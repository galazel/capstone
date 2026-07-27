"""Workflow run registry API.

Exposes what the checkpointer cannot: which runs exist, which are paused
waiting for a human, and what each one has done so far. This is the read
side the generation workspace is built on; the websocket layer (step 14)
pushes the same events these endpoints return.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.models import WorkflowEvent, WorkflowRun
from app.db.session import get_db
from app.services import certification_run
from app.services import workflow_registry as registry

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(require_service_key)],
)


def _recovery_state(db: Session, run: WorkflowRun) -> dict[str, Any]:
    """Whether this run can be retried or restarted, and from where.

    Sent with every run so the workspace can render the two recovery actions
    without a second round trip, and can label the retry with the step it
    would re-run rather than a bare "Retry".
    """
    recoverable = (
        run.kind == "CERTIFICATION" and run.status in certification_run.RECOVERABLE_STATUSES
    )
    return {
        "can_retry": recoverable,
        "can_restart": recoverable,
        "failed_stage": registry.last_failed_stage(db, run.run_id),
        "recovery_attempts": registry.recovery_attempts(db, run.run_id),
    }


def _run_to_dict(run: WorkflowRun) -> dict[str, Any]:
    return {
        "run_id": run.run_id,
        "thread_id": run.thread_id,
        "kind": run.kind,
        "certification_id": run.certification_id,
        "generation_request_id": run.generation_request_id,
        "triggered_by_user_id": run.triggered_by_user_id,
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_pct": run.progress_pct,
        "error_message": run.error_message,
        "last_seq": run.last_seq,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


def _event_to_dict(event: WorkflowEvent) -> dict[str, Any]:
    return {
        "seq": event.seq,
        "event_type": event.event_type,
        "stage": event.stage,
        "task_status": event.task_status,
        "duration_ms": event.duration_ms,
        "retry_count": event.retry_count,
        "payload": event.payload,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


@router.get("")
def list_workflow_runs(
    run_status: str | None = Query(default=None, alias="status"),
    certification_id: int | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    runs = registry.list_runs(
        db, status=run_status, certification_id=certification_id, limit=limit, offset=offset
    )
    return {"runs": [_run_to_dict(r) for r in runs], "count": len(runs)}


@router.get("/awaiting-review")
def list_awaiting_review(
    limit: int = Query(default=50, le=200), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Runs paused at a HITL checkpoint.

    Before the registry existed these were undiscoverable -- a paused run
    left `generation_requests` at PROCESSING with nothing pointing at it.
    """
    runs = registry.list_awaiting_review(db, limit=limit)
    return {"runs": [_run_to_dict(r) for r in runs], "count": len(runs)}


@router.get("/{run_id}")
def get_workflow_run(
    run_id: str,
    after_seq: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """A run plus its event timeline.

    `after_seq` returns only newer events, so a reconnecting client can
    catch up from where it left off instead of refetching everything.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")
    events = registry.list_events(db, run_id, after_seq=after_seq)
    return {
        **_run_to_dict(run),
        "recovery": _recovery_state(db, run),
        "events": [_event_to_dict(e) for e in events],
    }


@router.get("/by-thread/{thread_id}")
def get_workflow_run_by_thread(thread_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Lookup by LangGraph thread id -- the key the resume endpoints use."""
    run = registry.get_run_by_thread(db, thread_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run for thread {thread_id}")
    return {**_run_to_dict(run), "recovery": _recovery_state(db, run)}


@router.get("/{run_id}/versions")
def get_workflow_versions(
    run_id: str,
    key: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Artifact version history for a run, addressed by run id.

    The same data as the per-graph `/{thread_id}/versions` endpoints, keyed the
    way the workspace already addresses runs, so the UI does not have to hold
    both identifiers.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")
    return {
        "run_id": run_id,
        "thread_id": run.thread_id,
        "versions": registry.list_artifact_versions(db, run.thread_id, key=key),
    }


@router.get("/{run_id}/review")
async def get_pending_review(run_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """What the reviewer is being asked to judge, if this run is paused.

    The event log records *that* a review is waiting; the artifact itself lives
    in the LangGraph interrupt, which only the checkpointer holds. Without this
    the workspace could show that a run needs attention but not what for.

    Dispatches on the run's kind so the client does not need to know which graph
    produced it -- the workspace addresses everything by run id.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")

    if run.status != registry.WAITING_FOR_REVIEW:
        return {"run_id": run_id, "waiting": False, "review": None}

    if run.kind == "QUESTION_BANK":
        from app.graphs.question_bank.workflow import get_question_bank_graph

        graph = await get_question_bank_graph()
    else:
        from app.graphs.certification.workflow import get_certification_graph

        graph = await get_certification_graph()

    snapshot = await graph.aget_state({"configurable": {"thread_id": run.thread_id}})
    interrupts = snapshot.tasks[0].interrupts if (snapshot and snapshot.tasks) else ()
    if not interrupts:
        # The registry says waiting but the graph has no pending interrupt --
        # reported rather than papered over, because it means the two have
        # diverged and the run needs a human to look at it.
        logger.warning(
            "Run %s is WAITING_FOR_REVIEW but has no pending interrupt", run_id
        )
        return {"run_id": run_id, "waiting": False, "review": None, "desynced": True}

    return {
        "run_id": run_id,
        "thread_id": run.thread_id,
        "kind": run.kind,
        "waiting": True,
        "review": interrupts[0].value,
    }


@router.post("/{run_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_workflow_run(
    run_id: str, background: BackgroundTasks, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Re-runs the step this run failed on, keeping everything before it.

    LangGraph checkpoints after every superstep, so the thread is still parked
    with the failed node pending -- re-invoking runs exactly that node again.
    Retrying a curriculum call that died after a two-and-a-half minute document
    ingestion does not repeat the ingestion.

    Accepted rather than awaited: the run continues to the next review pause,
    which takes minutes. Progress arrives on the run's event stream, the same
    way the original attempt reported it.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")

    try:
        context, pending_stage = await certification_run.prepare_retry(run)
    except certification_run.RecoveryError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error

    attempt = registry.recovery_attempts(db, run_id) + 1
    registry.mark_retrying(db, run.thread_id, stage=pending_stage, attempt=attempt)
    background.add_task(certification_run.run_retry, context)

    return {
        **_run_to_dict(run),
        "retrying": True,
        "retrying_stage": pending_stage,
        "attempt": attempt,
    }


@router.post("/{run_id}/restart", status_code=status.HTTP_202_ACCEPTED)
async def restart_workflow_run(
    run_id: str, background: BackgroundTasks, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Discards this run's checkpoints and starts it again from the first step.

    For when the failure is in the run's state rather than in one step -- a bad
    ingestion, a curriculum that keeps coming back malformed, source documents
    that have since been corrected. Source documents are re-read from the
    certification, so a restart picks up anything uploaded since the failure.

    Keeps the run id and thread id, so the timeline shows the restart in
    context instead of appearing as an unrelated second run.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")

    try:
        context, seed = await certification_run.prepare_restart(run)
    except certification_run.RecoveryError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error

    attempt = registry.recovery_attempts(db, run_id) + 1
    registry.mark_restarted(db, run.thread_id, attempt=attempt)
    background.add_task(certification_run.run_restart, context, seed)

    return {**_run_to_dict(run), "restarting": True, "attempt": attempt}


@router.post("/{run_id}/cancel")
def cancel_workflow_run(run_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Requests cancellation of a run.

    Cooperative, and the timing differs by state:

    * paused for review -- effective immediately, because the graph is not
      executing; the resume endpoints then refuse it;
    * mid-generation -- effective at the next item boundary, since an
      in-flight LLM call cannot be aborted.

    Already-approved output is kept. Cancelling stops further work rather than
    discarding what a human already signed off on.
    """
    run = registry.get_run(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"No workflow run {run_id}")

    if run.status in registry.TERMINAL_STATUSES:
        # Idempotent rather than an error: two clicks, or a click racing a
        # completion, should not surface a failure.
        return {**_run_to_dict(run), "cancelled": run.status == registry.CANCELLED}

    updated = registry.mark_cancelled(db, run.thread_id)
    return {**_run_to_dict(updated or run), "cancelled": True}

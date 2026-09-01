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

    `stalled` is reported separately from the statuses, because a run that is
    RUNNING but has emitted nothing for a long time is not failed -- it was
    abandoned by a service restart, and the workspace has to say so rather than
    keep drawing a progress spinner for a run nobody is executing.
    """
    recoverable = certification_run.is_recoverable(run)
    # Only for the kind that has recovery actions: reporting a stalled question
    # bank run would surface a panel whose buttons cannot do anything.
    stalled = run.kind == "CERTIFICATION" and certification_run.is_stalled(run)
    return {
        "can_retry": recoverable,
        "can_restart": recoverable,
        "stalled": stalled,
        "idle_seconds": int(certification_run.idle_seconds(run)) if stalled else None,
        "failed_stage": registry.last_failed_stage(db, run.run_id),
        "attempt": registry.attempt_number(db, run.run_id),
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
        # The registry says waiting but the graph has no pending interrupt, so
        # the two have diverged. Reporting it was not enough: such a run is
        # unreachable, since `/review` has nothing to show and recovery accepts
        # only FAILED runs. Repair it against the checkpoint -- which either
        # marks the unrecorded failure (making Retry available) or finalises a
        # run that actually finished. Idempotent, and the workspace polls this
        # endpoint whenever a run reads as waiting, so a stranded run heals as
        # soon as anyone looks at it.
        if run.kind == "CERTIFICATION":
            repair = await certification_run.reconcile(run)
        else:
            logger.warning("Run %s is WAITING_FOR_REVIEW but has no pending interrupt", run_id)
            repair = {"reconciled": False, "reason": f"{run.kind} runs are not reconciled here."}

        db.refresh(run)
        return {
            "run_id": run_id,
            "waiting": False,
            "review": None,
            "desynced": True,
            "reconciled": repair.get("reconciled", False),
            "status": run.status,
            "recovery": _recovery_state(db, run),
        }

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

    # A retry continues the attempt it is part of rather than opening a new
    # one, so it reports the attempt it is repairing.
    attempt = registry.attempt_number(db, run_id)
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

    # +1 because this restart's own boundary event is recorded by the call below.
    attempt = registry.attempt_number(db, run_id) + 1
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


@router.delete("/certifications/{certification_id}")
async def purge_certification(certification_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Stops and erases everything this service holds for a certification.

    Called by the Java backend when an admin deletes a certification. Deleting
    one mid-generation used to leave the run untouched on this side: it carried
    on authoring lessons and questions against rows that no longer existed,
    spending tokens the whole way, and its timeline stayed in the workspace
    pointing at a certification nobody could open.

    Four things have to go, and cancelling has to come first -- a run stopped
    only *after* its rows are deleted would keep writing into the gap:

    1. the runs themselves, cancelled then deleted with their event log;
    2. the LangGraph checkpoints for those runs' threads;
    3. the indexed document vectors, which are scoped per certification
       (`namespace_for`) and are otherwise orphaned in Qdrant forever;
    4. nothing else -- the certification's own rows belong to Java, which
       deletes them itself.

    Step 2 was missing, and its absence was not cosmetic. `thread_id` is
    `str(generation_request_id)`, so an abandoned thread sits in `checkpoints`
    under an id a *later* request can be handed. Deleting the registry row
    while leaving the checkpoint behind is what produced runs whose progress
    view opened onto a previous certification's work: the row describing which
    run a thread belonged to was gone, and the thread was not.

    Idempotent: purging a certification with no runs is a success, not a 404,
    because the caller cannot know whether generation was ever started.
    """
    from app.rag.store import delete_index, namespace_for
    from app.utils.helpers import get_checkpointer

    summary = registry.purge_certification(db, certification_id)

    # Best-effort, like the vectors below: a leaked checkpoint is a storage
    # problem, while raising here would abort a delete the admin has already
    # committed to on the Java side.
    discarded = 0
    for thread_id in summary.get("thread_ids") or []:
        try:
            checkpointer = await get_checkpointer()
            await checkpointer.adelete_thread(thread_id)
            discarded += 1
        except Exception:
            logger.exception("Failed to discard checkpoints for thread %s", thread_id)
    summary["threads_discarded"] = discarded

    # Best-effort: losing the vectors is a storage leak, while failing here
    # would abort a deletion the admin has already committed to on the Java
    # side, leaving the two databases disagreeing about what exists.
    namespace = namespace_for(certification_id=certification_id)
    try:
        summary["vectors_deleted"] = delete_index(namespace)
    except Exception:
        logger.exception("Failed to delete vector index '%s'", namespace)
        summary["vectors_deleted"] = False

    logger.info("Purged certification %s: %s", certification_id, summary)
    return {"certification_id": certification_id, **summary}

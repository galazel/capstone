"""Tracking of LangGraph runs and the events they emit.

Answers the question the checkpointer cannot: *which runs exist, and which
are waiting for a human?* A HITL pause was previously invisible -- the run
sat at PROCESSING with no way for an admin to discover it or resume it.

The event log is append-only with a per-run monotonic `seq`, which is what
lets a reconnecting websocket client replay from `last_seq` rather than
losing the timeline.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import WorkflowEvent, WorkflowRun

logger = logging.getLogger(__name__)


# --- run statuses ---------------------------------------------------------
RUNNING = "RUNNING"
WAITING_FOR_REVIEW = "WAITING_FOR_REVIEW"
COMPLETED = "COMPLETED"
FAILED = "FAILED"
CANCELLED = "CANCELLED"

TERMINAL_STATUSES = {COMPLETED, FAILED, CANCELLED}

# --- event types (the workspace timeline renders these) -------------------
EVT_WORKFLOW_STARTED = "workflow.started"
EVT_NODE_STARTED = "node.started"
EVT_NODE_COMPLETED = "node.completed"
EVT_VALIDATION_COMPLETED = "validation.completed"
EVT_REVIEW_WAITING = "review.waiting"
EVT_REVIEW_SUBMITTED = "review.submitted"
EVT_WORKFLOW_RESUMED = "workflow.resumed"
EVT_WORKFLOW_COMPLETED = "workflow.completed"
EVT_WORKFLOW_FAILED = "workflow.failed"
#: Re-running the step that failed, from the checkpoint taken before it.
#: Distinct from RESUMED, which continues an intact run past a review.
EVT_WORKFLOW_RETRIED = "workflow.retried"
#: Discarding the run's checkpoints and starting over from the first step.
EVT_WORKFLOW_RESTARTED = "workflow.restarted"
#: Distinct from failure. Cancellation is a deliberate human decision, and the
#: workspace must not paint it red or invite the reviewer to retry it.
EVT_WORKFLOW_CANCELLED = "workflow.cancelled"

#: Event types after which no further events can arrive, so a stream can close.
TERMINAL_EVENTS = {EVT_WORKFLOW_COMPLETED, EVT_WORKFLOW_FAILED, EVT_WORKFLOW_CANCELLED}

# --- per-task statuses the workspace shows --------------------------------
TASK_PENDING = "PENDING"
TASK_RUNNING = "RUNNING"
TASK_COMPLETED = "COMPLETED"
TASK_WAITING_FOR_REVIEW = "WAITING_FOR_REVIEW"
TASK_RETRYING = "RETRYING"
TASK_FAILED = "FAILED"
TASK_SKIPPED = "SKIPPED"
TASK_CANCELLED = "CANCELLED"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def event_as_dict(event: WorkflowEvent) -> dict[str, Any]:
    """Wire form, shared by the REST timeline and the websocket stream so the
    two can never disagree about an event's shape."""
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


def _publish(run_id: str, events: list[WorkflowEvent]) -> None:
    """Fans out to websocket subscribers.

    Called only *after* a successful commit -- publishing at record time
    would broadcast events for a transaction that later rolled back, and a
    live client has no way to un-see them.
    """
    if not events:
        return
    # Imported lazily so the service layer does not depend on transport.
    from app.api.ws.broadcaster import get_broadcaster

    broadcaster = get_broadcaster()
    for event in events:
        broadcaster.publish(run_id, event_as_dict(event))


def publish_event(run_id: str, event: WorkflowEvent) -> None:
    """Fans out one already-committed event.

    The public form of `_publish` for callers outside this module (node
    instrumentation) that record and commit an event themselves. Same rule
    applies: call it only after the commit has succeeded.
    """
    _publish(run_id, [event])


def start_run(
    session: Session,
    *,
    thread_id: str,
    kind: str,
    certification_id: int | None = None,
    generation_request_id: int | None = None,
    triggered_by_user_id: int | None = None,
) -> WorkflowRun:
    """Registers a run, or revives the existing one for this thread.

    Resuming a paused run reuses its thread_id, so this is upsert-shaped:
    a second call for the same thread continues the existing timeline
    instead of creating a duplicate run with a fresh event sequence.
    """
    run = session.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    ).scalar_one_or_none()

    if run is not None:
        run.status = RUNNING
        run.updated_at = _now()
        session.flush()
        event = record_event(session, run, EVT_WORKFLOW_RESUMED, stage=run.current_stage)
        session.commit()
        _publish(run.run_id, [event])
        return run

    run = WorkflowRun(
        thread_id=thread_id,
        kind=kind,
        certification_id=certification_id,
        generation_request_id=generation_request_id,
        triggered_by_user_id=triggered_by_user_id,
        status=RUNNING,
        progress_pct=0,
    )
    session.add(run)
    session.flush()
    event = record_event(session, run, EVT_WORKFLOW_STARTED, task_status=TASK_RUNNING)
    session.commit()
    _publish(run.run_id, [event])
    return run


def record_event(
    session: Session,
    run: WorkflowRun,
    event_type: str,
    *,
    stage: str | None = None,
    task_status: str | None = None,
    duration_ms: int | None = None,
    retry_count: int = 0,
    payload: dict[str, Any] | None = None,
) -> WorkflowEvent:
    """Appends an event and advances the run's sequence counter.

    `seq` is allocated from the run row itself rather than from
    `max(seq)+1`, so two concurrent emitters cannot be handed the same
    number -- the row update serialises them.

    Does not commit: callers batch events into their own transaction.
    """
    run.last_seq += 1
    run.updated_at = _now()

    event = WorkflowEvent(
        run_id=run.run_id,
        seq=run.last_seq,
        event_type=event_type,
        stage=stage,
        task_status=task_status,
        duration_ms=duration_ms,
        retry_count=retry_count,
        payload=payload,
    )
    session.add(event)
    session.flush()
    return event


def _transition(
    session: Session,
    thread_id: str,
    *,
    status: str,
    event_type: str,
    stage: str | None = None,
    task_status: str | None = None,
    error_message: str | None = None,
    progress_pct: int | None = None,
    payload: dict[str, Any] | None = None,
    retry_count: int = 0,
    clear_error: bool = False,
    clear_stage: bool = False,
) -> WorkflowRun | None:
    run = session.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    ).scalar_one_or_none()
    if run is None:
        # Never fabricate a run: a missing registry row means the caller
        # started the graph without registering, which is a wiring bug worth
        # seeing rather than papering over.
        logger.warning("No workflow run registered for thread_id=%s", thread_id)
        return None

    run.status = status
    if clear_stage:
        run.current_stage = None
    if stage is not None:
        run.current_stage = stage
    if clear_error:
        run.error_message = None
    if error_message is not None:
        run.error_message = error_message
    if progress_pct is not None:
        run.progress_pct = progress_pct
    if status in TERMINAL_STATUSES:
        run.completed_at = _now()
        if status == COMPLETED:
            run.progress_pct = 100
    else:
        # A run leaving a terminal status (retry/restart of a failed run) must
        # not keep the completion timestamp of the attempt that died, or the
        # workspace shows it as finished while it is executing.
        run.completed_at = None

    event = record_event(
        session, run, event_type, stage=stage, task_status=task_status,
        retry_count=retry_count, payload=payload,
    )
    session.commit()
    _publish(run.run_id, [event])
    return run


def mark_waiting_for_review(
    session: Session, thread_id: str, *, stage: str, payload: dict[str, Any] | None = None
) -> WorkflowRun | None:
    """The transition that makes a paused run discoverable."""
    return _transition(
        session, thread_id, status=WAITING_FOR_REVIEW, event_type=EVT_REVIEW_WAITING,
        stage=stage, task_status=TASK_WAITING_FOR_REVIEW, payload=payload,
    )


def mark_review_submitted(
    session: Session, thread_id: str, *, stage: str | None, decision: str
) -> WorkflowRun | None:
    return _transition(
        session, thread_id, status=RUNNING, event_type=EVT_REVIEW_SUBMITTED,
        stage=stage, task_status=TASK_RUNNING, payload={"decision": decision},
    )


def mark_completed(
    session: Session, thread_id: str, *, payload: dict[str, Any] | None = None
) -> WorkflowRun | None:
    return _transition(
        session, thread_id, status=COMPLETED, event_type=EVT_WORKFLOW_COMPLETED,
        task_status=TASK_COMPLETED, payload=payload,
    )


def mark_failed(session: Session, thread_id: str, *, error: str) -> WorkflowRun | None:
    return _transition(
        session, thread_id, status=FAILED, event_type=EVT_WORKFLOW_FAILED,
        task_status=TASK_FAILED, error_message=error, payload={"error": error},
    )


def mark_retrying(
    session: Session, thread_id: str, *, stage: str | None, attempt: int
) -> WorkflowRun | None:
    """Re-running the failed step from the checkpoint taken before it.

    Clears `error_message`: leaving the previous failure on the row would
    make a run that is actively executing still read as broken.
    """
    return _transition(
        session, thread_id, status=RUNNING, event_type=EVT_WORKFLOW_RETRIED,
        stage=stage, task_status=TASK_RETRYING, clear_error=True,
        retry_count=attempt, payload={"stage": stage, "attempt": attempt},
    )


def mark_restarted(session: Session, thread_id: str, *, attempt: int) -> WorkflowRun | None:
    """Starting the run over from its first step.

    Resets progress to 0 -- the previous attempt's percentage describes work
    whose checkpoints have just been discarded.
    """
    return _transition(
        session, thread_id, status=RUNNING, event_type=EVT_WORKFLOW_RESTARTED,
        task_status=TASK_RUNNING, clear_error=True, clear_stage=True,
        progress_pct=0, retry_count=attempt, payload={"attempt": attempt},
    )


def mark_cancelled(session: Session, thread_id: str) -> WorkflowRun | None:
    return _transition(
        session, thread_id, status=CANCELLED, event_type=EVT_WORKFLOW_CANCELLED,
        task_status=TASK_CANCELLED,
    )


# --- reads ----------------------------------------------------------------

def list_runs(
    session: Session,
    *,
    status: str | None = None,
    certification_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[WorkflowRun]:
    query = select(WorkflowRun)
    if status:
        query = query.where(WorkflowRun.status == status)
    if certification_id is not None:
        query = query.where(WorkflowRun.certification_id == certification_id)
    query = query.order_by(WorkflowRun.started_at.desc()).limit(limit).offset(offset)
    return list(session.execute(query).scalars())


def list_awaiting_review(session: Session, limit: int = 50) -> list[WorkflowRun]:
    """The query the admin dashboard exists for."""
    return list_runs(session, status=WAITING_FOR_REVIEW, limit=limit)


def get_run(session: Session, run_id: str) -> WorkflowRun | None:
    return session.get(WorkflowRun, run_id)


def get_run_by_thread(session: Session, thread_id: str) -> WorkflowRun | None:
    return session.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    ).scalar_one_or_none()


def last_failed_stage(session: Session, run_id: str) -> str | None:
    """The step a run died on, for "Retry <step>" in the workspace.

    Read from the event log rather than `current_stage`: node instrumentation
    records which node failed, but only review/lifecycle transitions move
    `current_stage`, so on a failed run it still points at the last *review*.
    """
    event = session.execute(
        select(WorkflowEvent)
        .where(
            WorkflowEvent.run_id == run_id,
            WorkflowEvent.task_status == TASK_FAILED,
            WorkflowEvent.stage.is_not(None),
        )
        .order_by(WorkflowEvent.seq.desc())
        .limit(1)
    ).scalar_one_or_none()
    return event.stage if event is not None else None


def recovery_attempts(session: Session, run_id: str) -> int:
    """How many times this run has already been retried or restarted."""
    return len(
        session.execute(
            select(WorkflowEvent.seq).where(
                WorkflowEvent.run_id == run_id,
                WorkflowEvent.event_type.in_([EVT_WORKFLOW_RETRIED, EVT_WORKFLOW_RESTARTED]),
            )
        ).all()
    )


def list_events(
    session: Session, run_id: str, *, after_seq: int = 0, limit: int = 500
) -> list[WorkflowEvent]:
    """Events after `after_seq`, oldest first -- the websocket replay query."""
    return list(
        session.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.run_id == run_id, WorkflowEvent.seq > after_seq)
            .order_by(WorkflowEvent.seq)
            .limit(limit)
        ).scalars()
    )


# --- artifact version history --------------------------------------------
# Versions live in the event log, not in LangGraph state. Keeping the full
# artifact in state meant every regeneration grew a blob that was then
# re-serialized into every subsequent checkpoint -- the same write
# amplification that file bytes caused before Phase 2a step 5. State now
# holds only a reference; the artifact is fetched from the event log.

EVT_VERSION_RECORDED = "version.recorded"


def record_artifact_version(
    session: Session,
    thread_id: str,
    *,
    key: str,
    revision: int,
    source: str,
    artifact: Any,
    instructions: str | None = None,
) -> dict[str, Any] | None:
    """Appends one artifact version to the event log.

    Returns the lightweight reference to keep in graph state (no artifact),
    or None if the run is not registered.
    """
    run = session.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    ).scalar_one_or_none()
    if run is None:
        logger.warning("Cannot record version: no run for thread_id=%s", thread_id)
        return None

    event = record_event(
        session,
        run,
        EVT_VERSION_RECORDED,
        stage=key.split(":")[0] if ":" in key else None,
        payload={
            "key": key,
            "revision": revision,
            "source": source,
            "instructions": instructions,
            "artifact": artifact,
        },
    )
    session.commit()
    _publish(run.run_id, [event])

    return {
        "key": key,
        "revision": revision,
        "source": source,
        "instructions": instructions,
        # Where to fetch the artifact from, instead of carrying it.
        "event_seq": event.seq,
    }


def list_artifact_versions(
    session: Session, thread_id: str, *, key: str | None = None
) -> list[dict[str, Any]]:
    """Recorded versions for a run, optionally for one artifact key."""
    run = session.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    ).scalar_one_or_none()
    if run is None:
        return []

    events = session.execute(
        select(WorkflowEvent)
        .where(
            WorkflowEvent.run_id == run.run_id,
            WorkflowEvent.event_type == EVT_VERSION_RECORDED,
        )
        .order_by(WorkflowEvent.seq)
    ).scalars()

    versions = []
    for event in events:
        payload = event.payload or {}
        if key is not None and payload.get("key") != key:
            continue
        versions.append({**payload, "event_seq": event.seq})
    return versions

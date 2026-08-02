"""Executing a certification run, and recovering one that failed.

Everything after `graph.ainvoke` -- persisting the curriculum, saving the
generated assessments, marking the generation request, notifying the admin --
used to live inside the RabbitMQ consumer. That made the consumer the only
thing that could finish a run, so a failure had exactly one remedy: publish a
new message. Re-publishing does not help, because the new message reuses
`thread_id = str(generation_request_id)` and LangGraph picks the *existing*
checkpoint back up, landing on the same failed step with the same inputs.

So the run outcome handling lives here, and two recovery paths use it:

*Retry* re-runs only the step that failed. LangGraph checkpoints after every
superstep, so a node that raised leaves the thread parked with that node still
pending -- invoking with `None` re-executes exactly it, keeping everything the
run has already produced. A ~2.5 minute document ingestion is not repeated to
retry the 40-second curriculum call that failed after it.

*Restart* throws the run's checkpoints away and begins at step one with a
freshly rebuilt seed. That is the answer when the state itself is the problem
and no amount of re-running one node will help.

Both keep the run's `thread_id`, so the registry timeline, the generation
request, and any websocket client stay attached to the same run.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.db.session import SessionLocal
from app.graphs.cancellation import RunCancelled
from app.graphs.certification.workflow import get_certification_graph
from app.repositories import java_backend as repo
from app.services import workflow_registry as registry
from app.services.assessment_persistence import persist_generated_assessments

logger = logging.getLogger(__name__)


class RecoveryError(Exception):
    """A retry or restart cannot proceed. The message is shown to the admin."""


@dataclass(frozen=True)
class RunContext:
    """What finalisation needs to know beyond the graph result itself.

    A run started through `POST /certification/generate` has no generation
    request and no certification row, so the id fields are optional: that run
    reports its outcome through the response and the registry only, and the
    Java-side persistence below is skipped rather than half-applied.
    """

    thread_id: str
    certification_title: str
    certification_id: int | None = None
    generation_request_id: int | None = None
    triggered_by_user_id: int | None = None

    @property
    def persists_to_java(self) -> bool:
        return self.certification_id is not None and self.generation_request_id is not None


def _thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _notify(context: RunContext, title: str, body: str) -> None:
    if context.triggered_by_user_id is None:
        return
    with SessionLocal() as session:
        repo.insert_notification(
            session, user_id=context.triggered_by_user_id, title=title, body=body,
            href="/admin/certifications",
        )


def _persist_curriculum(certification_id: int, curriculum: dict) -> None:
    with SessionLocal() as session:
        # Written even when the planner returned nothing useful, so a rerun
        # that *does* find the exam's shape overwrites a stale value rather
        # than leaving the old one in place.
        structure = curriculum.get("exam_structure")
        if structure and (structure.get("total_items") or structure.get("question_types")):
            repo.update_certification_exam_structure(session, certification_id, structure)

        for major in curriculum.get("majorCategories") or []:
            major_id = repo.insert_major_category(session, certification_id, major["name"])
            for middle in major.get("middleCategories") or []:
                middle_id = repo.insert_middle_category(session, major_id, middle["name"])
                for lesson in middle.get("lessons") or []:
                    repo.insert_lesson(session, middle_id, lesson["name"], [])
        session.commit()


def fail(context: RunContext, error: str) -> dict[str, Any]:
    """Records a failed run everywhere an admin might look for it."""
    with SessionLocal() as session:
        if context.generation_request_id is not None:
            repo.mark_generation_request_failed(session, context.generation_request_id, error)
        registry.mark_failed(session, context.thread_id, error=error)
    _notify(
        context,
        f"Generation failed: {context.certification_title}",
        f"Curriculum generation for {context.certification_title} failed: {error}",
    )
    return {"outcome": registry.FAILED, "error": error}


def _stranded_output(summary: dict[str, Any]) -> list[str]:
    """Artifacts the run generated that reached the database as nothing.

    A *total* loss for a kind is what counts. A partial one already surfaces
    as a per-item warning and usually means a single unmatched name, whereas
    "produced seven, saved zero" is systemic -- an unseeded exam type, a
    missing table, a failed commit -- and must not be reported as success.
    """
    expected = summary.get("expected") or {}
    stranded = []

    if expected.get("exams") and not summary.get("exams"):
        stranded.append(f"{expected['exams']} assessment(s) generated, none stored")
    if expected.get("bank_questions") and not summary.get("bank_questions"):
        stranded.append(f"{expected['bank_questions']} question(s) generated, none stored")
    if expected.get("lessons") and not summary.get("lessons_written"):
        stranded.append(f"{expected['lessons']} lesson bod(y/ies) generated, none stored")

    return stranded


def finalize(context: RunContext, result: dict) -> dict[str, Any]:
    """Turns a graph result into run status, persisted output, and a notice.

    Three non-success shapes are handled before the happy path, because each
    means something different to a reviewer: a HITL pause is not a failure and
    must leave the run resumable; a validation failure is the documents'
    fault; an empty curriculum is the model's.
    """
    if "__interrupt__" in result:
        interrupt_value = result["__interrupt__"][0].value or {}
        stage = interrupt_value.get("stage", "UNKNOWN")
        with SessionLocal() as session:
            registry.mark_waiting_for_review(
                session, context.thread_id, stage=stage,
                payload={"validation_report": interrupt_value.get("validation_report")},
            )
        logger.info(
            "Certification run %s paused for admin review at %s; resume via "
            "POST /certification/%s/resume.",
            context.thread_id, stage, context.thread_id,
        )
        return {"outcome": registry.WAITING_FOR_REVIEW, "stage": stage}

    if result.get("status") == "VALIDATION_FAILED":
        return fail(
            context,
            result.get("error_message")
            or "Uploaded documents do not match the certification topics.",
        )

    curriculum = result.get("curriculum")
    if not curriculum or not curriculum.get("majorCategories"):
        return fail(context, "Generation completed without a usable curriculum.")

    if not context.persists_to_java:
        # A direct-upload run: no certification row to attach output to. The
        # caller gets the artifacts in the HTTP response.
        with SessionLocal() as session:
            registry.mark_completed(session, context.thread_id)
        return {"outcome": registry.COMPLETED, "exams": 0, "bank_questions": 0}

    _persist_curriculum(context.certification_id, curriculum)

    # Curriculum alone used to be the end of it -- the generated quizzes,
    # exams, and question bank were discarded with the checkpoint. Persist
    # them too, as DRAFT, so nothing an admin approved is lost.
    with SessionLocal() as session:
        summary = persist_generated_assessments(session, context.certification_id, result)
    for warning in summary["warnings"]:
        logger.warning("Assessment persistence: %s", warning)

    stranded = _stranded_output(summary)
    if stranded:
        # The run did the work and the storage layer dropped it. Reporting
        # COMPLETED here is how a certification came to show two lessons and
        # no assessments while the log said success -- the drops were only
        # ever warnings, and warnings scroll past.
        return fail(
            context,
            "Generation succeeded but its output was not saved: "
            + "; ".join(stranded)
            + ". The run can be retried once the cause is fixed.",
        )

    with SessionLocal() as session:
        repo.mark_generation_request_done(session, context.generation_request_id)
        registry.mark_completed(
            session, context.thread_id,
            payload={"exams": len(summary["exams"]), "bank_questions": summary["bank_questions"]},
        )

    _notify(
        context,
        f"Curriculum ready: {context.certification_title}",
        f"AI-generated curriculum for {context.certification_title} is ready for review, "
        f"along with {len(summary['exams'])} assessment(s) and "
        f"{summary['bank_questions']} question-bank item(s), all saved as drafts.",
    )
    logger.info(
        "Certification run %s completed: curriculum + %d exam(s) + %d bank question(s) persisted",
        context.thread_id, len(summary["exams"]), summary["bank_questions"],
    )
    return {
        "outcome": registry.COMPLETED,
        "exams": len(summary["exams"]),
        "bank_questions": summary["bank_questions"],
    }


#: Threads this process is executing right now.
#:
#: `updated_at` says when a run last recorded something, which is enough to
#: spot an abandoned run but not enough to protect a live one: a run that has
#: just started, or one on a genuinely long step, is quiet without being dead.
#: This is the direct answer for the only process that can know it -- the one
#: holding the asyncio task -- and it is what stops recovery, or a redelivered
#: queue message, from putting a second driver on a thread already being driven.
#:
#: Deliberately in-memory: its whole purpose is to be empty after a restart,
#: because a restart is precisely when nothing is being driven any more.
_DRIVEN_THREADS: set[str] = set()


def is_being_driven(thread_id: str) -> bool:
    """Whether this process is currently executing that thread."""
    return thread_id in _DRIVEN_THREADS


class RunFailed(RuntimeError):
    """The graph raised. The run is already marked failed and the admin
    notified; this carries the outcome out to a caller that needs to report it.
    """

    def __init__(self, outcome: dict[str, Any]) -> None:
        super().__init__(outcome.get("error") or "Certification run failed.")
        self.outcome = outcome


async def advance(context: RunContext, graph_input: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """Drives the thread one step further and applies whatever came of it,
    returning `(graph result, finalisation outcome)`.

    Both halves are returned because the two callers need different ones: the
    consumer reports the outcome, while the HTTP routes have to hand the
    reviewer the interrupt payload inside the raw result.

    Every path that moves a certification thread goes through here, so the
    checkpoint can never advance without the registry and the Java side being
    told what happened. The HTTP resume route used to call `graph.ainvoke`
    directly, which meant a run resumed from a review pause reported nothing:
    on success the curriculum, assessments, and generation request were never
    persisted, and on failure the run stayed WAITING_FOR_REVIEW while its
    checkpoint moved past the interrupt -- leaving it stuck, since only FAILED
    runs are retryable.

    Raises `RunFailed` rather than returning an outcome, so a caller cannot
    mistake a failure for a result.
    """
    graph = await get_certification_graph()
    _DRIVEN_THREADS.add(context.thread_id)
    try:
        result = await graph.ainvoke(graph_input, config=_thread_config(context.thread_id))
    except RunCancelled as cancelled:
        # Already CANCELLED in the registry -- the graph is unwinding on
        # purpose. Marking it FAILED here would report a reviewer's own
        # decision as a generator bug, and offer to retry the work they just
        # stopped.
        logger.info("Certification run %s stopped: %s", context.thread_id, cancelled)
        raise RunFailed({"outcome": registry.CANCELLED, "error": str(cancelled)}) from cancelled
    except Exception as error:
        logger.exception("Certification run %s failed", context.thread_id)
        raise RunFailed(fail(context, str(error))) from error
    finally:
        # Released as soon as the graph returns or raises. Finalisation below
        # is database work measured in milliseconds, and holding the claim
        # across it would only delay a legitimate recovery.
        _DRIVEN_THREADS.discard(context.thread_id)

    return result, finalize(context, result)


async def execute(context: RunContext, graph_input: Any) -> dict[str, Any]:
    """Runs the graph to its next stopping point and finalises the outcome.

    `graph_input` is the seed state for a fresh run, or `None` to resume the
    thread's pending work -- which is what makes a retry re-run only the step
    that failed.
    """
    try:
        _, outcome = await advance(context, graph_input)
    except RunFailed as failure:
        return failure.outcome

    return outcome


# --- recovery -------------------------------------------------------------

#: Statuses a run can always be retried or restarted from.
RECOVERABLE_STATUSES = {registry.FAILED}


#: How quiet a run must be before reconciliation will touch it. Comfortably
#: longer than the gap between a node finishing and the next one starting --
#: including a rate-limit backoff, which routinely idles a healthy run for
#: tens of seconds without emitting anything.
RECONCILE_AFTER_IDLE_SECONDS = 180.0


#: How long a RUNNING run must emit nothing before it is treated as abandoned
#: rather than busy.
#:
#: A run is driven by an in-process asyncio task, so *nothing* survives the
#: process it was started in. Kill the service mid-generation and the registry
#: row is left claiming RUNNING forever with no one executing it -- and because
#: only FAILED runs were recoverable, that run was a permanent dead end: no
#: retry, no restart, and a certification stuck on "Generating…" for good.
#:
#: Every node boundary records an event, which bumps `updated_at`. Silence for
#: this long therefore means no node has started or finished in that window,
#: which no healthy run does -- the longest single step (deep lesson authoring)
#: is minutes, not this. Set well above the reconcile threshold because being
#: late to adopt an orphan costs a wait, while adopting a live run would put two
#: drivers on one thread.
STALLED_AFTER_IDLE_SECONDS = 900.0


def _seconds_since(moment) -> float:
    """Age of a timestamp, tolerating a naive one.

    The column is timezone-aware, but not every backend hands it back that
    way. An unreadable timestamp reports as infinitely old rather than
    blocking a repair -- the interrupt check below is the real safeguard.
    """
    if not isinstance(moment, datetime):
        return float("inf")
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - moment).total_seconds()


def idle_seconds(run) -> float:
    """How long since this run last recorded anything."""
    return _seconds_since(run.updated_at)


def is_stalled(run) -> bool:
    """Whether a RUNNING run has gone silent long enough to be abandoned.

    See `STALLED_AFTER_IDLE_SECONDS`. Only meaningful for RUNNING: a paused or
    terminal run is *supposed* to be quiet.
    """
    return (
        run.status == registry.RUNNING
        and _seconds_since(run.updated_at) >= STALLED_AFTER_IDLE_SECONDS
    )


def is_recoverable(run) -> bool:
    """Whether Retry/Restart may be offered for this run.

    A failed run always qualifies. A stalled one does too, which is the escape
    hatch for a run orphaned by a service restart: the startup sweep adopts
    those automatically, but a run orphaned while the sweep's grace period had
    already elapsed -- or one the sweep could not finish -- would otherwise stay
    unreachable until someone edited the database.
    """
    if run.kind != "CERTIFICATION":
        return False
    if is_being_driven(run.thread_id):
        # Whatever the row says, this process is executing it. Offering Retry
        # here would start a second driver on a thread that is very much alive.
        return False
    return run.status in RECOVERABLE_STATUSES or is_stalled(run)


def _has_pending_interrupt(snapshot) -> bool:
    """Whether the thread is actually parked at a HITL interrupt.

    Read from the tasks rather than from `snapshot.next`, because a thread
    with a *failed* node pending also has a non-empty `next` -- and telling
    those two apart is the entire point of the reconciliation below.
    """
    return any(getattr(task, "interrupts", None) for task in (getattr(snapshot, "tasks", None) or ()))


async def reconcile(run) -> dict[str, Any]:
    """Brings a run's registry status back in line with its checkpoint.

    The two can only disagree in one direction: the graph is the source of
    truth and the registry is told afterwards, so anything that interrupts
    that handoff strands a run claiming WAITING_FOR_REVIEW while its thread
    has already moved on. Such a run is unreachable -- `/review` has nothing
    to show, and recovery refuses it because only FAILED runs are retryable.

    The live case was a resume that raised outside the run lifecycle, now
    fixed at source in `advance`; a process killed between `ainvoke` returning
    and the registry write leaves the same wreckage, so the repair stays.

    What the thread holds decides the outcome:

    * a pending interrupt -- genuinely paused, left alone;
    * pending work but no interrupt -- the resumed step died without being
      recorded, so record it now and let Retry re-run exactly that step;
    * nothing pending -- the graph finished and only the handoff was lost, so
      finalise it rather than strand the output in a checkpoint nobody reads.

    Idempotent: a reconciled run is no longer WAITING_FOR_REVIEW, so a second
    call is a no-op.
    """
    if run.kind != "CERTIFICATION":
        return {"reconciled": False, "reason": f"{run.kind} runs are not reconciled here."}
    if run.status != registry.WAITING_FOR_REVIEW:
        return {"reconciled": False, "reason": f"Run is {run.status}, not awaiting review."}

    # Every event bumps `updated_at`, so a run that is emitting anything is a
    # run still doing something. Repairing one is how a *live* run twice got
    # marked failed while it was mid-generation. A genuinely stranded run has
    # nothing left to emit, so waiting out the grace period costs it nothing.
    idle_for = _seconds_since(run.updated_at)
    if idle_for < RECONCILE_AFTER_IDLE_SECONDS:
        return {
            "reconciled": False,
            "reason": f"Run emitted an event {idle_for:.0f}s ago; still progressing.",
        }

    graph = await get_certification_graph()
    snapshot = await graph.aget_state(_thread_config(run.thread_id))

    if _has_pending_interrupt(snapshot):
        return {"reconciled": False, "reason": "Run is genuinely awaiting review."}

    context = context_for(run)

    if snapshot is None or not snapshot.values:
        logger.warning("Run %s claims review but has no checkpoint at all", run.run_id)
        return {
            "reconciled": True,
            "outcome": fail(context, "The run's checkpoint is gone. Restart it."),
        }

    if snapshot.next:
        stage = snapshot.next[0]
        logger.warning(
            "Reconciling run %s: claimed WAITING_FOR_REVIEW, but %s is pending with no interrupt",
            run.run_id, stage,
        )
        return {
            "reconciled": True,
            "outcome": fail(context, f"Resuming failed inside {stage}; the run can be retried."),
        }

    logger.info("Reconciling run %s: the graph finished but the outcome was never applied", run.run_id)
    return {"reconciled": True, "outcome": finalize(context, dict(snapshot.values))}


async def adopt_orphan(run) -> dict[str, Any]:
    """Takes over a RUNNING run that nothing is executing, and finishes it.

    The counterpart to `reconcile` for the other way a run is stranded. A
    certification run is driven by an asyncio task inside this process, so a
    restart -- a crash, a deploy, a reload -- abandons every run mid-flight
    while the registry row still says RUNNING.

    RabbitMQ recovers the common case on its own: the message for a run started
    from the queue is still unacked, so the broker redelivers it and the
    consumer opens a fresh attempt. But that only covers runs whose queue
    message is outstanding. A run resumed from a review over HTTP, or one being
    retried or restarted from the workspace, has no message behind it at all --
    those simply died, and stayed RUNNING forever.

    What the checkpoint holds decides the outcome, exactly as in `reconcile`:
    a pending interrupt means it reached a review and the status write was
    lost; pending work means a step never finished, so re-run it from the
    checkpoint taken before it; nothing pending means the graph finished and
    only the handoff was lost.

    Idempotent in practice: the caller only passes runs that have been silent
    past `STALLED_AFTER_IDLE_SECONDS`, and the first thing every branch does is
    move the run off RUNNING.
    """
    context = context_for(run)
    graph = await get_certification_graph()
    snapshot = await graph.aget_state(_thread_config(run.thread_id))

    if snapshot is None or not snapshot.values:
        # Nothing to resume from. Failing it is what makes Restart available,
        # which re-reads the certification's documents and begins again.
        logger.warning("Orphaned run %s has no checkpoint to resume from", run.run_id)
        return {
            "action": "failed",
            "outcome": fail(
                context,
                "The service restarted while this run was executing, and it has no "
                "checkpoint to resume from. Restart it.",
            ),
        }

    interrupts = [
        interrupt
        for task in (getattr(snapshot, "tasks", None) or ())
        for interrupt in (getattr(task, "interrupts", None) or ())
    ]
    if interrupts:
        stage = (interrupts[0].value or {}).get("stage", "UNKNOWN")
        logger.info(
            "Orphaned run %s had already paused for review at %s; recording the pause",
            run.run_id, stage,
        )
        with SessionLocal() as session:
            registry.mark_waiting_for_review(
                session, run.thread_id, stage=stage,
                payload={"validation_report": (interrupts[0].value or {}).get("validation_report")},
            )
        return {"action": "waiting_for_review", "stage": stage}

    if snapshot.next:
        stage = snapshot.next[0]
        logger.info(
            "Adopting orphaned run %s: re-running %s from its last checkpoint",
            run.run_id, stage,
        )
        with SessionLocal() as session:
            attempt = registry.attempt_number(session, run.run_id)
            registry.mark_retrying(session, run.thread_id, stage=stage, attempt=attempt)
        # `None` resumes the pending step rather than starting over, so the
        # minutes of ingestion and generation already paid for are kept.
        return {"action": "resumed", "stage": stage, "outcome": await execute(context, None)}

    logger.info("Orphaned run %s had finished; applying the outcome it never reported", run.run_id)
    return {"action": "finalized", "outcome": finalize(context, dict(snapshot.values))}


def _load_java_context(run) -> tuple[dict | None, dict | None]:
    """The generation request and certification rows behind a run, if any."""
    if run.generation_request_id is None or run.certification_id is None:
        return None, None
    with SessionLocal() as session:
        return (
            repo.get_generation_request(session, run.generation_request_id),
            repo.get_certification(session, run.certification_id),
        )


def context_for(run) -> RunContext:
    """Rebuilds the finalisation context for an existing run row."""
    generation_request, certification = _load_java_context(run)
    title = (certification or {}).get("title") or f"certification {run.certification_id}"
    return RunContext(
        thread_id=run.thread_id,
        certification_title=title,
        certification_id=run.certification_id if certification else None,
        generation_request_id=run.generation_request_id if generation_request else None,
        triggered_by_user_id=(
            (generation_request or {}).get("triggered_by_user_id") or run.triggered_by_user_id
        ),
    )


def _guard(run, action: str) -> None:
    if run.kind != "CERTIFICATION":
        raise RecoveryError(f"Run {run.run_id} is a {run.kind} run, not a certification run.")
    if run.status == registry.CANCELLED:
        raise RecoveryError(f"Run {run.run_id} was cancelled and cannot be {action}.")
    if is_being_driven(run.thread_id):
        raise RecoveryError(
            f"Run {run.run_id} is executing right now and cannot be {action}. "
            "Stop it first if you want it to stop."
        )
    if not is_recoverable(run):
        if run.status == registry.RUNNING:
            # Distinct from the generic refusal: this run *will* become
            # recoverable on its own if it really is dead, and saying so stops
            # an admin hammering the button.
            raise RecoveryError(
                f"Run {run.run_id} is still executing. It becomes recoverable "
                f"after {int(STALLED_AFTER_IDLE_SECONDS / 60)} minutes of silence."
            )
        raise RecoveryError(
            f"Only failed or stalled runs can be {action}; run {run.run_id} is {run.status}."
        )


async def _snapshot_values(thread_id: str) -> dict:
    graph = await get_certification_graph()
    snapshot = await graph.aget_state(_thread_config(thread_id))
    return dict(snapshot.values) if snapshot and snapshot.values else {}


async def prepare_retry(run) -> tuple[RunContext, str | None]:
    """Validates that a retry is possible and reports the step it will re-run.

    Fails loudly when the checkpointer has nothing pending: resuming such a
    thread with `None` would run it from wherever it happens to be rather
    than re-running the failed step, which is not what the button promised.
    """
    _guard(run, "retried")

    graph = await get_certification_graph()
    snapshot = await graph.aget_state(_thread_config(run.thread_id))
    if snapshot is None or not snapshot.values:
        raise RecoveryError(
            f"Run {run.run_id} has no checkpoint to retry from. Restart it instead."
        )
    if not snapshot.next:
        raise RecoveryError(
            f"Run {run.run_id} has no pending step to retry. Restart it instead."
        )
    return context_for(run), (snapshot.next[0] if snapshot.next else None)


async def prepare_restart(run) -> tuple[RunContext, dict]:
    """Validates a restart and builds the seed state for the fresh attempt.

    Source documents are re-read from Java when the run has a certification,
    so a restart picks up documents added since the failed attempt. For a
    direct-upload run the only copy of the inputs is the old checkpoint, which
    is read here -- before anything is deleted.
    """
    _guard(run, "restarted")

    generation_request, certification = _load_java_context(run)

    if certification is not None and generation_request is not None:
        with SessionLocal() as session:
            documents = repo.list_knowledge_documents(session, run.certification_id, "LESSON")
        seed = {
            "thread_id": run.thread_id,
            "certification_id": run.certification_id,
            "certification_name": certification["title"],
            "certification_description": certification["description"] or "",
            "industry": certification["industry"] or "",
            "document_refs": document_refs_from(documents),
            "status": "STARTED",
        }
        if not seed["document_refs"]:
            raise RecoveryError(
                f"Certification {run.certification_id} has no stored source documents to "
                f"restart from. Re-upload them and start a new generation."
            )
        return context_for(run), seed

    values = await _snapshot_values(run.thread_id)
    if not values:
        raise RecoveryError(f"Run {run.run_id} has no checkpoint to rebuild its inputs from.")

    seed = {
        "thread_id": run.thread_id,
        "certification_name": values.get("certification_name", ""),
        "certification_description": values.get("certification_description", ""),
        "industry": values.get("industry", ""),
        "status": "STARTED",
    }
    if values.get("certification_id") is not None:
        seed["certification_id"] = values["certification_id"]

    # `uploaded_files` is deliberately cleared once ingested, so a run that
    # got past ingestion no longer carries its own bytes. Refusing is the
    # honest outcome: restarting without documents would quietly generate a
    # curriculum from the title alone.
    document_refs = values.get("document_refs") or []
    uploaded_files = values.get("uploaded_files") or []
    if not document_refs and not uploaded_files:
        raise RecoveryError(
            f"Run {run.run_id} was started from a direct upload whose file contents are no "
            f"longer held. Start a new generation with the documents attached."
        )
    if document_refs:
        seed["document_refs"] = document_refs
    if uploaded_files:
        seed["uploaded_files"] = uploaded_files

    return context_for(run), seed


async def run_retry(context: RunContext) -> dict[str, Any]:
    """Re-executes the pending (failed) step and everything after it."""
    _reopen_generation_request(context)
    return await execute(context, None)


async def run_restart(context: RunContext, seed: dict) -> dict[str, Any]:
    """Discards the thread's checkpoints and its vector index, then runs from
    the first step.

    Deleting the checkpoints is what makes this a true restart: LangGraph
    resolves a thread's starting point from its checkpoints, so invoking a
    seed on a thread that still has them would resume mid-run instead of
    beginning again.

    Deleting the index matters just as much. `rag.store.add_documents` is
    additive by design -- so that a second document set extends a
    certification's knowledge base rather than erasing it -- which means a
    restart that skipped this step would re-ingest the same documents and
    leave every chunk in the index twice, once more per restart.
    """
    from app.rag.store import delete_index, namespace_for
    from app.utils.helpers import get_checkpointer

    checkpointer = await get_checkpointer()
    await checkpointer.adelete_thread(context.thread_id)
    logger.info("Discarded checkpoints for thread %s ahead of restart", context.thread_id)

    namespace = namespace_for(
        certification_id=seed.get("certification_id"),
        certification_name=seed.get("certification_name", ""),
    )
    if delete_index(namespace):
        logger.info("Discarded FAISS index '%s' ahead of restart", namespace)

    _reopen_generation_request(context)
    return await execute(context, seed)


def _reopen_generation_request(context: RunContext) -> None:
    """Moves the Java-side request off FAILED before the attempt begins.

    Without this the admin list keeps showing the certification as failed for
    the whole of a retry that may well succeed.
    """
    if context.generation_request_id is None:
        return
    with SessionLocal() as session:
        repo.mark_generation_request_processing(session, context.generation_request_id)


def document_refs_from(documents: list[dict]) -> list[dict]:
    """S3 pointers, not bytes -- the graph fetches each document on demand.

    Embedding contents in the seed would put them in every checkpoint the run
    writes from then on.
    """
    return [
        {
            "s3_key": doc["s3_key"],
            "filename": doc["original_filename"],
            "content_type": doc["content_type"],
        }
        for doc in documents
        if doc["s3_key"]
    ]

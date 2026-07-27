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

import json
import logging
from dataclasses import dataclass
from typing import Any

from app.db.session import SessionLocal
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


async def execute(context: RunContext, graph_input: Any) -> dict[str, Any]:
    """Runs the graph to its next stopping point and finalises the outcome.

    `graph_input` is the seed state for a fresh run, or `None` to resume the
    thread's pending work -- which is what makes a retry re-run only the step
    that failed.
    """
    try:
        graph = await get_certification_graph()
        result = await graph.ainvoke(graph_input, config=_thread_config(context.thread_id))
    except Exception as error:
        logger.exception("Certification run %s failed", context.thread_id)
        return fail(context, str(error))

    return finalize(context, result)


# --- recovery -------------------------------------------------------------

#: Statuses a run can be retried or restarted from. A run that is RUNNING is
#: either genuinely executing or was orphaned by a process restart, and the
#: registry cannot tell those apart -- so it is excluded rather than risk two
#: workers driving one thread.
RECOVERABLE_STATUSES = {registry.FAILED}


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
    if run.status not in RECOVERABLE_STATUSES:
        raise RecoveryError(
            f"Only failed runs can be {action}; run {run.run_id} is {run.status}."
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

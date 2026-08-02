import asyncio
import logging

from app.ai.invocation import invoke_question_agent, questions_as_dicts
from app.graphs.cancellation import is_cancel_requested
from app.graphs.certification.review_loop import SOURCE_RESTORED, normalize_action
from app.graphs.question_bank.versions import record_batch_version
from app.domain.validation import validate_question_batch
from app.rag.loaders import resolve_documents
from app.rag.retriever import retrieve_context
from app.rag.store import namespace_for
from langgraph.types import interrupt

from .state import QuestionBankState

logger = logging.getLogger(__name__)

async def resolve_scope_node(state: QuestionBankState):
    """Resolves the reference context once, up front: uploaded-file text
    and/or certification-knowledge retrieved from the vector store,
    filtered to this certification. Every batch reuses this same context."""
    documents = await asyncio.to_thread(
        resolve_documents, state.get("document_refs"), state.get("uploaded_files")
    )
    pieces = [doc.page_content for doc in documents]

    certification_name = state.get("certification_name")
    certification_id = state.get("certification_id")
    if certification_name or certification_id is not None:
        # retrieve_context returns "" when this certification has no index
        # yet (e.g. a bank generated purely from freshly uploaded files),
        # which is a valid degraded state rather than an error. The previous
        # bare `except: pass` also hid genuine failures.
        retrieved = await asyncio.to_thread(
            retrieve_context,
            namespace_for(certification_id=certification_id, certification_name=certification_name or ""),
            f"{state.get('scope_label', '')} {certification_name or ''}".strip(),
        )
        if retrieved:
            pieces.append(retrieved)
        else:
            logger.info("No indexed context for '%s'; using uploaded files only", certification_name)

    return {
        "reference_context": "\n\n---\n\n".join(pieces)[:20000],
        # Reference context is resolved once and reused by every batch, so
        # the raw bytes are dead weight from here on -- drop them rather
        # than re-serializing them into each per-batch checkpoint.
        "uploaded_files": [],
        "generated_count": 0,
        "status": "SCOPE_RESOLVED",
    }


def _scope_description(state: QuestionBankState) -> str:
    scope_type = state.get("scope_type", "CERTIFICATION")
    label = state.get("scope_label") or state.get("certification_name", "")
    return f"{scope_type} question bank batch for '{label}' (certification: {state.get('certification_name', '')})"


async def generate_batch_node(state: QuestionBankState):
    """Generates (or regenerates) the current batch. Reused for the first
    pass, "Regenerate" (fresh version, no guidance), and "Improve with AI"
    (fresh version guided by review_instructions) — the only difference is
    whether review_instructions is set."""
    target_total = state.get("target_total", 100)
    batch_size = state.get("batch_size", 20)
    remaining = max(0, target_total - state.get("generated_count", 0))
    count = min(batch_size, remaining) if remaining else batch_size

    distribution = state.get("type_distribution")
    instructions = state.get("review_instructions")
    is_improvement = bool(instructions)

    base_instructions = (
        f"Generate exactly {count} questions for this batch."
        + (f" Distribute types approximately as: {distribution}." if distribution else
           " Mix MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, and DIAGRAM types.")
    )
    if is_improvement:
        base_instructions += f"\n\nAdmin feedback on the previous version of this batch — apply it: {instructions}"

    batch = await invoke_question_agent(
        _scope_description(state), state.get("reference_context", ""), base_instructions,
        count=count,
    )
    questions = questions_as_dicts(batch)

    return {
        "current_batch": questions,
        "version_refs": record_batch_version(
            state,
            questions=questions,
            source="AI_IMPROVED" if is_improvement else "AI_GENERATED",
            instructions=instructions,
        ),
        "review_instructions": None,
        "status": "BATCH_GENERATED",
    }


async def validate_batch_node(state: QuestionBankState):
    """Runs deterministic quality checks before the admin sees the batch.

    Previously this graph had no validation stage at all -- every generated
    batch went straight to review with nothing but the questions themselves,
    so duplicates and recall-only coverage were the reviewer's problem to
    spot by eye.

    Advisory by design: a failing report does not block, it is attached to
    the review payload so the admin can decide whether to approve, improve,
    or regenerate.
    """
    batch = state.get("current_batch", []) or []
    expected = min(
        state.get("batch_size", len(batch)),
        max(0, state.get("target_total", 0) - state.get("generated_count", 0)) or len(batch),
    )
    report = validate_question_batch(batch, expected_count=expected or None)

    if not report.passed:
        logger.warning(
            "Batch validation found %d error(s): %s",
            len(report.errors),
            [issue.code for issue in report.errors],
        )
    elif report.warnings:
        logger.info(
            "Batch validation warnings: %s", [issue.code for issue in report.warnings]
        )

    return {
        "validation_report": report.model_dump(mode="json"),
        "status": "BATCH_VALIDATED",
    }


def await_batch_review_node(state: QuestionBankState):
    """HITL checkpoint after every batch. Resume with:
    Command(resume={"action": "approve"}) — continue to the next batch
    Command(resume={"action": "edit", "questions": [...]}) — replace with admin edits, then continue
    Command(resume={"action": "improve", "instructions": "..."}) — regenerate this batch with guidance
    Command(resume={"action": "regenerate"}) — regenerate this batch, no guidance
    Command(resume={"action": "reject"}) — discard this batch, pause again for the next decision
    """
    decision = interrupt({
        "stage": "QUESTION_BATCH",
        "batch": state.get("current_batch", []),
        # Surfaced alongside the artifact so the admin reviews content and
        # its quality report together, per the Phase 2 brief.
        "validation_report": state.get("validation_report"),
        "generated_count": state.get("generated_count", 0),
        "target_total": state.get("target_total", 0),
    })
    raw = decision if isinstance(decision, str) else (decision or {}).get("action", "approve")
    action = normalize_action(raw)
    decision = decision if isinstance(decision, dict) else {}
    return {
        "review_action": action,
        "review_instructions": decision.get("instructions") if action == "improve" else None,
        "review_edited_questions": decision.get("questions") if action == "edit" else None,
        # A restore arrives as an edit carrying an earlier batch.
        "review_restored_from": decision.get("restored_from") if action == "edit" else None,
        "status": f"BATCH_{action.upper()}",
    }


def route_after_batch_review(state: QuestionBankState) -> str:
    action = state.get("review_action", "approve")
    if action == "edit":
        return "apply_edit"
    if action in ("improve", "regenerate"):
        return "regenerate_batch"
    if action == "reject":
        return "reject_batch"
    return "commit"


def apply_edit_node(state: QuestionBankState):
    edited = state.get("review_edited_questions") or state.get("current_batch", [])
    restored_from = state.get("review_restored_from")
    # Re-validate inline: a hand-written duplicate is still a duplicate, and
    # the stored report should describe what actually gets committed rather
    # than the superseded AI version.
    report = validate_question_batch(edited)
    return {
        "current_batch": edited,
        "version_refs": record_batch_version(
            state,
            questions=edited,
            source=SOURCE_RESTORED if restored_from else "MANUAL_EDIT",
            instructions=f"Restored from revision {restored_from}" if restored_from else None,
        ),
        "validation_report": report.model_dump(mode="json"),
        "review_edited_questions": None,
        "review_restored_from": None,
        "status": "BATCH_RESTORED" if restored_from else "BATCH_EDITED",
    }


def reject_batch_node(state: QuestionBankState):
    return {
        "current_batch": [],
        "review_action": None,
        "status": "BATCH_REJECTED",
    }


def commit_batch_node(state: QuestionBankState):
    # The model (or a manual edit) is only ever asked for `remaining`
    # questions, not structurally limited to it — cap here so a batch that
    # overshoots can never push generated_count past target_total.
    remaining = max(0, state.get("target_total", 0) - state.get("generated_count", 0))
    batch = (state.get("current_batch", []) or [])[:remaining] if remaining else state.get("current_batch", [])

    return {
        "approved_questions": batch,
        "generated_count": state.get("generated_count", 0) + len(batch),
        "current_batch": [],
        "review_action": None,
        "status": "BATCH_COMMITTED",
    }


def route_after_commit(state: QuestionBankState) -> str:
    # Cooperative cancellation boundary: between batches, since an in-flight
    # generation cannot be aborted. Approved batches are kept -- a cancel
    # stops further work, it does not discard already-reviewed output.
    if is_cancel_requested(state.get("thread_id")):
        logger.info("Question bank halting after batch: run was cancelled")
        return "done"
    if state.get("generated_count", 0) >= state.get("target_total", 0):
        return "done"
    return "continue"

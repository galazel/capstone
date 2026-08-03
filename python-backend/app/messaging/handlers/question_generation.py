"""Consumer for question.generation.queue.

Mirrors certification_generation.py: fetch by id, re-run the same HITL
question-bank LangGraph the direct-upload `/question-bank/generate` HTTP
route uses (app/api/routes/question_bank.py), and persist the result once it
resolves without pausing. Since the graph pauses for review after every
batch (see QuestionBankState's await_batch_review loop), most runs will stay
at PROCESSING pending a reviewer -- there was never an existing live table
for question drafts to land in either way (they were ephemeral, returned
straight to the HTTP caller before), so a fresh run only ever writes
generated_question_drafts once fully approved end to end.
"""

from __future__ import annotations

import json
import logging

from app.db.session import SessionLocal
from app.graphs.question_bank.workflow import get_question_bank_graph
from app.repositories import generated_question_drafts as drafts_repo
from app.domain.persistence import build_lesson_index
from app.repositories import java_backend as repo
from app.services import workflow_registry as registry
from app.services.assessment_persistence import persist_questions

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = 20
DEFAULT_TARGET_TOTAL = 100


def _thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _notify(generation_request: dict, title: str, body: str) -> None:
    user_id = generation_request.get("triggered_by_user_id")
    if user_id is None:
        return
    with SessionLocal() as session:
        repo.insert_notification(session, user_id=user_id, title=title, body=body, href="/admin/question-bank")


def _load_context(generation_request_id: int, certification_id: int):
    with SessionLocal() as session:
        generation_request = repo.get_generation_request(session, generation_request_id)
        if generation_request is None:
            return None
        certification = repo.get_certification(session, certification_id)
        if certification is None:
            repo.mark_generation_request_failed(
                session, generation_request_id, f"Certification {certification_id} not found"
            )
            user_id = generation_request.get("triggered_by_user_id")
            if user_id is not None:
                repo.insert_notification(
                    session, user_id=user_id, title="Generation failed",
                    body=f"Question generation failed: certification {certification_id} not found.",
                )
            return None
        documents = repo.list_knowledge_documents(session, certification_id, "QUESTION")
        repo.mark_generation_request_processing(session, generation_request_id)
    return generation_request, certification, documents


async def handle_question_generation_requested(payload: dict) -> None:
    generation_request_id = payload["generationRequestId"]
    certification_id = payload["certificationId"]

    context = _load_context(generation_request_id, certification_id)
    if context is None:
        logger.warning(
            "generation_request %s or certification %s not found, dropping message",
            generation_request_id, certification_id,
        )
        return
    generation_request, certification, documents = context

    params = json.loads(generation_request["params_json"] or "{}")
    question_counts = params.get("questionCounts") or None
    target_total = params.get("targetQuestionCount") or (
        sum(question_counts.values()) if question_counts else DEFAULT_TARGET_TOTAL
    )

    # S3 pointers instead of bytes -- see certification_generation.py.
    document_refs = [
        {
            "s3_key": doc["s3_key"],
            "filename": doc["original_filename"],
            "content_type": doc["content_type"],
        }
        for doc in documents
        if doc["s3_key"]
    ]

    thread_id = str(generation_request_id)
    with SessionLocal() as session:
        try:
            registry.start_run(
                session,
                thread_id=thread_id,
                kind="QUESTION_BANK",
                certification_id=certification_id,
                generation_request_id=generation_request_id,
                triggered_by_user_id=generation_request.get("triggered_by_user_id"),
            )
        except registry.RunAlreadyCancelled:
            # See the certification handler: a cancelled run leaves its queue
            # message unacked, and redelivery must not restart it.
            logger.info("Ignoring redelivered message for cancelled run %s", thread_id)
            return

    try:
        graph = await get_question_bank_graph()
        result = await graph.ainvoke(
            {
                "thread_id": thread_id,
                "certification_id": certification_id,
                "certification_name": certification["title"],
                "scope_type": "CERTIFICATION",
                "scope_label": certification["title"],
                "document_refs": document_refs,
                "target_total": target_total,
                "batch_size": DEFAULT_BATCH_SIZE,
                "type_distribution": question_counts,
            },
            config=_thread_config(thread_id),
        )
    except Exception as error:
        logger.exception("Question generation failed for request %s", generation_request_id)
        with SessionLocal() as session:
            repo.mark_generation_request_failed(session, generation_request_id, str(error))
            registry.mark_failed(session, thread_id, error=str(error))
        _notify(
            generation_request, f"Generation failed: {certification['title']}",
            f"Question generation for {certification['title']} failed: {error}",
        )
        return

    if "__interrupt__" in result:
        interrupt_value = result["__interrupt__"][0].value or {}
        with SessionLocal() as session:
            registry.mark_waiting_for_review(
                session,
                thread_id,
                stage=interrupt_value.get("stage", "QUESTION_BATCH"),
                payload={
                    "generated_count": interrupt_value.get("generated_count"),
                    "target_total": interrupt_value.get("target_total"),
                    "validation_report": interrupt_value.get("validation_report"),
                },
            )
        logger.info(
            "Question generation %s paused for admin review (thread_id=%s); "
            "left at PROCESSING until a reviewer resumes via /question-bank/%s/review.",
            generation_request_id, thread_id, thread_id,
        )
        return

    approved_questions = result.get("approved_questions") or []
    if not approved_questions:
        with SessionLocal() as session:
            repo.mark_generation_request_failed(
                session, generation_request_id, "Generation completed without any approved questions."
            )
            registry.mark_failed(session, thread_id, error="No approved questions produced.")
        _notify(
            generation_request, f"Generation failed: {certification['title']}",
            f"Question generation for {certification['title']} completed without any approved questions.",
        )
        return

    with SessionLocal() as session:
        # Keep the draft record (it carries the run's thread_id and full
        # review history) *and* write the approved questions into Java's
        # real questions tables, so they are usable by practice, adaptive
        # retakes, and BKT rather than sitting in a Python-only side table.
        drafts_repo.save_draft(
            session,
            generation_request_id=generation_request_id,
            certification_id=certification_id,
            thread_id=thread_id,
            questions=approved_questions,
        )
        lessons = repo.list_certification_lessons(session, certification_id)
        persisted = 0
        warnings: list[str] = []
        if lessons:
            question_ids, warnings = persist_questions(
                session,
                approved_questions,
                build_lesson_index(lessons),
                fallback_lesson_id=lessons[0]["lesson_id"],
            )
            persisted = len(question_ids)
            session.commit()
        else:
            warnings = ["Certification has no lessons; questions saved as drafts only."]

        repo.mark_generation_request_done(session, generation_request_id)
        registry.mark_completed(
            session, thread_id,
            payload={"approved": len(approved_questions), "persisted": persisted},
        )

    for warning in warnings:
        logger.warning("Question persistence: %s", warning)

    _notify(
        generation_request, f"Questions ready: {certification['title']}",
        f"{len(approved_questions)} AI-generated questions for {certification['title']} "
        f"are ready for review ({persisted} saved to the question bank).",
    )

    logger.info(
        "Question generation %s completed; %d questions saved for certification %s",
        generation_request_id, len(approved_questions), certification_id,
    )

"""Consumer for certification.generation.queue.

Fetches the GenerationRequest + certification + uploaded source documents by
id, re-runs the same HITL certification LangGraph the direct-upload
`/certification/generate` HTTP route uses (see app/api/routes/certification.py),
and persists the resulting curriculum into Java's major_categories/
middle_categories/lessons tables once the run finishes without pausing.

The graph pauses for admin review at several stages (curriculum approval,
lesson audit, etc.) exactly like the synchronous route does. Because this
consumer has no human attached, a pause is not a failure: the run is left at
generation_requests.status = PROCESSING, keyed by thread_id = str(generation_
request_id), so a future UI (Phase 7) can resume it through the existing
POST /certification/{thread_id}/resume endpoint using that same id.

Running the graph and interpreting its outcome now live in
`app.services.certification_run`, so the retry and restart endpoints reach the
same persistence and notifications this consumer does. They used to be inline
here, which made this consumer the only thing capable of finishing a run.
"""

from __future__ import annotations

import json
import logging

from app.db.session import SessionLocal
from app.repositories import java_backend as repo
from app.services import certification_run
from app.services import workflow_registry as registry

logger = logging.getLogger(__name__)


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
                    body=f"Curriculum generation failed: certification {certification_id} not found.",
                )
            return None
        documents = repo.list_knowledge_documents(session, certification_id, "LESSON")
        repo.mark_generation_request_processing(session, generation_request_id)
    return generation_request, certification, documents


async def handle_certification_generation_requested(payload: dict) -> None:
    generation_request_id = payload["generationRequestId"]
    certification_id = payload["certificationId"]

    loaded = _load_context(generation_request_id, certification_id)
    if loaded is None:
        logger.warning(
            "generation_request %s or certification %s not found, dropping message",
            generation_request_id, certification_id,
        )
        return
    generation_request, certification, documents = loaded

    params = json.loads(generation_request["params_json"] or "{}")

    # Pass S3 pointers, not bytes. The graph fetches each document on demand
    # during validation/ingestion; previously this downloaded every file up
    # front and embedded it in the initial state, which LangGraph then
    # re-serialized into every subsequent checkpoint.
    document_refs = certification_run.document_refs_from(documents)

    thread_id = str(generation_request_id)

    # A message can be redelivered while the run it refers to is still being
    # executed here -- RabbitMQ requeues on a dropped channel, and the broker's
    # consumer timeout closes one out from under a run that outlasts it. Acting
    # on that would put a second driver on the thread, duplicating every node.
    # The message is acked and dropped instead: the run in flight owns it.
    if certification_run.is_being_driven(thread_id):
        logger.info("Run %s is already executing here; dropping the redelivered message", thread_id)
        return

    with SessionLocal() as session:
        try:
            registry.start_run(
                session,
                thread_id=thread_id,
                kind="CERTIFICATION",
                certification_id=certification_id,
                generation_request_id=generation_request_id,
                triggered_by_user_id=generation_request.get("triggered_by_user_id"),
            )
        except registry.RunAlreadyCancelled:
            # The reviewer stopped this run. Cancellation leaves the message
            # unacked, so RabbitMQ redelivers it -- returning here acks and
            # drops it instead of resurrecting work someone stopped on purpose.
            logger.info("Ignoring redelivered message for cancelled run %s", thread_id)
            return

    context = certification_run.RunContext(
        thread_id=thread_id,
        certification_title=certification["title"],
        certification_id=certification_id,
        generation_request_id=generation_request_id,
        triggered_by_user_id=generation_request.get("triggered_by_user_id"),
    )

    seed = {
        "thread_id": thread_id,
        "certification_id": certification_id,
        "certification_name": certification["title"],
        "certification_description": certification["description"] or "",
        "industry": certification["industry"] or "",
        "document_refs": document_refs,
        # Supervised or unattended, as chosen in the create form. An
        # unattended run never raises a review interrupt, so it reaches
        # the end without anyone having to sit with it.
        "review_mode": certification_run.review_mode_from(params),
        "status": "STARTED",
    }

    # RESUME rather than re-seed when this thread already has progress.
    #
    # Seeding a thread that holds checkpoints does not continue it -- the seed
    # sets `status` back to STARTED and the run re-enters at the first node,
    # re-ingesting the documents and re-planning the curriculum it had already
    # produced. On 2026-08-31 that discarded a run's work three times over,
    # each redelivery paying again for lessons already written and leaving the
    # certification an empty shell.
    #
    # `execute(context, None)` is the resume LangGraph actually offers: it
    # picks the thread up at the node that was pending. It is what the retry
    # endpoint has always used; this path simply never did.
    graph_input = seed
    if await certification_run.has_progress(thread_id):
        logger.info(
            "Thread %s already has checkpoints; resuming instead of restarting", thread_id
        )
        graph_input = None

    await certification_run.execute(context, graph_input)

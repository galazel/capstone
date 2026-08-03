from __future__ import annotations

import logging
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from langgraph.types import Command
from pydantic import BaseModel, Field

from app.core.security import require_service_key
from app.db.session import SessionLocal
from app.services import workflow_registry as registry
from app.graphs.question_bank.workflow import get_question_bank_graph
from app.utils.helpers import create_id

router = APIRouter(
    prefix="/question-bank",
    tags=["question-bank"],
    dependencies=[Depends(require_service_key)],
)

logger = logging.getLogger(__name__)

ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]


class ReviewRequest(BaseModel):
    action: Literal["approve", "edit", "improve", "regenerate", "reject", "skip"]
    instructions: Optional[str] = Field(default=None, description="Free-form guidance for 'improve'.")
    questions: Optional[list[dict[str, Any]]] = Field(default=None, description="Admin-edited questions for 'edit'.")
    restored_from: Optional[int] = Field(
        default=None,
        description="Revision `questions` was restored from; records RESTORED rather than MANUAL_EDIT.",
    )


def _thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _reject_if_cancelled(thread_id: str) -> None:
    """Refuses to resume a cancelled run -- see the certification route for
    why this is the real enforcement point for paused runs."""
    with SessionLocal() as session:
        run = registry.get_run_by_thread(session, thread_id)
        if run is not None and run.status == registry.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Run {thread_id} was cancelled and cannot be resumed.",
            )


def _fail(thread_id: str, error: Exception, what: str) -> HTTPException:
    """Ends the run, then reports it.

    The graph raising means this thread is not executing any more, and a run
    nobody is driving must not be left claiming RUNNING or WAITING_FOR_REVIEW:
    the workspace keeps drawing a progress spinner for it, and recovery refuses
    to touch it because only failed runs are recoverable. Recording the failure
    is what turns a silently abandoned run into one that visibly stopped.
    """
    logger.exception("Question-bank run %s failed during %s", thread_id, what)
    try:
        with SessionLocal() as session:
            registry.mark_failed(session, thread_id, error=str(error))
    except Exception:
        # Reporting the original failure matters more than recording it. A
        # run left RUNNING here is picked up as stalled later.
        logger.exception("Could not record the failure of run %s", thread_id)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)
    )


def _to_response(thread_id: str, result: dict) -> dict[str, Any]:
    if "__interrupt__" in result:
        interrupt = result["__interrupt__"][0]
        payload = interrupt.value
        return {
            "thread_id": thread_id,
            "status": "AWAITING_REVIEW",
            "batch": payload.get("batch"),
            "generated_count": payload.get("generated_count"),
            "target_total": payload.get("target_total"),
        }
    return {
        "thread_id": thread_id,
        "status": result.get("status"),
        "generated_count": result.get("generated_count"),
        "target_total": result.get("target_total"),
        "approved_questions": result.get("approved_questions"),
    }


@router.post("/generate")
async def generate_question_bank(
    certification_name: Annotated[str, Form()],
    scope_type: Annotated[str, Form()] = "CERTIFICATION",
    scope_label: Annotated[str, Form()] = "",
    target_total: Annotated[int, Form()] = 100,
    batch_size: Annotated[int, Form()] = 20,
    files: list[UploadFile] = File(default_factory=list),
) -> dict[str, Any]:
    """
    Starts a new batched question-bank generation run. Pauses after the
    first batch for admin review — resume via
    POST /question-bank/{thread_id}/review.
    """
    uploaded_documents = []
    for file in files:
        if file.content_type not in ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{file.filename} must be PDF or DOCX.",
            )
        content = await file.read()
        uploaded_documents.append({
            "filename": file.filename,
            "type": file.content_type,
            "content": content,
        })

    thread_id = create_id()
    with SessionLocal() as session:
        registry.start_run(session, thread_id=thread_id, kind="QUESTION_BANK")

    try:
        graph = await get_question_bank_graph()
        result = await graph.ainvoke(
            {
                "thread_id": thread_id,
                "certification_name": certification_name,
                "scope_type": scope_type,
                "scope_label": scope_label,
                "uploaded_files": uploaded_documents,
                "target_total": target_total,
                "batch_size": batch_size,
            },
            config=_thread_config(thread_id),
        )
    except Exception as error:
        raise _fail(thread_id, error, "generation") from error

    return _to_response(thread_id, result)


@router.post("/{thread_id}/review")
async def review_question_batch(thread_id: str, request: ReviewRequest) -> dict[str, Any]:
    """
    Applies the admin's decision for the batch currently paused for review:
    approve (continue), edit (apply manual edits then continue), improve
    (regenerate this batch with feedback), regenerate (fresh version, no
    feedback), or reject (discard, pause again for the next decision).
    """
    _reject_if_cancelled(thread_id)

    config = _thread_config(thread_id)
    resume_value = {
        "action": request.action,
        "instructions": request.instructions,
        "questions": request.questions,
        "restored_from": request.restored_from,
    }
    try:
        graph = await get_question_bank_graph()
        result = await graph.ainvoke(Command(resume=resume_value), config=config)
    except Exception as error:
        raise _fail(thread_id, error, "review") from error

    return _to_response(thread_id, result)


@router.get("/{thread_id}/state")
async def get_question_bank_state(thread_id: str) -> dict[str, Any]:
    graph = await get_question_bank_graph()
    snapshot = await graph.aget_state(_thread_config(thread_id))
    if snapshot is None or not snapshot.values:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No run found for thread_id={thread_id}")

    if snapshot.next and snapshot.tasks and snapshot.tasks[0].interrupts:
        interrupt = snapshot.tasks[0].interrupts[0]
        payload = interrupt.value
        return {
            "thread_id": thread_id,
            "status": "AWAITING_REVIEW",
            "batch": payload.get("batch"),
            "generated_count": payload.get("generated_count"),
            "target_total": payload.get("target_total"),
        }

    return _to_response(thread_id, snapshot.values)


@router.get("/{thread_id}/versions")
async def get_question_bank_versions(
    thread_id: str, key: str | None = None
) -> dict[str, Any]:
    """
    Full version history for this run: every AI-generated, AI-improved,
    manually-edited, and restored version of every batch, oldest first — what
    an admin compares and restores from.

    Reads the event log, not graph state. This used to return
    `snapshot.values["version_refs"]`, which stopped carrying artifacts once
    versions moved into `workflow_events` — so it served refs with nothing to
    diff.
    """
    with SessionLocal() as session:
        return {
            "thread_id": thread_id,
            "versions": registry.list_artifact_versions(session, thread_id, key=key),
        }

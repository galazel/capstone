from __future__ import annotations

from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from langgraph.types import Command
from pydantic import BaseModel

from app.core.security import require_service_key
from app.db.session import SessionLocal
from app.services import workflow_registry as registry
from app.graphs.certification.workflow import get_certification_graph
from app.utils.helpers import create_id

router = APIRouter(
    prefix="/certification",
    tags=["certification"],
    dependencies=[Depends(require_service_key)],
)

ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]


class ResumeRequest(BaseModel):
    """A reviewer's decision for the stage a run is paused on.

    Previously this was a bare `decision: Literal["approve", "regenerate"]`
    string, which made four of the six review actions unreachable over HTTP:
    the graph reads `decision.get("instructions")` and `.get("payload")`, and a
    string has neither. Widening the Literal alone would not have been enough.
    """

    action: Literal[
        "approve", "edit", "improve", "regenerate", "reject", "skip", "approve_remaining"
    ]
    #: Free-form guidance for "improve".
    instructions: Optional[str] = None
    #: The reviewer's own version of the artifact, for "edit".
    payload: Optional[Any] = None
    #: Set when `payload` is an earlier version being rolled back to, so the
    #: version log records RESTORED instead of MANUAL_EDIT.
    restored_from: Optional[int] = None

    def as_resume_value(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "instructions": self.instructions,
            "payload": self.payload,
            "restored_from": self.restored_from,
        }


def _thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _reject_if_cancelled(thread_id: str) -> None:
    """A cancelled run must not be restartable by a stale browser tab.

    This is also what makes cancellation *immediate* for a paused run: the
    graph is not executing while parked at an interrupt, so refusing to resume
    it is the whole enforcement. The in-graph gate checks only matter for runs
    that are mid-flight when the cancel arrives.
    """
    with SessionLocal() as session:
        run = registry.get_run_by_thread(session, thread_id)
        if run is not None and run.status == registry.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Run {thread_id} was cancelled and cannot be resumed.",
            )


def _to_response(thread_id: str, result: dict) -> dict:
    if "__interrupt__" in result:
        interrupt = result["__interrupt__"][0]
        return {
            "thread_id": thread_id,
            "status": "AWAITING_REVIEW",
            "stage": interrupt.value.get("stage"),
            "payload": interrupt.value.get("payload"),
        }
    return {
        "thread_id": thread_id,
        "status": result.get("status"),
        "error_message": result.get("error_message"),
        "curriculum": result.get("curriculum"),
        "lessons": result.get("lessons"),
        "major_quizzes": result.get("major_quizzes"),
        "middle_quizzes": result.get("middle_quizzes"),
        "lesson_quizzes": result.get("lesson_quizzes"),
        "diagnostic_exam": result.get("diagnostic_exam"),
        "mock_exam": result.get("mock_exam"),
        "question_bank": result.get("question_bank"),
    }


@router.post("/generate")
async def generate_certification(
    certification_name: Annotated[str, Form()],
    certification_description: Annotated[str, Form()],
    industry: Annotated[str, Form()] = "",
    files: list[UploadFile] = File(default_factory=list),
) -> dict[str, Any]:
    """
    Starts a new certification-generation run and returns either the first
    HITL pause (stage + payload to review) or the final result if the graph
    somehow completes without pausing. Resume paused runs via
    POST /certification/{thread_id}/resume.
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
            "size": len(content),
            "content": content,
        })

    thread_id = create_id()
    # Register before invoking, so a run started through this route is
    # discoverable in the registry exactly like a consumer-started one --
    # otherwise it would pause for review with nothing pointing at it.
    with SessionLocal() as session:
        registry.start_run(session, thread_id=thread_id, kind="CERTIFICATION")

    try:
        graph = await get_certification_graph()
        result = await graph.ainvoke(
            {
                "thread_id": thread_id,
                "certification_name": certification_name,
                "certification_description": certification_description,
                "industry": industry,
                "uploaded_files": uploaded_documents,
                "status": "STARTED",
            },
            config=_thread_config(thread_id),
        )
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    if result.get("status") == "VALIDATION_FAILED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error_message", "Uploaded documents do not match the certification topics."),
        )

    return _to_response(thread_id, result)


@router.post("/{thread_id}/resume")
async def resume_certification(thread_id: str, request: ResumeRequest) -> dict[str, Any]:
    """
    Resumes a paused run with the admin's HITL decision for the stage it's
    currently paused on.

    approve / approve_remaining continue, regenerate and improve redo the
    current item (improve with the reviewer's guidance), edit accepts the
    reviewer's own version, and skip (alias: reject) leaves the item out and
    moves on.
    """
    _reject_if_cancelled(thread_id)

    config = _thread_config(thread_id)
    try:
        graph = await get_certification_graph()
        result = await graph.ainvoke(Command(resume=request.as_resume_value()), config=config)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return _to_response(thread_id, result)


@router.get("/{thread_id}/versions")
async def get_certification_versions(
    thread_id: str, key: str | None = None
) -> dict[str, Any]:
    """
    Every recorded version of every artifact in this run, oldest first --
    what the workspace compares and restores from.

    Read from the event log rather than graph state: state holds only
    lightweight refs, so the artifacts needed for a diff are not there.
    Optionally filtered to one artifact `key` (e.g. "LESSON:3").
    """
    with SessionLocal() as session:
        return {
            "thread_id": thread_id,
            "versions": registry.list_artifact_versions(session, thread_id, key=key),
        }


@router.get("/{thread_id}/state")
async def get_certification_state(thread_id: str) -> dict[str, Any]:
    """Fetches the current state of a run, e.g. after reconnecting to a paused thread."""
    graph = await get_certification_graph()
    snapshot = await graph.aget_state(_thread_config(thread_id))
    if snapshot is None or not snapshot.values:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No run found for thread_id={thread_id}")

    if snapshot.next:
        # Graph has a pending step (i.e. paused at an interrupt).
        pending_interrupts = snapshot.tasks[0].interrupts if snapshot.tasks else ()
        if pending_interrupts:
            interrupt = pending_interrupts[0]
            return {
                "thread_id": thread_id,
                "status": "AWAITING_REVIEW",
                "stage": interrupt.value.get("stage"),
                "payload": interrupt.value.get("payload"),
            }

    return _to_response(thread_id, snapshot.values)

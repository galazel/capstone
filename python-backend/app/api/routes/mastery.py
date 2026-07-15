from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.models import BktMasteryEvent, LearnerLessonMastery, LearnerLessonMasteryHistory
from app.db.session import get_db
from app.repositories.bkt import list_learner_mastery, list_mastery_history
from app.schemas.mastery import (
    LearnerLessonMasteryResponse,
    LearnerMasteryListResponse,
    MasteryEventBatchCreate,
    MasteryEventCreate,
    MasteryEventResponse,
    MasteryHistoryResponse,
)
from app.services.mastery_service import process_mastery_event

router = APIRouter(
    prefix="/mastery",
    tags=["mastery"],
    dependencies=[Depends(require_service_key)],
)


@router.post("/events", response_model=MasteryEventResponse)
def ingest_mastery_event(
    payload: MasteryEventCreate,
    db: Session = Depends(get_db),
) -> MasteryEventResponse:
    return process_mastery_event(db, payload)


@router.post("/events/batch", response_model=list[MasteryEventResponse])
def ingest_mastery_events(
    payload: MasteryEventBatchCreate,
    db: Session = Depends(get_db),
) -> list[MasteryEventResponse]:
    # Each event commits independently so retries remain idempotent and one bad
    # duplicate cannot roll back already accepted answers.
    return [process_mastery_event(db, event) for event in payload.events]


@router.get(
    "/learners/{learner_id}",
    response_model=LearnerMasteryListResponse,
)
def get_learner_mastery(
    learner_id: int,
    lesson_id: list[int] | None = Query(default=None),
    db: Session = Depends(get_db),
) -> LearnerMasteryListResponse:
    items = list_learner_mastery(db, learner_id, lesson_ids=lesson_id)
    average = (
        sum(item.mastery_probability for item in items) / len(items) if items else 0.0
    )
    return LearnerMasteryListResponse(
        items=items,
        total=len(items),
        average_mastery_probability=round(average, 6),
    )


@router.get(
    "/learners/{learner_id}/lessons/{lesson_id}",
    response_model=LearnerLessonMasteryResponse,
)
def get_lesson_mastery(
    learner_id: int,
    lesson_id: int,
    db: Session = Depends(get_db),
) -> LearnerLessonMastery:
    mastery = db.get(LearnerLessonMastery, (learner_id, lesson_id))
    if mastery is None:
        raise HTTPException(status_code=404, detail="Mastery record not found")
    return mastery


@router.get(
    "/learners/{learner_id}/certifications/{certification_id}/history",
    response_model=list[MasteryHistoryResponse],
)
def get_mastery_history(
    learner_id: int,
    certification_id: int,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> list[LearnerLessonMasteryHistory]:
    return list_mastery_history(db, learner_id, certification_id, limit=limit)


@router.delete(
    "/learners/{learner_id}/lessons/{lesson_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reset_lesson_mastery(
    learner_id: int,
    lesson_id: int,
    delete_event_history: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> None:
    mastery = db.get(LearnerLessonMastery, (learner_id, lesson_id))
    if mastery is None:
        raise HTTPException(status_code=404, detail="Mastery record not found")
    db.delete(mastery)
    if delete_event_history:
        db.execute(
            delete(BktMasteryEvent).where(
                BktMasteryEvent.learner_id == learner_id,
                BktMasteryEvent.lesson_id == lesson_id,
            )
        )
    db.commit()

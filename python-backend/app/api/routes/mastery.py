from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.models import (
    BktMasteryEvent,
    LearnerCategoryPriority,
    LearnerLessonMastery,
    LearnerLessonMasteryHistory,
)
from app.db.session import get_db
from app.repositories.bkt import list_learner_mastery, list_mastery_history
from app.schemas.certification.mastery import (
    LearnerLessonMasteryResponse,
    LearnerMasteryListResponse,
    MasteryEventBatchCreate,
    MasteryEventCreate,
    MasteryEventResponse,
    MasteryHistoryResponse,
)
from app.services.mastery_service import process_mastery_event

LOGGER = logging.getLogger(__name__)

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
    "/learners/{learner_id}",
    status_code=status.HTTP_200_OK,
)
def purge_learner_state(
    learner_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Erase every trace of one learner id from the BKT store.

    Exists because learner ids are not globally unique over time. The
    application database has been reset at least once while this schema was
    not: `learners` restarted from 1, and mastery rows survived for ids 6-12
    that no longer refer to anyone. A newly provisioned learner then inherited
    a dead learner's record -- a brand-new account opened on 98% mastery of a
    lesson it had never seen, with 89 answers behind it.

    So provisioning calls this before a learner ever answers anything. It is
    unconditional and idempotent: for a genuinely new id there is nothing to
    delete and it is a no-op, and for a reused id the only rows it can touch
    are by definition somebody else's.
    """
    deleted = {
        "mastery": db.execute(
            delete(LearnerLessonMastery).where(
                LearnerLessonMastery.learner_id == learner_id
            )
        ).rowcount,
        "history": db.execute(
            delete(LearnerLessonMasteryHistory).where(
                LearnerLessonMasteryHistory.learner_id == learner_id
            )
        ).rowcount,
        "events": db.execute(
            delete(BktMasteryEvent).where(BktMasteryEvent.learner_id == learner_id)
        ).rowcount,
        "priorities": db.execute(
            delete(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id
            )
        ).rowcount,
    }
    db.commit()

    if any(deleted.values()):
        # Loud on purpose: a non-empty purge means an id really was reused, and
        # that is worth knowing about rather than silently tidying away.
        LOGGER.warning(
            "Purged stale BKT state for reused learner_id=%s: %s", learner_id, deleted
        )

    return {"learner_id": learner_id, "deleted": deleted}


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

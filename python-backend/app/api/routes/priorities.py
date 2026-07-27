from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_service_key
from app.db.models import LearnerCategoryPriority
from app.db.session import get_db
from app.schemas.certification.priority import (
    CategoryPriorityHierarchy,
    ConfidenceResponse,
    LessonPriority,
    MajorCategoryPriority,
    MiddleCategoryPriority,
    PrioritySummary,
    RecalculateRequest,
)
from app.services import category_service, confidence_service
from app.services import priority_service as ps

router = APIRouter(
    prefix="/priorities",
    tags=["priorities"],
    dependencies=[Depends(require_service_key)],
)


def _sort_key(row: LearnerCategoryPriority):
    # Default learner ordering: most urgent first, then highest score.
    rank = ps.SEVERITY.get(row.priority_tag, -1)
    return (-rank, -row.priority_score)


def _lesson_dto(row: LearnerCategoryPriority) -> LessonPriority:
    return LessonPriority(
        lesson_id=row.lesson_id,
        lesson_title=row.category_title,
        middle_category_id=row.middle_category_id,
        major_category_id=row.major_category_id,
        mastery_probability=row.mastery_probability,
        mastery_level=row.mastery_level,
        priority_score=row.priority_score,
        priority_tag=row.priority_tag,
        priority_label=row.priority_label,
        primary_reason=row.primary_reason,
        reasons=row.reasons_json or [],
        recommended_action=row.recommended_action,
        recommended_activity=row.recommended_activity,
        evidence_count=row.evidence_count,
        last_assessed_at=row.updated_at,
    )


def _fetch(session: Session, learner_id: int, certification_id: int) -> list[LearnerCategoryPriority]:
    return list(
        session.scalars(
            select(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id,
                LearnerCategoryPriority.certification_id == certification_id,
            )
        )
    )


def _build_hierarchy(
    learner_id: int, certification_id: int, rows: list[LearnerCategoryPriority]
) -> CategoryPriorityHierarchy:
    lessons = sorted(
        (r for r in rows if r.category_type == "LESSON"), key=_sort_key
    )
    middles = {r.middle_category_id: r for r in rows if r.category_type == "MIDDLE"}
    majors = {r.major_category_id: r for r in rows if r.category_type == "MAJOR"}

    summary = PrioritySummary()
    counter = {
        ps.CRITICAL: "critical_count",
        ps.HIGH: "high_count",
        ps.MEDIUM: "medium_count",
        ps.LOW: "low_count",
        ps.ON_TRACK: "on_track_count",
        ps.STRONG: "strong_count",
        ps.NOT_ENOUGH_DATA: "not_enough_data_count",
        ps.NEEDS_REASSESSMENT: "needs_reassessment_count",
    }
    for lesson in lessons:
        attr = counter.get(lesson.priority_tag)
        if attr:
            setattr(summary, attr, getattr(summary, attr) + 1)

    middle_dtos: dict[int, MiddleCategoryPriority] = {}
    for middle_id, mrow in middles.items():
        middle_lessons = [
            _lesson_dto(l) for l in lessons if l.middle_category_id == middle_id
        ]
        weak = sum(
            1 for l in middle_lessons
            if l.mastery_probability is not None
            and l.mastery_probability < get_settings().developing_threshold
        )
        high = sum(1 for l in middle_lessons if l.priority_tag in (ps.HIGH, ps.CRITICAL))
        critical = sum(1 for l in middle_lessons if l.priority_tag == ps.CRITICAL)
        middle_dtos[middle_id] = MiddleCategoryPriority(
            middle_category_id=middle_id,
            major_category_id=mrow.major_category_id,
            title=mrow.category_title,
            priority_score=mrow.priority_score,
            priority_tag=mrow.priority_tag,
            priority_label=mrow.priority_label,
            average_mastery=mrow.mastery_probability,
            weak_lesson_count=weak,
            high_priority_lesson_count=high,
            critical_lesson_count=critical,
            total_lesson_count=len(middle_lessons),
            primary_reason=mrow.primary_reason,
            lessons=middle_lessons,
        )

    major_dtos: list[MajorCategoryPriority] = []
    for major_id, jrow in majors.items():
        child_middles = sorted(
            (mc for mc in middle_dtos.values() if mc.major_category_id == major_id),
            key=lambda mc: (-ps.SEVERITY.get(mc.priority_tag, -1), -mc.priority_score),
        )
        major_dtos.append(
            MajorCategoryPriority(
                major_category_id=major_id,
                title=jrow.category_title,
                priority_score=jrow.priority_score,
                priority_tag=jrow.priority_tag,
                priority_label=jrow.priority_label,
                average_mastery=jrow.mastery_probability,
                primary_reason=jrow.primary_reason,
                middle_categories=child_middles,
            )
        )
    major_dtos.sort(key=lambda mj: (-ps.SEVERITY.get(mj.priority_tag, -1), -mj.priority_score))

    return CategoryPriorityHierarchy(
        certification_id=certification_id, summary=summary, major_categories=major_dtos
    )


@router.get(
    "/learners/{learner_id}/certifications/{certification_id}",
    response_model=CategoryPriorityHierarchy,
)
def get_hierarchy(
    learner_id: int, certification_id: int, db: Session = Depends(get_db)
) -> CategoryPriorityHierarchy:
    rows = _fetch(db, learner_id, certification_id)
    return _build_hierarchy(learner_id, certification_id, rows)


@router.get(
    "/learners/{learner_id}/certifications/{certification_id}/lessons",
    response_model=list[LessonPriority],
)
def get_lesson_priorities(
    learner_id: int, certification_id: int, db: Session = Depends(get_db)
) -> list[LessonPriority]:
    rows = [r for r in _fetch(db, learner_id, certification_id) if r.category_type == "LESSON"]
    return [_lesson_dto(r) for r in sorted(rows, key=_sort_key)]


@router.get(
    "/learners/{learner_id}/certifications/{certification_id}/middle-categories",
    response_model=CategoryPriorityHierarchy,
)
def get_middle_categories(
    learner_id: int, certification_id: int, db: Session = Depends(get_db)
) -> CategoryPriorityHierarchy:
    return _build_hierarchy(learner_id, certification_id, _fetch(db, learner_id, certification_id))


@router.get(
    "/learners/{learner_id}/certifications/{certification_id}/confidence",
    response_model=ConfidenceResponse,
)
def get_confidence(
    learner_id: int, certification_id: int, db: Session = Depends(get_db)
) -> ConfidenceResponse:
    return confidence_service.compute_confidence(
        db, learner_id=learner_id, certification_id=certification_id, settings=get_settings()
    )


@router.post("/recalculate", response_model=CategoryPriorityHierarchy)
def recalculate(
    payload: RecalculateRequest, db: Session = Depends(get_db)
) -> CategoryPriorityHierarchy:
    category_service.full_recalculate(
        db,
        learner_id=payload.learner_id,
        certification_id=payload.certification_id,
        settings=get_settings(),
    )
    db.commit()
    rows = _fetch(db, payload.learner_id, payload.certification_id)
    return _build_hierarchy(payload.learner_id, payload.certification_id, rows)

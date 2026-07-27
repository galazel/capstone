"""Learner certification confidence: a weighted view of lesson mastery."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import LearnerLessonMastery
from app.schemas.certification.priority import ConfidenceResponse


def compute_confidence(
    session: Session,
    *,
    learner_id: int,
    certification_id: int,
    settings: Settings,
    total_curriculum_lessons: int | None = None,
) -> ConfidenceResponse:
    """Confidence = evidence-weighted mean lesson mastery (0..100).

    Lessons with more evidence count slightly more, but a single heavily
    attempted lesson cannot dominate (weights are capped). Only assessed lessons
    are visible to this service; ``total_curriculum_lessons`` (when the caller
    knows it) drives an honest coverage percentage.
    """
    rows = list(
        session.scalars(
            select(LearnerLessonMastery).where(
                LearnerLessonMastery.learner_id == learner_id,
                LearnerLessonMastery.certification_id == certification_id,
            )
        )
    )

    mastered = good = developing = weak = 0
    weighted_sum = 0.0
    weight_total = 0.0
    for row in rows:
        evidence = (row.correct_count or 0) + (row.incorrect_count or 0)
        weight = min(5, max(1, evidence))  # cap so one lesson can't dominate
        weighted_sum += row.mastery_probability * weight
        weight_total += weight
        if row.mastery_probability >= settings.mastered_threshold:
            mastered += 1
        elif row.mastery_probability >= settings.good_threshold:
            good += 1
        elif row.mastery_probability >= settings.developing_threshold:
            developing += 1
        else:
            weak += 1

    average = weighted_sum / weight_total if weight_total > 0 else 0.0
    assessed = len(rows)
    denominator = total_curriculum_lessons or assessed or 1
    coverage = round(min(100.0, assessed / denominator * 100.0), 2)

    return ConfidenceResponse(
        learner_id=learner_id,
        certification_id=certification_id,
        confidence_score=round(average * 100.0, 2),
        average_mastery=round(average, 4),
        mastered_count=mastered,
        good_count=good,
        developing_count=developing,
        weak_count=weak,
        total_lessons=assessed,
        coverage_percentage=coverage,
    )

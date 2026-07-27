from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories.bkt import list_learner_mastery
from app.schemas.certification.analytics import (
    ReadinessComponent,
    ReadinessRequest,
    ReadinessResponse,
)


def _level(score: float) -> str:
    if score >= 85:
        return "exam_ready"
    if score >= 70:
        return "nearly_ready"
    if score >= 50:
        return "developing"
    return "needs_review"


def calculate_readiness(session: Session, payload: ReadinessRequest) -> ReadinessResponse:
    settings = get_settings()
    records = list_learner_mastery(
        session,
        payload.learner_id,
        lesson_ids=payload.lesson_ids,
    )
    mastery_score = (
        sum(record.mastery_probability for record in records) / len(records) * 100
        if records
        else 0.0
    )

    configured = [
        ("mastery", mastery_score, settings.readiness_mastery_weight),
        ("diagnostic", payload.diagnostic_score, settings.readiness_diagnostic_weight),
        ("lesson_quiz", payload.lesson_quiz_score, settings.readiness_quiz_weight),
        ("middle_exam", payload.middle_exam_score, settings.readiness_middle_exam_weight),
        ("mock_exam", payload.mock_exam_score, settings.readiness_mock_exam_weight),
    ]
    available = [(name, score, weight) for name, score, weight in configured if score is not None]
    total_weight = sum(weight for _, _, weight in available)
    if total_weight <= 0:
        total_weight = 1.0

    components: list[ReadinessComponent] = []
    readiness = 0.0
    for name, score, weight in available:
        normalized = weight / total_weight
        contribution = float(score) * normalized
        readiness += contribution
        components.append(
            ReadinessComponent(
                name=name,
                score=round(float(score), 2),
                configured_weight=weight,
                normalized_weight=round(normalized, 6),
                contribution=round(contribution, 2),
            )
        )

    coverage = len(records) / len(set(payload.lesson_ids))
    return ReadinessResponse(
        learner_id=payload.learner_id,
        lesson_count_requested=len(set(payload.lesson_ids)),
        lesson_count_with_mastery=len(records),
        mastery_coverage=round(coverage, 4),
        readiness_score=round(readiness, 2),
        readiness_level=_level(readiness),
        components=components,
    )

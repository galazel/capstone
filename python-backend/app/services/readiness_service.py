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
        ("major_exam", payload.major_exam_score, settings.readiness_major_exam_weight),
        ("mock_exam", payload.mock_exam_score, settings.readiness_mock_exam_weight),
        ("lesson_progress", payload.lesson_progress_score, settings.readiness_progress_weight),
        ("streak", payload.streak_score, settings.readiness_streak_weight),
    ]
    # Divide by every configured weight, not only the components the learner
    # happens to have.
    #
    # Renormalising over what exists meant a missing component was removed from
    # the calculation rather than counted as outstanding -- so a learner who had
    # sat nothing but a diagnostic had that diagnostic's 3% stretched across the
    # whole score and came out 100% ready. Work not yet done now contributes
    # nothing, which is what "not ready yet" means.
    total_weight = sum(weight for _, _, weight in configured)
    if total_weight <= 0:
        total_weight = 1.0

    components: list[ReadinessComponent] = []
    readiness = 0.0
    for name, score, weight in configured:
        normalized = weight / total_weight
        # An absent component is reported at zero rather than omitted, so the
        # breakdown names what is still outstanding instead of going quiet
        # about it.
        effective = 0.0 if score is None else float(score)
        contribution = effective * normalized
        readiness += contribution
        components.append(
            ReadinessComponent(
                name=name,
                score=round(effective, 2),
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

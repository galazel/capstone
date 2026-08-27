"""Lesson-level priority scoring, tag classification, and stabilized persistence.

Priority answers "what should the learner review first". A higher score (0..100)
means review sooner. Scores never derive from an overall exam score; each lesson
is scored from its own BKT mastery and evidence.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.services.bkt_math import mastery_level
from app.db.models import (
    LearnerCategoryPriority,
    LearnerCategoryPriorityHistory,
    LearnerLessonMastery,
)

# --- Tags -------------------------------------------------------------------
CRITICAL = "CRITICAL_PRIORITY"
HIGH = "HIGH_PRIORITY"
MEDIUM = "MEDIUM_PRIORITY"
LOW = "LOW_PRIORITY"
ON_TRACK = "ON_TRACK"
STRONG = "STRONG"
NOT_ENOUGH_DATA = "NOT_ENOUGH_DATA"
NEEDS_REASSESSMENT = "NEEDS_REASSESSMENT"

LABELS = {
    CRITICAL: "Critical Priority",
    HIGH: "High Priority",
    MEDIUM: "Medium Priority",
    LOW: "Low Priority",
    ON_TRACK: "On Track",
    STRONG: "Strong Area",
    NOT_ENOUGH_DATA: "Not Enough Data",
    NEEDS_REASSESSMENT: "Needs Reassessment",
}

# Severity ordering for hysteresis (higher = worse / more urgent).
SEVERITY = {STRONG: 0, ON_TRACK: 1, LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 5}
_DATA_STATES = {NOT_ENOUGH_DATA, NEEDS_REASSESSMENT}

ACTIVITY = {
    CRITICAL: "LESSON_REVIEW",
    HIGH: "LESSON_REVIEW",
    MEDIUM: "PRACTICE_QUIZ",
    LOW: "PRACTICE_QUIZ",
    ON_TRACK: "REVIEW_MISTAKES",
    STRONG: "MAINTENANCE_REVIEW",
    NOT_ENOUGH_DATA: "TAKE_ASSESSMENT",
    NEEDS_REASSESSMENT: "TAKE_ASSESSMENT",
}

ACTION = {
    CRITICAL: "Review this lesson before your next exam",
    HIGH: "Review the lesson and take a practice quiz",
    MEDIUM: "Take a practice quiz to strengthen this lesson",
    LOW: "A short practice quiz will keep this solid",
    ON_TRACK: "Keep going; review your mistakes occasionally",
    STRONG: "Maintain with an occasional review",
    NOT_ENOUGH_DATA: "Take an assessment so we can measure this lesson",
    NEEDS_REASSESSMENT: "Reassess this lesson; recent evidence is inconclusive",
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def classify_tag(
    score: float,
    mastery: float | None,
    evidence_count: int,
    settings: Settings,
) -> str:
    """Threshold classification with mastery safeguards."""
    if evidence_count < settings.priority_min_evidence:
        return NOT_ENOUGH_DATA

    if score >= settings.priority_critical_threshold:
        tag = CRITICAL
    elif score >= settings.priority_high_threshold:
        tag = HIGH
    elif score >= settings.priority_medium_threshold:
        tag = MEDIUM
    elif score >= settings.priority_low_threshold:
        tag = LOW
    elif score >= settings.priority_on_track_threshold:
        tag = ON_TRACK
    else:
        tag = STRONG

    if mastery is not None:
        if mastery >= settings.mastered_threshold:
            tag = STRONG
        if mastery < settings.mastery_critical_ceiling:
            tag = CRITICAL
        elif mastery < settings.mastery_high_ceiling and SEVERITY[tag] < SEVERITY[HIGH]:
            tag = HIGH
    return tag


def reportable_mastery(row: LearnerLessonMastery, settings: Settings) -> float:
    """The knowledge estimate, held within reach of the learner's actual record.

    BKT's P(L) answers "what is the chance they know this *now*", and it is
    recency-weighted by design: Bulut et al. (2023), Eq. 3 -- each observation
    updates the posterior and then applies the learn transition, so a run of
    correct answers is *supposed* to move it sharply. That is the right
    behaviour for a learner who has turned a corner, and the wrong one to put
    on a dashboard unqualified: with the untrained fallback parameters, three
    correct answers took a real learner to 0.98 on a lesson they had answered
    19 right and 70 wrong. No reading of that record supports 98%.

    So once there is enough evidence to be worth trusting, observed accuracy
    sets a ceiling on what is *reported*. The headroom above accuracy is
    deliberate rather than slack -- a learner who has genuinely improved should
    read higher than their lifetime average, because that average still carries
    everything they have since learned. What they cannot do is read as mastered
    on the strength of the last three answers alone.

    Applied here, at the point of reporting, and never written back to
    `LearnerLessonMastery`: the stored value is the input to the next update
    (`mastery_before`), so capping it would feed a doctored prior into the
    chain and compound at every step. The model stays the model; this is a
    statement about what we are willing to *claim*.

    Once per-lesson parameters are actually fitted this guard should bind far
    less often, and its headroom is worth revisiting then -- it is a safeguard
    against untrained parameters, not a permanent part of the model.
    """
    mastery = row.mastery_probability
    evidence = (row.correct_count or 0) + (row.incorrect_count or 0)

    # Too little to draw a ceiling from: an estimate is meant to move freely
    # early on, and a bound taken from two answers is noise.
    if evidence < settings.mastery_accuracy_guard_min_evidence:
        return mastery

    accuracy = (row.correct_count or 0) / evidence
    return min(mastery, accuracy + settings.mastery_accuracy_guard_headroom)


def compute_lesson_priority(row: LearnerLessonMastery, settings: Settings) -> dict:
    """Weighted, missing-data-normalized lesson priority."""
    mastery = reportable_mastery(row, settings)
    evidence = (row.correct_count or 0) + (row.incorrect_count or 0)
    mastery_weakness = _clamp((1.0 - mastery) * 100.0)

    components: list[tuple[float, float]] = [
        (mastery_weakness, settings.priority_weight_mastery)
    ]
    reasons: list[str] = []

    incorrect_rate = None
    if evidence > 0:
        incorrect_rate = _clamp(row.incorrect_count / evidence * 100.0)
        components.append((incorrect_rate, settings.priority_weight_incorrect))
        if incorrect_rate >= 50:
            reasons.append("Missed at least half of recent questions")

    # NOTE: priority_weight_mock/priority_weight_diagnostic re-weight the
    # SAME mastery_weakness value computed above, not an independent
    # mock/diagnostic-specific signal -- there is no separate "mastery as
    # measured by mock exams only" number being tracked. Bumping these
    # weights makes a lesson whose most recent assessment was a mock/
    # diagnostic count as MORE urgent for the same underlying mastery, it
    # does not add new evidence.
    last_type = (row.last_assessment_type or "").upper()
    if last_type == "MOCK_EXAM":
        components.append((mastery_weakness, settings.priority_weight_mock))
        if mastery < settings.mastery_high_ceiling:
            reasons.append("Weak in the latest mock exam")
    if last_type == "DIAGNOSTIC":
        components.append((mastery_weakness, settings.priority_weight_diagnostic))
        reasons.append("Flagged weak by the diagnostic")

    review_urgency = _review_urgency(row.last_updated)
    if review_urgency is not None:
        components.append((review_urgency, settings.priority_weight_review))

    weight_total = sum(weight for _, weight in components)
    score = (
        sum(value * weight for value, weight in components) / weight_total
        if weight_total > 0
        else mastery_weakness
    )
    score = round(_clamp(score), 2)

    if mastery < settings.mastery_high_ceiling:
        reasons.insert(0, "Mastery is below 30%")
    if not reasons and mastery >= settings.mastered_threshold:
        reasons.append("Consistently strong performance")

    tag = classify_tag(score, mastery, evidence, settings)
    return {
        "priority_score": score,
        "priority_tag": tag,
        "priority_label": LABELS[tag],
        "primary_reason": reasons[0] if reasons else None,
        "reasons": reasons,
        "recommended_action": ACTION[tag],
        "recommended_activity": ACTIVITY[tag],
        "mastery_probability": mastery,
        # Derived from the reported figure, not the stored one. Read off the
        # row it could say "mastered" beside a percentage the guard had just
        # pulled down, and a badge contradicting the number under it is worse
        # than either being wrong alone.
        "mastery_level": mastery_level(
            mastery,
            developing_threshold=settings.developing_threshold,
            good_threshold=settings.good_threshold,
            mastered_threshold=settings.mastered_threshold,
        ),
        "evidence_count": evidence,
    }


def _review_urgency(last_updated: datetime | None) -> float | None:
    if last_updated is None:
        return None
    now = datetime.now(timezone.utc)
    reference = last_updated if last_updated.tzinfo else last_updated.replace(tzinfo=timezone.utc)
    days = max(0.0, (now - reference).total_seconds() / 86400.0)
    return _clamp(days * 5.0)  # ~20 days since review saturates the component


def apply_hysteresis(
    existing: LearnerCategoryPriority | None,
    raw_tag: str,
    new_score: float,
    settings: Settings,
) -> str:
    """Damp tag flapping: a worse tag needs +worsen_margin, better needs -improve_margin."""
    if existing is None or raw_tag in _DATA_STATES or existing.priority_tag in _DATA_STATES:
        return raw_tag
    old_tag = existing.priority_tag
    if old_tag == raw_tag:
        return raw_tag
    old_sev = SEVERITY.get(old_tag, 0)
    new_sev = SEVERITY.get(raw_tag, 0)
    old_score = existing.priority_score
    if new_sev > old_sev and new_score < old_score + settings.priority_worsen_margin:
        return old_tag
    if new_sev < old_sev and new_score > old_score - settings.priority_improve_margin:
        return old_tag
    return raw_tag


def upsert_priority(
    session: Session,
    *,
    learner_id: int,
    certification_id: int,
    category_type: str,
    category_id: int,
    title: str | None,
    computed: dict,
    settings: Settings,
    model_version: str | None = None,
    last_assessment_type: str | None = None,
    source_event_id: str | None = None,
    exam_id: int | None = None,
    major_category_id: int | None = None,
    middle_category_id: int | None = None,
    lesson_id: int | None = None,
) -> None:
    """Insert/update the current priority row and append history on a real change."""
    category_key = f"{category_type}:{category_id}"
    existing = session.scalar(
        select(LearnerCategoryPriority).where(
            LearnerCategoryPriority.learner_id == learner_id,
            LearnerCategoryPriority.certification_id == certification_id,
            LearnerCategoryPriority.category_key == category_key,
        )
    )

    raw_tag = computed["priority_tag"]
    new_score = computed["priority_score"]
    final_tag = apply_hysteresis(existing, raw_tag, new_score, settings)
    final_label = LABELS[final_tag]
    now = datetime.now(timezone.utc)

    previous_tag = existing.priority_tag if existing else None
    previous_score = existing.priority_score if existing else None

    if existing is None:
        existing = LearnerCategoryPriority(
            learner_id=learner_id,
            certification_id=certification_id,
            category_type=category_type,
            category_key=category_key,
            major_category_id=major_category_id,
            middle_category_id=middle_category_id,
            lesson_id=lesson_id,
            calculated_at=now,
        )
        session.add(existing)

    existing.category_title = title
    existing.mastery_probability = computed.get("mastery_probability")
    existing.mastery_level = computed.get("mastery_level")
    existing.priority_score = new_score
    existing.priority_tag = final_tag
    existing.priority_label = final_label
    existing.primary_reason = computed.get("primary_reason")
    existing.reasons_json = computed.get("reasons")
    existing.recommended_action = computed.get("recommended_action")
    existing.recommended_activity = computed.get("recommended_activity")
    existing.evidence_count = computed.get("evidence_count", 0)
    existing.model_version = model_version
    existing.last_assessment_type = last_assessment_type
    existing.updated_at = now

    tag_changed = previous_tag != final_tag
    score_moved = previous_score is None or abs((previous_score or 0.0) - new_score) >= 1.0
    if tag_changed or score_moved:
        session.add(
            LearnerCategoryPriorityHistory(
                learner_id=learner_id,
                certification_id=certification_id,
                category_type=category_type,
                category_id=category_id,
                previous_priority_score=previous_score,
                new_priority_score=new_score,
                previous_priority_tag=previous_tag,
                new_priority_tag=final_tag,
                primary_reason=computed.get("primary_reason"),
                source_event_id=source_event_id,
                exam_id=exam_id,
                assessment_type=last_assessment_type,
                model_version=model_version,
                created_at=now,
            )
        )

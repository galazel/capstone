"""Aggregate lesson priorities into middle- and major-category priorities.

A simple mastery average would let strong lessons hide a critical required
lesson, so aggregation combines a weighted priority average with weak/high/
critical shares and applies escalation rules.
"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import LearnerCategoryPriority, LearnerLessonMastery
from app.services import priority_service as ps


def _at_least(tag: str, floor: str) -> str:
    if tag in ps._DATA_STATES:
        return tag
    return tag if ps.SEVERITY.get(tag, 0) >= ps.SEVERITY.get(floor, 0) else floor


def _weighted_average(pairs: list[tuple[float, float]]) -> float:
    weight_total = sum(w for _, w in pairs)
    if weight_total <= 0:
        return 0.0
    return sum(v * w for v, w in pairs) / weight_total


def _finalize(score: float, tag: str, reasons: list[str], *, avg_mastery: float | None,
              evidence_count: int) -> dict:
    score = round(max(0.0, min(100.0, score)), 2)
    return {
        "priority_score": score,
        "priority_tag": tag,
        "priority_label": ps.LABELS[tag],
        "primary_reason": reasons[0] if reasons else None,
        "reasons": reasons,
        "recommended_action": ps.ACTION[tag],
        "recommended_activity": ps.ACTIVITY[tag],
        "mastery_probability": avg_mastery,
        "mastery_level": None,
        "evidence_count": evidence_count,
    }


def recompute_categories(
    session: Session,
    *,
    learner_id: int,
    certification_id: int,
    settings: Settings,
    source_event_id: str | None = None,
    exam_id: int | None = None,
    model_version: str | None = None,
    major_category_id: int | None = None,
    middle_category_id: int | None = None,
) -> None:
    """Rebuild middle- and major-category priorities.

    When major_category_id/middle_category_id are given (the online
    per-event path in mastery_service), only the touched middle category is
    re-aggregated from its own lesson rows, and only the touched major
    category is re-aggregated -- reusing every OTHER middle category's
    already-stored priority row instead of recomputing it, since major
    aggregation only needs each middle's summary (score/tag/mastery/
    evidence), not its individual lessons. This bounds the work to the
    touched branch instead of redoing the whole certification's hierarchy on
    every single answer. Falls back to a full rebuild when no scope is given
    (used by full_recalculate, the admin-triggered recompute).
    """
    if middle_category_id is not None and major_category_id is not None:
        _recompute_one_branch(
            session,
            learner_id=learner_id,
            certification_id=certification_id,
            settings=settings,
            source_event_id=source_event_id,
            exam_id=exam_id,
            model_version=model_version,
            major_category_id=major_category_id,
            middle_category_id=middle_category_id,
        )
        return

    mastery_rows = list(
        session.scalars(
            select(LearnerLessonMastery).where(
                LearnerLessonMastery.learner_id == learner_id,
                LearnerLessonMastery.certification_id == certification_id,
            )
        )
    )
    middle_title = {r.middle_category_id: r.middle_category_title for r in mastery_rows}
    major_title = {r.major_category_id: r.major_category_title for r in mastery_rows}

    lesson_rows = list(
        session.scalars(
            select(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id,
                LearnerCategoryPriority.certification_id == certification_id,
                LearnerCategoryPriority.category_type == "LESSON",
            )
        )
    )
    if not lesson_rows:
        return

    by_middle: dict[int, list[LearnerCategoryPriority]] = defaultdict(list)
    middle_to_major: dict[int, int | None] = {}
    for row in lesson_rows:
        if row.middle_category_id is None:
            continue
        by_middle[row.middle_category_id].append(row)
        middle_to_major.setdefault(row.middle_category_id, row.major_category_id)

    middle_computed: dict[int, dict] = {}
    for middle_id, lessons in by_middle.items():
        computed = _aggregate_middle(lessons, settings)
        middle_computed[middle_id] = computed
        ps.upsert_priority(
            session,
            learner_id=learner_id,
            certification_id=certification_id,
            category_type="MIDDLE",
            category_id=middle_id,
            title=middle_title.get(middle_id),
            computed=computed,
            settings=settings,
            model_version=model_version,
            source_event_id=source_event_id,
            exam_id=exam_id,
            major_category_id=middle_to_major.get(middle_id),
            middle_category_id=middle_id,
        )

    by_major: dict[int, list[int]] = defaultdict(list)
    for middle_id, major_id in middle_to_major.items():
        if major_id is not None:
            by_major[major_id].append(middle_id)

    for major_id, middle_ids in by_major.items():
        major_lessons = [l for m in middle_ids for l in by_middle[m]]
        computed = _aggregate_major(
            [middle_computed[m] for m in middle_ids], major_lessons, settings
        )
        ps.upsert_priority(
            session,
            learner_id=learner_id,
            certification_id=certification_id,
            category_type="MAJOR",
            category_id=major_id,
            title=major_title.get(major_id),
            computed=computed,
            settings=settings,
            model_version=model_version,
            source_event_id=source_event_id,
            exam_id=exam_id,
            major_category_id=major_id,
        )


def _recompute_one_branch(
    session: Session,
    *,
    learner_id: int,
    certification_id: int,
    settings: Settings,
    source_event_id: str | None,
    exam_id: int | None,
    model_version: str | None,
    major_category_id: int,
    middle_category_id: int,
) -> None:
    middle_lesson_rows = list(
        session.scalars(
            select(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id,
                LearnerCategoryPriority.certification_id == certification_id,
                LearnerCategoryPriority.category_type == "LESSON",
                LearnerCategoryPriority.middle_category_id == middle_category_id,
            )
        )
    )
    if not middle_lesson_rows:
        return

    sample_mastery = session.scalar(
        select(LearnerLessonMastery)
        .where(
            LearnerLessonMastery.learner_id == learner_id,
            LearnerLessonMastery.middle_category_id == middle_category_id,
        )
        .limit(1)
    )
    middle_title = sample_mastery.middle_category_title if sample_mastery else None
    major_title = sample_mastery.major_category_title if sample_mastery else None

    middle_computed = _aggregate_middle(middle_lesson_rows, settings)
    ps.upsert_priority(
        session,
        learner_id=learner_id,
        certification_id=certification_id,
        category_type="MIDDLE",
        category_id=middle_category_id,
        title=middle_title,
        computed=middle_computed,
        settings=settings,
        model_version=model_version,
        source_event_id=source_event_id,
        exam_id=exam_id,
        major_category_id=major_category_id,
        middle_category_id=middle_category_id,
    )
    session.flush()

    # Major aggregation only needs every middle's stored summary (not its
    # individual lessons) plus every lesson under the major for critical/
    # high-lesson ratios -- both scoped to this major category, not the
    # whole certification.
    middle_rows = list(
        session.scalars(
            select(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id,
                LearnerCategoryPriority.certification_id == certification_id,
                LearnerCategoryPriority.category_type == "MIDDLE",
                LearnerCategoryPriority.major_category_id == major_category_id,
            )
        )
    )
    middle_dicts = [
        {
            "priority_score": row.priority_score,
            "priority_tag": row.priority_tag,
            "mastery_probability": row.mastery_probability,
            "evidence_count": row.evidence_count,
        }
        for row in middle_rows
    ]

    major_lesson_rows = list(
        session.scalars(
            select(LearnerCategoryPriority).where(
                LearnerCategoryPriority.learner_id == learner_id,
                LearnerCategoryPriority.certification_id == certification_id,
                LearnerCategoryPriority.category_type == "LESSON",
                LearnerCategoryPriority.major_category_id == major_category_id,
            )
        )
    )

    major_computed = _aggregate_major(middle_dicts, major_lesson_rows, settings)
    ps.upsert_priority(
        session,
        learner_id=learner_id,
        certification_id=certification_id,
        category_type="MAJOR",
        category_id=major_category_id,
        title=major_title,
        computed=major_computed,
        settings=settings,
        model_version=model_version,
        source_event_id=source_event_id,
        exam_id=exam_id,
        major_category_id=major_category_id,
    )


def full_recalculate(
    session: Session,
    *,
    learner_id: int,
    certification_id: int,
    settings: Settings,
) -> None:
    """Recompute every lesson priority from stored mastery, then roll up.

    Used by the admin/priority recalculate endpoint; the online path recomputes
    incrementally as each event arrives.
    """
    mastery_rows = list(
        session.scalars(
            select(LearnerLessonMastery).where(
                LearnerLessonMastery.learner_id == learner_id,
                LearnerLessonMastery.certification_id == certification_id,
            )
        )
    )
    for row in mastery_rows:
        computed = ps.compute_lesson_priority(row, settings)
        ps.upsert_priority(
            session,
            learner_id=learner_id,
            certification_id=certification_id,
            category_type="LESSON",
            category_id=row.lesson_id,
            title=row.lesson_title,
            computed=computed,
            settings=settings,
            last_assessment_type=row.last_assessment_type,
            major_category_id=row.major_category_id,
            middle_category_id=row.middle_category_id,
            lesson_id=row.lesson_id,
        )
    session.flush()
    recompute_categories(
        session,
        learner_id=learner_id,
        certification_id=certification_id,
        settings=settings,
    )


def _aggregate_middle(lessons: list[LearnerCategoryPriority], settings: Settings) -> dict:
    total = len(lessons)
    weighted = _weighted_average(
        [(l.priority_score, max(1, l.evidence_count)) for l in lessons]
    )
    weak = sum(
        1 for l in lessons
        if l.mastery_probability is not None
        and l.mastery_probability < settings.developing_threshold
    )
    high = sum(1 for l in lessons if l.priority_tag in (ps.HIGH, ps.CRITICAL))
    critical = sum(1 for l in lessons if l.priority_tag == ps.CRITICAL)
    evidence_total = sum(l.evidence_count for l in lessons)

    weak_pct = weak / total * 100 if total else 0.0
    high_pct = high / total * 100 if total else 0.0
    score = _weighted_average([(weighted, 0.55), (weak_pct, 0.20), (high_pct, 0.15)])

    masteries = [l.mastery_probability for l in lessons if l.mastery_probability is not None]
    avg_mastery = sum(masteries) / len(masteries) if masteries else None

    if evidence_total == 0:
        tag = ps.NOT_ENOUGH_DATA
    else:
        tag = ps.classify_tag(score, avg_mastery, evidence_total, settings)
        if total and (high / total) >= 0.5:
            tag = _at_least(tag, ps.HIGH)  # weak lessons must not hide under strong ones

    reasons = []
    if critical:
        reasons.append(f"{critical} critical lesson(s) in this category")
    elif high:
        reasons.append(f"{high} high-priority lesson(s) in this category")
    return _finalize(score, tag, reasons, avg_mastery=avg_mastery, evidence_count=evidence_total)


def _aggregate_major(
    middles: list[dict], lessons: list[LearnerCategoryPriority], settings: Settings
) -> dict:
    weighted = _weighted_average(
        [(m["priority_score"], max(1, m.get("evidence_count", 0))) for m in middles]
    )
    total_lessons = len(lessons)
    critical_lessons = sum(1 for l in lessons if l.priority_tag == ps.CRITICAL)
    high_lessons = sum(1 for l in lessons if l.priority_tag in (ps.HIGH, ps.CRITICAL))
    critical_ratio = critical_lessons / total_lessons if total_lessons else 0.0

    score = _weighted_average([(weighted, 0.60), (critical_ratio * 100, 0.10)])
    evidence_total = sum(m.get("evidence_count", 0) for m in middles)

    masteries = [m["mastery_probability"] for m in middles if m.get("mastery_probability") is not None]
    avg_mastery = sum(masteries) / len(masteries) if masteries else None

    if evidence_total == 0:
        tag = ps.NOT_ENOUGH_DATA
    else:
        tag = ps.classify_tag(score, avg_mastery, evidence_total, settings)
        critical_middles = sum(1 for m in middles if m["priority_tag"] == ps.CRITICAL)
        if critical_middles >= 2:
            tag = _at_least(tag, ps.CRITICAL)
        elif total_lessons and (high_lessons / total_lessons) >= 0.40:
            tag = _at_least(tag, ps.HIGH)

    reasons = []
    if critical_lessons:
        reasons.append(f"{critical_lessons} critical lesson(s) across this area")
    return _finalize(score, tag, reasons, avg_mastery=avg_mastery, evidence_count=evidence_total)

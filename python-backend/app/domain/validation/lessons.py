"""Deterministic quality checks over an authored lesson.

Split the same way as question validation: the Pydantic model rejects
*missing* anatomy (no summary, no objectives) and the retry policy asks the
model again; this layer reports content that is present but weak, so a
reviewing admin can judge it.
"""

from __future__ import annotations

from typing import Any

from app.domain.validation.report import Severity, ValidationIssue, ValidationReport

# Below this a "lesson" is a stub, whatever its block count says.
MIN_CONTENT_BLOCKS = 3
MIN_TOTAL_CHARS = 600
# Beyond this, study time stops being plausible for a single sitting.
MAX_REASONABLE_MINUTES = 180
MIN_REASONABLE_MINUTES = 3

_VISUAL_BLOCK_TYPES = {
    "image", "image-left-text", "image-right-text", "video",
    "intro-image-card", "image-feature-grid", "media-text-block",
}


def _get(lesson: Any, field: str, default=None):
    if isinstance(lesson, dict):
        return lesson.get(field, default)
    return getattr(lesson, field, default)


def _block_type(block: Any) -> str:
    """A block's ``type`` as a string, or "" when it is anything else.

    The model occasionally emits an object here instead of a name; without
    this an unhashable value reaches a set membership test and raises.
    """
    if not isinstance(block, dict):
        return ""
    value = block.get("type")
    return value if isinstance(value, str) else ""


def _block_text_length(sections: list[dict]) -> int:
    total = 0
    for block in sections or []:
        data = block.get("data", {}) if isinstance(block, dict) else {}
        if not isinstance(data, dict):
            continue
        for value in data.values():
            if isinstance(value, str):
                total += len(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        total += sum(len(v) for v in item.values() if isinstance(v, str))
    return total


def validate_lesson(lesson: Any, *, expect_visuals: bool = False) -> ValidationReport:
    """Quality report for one lesson. Advisory -- never blocks on its own."""
    issues: list[ValidationIssue] = []
    sections = _get(lesson, "sections", []) or []
    stats: dict[str, Any] = {
        "block_count": len(sections),
        "objective_count": len(_get(lesson, "learning_objectives", []) or []),
        "key_term_count": len(_get(lesson, "key_terms", []) or []),
        "estimated_minutes": _get(lesson, "estimated_minutes", 0),
    }

    if len(sections) < MIN_CONTENT_BLOCKS:
        issues.append(
            ValidationIssue(
                code="THIN_CONTENT",
                severity=Severity.ERROR,
                message=(
                    f"Lesson has only {len(sections)} content block(s); "
                    f"expected at least {MIN_CONTENT_BLOCKS}."
                ),
            )
        )

    total_chars = _block_text_length(sections)
    stats["content_chars"] = total_chars
    if total_chars < MIN_TOTAL_CHARS:
        issues.append(
            ValidationIssue(
                code="SHALLOW_CONTENT",
                severity=Severity.WARNING,
                message=(
                    f"Instructional content is only ~{total_chars} characters; "
                    f"this reads as an outline rather than a lesson."
                ),
            )
        )

    if not (_get(lesson, "key_terms", []) or []):
        issues.append(
            ValidationIssue(
                code="NO_KEY_TERMS",
                severity=Severity.WARNING,
                message="Lesson defines no key terms, so it contributes nothing to the glossary.",
            )
        )

    minutes = _get(lesson, "estimated_minutes", 0) or 0
    if minutes and not (MIN_REASONABLE_MINUTES <= minutes <= MAX_REASONABLE_MINUTES):
        issues.append(
            ValidationIssue(
                code="IMPLAUSIBLE_STUDY_TIME",
                severity=Severity.WARNING,
                message=(
                    f"Estimated study time of {minutes} minutes is outside the "
                    f"plausible {MIN_REASONABLE_MINUTES}-{MAX_REASONABLE_MINUTES} minute range."
                ),
            )
        )

    objectives = _get(lesson, "learning_objectives", []) or []
    if len(objectives) > 8:
        issues.append(
            ValidationIssue(
                code="TOO_MANY_OBJECTIVES",
                severity=Severity.WARNING,
                message=(
                    f"{len(objectives)} learning objectives for one lesson; "
                    f"this is probably a middle category masquerading as a lesson."
                ),
            )
        )

    has_visual = any(_block_type(b) in _VISUAL_BLOCK_TYPES for b in sections)
    stats["has_visual"] = has_visual
    if expect_visuals and not has_visual:
        issues.append(
            ValidationIssue(
                code="NO_VISUALS",
                severity=Severity.WARNING,
                message="The curriculum recommended visuals for this lesson but none were included.",
            )
        )

    penalty = sum(
        {Severity.ERROR: 25, Severity.WARNING: 8, Severity.INFO: 0}[i.severity] for i in issues
    )
    return ValidationReport(issues=issues, score=max(0, 100 - penalty), stats=stats)


def validate_lessons(lessons: list[Any]) -> ValidationReport:
    """Aggregate report across a set of lessons, tagging each issue with the
    index of the lesson it came from."""
    issues: list[ValidationIssue] = []
    scores: list[int] = []

    for index, lesson in enumerate(lessons or []):
        report = validate_lesson(lesson)
        scores.append(report.score)
        for issue in report.issues:
            issues.append(issue.model_copy(update={"question_indices": [index]}))

    if not lessons:
        return ValidationReport(
            issues=[
                ValidationIssue(
                    code="NO_LESSONS", severity=Severity.ERROR, message="No lessons were generated."
                )
            ],
            score=0,
            stats={"lesson_count": 0},
        )

    return ValidationReport(
        issues=issues,
        score=round(sum(scores) / len(scores)),
        stats={"lesson_count": len(lessons)},
    )

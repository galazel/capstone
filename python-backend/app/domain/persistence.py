"""Pure mapping from generated content onto Java's assessment schema.

The hard constraint this module exists to solve: `questions.lesson_id` is
NOT NULL in Java's schema, so *every* question must belong to exactly one
lesson. But most generated artifacts deliberately span many lessons -- a
major-category quiz covers everything under that category, and the mock exam
and question bank cover the whole certification.

So each question has to be resolved to a concrete lesson. The generator
emits `lesson_ref` (a lesson *name*) for exactly this purpose; this module
turns that into a lesson id, and decides what to do when it can't.

No I/O here -- callers pass in the lesson lookup and receive plain rows.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

logger = logging.getLogger(__name__)

# Java's canonical exam types (see V8/V16 migrations).
EXAM_TYPE_LESSON_QUIZ = "LESSON_QUIZ"
EXAM_TYPE_MIDDLE_EXAM = "MIDDLE_EXAM"
EXAM_TYPE_MAJOR_EXAM = "MAJOR_EXAM"
EXAM_TYPE_DIAGNOSTIC = "DIAGNOSTIC"
EXAM_TYPE_MOCK_EXAM = "MOCK_EXAM"

CHECKING_METHOD_EXACT = "EXACT_MATCH"
CHECKING_METHOD_SEMANTIC = "AI_SEMANTIC"


def normalize_lesson_name(name: str) -> str:
    return " ".join(re.findall(r"\w+", (name or "").lower()))


@dataclass
class LessonResolution:
    """Outcome of mapping a question to a lesson."""

    lesson_id: int | None
    #: True when the id came from an exact/normalized name match rather than
    #: a positional fallback.
    matched: bool
    reason: str = ""


@dataclass
class PersistencePlan:
    """What will be written, plus what could not be."""

    questions: list[dict[str, Any]] = field(default_factory=list)
    unresolved: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def build_lesson_index(lessons: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Maps normalized lesson name -> lesson_id.

    Later duplicates lose: two lessons sharing a name is a curriculum
    problem, and picking the first is at least deterministic.
    """
    index: dict[str, int] = {}
    for lesson in lessons:
        key = normalize_lesson_name(lesson.get("name", ""))
        if key and key not in index:
            index[key] = lesson["lesson_id"]
    return index


def resolve_lesson(
    question: dict[str, Any],
    lesson_index: dict[str, int],
    *,
    fallback_lesson_id: int | None = None,
) -> LessonResolution:
    """Resolves one question's owning lesson.

    Exact name match is preferred. When the generator names a lesson that
    doesn't exist -- which it will, since `lesson_ref` is free text -- we
    fall back to a caller-supplied lesson (typically the first in the
    artifact's scope) rather than dropping content an admin already
    approved. The fallback is reported, never silent, because a
    mis-attributed question degrades adaptive retake targeting.
    """
    ref = (question.get("lesson_ref") or "").strip()
    if ref:
        key = normalize_lesson_name(ref)
        if key in lesson_index:
            return LessonResolution(lesson_index[key], matched=True)
        # Substring match catches "Indexing" vs "Database Indexing".
        candidates = [name for name in lesson_index if key and (key in name or name in key)]
        if len(candidates) == 1:
            return LessonResolution(
                lesson_index[candidates[0]],
                matched=True,
                reason=f"fuzzy match '{ref}' -> '{candidates[0]}'",
            )

    if fallback_lesson_id is not None:
        return LessonResolution(
            fallback_lesson_id,
            matched=False,
            reason=(
                f"lesson_ref {ref!r} did not match any lesson; "
                f"attributed to fallback lesson {fallback_lesson_id}"
            ),
        )

    return LessonResolution(None, matched=False, reason=f"lesson_ref {ref!r} unresolvable")


def plan_question_rows(
    questions: Iterable[dict[str, Any]],
    lesson_index: dict[str, int],
    *,
    fallback_lesson_id: int | None = None,
) -> PersistencePlan:
    """Attaches a lesson_id to every question, or sets it aside."""
    plan = PersistencePlan()
    unmatched = 0

    for question in questions:
        resolution = resolve_lesson(question, lesson_index, fallback_lesson_id=fallback_lesson_id)
        if resolution.lesson_id is None:
            plan.unresolved.append(question)
            continue
        if not resolution.matched:
            unmatched += 1
        plan.questions.append({**question, "_lesson_id": resolution.lesson_id})

    if unmatched:
        plan.warnings.append(
            f"{unmatched} question(s) could not be matched to a named lesson and were "
            f"attributed to a fallback lesson; adaptive retake targeting will be "
            f"approximate for those."
        )
    if plan.unresolved:
        plan.warnings.append(
            f"{len(plan.unresolved)} question(s) had no resolvable lesson and were not saved."
        )
    return plan


def exam_type_for_scope(scope: str) -> str:
    return {
        "LESSON": EXAM_TYPE_LESSON_QUIZ,
        "MIDDLE": EXAM_TYPE_MIDDLE_EXAM,
        "MAJOR": EXAM_TYPE_MAJOR_EXAM,
        "DIAGNOSTIC": EXAM_TYPE_DIAGNOSTIC,
        "MOCK": EXAM_TYPE_MOCK_EXAM,
    }[scope]


def checking_method_for(question_type: str) -> str:
    """SHORT_ANSWER has one right string; DESCRIPTIVE needs semantic grading."""
    return CHECKING_METHOD_EXACT if question_type == "SHORT_ANSWER" else CHECKING_METHOD_SEMANTIC

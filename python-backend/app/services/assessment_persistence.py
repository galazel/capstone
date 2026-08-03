"""Writes generated questions and exams into Java's assessment schema.

Until now the certification graph generated major/middle/lesson quizzes, a
diagnostic exam, a mock exam, and a 100-question bank -- and then discarded
all of it. Only the curriculum (categories and lessons) was persisted, so
every quiz and exam an admin approved existed solely inside a LangGraph
checkpoint and was invisible to the learner app, the adaptive retake
selector, and BKT.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.domain.persistence import (
    build_lesson_index,
    normalize_lesson_name,
    checking_method_for,
    exam_type_for_scope,
    plan_question_rows,
)
from app.repositories import java_backend as repo

logger = logging.getLogger(__name__)


def _persist_one_question(session: Session, question: dict[str, Any]) -> int:
    """Writes a question plus whatever type-specific config it needs."""
    question_type = question.get("question_type", "MCQ")
    question_id = repo.insert_question(
        session,
        lesson_id=question["_lesson_id"],
        question_type=question_type,
        difficulty=question.get("difficulty", "AVERAGE"),
        question_text=question.get("question", ""),
    )

    if question_type == "MCQ":
        correct_index = question.get("correct_choice_index")
        per_choice = question.get("choice_explanations") or []
        choices = question.get("choices") or []
        aligned = len(per_choice) == len(choices)

        for index, choice_text in enumerate(choices):
            if aligned and (per_choice[index] or "").strip():
                # Why *this* option is right or wrong -- the half a learner who
                # picked a distractor actually needs. `QuestionDraft` requires
                # these for every MCQ, so this is the normal path.
                explanation = per_choice[index]
            elif index == correct_index:
                # Only reachable for a question that did not come from
                # generation -- a reviewer's hand-written edit, or an artifact
                # from a run predating per-choice explanations. Falls back to
                # the item-level explanation on the correct choice.
                explanation = question.get("explanation")
            else:
                explanation = None

            repo.insert_choice(
                session,
                question_id,
                choice_text,
                is_correct=(index == correct_index),
                explanation=explanation,
            )

    elif question_type in ("SHORT_ANSWER", "DESCRIPTIVE"):
        answer = question.get("correct_answer") or question.get("rubric_answer") or ""
        repo.insert_text_config(
            session, question_id, answer, checking_method_for(question_type)
        )

    elif question_type == "PROGRAMMING":
        repo.insert_programming_config(
            session, question_id, question.get("starter_code"), question.get("test_cases") or []
        )

    elif question_type == "DIAGRAM":
        repo.insert_diagram_config(
            session, question_id, question.get("diagram_type") or "FLOWCHART",
            question.get("instructions"),
        )

    return question_id


def persist_questions(
    session: Session,
    questions: list[dict[str, Any]],
    lesson_index: dict[str, int],
    *,
    fallback_lesson_id: int | None = None,
) -> tuple[list[int], list[str]]:
    """Persists a set of questions, resolving each to a lesson first.

    Returns (question_ids, warnings). Warnings cover questions attributed to
    a fallback lesson or skipped entirely -- never silent, because a
    mis-attributed question degrades adaptive retake targeting.
    """
    plan = plan_question_rows(questions, lesson_index, fallback_lesson_id=fallback_lesson_id)
    question_ids = [_persist_one_question(session, q) for q in plan.questions]

    for warning in plan.warnings:
        logger.warning("%s", warning)

    return question_ids, plan.warnings


def persist_exam(
    session: Session,
    *,
    certification_id: int,
    scope: str,
    title: str,
    questions: list[dict[str, Any]],
    lesson_index: dict[str, int],
    fallback_lesson_id: int | None = None,
    lesson_id: int | None = None,
    middle_category_id: int | None = None,
    major_category_id: int | None = None,
) -> tuple[int | None, list[str]]:
    """Persists one exam and the questions it contains.

    Created as DRAFT: nothing generated reaches a learner until an admin
    publishes it, which is the Phase 2 brief's "under no circumstances
    should AI-generated educational content be published automatically".
    """
    if not questions:
        return None, [f"'{title}' had no questions; no exam created."]

    exam_type_text = exam_type_for_scope(scope)
    exam_type_id = repo.get_exam_type_id(session, exam_type_text)
    if exam_type_id is None:
        return None, [f"exam_type '{exam_type_text}' is not seeded; '{title}' was not saved."]

    question_ids, warnings = persist_questions(
        session, questions, lesson_index, fallback_lesson_id=fallback_lesson_id
    )
    if not question_ids:
        return None, warnings + [f"'{title}' produced no persistable questions."]

    exam_id = repo.insert_exam(
        session,
        certification_id=certification_id,
        exam_type_id=exam_type_id,
        title=title,
        total_questions=len(question_ids),
        target_scope=scope,
        lesson_id=lesson_id,
        middle_category_id=middle_category_id,
        major_category_id=major_category_id,
    )
    for order, question_id in enumerate(question_ids, start=1):
        repo.insert_exam_question(session, exam_id, question_id, order)

    logger.info("Persisted exam '%s' (%d questions) as DRAFT", title, len(question_ids))
    return exam_id, warnings


def persist_lesson_content(
    session: Session,
    certification_id: int,
    lessons_generated: list[dict[str, Any]],
) -> tuple[int, list[str]]:
    """Writes each generated lesson's blocks onto its curriculum row.

    Lesson *content* was the third thing being discarded with the
    checkpoint: `insert_lesson` always wrote an empty structure, so an
    authored, admin-approved lesson never reached the learner app.
    """
    if not lessons_generated:
        return 0, []

    lesson_index = build_lesson_index(repo.list_certification_lessons(session, certification_id))
    written = 0
    warnings: list[str] = []

    for lesson in lessons_generated:
        name = lesson.get("name") or lesson.get("title") or ""
        lesson_id = lesson_index.get(normalize_lesson_name(name))
        if lesson_id is None:
            warnings.append(f"Generated lesson '{name}' matched no curriculum lesson; content not saved.")
            continue
        blocks = lesson.get("blocks") or lesson.get("sections") or []
        repo.update_lesson_content(session, lesson_id, blocks)
        written += 1

    logger.info("Wrote content for %d/%d generated lessons", written, len(lessons_generated))
    return written, warnings


def persist_generated_assessments(
    session: Session,
    certification_id: int,
    result: dict[str, Any],
) -> dict[str, Any]:
    """Persists every assessment artifact a completed run produced.

    Covers lesson/middle/major quizzes, the diagnostic and mock exams, and
    the adaptive question bank. The bank is stored as questions only -- it is
    a pool for adaptive selection, not a sittable exam, so it gets no `exams`
    row.
    """
    lessons = repo.list_certification_lessons(session, certification_id)
    if not lessons:
        return {"exams": [], "bank_questions": 0, "lessons_written": 0,
                "warnings": ["Certification has no lessons; nothing persisted."]}

    lesson_index = build_lesson_index(lessons)
    default_lesson_id = lessons[0]["lesson_id"]

    created: list[int] = []
    warnings: list[str] = []

    # Lesson bodies first: they belong to the curriculum rows, not to any exam.
    lessons_written, lesson_warnings = persist_lesson_content(
        session, certification_id, result.get("lessons") or []
    )
    warnings.extend(lesson_warnings)

    def _record(exam_id, exam_warnings):
        if exam_id is not None:
            created.append(exam_id)
        warnings.extend(exam_warnings)

    for quiz in result.get("lesson_quizzes") or []:
        lesson_name = quiz.get("lesson", "")
        resolved = lesson_index.get(
            " ".join(lesson_name.lower().split()), default_lesson_id
        )
        _record(*persist_exam(
            session, certification_id=certification_id, scope="LESSON",
            title=f"{lesson_name} Quiz", questions=quiz.get("questions") or [],
            lesson_index=lesson_index, fallback_lesson_id=resolved, lesson_id=resolved,
        ))

    for quiz in result.get("middle_quizzes") or []:
        _record(*persist_exam(
            session, certification_id=certification_id, scope="MIDDLE",
            title=f"{quiz.get('middleCategory', 'Middle Category')} Exam",
            questions=quiz.get("questions") or [],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
        ))

    for quiz in result.get("major_quizzes") or []:
        _record(*persist_exam(
            session, certification_id=certification_id, scope="MAJOR",
            title=f"{quiz.get('majorCategory', 'Major Category')} Exam",
            questions=quiz.get("questions") or [],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
        ))

    diagnostic = result.get("diagnostic_exam") or {}
    if diagnostic.get("questions"):
        _record(*persist_exam(
            session, certification_id=certification_id, scope="DIAGNOSTIC",
            title="Diagnostic Exam", questions=diagnostic["questions"],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
        ))

    mock = result.get("mock_exam") or {}
    if mock.get("questions"):
        _record(*persist_exam(
            session, certification_id=certification_id, scope="MOCK",
            title="Mock Exam", questions=mock["questions"],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
        ))

    # The bank is a pool for adaptive selection/practice, not a sittable
    # exam, so it becomes questions without an `exams` row.
    bank = result.get("question_bank") or []
    bank_ids: list[int] = []
    if bank:
        bank_ids, bank_warnings = persist_questions(
            session, bank, lesson_index, fallback_lesson_id=default_lesson_id
        )
        warnings.extend(bank_warnings)

    session.commit()

    # What the run *produced*, against what actually landed. Every drop above
    # is a warning, and warnings scroll past: a live run generated seven
    # assessments, saved none of them because `exam_types` was unseeded, and
    # still reported "completed". Counting both sides is what lets `finalize`
    # tell a successful run from an empty one.
    expected = {
        "exams": (
            len(result.get("lesson_quizzes") or [])
            + len(result.get("middle_quizzes") or [])
            + len(result.get("major_quizzes") or [])
            + (1 if diagnostic.get("questions") else 0)
            + (1 if mock.get("questions") else 0)
        ),
        "bank_questions": len(bank),
        "lessons": len(result.get("lessons") or []),
    }

    logger.info(
        "Persisted %d/%d exam(s), %d/%d bank item(s), %d/%d lesson bod(y/ies) "
        "for certification %s",
        len(created), expected["exams"],
        len(bank_ids), expected["bank_questions"],
        lessons_written, expected["lessons"],
        certification_id,
    )
    return {
        "exams": created,
        "bank_questions": len(bank_ids),
        "lessons_written": lessons_written,
        "expected": expected,
        "warnings": warnings,
    }

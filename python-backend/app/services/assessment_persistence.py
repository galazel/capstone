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
    build_lesson_sections,
    build_name_index,
    normalize_lesson_name,
    checking_method_for,
    exam_type_for_scope,
    plan_question_rows,
    resolve_category_id,
)
from app.repositories import java_backend as repo

logger = logging.getLogger(__name__)


def _title_key(value: Any) -> str:
    """Case- and whitespace-insensitive identity for an exam title or a
    question's text, used to recognise an artifact that is already stored."""
    return " ".join(str(value or "").lower().split())


#: Generated types that are stored as CRITICAL_THINKING.
#:
#: The generator names the work (PROGRAMMING, DIAGRAM); the product calls both
#: of them critical thinking and identifies which kind from the config row
#: attached to the question -- that is exactly what the manual question builder
#: writes (`questionType: "CRITICAL_THINKING"`, `criticalThinkingType:
#: "PROGRAMMING"`) and what Java's grader reads back through
#: `resolveCriticalThinkingType`.
#:
#: Stored verbatim, the two paths disagreed: an AI-written programming task
#: landed as question_type='PROGRAMMING' and so never appeared under Critical
#: Thinking anywhere in the app, while a hand-written one did. Same question,
#: two categories, depending on who typed it.
_WORKSPACE_TYPES = {"PROGRAMMING", "DIAGRAM"}


def _persist_one_question(session: Session, question: dict[str, Any]) -> int:
    """Writes a question plus whatever type-specific config it needs."""
    question_type = question.get("question_type", "MCQ")

    # What the branches below switch on -- the generator's name for the work.
    # The stored type is CRITICAL_THINKING for the two workspace kinds; which
    # kind it is comes from the config row, not from this column.
    stored_type = (
        "CRITICAL_THINKING" if question_type in _WORKSPACE_TYPES else question_type
    )

    question_id = repo.insert_question(
        session,
        lesson_id=question["_lesson_id"],
        question_type=stored_type,
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
            question.get("reference_diagram_xml"),
        )

    # The parts of a critical-thinking item, as child rows under it. Each is a
    # written answer graded against its own rubric; the Java grader reads the
    # set back by parent id and marks it in one holistic call. Insertion order
    # is the order the learner is asked them in -- the reader orders by
    # question_id -- so this must stay a plain in-order loop.
    # Parts of a SHORT_ANSWER parent are the blanks of a fill-in-the-blank
    # item, and each has ONE right word -- the candidate list in the stem makes
    # sure of it. They are stored as SHORT_ANSWER and marked by exact match,
    # like any other short answer.
    #
    # Marked semantically instead, "Usability" would be graded by asking a
    # model whether it means the same as "Usability" -- a paid call, a slower
    # attempt, and a chance of disagreeing with itself, to check a string
    # equality. Parts of every other parent stay written answers.
    sub_type = "SHORT_ANSWER" if question_type == "SHORT_ANSWER" else "DESCRIPTIVE"

    for sub in question.get("sub_questions") or []:
        sub_id = repo.insert_question(
            session,
            lesson_id=question["_lesson_id"],
            question_type=sub_type,
            difficulty=question.get("difficulty", "AVERAGE"),
            question_text=sub.get("question", ""),
            total_points=float(sub.get("points") or 1.0),
            parent_question_id=question_id,
        )
        # The expected answer, so the grader has something to mark against.
        # Without a text config the sub-answer falls through to "no evaluator
        # applies" and scores zero however good it is.
        repo.insert_text_config(
            session,
            sub_id,
            sub.get("rubric_answer") or "",
            checking_method_for(sub_type),
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
    duration_minutes: int | None = None,
    passing_score: float | None = None,
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
        duration_minutes=duration_minutes,
        # Only when researched; otherwise insert_exam's own 70 stands, so a
        # certification whose real pass mark is unknown behaves as before.
        **({"passing_score": passing_score} if passing_score else {}),
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

    If a generated lesson name does not match an existing curriculum lesson,
    create a new lesson row under the certification's first middle category
    so generated content is not lost. This behaviour avoids dropping AI-
    authored lesson bodies when the curriculum is missing matching rows.
    """
    if not lessons_generated:
        return 0, []

    # Fetch existing lessons and build an index for name -> lesson_id lookups.
    existing_lessons = repo.list_certification_lessons(session, certification_id)
    lesson_index = build_lesson_index(existing_lessons)

    # Default to the first middle_category_id when inserting new lessons.
    default_middle_category_id = (
        existing_lessons[0]["middle_category_id"] if existing_lessons else None
    )

    written = 0
    warnings: list[str] = []

    for lesson in lessons_generated:
        name = lesson.get("name") or lesson.get("title") or ""
        key = normalize_lesson_name(name)
        lesson_id = lesson_index.get(key)
        # The generator emits a flat block list; the editor and the learner
        # viewer both render sections. Convert before writing, or the lesson
        # renders as a stack of empty untitled sections.
        blocks = build_lesson_sections(lesson.get("blocks") or lesson.get("sections") or [])

        if lesson_id is None:
            if default_middle_category_id is None:
                warnings.append(
                    f"Generated lesson '{name}' matched no curriculum lesson; content not saved."
                )
                continue

            # Create a new lesson under the default middle category and write blocks.
            lesson_id = repo.insert_lesson(session, default_middle_category_id, name, blocks)
            # Update local index so subsequent resolutions use the newly-created lesson.
            lesson_index[key] = lesson_id
            logger.info("Inserted new lesson '%s' (id %s) into middle_category %s", name, lesson_id, default_middle_category_id)
            written += 1
            continue

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

    # A middle/major exam is only *seen* by the publish checklist through its
    # category FK: `buildPublishRequirements` derives coverage from
    # `exam.getMiddleCategory()`/`getMajorCategory()`, so an exam saved with a
    # null FK reads as "not created yet" no matter how many questions it has.
    # The generator names its category rather than keying it, so resolve here.
    major_index = build_name_index(
        repo.list_certification_major_categories(session, certification_id), "major_category_id"
    )
    middle_index = build_name_index(
        repo.list_certification_middle_categories(session, certification_id), "middle_category_id"
    )

    created: list[int] = []
    warnings: list[str] = []
    #: Exams this pass did not write because they were already stored. Counted
    #: out of `expected` below, so "generated seven, saved none" still reads as
    #: a systemic failure while "all seven were already saved" does not.
    skipped_exams: list[str] = []

    # What is already stored. A run's output can reach this function twice --
    # once as a partial save when the run failed or was stopped, once in full
    # when the retry finishes -- and every insert below is unconditional, so
    # without this the second pass duplicated every exam and every bank
    # question. An artifact already present is left alone rather than
    # rewritten: the stored copy may have been edited since.
    existing_exams = {
        (row.get("target_scope"), _title_key(row.get("title")))
        for row in repo.list_certification_exams(session, certification_id)
    }
    existing_question_texts = {
        _title_key(text) for text in repo.list_certification_question_texts(session, certification_id)
    }

    def _already_stored(scope: str, title: str) -> bool:
        key = _title_key(title)
        # `target_scope` is what this module writes, but a row created by
        # another path may have none -- so a title match with no scope counts
        # too, rather than being written a second time.
        return (scope, key) in existing_exams or (None, key) in existing_exams

    # Lesson bodies first: they belong to the curriculum rows, not to any exam.
    lessons_written, lesson_warnings = persist_lesson_content(
        session, certification_id, result.get("lessons") or []
    )
    warnings.extend(lesson_warnings)

    def _record(exam_id, exam_warnings):
        if exam_id is not None:
            created.append(exam_id)
        warnings.extend(exam_warnings)

    # What the planner researched about the real paper: how long it runs, how
    # many questions it holds, and the mark that passes it. Every exam this
    # run creates is set against it, so a learner sitting any of them works
    # under the clock and the standard the certification actually applies.
    exam_structure = (result.get("curriculum") or {}).get("exam_structure") or {}
    real_duration = int(exam_structure.get("duration_minutes") or 0) or None
    real_total_items = int(exam_structure.get("total_items") or 0) or None
    real_passing = float(exam_structure.get("passing_score") or 0) or None

    def _timed(question_count: int) -> int | None:
        """Minutes for an exam of this size, at the real paper's pace.

        A twenty-question unit exam is not a two-hour paper, so the real
        duration is scaled by size rather than copied: the pace is what
        transfers, not the total. Untimed when the planner could not find the
        real figures -- a made-up clock is worse than none, because a learner
        pacing themselves against it is being told something false.
        """
        if not real_duration or not real_total_items or question_count <= 0:
            return None
        per_question = real_duration / real_total_items
        # Never under five minutes: a ten-question quiz on a fast paper can
        # scale to two, which is a clock nobody can sit.
        return max(5, round(question_count * per_question))

    def _store_exam(*, scope: str, title: str, **kwargs) -> None:
        """Persists one exam unless an exam of that scope and title is
        already stored for this certification."""
        if _already_stored(scope, title):
            logger.info(
                "Exam '%s' (%s) is already stored for certification %s; keeping the stored copy",
                title, scope, certification_id,
            )
            skipped_exams.append(title)
            return
        existing_exams.add((scope, _title_key(title)))
        _record(*persist_exam(
            session, certification_id=certification_id, scope=scope, title=title, **kwargs
        ))

    for quiz in result.get("lesson_quizzes") or []:
        lesson_name = quiz.get("lesson", "")
        # `normalize_lesson_name`, not a local whitespace collapse.
        #
        # `lesson_index` is keyed with `normalize_lesson_name`, which strips
        # punctuation (a word-character regex); this lookup used
        # `" ".join(name.lower().split())`, which keeps it. So any lesson whose
        # name contains a hyphen, ampersand, slash or apostrophe could never
        # match its own index entry: "E-Business and Electronic Commerce" is
        # stored as "e business ..." and was looked up as "e-business ...".
        #
        # The miss was silent, and the fallback is `lessons[0]`, so the quiz
        # was filed against the FIRST lesson of the certification -- leaving
        # that lesson with two quizzes and its real lesson with none, which
        # only surfaces later as a publishing requirement that cannot be met.
        key = normalize_lesson_name(lesson_name)
        resolved = lesson_index.get(key)
        if resolved is None:
            resolved = default_lesson_id
            # Never silent again: a quiz landing on the wrong lesson is a data
            # error the run should report, not something to discover at publish
            # time.
            warnings.append(
                f"Lesson quiz '{lesson_name}' matched no curriculum lesson; "
                f"filed against lesson {default_lesson_id}."
            )
            logger.warning(
                "Lesson quiz '%s' (key '%s') matched no lesson; falling back to lesson %s",
                lesson_name, key, default_lesson_id,
            )
        lesson_questions = quiz.get("questions") or []
        _store_exam(
            scope="LESSON", title=f"{lesson_name} Quiz",
            questions=lesson_questions,
            lesson_index=lesson_index, fallback_lesson_id=resolved, lesson_id=resolved,
            duration_minutes=_timed(len(lesson_questions)),
            passing_score=real_passing,
        )

    for quiz in result.get("middle_quizzes") or []:
        middle_name = quiz.get("middleCategory") or "Middle Category"
        middle_category_id = resolve_category_id(middle_name, middle_index)
        if middle_category_id is None:
            warnings.append(
                f"Middle exam '{middle_name}' matched no middle category; it will not "
                f"satisfy that category's publishing requirement."
            )
        middle_questions = quiz.get("questions") or []
        _store_exam(
            scope="MIDDLE", title=f"{middle_name} Exam",
            questions=middle_questions,
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
            middle_category_id=middle_category_id,
            duration_minutes=_timed(len(middle_questions)),
            passing_score=real_passing,
        )

    for quiz in result.get("major_quizzes") or []:
        major_name = quiz.get("majorCategory") or "Major Category"
        major_category_id = resolve_category_id(major_name, major_index)
        if major_category_id is None:
            warnings.append(
                f"Major exam '{major_name}' matched no major category; it will not "
                f"satisfy that category's publishing requirement."
            )
        major_questions = quiz.get("questions") or []
        _store_exam(
            scope="MAJOR", title=f"{major_name} Exam",
            questions=major_questions,
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
            major_category_id=major_category_id,
            duration_minutes=_timed(len(major_questions)),
            passing_score=real_passing,
        )

    diagnostic = result.get("diagnostic_exam") or {}
    if diagnostic.get("questions"):
        _store_exam(
            scope="DIAGNOSTIC", title="Diagnostic Exam",
            questions=diagnostic["questions"],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
            # Timed like the real paper, but never pass/failed against it: the
            # diagnostic is a placement measure sat before any teaching, and
            # reporting "failed" to someone who has not studied yet is both
            # wrong and discouraging.
            duration_minutes=real_duration,
        )

    mock = result.get("mock_exam") or {}
    if mock.get("questions"):
        _store_exam(
            scope="MOCK", title="Mock Exam",
            questions=mock["questions"],
            lesson_index=lesson_index, fallback_lesson_id=default_lesson_id,
            duration_minutes=real_duration,
            passing_score=real_passing,
        )

    # The bank is a pool for adaptive selection/practice, not a sittable
    # exam, so it becomes questions without an `exams` row.
    bank = result.get("question_bank") or []
    # Anything already stored under this certification is dropped here rather
    # than written again -- the bank has no exam row to key on, so its text is
    # its identity.
    fresh_bank = [
        question
        for question in bank
        if _title_key(question.get("question")) not in existing_question_texts
    ]
    if len(fresh_bank) != len(bank):
        logger.info(
            "%d of %d bank question(s) are already stored for certification %s; skipping those",
            len(bank) - len(fresh_bank), len(bank), certification_id,
        )
    bank_ids: list[int] = []
    if fresh_bank:
        bank_ids, bank_warnings = persist_questions(
            session, fresh_bank, lesson_index, fallback_lesson_id=default_lesson_id
        )
        warnings.extend(bank_warnings)

    session.commit()

    # What the run *produced*, against what actually landed. Every drop above
    # is a warning, and warnings scroll past: a live run generated seven
    # assessments, saved none of them because `exam_types` was unseeded, and
    # still reported "completed". Counting both sides is what lets `finalize`
    # tell a successful run from an empty one.
    expected = {
        "exams": max(
            0,
            len(result.get("lesson_quizzes") or [])
            + len(result.get("middle_quizzes") or [])
            + len(result.get("major_quizzes") or [])
            + (1 if diagnostic.get("questions") else 0)
            + (1 if mock.get("questions") else 0)
            - len(skipped_exams),
        ),
        # What this pass actually tried to write. Counting the whole bank here
        # would report a re-persist of already-stored work as a total loss.
        "bank_questions": len(fresh_bank),
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

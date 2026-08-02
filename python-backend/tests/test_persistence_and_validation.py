"""Tests for assessment persistence mapping and question validation.

Both are pure domain logic, so they run with no database.
"""

from __future__ import annotations

import pytest

from app.domain.persistence import (
    build_lesson_index,
    checking_method_for,
    exam_type_for_scope,
    normalize_lesson_name,
    plan_question_rows,
    resolve_lesson,
)
from app.domain.validation import Severity, find_duplicates, validate_question_batch
from app.schemas.certification.question_schema import QuestionDraft


LESSONS = [
    {"lesson_id": 11, "name": "Database Indexing"},
    {"lesson_id": 12, "name": "Normalization Forms"},
    {"lesson_id": 13, "name": "Query Optimization"},
]


def _q(**overrides):
    base = {
        "question_type": "MCQ",
        "question": "What is a B-tree index?",
        "difficulty": "AVERAGE",
        "explanation": "A balanced tree structure used to speed up lookups.",
        "choices": ["A tree", "A list", "A hash", "A queue"],
        "correct_choice_index": 0,
        "choice_explanations": [
            "Correct: a B-tree keeps keys sorted across balanced nodes.",
            "A plain list gives no logarithmic lookup.",
            "A hash supports equality only, not range scans.",
            "A queue is an ordering structure, not an index.",
        ],
        "bloom_level": "UNDERSTAND",
        "learning_objective": "Explain indexing",
        "lesson_ref": "Database Indexing",
        "source_chunk_ids": ["c1"],
    }
    base.update(overrides)
    return base


# --- lesson resolution (the questions.lesson_id NOT NULL problem) ---------

def test_lesson_index_normalizes_names():
    index = build_lesson_index(LESSONS)
    assert index[normalize_lesson_name("Database Indexing")] == 11
    assert index[normalize_lesson_name("  database   indexing  ")] == 11


def test_exact_lesson_ref_resolves():
    resolution = resolve_lesson(_q(), build_lesson_index(LESSONS))
    assert resolution.lesson_id == 11
    assert resolution.matched


def test_fuzzy_lesson_ref_resolves_when_unambiguous():
    resolution = resolve_lesson(_q(lesson_ref="Indexing"), build_lesson_index(LESSONS))
    assert resolution.lesson_id == 11
    assert resolution.matched


def test_unmatched_lesson_ref_falls_back_and_reports():
    """A question an admin approved must not be silently dropped, but the
    mis-attribution has to be visible -- it degrades retake targeting."""
    resolution = resolve_lesson(
        _q(lesson_ref="Totally Unrelated Topic"),
        build_lesson_index(LESSONS),
        fallback_lesson_id=99,
    )
    assert resolution.lesson_id == 99
    assert not resolution.matched
    assert "did not match" in resolution.reason


def test_unmatched_with_no_fallback_is_unresolved():
    resolution = resolve_lesson(_q(lesson_ref="Nope"), build_lesson_index(LESSONS))
    assert resolution.lesson_id is None


def test_plan_attaches_lesson_ids_and_warns_about_fallbacks():
    plan = plan_question_rows(
        [_q(), _q(lesson_ref="Unknown Thing")],
        build_lesson_index(LESSONS),
        fallback_lesson_id=11,
    )
    assert len(plan.questions) == 2
    assert [q["_lesson_id"] for q in plan.questions] == [11, 11]
    assert plan.warnings and "fallback lesson" in plan.warnings[0]


def test_plan_sets_aside_unresolvable_questions():
    plan = plan_question_rows([_q(lesson_ref="Unknown")], build_lesson_index(LESSONS))
    assert plan.questions == []
    assert len(plan.unresolved) == 1
    assert "not saved" in plan.warnings[-1]


def test_exam_type_mapping_matches_javas_seeded_types():
    assert exam_type_for_scope("LESSON") == "LESSON_QUIZ"
    assert exam_type_for_scope("MIDDLE") == "MIDDLE_EXAM"
    assert exam_type_for_scope("MAJOR") == "MAJOR_EXAM"
    assert exam_type_for_scope("DIAGNOSTIC") == "DIAGNOSTIC"
    assert exam_type_for_scope("MOCK") == "MOCK_EXAM"


def test_checking_method_differs_by_question_type():
    assert checking_method_for("SHORT_ANSWER") == "EXACT_MATCH"
    assert checking_method_for("DESCRIPTIVE") == "AI_SEMANTIC"


# --- schema-level structural enforcement ----------------------------------

def test_mcq_with_wrong_choice_count_is_rejected():
    with pytest.raises(ValueError, match="exactly 4 choices"):
        QuestionDraft(question_type="MCQ", question="Q?", choices=["a", "b", "c"],
                      correct_choice_index=0)


def test_mcq_with_out_of_range_index_is_rejected():
    with pytest.raises(ValueError, match="out of range"):
        QuestionDraft(question_type="MCQ", question="Q?", choices=list("abcd"),
                      correct_choice_index=9)


def test_mcq_with_duplicate_choices_is_rejected():
    with pytest.raises(ValueError, match="distinct"):
        QuestionDraft(question_type="MCQ", question="Q?", choices=["a", "a", "b", "c"],
                      correct_choice_index=0)


def test_short_answer_requires_an_answer():
    with pytest.raises(ValueError, match="correct_answer"):
        QuestionDraft(question_type="SHORT_ANSWER", question="Q?")


def test_programming_requires_a_test_case():
    with pytest.raises(ValueError, match="test case"):
        QuestionDraft(question_type="PROGRAMMING", question="Q?", starter_code="x")


def test_diagram_requires_type_and_instructions():
    with pytest.raises(ValueError, match="diagram_type"):
        QuestionDraft(question_type="DIAGRAM", question="Q?")


def test_valid_question_passes():
    draft = QuestionDraft(**{k: v for k, v in _q().items()})
    assert draft.bloom_level == "UNDERSTAND"


# --- batch validation -----------------------------------------------------

def test_duplicate_detection_catches_rephrasings():
    a = _q(question="What is the primary purpose of a database index?")
    b = _q(question="What is the main purpose of a database index?")
    duplicates = find_duplicates([a, b])
    assert duplicates, "a one-word rephrasing should be caught"


def test_distinct_questions_are_not_flagged_as_duplicates():
    a = _q(question="What is a B-tree index?")
    b = _q(question="Explain third normal form and why it reduces redundancy.")
    assert find_duplicates([a, b]) == []


def test_duplicates_are_an_error_not_a_warning():
    report = validate_question_batch([
        _q(question="What is the primary purpose of an index?"),
        _q(question="What is the main purpose of an index?"),
    ])
    assert not report.passed
    assert any(i.code == "DUPLICATE_QUESTIONS" for i in report.errors)


def test_missing_explanations_are_warned():
    report = validate_question_batch([_q(explanation="")])
    assert any(i.code == "MISSING_EXPLANATION" for i in report.warnings)


def test_filler_distractors_are_warned():
    report = validate_question_batch([
        _q(choices=["A tree", "A list", "A hash", "None of the above"])
    ])
    assert any(i.code == "FILLER_DISTRACTORS" for i in report.warnings)


def test_short_numeric_choices_are_not_flagged():
    """Regression: an earlier length-based rule flagged every numeric MCQ."""
    report = validate_question_batch([_q(choices=["4", "8", "16", "32"])])
    assert not any(i.code == "BLANK_DISTRACTORS" for i in report.issues)


def test_difficulty_imbalance_is_warned():
    batch = [_q(question=f"Distinct question number {i} about indexing") for i in range(6)]
    report = validate_question_batch(batch)
    assert any(i.code == "DIFFICULTY_IMBALANCE" for i in report.warnings)


def test_single_bloom_level_is_warned():
    batch = [
        _q(question=f"Distinct question number {i} about indexing", bloom_level="REMEMBER")
        for i in range(6)
    ]
    report = validate_question_batch(batch)
    codes = {i.code for i in report.issues}
    assert "BLOOM_SINGLE_LEVEL" in codes


def test_unmapped_objectives_are_warned():
    report = validate_question_batch([_q(learning_objective="")])
    assert any(i.code == "UNMAPPED_OBJECTIVE" for i in report.warnings)


def test_empty_batch_is_an_error_with_zero_score():
    report = validate_question_batch([])
    assert not report.passed
    assert report.score == 0
    assert report.issues[0].code == "EMPTY_BATCH"


def test_clean_batch_passes_with_a_high_score():
    batch = [
        _q(question="What is a B-tree index and when is it used?", difficulty="EASY",
           bloom_level="REMEMBER"),
        _q(question="Explain third normal form and its effect on redundancy.",
           difficulty="AVERAGE", bloom_level="APPLY", lesson_ref="Normalization Forms"),
        _q(question="Given a slow join, determine which index would help most.",
           difficulty="DIFFICULT", bloom_level="ANALYZE", lesson_ref="Query Optimization"),
    ]
    report = validate_question_batch(batch)
    assert report.passed
    assert report.score >= 90, [i.code for i in report.issues]


def test_report_carries_distribution_stats_for_the_dashboard():
    report = validate_question_batch([_q(), _q(question="A different question entirely.")])
    assert report.stats["count"] == 2
    assert "difficulty" in report.stats
    assert "bloom" in report.stats
    assert "types" in report.stats

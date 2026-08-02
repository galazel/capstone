"""Validation-layer tests (Phase 2b steps 9-10).

Two distinct mechanisms, deliberately separated:

* Pydantic model validators reject *impossible* content (an MCQ with three
  choices). These raise, so the shared retry policy re-asks the model. Before
  this, the rules lived only in the agent's system prompt -- requests, not
  constraints.
* `app.domain.validation` reports *poor* content (duplicates, recall-only
  Bloom's coverage, filler distractors). Advisory: surfaced to the reviewing
  admin, never auto-blocking.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.validation import Severity, find_duplicates, validate_question_batch
from app.schemas.certification.question_schema import ProgrammingTestCase, QuestionDraft


def mcq(question="What is 2+2?", **overrides):
    base = dict(
        question_type="MCQ",
        question=question,
        choices=["3", "4", "5", "6"],
        correct_choice_index=1,
        explanation="Because two plus two equals four, by definition.",
        choice_explanations=[
            "Off by one: 2+2 is not 3.",
            "Correct: two plus two equals four.",
            "Off by one in the other direction.",
            "This is 2x3, not 2+2.",
        ],
        learning_objective="arithmetic",
        bloom_level="REMEMBER",
    )
    base.update(overrides)
    return QuestionDraft(**base)


def mcq_dict(**overrides) -> dict:
    """A question as a plain dict, bypassing `QuestionDraft`.

    The advisory layer accepts dicts as well as models, and some of its checks
    exist for content the schema now rejects outright at generation time --
    a missing explanation, say. Those cases still reach validation from
    elsewhere (a reviewer's manual edit, an artifact from an older run), so
    they are still worth reporting; they just cannot be built as a draft.
    """
    base = dict(
        question_type="MCQ",
        question="What is 2+2?",
        choices=["3", "4", "5", "6"],
        correct_choice_index=1,
        explanation="Because two plus two equals four, by definition.",
        learning_objective="arithmetic",
        bloom_level="REMEMBER",
        difficulty="AVERAGE",
        estimated_seconds=60,
    )
    base.update(overrides)
    return base


def codes(report) -> set[str]:
    return {issue.code for issue in report.issues}


# =========================================================================
# Structural enforcement (raises -> triggers retry)
# =========================================================================

def test_mcq_requires_exactly_four_choices():
    with pytest.raises(ValidationError, match="exactly 4 choices"):
        mcq(choices=["a", "b", "c"])


def test_mcq_requires_correct_choice_index():
    with pytest.raises(ValidationError, match="correct_choice_index"):
        mcq(correct_choice_index=None)


def test_mcq_rejects_out_of_range_index():
    with pytest.raises(ValidationError, match="out of range"):
        mcq(correct_choice_index=9)


def test_mcq_rejects_duplicate_choices():
    """A model that emits the same option twice makes the item unanswerable."""
    with pytest.raises(ValidationError, match="distinct"):
        mcq(choices=["4", "4", "5", "6"])


def test_short_answer_requires_correct_answer():
    with pytest.raises(ValidationError, match="correct_answer"):
        QuestionDraft(question_type="SHORT_ANSWER", question="Define SQL.")


def test_descriptive_requires_rubric():
    with pytest.raises(ValidationError, match="rubric_answer"):
        QuestionDraft(question_type="DESCRIPTIVE", question="Explain normalization.")


def test_programming_requires_a_test_case():
    with pytest.raises(ValidationError, match="test case"):
        QuestionDraft(question_type="PROGRAMMING", question="Reverse a string.")


def test_programming_accepts_with_test_case():
    q = QuestionDraft(
        question_type="PROGRAMMING",
        question="Reverse a string.",
        test_cases=[ProgrammingTestCase(input_data="ab", expected_output="ba")],
        explanation="Reversing walks the string from the end to the start.",
    )
    assert q.test_cases[0].expected_output == "ba"


def test_diagram_requires_type_and_instructions():
    with pytest.raises(ValidationError, match="diagram_type"):
        QuestionDraft(question_type="DIAGRAM", question="Draw the schema.")


def test_empty_question_text_is_rejected():
    with pytest.raises(ValidationError, match="must not be empty"):
        mcq(question="   ")


def test_non_positive_estimated_time_is_rejected():
    with pytest.raises(ValidationError, match="estimated_seconds"):
        mcq(estimated_seconds=0)


def test_defaults_keep_generation_working_without_new_metadata():
    """The new pedagogical fields must not become a hard requirement on the
    model, or every existing prompt would start failing."""
    q = QuestionDraft(
        question_type="SHORT_ANSWER",
        question="Define SQL.",
        correct_answer="lang",
        explanation="SQL is the query language for relational databases.",
    )
    assert q.bloom_level == "UNDERSTAND"
    assert q.estimated_seconds > 0
    assert q.source_chunk_ids == []


# =========================================================================
# Quality reporting (advisory)
# =========================================================================

def test_empty_batch_is_an_error():
    report = validate_question_batch([])
    assert not report.passed
    assert report.score == 0
    assert "EMPTY_BATCH" in codes(report)


def test_clean_batch_scores_full_marks():
    questions = [
        mcq("What is 2+2?", bloom_level="REMEMBER", source_chunk_ids=["c1"]),
        mcq("Which index type suits range queries?", choices=["hash", "btree", "gin", "gist"],
            correct_choice_index=1, bloom_level="APPLY", source_chunk_ids=["c2"],
            explanation="B-tree indexes preserve ordering, which range scans rely on."),
    ]
    report = validate_question_batch(questions)
    assert report.passed
    assert report.score == 100
    assert report.issues == []


def test_detects_near_duplicate_rephrasings():
    """Exact-match detection is useless: a model rephrases rather than
    repeating verbatim."""
    questions = [
        mcq("What is the primary purpose of an index in a database?"),
        mcq("What is the main purpose of an index in a database?"),
    ]
    report = validate_question_batch(questions)

    assert "DUPLICATE_QUESTIONS" in codes(report)
    assert not report.passed, "duplicates are an ERROR, not a warning"


def test_distinct_questions_are_not_flagged_as_duplicates():
    questions = [
        mcq("What is a database index?"),
        mcq("Which protocol underpins secure web traffic?",
            choices=["FTP", "HTTPS", "SMTP", "TELNET"], correct_choice_index=1),
    ]
    assert find_duplicates(questions) == []


def test_related_but_different_questions_are_not_duplicates():
    """Guards the threshold from the other side: two questions about
    different index types share most of their wording but are distinct
    items, and must not collapse."""
    questions = [
        mcq("What is a B-tree index used for?"),
        mcq("What is a hash index used for?"),
    ]
    assert find_duplicates(questions) == []


def test_numeric_mcq_choices_are_not_flagged_as_blank():
    """One-character answers like "4" are legitimate; an earlier version of
    this check flagged every numeric MCQ."""
    report = validate_question_batch([mcq(choices=["3", "4", "5", "6"], correct_choice_index=1)])
    assert "BLANK_DISTRACTORS" not in codes(report)


def test_genuinely_blank_choice_is_flagged():
    report = validate_question_batch(
        [mcq(choices=["4", "  ", "5", "6"], correct_choice_index=0)]
    )
    assert "BLANK_DISTRACTORS" in codes(report)


def test_flags_missing_explanations():
    # Dicts, not drafts: the schema now rejects an unexplained question at
    # generation time, so this advisory check only ever sees one that arrived
    # from somewhere else.
    report = validate_question_batch(
        [mcq_dict(explanation=""), mcq_dict(question="Another?", explanation="")]
    )
    assert "MISSING_EXPLANATION" in codes(report)


def test_flags_filler_distractors():
    report = validate_question_batch(
        [mcq(choices=["4", "None of the above", "5", "6"], correct_choice_index=0)]
    )
    assert "FILLER_DISTRACTORS" in codes(report)


def test_flags_difficulty_imbalance():
    questions = [mcq(f"Question number {i}?", difficulty="EASY") for i in range(6)]
    report = validate_question_batch(questions)
    assert "DIFFICULTY_IMBALANCE" in codes(report)


def test_flags_single_bloom_level():
    questions = [mcq(f"Recall item {i}?", bloom_level="REMEMBER") for i in range(6)]
    report = validate_question_batch(questions)
    assert "BLOOM_SINGLE_LEVEL" in codes(report)


def test_does_not_flag_bloom_for_tiny_batches():
    """A 2-question batch spanning one level is not evidence of a problem."""
    report = validate_question_batch([mcq("A?"), mcq("B?")])
    assert "BLOOM_SINGLE_LEVEL" not in codes(report)


def test_flags_unmapped_learning_objectives():
    report = validate_question_batch([mcq(learning_objective="")])
    assert "UNMAPPED_OBJECTIVE" in codes(report)


def test_reports_count_mismatch():
    report = validate_question_batch([mcq()], expected_count=5)
    assert "COUNT_MISMATCH" in codes(report)


def test_ungrounded_batch_is_informational_not_a_failure():
    """No grounding at all usually means the feature isn't wired yet, so it
    must not read as a content defect."""
    report = validate_question_batch([mcq(), mcq("Second?")])
    issue = next(i for i in report.issues if i.code == "NO_GROUNDING")
    assert issue.severity is Severity.INFO


def test_partial_grounding_is_a_warning():
    report = validate_question_batch(
        [mcq(source_chunk_ids=["c1"]), mcq("Second?", source_chunk_ids=[])]
    )
    assert "PARTIALLY_UNGROUNDED" in codes(report)


def test_score_decreases_with_issue_severity():
    clean = validate_question_batch([mcq(source_chunk_ids=["c"])])
    warned = validate_question_batch([mcq_dict(explanation="", source_chunk_ids=["c"])])
    errored = validate_question_batch([mcq("Same question?"), mcq("Same question?")])

    assert clean.score > warned.score > errored.score


def test_validation_accepts_plain_dicts():
    """Graph nodes pass `model_dump()` output, not models."""
    report = validate_question_batch([mcq().model_dump()])
    assert isinstance(report.score, int)

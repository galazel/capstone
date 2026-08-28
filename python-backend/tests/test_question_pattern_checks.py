"""Checks for the tells that let a learner pass without knowing the material.

Every question in a batch can be individually valid while the batch as a whole
gives itself away: the answer is always the third option, or always the longest
one, or every stem opens "Which of the following". None of that is visible one
question at a time, which is why it belongs here rather than in the schema.

Also the two types that quietly degrade into non-tasks -- a PROGRAMMING
question with one test case, a DIAGRAM question with nothing to model.
"""

from __future__ import annotations

from app.domain.validation.questions import validate_question_batch


def _codes(questions) -> set[str]:
    return {issue.code for issue in validate_question_batch(questions).issues}


def _mcq(index: int, correct: int, choices=None) -> dict:
    """A distinct, otherwise-clean MCQ. The stems differ so the duplicate and
    opening checks stay out of the way of what is under test."""
    stems = [
        "Normalization to 3NF removes which kind of dependency?",
        "A composite index helps which access pattern most?",
        "During a rollback, what happens to uncommitted writes?",
        "Choosing a clustered index affects what physically?",
        "Foreign keys enforce which property of the data?",
        "Set-based updates outperform row-by-row ones because of what?",
        "Query planners pick an index based mainly on what?",
        "Deadlock detection resolves a cycle by doing what?",
        "Read committed isolation prevents which anomaly?",
        "Write-ahead logging guarantees durability by doing what?",
        "Sharding a table changes which cost the most?",
        "Materialised views trade freshness for what?",
    ]
    return {
        "question_type": "MCQ",
        "question": stems[index % len(stems)],
        "choices": choices or ["alpha", "bravo", "charlie", "delta"],
        "correct_choice_index": correct,
        "explanation": "A sufficiently detailed explanation of the answer.",
    }


def test_a_batch_that_favours_one_position_is_flagged():
    batch = [_mcq(i, correct=1) for i in range(10)]
    assert "PREDICTABLE_ANSWER_POSITION" in _codes(batch)


def test_a_spread_of_positions_is_not_flagged():
    batch = [_mcq(i, correct=i % 4) for i in range(12)]
    assert "PREDICTABLE_ANSWER_POSITION" not in _codes(batch)


def test_a_short_quiz_is_not_judged_on_position():
    """Four questions cannot demonstrate a habit, and flagging them would put
    a warning on every lesson quiz."""
    batch = [_mcq(i, correct=2) for i in range(4)]
    assert "PREDICTABLE_ANSWER_POSITION" not in _codes(batch)


def test_the_correct_answer_being_consistently_longest_is_flagged():
    batch = [
        _mcq(i, correct=0, choices=[
            "The transaction is rolled back and every uncommitted write is discarded",
            "It commits",
            "It retries",
            "It waits",
        ])
        for i in range(10)
    ]
    assert "CORRECT_ANSWER_IS_LONGEST" in _codes(batch)


def test_evenly_matched_choices_are_not_flagged():
    batch = [
        _mcq(i, correct=i % 4, choices=[
            "Partial dependency on part of a composite key",
            "Transitive dependency through a non-key column",
            "Multivalued dependency between two attributes",
            "Functional dependency on the whole primary key",
        ])
        for i in range(12)
    ]
    assert "CORRECT_ANSWER_IS_LONGEST" not in _codes(batch)


def test_one_long_correct_answer_among_many_is_not_a_pattern():
    """A single question whose answer needs a qualification is fine; it is the
    habit that gives the game away."""
    batch = [_mcq(i, correct=i % 4) for i in range(11)]
    batch.append(
        _mcq(11, correct=0, choices=["A considerably longer correct option here", "b", "c", "d"])
    )
    assert "CORRECT_ANSWER_IS_LONGEST" not in _codes(batch)


def test_repeated_openings_are_flagged():
    batch = [
        {
            "question_type": "MCQ",
            "question": f"Which of the following describes concept {i}?",
            "choices": ["a", "b", "c", "d"],
            "correct_choice_index": i % 4,
            "explanation": "A sufficiently detailed explanation of the answer.",
        }
        for i in range(8)
    ]
    assert "REPETITIVE_QUESTION_OPENINGS" in _codes(batch)


def test_varied_openings_are_not_flagged():
    assert "REPETITIVE_QUESTION_OPENINGS" not in _codes([_mcq(i, correct=i % 4) for i in range(12)])


# --- programming and diagram tasks ---------------------------------------


def _programming(text: str, test_cases: int) -> dict:
    return {
        "question_type": "PROGRAMMING",
        "question": text,
        "starter_code": "def solve(rows):\n    ...",
        "test_cases": [{"input_data": str(i), "expected_output": str(i)} for i in range(test_cases)],
        "explanation": "A sufficiently detailed explanation of the answer.",
    }


LONG_TASK = (
    "A logistics service records each delivery as a row of driver id, route id, "
    "distance in kilometres and elapsed minutes. Implement solve(rows), which "
    "returns the driver id with the highest average speed across all routes they "
    "drove. Input is a list of tuples; distances are positive floats and elapsed "
    "minutes are positive integers. Return None for an empty input, and break ties "
    "by the lowest driver id."
)


def test_a_one_line_programming_question_is_flagged():
    assert "THIN_PROGRAMMING_TASK" in _codes([_programming("Write a function to add two numbers.", 3)])


def test_a_fully_stated_programming_task_is_not_flagged():
    assert "THIN_PROGRAMMING_TASK" not in _codes([_programming(LONG_TASK, 3)])


def test_too_few_test_cases_are_flagged():
    assert "TOO_FEW_TEST_CASES" in _codes([_programming(LONG_TASK, 1)])


def test_a_thin_diagram_question_is_flagged():
    batch = [{
        "question_type": "DIAGRAM",
        "question": "Draw an ERD for a library.",
        "diagram_type": "ERD",
        "instructions": "Include the entities.",
        "explanation": "A sufficiently detailed explanation of the answer.",
    }]
    assert "THIN_DIAGRAM_TASK" in _codes(batch)


def test_a_diagram_question_with_a_real_scenario_is_not_flagged():
    batch = [{
        "question_type": "DIAGRAM",
        "question": (
            "A community library lends physical copies of titles to members. Each "
            "title may have many copies; a copy is on loan to at most one member at "
            "a time, and a member may hold several loans. Members reserve titles "
            "that are fully on loan, and a reservation expires after seven days. "
            "Model this domain."
        ),
        "diagram_type": "ERD",
        "instructions": (
            "Produce an entity-relationship diagram in Crow's Foot notation. Show "
            "every entity with its primary key, mark the cardinality and optionality "
            "of each relationship, and resolve the many-to-many between members and "
            "titles through the loan and reservation entities."
        ),
        "explanation": "A sufficiently detailed explanation of the answer.",
    }]
    assert "THIN_DIAGRAM_TASK" not in _codes(batch)


# --- the schema floor -----------------------------------------------------


def test_the_schema_rejects_a_programming_question_with_one_test_case():
    """The prompt asks for three; this is what makes it a constraint rather
    than a request, so the shared retry policy asks the model again."""
    import pytest
    from app.schemas.certification.question_schema import QuestionDraft

    with pytest.raises(ValueError, match="at least 3 test cases"):
        QuestionDraft(
            question_type="PROGRAMMING",
            question=LONG_TASK,
            explanation="A sufficiently detailed explanation of the answer.",
            starter_code="def solve(rows): ...",
            test_cases=[{"input_data": "1", "expected_output": "1"}],
        )

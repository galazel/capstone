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


# ---------------------------------------------------------------------------
# The question bank must read like a professional certification paper.
# ---------------------------------------------------------------------------


def test_the_prompt_demands_hard_scenario_questions_not_definitions():
    """Pins the difficulty brief.

    The default failure mode of generated assessment is a bank of definition
    lookups: answerable without studying, and useless for a professional
    certification. Each instruction below is load-bearing, and losing any of
    them quietly returns the bank to that state -- which is only visible much
    later, in questions nobody finds hard.
    """
    from app.agents.certification.question_agent import SYSTEM_PROMPT

    # Skewed hard, with an explicit mix so the model cannot default to easy.
    assert "10% EASY, 40% AVERAGE, 50% HARD" in SYSTEM_PROMPT
    assert "If you are\n  unsure whether a question is AVERAGE or HARD, make it harder." in SYSTEM_PROMPT

    # Scenario-first, technical, judgement over recall.
    assert "SITUATIONAL and TECHNICAL" in SYSTEM_PROMPT
    assert "Test judgement, not recall" in SYSTEM_PROMPT
    assert "working practitioner" in SYSTEM_PROMPT

    # Higher-order Bloom levels rather than REMEMBER/UNDERSTAND.
    assert "APPLY, ANALYZE or EVALUATE" in SYSTEM_PROMPT


def test_hard_never_means_ambiguous():
    """Difficulty must come from reasoning demanded, not unclear wording.

    A question with two defensible readings is broken, not hard. This rule
    predates the difficulty push and has to survive it -- pushing for "tricky"
    questions without it produces guessing games instead of assessment.
    """
    from app.agents.certification.question_agent import SYSTEM_PROMPT

    assert "HARD means cognitively demanding, NOT deceptive" in SYSTEM_PROMPT
    assert "If two readings of\n  the stem lead to different answers, the question is broken" in SYSTEM_PROMPT
    assert "hard only because it is unclear is a bad\n  question" in SYSTEM_PROMPT


def test_a_bank_that_all_opens_with_the_is_flagged():
    """The pattern the three-word check cannot see.

    "The server fails..." and "The database is..." are different three-word
    openings, so `_check_stem_variety` passes a bank in which every stem begins
    with "The". That is precisely the shape reviewers describe as "looks AI
    generated", so it needs its own check.
    """
    from app.domain.validation.questions import _check_opening_word_variety

    issues: list = []
    _check_opening_word_variety(
        [{"question": f"The component {i} fails to respond under load."} for i in range(10)],
        issues,
    )
    codes = {issue.code for issue in issues}

    assert "REPETITIVE_OPENING_WORD" in codes
    assert "ARTICLE_HEAVY_OPENINGS" in codes


def test_varied_openings_are_not_flagged():
    """Guards against the check being so strict it fires on good banks."""
    from app.domain.validation.questions import _check_opening_word_variety

    issues: list = []
    _check_opening_word_variety(
        [
            {"question": "Given a sudden spike in latency, which change is safest?"},
            {"question": "Which control best mitigates this risk?"},
            {"question": "You are asked to review a schema. What fails first?"},
            {"question": "Under which condition does the cache invalidate early?"},
            {"question": "A developer reports an intermittent error. Why?"},
            {"question": "Identify the root cause of the reported timeout."},
        ],
        issues,
    )

    assert issues == []


def test_the_prompt_forbids_defaulting_to_article_openings():
    """The validator only warns after the fact; the prompt is the prevention."""
    from app.agents.certification.question_agent import SYSTEM_PROMPT

    assert "Vary how each stem OPENS" in SYSTEM_PROMPT
    assert "most stems should NOT open with an article" in SYSTEM_PROMPT
    # Concrete alternatives, so "vary it" is actionable rather than a wish.
    assert "second person" in SYSTEM_PROMPT
    assert "inverted" in SYSTEM_PROMPT
    assert "imperative" in SYSTEM_PROMPT


def test_performance_items_are_framed_as_real_systems():
    """PROGRAMMING and DIAGRAM items must read like professional performance tasks.

    In TOPCIT these are the largest weighted component and are explicitly
    "real life problems ... solved through coding and drawing diagrams". An
    item that opens on a topic rather than a system is an academic exercise
    wearing a scenario's clothes, so each of these instructions is pinned.
    """
    from app.agents.certification.question_agent import SYSTEM_PROMPT

    assert "PROGRAMMING and DIAGRAM ITEMS ARE PERFORMANCE ITEMS" in SYSTEM_PROMPT
    assert "OPEN ON A SYSTEM, NOT ON A TOPIC" in SYSTEM_PROMPT
    assert "THE SCENARIO CARRIES THE DIFFICULTY" in SYSTEM_PROMPT
    assert "REQUIRE A DESIGN DECISION" in SYSTEM_PROMPT
    assert "MATCH THE ARTEFACT TO THE PROBLEM" in SYSTEM_PROMPT
    # The scenario must not pre-solve the model for the learner.
    assert "Never pre-solve it by" in SYSTEM_PROMPT

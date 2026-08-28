"""SHORT_ANSWER must have one specific answer; open-ended belongs to DESCRIPTIVE.

SHORT_ANSWER is graded by normalised exact string match
(`app.domain.persistence.checking_method_for` maps it to EXACT_MATCH), so an
open-ended short-answer question cannot be answered correctly by anyone: no
string the learner types will match. A live run produced

    SHORT_ANSWER / EASY / UNDERSTAND
    "What is the importance of defining the scope of the problem domain?"

which is a perfectly good question of the wrong type. It is reclassified rather
than rejected, because rejecting resamples the whole batch for a mistake the
model repeats reliably -- expensive, and it discards usable content.
"""

from __future__ import annotations

import pytest

from app.domain.persistence import checking_method_for
from app.schemas.certification.question_schema import (
    SHORT_ANSWER_MAX_WORDS,
    QuestionDraft,
)


def _short(question: str, answer: str = "Normalization") -> QuestionDraft:
    return QuestionDraft(
        question_type="SHORT_ANSWER",
        question=question,
        correct_answer=answer,
        explanation="A sufficiently detailed explanation of the answer.",
    )


def test_the_grading_method_is_what_makes_this_a_correctness_bug():
    """The premise the rest of this file rests on."""
    assert checking_method_for("SHORT_ANSWER") != checking_method_for("DESCRIPTIVE")


def test_a_specific_factual_short_answer_is_left_alone():
    draft = _short("Which normal form eliminates transitive dependencies?", "3NF")
    assert draft.question_type == "SHORT_ANSWER"
    assert draft.correct_answer == "3NF"


@pytest.mark.parametrize(
    "question",
    [
        # The exact question from the live run.
        "What is the importance of defining the scope of the problem domain?",
        "What is the significance of requirements traceability?",
        "Why is version control important in a team?",
        "Discuss the role of the data link layer.",
        "Explain how a hash index works.",
        "Describe the waterfall model.",
        "Compare Agile and Waterfall.",
        "What are the benefits of continuous integration?",
        "In your own words, what is technical debt?",
    ],
)
def test_an_open_ended_short_answer_becomes_descriptive(question):
    draft = _short(question)
    assert draft.question_type == "DESCRIPTIVE", question


@pytest.mark.parametrize(
    "question",
    [
        # The exact question from the live run: passes the open-ended stem list
        # and, at five words, the answer-length limit -- yet no learner will
        # reproduce that string, in that order, with that punctuation.
        "What are the five core activities of the requirements definition process?",
        "What are the layers of the OSI model?",
        "Which are the ACID properties?",
        "Name the three phases of the compiler front end.",
        "List the four pillars of OOP.",
        "Enumerate the SOLID principles.",
        "State the normalization forms up to BCNF.",
        "Identify the components of a URL.",
        "What steps make up the software development life cycle?",
        "What phases does the waterfall model have?",
        # Counted set with no listing verb to give it away.
        "A TCP handshake consists of three messages in what order?",
    ],
)
def test_an_enumeration_short_answer_becomes_descriptive(question):
    draft = _short(question, "Elicitation, analysis, specification, validation, management")
    assert draft.question_type == "DESCRIPTIVE", question


@pytest.mark.parametrize(
    ("question", "answer"),
    [
        # An expansion has one canonical form, so it is a fair exact match even
        # though the answer is comma-separated. The rule keys on what was asked.
        ("What does ACID stand for?", "Atomicity, Consistency, Isolation, Durability"),
        ("Which HTTP status code means Not Found?", "404"),
        ("Which normal form eliminates transitive dependencies?", "3NF"),
        ("What is the time complexity of binary search?", "O(log n)"),
    ],
)
def test_a_single_answer_question_is_not_mistaken_for_an_enumeration(question, answer):
    draft = _short(question, answer)
    assert draft.question_type == "SHORT_ANSWER", question
    assert draft.correct_answer == answer


@pytest.mark.parametrize(
    "question",
    [
        # Three of these are live in the question bank (#104, #107, #112) with
        # the one-term answer "Strategic objectives". A number followed by a
        # unit is a measurement, not a set to enumerate, and reclassifying them
        # would cost a good question its exact matching.
        "What type of business objective defines long-term goals, typically "
        "spanning 3-5 years?",
        "What type of objectives are long-term goals, typically spanning 3-5 "
        "years, that define an organization's overall direction?",
        "Which cache eviction policy evicts the entry unused for the most "
        "minutes?",
        "What is the maximum payload in 4 bytes?",
    ],
)
def test_a_quantity_of_units_is_not_an_enumeration(question):
    draft = _short(question, "Strategic objectives")
    assert draft.question_type == "SHORT_ANSWER", question


def test_the_question_text_survives_reclassification():
    """The content is good -- only the type was wrong."""
    question = "What is the importance of defining the scope of the problem domain?"
    draft = _short(question)
    assert draft.question == question


def test_the_intended_answer_becomes_the_grading_rubric():
    """Nothing is discarded: what the model meant as the answer is exactly what
    a semantic grader needs as the rubric."""
    draft = _short("Explain why indexing speeds up reads.", "It avoids a full table scan")
    assert draft.rubric_answer == "It avoids a full table scan"
    assert draft.correct_answer is None, "an exact-match answer must not survive"


def test_an_essay_length_answer_is_reclassified_even_with_a_clean_stem():
    """The stem list cannot catch every phrasing. An answer too long to match
    exactly is the other half of the same signal."""
    draft = _short(
        "What is the first step of requirements engineering?",
        "You begin by gathering the stakeholders together and eliciting their "
        "needs through interviews and workshops before writing anything down.",
    )
    assert draft.question_type == "DESCRIPTIVE"


def test_an_answer_at_the_limit_is_still_a_short_answer():
    answer = " ".join(["word"] * SHORT_ANSWER_MAX_WORDS)
    assert _short("Which protocol is used?", answer).question_type == "SHORT_ANSWER"


def test_a_reclassified_question_passes_descriptive_validation():
    """Reclassifying must produce a *valid* DESCRIPTIVE, not a half-converted
    one that fails the shape checks further down the pipeline."""
    draft = _short("Explain the CAP theorem.", "")
    assert draft.question_type == "DESCRIPTIVE"
    assert (draft.rubric_answer or "").strip(), "DESCRIPTIVE requires a rubric"


def test_other_types_are_untouched():
    """An open-ended stem is only a problem for exact-match grading, so an MCQ
    asking "why is..." is perfectly valid and must not be reclassified."""
    mcq = _mcq(question="Why is normalization important?")
    assert mcq.question_type == "MCQ", "only SHORT_ANSWER is reclassified"


def test_the_prompt_states_the_rule_the_schema_enforces():
    """Repair is the safety net; the prompt is meant to make it unnecessary."""
    from app.agents.certification.question_agent import SYSTEM_PROMPT

    assert "EXACTLY, character for character" in SYSTEM_PROMPT
    assert "importance of" in SYSTEM_PROMPT


# --- explanations ----------------------------------------------------------
#
# What a learner sees after getting an item wrong. The `choices` table has
# carried a per-choice `explanation` column all along, but only the correct
# choice's was ever filled -- so someone who picked a distractor was told what
# the right answer was and never why their own answer failed.


def _mcq(**overrides) -> QuestionDraft:
    base = dict(
        question_type="MCQ",
        question="Which normal form eliminates transitive dependencies?",
        choices=["1NF", "2NF", "3NF", "BCNF"],
        correct_choice_index=2,
        explanation="Tests the normal forms; 3NF is defined by removing transitive dependencies.",
        choice_explanations=[
            "1NF only requires atomic column values.",
            "2NF removes partial dependencies on part of a composite key.",
            "Correct: 3NF is defined by removing transitive dependencies.",
            "BCNF is stricter and addresses remaining key anomalies.",
        ],
    )
    base.update(overrides)
    return QuestionDraft(**base)


def test_an_mcq_carries_an_explanation_for_every_choice():
    assert len(_mcq().choice_explanations) == 4


def test_an_mcq_without_per_choice_explanations_is_rejected():
    """Rejected, not repaired: an explanation cannot be invented here without
    fabricating teaching material."""
    with pytest.raises(ValueError, match="one explanation per choice"):
        _mcq(choice_explanations=[])


def test_a_misaligned_explanation_list_is_rejected():
    """Trimming to fit would attach the wrong reason to the wrong option --
    telling a learner their correct answer was wrong."""
    with pytest.raises(ValueError, match="one explanation per choice"):
        _mcq(choice_explanations=["only one"])


@pytest.mark.parametrize("filler", ["", "   ", "Wrong.", "Incorrect"])
def test_a_dismissive_choice_explanation_is_rejected(filler):
    """"Incorrect." teaches nothing, which is the whole point of the field."""
    with pytest.raises(ValueError, match="why it is wrong"):
        _mcq(choice_explanations=[filler, "b" * 30, "c" * 30, "d" * 30])


def test_every_question_needs_an_item_level_explanation():
    with pytest.raises(ValueError, match="explanation"):
        _mcq(explanation="")


def test_the_shape_error_is_not_masked_by_the_explanation_error():
    """A three-choice MCQ must say so, rather than complaining about the
    explanation count that is a consequence of it."""
    with pytest.raises(ValueError, match="exactly 4 choices"):
        _mcq(choices=["a", "b", "c"], correct_choice_index=0)


def test_each_choices_own_explanation_is_persisted_to_that_choice():
    """The point of the field: a learner who picked choice 2 reads choice 2's
    explanation, not the correct answer's."""
    from app.services.assessment_persistence import _persist_one_question

    written = []

    class _Repo:
        @staticmethod
        def insert_question(session, **kwargs):
            return 1

        @staticmethod
        def insert_choice(session, question_id, text, is_correct, explanation=None):
            written.append((text, is_correct, explanation))

    import app.services.assessment_persistence as persistence

    original = persistence.repo
    persistence.repo = _Repo
    try:
        question = _mcq().model_dump()
        question["_lesson_id"] = 7
        _persist_one_question(None, question)
    finally:
        persistence.repo = original

    assert [row[2] for row in written] == _mcq().choice_explanations
    assert [row[1] for row in written] == [False, False, True, False]


# --- exam structure persistence -------------------------------------------


def test_the_researched_exam_structure_is_written_to_the_certification():
    """It used to live only in the LangGraph checkpoint, so it was discarded
    when the run finished -- nothing to show an admin, and a mock exam could
    not be regenerated without re-planning the whole curriculum."""
    import app.services.certification_run as run

    written = {}

    class _Repo:
        @staticmethod
        def update_certification_exam_structure(session, certification_id, structure):
            written["id"] = certification_id
            written["structure"] = structure

        @staticmethod
        def list_certification_major_categories(session, certification_id):
            return []

        @staticmethod
        def list_certification_middle_categories(session, certification_id):
            return []

        @staticmethod
        def list_certification_lessons(session, certification_id):
            return []

        @staticmethod
        def insert_major_category(session, certification_id, name):
            return 1

        @staticmethod
        def insert_middle_category(session, major_id, name):
            return 2

        @staticmethod
        def insert_lesson(session, middle_id, name, blocks):
            return 3

    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def commit(self):
            pass

    structure = {
        "total_items": 100,
        "question_types": ["MCQ", "SHORT_ANSWER", "DESCRIPTIVE", "PROGRAMMING", "DIAGRAM"],
        "notes": "Sections with a three hour limit.",
    }
    curriculum = {"majorCategories": [], "exam_structure": structure}

    original_repo, original_session = run.repo, run.SessionLocal
    run.repo, run.SessionLocal = _Repo, _Session
    try:
        run._persist_curriculum(42, curriculum)
    finally:
        run.repo, run.SessionLocal = original_repo, original_session

    assert written == {"id": 42, "structure": structure}


def test_an_unknown_exam_structure_is_not_written_over_a_known_one():
    """The planner returns zeros when it could not find the real exam's shape.
    Writing that would erase what an earlier run discovered."""
    import app.services.certification_run as run

    calls = []

    class _Repo:
        @staticmethod
        def update_certification_exam_structure(session, certification_id, structure):
            calls.append(structure)

        @staticmethod
        def list_certification_major_categories(session, certification_id):
            return []

        @staticmethod
        def list_certification_middle_categories(session, certification_id):
            return []

        @staticmethod
        def list_certification_lessons(session, certification_id):
            return []


    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def commit(self):
            pass

    original_repo, original_session = run.repo, run.SessionLocal
    run.repo, run.SessionLocal = _Repo, _Session
    try:
        run._persist_curriculum(
            42,
            {"majorCategories": [], "exam_structure": {"total_items": 0, "question_types": []}},
        )
        run._persist_curriculum(42, {"majorCategories": []})
    finally:
        run.repo, run.SessionLocal = original_repo, original_session

    assert calls == []

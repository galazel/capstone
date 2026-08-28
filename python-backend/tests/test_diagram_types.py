"""The vocabulary a DIAGRAM question may use.

`diagram_type` was free text, so the model wrote "ERD", "er diagram" and
"Entity Relationship Diagram" for the same thing -- and the learner's canvas
is equipped from that value, so only the first spelling produced the right
palette. The rest fell back to entity shapes whatever the question asked for.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.certification.question_schema import (
    DIAGRAM_TYPES,
    QuestionDraft,
    normalize_diagram_type,
)


SCENARIO = (
    "A clinic books appointments for patients with named practitioners. A "
    "practitioner works fixed sessions, an appointment belongs to exactly one "
    "session, and a patient may hold several future appointments. Model this."
)
BRIEF = (
    "Produce the diagram in standard notation, showing every element with its "
    "identifying detail and marking how the parts relate to one another."
)


def _diagram(diagram_type: str) -> QuestionDraft:
    return QuestionDraft(
        question_type="DIAGRAM",
        question=SCENARIO,
        diagram_type=diagram_type,
        instructions=BRIEF,
        explanation="A sufficiently detailed explanation of the answer.",
    )


def test_the_seven_supported_types_are_the_editor_and_playground_vocabulary():
    assert set(DIAGRAM_TYPES) == {
        "ACTIVITY_DIAGRAM",
        "UML_CLASS",
        "UML_COMPONENT",
        "ERD",
        "FLOWCHART",
        "SEQUENCE_DIAGRAM",
        "USE_CASE",
    }


@pytest.mark.parametrize("raw", ["ERD", "erd", "ER diagram", "Entity Relationship Diagram", "er"])
def test_the_spellings_of_one_type_all_normalise(raw):
    assert normalize_diagram_type(raw) == "ERD"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("class diagram", "UML_CLASS"),
        ("UML Class", "UML_CLASS"),
        ("component diagram", "UML_COMPONENT"),
        ("sequence", "SEQUENCE_DIAGRAM"),
        ("UML_SEQUENCE", "SEQUENCE_DIAGRAM"),
        ("use case diagram", "USE_CASE"),
        ("activity", "ACTIVITY_DIAGRAM"),
        ("flow chart", "FLOWCHART"),
    ],
)
def test_each_type_is_reachable_from_how_a_model_writes_it(raw, expected):
    assert normalize_diagram_type(raw) == expected


def test_a_generated_question_is_stored_with_the_canonical_value():
    """Normalised in place rather than rejected: the spelling is not worth a
    retry when the meaning is unambiguous."""
    assert _diagram("ER Diagram").diagram_type == "ERD"
    assert _diagram("sequence diagram").diagram_type == "SEQUENCE_DIAGRAM"


def test_an_unsupported_type_is_rejected():
    """A state machine or a network topology has no palette here, so the
    learner would be handed some other diagram's shapes. Raising sends it
    back to the model instead."""
    with pytest.raises(ValidationError, match="not supported"):
        _diagram("state machine diagram")


def test_the_rejection_names_the_types_that_are_allowed():
    with pytest.raises(ValidationError, match="SEQUENCE_DIAGRAM"):
        _diagram("mind map")


def test_a_missing_type_is_still_rejected_as_missing():
    with pytest.raises(ValidationError, match="must set diagram_type"):
        QuestionDraft(
            question_type="DIAGRAM",
            question=SCENARIO,
            instructions=BRIEF,
            explanation="A sufficiently detailed explanation of the answer.",
        )


def test_unknown_input_normalises_to_nothing_rather_than_guessing():
    assert normalize_diagram_type("gantt chart") is None
    assert normalize_diagram_type("") is None
    assert normalize_diagram_type(None) is None

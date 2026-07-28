"""Curriculum schema tolerance tests.

A live TOPCIT run died with HTTP 400 `tool_use_failed`:

    missing properties: 'status',
    .../lessonGenerationInstructions/certification_focus:
        expected array, but got string

Groq validates tool-call arguments against this model's JSON schema before
returning them, so both failures had to be fixed in the *schema* -- a
pydantic validator never runs on a payload the provider already rejected.
These tests pin both the emitted schema and the local coercion.
"""

from __future__ import annotations

import pytest
from langchain_core.utils.function_calling import convert_to_openai_tool

from app.schemas.certification.curriculum_schema import (
    CertificationCurriculum,
    LessonGenerationInstructions,
)

LIST_FIELDS = [
    "concepts",
    "learning_progression",
    "technical_topics",
    "visual_recommendations",
    "real_world_applications",
    "comparisons",
    "common_mistakes",
    "best_practices",
    "relationships",
    "certification_focus",
]


def _instructions(**overrides):
    payload = {
        "introduction": {
            "prerequisites": ["Basic understanding of software development"],
            "motivation": "m",
            "certification_relevance": "r",
            "industry_importance": "High",
        },
        "expected_learner_outcome": "o",
        **{field: [f"{field} value"] for field in LIST_FIELDS},
    }
    payload.update(overrides)
    return LessonGenerationInstructions(**payload)


def _tool_schema() -> dict:
    return convert_to_openai_tool(CertificationCurriculum)["function"]["parameters"]


def _instructions_schema() -> dict:
    """Walks to lessonGenerationInstructions in the tool schema.

    The tool schema is fully inlined -- no `$defs` -- so the nesting has to
    be traversed, which doubles as a check that the hierarchy Groq validates
    against is the one the prompt describes."""
    schema = _tool_schema()
    schema = schema["properties"]["curriculum"]["properties"]["majorCategories"]["items"]
    schema = schema["properties"]["middleCategories"]["items"]
    schema = schema["properties"]["lessons"]["items"]
    return schema["properties"]["lessonGenerationInstructions"]


def test_status_is_not_required_by_the_provider_schema():
    """Nothing downstream reads `status`; requiring it only gave the model
    one more field to place wrongly -- which is exactly what it did."""
    assert "status" not in _tool_schema()["required"]


def test_status_defaults_when_the_model_omits_it():
    curriculum = CertificationCurriculum(
        certification_name="TOPCIT", curriculum={"majorCategories": []}
    )
    assert curriculum.status == "DRAFT"


@pytest.mark.parametrize("field", LIST_FIELDS)
def test_list_fields_accept_a_string_in_the_provider_schema(field):
    """The rejection happened server-side, so it is the *schema* -- not the
    pydantic coercion below -- that has to tolerate a bare string."""
    prop = _instructions_schema()["properties"][field]
    assert {branch.get("type") for branch in prop["anyOf"]} == {"array", "string"}


def test_nested_prerequisites_accept_a_string_in_the_provider_schema():
    prop = _instructions_schema()["properties"]["introduction"]["properties"]["prerequisites"]
    assert {branch.get("type") for branch in prop["anyOf"]} == {"array", "string"}


@pytest.mark.parametrize("field", LIST_FIELDS)
def test_a_bare_string_is_coerced_to_a_single_element_list(field):
    assert getattr(_instructions(**{field: "TOPCIT"}), field) == ["TOPCIT"]


def test_nested_prerequisites_are_coerced_too():
    instructions = _instructions(
        introduction={
            "prerequisites": "Basic understanding of software development",
            "motivation": "m",
            "certification_relevance": "r",
            "industry_importance": "High",
        }
    )
    assert instructions.introduction.prerequisites == [
        "Basic understanding of software development"
    ]


@pytest.mark.parametrize("value", [None, "", "   "])
def test_empty_values_become_an_empty_list_rather_than_a_validation_error(value):
    assert _instructions(comparisons=value).comparisons == []


def test_a_list_still_validates_unchanged():
    assert _instructions(concepts=["a", "b"]).concepts == ["a", "b"]


def test_non_string_scalars_are_still_rejected():
    with pytest.raises(ValueError):
        _instructions(concepts=42)


# --- Mis-nested major categories -------------------------------------------
#
# A second live TOPCIT run failed all five attempts with the same
# `tool_use_failed` 400: every sample put the second *major* category inside
# the first one's `middleCategories` array, so that entry had
# `middleCategories` where the schema required `lessons`.


def _lesson(name: str) -> dict:
    return {
        "name": name,
        "learning_objective": "o",
        "lessonGenerationInstructions": _instructions().model_dump(),
    }


def _middle(name: str) -> dict:
    return {"name": name, "description": "d", "lessons": [_lesson(f"{name} lesson")]}


def _major(name: str, *middles: dict) -> dict:
    return {"name": name, "description": "d", "middleCategories": list(middles)}


def _misnested() -> dict:
    """The live payload's shape: two majors, the second buried in the first."""
    return {
        "certification_name": "TOPCIT",
        "curriculum": {
            "majorCategories": [
                _major(
                    "Software Development",
                    _middle("Requirement Management"),
                    _major("Database Construction and Management", _middle("Data Modeling")),
                )
            ]
        },
    }


def test_lessons_is_not_required_by_the_provider_schema():
    """What produced the 400: the mis-nested branch has no `lessons`, so a
    required `lessons` meant the provider rejected the call before any local
    repair could run."""
    middle = _tool_schema()["properties"]["curriculum"]["properties"]["majorCategories"]["items"][
        "properties"
    ]["middleCategories"]["items"]
    assert "lessons" not in middle["required"]


def test_a_misnested_major_category_is_hoisted_to_the_top_level():
    curriculum = CertificationCurriculum(**_misnested()).curriculum
    assert [major.name for major in curriculum.majorCategories] == [
        "Software Development",
        "Database Construction and Management",
    ]


def test_hoisting_leaves_the_real_middle_categories_in_place():
    majors = CertificationCurriculum(**_misnested()).curriculum.majorCategories
    assert [middle.name for middle in majors[0].middleCategories] == ["Requirement Management"]
    assert [middle.name for middle in majors[1].middleCategories] == ["Data Modeling"]


def test_hoisting_recurses_through_repeated_misnesting():
    payload = {
        "certification_name": "TOPCIT",
        "curriculum": {
            "majorCategories": [
                _major(
                    "A",
                    _middle("a1"),
                    _major("B", _middle("b1"), _major("C", _middle("c1"))),
                )
            ]
        },
    }
    majors = CertificationCurriculum(**payload).curriculum.majorCategories
    assert [major.name for major in majors] == ["A", "B", "C"]


def test_a_major_left_with_no_lessons_is_dropped_rather_than_kept_empty():
    payload = {
        "certification_name": "TOPCIT",
        "curriculum": {
            "majorCategories": [_major("Shell", _major("Real", _middle("m1")))],
        },
    }
    majors = CertificationCurriculum(**payload).curriculum.majorCategories
    assert [major.name for major in majors] == ["Real"]


def test_a_wellformed_curriculum_is_left_untouched():
    payload = {
        "certification_name": "TOPCIT",
        "curriculum": {"majorCategories": [_major("A", _middle("a1")), _major("B", _middle("b1"))]},
    }
    majors = CertificationCurriculum(**payload).curriculum.majorCategories
    assert [major.name for major in majors] == ["A", "B"]
    assert [middle.name for middle in majors[0].middleCategories] == ["a1"]


def test_a_curriculum_with_no_lessons_anywhere_is_rejected_for_resampling():
    payload = {
        "certification_name": "TOPCIT",
        "curriculum": {"majorCategories": [_major("A"), _major("B")]},
    }
    with pytest.raises(ValueError):
        CertificationCurriculum(**payload)


def test_an_explicitly_empty_curriculum_is_still_allowed():
    """`majorCategories: []` is the graph's own empty value, not a bad sample."""
    assert (
        CertificationCurriculum(
            certification_name="TOPCIT", curriculum={"majorCategories": []}
        ).curriculum.majorCategories
        == []
    )

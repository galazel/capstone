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

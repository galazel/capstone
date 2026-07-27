"""Curriculum blueprint returned by the curriculum planning agent.

Two shapes here exist to survive a *server-side* schema check rather than a
local one. Groq validates the model's tool-call arguments against this
model's JSON schema and returns HTTP 400 `tool_use_failed` on any mismatch,
before pydantic ever sees the payload -- so a `field_validator` cannot
rescue a type the schema forbids. The schema itself has to be tolerant of
the mistakes a 70B model reliably makes:

1. Emitting a bare string where a list of strings is expected
   (`"certification_focus": "TOPCIT"`). `StrList` accepts either and
   normalises to a list.
2. Omitting `status`, a workflow field the model has no way to reason
   about and that nothing downstream reads. It is now optional.
"""

from typing import Annotated, Any, List

from pydantic import BaseModel, BeforeValidator, WithJsonSchema


def _coerce_str_list(value: Any) -> Any:
    """Normalises a single string to a one-element list, leaving anything
    else for pydantic to validate or reject as usual."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return value


#: A list of strings that also accepts a single string, in the JSON schema
#: the provider validates against as well as in pydantic.
StrList = Annotated[
    List[str],
    BeforeValidator(_coerce_str_list),
    WithJsonSchema(
        {
            "anyOf": [
                {"type": "array", "items": {"type": "string"}},
                {"type": "string"},
            ]
        }
    ),
]


class LessonIntroduction(BaseModel):
    prerequisites: StrList
    motivation: str
    certification_relevance: str
    industry_importance: str


class LessonGenerationInstructions(BaseModel):
    introduction: LessonIntroduction
    concepts: StrList
    learning_progression: StrList
    technical_topics: StrList
    visual_recommendations: StrList
    real_world_applications: StrList
    comparisons: StrList
    common_mistakes: StrList
    best_practices: StrList
    relationships: StrList
    certification_focus: StrList
    expected_learner_outcome: str


class Lesson(BaseModel):
    name: str
    learning_objective: str
    lessonGenerationInstructions: LessonGenerationInstructions


class MiddleCategory(BaseModel):
    name: str
    description: str
    lessons: List[Lesson]


class MajorCategory(BaseModel):
    name: str
    description: str
    middleCategories: List[MiddleCategory]


class Curriculum(BaseModel):
    majorCategories: List[MajorCategory]


class CertificationCurriculum(BaseModel):
    certification_name: str
    curriculum: Curriculum
    #: Workflow state, not model output -- the graph tracks status itself.
    #: Optional so a missing value can never fail the tool call.
    status: str = "DRAFT"

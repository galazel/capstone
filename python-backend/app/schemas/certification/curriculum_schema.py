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
3. Nesting the second *major* category inside the first one's
   `middleCategories` array, so that entry carries `middleCategories`
   where `lessons` was required. `lessons` is now optional -- which is
   what lets the payload past the provider -- and `Curriculum` hoists
   the mis-nested branch back to the top level (see `_hoist_majors`).
"""

from typing import Annotated, Any, List

from pydantic import BaseModel, BeforeValidator, WithJsonSchema, model_validator


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
    #: Both optional purely so the provider's schema check lets a *middle
    #: category* mis-nested inside `lessons` through to `_hoist_middles`, which
    #: lifts it back out. A surviving entry with no instructions is not a
    #: lesson at all and is dropped there, so nothing incomplete is persisted.
    learning_objective: str = ""
    #: Typed non-optional with a `None` default on purpose. What has to change
    #: is only that the provider stops *requiring* it -- the default achieves
    #: that -- while the advertised shape stays a plain object. Writing
    #: `Optional[...]` instead would emit an `anyOf`, and a schema wrinkle at
    #: exactly the node this model keeps mis-nesting is the last thing wanted.
    #: Pydantic does not validate defaults, so `None` survives; a value the
    #: model does supply is validated normally.
    lessonGenerationInstructions: LessonGenerationInstructions = None  # type: ignore[assignment]


class MiddleCategory(BaseModel):
    name: str
    description: str
    #: Optional purely so the provider's schema check lets a mis-nested major
    #: category through to `_hoist_majors`, which repairs it. A middle category
    #: that still has no lessons after the repair is dropped there.
    lessons: List[Lesson] = []


class MajorCategory(BaseModel):
    name: str
    description: str
    middleCategories: List[MiddleCategory]


def _is_misnested_middle(node: Any) -> bool:
    """True for a would-be lesson that is really a middle category.

    Structural tell again: it carries its own `lessons` where a lesson carries
    `lessonGenerationInstructions`. This is the same mistake as
    `_is_misnested_major` one level down -- the model flattens a level of the
    hierarchy and keeps going -- and it arrived the same way, as a
    `tool_use_failed` 400 with four sibling lessons and two middle categories
    all sitting in one `lessons` array.
    """
    return (
        isinstance(node, dict)
        and isinstance(node.get("lessons"), list)
        and bool(node["lessons"])
        and not node.get("lessonGenerationInstructions")
    )


def _hoist_middles(middle: dict) -> List[dict]:
    """Returns `middle` plus every middle category wrongly nested in its
    `lessons`. Recursive, since a hoisted one can repeat the mistake."""
    lessons: List[Any] = []
    hoisted: List[dict] = []

    for child in middle.get("lessons") or []:
        if _is_misnested_middle(child):
            hoisted.extend(_hoist_middles(child))
        elif isinstance(child, dict) and child.get("lessonGenerationInstructions"):
            lessons.append(child)

    repaired = {**middle, "lessons": lessons}
    return [repaired, *hoisted] if lessons else hoisted


def _is_misnested_major(node: Any) -> bool:
    """True for a would-be middle category that is really a major one.

    The tell is structural rather than semantic: it carries child categories
    where a middle category carries lessons.
    """
    return (
        isinstance(node, dict)
        and isinstance(node.get("middleCategories"), list)
        and bool(node["middleCategories"])
        and not node.get("lessons")
    )


def _hoist_majors(node: dict) -> List[dict]:
    """Returns `node` plus every major category wrongly nested beneath it.

    Recursive because the model has no reason to stop at one level: a hoisted
    branch can itself contain the same mistake.
    """
    middles: List[Any] = []
    hoisted: List[dict] = []

    for child in node.get("middleCategories") or []:
        if _is_misnested_major(child):
            hoisted.extend(_hoist_majors(child))
        elif isinstance(child, dict) and child.get("lessons"):
            # Repair the level below on the way past: a middle category can
            # have further middle categories buried in its `lessons`, and one
            # pass over the tree fixes both depths.
            middles.extend(_hoist_middles(child))

    repaired = {**node, "middleCategories": middles}
    return [repaired, *hoisted] if middles else hoisted


#: The floor a curriculum has to clear to be worth building a certification on.
#: A live TOPCIT run produced one major category, two middles and two lessons
#: total -- structurally valid, and useless as a syllabus. The prompt asks for
#: 3-6 majors with 3-5 lessons each; these are the numbers below which the
#: result is rejected outright and resampled, set well under the ask so a
#: merely modest curriculum still passes.
#:
#: Deliberately enforced *here* and not in the JSON schema the provider
#: validates: adding `minItems` there would turn an under-sized sample into a
#: `tool_use_failed` 400, which is neither retryable in a useful way nor
#: legible. A ValueError raised locally is classed as malformed output and
#: resampled -- see `app.ai.retry`.
MIN_MAJOR_CATEGORIES = 2
MIN_TOTAL_LESSONS = 6


def _require_breadth(majors: List[Any]) -> None:
    lessons = sum(
        len(middle.get("lessons") or [])
        for major in majors
        if isinstance(major, dict)
        for middle in (major.get("middleCategories") or [])
        if isinstance(middle, dict)
    )
    if len(majors) < MIN_MAJOR_CATEGORIES or lessons < MIN_TOTAL_LESSONS:
        raise ValueError(
            f"Curriculum is too small to be a syllabus: {len(majors)} major "
            f"category/ies and {lessons} lesson(s); at least "
            f"{MIN_MAJOR_CATEGORIES} and {MIN_TOTAL_LESSONS} are required."
        )


class Curriculum(BaseModel):
    majorCategories: List[MajorCategory]

    @model_validator(mode="before")
    @classmethod
    def _repair_hierarchy(cls, value: Any) -> Any:
        """Flattens the model's most frequent structural mistake.

        Runs `before` so it sees the raw tool-call arguments -- by the time
        pydantic has built `MajorCategory` objects the mis-nested branch has
        already been discarded as an unknown field.
        """
        if not isinstance(value, dict):
            return value
        majors = value.get("majorCategories")
        if not isinstance(majors, list):
            return value

        repaired: List[Any] = []
        for major in majors:
            if isinstance(major, dict):
                repaired.extend(_hoist_majors(major))
            else:
                repaired.append(major)

        if majors and not repaired:
            # Every branch was empty. Raising here (rather than returning an
            # unusable curriculum) is a ValueError, which `app.ai.retry` treats
            # as malformed output and resamples.
            raise ValueError("Curriculum contains no lessons.")

        if majors:
            _require_breadth(repaired)

        return {**value, "majorCategories": repaired}


class CertificationCurriculum(BaseModel):
    certification_name: str
    curriculum: Curriculum
    #: Workflow state, not model output -- the graph tracks status itself.
    #: Optional so a missing value can never fail the tool call.
    status: str = "DRAFT"

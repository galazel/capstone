"""Wire and model schemas for grading one written answer.

Two families live here and they are deliberately not the same shape:

* the **wire** models mirror `com.capstone.rebyu.aigateway.dto`'s
  `AnswerGradingRequestDto` / `AnswerGradingResultDto` field for field,
  camelCase included -- Java is the only caller, and its records fail to bind
  anything else;
* the **verdict** models are what the grading agent is asked to produce, which
  is a *percentage* per answer rather than a point total. The model is not
  asked to do decimal arithmetic against `maxPoints`; that conversion happens
  in `app.services.ai.answer_grading` where it can be clamped and rounded
  deterministically.

Everything here is tolerant on input. A rejected tool call costs a whole
resample, so a model that writes `"85%"` or `85.0` where an int was wanted is
coerced rather than refused -- the bounds are enforced later, in code.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


def _none_to_empty(value: Any) -> Any:
    """Java sends an absent list as JSON `null`, not as `[]`."""
    return [] if value is None else value


# --- wire: request ---------------------------------------------------------


class RubricCriterion(BaseModel):
    name: str = ""
    maxPoints: Decimal | None = None


class SubQuestionGradingRequest(BaseModel):
    """One sub-question of a critical-thinking item."""

    subQuestionId: int
    questionText: str = ""
    maxPoints: Decimal | None = None
    #: Despite the name, this is the *reference answer* the admin authored --
    #: `AssessmentAttemptService.rubricGuidanceFor` reads it off the question's
    #: AI_SEMANTIC text config. Prompted as such rather than as a rubric.
    rubricGuidance: str | None = None
    rubricCriteria: list[RubricCriterion] = Field(default_factory=list)
    learnerAnswer: str | None = None

    _empty_criteria = field_validator("rubricCriteria", mode="before")(_none_to_empty)


class AnswerGradingRequest(BaseModel):
    """One learner answer to mark.

    `subQuestions` empty means a plain descriptive/short answer, graded off
    `learnerAnswer`. Populated means a critical-thinking item, where
    `learnerAnswer` is null and each sub-question carries its own text.
    """

    questionText: str = ""
    maxPoints: Decimal | None = None
    rubricGuidance: str | None = None
    rubricCriteria: list[RubricCriterion] = Field(default_factory=list)
    learnerAnswer: str | None = None
    subQuestions: list[SubQuestionGradingRequest] = Field(default_factory=list)

    _empty_criteria = field_validator("rubricCriteria", mode="before")(_none_to_empty)
    _empty_subs = field_validator("subQuestions", mode="before")(_none_to_empty)


# --- wire: response --------------------------------------------------------


class SubAnswerGrade(BaseModel):
    subQuestionId: int
    earnedPoints: float
    feedback: str


class AnswerGradingResult(BaseModel):
    """What Java persists onto the attempt answer.

    `earnedPoints` is the total written to the answer row, and for a
    critical-thinking item it is the sum of `subScores` -- the Java side does
    not re-add them, it stores the total and the breakdown separately, so a
    disagreement between the two would surface to the learner as a result
    page whose parts do not add up.
    """

    earnedPoints: float
    feedback: str
    subScores: list[SubAnswerGrade] = Field(default_factory=list)


# --- what the model returns ------------------------------------------------


def _coerce_percent(value: Any) -> Any:
    """Accepts the ways a model writes a percentage."""
    if isinstance(value, str):
        cleaned = value.strip().rstrip("%").replace(",", "").strip()
        if cleaned:
            return cleaned
        return 0.0
    if value is None:
        return 0.0
    return value


class SubAnswerVerdict(BaseModel):
    """The model's mark for one sub-question.

    Identified by 1-based `index` into the numbered list in the prompt, never
    by the real `subQuestionId`. Sub-question ids are not sent to the model at
    all: an id it invents or transposes would attach a mark to the wrong
    sub-question silently, while a bad index is caught by the completeness
    check in `app.services.ai.answer_grading`.
    """

    index: int
    scorePercent: float = 0.0
    feedback: str = ""

    _percent = field_validator("scorePercent", mode="before")(_coerce_percent)


class AnswerVerdict(BaseModel):
    """The model's mark for the whole item.

    `scorePercent` is the share of the available marks the answer earned, so
    the same verdict shape works whether the question is worth 1 point or 25.
    Unbounded here on purpose -- clamping lives in the service, because a
    schema that rejects 105 costs a resample where a clamp costs nothing.
    """

    scorePercent: float = 0.0
    feedback: str = ""
    subScores: list[SubAnswerVerdict] = Field(default_factory=list)

    _percent = field_validator("scorePercent", mode="before")(_coerce_percent)
    _empty_subs = field_validator("subScores", mode="before")(_none_to_empty)

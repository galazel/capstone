from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Difficulty = Literal["EASY", "AVERAGE", "HARD"]
AssessmentType = Literal["DIAGNOSTIC", "LESSON_QUIZ", "MIDDLE_EXAM", "MOCK_EXAM"]


class MasteryEventCreate(BaseModel):
    source_event_id: str = Field(min_length=1, max_length=150)
    learner_id: int = Field(gt=0)
    lesson_id: int = Field(gt=0)
    question_id: int | None = Field(default=None, gt=0)
    is_correct: bool
    difficulty_level: Difficulty
    assessment_type: AssessmentType
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Curriculum path carried with the event so priority aggregation never reads
    # the main Rebyu curriculum tables. All optional for backward compatibility.
    certification_id: int | None = Field(default=None, gt=0)
    middle_category_id: int | None = Field(default=None, gt=0)
    major_category_id: int | None = Field(default=None, gt=0)
    lesson_title: str | None = Field(default=None, max_length=200)
    middle_category_title: str | None = Field(default=None, max_length=200)
    major_category_title: str | None = Field(default=None, max_length=200)

    @field_validator("difficulty_level", "assessment_type", mode="before")
    @classmethod
    def uppercase(cls, value: object) -> object:
        return str(value).strip().upper().replace("-", "_").replace(" ", "_")


class MasteryEventBatchCreate(BaseModel):
    events: list[MasteryEventCreate] = Field(min_length=1, max_length=500)


class ParametersUsed(BaseModel):
    prior: float
    learn: float
    guess: float
    slip: float
    forget: float
    model_variant: str


class MasteryEventResponse(BaseModel):
    source_event_id: str
    duplicate: bool
    learner_id: int
    lesson_id: int
    question_id: int | None
    is_correct: bool
    predicted_correct_probability: float
    mastery_before: float
    mastery_posterior: float
    mastery_after: float
    mastery_level: str
    attempt_count: int
    parameters_used: ParametersUsed
    processed_at: datetime


class LearnerLessonMasteryResponse(BaseModel):
    learner_id: int
    lesson_id: int
    mastery_probability: float
    mastery_level: str
    attempt_count: int
    last_event_id: str | None
    model_run_id: str | None
    last_updated: datetime

    model_config = {"from_attributes": True}


class LearnerMasteryListResponse(BaseModel):
    items: list[LearnerLessonMasteryResponse]
    total: int
    average_mastery_probability: float


class MasteryHistoryResponse(BaseModel):
    mastery_history_id: str
    learner_id: int
    certification_id: int | None
    lesson_id: int
    previous_mastery: float
    final_mastery: float
    previous_mastery_level: str | None
    new_mastery_level: str
    observed_correct: bool
    assessment_type: str
    difficulty_level: str
    created_at: datetime

    model_config = {"from_attributes": True}

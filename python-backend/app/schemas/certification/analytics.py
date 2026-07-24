from __future__ import annotations

from pydantic import BaseModel, Field


class ReadinessRequest(BaseModel):
    learner_id: int = Field(gt=0)
    lesson_ids: list[int] = Field(min_length=1)
    diagnostic_score: float | None = Field(default=None, ge=0, le=100)
    lesson_quiz_score: float | None = Field(default=None, ge=0, le=100)
    middle_exam_score: float | None = Field(default=None, ge=0, le=100)
    mock_exam_score: float | None = Field(default=None, ge=0, le=100)


class ReadinessComponent(BaseModel):
    name: str
    score: float
    configured_weight: float
    normalized_weight: float
    contribution: float


class ReadinessResponse(BaseModel):
    learner_id: int
    lesson_count_requested: int
    lesson_count_with_mastery: int
    mastery_coverage: float
    readiness_score: float
    readiness_level: str
    components: list[ReadinessComponent]

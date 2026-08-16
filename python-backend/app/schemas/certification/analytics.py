from __future__ import annotations

from pydantic import BaseModel, Field


class ReadinessRequest(BaseModel):
    learner_id: int = Field(gt=0)
    lesson_ids: list[int] = Field(min_length=1)
    diagnostic_score: float | None = Field(default=None, ge=0, le=100)
    lesson_quiz_score: float | None = Field(default=None, ge=0, le=100)
    middle_exam_score: float | None = Field(default=None, ge=0, le=100)
    # Major-category exams score separately from the mock exam. BKT folds the
    # two together because its event schema is a fixed four-value Literal;
    # readiness is not bound by that, and the distinction matters here -- a
    # major exam covers one section, a mock exam simulates the whole paper.
    major_exam_score: float | None = Field(default=None, ge=0, le=100)
    mock_exam_score: float | None = Field(default=None, ge=0, le=100)
    # Share of the certification's lessons completed, 0..100. Unlike the score
    # components this is always computable, so it is always present -- which is
    # the point: it is the one input that can say "you have not done the work
    # yet" instead of going quiet.
    lesson_progress_score: float | None = Field(default=None, ge=0, le=100)
    # Study consistency, already scaled to 0..100 by the caller.
    streak_score: float | None = Field(default=None, ge=0, le=100)


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

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class TrainingJobCreate(BaseModel):
    source_type: Literal["database"] = "database"
    certification_id: int | None = Field(default=None, gt=0)
    date_from: datetime | None = None
    date_to: datetime | None = None
    requested_by: str | None = Field(default=None, max_length=150)
    num_fits: int | None = Field(default=None, ge=1, le=20)
    seed: int | None = None
    test_size: float | None = Field(default=None, gt=0, lt=0.5)
    min_interactions_per_skill: int | None = Field(default=None, ge=1)
    min_learners_per_skill: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_dates(self) -> "TrainingJobCreate":
        if self.date_from and self.date_to and self.date_from >= self.date_to:
            raise ValueError("date_from must be earlier than date_to")
        return self


class TrainingJobResponse(BaseModel):
    model_run_id: str
    run_type: str
    trigger_type: str
    source_type: str
    status: str
    requested_by: str | None
    celery_task_id: str | None
    certification_id: int | None
    date_from: datetime | None
    date_to: datetime | None
    model_variant: str | None
    evaluation_mode: str | None
    seed: int
    num_fits: int
    test_size: float
    training_rows: int | None
    learner_count: int | None
    skill_count: int | None
    metrics: dict | None
    configuration: dict | None
    artifact_path: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TrainingJobListResponse(BaseModel):
    items: list[TrainingJobResponse]
    total: int


class CsvTrainingOptions(BaseModel):
    requested_by: str | None = None
    num_fits: int | None = None
    seed: int | None = None
    test_size: float | None = None
    min_interactions_per_skill: int | None = None
    min_learners_per_skill: int | None = None

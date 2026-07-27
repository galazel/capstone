from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ParameterClassResponse(BaseModel):
    parameter_name: str
    class_name: str
    parameter_value: float


class LessonParametersResponse(BaseModel):
    lesson_id: int
    prior_probability: float
    learn_probability: float
    guess_probability: float
    slip_probability: float
    forget_probability: float
    model_variant: str
    model_run_id: str | None
    last_trained_at: datetime
    classes: list[ParameterClassResponse]


class ActiveModelResponse(BaseModel):
    artifact_id: str
    model_run_id: str
    model_variant: str
    artifact_path: str
    sha256: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

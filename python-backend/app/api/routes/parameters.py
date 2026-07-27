from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.session import get_db
from app.repositories.bkt import get_active_artifact, get_lesson_parameters
from app.schemas.certification.parameters import (
    ActiveModelResponse,
    LessonParametersResponse,
    ParameterClassResponse,
)

router = APIRouter(
    prefix="/models",
    tags=["models and parameters"],
    dependencies=[Depends(require_service_key)],
)


@router.get("/active", response_model=ActiveModelResponse)
def active_model(db: Session = Depends(get_db)):
    artifact = get_active_artifact(db)
    if artifact is None:
        raise HTTPException(status_code=404, detail="No active trained model")
    return artifact


@router.get("/lessons/{lesson_id}/parameters", response_model=LessonParametersResponse)
def lesson_parameters(lesson_id: int, db: Session = Depends(get_db)):
    aggregate, classes = get_lesson_parameters(db, lesson_id)
    if aggregate is None:
        raise HTTPException(status_code=404, detail="No trained parameters for this lesson")
    return LessonParametersResponse(
        lesson_id=aggregate.lesson_id,
        prior_probability=aggregate.prior_probability,
        learn_probability=aggregate.learn_probability,
        guess_probability=aggregate.guess_probability,
        slip_probability=aggregate.slip_probability,
        forget_probability=aggregate.forget_probability,
        model_variant=aggregate.model_variant,
        model_run_id=aggregate.model_run_id,
        last_trained_at=aggregate.last_trained_at,
        classes=[
            ParameterClassResponse(
                parameter_name=row.parameter_name,
                class_name=row.class_name,
                parameter_value=row.parameter_value,
            )
            for row in classes
        ],
    )

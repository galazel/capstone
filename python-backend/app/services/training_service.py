from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import (
    BktModelArtifact,
    BktModelRun,
    BktParameter,
    BktParameterClass,
    LearnerLessonMastery,
)
from app.ml.pipeline import run_pipeline
from app.repositories.bkt import deactivate_artifacts
from app.repositories.training import TrainingDataRepository
from app.services.bkt_math import mastery_level

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class TrainingOptions:
    seed: int
    num_fits: int
    test_size: float
    min_interactions_per_skill: int
    min_learners_per_skill: int


def options_from_run(run: BktModelRun) -> TrainingOptions:
    settings = get_settings()
    configuration = run.configuration or {}
    return TrainingOptions(
        seed=run.seed,
        num_fits=run.num_fits,
        test_size=run.test_size,
        min_interactions_per_skill=int(
            configuration.get(
                "min_interactions_per_skill",
                settings.bkt_min_interactions_per_skill,
            )
        ),
        min_learners_per_skill=int(
            configuration.get(
                "min_learners_per_skill",
                settings.bkt_min_learners_per_skill,
            )
        ),
    )


def create_training_run(
    session: Session,
    *,
    source_type: str,
    trigger_type: str = "manual",
    requested_by: str | None = None,
    certification_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    seed: int | None = None,
    num_fits: int | None = None,
    test_size: float | None = None,
    min_interactions_per_skill: int | None = None,
    min_learners_per_skill: int | None = None,
) -> BktModelRun:
    settings = get_settings()
    run = BktModelRun(
        source_type=source_type,
        trigger_type=trigger_type,
        requested_by=requested_by,
        certification_id=certification_id,
        date_from=date_from,
        date_to=date_to,
        seed=seed if seed is not None else settings.bkt_seed,
        num_fits=num_fits if num_fits is not None else settings.bkt_num_fits,
        test_size=test_size if test_size is not None else settings.bkt_test_size,
        configuration={
            "min_interactions_per_skill": (
                min_interactions_per_skill
                if min_interactions_per_skill is not None
                else settings.bkt_min_interactions_per_skill
            ),
            "min_learners_per_skill": (
                min_learners_per_skill
                if min_learners_per_skill is not None
                else settings.bkt_min_learners_per_skill
            ),
        },
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def set_task_id(session: Session, run_id: str, task_id: str) -> None:
    run = session.get(BktModelRun, run_id)
    if run is None:
        raise ValueError(f"Training run {run_id} was not found")
    run.celery_task_id = task_id
    session.commit()


def _load_dataframe(session: Session, run: BktModelRun, csv_path: str | None) -> pd.DataFrame:
    if run.source_type == "csv":
        if not csv_path:
            raise ValueError("CSV training run is missing its uploaded file path")
        path = Path(csv_path)
        if not path.exists():
            raise FileNotFoundError(f"Uploaded training CSV was not found: {path}")
        return pd.read_csv(path)

    repository = TrainingDataRepository()
    return repository.load_dataframe(
        session,
        certification_id=run.certification_id,
        date_from=run.date_from,
        date_to=run.date_to,
    )


def _lesson_id(value: Any) -> int:
    text_value = str(value).strip()
    try:
        return int(text_value)
    except ValueError as exc:
        try:
            numeric = float(text_value)
            if numeric.is_integer():
                return int(numeric)
        except ValueError:
            pass
        raise ValueError(
            f"BKT skill_name/lesson_id must be numeric for Rebyu persistence; got {value!r}"
        ) from exc


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _persist_result(
    session: Session,
    run: BktModelRun,
    result: dict[str, Any],
    output_dir: Path,
) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    variant = str(result["best_variant"])

    parameters: pd.DataFrame = result["parameters"]
    for row in parameters.to_dict("records"):
        lesson_id = _lesson_id(row["lesson_id"])
        entity = session.get(BktParameter, lesson_id)
        if entity is None:
            entity = BktParameter(lesson_id=lesson_id)
            session.add(entity)
        entity.prior_probability = float(row["prior_probability"])
        entity.learn_probability = float(row["learn_probability"])
        entity.guess_probability = float(row["guess_probability"])
        entity.slip_probability = float(row["slip_probability"])
        entity.forget_probability = float(row["forget_probability"])
        entity.model_variant = variant
        entity.model_run_id = run.model_run_id
        entity.last_trained_at = now

    parameter_classes: pd.DataFrame = result["parameter_classes"]
    for row in parameter_classes.to_dict("records"):
        key = (
            _lesson_id(row["skill_name"]),
            str(row["parameter_name"]),
            str(row["class_name"]),
        )
        entity = session.get(BktParameterClass, key)
        if entity is None:
            entity = BktParameterClass(
                lesson_id=key[0],
                parameter_name=key[1],
                class_name=key[2],
            )
            session.add(entity)
        entity.parameter_value = float(row["parameter_value"])
        entity.model_run_id = run.model_run_id
        entity.last_trained_at = now

    mastery_df: pd.DataFrame = result["mastery"]
    for row in mastery_df.to_dict("records"):
        learner_id = _lesson_id(row["learner_id"])
        lesson_id = _lesson_id(row["lesson_id"])
        key = (learner_id, lesson_id)
        entity = session.get(LearnerLessonMastery, key)
        probability = min(max(float(row["mastery_probability"]), 0.0), 1.0)
        level = mastery_level(
            probability,
            developing_threshold=settings.developing_threshold,
            good_threshold=settings.good_threshold,
            mastered_threshold=settings.mastered_threshold,
        )
        last_updated_raw = row.get("last_updated")
        last_updated = pd.to_datetime(last_updated_raw, utc=True).to_pydatetime()
        if entity is None:
            entity = LearnerLessonMastery(
                learner_id=learner_id,
                lesson_id=lesson_id,
                mastery_probability=probability,
                mastery_level=level,
                attempt_count=int(row.get("attempt_count", 0)),
                model_run_id=run.model_run_id,
                last_updated=last_updated,
            )
            session.add(entity)
        else:
            entity.mastery_probability = probability
            entity.mastery_level = level
            entity.attempt_count = max(entity.attempt_count, int(row.get("attempt_count", 0)))
            entity.model_run_id = run.model_run_id
            entity.last_updated = last_updated

    model_path = output_dir / "rebyu_bkt_model.joblib"
    deactivate_artifacts(session)
    session.add(
        BktModelArtifact(
            model_run_id=run.model_run_id,
            model_variant=variant,
            artifact_path=str(model_path.resolve()),
            sha256=_sha256(model_path),
            is_active=True,
        )
    )

    model_run_data = result["model_run"]
    run.status = "succeeded"
    run.model_variant = variant
    run.evaluation_mode = model_run_data.get("evaluation_mode")
    run.training_rows = int(model_run_data.get("training_rows", 0))
    run.learner_count = int(model_run_data.get("learners", 0))
    run.skill_count = int(model_run_data.get("skills", 0))
    run.metrics = model_run_data.get("metrics")
    run.artifact_path = str(output_dir.resolve())
    run.completed_at = now
    run.error_message = None
    session.commit()


def execute_training_run(
    session: Session,
    *,
    run_id: str,
    csv_path: str | None = None,
) -> dict[str, Any]:
    run = session.get(BktModelRun, run_id)
    if run is None:
        raise ValueError(f"Training run {run_id} was not found")
    if run.status == "cancelled":
        return {"model_run_id": run_id, "status": "cancelled"}

    settings = get_settings()
    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    run.error_message = None
    session.commit()

    try:
        dataframe = _load_dataframe(session, run, csv_path)
        if dataframe.empty:
            raise ValueError("No training rows matched the requested filters")

        output_dir = settings.artifact_dir / run.model_run_id
        output_dir.mkdir(parents=True, exist_ok=True)
        input_path = output_dir / "training_input.csv"
        dataframe.to_csv(input_path, index=False)

        options = options_from_run(run)
        result = run_pipeline(
            input_path=input_path,
            output_dir=output_dir,
            seed=options.seed,
            num_fits=options.num_fits,
            test_size=options.test_size,
            min_interactions_per_skill=options.min_interactions_per_skill,
            min_learners_per_skill=options.min_learners_per_skill,
        )
        _persist_result(session, run, result, output_dir)
        return {
            "model_run_id": run.model_run_id,
            "status": "succeeded",
            "model_variant": result["best_variant"],
            "metrics": result["model_run"]["metrics"],
            "artifact_path": str(output_dir.resolve()),
        }
    except Exception as exc:
        LOGGER.exception("BKT training run %s failed", run_id)
        session.rollback()
        failed_run = session.get(BktModelRun, run_id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.error_message = str(exc)[:10000]
            failed_run.completed_at = datetime.now(timezone.utc)
            session.commit()
        raise

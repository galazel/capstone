from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Rebyu BKT Service"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    api_prefix: str = "/api/v1/bkt"
    service_api_key: str = ""
    # Keep this as a CSV environment variable (rather than Pydantic's default
    # JSON array) so `CORS_ORIGINS=http://localhost:5173,http://localhost:3000`
    # works in .env files.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    database_url: str = "postgresql+psycopg2://rebyu:rebyu@postgres:5432/rebyu"
    sql_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    celery_task_always_eager: bool = False
    celery_task_eager_propagates: bool = True
    timezone: str = "Asia/Manila"
    scheduled_retraining_enabled: bool = True
    scheduled_retraining_day_of_week: str = "sun"
    scheduled_retraining_hour: int = 2
    scheduled_retraining_minute: int = 0

    artifact_dir: Path = Path("artifacts")
    training_view_name: str = "rebyu_bkt_training_data_v"
    max_upload_mb: int = 100

    bkt_seed: int = 42
    bkt_num_fits: int = 2
    bkt_test_size: float = 0.20
    bkt_min_interactions_per_skill: int = 20
    bkt_min_learners_per_skill: int = 3

    fallback_prior: float = 0.30
    fallback_learn: float = 0.20
    fallback_guess: float = 0.25
    fallback_slip: float = 0.10
    fallback_forget: float = 0.00

    developing_threshold: float = 0.40
    good_threshold: float = 0.70
    mastered_threshold: float = 0.85

    readiness_mastery_weight: float = 0.60
    readiness_diagnostic_weight: float = 0.05
    readiness_quiz_weight: float = 0.15
    readiness_middle_exam_weight: float = 0.10
    readiness_mock_exam_weight: float = 0.10

    # --- Priority scoring (lesson component weights; normalized at use) -------
    priority_weight_mastery: float = 0.45
    priority_weight_incorrect: float = 0.20
    priority_weight_mock: float = 0.10
    priority_weight_diagnostic: float = 0.10
    priority_weight_curriculum: float = 0.10
    priority_weight_review: float = 0.05

    # Priority tag thresholds (0..100, worse >= threshold).
    priority_critical_threshold: float = 85.0
    priority_high_threshold: float = 70.0
    priority_medium_threshold: float = 50.0
    priority_low_threshold: float = 30.0
    priority_on_track_threshold: float = 15.0

    # Mastery safeguards and evidence floor.
    priority_min_evidence: int = 1
    mastery_critical_ceiling: float = 0.20
    mastery_high_ceiling: float = 0.30

    # Stabilization hysteresis (points a score must move to change tag).
    priority_worsen_margin: float = 5.0
    priority_improve_margin: float = 8.0

    @field_validator("training_view_name")
    @classmethod
    def validate_view_name(cls, value: str) -> str:
        if not _IDENTIFIER.fullmatch(value):
            raise ValueError("training_view_name must be a plain SQL identifier")
        return value

    @field_validator("artifact_dir", mode="before")
    @classmethod
    def normalize_artifact_dir(cls, value: object) -> Path:
        return Path(str(value)).expanduser()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator(
        "fallback_prior",
        "fallback_learn",
        "fallback_guess",
        "fallback_slip",
        "fallback_forget",
        "developing_threshold",
        "good_threshold",
        "mastered_threshold",
        "readiness_mastery_weight",
        "readiness_diagnostic_weight",
        "readiness_quiz_weight",
        "readiness_middle_exam_weight",
        "readiness_mock_exam_weight",
    )
    @classmethod
    def probability_range(cls, value: float) -> float:
        if not 0 <= value <= 1:
            raise ValueError("probability and weight values must be between 0 and 1")
        return value

    def ensure_directories(self) -> None:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)

    @property
    def readiness_weight_total(self) -> float:
        return (
            self.readiness_mastery_weight
            + self.readiness_diagnostic_weight
            + self.readiness_quiz_weight
            + self.readiness_middle_exam_weight
            + self.readiness_mock_exam_weight
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings

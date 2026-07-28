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

    database_url: str = "postgresql+psycopg://rebyu:rebyu@postgres:5432/rebyu"
    sql_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20
    # Dedicated Postgres schema for every BKT table, so this service can share
    # the same database as the main Rebyu backend without colliding with its
    # tables (notably a legacy `learner_lesson_mastery` table in `public`).
    db_schema: str = "bkt"

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

    # --- AI generation models (certification/lesson/tutor agents) -----------
    # Per-agent-type model selection so cheap classification tasks (document
    # validation, lesson audits) can move to a lighter/faster model later
    # without touching agent code.
    ai_default_model: str = "llama-3.3-70b-versatile"
    ai_generation_model: str = "llama-3.3-70b-versatile"
    ai_classification_model: str = "llama-3.3-70b-versatile"
    ai_temperature: float = 0.0
    ai_max_tokens: int = 6000
    #: Completion budget for the classification agents (document validation,
    #: lesson audits). They return a boolean and a sentence, so reserving the
    #: generation budget for them was never useful -- and it was actively
    #: harmful: Groq counts `max_tokens` toward a request's TPM estimate, so a
    #: ~300-token audit prompt asked for 6332 tokens against `llama-3.1-8b-
    #: instant`'s 6000 TPM limit and was rejected outright with a 413. No
    #: amount of waiting fixes a single request that exceeds the whole
    #: per-minute allowance.
    ai_classification_max_tokens: int = 1024

    # --- Model fallback on quota exhaustion -----------------------------------
    # Groq scopes rate limits per model, so a model whose daily token budget is
    # spent can be swapped for one with its own untouched budget instead of
    # failing the run. Ordered most-capable first: a fallback trades output
    # quality for availability, so it is a last resort, not a load-balancer.
    #
    # Comma-separated rather than list[str] because pydantic-settings expects
    # JSON for complex types, which makes overriding this in .env awkward
    # (AI_GENERATION_FALLBACKS='["a","b"]' vs AI_GENERATION_FALLBACKS=a,b).
    ai_generation_fallbacks: str = "llama-3.1-8b-instant"
    ai_classification_fallbacks: str = "llama-3.1-8b-instant"
    #: Cooldown applied when a 429 carries no parseable reset time. Groq's daily
    #: buckets reset on a rolling window, so an hour is a safe assumption.
    ai_quota_cooldown_seconds: float = 3600.0

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

    # --- RAG / retrieval (Phase 2a) -------------------------------------------
    # Replaces the previous 256-dim SHA-256 token-hashing "embeddings", which
    # had no semantic capability at all. Kept behind settings so the model can
    # be swapped (e.g. to BAAI/bge-base-en-v1.5) without touching rag/ code.
    rag_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rag_embedding_device: str = "cpu"
    rag_index_dir: Path = Path("faiss_db")
    # ~1000 chars/150 overlap on sentence boundaries, vs the old 300-char
    # fixed-width slices that cut mid-word and carried ~75 tokens of context.
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 150
    # Fetch wide, then narrow: fetch_k candidates are reranked down to top_k.
    rag_fetch_k: int = 20
    rag_top_k: int = 8
    rag_rerank_enabled: bool = True
    rag_rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    # Hard ceiling on assembled context handed to a generation agent.
    rag_max_context_chars: int = 24000

    # --- RabbitMQ (Phase 6 consumers) ----------------------------------------
    # Same broker/topology the Java backend's producers publish to
    # (see backend-java RabbitMqConfig): topic exchange + per-queue DLX/DLQ.
    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_username: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_exchange: str = "rebyu.exchange"
    rabbitmq_dead_letter_exchange: str = "rebyu.dlx"

    # --- AWS S3 (Phase 6: read knowledge_documents uploaded by Java) ---------
    aws_s3_bucket_name: str = "rebyu"
    aws_s3_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    @property
    def rabbitmq_url(self) -> str:
        return (
            f"amqp://{self.rabbitmq_username}:{self.rabbitmq_password}"
            f"@{self.rabbitmq_host}:{self.rabbitmq_port}/"
        )

    @field_validator("training_view_name")
    @classmethod
    def validate_view_name(cls, value: str) -> str:
        if not _IDENTIFIER.fullmatch(value):
            raise ValueError("training_view_name must be a plain SQL identifier")
        return value

    @field_validator("db_schema")
    @classmethod
    def validate_db_schema(cls, value: str) -> str:
        if not _IDENTIFIER.fullmatch(value):
            raise ValueError("db_schema must be a plain SQL identifier")
        return value

    @field_validator("artifact_dir", "rag_index_dir", mode="before")
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
        self.rag_index_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings

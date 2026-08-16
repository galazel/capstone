from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator, model_validator
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

    # --- OpenRouter -----------------------------------------------------------
    # Every agent talks to OpenRouter's OpenAI-compatible endpoint rather than
    # to one vendor directly, which is what makes the per-task model table below
    # possible: a lesson can be written by Claude and a document audit answered
    # by Gemini Flash Lite over the same client, the same key, and the same
    # billing account.
    #: Base URLs live in `app.ai.tasks.PROVIDERS`, not here -- there is one per
    #: provider now, and a per-provider value cannot be expressed as a single
    #: setting. An `openrouter_base_url` field used to sit here and was silently
    #: ignored after the registry took over, which is worse than not having it.
    #:
    #: Sent as OpenRouter's `HTTP-Referer` / `X-Title` attribution headers.
    #: Optional to the API; they are what makes a run identifiable on the
    #: activity dashboard when several services share one key.
    openrouter_site_url: str = "https://rebyu.app"
    openrouter_app_name: str = "REBYU"

    # --- Per-task AI models ---------------------------------------------------
    # One model per task, not one model per "tier". These jobs differ by more
    # than an order of magnitude in size and in what they demand:
    #
    #   lesson          a whole lesson, 18+ authored content blocks, research
    #                   tool calls, structured output -- the single hardest and
    #                   most quality-sensitive thing this service does
    #   curriculum      one large JSON syllabus, planned in one shot
    #   question        many small batches, run dozens of times per generation
    #                   -- the volume task, so unit price dominates
    #   tutor           interactive; latency matters more than depth
    #   lesson_audit    reads a long lesson, returns a verdict
    #   document_audit  reads a few document samples, returns a boolean
    #
    # Pointing all six at one model means either wasting the biggest model on a
    # boolean or underpowering the lessons. Each therefore gets its own model,
    # fallback chain, completion budget and temperature, resolved in
    # `app.ai.tasks`.
    #
    # EVERYTHING RUNS ON OPENROUTER, ON `:free` SLUGS -- no credit is spent.
    # One provider for all six tasks, which keeps the table simple. Know the
    # limits before relying on it:
    #
    #   * The free allowance is ~50 requests per DAY for the whole ACCOUNT --
    #     shared across every `:free` model, so a fallback chain cannot route
    #     around it. A full certification needs roughly 100+ calls (18 lessons
    #     x2 round trips, ~30 question batches, 18 audits), so A COMPLETE RUN
    #     DOES NOT FIT. Expect it to stop partway with a 429 naming
    #     `free-models-per-day`. One or two lessons to check the pipeline is fine.
    #     A one-off $10 purchase raises the cap to ~1000/day permanently.
    #   * Models are chosen for MULTI-TURN tool support and output ceiling first.
    #     `lesson` and `curriculum` call a Serper web search and then answer, and
    #     most free slugs cannot do that round trip -- see the note on those two.
    #   * Quality is lower than paid. Measured: a free lesson used 8 distinct
    #     block types (the best of any free model tested); Groq's llama-3.3-70b
    #     managed only 5. `.env.example` carries a ready paid block.
    #
    # `ai_default_model` is the backstop appended to every chain. Empty here on
    # purpose: every task already names a same-provider fallback, and a global
    # default would be the one entry able to smuggle a paid slug into a chain
    # that is meant to stay free.
    ai_default_model: str = ""

    #: The only two agents that call a real tool (Serper web search) and then
    #: answer, so they need MULTI-TURN tool use -- a much narrower capability
    #: than the single-turn structured output the other four need. Tested
    #: 2026-08-03 against the real agents, which rules out most of the catalogue:
    #:
    #:   PASS  openrouter nemotron-3-ultra-550b:free  (ran the real lesson agent)
    #:   PASS  groq llama-3.3-70b-versatile / llama-3.1-8b-instant
    #:   FAIL  gemini 3.x      -- needs a thought_signature on replayed tool calls
    #:                            that the OpenAI-compat layer drops
    #:   FAIL  groq gpt-oss-*  -- tool_use_failed WITH tools (fine without)
    #:   FAIL  groq qwen3.6-27b -- 413, its TPM cannot hold a lesson request
    #:
    #: 550B parameters with a 1M context and 64k output ceiling: the largest free
    #: model that exists with working tool support, and the only free one that
    #: reached for the rich block types (tabs, image-text layouts) rather than
    #: padding with headings and paragraphs.
    ai_lesson_provider: str = "openrouter"
    ai_lesson_model: str = "anthropic/claude-sonnet-4.5"
    ai_lesson_fallbacks: str = "google/gemini-2.5-pro,openai/gpt-4.1"
    #: 16000. Unlike Groq -- whose 12k tokens-per-minute ceiling counts
    #: `max_tokens` and refused anything larger with a 413 -- OpenRouter imposes
    #: no per-minute ceiling here, and this model's output limit is 64k. So the
    #: lesson budget is a content decision again rather than a provider one.
    ai_lesson_max_tokens: int = 24000
    #: Slightly above zero: at 0.0 the model reaches for the same four block
    #: types every lesson, and the prompt explicitly asks it to vary them.
    ai_lesson_temperature: float = 0.4

    #: Same multi-turn tool constraint as the lesson agent -- it searches for the
    #: real certification's published exam objectives before planning -- so it
    #: gets the same proven model. Its answer is plain JSON rather than a tool
    #: call (see app/ai/json_output.py), which is what lets a sample that stops
    #: before its closing brackets be repaired instead of rejected.
    ai_curriculum_provider: str = "openrouter"
    ai_curriculum_model: str = "anthropic/claude-sonnet-4.5"
    ai_curriculum_fallbacks: str = "google/gemini-2.5-pro,openai/gpt-4.1"
    ai_curriculum_max_tokens: int = 16000
    #: Near-deterministic: a syllabus should be the same shape twice, and this
    #: agent's answer is hand-parsed JSON, where creativity is only ever risk.
    ai_curriculum_temperature: float = 0.2

    #: The volume task -- ~30 calls per certification, more than every other
    #: agent combined. On the free tier the scarce resource is the account-wide
    #: daily REQUEST cap, not money, so this is what exhausts a run, and the
    #: first thing to look at when generation stops partway through.
    ai_question_provider: str = "openrouter"
    ai_question_model: str = "google/gemini-2.5-flash"
    ai_question_fallbacks: str = "openai/gpt-4.1-mini,anthropic/claude-haiku-4.5"
    ai_question_max_tokens: int = 8000
    #: Deliberately the highest of the six. Batches cannot see each other except
    #: through an "already written" list, and at low temperature they converge on
    #: the same stems -- which `invoke_question_agent` then discards as
    #: duplicates, leaving the assessment short. Variance here is throughput.
    ai_question_temperature: float = 0.6

    #: Learner-facing chat: answered while someone waits, so a small fast model
    #: beats a marginally better slow one.
    ai_tutor_provider: str = "openrouter"
    ai_tutor_model: str = "google/gemini-2.5-flash"
    ai_tutor_fallbacks: str = "openai/gpt-4.1-mini"
    ai_tutor_max_tokens: int = 2000
    ai_tutor_temperature: float = 0.3

    #: Reads a full generated lesson and judges it against the curriculum. Small
    #: output, large input -- so this is sized by context, not by capability.
    ai_lesson_audit_provider: str = "openrouter"
    ai_lesson_audit_model: str = "openai/gpt-4.1-mini"
    ai_lesson_audit_fallbacks: str = "google/gemini-2.5-flash"
    ai_lesson_audit_max_tokens: int = 1024
    ai_lesson_audit_temperature: float = 0.0

    #: The smallest job in the system: is this document about this
    #: certification, yes or no. Anything larger is waste -- and on a per-day
    #: request cap, waste is measured in requests the lesson agent no longer has.
    #:
    #: There is a floor, though, and it is higher than "smallest model that
    #: advertises tool support". `nvidia/nemotron-nano-9b-v2:free` answers a
    #: one-field probe tool correctly and then degenerates on this agent's real
    #: schema, emitting repeated `/</</<` and unparseable tool-call JSON until
    #: the retry budget is spent. Capability has to be verified against the
    #: actual agent, not a toy call.
    ai_document_audit_provider: str = "openrouter"
    ai_document_audit_model: str = "openai/gpt-4.1-mini"
    ai_document_audit_fallbacks: str = "google/gemini-2.5-flash"
    ai_document_audit_max_tokens: int = 512
    ai_document_audit_temperature: float = 0.0

    # --- Curriculum size ------------------------------------------------------
    # What the planner is *asked* for. Lower all six to run the whole workflow
    # end-to-end on a small AI budget: setting every min/max to 1 yields a
    # one-major/one-middle/one-lesson certification that still exercises every
    # node in the graph, review checkpoints and assessments included.
    #
    # The breadth floor that rejects an under-sized sample is derived from
    # these rather than fixed (see `app.schemas.certification.curriculum_schema`),
    # so a deliberately small configuration is not rejected as a bad sample.
    curriculum_min_majors: int = 3
    curriculum_max_majors: int = 6
    curriculum_min_middles: int = 2
    curriculum_max_middles: int = 4
    curriculum_min_lessons: int = 3
    curriculum_max_lessons: int = 5

    #: Content blocks the lesson agent is asked to write. Deliberately
    #: independent of curriculum size: a cheap test run wants *few* lessons,
    #: not thin ones, so shrinking the syllabus must not shrink the lesson.
    #:
    #: 18 rather than the old 10 because the constraint that set the old number
    #: is gone: the lesson was written in one response bounded by a 6000-token
    #: completion budget, itself bounded by a free tier's per-minute allowance.
    #: `ai_lesson_max_tokens` is now 16000 against a model with a 64k ceiling,
    #: so depth here is a content decision rather than a budget one.
    lesson_min_sections: int = 22

    # --- Assessment size ------------------------------------------------------
    # Questions per assessment. Generation and validation read the same value,
    # so lowering one lowers the ask and the expected count together.
    #
    # These dominate a run's token cost: even a single-lesson curriculum still
    # generates 10 + 20 + 50 + 40 + 60 + 100 = 280 questions at these defaults,
    # which is far more than the syllabus itself. They are the first thing to
    # lower when the budget, not the workflow, is the constraint.
    lesson_quiz_questions: int = 10
    middle_quiz_questions: int = 20
    major_quiz_questions: int = 50
    diagnostic_exam_questions: int = 40
    #: Used only when the planner could not determine the real exam's item
    #: count -- when it did, that number wins (capped by
    #: `mock_exam_max_questions`). 50 MCQs across the whole syllabus is the
    #: neutral fallback: long enough to cover a certification, short enough to
    #: sit, and self-grading.
    mock_exam_questions: int = 50
    question_bank_questions: int = 100

    #: Questions asked for in a single LLM call. Anything larger is split
    #: across several calls and merged (`app.ai.invocation`). One MCQ costs
    #: roughly 250 completion tokens because it explains every choice, so 15
    #: fits inside `ai_question_max_tokens` (4000) with room for the model's
    #: preamble; asking for 50 at once truncates the response, which fails,
    #: retries with backoff, and eventually trips the Java gateway's timeout.
    #:
    #: Raising this beyond the completion budget / 250 is the fastest way to
    #: reintroduce that timeout, so the two settings move together -- which is
    #: why a test pins the relationship rather than trusting these comments.
    #: The question task runs on Groq, whose tokens-per-minute ceiling is 8k and
    #: counts `max_tokens` toward the estimate, so the budget cannot simply be
    #: raised to fit a bigger batch.
    question_batch_size: int = 20

    #: Ceiling on the mock exam regardless of what the planner researched.
    #: The mock exam's item count normally comes from the real certification's
    #: exam structure -- TOPCIT's 100 items, say -- because a mock exam that
    #: ignores the paper it imitates is not a mock exam. That is the right
    #: default and the wrong one on a small budget, so this clamps it without
    #: discarding the rest of the researched structure. 0 means no ceiling.
    mock_exam_max_questions: int = 0

    # --- Model fallback on quota exhaustion -----------------------------------
    # The per-task `*_fallbacks` lists above are walked when a model is rate
    # limited or its upstream provider is down. They are ordered most-capable
    # first: a fallback trades output quality for availability, so it is a last
    # resort, not a load-balancer.
    #
    # They are comma-separated strings rather than list[str] because
    # pydantic-settings expects JSON for complex types, which makes overriding
    # them in .env awkward (AI_LESSON_FALLBACKS='["a","b"]' vs =a,b).
    #
    #: Cooldown applied when a rate-limit response carries no parseable reset
    #: time. OpenRouter's own free-tier buckets are daily, and an upstream
    #: provider's limits are opaque from here, so an hour is the safe
    #: assumption -- it is a skip-this-model hint, not a sleep.
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

    # Readiness component weights. They must sum to 1.00: the service divides
    # by the full total, so a component a learner has not earned yet counts as
    # zero rather than being removed from the calculation.
    #
    # Mastery leads -- what you know matters most. Lesson progress is second:
    # having covered the syllabus is the other half of being ready, and it is
    # the component that keeps an untouched course from scoring well on the
    # strength of one good assessment. The mock exam is third and now outranks
    # the lesson quiz: it is the only component sat under real exam conditions,
    # so it is the closest thing here to evidence of passing the actual thing.
    readiness_mastery_weight: float = 0.40
    readiness_progress_weight: float = 0.20
    readiness_mock_exam_weight: float = 0.15
    readiness_quiz_weight: float = 0.12
    readiness_middle_exam_weight: float = 0.08
    # A diagnostic places you; it does not certify you. Small on purpose.
    readiness_diagnostic_weight: float = 0.03
    # Consistency is evidence of effort, not of knowing the material.
    readiness_streak_weight: float = 0.02

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
    #: Retained only so an existing deployment's `faiss_db/` path stays
    #: configurable while it is cleaned up. Nothing reads it for retrieval
    #: any more -- vectors live in Qdrant.
    rag_index_dir: Path = Path("faiss_db")

    # --- Qdrant ------------------------------------------------------------
    # Run it with:  docker run -p 6333:6333 -p 6334:6334 \
    #                 -v qdrant_storage:/qdrant/storage qdrant/qdrant
    # One collection per certification (see `app.rag.store.namespace_for`), so
    # a retrieval cannot read another certification's documents even if a
    # metadata filter is forgotten.
    qdrant_url: str = "http://localhost:6333"
    #: Empty for a local container; set for Qdrant Cloud.
    qdrant_api_key: str = ""
    qdrant_timeout_seconds: float = 30.0
    # ~1000 chars/150 overlap on sentence boundaries, vs the old 300-char
    # fixed-width slices that cut mid-word and carried ~75 tokens of context.
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 150
    # Fetch wide, then narrow: fetch_k candidates are reranked down to top_k.
    rag_fetch_k: int = 80
    rag_top_k: int = 24
    rag_rerank_enabled: bool = True
    rag_rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    # Hard ceiling on assembled context handed to a generation agent.
    rag_max_context_chars: int = 160000

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

    @field_validator(
        "curriculum_min_majors",
        "curriculum_max_majors",
        "curriculum_min_middles",
        "curriculum_max_middles",
        "curriculum_min_lessons",
        "curriculum_max_lessons",
        "lesson_min_sections",
        "lesson_quiz_questions",
        "middle_quiz_questions",
        "major_quiz_questions",
        "diagnostic_exam_questions",
        "mock_exam_questions",
        "question_bank_questions",
    )
    @classmethod
    def at_least_one(cls, value: int) -> int:
        if value < 1:
            raise ValueError("curriculum and assessment sizes must be at least 1")
        return value

    @model_validator(mode="after")
    def ranges_are_ordered(self) -> "Settings":
        """A max below its min would produce a prompt asking for "3 to 1"
        lessons -- nonsense the model resolves arbitrarily, and a silent one
        since nothing else would ever notice."""
        for low, high in (
            ("curriculum_min_majors", "curriculum_max_majors"),
            ("curriculum_min_middles", "curriculum_max_middles"),
            ("curriculum_min_lessons", "curriculum_max_lessons"),
        ):
            if getattr(self, high) < getattr(self, low):
                raise ValueError(f"{high} must be greater than or equal to {low}")
        return self

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
        "readiness_progress_weight",
        "readiness_streak_weight",
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

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def uuid_string() -> str:
    return str(uuid4())


class BktModelRun(Base):
    __tablename__ = "bkt_model_runs"

    model_run_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    run_type: Mapped[str] = mapped_column(String(30), default="training", nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(30), default="manual", nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), default="database", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False, index=True)
    requested_by: Mapped[str | None] = mapped_column(String(150))
    celery_task_id: Mapped[str | None] = mapped_column(String(100), index=True)
    certification_id: Mapped[int | None] = mapped_column(BigInteger)
    date_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    date_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model_variant: Mapped[str | None] = mapped_column(String(80))
    evaluation_mode: Mapped[str | None] = mapped_column(String(80))
    seed: Mapped[int] = mapped_column(Integer, nullable=False, default=42)
    num_fits: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    test_size: Mapped[float] = mapped_column(Float, nullable=False, default=0.20)
    training_rows: Mapped[int | None] = mapped_column(Integer)
    learner_count: Mapped[int | None] = mapped_column(Integer)
    skill_count: Mapped[int | None] = mapped_column(Integer)
    metrics: Mapped[dict | None] = mapped_column(JSON)
    configuration: Mapped[dict | None] = mapped_column(JSON)
    artifact_path: Mapped[str | None] = mapped_column(String(500))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled')",
            name="ck_bkt_model_runs_status",
        ),
    )


class BktParameter(Base):
    __tablename__ = "bkt_parameters"

    lesson_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    prior_probability: Mapped[float] = mapped_column(Float, nullable=False)
    learn_probability: Mapped[float] = mapped_column(Float, nullable=False)
    guess_probability: Mapped[float] = mapped_column(Float, nullable=False)
    slip_probability: Mapped[float] = mapped_column(Float, nullable=False)
    forget_probability: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    model_variant: Mapped[str] = mapped_column(String(80), nullable=False)
    model_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bkt_model_runs.model_run_id", ondelete="SET NULL")
    )
    last_trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class BktParameterClass(Base):
    __tablename__ = "bkt_parameter_classes"

    lesson_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    parameter_name: Mapped[str] = mapped_column(String(30), primary_key=True)
    class_name: Mapped[str] = mapped_column(String(80), primary_key=True)
    parameter_value: Mapped[float] = mapped_column(Float, nullable=False)
    model_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bkt_model_runs.model_run_id", ondelete="SET NULL")
    )
    last_trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "parameter_name IN ('prior','learns','guesses','slips','forgets')",
            name="ck_bkt_parameter_classes_parameter",
        ),
    )


class LearnerLessonMastery(Base):
    __tablename__ = "learner_lesson_mastery"

    learner_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    mastery_probability: Mapped[float] = mapped_column(Float, nullable=False)
    mastery_level: Mapped[str] = mapped_column(String(20), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Evidence counters + curriculum path, carried on the event so priority
    # aggregation never needs to read the main Rebyu curriculum tables.
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    certification_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    middle_category_id: Mapped[int | None] = mapped_column(BigInteger)
    major_category_id: Mapped[int | None] = mapped_column(BigInteger)
    lesson_title: Mapped[str | None] = mapped_column(String(200))
    middle_category_title: Mapped[str | None] = mapped_column(String(200))
    major_category_title: Mapped[str | None] = mapped_column(String(200))
    last_assessment_type: Mapped[str | None] = mapped_column(String(30))
    last_event_id: Mapped[str | None] = mapped_column(String(150))
    model_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bkt_model_runs.model_run_id", ondelete="SET NULL")
    )
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "mastery_level IN ('weak','developing','good','mastered')",
            name="ck_learner_lesson_mastery_level",
        ),
        Index("ix_mastery_learner_level", "learner_id", "mastery_level"),
        Index("ix_mastery_learner_certification", "learner_id", "certification_id"),
    )


class BktMasteryEvent(Base):
    __tablename__ = "bkt_mastery_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    source_event_id: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    learner_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    lesson_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    question_id: Mapped[int | None] = mapped_column(BigInteger)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    difficulty_level: Mapped[str] = mapped_column(String(20), nullable=False)
    assessment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    mastery_before: Mapped[float] = mapped_column(Float, nullable=False)
    mastery_posterior: Mapped[float] = mapped_column(Float, nullable=False)
    mastery_after: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_correct_probability: Mapped[float] = mapped_column(Float, nullable=False)
    parameters_used: Mapped[dict] = mapped_column(JSON, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_bkt_mastery_events_learner_lesson", "learner_id", "lesson_id", "occurred_at"),
    )


class BktModelArtifact(Base):
    __tablename__ = "bkt_model_artifacts"

    artifact_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    model_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bkt_model_runs.model_run_id", ondelete="CASCADE"), nullable=False
    )
    model_variant: Mapped[str] = mapped_column(String(80), nullable=False)
    artifact_path: Mapped[str] = mapped_column(String(500), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("model_run_id", name="uq_bkt_model_artifact_run"),
    )


class BktProcessedEvent(Base):
    """Idempotency ledger: one row per successfully processed source event.

    Complements the unique ``bkt_mastery_events.source_event_id`` guard with a
    deterministic payload hash so a re-send with a *different* payload for the
    same event id can be detected and flagged instead of silently reprocessed.
    """

    __tablename__ = "bkt_processed_events"

    processed_event_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    event_id: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    batch_id: Mapped[str | None] = mapped_column(String(120))
    learner_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    certification_id: Mapped[int | None] = mapped_column(BigInteger)
    exam_result_id: Mapped[int | None] = mapped_column(BigInteger)
    exam_question_id: Mapped[int | None] = mapped_column(BigInteger)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    processing_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PROCESSED")
    processing_result_json: Mapped[dict | None] = mapped_column(JSON)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class LearnerLessonMasteryHistory(Base):
    __tablename__ = "learner_lesson_mastery_history"

    mastery_history_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    event_id: Mapped[str | None] = mapped_column(String(150), index=True)
    learner_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    certification_id: Mapped[int | None] = mapped_column(BigInteger)
    lesson_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    previous_mastery: Mapped[float] = mapped_column(Float, nullable=False)
    observation_posterior: Mapped[float] = mapped_column(Float, nullable=False)
    final_mastery: Mapped[float] = mapped_column(Float, nullable=False)
    previous_mastery_level: Mapped[str | None] = mapped_column(String(20))
    new_mastery_level: Mapped[str] = mapped_column(String(20), nullable=False)
    observed_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score_awarded: Mapped[float | None] = mapped_column(Float)
    maximum_score: Mapped[float | None] = mapped_column(Float)
    assessment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    question_type: Mapped[str | None] = mapped_column(String(30))
    difficulty_level: Mapped[str] = mapped_column(String(20), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_mastery_history_learner_lesson", "learner_id", "lesson_id", "created_at"),
    )


class LearnerCategoryPriority(Base):
    """Current priority record for one LESSON / MIDDLE / MAJOR node."""

    __tablename__ = "learner_category_priorities"

    learner_category_priority_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=uuid_string
    )
    learner_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    certification_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category_type: Mapped[str] = mapped_column(String(10), nullable=False)  # MAJOR/MIDDLE/LESSON
    # "LESSON:17" / "MIDDLE:8" / "MAJOR:2": makes the uniqueness index simple
    # despite the nullable id columns.
    category_key: Mapped[str] = mapped_column(String(40), nullable=False)
    major_category_id: Mapped[int | None] = mapped_column(BigInteger)
    middle_category_id: Mapped[int | None] = mapped_column(BigInteger)
    lesson_id: Mapped[int | None] = mapped_column(BigInteger)
    category_title: Mapped[str | None] = mapped_column(String(200))
    mastery_probability: Mapped[float | None] = mapped_column(Float)
    mastery_level: Mapped[str | None] = mapped_column(String(20))
    priority_score: Mapped[float] = mapped_column(Float, nullable=False)
    priority_tag: Mapped[str] = mapped_column(String(30), nullable=False)
    priority_label: Mapped[str] = mapped_column(String(50), nullable=False)
    primary_reason: Mapped[str | None] = mapped_column(Text)
    reasons_json: Mapped[list | None] = mapped_column(JSON)
    recommended_action: Mapped[str | None] = mapped_column(Text)
    recommended_activity: Mapped[str | None] = mapped_column(String(40))
    evidence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_version: Mapped[str | None] = mapped_column(String(80))
    last_assessment_type: Mapped[str | None] = mapped_column(String(30))
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "learner_id", "certification_id", "category_key",
            name="uq_learner_category_priority",
        ),
        Index("ix_category_priority_learner_cert", "learner_id", "certification_id"),
        Index("ix_category_priority_tag", "priority_tag"),
        Index("ix_category_priority_score", "priority_score"),
    )


class LearnerCategoryPriorityHistory(Base):
    __tablename__ = "learner_category_priority_history"

    priority_history_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    learner_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    certification_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category_type: Mapped[str] = mapped_column(String(10), nullable=False)
    category_id: Mapped[int | None] = mapped_column(BigInteger)
    previous_priority_score: Mapped[float | None] = mapped_column(Float)
    new_priority_score: Mapped[float | None] = mapped_column(Float)
    previous_priority_tag: Mapped[str | None] = mapped_column(String(30))
    new_priority_tag: Mapped[str | None] = mapped_column(String(30))
    primary_reason: Mapped[str | None] = mapped_column(Text)
    source_event_id: Mapped[str | None] = mapped_column(String(150))
    exam_id: Mapped[int | None] = mapped_column(BigInteger)
    exam_result_id: Mapped[int | None] = mapped_column(BigInteger)
    assessment_type: Mapped[str | None] = mapped_column(String(30))
    model_version: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        Index("ix_priority_history_learner_cert", "learner_id", "certification_id", "created_at"),
    )


class GeneratedQuestionDraft(Base):
    """One completed question-bank generation run's approved output.

    Written by the Phase 6 question.generation.queue consumer once its
    LangGraph run resolves without a pending HITL review. There is no
    equivalent Java table -- question drafts were previously ephemeral
    (returned straight to the browser by the old synchronous endpoint), so
    this is the first durable place they land for the async flow.
    """

    __tablename__ = "generated_question_drafts"

    generated_question_draft_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    generation_request_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    certification_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    thread_id: Mapped[str] = mapped_column(String(36), nullable=False)
    questions: Mapped[list] = mapped_column(JSON, nullable=False)
    generated_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class WorkflowRun(Base):
    """One execution of a LangGraph workflow, tracked outside the checkpoint.

    LangGraph's checkpointer stores a run's *state* keyed by thread_id, but
    provides no way to ask "which runs exist, and which are waiting for a
    human?". Without that, a HITL pause was invisible: the run sat at
    generation_requests.status = PROCESSING forever and no admin could
    discover a review was pending or reach the resume endpoint.

    Owned by Python (this service's own schema), because workflow
    orchestration state is Python's concern -- Java only needs the finished
    artifacts.
    """

    __tablename__ = "workflow_runs"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    #: LangGraph thread id -- the key used to resume this run.
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    #: CERTIFICATION | QUESTION_BANK
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    certification_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    generation_request_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    triggered_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    #: RUNNING | WAITING_FOR_REVIEW | COMPLETED | FAILED | CANCELLED
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    #: Human-readable stage the run is at, e.g. "CURRICULUM".
    current_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Monotonic counter for events belonging to this run. Lets a
    #: reconnecting client replay from `last_seq` instead of losing history.
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # One live registry row per LangGraph thread.
        UniqueConstraint("thread_id", name="uq_workflow_runs_thread"),
        Index("ix_workflow_runs_status_started", "status", "started_at"),
    )


class WorkflowEvent(Base):
    """An append-only log of what a run did, and when.

    Doubles as the WebSocket replay log: `seq` is monotonic per run, so a
    client that reconnects sends its `last_seq` and receives only what it
    missed. Without this, a dropped connection loses the timeline.
    """

    __tablename__ = "workflow_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_string)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_runs.run_id", ondelete="CASCADE"), nullable=False
    )
    #: Monotonic within a run, starting at 1.
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    #: workflow.started | node.started | node.completed | validation.completed
    #: | review.waiting | review.submitted | workflow.resumed
    #: | workflow.completed | workflow.failed
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    #: PENDING | RUNNING | COMPLETED | WAITING_FOR_REVIEW | RETRYING | FAILED
    #: | SKIPPED | CANCELLED -- the task status the workspace renders.
    task_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("run_id", "seq", name="uq_workflow_events_run_seq"),
        Index("ix_workflow_events_run_seq", "run_id", "seq"),
    )

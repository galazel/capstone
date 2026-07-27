"""SQLAlchemy Core reflections of tables owned by the Java (Spring Boot)
backend, for the Phase 6 RabbitMQ consumers to read/write directly.

These are deliberately Core `Table` objects on their own `MetaData` --not
mapped classes on `app.db.base.Base`-- so Alembic never tries to manage or
autogenerate migrations against tables Java's Hibernate `ddl-auto=update`
already owns. Column sets are intentionally partial: only what the Phase 6
consumers actually read or write, mirrored from the corresponding Java
`@Entity` classes. Schema is pinned to `public` explicitly (rather than
relying on this service's `search_path`) since these tables never exist in
the `bkt` schema and consumers may run write statements where ambiguity
would be a real bug, not just a lookup convenience.
"""

from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB

java_metadata = MetaData(schema="public")

certifications = Table(
    "certifications",
    java_metadata,
    Column("certification_id", BigInteger, primary_key=True),
    Column("title", String(150)),
    Column("description", Text),
    Column("industry", String),
    # smallint, not text. Java's Certification entity declares
    # `CertificationStatus status` with no @Enumerated(EnumType.STRING), so
    # JPA falls back to ORDINAL and persists the enum's position:
    # PUBLISHED=0, DRAFT=1. Verified against the live schema.
    Column("status", SmallInteger),
    Column("date_created", DateTime),
    Column("date_updated", DateTime),
)

generation_requests = Table(
    "generation_requests",
    java_metadata,
    Column("generation_request_id", BigInteger, primary_key=True),
    Column("certification_id", BigInteger, nullable=False),
    Column("request_type", String(20), nullable=False),
    Column("params_json", Text),
    Column("status", String(20), nullable=False),
    Column("error_message", Text),
    Column("triggered_by_user_id", BigInteger),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime),
    Column("completed_at", DateTime),
)

knowledge_documents = Table(
    "knowledge_documents",
    java_metadata,
    Column("knowledge_document_id", BigInteger, primary_key=True),
    Column("filename", String, nullable=False),
    Column("original_filename", String, nullable=False),
    Column("content_type", String, nullable=False),
    Column("file_size", BigInteger),
    Column("s3_key", String),
    Column("status", String, nullable=False),
    Column("certification_id", BigInteger),
    Column("use_case", String, nullable=False),
)

major_categories = Table(
    "major_categories",
    java_metadata,
    Column("major_category_id", BigInteger, primary_key=True),
    Column("certification_id", BigInteger, nullable=False),
    Column("title", String(150), nullable=False),
    Column("owner_group_id", BigInteger),
)

middle_categories = Table(
    "middle_categories",
    java_metadata,
    Column("middle_category_id", BigInteger, primary_key=True),
    Column("major_category_id", BigInteger, nullable=False),
    Column("title", String(150), nullable=False),
)

lessons = Table(
    "lessons",
    java_metadata,
    Column("lesson_id", BigInteger, primary_key=True),
    Column("middle_category_id", BigInteger, nullable=False),
    Column("name", String(150), nullable=False),
    # jsonb, not text: Java's Lesson entity annotates this
    # @JdbcTypeCode(SqlTypes.JSON). Passing a str here fails with
    # "column is of type jsonb but expression is of type character varying".
    Column("lesson_component_structure", JSONB, nullable=False),
)

users = Table(
    "users",
    java_metadata,
    Column("user_id", BigInteger, primary_key=True),
    Column("email", String(254), nullable=False),
)

learners = Table(
    "learners",
    java_metadata,
    Column("learner_id", BigInteger, primary_key=True),
    Column("user_id", BigInteger, nullable=False),
    Column("username", String(50), nullable=False),
    Column("first_name", String(50), nullable=False),
    Column("last_name", String(50), nullable=False),
)

exam_types = Table(
    "exam_types",
    java_metadata,
    Column("exam_type_id", BigInteger, primary_key=True),
    Column("exam_type_text", String(50), nullable=False),
)

exams = Table(
    "exams",
    java_metadata,
    Column("exam_id", BigInteger, primary_key=True),
    Column("certification_id", BigInteger, nullable=False),
    Column("exam_type_id", BigInteger, nullable=False),
    Column("title", String(150), nullable=False),
    Column("is_generated", Boolean, nullable=False),
    Column("duration_minutes", Integer),
    Column("total_questions", Integer, nullable=False),
    Column("passing_score", Numeric(5, 2), nullable=False),
    Column("status", String(20)),
    Column("description", Text),
    Column("instructions", Text),
    # Scope: exactly one of these is set (or none, for certification-wide
    # exams like the mock/diagnostic).
    Column("lesson_id", BigInteger),
    Column("middle_category_id", BigInteger),
    Column("major_category_id", BigInteger),
    Column("target_scope", String(20)),
    Column("updated_at", DateTime),
)

questions = Table(
    "questions",
    java_metadata,
    Column("question_id", BigInteger, primary_key=True),
    Column("question_type", String(30), nullable=False),
    Column("difficulty_level", String(10), nullable=False),
    Column("question_text", Text, nullable=False),
    # NOT NULL in Java's schema: every question belongs to exactly one
    # lesson. Multi-lesson artifacts (major/middle quizzes, mock exams, the
    # bank) therefore have to resolve each question to a specific lesson --
    # see app/domain/persistence/questions.py.
    Column("lesson_id", BigInteger, nullable=False),
    Column("total_points", Numeric(5, 2), nullable=False),
    Column("created_at", DateTime),
)

choices = Table(
    "choices",
    java_metadata,
    Column("choice_id", BigInteger, primary_key=True),
    Column("question_id", BigInteger, nullable=False),
    Column("choice_text", Text, nullable=False),
    Column("is_correct", Boolean, nullable=False),
    Column("explanation", Text),
)

text_question_configs = Table(
    "text_question_configs",
    java_metadata,
    Column("text_question_config_id", BigInteger, primary_key=True),
    Column("question_id", BigInteger, nullable=False),
    Column("correct_answer", Text, nullable=False),
    Column("checking_method", String(30), nullable=False),
    Column("accepted_variations", Text),
)

programming_question_configs = Table(
    "programming_question_configs",
    java_metadata,
    Column("programming_question_config_id", BigInteger, primary_key=True),
    Column("question_id", BigInteger, nullable=False),
    Column("starter_code", Text),
)

programming_test_cases = Table(
    "programming_test_cases",
    java_metadata,
    Column("programming_test_case_id", BigInteger, primary_key=True),
    Column("programming_question_config_id", BigInteger, nullable=False),
    Column("input_data", Text, nullable=False),
    Column("expected_output", Text, nullable=False),
    Column("is_sample", Boolean, nullable=False),
)

diagram_question_configs = Table(
    "diagram_question_configs",
    java_metadata,
    Column("diagram_question_config_id", BigInteger, primary_key=True),
    Column("question_id", BigInteger, nullable=False),
    Column("diagram_type", String(30), nullable=False),
    Column("instructions", Text),
    # Both NOT NULL in Java's schema, but the generator produces neither --
    # it emits only diagram_type and instructions. Written empty so an
    # approved diagram question is not silently dropped; auto-grading such a
    # question is not possible until a reference diagram is supplied.
    Column("reference_diagram_xml", Text, nullable=False),
    Column("reference_diagram_json", JSONB, nullable=False),
)

exam_questions = Table(
    "exam_questions",
    java_metadata,
    Column("exam_question_id", BigInteger, primary_key=True),
    Column("exam_id", BigInteger, nullable=False),
    Column("question_id", BigInteger, nullable=False),
    Column("display_order", Integer, nullable=False),
    Column("points", Numeric(5, 2)),
)

assessment_attempts = Table(
    "assessment_attempts",
    java_metadata,
    Column("assessment_attempt_id", BigInteger, primary_key=True),
    Column("exam_id", BigInteger, nullable=False),
    Column("learner_id", BigInteger, nullable=False),
    Column("attempt_number", Integer, nullable=False),
    Column("status", String(20), nullable=False),
    Column("percentage", Numeric(5, 2)),
    Column("passed", Boolean),
    Column("total_points", Numeric(8, 2)),
    Column("earned_points", Numeric(8, 2)),
)

notifications = Table(
    "notifications",
    java_metadata,
    Column("notification_id", BigInteger, primary_key=True),
    Column("user_id", BigInteger, nullable=False),
    Column("title", String(180), nullable=False),
    Column("body", Text, nullable=False),
    Column("href", String(240)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("read_at", DateTime(timezone=True)),
)

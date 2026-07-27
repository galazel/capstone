"""Add workflow_runs / workflow_events registry.

LangGraph's checkpointer stores run *state* keyed by thread_id but cannot
answer "which runs exist and which are waiting for a human?". Without that,
a HITL pause is invisible -- the run sits at PROCESSING and no admin can
discover it or reach the resume endpoint.

workflow_events is append-only and carries a per-run monotonic `seq`, so it
also serves as the WebSocket replay log for the generation workspace.

Revision ID: 20260726_0004
Revises: 20260726_0003
Create Date: 2026-07-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_0004"
down_revision: Union[str, None] = "20260726_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_runs",
        sa.Column("run_id", sa.String(36), primary_key=True),
        sa.Column("thread_id", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("certification_id", sa.BigInteger(), nullable=True),
        sa.Column("generation_request_id", sa.BigInteger(), nullable=True),
        sa.Column("triggered_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("current_stage", sa.String(64), nullable=True),
        sa.Column("progress_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("thread_id", name="uq_workflow_runs_thread"),
    )
    op.create_index("ix_workflow_runs_thread_id", "workflow_runs", ["thread_id"])
    op.create_index("ix_workflow_runs_certification_id", "workflow_runs", ["certification_id"])
    op.create_index("ix_workflow_runs_generation_request_id", "workflow_runs", ["generation_request_id"])
    op.create_index("ix_workflow_runs_status", "workflow_runs", ["status"])
    # Backs the dashboard's default query: newest runs in a given status.
    op.create_index("ix_workflow_runs_status_started", "workflow_runs", ["status", "started_at"])

    op.create_table(
        "workflow_events",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("stage", sa.String(64), nullable=True),
        sa.Column("task_status", sa.String(32), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["workflow_runs.run_id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "seq", name="uq_workflow_events_run_seq"),
    )
    # Backs replay-from-last_seq.
    op.create_index("ix_workflow_events_run_seq", "workflow_events", ["run_id", "seq"])


def downgrade() -> None:
    op.drop_index("ix_workflow_events_run_seq", table_name="workflow_events")
    op.drop_table("workflow_events")
    for index in (
        "ix_workflow_runs_status_started",
        "ix_workflow_runs_status",
        "ix_workflow_runs_generation_request_id",
        "ix_workflow_runs_certification_id",
        "ix_workflow_runs_thread_id",
    ):
        op.drop_index(index, table_name="workflow_runs")
    op.drop_table("workflow_runs")

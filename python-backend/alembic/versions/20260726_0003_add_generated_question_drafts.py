"""Add generated_question_drafts table for the async question-bank consumer.

Revision ID: 20260726_0003
Revises: 20260712_0002
Create Date: 2026-07-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_0003"
down_revision: Union[str, None] = "20260712_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generated_question_drafts",
        sa.Column("generated_question_draft_id", sa.String(36), primary_key=True),
        sa.Column("generation_request_id", sa.BigInteger(), nullable=False),
        sa.Column("certification_id", sa.BigInteger(), nullable=False),
        sa.Column("thread_id", sa.String(36), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("generated_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("generation_request_id", name="uq_generated_question_drafts_request"),
    )
    op.create_index(
        "ix_generated_question_drafts_certification",
        "generated_question_drafts",
        ["certification_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_generated_question_drafts_certification", table_name="generated_question_drafts")
    op.drop_table("generated_question_drafts")

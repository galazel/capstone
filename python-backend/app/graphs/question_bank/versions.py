"""Batch version history for the question-bank graph.

Mirrors the certification graph: the batch itself goes to `workflow_events`,
and only a lightweight reference stays in graph state. Holding each version's
full question list in state meant every improve/regenerate cycle grew a blob
that LangGraph re-serialized into every subsequent checkpoint.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

BATCH_KEY_PREFIX = "QUESTION_BATCH"


def record_batch_version(
    state: dict,
    *,
    questions: list[dict],
    source: str,
    instructions: str | None = None,
) -> list[dict]:
    """Writes one batch version to the event log; returns the ref to append."""
    # Batches are numbered by how many have already been committed, so an
    # improve/regenerate cycle keeps revising the same batch number.
    batch_number = (state.get("generated_count", 0) or 0) // max(state.get("batch_size", 20), 1)
    key = f"{BATCH_KEY_PREFIX}:{batch_number}"
    existing = state.get("version_refs") or []
    revision = sum(1 for v in existing if v.get("key") == key) + 1

    thread_id = state.get("thread_id")
    if thread_id:
        from app.db.session import SessionLocal
        from app.services import workflow_registry as registry

        try:
            with SessionLocal() as session:
                ref = registry.record_artifact_version(
                    session,
                    thread_id,
                    key=key,
                    revision=revision,
                    source=source,
                    artifact={"questions": questions},
                    instructions=instructions,
                )
            if ref is not None:
                return [ref]
        except Exception:
            # An audit aid must never fail the generation it describes.
            logger.exception("Failed to record batch version %s r%d", key, revision)

    return [{
        "key": key,
        "revision": revision,
        "source": source,
        "instructions": instructions,
        "event_seq": None,
    }]

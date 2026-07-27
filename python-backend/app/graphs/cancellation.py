"""Cooperative workflow cancellation.

There is no way to abort a LangGraph run from outside: `ainvoke` owns the
event loop until it returns or interrupts. So cancellation is cooperative --
the workspace marks the run CANCELLED in the registry, and the graph checks
that flag at its own boundaries and routes to END.

Two cases, with genuinely different timing:

*Paused at an interrupt* -- the run is not executing at all, so marking it
cancelled is immediately effective. The API refuses to resume it, and it is
simply never resumed. Nothing further runs.

*Mid-node* -- an in-flight LLM call cannot be interrupted. The check happens
in each phase's gate node, which runs between items, so a cancel during
lesson 3 of 20 takes effect before lesson 4 rather than instantly. The
per-item loop is what makes this bound tight; a fan-out design would have had
to wait for the whole batch.

Deliberately fail-open: if the registry is unreachable, generation continues.
A cancel that arrives late is recoverable; a run killed by a transient
database blip is not.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def is_cancel_requested(thread_id: str | None) -> bool:
    """True when this run has been marked cancelled in the registry."""
    if not thread_id:
        return False

    from app.db.session import SessionLocal
    from app.services import workflow_registry as registry

    try:
        with SessionLocal() as session:
            run = registry.get_run_by_thread(session, thread_id)
            return run is not None and run.status == registry.CANCELLED
    except Exception:
        logger.exception(
            "Cancellation check failed for thread %s; continuing generation", thread_id
        )
        return False

"""Cooperative workflow cancellation.

There is no way to abort a LangGraph run from outside: `ainvoke` owns the
event loop until it returns or interrupts. So cancellation is cooperative --
the workspace marks the run CANCELLED in the registry, and the graph checks
that flag at its own boundaries and routes to END.

Two cases, with genuinely different timing:

*Paused at an interrupt* -- the run is not executing at all, so marking it
cancelled is immediately effective. The API refuses to resume it, and it is
simply never resumed. Nothing further runs.

*Mid-node* -- an in-flight LLM call cannot be interrupted, so the check
happens *between* nodes: `app.graphs.instrumentation` tests the flag before
running each one. A cancel during lesson 3 of 20 therefore takes effect before
lesson 4 rather than instantly.

That check used to live only in the review-loop gate nodes, which meant it
covered the per-item phases and nothing else. Cancelling during document
validation, ingestion, curriculum planning, or the diagnostic and mock exams
did nothing at all: the registry said CANCELLED while the run carried on for
another two minutes and then parked itself at a review. Putting it in the
instrumentation wrapper covers every node by construction, including nodes
added later.

Deliberately fail-open: if the registry is unreachable, generation continues.
A cancel that arrives late is recoverable; a run killed by a transient
database blip is not.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class RunCancelled(Exception):
    """Raised between nodes when the reviewer has cancelled the run.

    Not an error: the run is already CANCELLED in the registry, and the graph
    is unwinding on purpose. `certification_run.advance` catches it and leaves
    the status alone rather than overwriting it with FAILED -- a cancelled run
    that reports "failed" reads as a bug in the generator and invites a retry
    of work the reviewer just stopped.
    """

    def __init__(self, stage: str | None = None) -> None:
        super().__init__(f"Run cancelled before {stage or 'the next step'}.")
        self.stage = stage


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

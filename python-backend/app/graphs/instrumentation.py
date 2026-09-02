"""Node-level progress events.

The registry schema has carried `node.started` / `node.completed` with durations
and retry counts since step 14, but nothing emitted them: the only events on a
run were the coarse workflow/review transitions. That was enough for a "which
runs are waiting for me" list and not enough for a live timeline -- a twenty-
lesson certification would sit on `workflow.started` for many minutes with
nothing to show, which is exactly the loading-spinner experience the workspace
exists to replace.

`instrument` wraps a node so the timeline gets a task entry with real timing.

Two deliberate limits:

*Not every node.* Gate and advance nodes are bookkeeping no-ops, and review
nodes already emit `review.waiting`. Wrapping those would triple the event
volume and bury the events a human actually reads.

*Never fails the node.* Emitting is best-effort in both directions: a registry
write failure must not fail generation that otherwise succeeded, and a node's
own exception is recorded and re-raised unchanged rather than being swallowed.
"""

from __future__ import annotations

import functools
import inspect
import logging
import time
from typing import Any, Callable

from app.graphs.certification.state import curriculum_totals

logger = logging.getLogger(__name__)


def _emit(
    thread_id: str | None,
    event_type: str,
    *,
    stage: str,
    task_status: str,
    duration_ms: int | None = None,
    payload: dict | None = None,
) -> None:
    if not thread_id:
        return

    from app.db.session import SessionLocal
    from app.services import workflow_registry as registry

    try:
        with SessionLocal() as session:
            run = registry.get_run_by_thread(session, thread_id)
            if run is None:
                return

            # Keep the run row pointing at the node actually executing.
            #
            # Events carried the stage and the row did not, so `current_stage`
            # held whatever last set it explicitly -- a review submission, or a
            # retry, which sets it to the step being retried. A run retried at
            # plan_curriculum therefore reported "Planning the curriculum" for
            # the rest of its life, and the certification card says exactly
            # that while the live view shows lesson 8 of 28.
            #
            # Only on node start: the completion event fires as the node ends,
            # and taking the stage from that would leave the row naming a step
            # that has already finished.
            if event_type == registry.EVT_NODE_STARTED and run.current_stage != stage:
                run.current_stage = stage

            event = registry.record_event(
                session,
                run,
                event_type,
                stage=stage,
                task_status=task_status,
                duration_ms=duration_ms,
                payload=payload,
            )
            session.commit()
            # Published only after the commit: broadcasting first would push an
            # event to live clients that a rollback then erased, and a client
            # cannot un-render what it has already drawn.
            registry.publish_event(run.run_id, event)
    except Exception:
        logger.debug("Could not emit %s for stage %s", event_type, stage, exc_info=True)


#: Per-item loop stages, mapped to the state cursor and the plan total that
#: bound them. Anything absent is a once-per-run node with no "of N".
_LOOP_PHASES = {
    "MAJOR": ("major_cursor", "majors"),
    "MIDDLE": ("middle_cursor", "middles"),
    "LESSON": ("lesson_cursor", "lessons"),
}


def _progress_context(state: dict, stage: str, result: Any = None) -> dict | None:
    """Where this node sits in the run: which item of how many, out of what plan.

    This is what turns "generating lessons" into "lesson 3 of 20" in the
    timeline, and what gives the client a denominator to draw a progress bar
    against -- the difference between a progress indicator and a spinner with
    words on it.

    `plan` rides on every event rather than being announced once, because a
    client that reconnects mid-run replays from a cursor and may never see the
    announcement. It is a few integers; the alternative is a bar that is
    indeterminate for whichever clients joined late.

    `result` is consulted first so the curriculum node's own completion already
    carries the plan it just produced -- the wrapper only ever sees the state
    from *before* the node ran, where there is no curriculum yet.
    """
    context: dict = {}

    curriculum = result.get("curriculum") if isinstance(result, dict) else None
    totals = curriculum_totals(curriculum or state.get("curriculum"))
    if totals["lessons"]:
        context["plan"] = totals

    phase = _LOOP_PHASES.get(stage.split("_")[0].upper())
    if phase is not None:
        cursor_key, total_key = phase
        index = state.get(cursor_key) or 0
        context.update({"item_index": index, "item_number": index + 1})
        if totals[total_key]:
            context["item_total"] = totals[total_key]

    return context or None


def _halt_if_cancelled(thread_id: str | None, stage: str) -> None:
    """Stops the graph at a node boundary once a reviewer has cancelled.

    Raising unwinds `ainvoke` and leaves the checkpoint where it is, so a
    cancelled run stops without losing the work already approved. Deliberately
    *before* the node-started event: emitting one for a node that never runs
    would leave a task showing as permanently in-progress on the timeline.
    """
    from app.graphs.cancellation import RunCancelled, is_cancel_requested

    if is_cancel_requested(thread_id):
        logger.info("Halting run %s before %s: cancelled by a reviewer", thread_id, stage)
        raise RunCancelled(stage)


def instrument(node: Callable, stage: str) -> Callable:
    """Wraps `node` so it reports its own start, duration, and outcome.

    Preserves sync/async: LangGraph inspects the callable, so turning a sync
    node into a coroutine here would change how the graph schedules it.
    """
    from app.services import workflow_registry as registry

    if inspect.iscoroutinefunction(node):

        @functools.wraps(node)
        async def async_wrapper(state: dict, *args: Any, **kwargs: Any):
            thread_id = state.get("thread_id")
            # Between-node cancellation check. An in-flight LLM call cannot be
            # aborted, so this boundary is the tightest bound available -- and
            # it belongs here rather than in individual nodes, which is how
            # cancelling during document validation used to do nothing.
            _halt_if_cancelled(thread_id, stage)
            _emit(
                thread_id, registry.EVT_NODE_STARTED, stage=stage,
                task_status=registry.TASK_RUNNING, payload=_progress_context(state, stage),
            )
            started = time.monotonic()
            try:
                result = await node(state, *args, **kwargs)
            except Exception as error:
                _emit(
                    thread_id, registry.EVT_NODE_COMPLETED, stage=stage,
                    task_status=registry.TASK_FAILED,
                    duration_ms=int((time.monotonic() - started) * 1000),
                    payload={"error": str(error)},
                )
                raise
            _emit(
                thread_id, registry.EVT_NODE_COMPLETED, stage=stage,
                task_status=registry.TASK_COMPLETED,
                duration_ms=int((time.monotonic() - started) * 1000),
                payload=_progress_context(state, stage, result),
            )
            return result

        return async_wrapper

    @functools.wraps(node)
    def sync_wrapper(state: dict, *args: Any, **kwargs: Any):
        thread_id = state.get("thread_id")
        _halt_if_cancelled(thread_id, stage)
        _emit(
            thread_id, registry.EVT_NODE_STARTED, stage=stage,
            task_status=registry.TASK_RUNNING, payload=_progress_context(state, stage),
        )
        started = time.monotonic()
        try:
            result = node(state, *args, **kwargs)
        except Exception as error:
            _emit(
                thread_id, registry.EVT_NODE_COMPLETED, stage=stage,
                task_status=registry.TASK_FAILED,
                duration_ms=int((time.monotonic() - started) * 1000),
                payload={"error": str(error)},
            )
            raise
        _emit(
            thread_id, registry.EVT_NODE_COMPLETED, stage=stage,
            task_status=registry.TASK_COMPLETED,
            duration_ms=int((time.monotonic() - started) * 1000),
            payload=_progress_context(state, stage, result),
        )
        return result

    return sync_wrapper

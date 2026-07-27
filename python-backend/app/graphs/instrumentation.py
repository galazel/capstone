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


def _item_context(state: dict, stage: str) -> dict | None:
    """Which item of how many, when the node is inside a per-item loop.

    This is what turns "generating lessons" into "lesson 3 of 20" in the
    timeline, which is the difference between a progress indicator and a
    spinner with words on it.
    """
    cursor_key = {
        "MAJOR": "major_cursor",
        "MIDDLE": "middle_cursor",
        "LESSON": "lesson_cursor",
    }.get(stage.split("_")[0].upper())

    if cursor_key is None:
        return None
    index = state.get(cursor_key) or 0
    return {"item_index": index, "item_number": index + 1}


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
            _emit(
                thread_id, registry.EVT_NODE_STARTED, stage=stage,
                task_status=registry.TASK_RUNNING, payload=_item_context(state, stage),
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
                payload=_item_context(state, stage),
            )
            return result

        return async_wrapper

    @functools.wraps(node)
    def sync_wrapper(state: dict, *args: Any, **kwargs: Any):
        thread_id = state.get("thread_id")
        _emit(
            thread_id, registry.EVT_NODE_STARTED, stage=stage,
            task_status=registry.TASK_RUNNING, payload=_item_context(state, stage),
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
            payload=_item_context(state, stage),
        )
        return result

    return sync_wrapper

"""A redelivered generation message must not destroy the run's work.

Written after 2026-08-31, when a certification generation restarted three
times and left an empty certification each time. Two independent defects had
to line up for that, and each is pinned separately below:

1. The queue handler always passed the full seed to `execute`, which re-enters
   the graph at the first node instead of resuming -- so a redelivery paid
   again for every document ingestion, curriculum plan and lesson.

2. `execute` rescued partial output on `Exception`, but a broker timeout
   cancels the task, and `asyncio.CancelledError` is a BaseException. The
   rescue was skipped entirely and the generated work died with the task.
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import certification_run


class _StubGraph:
    """Records what `ainvoke` was handed, and optionally cancels."""

    def __init__(self, *, cancel: bool = False):
        self.invoked_with = "<not called>"
        self._cancel = cancel

    async def ainvoke(self, graph_input, config=None):
        self.invoked_with = graph_input
        if self._cancel:
            raise asyncio.CancelledError()
        return {"status": "COMPLETED"}


@pytest.fixture
def context():
    return certification_run.RunContext(
        thread_id="1",
        certification_title="IT Passport",
        certification_id=1,
        generation_request_id=1,
        triggered_by_user_id=None,
    )


async def test_cancellation_saves_what_was_generated(monkeypatch, context):
    """The defect that emptied the certification.

    A cancelled run must flush its output before the exception propagates.
    """
    graph = _StubGraph(cancel=True)
    monkeypatch.setattr(certification_run, "get_certification_graph", lambda: _async(graph))

    rescued: list = []

    async def _rescue(ctx):
        rescued.append(ctx.thread_id)
        return {"saved": True}

    monkeypatch.setattr(certification_run, "rescue_partial_output", _rescue)

    with pytest.raises(asyncio.CancelledError):
        await certification_run.execute(context, {"status": "STARTED"})

    assert rescued == ["1"], "a cancelled run must still save its output"


async def test_cancellation_still_propagates(monkeypatch, context):
    """Rescuing must not swallow the cancellation."""
    graph = _StubGraph(cancel=True)
    monkeypatch.setattr(certification_run, "get_certification_graph", lambda: _async(graph))

    async def _rescue(ctx):
        return {"saved": True}

    monkeypatch.setattr(certification_run, "rescue_partial_output", _rescue)

    with pytest.raises(asyncio.CancelledError):
        await certification_run.execute(context, {"status": "STARTED"})


async def test_a_failing_rescue_does_not_mask_the_cancellation(monkeypatch, context):
    """Cancellation still wins even if saving blows up."""
    graph = _StubGraph(cancel=True)
    monkeypatch.setattr(certification_run, "get_certification_graph", lambda: _async(graph))

    async def _boom(ctx):
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(certification_run, "rescue_partial_output", _boom)

    with pytest.raises(asyncio.CancelledError):
        await certification_run.execute(context, {"status": "STARTED"})


async def test_has_progress_is_false_when_the_checkpointer_is_unreadable(monkeypatch):
    """Conservative on failure: seed rather than resume into nothing."""

    async def _boom(thread_id):
        raise RuntimeError("checkpointer down")

    monkeypatch.setattr(certification_run, "_snapshot_values", _boom)

    assert await certification_run.has_progress("1") is False


async def test_has_progress_reports_existing_work(monkeypatch):
    async def _values(thread_id):
        return {"curriculum": {"majorCategories": [{"title": "M"}]}}

    monkeypatch.setattr(certification_run, "_snapshot_values", _values)

    assert await certification_run.has_progress("1") is True


async def test_has_progress_is_false_for_a_brand_new_thread(monkeypatch):
    async def _empty(thread_id):
        return {}

    monkeypatch.setattr(certification_run, "_snapshot_values", _empty)

    assert await certification_run.has_progress("1") is False


async def _async(value):
    return value

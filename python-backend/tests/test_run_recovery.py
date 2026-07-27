"""Retry and restart for a failed certification run.

Before these, a failed run was a dead end. Re-publishing the queue message
did not help: the message reuses `thread_id = str(generation_request_id)`, so
LangGraph picks the existing checkpoint back up and lands on the same failed
step with the same inputs.

Retry re-runs only the pending (failed) step, keeping everything the run has
already produced. Restart discards the checkpoints and begins again.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import certification_run
from app.services import workflow_registry as registry


@pytest.fixture()
def session(db):
    return db


def _failed_run(session, thread_id="t-fail", *, stage="plan_curriculum", **kwargs):
    """A run that started, failed inside a node, and was marked FAILED --
    the exact shape the curriculum tool-call failure leaves behind."""
    run = registry.start_run(session, thread_id=thread_id, kind="CERTIFICATION", **kwargs)
    registry.record_event(
        session, run, registry.EVT_NODE_STARTED,
        stage=stage, task_status=registry.TASK_RUNNING,
    )
    registry.record_event(
        session, run, registry.EVT_NODE_COMPLETED,
        stage=stage, task_status=registry.TASK_FAILED, payload={"error": "boom"},
    )
    session.commit()
    registry.mark_failed(session, thread_id, error="Curriculum generation failed.")
    return run


# --- registry transitions -------------------------------------------------

def test_failed_run_reports_the_stage_it_died_on(session):
    """`current_stage` cannot answer this: node instrumentation records the
    failing node, but only review transitions move `current_stage`."""
    run = _failed_run(session, stage="plan_curriculum")
    assert registry.last_failed_stage(session, run.run_id) == "plan_curriculum"


def test_last_failed_stage_is_none_for_a_healthy_run(session):
    run = registry.start_run(session, thread_id="t-ok", kind="CERTIFICATION")
    assert registry.last_failed_stage(session, run.run_id) is None


def test_retry_clears_the_error_and_returns_the_run_to_running(session):
    run = _failed_run(session)
    assert run.error_message

    registry.mark_retrying(session, "t-fail", stage="plan_curriculum", attempt=1)

    run = registry.get_run_by_thread(session, "t-fail")
    assert run.status == registry.RUNNING
    assert run.error_message is None, "a run that is executing must not still read as failed"
    assert run.completed_at is None, "the dead attempt's completion time must not survive"

    last = registry.list_events(session, run.run_id)[-1]
    assert last.event_type == registry.EVT_WORKFLOW_RETRIED
    assert last.task_status == registry.TASK_RETRYING
    assert last.retry_count == 1


def test_restart_resets_progress_and_stage(session):
    run = _failed_run(session)
    registry.mark_waiting_for_review(session, "t-fail", stage="CURRICULUM")
    registry.mark_failed(session, "t-fail", error="died later")

    registry.mark_restarted(session, "t-fail", attempt=1)

    run = registry.get_run_by_thread(session, "t-fail")
    assert run.status == registry.RUNNING
    assert run.progress_pct == 0
    assert run.current_stage is None, "restarting from step one keeps no stage from the old attempt"
    assert run.error_message is None


def test_attempt_number_counts_fresh_starts_not_retries(session):
    """A retry repairs the attempt it is part of; only a restart begins a new
    one. The workspace timeline segments on the same boundary, so the two must
    agree on what "attempt 2" means."""
    run = _failed_run(session)
    assert registry.attempt_number(session, run.run_id) == 1

    registry.mark_retrying(session, "t-fail", stage="plan_curriculum", attempt=1)
    registry.mark_failed(session, "t-fail", error="again")
    assert registry.attempt_number(session, run.run_id) == 1, "a retry is not a new attempt"

    registry.mark_restarted(session, "t-fail", attempt=2)
    assert registry.attempt_number(session, run.run_id) == 2


# --- guards ---------------------------------------------------------------

@pytest.mark.parametrize(
    "status", [registry.RUNNING, registry.WAITING_FOR_REVIEW, registry.COMPLETED]
)
def test_only_failed_runs_are_recoverable(status):
    """A RUNNING run is either genuinely executing or orphaned by a process
    restart, and the registry cannot tell those apart -- recovering it would
    risk two workers driving one thread."""
    assert status not in certification_run.RECOVERABLE_STATUSES


def test_failed_is_recoverable():
    assert registry.FAILED in certification_run.RECOVERABLE_STATUSES


async def test_cancelled_run_cannot_be_retried():
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.CANCELLED
    )
    with pytest.raises(certification_run.RecoveryError, match="cancelled"):
        await certification_run.prepare_retry(run)


async def test_question_bank_run_cannot_be_retried_through_this_path():
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="QUESTION_BANK", status=registry.FAILED
    )
    with pytest.raises(certification_run.RecoveryError, match="not a certification run"):
        await certification_run.prepare_retry(run)


async def test_completed_run_cannot_be_restarted():
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.COMPLETED
    )
    with pytest.raises(certification_run.RecoveryError, match="Only failed runs"):
        await certification_run.prepare_restart(run)


# --- retry targets the pending step --------------------------------------

class _Snapshot:
    def __init__(self, values, next_):
        self.values = values
        self.next = next_


class _FakeGraph:
    """Stands in for the compiled graph. `ainvoke` records what it was
    handed, which is the whole point: a retry must pass None."""

    def __init__(self, snapshot):
        self._snapshot = snapshot
        self.invoked_with = []

    async def aget_state(self, config):
        return self._snapshot

    async def ainvoke(self, graph_input, config=None):
        self.invoked_with.append(graph_input)
        return {"status": "CURRICULUM_CREATED", "curriculum": {"majorCategories": [{"name": "M"}]}}


@pytest.fixture()
def fake_graph(monkeypatch):
    def install(snapshot):
        graph = _FakeGraph(snapshot)

        async def _get():
            return graph

        monkeypatch.setattr(certification_run, "get_certification_graph", _get)
        return graph

    return install


async def test_retry_reports_the_pending_step(fake_graph):
    """The step LangGraph will re-run is the one still pending on the thread,
    which is what the workspace labels the button with."""
    fake_graph(_Snapshot({"certification_name": "TOPCIT"}, ("plan_curriculum",)))
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.FAILED,
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
    )

    _, pending = await certification_run.prepare_retry(run)
    assert pending == "plan_curriculum"


async def test_retry_refuses_when_nothing_is_pending(fake_graph):
    """Resuming such a thread would run it from wherever it happens to be
    rather than re-running the failed step -- not what Retry promises."""
    fake_graph(_Snapshot({"certification_name": "TOPCIT"}, ()))
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.FAILED,
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
    )

    with pytest.raises(certification_run.RecoveryError, match="no pending step"):
        await certification_run.prepare_retry(run)


async def test_retry_refuses_when_there_is_no_checkpoint(fake_graph):
    fake_graph(_Snapshot({}, ()))
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.FAILED,
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
    )

    with pytest.raises(certification_run.RecoveryError, match="no checkpoint"):
        await certification_run.prepare_retry(run)


async def test_retry_resumes_with_none_so_only_the_failed_step_reruns(fake_graph, monkeypatch):
    """The behaviour the whole feature rests on: `ainvoke(None)` re-executes
    the pending node, so a 2.5-minute ingestion is not repeated to retry the
    40-second curriculum call that failed after it."""
    graph = fake_graph(_Snapshot({"certification_name": "TOPCIT"}, ("plan_curriculum",)))
    monkeypatch.setattr(certification_run, "finalize", lambda context, result: {"outcome": "X"})

    context = certification_run.RunContext(thread_id="t1", certification_title="TOPCIT")
    await certification_run.run_retry(context)

    assert graph.invoked_with == [None]


# --- restart rebuilds inputs ---------------------------------------------

async def test_restart_refuses_a_direct_upload_run_whose_bytes_are_gone(fake_graph):
    """`uploaded_files` is cleared once ingested, so a run past that point no
    longer carries its own documents. Restarting anyway would quietly build a
    curriculum from the title alone."""
    fake_graph(_Snapshot({"certification_name": "TOPCIT", "uploaded_files": []}, ()))
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.FAILED,
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
    )

    with pytest.raises(certification_run.RecoveryError, match="no longer held"):
        await certification_run.prepare_restart(run)


async def test_restart_rebuilds_the_seed_from_a_surviving_checkpoint(fake_graph):
    fake_graph(
        _Snapshot(
            {
                "certification_name": "TOPCIT",
                "certification_description": "IT competency",
                "industry": "IT",
                "document_refs": [{"s3_key": "k", "filename": "f.pdf", "content_type": "application/pdf"}],
                "curriculum": {"majorCategories": [{"name": "stale"}]},
            },
            (),
        )
    )
    run = SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION", status=registry.FAILED,
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
    )

    _, seed = await certification_run.prepare_restart(run)

    assert seed["status"] == "STARTED"
    assert seed["certification_name"] == "TOPCIT"
    assert seed["document_refs"][0]["s3_key"] == "k"
    assert "curriculum" not in seed, "a restart must not carry the failed attempt's output forward"


# --- endpoints ------------------------------------------------------------

@pytest.fixture()
def routes():
    from app.api.routes import workflows as workflow_routes

    return workflow_routes


def _background():
    from fastapi import BackgroundTasks

    return BackgroundTasks()


async def test_retry_endpoint_marks_retrying_and_queues_the_work(session, routes, monkeypatch):
    """Accepted, not awaited: the run continues to the next review pause,
    which takes minutes. Progress arrives on the event stream."""
    run = _failed_run(session, "t-http")

    async def _prepare(_run):
        return certification_run.RunContext(thread_id="t-http", certification_title="TOPCIT"), "plan_curriculum"

    monkeypatch.setattr(certification_run, "prepare_retry", _prepare)

    background = _background()
    result = await routes.retry_workflow_run(run.run_id, background, db=session)

    assert result["retrying"] is True
    assert result["retrying_stage"] == "plan_curriculum"
    assert result["attempt"] == 1
    assert result["status"] == registry.RUNNING
    assert len(background.tasks) == 1, "the graph run must be queued, not awaited in the request"

    assert registry.list_events(session, run.run_id)[-1].event_type == registry.EVT_WORKFLOW_RETRIED


async def test_restart_endpoint_marks_restarted_and_queues_the_work(session, routes, monkeypatch):
    run = _failed_run(session, "t-http2")

    async def _prepare(_run):
        return (
            certification_run.RunContext(thread_id="t-http2", certification_title="TOPCIT"),
            {"thread_id": "t-http2", "status": "STARTED"},
        )

    monkeypatch.setattr(certification_run, "prepare_restart", _prepare)

    background = _background()
    result = await routes.restart_workflow_run(run.run_id, background, db=session)

    assert result["restarting"] is True
    assert result["progress_pct"] == 0
    assert len(background.tasks) == 1
    assert registry.list_events(session, run.run_id)[-1].event_type == registry.EVT_WORKFLOW_RESTARTED


async def test_a_refused_recovery_is_a_conflict_not_a_server_error(session, routes, monkeypatch):
    """The reason is the admin's to act on -- "restart it instead", "re-upload
    the documents" -- so it must reach them, not become a 500."""
    from fastapi import HTTPException

    run = _failed_run(session, "t-http3")

    async def _prepare(_run):
        raise certification_run.RecoveryError("no pending step to retry")

    monkeypatch.setattr(certification_run, "prepare_retry", _prepare)

    with pytest.raises(HTTPException) as caught:
        await routes.retry_workflow_run(run.run_id, _background(), db=session)

    assert caught.value.status_code == 409
    assert "no pending step" in caught.value.detail
    assert registry.get_run_by_thread(session, "t-http3").status == registry.FAILED, (
        "a refused retry must leave the run failed, not half-transitioned"
    )


async def test_retrying_an_unknown_run_is_a_404(session, routes):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as caught:
        await routes.retry_workflow_run("nope", _background(), db=session)
    assert caught.value.status_code == 404


def test_run_detail_advertises_recovery(session, routes):
    """So the workspace can render Retry/Restart and label the retry with the
    step it would re-run, without a second round trip."""
    run = _failed_run(session, "t-detail", stage="plan_curriculum")

    detail = routes.get_workflow_run(run.run_id, after_seq=0, db=session)

    assert detail["recovery"] == {
        "can_retry": True,
        "can_restart": True,
        "failed_stage": "plan_curriculum",
        "attempt": 1,
    }


def test_a_healthy_run_advertises_no_recovery(session, routes):
    registry.start_run(session, thread_id="t-live", kind="CERTIFICATION")
    run = registry.get_run_by_thread(session, "t-live")

    recovery = routes.get_workflow_run(run.run_id, after_seq=0, db=session)["recovery"]

    assert recovery["can_retry"] is False
    assert recovery["failed_stage"] is None


def test_document_refs_carry_pointers_not_bytes():
    """Embedding contents in the seed would put them in every checkpoint the
    restarted run writes from then on."""
    refs = certification_run.document_refs_from(
        [
            {"s3_key": "a", "original_filename": "a.pdf", "content_type": "application/pdf"},
            {"s3_key": None, "original_filename": "skipped.pdf", "content_type": "application/pdf"},
        ]
    )

    assert refs == [{"s3_key": "a", "filename": "a.pdf", "content_type": "application/pdf"}]

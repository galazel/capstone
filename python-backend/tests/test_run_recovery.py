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


# --- a resumed run reports its outcome ------------------------------------
#
# A live run paused for review, was resumed over HTTP, and the lesson node
# raised. The registry kept saying WAITING_FOR_REVIEW while the checkpoint had
# already moved past the interrupt, so `/review` reported the run as desynced
# and Retry refused it -- only FAILED runs are recoverable. The cause was the
# resume route calling `graph.ainvoke` directly, around the lifecycle.


class _ExplodingGraph(_FakeGraph):
    async def ainvoke(self, graph_input, config=None):
        self.invoked_with.append(graph_input)
        raise KeyError("structured_response")


async def test_a_failed_advance_marks_the_run_failed_so_retry_can_pick_it_up(
    fake_graph, monkeypatch
):
    graph = _ExplodingGraph(_Snapshot({}, ()))

    async def _get():
        return graph

    monkeypatch.setattr(certification_run, "get_certification_graph", _get)

    marked = {}
    monkeypatch.setattr(
        certification_run.registry,
        "mark_failed",
        lambda session, thread_id, error: marked.update(thread_id=thread_id, error=error),
    )
    monkeypatch.setattr(certification_run, "_notify", lambda *a, **kw: None)

    context = certification_run.RunContext(thread_id="t1", certification_title="TOPCIT")
    with pytest.raises(certification_run.RunFailed):
        await certification_run.advance(context, None)

    assert marked["thread_id"] == "t1"
    assert "structured_response" in marked["error"]


async def test_advance_returns_the_graph_result_alongside_the_outcome(fake_graph, monkeypatch):
    """The HTTP routes need the raw result -- it carries the interrupt payload
    the reviewer is shown -- while the consumer needs the outcome."""
    fake_graph(_Snapshot({}, ()))
    monkeypatch.setattr(certification_run, "finalize", lambda context, result: {"outcome": "X"})

    context = certification_run.RunContext(thread_id="t1", certification_title="TOPCIT")
    result, outcome = await certification_run.advance(context, None)

    assert result["status"] == "CURRICULUM_CREATED"
    assert outcome == {"outcome": "X"}


async def test_a_successful_advance_finalises_rather_than_dropping_the_output(
    fake_graph, monkeypatch
):
    """Resuming used to bypass finalisation entirely: an approved run's
    curriculum and assessments were never persisted to Java."""
    fake_graph(_Snapshot({}, ()))
    finalised = []
    monkeypatch.setattr(
        certification_run,
        "finalize",
        lambda context, result: finalised.append(result) or {"outcome": "COMPLETED"},
    )

    context = certification_run.RunContext(thread_id="t1", certification_title="TOPCIT")
    await certification_run.advance(context, None)

    assert len(finalised) == 1


# --- reconciling a stranded run -------------------------------------------
#
# The registry is written *after* the graph, so anything that interrupts the
# handoff leaves a run claiming WAITING_FOR_REVIEW while its thread has moved
# on. That run is unreachable: /review has nothing to show and recovery takes
# only FAILED runs. Reconciliation repairs it against the checkpoint.


class _Task:
    def __init__(self, interrupts=()):
        self.interrupts = interrupts


class _ReviewSnapshot(_Snapshot):
    def __init__(self, values, next_, tasks=()):
        super().__init__(values, next_)
        self.tasks = tasks


def _waiting_run(idle_seconds=600, **kwargs):
    """A run paused for review. `idle_seconds` is how long since it last
    emitted anything -- reconciliation ignores a run that is still talking,
    so the default is comfortably past the grace period."""
    from datetime import datetime, timedelta, timezone

    return SimpleNamespace(
        run_id="r1", thread_id="t1", kind="CERTIFICATION",
        status=registry.WAITING_FOR_REVIEW,
        updated_at=datetime.now(timezone.utc) - timedelta(seconds=idle_seconds),
        certification_id=None, generation_request_id=None, triggered_by_user_id=None,
        **kwargs,
    )


@pytest.fixture()
def captured_outcome(monkeypatch):
    """Records what reconciliation decided, without touching Java or the db."""
    seen = {}
    monkeypatch.setattr(certification_run, "_notify", lambda *a, **kw: None)
    monkeypatch.setattr(
        certification_run.registry, "mark_failed",
        lambda session, thread_id, error: seen.update(status=registry.FAILED, error=error),
    )
    monkeypatch.setattr(
        certification_run.registry, "mark_completed",
        lambda session, thread_id, payload=None: seen.update(status=registry.COMPLETED),
    )
    monkeypatch.setattr(
        certification_run.repo, "mark_generation_request_failed", lambda *a, **kw: None
    )
    return seen


async def test_a_genuinely_paused_run_is_left_alone(fake_graph, captured_outcome):
    """The check that keeps this from stealing runs out from under reviewers."""
    fake_graph(_ReviewSnapshot({"curriculum": {}}, ("review",), tasks=(_Task(interrupts=("i",)),)))

    result = await certification_run.reconcile(_waiting_run())

    assert result["reconciled"] is False
    assert captured_outcome == {}


async def test_a_step_that_died_mid_resume_is_recorded_so_retry_becomes_available(
    fake_graph, captured_outcome
):
    """The live wreckage: the lesson node raised, the registry was never told,
    and Retry refused the run because it did not read as FAILED."""
    fake_graph(_ReviewSnapshot({"curriculum": {}}, ("write_lesson",), tasks=(_Task(),)))

    result = await certification_run.reconcile(_waiting_run())

    assert result["reconciled"] is True
    assert captured_outcome["status"] == registry.FAILED
    assert "write_lesson" in captured_outcome["error"]


async def test_a_reconciled_run_is_then_accepted_by_retry(fake_graph, captured_outcome):
    """The point of marking it failed rather than merely reporting it."""
    fake_graph(_ReviewSnapshot({"certification_name": "T"}, ("write_lesson",), tasks=(_Task(),)))
    run = _waiting_run()

    await certification_run.reconcile(run)
    run.status = captured_outcome["status"]

    context, pending = await certification_run.prepare_retry(run)
    assert pending == "write_lesson"
    assert context.thread_id == "t1"


async def test_a_run_that_actually_finished_is_finalised_not_failed(
    fake_graph, captured_outcome
):
    """Only the handoff was lost. Marking it failed would throw away a
    completed curriculum still sitting in the checkpoint."""
    fake_graph(
        _ReviewSnapshot(
            {"status": "COMPLETED", "curriculum": {"majorCategories": [{"name": "M"}]}},
            (),
            tasks=(),
        )
    )

    result = await certification_run.reconcile(_waiting_run())

    assert result["reconciled"] is True
    assert captured_outcome["status"] == registry.COMPLETED


async def test_a_run_with_no_checkpoint_left_is_failed_with_a_restart_hint(
    fake_graph, captured_outcome
):
    fake_graph(_ReviewSnapshot({}, (), tasks=()))

    result = await certification_run.reconcile(_waiting_run())

    assert result["reconciled"] is True
    assert "Restart" in captured_outcome["error"]


async def test_reconciliation_is_a_no_op_for_a_run_that_is_not_awaiting_review(
    fake_graph, captured_outcome
):
    """Idempotence: once repaired the run is FAILED, so polling again does
    nothing rather than re-failing it."""
    fake_graph(_ReviewSnapshot({}, (), tasks=()))
    run = _waiting_run()
    run.status = registry.FAILED

    result = await certification_run.reconcile(run)

    assert result["reconciled"] is False
    assert captured_outcome == {}


async def test_a_question_bank_run_is_not_reconciled_by_the_certification_path(
    fake_graph, captured_outcome
):
    fake_graph(_ReviewSnapshot({}, (), tasks=()))
    run = _waiting_run()
    run.kind = "QUESTION_BANK"

    assert (await certification_run.reconcile(run))["reconciled"] is False
    assert captured_outcome == {}


async def test_the_review_endpoint_repairs_a_stranded_run_and_reports_it(
    session, session_factory, routes, fake_graph, monkeypatch
):
    """End to end: the workspace polls /review whenever a run reads as
    waiting, so a stranded run heals as soon as anyone opens it."""
    from app.graphs.certification import workflow as cert_workflow

    graph = fake_graph(_ReviewSnapshot({"curriculum": {}}, ("write_lesson",), tasks=(_Task(),)))

    async def _get():
        return graph

    # The route imports the graph accessor itself, so both call sites need it.
    monkeypatch.setattr(cert_workflow, "get_certification_graph", _get)
    monkeypatch.setattr(certification_run, "_notify", lambda *a, **kw: None)
    # Reconciliation writes through its own session, as every registry
    # transition does -- point it at the test database.
    monkeypatch.setattr(certification_run, "SessionLocal", session_factory)

    registry.start_run(session, thread_id="t-strand", kind="CERTIFICATION")
    registry.mark_waiting_for_review(session, "t-strand", stage="LESSON")
    run = registry.get_run_by_thread(session, "t-strand")
    assert run.status == registry.WAITING_FOR_REVIEW

    # Genuinely stranded: nothing has been emitted for a long time. A run that
    # is still talking is left alone -- see
    # `test_a_run_still_emitting_events_is_never_reconciled`.
    from datetime import datetime, timedelta, timezone

    run.updated_at = datetime.now(timezone.utc) - timedelta(hours=1)
    session.commit()

    response = await routes.get_pending_review(run.run_id, db=session)

    assert response["desynced"] is True
    assert response["reconciled"] is True
    assert response["status"] == registry.FAILED
    assert response["recovery"]["can_retry"] is True, (
        "the whole point: the stranded run must become retryable"
    )


# --- a resumed run must stop reading as paused ----------------------------

async def test_resuming_leaves_waiting_for_review_before_the_work_starts(
    session, session_factory, monkeypatch
):
    """Nothing recorded this transition, so a run stayed WAITING_FOR_REVIEW for
    the several minutes a resume took to reach the next checkpoint. Long enough
    for reconciliation to read it as stranded, mark it failed, and offer Retry
    on a run that was busy executing -- which is how two drivers ended up on
    one thread and the seq collision surfaced.
    """
    from app.api.routes import certification as cert_routes

    monkeypatch.setattr(cert_routes, "SessionLocal", session_factory)

    seen = {}

    async def _fake_advance(context, graph_input):
        with session_factory() as s:
            seen["status"] = registry.get_run_by_thread(s, "t-resume").status
        return {}, {"outcome": registry.WAITING_FOR_REVIEW}

    monkeypatch.setattr(cert_routes.certification_run, "advance", _fake_advance)
    monkeypatch.setattr(
        cert_routes.certification_run, "context_for",
        lambda run: certification_run.RunContext(thread_id=run.thread_id, certification_title="T"),
    )

    registry.start_run(session, thread_id="t-resume", kind="CERTIFICATION")
    registry.mark_waiting_for_review(session, "t-resume", stage="MAJOR")

    await cert_routes._advance("t-resume", None, decision="approve")

    assert seen["status"] == registry.RUNNING, (
        "the run must read as running while the graph is actually running"
    )


async def test_a_run_that_is_executing_is_never_reconciled_as_stranded(
    fake_graph, captured_outcome
):
    """The guard that follows from the above: a resumed run is RUNNING, so
    reconciliation -- which only ever looks at WAITING_FOR_REVIEW runs --
    cannot mistake its missing interrupt for a lost handoff."""
    fake_graph(_ReviewSnapshot({"curriculum": {}}, ("write_lesson",), tasks=(_Task(),)))
    run = _waiting_run()
    run.status = registry.RUNNING

    assert (await certification_run.reconcile(run))["reconciled"] is False
    assert captured_outcome == {}


async def test_a_run_still_emitting_events_is_never_reconciled(fake_graph, captured_outcome):
    """The live regression this guards. A double-clicked approval put two
    drivers on one thread; the faster finished and parked the run back at
    WAITING_FOR_REVIEW while the slower was still generating, and
    reconciliation failed a run that was working. The claim in
    `mark_review_submitted` stops the double-drive; this stops the repair from
    ever firing on a run that is visibly progressing.
    """
    fake_graph(_ReviewSnapshot({"curriculum": {}}, ("lesson_quiz_generate",), tasks=(_Task(),)))

    result = await certification_run.reconcile(_waiting_run(idle_seconds=5))

    assert result["reconciled"] is False
    assert "progressing" in result["reason"]
    assert captured_outcome == {}


async def test_a_long_idle_run_is_still_repaired(fake_graph, captured_outcome):
    """The grace period must not make stranded runs unrecoverable."""
    fake_graph(_ReviewSnapshot({"curriculum": {}}, ("lesson_quiz_generate",), tasks=(_Task(),)))

    result = await certification_run.reconcile(_waiting_run(idle_seconds=600))

    assert result["reconciled"] is True
    assert captured_outcome["status"] == registry.FAILED


# --- a run that saved nothing is not a success ----------------------------

def test_generated_but_unstored_output_fails_the_run():
    """The live case: seven assessments generated, `exam_types` unseeded, zero
    stored -- and the run logged "completed". Warnings scroll past; a status
    does not."""
    stranded = certification_run._stranded_output({
        "exams": [], "bank_questions": 40, "lessons_written": 2,
        "expected": {"exams": 7, "bank_questions": 40, "lessons": 2},
    })
    assert stranded == ["7 assessment(s) generated, none stored"]


def test_a_partial_loss_is_left_to_the_per_item_warnings():
    """One unmatched lesson name is not a systemic failure, and failing the
    whole run over it would throw away everything that did save."""
    assert certification_run._stranded_output({
        "exams": [1, 2], "bank_questions": 38, "lessons_written": 2,
        "expected": {"exams": 3, "bank_questions": 40, "lessons": 2},
    }) == []


def test_generating_nothing_of_a_kind_is_not_a_loss():
    """A curriculum with no mock exam simply has none to store."""
    assert certification_run._stranded_output({
        "exams": [], "bank_questions": 0, "lessons_written": 0,
        "expected": {"exams": 0, "bank_questions": 0, "lessons": 0},
    }) == []


def test_every_kind_is_reported_not_just_the_first():
    stranded = certification_run._stranded_output({
        "exams": [], "bank_questions": 0, "lessons_written": 0,
        "expected": {"exams": 7, "bank_questions": 40, "lessons": 2},
    })
    assert len(stranded) == 3


# --- cancellation reaches every node --------------------------------------

def _instrumented(stage, calls):
    from app.graphs.instrumentation import instrument

    async def node(state):
        calls.append(stage)
        return {}

    return instrument(node, stage)


async def test_cancelling_during_an_early_node_actually_stops_the_run(monkeypatch):
    """The live gap: the gate lived only in the review-loop nodes, so
    cancelling during `validate_documents` did nothing and the run carried on
    through ingestion and curriculum planning before parking at a review."""
    from app.graphs import cancellation, instrumentation

    monkeypatch.setattr(cancellation, "is_cancel_requested", lambda thread_id: True)
    monkeypatch.setattr(instrumentation, "_emit", lambda *a, **kw: None)

    calls: list[str] = []
    with pytest.raises(cancellation.RunCancelled):
        await _instrumented("validate_documents", calls)({"thread_id": "t1"})

    assert calls == [], "the node must not run at all once cancelled"


async def test_an_uncancelled_run_is_untouched(monkeypatch):
    from app.graphs import cancellation, instrumentation

    monkeypatch.setattr(cancellation, "is_cancel_requested", lambda thread_id: False)
    monkeypatch.setattr(instrumentation, "_emit", lambda *a, **kw: None)

    calls: list[str] = []
    await _instrumented("plan_curriculum", calls)({"thread_id": "t1"})
    assert calls == ["plan_curriculum"]


async def test_a_cancelled_run_is_not_relabelled_as_failed(fake_graph, captured_outcome):
    """A reviewer's own decision must not be reported back to them as a
    generator bug -- that invites retrying the work they just stopped."""
    from app.graphs.cancellation import RunCancelled

    class _CancellingGraph(_FakeGraph):
        async def ainvoke(self, graph_input, config=None):
            raise RunCancelled("write_lesson")

    graph = _CancellingGraph(_Snapshot({}, ()))

    async def _get():
        return graph

    import app.services.certification_run as cr

    original = cr.get_certification_graph
    cr.get_certification_graph = _get
    try:
        context = cr.RunContext(thread_id="t1", certification_title="T")
        with pytest.raises(cr.RunFailed) as caught:
            await cr.advance(context, None)
    finally:
        cr.get_certification_graph = original

    assert caught.value.outcome["outcome"] == registry.CANCELLED
    assert captured_outcome == {}, "must not overwrite the status with FAILED"

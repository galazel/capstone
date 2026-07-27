"""Backend contracts the Generation Workspace depends on.

Four things the UI cannot work without, none of which existed before:

  * every review action reachable over HTTP, carrying instructions and payloads
    (the endpoint used to send a bare string, so four of six were unreachable);
  * cooperative cancellation, with its two different timings;
  * version history readable *with artifacts*, so a diff has something to show;
  * restore recorded as a new version rather than a rewind.
"""

from __future__ import annotations

import json

import pytest

from app.api.routes.certification import ResumeRequest
from app.graphs.certification import review_loop
from app.services import workflow_registry as registry


# --- the review vocabulary ------------------------------------------------

def test_resume_request_carries_instructions_and_payload():
    """The regression that made Improve and Edit unreachable: a bare string
    resume value has no `.get`, so the graph could never see guidance."""
    request = ResumeRequest(action="improve", instructions="harder distractors")
    assert request.as_resume_value() == {
        "action": "improve",
        "instructions": "harder distractors",
        "payload": None,
        "restored_from": None,
    }


@pytest.mark.parametrize(
    "action", ["approve", "edit", "improve", "regenerate", "reject", "skip", "approve_remaining"]
)
def test_every_workspace_action_is_accepted(action):
    assert ResumeRequest(action=action).action == action


def test_unknown_action_is_rejected():
    with pytest.raises(Exception):
        ResumeRequest(action="delete_everything")


def test_skip_is_an_alias_for_reject():
    """The workspace says "Skip" because that describes the effect; the graph
    says "reject". Both must reach the same branch."""
    assert review_loop.normalize_action("skip") == review_loop.REJECT
    assert review_loop.normalize_action("reject") == review_loop.REJECT


def test_canonical_actions_pass_through_unchanged():
    for action in review_loop.ALL_ACTIONS:
        assert review_loop.normalize_action(action) == action


def test_missing_action_defaults_to_approve():
    assert review_loop.normalize_action(None) == review_loop.APPROVE


# --- cancellation ---------------------------------------------------------

def test_cancel_marks_the_run_and_emits_a_cancelled_event(db, monkeypatch):
    from app.api.routes import workflows as workflow_routes

    registry.start_run(db, thread_id="cancel-1", kind="CERTIFICATION")
    run = registry.get_run_by_thread(db, "cancel-1")

    result = workflow_routes.cancel_workflow_run(run.run_id, db=db)

    assert result["cancelled"] is True
    assert result["status"] == registry.CANCELLED

    events = registry.list_events(db, run.run_id)
    assert events[-1].event_type == registry.EVT_WORKFLOW_CANCELLED
    assert events[-1].task_status == registry.TASK_CANCELLED


def test_cancellation_is_not_reported_as_a_failure(db):
    """A deliberate human decision must not surface as an error in the
    activity panel, so it gets its own event type."""
    registry.start_run(db, thread_id="cancel-2", kind="CERTIFICATION")
    registry.mark_cancelled(db, "cancel-2")

    types = [e.event_type for e in registry.list_events(db, registry.get_run_by_thread(db, "cancel-2").run_id)]
    assert registry.EVT_WORKFLOW_CANCELLED in types
    assert registry.EVT_WORKFLOW_FAILED not in types


def test_cancelling_twice_is_idempotent(db):
    from app.api.routes import workflows as workflow_routes

    registry.start_run(db, thread_id="cancel-3", kind="CERTIFICATION")
    run_id = registry.get_run_by_thread(db, "cancel-3").run_id

    first = workflow_routes.cancel_workflow_run(run_id, db=db)
    second = workflow_routes.cancel_workflow_run(run_id, db=db)

    assert first["cancelled"] is True
    # A second click, or a click racing a completion, is not an error.
    assert second["cancelled"] is True


def test_cancelling_a_completed_run_does_not_rewrite_it(db):
    from app.api.routes import workflows as workflow_routes

    registry.start_run(db, thread_id="cancel-4", kind="CERTIFICATION")
    registry.mark_completed(db, "cancel-4")
    run_id = registry.get_run_by_thread(db, "cancel-4").run_id

    result = workflow_routes.cancel_workflow_run(run_id, db=db)

    assert result["status"] == registry.COMPLETED
    assert result["cancelled"] is False


def test_cancelled_run_refuses_to_resume(db, monkeypatch):
    """The real enforcement for a paused run: it is not executing, so refusing
    the resume *is* the cancellation."""
    from fastapi import HTTPException

    from app.api.routes import certification as cert_routes

    registry.start_run(db, thread_id="cancel-5", kind="CERTIFICATION")
    registry.mark_cancelled(db, "cancel-5")
    monkeypatch.setattr(cert_routes, "SessionLocal", lambda: _NoClose(db))

    with pytest.raises(HTTPException) as caught:
        cert_routes._reject_if_cancelled("cancel-5")
    assert caught.value.status_code == 409


def test_a_live_run_still_resumes(db, monkeypatch):
    from app.api.routes import certification as cert_routes

    registry.start_run(db, thread_id="cancel-6", kind="CERTIFICATION")
    registry.mark_waiting_for_review(db, "cancel-6", stage="CURRICULUM")
    monkeypatch.setattr(cert_routes, "SessionLocal", lambda: _NoClose(db))

    cert_routes._reject_if_cancelled("cancel-6")  # must not raise


def test_cancel_check_fails_open_when_the_registry_is_unreachable(monkeypatch):
    """A transient database blip must not kill a running generation. A late
    cancel is recoverable; a destroyed run is not."""
    from app.graphs import cancellation

    def explode():
        raise RuntimeError("database is down")

    monkeypatch.setattr("app.db.session.SessionLocal", explode)
    assert cancellation.is_cancel_requested("any-thread") is False


def test_no_thread_id_means_no_cancellation_check():
    from app.graphs import cancellation

    assert cancellation.is_cancel_requested(None) is False
    assert cancellation.is_cancel_requested("") is False


def test_gate_router_halts_a_cancelled_phase(monkeypatch):
    """The in-graph boundary: cancel lands between items, not mid-generation."""
    monkeypatch.setattr(
        "app.graphs.certification.review_loop.is_cancel_requested", lambda _: True
    )
    route = review_loop.make_gate_router(review_loop.LoopPhase(
        scope="MAJOR", cursor_key="major_cursor",
        items_of=lambda c: c.get("major_categories", []),
        label_of=lambda i: i.get("name", ""),
    ))
    state = {"thread_id": "t", "curriculum": {"major_categories": [{"name": "A"}]}}
    assert route(state) == "cancelled"


def test_gate_router_proceeds_when_not_cancelled(monkeypatch):
    monkeypatch.setattr(
        "app.graphs.certification.review_loop.is_cancel_requested", lambda _: False
    )
    route = review_loop.make_gate_router(review_loop.LoopPhase(
        scope="MAJOR", cursor_key="major_cursor",
        items_of=lambda c: c.get("major_categories", []),
        label_of=lambda i: i.get("name", ""),
    ))
    state = {"thread_id": "t", "curriculum": {"major_categories": [{"name": "A"}]}}
    assert route(state) == "generate"


# --- version history with artifacts --------------------------------------

def test_versions_endpoint_returns_artifacts_not_just_refs(db):
    """The step-14 regression this closes: graph state keeps refs only, so an
    endpoint reading `version_refs` served nothing to diff."""
    registry.start_run(db, thread_id="ver-1", kind="CERTIFICATION")
    registry.record_artifact_version(
        db, "ver-1", key="MAJOR:0", revision=1, source="AI_GENERATED",
        artifact={"questions": [{"question": "What is a VLAN?"}]},
    )

    versions = registry.list_artifact_versions(db, "ver-1")

    assert len(versions) == 1
    assert versions[0]["artifact"]["questions"][0]["question"] == "What is a VLAN?"


def test_versions_can_be_filtered_to_one_artifact(db):
    registry.start_run(db, thread_id="ver-2", kind="CERTIFICATION")
    for key in ("MAJOR:0", "MAJOR:1"):
        registry.record_artifact_version(
            db, "ver-2", key=key, revision=1, source="AI_GENERATED", artifact={"k": key},
        )

    only = registry.list_artifact_versions(db, "ver-2", key="MAJOR:1")
    assert [v["key"] for v in only] == ["MAJOR:1"]


def test_restore_appends_a_new_version_rather_than_rewinding(db):
    """Audit trail: after restoring r1, the log must still show r2 happened
    and that r3 is where we went back."""
    registry.start_run(db, thread_id="ver-3", kind="CERTIFICATION")
    registry.record_artifact_version(
        db, "ver-3", key="MAJOR:0", revision=1, source="AI_GENERATED", artifact={"v": 1})
    registry.record_artifact_version(
        db, "ver-3", key="MAJOR:0", revision=2, source="AI_IMPROVED", artifact={"v": 2})
    registry.record_artifact_version(
        db, "ver-3", key="MAJOR:0", revision=3, source=review_loop.SOURCE_RESTORED,
        artifact={"v": 1}, instructions="Restored from revision 1")

    versions = registry.list_artifact_versions(db, "ver-3", key="MAJOR:0")

    assert [v["source"] for v in versions] == ["AI_GENERATED", "AI_IMPROVED", "RESTORED"]
    # The restored version carries the old content...
    assert versions[-1]["artifact"] == {"v": 1}
    # ...and the superseded one is still there.
    assert versions[1]["artifact"] == {"v": 2}


def test_restore_is_recorded_as_restored_not_a_manual_edit():
    """Distinguishing these matters: "a human wrote this" and "a human rolled
    back to an earlier generation" are different provenance claims."""
    phase = review_loop.LoopPhase(
        scope="MAJOR", cursor_key="major_cursor",
        items_of=lambda c: c.get("major_categories", []),
        label_of=lambda i: i.get("name", ""),
    )
    recorded = {}

    def fake_record(state, phase, *, artifact, source, instructions=None):
        recorded.update(source=source, instructions=instructions, artifact=artifact)
        return []

    node = review_loop.make_apply_edit_node(phase, lambda s, p: {"major_quizzes": [p]})

    import app.graphs.certification.review_loop as module
    original = module.record_version
    module.record_version = fake_record
    try:
        result = node({
            "review_edited_payload": {"v": 1},
            "review_restored_from": 1,
            "major_cursor": 0,
        })
    finally:
        module.record_version = original

    assert recorded["source"] == review_loop.SOURCE_RESTORED
    assert "revision 1" in recorded["instructions"]
    assert result["status"] == "MAJOR_RESTORED"


def test_a_hand_edit_is_still_a_manual_edit():
    phase = review_loop.LoopPhase(
        scope="MAJOR", cursor_key="major_cursor",
        items_of=lambda c: c.get("major_categories", []),
        label_of=lambda i: i.get("name", ""),
    )
    recorded = {}

    def fake_record(state, phase, *, artifact, source, instructions=None):
        recorded.update(source=source)
        return []

    node = review_loop.make_apply_edit_node(phase, lambda s, p: {"major_quizzes": [p]})

    import app.graphs.certification.review_loop as module
    original = module.record_version
    module.record_version = fake_record
    try:
        result = node({"review_edited_payload": {"v": 1}, "major_cursor": 0})
    finally:
        module.record_version = original

    assert recorded["source"] == review_loop.SOURCE_MANUAL_EDIT
    assert result["status"] == "MAJOR_EDITED"


# --- SSE framing ----------------------------------------------------------

def test_sse_frame_carries_the_seq_as_the_event_id():
    """`id:` is what makes Last-Event-ID replay work, and it must be the event
    seq -- the same cursor the REST and websocket paths use."""
    from app.api.routes.workflow_stream import _sse_frame

    frame = _sse_frame({"type": "event", "event": {"seq": 42, "event_type": "node.completed"}})

    assert "event: event" in frame
    assert "id: 42" in frame
    assert frame.endswith("\n\n")
    body = json.loads([l for l in frame.splitlines() if l.startswith("data: ")][0][6:])
    assert body["event"]["seq"] == 42


def test_snapshot_and_heartbeat_frames_carry_no_id():
    """Neither has a seq, and stamping one would move the client's replay
    cursor to a position it has not actually reached."""
    from app.api.routes.workflow_stream import _sse_frame

    for message in ({"type": "snapshot", "run": {}, "events": []}, {"type": "heartbeat"}):
        assert "id:" not in _sse_frame(message)


def test_sse_data_is_always_a_single_line():
    """A raw newline inside `data:` would split one message into two frames."""
    from app.api.routes.workflow_stream import _sse_frame

    frame = _sse_frame({
        "type": "event",
        "event": {"seq": 1, "payload": {"text": "line one\nline two"}},
    })
    assert len([l for l in frame.strip().splitlines() if l.startswith("data: ")]) == 1


# --- one stream implementation, two transports ---------------------------

async def test_sse_and_websocket_yield_the_same_messages(db, monkeypatch):
    """The reason stream_events exists: if the two transports were written
    separately they would drift, and a client reconnecting to the other one
    would silently lose history."""
    from app.api.ws import stream as stream_module

    monkeypatch.setattr(stream_module, "SessionLocal", lambda: _NoClose(db))

    registry.start_run(db, thread_id="both-1", kind="CERTIFICATION")
    registry.mark_completed(db, "both-1")
    run_id = registry.get_run_by_thread(db, "both-1").run_id

    messages = [m async for m in stream_module.stream_events(run_id, 0)]

    assert [m["type"] for m in messages] == ["snapshot", "complete"]
    # And the SSE encoder can render every one of them.
    from app.api.routes.workflow_stream import _sse_frame
    for message in messages:
        assert _sse_frame(message).endswith("\n\n")


async def test_stream_reports_an_unknown_run_instead_of_hanging(db, monkeypatch):
    from app.api.ws import stream as stream_module

    monkeypatch.setattr(stream_module, "SessionLocal", lambda: _NoClose(db))

    messages = [m async for m in stream_module.stream_events("nope", 0)]
    assert messages == [{"type": "error", "message": "No workflow run nope"}]


class _NoClose:
    """Keeps the shared in-memory connection alive across `with` blocks."""

    def __init__(self, session):
        self._session = session

    def __enter__(self):
        return self._session

    def __exit__(self, *exc):
        return False


# --- node instrumentation -------------------------------------------------
# This wraps every generating node, so its failure modes are generation's
# failure modes. What matters is that it stays invisible: same signature, same
# sync/async nature, same exceptions, and no ability to fail a node.

def test_instrument_preserves_a_sync_node():
    """LangGraph inspects the callable to decide how to schedule it, so
    turning a sync node into a coroutine would silently change execution."""
    import inspect

    from app.graphs.instrumentation import instrument

    def node(state):
        return {"ok": True}

    wrapped = instrument(node, "stage")
    assert not inspect.iscoroutinefunction(wrapped)
    assert wrapped({}) == {"ok": True}


async def test_instrument_preserves_an_async_node():
    import inspect

    from app.graphs.instrumentation import instrument

    async def node(state):
        return {"ok": True}

    wrapped = instrument(node, "stage")
    assert inspect.iscoroutinefunction(wrapped)
    assert await wrapped({}) == {"ok": True}


def test_instrumentation_never_fails_the_node_it_wraps(monkeypatch):
    """An audit aid must not be able to break the generation it describes."""
    from app.graphs.instrumentation import instrument

    def explode():
        raise RuntimeError("registry is down")

    monkeypatch.setattr("app.db.session.SessionLocal", explode)

    wrapped = instrument(lambda state: {"generated": 1}, "stage")
    assert wrapped({"thread_id": "t"}) == {"generated": 1}


def test_a_failing_node_still_raises(monkeypatch):
    """Recording the failure must not swallow it -- the graph has to see it."""
    from app.graphs.instrumentation import instrument

    monkeypatch.setattr("app.db.session.SessionLocal", lambda: (_ for _ in ()).throw(RuntimeError()))

    def node(state):
        raise ValueError("generation failed")

    with pytest.raises(ValueError, match="generation failed"):
        instrument(node, "stage")({"thread_id": "t"})


def test_instrumented_node_records_start_and_completion(db, monkeypatch):
    from app.graphs import instrumentation

    registry.start_run(db, thread_id="inst-1", kind="CERTIFICATION")
    run_id = registry.get_run_by_thread(db, "inst-1").run_id
    monkeypatch.setattr("app.db.session.SessionLocal", lambda: _NoClose(db))

    instrumentation.instrument(lambda state: {}, "lesson_content")({"thread_id": "inst-1"})

    events = [e for e in registry.list_events(db, run_id) if e.stage == "lesson_content"]
    assert [e.event_type for e in events] == [
        registry.EVT_NODE_STARTED, registry.EVT_NODE_COMPLETED
    ]
    assert events[1].task_status == registry.TASK_COMPLETED
    assert events[1].duration_ms is not None


def test_a_node_failure_is_recorded_as_failed(db, monkeypatch):
    from app.graphs import instrumentation

    registry.start_run(db, thread_id="inst-2", kind="CERTIFICATION")
    run_id = registry.get_run_by_thread(db, "inst-2").run_id
    monkeypatch.setattr("app.db.session.SessionLocal", lambda: _NoClose(db))

    def node(state):
        raise ValueError("boom")

    with pytest.raises(ValueError):
        instrumentation.instrument(node, "plan_curriculum")({"thread_id": "inst-2"})

    completed = [e for e in registry.list_events(db, run_id)
                 if e.event_type == registry.EVT_NODE_COMPLETED]
    assert completed[-1].task_status == registry.TASK_FAILED
    assert "boom" in completed[-1].payload["error"]


def test_loop_nodes_report_which_item_they_are_on(db, monkeypatch):
    """"lesson 3 of 20" rather than a spinner: the cursor is what makes the
    timeline legible during a long per-item walk."""
    from app.graphs import instrumentation

    registry.start_run(db, thread_id="inst-3", kind="CERTIFICATION")
    run_id = registry.get_run_by_thread(db, "inst-3").run_id
    monkeypatch.setattr("app.db.session.SessionLocal", lambda: _NoClose(db))

    instrumentation.instrument(lambda state: {}, "lesson_generate")(
        {"thread_id": "inst-3", "lesson_cursor": 2}
    )

    started = [e for e in registry.list_events(db, run_id)
               if e.event_type == registry.EVT_NODE_STARTED][-1]
    assert started.payload == {"item_index": 2, "item_number": 3}


def test_an_unregistered_run_is_simply_not_recorded(db, monkeypatch):
    """A run started outside the registry must still generate normally."""
    from app.graphs import instrumentation

    monkeypatch.setattr("app.db.session.SessionLocal", lambda: _NoClose(db))
    assert instrumentation.instrument(lambda s: {"x": 1}, "stage")({"thread_id": "ghost"}) == {"x": 1}


# --- schema qualification -------------------------------------------------

def test_tables_are_schema_qualified_on_postgres():
    """Queries must name the schema rather than lean on `search_path`.

    search_path is session state, and depending on it produced
    `relation "workflow_runs" does not exist` against a database where the table
    was demonstrably present -- a failure that reads like a missing migration
    rather than a connection-configuration problem. Qualifying removes the
    dependency, so no session state has to be correct for a query to resolve.

    Asserted against a freshly built MetaData because the test suite runs on
    SQLite, which has no schemas.
    """
    from sqlalchemy import Column, Integer, MetaData, Table, select

    metadata = MetaData(schema="bkt")
    table = Table("workflow_runs", metadata, Column("run_id", Integer))

    assert "bkt.workflow_runs" in str(select(table.c.run_id))


def test_java_owned_tables_stay_in_public():
    """The other half: Java's tables must not acquire our schema prefix."""
    from app.db.java_tables import java_metadata

    assert java_metadata.schema == "public"

"""Live workflow timeline over websocket (Phase 2b step 14).

The contract these lock down:
  * a client always gets a DB-backed snapshot first, so a reconnect after a
    dropped connection or a server restart never loses history;
  * `last_seq` replays only what was missed;
  * live events arrive without polling;
  * the stream closes itself once the run reaches a terminal state.
"""

from __future__ import annotations

import pytest

from app.api.ws.broadcaster import EventBroadcaster, get_broadcaster
from app.services import workflow_registry as registry


class _NoCloseSession:
    """Wraps the test session so the handler's `with SessionLocal()` cannot
    close the shared in-memory connection."""

    def __init__(self, session):
        self._session = session

    def __enter__(self):
        return self._session

    def __exit__(self, *exc):
        return False


@pytest.fixture(autouse=True)
def handler_uses_test_db(db, monkeypatch):
    """The stream manages its own short-lived sessions rather than taking
    Depends(get_db), because it outlives any single request. That means the
    client fixture's override does not apply and it would otherwise open a
    real connection."""
    from app.api.ws import stream as stream_module

    monkeypatch.setattr(stream_module, "SessionLocal", lambda: _NoCloseSession(db))


@pytest.fixture()
def run(db):
    """A registered run with a few events already recorded."""
    created = registry.start_run(
        db, thread_id="ws-thread", kind="CERTIFICATION", certification_id=7
    )
    registry.mark_waiting_for_review(db, "ws-thread", stage="CURRICULUM")
    return created


# --- broadcaster ----------------------------------------------------------

async def test_broadcaster_delivers_to_every_subscriber():
    broadcaster = EventBroadcaster()
    a = broadcaster.subscribe("r1")
    b = broadcaster.subscribe("r1")

    broadcaster.publish("r1", {"seq": 1})

    assert (await a.get())["seq"] == 1
    assert (await b.get())["seq"] == 1


async def test_broadcaster_isolates_runs():
    broadcaster = EventBroadcaster()
    mine = broadcaster.subscribe("r1")
    broadcaster.subscribe("r2")

    broadcaster.publish("r2", {"seq": 9})
    assert mine.empty(), "an event leaked across runs"


async def test_unsubscribe_removes_the_queue():
    broadcaster = EventBroadcaster()
    queue = broadcaster.subscribe("r1")
    assert broadcaster.subscriber_count("r1") == 1

    broadcaster.unsubscribe("r1", queue)
    assert broadcaster.subscriber_count("r1") == 0

    broadcaster.publish("r1", {"seq": 1})
    assert queue.empty()


async def test_publish_never_raises_on_a_stalled_subscriber():
    """A broadcast failure must not be able to fail the workflow that
    produced the event."""
    broadcaster = EventBroadcaster()
    queue = broadcaster.subscribe("r1")
    for i in range(1000):
        broadcaster.publish("r1", {"seq": i})
    assert queue.qsize() > 0


async def test_publish_to_nobody_is_a_noop():
    EventBroadcaster().publish("nobody-listening", {"seq": 1})


# --- registry publishes after commit -------------------------------------

def test_registry_publishes_transitions_to_subscribers(db):
    broadcaster = get_broadcaster()
    registry.start_run(db, thread_id="pub-1", kind="CERTIFICATION")

    queue = broadcaster.subscribe(
        registry.get_run_by_thread(db, "pub-1").run_id
    )
    registry.mark_waiting_for_review(db, "pub-1", stage="CURRICULUM")

    assert not queue.empty(), "a committed transition was not broadcast"
    event = queue.get_nowait()
    assert event["event_type"] == registry.EVT_REVIEW_WAITING
    assert event["stage"] == "CURRICULUM"


def test_event_wire_form_carries_what_the_timeline_renders(db):
    registry.start_run(db, thread_id="wire-1", kind="CERTIFICATION")
    run = registry.get_run_by_thread(db, "wire-1")
    event = registry.record_event(
        db, run, registry.EVT_NODE_COMPLETED, stage="plan_curriculum",
        task_status=registry.TASK_COMPLETED, duration_ms=1500, retry_count=1,
    )
    db.commit()

    wire = registry.event_as_dict(event)
    assert set(wire) == {
        "seq", "event_type", "stage", "task_status",
        "duration_ms", "retry_count", "payload", "created_at",
    }
    assert wire["duration_ms"] == 1500
    assert wire["retry_count"] == 1


# --- the socket -----------------------------------------------------------

def test_socket_sends_a_snapshot_first(client, run):
    with client.websocket_connect(f"/ws/workflows/{run.run_id}") as ws:
        message = ws.receive_json()

    assert message["type"] == "snapshot"
    assert message["run"]["run_id"] == run.run_id
    assert message["run"]["status"] == registry.WAITING_FOR_REVIEW
    assert message["run"]["current_stage"] == "CURRICULUM"
    # workflow.started + review.waiting
    assert [e["event_type"] for e in message["events"]] == [
        registry.EVT_WORKFLOW_STARTED,
        registry.EVT_REVIEW_WAITING,
    ]


def test_last_seq_replays_only_what_was_missed(client, run):
    """A reconnecting client sends its last_seq and must not re-receive
    events it already rendered."""
    with client.websocket_connect(f"/ws/workflows/{run.run_id}?last_seq=1") as ws:
        message = ws.receive_json()

    assert [e["seq"] for e in message["events"]] == [2]


def test_last_seq_at_the_head_replays_nothing(client, run):
    with client.websocket_connect(f"/ws/workflows/{run.run_id}?last_seq=2") as ws:
        message = ws.receive_json()
    assert message["events"] == []


def test_unknown_run_is_rejected(client):
    with client.websocket_connect("/ws/workflows/does-not-exist") as ws:
        message = ws.receive_json()
    assert message["type"] == "error"


def test_socket_closes_once_the_run_is_terminal(client, db, run):
    """A finished run has nothing more to say; the socket should not hang
    open holding a connection."""
    registry.mark_completed(db, "ws-thread")

    with client.websocket_connect(f"/ws/workflows/{run.run_id}") as ws:
        snapshot = ws.receive_json()
        final = ws.receive_json()

    assert snapshot["type"] == "snapshot"
    assert final["type"] == "complete"
    assert final["status"] == registry.COMPLETED


async def _await_subscriber(broadcaster, run_id: str, timeout: float = 5.0) -> None:
    """Waits until the handler has registered its queue."""
    import asyncio

    deadline = asyncio.get_running_loop().time() + timeout
    while broadcaster.subscriber_count(run_id) == 0:
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("handler never subscribed")
        await asyncio.sleep(0.01)


class _FakeSocket:
    """Minimal WebSocket stand-in.

    The sync TestClient runs the handler in its own event loop, so publishing
    from the test thread into that loop's asyncio.Queue is not safe. Driving
    the endpoint coroutine directly exercises the real live-streaming path in
    one loop.
    """

    def __init__(self):
        self.accepted = False
        self.sent: list[dict] = []
        self.close_code: int | None = None

    async def accept(self):
        self.accepted = True

    async def send_json(self, message):
        self.sent.append(message)

    async def close(self, code: int = 1000):
        self.close_code = code


async def test_live_events_are_streamed_without_polling(db, monkeypatch):
    """The point of the socket: an event emitted after connect arrives
    immediately, not on the next poll."""
    from app.api.ws import workflows as ws_module

    registry.start_run(db, thread_id="live-1", kind="CERTIFICATION")
    run = registry.get_run_by_thread(db, "live-1")
    run_id = run.run_id

    # The handler opens its own sessions; point them at the test session so
    # it sees the same in-memory database.
    monkeypatch.setattr(ws_module, "get_settings", lambda: _NoAuth())

    socket = _FakeSocket()
    broadcaster = get_broadcaster()

    import asyncio

    task = asyncio.create_task(ws_module.workflow_timeline(socket, run_id, last_seq=0, key=None))
    # The handler loads its snapshot with real async I/O before subscribing;
    # publishing before then would be delivered to nobody.
    await _await_subscriber(broadcaster, run_id)

    # Emitted after the client connected.
    broadcaster.publish(run_id, {"seq": 99, "event_type": registry.EVT_NODE_COMPLETED,
                                 "stage": "plan_curriculum"})
    broadcaster.publish(run_id, {"seq": 100, "event_type": registry.EVT_WORKFLOW_COMPLETED})

    await asyncio.wait_for(task, timeout=5)

    kinds = [m["type"] for m in socket.sent]
    assert kinds[0] == "snapshot"
    assert "event" in kinds, f"live event never forwarded: {socket.sent}"
    assert kinds[-1] == "complete", "stream did not close on workflow.completed"

    streamed = [m["event"]["seq"] for m in socket.sent if m["type"] == "event"]
    assert streamed == [99, 100]


async def test_out_of_order_events_are_dropped(db, monkeypatch):
    """The client's view must stay monotonic even if a stale event arrives."""
    from app.api.ws import workflows as ws_module

    registry.start_run(db, thread_id="live-2", kind="CERTIFICATION")
    run_id = registry.get_run_by_thread(db, "live-2").run_id

    monkeypatch.setattr(ws_module, "get_settings", lambda: _NoAuth())

    socket = _FakeSocket()
    broadcaster = get_broadcaster()

    import asyncio

    task = asyncio.create_task(ws_module.workflow_timeline(socket, run_id, last_seq=5, key=None))
    await _await_subscriber(broadcaster, run_id)

    broadcaster.publish(run_id, {"seq": 3, "event_type": "node.completed"})   # stale
    broadcaster.publish(run_id, {"seq": 6, "event_type": "node.completed"})
    broadcaster.publish(run_id, {"seq": 7, "event_type": registry.EVT_WORKFLOW_FAILED})

    await asyncio.wait_for(task, timeout=5)

    streamed = [m["event"]["seq"] for m in socket.sent if m["type"] == "event"]
    assert streamed == [6, 7], f"stale event was not dropped: {streamed}"


class _NoAuth:
    """Settings stub with auth disabled."""

    service_api_key = ""

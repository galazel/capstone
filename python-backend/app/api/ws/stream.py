"""The workflow timeline stream, transport-independent.

One generator, two mounts:

* `/ws/workflows/{run_id}` -- the websocket, for internal consumers and tests;
* `/api/v1/ai/workflows/{run_id}/stream` -- server-sent events, which the Java
  gateway relays to the browser.

Factoring the logic here rather than writing it twice is the point: the replay
contract (snapshot first, then only events after `last_seq`, monotonic seqs,
close on terminal) is subtle enough that two copies would drift, and a client
reconnecting to the "wrong" transport would silently lose history.

Messages are dicts in one of four shapes, in this order:

    {"type": "snapshot",  "run": {...}, "events": [...]}
    {"type": "event",     "event": {...}}
    {"type": "heartbeat"}
    {"type": "complete",  "status": "..."}          # or "error"
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

from app.api.ws.broadcaster import get_broadcaster
from app.db.session import SessionLocal
from app.services import workflow_registry as registry

logger = logging.getLogger(__name__)

#: How long to wait for a live event before doing a catch-up poll. The
#: broadcaster is process-local, so with several uvicorn workers an event
#: emitted in another worker only arrives via this poll.
IDLE_TIMEOUT_SECONDS = 10.0


def run_summary(run) -> dict[str, Any]:
    return {
        "run_id": run.run_id,
        "thread_id": run.thread_id,
        "kind": run.kind,
        "certification_id": run.certification_id,
        "status": run.status,
        "current_stage": run.current_stage,
        "progress_pct": run.progress_pct,
        "error_message": run.error_message,
        "last_seq": run.last_seq,
        # When the run last recorded anything. A client that attaches to a run
        # started hours ago -- reopened from the certifications list, or after
        # the admin signed back in -- cannot tell a busy run from an abandoned
        # one by watching its own connection, because both look like a live
        # stream with nothing arriving. This is the only evidence of that.
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }


def _load_snapshot(run_id: str, after_seq: int) -> tuple[dict | None, list[dict]]:
    with SessionLocal() as session:
        run = registry.get_run(session, run_id)
        if run is None:
            return None, []
        events = registry.list_events(session, run_id, after_seq=after_seq)
        return run_summary(run), [registry.event_as_dict(e) for e in events]


def _load_since(run_id: str, after_seq: int) -> list[dict]:
    with SessionLocal() as session:
        return [
            registry.event_as_dict(e)
            for e in registry.list_events(session, run_id, after_seq=after_seq)
        ]


def _is_terminal(status: str | None) -> bool:
    return status in registry.TERMINAL_STATUSES


async def stream_events(run_id: str, last_seq: int = 0) -> AsyncIterator[dict[str, Any]]:
    """Yields timeline messages for one run until it reaches a terminal state.

    The snapshot is read from the database rather than the broadcaster, so a
    client that reconnects after a dropped connection or a server restart
    resumes exactly where it left off instead of losing history.
    """
    run, missed = await asyncio.to_thread(_load_snapshot, run_id, last_seq)
    if run is None:
        yield {"type": "error", "message": f"No workflow run {run_id}"}
        return

    # Subscribe *before* yielding the snapshot, so an event emitted in the gap
    # between reading history and starting to listen is queued, not lost.
    broadcaster = get_broadcaster()
    queue = broadcaster.subscribe(run_id)

    try:
        # The replayed history is streamed as individual event frames rather
        # than embedded in the snapshot. Embedding it made the *first* frame
        # grow with the run: at 150 events it reached 284 KB, past the 256 KB
        # in-memory buffer the Java relay's WebClient decodes each SSE frame
        # into. The relay then failed the stream, the browser reconnected, and
        # got the same oversized frame again -- a permanent reconnect loop
        # whose only symptom was an empty timeline, and one that any long run
        # was guaranteed to reach eventually.
        #
        # Live events already went one per frame, so this simply makes replay
        # behave like the steady state. `events` stays in the snapshot message
        # for shape compatibility; clients merge by seq either way.
        yield {"type": "snapshot", "run": run, "events": []}
        seen = last_seq
        for replayed in missed:
            seen = replayed["seq"]
            yield {"type": "event", "event": replayed}

        if _is_terminal(run["status"]) and seen >= run["last_seq"]:
            # Nothing further will ever arrive; don't hold the connection.
            yield {"type": "complete", "status": run["status"]}
            return

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=IDLE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                for missed_event in await asyncio.to_thread(_load_since, run_id, seen):
                    seen = missed_event["seq"]
                    yield {"type": "event", "event": missed_event}

                current, _ = await asyncio.to_thread(_load_snapshot, run_id, seen)
                if current and _is_terminal(current["status"]) and seen >= current["last_seq"]:
                    yield {"type": "complete", "status": current["status"]}
                    return
                yield {"type": "heartbeat"}
                continue

            # Out-of-order or already-delivered events are dropped: the
            # client's view must stay monotonic.
            if event["seq"] <= seen:
                continue
            seen = event["seq"]
            yield {"type": "event", "event": event}

            if event["event_type"] in registry.TERMINAL_EVENTS:
                yield {"type": "complete", "status": event["event_type"]}
                return
    finally:
        broadcaster.unsubscribe(run_id, queue)

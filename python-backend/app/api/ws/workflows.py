"""Live workflow timeline over a websocket.

The stream logic itself lives in `app.api.ws.stream` and is shared with the SSE
mount that the Java gateway relays to the browser; this module is only the
websocket transport for it.

Contract, in order:

1. `{"type": "snapshot", "run": {...}, "events": [...]}` -- the run's current
   state plus every event after the client's `last_seq`.
2. `{"type": "event", "event": {...}}` for each subsequent event.
3. `{"type": "heartbeat"}` periodically, so a client can distinguish "idle"
   from "connection dead".
4. `{"type": "complete", "status": "..."}` once nothing more can arrive.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.ws.stream import stream_events
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/workflows/{run_id}")
async def workflow_timeline(
    websocket: WebSocket,
    run_id: str,
    last_seq: int = Query(default=0, ge=0),
    key: str | None = Query(default=None),
) -> None:
    """Streams one run's timeline.

    Auth is via `?key=` rather than a header: browsers cannot set headers on a
    WebSocket handshake, so the service key travels as a query parameter -- the
    same secret the REST routes require.

    This is an internal, service-to-service entrypoint. Browsers reach the same
    stream through Java's authenticated SSE relay, which keeps the service key
    out of client-side code entirely.
    """
    settings = get_settings()
    expected = settings.service_api_key
    if expected and key != expected:
        # Rejected before accept, so no session is established.
        await websocket.close(code=4401)
        return

    await websocket.accept()

    try:
        async for message in stream_events(run_id, last_seq):
            await websocket.send_json(message)
            if message["type"] == "error":
                await websocket.close(code=4404)
                return
    except WebSocketDisconnect:
        logger.debug("Websocket client disconnected from run %s", run_id)
    except Exception:
        logger.exception("Websocket error on run %s", run_id)

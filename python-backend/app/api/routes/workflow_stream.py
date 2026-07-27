"""Server-sent events mount for the workflow timeline.

Same stream as the websocket, different transport. This is the one the Java
gateway consumes and relays to the browser, because:

* the timeline is strictly server-to-client -- review actions are REST POSTs, so
  a bidirectional socket buys nothing;
* SSE's `Last-Event-ID` header *is* the `last_seq` replay contract, so reconnect
  resumption comes from the protocol instead of being hand-rolled;
* relaying SSE through Java is a body pipe, where relaying a websocket would
  need a reactive websocket client and its own reconnect bookkeeping.

Each message carries `id: <seq>`, so a client (or Java, or the browser's
EventSource) that drops the connection resends the last id it saw and resumes
exactly there. Messages without a seq -- heartbeats and the snapshot -- carry no
id, which is deliberate: they must not move the client's replay cursor.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Header, Query
from fastapi.responses import StreamingResponse

from app.api.ws.stream import stream_events
from app.core.security import require_service_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(require_service_key)],
)


def _sse_frame(message: dict) -> str:
    """Encodes one message as an SSE frame.

    `event:` is the message type, so a consumer can dispatch without parsing
    the body; `id:` is the event seq where one exists.
    """
    lines = [f"event: {message['type']}"]

    seq = (message.get("event") or {}).get("seq")
    if seq is not None:
        lines.append(f"id: {seq}")

    # json.dumps never emits a raw newline, so the payload is always one
    # `data:` line -- no need to split it.
    lines.append(f"data: {json.dumps(message, default=str)}")
    return "\n".join(lines) + "\n\n"


async def _sse_body(run_id: str, last_seq: int) -> AsyncIterator[str]:
    try:
        async for message in stream_events(run_id, last_seq):
            yield _sse_frame(message)
    except Exception:
        # The client has already had a partial stream; tell it the stream
        # failed rather than letting the connection just stop, which is
        # indistinguishable from a network drop and would trigger a reconnect
        # loop against a broken run.
        logger.exception("SSE stream failed for run %s", run_id)
        yield _sse_frame({"type": "error", "message": "stream failed"})


@router.get("/{run_id}/stream")
async def stream_workflow_timeline(
    run_id: str,
    last_seq: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
) -> StreamingResponse:
    """Streams one run's timeline as SSE.

    `Last-Event-ID` takes precedence over the `last_seq` query parameter: on a
    reconnect the protocol header is the authoritative cursor, and the original
    query string is whatever the client first connected with.
    """
    resume_from = last_seq
    if last_event_id:
        try:
            resume_from = max(resume_from, int(last_event_id))
        except ValueError:
            logger.warning("Ignoring non-numeric Last-Event-ID %r", last_event_id)

    return StreamingResponse(
        _sse_body(run_id, resume_from),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # Stops nginx and similar from buffering the stream into
            # uselessness -- without it events arrive in batches, or not
            # until the response ends.
            "X-Accel-Buffering": "no",
        },
    )

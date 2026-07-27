"""In-process fan-out of workflow events to connected websocket clients.

Deliberately paired with a DB replay in the socket handler rather than
trusted on its own. Two reasons:

1. A dropped or slow client must not lose history. `workflow_events` is the
   source of truth and carries a monotonic `seq`, so a client reconnects with
   its `last_seq` and receives exactly what it missed.
2. This broadcaster is process-local. With more than one uvicorn worker, an
   event published in worker A never reaches a socket held by worker B. The
   handler's periodic catch-up poll covers that case, so multi-worker
   degrades to slightly-delayed delivery instead of silence. Swapping this
   for Redis pub/sub is the fix if sub-second latency across workers is ever
   required.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

#: Bounded so one stalled client cannot grow memory without limit. On
#: overflow the oldest is dropped -- safe, because the catch-up poll will
#: re-deliver anything skipped.
_QUEUE_MAXSIZE = 256


class EventBroadcaster:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, run_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers[run_id].add(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        subscribers = self._subscribers.get(run_id)
        if not subscribers:
            return
        subscribers.discard(queue)
        if not subscribers:
            self._subscribers.pop(run_id, None)

    def subscriber_count(self, run_id: str) -> int:
        return len(self._subscribers.get(run_id, ()))

    def publish(self, run_id: str, event: dict[str, Any]) -> None:
        """Pushes to every subscriber of this run.

        Never raises: a broadcast failure must not roll back or fail the
        workflow that produced the event.
        """
        for queue in list(self._subscribers.get(run_id, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Drop the oldest and retry once; the catch-up poll repairs
                # any gap this creates.
                try:
                    queue.get_nowait()
                    queue.put_nowait(event)
                except Exception:
                    logger.warning("Dropped workflow event for a stalled subscriber")
            except Exception:
                logger.exception("Failed to publish workflow event")


_broadcaster = EventBroadcaster()


def get_broadcaster() -> EventBroadcaster:
    return _broadcaster

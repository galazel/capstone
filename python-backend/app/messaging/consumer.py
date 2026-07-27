from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable

from aio_pika.abc import AbstractChannel, AbstractRobustConnection, AbstractIncomingMessage

from app.messaging.connection import connect, declare_queue
from app.messaging.topology import QueueSpec

logger = logging.getLogger(__name__)

MessageHandler = Callable[[dict], Awaitable[None]]


class QueueConsumer:
    """Runs one queue's consume loop: connect -> declare topology -> consume.

    The handler receives the JSON-decoded message body. It must raise on any
    failure (bad payload, DB error, etc.) -- the message is only acknowledged
    after the handler returns normally, and a raised exception nacks the
    message without requeue so it is dead-lettered rather than retried
    forever or silently dropped.
    """

    def __init__(self, spec: QueueSpec, handler: MessageHandler, *, prefetch_count: int = 1) -> None:
        self._spec = spec
        self._handler = handler
        self._prefetch_count = prefetch_count
        self._connection: AbstractRobustConnection | None = None

    async def start(self) -> None:
        self._connection = await connect()
        channel: AbstractChannel = await self._connection.channel()
        await channel.set_qos(prefetch_count=self._prefetch_count)
        queue = await declare_queue(channel, self._spec)
        await queue.consume(self._on_message)
        logger.info("Listening on %s (routing key %s)", self._spec.queue, self._spec.routing_key)

    async def stop(self) -> None:
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

    async def _on_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            payload = json.loads(message.body)
            await self._handler(payload)

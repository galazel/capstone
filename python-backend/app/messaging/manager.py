from __future__ import annotations

import logging

from app.messaging.consumer import QueueConsumer

logger = logging.getLogger(__name__)


class ConsumerManager:
    """Starts/stops a fixed set of QueueConsumers together, for the FastAPI
    lifespan to own as a single unit."""

    def __init__(self, consumers: list[QueueConsumer]) -> None:
        self._consumers = consumers

    async def start(self) -> None:
        for consumer in self._consumers:
            await consumer.start()

    async def stop(self) -> None:
        for consumer in self._consumers:
            try:
                await consumer.stop()
            except Exception:
                logger.exception("Error stopping consumer")

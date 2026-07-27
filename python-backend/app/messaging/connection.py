from __future__ import annotations

import logging

import aio_pika
from aio_pika import ExchangeType
from aio_pika.abc import AbstractChannel, AbstractQueue, AbstractRobustConnection

from app.core.config import get_settings
from app.messaging.topology import DEAD_LETTER_EXCHANGE, EXCHANGE, QueueSpec

logger = logging.getLogger(__name__)


async def connect() -> AbstractRobustConnection:
    settings = get_settings()
    return await aio_pika.connect_robust(settings.rabbitmq_url)


async def declare_queue(channel: AbstractChannel, spec: QueueSpec) -> AbstractQueue:
    """Idempotently declares a queue + its DLQ, matching backend-java's
    RabbitMqConfig args exactly so either service can start first."""
    exchange = await channel.declare_exchange(EXCHANGE, ExchangeType.TOPIC, durable=True)
    dead_letter_exchange = await channel.declare_exchange(
        DEAD_LETTER_EXCHANGE, ExchangeType.TOPIC, durable=True
    )

    dead_letter_queue = await channel.declare_queue(spec.dead_letter_queue, durable=True)
    await dead_letter_queue.bind(dead_letter_exchange, routing_key=spec.dead_letter_queue)

    queue = await channel.declare_queue(
        spec.queue,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
            "x-dead-letter-routing-key": spec.dead_letter_queue,
        },
    )
    await queue.bind(exchange, routing_key=spec.routing_key)
    return queue

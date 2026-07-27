"""Queue/routing-key constants mirroring backend-java's RabbitMqConfig.

Both services declare this topology idempotently, so whichever process starts
first creates it and the other simply binds to the existing definitions.
"""

from __future__ import annotations

from dataclasses import dataclass

EXCHANGE = "rebyu.exchange"
DEAD_LETTER_EXCHANGE = "rebyu.dlx"


@dataclass(frozen=True)
class QueueSpec:
    queue: str
    routing_key: str

    @property
    def dead_letter_queue(self) -> str:
        # Mirrors backend-java RabbitMqConfig.deadLetterQueueName/-RoutingKey:
        # the DLQ name (and its binding routing key) is the main queue name
        # with ".queue" swapped for ".dlq".
        return self.queue.replace(".queue", ".dlq")


CERTIFICATION_GENERATION = QueueSpec("certification.generation.queue", "certification.generation.requested")
QUESTION_GENERATION = QueueSpec("question.generation.queue", "question.generation.requested")
ASSESSMENT_SUBMITTED = QueueSpec("assessment.submitted.queue", "assessment.submitted")
ASSESSMENT_RETAKE = QueueSpec("assessment.retake.queue", "assessment.retake.requested")

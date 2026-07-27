from __future__ import annotations

from app.messaging.consumer import QueueConsumer
from app.messaging.handlers.assessment_events import (
    handle_assessment_retake_requested,
    handle_assessment_submitted,
)
from app.messaging.handlers.certification_generation import (
    handle_certification_generation_requested,
)
from app.messaging.handlers.question_generation import handle_question_generation_requested
from app.messaging.manager import ConsumerManager
from app.messaging.topology import (
    ASSESSMENT_RETAKE,
    ASSESSMENT_SUBMITTED,
    CERTIFICATION_GENERATION,
    QUESTION_GENERATION,
)


def build_consumer_manager() -> ConsumerManager:
    return ConsumerManager([
        QueueConsumer(CERTIFICATION_GENERATION, handle_certification_generation_requested),
        QueueConsumer(QUESTION_GENERATION, handle_question_generation_requested),
        QueueConsumer(ASSESSMENT_SUBMITTED, handle_assessment_submitted),
        QueueConsumer(ASSESSMENT_RETAKE, handle_assessment_retake_requested),
    ])

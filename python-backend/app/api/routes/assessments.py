from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.ai.router import AllModelsExhausted, OutOfCredits, RequestTooLarge
from app.core.security import require_service_key
from app.schemas.assessment.grading_schema import AnswerGradingRequest, AnswerGradingResult
from app.services.ai.answer_grading import grade_answer

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/assessments",
    tags=["assessments"],
    dependencies=[Depends(require_service_key)],
)


@router.post("/grade-answer", response_model=AnswerGradingResult)
async def grade(payload: AnswerGradingRequest) -> AnswerGradingResult:
    """Marks one written answer for `AssessmentAttemptService`.

    Every failure here answers with a 5xx rather than a zero. The Java caller
    reads 4xx as "this request can never work" and stops retrying, while 5xx
    means "try again" -- and after its retries it leaves the answer unmarked
    instead of recording a score. Returning 200 with 0 points would look
    identical to a learner who genuinely earned nothing, which is the one
    outcome worth going out of the way to avoid.
    """
    try:
        return await grade_answer(payload)
    except (AllModelsExhausted, OutOfCredits, RequestTooLarge) as unavailable:
        # Not the caller's fault and not fixed by a different payload, so 503
        # rather than 4xx -- the answer should be retried, then left pending.
        logger.error("Cannot grade this answer right now: %s", unavailable)
        raise HTTPException(
            status_code=503, detail=f"Grading is unavailable: {unavailable}"
        ) from unavailable

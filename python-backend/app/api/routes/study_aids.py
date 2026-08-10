from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.study_aid.study_aid_agent import get_study_aid_agent
from app.ai.invocation import structured
from app.ai.router import ainvoke_with_fallback
from app.core.security import require_service_key
from app.db.session import get_db
from app.graphs.tutor.lesson_context import load_lesson_context
from app.schemas.study_aid.study_aid_schema import StudyAidSet

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/study-aids",
    tags=["study-aids"],
    dependencies=[Depends(require_service_key)],
)

#: Fixed rather than caller-configurable -- the learner tools UI offers no
#: count picker, and a hard cap here is what makes "exactly 10" a guarantee
#: rather than a suggestion the model can ignore.
ITEM_COUNT = 10

_TYPES = ("quiz", "flashcard")


class StudyAidRequest(BaseModel):
    type: str
    lessonName: str
    lessonId: int | None = None


def _build_prompt(aid_type: str, lesson_name: str, lesson_context: str | None) -> str:
    content = lesson_context or (
        f"Lesson: {lesson_name}\n\n"
        "No stored content was found for this lesson -- write conservative, general "
        "items from the title alone rather than guessing at specifics."
    )

    if aid_type == "quiz":
        instructions = (
            f"Generate exactly {ITEM_COUNT} multiple-choice questions for this lesson."
        )
    else:
        instructions = f"Generate exactly {ITEM_COUNT} flashcards for this lesson."

    return f"{instructions}\n\n{content}"


@router.post("/generate", response_model=StudyAidSet)
async def generate(payload: StudyAidRequest, db: Session = Depends(get_db)) -> StudyAidSet:
    aid_type = (payload.type or "").strip().lower()
    if aid_type not in _TYPES:
        raise HTTPException(status_code=422, detail="type must be 'quiz' or 'flashcard'")

    lesson_context = None
    if payload.lessonId is not None:
        try:
            lesson_context = load_lesson_context(db, payload.lessonId)
        except Exception:
            # Same degrade-not-fail posture as the tutor chat route: a lookup
            # failure shouldn't stop generation, just make it less specific.
            logger.exception(
                "Failed to load lesson %s for study aid generation", payload.lessonId
            )

    prompt = _build_prompt(aid_type, payload.lessonName, lesson_context)

    result: StudyAidSet = await ainvoke_with_fallback(
        structured(get_study_aid_agent),
        {"messages": [HumanMessage(content=prompt)]},
        task="tutor",
    )

    # Belt and suspenders: the prompt asks for exactly ITEM_COUNT, but nothing
    # stops a model from over- or under-delivering, so the cap is enforced
    # here rather than trusted to instruction-following.
    result.items = result.items[:ITEM_COUNT]
    return result

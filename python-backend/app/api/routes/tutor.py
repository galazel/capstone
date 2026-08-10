from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.session import get_db
from app.graphs.tutor.lesson_context import load_lesson_context
from app.graphs.tutor.workflow import get_tutor_graph
from app.services.ai.tutor_service import append_messages, get_conversation

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tutor",
    tags=["tutor"],
    dependencies=[Depends(require_service_key)],
)


class ChatRequest(BaseModel):
    message: str
    sessionId: str
    lessonName: str
    lessonId: int | None = None


class ChatResponse(BaseModel):
    reply: str
    sessionId: str


class ConversationMessage(BaseModel):
    role: str
    content: str
    # Only set on a generated quiz/flashcard turn: the payload the tutor UI
    # re-renders its "Take the quiz" card from after a refresh.
    action: dict | None = None


class ConversationResponse(BaseModel):
    messages: list[ConversationMessage]


class AppendMessagesRequest(BaseModel):
    sessionId: str
    messages: list[ConversationMessage]


@router.get("/conversation", response_model=ConversationResponse)
async def conversation(sessionId: str) -> ConversationResponse:
    messages = await get_conversation(sessionId)
    return ConversationResponse(messages=messages)


@router.post("/conversation/messages", response_model=ConversationResponse)
async def append_conversation_messages(payload: AppendMessagesRequest) -> ConversationResponse:
    """Records an exchange that didn't go through the model.

    The "generate a quiz/flashcards" action is a real turn in the
    conversation, but it never invokes the graph -- so without this it was
    absent from the thread and disappeared on refresh.
    """
    await append_messages(
        payload.sessionId, [message.model_dump() for message in payload.messages]
    )
    return ConversationResponse(messages=await get_conversation(payload.sessionId))


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    lesson_context = None
    if payload.lessonId is not None:
        try:
            lesson_context = load_lesson_context(db, payload.lessonId)
        except Exception:
            # A lesson lookup failure should degrade to an unscoped answer,
            # not take the whole chat down -- the learner still gets a reply.
            logger.exception("Failed to load lesson %s for the tutor", payload.lessonId)

    graph = await get_tutor_graph()
    config = {"configurable": {"thread_id": payload.sessionId}}
    result = await graph.ainvoke(
        {
            "request": payload.message,
            "messages": [HumanMessage(content=payload.message)],
            "lessonContext": lesson_context,
        },
        config=config,
    )
    reply = result["messages"][-1].content
    return ChatResponse(reply=reply, sessionId=payload.sessionId)

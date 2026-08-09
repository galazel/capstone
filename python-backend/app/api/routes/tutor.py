from __future__ import annotations

from fastapi import APIRouter, Depends
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.core.security import require_service_key
from app.graphs.tutor.workflow import get_tutor_graph

router = APIRouter(
    prefix="/tutor",
    tags=["tutor"],
    dependencies=[Depends(require_service_key)],
)


class ChatRequest(BaseModel):
    message: str
    sessionId: str
    lessonName: str


class ChatResponse(BaseModel):
    reply: str
    sessionId: str


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    graph = await get_tutor_graph()
    config = {"configurable": {"thread_id": payload.sessionId}}
    result = await graph.ainvoke(
        {
            "request": payload.message,
            "messages": [HumanMessage(content=payload.message)],
        },
        config=config,
    )
    reply = result["messages"][-1].content
    return ChatResponse(reply=reply, sessionId=payload.sessionId)

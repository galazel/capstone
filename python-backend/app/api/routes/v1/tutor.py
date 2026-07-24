from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.tutor_agent import tutor_agent

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        tutor_agent(request.query),
        media_type="text/plain"
    )
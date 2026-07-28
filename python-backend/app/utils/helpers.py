import asyncio
import logging
import os
from uuid import uuid4

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import get_settings

logger = logging.getLogger(__name__)

load_dotenv()

# psycopg's raw conninfo parser doesn't understand SQLAlchemy dialect
# suffixes (postgresql+psycopg://) -- only the plain postgresql:// scheme --
# so strip it before handing the URL to the checkpointer.
connection_string = (os.getenv("DATABASE_URL") or "").replace("postgresql+psycopg://", "postgresql://")

_checkpointer = None
_checkpointer_cm = None
_checkpointer_lock = asyncio.Lock()


async def get_checkpointer():
    """Async checkpointer, created once per process.

    Two problems with the previous implementation:

    1. It used the *sync* `PostgresSaver` inside an async application, so
       every checkpoint write blocked a threadpool worker. With 8+ HITL
       checkpoints and a Send() fan-out across dozens of lessons, that is a
       lot of blocking on the hot path.
    2. It called `cm.__enter__()` and never `__exit__()`, so the connection
       was never released for the lifetime of the process.

    The lock matters: without it two concurrent first-requests can both see
    `None` and each open their own connection, leaking one of them.
    """
    global _checkpointer, _checkpointer_cm

    if _checkpointer is not None:
        return _checkpointer

    async with _checkpointer_lock:
        if _checkpointer is None:
            _checkpointer_cm = AsyncPostgresSaver.from_conn_string(connection_string)
            _checkpointer = await _checkpointer_cm.__aenter__()
            await _checkpointer.setup()
            logger.info("Async Postgres checkpointer initialised")

    return _checkpointer


async def close_checkpointer() -> None:
    """Releases the checkpointer connection. Called from the FastAPI
    lifespan shutdown -- this is the `__exit__` the old code never made."""
    global _checkpointer, _checkpointer_cm

    async with _checkpointer_lock:
        if _checkpointer_cm is not None:
            try:
                await _checkpointer_cm.__aexit__(None, None, None)
            except Exception:
                logger.exception("Error closing checkpointer")
            finally:
                _checkpointer = None
                _checkpointer_cm = None
                logger.info("Async Postgres checkpointer closed")

def create_id():
    return str(uuid4())

def get_llm(agent_type: str = "generation", model: str | None = None):
    """
    Builds the chat model for an agent. `agent_type` selects which model
    setting to use ("generation" for curriculum/lesson/question authoring,
    "classification" for cheap yes/no-style audit agents) so the two can be
    pointed at different models later without touching agent code.

    `model` overrides the configured choice outright. `app.ai.router` uses it to
    rebuild an agent against a fallback model when the primary model's daily
    token budget is spent.
    """
    settings = get_settings()
    classification = agent_type == "classification"
    model = model or (
        settings.ai_classification_model
        if classification
        else settings.ai_generation_model
    ) or settings.ai_default_model

    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=model,
        temperature=settings.ai_temperature,
        # Sized per agent type: `max_tokens` is counted toward the request's
        # rate-limit estimate, so giving a yes/no auditor the full generation
        # budget made small prompts exceed a small model's TPM limit.
        max_tokens=(
            settings.ai_classification_max_tokens if classification else settings.ai_max_tokens
        ),
    )

def get_config(learner_id: int,lesson_id: int):
    return {
    "configurable": {
        "thread_id": f"{learner_id}-{lesson_id}"
    }
}

def get_youtube_key():
    return os.environ.get("YOUTUBE_API_KEY")


def get_serper_key():
    return os.getenv("SERPER_API_KEY")


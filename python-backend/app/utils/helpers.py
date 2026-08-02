import asyncio
import logging
import os
from uuid import uuid4

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.ai.tasks import profile_for
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

def get_llm(task: str = "question", model: str | None = None):
    """Builds the chat model for one task.

    `task` names the job, not a tier -- "lesson", "curriculum", "question",
    "tutor", "lesson_audit", "document_audit" -- and selects that task's
    provider, model, completion budget and temperature from `app.ai.tasks`. The
    two legacy names ("generation", "classification") still resolve, via the
    aliases there.

    `model` overrides the configured choice outright. `app.ai.router` uses it to
    rebuild an agent against a fallback model when the primary is rate limited
    or its upstream provider is down.

    One client class for every provider: OpenRouter, Groq and Google's
    compatibility layer all speak the OpenAI chat-completions API, so Gemini and
    Llama arrive through the same `ChatOpenAI` and differ only by base URL, key
    and slug. That is the property the per-task table depends on -- moving a
    task to a different company is a settings change, never a client change.
    """
    settings = get_settings()
    profile = profile_for(task, settings)
    provider = profile.provider

    key = provider.api_key()
    if not key:
        raise RuntimeError(
            f"The '{profile.name}' task is configured for provider "
            f"'{provider.name}', but none of {', '.join(provider.key_env)} is "
            f"set. Set one, or point ai_{profile.name}_provider elsewhere."
        )

    return ChatOpenAI(
        api_key=key,
        base_url=provider.base_url,
        model=model or profile.model,
        temperature=profile.temperature,
        # Sized per task: a document auditor returning one boolean has no use
        # for a lesson's 16k budget, and on providers that bill reserved output
        # or count it toward a rate-limit estimate, asking for it is a real cost.
        max_tokens=profile.max_tokens,
        # OpenRouter's attribution headers, and only OpenRouter's -- they make a
        # generation run identifiable on its activity dashboard when several
        # services share one key. Sent to that provider alone, since Groq and
        # Google have no use for them.
        default_headers=(
            {
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": settings.openrouter_app_name,
            }
            if provider.name == "openrouter"
            else None
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


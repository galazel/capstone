import asyncio
import logging
import os
from uuid import uuid4

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.ai.tasks import profile_for
from app.core.config import get_settings

logger = logging.getLogger(__name__)

load_dotenv()

# psycopg's raw conninfo parser doesn't understand SQLAlchemy dialect
# suffixes (postgresql+psycopg://) -- only the plain postgresql:// scheme --
# so strip it before handing the URL to the checkpointer.
connection_string = (os.getenv("DATABASE_URL") or "").replace("postgresql+psycopg://", "postgresql://")

_checkpointer = None
_checkpointer_pool = None
_checkpointer_lock = asyncio.Lock()


async def get_checkpointer():
    """Async checkpointer, backed by a connection pool rather than one
    connection held for the whole process.

    A single long-lived connection (the previous implementation) has no way
    to recover once the server drops it -- a managed Postgres suspending its
    compute on idle (Neon's default behavior), a network blip, a restart,
    anything. Every checkpoint read/write after that fails with the same
    `OperationalError: server closed the connection unexpectedly` for the
    rest of the process's life, which is exactly what took the tutor down:
    one dropped connection turned into a permanent outage until redeploy.

    A pool borrows a fresh connection per operation and health-checks it
    first (`check=AsyncConnectionPool.check_connection`), so a dead
    connection gets quietly replaced instead of failing every request behind
    it. `AsyncPostgresSaver` accepts a pool directly in place of a raw
    connection -- see `langgraph.checkpoint.postgres._ainternal.get_connection`,
    which already branches on `isinstance(conn, AsyncConnectionPool)`.

    The lock matters: without it two concurrent first-requests can both see
    `None` and each open their own pool, leaking one of them.
    """
    global _checkpointer, _checkpointer_pool

    if _checkpointer is not None:
        return _checkpointer

    async with _checkpointer_lock:
        if _checkpointer is None:
            pool = AsyncConnectionPool(
                conninfo=connection_string,
                kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
                min_size=1,
                max_size=5,
                check=AsyncConnectionPool.check_connection,
                open=False,
            )
            await pool.open(wait=True)
            checkpointer = AsyncPostgresSaver(conn=pool)
            await checkpointer.setup()
            _checkpointer_pool = pool
            _checkpointer = checkpointer
            logger.info("Async Postgres checkpointer initialised (pooled)")

    return _checkpointer


async def close_checkpointer() -> None:
    """Closes the checkpointer's connection pool. Called from the FastAPI
    lifespan shutdown."""
    global _checkpointer, _checkpointer_pool

    async with _checkpointer_lock:
        if _checkpointer_pool is not None:
            try:
                await _checkpointer_pool.close()
            except Exception:
                logger.exception("Error closing checkpointer pool")
            finally:
                _checkpointer = None
                _checkpointer_pool = None
                logger.info("Async Postgres checkpointer pool closed")

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


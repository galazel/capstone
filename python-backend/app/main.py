from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes import certification as certification_routes
from app.api.routes import question_bank as question_bank_routes
from app.api.routes import workflow_stream as workflow_stream_routes
from app.api.routes import workflows as workflow_routes
from app.api.ws import workflows as workflow_ws
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.messaging.registry import build_consumer_manager
from app.services import run_recovery
from app.utils.helpers import close_checkpointer

settings = get_settings()
configure_logging(settings.debug)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_directories()

    consumer_manager = build_consumer_manager()
    try:
        await consumer_manager.start()
    except Exception:
        # Never block the API server on the broker being unreachable --
        # matches backend-java's producers, which log and move on instead of
        # failing the request/startup path.
        logger.exception("Failed to start RabbitMQ consumers; API will run without them")

    # Generation runs are asyncio tasks in this process, so every run in flight
    # when the previous one stopped was abandoned mid-step with its registry row
    # still reading RUNNING. This picks those back up -- after a grace period,
    # so RabbitMQ's own redelivery gets first refusal on the runs it owns.
    recovery = asyncio.create_task(run_recovery.run_forever(), name="run-recovery")

    yield

    recovery.cancel()
    with suppress(asyncio.CancelledError):
        await recovery

    await consumer_manager.stop()
    # Releases the LangGraph checkpointer's Postgres connection. The previous
    # sync checkpointer entered its context manager and never exited it, so
    # the connection was held for the process lifetime.
    await close_checkpointer()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Bayesian Knowledge Tracing microservice for Rebyu. It trains pyBKT "
            "models, stores lesson parameters, and updates learner mastery in real time."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    # AI generation routes (certification/lesson/question) live under their
    # own /api/v1/ai prefix, separate from the BKT service's /api/v1/bkt
    # prefix baked into api_router.
    app.include_router(certification_routes.router, prefix="/api/v1/ai")
    app.include_router(question_bank_routes.router, prefix="/api/v1/ai")
    # Run registry: what is running, what is paused for review, what happened.
    app.include_router(workflow_routes.router, prefix="/api/v1/ai")
    # Live timeline as SSE -- what the Java gateway relays to browsers. Shares
    # its implementation with the websocket below via app.api.ws.stream.
    app.include_router(workflow_stream_routes.router, prefix="/api/v1/ai")
    # The same timeline over a websocket, for internal consumers and tests.
    # Mounted at the root: websocket clients pass the service key as ?key=
    # because browsers cannot set handshake headers.
    app.include_router(workflow_ws.router)

    @app.get("/", tags=["service"])
    def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
        }

    return app


app = create_app()
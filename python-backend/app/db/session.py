from __future__ import annotations

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine_kwargs: dict[str, object] = {
    "echo": settings.sql_echo,
    "pool_pre_ping": True,
}
if not settings.database_url.startswith("sqlite"):
    engine_kwargs.update(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
    )

_POOLER_HINTS = ("-pooler.", "pgbouncer")

if any(hint in settings.database_url for hint in _POOLER_HINTS):
    # Transaction-mode poolers (Neon's `-pooler` endpoint, PgBouncer, RDS Proxy)
    # are not usable by this service, and the way they fail is slow to diagnose:
    #
    #   * they reject libpq startup options, so `-csearch_path=...` errors on
    #     connect;
    #   * a session-level `SET search_path` does not stick, because the next
    #     transaction can land on a different server connection -- queries then
    #     fail with `relation "workflow_runs" does not exist` even though the
    #     table is right there;
    #   * LangGraph's AsyncPostgresSaver uses prepared statements, which
    #     transaction pooling breaks outright.
    #
    # None of that surfaces as "you are using the wrong endpoint", so warn
    # loudly at import rather than letting it look like a missing migration.
    logging.getLogger(__name__).warning(
        "DATABASE_URL points at a connection pooler. This service needs a direct "
        "connection -- remove '-pooler' from the host. Symptoms otherwise: "
        "'unsupported startup parameter', missing-table errors for tables that "
        "exist, and checkpointer failures."
    )

engine = create_engine(settings.database_url, **engine_kwargs)


if not settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_search_path(dbapi_connection, _record) -> None:
        """Resolve unqualified table names to our schema first.

        This service shares a database with the main Rebyu backend, so its
        tables (bkt_model_runs, workflow_runs, learner_lesson_mastery) must not
        collide with anything Java owns in `public`. `public` stays second so
        reads that cross into Java-owned tables and views still resolve.

        Issued as a statement after connecting rather than as a libpq startup
        parameter (`-csearch_path=...`). Connection poolers -- Neon's pooled
        endpoint, PgBouncer, RDS Proxy -- reject unknown startup options
        outright:

            ERROR: unsupported startup parameter in options: search_path

        which made every query fail against a pooled URL. Since the pooled host
        is usually the one in a deployment's connection string, that took the
        whole service down: no BKT writes, and no generation runs for the
        workspace to show. A post-connect SET works on both.
        """
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f"SET search_path TO {settings.db_schema}, public")
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

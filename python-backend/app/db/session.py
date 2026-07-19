from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
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
        # Resolve every unqualified table name to our own schema first, so this
        # service can share a database with the main Rebyu backend without its
        # tables (e.g. bkt_model_runs, learner_lesson_mastery) colliding with
        # anything Java owns in `public`. `public` stays second so reads that
        # cross into Java-owned tables/views (like the training data view)
        # still resolve normally.
        connect_args={"options": f"-csearch_path={settings.db_schema},public"},
    )

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

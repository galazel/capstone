from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app

# Register all models before create_all.
from app.db import models  # noqa: F401,E402


@pytest.fixture(autouse=True)
def disable_service_key_auth():
    """Tests exercise business endpoints, not auth.

    `require_service_key` enforces the header whenever `service_api_key` is
    non-empty, and the developer `.env` sets one -- so without this the whole
    API suite 401s depending on ambient environment state rather than on
    anything the tests control.
    """
    settings = get_settings()
    original = settings.service_api_key
    settings.service_api_key = ""
    yield
    settings.service_api_key = original


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Our tables are schema-qualified (`bkt.workflow_runs`) so that queries do
    # not depend on `search_path`, which is session state and silently fails to
    # apply through connection poolers. SQLite has no schemas, but an ATTACHed
    # database serves the same syntax -- so tests exercise the *same* qualified
    # SQL that runs against Postgres instead of an unqualified variant that
    # would hide exactly the bug this qualification exists to prevent.
    schema = Base.metadata.schema
    if schema:
        @event.listens_for(engine, "connect")
        def _attach_schema(dbapi_connection, _record):
            dbapi_connection.execute(f"ATTACH DATABASE ':memory:' AS {schema}")

        # StaticPool reuses one connection, and it was opened before the
        # listener was registered.
        engine.dispose()

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    try:
        yield factory
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def db(session_factory) -> Generator[Session, None, None]:
    with session_factory() as session:
        yield session


@pytest.fixture()
def client(session_factory) -> Generator[TestClient, None, None]:
    app = create_app()

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

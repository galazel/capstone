from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for this service's own tables.

    Every table is bound to our schema explicitly, so SQLAlchemy emits
    `bkt.workflow_runs` rather than a bare `workflow_runs`.

    This used to rely on `search_path` instead, which is *session* state and
    turned out to be the wrong thing to depend on. It fails in ways that look
    like a missing migration rather than a configuration problem:

      * passed as a libpq startup option, connection poolers reject it outright;
      * issued as a post-connect `SET`, it does not survive a transaction-mode
        pooler, because the next transaction can land on a different server
        connection that never received it;
      * either way the symptom is `relation "workflow_runs" does not exist` for
        a table that is demonstrably present, which sends you looking at Alembic
        rather than at the connection.

    Qualifying the tables removes the dependency: the query names the schema, so
    no session state has to be correct for it to resolve. Java-owned tables are
    unaffected -- they already declare `MetaData(schema="public")` in
    `java_tables.py`.
    """

    # SQLite (the test database) has no schemas, so qualifying there would
    # produce `bkt.workflow_runs` against a database that cannot have it.
    # `test_schema_qualification` covers the Postgres shape directly instead.
    metadata = MetaData(
        schema=None
        if get_settings().database_url.startswith("sqlite")
        else get_settings().db_schema
    )

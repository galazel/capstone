"""Creates the BKT training view at startup.

The view (`rebyu_bkt_training_data_v`) is what the training pipeline reads
learner responses through. It lives in `sql/create_training_view.sql`, and
until now nothing ever ran that file: it had to be applied by hand against
every database, and on any database where nobody had, training failed with

    relation "rebyu_bkt_training_data_v" does not exist

which is exactly how the 2026-08-29 training run died. A file that must be
remembered is a file that will be forgotten -- especially after a database is
dropped and recreated, when everything else comes back on its own.

Two properties make running this at startup safe:

*   It is `CREATE OR REPLACE`, so applying it on every boot is a no-op once the
    view matches, and an automatic repair when the definition has changed.
*   It reads tables owned by the Java backend (`learner_exam_details`,
    `exam_questions`, `questions`, `exams`, `exam_types`), which Hibernate
    creates with `ddl-auto: update`. On a freshly wiped database this service
    can easily start first, so a failure here is expected rather than
    exceptional: it is logged and swallowed, and the next restart -- or the
    next deploy -- creates the view once those tables exist.

Never raises. A missing analytics view must not stop the API from serving.
"""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

logger = logging.getLogger(__name__)

#: `app/db/training_view.py` -> `python-backend/sql/create_training_view.sql`
_SQL_PATH = Path(__file__).resolve().parents[2] / "sql" / "create_training_view.sql"


def ensure_training_view() -> bool:
    """Applies the training view DDL. Returns whether it is now in place."""
    try:
        ddl = _SQL_PATH.read_text(encoding="utf-8")
    except OSError:
        logger.warning(
            "Could not read %s; the BKT training view will not be created. "
            "Training will fail until it is applied by hand.",
            _SQL_PATH,
        )
        return False

    try:
        with engine.begin() as connection:
            # exec_driver_sql: the file holds several statements (the view and
            # its COMMENT), which SQLAlchemy's text() will not split.
            connection.exec_driver_sql(ddl)
    except Exception as error:
        # Overwhelmingly this is "the Java backend has not created its tables
        # yet" on a fresh database. Said at warning rather than exception
        # because it is self-correcting on the next start.
        logger.warning(
            "Could not create the BKT training view (%s). This is expected on a "
            "fresh database before the Java backend has created its tables; it "
            "will be retried on the next start.",
            error,
        )
        return False

    logger.info("BKT training view is present.")
    return True

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    BktModelArtifact,
    BktModelRun,
    BktParameter,
    BktParameterClass,
    LearnerLessonMastery,
    LearnerLessonMasteryHistory,
)


def get_run(session: Session, run_id: str) -> BktModelRun | None:
    return session.get(BktModelRun, run_id)


def list_runs(session: Session, *, limit: int = 50, offset: int = 0) -> tuple[list[BktModelRun], int]:
    total = session.scalar(select(func.count()).select_from(BktModelRun)) or 0
    items = list(
        session.scalars(
            select(BktModelRun)
            .order_by(BktModelRun.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return items, int(total)


def get_lesson_parameters(
    session: Session, lesson_id: int
) -> tuple[BktParameter | None, list[BktParameterClass]]:
    aggregate = session.get(BktParameter, lesson_id)
    classes = list(
        session.scalars(
            select(BktParameterClass)
            .where(BktParameterClass.lesson_id == lesson_id)
            .order_by(BktParameterClass.parameter_name, BktParameterClass.class_name)
        )
    )
    return aggregate, classes


def get_active_artifact(session: Session) -> BktModelArtifact | None:
    return session.scalar(
        select(BktModelArtifact)
        .where(BktModelArtifact.is_active.is_(True))
        .order_by(BktModelArtifact.created_at.desc())
        .limit(1)
    )


def list_learner_mastery(
    session: Session,
    learner_id: int,
    *,
    lesson_ids: list[int] | None = None,
) -> list[LearnerLessonMastery]:
    statement = select(LearnerLessonMastery).where(
        LearnerLessonMastery.learner_id == learner_id
    )
    if lesson_ids:
        statement = statement.where(LearnerLessonMastery.lesson_id.in_(lesson_ids))
    return list(session.scalars(statement.order_by(LearnerLessonMastery.lesson_id)))


def list_mastery_history(
    session: Session,
    learner_id: int,
    certification_id: int,
    *,
    limit: int = 100,
) -> list[LearnerLessonMasteryHistory]:
    """Return the most recent history rows, oldest-first, ready for a trend chart."""
    statement = (
        select(LearnerLessonMasteryHistory)
        .where(
            LearnerLessonMasteryHistory.learner_id == learner_id,
            LearnerLessonMasteryHistory.certification_id == certification_id,
        )
        .order_by(LearnerLessonMasteryHistory.created_at.desc())
        .limit(limit)
    )
    return list(reversed(list(session.scalars(statement))))


def any_active_training(session: Session) -> bool:
    return bool(
        session.scalar(
            select(func.count())
            .select_from(BktModelRun)
            .where(BktModelRun.status.in_(["queued", "running"]))
        )
    )


def deactivate_artifacts(session: Session, except_run_id: str | None = None) -> None:
    artifacts = list(session.scalars(select(BktModelArtifact).where(BktModelArtifact.is_active.is_(True))))
    for artifact in artifacts:
        if except_run_id is None or artifact.model_run_id != except_run_id:
            artifact.is_active = False


def utc_or_now(value: datetime | None) -> datetime:
    from datetime import timezone

    return value or datetime.now(timezone.utc)

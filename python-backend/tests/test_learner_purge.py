from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.models import (
    BktMasteryEvent,
    BktProcessedEvent,
    LearnerCategoryPriority,
    LearnerCategoryPriorityHistory,
    LearnerLessonMastery,
    LearnerLessonMasteryHistory,
)

PURGE_URL = "/api/v1/bkt/mastery/learners/{learner_id}"

# The router is gated by require_service_key; send whatever key the running
# settings expect so these tests pass regardless of SERVICE_API_KEY being set.
AUTH_HEADERS = {"X-Service-Key": get_settings().service_api_key}

ALL_MODELS = (
    BktMasteryEvent,
    BktProcessedEvent,
    LearnerLessonMasteryHistory,
    LearnerCategoryPriorityHistory,
    LearnerCategoryPriority,
    LearnerLessonMastery,
)


def _seed_all_tables(session_factory, learner_id: int, *, suffix: str) -> None:
    now = datetime(2026, 7, 1, tzinfo=timezone.utc)
    with session_factory() as session:
        session.add(
            BktMasteryEvent(
                source_event_id=f"evt-{suffix}",
                learner_id=learner_id,
                lesson_id=101,
                question_id=1,
                is_correct=True,
                difficulty_level="AVERAGE",
                assessment_type="LESSON_QUIZ",
                mastery_before=0.3,
                mastery_posterior=0.4,
                mastery_after=0.4,
                predicted_correct_probability=0.5,
                parameters_used={"p": 0.1},
                occurred_at=now,
            )
        )
        session.add(
            BktProcessedEvent(
                event_id=f"proc-{suffix}",
                learner_id=learner_id,
                payload_hash=f"hash-{suffix}",
            )
        )
        session.add(
            LearnerLessonMasteryHistory(
                learner_id=learner_id,
                certification_id=10,
                lesson_id=101,
                previous_mastery=0.3,
                observation_posterior=0.4,
                final_mastery=0.4,
                previous_mastery_level="developing",
                new_mastery_level="good",
                observed_correct=True,
                assessment_type="LESSON_QUIZ",
                difficulty_level="AVERAGE",
                created_at=now,
            )
        )
        session.add(
            LearnerCategoryPriorityHistory(
                learner_id=learner_id,
                certification_id=10,
                category_type="LESSON",
                category_id=101,
            )
        )
        session.add(
            LearnerCategoryPriority(
                learner_id=learner_id,
                certification_id=10,
                category_type="LESSON",
                category_key=f"LESSON:{suffix}",
                priority_score=1.0,
                priority_tag="HIGH",
                priority_label="High priority",
            )
        )
        session.add(
            LearnerLessonMastery(
                learner_id=learner_id,
                lesson_id=101,
                mastery_probability=0.4,
                mastery_level="developing",
            )
        )
        session.commit()


def _row_count(session_factory, model, learner_id: int) -> int:
    with session_factory() as session:
        return session.scalar(
            select(func.count()).select_from(model).where(model.learner_id == learner_id)
        ) or 0


def test_purge_deletes_all_six_tables_for_learner(client, session_factory) -> None:
    _seed_all_tables(session_factory, learner_id=1, suffix="a")

    response = client.delete(PURGE_URL.format(learner_id=1), headers=AUTH_HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()

    expected_tables = {
        "bkt_mastery_events",
        "bkt_processed_events",
        "learner_lesson_mastery_history",
        "learner_category_priority_history",
        "learner_category_priorities",
        "learner_lesson_mastery",
    }
    assert set(body.keys()) == expected_tables
    for table, count in body.items():
        assert count >= 1, f"expected at least 1 deleted row for {table}, got {count}"

    for model in ALL_MODELS:
        assert _row_count(session_factory, model, 1) == 0


def test_purge_does_not_touch_other_learners(client, session_factory) -> None:
    _seed_all_tables(session_factory, learner_id=1, suffix="a")
    _seed_all_tables(session_factory, learner_id=2, suffix="b")

    response = client.delete(PURGE_URL.format(learner_id=1), headers=AUTH_HEADERS)
    assert response.status_code == 200, response.text

    for model in ALL_MODELS:
        assert _row_count(session_factory, model, 1) == 0
        assert _row_count(session_factory, model, 2) == 1


def test_purge_is_idempotent_for_unknown_learner(client) -> None:
    response = client.delete(PURGE_URL.format(learner_id=999999), headers=AUTH_HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert all(count == 0 for count in body.values())

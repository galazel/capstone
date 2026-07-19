from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import pytest

from app.db.models import BktMasteryEvent
from app.services.pybkt_runtime import PyBktScoringError, score_with_pybkt


class _RecordingFakeModel:
    """Stands in for a fitted pyBKT Model: records the frame it was given and
    returns deterministic, distinguishable per-row predictions so the test can
    assert exactly which row the runtime reads for each output value."""

    def __init__(self, state_predictions: list[float], correct_predictions: list[float]) -> None:
        self.state_predictions = state_predictions
        self.correct_predictions = correct_predictions
        self.calls: list[pd.DataFrame] = []

    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        self.calls.append(data.copy())
        frame = data.copy()
        frame["state_predictions"] = self.state_predictions
        frame["correct_predictions"] = self.correct_predictions
        return frame


def _seed_event(session, *, learner_id: int, lesson_id: int, is_correct: bool, occurred_at: datetime) -> None:
    session.add(
        BktMasteryEvent(
            source_event_id=f"seed:{learner_id}:{lesson_id}:{occurred_at.isoformat()}",
            learner_id=learner_id,
            lesson_id=lesson_id,
            is_correct=is_correct,
            difficulty_level="AVERAGE",
            assessment_type="LESSON_QUIZ",
            mastery_before=0.3,
            mastery_posterior=0.3,
            mastery_after=0.3,
            predicted_correct_probability=0.3,
            parameters_used={
                "prior": 0.3,
                "learn": 0.2,
                "guess": 0.25,
                "slip": 0.1,
                "forget": 0.0,
                "model_variant": "seed",
            },
            occurred_at=occurred_at,
            processed_at=occurred_at,
        )
    )
    session.commit()


def test_score_with_pybkt_replays_history_and_reads_correct_rows(db) -> None:
    _seed_event(
        db,
        learner_id=1,
        lesson_id=555,
        is_correct=True,
        occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    # 1 prior event + 1 new observation + 1 placeholder row = 3 rows.
    model = _RecordingFakeModel(
        state_predictions=[0.10, 0.20, 0.30],
        correct_predictions=[0.15, 0.25, 0.35],
    )

    score = score_with_pybkt(
        db,
        model,
        learner_id=1,
        lesson_id=555,
        is_correct=False,
        difficulty_level="hard",
        assessment_type="lesson-quiz",
    )

    assert len(model.calls) == 1
    frame = model.calls[0]
    assert list(frame["attempt_order"]) == [1, 2, 3]
    assert list(frame["learner_id"]) == ["1", "1", "1"]
    assert list(frame["skill_name"]) == ["555", "555", "555"]
    # Row 1 is the seeded history, row 2 is the new (incorrect) observation,
    # row 3 is the discarded placeholder.
    assert list(frame["is_correct"]) == [1, 0, 0]
    assert list(frame["difficulty_level"]) == ["AVERAGE", "HARD", "HARD"]
    assert list(frame["assessment_type"]) == ["LESSON_QUIZ", "LESSON_QUIZ", "LESSON_QUIZ"]

    # state_predictions/correct_predictions for the NEW row (index 1) describe
    # the observation just submitted; the placeholder row (index 2) exposes
    # the post-transition mastery.
    assert score.mastery_before == pytest.approx(0.20)
    assert score.predicted_correct_probability == pytest.approx(0.25)
    assert score.mastery_after == pytest.approx(0.30)


def test_score_with_pybkt_with_no_prior_history(db) -> None:
    model = _RecordingFakeModel(
        state_predictions=[0.30, 0.45],
        correct_predictions=[0.41, 0.50],
    )

    score = score_with_pybkt(
        db,
        model,
        learner_id=2,
        lesson_id=777,
        is_correct=True,
        difficulty_level="EASY",
        assessment_type="MOCK_EXAM",
    )

    frame = model.calls[0]
    assert list(frame["attempt_order"]) == [1, 2]
    assert score.mastery_before == pytest.approx(0.30)
    assert score.predicted_correct_probability == pytest.approx(0.41)
    assert score.mastery_after == pytest.approx(0.45)


def test_score_with_pybkt_raises_on_predict_failure(db) -> None:
    class _ExplodingModel:
        def predict(self, data: pd.DataFrame) -> pd.DataFrame:
            raise RuntimeError("native pyBKT crash")

    with pytest.raises(PyBktScoringError):
        score_with_pybkt(
            db,
            _ExplodingModel(),
            learner_id=3,
            lesson_id=1,
            is_correct=True,
            difficulty_level="AVERAGE",
            assessment_type="LESSON_QUIZ",
        )


def test_score_with_pybkt_raises_when_columns_missing(db) -> None:
    class _MalformedModel:
        def predict(self, data: pd.DataFrame) -> pd.DataFrame:
            return data.copy()

    with pytest.raises(PyBktScoringError):
        score_with_pybkt(
            db,
            _MalformedModel(),
            learner_id=4,
            lesson_id=1,
            is_correct=True,
            difficulty_level="AVERAGE",
            assessment_type="LESSON_QUIZ",
        )

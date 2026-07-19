from __future__ import annotations

from datetime import datetime, timezone

import joblib
import pandas as pd
import pytest

from app.db.models import BktModelArtifact, BktModelRun, BktParameter
from app.services import pybkt_runtime


class _FakeFittedPybktModel:
    """A minimal stand-in for a joblib-persisted, fitted pyBKT Model.

    Runs the same Corbett-Anderson forward pass pyBKT itself implements, but
    with one fixed global parameter set and no native dependency, so these
    tests can assert exact numbers without requiring the real compiled
    pyBKT wheel.
    """

    def __init__(self, trained_skills: list[str], *, prior=0.3, learn=0.3, guess=0.2, slip=0.1, forget=0.0):
        self.trained_skills = trained_skills
        self.prior = prior
        self.learn = learn
        self.guess = guess
        self.slip = slip
        self.forget = forget

    def params(self) -> pd.DataFrame:
        index = pd.MultiIndex.from_tuples(
            [(skill, "prior", "default") for skill in self.trained_skills],
            names=["skill", "param", "class"],
        )
        return pd.DataFrame({"value": [self.prior] * len(self.trained_skills)}, index=index)

    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        frame = data.sort_values(["learner_id", "skill_name", "attempt_order"]).copy()
        states: list[float] = []
        corrects: list[float] = []
        for _, group in frame.groupby(["learner_id", "skill_name"], sort=False):
            state = self.prior
            for _, row in group.iterrows():
                states.append(state)
                corrects.append(state * (1 - self.slip) + (1 - state) * self.guess)
                if int(row["is_correct"]) == 1:
                    numerator = state * (1 - self.slip)
                    denominator = numerator + (1 - state) * self.guess
                else:
                    numerator = state * self.slip
                    denominator = numerator + (1 - state) * (1 - self.guess)
                posterior = numerator / denominator
                state = posterior * (1 - self.forget) + (1 - posterior) * self.learn
        frame["state_predictions"] = states
        frame["correct_predictions"] = corrects
        return frame


class _ExplodingModel:
    """A fake fitted model whose predict() simulates a native pyBKT crash.

    Defined at module level (not nested in a test function) so joblib/pickle
    can actually serialize and deserialize it round-trip, matching how a real
    joblib-persisted artifact is loaded.
    """

    def params(self) -> pd.DataFrame:
        index = pd.MultiIndex.from_tuples([("303", "prior", "default")], names=["skill", "param", "class"])
        return pd.DataFrame({"value": [0.3]}, index=index)

    def predict(self, data: pd.DataFrame) -> pd.DataFrame:
        raise RuntimeError("simulated native crash")


def _activate_artifact(session, tmp_path, model, *, variant="fake_full_rebyu"):
    run = BktModelRun(model_variant=variant)
    session.add(run)
    session.commit()

    model_path = tmp_path / f"{run.model_run_id}.joblib"
    joblib.dump(model, model_path)

    session.add(
        BktModelArtifact(
            model_run_id=run.model_run_id,
            model_variant=variant,
            artifact_path=str(model_path),
            sha256="0" * 64,
            is_active=True,
        )
    )
    session.commit()
    pybkt_runtime.invalidate_model_cache()


def test_trained_lesson_is_scored_by_pybkt(client, session_factory, tmp_path) -> None:
    with session_factory() as session:
        model = _FakeFittedPybktModel(trained_skills=["202"])
        _activate_artifact(session, tmp_path, model)

    payload = {
        "source_event_id": "pybkt-e2e:1",
        "learner_id": 555,
        "lesson_id": 202,
        "is_correct": True,
        "difficulty_level": "AVERAGE",
        "assessment_type": "LESSON_QUIZ",
        "occurred_at": "2026-07-18T12:00:00+00:00",
    }
    response = client.post("/api/v1/bkt/mastery/events", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()

    # prior=0.3, guess=0.2, slip=0.1, learn=0.3, forget=0.0, observed correct.
    assert body["mastery_before"] == pytest.approx(0.3)
    assert body["predicted_correct_probability"] == pytest.approx(0.41)
    assert body["mastery_after"] == pytest.approx(0.7609756097561, rel=1e-6)

    # A second event for the SAME learner+lesson replays the full history, so
    # its mastery_before must equal the first event's mastery_after.
    second_payload = {
        **payload,
        "source_event_id": "pybkt-e2e:2",
        "is_correct": False,
        "occurred_at": "2026-07-18T12:05:00+00:00",
    }
    second = client.post("/api/v1/bkt/mastery/events", json=second_payload)
    assert second.status_code == 200, second.text
    second_body = second.json()
    assert second_body["mastery_before"] == pytest.approx(body["mastery_after"], rel=1e-6)


def test_untrained_lesson_falls_back_even_with_active_artifact(client, session_factory, tmp_path) -> None:
    with session_factory() as session:
        model = _FakeFittedPybktModel(trained_skills=["202"])  # lesson 909 is NOT in this list
        _activate_artifact(session, tmp_path, model)

    response = client.post(
        "/api/v1/bkt/mastery/events",
        json={
            "source_event_id": "pybkt-e2e:fallback",
            "learner_id": 1,
            "lesson_id": 909,
            "is_correct": True,
            "difficulty_level": "AVERAGE",
            "assessment_type": "LESSON_QUIZ",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["parameters_used"]["model_variant"] == "fallback"
    assert body["parameters_used"]["prior"] == 0.30


def test_pybkt_predict_failure_falls_back_to_parameters(client, session_factory, tmp_path) -> None:
    with session_factory() as session:
        _activate_artifact(session, tmp_path, _ExplodingModel(), variant="broken")
        now = datetime.now(timezone.utc)
        session.add(
            BktParameter(
                lesson_id=303,
                prior_probability=0.30,
                learn_probability=0.20,
                guess_probability=0.25,
                slip_probability=0.10,
                forget_probability=0.00,
                model_variant="broken",
                last_trained_at=now,
            )
        )
        session.commit()

    response = client.post(
        "/api/v1/bkt/mastery/events",
        json={
            "source_event_id": "pybkt-e2e:explode",
            "learner_id": 1,
            "lesson_id": 303,
            "is_correct": True,
            "difficulty_level": "AVERAGE",
            "assessment_type": "LESSON_QUIZ",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["mastery_after"] > 0.30

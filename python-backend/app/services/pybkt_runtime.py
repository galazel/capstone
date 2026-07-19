from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import joblib
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import BktMasteryEvent
from app.ml.pipeline import normalize_assessment_type, normalize_difficulty
from app.repositories.bkt import get_active_artifact

LOGGER = logging.getLogger(__name__)


class PyBktScoringError(RuntimeError):
    """Raised when the fitted pyBKT model cannot score an event.

    Callers should catch this and fall back to the parameter-based estimate
    rather than let a library/artifact quirk break assessment submission.
    """


@dataclass(frozen=True)
class PyBktScore:
    mastery_before: float
    predicted_correct_probability: float
    mastery_after: float


class _ModelCache:
    """Caches the deserialized, fitted pyBKT Model keyed by active artifact id.

    The model is a fitted ``pyBKT.models.Model`` produced offline by
    ``app.ml.pipeline`` and persisted as a joblib artifact. It only needs to be
    reloaded when training produces a new active artifact.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._artifact_id: str | None = None
        self._model: object | None = None
        self._model_variant: str | None = None
        self._trained_skills: frozenset[str] = frozenset()

    def get(self, session: Session) -> tuple[object | None, frozenset[str], str | None]:
        artifact = get_active_artifact(session)
        if artifact is None:
            return None, frozenset(), None

        with self._lock:
            if self._artifact_id == artifact.artifact_id:
                return self._model, self._trained_skills, self._model_variant

            try:
                model = joblib.load(artifact.artifact_path)
            except (OSError, EOFError, ValueError):
                LOGGER.exception(
                    "Could not load active BKT model artifact from %s",
                    artifact.artifact_path,
                )
                return None, frozenset(), None

            trained_skills = _trained_skill_names(model)
            self._artifact_id = artifact.artifact_id
            self._model = model
            self._model_variant = artifact.model_variant
            self._trained_skills = trained_skills
            return model, trained_skills, artifact.model_variant

    def invalidate(self) -> None:
        with self._lock:
            self._artifact_id = None
            self._model = None
            self._trained_skills = frozenset()
            self._model_variant = None


_cache = _ModelCache()


def invalidate_model_cache() -> None:
    """Force the next scoring call to reload the active artifact from disk.

    Call this right after a training run activates a new artifact so the very
    next assessment event picks up the freshly trained model instead of an
    in-memory copy of the previous one.
    """
    _cache.invalidate()


def _trained_skill_names(model: object) -> frozenset[str]:
    try:
        params = model.params()
        return frozenset(str(name) for name in params.index.get_level_values(0))
    except Exception:  # defensive: never let a params() shape quirk crash scoring
        LOGGER.exception("Could not read trained skill list from the pyBKT model")
        return frozenset()


def get_scoring_model(session: Session) -> tuple[object | None, frozenset[str], str | None]:
    """Return (fitted model, trained skill names, model_variant) for the active artifact.

    Returns (None, frozenset(), None) when there is no active training run yet,
    so the caller can fall back to parameter-based scoring for a cold-start
    lesson.
    """
    return _cache.get(session)


def score_with_pybkt(
    session: Session,
    model: object,
    *,
    learner_id: int,
    lesson_id: int,
    is_correct: bool,
    difficulty_level: str,
    assessment_type: str,
) -> PyBktScore:
    """Score the newest observation by replaying the full history through pyBKT.

    pyBKT's ``Model.predict()`` always recomputes a user-skill trajectory
    starting from the skill's trained prior -- it has no API for handing it a
    single new observation plus an arbitrary starting probability. So the
    learner's committed event history for this lesson is replayed in full,
    with the new observation appended, and a placeholder row appended after
    it so the model's own forward pass exposes the post-transition mastery.
    The placeholder's correctness/class values are never read.
    """
    skill_name = str(lesson_id)
    user_id = str(learner_id)

    history = list(
        session.scalars(
            select(BktMasteryEvent)
            .where(
                BktMasteryEvent.learner_id == learner_id,
                BktMasteryEvent.lesson_id == lesson_id,
            )
            .order_by(BktMasteryEvent.occurred_at)
        )
    )

    rows: list[dict[str, object]] = [
        {
            "attempt_order": index + 1,
            "learner_id": user_id,
            "skill_name": skill_name,
            "is_correct": int(event.is_correct),
            "difficulty_level": normalize_difficulty(event.difficulty_level),
            "assessment_type": normalize_assessment_type(event.assessment_type),
        }
        for index, event in enumerate(history)
    ]

    new_row_position = len(rows) + 1
    rows.append(
        {
            "attempt_order": new_row_position,
            "learner_id": user_id,
            "skill_name": skill_name,
            "is_correct": int(is_correct),
            "difficulty_level": normalize_difficulty(difficulty_level),
            "assessment_type": normalize_assessment_type(assessment_type),
        }
    )
    rows.append(
        {
            "attempt_order": new_row_position + 1,
            "learner_id": user_id,
            "skill_name": skill_name,
            "is_correct": 0,
            "difficulty_level": normalize_difficulty(difficulty_level),
            "assessment_type": normalize_assessment_type(assessment_type),
        }
    )

    frame = pd.DataFrame(rows)

    try:
        predictions = model.predict(data=frame)
    except Exception as exc:
        raise PyBktScoringError(f"pyBKT predict() failed for lesson {lesson_id}") from exc

    if "state_predictions" not in predictions.columns or "correct_predictions" not in predictions.columns:
        raise PyBktScoringError("pyBKT predict() response is missing expected columns")

    predictions = predictions.sort_values("attempt_order").reset_index(drop=True)
    try:
        new_row = predictions.iloc[new_row_position - 1]
        after_row = predictions.iloc[new_row_position]
    except IndexError as exc:
        raise PyBktScoringError("pyBKT predict() returned fewer rows than requested") from exc

    return PyBktScore(
        mastery_before=float(new_row["state_predictions"]),
        predicted_correct_probability=float(new_row["correct_predictions"]),
        mastery_after=float(after_row["state_predictions"]),
    )

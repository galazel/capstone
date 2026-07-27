from __future__ import annotations

import argparse
import json
import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyBKT.models import Model
from sklearn.metrics import accuracy_score, mean_squared_error, roc_auc_score
from sklearn.model_selection import train_test_split

from app.core.config import get_settings

LOGGER = logging.getLogger("rebyu_bkt.ml")

REQUIRED_COLUMNS = {
    "learner_id",
    "skill_name",
    "question_id",
    "is_correct",
    "difficulty_level",
    "assessment_type",
}

COLUMN_ALIASES = {
    "result": "is_correct",
    "correct": "is_correct",
    "difficulty": "difficulty_level",
    "exam_type": "assessment_type",
    "lesson_id": "skill_name",
}

PYBKT_DEFAULTS = {
    "order_id": "attempt_order",
    "user_id": "learner_id",
    "skill_name": "skill_name",
    "correct": "is_correct",
}

FALLBACK_PARAMETERS = {
    "prior": 0.30,
    "learns": 0.20,
    "guesses": 0.25,
    "slips": 0.10,
    "forgets": 0.00,
}

# Sourced from the shared config so a standalone run of this pipeline can
# never silently disagree with the thresholds mastery_service/priority_service
# actually score learners against at runtime.
_settings = get_settings()
MASTERED_THRESHOLD = _settings.mastered_threshold
GOOD_THRESHOLD = _settings.good_threshold
DEVELOPING_THRESHOLD = _settings.developing_threshold


@dataclass(frozen=True)
class CandidateSpec:
    name: str
    kwargs: dict[str, Any]
    complexity: int


CANDIDATES = [
    CandidateSpec("simple", {}, 0),
    CandidateSpec("forgetting", {"forgets": True}, 1),
    CandidateSpec(
        "difficulty_guess_slip",
        {"multigs": "difficulty_level"},
        1,
    ),
    CandidateSpec(
        "difficulty_guess_slip_forgetting",
        {"multigs": "difficulty_level", "forgets": True},
        2,
    ),
    CandidateSpec(
        "difficulty_and_assessment_learning",
        {
            "multigs": "difficulty_level",
            "multilearn": "assessment_type",
        },
        2,
    ),
    CandidateSpec(
        "full_rebyu",
        {
            "multigs": "difficulty_level",
            "multilearn": "assessment_type",
            "forgets": True,
        },
        3,
    ),
]


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def normalize_difficulty(value: Any) -> str:
    normalized = str(value).strip().upper().replace(" ", "_")
    if normalized in {"MEDIUM", "MODERATE", "NORMAL"}:
        return "AVERAGE"
    if normalized not in {"EASY", "AVERAGE", "HARD"}:
        return "AVERAGE"
    return normalized


def normalize_assessment_type(value: Any) -> str:
    normalized = str(value).strip().upper().replace(" ", "_").replace("-", "_")
    aliases = {
        "QUIZ": "LESSON_QUIZ",
        "LESSONQUIZ": "LESSON_QUIZ",
        "MIDDLE": "MIDDLE_EXAM",
        "MIDDLEEXAM": "MIDDLE_EXAM",
        "MOCK": "MOCK_EXAM",
        "MOCKEXAM": "MOCK_EXAM",
    }
    return aliases.get(normalized, normalized or "UNKNOWN")


def load_and_prepare_dataset(path: str | Path) -> pd.DataFrame:
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(f"Training dataset was not found: {source}")

    df = pd.read_csv(source)
    return prepare_dataset(df)


def prepare_dataset(raw_df: pd.DataFrame) -> pd.DataFrame:
    if raw_df.empty:
        raise ValueError("The BKT training dataset is empty.")

    df = raw_df.copy()

    for old_name, new_name in COLUMN_ALIASES.items():
        if new_name not in df.columns and old_name in df.columns:
            df = df.rename(columns={old_name: new_name})

    missing = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing:
        raise ValueError(
            "Missing required columns: "
            + ", ".join(missing)
            + ". Expected at least: "
            + ", ".join(sorted(REQUIRED_COLUMNS))
        )

    df = df.drop_duplicates().copy()
    df["learner_id"] = df["learner_id"].astype(str).str.strip()
    df["skill_name"] = df["skill_name"].astype(str).str.strip()
    df["question_id"] = df["question_id"].astype(str).str.strip()

    df["is_correct"] = pd.to_numeric(df["is_correct"], errors="coerce")
    invalid_correctness = ~df["is_correct"].isin([0, 1])
    if invalid_correctness.any():
        LOGGER.warning(
            "Dropping %s rows whose is_correct value is not 0 or 1.",
            int(invalid_correctness.sum()),
        )
        df = df.loc[~invalid_correctness].copy()
    df["is_correct"] = df["is_correct"].astype(int)

    df["difficulty_level"] = df["difficulty_level"].map(normalize_difficulty)
    df["assessment_type"] = df["assessment_type"].map(normalize_assessment_type)

    if "answered_at" in df.columns:
        df["answered_at"] = pd.to_datetime(df["answered_at"], errors="coerce", utc=True)
    else:
        df["answered_at"] = pd.NaT

    if "attempt_order" in df.columns:
        df["attempt_order"] = pd.to_numeric(df["attempt_order"], errors="coerce")
    else:
        df["attempt_order"] = np.nan

    # Build a deterministic chronological order. answered_at is preferred; the
    # original attempt_order is used as a stable fallback.
    df["_original_row"] = np.arange(len(df), dtype=int)
    df["_time_missing"] = df["answered_at"].isna()
    df["_order_missing"] = df["attempt_order"].isna()
    df = df.sort_values(
        [
            "learner_id",
            "_time_missing",
            "answered_at",
            "_order_missing",
            "attempt_order",
            "_original_row",
        ],
        kind="mergesort",
    ).reset_index(drop=True)
    df["attempt_order"] = np.arange(1, len(df) + 1, dtype=int)
    df = df.drop(columns=["_original_row", "_time_missing", "_order_missing"])

    empty_keys = (
        df["learner_id"].eq("")
        | df["skill_name"].eq("")
        | df["question_id"].eq("")
    )
    if empty_keys.any():
        LOGGER.warning("Dropping %s rows with empty identifiers.", int(empty_keys.sum()))
        df = df.loc[~empty_keys].copy()

    if df.empty:
        raise ValueError("No valid BKT rows remain after cleaning.")

    return df.reset_index(drop=True)


def skill_quality_table(df: pd.DataFrame) -> pd.DataFrame:
    quality = (
        df.groupby("skill_name", as_index=False)
        .agg(
            interactions=("is_correct", "size"),
            learners=("learner_id", "nunique"),
            questions=("question_id", "nunique"),
            accuracy=("is_correct", "mean"),
        )
        .sort_values(["interactions", "learners"], ascending=False)
        .reset_index(drop=True)
    )
    return quality


def select_eligible_skills(
    df: pd.DataFrame,
    min_interactions_per_skill: int,
    min_learners_per_skill: int,
) -> tuple[list[str], pd.DataFrame]:
    quality = skill_quality_table(df)
    quality["eligible_for_training"] = (
        quality["interactions"].ge(min_interactions_per_skill)
        & quality["learners"].ge(min_learners_per_skill)
    )
    eligible = quality.loc[quality["eligible_for_training"], "skill_name"].astype(str).tolist()

    if not eligible:
        LOGGER.warning(
            "No skill met the minimum-data rules; all skills will be trained, "
            "but parameters may be unstable."
        )
        eligible = quality["skill_name"].astype(str).tolist()
        quality["eligible_for_training"] = True

    return eligible, quality


def split_by_learner(
    df: pd.DataFrame,
    test_size: float,
    seed: int,
) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    learners = np.array(sorted(df["learner_id"].unique()))
    if len(learners) < 5:
        LOGGER.warning(
            "Only %s learners are available. Candidate metrics will use the "
            "training data and should not be treated as generalization metrics.",
            len(learners),
        )
        return df.copy(), df.copy(), "training-data evaluation"

    train_users, test_users = train_test_split(
        learners,
        test_size=test_size,
        random_state=seed,
    )
    train_df = df[df["learner_id"].isin(train_users)].copy()
    test_df = df[df["learner_id"].isin(test_users)].copy()

    train_skills = set(train_df["skill_name"])
    unseen_test = ~test_df["skill_name"].isin(train_skills)
    if unseen_test.any():
        LOGGER.warning(
            "Dropping %s validation rows for skills absent from the training split.",
            int(unseen_test.sum()),
        )
        test_df = test_df.loc[~unseen_test].copy()

    if test_df.empty:
        LOGGER.warning("Validation split became empty; using training-data evaluation.")
        return df.copy(), df.copy(), "training-data evaluation"

    return train_df, test_df, "learner holdout"


def prediction_metrics(predictions: pd.DataFrame) -> dict[str, float]:
    valid = predictions["is_correct"].isin([0, 1]) & predictions[
        "correct_predictions"
    ].notna()
    y_true = predictions.loc[valid, "is_correct"].astype(int).to_numpy()
    y_prob = predictions.loc[valid, "correct_predictions"].astype(float).to_numpy()

    if len(y_true) == 0:
        return {"auc": math.nan, "rmse": math.nan, "accuracy": math.nan}

    rmse = float(np.sqrt(mean_squared_error(y_true, y_prob)))
    y_label = (y_prob >= 0.5).astype(int)
    accuracy = float(accuracy_score(y_true, y_label))
    auc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else math.nan
    return {"auc": auc, "rmse": rmse, "accuracy": accuracy}


def fit_candidate_models(
    train_df: pd.DataFrame,
    validation_df: pd.DataFrame,
    seed: int,
    num_fits: int,
) -> tuple[pd.DataFrame, dict[str, Model]]:
    records: list[dict[str, Any]] = []
    fitted: dict[str, Model] = {}

    for spec in CANDIDATES:
        LOGGER.info("Training candidate model: %s", spec.name)
        try:
            candidate = Model(seed=seed, num_fits=num_fits)
            candidate.fit(
                data=train_df,
                defaults=PYBKT_DEFAULTS,
                **spec.kwargs,
            )
            predictions = candidate.predict(data=validation_df)
            metrics = prediction_metrics(predictions)
            records.append(
                {
                    "model_variant": spec.name,
                    "auc": metrics["auc"],
                    "rmse": metrics["rmse"],
                    "accuracy": metrics["accuracy"],
                    "complexity": spec.complexity,
                    "status": "ok",
                    "error": "",
                }
            )
            fitted[spec.name] = candidate
        except Exception as exc:  # continue comparing viable variants
            LOGGER.exception("Candidate %s failed.", spec.name)
            records.append(
                {
                    "model_variant": spec.name,
                    "auc": math.nan,
                    "rmse": math.nan,
                    "accuracy": math.nan,
                    "complexity": spec.complexity,
                    "status": "failed",
                    "error": str(exc),
                }
            )

    comparison = pd.DataFrame(records)
    if comparison["status"].eq("ok").sum() == 0:
        raise RuntimeError("Every BKT candidate failed. Review the dataset and error column.")

    return comparison, fitted


def choose_best_variant(comparison: pd.DataFrame) -> str:
    viable = comparison[comparison["status"].eq("ok")].copy()

    if viable["auc"].notna().any():
        best_auc = viable["auc"].max()
        # Prefer a simpler model when its AUC is effectively tied.
        viable = viable[viable["auc"].ge(best_auc - 0.002)].copy()
        viable = viable.sort_values(
            ["rmse", "complexity", "auc"],
            ascending=[True, True, False],
        )
    else:
        viable = viable.sort_values(
            ["rmse", "complexity"],
            ascending=[True, True],
        )

    return str(viable.iloc[0]["model_variant"])


def get_candidate_spec(name: str) -> CandidateSpec:
    for spec in CANDIDATES:
        if spec.name == name:
            return spec
    raise KeyError(f"Unknown candidate model: {name}")


def fit_final_model(
    df: pd.DataFrame,
    variant_name: str,
    seed: int,
    num_fits: int,
) -> Model:
    spec = get_candidate_spec(variant_name)
    model = Model(seed=seed, num_fits=num_fits)
    model.fit(
        data=df,
        defaults=PYBKT_DEFAULTS,
        **spec.kwargs,
    )
    return model


def extract_parameter_classes(model: Model) -> pd.DataFrame:
    params = model.params().reset_index()
    params.columns = ["skill_name", "parameter_name", "class_name", "parameter_value"]
    params["skill_name"] = params["skill_name"].astype(str)
    params["parameter_name"] = params["parameter_name"].astype(str)
    params["class_name"] = params["class_name"].astype(str)
    params["parameter_value"] = params["parameter_value"].astype(float)
    return params


def add_fallback_parameter_rows(
    parameter_classes: pd.DataFrame,
    fallback_skills: list[str],
) -> pd.DataFrame:
    if not fallback_skills:
        return parameter_classes

    rows = []
    for skill in fallback_skills:
        for parameter_name, value in FALLBACK_PARAMETERS.items():
            rows.append(
                {
                    "skill_name": str(skill),
                    "parameter_name": parameter_name,
                    "class_name": "default",
                    "parameter_value": float(value),
                }
            )
    return pd.concat([parameter_classes, pd.DataFrame(rows)], ignore_index=True)


def parameter_lookup(parameter_classes: pd.DataFrame) -> dict[tuple[str, str, str], float]:
    return {
        (str(row.skill_name), str(row.parameter_name), str(row.class_name)): float(
            row.parameter_value
        )
        for row in parameter_classes.itertuples(index=False)
    }


def lookup_parameter(
    lookup: dict[tuple[str, str, str], float],
    skill: str,
    parameter_name: str,
    class_name: str,
) -> float:
    direct = lookup.get((skill, parameter_name, class_name))
    if direct is not None:
        return direct
    default = lookup.get((skill, parameter_name, "default"))
    if default is not None:
        return default
    return float(FALLBACK_PARAMETERS[parameter_name])


def bkt_update(
    mastery_before: float,
    is_correct: int,
    learn: float,
    guess: float,
    slip: float,
    forget: float,
) -> tuple[float, float]:
    eps = 1e-12
    p = float(np.clip(mastery_before, eps, 1 - eps))
    learn = float(np.clip(learn, 0, 1))
    guess = float(np.clip(guess, 0, 1))
    slip = float(np.clip(slip, 0, 1))
    forget = float(np.clip(forget, 0, 1))

    if int(is_correct) == 1:
        numerator = p * (1 - slip)
        denominator = numerator + (1 - p) * guess
    else:
        numerator = p * slip
        denominator = numerator + (1 - p) * (1 - guess)

    posterior = numerator / max(denominator, eps)
    mastery_after = posterior * (1 - forget) + (1 - posterior) * learn
    return float(posterior), float(np.clip(mastery_after, 0, 1))


def add_mastery_after_response(
    predictions: pd.DataFrame,
    parameter_classes: pd.DataFrame,
    variant_name: str,
) -> pd.DataFrame:
    spec = get_candidate_spec(variant_name)
    lookup = parameter_lookup(parameter_classes)
    output = predictions.copy()

    mastery_posteriors: list[float] = []
    mastery_after_values: list[float] = []

    uses_multigs = bool(spec.kwargs.get("multigs"))
    uses_multilearn = bool(spec.kwargs.get("multilearn"))
    uses_forgetting = bool(spec.kwargs.get("forgets"))

    for row in output.itertuples(index=False):
        skill = str(row.skill_name)
        guess_class = str(row.difficulty_level) if uses_multigs else "default"
        learn_class = str(row.assessment_type) if uses_multilearn else "default"
        forget_class = learn_class if uses_multilearn and uses_forgetting else "default"

        guess = lookup_parameter(lookup, skill, "guesses", guess_class)
        slip = lookup_parameter(lookup, skill, "slips", guess_class)
        learn = lookup_parameter(lookup, skill, "learns", learn_class)
        forget = (
            lookup_parameter(lookup, skill, "forgets", forget_class)
            if uses_forgetting
            else 0.0
        )

        posterior, mastery_after = bkt_update(
            mastery_before=float(row.state_predictions),
            is_correct=int(row.is_correct),
            learn=learn,
            guess=guess,
            slip=slip,
            forget=forget,
        )
        mastery_posteriors.append(posterior)
        mastery_after_values.append(mastery_after)

    output["mastery_posterior"] = mastery_posteriors
    output["mastery_after"] = mastery_after_values
    return output


def fallback_predictions(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for (_, _), group in df.groupby(["learner_id", "skill_name"], sort=False):
        mastery = FALLBACK_PARAMETERS["prior"]
        for row in group.sort_values("attempt_order").to_dict("records"):
            correct_probability = mastery * (1 - FALLBACK_PARAMETERS["slips"]) + (
                1 - mastery
            ) * FALLBACK_PARAMETERS["guesses"]
            posterior, mastery_after = bkt_update(
                mastery_before=mastery,
                is_correct=int(row["is_correct"]),
                learn=FALLBACK_PARAMETERS["learns"],
                guess=FALLBACK_PARAMETERS["guesses"],
                slip=FALLBACK_PARAMETERS["slips"],
                forget=FALLBACK_PARAMETERS["forgets"],
            )
            row["correct_predictions"] = correct_probability
            row["state_predictions"] = mastery
            row["mastery_posterior"] = posterior
            row["mastery_after"] = mastery_after
            rows.append(row)
            mastery = mastery_after
    return pd.DataFrame(rows)


def mastery_level(probability: float) -> str:
    if probability >= MASTERED_THRESHOLD:
        return "mastered"
    if probability >= GOOD_THRESHOLD:
        return "good"
    if probability >= DEVELOPING_THRESHOLD:
        return "developing"
    return "weak"


def build_latest_mastery(predictions: pd.DataFrame) -> pd.DataFrame:
    latest = (
        predictions.sort_values("attempt_order")
        .groupby(["learner_id", "skill_name"], as_index=False)
        .tail(1)
        .copy()
    )
    attempt_counts = (
        predictions.groupby(["learner_id", "skill_name"])
        .size()
        .rename("attempt_count")
        .reset_index()
    )
    latest = latest.merge(attempt_counts, on=["learner_id", "skill_name"], how="left")
    latest["mastery_probability"] = latest["mastery_after"].clip(0, 1)
    latest["mastery_level"] = latest["mastery_probability"].map(mastery_level)
    latest["lesson_id"] = latest["skill_name"]
    latest["last_updated"] = latest["answered_at"]
    latest["last_updated"] = latest["last_updated"].fillna(
        pd.Timestamp.now(tz="UTC")
    )

    columns = [
        "learner_id",
        "lesson_id",
        "mastery_probability",
        "mastery_level",
        "attempt_count",
        "is_correct",
        "correct_predictions",
        "last_updated",
    ]
    return latest[columns].sort_values(["learner_id", "lesson_id"]).reset_index(drop=True)


def aggregate_parameters_for_existing_table(
    parameter_classes: pd.DataFrame,
    variant_name: str,
    trained_at: str,
) -> pd.DataFrame:
    aggregate = (
        parameter_classes.groupby(["skill_name", "parameter_name"], as_index=False)[
            "parameter_value"
        ]
        .mean()
        .pivot(index="skill_name", columns="parameter_name", values="parameter_value")
        .reset_index()
    )
    aggregate.columns.name = None
    for parameter in ["prior", "learns", "guesses", "slips", "forgets"]:
        if parameter not in aggregate.columns:
            aggregate[parameter] = FALLBACK_PARAMETERS[parameter]
    aggregate = aggregate.rename(
        columns={
            "skill_name": "lesson_id",
            "learns": "learn_probability",
            "guesses": "guess_probability",
            "slips": "slip_probability",
            "forgets": "forget_probability",
            "prior": "prior_probability",
        }
    )
    aggregate["model_variant"] = variant_name
    aggregate["last_trained_at"] = trained_at
    return aggregate[
        [
            "lesson_id",
            "prior_probability",
            "learn_probability",
            "guess_probability",
            "slip_probability",
            "forget_probability",
            "model_variant",
            "last_trained_at",
        ]
    ]


def save_comparison_plot(comparison: pd.DataFrame, output_path: Path) -> None:
    viable = comparison[comparison["status"].eq("ok")].copy()
    if viable.empty:
        return
    viable = viable.sort_values("auc", ascending=True)
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.barh(viable["model_variant"], viable["auc"].fillna(0))
    ax.set_xlabel("Validation AUC")
    ax.set_ylabel("BKT model variant")
    ax.set_title("Rebyu BKT candidate comparison")
    ax.set_xlim(0, 1)
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def save_mastery_distribution_plot(mastery: pd.DataFrame, output_path: Path) -> None:
    counts = mastery["mastery_level"].value_counts().reindex(
        ["weak", "developing", "good", "mastered"], fill_value=0
    )
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(counts.index, counts.values)
    ax.set_xlabel("Mastery level")
    ax.set_ylabel("Learner-skill records")
    ax.set_title("Rebyu learner mastery distribution")
    fig.tight_layout()
    fig.savefig(output_path, dpi=160)
    plt.close(fig)


def run_pipeline(
    input_path: str | Path,
    output_dir: str | Path = "rebyu_bkt_outputs",
    seed: int = 42,
    num_fits: int = 2,
    test_size: float = 0.20,
    min_interactions_per_skill: int = 20,
    min_learners_per_skill: int = 3,
) -> dict[str, Any]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    df = load_and_prepare_dataset(input_path)
    eligible_skills, quality = select_eligible_skills(
        df,
        min_interactions_per_skill=min_interactions_per_skill,
        min_learners_per_skill=min_learners_per_skill,
    )

    eligible_df = df[df["skill_name"].isin(eligible_skills)].copy()
    fallback_df = df[~df["skill_name"].isin(eligible_skills)].copy()
    fallback_skills = sorted(fallback_df["skill_name"].unique().tolist())

    train_df, validation_df, evaluation_mode = split_by_learner(
        eligible_df,
        test_size=test_size,
        seed=seed,
    )

    comparison, _ = fit_candidate_models(
        train_df,
        validation_df,
        seed=seed,
        num_fits=num_fits,
    )
    best_variant = choose_best_variant(comparison)
    LOGGER.info("Selected BKT variant: %s", best_variant)

    final_model = fit_final_model(
        eligible_df,
        variant_name=best_variant,
        seed=seed,
        num_fits=num_fits,
    )

    parameter_classes = extract_parameter_classes(final_model)
    parameter_classes = add_fallback_parameter_rows(parameter_classes, fallback_skills)

    eligible_predictions = final_model.predict(data=eligible_df)
    eligible_predictions = add_mastery_after_response(
        eligible_predictions,
        parameter_classes=parameter_classes,
        variant_name=best_variant,
    )

    if fallback_df.empty:
        all_predictions = eligible_predictions
    else:
        fallback_pred = fallback_predictions(fallback_df)
        all_predictions = pd.concat(
            [eligible_predictions, fallback_pred],
            ignore_index=True,
            sort=False,
        )

    all_predictions = all_predictions.sort_values("attempt_order").reset_index(drop=True)
    latest_mastery = build_latest_mastery(all_predictions)

    trained_at = datetime.now(timezone.utc).isoformat()
    aggregate_parameters = aggregate_parameters_for_existing_table(
        parameter_classes,
        variant_name=best_variant,
        trained_at=trained_at,
    )

    validation_metrics = comparison.loc[
        comparison["model_variant"].eq(best_variant),
        ["auc", "rmse", "accuracy"],
    ].iloc[0].to_dict()

    model_run = {
        "run_type": "training",
        "dataset_type": "real",
        "model_variant": best_variant,
        "evaluation_mode": evaluation_mode,
        "seed": seed,
        "num_fits": num_fits,
        "training_rows": int(len(df)),
        "eligible_training_rows": int(len(eligible_df)),
        "fallback_rows": int(len(fallback_df)),
        "learners": int(df["learner_id"].nunique()),
        "skills": int(df["skill_name"].nunique()),
        "eligible_skills": int(len(eligible_skills)),
        "fallback_skills": fallback_skills,
        "metrics": {
            key: None if pd.isna(value) else float(value)
            for key, value in validation_metrics.items()
        },
        "mastery_thresholds": {
            "developing": DEVELOPING_THRESHOLD,
            "good": GOOD_THRESHOLD,
            "mastered": MASTERED_THRESHOLD,
        },
        "trained_at": trained_at,
    }

    # Save production artifacts.
    cleaned_path = output / "rebyu_bkt_cleaned_training_data.csv"
    comparison_path = output / "model_comparison.csv"
    quality_path = output / "skill_data_quality.csv"
    class_params_path = output / "bkt_parameter_classes.csv"
    aggregate_params_path = output / "bkt_parameters.csv"
    predictions_path = output / "bkt_predictions.csv"
    mastery_path = output / "learner_lesson_mastery.csv"
    model_path = output / "rebyu_bkt_model.joblib"
    run_path = output / "bkt_model_run.json"
    params_json_path = output / "bkt_parameters.json"

    df.to_csv(cleaned_path, index=False)
    comparison.to_csv(comparison_path, index=False)
    quality.to_csv(quality_path, index=False)
    parameter_classes.to_csv(class_params_path, index=False)
    aggregate_parameters.to_csv(aggregate_params_path, index=False)
    all_predictions.to_csv(predictions_path, index=False)
    latest_mastery.to_csv(mastery_path, index=False)
    joblib.dump(final_model, model_path)

    with run_path.open("w", encoding="utf-8") as file:
        json.dump(model_run, file, indent=2)

    exact_parameter_json: dict[str, dict[str, dict[str, float]]] = {}
    for row in parameter_classes.itertuples(index=False):
        exact_parameter_json.setdefault(str(row.skill_name), {}).setdefault(
            str(row.parameter_name), {}
        )[str(row.class_name)] = float(row.parameter_value)
    with params_json_path.open("w", encoding="utf-8") as file:
        json.dump(exact_parameter_json, file, indent=2)

    save_comparison_plot(comparison, output / "model_comparison.png")
    save_mastery_distribution_plot(latest_mastery, output / "mastery_distribution.png")

    LOGGER.info("Saved Rebyu BKT outputs to %s", output.resolve())
    return {
        "best_variant": best_variant,
        "comparison": comparison,
        "quality": quality,
        "parameter_classes": parameter_classes,
        "parameters": aggregate_parameters,
        "predictions": all_predictions,
        "mastery": latest_mastery,
        "model_run": model_run,
        "output_dir": output,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train and export a Bayesian Knowledge Tracing model for Rebyu."
    )
    parser.add_argument("--input", required=True, help="Path to Rebyu BKT training CSV.")
    parser.add_argument(
        "--output",
        default="rebyu_bkt_outputs",
        help="Directory where model artifacts will be saved.",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--num-fits", type=int, default=2)
    parser.add_argument("--test-size", type=float, default=0.20)
    parser.add_argument("--min-interactions", type=int, default=20)
    parser.add_argument("--min-learners", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    configure_logging()
    args = parse_args()
    results = run_pipeline(
        input_path=args.input,
        output_dir=args.output,
        seed=args.seed,
        num_fits=args.num_fits,
        test_size=args.test_size,
        min_interactions_per_skill=args.min_interactions,
        min_learners_per_skill=args.min_learners,
    )
    print("\nSelected model:", results["best_variant"])
    print("\nCandidate comparison:")
    print(results["comparison"].to_string(index=False))
    print("\nLatest mastery preview:")
    print(results["mastery"].head(10).to_string(index=False))


if __name__ == "__main__":
    main()

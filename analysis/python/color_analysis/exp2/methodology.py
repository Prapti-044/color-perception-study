"""Port of analysis/exp2/src/lib/server/colorVisionMethodology.js.

Loads the male/female ReVISit exports and extracts per-participant metrics
(thresholds, accuracy, reconstructed ellipsoid volume) and the demographics
used by the expert clause.
"""

from __future__ import annotations

from pathlib import Path

import orjson

from color_analysis import EXP2_DATA_DIR
from color_analysis.exp2.constants import MAX_LOCATION_BY_VECTOR
from color_analysis.exp2.ellipsoid import (
    build_exact_ellipsoid_model,
    build_fitted_ellipsoid_model,
    compute_ellipsoid_proxy_volume,
)

MALE_FILENAME = "color-vision-perception_male.json"
FEMALE_FILENAME = "color-vision-perception_female.json"

ELLIPSE_MODE_EXACT = "exact"
ELLIPSE_MODE_INCLUDE_FITTED = "include-fitted"


def _load_json(path: Path):
    if not path.exists():
        raise FileNotFoundError(
            f"Missing data file: {path}\n"
            "Export the ReVISit participant JSON files and place them in "
            f"{path.parent} (see the README there)."
        )
    return orjson.loads(path.read_bytes())


def load_participant_groups(data_dir: Path = EXP2_DATA_DIR) -> dict:
    """Load raw male and female participant lists."""
    return {
        "male": _load_json(data_dir / MALE_FILENAME),
        "female": _load_json(data_dir / FEMALE_FILENAME),
    }


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def extract_participant_metric(
    participant: dict, ellipse_mode: str = ELLIPSE_MODE_EXACT
) -> dict | None:
    """Per-participant thresholds, accuracy, and reconstructed ellipsoid.

    Returns None when the participant is missing a staircase vector or (in
    ``exact`` mode) when their thresholds do not define a valid ellipse.
    """
    thresholds_by_vector: dict[int, list[float]] = {1: [], 2: [], 3: [], 4: []}
    total_correct = 0
    total_trials = 0

    for record in (participant.get("answers") or {}).values():
        if not record or record.get("componentName") == "practice":
            continue

        answer = record.get("answer") or {}
        threshold = answer.get("threshold")
        vector = answer.get("vector")
        direction_response = answer.get("direction-response")

        if (
            not _is_number(threshold)
            or not _is_number(vector)
            or not _is_number(direction_response)
            or vector not in thresholds_by_vector
        ):
            continue

        thresholds_by_vector[vector].append(threshold)

        for guess in answer.get("guesses") or []:
            total_trials += 1
            if guess.get("correct"):
                total_correct += 1

    if any(not thresholds_by_vector[vector] for vector in (1, 2, 3, 4)):
        return None

    threshold_means = {
        vector: sum(values) / len(values)
        for vector, values in thresholds_by_vector.items()
    }
    all_thresholds = [t for values in thresholds_by_vector.values() for t in values]

    exact_model = build_exact_ellipsoid_model(threshold_means)
    model = exact_model
    if model is None and ellipse_mode == ELLIPSE_MODE_INCLUDE_FITTED:
        model = build_fitted_ellipsoid_model(threshold_means)

    if model is None:
        return None

    return {
        "participantId": participant.get("participantId", "unknown"),
        "accuracy": total_correct / total_trials if total_trials else 0.0,
        "ellipsoidModel": model,
        "exactEllipsoidModel": exact_model,
        "ellipsoidProxyVolume": compute_ellipsoid_proxy_volume(all_thresholds),
        "ellipsoidVolume": model["volume"],
        "fitKind": model["fitKind"],
        "fitLoss": model["fitLoss"],
        "maxRelativeRadiusError": model["maxRelativeRadiusError"],
        "meanNormalizedThreshold": sum(
            threshold_means[vector] / MAX_LOCATION_BY_VECTOR[vector]
            for vector in (1, 2, 3, 4)
        )
        / 4,
        "meanRawThreshold": sum(all_thresholds) / len(all_thresholds),
        "thresholdMeans": threshold_means,
        "thresholdsByVector": thresholds_by_vector,
        "totalCorrect": total_correct,
        "totalTrials": total_trials,
    }


def _find_answer_by_component_name(participant: dict, component_name: str) -> dict:
    for record in (participant.get("answers") or {}).values():
        if record and record.get("componentName") == component_name:
            return record.get("answer") or {}
    return {}


def _normalize_answer_value(value) -> str:
    if isinstance(value, list):
        return ", ".join(
            entry for entry in value if isinstance(entry, str) and entry.strip()
        )
    return value if isinstance(value, str) else ""


def extract_expert_demographics(participant: dict) -> dict:
    """Demographics fields consumed by the expert clause."""
    color_theory = _find_answer_by_component_name(
        participant, "demographic-questionnaire-color-theory"
    )
    makeup = _find_answer_by_component_name(participant, "demographic-questionnaire-makeup")

    return {
        "participantId": participant.get("participantId", "unknown"),
        "color_hobby": _normalize_answer_value(color_theory.get("color-hobby")),
        "color_theory_class": _normalize_answer_value(color_theory.get("color-theory-class")),
        "makeup_familiarity": _normalize_answer_value(makeup.get("makeup-familiarity")),
        "makeup_products": _normalize_answer_value(makeup.get("makeup-products")),
        "use_makeup": _normalize_answer_value(makeup.get("use-makeup")),
    }


def participant_records(
    participants: list[dict], ellipse_mode: str = ELLIPSE_MODE_EXACT
) -> list[dict]:
    """Analyzable records: ``{participantId, demographics, metric}`` per participant."""
    records = []
    for participant in participants:
        metric = extract_participant_metric(participant, ellipse_mode)
        if metric is None:
            continue
        records.append(
            {
                "participantId": metric["participantId"],
                "demographics": extract_expert_demographics(participant),
                "metric": metric,
            }
        )
    return records

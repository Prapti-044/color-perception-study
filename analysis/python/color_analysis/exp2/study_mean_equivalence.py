"""Port of analysis/exp2/src/lib/studyMeanEquivalence.ts.

Compares this study's mean ellipsoid volume against the original study's
published mean/SD via Welch inference and TOST equivalence testing.
"""

from __future__ import annotations

import math

from scipy import stats as sps

ORIGINAL_STUDY_VOLUME_MEAN_SUMMARY = {
    "label": "Original study",
    "mean": 3670.43,
    "n": 29_044,
    "sd": 13_728.03,
}

DEFAULT_VOLUME_EQUIVALENCE_MARGIN = 0.2 * ORIGINAL_STUDY_VOLUME_MEAN_SUMMARY["sd"]


def _clamp_probability(value: float) -> float:
    return max(0.0, min(1.0, value))


def _assert_estimable_study(study: dict) -> None:
    if study["n"] < 2 or not math.isfinite(study["mean"]) or not math.isfinite(study["sd"]):
        raise ValueError(
            f'Study "{study["label"]}" needs n >= 2, a finite mean, and a finite SD'
        )


def _confidence_interval_from_estimate(
    estimate: float,
    standard_error: float,
    degrees_of_freedom: float,
    confidence: float,
) -> dict:
    alpha = 1 - confidence
    critical_value = float(sps.t.ppf(1 - alpha / 2, degrees_of_freedom))
    half_width = critical_value * standard_error
    return {
        "confidence": confidence,
        "lower": estimate - half_width,
        "upper": estimate + half_width,
    }


def mean_confidence_interval(study: dict, confidence: float = 0.95) -> dict:
    """95% (or other) CI for a study mean from summary statistics."""
    _assert_estimable_study(study)
    return _confidence_interval_from_estimate(
        study["mean"],
        study["sd"] / math.sqrt(study["n"]),
        study["n"] - 1,
        confidence,
    )


def build_volume_equivalence_comparison(
    current: dict,
    reference: dict | None = None,
    equivalence_margin: float = DEFAULT_VOLUME_EQUIVALENCE_MARGIN,
    alpha: float = 0.05,
) -> dict:
    """Welch mean comparison + TOST against the original-study summary."""
    if reference is None:
        reference = ORIGINAL_STUDY_VOLUME_MEAN_SUMMARY

    _assert_estimable_study(current)
    _assert_estimable_study(reference)

    if equivalence_margin <= 0 or not math.isfinite(equivalence_margin):
        raise ValueError("Equivalence margin must be a positive finite value")

    current_variance_term = current["sd"] ** 2 / current["n"]
    reference_variance_term = reference["sd"] ** 2 / reference["n"]
    standard_error = math.sqrt(current_variance_term + reference_variance_term)
    mean_difference = current["mean"] - reference["mean"]
    t_statistic = mean_difference / standard_error
    degrees_of_freedom = (current_variance_term + reference_variance_term) ** 2 / (
        current_variance_term**2 / (current["n"] - 1)
        + reference_variance_term**2 / (reference["n"] - 1)
    )
    p_value_two_sided = _clamp_probability(
        2 * (1 - float(sps.t.cdf(abs(t_statistic), degrees_of_freedom)))
    )
    mean_difference_ci90 = _confidence_interval_from_estimate(
        mean_difference, standard_error, degrees_of_freedom, 0.9
    )
    mean_difference_ci95 = _confidence_interval_from_estimate(
        mean_difference, standard_error, degrees_of_freedom, 0.95
    )
    lower_t_statistic = (mean_difference + equivalence_margin) / standard_error
    upper_t_statistic = (mean_difference - equivalence_margin) / standard_error
    lower_p_value = _clamp_probability(
        1 - float(sps.t.cdf(lower_t_statistic, degrees_of_freedom))
    )
    upper_p_value = _clamp_probability(
        float(sps.t.cdf(upper_t_statistic, degrees_of_freedom))
    )
    max_p_value = max(lower_p_value, upper_p_value)

    return {
        "alpha": alpha,
        "current": current,
        "currentMeanCi95": mean_confidence_interval(current, 0.95),
        "degreesOfFreedom": degrees_of_freedom,
        "equivalenceMargin": equivalence_margin,
        "meanDifference": mean_difference,
        "meanDifferenceCi90": mean_difference_ci90,
        "meanDifferenceCi95": mean_difference_ci95,
        "pValueTwoSided": p_value_two_sided,
        "reference": reference,
        "referenceMeanCi95": mean_confidence_interval(reference, 0.95),
        "requiredMarginForEquivalence": max(
            abs(mean_difference_ci90["lower"]),
            abs(mean_difference_ci90["upper"]),
        ),
        "standardError": standard_error,
        "tStatistic": t_statistic,
        "tost": {
            "equivalent": lower_p_value < alpha and upper_p_value < alpha,
            "lowerPValue": lower_p_value,
            "lowerTStatistic": lower_t_statistic,
            "maxPValue": max_p_value,
            "upperPValue": upper_p_value,
            "upperTStatistic": upper_t_statistic,
        },
    }

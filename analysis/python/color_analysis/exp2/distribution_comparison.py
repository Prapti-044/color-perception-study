"""Port of analysis/exp2/src/lib/distributionComparison.ts.

Compares this study's ellipsoid-volume distribution against the original
study's published summary statistics (Welch/TOST on moments, log-scale model,
and Monte-Carlo KS / Mann–Whitney sensitivity checks).
"""

from __future__ import annotations

import math

import numpy as np
from scipy import stats as sps

ORIGINAL_STUDY_VOLUME_DISTRIBUTION = {
    "label": "Original study",
    "max": 1_058_397.76,
    "mean": 3670.43,
    "median": 1558.38,
    "min": 21.68,
    "n": 29_044,
    "q1": 804.62,
    "q3": 3223.6,
    "sd": 13_728.03,
}

# z-score for the 75th percentile of the standard normal (IQR → sigma).
NORMAL_IQR_Z = 0.6744897501960817

# Fixed seed so the Monte-Carlo sensitivity check is reproducible.
MONTE_CARLO_SEED = 20240709


def interpret_cohens_d(d: float) -> str:
    """Cohen (1988) benchmarks for |d|."""
    magnitude = abs(d)
    if not math.isfinite(magnitude) or magnitude < 0.2:
        return "negligible"
    if magnitude < 0.5:
        return "small"
    if magnitude < 0.8:
        return "medium"
    return "large"


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _sample_sd(values: list[float], average: float | None = None) -> float:
    if len(values) < 2:
        return 0.0
    if average is None:
        average = _mean(values)
    squared = sum((value - average) ** 2 for value in values)
    return math.sqrt(squared / (len(values) - 1))


def _quantile_sorted(sorted_values: list[float], probability: float) -> float:
    if not sorted_values:
        return 0.0
    index = (len(sorted_values) - 1) * probability
    lower_index = math.floor(index)
    upper_index = math.ceil(index)
    if lower_index == upper_index:
        return sorted_values[lower_index]
    interpolation = index - lower_index
    return (
        sorted_values[lower_index] * (1 - interpolation)
        + sorted_values[upper_index] * interpolation
    )


def _skewness(values: list[float], average: float, standard_deviation: float) -> float:
    n = len(values)
    if n < 3 or standard_deviation == 0:
        return float("nan")
    cubed_sum = sum(((value - average) / standard_deviation) ** 3 for value in values)
    return (n / ((n - 1) * (n - 2))) * cubed_sum


def _describe_sample(values: list[float], label: str) -> dict:
    sorted_values = sorted(values)
    average = _mean(values)
    standard_deviation = _sample_sd(values, average)
    logs = [math.log(value) for value in values]
    log_mean = _mean(logs)
    log_sd = _sample_sd(logs, log_mean)
    return {
        "cv": 0.0 if average == 0 else standard_deviation / average,
        "geoMean": math.exp(log_mean),
        "label": label,
        "logMean": log_mean,
        "logSd": log_sd,
        "max": sorted_values[-1] if sorted_values else 0.0,
        "mean": average,
        "median": _quantile_sorted(sorted_values, 0.5),
        "min": sorted_values[0] if sorted_values else 0.0,
        "n": len(values),
        "q1": _quantile_sorted(sorted_values, 0.25),
        "q3": _quantile_sorted(sorted_values, 0.75),
        "sd": standard_deviation,
        "skewness": _skewness(values, average, standard_deviation),
    }


def _welch_from_summaries(
    mean1: float, sd1: float, n1: int, mean2: float, sd2: float, n2: int
) -> dict:
    variance_term1 = (sd1 * sd1) / n1
    variance_term2 = (sd2 * sd2) / n2
    standard_error = math.sqrt(variance_term1 + variance_term2)
    mean_difference = mean1 - mean2
    t_statistic = 0.0 if standard_error == 0 else mean_difference / standard_error
    degrees_of_freedom = (variance_term1 + variance_term2) ** 2 / (
        variance_term1**2 / (n1 - 1) + variance_term2**2 / (n2 - 1)
    )
    p_value = max(
        0.0,
        min(1.0, 2 * (1 - float(sps.t.cdf(abs(t_statistic), degrees_of_freedom)))),
    )
    return {
        "degreesOfFreedom": degrees_of_freedom,
        "meanDifference": mean_difference,
        "pValue": p_value,
        "tStatistic": t_statistic,
    }


def _build_welch_raw(current: dict, original: dict) -> dict:
    welch = _welch_from_summaries(
        current["mean"],
        current["sd"],
        current["n"],
        original["mean"],
        original["sd"],
        original["n"],
    )
    pooled_sd = math.sqrt(
        (
            (current["n"] - 1) * current["sd"] ** 2
            + (original["n"] - 1) * original["sd"] ** 2
        )
        / (current["n"] + original["n"] - 2)
    )
    return {
        "cohenD": 0.0 if pooled_sd == 0 else welch["meanDifference"] / pooled_sd,
        "degreesOfFreedom": welch["degreesOfFreedom"],
        "glassDelta": (
            0.0 if original["sd"] == 0 else welch["meanDifference"] / original["sd"]
        ),
        "meanDifference": welch["meanDifference"],
        "pValue": welch["pValue"],
        "tStatistic": welch["tStatistic"],
    }


def _build_tost(
    current: dict, original: dict, margin: float, alpha: float = 0.05
) -> dict:
    variance_term1 = (current["sd"] * current["sd"]) / current["n"]
    variance_term2 = (original["sd"] * original["sd"]) / original["n"]
    standard_error = math.sqrt(variance_term1 + variance_term2)
    mean_difference = current["mean"] - original["mean"]
    degrees_of_freedom = (variance_term1 + variance_term2) ** 2 / (
        variance_term1**2 / (current["n"] - 1)
        + variance_term2**2 / (original["n"] - 1)
    )
    lower_t = (mean_difference + margin) / standard_error
    upper_t = (mean_difference - margin) / standard_error
    lower_p_value = max(0.0, min(1.0, 1 - float(sps.t.cdf(lower_t, degrees_of_freedom))))
    upper_p_value = max(0.0, min(1.0, float(sps.t.cdf(upper_t, degrees_of_freedom))))
    max_p_value = max(lower_p_value, upper_p_value)
    return {
        "equivalent": max_p_value < alpha,
        "margin": margin,
        "maxPValue": max_p_value,
    }


def _build_log_scale(current: dict, original: dict) -> dict:
    cv2 = (original["sd"] / original["mean"]) ** 2
    original_sigma_mom = math.sqrt(math.log(1 + cv2))
    original_mu_mom = math.log(original["mean"]) - 0.5 * original_sigma_mom**2
    original_mu_quantile = math.log(original["median"])
    original_sigma_quantile = math.log(original["q3"] / original["q1"]) / (
        2 * NORMAL_IQR_Z
    )

    welch = _welch_from_summaries(
        current["logMean"],
        current["logSd"],
        current["n"],
        original_mu_quantile,
        original_sigma_quantile,
        original["n"],
    )
    pooled_log_sd = math.sqrt((current["logSd"] ** 2 + original_sigma_quantile**2) / 2)
    spread = math.sqrt(current["logSd"] ** 2 + original_sigma_quantile**2)

    return {
        "cohenDLog": (
            0.0
            if pooled_log_sd == 0
            else (current["logMean"] - original_mu_quantile) / pooled_log_sd
        ),
        "geoMeanRatioMoM": current["geoMean"] / math.exp(original_mu_mom),
        "geoMeanRatioQuantile": current["geoMean"] / math.exp(original_mu_quantile),
        "medianRatio": current["median"] / original["median"],
        "originalMuMoM": original_mu_mom,
        "originalMuQuantile": original_mu_quantile,
        "originalSigmaMoM": original_sigma_mom,
        "originalSigmaQuantile": original_sigma_quantile,
        "probabilitySuperiority": (
            0.5
            if spread == 0
            else float(
                sps.norm.cdf((current["logMean"] - original_mu_quantile) / spread)
            )
        ),
        "welchLog": {
            "degreesOfFreedom": welch["degreesOfFreedom"],
            "pValue": welch["pValue"],
            "tStatistic": welch["tStatistic"],
        },
    }


def _to_int32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value & 0x80000000 else value


def _imul(a: int, b: int) -> int:
    """Match JavaScript Math.imul (signed 32-bit multiply)."""
    return _to_int32((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF))


def _mulberry32(seed: int):
    """Match the TypeScript mulberry32 PRNG used by the website."""
    state = _to_int32(seed)

    def next_value() -> float:
        nonlocal state
        state = _to_int32(state + 0x6D2B79F5)
        t = _imul(state ^ ((state & 0xFFFFFFFF) >> 15), 1 | state)
        t = _to_int32(t + _imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t)) ^ t
        return ((_to_int32(t) ^ ((_to_int32(t) & 0xFFFFFFFF) >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def _sample_log_normal(n: int, mu: float, sigma: float, rng) -> list[float]:
    values = [0.0] * n
    for i in range(n):
        u1 = max(rng(), 1e-12)
        u2 = rng()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        values[i] = math.exp(mu + sigma * z)
    return values


def _kolmogorov_q(t: float) -> float:
    if t <= 0:
        return 1.0
    total = 0.0
    for k in range(1, 101):
        sign = 1 if k % 2 == 1 else -1
        total += sign * math.exp(-2 * k * k * t * t)
    return max(0.0, min(1.0, 2 * total))


def _ks_two_sample(a: list[float], b: list[float]) -> dict:
    s1 = sorted(a)
    s2 = sorted(b)
    n1 = len(s1)
    n2 = len(s2)
    i = 0
    j = 0
    d_statistic = 0.0

    while i < n1 and j < n2:
        x = s1[i]
        y = s2[j]
        if x <= y:
            i += 1
        if y <= x:
            j += 1
        d_statistic = max(d_statistic, abs(i / n1 - j / n2))

    effective_n = (n1 * n2) / (n1 + n2)
    t = (math.sqrt(effective_n) + 0.12 + 0.11 / math.sqrt(effective_n)) * d_statistic
    return {"dStatistic": d_statistic, "pValue": _kolmogorov_q(t)}


def _mann_whitney(a: list[float], b: list[float]) -> dict:
    n1 = len(a)
    n2 = len(b)
    combined = sorted(
        [{"group": 0, "value": value} for value in a]
        + [{"group": 1, "value": value} for value in b],
        key=lambda item: item["value"],
    )
    total = len(combined)
    index = 0
    rank_sum1 = 0.0
    tie_term = 0

    while index < total:
        end = index
        while end + 1 < total and combined[end + 1]["value"] == combined[index]["value"]:
            end += 1
        count = end - index + 1
        average_rank = (index + 1 + (end + 1)) / 2
        for k in range(index, end + 1):
            if combined[k]["group"] == 0:
                rank_sum1 += average_rank
        tie_term += count**3 - count
        index = end + 1

    u1 = rank_sum1 - (n1 * (n1 + 1)) / 2
    u2 = n1 * n2 - u1
    u = min(u1, u2)
    mean_u = (n1 * n2) / 2
    sd_u = math.sqrt(
        ((n1 * n2) / 12) * (total + 1 - tie_term / (total * (total - 1)))
    )
    z_score = 0.0 if sd_u == 0 else (u - mean_u) / sd_u
    p_value = max(
        0.0, min(1.0, 2 * (1 - float(sps.norm.cdf(abs(z_score)))))
    )
    return {
        "pValue": p_value,
        "probabilitySuperiority": u1 / (n1 * n2),
        "zScore": z_score,
    }


def _build_monte_carlo(
    current: dict,
    log_scale: dict,
    original: dict,
    sorted_current_volumes: list[float],
) -> dict:
    rng = _mulberry32(MONTE_CARLO_SEED)
    simulated_original = _sample_log_normal(
        original["n"],
        log_scale["originalMuQuantile"],
        log_scale["originalSigmaQuantile"],
        rng,
    )
    ks = _ks_two_sample(sorted_current_volumes, simulated_original)
    mwu = _mann_whitney(sorted_current_volumes, simulated_original)
    return {"ks": ks, "mannWhitney": mwu, "seed": MONTE_CARLO_SEED}


def build_distribution_comparison(
    participant_volumes,
    current_label: str = "This study",
    original: dict | None = None,
    equivalence_margin: float | None = None,
) -> dict:
    """Full original-vs-this-study distribution comparison."""
    if original is None:
        original = ORIGINAL_STUDY_VOLUME_DISTRIBUTION
    if equivalence_margin is None:
        equivalence_margin = 0.2 * ORIGINAL_STUDY_VOLUME_DISTRIBUTION["sd"]

    volumes = np.asarray(participant_volumes, dtype=float)
    positive_volumes = [
        float(value) for value in volumes if math.isfinite(float(value)) and value > 0
    ]

    if len(positive_volumes) < 3:
        raise ValueError("Distribution comparison needs at least 3 positive volumes")

    current = _describe_sample(positive_volumes, current_label)
    log_scale = _build_log_scale(current, original)
    sorted_current = sorted(positive_volumes)

    return {
        "current": current,
        "logScale": log_scale,
        "monteCarlo": _build_monte_carlo(current, log_scale, original, sorted_current),
        "original": {**original, "cv": original["sd"] / original["mean"]},
        "tost": _build_tost(current, original, equivalence_margin),
        "welchRaw": _build_welch_raw(current, original),
    }

"""Shared statistics helpers used by both experiment notebooks."""

from __future__ import annotations

import math

import numpy as np
from scipy import stats as sps


def welch_t_test(group_a: np.ndarray, group_b: np.ndarray) -> dict:
    """Welch's two-sample t-test (a - b) with Welch–Satterthwaite df.

    Matches the website's formulas and adds the two-sided p-value.
    """
    a = np.asarray(group_a, dtype=float)
    b = np.asarray(group_b, dtype=float)
    n_a, n_b = len(a), len(b)

    if n_a < 2 or n_b < 2:
        return {"t": math.nan, "df": math.nan, "p": math.nan, "delta": math.nan}

    var_a = float(np.var(a, ddof=1))
    var_b = float(np.var(b, ddof=1))
    delta = float(np.mean(a) - np.mean(b))

    if var_a == 0 and var_b == 0:
        return {"t": 0.0, "df": float(n_a + n_b - 2), "p": 1.0, "delta": delta}

    se = math.sqrt(var_a / n_a + var_b / n_b)
    t = delta / se if se else 0.0

    numerator = (var_a / n_a + var_b / n_b) ** 2
    denominator = (var_a / n_a) ** 2 / (n_a - 1) + (var_b / n_b) ** 2 / (n_b - 1)
    df = numerator / denominator if denominator else float(n_a + n_b - 2)

    p = 2 * sps.t.sf(abs(t), df)
    return {"t": t, "df": df, "p": float(p), "delta": delta}


def cohens_d_paired(differences: np.ndarray) -> float:
    """Paired Cohen's d_z: mean(diff) / sd(diff)."""
    diffs = np.asarray(differences, dtype=float)
    sd = float(np.std(diffs, ddof=1))
    return float(np.mean(diffs)) / sd if sd else math.nan


def shapiro_wilk(values: np.ndarray, alpha: float = 0.05) -> dict:
    """Shapiro–Wilk normality test with the website's result shape."""
    x = np.asarray(values, dtype=float)
    n = len(x)
    mean = float(np.mean(x)) if n else 0.0
    sd = float(np.std(x, ddof=1)) if n >= 2 else 0.0

    if n < 3:
        return {"n": n, "mean": mean, "sd": sd, "W": None, "p": None, "verdict": None}

    if np.ptp(x) == 0:
        return {"n": n, "mean": mean, "sd": sd, "W": 1.0, "p": 1.0, "verdict": "fail-to-reject"}

    w, p = sps.shapiro(x)
    return {
        "n": n,
        "mean": mean,
        "sd": sd,
        "W": float(w),
        "p": float(p),
        "verdict": "reject" if p < alpha else "fail-to-reject",
    }


def qq_plot_points(values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Standardized Q–Q points against N(0,1) using Blom plotting positions.

    Returns ``(theoretical, sample)``; the reference line is y = x.
    """
    x = np.asarray(values, dtype=float)
    n = len(x)
    if n < 2:
        return np.array([]), np.array([])

    mean = float(np.mean(x))
    sd = float(np.std(x, ddof=1))
    if sd == 0:
        return np.array([]), np.array([])

    probabilities = (np.arange(1, n + 1) - 3 / 8) / (n + 1 / 4)
    theoretical = sps.norm.ppf(probabilities)
    sample = (np.sort(x) - mean) / sd
    return theoretical, sample

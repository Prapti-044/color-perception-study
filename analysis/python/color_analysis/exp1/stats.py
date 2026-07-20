"""Port of analysis/exp1/src/lib/statistics.ts.

Discriminability aggregation, through-origin OLS regression (p = m * ΔE),
50% JND models, and comparison against the original paper results.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from color_analysis.exp1.constants import AXIS_ORDER, ORIGINAL_PAPER_RESULTS


def compute_discriminability(trials: pd.DataFrame) -> pd.DataFrame:
    """Proportion correct for each axis × size × |ΔE| group (diff trials only)."""
    diff_trials = trials[trials["is_diff_trial"]].copy()
    diff_trials = diff_trials.dropna(subset=["axis", "point_diameter_degrees", "delta_e"])
    diff_trials["delta_e_abs"] = diff_trials["delta_e"].abs()

    grouped = (
        diff_trials.groupby(["axis", "point_diameter_degrees", "delta_e_abs"])
        .agg(
            p=("correct", "mean"),
            n_trials=("correct", "size"),
            n_participants=("participantId", "nunique"),
        )
        .reset_index()
        .rename(columns={"point_diameter_degrees": "size_deg", "delta_e_abs": "delta_e"})
    )

    grouped["axis_order"] = grouped["axis"].map(AXIS_ORDER)
    grouped = (
        grouped.sort_values(["axis_order", "size_deg", "delta_e"])
        .drop(columns="axis_order")
        .reset_index(drop=True)
    )
    return grouped


def _fit_ols_no_intercept(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    """Through-origin OLS y = m*x. Returns (slope, uncentered R², slope SE)."""
    n = len(x)
    if n < 2 or n != len(y):
        return (math.nan, math.nan, math.nan)

    sum_xy = float(np.sum(x * y))
    sum_xx = float(np.sum(x * x))
    sum_yy = float(np.sum(y * y))

    slope = sum_xy / sum_xx
    ss_res = float(np.sum((y - slope * x) ** 2))
    r2 = 1 - ss_res / sum_yy if sum_yy > 0 else math.nan

    mse = ss_res / (n - 1)
    slope_se = math.sqrt(mse / sum_xx)
    return slope, r2, slope_se


def fit_size_axis_regressions(discrim: pd.DataFrame) -> pd.DataFrame:
    """For each axis and size, fit p = m_x × ΔE (no intercept) and derive ND50."""
    rows = []
    for (axis, size), group in discrim.groupby(["axis", "size_deg"], sort=False):
        if len(group) < 2:
            continue

        slope, r2, slope_se = _fit_ols_no_intercept(
            group["delta_e"].to_numpy(float), group["p"].to_numpy(float)
        )

        nd50 = 0.5 / slope if slope > 0 else math.nan
        # Delta method: SE(ND50) = (0.5 / slope²) × SE(slope)
        nd50_se = (0.5 / slope**2) * slope_se if slope > 0 else math.nan

        rows.append(
            {
                "axis": axis,
                "size_deg": size,
                "slope": slope,
                "slope_se": slope_se,
                "r2": r2,
                "ND50": nd50,
                "ND50_se": nd50_se,
            }
        )

    result = pd.DataFrame(rows)
    if len(result):
        result["axis_order"] = result["axis"].map(AXIS_ORDER)
        result = (
            result.sort_values(["axis_order", "size_deg"])
            .drop(columns="axis_order")
            .reset_index(drop=True)
        )
    return result


def _simple_linear_fit(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float, float, float]:
    """OLS y = a + b*x. Returns (intercept, slope, R², intercept SE, slope SE)."""
    n = len(x)
    mean_x = float(np.mean(x))
    mean_y = float(np.mean(y))
    ss_xy = float(np.sum(x * y)) - n * mean_x * mean_y
    ss_xx = float(np.sum(x * x)) - n * mean_x * mean_x

    slope = ss_xy / ss_xx
    intercept = mean_y - slope * mean_x

    predicted = intercept + slope * x
    ss_res = float(np.sum((y - predicted) ** 2))
    ss_tot = float(np.sum((y - mean_y) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else math.nan

    df = n - 2
    mse = ss_res / df if df > 0 else math.nan
    slope_se = math.sqrt(mse / ss_xx) if df > 0 else math.nan
    intercept_se = (
        math.sqrt(mse * (1 / n + mean_x**2 / ss_xx)) if df > 0 else math.nan
    )
    return intercept, slope, r2, intercept_se, slope_se


def fit_inverse_size_model(reg_table: pd.DataFrame) -> pd.DataFrame:
    """Fit slope = c_x + k_x / size for each axis."""
    rows = []
    for axis, group in reg_table.groupby("axis", sort=False):
        if len(group) < 2:
            continue
        x = 1 / group["size_deg"].to_numpy(float)
        y = group["slope"].to_numpy(float)
        c_x, k_x, r2, _, _ = _simple_linear_fit(x, y)
        rows.append({"axis": axis, "c_x": c_x, "k_x": k_x, "R2": r2})

    result = pd.DataFrame(rows)
    if len(result):
        result["axis_order"] = result["axis"].map(AXIS_ORDER)
        result = (
            result.sort_values("axis_order").drop(columns="axis_order").reset_index(drop=True)
        )
    return result


def nd_from_inverse_model(axis: str, p: float, s_deg: float, inv_model: pd.DataFrame) -> float:
    """ND_x(p, s) = p / (c_x + k_x / s)."""
    row = inv_model[inv_model["axis"] == axis]
    if row.empty:
        raise ValueError(f"Axis {axis} not found in inverse-size model.")
    denom = float(row["c_x"].iloc[0]) + float(row["k_x"].iloc[0]) / s_deg
    return p / denom


def fit_nd_linear_model(reg_table: pd.DataFrame) -> pd.DataFrame:
    """Fit ND(50%, s) = A + B/s for each axis (linear regression of ND50 on 1/s)."""
    rows = []
    for axis, group in reg_table.groupby("axis", sort=False):
        group = group[~group["ND50"].isna()]
        if len(group) < 2:
            continue

        x = 1 / group["size_deg"].to_numpy(float)
        y = group["ND50"].to_numpy(float)
        a, b, r2, a_se, b_se = _simple_linear_fit(x, y)

        rows.append(
            {
                "axis": axis,
                "A": a,
                "B": b,
                "A_se": a_se,
                "B_se": b_se,
                "R2": r2,
                "n_points": len(group),
                "sizes": group["size_deg"].tolist(),
                "nd_values": y.tolist(),
                "nd_se_values": group["ND50_se"].tolist(),
            }
        )

    result = pd.DataFrame(rows)
    if len(result):
        result["axis_order"] = result["axis"].map(AXIS_ORDER)
        result = (
            result.sort_values("axis_order").drop(columns="axis_order").reset_index(drop=True)
        )
    return result


def compare_to_reference(
    reg_table: pd.DataFrame, inv_model: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Compare replication results to the original paper (Szafir 2018, Table 1)."""
    ref_reg = ORIGINAL_PAPER_RESULTS["regression"]
    ref_inv = ORIGINAL_PAPER_RESULTS["inverse_model"]

    reg_rows = []
    for row in reg_table.to_dict("records"):
        axis, size = row["axis"], row["size_deg"]
        ref_sizes = list(ref_reg.get(axis, {}).keys())
        if not ref_sizes:
            continue

        closest = min(ref_sizes, key=lambda s: abs(s - size))
        ref = ref_reg[axis][closest]

        slope_diff = row["slope"] - ref["slope"]
        reg_rows.append(
            {
                "axis": axis,
                "size_deg": size,
                "current_slope": row["slope"],
                "ref_slope": ref["slope"],
                "slope_diff": slope_diff,
                "slope_pct_diff": slope_diff / ref["slope"] * 100 if ref["slope"] else math.nan,
                "current_r2": row["r2"],
                "ref_r2": ref["r2"],
                "r2_diff": row["r2"] - ref["r2"],
                "current_nd50": row["ND50"],
                "ref_nd50": ref["nd50"],
                "nd50_diff": row["ND50"] - ref["nd50"] if not math.isnan(row["ND50"]) else math.nan,
                "ref_size_matched": closest,
            }
        )

    inv_rows = []
    for row in inv_model.to_dict("records"):
        ref = ref_inv.get(row["axis"])
        if not ref:
            continue
        inv_rows.append(
            {
                "axis": row["axis"],
                "current_c": row["c_x"],
                "ref_c": ref["c"],
                "c_diff": row["c_x"] - ref["c"],
                "current_k": row["k_x"],
                "ref_k": ref["k"],
                "k_diff": row["k_x"] - ref["k"],
                "current_r2": row["R2"],
                "ref_r2": ref["r2"],
                "r2_diff": row["R2"] - ref["r2"] if not math.isnan(row["R2"]) else math.nan,
            }
        )

    return pd.DataFrame(reg_rows), pd.DataFrame(inv_rows)


def participant_accuracy(trials: pd.DataFrame) -> pd.DataFrame:
    """Participant-level accuracy over answered trials (used for Welch tests)."""
    answered = trials[trials["answer"].notna()]
    return (
        answered.groupby("participantId")
        .agg(accuracy=("is_correct", "mean"), n_answered=("is_correct", "size"))
        .reset_index()
    )

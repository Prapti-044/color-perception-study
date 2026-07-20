"""Port of analysis/exp2/src/lib/colorVisionGroupAnalysis.ts.

Splits analyzable participants into expert/non-expert groups via the expert
clause and computes group summaries, Welch comparisons, the ellipsoid-volume
histogram, and normality diagnostics.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from color_analysis.expert_clause import ClauseNode, get_participants_by_expert_clause
from color_analysis.exp2.constants import HISTOGRAM_BIN_WIDTH, HISTOGRAM_MAX_VOLUME
from color_analysis.stats_common import qq_plot_points, shapiro_wilk, welch_t_test

COMPARISON_METRICS = [
    {
        "id": "accuracy",
        "label": "Trial accuracy",
        "better": "higher",
        "description": "Proportion of correct guesses across all staircase trials per participant.",
    },
    {
        "id": "meanRawThreshold",
        "label": "Mean raw threshold",
        "better": "lower",
        "description": "Average threshold across the completed direction-discrimination sets.",
    },
    {
        "id": "meanNormalizedThreshold",
        "label": "Mean normalized threshold",
        "better": "lower",
        "description": "Raw threshold divided by the vector-specific max step count, then averaged.",
    },
]

NORMALITY_VARIABLES = [
    {"id": "accuracy", "label": "Trial accuracy"},
    {"id": "meanRawThreshold", "label": "Mean raw threshold"},
    {"id": "meanNormalizedThreshold", "label": "Mean normalized threshold"},
    {"id": "ellipsoidVolume", "label": "Ellipsoid volume"},
]


def metrics_dataframe(records: list[dict]) -> pd.DataFrame:
    """Flatten participant records into a metrics DataFrame."""
    return pd.DataFrame(
        [
            {
                "participantId": record["participantId"],
                "accuracy": record["metric"]["accuracy"],
                "meanRawThreshold": record["metric"]["meanRawThreshold"],
                "meanNormalizedThreshold": record["metric"]["meanNormalizedThreshold"],
                "ellipsoidVolume": record["metric"]["ellipsoidVolume"],
                "ellipsoidProxyVolume": record["metric"]["ellipsoidProxyVolume"],
                "fitKind": record["metric"]["fitKind"],
                "totalCorrect": record["metric"]["totalCorrect"],
                "totalTrials": record["metric"]["totalTrials"],
            }
            for record in records
        ]
    )


def _summarise(values: np.ndarray) -> dict:
    return {
        "mean": float(np.mean(values)) if len(values) else 0.0,
        "sd": float(np.std(values, ddof=1)) if len(values) >= 2 else 0.0,
    }


def _group_summary(label: str, df: pd.DataFrame) -> dict:
    total_correct = int(df["totalCorrect"].sum())
    total_guesses = int(df["totalTrials"].sum())
    return {
        "label": label,
        "participantCount": len(df),
        "aggregateAccuracy": total_correct / total_guesses if total_guesses else 0.0,
        "totalCorrect": total_correct,
        "totalGuesses": total_guesses,
        "trialAccuracy": _summarise(df["accuracy"].to_numpy()),
        "meanRawThreshold": _summarise(df["meanRawThreshold"].to_numpy()),
        "meanNormalizedThreshold": _summarise(df["meanNormalizedThreshold"].to_numpy()),
        "ellipsoidVolume": _summarise(df["ellipsoidVolume"].to_numpy()),
    }


def build_histogram(volumes: np.ndarray) -> pd.DataFrame:
    """Website histogram: fixed bin width, values above the cap omitted."""
    bin_count = int(np.ceil(HISTOGRAM_MAX_VOLUME / HISTOGRAM_BIN_WIDTH))
    visible = volumes[volumes <= HISTOGRAM_MAX_VOLUME]
    indices = np.minimum(bin_count - 1, (visible // HISTOGRAM_BIN_WIDTH).astype(int))
    counts = np.bincount(indices, minlength=bin_count)

    starts = np.arange(bin_count) * HISTOGRAM_BIN_WIDTH
    return pd.DataFrame(
        {
            "start": starts,
            "end": starts + HISTOGRAM_BIN_WIDTH,
            "count": counts,
        }
    )


def build_group_analysis(records: list[dict], clause: ClauseNode) -> dict:
    """Expert vs non-expert group analysis for a set of analyzable records."""
    expert_ids, non_expert_ids = get_participants_by_expert_clause(
        [record["demographics"] for record in records], clause
    )

    df = metrics_dataframe(records)
    expert_df = df[df["participantId"].isin(expert_ids)]
    non_expert_df = df[df["participantId"].isin(non_expert_ids)]

    comparisons = []
    for metric in COMPARISON_METRICS:
        col = metric["id"]
        welch = welch_t_test(expert_df[col].to_numpy(), non_expert_df[col].to_numpy())
        comparisons.append(
            {
                "label": metric["label"],
                "better": metric["better"],
                "expert": _summarise(expert_df[col].to_numpy()),
                "nonExpert": _summarise(non_expert_df[col].to_numpy()),
                **welch,
            }
        )

    normality = []
    for variable in NORMALITY_VARIABLES:
        col = variable["id"]
        pooled = df[col].to_numpy()
        normality.append(
            {
                "label": variable["label"],
                "expert": shapiro_wilk(expert_df[col].to_numpy()),
                "nonExpert": shapiro_wilk(non_expert_df[col].to_numpy()),
                "pooled": shapiro_wilk(pooled),
                "qq": {
                    "expert": qq_plot_points(expert_df[col].to_numpy()),
                    "nonExpert": qq_plot_points(non_expert_df[col].to_numpy()),
                    "pooled": qq_plot_points(pooled),
                },
            }
        )

    volumes = np.sort(df["ellipsoidVolume"].to_numpy())
    volume_summary = {
        "minimum": float(volumes[0]) if len(volumes) else 0.0,
        "firstQuartile": float(np.percentile(volumes, 25)) if len(volumes) else 0.0,
        "median": float(np.percentile(volumes, 50)) if len(volumes) else 0.0,
        "thirdQuartile": float(np.percentile(volumes, 75)) if len(volumes) else 0.0,
        "maximum": float(volumes[-1]) if len(volumes) else 0.0,
    }

    return {
        "expert": _group_summary("Expert", expert_df),
        "nonExpert": _group_summary("Non-Expert", non_expert_df),
        "comparisons": pd.DataFrame(comparisons),
        "normality": normality,
        "overallEllipsoidVolume": _summarise(df["ellipsoidVolume"].to_numpy()),
        "volumeSummary": volume_summary,
        "volumes": df["ellipsoidVolume"].to_numpy(),
        "histogram": build_histogram(df["ellipsoidVolume"].to_numpy()),
        "expertDf": expert_df,
        "nonExpertDf": non_expert_df,
        "df": df,
    }

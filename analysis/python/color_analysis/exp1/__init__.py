"""Exp1 (colormap/makeup JND) analysis, ported from analysis/exp1/src/lib/."""

from color_analysis.exp1.colors import (
    AXIS_COLORS,
    AXIS_MAIN_COLORS,
    CHART_AXIS_STROKE,
    CHART_MUTED_FILL,
    CHART_TEXT_FILL,
    GROUP_COLORS,
    JND_DASH,
    JND_LINE_WIDTH,
    JND_PLOT_X_MIN,
    JND_PLOT_Y_MIN,
    OKABE_ITO,
    SCATTER_POINT_STROKE,
)
from color_analysis.exp1.constants import (
    ATTENTION_CHECK_QUESTIONS,
    EXCLUDED_PARTICIPANT_IDS,
    ORIGINAL_PAPER_RESULTS,
)
from color_analysis.exp1.loader import (
    apply_exclusion,
    build_trial_dataframe,
    load_all_data,
)
from color_analysis.exp1.makeup import (
    MAKEUP_COLOR_DELTA_E_THRESHOLD,
    build_makeup_stimulus_key_set,
    load_foundation_colors,
    standard_trial_key,
)
from color_analysis.exp1.stats import (
    compare_to_reference,
    compute_discriminability,
    fit_inverse_size_model,
    fit_nd_linear_model,
    fit_size_axis_regressions,
)

__all__ = [
    "AXIS_COLORS",
    "AXIS_MAIN_COLORS",
    "ATTENTION_CHECK_QUESTIONS",
    "CHART_AXIS_STROKE",
    "CHART_MUTED_FILL",
    "CHART_TEXT_FILL",
    "EXCLUDED_PARTICIPANT_IDS",
    "GROUP_COLORS",
    "JND_DASH",
    "JND_LINE_WIDTH",
    "JND_PLOT_X_MIN",
    "JND_PLOT_Y_MIN",
    "MAKEUP_COLOR_DELTA_E_THRESHOLD",
    "OKABE_ITO",
    "ORIGINAL_PAPER_RESULTS",
    "SCATTER_POINT_STROKE",
    "apply_exclusion",
    "build_makeup_stimulus_key_set",
    "build_trial_dataframe",
    "compare_to_reference",
    "compute_discriminability",
    "fit_inverse_size_model",
    "fit_nd_linear_model",
    "fit_size_axis_regressions",
    "load_all_data",
    "load_foundation_colors",
    "standard_trial_key",
]

"""Exp2 (color-vision perception) analysis, ported from analysis/exp2/src/lib/."""

from color_analysis.exp2.constants import (
    EXPERT_COLOR,
    HISTOGRAM_BIN_WIDTH,
    HISTOGRAM_MAX_VOLUME,
    MAX_LOCATION_BY_VECTOR,
    NON_EXPERT_COLOR,
    NORMALITY_EXPERT_COLOR,
    NORMALITY_NON_EXPERT_COLOR,
    ORIGINAL_STUDY_VOLUME_SUMMARY,
    PAPER_VOLUME_BAR_FILL,
    PAPER_VOLUME_BAR_STROKE,
    PAPER_VOLUME_INK,
    RECOVERED_AXES,
    STUDY_CURRENT_COLOR,
    STUDY_REFERENCE_COLOR,
    VECTOR_COLORS,
    VECTOR_NAMES,
)
from color_analysis.exp2.distribution_comparison import (
    ORIGINAL_STUDY_VOLUME_DISTRIBUTION,
    build_distribution_comparison,
    interpret_cohens_d,
)
from color_analysis.exp2.ellipsoid import (
    build_exact_ellipsoid_model,
    build_fitted_ellipsoid_model,
    compute_ellipsoid_proxy_volume,
    threshold_mean_to_radius,
)
from color_analysis.exp2.group_analysis import build_group_analysis
from color_analysis.exp2.methodology import (
    extract_expert_demographics,
    extract_participant_metric,
    load_participant_groups,
    participant_records,
)
from color_analysis.exp2.study_mean_equivalence import (
    DEFAULT_VOLUME_EQUIVALENCE_MARGIN,
    ORIGINAL_STUDY_VOLUME_MEAN_SUMMARY,
    build_volume_equivalence_comparison,
)

__all__ = [
    "DEFAULT_VOLUME_EQUIVALENCE_MARGIN",
    "EXPERT_COLOR",
    "HISTOGRAM_BIN_WIDTH",
    "HISTOGRAM_MAX_VOLUME",
    "MAX_LOCATION_BY_VECTOR",
    "NON_EXPERT_COLOR",
    "NORMALITY_EXPERT_COLOR",
    "NORMALITY_NON_EXPERT_COLOR",
    "ORIGINAL_STUDY_VOLUME_DISTRIBUTION",
    "ORIGINAL_STUDY_VOLUME_MEAN_SUMMARY",
    "ORIGINAL_STUDY_VOLUME_SUMMARY",
    "PAPER_VOLUME_BAR_FILL",
    "PAPER_VOLUME_BAR_STROKE",
    "PAPER_VOLUME_INK",
    "RECOVERED_AXES",
    "STUDY_CURRENT_COLOR",
    "STUDY_REFERENCE_COLOR",
    "VECTOR_COLORS",
    "VECTOR_NAMES",
    "build_distribution_comparison",
    "build_exact_ellipsoid_model",
    "build_fitted_ellipsoid_model",
    "build_group_analysis",
    "build_volume_equivalence_comparison",
    "compute_ellipsoid_proxy_volume",
    "extract_expert_demographics",
    "extract_participant_metric",
    "interpret_cohens_d",
    "load_participant_groups",
    "participant_records",
    "threshold_mean_to_radius",
]

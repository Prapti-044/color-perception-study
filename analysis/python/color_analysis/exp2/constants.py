"""Constants ported from analysis/exp2/src/lib/colorVisionMath.js.

The recovered axes describe the four staircase directions in CIE L*u*v*:
vector 1 (pink), 2 (magenta), 3 (blue) span the chromatic plane and vector 4
(lighter) is the lightness direction.
"""

MAX_LOCATION_BY_VECTOR = {1: 166, 2: 134, 3: 174, 4: 106}

VECTOR_NAMES = {1: "pink", 2: "magenta", 3: "blue", 4: "lighter"}

HISTOGRAM_MAX_VOLUME = 12_000
HISTOGRAM_BIN_WIDTH = 250

RECOVERED_AXES = {
    1: {
        "name": "pink",
        "endpointHex": "#da325c",
        "maxLocation": 166,
        "maxRadius": 116.85180283109261,
        "unitUv": (0.9980717421434949, 0.06206869516574314),
        "deltaLuv": (-1.007737, 116.626499, 7.252836),
    },
    2: {
        "name": "magenta",
        "endpointHex": "#d33685",
        "maxLocation": 134,
        "maxRadius": 97.29627981481695,
        "unitUv": (0.9743857154843092, -0.22488130951080765),
        "deltaLuv": (-0.554073, 94.804165, -21.880043),
    },
    3: {
        "name": "blue",
        "endpointHex": "#9156e7",
        "maxLocation": 174,
        "maxRadius": 105.47062713526178,
        "unitUv": (0.1266987109754714, -0.9919411675887145),
        "deltaLuv": (0.043656, 13.363038, -104.620659),
    },
    4: {
        "name": "lighter",
        "endpointHex": "#e0e0e0",
        "maxLocation": 106,
        "maxRadius": 38.865557,
        "unitUv": (0.0, 0.0),
        "deltaLuv": (38.865557, 0.0, 0.0),
    },
}

# Ellipsoid-volume summary statistics of the original study
# (Reinecke et al. 2016), as reported in the paper's Fig. 3.
ORIGINAL_STUDY_VOLUME_SUMMARY = {
    "minimum": 21.68,
    "firstQuartile": 804.62,
    "median": 1558.38,
    "thirdQuartile": 3223.60,
    "maximum": 1_058_397.76,
}

# Chart colors matching the Exp2 dashboard components.
VECTOR_COLORS = {v: axis["endpointHex"] for v, axis in RECOVERED_AXES.items()}

# PaperVolumeDistributionFigure.svelte
PAPER_VOLUME_BAR_FILL = "#2f5ec9"
PAPER_VOLUME_BAR_STROKE = "#4b5563"
PAPER_VOLUME_INK = "#000000"

# StudyMeanEquivalenceFigure.svelte — current study vs original reference
STUDY_CURRENT_COLOR = "#0f766e"
STUDY_REFERENCE_COLOR = "#475569"

# PerceptionHistogram.svelte — Expert / Non-Expert (Okabe–Ito)
EXPERT_COLOR = "#0072B2"
NON_EXPERT_COLOR = "#D55E00"

# NormalityAnalysis.svelte Q–Q markers
NORMALITY_EXPERT_COLOR = "#0f766e"
NORMALITY_NON_EXPERT_COLOR = "#c2410c"

"""Port of analysis/exp1/src/lib/colors.ts and chartTheme.ts.

Okabe–Ito CVD-safe palette used by the interactive Exp1 dashboard.
"""

OKABE_ITO = {
    "black": "#000000",
    "orange": "#E69F00",
    "skyBlue": "#56B4E9",
    "bluishGreen": "#009E73",
    "yellow": "#F0E442",
    "blue": "#0072B2",
    "vermillion": "#D55E00",
    "reddishPurple": "#CC79A7",
}

# Per-axis colors for L*/a*/b* JND plots. main = current/expert; muted = reference/non-expert.
AXIS_COLORS = {
    "L": {"main": OKABE_ITO["blue"], "muted": "#74B3DB", "faint": "rgba(0, 114, 178, 0.15)"},
    "a": {"main": OKABE_ITO["vermillion"], "muted": "#F0A16A", "faint": "rgba(213, 94, 0, 0.15)"},
    "b": {"main": OKABE_ITO["bluishGreen"], "muted": "#66C6A9", "faint": "rgba(0, 158, 115, 0.15)"},
}

# Flat map of main hues — convenient for seaborn hue palettes.
AXIS_MAIN_COLORS = {axis: colors["main"] for axis, colors in AXIS_COLORS.items()}

GROUP_COLORS = {
    "expertise": {"group1": OKABE_ITO["blue"], "group2": OKABE_ITO["orange"]},
    "makeupUse": {"group1": OKABE_ITO["reddishPurple"], "group2": OKABE_ITO["bluishGreen"]},
    "training": {"group1": OKABE_ITO["blue"], "group2": OKABE_ITO["vermillion"]},
}

SCATTER_POINT_FILL = "rgba(0, 114, 178, 0.55)"
SCATTER_POINT_STROKE = OKABE_ITO["blue"]

CHART_TEXT_FILL = "#334155"
CHART_MUTED_FILL = "#475569"
CHART_AXIS_STROKE = "#94a3b8"

# Match jndComparisonChart.ts
JND_DASH = (10, 6)
JND_PLOT_X_MIN = 0.2
JND_PLOT_Y_MIN = 3.5
JND_LINE_WIDTH = 2.25

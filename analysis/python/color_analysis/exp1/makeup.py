"""Port of analysis/exp1/src/lib/makeup.ts.

Foundation-shade color matching used to identify "makeup-color" stimuli:
a scatterplot counts as a makeup-color stimulus when either target color is
within ΔE < 10 of any foundation shade from the Pudding foundation dataset.
"""

from __future__ import annotations

import csv
import math
import re
from pathlib import Path

from color_analysis import EXP1_FOUNDATION_CSV

MAKEUP_COLOR_DELTA_E_THRESHOLD = 10

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def hex_to_lab(hex_color: str) -> dict:
    """sRGB hex to CIELAB (D65), rounded to 1 decimal to match the TS port."""
    r = int(hex_color[1:3], 16) / 255
    g = int(hex_color[3:5], 16) / 255
    b = int(hex_color[5:7], 16) / 255

    def linear(c: float) -> float:
        return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92

    rl, gl, bl = linear(r), linear(g), linear(b)

    x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
    y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
    z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)

    return {
        "L": round(116 * fy - 16, 1),
        "a": round(500 * (fx - fy), 1),
        "b": round(200 * (fy - fz), 1),
    }


def calculate_delta_e(lab1: dict, lab2: dict) -> float:
    """Euclidean ΔE in CIELAB (ΔE76)."""
    return math.sqrt(
        (lab1["L"] - lab2["L"]) ** 2
        + (lab1["a"] - lab2["a"]) ** 2
        + (lab1["b"] - lab2["b"]) ** 2
    )


def load_foundation_colors(csv_path: Path = EXP1_FOUNDATION_CSV) -> list[dict]:
    """Parse allShades.csv, keeping valid-hex shades with lab.b >= 0."""
    colors = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            hex_color = (row.get("hex") or "").strip()
            if not _HEX_RE.match(hex_color):
                continue

            lab = hex_to_lab(hex_color)
            if lab["b"] < 0:
                continue

            name = (row.get("name") or "").strip()
            if not name or name == "NA":
                name = (row.get("specific") or "").strip() or "Unknown"

            colors.append(
                {
                    "brand": (row.get("brand") or "").strip() or "Unknown",
                    "name": name,
                    "hex": hex_color,
                    "lab": lab,
                }
            )
    return colors


def find_nearest_foundation(target_lab: dict, foundation_colors: list[dict]) -> dict | None:
    if not foundation_colors:
        return None

    nearest = min(
        foundation_colors, key=lambda c: calculate_delta_e(target_lab, c["lab"])
    )
    return {"color": nearest, "deltaE": calculate_delta_e(target_lab, nearest["lab"])}


def is_makeup_color_scatterplot(scatterplot: dict, foundation_colors: list[dict]) -> bool:
    for key in ("target_color1_lab", "target_color2_lab"):
        nearest = find_nearest_foundation(scatterplot[key], foundation_colors)
        if nearest is not None and nearest["deltaE"] < MAKEUP_COLOR_DELTA_E_THRESHOLD:
            return True
    return False


def standard_trial_key(scatter_index: int, axis: str | None) -> str | None:
    """Key used to match trials against the makeup stimulus set."""
    if not axis:
        return None
    return f"{scatter_index}-{axis}"


def build_makeup_stimulus_key_set(
    scatterplots: list[dict], foundation_colors: list[dict]
) -> set[str]:
    """Keys (``index-axis``) of scatterplots whose targets match a foundation shade."""
    return {
        f"{sp['index']}-{sp['axis']}"
        for sp in scatterplots
        if is_makeup_color_scatterplot(sp, foundation_colors)
    }

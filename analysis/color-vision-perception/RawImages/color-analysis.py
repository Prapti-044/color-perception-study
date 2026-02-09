#!/usr/bin/env python3
"""
Color analysis of Landolt-C stimuli images.

Reads every subdirectory under RawImages/, classifies each cell in the 50×50
grid as **foreground** (part of the Landolt-C ring) or **background**, and
produces a self-contained HTML report with per-directory colour distributions.
"""

import base64
import math
import os
from io import BytesIO
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402


# ─── CIE-LUV colour-space conversions ─────────────────────────────────────────
# D65 white-point
_XN, _YN, _ZN = 0.95047, 1.0, 1.08883
_UN_PRIME = 4 * _XN / (_XN + 15 * _YN + 3 * _ZN)
_VN_PRIME = 9 * _YN / (_XN + 15 * _YN + 3 * _ZN)
_EPS = (6.0 / 29.0) ** 3  # 0.008856
_KAPPA = (29.0 / 3.0) ** 3  # 903.3

# sRGB ↔ XYZ matrices (D65)
_SRGB_TO_XYZ = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041],
])
_XYZ_TO_SRGB = np.linalg.inv(_SRGB_TO_XYZ)


def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    """Linearise sRGB channel(s) in [0, 1]."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(c: np.ndarray) -> np.ndarray:
    """Apply sRGB gamma to linear channel(s) in [0, 1]."""
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(np.clip(c, 0, None), 1.0 / 2.4) - 0.055)


def rgb_to_luv(rgb: np.ndarray) -> np.ndarray:
    """
    Convert an (N, 3) uint8 sRGB array to CIE-LUV (float64).

    Returns (N, 3) with columns L* [0, 100], u*, v*.
    """
    rgb_f = rgb.astype(np.float64) / 255.0
    linear = _srgb_to_linear(rgb_f)
    xyz = linear @ _SRGB_TO_XYZ.T  # (N, 3)

    X, Y, Z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    denom = X + 15.0 * Y + 3.0 * Z
    # Avoid division by zero for black pixels
    safe_denom = np.where(denom == 0, 1e-10, denom)
    u_prime = 4.0 * X / safe_denom
    v_prime = 9.0 * Y / safe_denom

    yr = Y / _YN
    L = np.where(yr > _EPS, 116.0 * np.cbrt(yr) - 16.0, _KAPPA * yr)
    u = 13.0 * L * (u_prime - _UN_PRIME)
    v = 13.0 * L * (v_prime - _VN_PRIME)
    return np.column_stack([L, u, v])


def luv_to_rgb(luv: np.ndarray) -> np.ndarray:
    """
    Convert (N, 3) or (3,) CIE-LUV → sRGB uint8, clipping to gamut.
    """
    squeeze = luv.ndim == 1
    if squeeze:
        luv = luv[np.newaxis, :]

    L, u, v = luv[:, 0], luv[:, 1], luv[:, 2]
    safe_L = np.where(L == 0, 1e-10, L)
    u_prime = u / (13.0 * safe_L) + _UN_PRIME
    v_prime = v / (13.0 * safe_L) + _VN_PRIME

    Y = np.where(L > 8.0, _YN * ((L + 16.0) / 116.0) ** 3, _YN * L / _KAPPA)
    safe_vp = np.where(v_prime == 0, 1e-10, v_prime)
    X = Y * 9.0 * u_prime / (4.0 * safe_vp)
    Z = Y * (12.0 - 3.0 * u_prime - 20.0 * v_prime) / (4.0 * safe_vp)

    xyz = np.column_stack([X, Y, Z])
    linear = xyz @ _XYZ_TO_SRGB.T
    srgb = _linear_to_srgb(np.clip(linear, 0, 1))
    out = np.clip(np.round(srgb * 255), 0, 255).astype(np.uint8)
    return out[0] if squeeze else out

# ─── Constants (must match direction-stimuli.tsx) ──────────────────────────────

GRID_SIZE = 50  # 50 × 50 cells
RADIUS = 5  # half-cell size in SVG units; rect is RADIUS × RADIUS
SVG_OFFSET = 5  # translate(5, 5) applied in the SVG
CELL_SPACING = RADIUS * 2  # 10 SVG units between cell origins
VIEWBOX = CELL_SPACING * GRID_SIZE + 2 * SVG_OFFSET  # 510

RING_INNER = 12  # inner radius of the C ring (in cells)
RING_OUTER = 19  # outer radius
CUTOUT_HALF_WIDTH = 5  # half-width of the gap in the C

# Mapping from **file index** (0-7 in the filename) to a human-readable name.
DIRECTION_NAMES: dict[int, str] = {
    0: "bottom-mid",
    1: "bottom-left",
    2: "bottom-right",
    3: "mid-left",
    4: "mid-right",
    5: "top-left",
    6: "top-right",
    7: "top-mid",
}

# Mapping from file index (0-7) to the geometry direction number (1-8) used in
# the `is_foreground` formula.  direction N → angle = (360/8)*(N-1).
#   1 = 0° (mid-right), 2 = 45° (bottom-right), 3 = 90° (bottom-mid),
#   4 = 135° (bottom-left), 5 = 180° (mid-left), 6 = 225° (top-left),
#   7 = 270° (top-mid), 8 = 315° (top-right)
FILE_IDX_TO_GEOM_DIR: dict[int, int] = {
    0: 3,   # bottom-mid   → 90°
    1: 4,   # bottom-left  → 135°
    2: 2,   # bottom-right → 45°
    3: 5,   # mid-left     → 180°
    4: 1,   # mid-right    → 0°
    5: 6,   # top-left     → 225°
    6: 8,   # top-right    → 315°
    7: 7,   # top-mid      → 270°
}

VECTOR_NAMES = {1: "Red", 2: "Blue", 3: "Magenta / Purple", 4: "White"}


# ─── Geometry helpers ──────────────────────────────────────────────────────────


def _cell_center_px(i: int, j: int, img_w: int, img_h: int) -> tuple[float, float]:
    """Pixel coordinates of the centre of cell (i, j)."""
    svg_x = SVG_OFFSET + i * CELL_SPACING + RADIUS / 2
    svg_y = SVG_OFFSET + j * CELL_SPACING + RADIUS / 2
    return svg_x * img_w / VIEWBOX, svg_y * img_h / VIEWBOX


def is_foreground(i: int, j: int, direction: int) -> bool:
    """Return True when cell (i, j) belongs to the Landolt-C ring."""
    cx = cy = GRID_SIZE / 2
    dx, dy = i - cx, j - cy
    dist = math.hypot(dx, dy)
    if not (RING_INNER <= dist < RING_OUTER):
        return False

    angle_rad = math.radians((360 / 8) * (direction - 1))
    ray_x, ray_y = math.cos(angle_rad), math.sin(angle_rad)
    perp = abs(dx * ray_y - dy * ray_x)
    dot = dx * ray_x + dy * ray_y
    if perp <= CUTOUT_HALF_WIDTH and dot > 0:  # inside the gap
        return False
    return True


# Pre-compute a foreground mask for every direction (1-8) once.
_FG_MASKS: dict[int, np.ndarray] = {}


def _fg_mask(direction: int) -> np.ndarray:
    """Return a (50, 50) bool array — True for foreground cells."""
    if direction not in _FG_MASKS:
        mask = np.zeros((GRID_SIZE, GRID_SIZE), dtype=bool)
        for i in range(GRID_SIZE):
            for j in range(GRID_SIZE):
                mask[j, i] = is_foreground(i, j, direction)
        _FG_MASKS[direction] = mask
    return _FG_MASKS[direction]


# ─── Image analysis ───────────────────────────────────────────────────────────


def _sample_cell_colors(img_arr: np.ndarray) -> np.ndarray:
    """
    Return a (50, 50, 3) float64 array of mean non-black RGB for every cell.

    Cells whose patch has *only* black pixels get NaN so we can filter later.
    """
    h, w = img_arr.shape[:2]
    result = np.full((GRID_SIZE, GRID_SIZE, 3), np.nan)
    patch_r = 2  # sample a (2*patch_r+1)² neighbourhood

    for i in range(GRID_SIZE):
        for j in range(GRID_SIZE):
            px, py = _cell_center_px(i, j, w, h)
            x0, x1 = max(0, int(px) - patch_r), min(w, int(px) + patch_r + 1)
            y0, y1 = max(0, int(py) - patch_r), min(h, int(py) + patch_r + 1)
            patch = img_arr[y0:y1, x0:x1, :3].astype(np.float64)

            # Exclude near-black (border) pixels
            bright = patch.sum(axis=-1) > 30
            if bright.any():
                result[j, i] = patch[bright].mean(axis=0)

    return result


def analyze_image(
    img_path: str, direction: int
) -> tuple[np.ndarray, np.ndarray]:
    """
    Analyse one image.

    Returns (foreground_luv, background_luv) — each an (N, 3) float64 array
    of CIE-LUV values (L*, u*, v*).
    """
    img = Image.open(img_path).convert("RGB")
    img_arr = np.array(img)
    cell_colors = _sample_cell_colors(img_arr)  # (50, 50, 3) RGB float64
    mask = _fg_mask(direction)  # (50, 50)

    valid = ~np.isnan(cell_colors[:, :, 0])
    fg_rgb = cell_colors[valid & mask].astype(np.uint8)
    bg_rgb = cell_colors[valid & ~mask].astype(np.uint8)

    fg_luv = rgb_to_luv(fg_rgb) if len(fg_rgb) > 0 else np.empty((0, 3))
    bg_luv = rgb_to_luv(bg_rgb) if len(bg_rgb) > 0 else np.empty((0, 3))
    return fg_luv, bg_luv


# ─── Filename / dirname parsing ───────────────────────────────────────────────


def _parse_filename(name: str) -> tuple[int, int, int] | None:
    """'{vec}-{loc}-{dir_idx}.png' → (vector, location, file_dir_index 0-7)."""
    stem = Path(name).stem
    parts = stem.split("-")
    if len(parts) != 3:
        return None
    try:
        return int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None


def _parse_dirname(name: str) -> tuple[int, int] | None:
    parts = name.split("-")
    if len(parts) != 2:
        return None
    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        return None


# ─── Plotting helpers ─────────────────────────────────────────────────────────

DARK_BG = "#0f0f1a"
CARD_BG = "#1a1a2e"
AXES_BG = "#20203a"
GRID_CLR = "#2a2a4a"
TEXT_CLR = "#cccccc"


def _fig_to_b64(fig: plt.Figure) -> str:
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def _style_ax(ax: plt.Axes) -> None:
    ax.set_facecolor(AXES_BG)
    ax.tick_params(colors="#888", labelsize=8)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("bottom", "left"):
        ax.spines[spine].set_color(GRID_CLR)


def plot_luv_histograms(luv_colors: np.ndarray, title: str) -> str:
    """L*, u*, v* channel histograms → base64 PNG."""
    fig, axes = plt.subplots(1, 3, figsize=(13, 3.2))
    fig.patch.set_facecolor(CARD_BG)
    names = ("L*", "u*", "v*")
    bar_colors = ("#e0e0e0", "#f08c00", "#7048e8")
    # Sensible axis ranges for each channel
    ranges = [(0, 100), (-150, 200), (-150, 150)]

    for idx, (ax, ch_name, ch_color, rng) in enumerate(
        zip(axes, names, bar_colors, ranges)
    ):
        data = luv_colors[:, idx]
        _style_ax(ax)
        ax.hist(data, bins=64, range=rng, color=ch_color, alpha=0.85, edgecolor="none")
        ax.set_title(ch_name, color=TEXT_CLR, fontsize=10, fontweight="bold")
        ax.set_xlim(*rng)
        ax.set_xlabel(ch_name, color="#999", fontsize=8)
        ax.set_ylabel("Count", color="#999", fontsize=8)

    fig.suptitle(title, color="white", fontsize=12, fontweight="bold", y=1.02)
    fig.tight_layout()
    return _fig_to_b64(fig)


def plot_uv_scatter(fg_luv: np.ndarray, bg_luv: np.ndarray, title: str) -> str:
    """u* vs v* chromaticity scatter for foreground & background → base64 PNG."""
    fig, ax = plt.subplots(figsize=(5.5, 5))
    fig.patch.set_facecolor(CARD_BG)
    _style_ax(ax)

    rng = np.random.default_rng(42)

    def _plot(luv: np.ndarray, label: str, s: int, alpha: float) -> None:
        n = min(800, len(luv))
        idx = rng.choice(len(luv), n, replace=False)
        subset = luv[idx]
        # Convert LUV back to sRGB for dot colour
        rgb_f = luv_to_rgb(subset).astype(np.float64) / 255.0
        ax.scatter(subset[:, 1], subset[:, 2], c=rgb_f, s=s, alpha=alpha,
                   label=label, edgecolors="none")

    if len(bg_luv) > 0:
        _plot(bg_luv, "Background", s=6, alpha=0.4)
    if len(fg_luv) > 0:
        _plot(fg_luv, "Foreground", s=12, alpha=0.7)

    ax.set_xlabel("u*", color="#999", fontsize=9)
    ax.set_ylabel("v*", color="#999", fontsize=9)
    ax.axhline(0, color=GRID_CLR, linewidth=0.5)
    ax.axvline(0, color=GRID_CLR, linewidth=0.5)
    ax.set_title(title, color="white", fontsize=12, fontweight="bold")
    ax.legend(facecolor=AXES_BG, edgecolor=GRID_CLR, labelcolor="white", fontsize=9)
    fig.tight_layout()
    return _fig_to_b64(fig)


def plot_cell_map(img_arr: np.ndarray, direction: int, title: str) -> str:
    """
    Render a 50×50 cell map highlighting foreground / background classification.
    """
    cell_colors = _sample_cell_colors(img_arr)
    mask = _fg_mask(direction)

    fig, axes = plt.subplots(1, 2, figsize=(9, 4.2))
    fig.patch.set_facecolor(CARD_BG)

    for ax, show_fg, label in zip(axes, [True, False], ["Foreground cells", "Background cells"]):
        display = np.zeros((GRID_SIZE, GRID_SIZE, 3), dtype=np.uint8)
        for j in range(GRID_SIZE):
            for i in range(GRID_SIZE):
                c = cell_colors[j, i]
                if np.isnan(c[0]):
                    continue
                is_fg = mask[j, i]
                if is_fg == show_fg:
                    display[j, i] = c.astype(np.uint8)
        ax.imshow(display, interpolation="nearest")
        ax.set_title(label, color=TEXT_CLR, fontsize=10, fontweight="bold")
        ax.axis("off")

    fig.suptitle(title, color="white", fontsize=11, fontweight="bold", y=1.0)
    fig.tight_layout()
    return _fig_to_b64(fig)


def _thumb_b64(img_path: str, size: int = 120) -> str:
    img = Image.open(img_path)
    img.thumbnail((size, size))
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


# ─── HTML generation ──────────────────────────────────────────────────────────


def _stats_html(luv_colors: np.ndarray, label: str) -> str:
    """Return an HTML stat-card for a set of CIE-LUV colours."""
    if len(luv_colors) == 0:
        return ""
    mean = luv_colors.mean(axis=0)
    std = luv_colors.std(axis=0)
    mn = luv_colors.min(axis=0)
    mx = luv_colors.max(axis=0)
    # Convert mean LUV back to sRGB for the swatch
    mean_rgb = luv_to_rgb(mean)
    hex_clr = f"#{mean_rgb[0]:02x}{mean_rgb[1]:02x}{mean_rgb[2]:02x}"

    def _fmt(arr: np.ndarray) -> str:
        return f"({arr[0]:.1f}, {arr[1]:.1f}, {arr[2]:.1f})"

    return f"""
    <div class="stat-card">
      <h4>{label}</h4>
      <p>
        <span class="swatch" style="background:{hex_clr}"></span>
        <b>Mean:</b> L*u*v* {_fmt(mean)}
      </p>
      <p><b>Std&nbsp;dev:</b> {_fmt(std)}</p>
      <p><b>Min:</b> {_fmt(mn)}</p>
      <p><b>Max:</b> {_fmt(mx)}</p>
      <p><b>Cell count:</b> {len(luv_colors)}</p>
    </div>"""


HTML_HEAD = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Landolt-C Colour Analysis Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
  background:#0f0f1a;color:#d0d0d8;line-height:1.6;padding:2rem 3rem;
}
h1{color:#c4b5fd;font-size:2rem;margin-bottom:.4rem}
h2{color:#a78bfa;font-size:1.4rem;margin:1.4rem 0 .6rem;border-bottom:2px solid #2a2a4a;padding-bottom:.4rem}
h3{color:#93c5fd;font-size:1.05rem;margin:.9rem 0 .4rem}
.header{text-align:center;margin-bottom:2.5rem}
.header p{color:#888;font-size:.95rem}
.section{
  background:#1a1a2e;border-radius:12px;padding:1.5rem;
  margin-bottom:2rem;border:1px solid #2a2a4a;
}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:.6rem 0}
.badge{background:#2a2a4a;padding:4px 14px;border-radius:20px;font-size:.85rem;color:#c4b5fd}
.thumbs{display:flex;flex-wrap:wrap;gap:6px;margin:.6rem 0}
.thumbs img{border-radius:6px;border:1px solid #333}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin:1rem 0}
.stat-card{background:#16162a;border-radius:8px;padding:1rem;border:1px solid #2a2a4a}
.stat-card h4{color:#c4b5fd;margin-bottom:.4rem;font-size:.95rem}
.stat-card p{font-size:.88rem;margin:.2rem 0}
.swatch{display:inline-block;width:20px;height:20px;border-radius:4px;
  border:1px solid #555;vertical-align:middle;margin-right:6px}
.charts{display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;margin:1rem 0}
.charts img{border-radius:8px;max-width:100%}
table{width:100%;border-collapse:collapse;margin:.6rem 0;font-size:.88rem}
th,td{padding:5px 10px;text-align:left;border-bottom:1px solid #2a2a4a}
th{color:#a78bfa;font-weight:600}
td{color:#ccc}
</style>
</head>
<body>
<div class="header">
  <h1>Landolt-C Colour Analysis Report</h1>
  <p>Foreground vs Background CIE-LUV Colour Distributions per Stimulus Directory</p>
</div>
"""


def build_report(results: dict, output_path: str) -> None:
    parts: list[str] = [HTML_HEAD]

    for name in sorted(results):
        d = results[name]
        vec_id, location = d["vector"], d["location"]
        vec_name = VECTOR_NAMES.get(vec_id, f"Vector {vec_id}")
        fg = np.asarray(d["fg_colors"], dtype=np.float64)
        bg = np.asarray(d["bg_colors"], dtype=np.float64)

        parts.append(f'<div class="section">')
        parts.append(f"<h2>{name} — {vec_name} · Step {location}</h2>")

        # badges
        parts.append('<div class="badges">')
        parts.append(f'<span class="badge">Vector: {vec_name}</span>')
        parts.append(f'<span class="badge">Step / Location: {location}</span>')
        parts.append(f'<span class="badge">Images: {d["n_images"]}</span>')
        parts.append(f'<span class="badge">FG cells total: {len(fg)}</span>')
        parts.append(f'<span class="badge">BG cells total: {len(bg)}</span>')
        parts.append("</div>")

        # thumbnails
        parts.append("<h3>Stimulus Images</h3>")
        parts.append('<div class="thumbs">')
        for t in d["thumbs"]:
            parts.append(f'<img src="data:image/png;base64,{t}" width="110" height="110">')
        parts.append("</div>")

        # cell-map visualisation (first image only)
        if d.get("cell_map_b64"):
            parts.append("<h3>Cell Classification (first image)</h3>")
            parts.append('<div class="charts">')
            parts.append(f'<img src="data:image/png;base64,{d["cell_map_b64"]}">')
            parts.append("</div>")

        # stats cards
        parts.append('<div class="stats-grid">')
        parts.append(_stats_html(fg, "Foreground (Landolt-C Ring)"))
        parts.append(_stats_html(bg, "Background"))
        parts.append("</div>")

        # LUV histograms
        parts.append("<h3>CIE-LUV Channel Distributions</h3>")
        parts.append('<div class="charts">')
        if len(fg) > 0:
            parts.append(f'<img src="data:image/png;base64,{plot_luv_histograms(fg, "Foreground")}">')
        if len(bg) > 0:
            parts.append(f'<img src="data:image/png;base64,{plot_luv_histograms(bg, "Background")}">')
        parts.append("</div>")

        # u*-v* chromaticity scatter
        if len(fg) > 0 and len(bg) > 0:
            parts.append("<h3>u* × v* Chromaticity Scatter</h3>")
            parts.append('<div class="charts">')
            parts.append(
                f'<img src="data:image/png;base64,'
                f'{plot_uv_scatter(fg, bg, "Foreground vs Background")}">'
            )
            parts.append("</div>")

        # per-image table
        parts.append("<h3>Per-Image Breakdown</h3>")
        parts.append(
            "<table><tr><th>File</th><th>Direction</th>"
            "<th>FG cells</th><th>BG cells</th>"
            "<th>FG mean L*u*v*</th><th>BG mean L*u*v*</th></tr>"
        )
        for info in d["per_image"]:
            dn = DIRECTION_NAMES.get(info["dir"], str(info["dir"]))
            parts.append(
                f'<tr><td>{info["file"]}</td><td>{dn}</td>'
                f'<td>{info["n_fg"]}</td><td>{info["n_bg"]}</td>'
                f'<td>{info["fg_mean"]}</td><td>{info["bg_mean"]}</td></tr>'
            )
        parts.append("</table>")
        parts.append("</div>")

    parts.append("</body></html>")

    Path(output_path).write_text("\n".join(parts), encoding="utf-8")
    print(f"\n✓ Report written to {output_path}")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    raw_dir = Path(__file__).resolve().parent
    subdirs = sorted(
        d for d in raw_dir.iterdir() if d.is_dir() and _parse_dirname(d.name)
    )
    print(f"Found {len(subdirs)} stimulus directories under {raw_dir}\n")

    results: dict = {}

    for subdir in subdirs:
        vec_id, location = _parse_dirname(subdir.name)  # type: ignore[misc]
        vec_name = VECTOR_NAMES.get(vec_id, f"Vector {vec_id}")
        print(f"── {subdir.name}  ({vec_name}, step {location})")

        all_fg: list[np.ndarray] = []
        all_bg: list[np.ndarray] = []
        thumbs: list[str] = []
        per_image: list[dict] = []
        cell_map_b64: str | None = None

        for img_path in sorted(subdir.glob("*.png")):
            parsed = _parse_filename(img_path.name)
            if parsed is None:
                continue
            _, _, file_dir_idx = parsed
            geom_dir = FILE_IDX_TO_GEOM_DIR[file_dir_idx]
            dir_label = DIRECTION_NAMES.get(file_dir_idx, "?")
            print(f"   {img_path.name}  idx={file_dir_idx} → {dir_label}")

            fg, bg = analyze_image(str(img_path), geom_dir)
            all_fg.append(fg)
            all_bg.append(bg)
            thumbs.append(_thumb_b64(str(img_path)))

            # Cell-map for the first image
            if cell_map_b64 is None:
                arr = np.array(Image.open(img_path).convert("RGB"))
                cell_map_b64 = plot_cell_map(arr, geom_dir, f"Cell map — {img_path.name}")

            def _luv_mean_str(arr: np.ndarray) -> str:
                if len(arr) == 0:
                    return "—"
                m = arr.mean(axis=0)
                return f"({m[0]:.1f}, {m[1]:.1f}, {m[2]:.1f})"

            fg_mean_str = _luv_mean_str(fg)
            bg_mean_str = _luv_mean_str(bg)
            per_image.append({
                "file": img_path.name,
                "dir": file_dir_idx,
                "n_fg": len(fg),
                "n_bg": len(bg),
                "fg_mean": fg_mean_str,
                "bg_mean": bg_mean_str,
            })

        fg_all = np.concatenate(all_fg) if all_fg else np.empty((0, 3), dtype=np.float64)
        bg_all = np.concatenate(all_bg) if all_bg else np.empty((0, 3), dtype=np.float64)

        results[subdir.name] = {
            "vector": vec_id,
            "location": location,
            "n_images": len(per_image),
            "fg_colors": fg_all,
            "bg_colors": bg_all,
            "thumbs": thumbs,
            "cell_map_b64": cell_map_b64,
            "per_image": per_image,
        }

    # Write report one level up from RawImages/
    out = raw_dir.parent / "color-analysis-report.html"
    build_report(results, str(out))


if __name__ == "__main__":
    main()

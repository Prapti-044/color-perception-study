"""Python ports of the exp1/exp2 Svelte analysis pipelines."""

from pathlib import Path

ANALYSIS_ROOT = Path(__file__).resolve().parents[2]

EXP1_DATA_DIR = ANALYSIS_ROOT / "exp1" / "data"
EXP1_FOUNDATION_CSV = ANALYSIS_ROOT / "exp1" / "static" / "foundation-names" / "allShades.csv"
EXP2_DATA_DIR = ANALYSIS_ROOT / "exp2" / "static" / "color-vision-data"

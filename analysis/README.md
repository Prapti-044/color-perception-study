# Analysis notebooks

Jupyter notebooks accompanying *Ten Years Later: Replicating Two Color
Discrimination Studies* (supplementary materials). Each notebook first shows
the replication of the original study, then the color-practice extension:

- `exp1/results.ipynb` — Experiment 1: replication of Szafir (2018),
  *Modeling Color Difference for Visualization Design*, plus the
  Known/Unknown Color Practice comparison.
- `exp2/results.ipynb` — Experiment 2: replication of Reinecke et al. (2016),
  *Enabling Designers to Foresee Which Colors Users Cannot See*
  (discrimination ellipsoids), plus the color-practice comparison.

The statistics pipelines are direct Python ports of the TypeScript sources
behind the interactive dashboards (`exp1/src/lib/`, `exp2/src/lib/`) and live
in `python/color_analysis/`, so notebook numbers match the websites.

## Requirements

- [uv](https://docs.astral.sh/uv/)
- The gitignored ReVISit participant exports:
  - `exp1/data/colormap-makeup-{L,a,b}_all.json`
  - `exp2/static/color-vision-data/color-vision-perception_{male,female}.json`

## Usage

```bash
cd analysis
uv sync
uv run jupyter lab
```

Then open `exp1/results.ipynb` or `exp2/results.ipynb`.

To run a notebook headlessly:

```bash
uv run jupyter execute exp1/results.ipynb
```

To register the environment as a named kernel for IDEs:

```bash
uv run python -m ipykernel install --user --name=color-perception-analysis
```

## Layout

- `pyproject.toml` — uv project; installs `color_analysis` in editable mode
- `python/color_analysis/exp1/` — exp1 loading, discriminability, JND/regression models, makeup-stimulus matching
- `python/color_analysis/exp2/` — exp2 metric extraction, ellipsoid math, group analysis, Welch/normality, original-study mean equivalence and distribution comparison
- `python/color_analysis/expert_clause.py` — shared expert/non-expert clause logic (same default clause as the websites)
- `exp1/results.ipynb`, `exp2/results.ipynb` — the result notebooks

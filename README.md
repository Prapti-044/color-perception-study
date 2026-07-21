# Color Perception — Study & Analysis (anonymized)

This repository contains everything needed to run and analyze our color perception
user studies. It bundles two things in one place:

1. A **study application** (root project) — a [ReVISit](https://revisit.dev)-based
   web app that delivers the experiments to participants.
2. Two **analysis applications** (`analysis/exp1`, `analysis/exp2`) — SvelteKit
   dashboards that ingest the raw study exports and produce the figures and
   statistics used in the paper.
3. Two **analysis notebooks** (`analysis/exp1/results.ipynb`,
   `analysis/exp2/results.ipynb`) — the paper's material, which
   reproduce every figure, table, and statistic from static exports using a
   shared Python package (`analysis/python/color_analysis/`).

The repo is anonymized for review: author names, affiliations, and contact
emails have been removed from study configs and metadata.

---

## Content

### Experiment 1 — JNDs along CIELAB axes

Three sibling study configs under `public/`, each isolating perceptual
discrimination along one CIELAB axis while holding the other two fixed:

| Folder | Channel varied | Title |
| --- | --- | --- |
| `public/colormap-makeup-L/` | `L*` (lightness) | Color Perception Study, L\* channel |
| `public/colormap-makeup-a/` | `a*` (red–green)  | Color Perception Study, a\* channel |
| `public/colormap-makeup-b/` | `b*` (blue–yellow)| Color Perception Study, b\* channel |

Each trial shows a Vega scatterplot with two highlighted points and asks the
participant whether the two colors are the **same** or **different**
(keyboard `f` / `j`). Same-color and large-difference catch trials, attention
checks, an Ishihara color-vision screen, and a makeup / color-theory
demographic questionnaire are interleaved with the JND trials. Stimuli live
under `public/colormap-assets/` (Vega specs, training pages, consent, etc.).

### Experiment 2 — Color-vision perception

`public/color-vision-perception/` is a separate ReVISit study with its own
direction-discrimination stimuli, halfway-break engagement check, and
color-theory questionnaire.

### Analysis apps

Two independent SvelteKit apps that load the raw ReVISit exports and render
the analyses:

- `analysis/exp1/` — discriminability curves, JND models, expert-clause
  filtering, makeup/training group t-tests, and per-participant reports for
  the three CIELAB-axis studies.
- `analysis/exp2/` — perception histograms, normality tests, paper-volume
  distribution comparisons, and study-mean equivalence figures for the
  color-vision study.

Each experiment folder has a **`results.ipynb`** Jupyter notebook — the
paper's analysis — backed by the shared Python package
`analysis/python/color_analysis/`. See [Analysis notebooks](#analysis-notebooks-paper-figures--tables) below.

---

## Repository layout

```
.
├── public/
│   ├── colormap-makeup-{L,a,b}/   # Experiment 1 study configs (one per CIELAB axis)
│   ├── colormap-assets/           # Stimuli, Vega specs, consent, training assets
│   ├── color-vision-perception/   # Experiment 2 study config + assets
│   └── libraries/                 # Imported ReVISit libraries (color-blindness, demographics, …)
├── src/                           # ReVISit study runner (React + Mantine + Redux/Trrack)
├── analysis/
│   ├── exp1/                      # Experiment 1: SvelteKit dashboard + results.ipynb
│   ├── exp2/                      # Experiment 2: SvelteKit dashboard + results.ipynb
│   ├── python/color_analysis/     # Shared Python stats pipeline for the notebooks
│   ├── pyproject.toml             # uv-managed Python env for the notebooks
│   └── uv.lock
├── tests/                         # Playwright end-to-end tests for the study app
├── package.json                   # Root (study app) — yarn
└── pnpm-lock.yaml                 # Analysis apps — pnpm workspaces
```

---


## Code Reproducibility

The code in this repository is reproducible. The analysis notebooks are backed by a shared Python package `analysis/python/color_analysis/`, which mirrors the TypeScript implementation used by the dashboards. 
The notebooks reproduce every figure, table, and statistic from static exports.

## Running the analysis notebooks

```bash
uv run jupyter lab analysis/exp1/results.ipynb
uv run jupyter lab analysis/exp2/results.ipynb
```

## Analysis Jupyter notebooks (paper figures & tables)

In addition to the interactive dashboards, each experiment has a Jupyter
notebook that is the **analyses material** for the paper *Ten Years Later:
Replicating Two Color Discrimination Studies*. The notebooks reproduce every
figure, table, and statistic from static exports. They call the Python package
`analysis/python/color_analysis/`, which mirrors the TypeScript implementation
used by the dashboards, so both surfaces compute identical results.

### `analysis/exp1/results.ipynb` — Modeling Color Differences

Replication of Szafir, *Modeling Color Difference for Visualization Design*
(IEEE TVCG 2018), with a color-practice extension.

- **Part A — Replication.** Cohort overview and demographics; per axis × mark-size
  through-origin regression $p = m_x\,\Delta x$ with derived 50% JND thresholds
  $ND(50\%) = 0.5 / m_x$; comparison of slopes, $R^2$, and thresholds against the
  original study; inverse-size slope models and the effect sizes of the
  replication differences.
- **Part B — Extension.** 50% JND curves and Welch's t-tests on participant-level
  accuracy, split by self-reported color practice (Known vs. Unknown Color
  Practice from the makeup / color-theory / hobby questionnaire).

### `analysis/exp2/results.ipynb` — Color Discrimination Test

Replication of Reinecke, Flatla & Brooks, *Enabling Designers to Foresee Which
Colors Users Cannot See* (CHI 2016), with a color-practice extension.

- **Part A — Replication.** Staircase thresholds per color vector; reconstruction
  of per-participant **discrimination ellipsoids** in CIE L\*u\*v\* space and their
  volumes; comparison of the ellipsoid-volume distribution against the original
  study.
- **Part B — Extension.** Group summaries, ellipsoid volumes by color practice,
  Welch's t-tests, and normality diagnostics.

### Data

The notebooks read the same gitignored ReVISit exports as the dashboards:

- **exp1** → `analysis/exp1/data/colormap-makeup-{L,a,b}_all.json` (plus the
  checked-in `scatterplots_metadata.json`).
- **exp2** → `analysis/exp2/static/color-vision-data/color-vision-perception_{male,female}.json`.

### Running

The notebooks use a [`uv`](https://docs.astral.sh/uv/)-managed Python
environment defined in `analysis/pyproject.toml` (Python ≥ 3.12; NumPy, pandas,
SciPy, statsmodels, Matplotlib, seaborn, colorspacious). From `analysis/`:

```bash
uv sync
uv run jupyter lab exp1/results.ipynb        # or exp2/results.ipynb
uv run jupyter execute exp1/results.ipynb     # non-interactive re-run
```

---

## Running the study app

Prerequisites: Node.js (LTS) and Yarn. If Yarn is missing, install it with
`npm i -g yarn`. The root project enforces Yarn via a `preinstall` hook.

```bash
yarn install
yarn serve            # http://localhost:8080
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `yarn serve` | Start the study app on `http://localhost:8080` |
| `yarn build` | Type-check and produce a production bundle |
| `yarn typecheck` | TypeScript only, no emit |
| `yarn lint` | ESLint over `src/` (Airbnb config) |
| `yarn unittest` | Vitest unit tests |
| `yarn test` | Playwright end-to-end tests |
| `yarn generate-schemas` | Regenerate JSON schemas from `src/parser/types.ts` |

Once running, each study is at:

- `http://localhost:8080/colormap-makeup-L`
- `http://localhost:8080/colormap-makeup-a`
- `http://localhost:8080/colormap-makeup-b`
- `http://localhost:8080/color-vision-perception`

A `.env` file selects the storage backend (Firebase or Supabase). For local
exploration without a backend, ReVISit will use local storage by default.

### Docker

A `Dockerfile` and `nginx-docker.conf` are provided for containerized
deployment behind nginx. Build and run:

```bash
docker build -t color-perception-study .
docker run --rm -p 8080:80 color-perception-study
```

---

## Running the analysis apps

Both analysis apps are SvelteKit projects managed with `pnpm`. They are
independent of the root project — install dependencies inside each folder.

### Experiment 1

```bash
cd analysis/exp1
pnpm install
pnpm dev          # http://localhost:5173
```

Place the raw ReVISit exports for the three conditions in
`analysis/exp1/data/`:

```
analysis/exp1/data/
├── colormap-makeup-L_all.json
├── colormap-makeup-a_all.json
└── colormap-makeup-b_all.json
```

Other useful scripts in `analysis/exp1`: `pnpm build`, `pnpm preview`,
`pnpm check` (svelte-check + tsc).

### Experiment 2

```bash
cd analysis/exp2
pnpm install
pnpm dev
```

Each analysis app keeps colocated unit tests (Vitest) for its statistics and
data-shaping code (e.g., `studyMeanEquivalence.spec.js`,
`expertClause.spec.js`, `makeup.spec.ts`). Run them from inside the app
directory:

```bash
pnpm exec vitest
```

---

## Data flow

1. Participants run a study config (`public/<study>/config.json`) inside the
   ReVISit runner served from `src/`.
2. Responses are persisted to the configured storage engine (Firebase /
   Supabase / local).
3. Researchers export the per-study `*_all.json` bundle from the ReVISit
   analysis dashboard.
4. The Svelte analysis apps consume those bundles directly from
   `analysis/exp*/data/` and render the figures.
5. The `results.ipynb` notebooks consume the same bundles via the
   `analysis/python/color_analysis/` pipeline and reproduce the paper's figures,
   tables, and statistics.

---

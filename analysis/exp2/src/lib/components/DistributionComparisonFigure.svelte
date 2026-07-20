<script lang="ts">
	import { interpretCohensD, type DistributionComparison } from '$lib/distributionComparison';

	type Props = {
		comparison: DistributionComparison;
		modeLabel: string;
	};

	let { comparison, modeLabel }: Props = $props();

	const volumeFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});
	const integerFormatter = new Intl.NumberFormat('en-US');

	function fmtVol(value: number): string {
		return volumeFormatter.format(value);
	}

	function fmtNum(value: number, digits: number): string {
		return Number.isFinite(value) ? value.toFixed(digits) : '—';
	}

	function fmtInt(value: number): string {
		return integerFormatter.format(value);
	}

	function fmtRatio(value: number): string {
		return `${value.toFixed(2)}×`;
	}

	function fmtP(value: number): string {
		if (value <= 0 || value < 1e-10) {
			return '< 1e-10';
		}
		if (value < 1e-4) {
			return value.toExponential(2);
		}
		return value.toFixed(4);
	}

	const descriptiveRows = $derived.by(() => {
		const o = comparison.original;
		const c = comparison.current;
		const ratio = (current: number, original: number) =>
			original === 0 ? '—' : fmtRatio(current / original);

		return [
			{ label: 'Participants (n)', original: fmtInt(o.n), current: fmtInt(c.n), ratio: '—', highlight: false },
			{ label: 'Mean', original: fmtVol(o.mean), current: fmtVol(c.mean), ratio: ratio(c.mean, o.mean), highlight: false },
			{ label: 'SD', original: fmtVol(o.sd), current: fmtVol(c.sd), ratio: ratio(c.sd, o.sd), highlight: false },
			{ label: 'CV (SD ÷ mean)', original: fmtNum(o.cv, 2), current: fmtNum(c.cv, 2), ratio: ratio(c.cv, o.cv), highlight: false },
			{ label: 'Minimum', original: fmtVol(o.min), current: fmtVol(c.min), ratio: ratio(c.min, o.min), highlight: false },
			{ label: 'Q1 (25%)', original: fmtVol(o.q1), current: fmtVol(c.q1), ratio: ratio(c.q1, o.q1), highlight: false },
			{ label: 'Median (50%)', original: fmtVol(o.median), current: fmtVol(c.median), ratio: ratio(c.median, o.median), highlight: true },
			{ label: 'Q3 (75%)', original: fmtVol(o.q3), current: fmtVol(c.q3), ratio: ratio(c.q3, o.q3), highlight: false },
			{ label: 'Maximum', original: fmtVol(o.max), current: fmtVol(c.max), ratio: ratio(c.max, o.max), highlight: false },
			{ label: 'Skewness', original: '—', current: fmtNum(c.skewness, 2), ratio: '—', highlight: false },
			{ label: 'Geometric mean', original: '—', current: fmtVol(c.geoMean), ratio: '—', highlight: false }
		];
	});

	const testRows = $derived.by(() => {
		const w = comparison.welchRaw;
		const t = comparison.tost;
		const l = comparison.logScale;
		const m = comparison.monteCarlo;

		return [
			{
				test: 'Welch t-test — raw mean',
				detail: 'Difference in mean volume. Sensitive to the extreme upper tail.',
				statistic: `t(${fmtNum(w.degreesOfFreedom, 1)}) = ${fmtNum(w.tStatistic, 2)}`,
				p: fmtP(w.pValue),
				effect: `Cohen's d = ${fmtNum(w.cohenD, 2)} (${interpretCohensD(w.cohenD)})`
			},
			{
				test: 'Equivalence (TOST)',
				detail: `Margin ±${fmtVol(t.margin)} (0.2 × original SD).`,
				statistic: `max one-sided p = ${fmtP(t.maxPValue)}`,
				p: '—',
				effect: t.equivalent ? 'Equivalent' : 'Not equivalent'
			},
			{
				test: 'Median ratio',
				detail: 'Distribution-free location shift (this study ÷ original).',
				statistic: fmtRatio(l.medianRatio),
				p: '—',
				effect: '—'
			},
			{
				test: 'Welch t-test — log scale',
				detail: 'Location shift on ln(volume); the appropriate lens for skewed volumes.',
				statistic: `t(${fmtNum(l.welchLog.degreesOfFreedom, 1)}) = ${fmtNum(l.welchLog.tStatistic, 2)}`,
				p: fmtP(l.welchLog.pValue),
				effect: `Cohen's d = ${fmtNum(l.cohenDLog, 2)} (${interpretCohensD(l.cohenDLog)})`
			},
			{
				test: 'Probability of superiority',
				detail: 'P(random this-study participant > random original participant), log-normal.',
				statistic: fmtNum(l.probabilitySuperiority, 3),
				p: '—',
				effect: '—'
			},
			{
				test: 'Kolmogorov–Smirnov *',
				detail: 'Two-sample KS against the resampled original.',
				statistic: `D = ${fmtNum(m.ks.dStatistic, 3)}`,
				p: fmtP(m.ks.pValue),
				effect: '—'
			},
			{
				test: 'Mann–Whitney U *',
				detail: 'Rank-based location shift against the resampled original.',
				statistic: `z = ${fmtNum(m.mannWhitney.zScore, 2)}`,
				p: fmtP(m.mannWhitney.pValue),
				effect: `P(this > orig) = ${fmtNum(m.mannWhitney.probabilitySuperiority, 3)}`
			}
		];
	});

	const interpretation = $derived.by(() => {
		const l = comparison.logScale;
		const shiftDirection = l.medianRatio >= 1 ? 'larger' : 'smaller';
		return (
			`Both distributions share the same right-skewed, log-normal-like shape, but this study's volumes are ` +
			`systematically ${shiftDirection}: the median is ${fmtRatio(l.medianRatio)} the original's, a ` +
			`${fmtNum(l.cohenDLog, 2)} standard-deviation shift on the log scale (Welch log-scale p = ${fmtP(l.welchLog.pValue)}), ` +
			`with a ${fmtNum(l.probabilitySuperiority, 2)} probability that a random participant here exceeds a random original participant. ` +
			`The raw-mean t-test is only marginal (Cohen's d = ${fmtNum(comparison.welchRaw.cohenD, 2)}) because the original mean is dominated by its extreme tail, ` +
			`so the log-scale and rank-based results are the trustworthy ones.`
		);
	});

	const rawMagnitude = $derived(interpretCohensD(comparison.welchRaw.cohenD));
	const logMagnitude = $derived(interpretCohensD(comparison.logScale.cohenDLog));

	const effectSizeAnalysis = $derived.by(() => {
		const w = comparison.welchRaw;
		const l = comparison.logScale;
		const superiorityPercent = (l.probabilitySuperiority * 100).toFixed(0);

		return (
			`On the raw scale the standardized mean difference is Cohen's d = ${fmtNum(w.cohenD, 2)} — a ${rawMagnitude} effect ` +
			`by Cohen's benchmarks (0.2 small, 0.5 medium, 0.8 large) — but that value is deflated because the original study's ` +
			`mean and SD are inflated by its extreme upper tail (CV ${fmtNum(comparison.original.cv, 1)}). ` +
			`The log-scale contrast is the appropriate effect size for a multiplicative, right-skewed volume metric, and it is ` +
			`markedly stronger at Cohen's d = ${fmtNum(l.cohenDLog, 2)} (${logMagnitude}). ` +
			`As common-language effect sizes, a randomly chosen participant here has the larger ellipsoid volume about ` +
			`${superiorityPercent}% of the time (0.5 = no difference), and the typical (median) volume is ${fmtRatio(l.medianRatio)} the original's. ` +
			`Bottom line: a ${rawMagnitude} effect on the raw mean but a ${logMagnitude}, well-supported shift once the skew is handled.`
		);
	});
</script>

<div class="comparison-card overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
	<div class="border-b border-slate-100 px-5 py-4">
		<p class="text-sm font-semibold text-slate-950">Original study vs this study — {modeLabel}</p>
		<p class="mt-1 text-xs leading-relaxed text-slate-500">
			The original study is published only as summary statistics (n = {fmtInt(comparison.original.n)},
			mean = {fmtVol(comparison.original.mean)}, SD = {fmtVol(comparison.original.sd)}), so exact
			two-sample tests use the moments directly (Welch, TOST) or the log-normal model, and the
			rank-based rows marked * are Monte-Carlo sensitivity checks.
		</p>
	</div>

	<div class="grid gap-6 p-5 lg:grid-cols-2">
		<div class="overflow-x-auto rounded-xl border border-slate-100">
			<table class="stat-table min-w-full text-sm">
				<caption class="stat-caption">Distribution descriptives</caption>
				<thead>
					<tr>
						<th scope="col">Statistic</th>
						<th scope="col">Original</th>
						<th scope="col">This study</th>
						<th scope="col">Ratio</th>
					</tr>
				</thead>
				<tbody>
					{#each descriptiveRows as row (row.label)}
						<tr class={row.highlight ? 'row-highlight' : ''}>
							<td data-label="Statistic" class="stat-label">{row.label}</td>
							<td data-label="Original" class="tabular-nums">{row.original}</td>
							<td data-label="This study" class="tabular-nums font-semibold text-slate-950">{row.current}</td>
							<td data-label="Ratio" class="tabular-nums">{row.ratio}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="overflow-x-auto rounded-xl border border-slate-100">
			<table class="stat-table min-w-full text-sm">
				<caption class="stat-caption">Statistical tests</caption>
				<thead>
					<tr>
						<th scope="col">Test</th>
						<th scope="col">Statistic</th>
						<th scope="col">p-value</th>
						<th scope="col">Effect / verdict</th>
					</tr>
				</thead>
				<tbody>
					{#each testRows as row (row.test)}
						<tr>
							<td data-label="Test">
								<span class="stat-label">{row.test}</span>
								<span class="stat-detail">{row.detail}</span>
							</td>
							<td data-label="Statistic" class="tabular-nums">{row.statistic}</td>
							<td data-label="p-value" class="tabular-nums">{row.p}</td>
							<td data-label="Effect / verdict" class="tabular-nums">{row.effect}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div class="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm leading-relaxed text-slate-700">
		<p>{interpretation}</p>

		<div class="mt-3 rounded-lg border border-slate-200/80 bg-white/70 p-3">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Effect-size analysis</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<span class="effect-chip">Raw d = {fmtNum(comparison.welchRaw.cohenD, 2)} · {rawMagnitude}</span>
				<span class="effect-chip effect-chip-strong">Log d = {fmtNum(comparison.logScale.cohenDLog, 2)} · {logMagnitude}</span>
				<span class="effect-chip">P(superiority) = {fmtNum(comparison.logScale.probabilitySuperiority, 2)}</span>
				<span class="effect-chip">Median ratio = {fmtRatio(comparison.logScale.medianRatio)}</span>
			</div>
			<p class="mt-2">{effectSizeAnalysis}</p>
		</div>

		<p class="mt-3 text-xs text-slate-500">
			* The original raw sample is unavailable, so the KS and Mann–Whitney rows resample the original
			from a log-normal matched to its published quartiles (fixed seed
			{integerFormatter.format(comparison.monteCarlo.seed)}); treat them as a shape-assuming sensitivity
			check rather than an exact test.
		</p>
	</div>
</div>

<style>
	.stat-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
	}

	.stat-caption {
		caption-side: top;
		text-align: left;
		padding: 0.75rem 1rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #64748b;
	}

	.stat-table thead th {
		text-align: left;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #64748b;
		padding: 0.6rem 1rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.stat-table tbody td {
		vertical-align: top;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
	}

	.stat-table tbody tr:last-child td {
		border-bottom: none;
	}

	.stat-table tbody tr.row-highlight td {
		background: rgba(20, 184, 166, 0.08);
	}

	.stat-label {
		display: block;
		font-weight: 600;
		color: #0f172a;
	}

	.stat-detail {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: #64748b;
	}

	.effect-chip {
		display: inline-flex;
		align-items: center;
		border-radius: 9999px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		padding: 0.15rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #334155;
	}

	.effect-chip-strong {
		border-color: #99f6e4;
		background: rgba(20, 184, 166, 0.1);
		color: #0f766e;
	}

	@media (max-width: 640px) {
		.stat-table thead {
			display: none;
		}

		.stat-table tbody tr {
			display: grid;
			gap: 0.35rem;
			padding: 0.75rem 0;
		}

		.stat-table tbody td {
			display: grid;
			grid-template-columns: minmax(0, 8rem) 1fr;
			gap: 0.5rem;
			padding: 0 1rem;
			border: none;
		}

		.stat-table tbody td::before {
			content: attr(data-label);
			font-size: 0.7rem;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: #94a3b8;
		}
	}
</style>

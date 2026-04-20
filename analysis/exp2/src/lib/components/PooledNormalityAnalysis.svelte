<script lang="ts">
	import type { NormalityVariableAnalysis } from '$lib/colorVisionGroupAnalysis';

	type Props = {
		alpha: number;
		variables: NormalityVariableAnalysis[];
	};

	let { alpha, variables }: Props = $props();

	const integerFormatter = new Intl.NumberFormat('en-US');
	const twoDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});
	const threeDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 3,
		minimumFractionDigits: 3
	});

	function formatW(value: number | null) {
		return value === null ? '—' : threeDecimalFormatter.format(value);
	}

	function formatPValue(value: number | null) {
		if (value === null) {
			return '—';
		}
		if (value < 0.001) {
			return '< 0.001';
		}
		if (value < 0.01) {
			return value.toFixed(4);
		}
		return value.toFixed(3);
	}

	function formatMean(id: string, value: number) {
		if (id === 'trialAccuracy') {
			return `${(value * 100).toFixed(1)}%`;
		}
		if (id === 'meanRawThreshold') {
			return value.toFixed(1);
		}
		if (id === 'meanNormalizedThreshold') {
			return value.toFixed(3);
		}
		return integerFormatter.format(Math.round(value));
	}

	function formatSd(id: string, value: number) {
		return formatMean(id, value);
	}

	function verdictLabel(verdict: 'reject' | 'fail-to-reject' | null) {
		if (verdict === null) {
			return 'n too small';
		}
		return verdict === 'reject'
			? `Reject (p < ${alpha})`
			: `Fail to reject (p ≥ ${alpha})`;
	}

	const POOLED_COLOR = '#4338ca';

	const PLOT_WIDTH = 240;
	const PLOT_HEIGHT = 200;
	const PLOT_MARGIN = { top: 14, right: 14, bottom: 36, left: 40 };
	const INNER_WIDTH = PLOT_WIDTH - PLOT_MARGIN.left - PLOT_MARGIN.right;
	const INNER_HEIGHT = PLOT_HEIGHT - PLOT_MARGIN.top - PLOT_MARGIN.bottom;
	const AXIS_LIMIT = 3;

	function xScale(theoretical: number) {
		const clamped = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, theoretical));
		return ((clamped + AXIS_LIMIT) / (2 * AXIS_LIMIT)) * INNER_WIDTH;
	}

	function yScale(sample: number) {
		const clamped = Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, sample));
		return INNER_HEIGHT - ((clamped + AXIS_LIMIT) / (2 * AXIS_LIMIT)) * INNER_HEIGHT;
	}

	const AXIS_TICKS = [-3, -2, -1, 0, 1, 2, 3];
</script>

<div class="pooled-normality-analysis flex flex-col gap-8">
	<div class="overflow-x-auto rounded-2xl border border-slate-100">
		<table class="pooled-normality-table min-w-full text-sm">
			<thead>
				<tr>
					<th scope="col" rowspan="2">Variable</th>
					<th scope="col" rowspan="2">n</th>
					<th scope="col" colspan="2">Descriptive</th>
					<th scope="col" rowspan="2">W</th>
					<th scope="col" rowspan="2">p-value</th>
					<th scope="col" rowspan="2">Verdict at α = {alpha}</th>
				</tr>
				<tr>
					<th scope="col" class="sub">Mean</th>
					<th scope="col" class="sub">SD</th>
				</tr>
			</thead>
			<tbody>
				{#each variables as variable}
					{@const pooled = variable.pooled}
					<tr>
						<td class="variable-cell">
							<span class="variable-label">{variable.label}</span>
							<p class="variable-desc">{variable.description}</p>
						</td>
						<td class="tabular-nums">{integerFormatter.format(pooled.n)}</td>
						<td class="tabular-nums">
							{pooled.n === 0 ? '—' : formatMean(variable.id, pooled.mean)}
						</td>
						<td class="tabular-nums">
							{pooled.n < 2 ? '—' : formatSd(variable.id, pooled.sd)}
						</td>
						<td class="tabular-nums font-semibold text-slate-950">{formatW(pooled.W)}</td>
						<td class="tabular-nums font-semibold text-slate-950">
							{formatPValue(pooled.pValue)}
						</td>
						<td>
							<span
								class="verdict-pill"
								class:verdict-pill--reject={pooled.verdict === 'reject'}
								class:verdict-pill--pass={pooled.verdict === 'fail-to-reject'}
								class:verdict-pill--na={pooled.verdict === null}
							>
								{verdictLabel(pooled.verdict)}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="qq-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
		{#each variables as variable}
			{@const pooled = variable.pooled}
			<div class="qq-variable rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
				<div class="flex items-baseline justify-between">
					<h3 class="text-sm font-semibold text-slate-950">{variable.label}</h3>
					<span class="text-xs text-slate-500">standardized Q–Q</span>
				</div>
				<p class="mt-1 text-xs leading-snug text-slate-500">{variable.description}</p>

				<figure class="mt-3">
					<figcaption
						class="flex items-center justify-between text-xs font-semibold text-slate-700"
					>
						<span class="flex items-center gap-2">
							<span class="group-dot" style="background: {POOLED_COLOR}"></span>
							All participants (n = {integerFormatter.format(pooled.n)})
						</span>
						<span class="text-slate-500">
							W = {formatW(pooled.W)}, p = {formatPValue(pooled.pValue)}
						</span>
					</figcaption>

					<svg
						role="img"
						aria-label="Pooled Q–Q plot for {variable.label}"
						viewBox="0 0 {PLOT_WIDTH} {PLOT_HEIGHT}"
						class="mt-1 w-full"
					>
						<g transform="translate({PLOT_MARGIN.left},{PLOT_MARGIN.top})">
							<rect
								x="0"
								y="0"
								width={INNER_WIDTH}
								height={INNER_HEIGHT}
								class="plot-frame"
							/>

							{#each AXIS_TICKS as tick}
								<line
									x1={xScale(tick)}
									x2={xScale(tick)}
									y1="0"
									y2={INNER_HEIGHT}
									class="grid-line"
								/>
								<line
									x1="0"
									x2={INNER_WIDTH}
									y1={yScale(tick)}
									y2={yScale(tick)}
									class="grid-line"
								/>
							{/each}

							<line
								x1={xScale(-AXIS_LIMIT)}
								y1={yScale(-AXIS_LIMIT)}
								x2={xScale(AXIS_LIMIT)}
								y2={yScale(AXIS_LIMIT)}
								class="reference-line"
							/>

							{#if pooled.qq.length === 0}
								<text
									x={INNER_WIDTH / 2}
									y={INNER_HEIGHT / 2}
									class="empty-label"
									text-anchor="middle"
									dominant-baseline="middle"
								>
									Not enough data
								</text>
							{:else}
								{#each pooled.qq as point}
									<circle
										cx={xScale(point.theoretical)}
										cy={yScale(point.sample)}
										r="2.5"
										fill={POOLED_COLOR}
										fill-opacity="0.6"
										stroke="white"
										stroke-width="0.5"
									/>
								{/each}
							{/if}

							{#each AXIS_TICKS as tick}
								<text
									x={xScale(tick)}
									y={INNER_HEIGHT + 14}
									class="axis-tick"
									text-anchor="middle"
								>
									{tick}
								</text>
								<text
									x={-6}
									y={yScale(tick)}
									class="axis-tick"
									text-anchor="end"
									dominant-baseline="middle"
								>
									{twoDecimalFormatter.format(tick)}
								</text>
							{/each}

							<text
								x={INNER_WIDTH / 2}
								y={INNER_HEIGHT + 30}
								class="axis-label"
								text-anchor="middle"
							>
								Theoretical quantile
							</text>
							<text
								transform="translate(-30,{INNER_HEIGHT / 2}) rotate(-90)"
								class="axis-label"
								text-anchor="middle"
							>
								Standardized sample
							</text>
						</g>
					</svg>
				</figure>
			</div>
		{/each}
	</div>
</div>

<style>
	.pooled-normality-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
	}

	.pooled-normality-table thead th {
		text-align: left;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #64748b;
		padding: 0.6rem 0.85rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		vertical-align: bottom;
	}

	.pooled-normality-table thead th.sub {
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: #94a3b8;
	}

	.pooled-normality-table tbody td {
		padding: 0.75rem 0.85rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		vertical-align: middle;
	}

	.pooled-normality-table tbody tr:last-child td {
		border-bottom: none;
	}

	.variable-cell {
		background: #fcfdff;
		min-width: 12rem;
	}

	.variable-label {
		display: block;
		font-weight: 600;
		color: #0f172a;
	}

	.variable-desc {
		margin-top: 0.2rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: #64748b;
	}

	.group-dot {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		margin-right: 0.35rem;
		vertical-align: middle;
	}

	.verdict-pill {
		display: inline-block;
		padding: 0.2rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 600;
		border-radius: 999px;
		background: #f1f5f9;
		color: #475569;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	.verdict-pill--reject {
		background: #fee2e2;
		color: #b91c1c;
	}

	.verdict-pill--pass {
		background: #ccfbf1;
		color: #0f766e;
	}

	.verdict-pill--na {
		background: #f1f5f9;
		color: #94a3b8;
	}

	.plot-frame {
		fill: #fdfdff;
		stroke: #e2e8f0;
		stroke-width: 1;
	}

	.grid-line {
		stroke: #eef2f7;
		stroke-width: 1;
	}

	.reference-line {
		stroke: #94a3b8;
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.axis-tick {
		font-size: 9px;
		fill: #94a3b8;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
	}

	.axis-label {
		font-size: 10px;
		fill: #64748b;
	}

	.empty-label {
		font-size: 11px;
		fill: #94a3b8;
	}

	@media (max-width: 768px) {
		.pooled-normality-table thead {
			display: none;
		}

		.pooled-normality-table,
		.pooled-normality-table tbody,
		.pooled-normality-table tr,
		.pooled-normality-table td {
			display: block;
			width: 100%;
		}

		.pooled-normality-table tbody tr {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid #e2e8f0;
		}

		.pooled-normality-table tbody td {
			padding: 0.2rem 0;
			border: none;
		}

		.variable-cell {
			padding-bottom: 0.5rem !important;
		}
	}
</style>

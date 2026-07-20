<script lang="ts">
	import type {
		AxisComparisonSummary,
		BetterModel,
		InverseModelComparison,
		PairedStats,
		RegressionComparison
	} from '$lib/types';
	import { formatNumber, compareByAxisAndSize } from '$lib/utils';
	import Section from './Section.svelte';
	import DataTable from './DataTable.svelte';

	interface Props {
		regressionComparison: RegressionComparison[];
		inverseModelComparison: InverseModelComparison[];
		axisComparison: AxisComparisonSummary[];
	}

	let {
		regressionComparison,
		inverseModelComparison,
		axisComparison
	}: Props = $props();

	const axisOrder = ['L', 'a', 'b'];

	const sortedRegComparison = $derived([...regressionComparison].sort(compareByAxisAndSize));

	const sortedInvComparison = $derived(
		axisOrder
			.filter((axis) => inverseModelComparison.some((r) => r.axis === axis))
			.map((axis) => inverseModelComparison.find((r) => r.axis === axis)!)
	);

	const sortedAxisComparison = $derived(
		axisOrder
			.filter((axis) => axisComparison.some((r) => r.axis === axis))
			.map((axis) => axisComparison.find((r) => r.axis === axis)!)
	);

	function getDiffClass(pctDiff: number): string {
		if (isNaN(pctDiff)) return 'text-slate-500';
		if (Math.abs(pctDiff) < 20) return 'text-green-600 font-semibold';
		if (Math.abs(pctDiff) < 50) return 'text-yellow-600 font-semibold';
		return 'text-red-600 font-semibold';
	}

	function betterLabel(better: BetterModel): string {
		if (better === 'current') return 'Ours';
		if (better === 'reference') return 'Szafir';
		return 'Tie';
	}

	function betterClass(better: BetterModel): string {
		if (better === 'current') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
		if (better === 'reference') return 'bg-indigo-100 text-indigo-700 border-indigo-300';
		return 'bg-slate-100 text-slate-600 border-slate-300';
	}

	function formatPValue(p: number): string {
		if (!Number.isFinite(p)) return 'N/A';
		if (p < 0.001) return '< .001';
		return p.toFixed(3);
	}

	function pClass(p: number): string {
		if (!Number.isFinite(p)) return 'text-slate-500';
		if (p < 0.001) return 'text-red-700 font-semibold';
		if (p < 0.01) return 'text-red-600 font-semibold';
		if (p < 0.05) return 'text-amber-600 font-semibold';
		return 'text-slate-600';
	}

	// Interpret |Cohen's d| using the classical thresholds:
	// negligible (<0.2), small (<0.5), medium (<0.8), large (≥0.8).
	function cohensDMagnitude(d: number): string {
		if (!Number.isFinite(d)) return '';
		const abs = Math.abs(d);
		if (abs < 0.2) return 'negligible';
		if (abs < 0.5) return 'small';
		if (abs < 0.8) return 'medium';
		return 'large';
	}

	// Render a paired-stats block for a single axis (slope or ND50 view).
	function meanDiffDirection(stats: PairedStats): string {
		if (!Number.isFinite(stats.mean_diff)) return '';
		if (stats.mean_diff === 0) return '(no shift)';
		return stats.mean_diff > 0
			? '(current > Szafir on average)'
			: '(current < Szafir on average)';
	}
</script>

{#if regressionComparison.length > 0}
	<Section
		title="Comparison to Original Paper"
		subtitle="Comparing current study results to 'Modeling Color Difference for Visualization Design' (Szafir et al.)"
	>
		<h3 class="mb-4 text-lg font-medium text-slate-700">Per-Size Regression Comparison</h3>
		<p class="mb-4 text-sm text-slate-500">
			The <em>Better</em> column reports which study's fitted slope implies stronger human
			discriminability at that condition — a higher slope (equivalently a lower ND50) means
			participants achieved 50% discriminability at a smaller ΔE, so we mark the model with the
			higher slope as the winner.
			The <em>z</em>, <em>p</em>, and Cohen's <em>d</em> columns are Wald-style tests of the
			current slope against Szafir et al.'s fixed slope, standardised by our fitted slope
			standard error.
		</p>
		<DataTable
			headers={[
				'Axis',
				'Size (°)',
				'Current Slope',
				'Reference Slope',
				'Diff',
				'% Diff',
				'Better',
				'z',
				'p',
				"Cohen's d",
				'Current R²',
				'Ref R²',
				'Current ND50',
				'Ref ND50'
			]}
		>
			{#each sortedRegComparison as row (`${row.axis}-${row.size_deg}`)}
				<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
					<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.size_deg, 2)}</td>
					<td class="px-3 py-3 text-slate-600">
						{formatNumber(row.current_slope, 4)}
						<span class="ml-1 text-xs text-slate-400">± {formatNumber(row.current_slope_se, 4)}</span>
					</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_slope, 4)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.slope_diff, 4, true)}</td>
					<td class="px-3 py-3 {getDiffClass(row.slope_pct_diff)}">
						{isNaN(row.slope_pct_diff)
							? 'N/A'
							: `${row.slope_pct_diff > 0 ? '+' : ''}${formatNumber(row.slope_pct_diff, 1)}%`}
					</td>
					<td class="px-3 py-3">
						<span
							class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold {betterClass(row.better)}"
						>
							{betterLabel(row.better)}
						</span>
					</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.slope_z, 2, true)}</td>
					<td class="px-3 py-3 {pClass(row.slope_p)}">{formatPValue(row.slope_p)}</td>
					<td class="px-3 py-3 text-slate-600">
						{formatNumber(row.slope_cohens_d, 2, true)}
						{#if Number.isFinite(row.slope_cohens_d)}
							<span class="ml-1 text-xs text-slate-400">({cohensDMagnitude(row.slope_cohens_d)})</span>
						{/if}
					</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_r2, 3)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_r2, 3)}</td>
					<td class="px-3 py-3 text-slate-600">
						{formatNumber(row.current_nd50, 2)}
						<span class="ml-1 text-xs text-slate-400">± {formatNumber(row.current_nd50_se, 2)}</span>
					</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_nd50, 2)}</td>
				</tr>
			{/each}
		</DataTable>

		{#if sortedAxisComparison.length > 0}
			<h3 class="mb-4 mt-8 text-lg font-medium text-slate-700">
				Per-Axis Paired Statistical Comparison
			</h3>
			<p class="mb-4 text-sm text-slate-500">
				Each axis pools all sizes into paired observations (current vs. Szafir et al.) and reports
				a paired t-test on the differences, Cohen's <em>d<sub>z</sub></em> (mean of differences ÷
				SD of differences), Pearson <em>r</em>, Lin's concordance correlation coefficient (CCC),
				and RMSE / MAE between the two studies.
			</p>

			<div class="space-y-6">
				{#each sortedAxisComparison as summary (summary.axis)}
					<div class="rounded-lg border border-slate-200 bg-slate-50 p-5">
						<div class="mb-3 flex items-center justify-between gap-3">
							<h4 class="text-base font-semibold text-slate-800">
								Axis {summary.axis}
								<span class="ml-2 text-sm font-normal text-slate-500">
									({summary.n_sizes} paired sizes)
								</span>
							</h4>
							<span
								class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold {betterClass(summary.better)}"
							>
								Overall winner: {betterLabel(summary.better)}
							</span>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										></th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>Current mean</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>Szafir mean</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>Mean diff</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>t (df)</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>p</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>Cohen's d<sub>z</sub></th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>Pearson r</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>CCC</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>RMSE</th>
										<th
											class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
										>MAE</th>
									</tr>
								</thead>
								<tbody>
									<tr class="border-b border-slate-100 bg-white">
										<td class="px-3 py-2 font-medium text-slate-700">Slope m<sub>x</sub></td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.current_mean, 4)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.ref_mean, 4)}</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.slope.mean_diff, 4, true)}
											<span class="ml-1 text-xs text-slate-400">
												{meanDiffDirection(summary.slope)}
											</span>
										</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.slope.t, 2, true)}
											<span class="ml-1 text-xs text-slate-400">({formatNumber(summary.slope.df, 0)})</span>
										</td>
										<td class="px-3 py-2 {pClass(summary.slope.p)}">{formatPValue(summary.slope.p)}</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.slope.cohens_dz, 2, true)}
											{#if Number.isFinite(summary.slope.cohens_dz)}
												<span class="ml-1 text-xs text-slate-400">({cohensDMagnitude(summary.slope.cohens_dz)})</span>
											{/if}
										</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.pearson_r, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.ccc, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.rmse, 4)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.slope.mae, 4)}</td>
									</tr>
									<tr class="border-b border-slate-100 bg-white">
										<td class="px-3 py-2 font-medium text-slate-700">ND(50%)</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.current_mean, 2)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.ref_mean, 2)}</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.nd50.mean_diff, 2, true)}
											<span class="ml-1 text-xs text-slate-400">
												{meanDiffDirection(summary.nd50)}
											</span>
										</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.nd50.t, 2, true)}
											<span class="ml-1 text-xs text-slate-400">({formatNumber(summary.nd50.df, 0)})</span>
										</td>
										<td class="px-3 py-2 {pClass(summary.nd50.p)}">{formatPValue(summary.nd50.p)}</td>
										<td class="px-3 py-2 text-slate-600">
											{formatNumber(summary.nd50.cohens_dz, 2, true)}
											{#if Number.isFinite(summary.nd50.cohens_dz)}
												<span class="ml-1 text-xs text-slate-400">({cohensDMagnitude(summary.nd50.cohens_dz)})</span>
											{/if}
										</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.pearson_r, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.ccc, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.rmse, 2)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(summary.nd50.mae, 2)}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
				<p class="mb-2 font-semibold text-slate-800">How to read the comparison</p>
				<ul class="list-inside list-disc space-y-1">
					<li>
						<strong>Better (per row):</strong> the study whose fitted slope predicts higher
						discriminability at that (axis, size). A higher slope directly implies participants
						reach 50% discriminability at a smaller ΔE — i.e. more sensitive perception.
					</li>
					<li>
						<strong>z and p (per row):</strong> Wald test of our slope against Szafir et al.'s
						reported slope, using our fitted slope standard error. p &lt; .05 means our estimate is
						significantly displaced from theirs at that condition.
					</li>
					<li>
						<strong>Cohen's d (per row):</strong> the Wald-style standardised effect size,
						(current − reference) / SE(current). Magnitudes follow Cohen's conventions
						(0.2 small, 0.5 medium, 0.8 large).
					</li>
					<li>
						<strong>Paired t and d<sub>z</sub> (per axis):</strong> treat each size as one paired
						observation across studies and standardise the mean difference by the SD of paired
						differences. This is the most direct test of whether the two studies systematically
						disagree on an entire axis.
					</li>
					<li>
						<strong>Pearson r and CCC:</strong> r reports whether the two studies rank the six
						sizes in the same order; CCC additionally penalises location/scale shifts, so it drops
						when curves are correlated but offset. High r with low CCC means &quot;same shape,
						different level&quot;.
					</li>
					<li>
						<strong>RMSE and MAE:</strong> raw disagreement between the two studies in the same
						units as the slope (or ND50 in ΔE). Small values mean the two studies produce almost
						the same numeric estimate.
					</li>
				</ul>
			</div>

			<div class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700">
				<p class="mb-2 font-semibold text-amber-900">Why the two studies can disagree</p>
				<p class="mb-2">
					Even when both studies fit the same model to the same task, the fitted slopes and
					ND(50%) values respond to any factor that changes how participants translate a ΔE into a
					discrimination probability. Concretely:
				</p>
				<ul class="list-inside list-disc space-y-1">
					<li>
						<strong>Stimulus set:</strong> Szafir et al. tiled distractors uniformly around CIELAB;
						this study restricts the palette to colormap / makeup-relevant regions. Narrower or
						more perceptually clustered distractors compress or expand the effective ΔE, which
						shifts the fitted slope for a given axis / size.
					</li>
					<li>
						<strong>Display conditions:</strong> the original study used a calibrated lab display,
						while this study runs unattended in participants' browsers. Uncalibrated gamma and
						white points shift especially the a* and b* slopes because chromatic contrast is more
						display-dependent than luminance contrast.
					</li>
					<li>
						<strong>Attention and viewing distance:</strong> a crowdsourced protocol can only
						estimate viewing distance and cannot enforce it. Smaller effective angular sizes
						inflate ND(50%) at the small end and drive the k<sub>x</sub> / s term in the
						inverse-size model.
					</li>
					<li>
						<strong>Sample composition and expertise:</strong> our participant pool differs in
						size, age distribution, colour training, and makeup familiarity. Any expertise
						advantage (e.g., regular makeup users, colour-theory training) raises slopes globally
						and lowers ND(50%).
					</li>
					<li>
						<strong>Sampling of ΔE and size:</strong> per-size regressions are through-origin fits
						with only a handful of ΔE levels. Small changes in the sampled ΔE range are amplified
						into slope differences, which is a large part of what the paired Cohen's d<sub
							>z</sub
						> is picking up.
					</li>
				</ul>
				<p class="mt-2">
					A consistent sign of the mean difference across sizes (visible in the &quot;Better&quot;
					column above) plus a large paired d<sub>z</sub> points to a systematic study-level shift
					rather than noise at any single size. A near-zero mean difference with a large per-row
					disagreement instead suggests condition-specific factors (e.g., only the smallest sizes
					differ, which typically indicates viewing-distance / rendering effects).
				</p>
			</div>
		{/if}

		{#if sortedInvComparison.length > 0}
			<h3 class="mb-4 mt-8 text-lg font-medium text-slate-700">Inverse-Size Model Comparison</h3>
			<p class="mb-4 text-sm text-slate-500">
				Model: ND<sub>x</sub>(p,s) = p / (c<sub>x</sub> + k<sub>x</sub> / s)
			</p>
			<DataTable
				headers={[
					'Axis',
					'Current c<sub>x</sub>',
					'Ref c<sub>x</sub>',
					'c Diff',
					'Current k<sub>x</sub>',
					'Ref k<sub>x</sub>',
					'k Diff',
					'Current R²',
					'Ref R²'
				]}
			>
				{#each sortedInvComparison as row (row.axis)}
					<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
						<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_c, 4)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_c, 4)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.c_diff, 4, true)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_k, 4)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_k, 4)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.k_diff, 4, true)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_r2, 3)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_r2, 2)}</td>
					</tr>
				{/each}
			</DataTable>
		{/if}
	</Section>
{/if}

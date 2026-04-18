<script lang="ts">
	import type { RegressionComparison, InverseModelComparison } from '$lib/types';
	import { formatNumber, compareByAxisAndSize } from '$lib/utils';
	import Section from './Section.svelte';
	import DataTable from './DataTable.svelte';

	interface Props {
		regressionComparison: RegressionComparison[];
		inverseModelComparison: InverseModelComparison[];
	}

	let { regressionComparison, inverseModelComparison }: Props = $props();

	// Custom axis order: L, a, b
	const axisOrder = ['L', 'a', 'b'];

	const sortedRegComparison = $derived([...regressionComparison].sort(compareByAxisAndSize));

	const sortedInvComparison = $derived(
		axisOrder
			.filter((axis) => inverseModelComparison.some((r) => r.axis === axis))
			.map((axis) => inverseModelComparison.find((r) => r.axis === axis)!)
	);

	function getDiffClass(pctDiff: number): string {
		if (isNaN(pctDiff)) return 'text-slate-500';
		if (Math.abs(pctDiff) < 20) return 'text-green-600 font-semibold';
		if (Math.abs(pctDiff) < 50) return 'text-yellow-600 font-semibold';
		return 'text-red-600 font-semibold';
	}
</script>

{#if regressionComparison.length > 0}
	<Section
		title="Comparison to Original Paper"
		subtitle="Comparing current study results to 'Modeling Color Difference for Visualization Design' (Szafir et al.)"
	>
		<h3 class="mb-4 text-lg font-medium text-slate-700">Per-Size Regression Comparison</h3>
		<DataTable
			headers={[
				'Axis',
				'Size (°)',
				'Current Slope',
				'Reference Slope',
				'Diff',
				'% Diff',
				'Current R²',
				'Ref R²',
				'Current ND50',
				'Ref ND50'
			]}
		>
			{#each sortedRegComparison as row}
				<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
					<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.size_deg, 2)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_slope, 4)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_slope, 4)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.slope_diff, 4, true)}</td>
					<td class="px-3 py-3 {getDiffClass(row.slope_pct_diff)}">
						{isNaN(row.slope_pct_diff) ? 'N/A' : `${row.slope_pct_diff > 0 ? '+' : ''}${formatNumber(row.slope_pct_diff, 1)}%`}
					</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_r2, 3)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_r2, 3)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.current_nd50, 2)}</td>
					<td class="px-3 py-3 text-slate-600">{formatNumber(row.ref_nd50, 2)}</td>
				</tr>
			{/each}
		</DataTable>

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
				{#each sortedInvComparison as row}
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


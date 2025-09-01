<script lang="ts">
	import type { RegressionRow, InverseModelRow, DiscriminabilityRow } from '$lib/types';
	import { ND } from '$lib/statistics';
	import { formatNumber, compareByAxisAndSize } from '$lib/utils';
	import Section from './Section.svelte';
	import DataTable from './DataTable.svelte';

	interface Props {
		regression: RegressionRow[];
		inverseModel: InverseModelRow[];
		discriminability: DiscriminabilityRow[];
	}

	let { regression, inverseModel, discriminability }: Props = $props();

	// Custom axis order: L, a, b
	const axisOrder = ['L', 'a', 'b'];

	const sortedRegression = $derived([...regression].sort(compareByAxisAndSize));

	const sortedInverseModel = $derived(
		axisOrder.filter((axis) => inverseModel.some((r) => r.axis === axis)).map((axis) => inverseModel.find((r) => r.axis === axis)!)
	);

	// Get example sizes for ND(50%, s) table
	const exampleSizes = $derived(() => {
		const sizes = [...new Set(discriminability.map((d) => d.size_deg))].sort((a, b) => a - b);
		if (sizes.length <= 5) return sizes;
		// Pick 5 representative sizes
		const indices = [
			0,
			Math.floor(sizes.length / 4),
			Math.floor(sizes.length / 2),
			Math.floor((3 * sizes.length) / 4),
			sizes.length - 1
		];
		return indices.map((i) => sizes[i]);
	});

	function computeND(axis: string, p: number, sDeg: number): string {
		try {
			const nd = ND(axis, p, sDeg, inverseModel);
			return formatNumber(nd, 2);
		} catch {
			return 'N/A';
		}
	}
</script>

<Section title="Regression Analysis">
	<h3 class="mb-4 text-lg font-medium text-slate-700">
		Per-Size Regression (p = m<sub class="text-blue-600">x</sub> × ΔE)
	</h3>
	<DataTable
		headers={[
			'Axis',
			'Size (°)',
			'Slope m<sub>x</sub>',
			'R²',
			'ND(50%) ΔE'
		]}
	>
		{#each sortedRegression as row}
			<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
				<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.size_deg, 3)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.slope, 4)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.r2, 3)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.ND50, 2)}</td>
			</tr>
		{/each}
	</DataTable>

	<h3 class="mb-4 mt-8 text-lg font-medium text-slate-700">Inverse-Size ND Model Parameters</h3>
	<p class="mb-4 text-sm text-slate-500">
		Model: slope = c<sub>x</sub> + k<sub>x</sub> / size
	</p>
	<DataTable
		headers={[
			'Axis',
			'c<sub>x</sub>',
			'k<sub>x</sub>',
			'R²',
			'Equation'
		]}
	>
		{#each sortedInverseModel as row}
			<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
				<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.c_x, 4)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.k_x, 4)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.R2, 3)}</td>
				<td class="px-3 py-3">
					<code
						class="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 border border-slate-200"
					>
						ND<sub>{row.axis}</sub>(p,s) = p / ({formatNumber(row.c_x, 4)} + {formatNumber(row.k_x, 4)} / s)
					</code>
				</td>
			</tr>
		{/each}
	</DataTable>

	<h3 class="mb-4 mt-8 text-lg font-medium text-slate-700">Example ND(50%, s) Values</h3>
	<DataTable
		headers={[
			'Size (°)',
			'ND<sub>L</sub>(50%, s)',
			'ND<sub>a</sub>(50%, s)',
			'ND<sub>b</sub>(50%, s)'
		]}
	>
		{#each exampleSizes() as size}
			<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
				<td class="px-3 py-3 text-slate-600">{formatNumber(size, 3)}</td>
				<td class="px-3 py-3 text-slate-600">{computeND('L', 0.5, size)}</td>
				<td class="px-3 py-3 text-slate-600">{computeND('a', 0.5, size)}</td>
				<td class="px-3 py-3 text-slate-600">{computeND('b', 0.5, size)}</td>
			</tr>
		{/each}
	</DataTable>
</Section>


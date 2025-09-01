<script lang="ts">
	import type { DiscriminabilityRow } from '$lib/types';
	import { formatNumber, groupBy, compareByAxisAndSize, compareByAxisSizeDeltaE } from '$lib/utils';
	import Section from './Section.svelte';
	import DataTable from './DataTable.svelte';

	interface Props {
		discriminability: DiscriminabilityRow[];
	}

	let { discriminability }: Props = $props();

	const byAxis = $derived(groupBy(discriminability, (d) => d.axis));

	// Custom axis order: L, a, b
	const axisOrder = ['L', 'a', 'b'];

	const axisSummaries = $derived(
		axisOrder
			.filter((axis) => byAxis.has(axis))
			.map((axis) => {
				const rows = byAxis.get(axis)!;
				return {
					axis,
					nSizes: new Set(rows.map((r) => r.size_deg)).size,
					nDeltaE: new Set(rows.map((r) => r.delta_e)).size,
					meanP: rows.reduce((sum, r) => sum + r.p, 0) / rows.length,
					minP: Math.min(...rows.map((r) => r.p)),
					maxP: Math.max(...rows.map((r) => r.p))
				};
			})
	);

	const sortedDiscrim = $derived(
		[...discriminability]
			.filter((d) => d.axis !== undefined)
			.sort(compareByAxisSizeDeltaE)
	);

	let detailedExpanded = $state(false);
</script>

<Section title="Discriminability Analysis">
	<h3 class="mb-4 text-lg font-medium text-slate-700">Overview by Axis</h3>
	<DataTable headers={['Axis', '# Sizes', '# ΔE Levels', 'Mean p', 'Min p', 'Max p']}>
		{#each axisSummaries as row}
			<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
				<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
				<td class="px-3 py-3 text-slate-600">{row.nSizes}</td>
				<td class="px-3 py-3 text-slate-600">{row.nDeltaE}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.meanP, 3)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.minP, 3)}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.maxP, 3)}</td>
			</tr>
		{/each}
	</DataTable>

	<div class="mt-8">
		<button
			onclick={() => detailedExpanded = !detailedExpanded}
			class="mb-4 flex items-center gap-2 text-lg font-medium text-slate-700 transition-colors hover:text-slate-900"
		>
			<svg
				class="h-5 w-5 transition-transform {detailedExpanded ? 'rotate-90' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
			Detailed Discriminability (p by Axis × Size × ΔE)
		</button>
		{#if detailedExpanded}
			<DataTable headers={['Axis', 'Size (°)', 'ΔE', 'p', '# Trials', '# Participants']}>
				{#each sortedDiscrim as row}
					<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
						<td class="px-3 py-3 font-medium text-slate-700">{row.axis}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.size_deg, 3)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.delta_e, 1)}</td>
						<td class="px-3 py-3 text-slate-600">{formatNumber(row.p, 3)}</td>
						<td class="px-3 py-3 text-slate-600">{row.n_trials}</td>
						<td class="px-3 py-3 text-slate-600">{row.n_participants}</td>
					</tr>
				{/each}
			</DataTable>
		{/if}
	</div>
</Section>


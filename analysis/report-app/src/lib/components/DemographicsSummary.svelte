<script lang="ts">
	import type { Demographics } from '$lib/types';
	import { countValues } from '$lib/utils';
	import Section from './Section.svelte';

	interface Props {
		demographics: Demographics[];
	}

	let { demographics }: Props = $props();

	const genderCounts = $derived(countValues(demographics.map((d) => d.gender)));
	const ageCounts = $derived(countValues(demographics.map((d) => d.age)));
	const educationCounts = $derived(countValues(demographics.map((d) => d.education)));
	const makeupFamiliarityCounts = $derived(countValues(demographics.map((d) => d.makeup_familiarity)));
	const useMakeupCounts = $derived(countValues(demographics.map((d) => d.use_makeup)));
	const colorTheoryClassCounts = $derived(countValues(demographics.map((d) => d.color_theory_class)));

	function getPercent(count: number): string {
		return ((count / demographics.length) * 100).toFixed(1);
	}
</script>

<Section title="Demographics Summary">
	<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
		<!-- Gender -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Gender Distribution</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Gender</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...genderCounts.entries()] as [gender, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{gender}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Age -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Age Distribution</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Age</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...ageCounts.entries()] as [age, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{age}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Education -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Education</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Level</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...educationCounts.entries()] as [edu, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{edu}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Makeup Familiarity -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Makeup Familiarity</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Response</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...makeupFamiliarityCounts.entries()] as [resp, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{resp}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Makeup Usage -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Makeup Usage</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Usage</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...useMakeupCounts.entries()] as [usage, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{usage}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Color Theory Class -->
		<div class="rounded-lg border border-slate-100 bg-slate-50 p-4">
			<h4 class="mb-3 text-sm font-semibold text-blue-700">Color Theory Class</h4>
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Response</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">Count</th>
						<th class="pb-2 text-left text-xs font-medium text-slate-500">%</th>
					</tr>
				</thead>
				<tbody>
					{#each [...colorTheoryClassCounts.entries()] as [resp, count]}
						<tr class="border-t border-slate-200">
							<td class="py-1.5 text-slate-700">{resp}</td>
							<td class="py-1.5 text-slate-600">{count}</td>
							<td class="py-1.5 text-slate-600">{getPercent(count)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</Section>


<script lang="ts">
	import type { ParticipantSummary } from '$lib/types';
	import { truncateId, formatNumber } from '$lib/utils';
	import Section from './Section.svelte';
	import DataTable from './DataTable.svelte';

	interface Props {
		summary: ParticipantSummary[];
	}

	let { summary }: Props = $props();

	const sortedSummary = $derived(
		[...summary].sort((a, b) => {
			if (a.participantId !== b.participantId) {
				return a.participantId.localeCompare(b.participantId);
			}
			return a.condition.localeCompare(b.condition);
		})
	);
</script>

<Section
	title="Participant Summary"
	collapsible={true}
	defaultExpanded={false}
>
	<DataTable
		headers={[
			'Participant ID',
			'Condition',
			'# Trials',
			'# Diff',
			'# Same',
			'Wrong Same',
			'Mean RT (ms)'
		]}
	>
		{#each sortedSummary as row}
			<tr class="border-b border-slate-100 transition-colors hover:bg-slate-50">
				<td class="px-3 py-3 font-mono text-xs text-slate-600">{truncateId(row.participantId)}</td>
				<td class="px-3 py-3 text-slate-700">{row.condition}</td>
				<td class="px-3 py-3 text-slate-600">{row.n_trials}</td>
				<td class="px-3 py-3 text-slate-600">{row.n_diff_trials}</td>
				<td class="px-3 py-3 text-slate-600">{row.n_same_trials}</td>
				<td class="px-3 py-3 text-slate-600">{row.n_wrong_same}</td>
				<td class="px-3 py-3 text-slate-600">{formatNumber(row.mean_rt_ms, 0)}</td>
			</tr>
		{/each}
	</DataTable>
</Section>


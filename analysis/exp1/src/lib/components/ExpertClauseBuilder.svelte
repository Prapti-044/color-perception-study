<script lang="ts">
	import type { ExpertClauseGroupNode, ExpertPredicateDefinition } from '$lib/types';
	import Section from './Section.svelte';
	import ExpertClauseGroupEditor from './ExpertClauseGroupEditor.svelte';

	interface Props {
		clause: ExpertClauseGroupNode;
		summary: string;
		availablePredicates: ExpertPredicateDefinition[];
		onChange: (clause: ExpertClauseGroupNode) => void;
		onReset: () => void;
	}

	let { clause, summary, availablePredicates, onChange, onReset }: Props = $props();
</script>

<Section title="Expert Clause Builder">
	<div class="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-5">
		<p class="text-sm text-slate-700">
			Build the <strong>Expert</strong> group interactively using nested <code>AND</code> / <code>OR</code> groups and raw answer predicates.
			Everyone who does not match the active clause, including null or missing values, is treated as <strong>Non-Expert</strong>.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={onReset}
				class="rounded border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
			>
				Reset To Default Clause
			</button>
			<p class="text-xs text-slate-500">
				The active clause is restored from the URL when present, otherwise from local browser state.
			</p>
		</div>
	</div>

	<div class="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
		<h4 class="mb-2 text-sm font-semibold text-slate-800">Current Clause Summary</h4>
		<p class="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">{summary}</p>
	</div>

	<ExpertClauseGroupEditor
		node={clause}
		{availablePredicates}
		onReplace={onChange}
		isRoot={true}
	/>
</Section>

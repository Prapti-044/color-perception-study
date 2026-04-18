<script lang="ts">
	import type {
		ExpertClauseGroupNode,
		ExpertPredicateDefinition
	} from '$lib/expertClause';
	import ExpertClauseGroupEditor from './ExpertClauseGroupEditor.svelte';

	type Props = {
		availablePredicates: ExpertPredicateDefinition[];
		clause: ExpertClauseGroupNode;
		onChange: (clause: ExpertClauseGroupNode) => void;
		onReset: () => void;
		summary: string;
	};

	let { availablePredicates, clause, onChange, onReset, summary }: Props = $props();
</script>

<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
	<div class="rounded-2xl border border-blue-200 bg-blue-50/90 p-5">
		<p class="text-xs font-semibold uppercase tracking-wide text-blue-800">Expert grouping</p>
		<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
			Expert clause builder
		</h2>
		<p class="mt-3 text-sm leading-relaxed text-slate-700">
			Build the <strong>Expert</strong> group interactively using nested <code>AND</code> /
			<code>OR</code> groups and raw answer predicates. Anyone who does not match the active
			clause, including missing values, is treated as <strong>Non-Expert</strong>.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={onReset}
				class="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
			>
				Reset to default clause
			</button>
			<p class="text-xs text-slate-500">
				The active clause is restored from the URL when present, otherwise from local browser state.
			</p>
		</div>
	</div>

	<div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Current clause summary</p>
		<p class="mt-2 text-sm leading-relaxed text-slate-700">{summary}</p>
	</div>

	<div class="mt-5">
		<ExpertClauseGroupEditor
			node={clause}
			{availablePredicates}
			onReplace={onChange}
			isRoot={true}
		/>
	</div>
</section>

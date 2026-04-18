<script lang="ts">
	import type {
		ExpertClauseGroupNode,
		ExpertClauseNode,
		ExpertPredicateDefinition
	} from '$lib/expertClause';
	import {
		createExpertClauseGroupNode,
		createExpertClausePredicateNode,
		getExpertPredicateLabel
	} from '$lib/expertClause';
	import ExpertClauseGroupEditor from './ExpertClauseGroupEditor.svelte';

	type Props = {
		availablePredicates: ExpertPredicateDefinition[];
		depth?: number;
		isRoot?: boolean;
		node: ExpertClauseGroupNode;
		onRemove?: () => void;
		onReplace: (node: ExpertClauseGroupNode) => void;
	};

	let {
		availablePredicates,
		depth = 0,
		isRoot = false,
		node,
		onRemove,
		onReplace
	}: Props = $props();

	let showPredicatePalette = $state(false);

	const predicatesByCategory = $derived.by(() => {
		const groups = new Map<string, ExpertPredicateDefinition[]>();
		for (const predicate of availablePredicates) {
			const group = groups.get(predicate.category) ?? [];
			group.push(predicate);
			groups.set(predicate.category, group);
		}
		return [...groups.entries()];
	});

	function replaceChildren(children: ExpertClauseNode[]) {
		onReplace({ ...node, children });
	}

	function replaceChild(index: number, child: ExpertClauseNode) {
		replaceChildren(
			node.children.map((currentChild, childIndex) =>
				childIndex === index ? child : currentChild
			)
		);
	}

	function removeChild(index: number) {
		replaceChildren(node.children.filter((_, childIndex) => childIndex !== index));
	}

	function setOperator(operator: 'AND' | 'OR') {
		onReplace({ ...node, operator });
	}

	function addSubgroup() {
		replaceChildren([...node.children, createExpertClauseGroupNode('AND')]);
	}

	function addPredicate(definition: ExpertPredicateDefinition) {
		replaceChildren([...node.children, createExpertClausePredicateNode(definition)]);
		showPredicatePalette = false;
	}
</script>

<div
	class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
	style={`margin-left: ${depth * 0.75}rem;`}
>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-sm font-semibold text-slate-800">
				{isRoot ? 'Root clause group' : 'Nested clause group'}
			</p>
			<p class="text-xs text-slate-500">
				Children are combined with <span class="font-semibold">{node.operator}</span>
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
				<button
					type="button"
					onclick={() => setOperator('AND')}
					class={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
						node.operator === 'AND'
							? 'bg-blue-600 text-white'
							: 'text-slate-600 hover:bg-slate-100'
					}`}
				>
					AND
				</button>
				<button
					type="button"
					onclick={() => setOperator('OR')}
					class={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
						node.operator === 'OR'
							? 'bg-blue-600 text-white'
							: 'text-slate-600 hover:bg-slate-100'
					}`}
				>
					OR
				</button>
			</div>
			{#if !isRoot && onRemove}
				<button
					type="button"
					onclick={onRemove}
					class="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
				>
					Remove group
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-4 space-y-3">
		{#if node.children.length === 0}
			<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm italic text-slate-500">
				This group is empty. Add predicates or nested groups below.
			</div>
		{/if}

		{#each node.children as child, index (child.id)}
			{#if child.type === 'group'}
				<ExpertClauseGroupEditor
					node={child}
					{availablePredicates}
					onReplace={(nextGroup: ExpertClauseGroupNode) => replaceChild(index, nextGroup)}
					onRemove={() => removeChild(index)}
					depth={depth + 1}
				/>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
					<p class="text-sm text-slate-700">{getExpertPredicateLabel(child)}</p>
					<button
						type="button"
						onclick={() => removeChild(index)}
						class="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
					>
						Remove
					</button>
				</div>
			{/if}
		{/each}
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={() => {
				showPredicatePalette = !showPredicatePalette;
			}}
			class="rounded-full border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
		>
			{showPredicatePalette ? 'Hide predicate buttons' : 'Add predicate'}
		</button>
		<button
			type="button"
			onclick={addSubgroup}
			class="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			Add nested group
		</button>
	</div>

	{#if showPredicatePalette}
		<div class="mt-4 space-y-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
			<p class="text-sm font-semibold text-blue-900">Choose a raw answer predicate to add to this group</p>
			{#each predicatesByCategory as [category, predicates]}
				<div>
					<h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">{category}</h5>
					<div class="flex flex-wrap gap-2">
						{#each predicates as predicate (predicate.id)}
							<button
								type="button"
								onclick={() => addPredicate(predicate)}
								class="rounded-xl border border-blue-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-100"
							>
								{predicate.label}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

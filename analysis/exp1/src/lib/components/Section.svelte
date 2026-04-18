<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		children: Snippet;
		headerAction?: Snippet;
		collapsible?: boolean;
		defaultExpanded?: boolean;
	}

	let { title, subtitle, children, headerAction, collapsible = false, defaultExpanded = true }: Props = $props();
	
	let expanded = $state(defaultExpanded);

	function toggle() {
		expanded = !expanded;
	}
</script>

<section class="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-3">
			{#if collapsible}
				<button
					onclick={toggle}
					class="flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
					aria-label={expanded ? 'Collapse section' : 'Expand section'}
				>
					<svg
						class="h-5 w-5 transition-transform {expanded ? 'rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/if}
			<div>
				<h2 class="text-xl font-semibold text-slate-800">{title}</h2>
				{#if subtitle}
					<p class="mt-1 text-sm text-slate-500">{subtitle}</p>
				{/if}
			</div>
		</div>
		{#if headerAction}
			{@render headerAction()}
		{/if}
	</div>
	{#if !collapsible || expanded}
		{@render children()}
	{/if}
</section>


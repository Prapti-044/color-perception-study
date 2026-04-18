<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		headers: string[];
		children: Snippet;
	}

	let { headers, children }: Props = $props();
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr>
				{#each headers as header}
					<th
						class="border-b-2 border-slate-200 bg-slate-50 px-3 py-3.5 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase"
					>
						{@html header}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{@render children()}
		</tbody>
	</table>
</div>


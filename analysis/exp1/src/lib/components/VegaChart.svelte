<script lang="ts">
	import { onMount } from 'svelte';
	import embed from 'vega-embed';
	import type { VisualizationSpec } from 'vega-embed';

	interface Props {
		spec: VisualizationSpec;
		options?: Record<string, unknown>;
	}

	let { spec, options = {} }: Props = $props();

	let container: HTMLDivElement;
	let view: { finalize: () => void } | null = null;

	onMount(() => {
		if (!container || !spec) return;

		// Strip Svelte's Proxy wrapper via JSON round-trip to avoid structuredClone errors in vega-embed
		const cleanSpec: VisualizationSpec = JSON.parse(JSON.stringify(spec));

		embed(container, cleanSpec, {
			actions: false,
			renderer: 'canvas'
		})
			.then((result) => {
				view = result.view;
			})
			.catch((error) => {
				console.error('Error rendering Vega chart:', error);
			});

		return () => {
			if (view) {
				view.finalize();
			}
		};
	});
</script>

<div bind:this={container} class="vega-container"></div>

<style>
	.vega-container {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.vega-container :global(canvas) {
		border-radius: 4px;
	}
</style>

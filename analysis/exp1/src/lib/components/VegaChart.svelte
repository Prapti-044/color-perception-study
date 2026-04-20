<script lang="ts">
	import embed from 'vega-embed';
	import type { VisualizationSpec } from 'vega-embed';
	import type { View } from 'vega';
	import { downloadSvgString } from '$lib/svgDownload';

	interface Props {
		spec: VisualizationSpec;
		options?: Record<string, unknown>;
		downloadFileName?: string;
	}

	let { spec, options = {}, downloadFileName = 'chart.svg' }: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let view: View | null = $state(null);

	$effect(() => {
		if (!container || !spec) return;

		const cleanSpec: VisualizationSpec = JSON.parse(JSON.stringify(spec));
		let localView: View | null = null;
		let cancelled = false;

		embed(container, cleanSpec, {
			...options,
			actions: false,
			renderer: 'svg'
		})
			.then((result) => {
				if (cancelled) {
					result.view.finalize();
					return;
				}
				localView = result.view;
				view = result.view;
			})
			.catch((error) => {
				console.error('Error rendering Vega chart:', error);
			});

		return () => {
			cancelled = true;
			if (localView) {
				localView.finalize();
			}
			view = null;
		};
	});

	async function downloadSvg() {
		if (!view) return;
		const svg = await view.toSVG();
		downloadSvgString(svg, downloadFileName);
	}
</script>

<div class="vega-wrap">
	<div class="vega-actions">
		<button type="button" class="vega-download" onclick={downloadSvg}>Download SVG</button>
	</div>
	<div bind:this={container} class="vega-container"></div>
</div>

<style>
	.vega-wrap {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
		width: 100%;
	}

	.vega-actions {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}

	.vega-download {
		border-radius: 0.375rem;
		border: 1px solid rgb(203 213 225);
		background: rgb(255 255 255);
		padding: 0.25rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: rgb(51 65 85);
		cursor: pointer;
	}

	.vega-download:hover {
		border-color: rgb(148 163 184);
		color: rgb(15 23 42);
	}

	.vega-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.vega-container :global(svg) {
		border-radius: 4px;
		max-width: 100%;
		height: auto;
	}
</style>

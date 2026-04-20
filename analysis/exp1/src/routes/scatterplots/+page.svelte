<script lang="ts">
	import { onMount } from 'svelte';
	import { VegaChart, ScatterplotCard } from '$lib/components';
	import {
		findNearestFoundation,
		isMakeupColorMatch,
		loadFoundationColors,
		type FoundationColor,
		type NearestFoundation
	} from '$lib';
	import type { MetadataFile, ScatterplotMetadata } from '$lib/types';
	import type { VisualizationSpec } from 'vega-embed';

	interface ScatterplotData {
		metadata: ScatterplotMetadata;
		spec: VisualizationSpec | null;
		specLoaded: boolean;
		nearestFoundation1: NearestFoundation | null;
		nearestFoundation2: NearestFoundation | null;
	}

	interface Section {
		id: string;
		title: string;
		description: string;
		folderName: string;
		plots: ScatterplotData[];
		expanded: boolean;
		specsLoaded: boolean;
	}

	// Section definitions
	const sectionDefinitions = [
		{
			id: 'large_diff',
			title: 'Large Difference Scatterplots',
			description: 'Scatterplots with large color differences between target points',
			folderName: 'scatterplots_large_diff'
		},
		{
			id: 'no_diff',
			title: 'No Difference Scatterplots',
			description: 'Scatterplots with no color difference between target points',
			folderName: 'scatterplots_no_diff'
		},
		{
			id: 'smalldiff_L',
			title: 'Small Difference - L* Axis',
			description: 'Scatterplots with small differences along the L* (Lightness) axis',
			folderName: 'scatterplots_smalldiff_L'
		},
		{
			id: 'smalldiff_a',
			title: 'Small Difference - a* Axis',
			description: 'Scatterplots with small differences along the a* (Red-Green) axis',
			folderName: 'scatterplots_smalldiff_a'
		},
		{
			id: 'smalldiff_b',
			title: 'Small Difference - b* Axis',
			description: 'Scatterplots with small differences along the b* (Yellow-Blue) axis',
			folderName: 'scatterplots_smalldiff_b'
		}
	];

	let loading = $state(true);
	let error = $state<string | null>(null);
	let sections = $state<Section[]>([]);
	let totalPlots = $state(0);
	let foundationColors: FoundationColor[] = [];
	let foundationColorsCount = $state(0);

	// Pre-computed makeup color counts (calculated once on load)
	let makeupColorCount = $state(0);
	let makeupByAxisCounts = $state({ L: 0, a: 0, b: 0 });

	function groupByFolder(scatterplots: ScatterplotMetadata[]): Map<string, ScatterplotMetadata[]> {
		const groups = new Map<string, ScatterplotMetadata[]>();

		for (const plot of scatterplots) {
			const pathParts = plot.output_directory.split('/');
			const folderName = pathParts[pathParts.length - 1];

			if (!groups.has(folderName)) {
				groups.set(folderName, []);
			}
			groups.get(folderName)!.push(plot);
		}

		return groups;
	}

	// Load spec for a single plot (called lazily)
	async function loadSpec(folderName: string, filename: string): Promise<VisualizationSpec | null> {
		try {
			const response = await fetch(`/colormap-assets/vega-specs/${folderName}/${filename}`);
			if (!response.ok) return null;
			return await response.json();
		} catch {
			return null;
		}
	}

	// Load specs for a section (lazy loading)
	async function loadSectionSpecs(sectionId: string) {
		const sectionIndex = sections.findIndex(s => s.id === sectionId);
		if (sectionIndex === -1 || sections[sectionIndex].specsLoaded) return;

		const section = sections[sectionIndex];
		
		// Load specs in parallel batches of 10 to avoid overwhelming the browser
		const batchSize = 10;
		for (let i = 0; i < section.plots.length; i += batchSize) {
			const batch = section.plots.slice(i, i + batchSize);
			await Promise.all(
				batch.map(async (plot, batchIndex) => {
					const plotIndex = i + batchIndex;
					if (!section.plots[plotIndex].specLoaded) {
						const spec = await loadSpec(section.folderName, plot.metadata.filename);
						sections[sectionIndex].plots[plotIndex].spec = spec;
						sections[sectionIndex].plots[plotIndex].specLoaded = true;
					}
				})
			);
			// Force reactivity update after each batch
			sections = [...sections];
		}
		
		sections[sectionIndex].specsLoaded = true;
		sections = [...sections];
	}

	async function loadAllData() {
		try {
			// Load foundation colors and metadata in parallel
			const [foundationColorsData, metadataResponse] = await Promise.all([
				loadFoundationColors(),
				fetch('/colormap-assets/vega-specs/scatterplots_metadata.json')
			]);

			foundationColors = foundationColorsData;
			foundationColorsCount = foundationColors.length;

			if (!metadataResponse.ok) {
				throw new Error('Failed to load metadata');
			}
			const metadata: MetadataFile = await metadataResponse.json();
			totalPlots = metadata.total_scatterplots;

			// Group by folder
			const groupedByFolder = groupByFolder(metadata.scatterplots);

			// Build sections WITHOUT loading specs (lazy loading)
			const loadedSections: Section[] = [];
			let totalMakeup = 0;
			const axisCounts = { L: 0, a: 0, b: 0 };

			for (const def of sectionDefinitions) {
				const folderPlots = groupedByFolder.get(def.folderName) || [];
				folderPlots.sort((a, b) => a.index - b.index);

				// Pre-compute nearest foundation colors (this is fast, no network)
				const plotsWithData: ScatterplotData[] = folderPlots.map((plotMeta) => {
					const nearestFoundation1 = findNearestFoundation(plotMeta.target_color1_lab, foundationColors);
					const nearestFoundation2 = findNearestFoundation(plotMeta.target_color2_lab, foundationColors);
					
					// Count makeup colors
					const hasMakeup =
						isMakeupColorMatch(nearestFoundation1) || isMakeupColorMatch(nearestFoundation2);
					if (hasMakeup) {
						totalMakeup++;
						const axis = plotMeta.axis;
						if (axis === 'L' || axis === 'a' || axis === 'b') {
							axisCounts[axis]++;
						}
					}

					return {
						metadata: plotMeta,
						spec: null,
						specLoaded: false,
						nearestFoundation1,
						nearestFoundation2
					};
				});

				loadedSections.push({
					id: def.id,
					title: def.title,
					description: def.description,
					folderName: def.folderName,
					plots: plotsWithData,
					expanded: false, // Start collapsed for performance
					specsLoaded: false
				});
			}

			makeupColorCount = totalMakeup;
			makeupByAxisCounts = axisCounts;
			sections = loadedSections;
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			loading = false;
		}
	}

	async function toggleSection(sectionId: string) {
		const sectionIndex = sections.findIndex(s => s.id === sectionId);
		if (sectionIndex === -1) return;

		const wasExpanded = sections[sectionIndex].expanded;
		sections[sectionIndex].expanded = !wasExpanded;
		sections = [...sections];

		// If expanding and specs not loaded, load them
		if (!wasExpanded && !sections[sectionIndex].specsLoaded) {
			await loadSectionSpecs(sectionId);
		}
	}

	onMount(() => {
		loadAllData();
	});
</script>

<svelte:head>
	<title>Scatterplots - Color Perception Study</title>
</svelte:head>

<div class="min-h-screen bg-slate-100">
	<div class="mx-auto max-w-[1600px] px-6 py-8">
		<!-- Header -->
		<header class="mb-8">
			<h1 class="border-b-4 border-blue-600 pb-4 text-3xl font-bold tracking-tight text-slate-800">
				Scatterplot Visualizations
			</h1>
			<p class="mt-2 text-sm text-slate-500">
				Vega-Lite scatterplots used in the color perception study, organized by difference type and color axis.
				<strong>Click on a section to expand and load charts.</strong>
			</p>
		</header>

		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="text-center">
					<div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
					<p class="text-slate-600">Loading scatterplots...</p>
				</div>
			</div>
		{:else if error}
			<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
				<p class="text-red-600">{error}</p>
			</div>
		{:else}
			<!-- Stats Overview -->
			<div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
					<div class="text-2xl font-bold text-blue-600">{totalPlots}</div>
					<div class="mt-1 text-xs font-medium text-slate-500">Total Scatterplots</div>
				</div>
				<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
					<div class="text-2xl font-bold text-pink-600">{makeupColorCount}</div>
					<div class="mt-1 text-xs font-medium text-slate-500">With Makeup Colors</div>
				</div>
				<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
					<div class="text-2xl font-bold text-green-600">{foundationColorsCount}</div>
					<div class="mt-1 text-xs font-medium text-slate-500">Foundation Colors</div>
				</div>
				<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
					<div class="text-2xl font-bold text-slate-600">{totalPlots - makeupColorCount}</div>
					<div class="mt-1 text-xs font-medium text-slate-500">Without Makeup Colors</div>
				</div>
			</div>

			<!-- Makeup Colors by Axis Summary -->
			<div class="mb-8 rounded-xl border border-pink-200 bg-pink-50 p-4 shadow-sm">
				<h3 class="text-sm font-semibold text-pink-800 mb-3">Makeup Colors by Axis (ΔE &lt; 10)</h3>
				<div class="grid grid-cols-3 gap-4">
					<div class="text-center">
						<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.L}</div>
						<div class="text-xs text-pink-600">L* Axis</div>
					</div>
					<div class="text-center">
						<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.a}</div>
						<div class="text-xs text-pink-600">a* Axis</div>
					</div>
					<div class="text-center">
						<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.b}</div>
						<div class="text-xs text-pink-600">b* Axis</div>
					</div>
				</div>
			</div>

			<!-- Sections -->
			{#each sections as section}
				<section class="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
					<!-- Section Header -->
					<button
						type="button"
						class="w-full flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
						onclick={() => toggleSection(section.id)}
					>
						<div>
							<h2 class="text-lg font-semibold text-slate-800">{section.title}</h2>
							<p class="text-sm text-slate-500 mt-1">{section.description}</p>
						</div>
						<div class="flex items-center gap-3">
							{#if !section.specsLoaded && section.expanded}
								<span class="text-xs text-blue-600">Loading...</span>
							{/if}
							<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
								{section.plots.length} plots
							</span>
							<svg
								class="w-5 h-5 text-slate-400 transition-transform duration-200"
								class:rotate-180={section.expanded}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</button>

					<!-- Section Content -->
					{#if section.expanded}
						<div class="p-5 border-t border-slate-200">
							<div class="scatterplot-grid">
								{#each section.plots as plot}
									<div class="scatterplot-item">
										{#if plot.specLoaded && plot.spec}
											<div class="chart-wrapper">
												<VegaChart spec={plot.spec} />
											</div>
										{:else if plot.specLoaded && !plot.spec}
											<div class="chart-placeholder">
												<span class="text-slate-400">Failed to load chart</span>
											</div>
										{:else}
											<div class="chart-placeholder">
												<div class="animate-pulse text-slate-400">Loading chart...</div>
											</div>
										{/if}
										<ScatterplotCard 
											metadata={plot.metadata} 
											nearestFoundation1={plot.nearestFoundation1}
											nearestFoundation2={plot.nearestFoundation2}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</section>
			{/each}
		{/if}
	</div>
</div>

<style>
	.scatterplot-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
		gap: 1.5rem;
	}

	.scatterplot-item {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1rem;
		transition: box-shadow 0.2s ease;
	}

	.scatterplot-item:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.chart-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		background: white;
		border-radius: 0.5rem;
		overflow: hidden;
		min-height: 260px;
	}

	.chart-placeholder {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 260px;
		background: #f8fafc;
		border-radius: 0.5rem;
		border: 1px dashed #cbd5e1;
	}

	@media (max-width: 900px) {
		.scatterplot-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

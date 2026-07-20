<script lang="ts">
	import { onMount } from 'svelte';
	import { VegaChart, ScatterplotCard } from '$lib/components';
	import {
		findNearestFoundation,
		isMakeupColorMatch,
		loadFoundationColors,
		MAKEUP_COLOR_DELTA_E_THRESHOLD,
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

	interface NearestDeltaEStats {
		min: number;
		median: number;
		mean: number;
		max: number;
	}

	interface MakeupMatchCounts {
		target1Only: number;
		target2Only: number;
		bothTargets: number;
	}

	interface DeltaEBandDefinition {
		label: string;
		range: string;
		min: number;
		max: number;
	}

	interface DeltaEBandSummary {
		label: string;
		range: string;
		count: number;
		percentage: number;
	}

	interface SectionSummary {
		id: string;
		title: string;
		total: number;
		makeup: number;
		percentage: number;
		medianNearestDeltaE: number | null;
		meanNearestDeltaE: number | null;
	}

	interface ClosestMakeupMatch {
		filename: string;
		axis: ScatterplotMetadata['axis'];
		diffType: ScatterplotMetadata['diff_type'];
		targetLabel: string;
		targetHex: string;
		foundationName: string;
		foundationBrand: string;
		foundationHex: string;
		deltaE: number;
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

	const deltaEBandDefinitions: DeltaEBandDefinition[] = [
		{ label: 'Very close', range: 'ΔE < 5', min: 0, max: 5 },
		{ label: 'Within threshold', range: `5 ≤ ΔE < ${MAKEUP_COLOR_DELTA_E_THRESHOLD}`, min: 5, max: MAKEUP_COLOR_DELTA_E_THRESHOLD },
		{ label: 'Near miss', range: `${MAKEUP_COLOR_DELTA_E_THRESHOLD} ≤ ΔE < 15`, min: MAKEUP_COLOR_DELTA_E_THRESHOLD, max: 15 },
		{ label: 'Farther away', range: 'ΔE ≥ 15', min: 15, max: Number.POSITIVE_INFINITY }
	];

	const diffTypeLabels: Record<ScatterplotMetadata['diff_type'], string> = {
		small: 'Small difference',
		large: 'Large difference',
		none: 'No difference'
	};

	let loading = $state(true);
	let error = $state<string | null>(null);
	let sections = $state<Section[]>([]);
	let totalPlots = $state(0);
	let foundationColors: FoundationColor[] = [];
	let foundationColorsCount = $state(0);

	// Pre-computed makeup color counts (calculated once on load)
	let makeupColorCount = $state(0);
	let makeupByAxisCounts = $state({ L: 0, a: 0, b: 0 });
	let totalByAxisCounts = $state({ L: 0, a: 0, b: 0 });
	let makeupByDiffTypeCounts = $state<Record<ScatterplotMetadata['diff_type'], number>>({
		small: 0,
		large: 0,
		none: 0
	});
	let totalByDiffTypeCounts = $state<Record<ScatterplotMetadata['diff_type'], number>>({
		small: 0,
		large: 0,
		none: 0
	});
	let makeupMatchCounts = $state<MakeupMatchCounts>({
		target1Only: 0,
		target2Only: 0,
		bothTargets: 0
	});
	let nearestDeltaEStats = $state<NearestDeltaEStats | null>(null);
	let deltaEBands = $state<DeltaEBandSummary[]>([]);
	let sectionSummaries = $state<SectionSummary[]>([]);
	let closestMakeupMatch = $state<ClosestMakeupMatch | null>(null);

	function getBestNearestFoundation(
		nearestFoundation1: NearestFoundation | null,
		nearestFoundation2: NearestFoundation | null
	): NearestFoundation | null {
		if (nearestFoundation1 === null) return nearestFoundation2;
		if (nearestFoundation2 === null) return nearestFoundation1;
		return nearestFoundation1.deltaE <= nearestFoundation2.deltaE ? nearestFoundation1 : nearestFoundation2;
	}

	function calculateNearestDeltaEStats(values: number[]): NearestDeltaEStats | null {
		if (values.length === 0) {
			return null;
		}

		const sortedValues = [...values].sort((a, b) => a - b);
		const total = sortedValues.reduce((sum, value) => sum + value, 0);
		const middleIndex = Math.floor(sortedValues.length / 2);
		const median = sortedValues.length % 2 === 0
			? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
			: sortedValues[middleIndex];

		return {
			min: sortedValues[0],
			median,
			mean: total / sortedValues.length,
			max: sortedValues[sortedValues.length - 1]
		};
	}

	function getPercentage(count: number, total: number): number {
		return total === 0 ? 0 : (count / total) * 100;
	}

	function formatNumber(value: number | null | undefined, digits = 1): string {
		if (value === null || value === undefined || !Number.isFinite(value)) {
			return 'N/A';
		}

		return value.toFixed(digits);
	}

	function formatPercentage(count: number, total: number): string {
		return `${formatNumber(getPercentage(count, total), 1)}%`;
	}

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
				const allAxisCounts = { L: 0, a: 0, b: 0 };
				const diffTypeCounts: Record<ScatterplotMetadata['diff_type'], number> = {
					small: 0,
					large: 0,
					none: 0
				};
				const allDiffTypeCounts: Record<ScatterplotMetadata['diff_type'], number> = {
					small: 0,
					large: 0,
					none: 0
				};
				const matchCounts: MakeupMatchCounts = {
					target1Only: 0,
					target2Only: 0,
					bothTargets: 0
				};
				const nearestDeltaEValues: number[] = [];
				const bandCounts = deltaEBandDefinitions.map((band) => ({ ...band, count: 0 }));
				const summaries: SectionSummary[] = [];
				let closestMatch: ClosestMakeupMatch | null = null;

				for (const def of sectionDefinitions) {
					const folderPlots = groupedByFolder.get(def.folderName) || [];
					folderPlots.sort((a, b) => a.index - b.index);
					let sectionMakeup = 0;
					const sectionNearestDeltaEValues: number[] = [];

					// Pre-compute nearest foundation colors (this is fast, no network)
					const plotsWithData: ScatterplotData[] = folderPlots.map((plotMeta) => {
						const nearestFoundation1 = findNearestFoundation(plotMeta.target_color1_lab, foundationColors);
						const nearestFoundation2 = findNearestFoundation(plotMeta.target_color2_lab, foundationColors);
						const nearestFoundation = getBestNearestFoundation(nearestFoundation1, nearestFoundation2);
						const target1Matches = isMakeupColorMatch(nearestFoundation1);
						const target2Matches = isMakeupColorMatch(nearestFoundation2);

						if (plotMeta.axis === 'L' || plotMeta.axis === 'a' || plotMeta.axis === 'b') {
							allAxisCounts[plotMeta.axis]++;
						}
						allDiffTypeCounts[plotMeta.diff_type]++;

						if (nearestFoundation !== null) {
							nearestDeltaEValues.push(nearestFoundation.deltaE);
							sectionNearestDeltaEValues.push(nearestFoundation.deltaE);

							const band = bandCounts.find(
								(candidate) =>
									nearestFoundation.deltaE >= candidate.min
									&& nearestFoundation.deltaE < candidate.max
							);
							if (band) {
								band.count++;
							}
						}

						const hasMakeup = target1Matches || target2Matches;
						if (hasMakeup) {
							totalMakeup++;
							sectionMakeup++;
							diffTypeCounts[plotMeta.diff_type]++;
							const axis = plotMeta.axis;
							if (axis === 'L' || axis === 'a' || axis === 'b') {
								axisCounts[axis]++;
							}

							let matchedTarget = 1;
							let matchedFoundation: NearestFoundation | null = null;

							if (target1Matches && target2Matches) {
								matchCounts.bothTargets++;
								if (
									nearestFoundation1 !== null
									&& nearestFoundation2 !== null
									&& nearestFoundation1.deltaE <= nearestFoundation2.deltaE
								) {
									matchedFoundation = nearestFoundation1;
								} else {
									matchedTarget = 2;
									matchedFoundation = nearestFoundation2;
								}
							} else if (target1Matches) {
								matchCounts.target1Only++;
								matchedFoundation = nearestFoundation1;
							} else {
								matchCounts.target2Only++;
								matchedTarget = 2;
								matchedFoundation = nearestFoundation2;
							}

							if (
								matchedFoundation !== null
								&& (closestMatch === null || matchedFoundation.deltaE < closestMatch.deltaE)
							) {
								closestMatch = {
									filename: plotMeta.filename,
									axis: plotMeta.axis,
									diffType: plotMeta.diff_type,
									targetLabel: `Target ${matchedTarget}`,
									targetHex: matchedTarget === 1 ? plotMeta.target_color1_hex : plotMeta.target_color2_hex,
									foundationName: matchedFoundation.color.name,
									foundationBrand: matchedFoundation.color.brand,
									foundationHex: matchedFoundation.color.hex,
									deltaE: matchedFoundation.deltaE
								};
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
					const sectionDeltaEStats = calculateNearestDeltaEStats(sectionNearestDeltaEValues);

					summaries.push({
						id: def.id,
						title: def.title,
						total: folderPlots.length,
						makeup: sectionMakeup,
						percentage: getPercentage(sectionMakeup, folderPlots.length),
						medianNearestDeltaE: sectionDeltaEStats?.median ?? null,
						meanNearestDeltaE: sectionDeltaEStats?.mean ?? null
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
				totalByAxisCounts = allAxisCounts;
				makeupByDiffTypeCounts = diffTypeCounts;
				totalByDiffTypeCounts = allDiffTypeCounts;
				makeupMatchCounts = matchCounts;
				nearestDeltaEStats = calculateNearestDeltaEStats(nearestDeltaEValues);
				deltaEBands = bandCounts.map((band) => ({
					label: band.label,
					range: band.range,
					count: band.count,
					percentage: getPercentage(band.count, nearestDeltaEValues.length)
				}));
				sectionSummaries = summaries;
				closestMakeupMatch = closestMatch;
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
						<div class="mt-1 text-[0.65rem] text-slate-400">{formatPercentage(makeupColorCount, totalPlots)} of plots</div>
					</div>
					<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
						<div class="text-2xl font-bold text-green-600">{foundationColorsCount}</div>
					<div class="mt-1 text-xs font-medium text-slate-500">Foundation Colors</div>
				</div>
					<div class="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
						<div class="text-2xl font-bold text-slate-600">{totalPlots - makeupColorCount}</div>
						<div class="mt-1 text-xs font-medium text-slate-500">Without Makeup Colors</div>
						<div class="mt-1 text-[0.65rem] text-slate-400">{formatPercentage(totalPlots - makeupColorCount, totalPlots)} of plots</div>
					</div>
				</div>

				<!-- Nearest-foundation statistics -->
				<div class="mb-4 grid gap-4 lg:grid-cols-3">
					<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 class="mb-3 text-sm font-semibold text-slate-800">Nearest Foundation ΔE</h3>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<div class="text-xs text-slate-500">Minimum</div>
								<div class="text-xl font-bold text-blue-700">{formatNumber(nearestDeltaEStats?.min, 2)}</div>
							</div>
							<div>
								<div class="text-xs text-slate-500">Median</div>
								<div class="text-xl font-bold text-blue-700">{formatNumber(nearestDeltaEStats?.median, 2)}</div>
							</div>
							<div>
								<div class="text-xs text-slate-500">Mean</div>
								<div class="text-xl font-bold text-blue-700">{formatNumber(nearestDeltaEStats?.mean, 2)}</div>
							</div>
							<div>
								<div class="text-xs text-slate-500">Maximum</div>
								<div class="text-xl font-bold text-blue-700">{formatNumber(nearestDeltaEStats?.max, 2)}</div>
							</div>
						</div>
					</section>

					<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 class="mb-3 text-sm font-semibold text-slate-800">Target Match Pattern</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">Target 1 only</span>
								<span class="font-semibold text-slate-800">
									{makeupMatchCounts.target1Only}
									<span class="text-xs font-normal text-slate-400">({formatPercentage(makeupMatchCounts.target1Only, makeupColorCount)})</span>
								</span>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">Target 2 only</span>
								<span class="font-semibold text-slate-800">
									{makeupMatchCounts.target2Only}
									<span class="text-xs font-normal text-slate-400">({formatPercentage(makeupMatchCounts.target2Only, makeupColorCount)})</span>
								</span>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">Both targets</span>
								<span class="font-semibold text-slate-800">
									{makeupMatchCounts.bothTargets}
									<span class="text-xs font-normal text-slate-400">({formatPercentage(makeupMatchCounts.bothTargets, makeupColorCount)})</span>
								</span>
							</div>
						</div>
					</section>

					<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 class="mb-3 text-sm font-semibold text-slate-800">Closest Makeup Match</h3>
						{#if closestMakeupMatch}
							<div class="space-y-3">
								<div class="flex items-center gap-3">
									<span
										class="h-8 w-8 rounded border border-slate-200"
										style:background-color={closestMakeupMatch.targetHex}
									></span>
									<div class="min-w-0">
										<div class="truncate text-sm font-semibold text-slate-800">
											{closestMakeupMatch.filename} · {closestMakeupMatch.targetLabel}
										</div>
										<div class="text-xs text-slate-500">
											{closestMakeupMatch.axis} axis · {diffTypeLabels[closestMakeupMatch.diffType]}
										</div>
									</div>
								</div>
								<div class="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
									<div class="flex min-w-0 items-center gap-2">
										<span
											class="h-6 w-6 rounded border border-slate-200"
											style:background-color={closestMakeupMatch.foundationHex}
										></span>
										<div class="min-w-0">
											<div class="truncate text-xs font-semibold text-slate-700">
												{closestMakeupMatch.foundationName}
											</div>
											<div class="truncate text-[0.65rem] text-slate-500">
												{closestMakeupMatch.foundationBrand}
											</div>
										</div>
									</div>
									<div class="text-right text-sm font-bold text-pink-700">
										ΔE {formatNumber(closestMakeupMatch.deltaE, 2)}
									</div>
								</div>
							</div>
						{:else}
							<p class="text-sm text-slate-500">No makeup-color matches found.</p>
						{/if}
					</section>
				</div>

				<div class="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
					<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 class="mb-3 text-sm font-semibold text-slate-800">Nearest ΔE Bands</h3>
						<div class="space-y-3">
							{#each deltaEBands as band}
								<div>
									<div class="mb-1 flex items-center justify-between gap-3">
										<div>
											<div class="text-sm font-medium text-slate-700">{band.label}</div>
											<div class="text-xs text-slate-400">{band.range}</div>
										</div>
										<div class="text-right text-sm font-semibold text-slate-800">
											{band.count}
											<span class="text-xs font-normal text-slate-400">({formatNumber(band.percentage, 1)}%)</span>
										</div>
									</div>
									<div class="h-2 overflow-hidden rounded-full bg-slate-100">
										<div
											class="h-full rounded-full bg-blue-500"
											style:width={`${band.percentage}%`}
										></div>
									</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 class="mb-3 text-sm font-semibold text-slate-800">Makeup Colors by Difference Type</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">{diffTypeLabels.small}</span>
								<span class="font-semibold text-slate-800">
									{makeupByDiffTypeCounts.small}/{totalByDiffTypeCounts.small}
									<span class="text-xs font-normal text-slate-400">
										({formatPercentage(makeupByDiffTypeCounts.small, totalByDiffTypeCounts.small)})
									</span>
								</span>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">{diffTypeLabels.large}</span>
								<span class="font-semibold text-slate-800">
									{makeupByDiffTypeCounts.large}/{totalByDiffTypeCounts.large}
									<span class="text-xs font-normal text-slate-400">
										({formatPercentage(makeupByDiffTypeCounts.large, totalByDiffTypeCounts.large)})
									</span>
								</span>
							</div>
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-slate-600">{diffTypeLabels.none}</span>
								<span class="font-semibold text-slate-800">
									{makeupByDiffTypeCounts.none}/{totalByDiffTypeCounts.none}
									<span class="text-xs font-normal text-slate-400">
										({formatPercentage(makeupByDiffTypeCounts.none, totalByDiffTypeCounts.none)})
									</span>
								</span>
							</div>
						</div>
					</section>
				</div>

				<!-- Makeup Colors by Axis Summary -->
				<div class="mb-4 rounded-xl border border-pink-200 bg-pink-50 p-4 shadow-sm">
					<h3 class="text-sm font-semibold text-pink-800 mb-3">Makeup Colors by Axis (ΔE &lt; 10)</h3>
					<div class="grid grid-cols-3 gap-4">
						<div class="text-center">
							<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.L}</div>
							<div class="text-xs text-pink-600">L* Axis</div>
							<div class="text-[0.65rem] text-pink-500">
								{formatPercentage(makeupByAxisCounts.L, totalByAxisCounts.L)} of {totalByAxisCounts.L}
							</div>
						</div>
						<div class="text-center">
							<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.a}</div>
							<div class="text-xs text-pink-600">a* Axis</div>
							<div class="text-[0.65rem] text-pink-500">
								{formatPercentage(makeupByAxisCounts.a, totalByAxisCounts.a)} of {totalByAxisCounts.a}
							</div>
						</div>
						<div class="text-center">
							<div class="text-xl font-bold text-pink-700">{makeupByAxisCounts.b}</div>
							<div class="text-xs text-pink-600">b* Axis</div>
							<div class="text-[0.65rem] text-pink-500">
								{formatPercentage(makeupByAxisCounts.b, totalByAxisCounts.b)} of {totalByAxisCounts.b}
							</div>
						</div>
					</div>
				</div>

				<!-- Section summary -->
				<div class="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					<div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
						<h3 class="text-sm font-semibold text-slate-800">Section Summary</h3>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="bg-white text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th class="px-4 py-3">Section</th>
									<th class="px-4 py-3 text-right">Plots</th>
									<th class="px-4 py-3 text-right">Makeup</th>
									<th class="px-4 py-3 text-right">Makeup %</th>
									<th class="px-4 py-3 text-right">Median nearest ΔE</th>
									<th class="px-4 py-3 text-right">Mean nearest ΔE</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each sectionSummaries as summary}
									<tr class="hover:bg-slate-50">
										<td class="px-4 py-3 font-medium text-slate-700">{summary.title}</td>
										<td class="px-4 py-3 text-right text-slate-600">{summary.total}</td>
										<td class="px-4 py-3 text-right font-semibold text-pink-700">{summary.makeup}</td>
										<td class="px-4 py-3 text-right text-slate-600">{formatNumber(summary.percentage, 1)}%</td>
										<td class="px-4 py-3 text-right text-slate-600">{formatNumber(summary.medianNearestDeltaE, 2)}</td>
										<td class="px-4 py-3 text-right text-slate-600">{formatNumber(summary.meanNearestDeltaE, 2)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
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
												<VegaChart
													spec={plot.spec}
													downloadFileName={`scatterplot-${section.id}-${plot.metadata.index}.svg`}
												/>
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

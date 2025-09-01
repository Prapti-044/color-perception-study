<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadAllData,
		buildTrialDataframe,
		applyExclusion,
		computeDiscriminability,
		fitSizeAxisRegressions,
		fitInverseSizeModel,
		fitNDLinearModel,
		compareToReference,
		groupBy,
		getParticipantsByExpertise,
		getParticipantsByOnlyColorExpert
	} from '$lib';
	import type {
		MetadataFile,
		Demographics,
		AttentionCheck,
		ExperimentInfo,
		TrialDetails,
		ParticipantSummary,
		DiscriminabilityRow,
		RegressionRow,
		InverseModelRow,
		NDLinearFitRow,
		RegressionComparison,
		InverseModelComparison,
		ScatterplotMetadata
	} from '$lib/types';
	import {
		StatsCard,
		DemographicsSummary,
		ParticipantTable,
		DiscriminabilitySection,
		RegressionSection,
		ComparisonSection,
		ParticipantReport,
		JNDPlot,
		JNDPlotByExpertise,
		JNDPlotOnlyColorExpert,
		JNDPlotMakeupColors,
		DurationAccuracyScatterplot,
		GroupPerformanceCharts
	} from '$lib/components';

	// Outline sections for navigation
	const outlineSections = [
		{ id: 'stats-overview', title: 'Stats Overview' },
		{ id: 'demographics', title: 'Demographics' },
		{ id: 'duration-accuracy', title: 'Duration vs Accuracy' },
		{ id: 'participant-summary', title: 'Participant Summary' },
		{ id: 'discriminability', title: 'Discriminability' },
		{ id: 'regression', title: 'Regression Analysis' },
		{ id: 'jnd-model', title: '50% JND Model' },
		{ id: 'jnd-expertise', title: 'JND by Expertise' },
		{ id: 'jnd-only-color-expert', title: 'JND Only Color Expert' },
		{ id: 'jnd-makeup-colors', title: 'JND Makeup Colors' },
		{ id: 'comparison', title: 'Comparison to Paper' },
		{ id: 'participant-reports', title: 'Participant Reports' }
	];

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showOutline = $state(false);

	function scrollToSection(id: string) {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			showOutline = false;
		}
	}

	// Data
	let metadata = $state<MetadataFile | null>(null);
	let demographics = $state<Demographics[]>([]);
	let attentionChecks = $state<Record<string, AttentionCheck[]>>({});
	let experimentInfo = $state<Record<string, ExperimentInfo>>({});
	let trialDetails = $state<TrialDetails[]>([]);
	let participantSummary = $state<ParticipantSummary[]>([]);
	let discriminability = $state<DiscriminabilityRow[]>([]);
	let regression = $state<RegressionRow[]>([]);
	let inverseModel = $state<InverseModelRow[]>([]);
	let ndLinearFit = $state<NDLinearFitRow[]>([]);
	let regressionComparison = $state<RegressionComparison[]>([]);
	let inverseModelComparison = $state<InverseModelComparison[]>([]);

	// Expertise group analysis
	let regressionColorExpert = $state<RegressionRow[]>([]);
	let regressionNonExpert = $state<RegressionRow[]>([]);
	let ndLinearFitColorExpert = $state<NDLinearFitRow[]>([]);
	let ndLinearFitNonExpert = $state<NDLinearFitRow[]>([]);

	// Only Color Expert group analysis (excluding occasional makeup users)
	let regressionOnlyColorExpert = $state<RegressionRow[]>([]);
	let ndLinearFitOnlyColorExpert = $state<NDLinearFitRow[]>([]);

	// Makeup colors analysis (Only Color Expert vs Non-Expert for makeup colors only)
	let regressionMakeupOnlyColorExpert = $state<RegressionRow[]>([]);
	let regressionMakeupNonExpert = $state<RegressionRow[]>([]);
	let ndLinearFitMakeupOnlyColorExpert = $state<NDLinearFitRow[]>([]);
	let ndLinearFitMakeupNonExpert = $state<NDLinearFitRow[]>([]);
	let makeupColorScatterplotCount = $state(0);

	// Filtered trial data for performance charts
	let trialsColorExpert = $state<TrialDetails[]>([]);
	let trialsNonExpert = $state<TrialDetails[]>([]);
	let trialsOnlyColorExpert = $state<TrialDetails[]>([]);
	let trialsMakeupOnlyColorExpert = $state<TrialDetails[]>([]);
	let trialsMakeupNonExpert = $state<TrialDetails[]>([]);

	// Foundation colors for makeup color detection
	interface LabColor {
		L: number;
		a: number;
		b: number;
	}

	interface FoundationColor {
		hex: string;
		lab: LabColor;
	}

	// Convert hex color to LAB color space
	function hexToLab(hex: string): LabColor {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;

		const rLinear = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		const gLinear = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		const bLinear = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

		let x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
		let y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
		let z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;

		x = x / 0.95047;
		y = y / 1.00000;
		z = z / 1.08883;

		const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
		const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
		const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

		return {
			L: 116 * fy - 16,
			a: 500 * (fx - fy),
			b: 200 * (fy - fz)
		};
	}

	// Calculate Delta E (CIE76)
	function calculateDeltaE(lab1: LabColor, lab2: LabColor): number {
		return Math.sqrt(
			Math.pow(lab1.L - lab2.L, 2) +
			Math.pow(lab1.a - lab2.a, 2) +
			Math.pow(lab1.b - lab2.b, 2)
		);
	}

	// Parse CSV line
	function parseCSVLine(line: string): string[] {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				result.push(current);
				current = '';
			} else {
				current += char;
			}
		}
		result.push(current);
		return result;
	}

	// Load foundation colors
	async function loadFoundationColors(): Promise<FoundationColor[]> {
		try {
			const response = await fetch('/foundation-names/allShades.csv');
			const csvText = await response.text();
			const lines = csvText.split('\n');
			const headers = lines[0].split(',');
			const colors: FoundationColor[] = [];

			for (let i = 1; i < lines.length; i++) {
				if (lines[i].trim() === '') continue;
				const values = parseCSVLine(lines[i]);
				if (values.length >= headers.length) {
					const row: Record<string, string> = {};
					headers.forEach((header, index) => {
						row[header.trim()] = values[index] ? values[index].trim() : '';
					});
					if (row.hex && row.hex.match(/^#[0-9A-Fa-f]{6}$/)) {
						const lab = hexToLab(row.hex);
						// Exclude blue undertones (b* < 0)
						if (lab.b >= 0) {
							colors.push({ hex: row.hex, lab });
						}
					}
				}
			}
			return colors;
		} catch {
			return [];
		}
	}

	// Find minimum Delta E to any foundation color
	function findMinDeltaE(targetLab: LabColor, foundations: FoundationColor[]): number {
		if (foundations.length === 0) return Infinity;
		let minDeltaE = Infinity;
		for (const f of foundations) {
			const deltaE = calculateDeltaE(targetLab, f.lab);
			if (deltaE < minDeltaE) minDeltaE = deltaE;
		}
		return minDeltaE;
	}

	// Check if scatterplot has makeup colors (either target has deltaE < 10)
	function hasMakeupColors(scatter: ScatterplotMetadata, foundations: FoundationColor[]): boolean {
		const deltaE1 = findMinDeltaE(scatter.target_color1_lab, foundations);
		const deltaE2 = findMinDeltaE(scatter.target_color2_lab, foundations);
		return deltaE1 < 10 || deltaE2 < 10;
	}

	// Get set of scatter indices that have makeup colors
	function getMakeupColorIndices(scatterplots: ScatterplotMetadata[], foundations: FoundationColor[]): Set<number> {
		const indices = new Set<number>();
		for (const scatter of scatterplots) {
			if (hasMakeupColors(scatter, foundations)) {
				indices.add(scatter.index);
			}
		}
		return indices;
	}

	// Derived values
	const nParticipants = $derived(new Set(trialDetails.map((t) => t.participantId)).size);
	const nExcluded = $derived(participantSummary.filter((p) => p.excluded).length);
	const nIncluded = $derived(participantSummary.length - nExcluded);
	const nTrials = $derived(trialDetails.length);
	
	// Analysis trials: standard trials from included participants (excludes 7 special trials per participant)
	const nAnalysisTrials = $derived(
		trialDetails.filter((t) => t.trial_type === 'standard' && !t.excluded).length
	);

	// Group trials by participant
	const trialsByParticipant = $derived(groupBy(trialDetails, (t) => t.participantId));

	// Sort participants by accuracy (highest first)
	const sortedParticipantIds = $derived(() => {
		const ids = [...trialsByParticipant.keys()];
		return ids.sort((a, b) => {
			const aTrials = trialsByParticipant.get(a) ?? [];
			const bTrials = trialsByParticipant.get(b) ?? [];
			
			const aAnswered = aTrials.filter((t) => t.answer !== null);
			const bAnswered = bTrials.filter((t) => t.answer !== null);
			
			const aAccuracy = aAnswered.length > 0 
				? aAnswered.filter((t) => t.is_correct).length / aAnswered.length 
				: 0;
			const bAccuracy = bAnswered.length > 0 
				? bAnswered.filter((t) => t.is_correct).length / bAnswered.length 
				: 0;
			
			// Sort descending (highest accuracy first)
			return bAccuracy - aAccuracy;
		});
	});

	onMount(async () => {
		try {
			// Load all data
			const data = await loadAllData();
			metadata = data.metadata;
			demographics = data.demographics;
			attentionChecks = data.attentionChecks;
			experimentInfo = data.experimentInfo;

			// Build trial dataframe
			const allTrials = buildTrialDataframe(data.responses, data.metadata);

			// Apply exclusion criteria
			const { filtered, summary } = applyExclusion(allTrials);
			trialDetails = allTrials; // Keep all for display, filtered used for analysis
			participantSummary = summary;

			// Compute discriminability (on filtered data)
			discriminability = computeDiscriminability(filtered);

			// Fit regressions
			regression = fitSizeAxisRegressions(discriminability);

			// Fit inverse-size model
			inverseModel = fitInverseSizeModel(regression);

			// Fit ND linear model: ND(50%, s) = A + B/s
			ndLinearFit = fitNDLinearModel(regression);

			// Compare to original paper
			const comparison = compareToReference(regression, inverseModel);
			regressionComparison = comparison.regressionComparison;
			inverseModelComparison = comparison.inverseModelComparison;

			// Expertise group analysis
			const expertiseGroups = getParticipantsByExpertise(demographics);
			
			// Filter trials by expertise group
			const filteredColorExpert = filtered.filter(t => expertiseGroups.colorExpert.has(t.participantId));
			const filteredNonExpert = filtered.filter(t => expertiseGroups.nonExpert.has(t.participantId));
			
			// Store filtered trials for performance charts
			trialsColorExpert = filteredColorExpert;
			trialsNonExpert = filteredNonExpert;
			
			// Compute discriminability for each group
			const discriminabilityColorExpert = computeDiscriminability(filteredColorExpert);
			const discriminabilityNonExpert = computeDiscriminability(filteredNonExpert);
			
			// Fit regressions for each group
			regressionColorExpert = fitSizeAxisRegressions(discriminabilityColorExpert);
			regressionNonExpert = fitSizeAxisRegressions(discriminabilityNonExpert);
			
			// Fit ND linear models for each group
			ndLinearFitColorExpert = fitNDLinearModel(regressionColorExpert);
			ndLinearFitNonExpert = fitNDLinearModel(regressionNonExpert);

			// Only Color Expert group analysis (excluding occasional makeup users)
			const onlyColorExpertGroups = getParticipantsByOnlyColorExpert(demographics);
			
			// Filter trials by Only Color Expert group (excluding occasional makeup users)
			const filteredOnlyColorExpert = filtered.filter(t => onlyColorExpertGroups.onlyColorExpert.has(t.participantId));
			// Reuse filteredNonExpert from above (same non-expert group)
			
			// Store filtered trials for performance charts
			trialsOnlyColorExpert = filteredOnlyColorExpert;
			
			// Compute discriminability for Only Color Expert group
			const discriminabilityOnlyColorExpert = computeDiscriminability(filteredOnlyColorExpert);
			
			// Fit regressions for Only Color Expert group
			regressionOnlyColorExpert = fitSizeAxisRegressions(discriminabilityOnlyColorExpert);
			
			// Fit ND linear model for Only Color Expert group
			ndLinearFitOnlyColorExpert = fitNDLinearModel(regressionOnlyColorExpert);

			// ============================================
			// MAKEUP COLORS ANALYSIS
			// ============================================
			// Load foundation colors
			const foundationColors = await loadFoundationColors();
			
			// Get scatterplot indices that have makeup colors (deltaE < 10)
			const makeupColorIndices = getMakeupColorIndices(data.metadata.scatterplots, foundationColors);
			makeupColorScatterplotCount = makeupColorIndices.size;
			
			// Filter trials to only include makeup color scatterplots
			const filteredMakeup = filtered.filter(t => makeupColorIndices.has(t.scatter_index));
			
			// Filter by expertise group for makeup colors
			const filteredMakeupOnlyColorExpert = filteredMakeup.filter(t => onlyColorExpertGroups.onlyColorExpert.has(t.participantId));
			const filteredMakeupNonExpert = filteredMakeup.filter(t => expertiseGroups.nonExpert.has(t.participantId));
			
			// Store filtered trials for performance charts
			trialsMakeupOnlyColorExpert = filteredMakeupOnlyColorExpert;
			trialsMakeupNonExpert = filteredMakeupNonExpert;
			
			// Compute discriminability for makeup colors
			const discriminabilityMakeupOnlyColorExpert = computeDiscriminability(filteredMakeupOnlyColorExpert);
			const discriminabilityMakeupNonExpert = computeDiscriminability(filteredMakeupNonExpert);
			
			// Fit regressions for makeup colors
			regressionMakeupOnlyColorExpert = fitSizeAxisRegressions(discriminabilityMakeupOnlyColorExpert);
			regressionMakeupNonExpert = fitSizeAxisRegressions(discriminabilityMakeupNonExpert);
			
			// Fit ND linear models for makeup colors
			ndLinearFitMakeupOnlyColorExpert = fitNDLinearModel(regressionMakeupOnlyColorExpert);
			ndLinearFitMakeupNonExpert = fitNDLinearModel(regressionMakeupNonExpert);

			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load data';
			loading = false;
		}
	});

	const currentDate = new Date().toLocaleString();
</script>

<svelte:head>
	<title>Colormap Makeup Study - Analysis Report</title>
</svelte:head>

<div class="min-h-screen bg-slate-100">
	<!-- Outline Sidebar -->
	<aside
		class="fixed left-0 top-0 z-40 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out"
		class:translate-x-0={showOutline}
		class:-translate-x-full={!showOutline}
	>
		<div class="flex h-full flex-col">
			<div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
				<h2 class="text-lg font-semibold text-slate-800">Quick Navigation</h2>
				<button
					onclick={() => showOutline = false}
					class="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Close outline"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</div>
			<nav class="flex-1 overflow-y-auto px-3 py-4">
				<ul class="space-y-1">
					{#each outlineSections as section}
						<li>
							<button
								onclick={() => scrollToSection(section.id)}
								class="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
							>
								{section.title}
							</button>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</aside>

	<!-- Overlay when sidebar is open (click to close) -->
	{#if showOutline}
		<button
			class="fixed inset-0 z-30"
			onclick={() => showOutline = false}
			aria-label="Close outline"
		></button>
	{/if}

	<!-- Toggle Button (fixed) -->
	<button
		onclick={() => showOutline = !showOutline}
		class="fixed left-4 top-4 z-20 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50 transition-colors border border-slate-200"
		aria-label="Toggle outline navigation"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
		</svg>
		<span>Outline</span>
	</button>

	<div class="mx-auto max-w-7xl px-6 py-8">
		<!-- Header -->
		<header class="mb-8 pt-12">
			<h1 class="border-b-4 border-blue-600 pb-4 text-3xl font-bold tracking-tight text-slate-800">
				Colormap Makeup Study - Analysis Report
			</h1>
			<p class="mt-2 text-sm text-slate-500">
				Generated: <span class="text-slate-600">{currentDate}</span>
			</p>
		</header>

		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="text-center">
					<div
						class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
					></div>
					<p class="text-slate-600">Loading and analyzing data...</p>
				</div>
			</div>
		{:else if error}
			<div class="rounded-lg bg-red-50 p-6 text-red-700 border border-red-200">
				<h2 class="mb-2 text-lg font-semibold">Error Loading Data</h2>
				<p>{error}</p>
				<p class="mt-4 text-sm text-red-600">
					Make sure the data files are in the <code class="rounded bg-red-100 px-1">static/data/</code>
					directory.
				</p>
			</div>
		{:else}
			<!-- Stats Overview -->
			<div id="stats-overview" class="mb-8 scroll-mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatsCard value={nParticipants} label="Total Participants" />
				<StatsCard value={nIncluded} label="Included" />
				<StatsCard value={nExcluded} label="Excluded" />
				<StatsCard value={nTrials} label="Total Trials" />
			</div>

			<!-- Demographics Section -->
			{#if demographics.length > 0}
				<div id="demographics" class="mb-6 scroll-mt-20">
					<DemographicsSummary {demographics} />
				</div>
			{/if}

			<!-- Duration vs Accuracy Scatterplot -->
			{#if !loading && trialDetails.length > 0 && Object.keys(experimentInfo).length > 0}
				<div id="duration-accuracy" class="mb-6 scroll-mt-20">
					<DurationAccuracyScatterplot {trialDetails} {experimentInfo} />
				</div>
			{/if}

			<!-- Participant Summary & Exclusion -->
			<div id="participant-summary" class="mb-6 scroll-mt-20">
				<ParticipantTable summary={participantSummary} />
			</div>

			<!-- Discriminability Analysis -->
			{#if discriminability.length > 0}
				<div id="discriminability" class="mb-6 scroll-mt-20">
					<DiscriminabilitySection {discriminability} />
				</div>
			{/if}

			<!-- Regression Analysis -->
			{#if regression.length > 0 && inverseModel.length > 0}
				<div id="regression" class="mb-6 scroll-mt-20">
					<RegressionSection {regression} {inverseModel} {discriminability} />
				</div>
			{/if}

			<!-- 50% JND Model Plot -->
			{#if regression.length > 0 && inverseModel.length > 0 && ndLinearFit.length > 0}
				<div id="jnd-model" class="mb-6 scroll-mt-20">
					<JNDPlot {regression} {inverseModel} {ndLinearFit} />
				</div>
			{/if}

			<!-- 50% JND by Expertise Group -->
			{#if regressionColorExpert.length > 0 || regressionNonExpert.length > 0}
				<div id="jnd-expertise" class="mb-6 scroll-mt-20">
					<JNDPlotByExpertise 
						{regressionColorExpert}
						{regressionNonExpert}
						{ndLinearFitColorExpert}
						{ndLinearFitNonExpert}
						{demographics}
					/>
					<!-- Performance breakdown for Color Expert vs Non-Expert -->
					{#if trialsColorExpert.length > 0 || trialsNonExpert.length > 0}
						<GroupPerformanceCharts
							group1Trials={trialsColorExpert}
							group2Trials={trialsNonExpert}
							group1Label="Color Expert"
							group2Label="Non-Expert"
							group1Color="rgb(59, 130, 246)"
							group2Color="rgb(147, 197, 253)"
							title="Performance Breakdown: Color Expert vs Non-Expert (All Scatterplots)"
						/>
					{/if}
				</div>
			{/if}

			<!-- 50% JND Comparison: Only Color Expert (without occasional makeup users) vs Non-Expert -->
			{#if regressionOnlyColorExpert.length > 0 || regressionNonExpert.length > 0}
				<div id="jnd-only-color-expert" class="mb-6 scroll-mt-20">
					<JNDPlotOnlyColorExpert 
						regressionOnlyColorExpert={regressionOnlyColorExpert}
						{regressionNonExpert}
						ndLinearFitOnlyColorExpert={ndLinearFitOnlyColorExpert}
						{ndLinearFitNonExpert}
						{demographics}
					/>
					<!-- Performance breakdown for Only Color Expert vs Non-Expert -->
					{#if trialsOnlyColorExpert.length > 0 || trialsNonExpert.length > 0}
						<GroupPerformanceCharts
							group1Trials={trialsOnlyColorExpert}
							group2Trials={trialsNonExpert}
							group1Label="Only Color Expert"
							group2Label="Non-Expert"
							group1Color="rgb(59, 130, 246)"
							group2Color="rgb(147, 197, 253)"
							title="Performance Breakdown: Only Color Expert vs Non-Expert (All Scatterplots)"
						/>
					{/if}
				</div>
			{/if}

			<!-- 50% JND Comparison for Makeup Colors: Only Color Expert vs Non-Expert -->
			{#if regressionMakeupOnlyColorExpert.length > 0 || regressionMakeupNonExpert.length > 0}
				<div id="jnd-makeup-colors" class="mb-6 scroll-mt-20">
					<JNDPlotMakeupColors 
						regressionOnlyColorExpert={regressionMakeupOnlyColorExpert}
						regressionNonExpert={regressionMakeupNonExpert}
						ndLinearFitOnlyColorExpert={ndLinearFitMakeupOnlyColorExpert}
						ndLinearFitNonExpert={ndLinearFitMakeupNonExpert}
						{demographics}
						makeupColorCount={makeupColorScatterplotCount}
					/>
					<!-- Performance breakdown for Only Color Expert vs Non-Expert on Makeup Colors -->
					{#if trialsMakeupOnlyColorExpert.length > 0 || trialsMakeupNonExpert.length > 0}
						<GroupPerformanceCharts
							group1Trials={trialsMakeupOnlyColorExpert}
							group2Trials={trialsMakeupNonExpert}
							group1Label="Only Color Expert"
							group2Label="Non-Expert"
							group1Color="rgb(236, 72, 153)"
							group2Color="rgb(251, 182, 206)"
							title="Performance Breakdown: Only Color Expert vs Non-Expert ({makeupColorScatterplotCount} Makeup Color Scatterplots)"
						/>
					{/if}
				</div>
			{/if}

			<!-- Comparison to Original Paper -->
			{#if regressionComparison.length > 0}
				<div id="comparison" class="mb-6 scroll-mt-20">
					<ComparisonSection {regressionComparison} {inverseModelComparison} />
				</div>
			{/if}

			<!-- Individual Participant Reports -->
			<section id="participant-reports" class="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
				<h2 class="mb-6 text-xl font-semibold text-slate-800">Individual Participant Reports</h2>

				<div class="space-y-4">
					{#each sortedParticipantIds() as participantId, index}
						{@const trials = trialsByParticipant.get(participantId) ?? []}
						{@const demo = demographics.find((d) => d.participantId === participantId)}
						{@const ac = attentionChecks[participantId] ?? []}
						{@const expInfo = experimentInfo[participantId]}
						{@const summaryRow = participantSummary.find((p) => p.participantId === participantId)}
						
						<ParticipantReport
							{participantId}
							{trials}
							demographics={demo}
							attentionChecks={ac}
							experimentInfo={expInfo}
							participantSummaryRow={summaryRow}
							{index}
						/>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

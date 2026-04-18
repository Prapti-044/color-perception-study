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
		deserializeExpertClause,
		EXPERT_CLAUSE_QUERY_PARAM,
		EXPERT_CLAUSE_STORAGE_KEY,
		EXPERT_PREDICATE_DEFINITIONS,
		getDefaultExpertClause,
		getExpertClauseSummary,
		getParticipantsByExpertClause,
		serializeExpertClause
	} from '$lib';
	import type {
		ExpertClauseGroupNode,
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
		InverseModelComparison
	} from '$lib/types';
	import {
		StatsCard,
		DemographicsSummary,
		ParticipantTable,
		DiscriminabilitySection,
		RegressionSection,
		ComparisonSection,
		ParticipantReport,
		ExpertClauseBuilder,
		JNDPlot,
		JNDPlotByExpertise,
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
	let analysisTrials = $state<TrialDetails[]>([]);
	let participantSummary = $state<ParticipantSummary[]>([]);
	let discriminability = $state<DiscriminabilityRow[]>([]);
	let regression = $state<RegressionRow[]>([]);
	let inverseModel = $state<InverseModelRow[]>([]);
	let ndLinearFit = $state<NDLinearFitRow[]>([]);
	let regressionComparison = $state<RegressionComparison[]>([]);
	let inverseModelComparison = $state<InverseModelComparison[]>([]);

	// Expertise group analysis
	let expertClause = $state<ExpertClauseGroupNode>(getDefaultExpertClause());
	let clauseHydrated = $state(false);
	let lastPersistedExpertClause: string | null = null;
	const availableExpertPredicates = EXPERT_PREDICATE_DEFINITIONS;
	const defaultExpertClauseSerialized = serializeExpertClause(getDefaultExpertClause());
	const expertClauseSummary = $derived(getExpertClauseSummary(expertClause));
	let showParticipantReports = $state(false);
	let visibleParticipantReportCount = $state(20);

	function getInitialExpertClause(): ExpertClauseGroupNode {
		if (typeof window === 'undefined') {
			return getDefaultExpertClause();
		}

		const urlClause = deserializeExpertClause(
			new URLSearchParams(window.location.search).get(EXPERT_CLAUSE_QUERY_PARAM)
		);
		if (urlClause) {
			return urlClause;
		}

		const storedClause = deserializeExpertClause(window.localStorage.getItem(EXPERT_CLAUSE_STORAGE_KEY));
		return storedClause ?? getDefaultExpertClause();
	}

	function handleExpertClauseChange(nextClause: ExpertClauseGroupNode) {
		expertClause = nextClause;
	}

	function resetExpertClause() {
		expertClause = getDefaultExpertClause();
	}

	function toggleParticipantReports() {
		showParticipantReports = !showParticipantReports;
		if (!showParticipantReports) {
			visibleParticipantReportCount = 20;
		}
	}

	function loadMoreParticipantReports() {
		visibleParticipantReportCount += 20;
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
	const visibleParticipantIds = $derived(
		showParticipantReports ? sortedParticipantIds().slice(0, visibleParticipantReportCount) : []
	);
	const expertiseAnalysis = $derived.by(() => {
		if (demographics.length === 0 || analysisTrials.length === 0) {
			return {
				expertParticipantCount: 0,
				nonExpertParticipantCount: 0,
				trialsColorExpert: [] as TrialDetails[],
				trialsNonExpert: [] as TrialDetails[],
				regressionColorExpert: [] as RegressionRow[],
				regressionNonExpert: [] as RegressionRow[],
				ndLinearFitColorExpert: [] as NDLinearFitRow[],
				ndLinearFitNonExpert: [] as NDLinearFitRow[]
			};
		}

		const participantGroups = getParticipantsByExpertClause(demographics, expertClause);
		const trialsColorExpert = analysisTrials.filter((trial) =>
			participantGroups.colorExpert.has(trial.participantId)
		);
		const trialsNonExpert = analysisTrials.filter((trial) =>
			participantGroups.nonExpert.has(trial.participantId)
		);
		const regressionColorExpert = fitSizeAxisRegressions(
			computeDiscriminability(trialsColorExpert)
		);
		const regressionNonExpert = fitSizeAxisRegressions(
			computeDiscriminability(trialsNonExpert)
		);

		return {
			expertParticipantCount: participantGroups.colorExpert.size,
			nonExpertParticipantCount: participantGroups.nonExpert.size,
			trialsColorExpert,
			trialsNonExpert,
			regressionColorExpert,
			regressionNonExpert,
			ndLinearFitColorExpert: fitNDLinearModel(regressionColorExpert),
			ndLinearFitNonExpert: fitNDLinearModel(regressionNonExpert)
		};
	});

	onMount(async () => {
		try {
			expertClause = getInitialExpertClause();
			clauseHydrated = true;

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
			analysisTrials = filtered;
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

			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load data';
			loading = false;
		}
	});

	$effect(() => {
		if (!clauseHydrated || typeof window === 'undefined') {
			return;
		}

		const serializedClause = serializeExpertClause(expertClause);
		if (serializedClause === lastPersistedExpertClause) {
			return;
		}

		const url = new URL(window.location.href);

		if (serializedClause === defaultExpertClauseSerialized) {
			url.searchParams.delete(EXPERT_CLAUSE_QUERY_PARAM);
			window.localStorage.removeItem(EXPERT_CLAUSE_STORAGE_KEY);
		} else {
			url.searchParams.set(EXPERT_CLAUSE_QUERY_PARAM, serializedClause);
			window.localStorage.setItem(EXPERT_CLAUSE_STORAGE_KEY, serializedClause);
		}

		window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
		lastPersistedExpertClause = serializedClause;
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
			{#if demographics.length > 0}
				<div id="jnd-expertise" class="mb-6 scroll-mt-20">
					<ExpertClauseBuilder
						clause={expertClause}
						summary={expertClauseSummary}
						availablePredicates={availableExpertPredicates}
						onChange={handleExpertClauseChange}
						onReset={resetExpertClause}
					/>

					{#if expertiseAnalysis.regressionColorExpert.length > 0 || expertiseAnalysis.regressionNonExpert.length > 0}
						<JNDPlotByExpertise
							regressionExpert={expertiseAnalysis.regressionColorExpert}
							regressionNonExpert={expertiseAnalysis.regressionNonExpert}
							ndLinearFitExpert={expertiseAnalysis.ndLinearFitColorExpert}
							ndLinearFitNonExpert={expertiseAnalysis.ndLinearFitNonExpert}
							expertCount={expertiseAnalysis.expertParticipantCount}
							nonExpertCount={expertiseAnalysis.nonExpertParticipantCount}
							{expertClauseSummary}
						/>
					{/if}
					<!-- Performance breakdown for Expert vs Non-Expert -->
					{#if expertiseAnalysis.trialsColorExpert.length > 0 || expertiseAnalysis.trialsNonExpert.length > 0}
						<GroupPerformanceCharts
							group1Trials={expertiseAnalysis.trialsColorExpert}
							group2Trials={expertiseAnalysis.trialsNonExpert}
							group1Label="Expert"
							group2Label="Non-Expert"
							group1Color="rgb(59, 130, 246)"
							group2Color="rgb(147, 197, 253)"
							title="Performance Breakdown: Expert vs Non-Expert (All Scatterplots)"
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
				<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 class="text-xl font-semibold text-slate-800">Individual Participant Reports</h2>
						<p class="mt-1 text-sm text-slate-500">
							These detailed cards are rendered on demand to reduce memory usage and keep the page responsive.
						</p>
					</div>
					<button
						type="button"
						onclick={toggleParticipantReports}
						class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
					>
						{showParticipantReports ? 'Hide Participant Reports' : `Show Participant Reports (${sortedParticipantIds().length})`}
					</button>
				</div>

				{#if showParticipantReports}
					<div class="space-y-4">
						{#each visibleParticipantIds as participantId, index}
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
								index={index}
							/>
						{/each}
					</div>

					{#if visibleParticipantIds.length < sortedParticipantIds().length}
						<div class="mt-6 flex justify-center">
							<button
								type="button"
								onclick={loadMoreParticipantReports}
								class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
							>
								Load 20 More Reports
							</button>
						</div>
					{/if}
				{/if}
			</section>
		{/if}
	</div>
</div>

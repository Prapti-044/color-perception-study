<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { buildColorVisionAnalysis } from '$lib/colorVisionGroupAnalysis';
	import ExpertClauseBuilder from '$lib/components/ExpertClauseBuilder.svelte';
	import EllipseModeToggle from '$lib/components/EllipseModeToggle.svelte';
	import PaperVolumeDistributionFigure from '$lib/components/PaperVolumeDistributionFigure.svelte';
	import PerceptionHistogram from '$lib/components/PerceptionHistogram.svelte';
	import {
		deserializeExpertClause,
		EXPERT_CLAUSE_QUERY_PARAM,
		EXPERT_CLAUSE_STORAGE_KEY,
		EXPERT_PREDICATE_DEFINITIONS,
		getDefaultExpertClause,
		getExpertClauseSummary,
		serializeExpertClause
	} from '$lib/expertClause';
	import type { ExpertClauseGroupNode } from '$lib/expertClause';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const percentFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		style: 'percent'
	});
	const signedPercentFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		signDisplay: 'always',
		style: 'percent'
	});
	const oneDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
	const signedOneDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1,
		signDisplay: 'always'
	});
	const threeDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 3,
		minimumFractionDigits: 3
	});
	const signedThreeDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 3,
		minimumFractionDigits: 3,
		signDisplay: 'always'
	});
	const integerFormatter = new Intl.NumberFormat('en-US');
	const compactFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		notation: 'compact'
	});
	const defaultExpertClauseSerialized = serializeExpertClause(getDefaultExpertClause());
	const availableExpertPredicates = EXPERT_PREDICATE_DEFINITIONS;

	let expertClause = $state<ExpertClauseGroupNode>(getDefaultExpertClause());
	let clauseHydrated = $state(false);
	let lastPersistedExpertClause: string | null = null;

	const ellipseMode = $derived(
		page.url.searchParams.get('ellipseMode') === 'include-fitted'
			? 'include-fitted'
			: 'exact'
	);
	const participantRecords = $derived(data.participantRecordsByMode[ellipseMode]);
	const analysis = $derived(buildColorVisionAnalysis(participantRecords, expertClause));
	const groups = $derived(analysis.groups);
	const expertGroup = $derived(groups[0]);
	const nonExpertGroup = $derived(groups[1]);
	const comparisons = $derived(analysis.comparisons);
	const expertClauseSummary = $derived(getExpertClauseSummary(expertClause));
	const participantRatio = $derived(
		nonExpertGroup.participantCount === 0
			? null
			: expertGroup.participantCount / nonExpertGroup.participantCount
	);
	const participantRatioFootnote = $derived.by(() => {
		if (participantRatio === null) {
			return 'The active clause currently places every analyzed participant in the Expert group.';
		}

		return ellipseMode === 'exact'
			? `${oneDecimalFormatter.format(participantRatio)}× expert-to-non-expert headcount ratio among exact-valid ellipses`
			: `${oneDecimalFormatter.format(participantRatio)}× expert-to-non-expert headcount ratio after fitted fallbacks`;
	});
	const methodsHref = $derived.by(() => {
		const params = new URLSearchParams();
		const serializedClause = serializeExpertClause(expertClause);

		if (ellipseMode === 'include-fitted') {
			params.set('ellipseMode', 'include-fitted');
		}

		if (serializedClause !== defaultExpertClauseSerialized) {
			params.set(EXPERT_CLAUSE_QUERY_PARAM, serializedClause);
		}

		const query = params.toString();
		return query ? `/methods?${query}` : '/methods';
	});
	const highlightCards = $derived([
		{
			label: ellipseMode === 'exact' ? 'Analyzed participants' : 'Analyzed participants (+ fitted)',
			value: `${expertGroup.participantCount} vs ${nonExpertGroup.participantCount}`,
			footnote: participantRatioFootnote
		},
		{
			label: 'Aggregate accuracy gap',
			value: signedPercentFormatter.format(
				expertGroup.aggregateAccuracy - nonExpertGroup.aggregateAccuracy
			),
			footnote: 'Expert minus Non-Expert (overall correct guesses)'
		},
		{
			label: 'Mean raw threshold gap',
			value: signedOneDecimalFormatter.format(
				expertGroup.metrics.meanRawThreshold.mean -
					nonExpertGroup.metrics.meanRawThreshold.mean
			),
			footnote: 'Lower indicates finer discrimination'
		},
		{
			label: 'Histogram coverage',
			value: integerFormatter.format(analysis.histogram.visibleParticipantCount),
			footnote: `${integerFormatter.format(analysis.histogram.omittedCount)} beyond ${compactFormatter.format(analysis.histogram.maxVisibleVolume)} ellipsoid units³`
		}
	]);

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

		const storedClause = deserializeExpertClause(
			window.localStorage.getItem(EXPERT_CLAUSE_STORAGE_KEY)
		);
		return storedClause ?? getDefaultExpertClause();
	}

	function handleExpertClauseChange(nextClause: ExpertClauseGroupNode) {
		expertClause = nextClause;
	}

	function resetExpertClause() {
		expertClause = getDefaultExpertClause();
	}

	function formatMetric(metricId: string, value: number) {
		if (metricId === 'trialAccuracy') {
			return percentFormatter.format(value);
		}

		if (metricId === 'meanRawThreshold') {
			return oneDecimalFormatter.format(value);
		}

		return threeDecimalFormatter.format(value);
	}

	function formatSignedMetric(metricId: string, value: number) {
		if (metricId === 'trialAccuracy') {
			return signedPercentFormatter.format(value);
		}

		if (metricId === 'meanRawThreshold') {
			return signedOneDecimalFormatter.format(value);
		}

		return signedThreeDecimalFormatter.format(value);
	}

	function formatWelchValue(value: number | null, digits: number) {
		if (value === null) {
			return '—';
		}

		return value.toFixed(digits);
	}

	onMount(() => {
		expertClause = getInitialExpertClause();
		clauseHydrated = true;
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
</script>

<svelte:head>
	<title>Color perception · Expert comparison</title>
	<meta
		name="description"
		content="Expert versus Non-Expert comparison for color perception: accuracy, thresholds, and reconstructed ellipsoid-volume distributions."
	/>
</svelte:head>

<div class="page-frame min-h-screen pb-16 pt-2">
	<div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8 lg:pt-8">
		<header
			class="surface-hero relative overflow-hidden rounded-3xl border border-white/60 px-6 py-10 shadow-xl sm:px-10 sm:py-12"
		>
			<div class="hero-glow pointer-events-none absolute inset-0"></div>
			<div class="relative max-w-3xl">
				<p class="text-xs font-semibold uppercase tracking-[0.22em] text-teal-800/90">
					Color perception
				</p>
				<h1 class="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
					Expert and Non-Expert comparison for color perception
				</h1>
				<p class="mt-5 text-lg leading-relaxed text-slate-600">
					Interactive summary of staircase accuracy, threshold summaries, and the reconstructed
					ellipsoid-volume distribution, regrouped live by the active expertise clause.
				</p>

				<div class="mt-6 max-w-xl">
					<EllipseModeToggle currentMode={ellipseMode} label="Ellipse inclusion" />
				</div>

				<div class="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{#each highlightCards as card}
						<div class="stat-card rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
							<p class="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-950">
								{card.value}
							</p>
							<p class="mt-2 text-sm leading-snug text-slate-600">{card.footnote}</p>
						</div>
					{/each}
				</div>
			</div>
		</header>

		<div
			class="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-5 py-4 text-sm leading-relaxed text-amber-950 shadow-sm"
			role="note"
		>
			{#if ellipseMode === 'exact'}
				The active clause identifies {expertGroup.participantCount} Expert participants versus{' '}
				{nonExpertGroup.participantCount} Non-Experts after excluding participants whose exact
				centered ellipse is invalid.
			{:else}
				The active clause identifies {expertGroup.participantCount} Expert participants versus{' '}
				{nonExpertGroup.participantCount} Non-Experts after adding deterministic fitted fallbacks
				where exact ellipse fitting fails.
			{/if}
			Unequal samples limit inferential strength; treat Welch results as descriptive context rather
			than confirmatory evidence.
		</div>

		<ExpertClauseBuilder
			clause={expertClause}
			summary={expertClauseSummary}
			availablePredicates={availableExpertPredicates}
			onChange={handleExpertClauseChange}
			onReset={resetExpertClause}
		/>

		<section class="grid gap-6 lg:grid-cols-2">
			{#each groups as group, index}
				<div
					class={`group-card rounded-3xl border p-7 shadow-sm ${
						index === 0
							? 'border-teal-200/90 bg-gradient-to-br from-teal-50/90 to-white'
							: 'border-orange-200/90 bg-gradient-to-br from-orange-50/85 to-white'
					}`}
				>
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
								{group.label}
							</p>
							<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
								{integerFormatter.format(group.participantCount)} participants
							</h2>
						</div>
						<div
							class="rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm"
						>
							{integerFormatter.format(group.totalCorrect)} / {integerFormatter.format(
								group.totalGuesses
							)}{' '}
							correct
						</div>
					</div>

					<div class="mt-8 grid gap-4 sm:grid-cols-2">
						<div class="rounded-2xl bg-slate-900 px-5 py-4 text-slate-50 shadow-inner">
							<p class="text-sm text-slate-400">Aggregate accuracy</p>
							<p class="mt-2 font-mono text-3xl font-semibold tabular-nums">
								{percentFormatter.format(group.aggregateAccuracy)}
							</p>
						</div>
						<div class="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
							<p class="text-sm text-slate-500">Mean trial accuracy</p>
							<p class="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">
								{percentFormatter.format(group.metrics.trialAccuracy.mean)}
							</p>
							<p class="mt-1 text-sm text-slate-600">
								SD {percentFormatter.format(group.metrics.trialAccuracy.sd)}
							</p>
						</div>
						<div class="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
							<p class="text-sm text-slate-500">Mean raw threshold</p>
							<p class="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">
								{oneDecimalFormatter.format(group.metrics.meanRawThreshold.mean)}
							</p>
							<p class="mt-1 text-sm text-slate-600">
								SD {oneDecimalFormatter.format(group.metrics.meanRawThreshold.sd)}
							</p>
						</div>
						<div class="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
							<p class="text-sm text-slate-500">Mean normalized threshold</p>
							<p class="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">
								{threeDecimalFormatter.format(group.metrics.meanNormalizedThreshold.mean)}
							</p>
							<p class="mt-1 text-sm text-slate-600">
								SD {threeDecimalFormatter.format(group.metrics.meanNormalizedThreshold.sd)}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</section>

		<section class="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
			<div class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Metrics</p>
						<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
							Group comparison
						</h2>
					</div>
					<p class="max-w-xs text-sm text-slate-500">
						Delta column: Expert minus Non-Expert. Welch t-tests for independent samples with
						unequal variances.
					</p>
				</div>

				<div class="mt-8 overflow-x-auto rounded-2xl border border-slate-100">
					<table class="compare-table min-w-full text-sm">
						<thead>
							<tr>
								<th scope="col">Metric</th>
								<th scope="col">Expert</th>
								<th scope="col">Non-Expert</th>
								<th scope="col">Δ</th>
								<th scope="col">Welch t (df)</th>
							</tr>
						</thead>
						<tbody>
							{#each comparisons as metric}
								<tr>
									<td data-label="Metric">
										<span class="metric-title">{metric.label}</span>
										<p class="metric-desc">{metric.description}</p>
										<p class="metric-hint">
											{metric.betterDirection === 'higher' ? 'Higher is better' : 'Lower is better'}
										</p>
									</td>
									<td data-label="Expert">
										<span class="tabular-nums font-semibold text-slate-950">
											{formatMetric(metric.id, metric.expert.mean)}
										</span>
										<span class="block text-slate-600">
											SD {formatMetric(metric.id, metric.expert.sd)}
										</span>
									</td>
									<td data-label="Non-Expert">
										<span class="tabular-nums font-semibold text-slate-950">
											{formatMetric(metric.id, metric.nonExpert.mean)}
										</span>
										<span class="block text-slate-600">
											SD {formatMetric(metric.id, metric.nonExpert.sd)}
										</span>
									</td>
									<td data-label="Δ">
										<span class="tabular-nums font-semibold text-slate-950">
											{formatSignedMetric(metric.id, metric.delta)}
										</span>
									</td>
									<td data-label="Welch">
										<span class="tabular-nums font-semibold text-slate-950">
											{formatWelchValue(metric.welch.tStatistic, 3)}
										</span>
										<span class="block text-slate-600">
											df {formatWelchValue(metric.welch.degreesOfFreedom, 1)}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<aside class="flex flex-col gap-4 rounded-3xl border border-slate-200/90 bg-slate-50/80 p-6 shadow-sm sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Methods</p>
				<h2 class="font-display text-2xl font-semibold text-slate-950">How volumes are built</h2>
				<div class="space-y-4 text-sm leading-relaxed text-slate-700">
					<p>
						Practice trials are excluded. Each participant contributes completed direction sets with
						thresholds, normalized thresholds, and per-trial guess outcomes.
					</p>
					<p>
						The histogram now uses a reconstructed{' '}
						<strong class="font-semibold text-slate-900">ellipsoid volume</strong> derived from the
						recovered pink, magenta, blue, and lighter axes. Values above{' '}
						{integerFormatter.format(analysis.histogram.maxVisibleVolume)} ellipsoid units³ are
						excluded from the chart so the distribution stays legible.
					</p>
					<p>
						Summary statistics and tests are computed from the same participant-level metrics shown in
						the group cards. The full recovery pipeline and an interactive worked example are
						documented on the methods page.
					</p>
				</div>
				<a
					href={methodsHref}
					class="inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-teal-300 hover:text-slate-950"
				>
					Open methods note
				</a>
			</aside>
		</section>

		<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Distribution</p>
					<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
						Ellipsoid volume
					</h2>
				</div>
			</div>

			<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
				{integerFormatter.format(analysis.histogram.bins.length)} bins of width{' '}
				{integerFormatter.format(analysis.histogram.binWidth)} ellipsoid units³ on the x-axis,
				covering 0–{integerFormatter.format(analysis.histogram.maxVisibleVolume)}. Axes and
				typography are tuned for high-resolution screenshots suitable for publication figures.
			</p>

			<div class="mt-8">
				<PerceptionHistogram
					bins={analysis.histogram.bins}
					maxVisibleVolume={analysis.histogram.maxVisibleVolume}
					omittedCount={analysis.histogram.omittedCount}
					visibleParticipantCount={analysis.histogram.visibleParticipantCount}
				/>
			</div>

			<div class="mt-10">
				<PaperVolumeDistributionFigure
					bins={analysis.histogram.bins}
					maxVisibleVolume={analysis.histogram.maxVisibleVolume}
					participantVolumes={analysis.histogram.participantVolumes}
					summary={analysis.histogram.summary}
					visibleParticipantCount={analysis.histogram.visibleParticipantCount}
				/>
			</div>
		</section>
	</div>
</div>

<style>
	.page-frame {
		color: var(--page-ink, #0f172a);
	}

	.surface-hero {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.96) 0%,
			rgba(248, 250, 252, 0.94) 45%,
			rgba(254, 249, 244, 0.92) 100%
		);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.8) inset,
			0 24px 60px rgba(15, 23, 42, 0.08);
	}

	.hero-glow {
		background:
			radial-gradient(circle at 0% 0%, rgba(13, 148, 136, 0.14), transparent 42%),
			radial-gradient(circle at 100% 20%, rgba(249, 115, 22, 0.12), transparent 40%);
	}

	.stat-card {
		backdrop-filter: blur(8px);
	}

	.group-card {
		transition:
			box-shadow 0.2s ease,
			transform 0.2s ease;
	}

	.group-card:hover {
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
		transform: translateY(-1px);
	}

	.compare-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
	}

	.compare-table thead th {
		text-align: left;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #64748b;
		padding: 0.75rem 1rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.compare-table tbody tr:nth-child(even) td {
		background: rgba(248, 250, 252, 0.65);
	}

	.compare-table tbody td {
		vertical-align: top;
		padding: 1rem 1rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
	}

	.compare-table tbody tr:last-child td {
		border-bottom: none;
	}

	.metric-title {
		font-weight: 600;
		color: #0f172a;
		display: block;
	}

	.metric-desc {
		margin-top: 0.35rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: #64748b;
	}

	.metric-hint {
		margin-top: 0.4rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #0f766e;
	}

	@media (max-width: 768px) {
		.compare-table thead {
			display: none;
		}

		.compare-table tbody tr {
			display: grid;
			gap: 0.5rem;
			padding: 1rem;
		}

		.compare-table tbody td {
			display: grid;
			gap: 0.2rem;
			padding: 0;
			border: none;
			background: transparent !important;
		}

		.compare-table tbody td::before {
			content: attr(data-label);
			font-size: 0.72rem;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: #94a3b8;
		}
	}
</style>

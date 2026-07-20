<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { buildColorVisionAnalysis } from '$lib/colorVisionGroupAnalysis';
	import ExpertClauseBuilder from '$lib/components/ExpertClauseBuilder.svelte';
	import EllipseModeToggle from '$lib/components/EllipseModeToggle.svelte';
	import NormalityAnalysis from '$lib/components/NormalityAnalysis.svelte';
	import PooledNormalityAnalysis from '$lib/components/PooledNormalityAnalysis.svelte';
	import PaperVolumeDistributionFigure from '$lib/components/PaperVolumeDistributionFigure.svelte';
	import PerceptionHistogram from '$lib/components/PerceptionHistogram.svelte';
	import StudyMeanEquivalenceFigure from '$lib/components/StudyMeanEquivalenceFigure.svelte';
	import DistributionComparisonFigure from '$lib/components/DistributionComparisonFigure.svelte';
	import { buildVolumeEquivalenceComparison } from '$lib/studyMeanEquivalence';
	import { buildDistributionComparison } from '$lib/distributionComparison';
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
	const includeFittedParticipantRecords = $derived(
		data.participantRecordsByMode['include-fitted']
	);
	const analysis = $derived(buildColorVisionAnalysis(participantRecords, expertClause));
	const includeFittedAnalysis = $derived(
		buildColorVisionAnalysis(includeFittedParticipantRecords, expertClause)
	);
	const volumeEquivalenceComparison = $derived(
		buildVolumeEquivalenceComparison({
			label: 'This study',
			mean: includeFittedAnalysis.overallEllipsoidVolume.mean,
			n: includeFittedParticipantRecords.length,
			sd: includeFittedAnalysis.overallEllipsoidVolume.sd
		})
	);
	const distributionComparisonModeLabel = $derived(
		ellipseMode === 'exact' ? 'exact-ellipse mode' : 'include-fitted mode'
	);
	const distributionComparison = $derived.by(() => {
		const volumes = analysis.histogram.participantVolumes;
		if (volumes.length < 3) {
			return null;
		}

		return buildDistributionComparison(volumes, 'This study');
	});
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
			label: 'Mean ellipsoid volume (all participants)',
			value: compactFormatter.format(analysis.overallEllipsoidVolume.mean),
			footnote: `SD ${compactFormatter.format(analysis.overallEllipsoidVolume.sd)} ellipsoid units³`
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

				<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
						<div class="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
							<p class="text-sm text-slate-500">Mean ellipsoid volume</p>
							<p class="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">
								{compactFormatter.format(group.metrics.ellipsoidVolume.mean)}
							</p>
							<p class="mt-1 text-sm text-slate-600">
								SD {compactFormatter.format(group.metrics.ellipsoidVolume.sd)} ellipsoid units³
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
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Assumption check
					</p>
					<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
						Normality of user study data
					</h2>
				</div>
				<p class="max-w-xs text-sm text-slate-500">
					Shapiro–Wilk per metric, split by Expert / Non-Expert. α = {analysis.normality.alpha}.
				</p>
			</div>

			<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
				The Welch t-tests above assume that each group's metric is approximately normal. This section
				runs the Shapiro–Wilk test on every participant-level metric inside each group and pairs it
				with a standardized Q–Q plot (Blom plotting positions against the y = x reference line). A
				small <em>p</em>-value means the metric is unlikely to have been drawn from a normal
				distribution.
			</p>

			<div class="mt-6">
				<NormalityAnalysis
					alpha={analysis.normality.alpha}
					variables={analysis.normality.variables}
				/>
			</div>

			<div
				class="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 text-sm leading-relaxed text-slate-700"
			>
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Conclusion</p>
				<p class="mt-2">
					Under the default expert clause in exact-ellipse mode (n = 147 Expert, n = 96 Non-Expert),
					only <strong>trial accuracy</strong> fails to reject normality in both groups (Expert W =
					0.984, p = 0.089; Non-Expert W = 0.980, p = 0.144). Both threshold metrics reject
					strongly — <strong>mean raw threshold</strong> at Expert W = 0.873 and Non-Expert W =
					0.798 (p ≈ 10⁻¹⁰ in both groups), and <strong>mean normalized threshold</strong> at
					Expert W = 0.876 and Non-Expert W = 0.800 (p ≈ 10⁻⁹ or smaller). <strong>Ellipsoid
					volume</strong> is the most extreme: Expert W = 0.422 and Non-Expert W = 0.375, both with
					<em>p</em> indistinguishable from zero.
				</p>
				<p class="mt-3">
					The Q–Q plots match the numbers. Accuracy scatters tightly along the y = x diagonal in
					both groups (staircase targeting pulls accuracies toward ~60% and symmetrizes the
					distribution), while the threshold and especially the ellipsoid-volume plots fan
					sharply upward on the right tail — the classic signature of a right-skewed, long-tailed
					distribution with a handful of participants producing disproportionately large volumes.
				</p>
				<p class="mt-3">
					Switching to <em>include-fitted</em> mode (n = 252 Expert, n = 142 Non-Expert) preserves
					the qualitative verdict for thresholds and volume (all four reject at p &lt; 10⁻¹²) and
					additionally pushes Expert accuracy below α = 0.05 (W = 0.932, p ≈ 2 × 10⁻⁹), driven by
					the extra variance that fitted participants contribute. Non-Expert accuracy stays on the
					border (W = 0.983, p = 0.067).
				</p>
				<p class="mt-3">
					Implication for the Welch table above: the accuracy contrast is on reasonably safe
					parametric ground in exact mode (the CLT plus Welch's robustness cover the mild
					deviation), but the threshold and volume contrasts should be treated as descriptive.
					A rank-based sensitivity analysis (Mann–Whitney) — or, for ellipsoid volume
					specifically, a log or Box–Cox transform before re-running the <em>t</em>-test — is the
					appropriate follow-up for the last two rows of the group comparison.
				</p>
			</div>
		</section>

		<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Assumption check
					</p>
					<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
						Normality of user study data — pooled
					</h2>
				</div>
				<p class="max-w-xs text-sm text-slate-500">
					Shapiro–Wilk per metric, all participants pooled (no Expert / Non-Expert split). α =
					{analysis.normality.alpha}.
				</p>
			</div>

			<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
				The split-by-group view above asks whether each group is individually normal — the
				assumption that the Welch <em>t</em>-test actually needs. It is also worth asking the
				simpler question: treating the user study as a single sample, are these metrics normally
				distributed overall? This section ignores the expert clause and runs Shapiro–Wilk on every
				participant together.
			</p>

			<div class="mt-6">
				<PooledNormalityAnalysis
					alpha={analysis.normality.alpha}
					variables={analysis.normality.variables}
				/>
			</div>

			<div
				class="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 text-sm leading-relaxed text-slate-700"
			>
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Conclusion</p>
				<p class="mt-2">
					Pooling everyone in exact-ellipse mode (n = 243) rejects normality for every metric at α
					= 0.05. <strong>Trial accuracy</strong> is the closest to normal (W = 0.986, p = 0.018)
					— the rejection is driven mostly by the larger sample size, which makes the test very
					sensitive to even mild deviations. Both <strong>threshold metrics</strong> are strongly
					non-normal (mean raw W = 0.828 and mean normalized W = 0.831, both with p ≈ 10⁻¹⁵), and
					<strong>ellipsoid volume</strong> is the most extreme (W = 0.397, <em>p</em> indistinguishable
					from zero).
				</p>
				<p class="mt-3">
					Switching to <em>include-fitted</em> mode (n = 394) amplifies every rejection. Trial
					accuracy drops to W = 0.954 (p ≈ 9 × 10⁻¹⁰), the thresholds collapse to W ≈ 0.67, and
					ellipsoid volume falls to W = 0.069 — essentially the entire sample lying on a single
					extreme tail. The fitted participants inject a long right tail into every metric, which
					is exactly what we saw in the split-by-group analysis.
				</p>
				<p class="mt-3">
					Comparing pooled vs. split: accuracy looks marginally non-normal when pooled in exact
					mode but passes comfortably inside each group, which is the expected signature of two
					sub-populations with slightly different means being collapsed into one sample. The
					threshold and volume metrics are non-normal both in aggregate and within each group, so
					the conclusion from the Welch table does not change — rank-based or log-transformed
					follow-ups remain the appropriate sensitivity checks for those two rows.
				</p>
			</div>
		</section>

		<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Study comparison
					</p>
					<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
						Original-study mean equivalence
					</h2>
				</div>
				<p class="max-w-sm text-sm text-slate-500">
					Fixed to include-fitted mode so the comparison always uses the full 394-participant
					sample requested for the original-study check.
				</p>
			</div>

			<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
				The figure compares this study's participant-level ellipsoid-volume mean against the
				original study summary (n = 29,044, mean = 3,670.43, SD = 13,728.03). The lower panel
				shows the TOST 90% confidence interval for the mean difference against a default
				equivalence margin of +/-0.2 times the original-study SD.
			</p>

			<div class="mt-8">
				<StudyMeanEquivalenceFigure comparison={volumeEquivalenceComparison} />
			</div>
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

			{#if distributionComparison}
				<div class="mt-10 border-t border-slate-200/80 pt-8">
					<div class="flex flex-wrap items-end justify-between gap-4">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Distribution comparison
							</p>
							<h3 class="mt-1 font-display text-xl font-semibold text-slate-950">
								Original vs this study
							</h3>
						</div>
						<p class="max-w-md text-sm text-slate-500">
							Descriptives and hypothesis tests contrasting the reconstructed ellipsoid-volume
							distribution above ({distributionComparisonModeLabel}) with the original study's
							published summary.
						</p>
					</div>

					<div class="mt-6">
						<DistributionComparisonFigure
							comparison={distributionComparison}
							modeLabel={distributionComparisonModeLabel}
						/>
					</div>
				</div>
			{/if}
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

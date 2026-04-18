<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { buildColorVisionAnalysis } from '$lib/colorVisionGroupAnalysis';
	import {
		deserializeExpertClause,
		EXPERT_CLAUSE_QUERY_PARAM,
		EXPERT_CLAUSE_STORAGE_KEY,
		getDefaultExpertClause
	} from '$lib/expertClause';
	import type { ExpertClauseGroupNode } from '$lib/expertClause';
	import AxisRecoveryCards from '$lib/components/AxisRecoveryCards.svelte';
	import ChromaticPlaneFigure from '$lib/components/ChromaticPlaneFigure.svelte';
	import EllipseModeToggle from '$lib/components/EllipseModeToggle.svelte';
	import VolumeSimulator from '$lib/components/VolumeSimulator.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const integerFormatter = new Intl.NumberFormat('en-US');
	const oneDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
	const threeDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 3,
		minimumFractionDigits: 3
	});

	let expertClause = $state<ExpertClauseGroupNode>(getDefaultExpertClause());

	const ellipseMode = $derived(
		page.url.searchParams.get('ellipseMode') === 'include-fitted'
			? 'include-fitted'
			: 'exact'
	);
	const currentAnalysis = $derived(
		buildColorVisionAnalysis(data.participantRecordsByMode[ellipseMode], expertClause)
	);
	const exactAnalysis = $derived(
		buildColorVisionAnalysis(data.participantRecordsByMode.exact, expertClause)
	);
	const includeFittedAnalysis = $derived(
		buildColorVisionAnalysis(data.participantRecordsByMode['include-fitted'], expertClause)
	);
	const methods = $derived(data.methodsByMode[ellipseMode]);
	const workedExample = $derived(methods.workedExample);
	const workedInvalidExample = $derived(methods.workedInvalidExample);
	const exactExpertGroup = $derived(exactAnalysis.groups[0]);
	const exactNonExpertGroup = $derived(exactAnalysis.groups[1]);
	const includeFittedExpertGroup = $derived(includeFittedAnalysis.groups[0]);
	const includeFittedNonExpertGroup = $derived(includeFittedAnalysis.groups[1]);

	function getQueryExpertClause(): ExpertClauseGroupNode | null {
		return deserializeExpertClause(page.url.searchParams.get(EXPERT_CLAUSE_QUERY_PARAM));
	}

	onMount(() => {
		const queryClause = getQueryExpertClause();
		if (queryClause) {
			expertClause = queryClause;
			return;
		}

		const storedClause = deserializeExpertClause(
			window.localStorage.getItem(EXPERT_CLAUSE_STORAGE_KEY)
		);
		if (storedClause) {
			expertClause = storedClause;
		}
	});

	$effect(() => {
		const queryClause = getQueryExpertClause();
		if (queryClause) {
			expertClause = queryClause;
		}
	});
</script>

<svelte:head>
	<title>Color perception · Methods</title>
	<meta
		name="description"
		content="Research note describing recovered pink, magenta, blue, and lighter axes, plus ellipsoid-volume reconstruction from the supplementary stimuli."
	/>
</svelte:head>

<div class="min-h-screen pb-16 pt-2">
	<div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8 lg:pt-8">
		<header class="surface-hero relative overflow-hidden rounded-3xl border border-white/60 px-6 py-10 shadow-xl sm:px-10 sm:py-12">
			<div class="hero-glow pointer-events-none absolute inset-0"></div>
			<div class="relative max-w-4xl">
				<p class="text-xs font-semibold uppercase tracking-[0.22em] text-teal-800/90">
					Research note
				</p>
				<h1 class="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
					Recovering the axes and rebuilding the discrimination ellipsoid
				</h1>
				<p class="mt-5 text-lg leading-relaxed text-slate-600">
					The archived experiment code confirms the staircase logic and vector bounds, but it does not
					expose numeric `L*u*v*` coordinates. This page documents how the max-step supplementary PNGs
					are used to recover the pink, magenta, blue, and lighter axes, and how those recovered axes
					feed the ellipsoid volume shown on the comparison page.
				</p>

				<div class="mt-6 max-w-xl">
					<EllipseModeToggle currentMode={ellipseMode} label="Ellipse inclusion" />
				</div>
			</div>
		</header>

		<section class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
			<div class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Archive confirmation</p>
				<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
					What the 2016 archive tells us
				</h2>
				<div class="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
					<p>
						The recovered JS identifies the four staircase bounds as
						<strong class="font-semibold text-slate-950">
							{' '}{methods.archive.vectorBounds.join(', ')}
						</strong>.
						Because each search starts at the upper bound and then moves inward, the practical max
						locations are 166, 134, 174, and 106.
					</p>
					<p>
						The same archive also confirms the threshold rule used in the current replication: once a
						staircase converges, the solution is the minimum location answered correctly for that set.
					</p>
					<p>
						What is missing is the generator-side lookup from vector index to `CIE L*u*v*`
						coordinates. The runtime only swaps PNG filenames such as `stimuli/1-166-0.png`; it never
						ships numeric color-space metadata.
					</p>
				</div>
			</div>

			<div class="rounded-3xl border border-slate-200/90 bg-slate-950 p-6 text-slate-50 shadow-sm sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Dataset impact</p>
				<h2 class="mt-1 font-display text-2xl font-semibold">
					What changed in the app
				</h2>
				<div class="mt-6 grid gap-4 sm:grid-cols-2">
					<div class="rounded-2xl border border-white/10 bg-white/5 p-4">
						<p class="text-sm text-slate-300">Participants in histogram range</p>
						<p class="mt-2 font-mono text-3xl font-semibold">
							{integerFormatter.format(currentAnalysis.histogram.visibleParticipantCount)}
						</p>
					</div>
					<div class="rounded-2xl border border-white/10 bg-white/5 p-4">
						<p class="text-sm text-slate-300">Participants above 12,000</p>
						<p class="mt-2 font-mono text-3xl font-semibold">
							{integerFormatter.format(currentAnalysis.histogram.omittedCount)}
						</p>
					</div>
				</div>
				<p class="mt-5 text-sm leading-relaxed text-slate-300">
					The comparison page now labels the x-axis simply as <strong>Ellipsoid volume</strong>. The
					reconstruction caveat is documented here instead of cluttering the figure, but the underlying
					numbers are recovered from the supplementary stimuli rather than from the original generator.
				</p>
				<p class="mt-3 text-sm leading-relaxed text-slate-300">
					With the active expert clause, exact mode keeps
					<strong> {exactExpertGroup.participantCount}</strong> Expert and
					<strong> {exactNonExpertGroup.participantCount}</strong> Non-Expert participants. Include-fitted
					mode changes that to <strong>{includeFittedExpertGroup.participantCount}</strong> Expert and
					<strong> {includeFittedNonExpertGroup.participantCount}</strong> Non-Expert participants.
				</p>
			</div>
		</section>

		<section class="space-y-5">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Axis recovery</p>
				<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
					Step 1: Recover endpoint colors from the PNGs
				</h2>
				<p class="mt-4 max-w-4xl text-sm leading-relaxed text-slate-600">
					For each vector, the max-step image is treated as a measurement surface. Non-gray pixels in the
					vector-1 endpoint define a ring mask; that same mask is then applied to all four max-step
					images to average ring RGB and background RGB separately. Those average RGB values are converted
					from sRGB/D65 into `L*u*v*`, yielding approximate endpoint coordinates for pink, magenta, blue,
					and lighter.
				</p>
			</div>

			<AxisRecoveryCards axes={methods.axes} />
		</section>

		<section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
			<div class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Geometry</p>
				<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
					Step 2: Place the recovered axes in the chromatic plane
				</h2>
				<div class="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
					<p>
						The recovered chromatic vectors are projected into the `u*–v*` plane. Pink, magenta, and
						blue stay close to constant `L*`, while the lighter vector becomes the ellipsoid’s third
						axis in `L*`.
					</p>
					<p>
						In the endpoint view, the arrows show the recovered max-step radii. In the normalized view,
						the same arrows are re-scaled to highlight direction alone. That directional information is
						what the ellipse fit needs.
					</p>
				</div>
			</div>

			<ChromaticPlaneFigure axes={methods.axes} />
		</section>

		<section class="space-y-5">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ellipsoid fitting</p>
				<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
					Step 3: Convert thresholds into radii and fit the ellipsoid
				</h2>
				<p class="mt-4 max-w-4xl text-sm leading-relaxed text-slate-600">
					Each participant contributes three repetitions per vector. The repetition means become
					vector-level thresholds. Each threshold is scaled against its vector’s recovered max-step
					magnitude, producing three chromatic radii and one lightness radius. A centered quadratic form
					is solved in `u*–v*`, the ellipse semiaxes come from its eigenvalues, and the ellipsoid volume
					follows from `V = 4/3πabc`.
				</p>
			</div>

			<VolumeSimulator workedExample={workedExample} />
		</section>

		<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Fitted fallback</p>
			<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
				When the exact centered ellipse is invalid
			</h2>
			<p class="mt-4 max-w-4xl text-sm leading-relaxed text-slate-600">
				Some participants produce three chromatic radii that do not correspond to a valid exact centered
				ellipse. In exact mode, those participants are excluded. In include-fitted mode, the app keeps the
				lightness radius unchanged and solves for the best centered ellipse that minimizes relative error
				across the pink, magenta, and blue radii.
			</p>

			<div class="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
				<div class="overflow-x-auto rounded-2xl border border-slate-100">
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
								<th class="px-4 py-3">Axis</th>
								<th class="px-4 py-3">Thresholds</th>
								<th class="px-4 py-3">Mean threshold</th>
							</tr>
						</thead>
						<tbody>
							{#each methods.axes as axis}
								<tr class="border-t border-slate-100">
									<td class="px-4 py-3 font-semibold text-slate-900">{axis.name}</td>
									<td class="px-4 py-3 font-mono text-slate-700">
										{workedInvalidExample.thresholdsByVector[axis.vector].join(', ')}
									</td>
									<td class="px-4 py-3 font-mono text-slate-700">
										{oneDecimalFormatter.format(workedInvalidExample.thresholdMeans[axis.vector])}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="space-y-4 rounded-3xl border border-slate-200/90 bg-slate-50/80 p-5">
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Participant ID</p>
						<p class="mt-2 font-mono text-sm text-slate-800">{workedInvalidExample.participantId}</p>
					</div>
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Fit result</p>
						<p class="mt-2 text-sm text-slate-700">
							Exact fit: <span class="font-semibold text-slate-950">invalid</span>
						</p>
						<p class="text-sm text-slate-700">
							Fallback fit kind: <span class="font-semibold text-slate-950">{workedInvalidExample.fitKind}</span>
						</p>
						<p class="text-sm text-slate-700">
							Fit loss: <span class="font-mono">{threeDecimalFormatter.format(workedInvalidExample.fitLoss)}</span>
						</p>
						<p class="text-sm text-slate-700">
							Max relative chromatic radius error:{' '}
							<span class="font-mono">{threeDecimalFormatter.format(workedInvalidExample.maxRelativeRadiusError)}</span>
						</p>
					</div>
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Fallback semiaxes</p>
						<p class="mt-2 text-sm text-slate-700">
							a = {workedInvalidExample.ellipsoidModel.ellipse.major.toFixed(3)}
						</p>
						<p class="text-sm text-slate-700">
							b = {workedInvalidExample.ellipsoidModel.ellipse.minor.toFixed(3)}
						</p>
						<p class="text-sm text-slate-700">
							c = {workedInvalidExample.ellipsoidModel.lightness.toFixed(3)}
						</p>
						<p class="mt-2 text-sm text-slate-700">
							Fitted ellipsoid volume ={' '}
							<span class="font-mono">{workedInvalidExample.ellipsoidVolume.toFixed(3)}</span>
						</p>
					</div>
				</div>
			</div>
		</section>

		<section class="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Worked example</p>
			<h2 class="mt-1 font-display text-2xl font-semibold text-slate-950">
				Step 4: One participant, end to end
			</h2>
			<p class="mt-4 max-w-4xl text-sm leading-relaxed text-slate-600">
				The worked example remains anchored to the first complete participant in the archived reference
				source used during the reconstruction workflow. The proxy volume is retained here only for contrast
				with the reconstructed ellipsoid.
			</p>

			<div class="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
				<div class="overflow-x-auto rounded-2xl border border-slate-100">
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
								<th class="px-4 py-3">Axis</th>
								<th class="px-4 py-3">Thresholds</th>
								<th class="px-4 py-3">Mean threshold</th>
							</tr>
						</thead>
						<tbody>
							{#each methods.axes as axis}
								<tr class="border-t border-slate-100">
									<td class="px-4 py-3 font-semibold text-slate-900">{axis.name}</td>
									<td class="px-4 py-3 font-mono text-slate-700">
										{workedExample.thresholdsByVector[axis.vector].join(', ')}
									</td>
									<td class="px-4 py-3 font-mono text-slate-700">
										{oneDecimalFormatter.format(workedExample.thresholdMeans[axis.vector])}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="space-y-4 rounded-3xl border border-slate-200/90 bg-slate-50/80 p-5">
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Participant ID</p>
						<p class="mt-2 font-mono text-sm text-slate-800">{workedExample.participantId}</p>
					</div>
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Chromatic semiaxes</p>
						<p class="mt-2 text-sm text-slate-700">a = {workedExample.ellipsoidModel.ellipse.major.toFixed(3)}</p>
						<p class="text-sm text-slate-700">b = {workedExample.ellipsoidModel.ellipse.minor.toFixed(3)}</p>
						<p class="text-sm text-slate-700">c = {workedExample.ellipsoidModel.lightness.toFixed(3)}</p>
					</div>
					<div class="rounded-2xl border border-slate-200/80 bg-white p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resulting volumes</p>
						<p class="mt-2 text-sm text-slate-700">
							Ellipsoid volume = <span class="font-mono">{workedExample.ellipsoidVolume.toFixed(3)}</span>
						</p>
						<p class="text-sm text-slate-700">
							Proxy volume = <span class="font-mono">{workedExample.ellipsoidProxyVolume.toFixed(3)}</span>
						</p>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
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
</style>

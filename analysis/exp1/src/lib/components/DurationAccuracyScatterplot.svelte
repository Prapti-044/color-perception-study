<script lang="ts">
	import type { TrialDetails, ExperimentInfo } from '$lib/types';
	import { generateParticipantSummary, groupBy } from '$lib';
	import { formatNumber, formatPercent } from '$lib/utils';
	import Section from './Section.svelte';
	import { renderScatterChart } from '$lib/d3/scatterChart';
	import { downloadSvgElement } from '$lib/svgDownload';

	interface DurationAccuracyPoint {
		participantId: string;
		duration: number;
		accuracy: number;
	}

	interface Props {
		trialDetails: TrialDetails[];
		experimentInfo: Record<string, ExperimentInfo>;
	}

	let { trialDetails, experimentInfo }: Props = $props();

	let chartHost = $state<HTMLDivElement | undefined>();

	const participantsData = $derived.by((): DurationAccuracyPoint[] => {
		if (trialDetails.length === 0) return [];

		const trialsByParticipant = groupBy(trialDetails, (t) => t.participantId);
		const data: DurationAccuracyPoint[] = [];

		for (const [participantId, trials] of trialsByParticipant) {
			const summary = generateParticipantSummary(trials);
			const expInfo = experimentInfo[participantId];
			const duration = expInfo?.duration_minutes ?? null;

			if (duration !== null && duration > 0) {
				data.push({
					participantId,
					duration,
					accuracy: summary.accuracy
				});
			}
		}

		return data;
	});

	const stats = $derived.by(() => {
		const data = participantsData;
		if (data.length === 0) {
			return { avgDuration: 0, avgAccuracy: 0, count: 0 };
		}
		const avgDuration = data.reduce((sum, d) => sum + d.duration, 0) / data.length;
		const avgAccuracy = data.reduce((sum, d) => sum + d.accuracy, 0) / data.length;
		return { avgDuration, avgAccuracy, count: data.length };
	});

	$effect(() => {
		if (!chartHost || participantsData.length === 0) return;

		const pts = participantsData.map((d) => ({
			x: d.duration,
			y: d.accuracy * 100
		}));

		renderScatterChart(
			chartHost,
			{
				title: 'Accuracy vs Duration',
				xLabel: 'Duration (minutes)',
				yLabel: 'Accuracy (%)',
				points: pts,
				formatX: (v) => String(Math.round(v * 10) / 10),
				formatY: (v) => `${Math.round(v)}%`
			},
			{ width: 720, height: 440 }
		);
	});

	function downloadSvg() {
		const svg = chartHost?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'duration-vs-accuracy.svg');
	}
</script>

<Section title="Duration vs Accuracy Scatterplot">
	<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<p class="text-sm text-blue-800">
			<strong>Description:</strong> This scatterplot shows the relationship between experiment duration (in minutes) and participant accuracy (as a percentage).
			Each point represents one participant.
		</p>
		<p class="mt-2 text-sm text-blue-700">
			<strong>Participants included:</strong> {stats.count} (only participants with valid duration data)
		</p>
	</div>

	{#if stats.count > 0}
		<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
			<div class="mb-2 flex justify-end">
				<button
					type="button"
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
					onclick={downloadSvg}>Download SVG</button
				>
			</div>
			<div class="h-[500px]">
				<div bind:this={chartHost} class="h-full w-full"></div>
			</div>
		</div>

		<div class="mt-6 grid gap-4 md:grid-cols-3">
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h4 class="mb-2 text-sm font-semibold text-slate-700">Average Duration</h4>
				<p class="text-2xl font-bold text-slate-800">
					{formatNumber(stats.avgDuration, 1)} min
				</p>
			</div>
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h4 class="mb-2 text-sm font-semibold text-slate-700">Average Accuracy</h4>
				<p class="text-2xl font-bold text-slate-800">
					{formatPercent(stats.avgAccuracy)}
				</p>
			</div>
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<h4 class="mb-2 text-sm font-semibold text-slate-700">Participants</h4>
				<p class="text-2xl font-bold text-slate-800">
					{stats.count}
				</p>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
			<p class="text-yellow-800">
				No data available. Please ensure participants have valid duration information.
			</p>
		</div>
	{/if}
</Section>

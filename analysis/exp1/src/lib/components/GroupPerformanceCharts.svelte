<script lang="ts">
	import type { TrialDetails } from '$lib/types';
	import { formatNumber, formatPercent } from '$lib/utils';
	import { renderGroupedBarChart } from '$lib/d3/groupedBarChart';
	import { downloadSvgElement } from '$lib/svgDownload';

	interface Props {
		group1Trials: TrialDetails[];
		group2Trials: TrialDetails[];
		group1Label: string;
		group2Label: string;
		group1Color: string;
		group2Color: string;
		title?: string;
	}

	let {
		group1Trials,
		group2Trials,
		group1Label,
		group2Label,
		group1Color,
		group2Color,
		title = 'Performance Breakdown'
	}: Props = $props();

	let accuracyHost = $state<HTMLDivElement | undefined>();
	let rtHost = $state<HTMLDivElement | undefined>();
	let axisHost = $state<HTMLDivElement | undefined>();

	function computeMetrics(trials: TrialDetails[]) {
		const standardTrials = trials.filter(
			(t) => t.trial_type === 'standard' && !t.excluded && t.diff_type === 'small'
		);
		const answeredTrials = standardTrials.filter((t) => t.answer !== null);

		const correctTrials = answeredTrials.filter((t) => t.is_correct);
		const accuracy = answeredTrials.length > 0 ? correctTrials.length / answeredTrials.length : 0;

		const rts = answeredTrials.filter((t) => t.rt_ms !== null && t.rt_ms > 0).map((t) => t.rt_ms!);
		const meanRT = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
		const medianRT = rts.length > 0 ? rts.sort((a, b) => a - b)[Math.floor(rts.length / 2)] : 0;

		const axisAccuracy: Record<string, { correct: number; total: number }> = {
			L: { correct: 0, total: 0 },
			a: { correct: 0, total: 0 },
			b: { correct: 0, total: 0 }
		};
		for (const t of answeredTrials) {
			if (t.axis && axisAccuracy[t.axis]) {
				axisAccuracy[t.axis].total++;
				if (t.is_correct) axisAccuracy[t.axis].correct++;
			}
		}

		const correctRTs = answeredTrials
			.filter((t) => t.is_correct && t.rt_ms && t.rt_ms > 0)
			.map((t) => t.rt_ms!);
		const incorrectRTs = answeredTrials
			.filter((t) => !t.is_correct && t.rt_ms && t.rt_ms > 0)
			.map((t) => t.rt_ms!);
		const correctMeanRT =
			correctRTs.length > 0 ? correctRTs.reduce((a, b) => a + b, 0) / correctRTs.length : 0;
		const incorrectMeanRT =
			incorrectRTs.length > 0 ? incorrectRTs.reduce((a, b) => a + b, 0) / incorrectRTs.length : 0;

		const participants = new Set(trials.map((t) => t.participantId));

		return {
			nTrials: answeredTrials.length,
			nParticipants: participants.size,
			accuracy,
			meanRT,
			medianRT,
			axisAccuracy,
			correctMeanRT,
			incorrectMeanRT
		};
	}

	const group1Metrics = $derived(computeMetrics(group1Trials));
	const group2Metrics = $derived(computeMetrics(group2Trials));

	const groupPair: [string, string] = $derived([group1Label, group2Label]);
	const colorPair: [string, string] = $derived([group1Color, group2Color]);

	$effect(() => {
		if (!accuracyHost) return;
		const _ = [group1Metrics, group2Metrics, group1Label, group2Label, group1Color, group2Color];
		renderGroupedBarChart(accuracyHost, {
			title: 'Overall Accuracy',
			yLabel: 'Accuracy (%)',
			categories: ['Overall Accuracy'],
			groupLabels: groupPair,
			groupColors: colorPair,
			values: [
				{
					group1: group1Metrics.accuracy * 100,
					group2: group2Metrics.accuracy * 100
				}
			],
			yMax: 100,
			formatY: (v) => `${Math.round(v)}%`
		});
	});

	$effect(() => {
		if (!rtHost) return;
		const _ = [group1Metrics, group2Metrics, group1Label, group2Label, group1Color, group2Color];
		renderGroupedBarChart(rtHost, {
			title: 'Response Time',
			yLabel: 'Time (ms)',
			categories: ['Mean RT', 'Median RT', 'RT (Correct)', 'RT (Incorrect)'],
			groupLabels: groupPair,
			groupColors: colorPair,
			values: [
				{ group1: group1Metrics.meanRT, group2: group2Metrics.meanRT },
				{ group1: group1Metrics.medianRT, group2: group2Metrics.medianRT },
				{ group1: group1Metrics.correctMeanRT, group2: group2Metrics.correctMeanRT },
				{ group1: group1Metrics.incorrectMeanRT, group2: group2Metrics.incorrectMeanRT }
			],
			formatY: (v) => String(Math.round(v))
		});
	});

	$effect(() => {
		if (!axisHost) return;
		const axes = ['L', 'a', 'b'] as const;
		const _ = [group1Metrics, group2Metrics, group1Label, group2Label, group1Color, group2Color];
		renderGroupedBarChart(axisHost, {
			title: 'Accuracy by Color Axis',
			yLabel: 'Accuracy (%)',
			categories: axes.map((a) => `${a}-axis`),
			groupLabels: groupPair,
			groupColors: colorPair,
			values: axes.map((a) => {
				const d1 = group1Metrics.axisAccuracy[a];
				const d2 = group2Metrics.axisAccuracy[a];
				return {
					group1: d1.total > 0 ? (d1.correct / d1.total) * 100 : 0,
					group2: d2.total > 0 ? (d2.correct / d2.total) * 100 : 0
				};
			}),
			yMax: 100,
			formatY: (v) => `${Math.round(v)}%`
		});
	});

	function downloadAccuracy() {
		const svg = accuracyHost?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'group-performance-accuracy.svg');
	}
	function downloadRt() {
		const svg = rtHost?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'group-performance-response-time.svg');
	}
	function downloadAxis() {
		const svg = axisHost?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'group-performance-accuracy-by-axis.svg');
	}
</script>

<div class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6">
	<h3 class="mb-4 text-lg font-semibold text-slate-800">{title}</h3>

	<div class="mb-6 overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr>
					<th
						class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
						>Metric</th
					>
					<th
						class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold"
						style="color: {group1Color}">{group1Label}</th
					>
					<th
						class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold"
						style="color: {group2Color}">{group2Label}</th
					>
					<th
						class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700"
						>Difference</th
					>
				</tr>
			</thead>
			<tbody>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Participants</td>
					<td class="px-3 py-2 text-center text-slate-700">{group1Metrics.nParticipants}</td>
					<td class="px-3 py-2 text-center text-slate-700">{group2Metrics.nParticipants}</td>
					<td class="px-3 py-2 text-center text-slate-500">-</td>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Trials</td>
					<td class="px-3 py-2 text-center text-slate-700">{group1Metrics.nTrials}</td>
					<td class="px-3 py-2 text-center text-slate-700">{group2Metrics.nTrials}</td>
					<td class="px-3 py-2 text-center text-slate-500">-</td>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 font-semibold text-slate-600">Accuracy</td>
					<td class="px-3 py-2 text-center font-semibold" style="color: {group1Color}"
						>{formatPercent(group1Metrics.accuracy)}</td
					>
					<td class="px-3 py-2 text-center font-semibold" style="color: {group2Color}"
						>{formatPercent(group2Metrics.accuracy)}</td
					>
					<td class="px-3 py-2 text-center text-slate-700"
						>{formatNumber((group1Metrics.accuracy - group2Metrics.accuracy) * 100, 1, true)}%</td
					>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Mean RT</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.meanRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group2Metrics.meanRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700"
						>{formatNumber(group1Metrics.meanRT - group2Metrics.meanRT, 0, true)} ms</td
					>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Median RT</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.medianRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group2Metrics.medianRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700"
						>{formatNumber(group1Metrics.medianRT - group2Metrics.medianRT, 0, true)} ms</td
					>
				</tr>
			</tbody>
		</table>
	</div>

	<div class="grid gap-6 md:grid-cols-3">
		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="mb-2 flex justify-end">
				<button
					type="button"
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
					onclick={downloadAccuracy}>Download SVG</button
				>
			</div>
			<div class="chart-host h-[250px]">
				<div bind:this={accuracyHost} class="h-full w-full"></div>
			</div>
		</div>

		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="mb-2 flex justify-end">
				<button
					type="button"
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
					onclick={downloadRt}>Download SVG</button
				>
			</div>
			<div class="chart-host h-[250px]">
				<div bind:this={rtHost} class="h-full w-full"></div>
			</div>
		</div>

		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="mb-2 flex justify-end">
				<button
					type="button"
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
					onclick={downloadAxis}>Download SVG</button
				>
			</div>
			<div class="chart-host h-[250px]">
				<div bind:this={axisHost} class="h-full w-full"></div>
			</div>
		</div>
	</div>

	<div class="mt-6">
		<h4 class="mb-3 text-sm font-semibold text-slate-700">Accuracy by Color Axis (Detailed)</h4>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>Axis</th
						>
						<th
							class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold"
							style="color: {group1Color}">{group1Label}</th
						>
						<th
							class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold"
							style="color: {group2Color}">{group2Label}</th
						>
					</tr>
				</thead>
				<tbody>
					{#each ['L', 'a', 'b'] as axis}
						{@const g1 = group1Metrics.axisAccuracy[axis]}
						{@const g2 = group2Metrics.axisAccuracy[axis]}
						<tr class="border-b border-slate-100">
							<td class="px-3 py-2 text-slate-600">{axis}-axis</td>
							<td class="px-3 py-2 text-center text-slate-700">
								{g1.total > 0 ? formatPercent(g1.correct / g1.total) : 'N/A'} ({g1.correct}/{g1.total})
							</td>
							<td class="px-3 py-2 text-center text-slate-700">
								{g2.total > 0 ? formatPercent(g2.correct / g2.total) : 'N/A'} ({g2.correct}/{g2.total})
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style>
	.chart-host {
		min-height: 220px;
	}
</style>

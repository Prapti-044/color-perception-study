<script lang="ts">
	import { onMount } from 'svelte';
	import type { TrialDetails } from '$lib/types';
	import { formatNumber, formatPercent } from '$lib/utils';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';

	// Register Chart.js components
	Chart.register(
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Title,
		Tooltip,
		Legend
	);

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

	let accuracyCanvas: HTMLCanvasElement;
	let rtCanvas: HTMLCanvasElement;
	let axisAccuracyCanvas: HTMLCanvasElement;

	let accuracyChart: Chart | null = null;
	let rtChart: Chart | null = null;
	let axisAccuracyChart: Chart | null = null;

	// Compute metrics for a group
	// Note: Only uses standard trials with diff_type === 'small' (the actual experimental trials)
	// Large diff and no diff trials are only used for participant exclusion, not analysis
	function computeMetrics(trials: TrialDetails[]) {
		// Filter to standard trials with small color differences (the actual experimental trials)
		const standardTrials = trials.filter(t => 
			t.trial_type === 'standard' && 
			!t.excluded && 
			t.diff_type === 'small'
		);
		const answeredTrials = standardTrials.filter(t => t.answer !== null);
		
		// Overall accuracy
		const correctTrials = answeredTrials.filter(t => t.is_correct);
		const accuracy = answeredTrials.length > 0 ? correctTrials.length / answeredTrials.length : 0;
		
		// Overall RT (only for answered trials)
		const rts = answeredTrials.filter(t => t.rt_ms !== null && t.rt_ms > 0).map(t => t.rt_ms!);
		const meanRT = rts.length > 0 ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
		const medianRT = rts.length > 0 ? rts.sort((a, b) => a - b)[Math.floor(rts.length / 2)] : 0;
		
		// Accuracy by axis
		const axisAccuracy: Record<string, { correct: number; total: number }> = { L: { correct: 0, total: 0 }, a: { correct: 0, total: 0 }, b: { correct: 0, total: 0 } };
		for (const t of answeredTrials) {
			if (t.axis && axisAccuracy[t.axis]) {
				axisAccuracy[t.axis].total++;
				if (t.is_correct) axisAccuracy[t.axis].correct++;
			}
		}
		
		// RT by trial correctness
		const correctRTs = answeredTrials.filter(t => t.is_correct && t.rt_ms && t.rt_ms > 0).map(t => t.rt_ms!);
		const incorrectRTs = answeredTrials.filter(t => !t.is_correct && t.rt_ms && t.rt_ms > 0).map(t => t.rt_ms!);
		const correctMeanRT = correctRTs.length > 0 ? correctRTs.reduce((a, b) => a + b, 0) / correctRTs.length : 0;
		const incorrectMeanRT = incorrectRTs.length > 0 ? incorrectRTs.reduce((a, b) => a + b, 0) / incorrectRTs.length : 0;
		
		// Unique participants
		const participants = new Set(trials.map(t => t.participantId));
		
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

	function buildCharts() {
		// Accuracy comparison chart
		if (accuracyCanvas && !accuracyChart) {
			accuracyChart = new Chart(accuracyCanvas, {
				type: 'bar',
				data: {
					labels: ['Overall Accuracy'],
					datasets: [
						{
							label: group1Label,
							data: [group1Metrics.accuracy * 100],
							backgroundColor: group1Color,
							borderColor: group1Color,
							borderWidth: 1
						},
						{
							label: group2Label,
							data: [group2Metrics.accuracy * 100],
							backgroundColor: group2Color,
							borderColor: group2Color,
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Overall Accuracy' }
					},
					scales: {
						y: {
							beginAtZero: true,
							max: 100,
							title: { display: true, text: 'Accuracy (%)' }
						}
					}
				}
			});
		}

		// RT comparison chart
		if (rtCanvas && !rtChart) {
			rtChart = new Chart(rtCanvas, {
				type: 'bar',
				data: {
					labels: ['Mean RT', 'Median RT', 'RT (Correct)', 'RT (Incorrect)'],
					datasets: [
						{
							label: group1Label,
							data: [
								group1Metrics.meanRT,
								group1Metrics.medianRT,
								group1Metrics.correctMeanRT,
								group1Metrics.incorrectMeanRT
							],
							backgroundColor: group1Color,
							borderColor: group1Color,
							borderWidth: 1
						},
						{
							label: group2Label,
							data: [
								group2Metrics.meanRT,
								group2Metrics.medianRT,
								group2Metrics.correctMeanRT,
								group2Metrics.incorrectMeanRT
							],
							backgroundColor: group2Color,
							borderColor: group2Color,
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Response Time' }
					},
					scales: {
						y: {
							beginAtZero: true,
							title: { display: true, text: 'Time (ms)' }
						}
					}
				}
			});
		}

		// Accuracy by axis chart
		if (axisAccuracyCanvas && !axisAccuracyChart) {
			const axes = ['L', 'a', 'b'];
			axisAccuracyChart = new Chart(axisAccuracyCanvas, {
				type: 'bar',
				data: {
					labels: axes.map(a => `${a}-axis`),
					datasets: [
						{
							label: group1Label,
							data: axes.map(a => {
								const d = group1Metrics.axisAccuracy[a];
								return d.total > 0 ? (d.correct / d.total) * 100 : 0;
							}),
							backgroundColor: group1Color,
							borderColor: group1Color,
							borderWidth: 1
						},
						{
							label: group2Label,
							data: axes.map(a => {
								const d = group2Metrics.axisAccuracy[a];
								return d.total > 0 ? (d.correct / d.total) * 100 : 0;
							}),
							backgroundColor: group2Color,
							borderColor: group2Color,
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Accuracy by Color Axis' }
					},
					scales: {
						y: {
							beginAtZero: true,
							max: 100,
							title: { display: true, text: 'Accuracy (%)' }
						}
					}
				}
			});
		}
	}

	function destroyCharts() {
		if (accuracyChart) { accuracyChart.destroy(); accuracyChart = null; }
		if (rtChart) { rtChart.destroy(); rtChart = null; }
		if (axisAccuracyChart) { axisAccuracyChart.destroy(); axisAccuracyChart = null; }
	}

	onMount(() => {
		buildCharts();
		return destroyCharts;
	});

	// Rebuild charts when data changes
	$effect(() => {
		const _ = [group1Trials, group2Trials, group1Label, group2Label];
		destroyCharts();
		// Use setTimeout to ensure canvas elements are ready
		setTimeout(() => buildCharts(), 0);
	});
</script>

<div class="mt-6 rounded-lg bg-slate-50 p-6 border border-slate-200">
	<h3 class="mb-4 text-lg font-semibold text-slate-800">{title}</h3>
	
	<!-- Summary Stats Table -->
	<div class="mb-6 overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr>
					<th class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">Metric</th>
					<th class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold" style="color: {group1Color}">{group1Label}</th>
					<th class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold" style="color: {group2Color}">{group2Label}</th>
					<th class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700">Difference</th>
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
					<td class="px-3 py-2 text-slate-600 font-semibold">Accuracy</td>
					<td class="px-3 py-2 text-center font-semibold" style="color: {group1Color}">{formatPercent(group1Metrics.accuracy)}</td>
					<td class="px-3 py-2 text-center font-semibold" style="color: {group2Color}">{formatPercent(group2Metrics.accuracy)}</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber((group1Metrics.accuracy - group2Metrics.accuracy) * 100, 1, true)}%</td>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Mean RT</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.meanRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group2Metrics.meanRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.meanRT - group2Metrics.meanRT, 0, true)} ms</td>
				</tr>
				<tr class="border-b border-slate-100">
					<td class="px-3 py-2 text-slate-600">Median RT</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.medianRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group2Metrics.medianRT, 0)} ms</td>
					<td class="px-3 py-2 text-center text-slate-700">{formatNumber(group1Metrics.medianRT - group2Metrics.medianRT, 0, true)} ms</td>
				</tr>
			</tbody>
		</table>
	</div>
	
	<!-- Charts Grid -->
	<div class="grid gap-6 md:grid-cols-3">
		<!-- Overall Accuracy -->
		<div class="rounded-lg bg-white p-4 border border-slate-200">
			<div class="h-[250px]">
				<canvas bind:this={accuracyCanvas}></canvas>
			</div>
		</div>
		
		<!-- Response Time -->
		<div class="rounded-lg bg-white p-4 border border-slate-200">
			<div class="h-[250px]">
				<canvas bind:this={rtCanvas}></canvas>
			</div>
		</div>
		
		<!-- Accuracy by Axis -->
		<div class="rounded-lg bg-white p-4 border border-slate-200">
			<div class="h-[250px]">
				<canvas bind:this={axisAccuracyCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Detailed breakdown table -->
	<div class="mt-6">
		<h4 class="mb-3 text-sm font-semibold text-slate-700">Accuracy by Color Axis (Detailed)</h4>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
						<th class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold" style="color: {group1Color}">{group1Label}</th>
						<th class="border-b border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold" style="color: {group2Color}">{group2Label}</th>
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

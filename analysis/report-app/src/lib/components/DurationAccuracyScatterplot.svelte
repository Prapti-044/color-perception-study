<script lang="ts">
	import { onMount } from 'svelte';
	import type { TrialDetails, ExperimentInfo } from '$lib/types';
	import { generateParticipantSummary, groupBy } from '$lib';
	import { formatNumber, formatPercent } from '$lib/utils';
	import Section from './Section.svelte';
	import {
		Chart,
		ScatterController,
		PointElement,
		LinearScale,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';

	// Register Chart.js components
	Chart.register(
		ScatterController,
		PointElement,
		LinearScale,
		Title,
		Tooltip,
		Legend
	);

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

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;
	
	// Compute data once - not reactive to avoid infinite loops
	let participantsData: DurationAccuracyPoint[] = $state([]);
	let stats = $state({ avgDuration: 0, avgAccuracy: 0, count: 0 });

	function computeParticipantsData() {
		if (trialDetails.length === 0) {
			participantsData = [];
			stats = { avgDuration: 0, avgAccuracy: 0, count: 0 };
			return;
		}
		
		const trialsByParticipant = groupBy(trialDetails, (t) => t.participantId);
		const data: DurationAccuracyPoint[] = [];

		for (const [participantId, trials] of trialsByParticipant) {
			const summary = generateParticipantSummary(trials);
			const expInfo = experimentInfo[participantId];
			const duration = expInfo?.duration_minutes ?? null;

			// Only include participants with valid duration data
			if (duration !== null && duration > 0) {
				data.push({
					participantId,
					duration,
					accuracy: summary.accuracy
				});
			}
		}

		participantsData = data;
		
		if (data.length > 0) {
			const avgDuration = data.reduce((sum, d) => sum + d.duration, 0) / data.length;
			const avgAccuracy = data.reduce((sum, d) => sum + d.accuracy, 0) / data.length;
			stats = { avgDuration, avgAccuracy, count: data.length };
		} else {
			stats = { avgDuration: 0, avgAccuracy: 0, count: 0 };
		}
	}

	// Build the chart
	function buildChart() {
		if (!chartCanvas || chart || participantsData.length === 0) return;

		const scatterData = participantsData.map((d) => ({
			x: d.duration,
			y: d.accuracy * 100, // Convert to percentage
			participantId: d.participantId
		}));

		// Calculate min/max for axes
		const durations = scatterData.map((d) => d.x);
		const accuracies = scatterData.map((d) => d.y);
		const minDuration = Math.min(...durations) * 0.95;
		const maxDuration = Math.max(...durations) * 1.05;
		const minAccuracy = Math.max(0, Math.min(...accuracies) * 0.95);
		const maxAccuracy = Math.min(100, Math.max(...accuracies) * 1.05);

		chart = new Chart(chartCanvas, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Participants',
						data: scatterData,
						backgroundColor: 'rgba(59, 130, 246, 0.6)',
						borderColor: 'rgba(59, 130, 246, 0.8)',
						pointRadius: 6,
						pointHoverRadius: 8,
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'point',
					intersect: false
				},
				plugins: {
					legend: {
						display: false
					},
					title: {
						display: true,
						text: 'Accuracy vs Duration',
						font: {
							size: 18,
							weight: 'bold'
						},
						padding: { bottom: 20 }
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const point = context.raw as any;
								const participantData = participantsData.find((d) => d.participantId === point.participantId);
								return [
									`Participant: ${participantData?.participantId.slice(0, 8)}...`,
									`Duration: ${formatNumber(point.x, 1)} minutes`,
									`Accuracy: ${formatPercent(point.y / 100)}`
								];
							}
						}
					}
				},
				scales: {
					x: {
						type: 'linear',
						title: {
							display: true,
							text: 'Duration (minutes)',
							font: { size: 14 }
						},
						min: minDuration,
						max: maxDuration,
						ticks: {
							stepSize: 5
						}
					},
					y: {
						type: 'linear',
						title: {
							display: true,
							text: 'Accuracy (%)',
							font: { size: 14 }
						},
						min: minAccuracy,
						max: maxAccuracy,
						ticks: {
							callback: function(value) {
								return value + '%';
							}
						}
					}
				}
			}
		});
	}

	onMount(() => {
		// Compute data once when component mounts
		computeParticipantsData();
		
		// Build chart after a brief delay to ensure canvas is ready
		setTimeout(() => {
			if (chartCanvas && participantsData.length > 0) {
				buildChart();
			}
		}, 50);
		
		return () => {
			if (chart) {
				chart.destroy();
				chart = null;
			}
		};
	});
</script>

<Section title="Duration vs Accuracy Scatterplot">
	<div class="mb-4 rounded-lg bg-blue-50 p-4 border border-blue-200">
		<p class="text-sm text-blue-800">
			<strong>Description:</strong> This scatterplot shows the relationship between experiment duration (in minutes) and participant accuracy (as a percentage). 
			Each point represents one participant.
		</p>
		<p class="text-sm text-blue-700 mt-2">
			<strong>Participants included:</strong> {stats.count} (only participants with valid duration data)
		</p>
	</div>

	{#if stats.count > 0}
		<div class="rounded-lg bg-white p-6 shadow-sm border border-slate-200">
			<div class="h-[500px]">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
		</div>

		<!-- Statistics Summary -->
		<div class="mt-6 grid gap-4 md:grid-cols-3">
			<div class="rounded-lg bg-slate-50 p-4 border border-slate-200">
				<h4 class="text-sm font-semibold text-slate-700 mb-2">Average Duration</h4>
				<p class="text-2xl font-bold text-slate-800">
					{formatNumber(stats.avgDuration, 1)} min
				</p>
			</div>
			<div class="rounded-lg bg-slate-50 p-4 border border-slate-200">
				<h4 class="text-sm font-semibold text-slate-700 mb-2">Average Accuracy</h4>
				<p class="text-2xl font-bold text-slate-800">
					{formatPercent(stats.avgAccuracy)}
				</p>
			</div>
			<div class="rounded-lg bg-slate-50 p-4 border border-slate-200">
				<h4 class="text-sm font-semibold text-slate-700 mb-2">Participants</h4>
				<p class="text-2xl font-bold text-slate-800">
					{stats.count}
				</p>
			</div>
		</div>
	{:else}
		<div class="rounded-lg bg-yellow-50 p-6 border border-yellow-200">
			<p class="text-yellow-800">
				No data available. Please ensure participants have valid duration information.
			</p>
		</div>
	{/if}
</Section>

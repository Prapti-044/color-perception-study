<script lang="ts">
	import { onMount } from 'svelte';
	import type { RegressionRow, NDLinearFitRow, Demographics } from '$lib/types';
	import { formatNumber, getParticipantsByExpertise } from '$lib/utils';
	import Section from './Section.svelte';
	import katex from 'katex';
	import 'katex/dist/katex.min.css';
	import {
		Chart,
		LineController,
		PointElement,
		LineElement,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		Filler
	} from 'chart.js';

	// Register Chart.js components
	Chart.register(
		LineController,
		PointElement,
		LineElement,
		LinearScale,
		Title,
		Tooltip,
		Legend,
		Filler
	);

	interface Props {
		regressionColorExpert: RegressionRow[];
		regressionNonExpert: RegressionRow[];
		ndLinearFitColorExpert: NDLinearFitRow[];
		ndLinearFitNonExpert: NDLinearFitRow[];
		demographics: Demographics[];
	}

	let {
		regressionColorExpert,
		regressionNonExpert,
		ndLinearFitColorExpert,
		ndLinearFitNonExpert,
		demographics
	}: Props = $props();

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	// Count participants in each group
	const participantGroups = $derived(getParticipantsByExpertise(demographics));
	const nColorExpert = $derived(participantGroups.colorExpert.size);
	const nNonExpert = $derived(participantGroups.nonExpert.size);

	// Axis colors - solid for color expert, muted/dashed for non-expert
	const axisColors: Record<string, { expert: string; expertLight: string; nonExpert: string; nonExpertLight: string }> = {
		L: { 
			expert: 'rgb(59, 130, 246)',      // Blue
			expertLight: 'rgba(59, 130, 246, 0.15)',
			nonExpert: 'rgb(147, 197, 253)',  // Light blue
			nonExpertLight: 'rgba(147, 197, 253, 0.15)'
		},
		a: { 
			expert: 'rgb(34, 197, 94)',       // Green
			expertLight: 'rgba(34, 197, 94, 0.15)',
			nonExpert: 'rgb(134, 239, 172)',  // Light green
			nonExpertLight: 'rgba(134, 239, 172, 0.15)'
		},
		b: { 
			expert: 'rgb(168, 85, 247)',      // Purple
			expertLight: 'rgba(168, 85, 247, 0.15)',
			nonExpert: 'rgb(216, 180, 254)',  // Light purple
			nonExpertLight: 'rgba(216, 180, 254, 0.15)'
		}
	};

	// Custom axis order
	const axisOrder = ['L', 'a', 'b'];

	// Sorted data for tables
	const sortedNDLinearFitExpert = $derived(
		axisOrder
			.filter((axis) => ndLinearFitColorExpert.some((r) => r.axis === axis))
			.map((axis) => ndLinearFitColorExpert.find((r) => r.axis === axis)!)
	);

	const sortedNDLinearFitNonExpert = $derived(
		axisOrder
			.filter((axis) => ndLinearFitNonExpert.some((r) => r.axis === axis))
			.map((axis) => ndLinearFitNonExpert.find((r) => r.axis === axis)!)
	);

	const sortedRegressionExpert = $derived(() => {
		const result: Record<string, RegressionRow[]> = {};
		for (const axis of axisOrder) {
			const axisData = regressionColorExpert
				.filter((r) => r.axis === axis)
				.sort((a, b) => a.size_deg - b.size_deg);
			if (axisData.length > 0) {
				result[axis] = axisData;
			}
		}
		return result;
	});

	const sortedRegressionNonExpert = $derived(() => {
		const result: Record<string, RegressionRow[]> = {};
		for (const axis of axisOrder) {
			const axisData = regressionNonExpert
				.filter((r) => r.axis === axis)
				.sort((a, b) => a.size_deg - b.size_deg);
			if (axisData.length > 0) {
				result[axis] = axisData;
			}
		}
		return result;
	});

	// Generate smooth curve points for the linear approximation model
	function generateLinearModelCurve(
		A: number,
		B: number,
		minSize: number,
		maxSize: number,
		numPoints: number = 100
	): { x: number; y: number }[] {
		const points: { x: number; y: number }[] = [];
		const step = (maxSize - minSize) / (numPoints - 1);

		for (let i = 0; i < numPoints; i++) {
			const s = minSize + i * step;
			// ND(50%, s) = A + B/s
			const nd = A + B / s;
			points.push({ x: s, y: nd });
		}

		return points;
	}

	// Render KaTeX equation
	function renderLatex(latex: string, displayMode: boolean = false): string {
		try {
			return katex.renderToString(latex, {
				throwOnError: false,
				displayMode
			});
		} catch {
			return latex;
		}
	}

	// Build the chart
	function buildChart() {
		if (!chartCanvas || chart) return;

		const regByAxisExpert = sortedRegressionExpert();
		const regByAxisNonExpert = sortedRegressionNonExpert();
		
		const allSizes = [
			...regressionColorExpert.map((r) => r.size_deg),
			...regressionNonExpert.map((r) => r.size_deg)
		];
		const minSize = Math.min(...allSizes) * 0.9;
		const maxSize = Math.max(...allSizes) * 1.1;

		const datasets: any[] = [];

		// For each axis, add curves and data points for both groups
		for (const axis of axisOrder) {
			const linModelExpert = ndLinearFitColorExpert.find((m) => m.axis === axis);
			const linModelNonExpert = ndLinearFitNonExpert.find((m) => m.axis === axis);
			const axisDataExpert = regByAxisExpert[axis];
			const axisDataNonExpert = regByAxisNonExpert[axis];

			const colors = axisColors[axis];

			// Color Expert: Linear approximation model curve (solid line)
			if (linModelExpert && axisDataExpert) {
				const expertCurvePoints = generateLinearModelCurve(linModelExpert.A, linModelExpert.B, minSize, maxSize);

				datasets.push({
					label: `${axis}-axis (Expert): ND = ${formatNumber(linModelExpert.A, 2)} + ${formatNumber(linModelExpert.B, 2)}/s`,
					data: expertCurvePoints,
					borderColor: colors.expert,
					backgroundColor: 'transparent',
					borderWidth: 2.5,
					pointRadius: 0,
					tension: 0,
					parsing: {
						xAxisKey: 'x',
						yAxisKey: 'y'
					}
				});

				// Color Expert: Data points with error bars
				datasets.push({
					label: `${axis}-axis data (expert)`,
					data: axisDataExpert.map((r) => ({
						x: r.size_deg,
						y: r.ND50,
						yMin: r.ND50 - r.ND50_se,
						yMax: r.ND50 + r.ND50_se
					})),
					borderColor: colors.expert,
					backgroundColor: colors.expert,
					pointRadius: 6,
					pointStyle: 'circle',
					showLine: false,
					parsing: {
						xAxisKey: 'x',
						yAxisKey: 'y'
					}
				});
			}

			// Non-Expert: Linear approximation model curve (dashed line)
			if (linModelNonExpert && axisDataNonExpert) {
				const nonExpertCurvePoints = generateLinearModelCurve(linModelNonExpert.A, linModelNonExpert.B, minSize, maxSize);

				datasets.push({
					label: `${axis}-axis (Non-Expert): ND = ${formatNumber(linModelNonExpert.A, 2)} + ${formatNumber(linModelNonExpert.B, 2)}/s`,
					data: nonExpertCurvePoints,
					borderColor: colors.nonExpert,
					backgroundColor: 'transparent',
					borderWidth: 2.5,
					borderDash: [8, 4],
					pointRadius: 0,
					tension: 0,
					parsing: {
						xAxisKey: 'x',
						yAxisKey: 'y'
					}
				});

				// Non-Expert: Data points (hollow squares)
				datasets.push({
					label: `${axis}-axis data (non-expert)`,
					data: axisDataNonExpert.map((r) => ({
						x: r.size_deg,
						y: r.ND50,
						yMin: r.ND50 - r.ND50_se,
						yMax: r.ND50 + r.ND50_se
					})),
					borderColor: colors.nonExpert,
					backgroundColor: 'transparent',
					pointRadius: 5,
					pointStyle: 'rectRot',
					borderWidth: 2,
					showLine: false,
					parsing: {
						xAxisKey: 'x',
						yAxisKey: 'y'
					}
				});
			}
		}

		chart = new Chart(chartCanvas, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'nearest',
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 15,
							font: { size: 11 },
							filter: (item) => !item.text.includes('data')
						}
					},
					title: {
						display: true,
						text: '50% JND by Color Expertise Group',
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
								const datasetLabel = context.dataset.label || '';
								const group = datasetLabel.includes('Expert') ? 
									(datasetLabel.includes('Non-Expert') ? ' (Non-Expert)' : ' (Expert)') : '';
								if (point.yMin !== undefined) {
									return `ND(50%) = ${formatNumber(point.y, 2)} ± ${formatNumber(point.y - point.yMin, 2)} ΔE${group}`;
								}
								return `ND(50%) = ${formatNumber(point.y, 2)} ΔE${group}`;
							}
						}
					}
				},
				scales: {
					x: {
						type: 'linear',
						title: {
							display: true,
							text: 'Point Diameter (Visual Angle °)',
							font: { size: 14 }
						},
						min: 0,
						max: maxSize,
						ticks: {
							stepSize: 0.5
						}
					},
					y: {
						type: 'linear',
						title: {
							display: true,
							text: 'ND(50%, s) in ΔE',
							font: { size: 14 }
						},
						min: 0,
						ticks: {
							stepSize: 5
						}
					}
				}
			},
			plugins: [
				{
					id: 'errorBars',
					afterDatasetsDraw(chart) {
						const ctx = chart.ctx;
						chart.data.datasets.forEach((dataset, i) => {
							if (!dataset.label?.includes('data')) return;

							const meta = chart.getDatasetMeta(i);
							meta.data.forEach((element, index) => {
								const dataPoint = (dataset.data as any[])[index];
								if (!dataPoint || dataPoint.yMin === undefined) return;

								const x = element.x;
								const yMin = chart.scales.y.getPixelForValue(dataPoint.yMin);
								const yMax = chart.scales.y.getPixelForValue(dataPoint.yMax);

								ctx.save();
								ctx.strokeStyle = (dataset.borderColor as string) || '#000';
								ctx.lineWidth = 1.5;

								// Vertical line
								ctx.beginPath();
								ctx.moveTo(x, yMin);
								ctx.lineTo(x, yMax);
								ctx.stroke();

								// Top cap
								ctx.beginPath();
								ctx.moveTo(x - 4, yMax);
								ctx.lineTo(x + 4, yMax);
								ctx.stroke();

								// Bottom cap
								ctx.beginPath();
								ctx.moveTo(x - 4, yMin);
								ctx.lineTo(x + 4, yMin);
								ctx.stroke();

								ctx.restore();
							});
						});
					}
				}
			]
		});
	}

	onMount(() => {
		buildChart();
		return () => {
			if (chart) {
				chart.destroy();
				chart = null;
			}
		};
	});

	// Rebuild chart when data changes
	$effect(() => {
		// Track dependencies
		const _ = [regressionColorExpert, regressionNonExpert, ndLinearFitColorExpert, ndLinearFitNonExpert];
		if (chartCanvas) {
			if (chart) {
				chart.destroy();
				chart = null;
			}
			buildChart();
		}
	});
</script>

<Section title="50% JND by Color Expertise">
	<!-- Group Definitions -->
	<div class="mb-6 rounded-lg bg-amber-50 p-6 border border-amber-200">
		<h3 class="mb-3 text-lg font-semibold text-amber-800">
			Participant Group Definitions
		</h3>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-lg bg-white p-4 border border-amber-100">
				<div class="flex items-center gap-2 mb-2">
					<span class="inline-block w-4 h-0.5 bg-blue-500"></span>
					<h4 class="font-semibold text-slate-700">Color Expert Group (n={nColorExpert})</h4>
				</div>
				<p class="text-sm text-slate-600">
					Participants who meet <strong>any</strong> of the following:
				</p>
				<ul class="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
					<li>Use makeup regularly</li>
					<li>Use makeup occasionally</li>
					<li>Use makeup professionally</li>
					<li>Have taken a color theory class</li>
				</ul>
			</div>
			<div class="rounded-lg bg-white p-4 border border-amber-100">
				<div class="flex items-center gap-2 mb-2">
					<span class="inline-block w-4 h-0.5 bg-blue-300 border-dashed border-t-2 border-blue-400"></span>
					<h4 class="font-semibold text-slate-700">Non-Expert Group (n={nNonExpert})</h4>
				</div>
				<p class="text-sm text-slate-600">
					Participants who meet <strong>all</strong> of the following:
				</p>
				<ul class="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
					<li>Do not use makeup</li>
					<li>Have NOT taken a color theory class</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Model Parameters Tables -->
	<div class="mb-6 space-y-4">
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Linear Model Parameters: {@html renderLatex('ND_x(50\\%, s) = A_x + B_x/s')}
			</h3>
			
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Color Expert Table -->
				<div>
					<h4 class="mb-3 text-sm font-semibold text-blue-700">Color Expert Group</h4>
					<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
						<table class="w-full text-sm">
							<thead>
								<tr>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('A_x')}</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('B_x')}</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">R²</th>
								</tr>
							</thead>
							<tbody>
								{#each sortedNDLinearFitExpert as row}
									<tr class="border-b border-slate-100">
										<td class="px-3 py-2 font-semibold" style="color: {axisColors[row.axis]?.expert}">{row.axis}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.A, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.B, 2)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.R2, 3)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Non-Expert Table -->
				<div>
					<h4 class="mb-3 text-sm font-semibold text-slate-500">Non-Expert Group</h4>
					<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
						<table class="w-full text-sm">
							<thead>
								<tr>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('A_x')}</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('B_x')}</th>
									<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">R²</th>
								</tr>
							</thead>
							<tbody>
								{#each sortedNDLinearFitNonExpert as row}
									<tr class="border-b border-slate-100">
										<td class="px-3 py-2 font-semibold" style="color: {axisColors[row.axis]?.nonExpert}">{row.axis}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.A, 3)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.B, 2)}</td>
										<td class="px-3 py-2 text-slate-600">{formatNumber(row.R2, 3)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Chart -->
	<div class="mt-8 rounded-lg bg-white p-6 shadow-sm border border-slate-200">
		<h3 class="mb-4 text-lg font-semibold text-slate-700">50% JND Comparison: Color Expert vs Non-Expert</h3>
		<div class="h-[500px]">
			<canvas bind:this={chartCanvas}></canvas>
		</div>
	</div>

	<!-- Legend explanation -->
	<div class="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
		<div class="flex items-center gap-2">
			<div class="w-8 h-0.5 bg-blue-500"></div>
			<span>Color Expert (solid lines, filled circles)</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-8 h-0.5 bg-blue-300 border-dashed border-t-2 border-blue-400"></div>
			<span>Non-Expert (dashed lines, hollow diamonds)</span>
		</div>
	</div>

	<!-- Caption -->
	<p class="mt-4 text-sm text-slate-600 italic">
		<strong>Figure:</strong> 50% JND (ND(50%, s)) as a function of point diameter, comparing participants with color expertise 
		(makeup users or color theory background) versus those without. 
		<strong>Solid lines</strong> show the Color Expert group's fitted model; 
		<strong>dashed lines</strong> show the Non-Expert group's model.
		Both groups use the linear approximation {@html renderLatex('ND_x(50\\%, s) = A_x + B_x/s')}.
	</p>

	<!-- Interpretation -->
	<div class="mt-6 rounded-lg bg-green-50 p-6 border border-green-200">
		<h3 class="mb-3 text-lg font-semibold text-green-800">
			Interpretation
		</h3>
		<p class="text-slate-700">
			If the Color Expert group shows <strong>lower</strong> JND values (lines below), they can discriminate smaller color differences—
			indicating better color perception. If the Non-Expert group's lines are lower, they have better discrimination.
			Overlapping or crossing lines suggest similar performance between groups at certain sizes.
		</p>
	</div>
</Section>


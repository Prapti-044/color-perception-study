<script lang="ts">
	import { onMount } from 'svelte';
	import type { NDLinearFitRow, RegressionRow } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import {
		jndLegendLabelOptions,
		legendInsidePlotTopRightPlugin
	} from '$lib/chart-legend-inside';
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
		regressionExpert: RegressionRow[];
		regressionNonExpert: RegressionRow[];
		ndLinearFitExpert: NDLinearFitRow[];
		ndLinearFitNonExpert: NDLinearFitRow[];
		expertCount: number;
		nonExpertCount: number;
		expertClauseSummary: string;
		expertLabel?: string;
		sectionTitle?: string;
		chartTitle?: string;
		figureScopeDescription?: string;
	}

	let {
		regressionExpert,
		regressionNonExpert,
		ndLinearFitExpert,
		ndLinearFitNonExpert,
		expertCount,
		nonExpertCount,
		expertClauseSummary,
		expertLabel = 'Expert',
		sectionTitle = '50% JND by Expertise',
		chartTitle = '',
		figureScopeDescription = 'using the active expert clause shown above.'
	}: Props = $props();

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	const resolvedChartTitle = $derived(
		chartTitle || `50% JND Comparison: ${expertLabel} vs Non-Expert`
	);
	const axisColors: Record<
		string,
		{ expert: string; expertLight: string; nonExpert: string; nonExpertLight: string }
	> = {
		L: {
			expert: 'rgb(59, 130, 246)',
			expertLight: 'rgba(59, 130, 246, 0.15)',
			nonExpert: 'rgb(147, 197, 253)',
			nonExpertLight: 'rgba(147, 197, 253, 0.15)'
		},
		a: {
			expert: 'rgb(34, 197, 94)',
			expertLight: 'rgba(34, 197, 94, 0.15)',
			nonExpert: 'rgb(134, 239, 172)',
			nonExpertLight: 'rgba(134, 239, 172, 0.15)'
		},
		b: {
			expert: 'rgb(168, 85, 247)',
			expertLight: 'rgba(168, 85, 247, 0.15)',
			nonExpert: 'rgb(216, 180, 254)',
			nonExpertLight: 'rgba(216, 180, 254, 0.15)'
		}
	};
	const axisOrder = ['L', 'a', 'b'];

	const sortedNDLinearFitExpert = $derived(
		axisOrder
			.filter((axis) => ndLinearFitExpert.some((row) => row.axis === axis))
			.map((axis) => ndLinearFitExpert.find((row) => row.axis === axis)!)
	);

	const sortedNDLinearFitNonExpert = $derived(
		axisOrder
			.filter((axis) => ndLinearFitNonExpert.some((row) => row.axis === axis))
			.map((axis) => ndLinearFitNonExpert.find((row) => row.axis === axis)!)
	);

	const sortedRegressionExpert = $derived.by(() => {
		const result: Record<string, RegressionRow[]> = {};
		for (const axis of axisOrder) {
			const axisData = regressionExpert
				.filter((row) => row.axis === axis)
				.sort((a, b) => a.size_deg - b.size_deg);
			if (axisData.length > 0) {
				result[axis] = axisData;
			}
		}
		return result;
	});

	const sortedRegressionNonExpert = $derived.by(() => {
		const result: Record<string, RegressionRow[]> = {};
		for (const axis of axisOrder) {
			const axisData = regressionNonExpert
				.filter((row) => row.axis === axis)
				.sort((a, b) => a.size_deg - b.size_deg);
			if (axisData.length > 0) {
				result[axis] = axisData;
			}
		}
		return result;
	});

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
			const size = minSize + i * step;
			points.push({ x: size, y: A + B / size });
		}

		return points;
	}

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

	function buildChart() {
		if (!chartCanvas || chart) return;

		const regressionByAxisExpert = sortedRegressionExpert;
		const regressionByAxisNonExpert = sortedRegressionNonExpert;
		const allSizes = [
			...regressionExpert.map((row) => row.size_deg),
			...regressionNonExpert.map((row) => row.size_deg)
		];

		if (allSizes.length === 0) {
			return;
		}

		const minSize = Math.min(...allSizes) * 0.9;
		const maxSize = Math.max(...allSizes) * 1.1;
		const datasets: any[] = [];

		for (const axis of axisOrder) {
			const expertModel = ndLinearFitExpert.find((row) => row.axis === axis);
			const nonExpertModel = ndLinearFitNonExpert.find((row) => row.axis === axis);
			const expertAxisData = regressionByAxisExpert[axis];
			const nonExpertAxisData = regressionByAxisNonExpert[axis];
			const colors = axisColors[axis];

			if (expertModel && expertAxisData) {
				datasets.push({
					label: `${axis}-axis (${expertLabel})`,
					data: generateLinearModelCurve(expertModel.A, expertModel.B, minSize, maxSize),
					borderColor: colors.expert,
					backgroundColor: 'transparent',
					borderWidth: 2.5,
					pointRadius: 0,
					tension: 0,
					parsing: { xAxisKey: 'x', yAxisKey: 'y' }
				});

				datasets.push({
					label: `${axis}-axis data (${expertLabel.toLowerCase()})`,
					data: expertAxisData.map((row) => ({
						x: row.size_deg,
						y: row.ND50,
						yMin: row.ND50 - row.ND50_se,
						yMax: row.ND50 + row.ND50_se
					})),
					borderColor: colors.expert,
					backgroundColor: colors.expert,
					pointRadius: 6,
					pointStyle: 'circle',
					showLine: false,
					parsing: { xAxisKey: 'x', yAxisKey: 'y' }
				});
			}

			if (nonExpertModel && nonExpertAxisData) {
				datasets.push({
					label: `${axis}-axis (Non-Expert)`,
					data: generateLinearModelCurve(nonExpertModel.A, nonExpertModel.B, minSize, maxSize),
					borderColor: colors.nonExpert,
					backgroundColor: 'transparent',
					borderWidth: 2.5,
					borderDash: [8, 4],
					pointRadius: 0,
					tension: 0,
					parsing: { xAxisKey: 'x', yAxisKey: 'y' }
				});

				datasets.push({
					label: `${axis}-axis data (non-expert)`,
					data: nonExpertAxisData.map((row) => ({
						x: row.size_deg,
						y: row.ND50,
						yMin: row.ND50 - row.ND50_se,
						yMax: row.ND50 + row.ND50_se
					})),
					borderColor: colors.nonExpert,
					backgroundColor: 'transparent',
					pointRadius: 5,
					pointStyle: 'rectRot',
					borderWidth: 2,
					showLine: false,
					parsing: { xAxisKey: 'x', yAxisKey: 'y' }
				});
			}
		}

		if (datasets.length === 0) {
			return;
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
						position: 'chartArea',
						align: 'start',
						fullSize: false,
						labels: jndLegendLabelOptions
					},
					title: {
						display: true,
						text: resolvedChartTitle,
						font: { size: 18, weight: 'bold' },
						padding: { bottom: 20 }
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const point = context.raw as {
									y: number;
									yMin?: number;
								};
								const datasetLabel = context.dataset.label || '';
								const group = datasetLabel.includes('Non-Expert')
									? ' (Non-Expert)'
									: ` (${expertLabel})`;

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
				legendInsidePlotTopRightPlugin,
				{
					id: 'errorBars',
					afterDatasetsDraw(currentChart) {
						const ctx = currentChart.ctx;
						currentChart.data.datasets.forEach((dataset, datasetIndex) => {
							if (!dataset.label?.includes('data')) return;

							const meta = currentChart.getDatasetMeta(datasetIndex);
							meta.data.forEach((element, pointIndex) => {
								const dataPoint = (dataset.data as Array<{
									yMin?: number;
									yMax?: number;
								}>)[pointIndex];

								if (!dataPoint || dataPoint.yMin === undefined || dataPoint.yMax === undefined) {
									return;
								}

								const x = element.x;
								const yMin = currentChart.scales.y.getPixelForValue(dataPoint.yMin);
								const yMax = currentChart.scales.y.getPixelForValue(dataPoint.yMax);

								ctx.save();
								ctx.strokeStyle = (dataset.borderColor as string) || '#000';
								ctx.lineWidth = 1.5;

								ctx.beginPath();
								ctx.moveTo(x, yMin);
								ctx.lineTo(x, yMax);
								ctx.stroke();

								ctx.beginPath();
								ctx.moveTo(x - 4, yMax);
								ctx.lineTo(x + 4, yMax);
								ctx.stroke();

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

	$effect(() => {
		const tracked = [
			regressionExpert,
			regressionNonExpert,
			ndLinearFitExpert,
			ndLinearFitNonExpert,
			expertLabel,
			chartTitle
		];

		if (tracked && chartCanvas) {
			if (chart) {
				chart.destroy();
				chart = null;
			}
			buildChart();
		}
	});
</script>

<Section title={sectionTitle}>
	<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
		<h3 class="mb-3 text-lg font-semibold text-amber-800">Active Expert Clause</h3>
		<div class="rounded-lg border border-amber-100 bg-white p-4">
			<p class="mb-2 text-sm font-semibold text-slate-700">{expertLabel} Group (n={expertCount})</p>
			<p class="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">{expertClauseSummary}</p>
		</div>
		<div class="mt-4 rounded-lg border border-amber-100 bg-white p-4">
			<p class="mb-2 text-sm font-semibold text-slate-700">Non-Expert Group (n={nonExpertCount})</p>
			<p class="text-sm text-slate-600">
				All participants who do not match the active expert clause, including missing or null values.
			</p>
		</div>
	</div>

	<div class="mb-6 space-y-4">
		<div class="rounded-lg border border-slate-200 bg-slate-50 p-6">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Linear Model Parameters: {@html renderLatex('ND_x(50\\%, s) = A_x + B_x/s')}
			</h3>

			<div class="grid gap-4 md:grid-cols-2">
				<div>
					<h4 class="mb-3 text-sm font-semibold text-blue-700">{expertLabel} Group</h4>
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
								{#if sortedNDLinearFitExpert.length === 0}
									<tr>
										<td colspan="4" class="px-3 py-4 text-center italic text-slate-500">No data available</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>

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
								{#if sortedNDLinearFitNonExpert.length === 0}
									<tr>
										<td colspan="4" class="px-3 py-4 text-center italic text-slate-500">No data available</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-700">{resolvedChartTitle}</h3>
		<div class="h-[500px]">
			<canvas bind:this={chartCanvas}></canvas>
		</div>
	</div>

	<div class="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
		<div class="flex items-center gap-2">
			<div class="h-0.5 w-8 bg-blue-500"></div>
			<span>{expertLabel} (solid lines, filled circles)</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-8 border-t-2 border-dashed border-blue-400"></div>
			<span>Non-Expert (dashed lines, hollow diamonds)</span>
		</div>
	</div>

	<p class="mt-4 text-sm italic text-slate-600">
		<strong>Figure:</strong> 50% JND (ND(50%, s)) as a function of point diameter {figureScopeDescription}
		<strong> Solid lines</strong> show the {expertLabel} group's fitted model;
		<strong> dashed lines</strong> show the Non-Expert group's model.
		Both groups use the linear approximation {@html renderLatex('ND_x(50\\%, s) = A_x + B_x/s')}.
	</p>

	<div class="mt-6 rounded-lg border border-green-200 bg-green-50 p-6">
		<h3 class="mb-3 text-lg font-semibold text-green-800">Interpretation</h3>
		<p class="text-slate-700">
			If the {expertLabel} group shows <strong>lower</strong> JND values, they can discriminate smaller color differences.
			If the Non-Expert group is lower, they show better discrimination under the active clause.
			Overlapping or crossing lines suggest similar performance at some sizes.
		</p>
	</div>
</Section>

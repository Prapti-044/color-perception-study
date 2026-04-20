<script lang="ts">
	import type { NDLinearFitRow, RegressionRow } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import Section from './Section.svelte';
	import katex from 'katex';
	import 'katex/dist/katex.min.css';
	import {
		renderJndComparisonChart,
		type JndLineSeries,
		type JndScatterSeries
	} from '$lib/d3/jndComparisonChart';
	import { downloadSvgElement } from '$lib/svgDownload';

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

	let chartHost = $state<HTMLDivElement | undefined>();

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

	const jndSvgModel = $derived.by(() => {
		const regressionByAxisExpert = sortedRegressionExpert;
		const regressionByAxisNonExpert = sortedRegressionNonExpert;
		const allSizes = [
			...regressionExpert.map((row) => row.size_deg),
			...regressionNonExpert.map((row) => row.size_deg)
		];

		if (allSizes.length === 0) {
			return {
				lineSeries: [] as JndLineSeries[],
				scatterSeries: [] as JndScatterSeries[],
				xDomain: [0, 1] as [number, number],
				yDomain: [0, 1] as [number, number],
				hasData: false
			};
		}

		const minSize = Math.min(...allSizes) * 0.9;
		const maxSize = Math.max(...allSizes) * 1.1;

		const lineSeries: JndLineSeries[] = [];
		const scatterSeries: JndScatterSeries[] = [];
		let yHi = 0;

		for (const axis of axisOrder) {
			const expertModel = ndLinearFitExpert.find((row) => row.axis === axis);
			const nonExpertModel = ndLinearFitNonExpert.find((row) => row.axis === axis);
			const expertAxisData = regressionByAxisExpert[axis];
			const nonExpertAxisData = regressionByAxisNonExpert[axis];
			const colors = axisColors[axis];

			if (expertModel && expertAxisData) {
				const pts = generateLinearModelCurve(expertModel.A, expertModel.B, minSize, maxSize);
				lineSeries.push({
					label: `${axis}-axis (${expertLabel})`,
					color: colors.expert,
					points: pts
				});
				for (const p of pts) yHi = Math.max(yHi, p.y);

				const expPts = expertAxisData.map((row) => ({
					x: row.size_deg,
					y: row.ND50,
					yMin: row.ND50 - row.ND50_se,
					yMax: row.ND50 + row.ND50_se
				}));
				scatterSeries.push({
					label: `${axis}-axis data (${expertLabel.toLowerCase()})`,
					color: colors.expert,
					shape: 'circle',
					points: expPts
				});
				for (const p of expPts) {
					yHi = Math.max(yHi, p.y, p.yMax ?? p.y, p.yMin ?? p.y);
				}
			}

			if (nonExpertModel && nonExpertAxisData) {
				const pts = generateLinearModelCurve(nonExpertModel.A, nonExpertModel.B, minSize, maxSize);
				lineSeries.push({
					label: `${axis}-axis (Non-Expert)`,
					color: colors.nonExpert,
					strokeDasharray: '8 4',
					points: pts
				});
				for (const p of pts) yHi = Math.max(yHi, p.y);

				const nePts = nonExpertAxisData.map((row) => ({
					x: row.size_deg,
					y: row.ND50,
					yMin: row.ND50 - row.ND50_se,
					yMax: row.ND50 + row.ND50_se
				}));
				scatterSeries.push({
					label: `${axis}-axis data (non-expert)`,
					color: colors.nonExpert,
					shape: 'diamond',
					points: nePts
				});
				for (const p of nePts) {
					yHi = Math.max(yHi, p.y, p.yMax ?? p.y, p.yMin ?? p.y);
				}
			}
		}

		const yTop = Math.max(5, Math.ceil(yHi / 5) * 5);

		return {
			lineSeries,
			scatterSeries,
			xDomain: [0, maxSize] as [number, number],
			yDomain: [0, yTop] as [number, number],
			hasData: lineSeries.length > 0
		};
	});

	$effect(() => {
		const _ = [
			regressionExpert,
			regressionNonExpert,
			ndLinearFitExpert,
			ndLinearFitNonExpert,
			expertLabel,
			chartTitle,
			resolvedChartTitle
		];
		if (!chartHost || !jndSvgModel.hasData) return;

		renderJndComparisonChart(chartHost, {
			title: resolvedChartTitle,
			xLabel: 'Point Diameter (Visual Angle °)',
			yLabel: 'ND(50%, s) in ΔE',
			lineSeries: jndSvgModel.lineSeries,
			scatterSeries: jndSvgModel.scatterSeries,
			xDomain: jndSvgModel.xDomain,
			yDomain: jndSvgModel.yDomain
		});
	});

	function downloadJndSvg() {
		const svg = chartHost?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'jnd-by-expertise.svg');
	}
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
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h3 class="text-lg font-semibold text-slate-700">{resolvedChartTitle}</h3>
			<button
				type="button"
				class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
				onclick={downloadJndSvg}>Download SVG</button
			>
		</div>
		<div class="h-[500px]">
			<div bind:this={chartHost} class="h-full w-full"></div>
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

<script lang="ts">
	import type { RegressionRow, InverseModelRow, NDLinearFitRow } from '$lib/types';
	import { formatNumber } from '$lib/utils';
	import { ORIGINAL_PAPER_RESULTS } from '$lib/constants';
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
		regression: RegressionRow[];
		inverseModel: InverseModelRow[];
		ndLinearFit: NDLinearFitRow[];
	}

	let { regression, inverseModel, ndLinearFit }: Props = $props();

	let chartHost = $state<HTMLDivElement | undefined>();
	let showReference = $state(true);

	// Axis colors matching the original paper
	const axisColors: Record<string, { main: string; light: string; ref: string }> = {
		L: { main: 'rgb(59, 130, 246)', light: 'rgba(59, 130, 246, 0.15)', ref: 'rgba(59, 130, 246, 0.5)' }, // Blue
		a: { main: 'rgb(34, 197, 94)', light: 'rgba(34, 197, 94, 0.15)', ref: 'rgba(34, 197, 94, 0.5)' }, // Green
		b: { main: 'rgb(168, 85, 247)', light: 'rgba(168, 85, 247, 0.15)', ref: 'rgba(168, 85, 247, 0.5)' } // Purple
	};

	// Reference data from original paper
	const refInverseModel = ORIGINAL_PAPER_RESULTS.inverse_model;
	const refRegression = ORIGINAL_PAPER_RESULTS.regression;

	// Custom axis order
	const axisOrder = ['L', 'a', 'b'];

	// Sorted data
	const sortedInverseModel = $derived(
		axisOrder
			.filter((axis) => inverseModel.some((r) => r.axis === axis))
			.map((axis) => inverseModel.find((r) => r.axis === axis)!)
	);

	const sortedNDLinearFit = $derived(
		axisOrder
			.filter((axis) => ndLinearFit.some((r) => r.axis === axis))
			.map((axis) => ndLinearFit.find((r) => r.axis === axis)!)
	);

	const sortedRegression = $derived(() => {
		const result: Record<string, RegressionRow[]> = {};
		for (const axis of axisOrder) {
			const axisData = regression
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

	// Generate curve from reference paper's nonlinear model
	// Note: Paper uses ND = p / (c - k/s), we store k as negative so c + k/s = c - |k|/s
	function generateRefModelCurve(
		c: number,
		k: number,
		minSize: number,
		maxSize: number,
		numPoints: number = 100
	): { x: number; y: number }[] {
		const points: { x: number; y: number }[] = [];
		const step = (maxSize - minSize) / (numPoints - 1);

		for (let i = 0; i < numPoints; i++) {
			const s = minSize + i * step;
			// ND(50%, s) = 0.5 / (c + k/s) where k is negative
			const denom = c + k / s;
			if (denom > 0) {
				const nd = 0.5 / denom;
				points.push({ x: s, y: nd });
			}
		}

		return points;
	}

	const jndSvgModel = $derived.by(() => {
		const regByAxis = sortedRegression();
		const allSizes = regression.map((r) => r.size_deg);
		const refSizes = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
		const allSizesWithRef = [...allSizes, ...refSizes];
		const minSize = Math.min(...allSizesWithRef) * 0.9;
		const maxSize = Math.max(...allSizesWithRef) * 1.1;

		const lineSeries: JndLineSeries[] = [];
		const scatterSeries: JndScatterSeries[] = [];
		let yHi = 0;

		for (const axis of axisOrder) {
			const invModel = inverseModel.find((m) => m.axis === axis);
			const linModel = ndLinearFit.find((m) => m.axis === axis);
			const axisData = regByAxis[axis];

			if (!invModel || !linModel || !axisData) continue;

			const colors = axisColors[axis];

			const linearCurvePoints = generateLinearModelCurve(linModel.A, linModel.B, minSize, maxSize);
			lineSeries.push({
				label: `${axis}-axis (Current)`,
				color: colors.main,
				points: linearCurvePoints
			});
			for (const p of linearCurvePoints) yHi = Math.max(yHi, p.y);

			const currentPts = axisData.map((r) => ({
				x: r.size_deg,
				y: r.ND50,
				yMin: r.ND50 - r.ND50_se,
				yMax: r.ND50 + r.ND50_se
			}));
			scatterSeries.push({
				label: `${axis}-axis data (current)`,
				color: colors.main,
				shape: 'circle',
				points: currentPts
			});
			for (const p of currentPts) {
				yHi = Math.max(yHi, p.y, p.yMax ?? p.y, p.yMin ?? p.y);
			}

			if (showReference && refInverseModel[axis]) {
				const refModel = refInverseModel[axis];
				const refCurvePoints = generateRefModelCurve(refModel.c, refModel.k, minSize, maxSize);
				lineSeries.push({
					label: `${axis}-axis (Szafir et al.)`,
					color: colors.ref,
					strokeDasharray: '8 4',
					points: refCurvePoints
				});
				for (const p of refCurvePoints) yHi = Math.max(yHi, p.y);

				const refAxisData = refRegression[axis];
				if (refAxisData) {
					const refPts = Object.entries(refAxisData).map(([size, data]) => ({
						x: parseFloat(size),
						y: data.nd50
					}));
					scatterSeries.push({
						label: `${axis}-axis data (Szafir)`,
						color: colors.ref,
						shape: 'diamond',
						points: refPts
					});
					for (const p of refPts) yHi = Math.max(yHi, p.y);
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
		const _ = [regression, inverseModel, ndLinearFit, showReference];
		if (!chartHost || !jndSvgModel.hasData) return;

		renderJndComparisonChart(chartHost, {
			title: '50% JND for Points (Current Study vs. Szafir et al.)',
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
		if (svg) downloadSvgElement(svg, 'jnd-50-percent-points.svg');
	}
</script>

<Section title="50% JND Model for Points">
	<!-- Step-by-Step Derivation -->
	<div class="space-y-6">
		<!-- Step 1 -->
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Step 1: Per-Size Regression Model
			</h3>
			<p class="mb-4 text-slate-700">
				For each axis and point size, we fit a regression model relating discriminability
				{@html renderLatex('p')} to color difference {@html renderLatex('\\Delta E')}:
			</p>
			<div class="my-4 flex justify-center">
				<div class="rounded-lg bg-white px-6 py-3 shadow-sm border border-slate-200">
					{@html renderLatex('p = m_x \\cdot \\Delta E', true)}
				</div>
			</div>
			<p class="text-sm text-slate-600">
				where {@html renderLatex('m_x')} is the slope for axis {@html renderLatex('x')} at a given size.
			</p>
		</div>

		<!-- Step 2 -->
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Step 2: Compute Empirical ND(50%) Values
			</h3>
			<p class="mb-4 text-slate-700">
				For each size, we compute the {@html renderLatex('\\Delta E')} needed for 50% discriminability
				by setting {@html renderLatex('p = 0.5')}:
			</p>
			<div class="my-4 flex justify-center">
				<div class="rounded-lg bg-white px-6 py-3 shadow-sm border border-slate-200">
					{@html renderLatex('ND(50\\%) = \\frac{0.5}{m_x}', true)}
				</div>
			</div>

			<!-- Show empirical ND values table -->
			<h4 class="mt-6 mb-3 text-sm font-semibold text-slate-700">Empirical ND(50%) Values:</h4>
			<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Size (°)</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Slope {@html renderLatex('m_x')}</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">ND(50%) ΔE</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">SE</th>
						</tr>
					</thead>
					<tbody>
						{#each axisOrder as axis}
							{@const axisData = sortedRegression()[axis] ?? []}
							{#each axisData as row}
								<tr class="border-b border-slate-100">
									<td class="px-3 py-2 font-semibold" style="color: {axisColors[axis]?.main}">{row.axis}</td>
									<td class="px-3 py-2 text-slate-600">{formatNumber(row.size_deg, 3)}</td>
									<td class="px-3 py-2 text-slate-600">{formatNumber(row.slope, 4)}</td>
									<td class="px-3 py-2 text-slate-600">{formatNumber(row.ND50, 2)}</td>
									<td class="px-3 py-2 text-slate-500">±{formatNumber(row.ND50_se, 2)}</td>
								</tr>
							{/each}
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Step 3 -->
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Step 3: Slope Varies with Size
			</h3>
			<p class="mb-4 text-slate-700">
				We observe that the slope {@html renderLatex('m_x')} varies with point size {@html renderLatex('s')}.
				We fit an inverse-size model:
			</p>
			<div class="my-4 flex justify-center">
				<div class="rounded-lg bg-white px-6 py-3 shadow-sm border border-slate-200">
					{@html renderLatex('m_x(s) = c_x + \\frac{k_x}{s}', true)}
				</div>
			</div>

			<h4 class="mt-6 mb-3 text-sm font-semibold text-slate-700">Fitted Slope Model Parameters:</h4>
			<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('c_x')}</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('k_x')}</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">R²</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedInverseModel as row}
							<tr class="border-b border-slate-100">
								<td class="px-3 py-2 font-semibold" style="color: {axisColors[row.axis]?.main}">{row.axis}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.c_x, 4)}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.k_x, 4)}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.R2, 3)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Step 4 -->
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Step 4: Derive ND(50%, s) from Slope Model
			</h3>
			<p class="mb-4 text-slate-700">
				Substituting the slope model into the ND formula:
			</p>
			<div class="my-4 flex flex-col items-center gap-3">
				<div class="rounded-lg bg-white px-6 py-3 shadow-sm border border-slate-200">
					{@html renderLatex('ND_x(50\\%, s) = \\frac{0.5}{m_x(s)} = \\frac{0.5}{c_x + \\frac{k_x}{s}}', true)}
				</div>
			</div>

			<h4 class="mt-6 mb-3 text-sm font-semibold text-slate-700">Nonlinear ND Model (exact form):</h4>
			<div class="space-y-2">
				{#each sortedInverseModel as row}
					<div class="flex items-center gap-3">
						<span class="font-semibold" style="color: {axisColors[row.axis]?.main}">{row.axis}:</span>
						<code class="rounded bg-white px-3 py-1 text-sm border border-slate-200">
							{@html renderLatex(`ND_{${row.axis}}(50\\%, s) = \\frac{0.5}{${formatNumber(row.c_x, 4)} + \\frac{${formatNumber(row.k_x, 4)}}{s}}`)}
						</code>
					</div>
				{/each}
			</div>
		</div>

		<!-- Step 5 -->
		<div class="rounded-lg bg-blue-50 p-6 border border-blue-200">
			<h3 class="mb-3 text-lg font-semibold text-blue-800">
				Step 5: Linear Approximation for Usability
			</h3>
			<p class="mb-4 text-slate-700">
				The nonlinear form {@html renderLatex('\\frac{0.5}{c_x + k_x/s}')} is exact but harder to interpret.
				Following the approach in the original paper, we <strong>fit a secondary linear regression</strong>
				to obtain a simpler, more interpretable form:
			</p>
			<div class="my-4 flex justify-center">
				<div class="rounded-lg bg-white px-6 py-3 shadow-sm border border-blue-200">
					{@html renderLatex('ND_x(50\\%, s) \\approx A_x + \\frac{B_x}{s}', true)}
				</div>
			</div>
			<p class="text-sm text-slate-600">
				This is <strong>not an algebraic transformation</strong> — it is a linear regression of the
				empirical ND(50%) values against {@html renderLatex('1/s')}.
			</p>
			<div class="mt-4 p-4 bg-white rounded-lg border border-blue-100">
				<p class="text-sm text-slate-700">
					<strong>Why this form?</strong>
				</p>
				<ul class="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
					<li><strong>Interpretability:</strong> {@html renderLatex('A_x')} is the base JND when marks are large; {@html renderLatex('B_x/s')} is the extra penalty for small marks</li>
					<li><strong>Stability:</strong> Avoids extrapolation artifacts from the nonlinear form</li>
					<li><strong>Empirically grounded:</strong> Matches observed data in the tested size range</li>
				</ul>
			</div>
		</div>

		<!-- Step 6 -->
		<div class="rounded-lg bg-slate-50 p-6 border border-slate-200">
			<h3 class="mb-3 text-lg font-semibold text-slate-800">
				Step 6: Secondary Regression Results
			</h3>
			<p class="mb-4 text-slate-700">
				We regress the empirical ND(50%) values against {@html renderLatex('1/s')} for each axis:
			</p>

			<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('A_x')} (intercept)</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('B_x')} (slope)</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">R²</th>
							<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">n</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedNDLinearFit as row}
							<tr class="border-b border-slate-100">
								<td class="px-3 py-2 font-semibold" style="color: {axisColors[row.axis]?.main}">{row.axis}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.A, 3)} ± {formatNumber(row.A_se, 3)}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.B, 2)} ± {formatNumber(row.B_se, 2)}</td>
								<td class="px-3 py-2 text-slate-600">{formatNumber(row.R2, 3)}</td>
								<td class="px-3 py-2 text-slate-600">{row.n_points}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Step 7: Final Result -->
		<div class="rounded-lg bg-green-50 p-6 border border-green-200">
			<h3 class="mb-3 text-lg font-semibold text-green-800">
				Step 7: Final JND Model Equations
			</h3>
			<p class="mb-4 text-slate-700">
				The final, usable equations for computing 50% JND at any point size:
			</p>

			<div class="space-y-4">
				{#each sortedNDLinearFit as row}
					{@const r2Display = row.R2 > 0.99 ? '> .99' : formatNumber(row.R2, 2)}
					<div class="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-green-200">
						<div class="flex items-center gap-3">
							<span
								class="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold"
								style="background-color: {axisColors[row.axis]?.main}"
							>
								{row.axis}
							</span>
							<div>
								{@html renderLatex(`ND_{${row.axis}}(50\\%, s) = ${formatNumber(row.A, 3)} + \\frac{${formatNumber(row.B, 2)}}{s}`)}
							</div>
						</div>
						<div class="text-sm text-slate-500">
							R² = {r2Display}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-6 p-4 bg-white rounded-lg border border-green-100">
				<p class="text-sm text-slate-700">
					<strong>Interpretation:</strong> As point size {@html renderLatex('s \\to \\infty')},
					{@html renderLatex('ND \\to A_x')} (the asymptotic JND). For smaller points, the
					{@html renderLatex('B_x/s')} term increases the JND, meaning colors are harder to discriminate.
				</p>
			</div>
		</div>
	</div>

	<!-- Reference Comparison Section -->
	<div class="mt-8 rounded-lg bg-amber-50 p-6 border border-amber-200">
		<h3 class="mb-3 text-lg font-semibold text-amber-800">
			Comparison with Szafir et al.
		</h3>
		<p class="mb-4 text-slate-700">
			For reference, the original paper (Szafir et al., "Modeling Color Difference for Visualization Design") 
			reported the following inverse-size models for scatterplots:
		</p>

		<div class="overflow-x-auto rounded-lg bg-white shadow-sm mb-4">
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Axis</th>
						<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Model</th>
						<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('c_x')}</th>
						<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">{@html renderLatex('k_x')}</th>
						<th class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">R²</th>
					</tr>
				</thead>
				<tbody>
					{#each axisOrder as axis}
						{@const ref = refInverseModel[axis]}
						{#if ref}
							<tr class="border-b border-slate-100">
								<td class="px-3 py-2 font-semibold" style="color: {axisColors[axis]?.main}">{axis}</td>
								<td class="px-3 py-2 text-slate-600 text-xs">
									{@html renderLatex(`ND_{${axis}} = \\frac{0.5}{${ref.c} + \\frac{${ref.k}}{s}}`)}
								</td>
								<td class="px-3 py-2 text-slate-600">{ref.c}</td>
								<td class="px-3 py-2 text-slate-600">{ref.k}</td>
								<td class="px-3 py-2 text-slate-600">{ref.r2}</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-sm text-slate-600">
			The original study tested 72 participants (24 per axis) with point diameters from 0.25° to 2.0°.
		</p>
	</div>

	<!-- Chart -->
	<div class="mt-8 rounded-lg bg-white p-6 shadow-sm border border-slate-200">
		<!-- Chart controls -->
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h3 class="text-lg font-semibold text-slate-700">50% JND Comparison Plot</h3>
			<div class="flex flex-wrap items-center gap-4">
				<button
					type="button"
					class="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
					onclick={downloadJndSvg}>Download SVG</button
				>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showReference}
						class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-slate-600">Show Szafir et al. reference</span>
				</label>
			</div>
		</div>

		<div class="h-[500px]">
			<div bind:this={chartHost} class="h-full w-full"></div>
		</div>
	</div>

	<!-- Legend explanation -->
	<div class="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
		<div class="flex items-center gap-2">
			<div class="w-8 h-0.5 bg-blue-500"></div>
			<span>Current study (solid lines)</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-8 h-0.5 bg-blue-300 border-dashed border-t-2 border-blue-400"></div>
			<span>Szafir et al. (dashed lines)</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rounded-full bg-slate-500"></div>
			<span>Current data points (with SE error bars)</span>
		</div>
		<div class="flex items-center gap-2">
			<div class="w-3 h-3 rotate-45 border-2 border-slate-400 bg-transparent"></div>
			<span>Szafir et al. data points</span>
		</div>
	</div>

	<!-- Caption -->
	<p class="mt-4 text-sm text-slate-600 italic">
		<strong>Figure:</strong> 50% JND (ND(50%, s)) as a function of point diameter. 
		<strong>Solid lines</strong> show our fitted linear approximation {@html renderLatex('ND_x(50\\%, s) = A_x + B_x/s')}; 
		<strong>filled circles</strong> show our empirical ND(50%) values with standard error bars.
		{#if showReference}
			<strong>Dashed lines</strong> show the original Szafir et al. model; 
			<strong>hollow diamonds</strong> show their empirical data points.
		{/if}
	</p>
</Section>

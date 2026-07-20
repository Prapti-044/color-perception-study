<script lang="ts">
	import { onMount } from 'svelte';
	import { renderHistogramChart } from '$lib/d3/histogramChart';
	import { renderMultiColorScatterChart } from '$lib/d3/multiColorScatterChart';
	import { downloadSvgElement } from '$lib/svgDownload';
	import { AXIS_COLORS } from '$lib/colors';

	interface ShadeData {
		brand: string;
		name?: string;
		specific?: string;
		product?: string;
		description?: string;
		hex: string;
		hue?: string;
		sat?: string;
		lightness?: string;
	}

	interface LabColor {
		L: number;
		A: number;
		B: number;
	}

	// Convert hex color to LAB color space
	function hexToLab(hex: string): LabColor {
		// Convert hex to RGB
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;

		// Apply gamma correction
		const rLinear = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
		const gLinear = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
		const bLinear = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

		// Convert RGB to XYZ (using sRGB D65 illuminant)
		let x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
		let y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
		let z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;

		// Normalize to D65 illuminant
		x = x / 0.95047;
		y = y / 1.00000;
		z = z / 1.08883;

		// Convert XYZ to LAB
		const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
		const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
		const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

		const L = 116 * fy - 16;
		const A = 500 * (fx - fy);
		const B = 200 * (fy - fz);

		return {
			L: Math.round(L * 10) / 10,
			A: Math.round(A * 10) / 10,
			B: Math.round(B * 10) / 10
		};
	}

	// ============================================
	// EXCLUDED COLORS CONFIGURATION
	// Add colors to exclude here. Currently excludes:
	// - Blue undertones (b* < 0 in LAB color space)
	// ============================================
	function shouldExcludeColor(hex: string): boolean {
		const lab = hexToLab(hex);
		
		// Exclude blue undertones (negative b* value in LAB space)
		if (lab.B < 0) return true;
		
		// Add more exclusion rules here as needed:
		// if (lab.L < 20) return true;  // Example: exclude very dark colors
		// if (someOtherCondition) return true;
		
		return false;
	}

	// State
	let loading = $state(true);
	let data = $state<ShadeData[]>([]);
	let brandData = $state<Map<string, ShadeData[]>>(new Map());
	let searchTerm = $state('');
	let excludedCount = $state(0);

	// Stats
	let totalShades = $derived(data.length);
	let totalBrands = $derived(brandData.size);
	let averageShades = $derived(totalBrands > 0 ? Math.round(totalShades / totalBrands) : 0);

	// Filtered brands based on search
	let filteredBrands = $derived(() => {
		if (!searchTerm) return [...brandData.entries()];
		return [...brandData.entries()].filter(([brand]) =>
			brand.toLowerCase().includes(searchTerm.toLowerCase())
		);
	});

	function parseCSVLine(line: string): string[] {
		const result: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				result.push(current);
				current = '';
			} else {
				current += char;
			}
		}
		result.push(current);
		return result;
	}

	function parseCSV(csv: string): { data: ShadeData[]; excludedCount: number } {
		const lines = csv.split('\n');
		const headers = lines[0].split(',');
		const parsedData: ShadeData[] = [];
		let excluded = 0;

		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '') continue;

			const values = parseCSVLine(lines[i]);
			if (values.length >= headers.length) {
				const row: Record<string, string> = {};
				headers.forEach((header, index) => {
					row[header.trim()] = values[index] ? values[index].trim() : '';
				});

				// Only include rows with valid hex colors
				if (row.hex && row.hex.match(/^#[0-9A-Fa-f]{6}$/)) {
					// Check if this color should be excluded
					if (shouldExcludeColor(row.hex)) {
						excluded++;
					} else {
						parsedData.push(row as unknown as ShadeData);
					}
				}
			}
		}
		return { data: parsedData, excludedCount: excluded };
	}

	function processData(shades: ShadeData[]): Map<string, ShadeData[]> {
		const brandMap = new Map<string, ShadeData[]>();
		
		shades.forEach(shade => {
			const brand = shade.brand;
			if (!brandMap.has(brand)) {
				brandMap.set(brand, []);
			}
			brandMap.get(brand)!.push(shade);
		});

		// Sort brands by number of shades (descending)
		const sortedEntries = [...brandMap.entries()].sort((a, b) => b[1].length - a[1].length);
		const sortedMap = new Map(sortedEntries);

		// Sort shades within each brand by lightness
		sortedMap.forEach((shades) => {
			shades.sort((a, b) => {
				const lightnessA = parseFloat(a.lightness || '0') || 0;
				const lightnessB = parseFloat(b.lightness || '0') || 0;
				return lightnessB - lightnessA; // Light to dark
			});
		});

		return sortedMap;
	}

	function getTooltipContent(shade: ShadeData): string {
		const lines: string[] = [];

		// Add shade name/specific
		if (shade.name && shade.name.trim() !== 'NA' && shade.name.trim() !== '') {
			lines.push(shade.name);
		} else if (shade.specific && shade.specific.trim() !== 'NA' && shade.specific.trim() !== '') {
			lines.push(shade.specific);
		}

		// Add product name if available
		if (shade.product && shade.product.trim() !== 'NA' && shade.product.trim() !== '') {
			lines.push(`Product: ${shade.product}`);
		}

		// Add description if available
		if (shade.description && shade.description.trim() !== 'NA' && shade.description.trim() !== '') {
			lines.push(shade.description);
		}

		// Add hex color
		lines.push(`Hex: ${shade.hex}`);

		// Add HSL color properties if available
		const hslProps: string[] = [];
		if (shade.hue && shade.hue.trim() !== 'NA' && shade.hue.trim() !== '') {
			hslProps.push(`H: ${Math.round(parseFloat(shade.hue))}°`);
		}
		if (shade.sat && shade.sat.trim() !== 'NA' && shade.sat.trim() !== '') {
			hslProps.push(`S: ${Math.round(parseFloat(shade.sat) * 100)}%`);
		}
		if (shade.lightness && shade.lightness.trim() !== 'NA' && shade.lightness.trim() !== '') {
			hslProps.push(`L: ${Math.round(parseFloat(shade.lightness) * 100)}%`);
		}

		if (hslProps.length > 0) {
			lines.push(`HSL: ${hslProps.join(', ')}`);
		}

		// Add LAB color properties
		const labValues = hexToLab(shade.hex);
		lines.push(`LAB: L*: ${labValues.L}, a*: ${labValues.A}, b*: ${labValues.B}`);

		return lines.join('\n');
	}

	let lightnessHost = $state<HTMLDivElement | undefined>();
	let aHost = $state<HTMLDivElement | undefined>();
	let bHost = $state<HTMLDivElement | undefined>();
	let scatterLaHost = $state<HTMLDivElement | undefined>();
	let scatterLbHost = $state<HTMLDivElement | undefined>();
	let scatterAbHost = $state<HTMLDivElement | undefined>();

	function downloadFrom(host: HTMLDivElement | undefined, filename: string) {
		const svg = host?.querySelector('svg');
		if (svg) downloadSvgElement(svg, filename);
	}

	$effect(() => {
		if (loading || data.length === 0) return;
		if (!lightnessHost || !aHost || !bHost || !scatterLaHost || !scatterLbHost || !scatterAbHost) {
			return;
		}

		const labValues = data.map((shade) => hexToLab(shade.hex));

		renderHistogramChart(
			lightnessHost,
			{
				title: 'L* (Lightness) Distribution',
				xAxisLabel: 'L* (Lightness)',
				values: labValues.map((lab) => lab.L),
				accentColor: AXIS_COLORS.L.main
			},
			{ width: 520, height: 300 }
		);
		renderHistogramChart(
			aHost,
			{
				title: 'a* (Red-Green) Distribution',
				xAxisLabel: 'a* (Red-Green)',
				values: labValues.map((lab) => lab.A),
				accentColor: AXIS_COLORS.a.main
			},
			{ width: 520, height: 300 }
		);
		renderHistogramChart(
			bHost,
			{
				title: 'b* (Yellow-Blue) Distribution',
				xAxisLabel: 'b* (Yellow-Blue)',
				values: labValues.map((lab) => lab.B),
				accentColor: AXIS_COLORS.b.main
			},
			{ width: 520, height: 300 }
		);

		renderMultiColorScatterChart(
			scatterLaHost,
			{
				title: 'L* vs a*',
				xLabel: 'L*',
				yLabel: 'a*',
				points: labValues.map((lab, index) => ({
					x: lab.L,
					y: lab.A,
					fill: data[index].hex
				}))
			},
			{ width: 520, height: 340 }
		);
		renderMultiColorScatterChart(
			scatterLbHost,
			{
				title: 'L* vs b*',
				xLabel: 'L*',
				yLabel: 'b*',
				points: labValues.map((lab, index) => ({
					x: lab.L,
					y: lab.B,
					fill: data[index].hex
				}))
			},
			{ width: 520, height: 340 }
		);
		renderMultiColorScatterChart(
			scatterAbHost,
			{
				title: 'a* vs b*',
				xLabel: 'a*',
				yLabel: 'b*',
				points: labValues.map((lab, index) => ({
					x: lab.A,
					y: lab.B,
					fill: data[index].hex
				}))
			},
			{ width: 520, height: 340 }
		);
	});

	onMount(() => {
		(async () => {
			try {
				const response = await fetch('/foundation-names/allShades.csv');
				const csvText = await response.text();
				const result = parseCSV(csvText);
				data = result.data;
				excludedCount = result.excludedCount;
				brandData = processData(data);
				loading = false;
			} catch (error) {
				console.error('Error loading data:', error);
				loading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>Foundation Color Palette Visualization</title>
</svelte:head>

<div class="min-h-screen bg-slate-100">
	<div class="mx-auto max-w-7xl px-6 py-8">
		<!-- Header -->
		<header class="mb-8">
			<h1 class="border-b-4 border-blue-600 pb-4 text-3xl font-bold tracking-tight text-slate-800">
				Foundation Color Palette Visualization
			</h1>
			<p class="mt-2 text-sm text-slate-500">
				Exploring the beautiful spectrum of foundation shades from Sephora & Ulta
			</p>
		</header>

		<!-- Stats Overview -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="text-4xl font-bold text-blue-600">{totalShades.toLocaleString()}</div>
				<div class="mt-2 text-sm font-medium text-slate-500">Included Shades</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="text-4xl font-bold text-blue-600">{totalBrands}</div>
				<div class="mt-2 text-sm font-medium text-slate-500">Brands</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="text-4xl font-bold text-blue-600">{averageShades}</div>
				<div class="mt-2 text-sm font-medium text-slate-500">Avg Shades/Brand</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="text-4xl font-bold text-amber-600">{excludedCount}</div>
				<div class="mt-2 text-sm font-medium text-slate-500">Excluded (Blue Undertones)</div>
			</div>
		</div>

		<!-- Exclusion Notice -->
		{#if excludedCount > 0}
			<div class="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
				<p class="text-sm text-amber-800">
					<strong>Note:</strong> {excludedCount} shades with blue undertones (b* &lt; 0 in LAB color space) have been excluded from this visualization to focus on warm-toned foundations.
				</p>
			</div>
		{/if}

		<!-- Search -->
		<div class="mb-8 text-center">
			<input
				type="text"
				class="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
				placeholder="Search brands..."
				bind:value={searchTerm}
			/>
		</div>

		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="text-center">
					<div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
					<p class="text-slate-600">Loading foundation colors...</p>
				</div>
			</div>
		{:else}
			<!-- LAB Color Space Analysis Section -->
			<section class="mb-6 rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
				<h2 class="mb-2 text-xl font-semibold text-slate-800">LAB Color Space Distribution Analysis</h2>
				<p class="mb-6 text-sm text-slate-500">
					Exploring the distribution of foundation shades across the LAB color space.
					LAB provides a perceptually uniform representation where L* represents lightness,
					a* represents the red-green axis, and b* represents the yellow-blue axis.
				</p>

				<div class="charts-grid">
					<div class="chart-container">
						<h3 class="chart-title">L* (Lightness) Distribution</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(lightnessHost, 'foundation-l-star-distribution.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={lightnessHost} class="chart-svg-host"></div>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">a* (Red-Green) Distribution</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(aHost, 'foundation-a-star-distribution.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={aHost} class="chart-svg-host"></div>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">b* (Yellow-Blue) Distribution</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(bHost, 'foundation-b-star-distribution.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={bHost} class="chart-svg-host"></div>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">L* vs a* Scatter Plot</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(scatterLaHost, 'foundation-l-vs-a-scatter.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={scatterLaHost} class="chart-svg-host"></div>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">L* vs b* Scatter Plot</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(scatterLbHost, 'foundation-l-vs-b-scatter.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={scatterLbHost} class="chart-svg-host"></div>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">a* vs b* Scatter Plot</h3>
						<div class="chart-actions">
							<button
								type="button"
								class="chart-download"
								onclick={() => downloadFrom(scatterAbHost, 'foundation-a-vs-b-scatter.svg')}
								>Download SVG</button
							>
						</div>
						<div bind:this={scatterAbHost} class="chart-svg-host"></div>
					</div>
				</div>
			</section>

			<!-- Brands Section -->
			<section class="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
				<h2 class="mb-6 text-xl font-semibold text-slate-800">Foundation Shades by Brand</h2>
				
				<div class="space-y-6">
					{#each filteredBrands() as [brand, shades]}
						{#if brand && brand.trim() !== ''}
							<div class="brand-section">
								<div class="brand-header">
									<h3 class="brand-name">{brand}</h3>
									<span class="shade-count">{shades.length} shades</span>
								</div>

								<div class="color-grid">
									{#each shades as shade}
										<div
											class="color-swatch"
											style:background-color={shade.hex}
											title={getTooltipContent(shade)}
										>
											<div class="tooltip">
												{#each getTooltipContent(shade).split('\n') as line, i}
													{#if i === 0}
														<strong>{line}</strong>
													{:else}
														<br>{line}
													{/if}
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	/* Charts grid layout */
	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.chart-container {
		background: #f8fafc;
		border-radius: 0.75rem;
		padding: 1rem;
		border: 1px solid #e2e8f0;
	}

	.chart-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #334155;
		margin-bottom: 0.75rem;
		text-align: center;
	}

	.chart-actions {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 0.35rem;
	}

	.chart-download {
		border-radius: 0.375rem;
		border: 1px solid #cbd5e1;
		background: #fff;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.chart-download:hover {
		border-color: #94a3b8;
		color: #0f172a;
	}

	.chart-svg-host {
		max-height: 300px;
		min-height: 240px;
	}

	/* Brand sections */
	.brand-section {
		padding: 1.25rem;
		background: #f8fafc;
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
	}

	.brand-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.brand-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1e293b;
	}

	.shade-count {
		background: #2563eb;
		color: white;
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 500;
	}

	/* Color swatches grid */
	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
		gap: 6px;
	}

	.color-swatch {
		aspect-ratio: 1;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
		position: relative;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.color-swatch:hover {
		transform: scale(1.25);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		z-index: 10;
	}

	/* Tooltip styling */
	.tooltip {
		position: absolute;
		bottom: 120%;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: white;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
		z-index: 20;
		max-width: 500px;
		text-align: center;
		line-height: 1.4;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.color-swatch:hover .tooltip {
		opacity: 1;
	}

	.tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 5px solid transparent;
		border-top-color: #1e293b;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.charts-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.chart-container {
			padding: 0.875rem;
		}

		.brand-section {
			padding: 1rem;
		}

		.color-grid {
			grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
			gap: 4px;
		}
	}
</style>

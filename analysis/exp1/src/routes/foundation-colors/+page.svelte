<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

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

	// Chart references
	let chartInstances: Chart[] = [];

	function createHistogram(ctx: CanvasRenderingContext2D, values: number[], label: string, color: string, bins: number = 20) {
		const min = Math.min(...values);
		const max = Math.max(...values);
		const binWidth = (max - min) / bins;
		const binData = new Array(bins).fill(0);
		const binLabels: string[] = [];

		for (let i = 0; i < bins; i++) {
			const binStart = min + i * binWidth;
			const binEnd = min + (i + 1) * binWidth;
			binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
		}

		values.forEach(value => {
			const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
			binData[binIndex]++;
		});

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: binLabels,
				datasets: [{
					label: `${label} Distribution`,
					data: binData,
					backgroundColor: color + '80',
					borderColor: color,
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }
				},
				scales: {
					y: {
						beginAtZero: true,
						title: { display: true, text: 'Count' }
					},
					x: {
						title: { display: true, text: label }
					}
				}
			}
		});
		chartInstances.push(chart);
	}

	function createScatterPlot(
		ctx: CanvasRenderingContext2D,
		labValues: LabColor[],
		xKey: 'L' | 'A' | 'B',
		yKey: 'L' | 'A' | 'B',
		title: string,
		shadeData: ShadeData[]
	) {
		const scatterData = labValues.map((lab, index) => ({
			x: lab[xKey],
			y: lab[yKey],
			backgroundColor: shadeData[index].hex
		}));

		const chart = new Chart(ctx, {
			type: 'scatter',
			data: {
				datasets: [{
					label: title,
					data: scatterData,
					backgroundColor: scatterData.map(point => point.backgroundColor),
					borderColor: scatterData.map(point => point.backgroundColor),
					borderWidth: 1,
					pointRadius: 3,
					pointHoverRadius: 5
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: function(context) {
								const shade = shadeData[context.dataIndex];
								const x = context.parsed?.x ?? 0;
								const y = context.parsed?.y ?? 0;
								return [
									`${xKey}*: ${x.toFixed(1)}`,
									`${yKey}*: ${y.toFixed(1)}`,
									`Brand: ${shade.brand}`,
									`Shade: ${shade.name || shade.specific || 'Unknown'}`
								];
							}
						}
					}
				},
				scales: {
					x: { title: { display: true, text: `${xKey}*` } },
					y: { title: { display: true, text: `${yKey}*` } }
				}
			}
		});
		chartInstances.push(chart);
	}

	onMount(() => {
		// Load data
		(async () => {
			try {
				const response = await fetch('/foundation-names/allShades.csv');
				const csvText = await response.text();
				const result = parseCSV(csvText);
				data = result.data;
				excludedCount = result.excludedCount;
				brandData = processData(data);
				loading = false;

				// Create charts after data is loaded
				setTimeout(() => {
					const labValues = data.map(shade => hexToLab(shade.hex));

					// Get canvas contexts
					const lightnessCtx = (document.getElementById('lightnessChart') as HTMLCanvasElement)?.getContext('2d');
					const aCtx = (document.getElementById('aChart') as HTMLCanvasElement)?.getContext('2d');
					const bCtx = (document.getElementById('bChart') as HTMLCanvasElement)?.getContext('2d');
					const scatterLaCtx = (document.getElementById('scatterLaChart') as HTMLCanvasElement)?.getContext('2d');
					const scatterLbCtx = (document.getElementById('scatterLbChart') as HTMLCanvasElement)?.getContext('2d');
					const scatterAbCtx = (document.getElementById('scatterAbChart') as HTMLCanvasElement)?.getContext('2d');

					if (lightnessCtx) createHistogram(lightnessCtx, labValues.map(lab => lab.L), 'L* (Lightness)', '#667eea', 20);
					if (aCtx) createHistogram(aCtx, labValues.map(lab => lab.A), 'a* (Red-Green)', '#e74c3c', 20);
					if (bCtx) createHistogram(bCtx, labValues.map(lab => lab.B), 'b* (Yellow-Blue)', '#f39c12', 20);

					if (scatterLaCtx) createScatterPlot(scatterLaCtx, labValues, 'L', 'A', 'L* vs a*', data);
					if (scatterLbCtx) createScatterPlot(scatterLbCtx, labValues, 'L', 'B', 'L* vs b*', data);
					if (scatterAbCtx) createScatterPlot(scatterAbCtx, labValues, 'A', 'B', 'a* vs b*', data);
				}, 100);
			} catch (error) {
				console.error('Error loading data:', error);
				loading = false;
			}
		})();

		// Cleanup charts on unmount
		return () => {
			chartInstances.forEach(chart => chart.destroy());
		};
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
						<canvas id="lightnessChart" class="chart-canvas"></canvas>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">a* (Red-Green) Distribution</h3>
						<canvas id="aChart" class="chart-canvas"></canvas>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">b* (Yellow-Blue) Distribution</h3>
						<canvas id="bChart" class="chart-canvas"></canvas>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">L* vs a* Scatter Plot</h3>
						<canvas id="scatterLaChart" class="chart-canvas"></canvas>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">L* vs b* Scatter Plot</h3>
						<canvas id="scatterLbChart" class="chart-canvas"></canvas>
					</div>

					<div class="chart-container">
						<h3 class="chart-title">a* vs b* Scatter Plot</h3>
						<canvas id="scatterAbChart" class="chart-canvas"></canvas>
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

	.chart-canvas {
		max-height: 280px;
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

<script lang="ts" module>
	export type HistogramBin = {
		end: number;
		expertCount: number;
		label: string;
		nonExpertCount: number;
		start: number;
		totalCount: number;
	};

	type RectGeom = { height: number; width: number; x: number; y: number };

	export type ChartMode =
		| 'total'
		| 'grouped'
		| 'stacked'
		| 'expertOnly'
		| 'nonExpertOnly';
</script>

<script lang="ts">
	import * as d3 from 'd3';
	import { downloadSvgElement } from '$lib/svgDownload';

	type Props = {
		bins: HistogramBin[];
		maxVisibleVolume: number;
		omittedCount: number;
		visibleParticipantCount: number;
	};

	let { bins, maxVisibleVolume, omittedCount, visibleParticipantCount }: Props = $props();

	let chartContainer = $state<HTMLDivElement | undefined>(undefined);
	let chartMode = $state<ChartMode>('grouped');
	const redrawFingerprint = $derived.by(() =>
		[
			chartMode,
			maxVisibleVolume,
			omittedCount,
			visibleParticipantCount,
			...bins.flatMap((bin) => [
				bin.start,
				bin.end,
				bin.expertCount,
				bin.nonExpertCount,
				bin.totalCount
			])
		].join('|')
	);

	const COLOR_EXPERT = '#0072B2';
	const COLOR_NON_EXPERT = '#D55E00';
	const COLOR_TOTAL = '#475569';
	const COLOR_EXPERIENCED_LABEL = 'Color Experienced';
	const COLOR_NON_EXPERIENCED_LABEL = 'Color Non-Experienced';

	const margin = { bottom: 78, left: 64, right: 28, top: 52 };
	const outerWidth = 1200;
	const outerHeight = 430;
	const INNER_PAD = 0.1;
	const Y_AXIS_HEADROOM = 2;
	const LEGEND_WIDTH = 188;
	const LEGEND_PADDING_X = 16;
	const LEGEND_PADDING_Y = 16;
	const LEGEND_ROW_HEIGHT = 24;
	const LEGEND_SWATCH_SIZE = 12;

	const MODE_OPTIONS: { id: ChartMode; label: string; title: string }[] = [
		{
			id: 'total',
			label: 'Total',
			title: 'One bar per bin: Expert + Non-Expert counts combined'
		},
		{
			id: 'grouped',
			label: 'Expert & Non-Expert',
			title: 'Grouped bars side by side'
		},
		{
			id: 'stacked',
			label: 'Stacked',
			title: 'Expert segment below, Non-Expert segment above'
		},
		{
			id: 'expertOnly',
			label: 'Expert only',
			title: 'Expert counts, full bin width'
		},
		{
			id: 'nonExpertOnly',
			label: 'Non-Expert only',
			title: 'Non-Expert counts, full bin width'
		}
	];
	const legendItems = $derived.by(() => {
		const items = [];

		if (chartMode === 'total') {
			items.push({ color: COLOR_TOTAL, label: 'Total' });
			return items;
		}

		if (chartMode === 'expertOnly') {
			items.push({ color: COLOR_EXPERT, label: COLOR_EXPERIENCED_LABEL });
			return items;
		}

		if (chartMode === 'nonExpertOnly') {
			items.push({ color: COLOR_NON_EXPERT, label: COLOR_NON_EXPERIENCED_LABEL });
			return items;
		}

		items.push({ color: COLOR_EXPERT, label: COLOR_EXPERIENCED_LABEL });
		items.push({ color: COLOR_NON_EXPERT, label: COLOR_NON_EXPERIENCED_LABEL });
		return items;
	});

	function plotInnerSize() {
		const width = outerWidth - margin.left - margin.right;
		const height = outerHeight - margin.top - margin.bottom;
		return { height, width };
	}

	function peakForMode(mode: ChartMode, binList: HistogramBin[]): number {
		if (!binList.length) {
			return 1;
		}
		let maxVal = 1;
		for (const bin of binList) {
			switch (mode) {
				case 'total':
				case 'stacked':
					maxVal = Math.max(maxVal, bin.expertCount + bin.nonExpertCount);
					break;
				case 'grouped':
					maxVal = Math.max(maxVal, bin.expertCount, bin.nonExpertCount);
					break;
				case 'expertOnly':
					maxVal = Math.max(maxVal, bin.expertCount);
					break;
				case 'nonExpertOnly':
					maxVal = Math.max(maxVal, bin.nonExpertCount);
					break;
				default:
					maxVal = Math.max(
						maxVal,
						bin.expertCount,
						bin.nonExpertCount,
						bin.expertCount + bin.nonExpertCount
					);
			}
		}
		return Math.max(1, maxVal);
	}

	function computeScales(mode: ChartMode, binList: HistogramBin[]) {
		const { height, width } = plotInnerSize();
		const yMax = peakForMode(mode, binList) + Y_AXIS_HEADROOM;
		const x = d3.scaleLinear().domain([0, maxVisibleVolume]).range([0, width]);
		const y = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);
		return { height, width, x, y };
	}

	function binBand(bin: HistogramBin, x: d3.ScaleLinear<number, number>) {
		const xL = x(bin.start);
		const xR = x(bin.end);
		const band = Math.max(0, xR - xL);
		const gap = band * INNER_PAD;
		const pairW = Math.max(0, band - gap);
		const x0 = xL + gap / 2;
		return { pairW, x0 };
	}

	function computeBarLayout(
		mode: ChartMode,
		bin: HistogramBin,
		x: d3.ScaleLinear<number, number>,
		y: d3.ScaleLinear<number, number>,
		plotHeight: number
	): {
		expert: { geom: RectGeom; visible: boolean };
		nonExpert: { geom: RectGeom; visible: boolean };
		total: { geom: RectGeom; visible: boolean };
	} {
		const { pairW, x0 } = binBand(bin, x);
		const expert = bin.expertCount;
		const nonExpert = bin.nonExpertCount;
		const sum = expert + nonExpert;
		const baselineY = y(0);

		const yExpert = y(expert);
		const hExpert = Math.max(0, baselineY - yExpert);
		const yNonExpert = y(nonExpert);
		const hNonExpert = Math.max(0, baselineY - yNonExpert);
		const ySum = y(sum);
		const hSum = Math.max(0, baselineY - ySum);

		const zero: RectGeom = { height: 0, width: 0, x: x0 + pairW / 2, y: baselineY };

		if (mode === 'total') {
			return {
				expert: { geom: zero, visible: false },
				nonExpert: { geom: zero, visible: false },
				total: { geom: { height: hSum, width: pairW, x: x0, y: ySum }, visible: true }
			};
		}

		if (mode === 'stacked') {
			const yExpertTop = y(expert);
			const hExpertSegment = Math.max(0, y(0) - yExpertTop);
			const yNonExpertTop = y(expert + nonExpert);
			const hNonExpertSegment = Math.max(0, yExpertTop - yNonExpertTop);
			return {
				expert: {
					geom: { height: hExpertSegment, width: pairW, x: x0, y: yExpertTop },
					visible: true
				},
				nonExpert: {
					geom: { height: hNonExpertSegment, width: pairW, x: x0, y: yNonExpertTop },
					visible: true
				},
				total: { geom: zero, visible: false }
			};
		}

		if (mode === 'grouped') {
			const half = pairW / 2;
			return {
				expert: {
					geom: { height: hExpert, width: half, x: x0, y: yExpert },
					visible: true
				},
				nonExpert: {
					geom: { height: hNonExpert, width: half, x: x0 + half, y: yNonExpert },
					visible: true
				},
				total: { geom: zero, visible: false }
			};
		}

		if (mode === 'expertOnly') {
			return {
				expert: { geom: { height: hExpert, width: pairW, x: x0, y: yExpert }, visible: true },
				nonExpert: { geom: { ...zero, x: x0 + pairW / 2 }, visible: false },
				total: { geom: zero, visible: false }
			};
		}

		return {
			expert: { geom: { ...zero, x: x0 + pairW / 2 }, visible: false },
			nonExpert: {
				geom: { height: hNonExpert, width: pairW, x: x0, y: yNonExpert },
				visible: true
			},
			total: { geom: zero, visible: false }
		};
	}

	function shouldShowXAxisLabel(value: number): boolean {
		const step = 500;
		const index = Math.round(value / step);
		if (Math.abs(value - index * step) > 1e-6) {
			return false;
		}
		if (index === 0 || index === 1) {
			return true;
		}
		return index >= 3 && index % 2 === 1;
	}

	$effect(() => {
		if (!chartContainer || !bins.length) {
			return;
		}

		redrawFingerprint;
		const mode = chartMode;
		const { height, width, x, y } = computeScales(mode, bins);
		const svg = d3
			.select(chartContainer)
			.html('')
			.append('svg')
			.attr('xmlns', 'http://www.w3.org/2000/svg')
			.attr('viewBox', `0 0 ${outerWidth} ${outerHeight}`)
			.attr('width', '100%')
			.attr('height', 'auto')
			.attr('role', 'img')
			.attr('aria-label', 'Histogram of ellipsoid volumes by expertise group');

		const root = svg
			.append('g')
			.attr('font-family', "Helvetica Neue, Helvetica, Arial, ui-sans-serif, system-ui, sans-serif")
			.attr('transform', `translate(${margin.left},${margin.top})`);

		root
			.append('g')
			.attr('class', 'grid')
			.call(
				d3
					.axisLeft(y)
					.ticks(8)
					.tickSize(-width)
					.tickFormat(() => '')
			)
			.call((axis) => axis.select('.domain').remove())
			.selectAll('.tick line')
			.attr('stroke', '#e5e7eb')
			.attr('stroke-width', 1);

		const barGroups = root
			.append('g')
			.attr('class', 'bar-layer')
			.selectAll('g')
			.data(bins)
			.join('g');

		barGroups.each(function (bin) {
			const g = d3.select(this);
			const layout = computeBarLayout(mode, bin, x, y, height);

			g.append('rect')
				.attr('class', 'bar-total')
				.attr('x', layout.total.geom.x)
				.attr('y', layout.total.geom.y)
				.attr('width', layout.total.geom.width)
				.attr('height', layout.total.geom.height)
				.attr('rx', 1)
				.attr('ry', 1)
				.attr('fill', COLOR_TOTAL)
				.attr('stroke', '#1f2937')
				.attr('stroke-width', 0.75)
				.attr('opacity', layout.total.visible ? 1 : 0)
				.attr('pointer-events', layout.total.visible ? 'auto' : 'none');

			g.append('rect')
				.attr('class', 'bar-expert')
				.attr('x', layout.expert.geom.x)
				.attr('y', layout.expert.geom.y)
				.attr('width', layout.expert.geom.width)
				.attr('height', layout.expert.geom.height)
				.attr('rx', 1)
				.attr('ry', 1)
				.attr('fill', COLOR_EXPERT)
				.attr('stroke', '#1f2937')
				.attr('stroke-width', 0.75)
				.attr('opacity', layout.expert.visible ? 1 : 0)
				.attr('pointer-events', layout.expert.visible ? 'auto' : 'none');

			g.append('rect')
				.attr('class', 'bar-non-expert')
				.attr('x', layout.nonExpert.geom.x)
				.attr('y', layout.nonExpert.geom.y)
				.attr('width', layout.nonExpert.geom.width)
				.attr('height', layout.nonExpert.geom.height)
				.attr('rx', 1)
				.attr('ry', 1)
				.attr('fill', COLOR_NON_EXPERT)
				.attr('stroke', '#1f2937')
				.attr('stroke-width', 0.75)
				.attr('opacity', layout.nonExpert.visible ? 1 : 0)
				.attr('pointer-events', layout.nonExpert.visible ? 'auto' : 'none');
		});

		const xTickStep = 500;
		const xTickValues = d3.range(0, maxVisibleVolume + xTickStep, xTickStep);

		const xAxisG = root.append('g').attr('transform', `translate(0,${height})`);

		xAxisG
			.call(
				d3
					.axisBottom(x)
					.tickValues(xTickValues)
					.tickSizeOuter(6)
					.tickSize(6)
					.tickFormat((d) => (shouldShowXAxisLabel(+d) ? d3.format('d')(+d) : ''))
			)
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', '#111827').attr('stroke-width', 1);
				axis.selectAll('.tick line').attr('stroke', '#111827').attr('y2', 6);
				axis
					.selectAll('text')
					.attr('fill', '#374151')
					.style('font-size', '11px')
					.attr('y', 12)
					.style('text-anchor', 'middle');
			});

		root
			.append('g')
			.call(d3.axisLeft(y).ticks(8).tickFormat(d3.format('d')))
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', '#111827').attr('stroke-width', 1);
				axis.selectAll('.tick line').attr('stroke', '#111827').attr('x2', -6);
				axis.selectAll('text').attr('fill', '#374151').style('font-size', '11px');
			});

		root
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + 56)
			.attr('text-anchor', 'middle')
			.attr('fill', '#111827')
			.style('font-size', '12px')
			.text('Ellipsoid volume');

		root
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -margin.left + 20)
			.attr('text-anchor', 'middle')
			.attr('fill', '#111827')
			.style('font-size', '12px')
			.text('Number of participants');

		svg
			.append('text')
			.attr('x', margin.left)
			.attr('y', 38)
			.attr('fill', '#0f172a')
			.style('font-size', '13px')
			.style('font-weight', '600')
			.text('Distribution of discrimination ellipsoid volumes');

		const omittedNote = `${visibleParticipantCount.toLocaleString()} participants within ≤${maxVisibleVolume.toLocaleString()} ellipsoid units³; ${omittedCount.toLocaleString()} beyond range omitted from bins.`;
		svg
			.append('text')
			.attr('x', margin.left)
			.attr('y', outerHeight - 10)
			.attr('fill', '#6b7280')
			.style('font-size', '10px')
			.text(omittedNote);

		const legend = svg
			.append('g')
			.attr(
				'transform',
				`translate(${outerWidth - margin.right - LEGEND_WIDTH},${margin.top + 4})`
			);

		legend
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', LEGEND_WIDTH)
			.attr('height', legendItems.length * LEGEND_ROW_HEIGHT + LEGEND_PADDING_Y * 2)
			.attr('rx', 10)
			.attr('fill', 'rgba(255,255,255,0.9)')
			.attr('stroke', '#cbd5e1')
			.attr('stroke-width', 1);

		legend
			.selectAll('g')
			.data(legendItems)
			.join('g')
			.attr(
				'transform',
				(_, index) => `translate(${LEGEND_PADDING_X}, ${LEGEND_PADDING_Y + index * LEGEND_ROW_HEIGHT})`
			)
			.call((groups) => {
				groups
					.append('rect')
					.attr('width', LEGEND_SWATCH_SIZE)
					.attr('height', LEGEND_SWATCH_SIZE)
					.attr('rx', 2)
					.attr('y', -LEGEND_SWATCH_SIZE + 2)
					.attr('fill', (item) => item.color)
					.attr('stroke', '#1f2937')
					.attr('stroke-width', 0.8);

				groups
					.append('text')
					.attr('x', LEGEND_SWATCH_SIZE + 10)
					.attr('y', 2)
					.attr('fill', '#334155')
					.style('font-size', '12px')
					.style('font-weight', '500')
					.text((item) => item.label);
			});
	});

	function downloadSvg() {
		const svg = chartContainer?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'perception-histogram.svg');
	}
</script>

<div
	class="chart-surface relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white pt-14"
>
	<div
		class="pointer-events-auto absolute left-3 right-3 top-3 z-10 flex flex-col gap-2 sm:left-4 sm:right-4"
		role="toolbar"
		aria-label="Chart display mode"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">View</p>
			<button
				type="button"
				class="rounded border border-slate-300 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur hover:border-slate-400"
				onclick={downloadSvg}>Download SVG</button
			>
		</div>
		<div class="flex flex-wrap gap-1.5 sm:gap-2">
			{#each MODE_OPTIONS as option (option.id)}
				<button
					type="button"
					class="mode-chip rounded-full border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 sm:px-3 sm:text-sm"
					class:mode-chip--active={chartMode === option.id}
					title={option.title}
					aria-pressed={chartMode === option.id}
					onclick={() => {
						chartMode = option.id;
					}}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<div bind:this={chartContainer} class="chart-svg-host"></div>
</div>

<style>
	.chart-surface {
		min-height: 320px;
	}

	.chart-svg-host :global(svg) {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.mode-chip {
		background: rgba(255, 255, 255, 0.92);
		border-color: rgba(226, 232, 240, 0.95);
		color: #475569;
		backdrop-filter: blur(8px);
	}

	.mode-chip:hover {
		border-color: rgba(148, 163, 184, 0.85);
		color: #0f172a;
	}

	.mode-chip--active {
		background: linear-gradient(180deg, rgba(13, 148, 136, 0.12), rgba(255, 255, 255, 0.95));
		border-color: rgba(13, 148, 136, 0.45);
		color: #0f172a;
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset;
	}
</style>

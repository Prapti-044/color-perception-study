import * as d3 from 'd3';
import {
	CHART_FONT,
	CHART_FONT_FAMILY,
	CHART_MUTED_FILL,
	CHART_TEXT_FILL,
	styleAxisGroup
} from './chartTheme';

export type JndLineSeries = {
	label: string;
	color: string;
	strokeDasharray?: string;
	points: { x: number; y: number }[];
};

export type JndScatterSeries = {
	label: string;
	color: string;
	shape: 'circle' | 'diamond';
	points: { x: number; y: number; yMin?: number; yMax?: number }[];
};

/** Color channel encodes the axis (one entry per L*, a*, b*). */
export type JndLegendColorItem = { label: string; color: string };
/** Line-style + marker channel encodes the study/group (solid vs dashed, circle vs diamond). */
export type JndLegendStyleItem = {
	label: string;
	dash?: string;
	shape?: 'circle' | 'diamond';
};

/**
 * Compact, de-duplicated legend: the color sub-legend lists axes once, and the
 * style sub-legend lists studies/groups once, instead of the axis×study cross product.
 */
export type JndLegend = {
	colorItems: JndLegendColorItem[];
	styleItems: JndLegendStyleItem[];
};

type JndChartOptions = {
	title: string;
	xLabel: string;
	yLabel: string;
	lineSeries: JndLineSeries[];
	scatterSeries: JndScatterSeries[];
	legend: JndLegend;
	/** Required so the x-axis matches the fitted model range (e.g. 0 to max point diameter). */
	xDomain: [number, number];
	yDomain?: [number, number];
	outerWidth?: number;
	outerHeight?: number;
};

const DEFAULT_W = 880;
const DEFAULT_H = 480;
const MARGIN = { top: 32, right: 28, bottom: 72, left: 80 };

/** Minimum point diameter (visual angle °) shown on JND comparison plots. */
export const JND_PLOT_X_MIN = 0.2;

/** Minimum y-axis value for JND comparison plots. */
export const JND_PLOT_Y_MIN = 3.5;

/** Dash pattern for reference / comparison curves (plot + legend). */
export const JND_DASH_PATTERN = '10 6';

/**
 * Renders the main JND comparison plot as SVG and returns the root element.
 */
export function renderJndComparisonChart(
	container: HTMLElement,
	opts: JndChartOptions
): SVGSVGElement {
	const outerW = opts.outerWidth ?? DEFAULT_W;
	const outerH = opts.outerHeight ?? DEFAULT_H;
	const innerW = outerW - MARGIN.left - MARGIN.right;
	const innerH = outerH - MARGIN.top - MARGIN.bottom;

	const allY: number[] = [];
	for (const s of opts.lineSeries) {
		for (const p of s.points) allY.push(p.y);
	}
	for (const s of opts.scatterSeries) {
		for (const p of s.points) {
			allY.push(p.y);
			if (p.yMin !== undefined) allY.push(p.yMin);
			if (p.yMax !== undefined) allY.push(p.yMax);
		}
	}
	const yMax = d3.max(allY) ?? 1;
	const yMin = 0;

	const [x0, x1] = opts.xDomain;
	const y0 = opts.yDomain?.[0] ?? yMin;
	const y1 = opts.yDomain?.[1] ?? yMax;

	const xScale = d3.scaleLinear().domain([x0, x1]).range([0, innerW]);
	const yScale = d3.scaleLinear().domain([y0, y1]).range([innerH, 0]);

	const lineGen = d3
		.line<{ x: number; y: number }>()
		.x((d) => xScale(d.x))
		.y((d) => yScale(d.y));

	d3.select(container).selectAll('*').remove();

	const svg = d3
		.select(container)
		.append('svg')
		.attr('xmlns', 'http://www.w3.org/2000/svg')
		.attr('viewBox', `0 0 ${outerW} ${outerH}`)
		.attr('width', '100%')
		.attr('height', '100%')
		.attr('role', 'img')
		.attr('aria-label', opts.title);

	const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

	g.append('g')
		.attr('transform', `translate(0,${innerH})`)
		.call(d3.axisBottom(xScale).ticks(12))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#94a3b8'))
		.call((sel) => styleAxisGroup(sel));

	g.append('g')
		.call(d3.axisLeft(yScale).ticks(8))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#94a3b8'))
		.call((sel) => styleAxisGroup(sel));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 54)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.axisLabel)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL)
		.text(opts.xLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -44)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.axisLabel)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL)
		.text(opts.yLabel);

	for (const series of opts.lineSeries) {
		g.append('path')
			.datum(series.points)
			.attr('fill', 'none')
			.attr('stroke', series.color)
			.attr('stroke-width', 2.25)
			.attr('stroke-linejoin', 'round')
			.attr('stroke-linecap', 'round')
			.attr('stroke-dasharray', series.strokeDasharray ?? '')
			.attr('d', lineGen);
	}

	for (const series of opts.scatterSeries) {
		for (const p of series.points) {
			const cx = xScale(p.x);
			const cy = yScale(p.y);
			if (p.yMin !== undefined && p.yMax !== undefined) {
				const y1 = yScale(p.yMin);
				const y2 = yScale(p.yMax);
				g.append('line')
					.attr('x1', cx)
					.attr('x2', cx)
					.attr('y1', y2)
					.attr('y2', y1)
					.attr('stroke', series.color)
					.attr('stroke-width', 1.5);
				const cap = 4;
				g.append('line')
					.attr('x1', cx - cap)
					.attr('x2', cx + cap)
					.attr('y1', y2)
					.attr('y2', y2)
					.attr('stroke', series.color)
					.attr('stroke-width', 1.5);
				g.append('line')
					.attr('x1', cx - cap)
					.attr('x2', cx + cap)
					.attr('y1', y1)
					.attr('y2', y1)
					.attr('stroke', series.color)
					.attr('stroke-width', 1.5);
			}

			if (series.shape === 'circle') {
				g.append('circle')
					.attr('cx', cx)
					.attr('cy', cy)
					.attr('r', 6)
					.attr('fill', series.color)
					.attr('stroke', series.color)
					.attr('stroke-width', 1);
			} else {
				const s = 5;
				g.append('path')
					.attr(
						'd',
						`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`
					)
					.attr('fill', 'none')
					.attr('stroke', series.color)
					.attr('stroke-width', 2);
			}
		}
	}

	const legendPadding = 8;
	const legendRowHeight = 28;
	const sectionGap = 8;
	const titleLegendGap = 36;
	const colorSwatchW = 26;
	const styleSwatchW = 50;
	const styleLineEnd = 36;
	const styleMarkerX = 44;
	const styleStrokeW = 3;
	const colorTextX = colorSwatchW + 8;
	const styleTextX = styleSwatchW + 8;
	const styleStroke = CHART_TEXT_FILL;

	const legendBlock = g.append('g').attr('class', 'legend-block');

	const title = legendBlock
		.append('text')
		.attr('class', 'chart-inset-title')
		.attr('font-size', CHART_FONT.titleInset)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('font-weight', '600')
		.attr('fill', CHART_TEXT_FILL)
		.text(opts.title);

	const legend = legendBlock.append('g').attr('class', 'legend');
	let legendY = 0;

	for (const item of opts.legend.colorItems) {
		const row = legend.append('g').attr('transform', `translate(0,${legendY})`);
		row
			.append('line')
			.attr('x1', 0)
			.attr('x2', colorSwatchW)
			.attr('y1', 7)
			.attr('y2', 7)
			.attr('stroke', item.color)
			.attr('stroke-width', styleStrokeW)
			.attr('stroke-linecap', 'round');
		row
			.append('text')
			.attr('x', colorTextX)
			.attr('y', 13)
			.attr('font-size', CHART_FONT.legend)
			.attr('font-family', CHART_FONT_FAMILY)
			.attr('fill', CHART_TEXT_FILL)
			.text(item.label);
		legendY += legendRowHeight;
	}

	if (opts.legend.colorItems.length > 0 && opts.legend.styleItems.length > 0) {
		legendY += sectionGap;
	}

	for (const item of opts.legend.styleItems) {
		const row = legend.append('g').attr('transform', `translate(0,${legendY})`);
		const dash = item.dash ?? '';
		row
			.append('line')
			.attr('x1', 0)
			.attr('x2', styleLineEnd)
			.attr('y1', 7)
			.attr('y2', 7)
			.attr('stroke', styleStroke)
			.attr('stroke-width', styleStrokeW)
			.attr('stroke-linecap', 'round')
			.attr('stroke-dasharray', dash);
		if (item.shape === 'circle') {
			row
				.append('circle')
				.attr('cx', styleMarkerX)
				.attr('cy', 7)
				.attr('r', 4.5)
				.attr('fill', styleStroke)
				.attr('stroke', styleStroke)
				.attr('stroke-width', 1);
		} else if (item.shape === 'diamond') {
			const s = 4.5;
			row
				.append('path')
				.attr(
					'd',
					`M ${styleMarkerX} ${7 - s} L ${styleMarkerX + s} 7 L ${styleMarkerX} ${7 + s} L ${styleMarkerX - s} 7 Z`
				)
				.attr('fill', 'none')
				.attr('stroke', styleStroke)
				.attr('stroke-width', 2);
		}
		row
			.append('text')
			.attr('x', styleTextX)
			.attr('y', 13)
			.attr('font-size', CHART_FONT.legend)
			.attr('font-family', CHART_FONT_FAMILY)
			.attr('fill', CHART_TEXT_FILL)
			.text(item.label);
		legendY += legendRowHeight;
	}

	const legendNode = legend.node() as SVGGElement | null;
	const titleNode = title.node() as SVGTextElement | null;
	if (legendNode && titleNode) {
		const titleBbox = titleNode.getBBox();
		const legendBbox = legendNode.getBBox();
		const blockWidth = Math.max(titleBbox.width, legendBbox.width);
		const legendStartY = titleBbox.y + titleBbox.height + titleLegendGap;

		title.attr('x', blockWidth).attr('y', CHART_FONT.titleInset).attr('text-anchor', 'end');

		legend.attr(
			'transform',
			`translate(${blockWidth - legendBbox.width}, ${legendStartY})`
		);

		const blockNode = legendBlock.node() as SVGGElement | null;
		const blockBbox = blockNode?.getBBox();
		if (blockBbox) {
			legendBlock.attr(
				'transform',
				`translate(${innerW - blockBbox.width - legendPadding}, ${legendPadding})`
			);
		}
	}

	return svg.node() as SVGSVGElement;
}

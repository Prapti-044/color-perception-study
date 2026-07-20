import * as d3 from 'd3';
import {
	CHART_FONT,
	CHART_FONT_FAMILY,
	CHART_MUTED_FILL,
	CHART_TEXT_FILL,
	styleAxisGroup
} from './chartTheme';

export type MultiScatterPoint = {
	x: number;
	y: number;
	fill: string;
};

export type MultiColorScatterSpec = {
	title: string;
	xLabel: string;
	yLabel: string;
	points: MultiScatterPoint[];
};

const DEFAULT_W = 480;
const DEFAULT_H = 320;

export function renderMultiColorScatterChart(
	container: HTMLElement,
	spec: MultiColorScatterSpec,
	size: { width: number; height: number } = { width: DEFAULT_W, height: DEFAULT_H }
): SVGSVGElement {
	const margin = { top: 48, right: 20, bottom: 58, left: 58 };
	const width = size.width;
	const height = size.height;
	const innerW = width - margin.left - margin.right;
	const innerH = height - margin.top - margin.bottom;

	const xs = spec.points.map((p) => p.x);
	const ys = spec.points.map((p) => p.y);
	const xScale = d3
		.scaleLinear()
		.domain([(d3.min(xs) ?? 0) - 2, (d3.max(xs) ?? 1) + 2])
		.range([0, innerW]);
	const yScale = d3
		.scaleLinear()
		.domain([(d3.min(ys) ?? 0) - 2, (d3.max(ys) ?? 1) + 2])
		.range([innerH, 0]);

	d3.select(container).selectAll('*').remove();

	const svg = d3
		.select(container)
		.append('svg')
		.attr('xmlns', 'http://www.w3.org/2000/svg')
		.attr('viewBox', `0 0 ${width} ${height}`)
		.attr('width', '100%')
		.attr('height', '100%')
		.attr('role', 'img')
		.attr('aria-label', spec.title);

	svg
		.append('text')
		.attr('x', width / 2)
		.attr('y', 24)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.titleCompact)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('font-weight', '600')
		.attr('fill', CHART_TEXT_FILL)
		.text(spec.title);

	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

	g.append('g')
		.attr('transform', `translate(0,${innerH})`)
		.call(d3.axisBottom(xScale).ticks(8))
		.call((sel) => styleAxisGroup(sel, CHART_FONT.tickCompact));

	g.append('g')
		.call(d3.axisLeft(yScale).ticks(8))
		.call((sel) => styleAxisGroup(sel, CHART_FONT.tickCompact));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 44)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.axisLabel)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL)
		.text(spec.xLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -44)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.axisLabel)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL)
		.text(spec.yLabel);

	g.selectAll('circle.pt')
		.data(spec.points)
		.join('circle')
		.attr('class', 'pt')
		.attr('cx', (d) => xScale(d.x))
		.attr('cy', (d) => yScale(d.y))
		.attr('r', 3)
		.attr('fill', (d) => d.fill)
		.attr('stroke', (d) => d.fill)
		.attr('stroke-width', 0.5);

	return svg.node() as SVGSVGElement;
}

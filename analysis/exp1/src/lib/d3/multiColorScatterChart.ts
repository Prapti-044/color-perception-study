import * as d3 from 'd3';

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
	const margin = { top: 44, right: 20, bottom: 52, left: 52 };
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
		.attr('y', 22)
		.attr('text-anchor', 'middle')
		.attr('font-size', 12)
		.attr('font-weight', '600')
		.attr('fill', '#334155')
		.text(spec.title);

	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

	g.append('g')
		.attr('transform', `translate(0,${innerH})`)
		.call(d3.axisBottom(xScale).ticks(8));

	g.append('g').call(d3.axisLeft(yScale).ticks(8));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 40)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.attr('fill', '#475569')
		.text(spec.xLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -38)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.attr('fill', '#475569')
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

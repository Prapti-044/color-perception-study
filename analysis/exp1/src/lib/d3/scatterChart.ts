import * as d3 from 'd3';

export type ScatterPoint = {
	x: number;
	y: number;
};

export type ScatterChartSpec = {
	title: string;
	xLabel: string;
	yLabel: string;
	points: ScatterPoint[];
	pointColor?: string;
	pointStroke?: string;
	formatX?: (v: number) => string;
	formatY?: (v: number) => string;
};

const DEFAULT_W = 720;
const DEFAULT_H = 420;

export function renderScatterChart(
	container: HTMLElement,
	spec: ScatterChartSpec,
	size: { width: number; height: number } = { width: DEFAULT_W, height: DEFAULT_H }
): SVGSVGElement {
	const margin = { top: 52, right: 28, bottom: 56, left: 64 };
	const width = size.width;
	const height = size.height;
	const innerW = width - margin.left - margin.right;
	const innerH = height - margin.top - margin.bottom;

	const xs = spec.points.map((p) => p.x);
	const ys = spec.points.map((p) => p.y);
	const xMin = (d3.min(xs) ?? 0) * 0.95;
	const xMax = (d3.max(xs) ?? 1) * 1.05;
	const yMin = Math.max(0, (d3.min(ys) ?? 0) * 0.95);
	const yMax = Math.min(100, (d3.max(ys) ?? 1) * 1.05);

	const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);
	const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

	const fmtX = spec.formatX ?? ((v) => String(Math.round(v * 10) / 10));
	const fmtY = spec.formatY ?? ((v) => `${Math.round(v)}%`);

	const fill = spec.pointColor ?? 'rgba(59, 130, 246, 0.55)';
	const stroke = spec.pointStroke ?? 'rgb(37, 99, 235)';

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
		.attr('y', 28)
		.attr('text-anchor', 'middle')
		.attr('font-size', 16)
		.attr('font-weight', '700')
		.attr('fill', '#334155')
		.text(spec.title);

	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

	g.append('g')
		.attr('transform', `translate(0,${innerH})`)
		.call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => fmtX(d as number)))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#cbd5e1'));

	g.append('g')
		.call(d3.axisLeft(yScale).ticks(8).tickFormat((d) => fmtY(d as number)))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#cbd5e1'));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 44)
		.attr('text-anchor', 'middle')
		.attr('font-size', 13)
		.attr('fill', '#475569')
		.text(spec.xLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -48)
		.attr('text-anchor', 'middle')
		.attr('font-size', 13)
		.attr('fill', '#475569')
		.text(spec.yLabel);

	g.selectAll('circle.pt')
		.data(spec.points)
		.join('circle')
		.attr('class', 'pt')
		.attr('cx', (d) => xScale(d.x))
		.attr('cy', (d) => yScale(d.y))
		.attr('r', 6)
		.attr('fill', fill)
		.attr('stroke', stroke)
		.attr('stroke-width', 1);

	return svg.node() as SVGSVGElement;
}

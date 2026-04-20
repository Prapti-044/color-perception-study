import * as d3 from 'd3';

export type HistogramChartSpec = {
	title: string;
	xAxisLabel: string;
	values: number[];
	accentColor: string;
	bins?: number;
};

const DEFAULT_W = 480;
const DEFAULT_H = 280;

export function renderHistogramChart(
	container: HTMLElement,
	spec: HistogramChartSpec,
	size: { width: number; height: number } = { width: DEFAULT_W, height: DEFAULT_H }
): SVGSVGElement {
	const binCount = spec.bins ?? 20;
	const values = spec.values;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const binWidth = (max - min) / binCount || 1;
	const counts = new Array(binCount).fill(0);
	const binLabels: string[] = [];

	for (let i = 0; i < binCount; i++) {
		const binStart = min + i * binWidth;
		const binEnd = min + (i + 1) * binWidth;
		binLabels.push(`${binStart.toFixed(1)}–${binEnd.toFixed(1)}`);
	}

	for (const value of values) {
		const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
		counts[binIndex]++;
	}

	const margin = { top: 44, right: 16, bottom: 88, left: 48 };
	const width = size.width;
	const height = size.height;
	const innerW = width - margin.left - margin.right;
	const innerH = height - margin.top - margin.bottom;

	const x = d3.scaleBand().domain(binLabels).range([0, innerW]).paddingInner(0.15);
	const yMax = Math.max(1, d3.max(counts) ?? 1);
	const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

	const fill = spec.accentColor + 'cc';
	const stroke = spec.accentColor;

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
		.call(d3.axisBottom(x))
		.selectAll('text')
		.attr('transform', 'rotate(-55)')
		.style('text-anchor', 'end')
		.attr('dx', '-0.5em')
		.attr('dy', '0.2em')
		.attr('font-size', 7);

	g.append('g').call(d3.axisLeft(y).ticks(5));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 72)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.attr('fill', '#475569')
		.text(spec.xAxisLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -36)
		.attr('text-anchor', 'middle')
		.attr('font-size', 11)
		.attr('fill', '#475569')
		.text('Count');

	g.selectAll('rect')
		.data(counts)
		.join('rect')
		.attr('x', (_, i) => x(binLabels[i]) ?? 0)
		.attr('y', (d) => y(d))
		.attr('width', x.bandwidth())
		.attr('height', (d) => innerH - y(d))
		.attr('fill', fill)
		.attr('stroke', stroke)
		.attr('stroke-width', 0.5);

	return svg.node() as SVGSVGElement;
}

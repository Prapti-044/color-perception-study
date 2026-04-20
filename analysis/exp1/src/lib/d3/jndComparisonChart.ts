import * as d3 from 'd3';

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

type JndChartOptions = {
	title: string;
	xLabel: string;
	yLabel: string;
	lineSeries: JndLineSeries[];
	scatterSeries: JndScatterSeries[];
	/** Required so the x-axis matches the fitted model range (e.g. 0 to max point diameter). */
	xDomain: [number, number];
	yDomain?: [number, number];
	outerWidth?: number;
	outerHeight?: number;
};

const DEFAULT_W = 880;
const DEFAULT_H = 480;
const MARGIN = { top: 56, right: 200, bottom: 56, left: 64 };

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

	svg
		.append('text')
		.attr('x', outerW / 2)
		.attr('y', 28)
		.attr('text-anchor', 'middle')
		.attr('font-size', 16)
		.attr('font-weight', '700')
		.attr('fill', '#334155')
		.text(opts.title);

	g.append('g')
		.attr('transform', `translate(0,${innerH})`)
		.call(d3.axisBottom(xScale).ticks(12))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#94a3b8'));

	g.append('g')
		.call(d3.axisLeft(yScale).ticks(8))
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#94a3b8'));

	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 44)
		.attr('text-anchor', 'middle')
		.attr('font-size', 13)
		.attr('fill', '#475569')
		.text(opts.xLabel);

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -48)
		.attr('text-anchor', 'middle')
		.attr('font-size', 13)
		.attr('fill', '#475569')
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

	const legendX = innerW + 12;
	let legendY = 8;
	const legendItems = opts.lineSeries.map((s) => ({
		label: s.label,
		color: s.color,
		dash: s.strokeDasharray
	}));

	for (const item of legendItems) {
		const row = g.append('g').attr('transform', `translate(${legendX},${legendY})`);
		row
			.append('line')
			.attr('x1', 0)
			.attr('x2', 28)
			.attr('y1', 7)
			.attr('y2', 7)
			.attr('stroke', item.color)
			.attr('stroke-width', 2.5)
			.attr('stroke-dasharray', item.dash ?? '');
		row
			.append('text')
			.attr('x', 34)
			.attr('y', 11)
			.attr('font-size', 10.5)
			.attr('fill', '#334155')
			.text(item.label);
		legendY += 22;
	}

	return svg.node() as SVGSVGElement;
}

import * as d3 from 'd3';
import {
	CHART_FONT,
	CHART_FONT_FAMILY,
	CHART_MUTED_FILL,
	CHART_TEXT_FILL,
	styleAxisGroup
} from './chartTheme';

export type GroupedBarChartSpec = {
	title: string;
	yLabel: string;
	categories: string[];
	groupLabels: [string, string];
	groupColors: [string, string];
	values: { group1: number; group2: number }[];
	/** If omitted, derived from data. */
	yMax?: number;
	formatY?: (value: number) => string;
};

const DEFAULT_W = 380;
const DEFAULT_H = 230;

export function renderGroupedBarChart(
	container: HTMLElement,
	spec: GroupedBarChartSpec,
	size: { width: number; height: number } = { width: DEFAULT_W, height: DEFAULT_H }
): SVGSVGElement {
	const margin = { top: 48, right: 16, bottom: 60, left: 58 };
	const width = size.width;
	const height = size.height;
	const innerW = width - margin.left - margin.right;
	const innerH = height - margin.top - margin.bottom;

	const maxVal = Math.max(
		0,
		...spec.values.flatMap((v) => [v.group1, v.group2])
	);
	const yMax = spec.yMax ?? (maxVal * 1.12 || 1);

	const x0 = d3
		.scaleBand()
		.domain(spec.categories)
		.rangeRound([0, innerW])
		.paddingInner(0.22);
	const x1 = d3
		.scaleBand()
		.domain(['0', '1'])
		.rangeRound([0, x0.bandwidth()])
		.padding(0.12);
	const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

	const fmt = spec.formatY ?? ((v: number) => String(Math.round(v * 100) / 100));

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
		.call(d3.axisBottom(x0))
		.selectAll('text')
		.attr('transform', 'rotate(-35)')
		.style('text-anchor', 'end')
		.attr('dx', '-0.35em')
		.attr('dy', '0.35em')
		.attr('font-size', CHART_FONT.tickCompact)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL);

	g.append('g')
		.call(
			d3
				.axisLeft(y)
				.ticks(6)
				.tickFormat((d) => fmt(d as number))
		)
		.call((sel) => sel.selectAll('path,line').attr('stroke', '#cbd5e1'))
		.call((sel) => styleAxisGroup(sel, CHART_FONT.tickCompact));

	g.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('x', -innerH / 2)
		.attr('y', -44)
		.attr('text-anchor', 'middle')
		.attr('font-size', CHART_FONT.axisLabel)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL)
		.text(spec.yLabel);

	const cat = g
		.selectAll('g.cat')
		.data(spec.categories)
		.join('g')
		.attr('class', 'cat')
		.attr('transform', (d) => `translate(${x0(d) ?? 0},0)`);

	cat
		.selectAll('rect')
		.data((_, i) => {
			const row = spec.values[i];
			return [
				{ key: '0', value: row.group1, color: spec.groupColors[0] },
				{ key: '1', value: row.group2, color: spec.groupColors[1] }
			];
		})
		.join('rect')
		.attr('x', (d) => x1(d.key) ?? 0)
		.attr('y', (d) => y(d.value))
		.attr('width', x1.bandwidth())
		.attr('height', (d) => innerH - y(d.value))
		.attr('fill', (d) => d.color)
		.attr('stroke', (d) => d.color)
		.attr('stroke-width', 0.5);

	const legendPadding = 8;
	const legendRowHeight = 20;
	const legend = g.append('g').attr('class', 'legend');

	[0, 1].forEach((i) => {
		const lg = legend.append('g').attr('transform', `translate(0,${i * legendRowHeight})`);
		lg.append('rect')
			.attr('width', 12)
			.attr('height', 12)
			.attr('rx', 2)
			.attr('fill', spec.groupColors[i as 0 | 1]);
		lg.append('text')
			.attr('x', 16)
			.attr('y', 10)
			.attr('font-size', CHART_FONT.legend)
			.attr('font-family', CHART_FONT_FAMILY)
			.attr('fill', CHART_TEXT_FILL)
			.text(spec.groupLabels[i as 0 | 1]);
	});

	const legendNode = legend.node() as SVGGElement | null;
	if (legendNode) {
		const bbox = legendNode.getBBox();
		legend
			.insert('rect', ':first-child')
			.attr('x', bbox.x - 5)
			.attr('y', bbox.y - 3)
			.attr('width', bbox.width + 10)
			.attr('height', bbox.height + 6)
			.attr('fill', '#ffffff')
			.attr('fill-opacity', 0.9)
			.attr('stroke', '#e2e8f0')
			.attr('rx', 3);
		legend.attr(
			'transform',
			`translate(${innerW - bbox.width - legendPadding}, ${legendPadding})`
		);
	}

	return svg.node() as SVGSVGElement;
}

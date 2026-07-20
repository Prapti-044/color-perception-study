import type { Selection } from 'd3';

/** Shared typography for D3 SVG charts (screen display + publication export). */
export const CHART_FONT = {
	title: 22,
	titleCompact: 19,
	titleInset: 19,
	axisLabel: 18,
	tick: 16,
	tickCompact: 14,
	legend: 16
} as const;

export const CHART_FONT_FAMILY =
	'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export const CHART_TEXT_FILL = '#334155';
export const CHART_MUTED_FILL = '#475569';

/** Apply consistent tick-label styling to a D3 axis group. */
export function styleAxisGroup(
	selection: Selection<SVGGElement, unknown, null, undefined>,
	fontSize: number = CHART_FONT.tick
): void {
	selection
		.selectAll('text')
		.attr('font-size', fontSize)
		.attr('font-family', CHART_FONT_FAMILY)
		.attr('fill', CHART_MUTED_FILL);
}

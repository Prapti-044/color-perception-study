import { Chart, type LegendItem } from 'chart.js';
import type { Chart as ChartInstance } from 'chart.js';

const PAD = 10;
const LEGEND_BOX_WIDTH = 28;
const LEGEND_BOX_HEIGHT = 14;
const LEGEND_FONT_SIZE = 11;

export const jndLegendLabelOptions = {
	usePointStyle: false,
	boxWidth: LEGEND_BOX_WIDTH,
	boxHeight: LEGEND_BOX_HEIGHT,
	padding: 15,
	font: { size: LEGEND_FONT_SIZE },
	generateLabels(chart: ChartInstance): LegendItem[] {
		return Chart.defaults.plugins.legend.labels
			.generateLabels(chart)
			.filter((item) => !item.text.includes('data'))
			.map((item) => ({
				...item,
				lineDash: Array.isArray(item.lineDash) ? [...item.lineDash] : [],
				lineDashOffset: item.lineDashOffset ?? 0,
				lineWidth: Math.max(1.5, item.lineWidth ?? 2),
				strokeStyle:
					typeof item.strokeStyle === 'string'
						? item.strokeStyle
						: 'rgba(15, 23, 42, 0.65)',
				fillStyle: 'rgba(255, 255, 255, 0.92)'
			}));
	}
};

/**
 * Puts the Chart.js legend inside the plot, top-right, and draws it after datasets
 * so it is not covered by lines/points.
 */
export const legendInsidePlotTopRightPlugin = {
	id: 'legendInsidePlotTopRight',
	beforeUpdate(chart: ChartInstance) {
		const legend = chart.legend;
		if (!legend?.options?.display) return;
		const el = legend as unknown as {
			_layers: () => { z: number; draw: (chartArea?: unknown) => void }[];
		};
		el._layers = () => [
			{
				z: 1,
				draw: () => legend.draw(chart.chartArea)
			}
		];
	},
	afterLayout(chart: ChartInstance) {
		const legend = chart.legend;
		if (!legend?.options?.display) return;
		const ca = chart.chartArea;
		if (!ca || ca.width <= 0 || ca.height <= 0) return;
		const w = legend.width;
		const h = legend.height;
		legend.left = ca.right - w - PAD;
		legend.top = ca.top + PAD;
		legend.right = legend.left + w;
		legend.bottom = legend.top + h;
	}
};

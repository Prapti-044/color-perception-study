import type { Chart } from 'chart.js';

const PAD = 10;

/**
 * Puts the Chart.js legend inside the plot, top-right, and draws it after datasets
 * so it is not covered by lines/points.
 */
export const legendInsidePlotTopRightPlugin = {
	id: 'legendInsidePlotTopRight',
	beforeUpdate(chart: Chart) {
		const legend = chart.legend;
		if (!legend?.options?.display) return;
		const el = legend as unknown as {
			_layers: () => { z: number; draw: (chartArea?: unknown) => void }[];
		};
		el._layers = () => [
			{
				z: 1,
				draw: () => legend.draw()
			}
		];
	},
	afterLayout(chart: Chart) {
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


<script lang="ts">
	import * as d3 from 'd3';

	type HistogramBin = {
		end: number;
		label: string;
		start: number;
		totalCount: number;
	};

	type HistogramSummary = {
		firstQuartile: number;
		maximum: number;
		median: number;
		minimum: number;
		thirdQuartile: number;
	};

	type Props = {
		bins: HistogramBin[];
		maxVisibleVolume: number;
		participantVolumes: number[];
		summary: HistogramSummary;
		visibleParticipantCount: number;
	};

	let { bins, maxVisibleVolume, participantVolumes, summary, visibleParticipantCount }: Props =
		$props();

	let chartContainer = $state<HTMLDivElement | undefined>(undefined);

	const BAR_FILL = '#2f5ec9';
	const BAR_STROKE = '#4b5563';
	const AXIS_COLOR = '#000000';
	const TEXT_COLOR = '#111111';
	const outerWidth = 1200;
	const outerHeight = 560;
	const plotLeft = 88;
	const plotRight = 38;
	const boxplotTop = 28;
	const boxplotHeight = 88;
	const dividerY = 128;
	const histogramTop = 152;
	const histogramHeight = 320;
	const histogramBottom = histogramTop + histogramHeight;
	const histogramLabelY = outerHeight - 18;

	const summaryFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});

	function shouldShowXAxisLabel(value: number): boolean {
		const step = 500;
		const index = Math.round(value / step);

		if (Math.abs(value - index * step) > 1e-6) {
			return false;
		}

		if (index === 0 || index === 1) {
			return true;
		}

		return index >= 3 && index % 2 === 1;
	}

	function clampXPosition(scale: d3.ScaleLinear<number, number>, value: number) {
		return scale(Math.min(value, maxVisibleVolume));
	}

	$effect(() => {
		if (!chartContainer || !bins.length || !participantVolumes.length) {
			return;
		}

		const sortedVolumes = [...participantVolumes].sort((left, right) => left - right);
		const histogramPeak = Math.max(1, ...bins.map((bin) => bin.totalCount));
		const x = d3
			.scaleLinear()
			.domain([0, maxVisibleVolume])
			.range([plotLeft, outerWidth - plotRight])
			.clamp(true);
		const y = d3.scaleLinear().domain([0, histogramPeak]).nice().range([histogramBottom, histogramTop]);
		const upperFence =
			summary.thirdQuartile + 1.5 * (summary.thirdQuartile - summary.firstQuartile);
		const lowerFence =
			summary.firstQuartile - 1.5 * (summary.thirdQuartile - summary.firstQuartile);
		const nonOutliers = sortedVolumes.filter(
			(value) => value >= lowerFence && value <= upperFence
		);
		const whiskerMinimum = nonOutliers[0] ?? summary.minimum;
		const whiskerMaximum = nonOutliers[nonOutliers.length - 1] ?? summary.maximum;
		const outliers = sortedVolumes.filter(
			(value) => value < whiskerMinimum || value > whiskerMaximum
		);

		const svg = d3
			.select(chartContainer)
			.html('')
			.append('svg')
			.attr('xmlns', 'http://www.w3.org/2000/svg')
			.attr('viewBox', `0 0 ${outerWidth} ${outerHeight}`)
			.attr('width', '100%')
			.attr('height', 'auto')
			.attr('role', 'img')
			.attr(
				'aria-label',
				'Paper-style figure showing a boxplot and histogram of ellipsoid volume'
			);

		svg
			.append('rect')
			.attr('x', 1)
			.attr('y', 1)
			.attr('width', outerWidth - 2)
			.attr('height', outerHeight - 2)
			.attr('fill', '#ffffff')
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 1.5);

		svg
			.append('line')
			.attr('x1', 1)
			.attr('x2', outerWidth - 1)
			.attr('y1', dividerY)
			.attr('y2', dividerY)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 1.25);

		const boxplotGroup = svg.append('g');
		const boxMidY = boxplotTop + boxplotHeight / 2;
		const boxHeightPx = 34;
		const capHeight = 20;
		const boxLeft = clampXPosition(x, summary.firstQuartile);
		const boxRight = clampXPosition(x, summary.thirdQuartile);
		const medianX = clampXPosition(x, summary.median);
		const whiskerLeft = clampXPosition(x, whiskerMinimum);
		const whiskerRight = clampXPosition(x, whiskerMaximum);

		boxplotGroup
			.append('line')
			.attr('x1', whiskerLeft)
			.attr('x2', boxLeft)
			.attr('y1', boxMidY)
			.attr('y2', boxMidY)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.append('line')
			.attr('x1', boxRight)
			.attr('x2', whiskerRight)
			.attr('y1', boxMidY)
			.attr('y2', boxMidY)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.append('line')
			.attr('x1', whiskerLeft)
			.attr('x2', whiskerLeft)
			.attr('y1', boxMidY - capHeight / 2)
			.attr('y2', boxMidY + capHeight / 2)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.append('line')
			.attr('x1', whiskerRight)
			.attr('x2', whiskerRight)
			.attr('y1', boxMidY - capHeight / 2)
			.attr('y2', boxMidY + capHeight / 2)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.append('rect')
			.attr('x', boxLeft)
			.attr('y', boxMidY - boxHeightPx / 2)
			.attr('width', Math.max(1, boxRight - boxLeft))
			.attr('height', boxHeightPx)
			.attr('fill', '#ffffff')
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.append('line')
			.attr('x1', medianX)
			.attr('x2', medianX)
			.attr('y1', boxMidY - boxHeightPx / 2)
			.attr('y2', boxMidY + boxHeightPx / 2)
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 2);

		boxplotGroup
			.selectAll('circle')
			.data(outliers)
			.join('circle')
			.attr('cx', (value) => clampXPosition(x, value))
			.attr('cy', boxMidY)
			.attr('r', 2.8)
			.attr('fill', '#000000');

		const xTickValues = d3.range(0, maxVisibleVolume + 500, 500);
		svg
			.append('g')
			.attr('transform', `translate(0,${histogramBottom})`)
			.call(
				d3
					.axisBottom(x)
					.tickValues(xTickValues)
					.tickSizeOuter(8)
					.tickSize(8)
					.tickFormat((value) => (shouldShowXAxisLabel(+value) ? d3.format('d')(+value) : ''))
			)
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', AXIS_COLOR).attr('stroke-width', 1.5);
				axis.selectAll('.tick line').attr('stroke', AXIS_COLOR).attr('stroke-width', 1.25);
				axis
					.selectAll('text')
					.attr('fill', TEXT_COLOR)
					.style('font-family', 'Arial, Helvetica, sans-serif')
					.style('font-size', '12px')
					.attr('y', 14);
			});

		svg
			.append('g')
			.attr('transform', `translate(${plotLeft},0)`)
			.call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('d')))
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', AXIS_COLOR).attr('stroke-width', 1.5);
				axis.selectAll('.tick line').attr('stroke', AXIS_COLOR).attr('stroke-width', 1.25);
				axis
					.selectAll('text')
					.attr('fill', TEXT_COLOR)
					.style('font-family', 'Arial, Helvetica, sans-serif')
					.style('font-size', '12px');
			});

		svg
			.append('text')
			.attr('x', (plotLeft + outerWidth - plotRight) / 2)
			.attr('y', histogramLabelY)
			.attr('fill', TEXT_COLOR)
			.attr('text-anchor', 'middle')
			.style('font-family', 'Arial, Helvetica, sans-serif')
			.style('font-size', '14px')
			.text('Ellipsoid volume');

		svg
			.append('text')
			.attr('transform', `translate(26 ${(histogramTop + histogramBottom) / 2}) rotate(-90)`)
			.attr('fill', TEXT_COLOR)
			.attr('text-anchor', 'middle')
			.style('font-family', 'Arial, Helvetica, sans-serif')
			.style('font-size', '14px')
			.text('Number of participants');

		const barGroup = svg.append('g');
		for (const bin of bins) {
			const xStart = x(bin.start);
			const xEnd = x(bin.end);
			const barWidth = Math.max(1, xEnd - xStart);
			const barY = y(bin.totalCount);
			const labelPercent = Math.round((bin.totalCount / visibleParticipantCount) * 100);

			barGroup
				.append('rect')
				.attr('x', xStart)
				.attr('y', barY)
				.attr('width', barWidth)
				.attr('height', Math.max(0, histogramBottom - barY))
				.attr('fill', BAR_FILL)
				.attr('stroke', BAR_STROKE)
				.attr('stroke-width', 1);

			if (labelPercent >= 1) {
				barGroup
					.append('text')
					.attr('x', xStart + barWidth / 2)
					.attr('y', barY - 8)
					.attr('fill', TEXT_COLOR)
					.attr('text-anchor', 'middle')
					.style('font-family', 'Arial, Helvetica, sans-serif')
					.style('font-size', '12px')
					.text(`${labelPercent}%`);
			}
		}

		const tableWidth = 360;
		const tableHeight = 158;
		const tableX = outerWidth - plotRight - tableWidth - 26;
		const tableY = histogramTop + 24;
		const tableHeaderY = tableY + 24;
		const tableFirstRowY = tableY + 56;
		const tableRowGap = 24;
		const summaryRows = [
			{ label: '100.0% maximum', value: summary.maximum },
			{ label: '75.0% quartile', value: summary.thirdQuartile },
			{ label: '50.0% median', value: summary.median },
			{ label: '25.0% quartile', value: summary.firstQuartile },
			{ label: '0.0% minimum', value: summary.minimum }
		];

		const tableGroup = svg.append('g');
		tableGroup
			.append('rect')
			.attr('x', tableX)
			.attr('y', tableY)
			.attr('width', tableWidth)
			.attr('height', tableHeight)
			.attr('fill', '#ffffff')
			.attr('stroke', AXIS_COLOR)
			.attr('stroke-width', 1);

		tableGroup
			.append('text')
			.attr('x', tableX + tableWidth - 20)
			.attr('y', tableHeaderY)
			.attr('fill', TEXT_COLOR)
			.attr('text-anchor', 'end')
			.style('font-family', 'Arial, Helvetica, sans-serif')
			.style('font-size', '14px')
			.style('font-style', 'italic')
			.text('ellipsoid volume');

		summaryRows.forEach((row, index) => {
			const rowY = tableFirstRowY + index * tableRowGap;

			tableGroup
				.append('text')
				.attr('x', tableX + 16)
				.attr('y', rowY)
				.attr('fill', TEXT_COLOR)
				.style('font-family', 'Arial, Helvetica, sans-serif')
				.style('font-size', '13px')
				.text(row.label);

			tableGroup
				.append('text')
				.attr('x', tableX + tableWidth - 16)
				.attr('y', rowY)
				.attr('fill', TEXT_COLOR)
				.attr('text-anchor', 'end')
				.style('font-family', 'Arial, Helvetica, sans-serif')
				.style('font-size', '13px')
				.text(summaryFormatter.format(row.value));
		});
	});
</script>

<div
	class="paper-figure w-full overflow-hidden rounded-sm bg-white"
	bind:this={chartContainer}
></div>

<style>
	.paper-figure :global(svg) {
		display: block;
		height: auto;
		max-width: 100%;
	}
</style>

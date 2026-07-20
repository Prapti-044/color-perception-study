<script lang="ts">
	import * as d3 from 'd3';
	import { downloadSvgElement } from '$lib/svgDownload';
	import type {
		ConfidenceInterval,
		StudySummary,
		VolumeEquivalenceComparison
	} from '$lib/studyMeanEquivalence';

	type Props = {
		comparison: VolumeEquivalenceComparison;
	};

	let { comparison }: Props = $props();
	let chartContainer = $state<HTMLDivElement | undefined>(undefined);

	const numberFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2
	});
	const compactFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		notation: 'compact'
	});
	const signedFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
		signDisplay: 'always'
	});

	const redrawFingerprint = $derived.by(() =>
		[
			comparison.current.n,
			comparison.current.mean,
			comparison.current.sd,
			comparison.reference.n,
			comparison.reference.mean,
			comparison.reference.sd,
			comparison.equivalenceMargin,
			comparison.meanDifference,
			comparison.meanDifferenceCi90.lower,
			comparison.meanDifferenceCi90.upper,
			comparison.tost.maxPValue
		].join('|')
	);

	function formatNumber(value: number): string {
		return numberFormatter.format(value);
	}

	function formatSignedNumber(value: number): string {
		return signedFormatter.format(value);
	}

	function formatAxisNumber(value: number): string {
		return d3.format('~s')(value);
	}

	function formatPValue(value: number): string {
		if (value < 0.001) {
			return '< 0.001';
		}

		return value.toFixed(3);
	}

	function formatCi(interval: ConfidenceInterval): string {
		return `[${formatSignedNumber(interval.lower)}, ${formatSignedNumber(interval.upper)}]`;
	}

	function meanCiLabel(study: StudySummary, interval: ConfidenceInterval): string {
		return `${study.label}: ${formatNumber(study.mean)} [${formatNumber(interval.lower)}, ${formatNumber(interval.upper)}]`;
	}

	$effect(() => {
		if (!chartContainer) {
			return;
		}

		redrawFingerprint;

		const outerWidth = 1200;
		const outerHeight = 520;
		const plotLeft = 174;
		const plotRight = 52;
		const meanTop = 72;
		const meanHeight = 118;
		const meanBottom = meanTop + meanHeight;
		const diffTop = 296;
		const diffHeight = 90;
		const diffBottom = diffTop + diffHeight;
		const axisColor = '#111827';
		const mutedText = '#64748b';
		const currentColor = '#0f766e';
		const referenceColor = '#475569';
		const ciColor = '#d97706';
		const bandColor = '#ccfbf1';
		const gridColor = '#e2e8f0';
		const current = comparison.current;
		const reference = comparison.reference;
		const currentMeanCi = comparison.currentMeanCi95;
		const referenceMeanCi = comparison.referenceMeanCi95;
		const meanDomainMax =
			Math.max(currentMeanCi.upper, referenceMeanCi.upper, current.mean, reference.mean) * 1.08;
		const meanX = d3
			.scaleLinear()
			.domain([0, meanDomainMax])
			.range([plotLeft, outerWidth - plotRight])
			.nice();
		const meanRows = [
			{
				ci: referenceMeanCi,
				color: referenceColor,
				study: reference,
				y: meanTop + 36
			},
			{
				ci: currentMeanCi,
				color: currentColor,
				study: current,
				y: meanTop + 90
			}
		];
		const diffCi90 = comparison.meanDifferenceCi90;
		const diffCi95 = comparison.meanDifferenceCi95;
		const margin = comparison.equivalenceMargin;
		const diffDomainMin = Math.min(-margin * 1.2, diffCi95.lower * 1.1, 0);
		const diffDomainMax = Math.max(margin * 1.2, diffCi95.upper * 1.08, 0);
		const diffX = d3
			.scaleLinear()
			.domain([diffDomainMin, diffDomainMax])
			.range([plotLeft, outerWidth - plotRight])
			.nice();
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
				'Mean ellipsoid volume comparison and equivalence-test interval'
			);

		svg
			.append('rect')
			.attr('width', outerWidth)
			.attr('height', outerHeight)
			.attr('fill', '#ffffff');

		svg
			.append('text')
			.attr('x', plotLeft)
			.attr('y', 34)
			.attr('fill', '#0f172a')
			.style('font-size', '18px')
			.style('font-weight', '700')
			.text('Study mean comparison');

		svg
			.append('text')
			.attr('x', plotLeft)
			.attr('y', 56)
			.attr('fill', mutedText)
			.style('font-size', '12px')
			.text('Dots show means; horizontal intervals show 95% confidence intervals for each mean.');

		const meanAxis = svg.append('g').attr('transform', `translate(0,${meanBottom})`);
		meanAxis
			.call(
				d3
					.axisBottom(meanX)
					.ticks(7)
					.tickSizeOuter(0)
					.tickFormat((value) => formatAxisNumber(+value))
			)
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', axisColor);
				axis.selectAll('.tick line').attr('stroke', axisColor);
				axis.selectAll('text').attr('fill', '#334155').style('font-size', '11px');
			});

		svg
			.append('g')
			.attr('transform', `translate(0,${meanBottom})`)
			.call(
				d3
					.axisBottom(meanX)
					.ticks(7)
					.tickSize(-(meanHeight + 12))
					.tickFormat(() => '')
			)
			.call((axis) => {
				axis.selectAll('path.domain').remove();
				axis.selectAll('.tick line').attr('stroke', gridColor);
			});

		for (const row of meanRows) {
			svg
				.append('text')
				.attr('x', plotLeft - 14)
				.attr('y', row.y + 4)
				.attr('fill', '#0f172a')
				.attr('text-anchor', 'end')
				.style('font-size', '13px')
				.style('font-weight', '600')
				.text(`${row.study.label} (n=${row.study.n.toLocaleString('en-US')})`);

			svg
				.append('line')
				.attr('x1', meanX(Math.max(0, row.ci.lower)))
				.attr('x2', meanX(row.ci.upper))
				.attr('y1', row.y)
				.attr('y2', row.y)
				.attr('stroke', row.color)
				.attr('stroke-width', 5)
				.attr('stroke-linecap', 'round');

			svg
				.append('circle')
				.attr('cx', meanX(row.study.mean))
				.attr('cy', row.y)
				.attr('r', 8)
				.attr('fill', row.color)
				.attr('stroke', '#ffffff')
				.attr('stroke-width', 2);

			svg
				.append('text')
				.attr('x', meanX(row.study.mean) + 14)
				.attr('y', row.y - 11)
				.attr('fill', '#334155')
				.style('font-size', '11px')
				.text(formatNumber(row.study.mean));
		}

		svg
			.append('text')
			.attr('x', (plotLeft + outerWidth - plotRight) / 2)
			.attr('y', meanBottom + 44)
			.attr('fill', '#111827')
			.attr('text-anchor', 'middle')
			.style('font-size', '12px')
			.text('Mean ellipsoid volume');

		svg
			.append('line')
			.attr('x1', plotLeft)
			.attr('x2', outerWidth - plotRight)
			.attr('y1', 248)
			.attr('y2', 248)
			.attr('stroke', '#cbd5e1')
			.attr('stroke-width', 1);

		svg
			.append('text')
			.attr('x', plotLeft)
			.attr('y', 276)
			.attr('fill', '#0f172a')
			.style('font-size', '18px')
			.style('font-weight', '700')
			.text('Equivalence-test view');

		svg
			.append('text')
			.attr('x', plotLeft)
			.attr('y', 297)
			.attr('fill', mutedText)
			.style('font-size', '12px')
			.text('TOST uses a default margin of +/-0.2 x original-study SD.');

		const diffAxis = svg.append('g').attr('transform', `translate(0,${diffBottom})`);
		diffAxis
			.call(
				d3
					.axisBottom(diffX)
					.ticks(8)
					.tickSizeOuter(0)
					.tickFormat((value) => formatAxisNumber(+value))
			)
			.call((axis) => {
				axis.selectAll('path.domain').attr('stroke', axisColor);
				axis.selectAll('.tick line').attr('stroke', axisColor);
				axis.selectAll('text').attr('fill', '#334155').style('font-size', '11px');
			});

		svg
			.append('rect')
			.attr('x', diffX(-margin))
			.attr('y', diffTop + 16)
			.attr('width', Math.max(1, diffX(margin) - diffX(-margin)))
			.attr('height', 46)
			.attr('rx', 6)
			.attr('fill', bandColor)
			.attr('stroke', '#5eead4');

		for (const value of [-margin, 0, margin]) {
			svg
				.append('line')
				.attr('x1', diffX(value))
				.attr('x2', diffX(value))
				.attr('y1', diffTop + 8)
				.attr('y2', diffBottom)
				.attr('stroke', value === 0 ? '#0f172a' : '#14b8a6')
				.attr('stroke-dasharray', value === 0 ? '0' : '4 4')
				.attr('stroke-width', value === 0 ? 1.4 : 1.1);
		}

		svg
			.append('line')
			.attr('x1', diffX(diffCi90.lower))
			.attr('x2', diffX(diffCi90.upper))
			.attr('y1', diffTop + 39)
			.attr('y2', diffTop + 39)
			.attr('stroke', ciColor)
			.attr('stroke-width', 7)
			.attr('stroke-linecap', 'round');

		for (const value of [diffCi90.lower, diffCi90.upper]) {
			svg
				.append('line')
				.attr('x1', diffX(value))
				.attr('x2', diffX(value))
				.attr('y1', diffTop + 27)
				.attr('y2', diffTop + 51)
				.attr('stroke', ciColor)
				.attr('stroke-width', 2);
		}

		svg
			.append('circle')
			.attr('cx', diffX(comparison.meanDifference))
			.attr('cy', diffTop + 39)
			.attr('r', 9)
			.attr('fill', '#0f172a')
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 2);

		svg
			.append('text')
			.attr('x', diffX(-margin) + 8)
			.attr('y', diffTop + 78)
			.attr('fill', '#0f766e')
			.style('font-size', '11px')
			.style('font-weight', '600')
			.text(`equivalence band +/-${formatNumber(margin)}`);

		svg
			.append('text')
			.attr('x', diffX(comparison.meanDifference) + 12)
			.attr('y', diffTop + 26)
			.attr('fill', '#0f172a')
			.style('font-size', '12px')
			.style('font-weight', '700')
			.text(`difference ${formatSignedNumber(comparison.meanDifference)}`);

		svg
			.append('text')
			.attr('x', (plotLeft + outerWidth - plotRight) / 2)
			.attr('y', diffBottom + 44)
			.attr('fill', '#111827')
			.attr('text-anchor', 'middle')
			.style('font-size', '12px')
			.text('Mean difference: this study - original study');

		svg
			.append('text')
			.attr('x', plotLeft)
			.attr('y', outerHeight - 22)
			.attr('fill', mutedText)
			.style('font-size', '11px')
			.text(
				`90% CI for difference ${formatCi(diffCi90)}; TOST max p=${formatPValue(comparison.tost.maxPValue)}.`
			);
	});

	function downloadSvg() {
		const svg = chartContainer?.querySelector('svg');
		if (svg) downloadSvgElement(svg, 'study-mean-equivalence.svg');
	}
</script>

<div class="equivalence-figure overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
	<div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
		<div>
			<p class="text-sm font-semibold text-slate-950">Original study vs this study</p>
			<p class="mt-1 text-xs leading-relaxed text-slate-500">
				The comparison uses all 394 include-fitted participant ellipsoid volumes.
			</p>
		</div>
		<button
			type="button"
			class="rounded border border-slate-300 bg-white/95 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur hover:border-slate-400"
			onclick={downloadSvg}>Download SVG</button
		>
	</div>

	<div bind:this={chartContainer} class="chart-svg-host"></div>

	<div class="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-3">
		<div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
				{comparison.reference.label}
			</p>
			<p class="mt-2 font-mono text-xl font-semibold tabular-nums text-slate-950">
				{formatNumber(comparison.reference.mean)}
			</p>
			<p class="mt-1 text-sm text-slate-600">
				n = {comparison.reference.n.toLocaleString('en-US')}; SD =
				{formatNumber(comparison.reference.sd)}
			</p>
			<p class="mt-1 text-xs text-slate-500">
				95% CI {meanCiLabel(comparison.reference, comparison.referenceMeanCi95)}
			</p>
		</div>
		<div class="rounded-xl border border-teal-200 bg-teal-50/70 p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-teal-800">
				{comparison.current.label}
			</p>
			<p class="mt-2 font-mono text-xl font-semibold tabular-nums text-slate-950">
				{formatNumber(comparison.current.mean)}
			</p>
			<p class="mt-1 text-sm text-slate-700">
				n = {comparison.current.n.toLocaleString('en-US')}; SD =
				{formatNumber(comparison.current.sd)}
			</p>
			<p class="mt-1 text-xs text-teal-900/80">
				95% CI {meanCiLabel(comparison.current, comparison.currentMeanCi95)}
			</p>
		</div>
		<div class="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-900">
				TOST verdict
			</p>
			<p class="mt-2 text-xl font-semibold text-slate-950">
				{comparison.tost.equivalent ? 'Equivalent' : 'Equivalence not supported'}
			</p>
			<p class="mt-1 text-sm text-amber-950">
				Margin +/-{compactFormatter.format(comparison.equivalenceMargin)}; max p =
				{formatPValue(comparison.tost.maxPValue)}
			</p>
			<p class="mt-1 text-xs text-amber-950/80">
				Required margin for support: +/-{formatNumber(comparison.requiredMarginForEquivalence)}
			</p>
		</div>
	</div>
</div>

<style>
	.chart-svg-host :global(svg) {
		display: block;
		height: auto;
		max-width: 100%;
	}
</style>

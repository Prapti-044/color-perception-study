<script lang="ts">
	import * as d3 from 'd3';

	type AxisPoint = {
		deltaLuv: readonly number[];
		maxRadius: number;
		name: string;
		unitUv: readonly number[];
		vector: number;
	};

	let { axes }: { axes: readonly AxisPoint[] } = $props();

	type PlotMode = 'endpoint' | 'normalized';

	const COLORS = {
		blue: '#9156e7',
		magenta: '#d33685',
		pink: '#da325c'
	};
	const height = 360;
	const width = 420;
	const margin = 34;
	let plotMode = $state<PlotMode>('endpoint');

	const chromaticAxes = $derived(axes.filter((axis) => axis.vector !== 4));
	const plottedAxes = $derived(
		chromaticAxes.map((axis) => {
			const [u, v] =
				plotMode === 'endpoint'
					? [axis.deltaLuv[1], axis.deltaLuv[2]]
					: [axis.unitUv[0] * 100, axis.unitUv[1] * 100];

			return {
				...axis,
				u,
				v
			};
		})
	);
	const maxAbs = $derived(
		Math.max(
			110,
			...plottedAxes.flatMap((axis) => [Math.abs(axis.u), Math.abs(axis.v)])
		)
	);
	const xScale = $derived(
		d3.scaleLinear().domain([-maxAbs, maxAbs]).range([margin, width - margin])
	);
	const yScale = $derived(
		d3.scaleLinear().domain([-maxAbs, maxAbs]).range([height - margin, margin])
	);
</script>

<div class="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
				Chromatic plane
			</p>
			<h3 class="mt-1 font-display text-2xl font-semibold text-slate-950">
				Recovered `u*–v*` directions
			</h3>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="mode-chip rounded-full border px-3 py-1.5 text-sm font-semibold"
				class:mode-chip--active={plotMode === 'endpoint'}
				onclick={() => (plotMode = 'endpoint')}
			>
				Recovered endpoints
			</button>
			<button
				type="button"
				class="mode-chip rounded-full border px-3 py-1.5 text-sm font-semibold"
				class:mode-chip--active={plotMode === 'normalized'}
				onclick={() => (plotMode = 'normalized')}
			>
				Normalized directions
			</button>
		</div>
	</div>

	<p class="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
		The gray background is placed at the origin. Each arrow shows the recovered chromatic direction
		in the `u*–v*` plane. The endpoint view uses the max-step stimuli; the normalized view keeps
		only direction.
	</p>

	<svg class="mt-6 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recovered chromatic directions in the u star v star plane">
		<rect x="0" y="0" width={width} height={height} rx="24" fill="#f8fafc" />
		<line
			x1={xScale(0)}
			y1={margin}
			x2={xScale(0)}
			y2={height - margin}
			stroke="#cbd5e1"
			stroke-dasharray="4 5"
		/>
		<line
			x1={margin}
			y1={yScale(0)}
			x2={width - margin}
			y2={yScale(0)}
			stroke="#cbd5e1"
			stroke-dasharray="4 5"
		/>

		{#each plottedAxes as axis}
			<line
				x1={xScale(0)}
				y1={yScale(0)}
				x2={xScale(axis.u)}
				y2={yScale(axis.v)}
				stroke={COLORS[axis.name as keyof typeof COLORS]}
				stroke-width="3"
				stroke-linecap="round"
			/>
			<circle
				cx={xScale(axis.u)}
				cy={yScale(axis.v)}
				r="7"
				fill={COLORS[axis.name as keyof typeof COLORS]}
				stroke="#fff"
				stroke-width="2"
			/>
			<text
				x={xScale(axis.u) + 10}
				y={yScale(axis.v) - 10}
				font-size="12"
				font-weight="600"
				fill="#0f172a"
			>
				{axis.name}
			</text>
		{/each}

		<circle cx={xScale(0)} cy={yScale(0)} r="6" fill="#0f172a" />
		<text x={xScale(0) + 10} y={yScale(0) + 18} font-size="12" font-weight="600" fill="#0f172a">
			gray
		</text>
		<text x={width / 2} y={height - 8} text-anchor="middle" font-size="12" fill="#334155">u*</text>
		<text
			x="-180"
			y="14"
			transform="rotate(-90)"
			text-anchor="middle"
			font-size="12"
			fill="#334155"
		>
			v*
		</text>
	</svg>
</div>

<style>
	.mode-chip {
		background: rgba(255, 255, 255, 0.92);
		border-color: rgba(226, 232, 240, 0.95);
		color: #475569;
		transition:
			border-color 0.2s ease,
			color 0.2s ease,
			transform 0.2s ease;
	}

	.mode-chip:hover {
		border-color: rgba(148, 163, 184, 0.85);
		color: #0f172a;
		transform: translateY(-1px);
	}

	.mode-chip--active {
		background: linear-gradient(180deg, rgba(13, 148, 136, 0.12), rgba(255, 255, 255, 0.95));
		border-color: rgba(13, 148, 136, 0.42);
		color: #0f172a;
	}
</style>

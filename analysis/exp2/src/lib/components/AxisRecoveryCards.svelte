<script lang="ts">
	type AxisCard = {
		backgroundHex: string;
		backgroundLuv: readonly number[];
		backgroundRgb: readonly number[];
		deltaLuv: readonly number[];
		endpointHex: string;
		endpointImage: string;
		endpointLuv: readonly number[];
		endpointRgb: readonly number[];
		maxLocation: number;
		name: string;
		vector: number;
	};

	let { axes }: { axes: readonly AxisCard[] } = $props();

	const oneDecimalFormatter = new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
</script>

<div class="grid gap-4 lg:grid-cols-2">
	{#each axes as axis}
		<article class="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
						Vector {axis.vector}
					</p>
					<h3 class="mt-1 font-display text-2xl font-semibold text-slate-950">
						{axis.name}
					</h3>
				</div>
				<div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
					max step {axis.maxLocation}
				</div>
			</div>

			<div class="mt-5 grid gap-4 xl:grid-cols-[180px_1fr]">
				<img
					class="h-[180px] w-[180px] rounded-2xl border border-slate-200 bg-slate-950 object-cover shadow-sm"
					src={axis.endpointImage}
					alt={`Recovered endpoint stimulus for vector ${axis.vector}`}
				/>

				<div class="space-y-4">
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Background</p>
							<div class="mt-3 flex items-center gap-3">
								<span
									class="h-10 w-10 rounded-full border border-slate-300"
									style={`background:${axis.backgroundHex}`}
								></span>
								<div class="text-sm text-slate-700">
									<p class="font-mono">{axis.backgroundHex}</p>
									<p>{axis.backgroundRgb.map((value) => Math.round(value)).join(', ')}</p>
								</div>
							</div>
						</div>

						<div class="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recovered ring</p>
							<div class="mt-3 flex items-center gap-3">
								<span
									class="h-10 w-10 rounded-full border border-slate-300"
									style={`background:${axis.endpointHex}`}
								></span>
								<div class="text-sm text-slate-700">
									<p class="font-mono">{axis.endpointHex}</p>
									<p>{axis.endpointRgb.map((value) => Math.round(value)).join(', ')}</p>
								</div>
							</div>
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-2xl border border-slate-200/80 bg-white p-3">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Recovered endpoint `L*u*v*`
							</p>
							<p class="mt-3 font-mono text-sm text-slate-800">
								({axis.endpointLuv.map((value) => oneDecimalFormatter.format(value)).join(', ')})
							</p>
						</div>

						<div class="rounded-2xl border border-slate-200/80 bg-white p-3">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
								Recovered delta from gray
							</p>
							<p class="mt-3 font-mono text-sm text-slate-800">
								({axis.deltaLuv.map((value) => oneDecimalFormatter.format(value)).join(', ')})
							</p>
						</div>
					</div>
				</div>
			</div>
		</article>
	{/each}
</div>

<script lang="ts">
	import { page } from '$app/state';

	type EllipseMode = 'exact' | 'include-fitted';

	let {
		currentMode,
		label = 'Ellipse mode'
	}: {
		currentMode: EllipseMode;
		label?: string;
	} = $props();

	const options: { description: string; id: EllipseMode; label: string }[] = [
		{
			description: 'Exclude participants whose exact centered ellipse is invalid.',
			id: 'exact',
			label: 'Exact only'
		},
		{
			description: 'Include fitted fallbacks for participants whose exact ellipse is invalid.',
			id: 'include-fitted',
			label: 'Include fitted'
		}
	];

	function hrefForMode(mode: EllipseMode) {
		const nextUrl = new URL(page.url);

		if (mode === 'exact') {
			nextUrl.searchParams.delete('ellipseMode');
		} else {
			nextUrl.searchParams.set('ellipseMode', mode);
		}

		return `${nextUrl.pathname}${nextUrl.search}`;
	}
</script>

<div class="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm">
	<p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
	<div class="mt-3 flex flex-wrap gap-2">
		{#each options as option}
			<a
				href={hrefForMode(option.id)}
				class="mode-pill rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200"
				class:mode-pill--active={currentMode === option.id}
				title={option.description}
			>
				{option.label}
			</a>
		{/each}
	</div>
	<p class="mt-3 text-sm leading-relaxed text-slate-600">
		{#if currentMode === 'exact'}
			Showing participants whose three chromatic thresholds form a valid exact centered ellipse.
		{:else}
			Showing exact ellipses when available, plus deterministic fitted fallbacks for invalid exact cases.
		{/if}
	</p>
</div>

<style>
	.mode-pill {
		background: rgba(255, 255, 255, 0.82);
		border-color: rgba(226, 232, 240, 0.95);
		color: #475569;
	}

	.mode-pill:hover {
		border-color: rgba(148, 163, 184, 0.85);
		color: #0f172a;
		transform: translateY(-1px);
	}

	.mode-pill--active {
		background: linear-gradient(180deg, rgba(13, 148, 136, 0.14), rgba(255, 255, 255, 0.96));
		border-color: rgba(13, 148, 136, 0.45);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.88) inset;
		color: #0f172a;
	}
</style>

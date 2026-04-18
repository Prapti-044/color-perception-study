<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', label: 'Comparison' },
		{ href: '/methods', label: 'Methods' }
	];

	function isActive(href: string, pathname: string) {
		if (href === '/') {
			return pathname === '/';
		}

		return pathname.startsWith(href);
	}

	function hrefWithCurrentMode(pathname: string) {
		const nextUrl = new URL(page.url);

		nextUrl.pathname = pathname;

		return `${nextUrl.pathname}${nextUrl.search}`;
	}
</script>

<nav class="nav-shell sticky top-0 z-40 border-b border-white/70 bg-slate-50/80 backdrop-blur-xl">
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
		<div>
			<p class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
				Color perception
			</p>
			<p class="mt-1 font-display text-lg font-semibold text-slate-950">
				Exp2 analysis notebook
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			{#each links as link}
				<a
					href={hrefWithCurrentMode(link.href)}
					class="nav-pill rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200"
					class:nav-pill--active={isActive(link.href, page.url.pathname)}
				>
					{link.label}
				</a>
			{/each}
		</div>
	</div>
</nav>

<style>
	.nav-shell {
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.8) inset,
			0 12px 30px rgba(15, 23, 42, 0.05);
	}

	.nav-pill {
		background: rgba(255, 255, 255, 0.72);
		border-color: rgba(226, 232, 240, 0.95);
		color: #475569;
	}

	.nav-pill:hover {
		border-color: rgba(148, 163, 184, 0.85);
		color: #0f172a;
		transform: translateY(-1px);
	}

	.nav-pill--active {
		background: linear-gradient(180deg, rgba(13, 148, 136, 0.14), rgba(255, 255, 255, 0.96));
		border-color: rgba(13, 148, 136, 0.45);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.88) inset;
		color: #0f172a;
	}
</style>

<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/', label: 'Analysis Report', icon: '📊' },
		{ href: '/foundation-colors', label: 'Foundation Colors', icon: '🎨' },
		{ href: '/scatterplots', label: 'Scatterplots', icon: '⬡' }
	];
</script>

<nav class="border-b border-slate-200 bg-white shadow-sm">
	<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
		<a href="/" class="flex items-center gap-2 text-slate-800 transition-colors hover:text-blue-600">
			<span class="text-xl">🔬</span>
			<span class="hidden font-semibold tracking-tight sm:inline">Color Perception Study</span>
		</a>

		<div class="flex gap-1">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
						{$page.url.pathname === item.href 
							? 'bg-blue-50 text-blue-600' 
							: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}"
				>
					<span class="text-base">{item.icon}</span>
					<span class="hidden sm:inline">{item.label}</span>
				</a>
			{/each}
		</div>
	</div>
</nav>

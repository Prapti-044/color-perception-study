<script lang="ts">
	interface Props {
		value: string | number;
		label: string;
	}

	let { value, label }: Props = $props();
</script>

<div
	class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
>
	<div class="text-4xl font-bold text-blue-600">{value}</div>
	<div class="mt-2 text-sm font-medium text-slate-500">{label}</div>
</div>


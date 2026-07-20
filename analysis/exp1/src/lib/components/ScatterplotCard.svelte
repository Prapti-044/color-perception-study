<script lang="ts">
	import { isMakeupColorMatch } from '$lib/makeup';

	interface LabColor {
		L: number;
		a: number;
		b: number;
	}

	interface ScatterplotMetadata {
		axis: string;
		diff_type: string;
		delta_e: number;
		point_radius_pixels: number;
		point_diameter_degrees: number;
		point_area_pixels: number;
		plot_width: number;
		plot_height: number;
		target_color1_hex: string;
		target_color2_hex: string;
		target_color1_lab: LabColor;
		target_color2_lab: LabColor;
		distractor_color_hex: string;
		target_positions: { x: number; y: number }[];
		target_separation_pixels: number;
		n_distractors: number;
		n_total_points: number;
		ppi: number;
		viewing_distance_inches: number;
		filename: string;
		filepath: string;
		output_directory: string;
		index: number;
	}

	interface FoundationColor {
		brand: string;
		name: string;
		hex: string;
		lab: LabColor;
	}

	interface NearestFoundation {
		color: FoundationColor;
		deltaE: number;
	}

	interface Props {
		metadata: ScatterplotMetadata;
		nearestFoundation1?: NearestFoundation | null;
		nearestFoundation2?: NearestFoundation | null;
	}

	let { metadata, nearestFoundation1 = null, nearestFoundation2 = null }: Props = $props();

	function formatLab(lab: LabColor): string {
		return `L*: ${lab.L.toFixed(1)}, a*: ${lab.a.toFixed(1)}, b*: ${lab.b.toFixed(1)}`;
	}

	// Check if either target color is close to a makeup/foundation color.
	const hasMakeupColor = $derived(
		isMakeupColorMatch(nearestFoundation1) || isMakeupColorMatch(nearestFoundation2)
	);
</script>

<div class="metadata-card">
	<div class="card-header">
		<span class="filename">{metadata.filename}</span>
		{#if hasMakeupColor}
			<span class="makeup-badge">Makeup Color</span>
		{/if}
	</div>

	<div class="card-body">
		<!-- Target Colors -->
		<div class="colors-section">
			<div class="color-row">
				<span class="label">Target 1:</span>
				<div class="color-info">
					<span class="color-swatch" style:background-color={metadata.target_color1_hex}></span>
					<span class="lab-value">{formatLab(metadata.target_color1_lab)}</span>
					<span class="hex-value">{metadata.target_color1_hex}</span>
				</div>
			</div>
			{#if nearestFoundation1}
				<div class="nearest-row">
					<span class="nearest-label">↳ Nearest:</span>
					<div class="nearest-info">
						<span class="color-swatch small" style:background-color={nearestFoundation1.color.hex}></span>
						<span class="nearest-name" title="{nearestFoundation1.color.brand} - {nearestFoundation1.color.name}">
							{nearestFoundation1.color.name}
						</span>
						<span class="nearest-delta">ΔE: {nearestFoundation1.deltaE.toFixed(2)}</span>
					</div>
				</div>
			{/if}

			<div class="color-row">
				<span class="label">Target 2:</span>
				<div class="color-info">
					<span class="color-swatch" style:background-color={metadata.target_color2_hex}></span>
					<span class="lab-value">{formatLab(metadata.target_color2_lab)}</span>
					<span class="hex-value">{metadata.target_color2_hex}</span>
				</div>
			</div>
			{#if nearestFoundation2}
				<div class="nearest-row">
					<span class="nearest-label">↳ Nearest:</span>
					<div class="nearest-info">
						<span class="color-swatch small" style:background-color={nearestFoundation2.color.hex}></span>
						<span class="nearest-name" title="{nearestFoundation2.color.brand} - {nearestFoundation2.color.name}">
							{nearestFoundation2.color.name}
						</span>
						<span class="nearest-delta">ΔE: {nearestFoundation2.deltaE.toFixed(2)}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.metadata-card {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		overflow: hidden;
		font-size: 0.75rem;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: #f1f5f9;
		border-bottom: 1px solid #e2e8f0;
	}

	.filename {
		font-weight: 600;
		color: #334155;
		font-family: ui-monospace, monospace;
	}

	.makeup-badge {
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.65rem;
		font-weight: 600;
		background: #fce7f3;
		color: #be185d;
	}

	.card-body {
		padding: 0.75rem;
	}

	.label {
		color: #64748b;
		font-weight: 500;
	}

	.colors-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: white;
		border-radius: 0.375rem;
		border: 1px solid #e2e8f0;
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.color-row .label {
		width: 4.5rem;
		flex-shrink: 0;
	}

	.color-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 0.25rem;
		border: 1px solid rgba(0, 0, 0, 0.1);
		flex-shrink: 0;
	}

	.color-swatch.small {
		width: 1rem;
		height: 1rem;
	}

	.lab-value {
		color: #1e293b;
		font-weight: 600;
	}

	.hex-value {
		font-family: ui-monospace, monospace;
		color: #94a3b8;
		font-size: 0.65rem;
	}

	/* Nearest foundation color styles */
	.nearest-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0.5rem;
		margin-top: -0.125rem;
		margin-bottom: 0.25rem;
	}

	.nearest-label {
		width: 4rem;
		flex-shrink: 0;
		color: #94a3b8;
		font-size: 0.65rem;
		font-weight: 500;
	}

	.nearest-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.nearest-name {
		color: #64748b;
		font-weight: 500;
		font-size: 0.65rem;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nearest-delta {
		color: #475569;
		font-size: 0.6rem;
		font-weight: 600;
	}
</style>

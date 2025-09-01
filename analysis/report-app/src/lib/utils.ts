// Utility functions
import LZString from 'lz-string';

// Cache for vega specs
const vegaSpecCache = new Map<string, object>();

/**
 * Create a Vega Editor URL from a Vega-Lite spec.
 */
export function createVegaEditorUrl(spec: object): string {
	const specJson = JSON.stringify(spec);
	const compressed = LZString.compressToEncodedURIComponent(specJson);
	return `https://vega.github.io/editor/#/url/vega-lite/${compressed}`;
}

/**
 * Load a Vega spec from the given path.
 */
async function loadVegaSpec(vegaSpecPath: string): Promise<object | null> {
	// Convert path to static URL
	let path = vegaSpecPath;
	if (path.startsWith('/')) {
		path = path.slice(1);
	}

	// The vega specs are in the main public folder, not the report-app static folder
	// We'll need to fetch from the parent public directory
	// For now, return null since we don't have access to vega specs in report-app
	// In production, these would need to be copied or the path adjusted

	try {
		// Try fetching from relative path (assuming vega specs might be available)
		const response = await fetch(`/${path}`);
		if (response.ok) {
			return response.json();
		}
	} catch {
		// Spec not available
	}

	return null;
}

/**
 * Get the Vega Editor URL for a given spec path, using caching.
 */
export async function getVegaEditorUrlForPath(vegaSpecPath: string): Promise<string | null> {
	if (!vegaSpecPath) return null;

	if (vegaSpecCache.has(vegaSpecPath)) {
		return createVegaEditorUrl(vegaSpecCache.get(vegaSpecPath)!);
	}

	const spec = await loadVegaSpec(vegaSpecPath);
	if (spec) {
		vegaSpecCache.set(vegaSpecPath, spec);
		return createVegaEditorUrl(spec);
	}

	return null;
}

/**
 * Format a number with specified decimal places.
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2, signed: boolean = false): string {
	if (value === null || value === undefined || isNaN(value)) {
		return 'N/A';
	}
	const formatted = value.toFixed(decimals);
	if (signed && value > 0) {
		return `+${formatted}`;
	}
	return formatted;
}

/**
 * Format a percentage.
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
	if (value === null || value === undefined || isNaN(value)) {
		return 'N/A';
	}
	return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a timestamp to a readable date string.
 */
export function formatTimestamp(timestamp: number | null | undefined): string {
	if (!timestamp) return 'N/A';
	return new Date(timestamp).toLocaleString();
}

/**
 * Format duration in minutes.
 */
export function formatDuration(minutes: number | null | undefined): string {
	if (minutes === null || minutes === undefined || isNaN(minutes)) {
		return 'N/A';
	}
	return `${minutes.toFixed(1)} min`;
}

/**
 * Truncate a participant ID for display.
 */
export function truncateId(id: string, length: number = 16): string {
	if (id.length <= length) return id;
	return `${id.slice(0, length)}...`;
}

/**
 * Get badge class based on attention check performance.
 */
export function getAttentionBadgeClass(correct: number, total: number): string {
	if (total === 0) return 'bg-yellow-100 text-yellow-800';
	if (correct === total) return 'bg-green-100 text-green-800';
	if (correct >= total * 0.7) return 'bg-yellow-100 text-yellow-800';
	return 'bg-red-100 text-red-800';
}

/**
 * Get badge class based on exclusion status.
 */
export function getStatusBadgeClass(excluded: boolean): string {
	return excluded ? 'bg-red-500 text-white' : 'bg-green-100 text-green-800';
}

/**
 * Count occurrences of values in an array.
 */
export function countValues<T>(arr: T[]): Map<T, number> {
	const counts = new Map<T, number>();
	for (const item of arr) {
		counts.set(item, (counts.get(item) ?? 0) + 1);
	}
	return counts;
}

/**
 * Group an array by a key function.
 */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of arr) {
		const key = keyFn(item);
		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(item);
	}
	return groups;
}

/**
 * Custom axis order: L first, then a, then b
 */
const AXIS_ORDER: Record<string, number> = { L: 0, a: 1, b: 2 };

/**
 * Compare function for sorting by axis (L, a, b order) then by size.
 */
export function compareByAxisAndSize<T extends { axis?: string; size_deg?: number }>(
	a: T,
	b: T
): number {
	const axisA = a.axis ?? '';
	const axisB = b.axis ?? '';
	const orderA = AXIS_ORDER[axisA] ?? 99;
	const orderB = AXIS_ORDER[axisB] ?? 99;

	if (orderA !== orderB) return orderA - orderB;
	return (a.size_deg ?? 0) - (b.size_deg ?? 0);
}

/**
 * Compare function for sorting by axis (L, a, b order), size, then delta_e.
 */
export function compareByAxisSizeDeltaE<
	T extends { axis?: string; size_deg?: number; delta_e?: number }
>(a: T, b: T): number {
	const axisA = a.axis ?? '';
	const axisB = b.axis ?? '';
	const orderA = AXIS_ORDER[axisA] ?? 99;
	const orderB = AXIS_ORDER[axisB] ?? 99;

	if (orderA !== orderB) return orderA - orderB;
	if ((a.size_deg ?? 0) !== (b.size_deg ?? 0)) return (a.size_deg ?? 0) - (b.size_deg ?? 0);
	return (a.delta_e ?? 0) - (b.delta_e ?? 0);
}

/**
 * Expertise group classification based on makeup usage and color theory class
 */
export type ExpertiseGroup = 'colorExpert' | 'nonExpert';

/**
 * Classify a participant as 'colorExpert' or 'nonExpert' based on demographics.
 * 
 * Color Expert: Uses makeup regularly OR occasionally OR professionally OR has taken a color theory class
 * Non-Expert: Does not use makeup AND has not taken a color theory class
 */
export function classifyParticipantExpertise(
	use_makeup: string,
	color_theory_class: string
): ExpertiseGroup {
	const usesMakeup = use_makeup === 'I use it regularly' || use_makeup === 'I use it occasionally' || use_makeup === 'I use it professionally';
	const hasColorTheoryClass = color_theory_class === 'Yes';
	
	if (usesMakeup || hasColorTheoryClass) {
		return 'colorExpert';
	}
	
	return 'nonExpert';
}

/**
 * Get participant IDs grouped by expertise classification.
 */
export function getParticipantsByExpertise(
	demographics: Array<{ participantId: string; use_makeup: string; color_theory_class: string }>
): { colorExpert: Set<string>; nonExpert: Set<string> } {
	const colorExpert = new Set<string>();
	const nonExpert = new Set<string>();
	
	for (const demo of demographics) {
		const group = classifyParticipantExpertise(demo.use_makeup, demo.color_theory_class);
		if (group === 'colorExpert') {
			colorExpert.add(demo.participantId);
		} else {
			nonExpert.add(demo.participantId);
		}
	}
	
	return { colorExpert, nonExpert };
}

/**
 * Classify a participant as 'onlyColorExpert' (excluding occasional makeup users) or 'nonExpert'.
 * 
 * Only Color Expert: Uses makeup regularly OR professionally OR has taken a color theory class
 * BUT excludes those who use makeup occasionally (even if they meet other criteria)
 * Non-Expert: Does not use makeup AND has not taken a color theory class
 */
function classifyOnlyColorExpert(
	use_makeup: string,
	color_theory_class: string
): 'onlyColorExpert' | 'nonExpert' {
	// Exclude participants who use makeup occasionally
	if (use_makeup === 'I use it occasionally') {
		return 'nonExpert';
	}
	
	const usesMakeupRegularlyOrProfessionally = use_makeup === 'I use it regularly' || use_makeup === 'I use it professionally';
	const hasColorTheoryClass = color_theory_class === 'Yes';
	
	if (usesMakeupRegularlyOrProfessionally || hasColorTheoryClass) {
		return 'onlyColorExpert';
	}
	
	return 'nonExpert';
}

/**
 * Get participant IDs grouped by "Only Color Expert" (excluding occasional makeup users) vs Non-Expert.
 */
export function getParticipantsByOnlyColorExpert(
	demographics: Array<{ participantId: string; use_makeup: string; color_theory_class: string }>
): { onlyColorExpert: Set<string>; nonExpert: Set<string> } {
	const onlyColorExpert = new Set<string>();
	const nonExpert = new Set<string>();
	
	for (const demo of demographics) {
		const group = classifyOnlyColorExpert(demo.use_makeup, demo.color_theory_class);
		if (group === 'onlyColorExpert') {
			onlyColorExpert.add(demo.participantId);
		} else {
			nonExpert.add(demo.participantId);
		}
	}
	
	return { onlyColorExpert, nonExpert };
}
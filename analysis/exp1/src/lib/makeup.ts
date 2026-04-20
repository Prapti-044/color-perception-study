import type { ScatterplotMetadata, TrialDetails } from './types';

export type LabColor = ScatterplotMetadata['target_color1_lab'];

export interface FoundationColor {
	brand: string;
	name: string;
	hex: string;
	lab: LabColor;
}

export interface NearestFoundation {
	color: FoundationColor;
	deltaE: number;
}

export const MAKEUP_COLOR_DELTA_E_THRESHOLD = 10;

export function hexToLab(hex: string): LabColor {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;

	const rLinear = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	const gLinear = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	const bLinear = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

	let x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
	let y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
	let z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;

	x /= 0.95047;
	y /= 1.0;
	z /= 1.08883;

	const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
	const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
	const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

	const L = 116 * fy - 16;
	const a = 500 * (fx - fy);
	const B = 200 * (fy - fz);

	return {
		L: Math.round(L * 10) / 10,
		a: Math.round(a * 10) / 10,
		b: Math.round(B * 10) / 10
	};
}

export function calculateDeltaE(lab1: LabColor, lab2: LabColor): number {
	return Math.sqrt(
		Math.pow(lab1.L - lab2.L, 2) +
		Math.pow(lab1.a - lab2.a, 2) +
		Math.pow(lab1.b - lab2.b, 2)
	);
}

export function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current);
	return result;
}

export function parseFoundationColorsCsv(csvText: string): FoundationColor[] {
	const lines = csvText.split('\n');
	if (lines.length === 0) {
		return [];
	}

	const headers = lines[0].split(',');
	const colors: FoundationColor[] = [];

	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === '') {
			continue;
		}

		const values = parseCsvLine(lines[i]);
		if (values.length < headers.length) {
			continue;
		}

		const row: Record<string, string> = {};
		headers.forEach((header, index) => {
			row[header.trim()] = values[index] ? values[index].trim() : '';
		});

		if (!row.hex || !/^#[0-9A-Fa-f]{6}$/.test(row.hex)) {
			continue;
		}

		const lab = hexToLab(row.hex);
		if (lab.b < 0) {
			continue;
		}

		colors.push({
			brand: row.brand || 'Unknown',
			name: row.name && row.name !== 'NA' ? row.name : row.specific || 'Unknown',
			hex: row.hex,
			lab
		});
	}

	return colors;
}

export async function loadFoundationColors(
	url: string = '/foundation-names/allShades.csv'
): Promise<FoundationColor[]> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load foundation colors from ${url}`);
	}

	return parseFoundationColorsCsv(await response.text());
}

export function findNearestFoundation(
	targetLab: LabColor,
	foundationColors: FoundationColor[]
): NearestFoundation | null {
	if (foundationColors.length === 0) {
		return null;
	}

	let nearest = foundationColors[0];
	let minDeltaE = calculateDeltaE(targetLab, foundationColors[0].lab);

	for (let i = 1; i < foundationColors.length; i++) {
		const deltaE = calculateDeltaE(targetLab, foundationColors[i].lab);
		if (deltaE < minDeltaE) {
			minDeltaE = deltaE;
			nearest = foundationColors[i];
		}
	}

	return {
		color: nearest,
		deltaE: minDeltaE
	};
}

export function isMakeupColorMatch(nearestFoundation: NearestFoundation | null | undefined): boolean {
	return nearestFoundation !== null
		&& nearestFoundation !== undefined
		&& nearestFoundation.deltaE < MAKEUP_COLOR_DELTA_E_THRESHOLD;
}

export function isMakeupColorScatterplot(
	scatterplot: ScatterplotMetadata,
	foundationColors: FoundationColor[]
): boolean {
	return isMakeupColorMatch(findNearestFoundation(scatterplot.target_color1_lab, foundationColors))
		|| isMakeupColorMatch(findNearestFoundation(scatterplot.target_color2_lab, foundationColors));
}

export function getStandardTrialMetadataKey(
	scatterplot: Pick<ScatterplotMetadata, 'index' | 'axis'>
): string {
	return `${scatterplot.index}-${scatterplot.axis}`;
}

export function getStandardTrialKey(
	trial: Pick<TrialDetails, 'scatter_index' | 'axis'>
): string | null {
	if (!trial.axis) {
		return null;
	}

	return `${trial.scatter_index}-${trial.axis}`;
}

export function buildMakeupStimulusKeySet(
	scatterplots: ScatterplotMetadata[],
	foundationColors: FoundationColor[]
): Set<string> {
	return new Set(
		scatterplots
			.filter((scatterplot) => isMakeupColorScatterplot(scatterplot, foundationColors))
			.map((scatterplot) => getStandardTrialMetadataKey(scatterplot))
	);
}

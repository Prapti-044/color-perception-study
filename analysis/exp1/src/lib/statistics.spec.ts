import { describe, expect, it } from 'vitest';
import { ORIGINAL_PAPER_RESULTS } from './constants';
import {
	compareToReference,
	computePairedStats,
	concordanceCorrelation,
	meanAbsoluteError,
	pearsonR,
	rootMeanSquareError
} from './statistics';
import type { InverseModelRow, RegressionRow } from './types';

function approxEqual(actual: number, expected: number, tolerance = 1e-6): boolean {
	if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
	return Math.abs(actual - expected) <= tolerance;
}

describe('pearsonR', () => {
	it('returns 1 for perfectly correlated vectors', () => {
		expect(pearsonR([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
	});

	it('returns -1 for perfectly anti-correlated vectors', () => {
		expect(pearsonR([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
	});

	it('returns NaN when a vector has zero variance', () => {
		expect(Number.isNaN(pearsonR([1, 1, 1], [1, 2, 3]))).toBe(true);
	});

	it('returns NaN when the vectors have unequal lengths', () => {
		expect(Number.isNaN(pearsonR([1, 2], [1, 2, 3]))).toBe(true);
	});
});

describe('concordanceCorrelation', () => {
	it('returns 1 when the two vectors are identical', () => {
		expect(concordanceCorrelation([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 10);
	});

	it('drops below the Pearson r when there is a location shift', () => {
		const x = [1, 2, 3, 4];
		const y = [3, 4, 5, 6];
		const ccc = concordanceCorrelation(x, y);
		const r = pearsonR(x, y);
		expect(r).toBeCloseTo(1, 10);
		expect(ccc).toBeLessThan(r);
		expect(ccc).toBeGreaterThan(0);
	});
});

describe('rootMeanSquareError and meanAbsoluteError', () => {
	it('produce zero for identical vectors', () => {
		expect(rootMeanSquareError([1, 2, 3], [1, 2, 3])).toBe(0);
		expect(meanAbsoluteError([1, 2, 3], [1, 2, 3])).toBe(0);
	});

	it('produce the expected values on a small example', () => {
		expect(rootMeanSquareError([1, 2, 3], [2, 4, 6])).toBeCloseTo(Math.sqrt((1 + 4 + 9) / 3), 10);
		expect(meanAbsoluteError([1, 2, 3], [2, 4, 6])).toBeCloseTo((1 + 2 + 3) / 3, 10);
	});
});

describe('computePairedStats', () => {
	it('computes zero mean difference and Cohen dz for identical inputs', () => {
		const stats = computePairedStats([1, 2, 3, 4], [1, 2, 3, 4]);

		expect(stats.n).toBe(4);
		expect(stats.mean_diff).toBe(0);
		expect(stats.sd_diff).toBe(0);
		// Zero SD → the t and dz are undefined; we surface NaN explicitly.
		expect(Number.isNaN(stats.cohens_dz)).toBe(true);
		expect(stats.pearson_r).toBeCloseTo(1, 10);
		expect(stats.ccc).toBeCloseTo(1, 10);
		expect(stats.rmse).toBe(0);
	});

	it('matches a hand-computed paired t-test and Cohen dz', () => {
		// differences = [2, 2, 2, 2, 2, 2] → SD 0 case, so use non-constant diffs.
		const current = [10, 12, 15, 18, 20, 25];
		const reference = [9, 11, 13, 17, 22, 24];
		const stats = computePairedStats(current, reference);

		const diffs = current.map((value, index) => value - reference[index]);
		const meanDiff = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
		const sqDeviations = diffs.reduce((sum, value) => sum + (value - meanDiff) ** 2, 0);
		const sdDiff = Math.sqrt(sqDeviations / (diffs.length - 1));
		const t = meanDiff / (sdDiff / Math.sqrt(diffs.length));

		expect(stats.n).toBe(6);
		expect(stats.mean_diff).toBeCloseTo(meanDiff, 10);
		expect(stats.sd_diff).toBeCloseTo(sdDiff, 10);
		expect(stats.t).toBeCloseTo(t, 10);
		expect(stats.df).toBe(5);
		expect(stats.cohens_dz).toBeCloseTo(meanDiff / sdDiff, 10);
		expect(stats.p).toBeGreaterThan(0);
		expect(stats.p).toBeLessThanOrEqual(1);
	});

	it('returns NaN statistics when there are too few observations', () => {
		const stats = computePairedStats([1], [2]);

		expect(stats.n).toBe(1);
		expect(Number.isNaN(stats.mean_diff)).toBe(true);
		expect(Number.isNaN(stats.pearson_r)).toBe(true);
	});
});

describe('compareToReference', () => {
	function buildRegressionRow(
		axis: 'L' | 'a' | 'b',
		size: number,
		overrides: Partial<RegressionRow> = {}
	): RegressionRow {
		const refRow = ORIGINAL_PAPER_RESULTS.regression[axis][size];
		return {
			axis,
			size_deg: size,
			slope: refRow.slope,
			slope_se: 0.005,
			r2: refRow.r2,
			ND50: refRow.nd50,
			ND50_se: 0.5,
			...overrides
		};
	}

	function referenceRegressionTable(): RegressionRow[] {
		const rows: RegressionRow[] = [];
		for (const axis of ['L', 'a', 'b'] as const) {
			const axisReg = ORIGINAL_PAPER_RESULTS.regression[axis];
			for (const [size] of Object.entries(axisReg)) {
				rows.push(buildRegressionRow(axis, Number(size)));
			}
		}
		return rows;
	}

	function referenceInverseModelTable(): InverseModelRow[] {
		return (['L', 'a', 'b'] as const).map((axis) => ({
			axis,
			c_x: ORIGINAL_PAPER_RESULTS.inverse_model[axis].c,
			k_x: ORIGINAL_PAPER_RESULTS.inverse_model[axis].k,
			R2: ORIGINAL_PAPER_RESULTS.inverse_model[axis].r2
		}));
	}

	it('yields zero differences and neutral effect sizes when we replay Szafir et al.', () => {
		const { regressionComparison, axisComparison } = compareToReference(
			referenceRegressionTable(),
			referenceInverseModelTable()
		);

		expect(regressionComparison.length).toBeGreaterThan(0);
		for (const row of regressionComparison) {
			expect(row.slope_diff).toBe(0);
			expect(row.nd50_diff).toBe(0);
			expect(row.slope_z).toBe(0);
			expect(row.slope_cohens_d).toBe(0);
			expect(row.better).toBe('tie');
		}

		expect(axisComparison).toHaveLength(3);
		for (const summary of axisComparison) {
			expect(summary.slope.mean_diff).toBe(0);
			expect(summary.nd50.mean_diff).toBe(0);
			expect(summary.slope.rmse).toBe(0);
			expect(summary.nd50.rmse).toBe(0);
			expect(summary.better).toBe('tie');
		}
	});

	it('flags Szafir as better when current slopes are uniformly lower', () => {
		const rows: RegressionRow[] = [];
		for (const axis of ['L', 'a', 'b'] as const) {
			const axisReg = ORIGINAL_PAPER_RESULTS.regression[axis];
			for (const [size, refRow] of Object.entries(axisReg)) {
				rows.push(
					buildRegressionRow(axis, Number(size), {
						slope: refRow.slope * 0.5,
						ND50: refRow.nd50 * 2
					})
				);
			}
		}

		const { regressionComparison, axisComparison } = compareToReference(
			rows,
			referenceInverseModelTable()
		);

		expect(regressionComparison.every((row) => row.better === 'reference')).toBe(true);
		expect(axisComparison.every((summary) => summary.better === 'reference')).toBe(true);
		for (const summary of axisComparison) {
			expect(summary.slope.mean_diff).toBeLessThan(0);
			expect(summary.nd50.mean_diff).toBeGreaterThan(0);
			expect(summary.slope.cohens_dz).toBeLessThan(0);
		}
	});

	it('produces a significant Wald test when a slope is many SE away from the reference', () => {
		// Move the L axis at 0.5° well above the reference and shrink the SE so
		// that the z-statistic is comfortably in the tails of the t-distribution.
		const rows = referenceRegressionTable().map((row) => {
			if (row.axis === 'L' && approxEqual(row.size_deg, 0.5, 1e-9)) {
				return { ...row, slope: row.slope + 0.05, slope_se: 0.005 };
			}
			return row;
		});

		const { regressionComparison } = compareToReference(rows, referenceInverseModelTable());
		const shifted = regressionComparison.find(
			(row) => row.axis === 'L' && approxEqual(row.size_deg, 0.5, 1e-9)
		);

		expect(shifted).toBeDefined();
		expect(shifted!.better).toBe('current');
		expect(shifted!.slope_p).toBeLessThan(0.01);
		expect(Math.abs(shifted!.slope_cohens_d)).toBeGreaterThan(0.8); // large effect
	});
});

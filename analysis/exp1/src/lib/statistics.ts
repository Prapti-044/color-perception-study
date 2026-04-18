// Statistical analysis functions
import { ORIGINAL_PAPER_RESULTS } from './constants';

import type {
	TrialDetails,
	DiscriminabilityRow,
	RegressionRow,
	InverseModelRow,
	RegressionComparison,
	InverseModelComparison
} from './types';

/**
 * Compute discriminability p for each axis × size × deltaE.
 */
export function computeDiscriminability(trials: TrialDetails[]): DiscriminabilityRow[] {
	// Filter to diff trials only
	const diffTrials = trials.filter((t) => t.is_diff_trial);

	// Group by axis, size, and absolute delta_e
	const groups = new Map<string, { correct: boolean[]; participants: Set<string> }>();

	for (const trial of diffTrials) {
		if (trial.axis === undefined || trial.point_diameter_degrees === undefined || trial.delta_e === undefined) {
			continue;
		}

		const key = `${trial.axis}-${trial.point_diameter_degrees}-${Math.abs(trial.delta_e)}`;

		if (!groups.has(key)) {
			groups.set(key, { correct: [], participants: new Set() });
		}

		const group = groups.get(key)!;
		group.correct.push(trial.correct);
		group.participants.add(trial.participantId);
	}

	// Calculate discriminability for each group
	const results: DiscriminabilityRow[] = [];

	for (const [key, group] of groups) {
		const [axis, sizeDeg, deltaE] = key.split('-');
		const p = group.correct.filter((c) => c).length / group.correct.length;

		results.push({
			axis,
			size_deg: parseFloat(sizeDeg),
			delta_e: parseFloat(deltaE),
			p,
			n_trials: group.correct.length,
			n_participants: group.participants.size
		});
	}

	// Sort by axis, size, delta_e
	results.sort((a, b) => {
		if (a.axis !== b.axis) return a.axis.localeCompare(b.axis);
		if (a.size_deg !== b.size_deg) return a.size_deg - b.size_deg;
		return a.delta_e - b.delta_e;
	});

	return results;
}

/**
 * Fit OLS regression through origin: y = m * x (no intercept).
 * Returns slope, R² (uncentered), and standard error of slope.
 */
function fitOLSNoIntercept(x: number[], y: number[]): { slope: number; r2: number; slope_se: number } {
	const n = x.length;
	if (n < 2 || n !== y.length) {
		return { slope: NaN, r2: NaN, slope_se: NaN };
	}

	// For y = m*x (no intercept):
	// m = sum(x*y) / sum(x^2)
	let sumXY = 0;
	let sumXX = 0;
	let sumYY = 0;

	for (let i = 0; i < n; i++) {
		sumXY += x[i] * y[i];
		sumXX += x[i] * x[i];
		sumYY += y[i] * y[i];
	}

	const slope = sumXY / sumXX;

	// Uncentered R² for regression through origin (matches statsmodels OLS without constant)
	// R² = 1 - SS_res / SS_tot_uncentered
	// where SS_res = sum((y - m*x)^2) and SS_tot_uncentered = sum(y^2)
	let ssRes = 0;

	for (let i = 0; i < n; i++) {
		const predicted = slope * x[i];
		ssRes += (y[i] - predicted) ** 2;
	}

	// sumYY is already Σy² (uncentered total sum of squares)
	const r2 = sumYY > 0 ? 1 - ssRes / sumYY : NaN;

	// Standard error of slope for regression through origin
	// SE(slope) = sqrt(MSE / sum(x^2))
	// where MSE = SS_res / (n - 1) for regression through origin with 1 parameter
	const df = n - 1; // degrees of freedom (n - number of parameters)
	const mse = ssRes / df;
	const slope_se = Math.sqrt(mse / sumXX);

	return { slope, r2, slope_se };
}

/**
 * For each axis and size, fit p = m_x × ΔE (no intercept).
 */
export function fitSizeAxisRegressions(discrim: DiscriminabilityRow[]): RegressionRow[] {
	const results: RegressionRow[] = [];

	// Get unique axes
	const axes = [...new Set(discrim.map((d) => d.axis).filter((a) => a !== undefined))];

	for (const axis of axes) {
		const axisData = discrim.filter((d) => d.axis === axis);

		// Get unique sizes for this axis
		const sizes = [...new Set(axisData.map((d) => d.size_deg))].sort((a, b) => a - b);

		for (const size of sizes) {
			const sizeData = axisData.filter((d) => d.size_deg === size);

			if (sizeData.length < 2) continue;

			const x = sizeData.map((d) => d.delta_e);
			const y = sizeData.map((d) => d.p);

			const { slope, r2, slope_se } = fitOLSNoIntercept(x, y);

			// ND(50%) = 0.5 / slope
			const ND50 = slope > 0 ? 0.5 / slope : NaN;

			// Standard error of ND(50%) using delta method:
			// ND50 = 0.5 / slope
			// d(ND50)/d(slope) = -0.5 / slope²
			// SE(ND50) = |d(ND50)/d(slope)| × SE(slope) = (0.5 / slope²) × SE(slope)
			const ND50_se = slope > 0 ? (0.5 / (slope * slope)) * slope_se : NaN;

			results.push({
				axis,
				size_deg: size,
				slope,
				slope_se,
				r2,
				ND50,
				ND50_se
			});
		}
	}

	return results;
}

/**
 * Fit slope ~ c_x + k_x / size for each axis.
 */
export function fitInverseSizeModel(regTable: RegressionRow[]): InverseModelRow[] {
	const results: InverseModelRow[] = [];

	// Get unique axes
	const axes = [...new Set(regTable.map((r) => r.axis))];

	for (const axis of axes) {
		const axisData = regTable.filter((r) => r.axis === axis);

		if (axisData.length < 2) continue;

		// Fit: slope = c_x + k_x * (1/size)
		// This is a linear regression: y = a + b*x where x = 1/size, y = slope
		const x = axisData.map((d) => 1 / d.size_deg);
		const y = axisData.map((d) => d.slope);

		const n = x.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumXX = 0;

		for (let i = 0; i < n; i++) {
			sumX += x[i];
			sumY += y[i];
			sumXY += x[i] * y[i];
			sumXX += x[i] * x[i];
		}

		// Linear regression formulas
		const meanX = sumX / n;
		const meanY = sumY / n;

		const ssXY = sumXY - n * meanX * meanY;
		const ssXX = sumXX - n * meanX * meanX;

		const k_x = ssXY / ssXX; // slope of the regression (coefficient of 1/size)
		const c_x = meanY - k_x * meanX; // intercept (constant term)

		// R²
		let ssTot = 0;
		let ssRes = 0;
		for (let i = 0; i < n; i++) {
			const predicted = c_x + k_x * x[i];
			ssRes += (y[i] - predicted) ** 2;
			ssTot += (y[i] - meanY) ** 2;
		}

		const R2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

		results.push({
			axis,
			c_x,
			k_x,
			R2
		});
	}

	return results;
}

/**
 * Compute ND_x(p, s) = p / (c_x + k_x / s).
 */
export function ND(
	axis: string,
	p: number,
	sDeg: number,
	invModel: InverseModelRow[]
): number {
	const row = invModel.find((r) => r.axis === axis);
	if (!row) {
		throw new Error(`Axis ${axis} not found in inverse-size model.`);
	}
	const denom = row.c_x + row.k_x / sDeg;
	return p / denom;
}

/**
 * Result of fitting ND(50%, s) = A + B/s to empirical ND values.
 */
export interface NDLinearFitRow {
	axis: string;
	A: number; // intercept (asymptotic ND as s → ∞)
	B: number; // coefficient of 1/s
	A_se: number; // standard error of A
	B_se: number; // standard error of B
	R2: number;
	n_points: number;
	// Data points used for the fit
	sizes: number[];
	nd_values: number[];
	nd_se_values: number[];
}

/**
 * Fit ND(50%, s) = A + B/s to empirical ND values for each axis.
 * 
 * This is a LINEAR REGRESSION of ND vs 1/s, which gives:
 * - A: intercept (asymptotic ND when size is large)
 * - B: slope w.r.t. 1/s (extra ND penalty for small sizes)
 */
export function fitNDLinearModel(regTable: RegressionRow[]): NDLinearFitRow[] {
	const results: NDLinearFitRow[] = [];

	// Get unique axes
	const axes = [...new Set(regTable.map((r) => r.axis))];

	for (const axis of axes) {
		const axisData = regTable.filter((r) => r.axis === axis && !isNaN(r.ND50));

		if (axisData.length < 2) continue;

		// x = 1/s, y = ND50
		const x = axisData.map((d) => 1 / d.size_deg);
		const y = axisData.map((d) => d.ND50);
		const sizes = axisData.map((d) => d.size_deg);
		const nd_se = axisData.map((d) => d.ND50_se);

		const n = x.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumXX = 0;

		for (let i = 0; i < n; i++) {
			sumX += x[i];
			sumY += y[i];
			sumXY += x[i] * y[i];
			sumXX += x[i] * x[i];
		}

		// Linear regression: y = A + B*x where x = 1/s
		const meanX = sumX / n;
		const meanY = sumY / n;

		const ssXY = sumXY - n * meanX * meanY;
		const ssXX = sumXX - n * meanX * meanX;

		const B = ssXY / ssXX; // slope (coefficient of 1/s)
		const A = meanY - B * meanX; // intercept

		// Compute R² and standard errors
		let ssTot = 0;
		let ssRes = 0;
		for (let i = 0; i < n; i++) {
			const predicted = A + B * x[i];
			ssRes += (y[i] - predicted) ** 2;
			ssTot += (y[i] - meanY) ** 2;
		}

		const R2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

		// Standard errors
		const df = n - 2; // degrees of freedom for linear regression with 2 params
		const mse = df > 0 ? ssRes / df : NaN;
		const se_B = Math.sqrt(mse / ssXX);
		const se_A = Math.sqrt(mse * (1 / n + (meanX * meanX) / ssXX));

		results.push({
			axis,
			A,
			B,
			A_se: se_A,
			B_se: se_B,
			R2,
			n_points: n,
			sizes,
			nd_values: y,
			nd_se_values: nd_se
		});
	}

	return results;
}

/**
 * Compare current study results to original paper results.
 */
export function compareToReference(
	regTable: RegressionRow[],
	invModel: InverseModelRow[]
): {
	regressionComparison: RegressionComparison[];
	inverseModelComparison: InverseModelComparison[];
} {
	const refReg = ORIGINAL_PAPER_RESULTS.regression;
	const refInv = ORIGINAL_PAPER_RESULTS.inverse_model;

	// Compare per-size regression results
	const regComparisonRows: RegressionComparison[] = [];

	for (const row of regTable) {
		const axis = row.axis;
		const size = row.size_deg;

		// Find closest reference size (original paper used 0.25, 0.5, 0.75, 1.0, 1.5, 2.0)
		const refSizes = Object.keys(refReg[axis] ?? {}).map(Number);
		if (refSizes.length === 0) continue;

		const closestSize = refSizes.reduce((prev, curr) =>
			Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
		);

		const refData = refReg[axis]?.[closestSize];
		if (!refData) continue;

		const slopeDiff = row.slope - refData.slope;
		const slopePctDiff = refData.slope !== 0 ? (slopeDiff / refData.slope) * 100 : NaN;
		const r2Diff = row.r2 - refData.r2;
		const nd50Diff = !isNaN(row.ND50) ? row.ND50 - refData.nd50 : NaN;

		regComparisonRows.push({
			axis,
			size_deg: size,
			current_slope: row.slope,
			ref_slope: refData.slope,
			slope_diff: slopeDiff,
			slope_pct_diff: slopePctDiff,
			current_r2: row.r2,
			ref_r2: refData.r2,
			r2_diff: r2Diff,
			current_nd50: row.ND50,
			ref_nd50: refData.nd50,
			nd50_diff: nd50Diff,
			ref_size_matched: closestSize
		});
	}

	// Compare inverse model parameters
	const invComparisonRows: InverseModelComparison[] = [];

	for (const row of invModel) {
		const axis = row.axis;
		const refData = refInv[axis];

		if (!refData) continue;

		const cDiff = row.c_x - refData.c;
		const kDiff = row.k_x - refData.k;
		const r2Diff = !isNaN(row.R2) ? row.R2 - refData.r2 : NaN;

		invComparisonRows.push({
			axis,
			current_c: row.c_x,
			ref_c: refData.c,
			c_diff: cDiff,
			current_k: row.k_x,
			ref_k: refData.k,
			k_diff: kDiff,
			current_r2: row.R2,
			ref_r2: refData.r2,
			r2_diff: r2Diff
		});
	}

	return {
		regressionComparison: regComparisonRows,
		inverseModelComparison: invComparisonRows
	};
}

// Statistical analysis functions
import { ORIGINAL_PAPER_RESULTS } from './constants';

import type {
	TrialDetails,
	DiscriminabilityRow,
	RegressionRow,
	InverseModelRow,
	NDLinearFitRow,
	RegressionComparison,
	InverseModelComparison,
	AxisComparisonSummary,
	PairedStats,
	BetterModel,
	ExpertiseGroup,
	ParticipantAccuracyRow,
	WelchTTestResult
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
 * Compute one accuracy value per participant for the Welch t-test.
 */
export function computeParticipantAccuracyRows(
	trials: TrialDetails[],
	group: ExpertiseGroup
): ParticipantAccuracyRow[] {
	const trialsByParticipant = new Map<string, TrialDetails[]>();

	for (const trial of trials) {
		if (trial.trial_type !== 'standard' || trial.excluded || !trial.is_diff_trial || trial.answer === null) {
			continue;
		}

		if (!trialsByParticipant.has(trial.participantId)) {
			trialsByParticipant.set(trial.participantId, []);
		}
		trialsByParticipant.get(trial.participantId)!.push(trial);
	}

	return [...trialsByParticipant.entries()]
		.map(([participantId, participantTrials]) => {
			const nCorrect = participantTrials.filter((trial) => trial.is_correct).length;

			return {
				participantId,
				group,
				accuracy: nCorrect / participantTrials.length,
				n_trials: participantTrials.length,
				n_correct: nCorrect
			};
		})
		.sort((a, b) => a.participantId.localeCompare(b.participantId));
}

function sampleVariance(values: number[], mean: number): number {
	if (values.length < 2) {
		return NaN;
	}

	const ss = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
	return ss / (values.length - 1);
}

function logGamma(value: number): number {
	const coefficients = [
		676.5203681218851,
		-1259.1392167224028,
		771.3234287776531,
		-176.6150291621406,
		12.507343278686905,
		-0.13857109526572012,
		9.984369578019572e-6,
		1.5056327351493116e-7
	];

	if (value < 0.5) {
		return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
	}

	let x = 0.9999999999998099;
	const z = value - 1;
	for (let i = 0; i < coefficients.length; i++) {
		x += coefficients[i] / (z + i + 1);
	}

	const t = z + coefficients.length - 0.5;
	return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
	const maxIterations = 100;
	const epsilon = 3e-7;
	const fpMin = 1e-30;
	let qab = a + b;
	let qap = a + 1;
	let qam = a - 1;
	let c = 1;
	let d = 1 - (qab * x) / qap;

	if (Math.abs(d) < fpMin) d = fpMin;
	d = 1 / d;
	let h = d;

	for (let m = 1; m <= maxIterations; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < fpMin) d = fpMin;
		c = 1 + aa / c;
		if (Math.abs(c) < fpMin) c = fpMin;
		d = 1 / d;
		h *= d * c;

		aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < fpMin) d = fpMin;
		c = 1 + aa / c;
		if (Math.abs(c) < fpMin) c = fpMin;
		d = 1 / d;
		const del = d * c;
		h *= del;

		if (Math.abs(del - 1) < epsilon) {
			break;
		}
	}

	return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;

	const bt = Math.exp(
		logGamma(a + b) -
			logGamma(a) -
			logGamma(b) +
			a * Math.log(x) +
			b * Math.log(1 - x)
	);

	if (x < (a + 1) / (a + b + 2)) {
		return (bt * betaContinuedFraction(x, a, b)) / a;
	}

	return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function studentTTwoTailedPValue(t: number, df: number): number {
	if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) {
		return NaN;
	}

	const x = df / (df + t * t);
	return regularizedIncompleteBeta(x, df / 2, 0.5);
}

/**
 * Pearson correlation coefficient between two equal-length numeric vectors.
 */
export function pearsonR(x: number[], y: number[]): number {
	if (x.length !== y.length || x.length < 2) {
		return NaN;
	}

	const n = x.length;
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;
	let sumYY = 0;

	for (let i = 0; i < n; i++) {
		sumX += x[i];
		sumY += y[i];
		sumXY += x[i] * y[i];
		sumXX += x[i] * x[i];
		sumYY += y[i] * y[i];
	}

	const num = n * sumXY - sumX * sumY;
	const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
	return den > 0 ? num / den : NaN;
}

/**
 * Lin's concordance correlation coefficient (CCC) measures agreement between
 * paired measurements. It is bounded by [-1, 1], where 1 indicates perfect
 * agreement (points fall on the 45° line), and 0 indicates no agreement.
 */
export function concordanceCorrelation(x: number[], y: number[]): number {
	if (x.length !== y.length || x.length < 2) {
		return NaN;
	}

	const n = x.length;
	const meanX = x.reduce((sum, value) => sum + value, 0) / n;
	const meanY = y.reduce((sum, value) => sum + value, 0) / n;

	let varX = 0;
	let varY = 0;
	let cov = 0;

	for (let i = 0; i < n; i++) {
		varX += (x[i] - meanX) ** 2;
		varY += (y[i] - meanY) ** 2;
		cov += (x[i] - meanX) * (y[i] - meanY);
	}

	varX /= n;
	varY /= n;
	cov /= n;

	const den = varX + varY + (meanX - meanY) ** 2;
	return den > 0 ? (2 * cov) / den : NaN;
}

/**
 * Root mean square error between predicted and observed vectors.
 */
export function rootMeanSquareError(pred: number[], obs: number[]): number {
	if (pred.length !== obs.length || pred.length === 0) {
		return NaN;
	}

	let ss = 0;
	for (let i = 0; i < pred.length; i++) {
		ss += (pred[i] - obs[i]) ** 2;
	}
	return Math.sqrt(ss / pred.length);
}

/**
 * Mean absolute error between predicted and observed vectors.
 */
export function meanAbsoluteError(pred: number[], obs: number[]): number {
	if (pred.length !== obs.length || pred.length === 0) {
		return NaN;
	}

	let total = 0;
	for (let i = 0; i < pred.length; i++) {
		total += Math.abs(pred[i] - obs[i]);
	}
	return total / pred.length;
}

/**
 * Paired-sample statistics on two equal-length vectors of current vs reference
 * measurements. Uses each paired difference (current − ref) to compute a
 * paired t-test, Cohen's d_z (standardised mean of the differences), Pearson
 * correlation, RMSE, MAE, and Lin's concordance correlation coefficient.
 */
export function computePairedStats(current: number[], reference: number[]): PairedStats {
	const emptyStats: PairedStats = {
		n: 0,
		current_mean: NaN,
		ref_mean: NaN,
		mean_diff: NaN,
		sd_diff: NaN,
		t: NaN,
		df: NaN,
		p: NaN,
		cohens_dz: NaN,
		pearson_r: NaN,
		rmse: NaN,
		mae: NaN,
		ccc: NaN
	};

	if (current.length !== reference.length || current.length < 2) {
		return { ...emptyStats, n: current.length };
	}

	const n = current.length;
	const diffs = current.map((value, index) => value - reference[index]);
	const currentMean = current.reduce((sum, value) => sum + value, 0) / n;
	const refMean = reference.reduce((sum, value) => sum + value, 0) / n;
	const meanDiff = diffs.reduce((sum, value) => sum + value, 0) / n;
	const sdDiff = Math.sqrt(sampleVariance(diffs, meanDiff));
	const df = n - 1;

	let t = NaN;
	let p = NaN;
	let cohensDz = NaN;

	if (sdDiff > 0 && Number.isFinite(sdDiff)) {
		t = meanDiff / (sdDiff / Math.sqrt(n));
		p = studentTTwoTailedPValue(t, df);
		cohensDz = meanDiff / sdDiff;
	}

	return {
		n,
		current_mean: currentMean,
		ref_mean: refMean,
		mean_diff: meanDiff,
		sd_diff: sdDiff,
		t,
		df,
		p,
		cohens_dz: cohensDz,
		pearson_r: pearsonR(current, reference),
		rmse: rootMeanSquareError(current, reference),
		mae: meanAbsoluteError(current, reference),
		ccc: concordanceCorrelation(current, reference)
	};
}

/**
 * Wald-style comparison of a fitted estimate to a fixed reference value.
 * z = (estimate − reference) / SE. Cohen's d in this Wald form treats SE as
 * the standard error of the estimate, so d equals z and reports the number of
 * standard errors between the two point estimates.
 */
function waldComparison(
	estimate: number,
	referenceValue: number,
	standardError: number,
	df: number
): { z: number; p: number; d: number } {
	if (
		!Number.isFinite(estimate) ||
		!Number.isFinite(referenceValue) ||
		!Number.isFinite(standardError) ||
		standardError <= 0
	) {
		return { z: NaN, p: NaN, d: NaN };
	}

	const z = (estimate - referenceValue) / standardError;
	const p =
		Number.isFinite(df) && df > 0
			? studentTTwoTailedPValue(z, df)
			: studentTTwoTailedPValue(z, 1e6);
	return { z, p, d: z };
}

function classifyWinner(currentSlope: number, refSlope: number): BetterModel {
	if (!Number.isFinite(currentSlope) || !Number.isFinite(refSlope)) {
		return 'tie';
	}
	if (currentSlope === refSlope) return 'tie';
	return currentSlope > refSlope ? 'current' : 'reference';
}

/**
 * Welch two-sample t-test for unequal variances.
 */
export function welchTTest(
	group1Values: number[],
	group2Values: number[],
	group1Label: string,
	group2Label: string
): WelchTTestResult | null {
	if (group1Values.length < 2 || group2Values.length < 2) {
		return null;
	}

	const group1Mean = group1Values.reduce((sum, value) => sum + value, 0) / group1Values.length;
	const group2Mean = group2Values.reduce((sum, value) => sum + value, 0) / group2Values.length;
	const group1Variance = sampleVariance(group1Values, group1Mean);
	const group2Variance = sampleVariance(group2Values, group2Mean);
	const group1Term = group1Variance / group1Values.length;
	const group2Term = group2Variance / group2Values.length;
	const standardError = Math.sqrt(group1Term + group2Term);

	if (standardError === 0 || !Number.isFinite(standardError)) {
		return null;
	}

	const t = (group1Mean - group2Mean) / standardError;
	const dfNumerator = (group1Term + group2Term) ** 2;
	const dfDenominator =
		(group1Term ** 2) / (group1Values.length - 1) +
		(group2Term ** 2) / (group2Values.length - 1);
	const df = dfNumerator / dfDenominator;
	const p = studentTTwoTailedPValue(t, df);

	return {
		group1Label,
		group2Label,
		group1Mean,
		group2Mean,
		meanDifference: group1Mean - group2Mean,
		group1N: group1Values.length,
		group2N: group2Values.length,
		group1Variance,
		group2Variance,
		t,
		df,
		p
	};
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
 *
 * Adds per-row Wald tests (z, p, Cohen's d) against the reference slope and
 * ND50, and produces a paired per-axis summary (paired t-test, Cohen's d_z,
 * Pearson r, CCC, RMSE, MAE) that treats each size as one paired observation.
 */
export function compareToReference(
	regTable: RegressionRow[],
	invModel: InverseModelRow[]
): {
	regressionComparison: RegressionComparison[];
	inverseModelComparison: InverseModelComparison[];
	axisComparison: AxisComparisonSummary[];
} {
	const refReg = ORIGINAL_PAPER_RESULTS.regression;
	const refInv = ORIGINAL_PAPER_RESULTS.inverse_model;
	const nDeltaELevels = ORIGINAL_PAPER_RESULTS.study_params.n_delta_e_levels;
	// Per-size regression fits use (n_delta_e_levels − 1) residual df when the
	// slope is the only fitted parameter (no intercept).
	const rowDf = Math.max(1, nDeltaELevels - 1);

	const regComparisonRows: RegressionComparison[] = [];

	for (const row of regTable) {
		const axis = row.axis;
		const size = row.size_deg;

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
		const nd50PctDiff =
			refData.nd50 !== 0 && !isNaN(row.ND50) ? (nd50Diff / refData.nd50) * 100 : NaN;

		const slopeWald = waldComparison(row.slope, refData.slope, row.slope_se, rowDf);
		const nd50Wald = waldComparison(row.ND50, refData.nd50, row.ND50_se, rowDf);

		regComparisonRows.push({
			axis,
			size_deg: size,
			current_slope: row.slope,
			current_slope_se: row.slope_se,
			ref_slope: refData.slope,
			slope_diff: slopeDiff,
			slope_pct_diff: slopePctDiff,
			current_r2: row.r2,
			ref_r2: refData.r2,
			r2_diff: r2Diff,
			current_nd50: row.ND50,
			current_nd50_se: row.ND50_se,
			ref_nd50: refData.nd50,
			nd50_diff: nd50Diff,
			nd50_pct_diff: nd50PctDiff,
			ref_size_matched: closestSize,
			slope_z: slopeWald.z,
			slope_p: slopeWald.p,
			slope_cohens_d: slopeWald.d,
			nd50_z: nd50Wald.z,
			nd50_p: nd50Wald.p,
			nd50_cohens_d: nd50Wald.d,
			better: classifyWinner(row.slope, refData.slope)
		});
	}

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

	const axisComparison = buildAxisComparisonSummary(regComparisonRows);

	return {
		regressionComparison: regComparisonRows,
		inverseModelComparison: invComparisonRows,
		axisComparison
	};
}

function buildAxisComparisonSummary(
	rows: RegressionComparison[]
): AxisComparisonSummary[] {
	const axes = [...new Set(rows.map((row) => row.axis))];
	const summaries: AxisComparisonSummary[] = [];

	for (const axis of axes) {
		const axisRows = rows
			.filter((row) => row.axis === axis)
			.filter(
				(row) =>
					Number.isFinite(row.current_slope) &&
					Number.isFinite(row.ref_slope) &&
					Number.isFinite(row.current_nd50) &&
					Number.isFinite(row.ref_nd50)
			)
			.sort((a, b) => a.size_deg - b.size_deg);

		if (axisRows.length < 2) continue;

		const currentSlopes = axisRows.map((row) => row.current_slope);
		const refSlopes = axisRows.map((row) => row.ref_slope);
		const currentNd50 = axisRows.map((row) => row.current_nd50);
		const refNd50 = axisRows.map((row) => row.ref_nd50);

		const slopeStats = computePairedStats(currentSlopes, refSlopes);
		const nd50Stats = computePairedStats(currentNd50, refNd50);

		summaries.push({
			axis,
			n_sizes: axisRows.length,
			slope: slopeStats,
			nd50: nd50Stats,
			better: classifyWinner(slopeStats.current_mean, slopeStats.ref_mean)
		});
	}

	return summaries;
}


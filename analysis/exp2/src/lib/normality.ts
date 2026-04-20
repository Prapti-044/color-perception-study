import pkg from 'jstat';

const { jStat } = pkg as { jStat: { normal: { inv(p: number, mean: number, sd: number): number; cdf(x: number, mean: number, sd: number): number } } };

export interface ShapiroWilkResult {
	n: number;
	mean: number;
	sd: number;
	W: number | null;
	pValue: number | null;
	/** null when not enough samples, otherwise "reject" | "fail-to-reject" at α = 0.05. */
	verdict: 'reject' | 'fail-to-reject' | null;
}

export interface QQPoint {
	theoretical: number;
	sample: number;
}

/**
 * Expected values of standard-normal order statistics using the Blom
 * plotting positions `(i - 3/8) / (n + 1/4)`.
 */
function blomNormalQuantiles(n: number): number[] {
	const quantiles = new Array<number>(n);
	for (let i = 0; i < n; i += 1) {
		const probability = (i + 1 - 3 / 8) / (n + 1 / 4);
		quantiles[i] = jStat.normal.inv(probability, 0, 1);
	}
	return quantiles;
}

/**
 * Shapiro–Wilk weights `a_i` following Royston (1992) AS R94. Valid for n >= 3.
 * The weights are returned in ascending order so `a[0]` multiplies the
 * smallest sorted value.
 */
function shapiroWilkWeights(n: number): number[] {
	if (n < 3) {
		throw new Error('Shapiro–Wilk requires n >= 3');
	}

	if (n === 3) {
		const inverseSqrt2 = 1 / Math.sqrt(2);
		return [-inverseSqrt2, 0, inverseSqrt2];
	}

	const m = blomNormalQuantiles(n);
	const mSquaredSum = m.reduce((total, value) => total + value * value, 0);
	const mNorm = Math.sqrt(mSquaredSum);
	const u = 1 / Math.sqrt(n);

	const cN = m[n - 1] / mNorm;
	const aN =
		cN +
		0.221157 * u -
		0.147981 * u ** 2 -
		2.07119 * u ** 3 +
		4.434685 * u ** 4 -
		2.706056 * u ** 5;

	const a = new Array<number>(n).fill(0);
	a[n - 1] = aN;
	a[0] = -aN;

	if (n >= 6) {
		const cNMinus1 = m[n - 2] / mNorm;
		const aNMinus1 =
			cNMinus1 +
			0.042981 * u -
			0.293762 * u ** 2 -
			1.75246 * u ** 3 +
			5.682633 * u ** 4 -
			3.582633 * u ** 5;
		a[n - 2] = aNMinus1;
		a[1] = -aNMinus1;

		const epsilon =
			(mSquaredSum - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) /
			(1 - 2 * aN ** 2 - 2 * aNMinus1 ** 2);
		const sqrtEpsilon = Math.sqrt(epsilon);
		for (let i = 2; i <= n - 3; i += 1) {
			a[i] = m[i] / sqrtEpsilon;
		}
	} else {
		const epsilon = (mSquaredSum - 2 * m[n - 1] ** 2) / (1 - 2 * aN ** 2);
		const sqrtEpsilon = Math.sqrt(epsilon);
		for (let i = 1; i <= n - 2; i += 1) {
			a[i] = m[i] / sqrtEpsilon;
		}
	}

	return a;
}

function meanValue(values: number[]): number {
	if (!values.length) {
		return 0;
	}
	let total = 0;
	for (const value of values) {
		total += value;
	}
	return total / values.length;
}

function sampleStandardDeviation(values: number[], mean: number): number {
	if (values.length < 2) {
		return 0;
	}
	let squaredSum = 0;
	for (const value of values) {
		squaredSum += (value - mean) ** 2;
	}
	return Math.sqrt(squaredSum / (values.length - 1));
}

function shapiroWilkPValue(W: number, n: number): number {
	if (n === 3) {
		const p =
			(6 / Math.PI) *
			(Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(3 / 4)));
		return Math.max(0, Math.min(1, p));
	}

	let z: number;
	if (n <= 11) {
		const gamma = -2.273 + 0.459 * n;
		const mu =
			0.544 - 0.39978 * n + 0.025054 * n ** 2 - 0.0006714 * n ** 3;
		const sigma = Math.exp(
			1.3822 - 0.77857 * n + 0.062767 * n ** 2 - 0.0020322 * n ** 3
		);
		const logArg = gamma - Math.log(1 - W);
		if (logArg <= 0) {
			return 1;
		}
		const g = -Math.log(logArg);
		z = (g - mu) / sigma;
	} else {
		const lnN = Math.log(n);
		const mu =
			0.0038915 * lnN ** 3 -
			0.083751 * lnN ** 2 -
			0.31082 * lnN -
			1.5861;
		const sigma = Math.exp(
			0.0030302 * lnN ** 2 - 0.082676 * lnN - 0.4803
		);
		if (1 - W <= 0) {
			return 1;
		}
		const g = Math.log(1 - W);
		z = (g - mu) / sigma;
	}

	const pValue = 1 - jStat.normal.cdf(z, 0, 1);
	return Math.max(0, Math.min(1, pValue));
}

/**
 * Shapiro–Wilk test for normality via Royston's AS R94 approximation.
 *
 * Returns `W`, the one-sided p-value against the normal null, and the
 * α = 0.05 verdict. When n < 3 the test is undefined and `W`, `pValue`,
 * and `verdict` are all `null` (but descriptive stats still populated).
 */
export function shapiroWilk(values: readonly number[]): ShapiroWilkResult {
	const n = values.length;
	const mean = meanValue(values as number[]);
	const sd = sampleStandardDeviation(values as number[], mean);

	if (n < 3) {
		return { n, mean, sd, W: null, pValue: null, verdict: null };
	}

	const sorted = [...values].sort((left, right) => left - right);
	let sumSquares = 0;
	for (const value of sorted) {
		sumSquares += (value - mean) ** 2;
	}

	if (sumSquares === 0) {
		return { n, mean, sd, W: 1, pValue: 1, verdict: 'fail-to-reject' };
	}

	const weights = shapiroWilkWeights(n);
	let weighted = 0;
	for (let i = 0; i < n; i += 1) {
		weighted += weights[i] * sorted[i];
	}

	const W = Math.min(1, (weighted * weighted) / sumSquares);
	const pValue = shapiroWilkPValue(W, n);
	const verdict: 'reject' | 'fail-to-reject' =
		pValue < 0.05 ? 'reject' : 'fail-to-reject';

	return { n, mean, sd, W, pValue, verdict };
}

/**
 * Q–Q plot coordinates for a sample against the standard normal distribution.
 * The x-axis is the theoretical normal quantile (Blom positions); the y-axis
 * is the standardized sample value `(x - mean) / sd` so the reference line is
 * always `y = x`. Returns an empty array when sd is zero or n < 2.
 */
export function qqPlotPoints(values: readonly number[]): QQPoint[] {
	const n = values.length;
	if (n < 2) {
		return [];
	}

	const mean = meanValue(values as number[]);
	const sd = sampleStandardDeviation(values as number[], mean);
	if (sd === 0) {
		return [];
	}

	const sorted = [...values].sort((left, right) => left - right);
	const theoretical = blomNormalQuantiles(n);

	return sorted.map((value, index) => ({
		theoretical: theoretical[index],
		sample: (value - mean) / sd
	}));
}

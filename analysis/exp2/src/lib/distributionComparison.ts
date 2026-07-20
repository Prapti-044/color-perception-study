import pkg from 'jstat';

const { jStat } = pkg as {
	jStat: {
		studentt: { cdf(value: number, degreesOfFreedom: number): number };
		normal: { cdf(value: number, mean: number, sd: number): number };
	};
};

/**
 * The original study is published only as a five-number summary plus mean/SD,
 * so exact two-sample tests that need both raw samples (Mann–Whitney, KS)
 * cannot be computed directly. We therefore combine (a) summary-statistics
 * tests that are exact given the reported moments (Welch t, TOST) with
 * (b) log-scale / log-normal model-based comparisons that are the appropriate
 * lens for a heavily right-skewed positive metric, and (c) a Monte-Carlo
 * KS / Mann–Whitney sensitivity check that resamples the original from a
 * log-normal matched to its published quartiles.
 */
export type OriginalStudyDistribution = {
	label: string;
	max: number;
	mean: number;
	median: number;
	min: number;
	n: number;
	q1: number;
	q3: number;
	sd: number;
};

export const ORIGINAL_STUDY_VOLUME_DISTRIBUTION: OriginalStudyDistribution = Object.freeze({
	label: 'Original study',
	max: 1_058_397.76,
	mean: 3670.43,
	median: 1558.38,
	min: 21.68,
	n: 29_044,
	q1: 804.62,
	q3: 3223.6,
	sd: 13_728.03
});

/** z-score for the 75th percentile of the standard normal (IQR → sigma). */
const NORMAL_IQR_Z = 0.6744897501960817;

/** Fixed seed so the Monte-Carlo sensitivity check is reproducible. */
const MONTE_CARLO_SEED = 20240709;

export type SampleDescriptives = {
	cv: number;
	geoMean: number;
	label: string;
	logMean: number;
	logSd: number;
	max: number;
	mean: number;
	median: number;
	min: number;
	n: number;
	q1: number;
	q3: number;
	sd: number;
	skewness: number;
};

export type WelchTestResult = {
	cohenD: number;
	degreesOfFreedom: number;
	glassDelta: number;
	meanDifference: number;
	pValue: number;
	tStatistic: number;
};

export type TostResult = {
	equivalent: boolean;
	margin: number;
	maxPValue: number;
};

export type LogScaleComparison = {
	cohenDLog: number;
	geoMeanRatioMoM: number;
	geoMeanRatioQuantile: number;
	medianRatio: number;
	originalMuMoM: number;
	originalMuQuantile: number;
	originalSigmaMoM: number;
	originalSigmaQuantile: number;
	probabilitySuperiority: number;
	welchLog: { degreesOfFreedom: number; pValue: number; tStatistic: number };
};

export type MonteCarloComparison = {
	ks: { dStatistic: number; pValue: number };
	mannWhitney: { pValue: number; probabilitySuperiority: number; zScore: number };
	seed: number;
};

export type DistributionComparison = {
	current: SampleDescriptives;
	logScale: LogScaleComparison;
	monteCarlo: MonteCarloComparison;
	original: OriginalStudyDistribution & { cv: number };
	tost: TostResult;
	welchRaw: WelchTestResult;
};

export type EffectMagnitude = 'negligible' | 'small' | 'medium' | 'large';

/**
 * Qualitative label for a Cohen's d using Cohen's (1988) conventional
 * benchmarks: |d| < 0.2 negligible, < 0.5 small, < 0.8 medium, else large.
 */
export function interpretCohensD(d: number): EffectMagnitude {
	const magnitude = Math.abs(d);

	if (!Number.isFinite(magnitude) || magnitude < 0.2) {
		return 'negligible';
	}
	if (magnitude < 0.5) {
		return 'small';
	}
	if (magnitude < 0.8) {
		return 'medium';
	}
	return 'large';
}

function mean(values: number[]): number {
	if (!values.length) {
		return 0;
	}

	return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], average = mean(values)): number {
	if (values.length < 2) {
		return 0;
	}

	const squaredDifferences = values.reduce(
		(total, value) => total + (value - average) ** 2,
		0
	);
	return Math.sqrt(squaredDifferences / (values.length - 1));
}

function quantileSorted(sortedValues: number[], probability: number): number {
	if (!sortedValues.length) {
		return 0;
	}

	const index = (sortedValues.length - 1) * probability;
	const lowerIndex = Math.floor(index);
	const upperIndex = Math.ceil(index);

	if (lowerIndex === upperIndex) {
		return sortedValues[lowerIndex];
	}

	const interpolation = index - lowerIndex;
	return (
		sortedValues[lowerIndex] * (1 - interpolation) + sortedValues[upperIndex] * interpolation
	);
}

function skewness(values: number[], average: number, standardDeviation: number): number {
	const n = values.length;
	if (n < 3 || standardDeviation === 0) {
		return Number.NaN;
	}

	const cubedSum = values.reduce(
		(total, value) => total + ((value - average) / standardDeviation) ** 3,
		0
	);
	return (n / ((n - 1) * (n - 2))) * cubedSum;
}

function describeSample(values: number[], label: string): SampleDescriptives {
	const sorted = [...values].sort((left, right) => left - right);
	const average = mean(values);
	const standardDeviation = sampleStandardDeviation(values, average);
	const logs = values.map((value) => Math.log(value));
	const logMean = mean(logs);
	const logSd = sampleStandardDeviation(logs, logMean);

	return {
		cv: average === 0 ? 0 : standardDeviation / average,
		geoMean: Math.exp(logMean),
		label,
		logMean,
		logSd,
		max: sorted[sorted.length - 1] ?? 0,
		mean: average,
		median: quantileSorted(sorted, 0.5),
		min: sorted[0] ?? 0,
		n: values.length,
		q1: quantileSorted(sorted, 0.25),
		q3: quantileSorted(sorted, 0.75),
		sd: standardDeviation,
		skewness: skewness(values, average, standardDeviation)
	};
}

function welchFromSummaries(
	mean1: number,
	sd1: number,
	n1: number,
	mean2: number,
	sd2: number,
	n2: number
): { degreesOfFreedom: number; meanDifference: number; pValue: number; tStatistic: number } {
	const varianceTerm1 = (sd1 * sd1) / n1;
	const varianceTerm2 = (sd2 * sd2) / n2;
	const standardError = Math.sqrt(varianceTerm1 + varianceTerm2);
	const meanDifference = mean1 - mean2;
	const tStatistic = standardError === 0 ? 0 : meanDifference / standardError;
	const degreesOfFreedom =
		(varianceTerm1 + varianceTerm2) ** 2 /
		(varianceTerm1 ** 2 / (n1 - 1) + varianceTerm2 ** 2 / (n2 - 1));
	const pValue = Math.max(
		0,
		Math.min(1, 2 * (1 - jStat.studentt.cdf(Math.abs(tStatistic), degreesOfFreedom)))
	);

	return { degreesOfFreedom, meanDifference, pValue, tStatistic };
}

function buildWelchRaw(
	current: SampleDescriptives,
	original: OriginalStudyDistribution
): WelchTestResult {
	const welch = welchFromSummaries(
		current.mean,
		current.sd,
		current.n,
		original.mean,
		original.sd,
		original.n
	);
	const pooledSd = Math.sqrt(
		((current.n - 1) * current.sd ** 2 + (original.n - 1) * original.sd ** 2) /
			(current.n + original.n - 2)
	);

	return {
		cohenD: pooledSd === 0 ? 0 : welch.meanDifference / pooledSd,
		degreesOfFreedom: welch.degreesOfFreedom,
		glassDelta: original.sd === 0 ? 0 : welch.meanDifference / original.sd,
		meanDifference: welch.meanDifference,
		pValue: welch.pValue,
		tStatistic: welch.tStatistic
	};
}

function buildTost(
	current: SampleDescriptives,
	original: OriginalStudyDistribution,
	margin: number,
	alpha = 0.05
): TostResult {
	const varianceTerm1 = (current.sd * current.sd) / current.n;
	const varianceTerm2 = (original.sd * original.sd) / original.n;
	const standardError = Math.sqrt(varianceTerm1 + varianceTerm2);
	const meanDifference = current.mean - original.mean;
	const degreesOfFreedom =
		(varianceTerm1 + varianceTerm2) ** 2 /
		(varianceTerm1 ** 2 / (current.n - 1) + varianceTerm2 ** 2 / (original.n - 1));
	const lowerT = (meanDifference + margin) / standardError;
	const upperT = (meanDifference - margin) / standardError;
	const lowerPValue = Math.max(0, Math.min(1, 1 - jStat.studentt.cdf(lowerT, degreesOfFreedom)));
	const upperPValue = Math.max(0, Math.min(1, jStat.studentt.cdf(upperT, degreesOfFreedom)));
	const maxPValue = Math.max(lowerPValue, upperPValue);

	return { equivalent: maxPValue < alpha, margin, maxPValue };
}

function buildLogScale(
	current: SampleDescriptives,
	original: OriginalStudyDistribution
): LogScaleComparison {
	const cv2 = (original.sd / original.mean) ** 2;
	const originalSigmaMoM = Math.sqrt(Math.log(1 + cv2));
	const originalMuMoM = Math.log(original.mean) - 0.5 * originalSigmaMoM ** 2;
	const originalMuQuantile = Math.log(original.median);
	const originalSigmaQuantile = Math.log(original.q3 / original.q1) / (2 * NORMAL_IQR_Z);

	const welch = welchFromSummaries(
		current.logMean,
		current.logSd,
		current.n,
		originalMuQuantile,
		originalSigmaQuantile,
		original.n
	);
	const pooledLogSd = Math.sqrt((current.logSd ** 2 + originalSigmaQuantile ** 2) / 2);
	const spread = Math.sqrt(current.logSd ** 2 + originalSigmaQuantile ** 2);

	return {
		cohenDLog: pooledLogSd === 0 ? 0 : (current.logMean - originalMuQuantile) / pooledLogSd,
		geoMeanRatioMoM: current.geoMean / Math.exp(originalMuMoM),
		geoMeanRatioQuantile: current.geoMean / Math.exp(originalMuQuantile),
		medianRatio: current.median / original.median,
		originalMuMoM,
		originalMuQuantile,
		originalSigmaMoM,
		originalSigmaQuantile,
		probabilitySuperiority:
			spread === 0
				? 0.5
				: jStat.normal.cdf((current.logMean - originalMuQuantile) / spread, 0, 1),
		welchLog: {
			degreesOfFreedom: welch.degreesOfFreedom,
			pValue: welch.pValue,
			tStatistic: welch.tStatistic
		}
	};
}

function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return function next() {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sampleLogNormal(n: number, mu: number, sigma: number, rng: () => number): number[] {
	const values = new Array<number>(n);
	for (let i = 0; i < n; i += 1) {
		const u1 = Math.max(rng(), 1e-12);
		const u2 = rng();
		const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		values[i] = Math.exp(mu + sigma * z);
	}
	return values;
}

function kolmogorovQ(t: number): number {
	if (t <= 0) {
		return 1;
	}

	let sum = 0;
	for (let k = 1; k <= 100; k += 1) {
		sum += (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * t * t);
	}
	return Math.max(0, Math.min(1, 2 * sum));
}

function ksTwoSample(a: number[], b: number[]): { dStatistic: number; pValue: number } {
	const s1 = [...a].sort((left, right) => left - right);
	const s2 = [...b].sort((left, right) => left - right);
	const n1 = s1.length;
	const n2 = s2.length;
	let i = 0;
	let j = 0;
	let dStatistic = 0;

	while (i < n1 && j < n2) {
		const x = s1[i];
		const y = s2[j];
		if (x <= y) {
			i += 1;
		}
		if (y <= x) {
			j += 1;
		}
		dStatistic = Math.max(dStatistic, Math.abs(i / n1 - j / n2));
	}

	const effectiveN = (n1 * n2) / (n1 + n2);
	const t = (Math.sqrt(effectiveN) + 0.12 + 0.11 / Math.sqrt(effectiveN)) * dStatistic;
	return { dStatistic, pValue: kolmogorovQ(t) };
}

function mannWhitney(
	a: number[],
	b: number[]
): { pValue: number; probabilitySuperiority: number; zScore: number } {
	const n1 = a.length;
	const n2 = b.length;
	const combined = [
		...a.map((value) => ({ group: 0, value })),
		...b.map((value) => ({ group: 1, value }))
	].sort((left, right) => left.value - right.value);
	const total = combined.length;
	let index = 0;
	let rankSum1 = 0;
	let tieTerm = 0;

	while (index < total) {
		let end = index;
		while (end + 1 < total && combined[end + 1].value === combined[index].value) {
			end += 1;
		}
		const count = end - index + 1;
		const averageRank = (index + 1 + (end + 1)) / 2;
		for (let k = index; k <= end; k += 1) {
			if (combined[k].group === 0) {
				rankSum1 += averageRank;
			}
		}
		tieTerm += count ** 3 - count;
		index = end + 1;
	}

	const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
	const u2 = n1 * n2 - u1;
	const u = Math.min(u1, u2);
	const meanU = (n1 * n2) / 2;
	const sdU = Math.sqrt(
		((n1 * n2) / 12) * (total + 1 - tieTerm / (total * (total - 1)))
	);
	const zScore = sdU === 0 ? 0 : (u - meanU) / sdU;
	const pValue = Math.max(0, Math.min(1, 2 * (1 - jStat.normal.cdf(Math.abs(zScore), 0, 1))));

	return { pValue, probabilitySuperiority: u1 / (n1 * n2), zScore };
}

function buildMonteCarlo(
	current: SampleDescriptives,
	logScale: LogScaleComparison,
	original: OriginalStudyDistribution,
	sortedCurrentVolumes: number[]
): MonteCarloComparison {
	const rng = mulberry32(MONTE_CARLO_SEED);
	const simulatedOriginal = sampleLogNormal(
		original.n,
		logScale.originalMuQuantile,
		logScale.originalSigmaQuantile,
		rng
	);
	const ks = ksTwoSample(sortedCurrentVolumes, simulatedOriginal);
	const mwu = mannWhitney(sortedCurrentVolumes, simulatedOriginal);

	return {
		ks,
		mannWhitney: mwu,
		seed: MONTE_CARLO_SEED
	};
}

export function buildDistributionComparison(
	participantVolumes: number[],
	currentLabel = 'This study',
	original: OriginalStudyDistribution = ORIGINAL_STUDY_VOLUME_DISTRIBUTION,
	equivalenceMargin = 0.2 * ORIGINAL_STUDY_VOLUME_DISTRIBUTION.sd
): DistributionComparison {
	const positiveVolumes = participantVolumes.filter(
		(value) => Number.isFinite(value) && value > 0
	);

	if (positiveVolumes.length < 3) {
		throw new Error('Distribution comparison needs at least 3 positive volumes');
	}

	const current = describeSample(positiveVolumes, currentLabel);
	const logScale = buildLogScale(current, original);
	const sortedCurrent = [...positiveVolumes].sort((left, right) => left - right);

	return {
		current,
		logScale,
		monteCarlo: buildMonteCarlo(current, logScale, original, sortedCurrent),
		original: { ...original, cv: original.sd / original.mean },
		tost: buildTost(current, original, equivalenceMargin),
		welchRaw: buildWelchRaw(current, original)
	};
}

import pkg from 'jstat';

const { jStat } = pkg as {
	jStat: {
		studentt: {
			cdf(value: number, degreesOfFreedom: number): number;
			inv(probability: number, degreesOfFreedom: number): number;
		};
	};
};

export type StudySummary = {
	label: string;
	mean: number;
	n: number;
	sd: number;
};

export type ConfidenceInterval = {
	confidence: number;
	lower: number;
	upper: number;
};

export type TostResult = {
	equivalent: boolean;
	lowerPValue: number;
	lowerTStatistic: number;
	maxPValue: number;
	upperPValue: number;
	upperTStatistic: number;
};

export type VolumeEquivalenceComparison = {
	alpha: number;
	current: StudySummary;
	currentMeanCi95: ConfidenceInterval;
	degreesOfFreedom: number;
	equivalenceMargin: number;
	meanDifference: number;
	meanDifferenceCi90: ConfidenceInterval;
	meanDifferenceCi95: ConfidenceInterval;
	pValueTwoSided: number;
	reference: StudySummary;
	referenceMeanCi95: ConfidenceInterval;
	requiredMarginForEquivalence: number;
	standardError: number;
	tStatistic: number;
	tost: TostResult;
};

export const ORIGINAL_STUDY_VOLUME_SUMMARY: StudySummary = Object.freeze({
	label: 'Original study',
	mean: 3670.43,
	n: 29044,
	sd: 13728.03
});

export const DEFAULT_VOLUME_EQUIVALENCE_MARGIN =
	0.2 * ORIGINAL_STUDY_VOLUME_SUMMARY.sd;

function clampProbability(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function assertEstimableStudy(study: StudySummary): void {
	if (study.n < 2 || !Number.isFinite(study.mean) || !Number.isFinite(study.sd)) {
		throw new Error(`Study "${study.label}" needs n >= 2, a finite mean, and a finite SD`);
	}
}

function confidenceIntervalFromEstimate(
	estimate: number,
	standardError: number,
	degreesOfFreedom: number,
	confidence: number
): ConfidenceInterval {
	const alpha = 1 - confidence;
	const criticalValue = jStat.studentt.inv(1 - alpha / 2, degreesOfFreedom);
	const halfWidth = criticalValue * standardError;

	return {
		confidence,
		lower: estimate - halfWidth,
		upper: estimate + halfWidth
	};
}

export function meanConfidenceInterval(
	study: StudySummary,
	confidence = 0.95
): ConfidenceInterval {
	assertEstimableStudy(study);

	return confidenceIntervalFromEstimate(
		study.mean,
		study.sd / Math.sqrt(study.n),
		study.n - 1,
		confidence
	);
}

export function buildVolumeEquivalenceComparison(
	current: StudySummary,
	reference: StudySummary = ORIGINAL_STUDY_VOLUME_SUMMARY,
	equivalenceMargin = DEFAULT_VOLUME_EQUIVALENCE_MARGIN,
	alpha = 0.05
): VolumeEquivalenceComparison {
	assertEstimableStudy(current);
	assertEstimableStudy(reference);

	if (equivalenceMargin <= 0 || !Number.isFinite(equivalenceMargin)) {
		throw new Error('Equivalence margin must be a positive finite value');
	}

	const currentVarianceTerm = current.sd ** 2 / current.n;
	const referenceVarianceTerm = reference.sd ** 2 / reference.n;
	const standardError = Math.sqrt(currentVarianceTerm + referenceVarianceTerm);
	const meanDifference = current.mean - reference.mean;
	const tStatistic = meanDifference / standardError;
	const degreesOfFreedom =
		(currentVarianceTerm + referenceVarianceTerm) ** 2 /
		(currentVarianceTerm ** 2 / (current.n - 1) +
			referenceVarianceTerm ** 2 / (reference.n - 1));
	const pValueTwoSided = clampProbability(
		2 * (1 - jStat.studentt.cdf(Math.abs(tStatistic), degreesOfFreedom))
	);
	const meanDifferenceCi90 = confidenceIntervalFromEstimate(
		meanDifference,
		standardError,
		degreesOfFreedom,
		0.9
	);
	const meanDifferenceCi95 = confidenceIntervalFromEstimate(
		meanDifference,
		standardError,
		degreesOfFreedom,
		0.95
	);
	const lowerTStatistic = (meanDifference + equivalenceMargin) / standardError;
	const upperTStatistic = (meanDifference - equivalenceMargin) / standardError;
	const lowerPValue = clampProbability(
		1 - jStat.studentt.cdf(lowerTStatistic, degreesOfFreedom)
	);
	const upperPValue = clampProbability(jStat.studentt.cdf(upperTStatistic, degreesOfFreedom));
	const maxPValue = Math.max(lowerPValue, upperPValue);

	return {
		alpha,
		current,
		currentMeanCi95: meanConfidenceInterval(current, 0.95),
		degreesOfFreedom,
		equivalenceMargin,
		meanDifference,
		meanDifferenceCi90,
		meanDifferenceCi95,
		pValueTwoSided,
		reference,
		referenceMeanCi95: meanConfidenceInterval(reference, 0.95),
		requiredMarginForEquivalence: Math.max(
			Math.abs(meanDifferenceCi90.lower),
			Math.abs(meanDifferenceCi90.upper)
		),
		standardError,
		tStatistic,
		tost: {
			equivalent: lowerPValue < alpha && upperPValue < alpha,
			lowerPValue,
			lowerTStatistic,
			maxPValue,
			upperPValue,
			upperTStatistic
		}
	};
}

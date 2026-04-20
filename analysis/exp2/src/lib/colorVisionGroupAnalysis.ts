import { HISTOGRAM_BIN_WIDTH, HISTOGRAM_MAX_VOLUME } from './colorVisionMath.js';
import type { ExpertClauseNode, ExpertDemographics } from './expertClause.ts';
import { getParticipantsByExpertClause } from './expertClause.ts';
import { qqPlotPoints, shapiroWilk } from './normality.ts';
import type { QQPoint, ShapiroWilkResult } from './normality.ts';

const HISTOGRAM_BIN_COUNT = Math.ceil(HISTOGRAM_MAX_VOLUME / HISTOGRAM_BIN_WIDTH);

export type ParticipantMetric = {
	accuracy: number;
	ellipsoidVolume: number;
	ellipsoidProxyVolume: number;
	fitKind: 'exact' | 'fitted';
	fitLoss: number;
	maxRelativeRadiusError: number;
	meanNormalizedThreshold: number;
	meanRawThreshold: number;
	participantId: string;
	totalCorrect: number;
	totalTrials: number;
};

export type ParticipantAnalysisRecord = {
	demographics: ExpertDemographics;
	metric: ParticipantMetric;
	participantId: string;
};

type SummaryStat = {
	mean: number;
	sd: number;
};

type WelchResult = {
	degreesOfFreedom: number | null;
	tStatistic: number | null;
};

export type GroupAnalysis = {
	aggregateAccuracy: number;
	id: 'expert' | 'nonExpert';
	label: string;
	metrics: {
		ellipsoidVolume: SummaryStat;
		meanNormalizedThreshold: SummaryStat;
		meanRawThreshold: SummaryStat;
		trialAccuracy: SummaryStat;
	};
	participantCount: number;
	totalCorrect: number;
	totalGuesses: number;
};

export type ComparisonMetric = {
	betterDirection: 'higher' | 'lower';
	description: string;
	delta: number;
	expert: SummaryStat;
	id: 'trialAccuracy' | 'meanRawThreshold' | 'meanNormalizedThreshold';
	label: string;
	nonExpert: SummaryStat;
	welch: WelchResult;
};

export type NormalityVariableId =
	| 'trialAccuracy'
	| 'meanRawThreshold'
	| 'meanNormalizedThreshold'
	| 'ellipsoidVolume';

export type NormalityGroupResult = ShapiroWilkResult & {
	qq: QQPoint[];
};

export type NormalityVariableAnalysis = {
	description: string;
	expert: NormalityGroupResult;
	id: NormalityVariableId;
	label: string;
	nonExpert: NormalityGroupResult;
	pooled: NormalityGroupResult;
};

export type HistogramBin = {
	end: number;
	expertCount: number;
	label: string;
	nonExpertCount: number;
	start: number;
	totalCount: number;
};

type HistogramSummary = {
	firstQuartile: number;
	maximum: number;
	median: number;
	minimum: number;
	thirdQuartile: number;
};

export type ColorVisionAnalysis = {
	comparisons: ComparisonMetric[];
	groups: GroupAnalysis[];
	overallEllipsoidVolume: SummaryStat;
	histogram: {
		binWidth: number;
		bins: HistogramBin[];
		maxVisibleVolume: number;
		omittedCount: number;
		participantVolumes: number[];
		summary: HistogramSummary;
		visibleParticipantCount: number;
	};
	normality: {
		alpha: number;
		variables: NormalityVariableAnalysis[];
	};
};

function mean(values: number[]): number {
	if (!values.length) {
		return 0;
	}

	return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleVariance(values: number[]): number {
	if (values.length < 2) {
		return 0;
	}

	const average = mean(values);
	const squaredDifferences = values.reduce((total, value) => total + (value - average) ** 2, 0);

	return squaredDifferences / (values.length - 1);
}

function sampleStandardDeviation(values: number[]): number {
	return Math.sqrt(sampleVariance(values));
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
		sortedValues[lowerIndex] * (1 - interpolation) +
		sortedValues[upperIndex] * interpolation
	);
}

function summarise(values: number[]): SummaryStat {
	return {
		mean: mean(values),
		sd: sampleStandardDeviation(values)
	};
}

function buildHistogramSummary(sortedValues: number[]): HistogramSummary {
	if (!sortedValues.length) {
		return {
			firstQuartile: 0,
			maximum: 0,
			median: 0,
			minimum: 0,
			thirdQuartile: 0
		};
	}

	return {
		firstQuartile: quantileSorted(sortedValues, 0.25),
		maximum: sortedValues[sortedValues.length - 1],
		median: quantileSorted(sortedValues, 0.5),
		minimum: sortedValues[0],
		thirdQuartile: quantileSorted(sortedValues, 0.75)
	};
}

function welchTStatistic(
	expertValues: number[],
	nonExpertValues: number[]
): WelchResult {
	const expertCount = expertValues.length;
	const nonExpertCount = nonExpertValues.length;

	if (expertCount < 2 || nonExpertCount < 2) {
		return {
			degreesOfFreedom: null,
			tStatistic: null
		};
	}

	const expertMean = mean(expertValues);
	const nonExpertMean = mean(nonExpertValues);
	const expertVariance = sampleVariance(expertValues);
	const nonExpertVariance = sampleVariance(nonExpertValues);

	if (expertVariance === 0 && nonExpertVariance === 0) {
		return {
			degreesOfFreedom: expertCount + nonExpertCount - 2,
			tStatistic: 0
		};
	}

	const standardError = Math.sqrt(
		expertVariance / expertCount + nonExpertVariance / nonExpertCount
	);
	const tStatistic = standardError ? (expertMean - nonExpertMean) / standardError : 0;
	const numerator =
		(expertVariance / expertCount + nonExpertVariance / nonExpertCount) ** 2;
	const denominator =
		(expertVariance / expertCount) ** 2 / (expertCount - 1) +
		(nonExpertVariance / nonExpertCount) ** 2 / (nonExpertCount - 1);

	return {
		degreesOfFreedom:
			denominator ? numerator / denominator : expertCount + nonExpertCount - 2,
		tStatistic
	};
}

function buildGroupAnalysis(
	id: 'expert' | 'nonExpert',
	label: string,
	records: ParticipantAnalysisRecord[]
): GroupAnalysis {
	const metrics = records.map((record) => record.metric);
	const totalCorrect = metrics.reduce((total, metric) => total + metric.totalCorrect, 0);
	const totalGuesses = metrics.reduce((total, metric) => total + metric.totalTrials, 0);

	return {
		aggregateAccuracy: totalGuesses ? totalCorrect / totalGuesses : 0,
		id,
		label,
		metrics: {
			ellipsoidVolume: summarise(metrics.map((metric) => metric.ellipsoidVolume)),
			meanNormalizedThreshold: summarise(
				metrics.map((metric) => metric.meanNormalizedThreshold)
			),
			meanRawThreshold: summarise(metrics.map((metric) => metric.meanRawThreshold)),
			trialAccuracy: summarise(metrics.map((metric) => metric.accuracy))
		},
		participantCount: metrics.length,
		totalCorrect,
		totalGuesses
	};
}

function buildHistogram(
	expertMetrics: ParticipantMetric[],
	nonExpertMetrics: ParticipantMetric[]
) {
	const formatEdge = (value: number) => value.toLocaleString('en-US');
	const participantVolumes = [...expertMetrics, ...nonExpertMetrics]
		.map((metric) => metric.ellipsoidVolume)
		.sort((left, right) => left - right);

	const bins: HistogramBin[] = Array.from({ length: HISTOGRAM_BIN_COUNT }, (_, index) => {
		const start = index * HISTOGRAM_BIN_WIDTH;
		const end = start + HISTOGRAM_BIN_WIDTH;

		return {
			end,
			expertCount: 0,
			label: `${formatEdge(start)}–${formatEdge(end)}`,
			nonExpertCount: 0,
			start,
			totalCount: 0
		};
	});

	const visibleExpert = expertMetrics.filter(
		(metric) => metric.ellipsoidVolume <= HISTOGRAM_MAX_VOLUME
	);
	const visibleNonExpert = nonExpertMetrics.filter(
		(metric) => metric.ellipsoidVolume <= HISTOGRAM_MAX_VOLUME
	);

	for (const metric of visibleExpert) {
		const index = Math.min(
			HISTOGRAM_BIN_COUNT - 1,
			Math.floor(metric.ellipsoidVolume / HISTOGRAM_BIN_WIDTH)
		);

		bins[index].expertCount += 1;
		bins[index].totalCount += 1;
	}

	for (const metric of visibleNonExpert) {
		const index = Math.min(
			HISTOGRAM_BIN_COUNT - 1,
			Math.floor(metric.ellipsoidVolume / HISTOGRAM_BIN_WIDTH)
		);

		bins[index].nonExpertCount += 1;
		bins[index].totalCount += 1;
	}

	return {
		binWidth: HISTOGRAM_BIN_WIDTH,
		bins,
		maxVisibleVolume: HISTOGRAM_MAX_VOLUME,
		omittedCount:
			expertMetrics.length +
			nonExpertMetrics.length -
			visibleExpert.length -
			visibleNonExpert.length,
		participantVolumes,
		summary: buildHistogramSummary(participantVolumes),
		visibleParticipantCount: visibleExpert.length + visibleNonExpert.length
	};
}

function buildNormalityGroupResult(values: number[]): NormalityGroupResult {
	const shapiro = shapiroWilk(values);
	const qq = qqPlotPoints(values);
	return { ...shapiro, qq };
}

const NORMALITY_VARIABLE_DEFINITIONS: Array<{
	description: string;
	id: NormalityVariableId;
	label: string;
	selector: (metric: ParticipantMetric) => number;
}> = [
	{
		description: 'Proportion of correct staircase guesses per participant.',
		id: 'trialAccuracy',
		label: 'Trial accuracy',
		selector: (metric) => metric.accuracy
	},
	{
		description: 'Average threshold (in staircase steps) across completed direction sets.',
		id: 'meanRawThreshold',
		label: 'Mean raw threshold',
		selector: (metric) => metric.meanRawThreshold
	},
	{
		description: 'Raw threshold divided by per-vector max step count, then averaged.',
		id: 'meanNormalizedThreshold',
		label: 'Mean normalized threshold',
		selector: (metric) => metric.meanNormalizedThreshold
	},
	{
		description: 'Reconstructed discrimination-ellipsoid volume (L*u*v* units cubed).',
		id: 'ellipsoidVolume',
		label: 'Ellipsoid volume',
		selector: (metric) => metric.ellipsoidVolume
	}
];

function buildNormalityAnalysis(
	expertMetrics: ParticipantMetric[],
	nonExpertMetrics: ParticipantMetric[]
) {
	const pooledMetrics = [...expertMetrics, ...nonExpertMetrics];
	const variables = NORMALITY_VARIABLE_DEFINITIONS.map((definition) => ({
		description: definition.description,
		expert: buildNormalityGroupResult(expertMetrics.map(definition.selector)),
		id: definition.id,
		label: definition.label,
		nonExpert: buildNormalityGroupResult(nonExpertMetrics.map(definition.selector)),
		pooled: buildNormalityGroupResult(pooledMetrics.map(definition.selector))
	}));

	return {
		alpha: 0.05,
		variables
	};
}

export function buildColorVisionAnalysis(
	records: ParticipantAnalysisRecord[],
	clause: ExpertClauseNode
): ColorVisionAnalysis {
	const participantGroups = getParticipantsByExpertClause(
		records.map((record) => record.demographics),
		clause
	);
	const expertRecords = records.filter((record) =>
		participantGroups.colorExpert.has(record.participantId)
	);
	const nonExpertRecords = records.filter((record) =>
		participantGroups.nonExpert.has(record.participantId)
	);
	const expertGroup = buildGroupAnalysis('expert', 'Expert', expertRecords);
	const nonExpertGroup = buildGroupAnalysis('nonExpert', 'Non-Expert', nonExpertRecords);
	const allAnalyzedMetrics = [...expertRecords, ...nonExpertRecords].map(
		(record) => record.metric
	);

	return {
		comparisons: [
			{
				betterDirection: 'higher',
				description:
					'Proportion of correct guesses across all staircase trials per participant.',
				delta:
					expertGroup.metrics.trialAccuracy.mean -
					nonExpertGroup.metrics.trialAccuracy.mean,
				expert: expertGroup.metrics.trialAccuracy,
				id: 'trialAccuracy',
				label: 'Trial accuracy',
				nonExpert: nonExpertGroup.metrics.trialAccuracy,
				welch: welchTStatistic(
					expertRecords.map((record) => record.metric.accuracy),
					nonExpertRecords.map((record) => record.metric.accuracy)
				)
			},
			{
				betterDirection: 'lower',
				description:
					'Average threshold across the completed direction-discrimination sets.',
				delta:
					expertGroup.metrics.meanRawThreshold.mean -
					nonExpertGroup.metrics.meanRawThreshold.mean,
				expert: expertGroup.metrics.meanRawThreshold,
				id: 'meanRawThreshold',
				label: 'Mean raw threshold',
				nonExpert: nonExpertGroup.metrics.meanRawThreshold,
				welch: welchTStatistic(
					expertRecords.map((record) => record.metric.meanRawThreshold),
					nonExpertRecords.map((record) => record.metric.meanRawThreshold)
				)
			},
			{
				betterDirection: 'lower',
				description:
					'Raw threshold divided by the vector-specific max step count, then averaged.',
				delta:
					expertGroup.metrics.meanNormalizedThreshold.mean -
					nonExpertGroup.metrics.meanNormalizedThreshold.mean,
				expert: expertGroup.metrics.meanNormalizedThreshold,
				id: 'meanNormalizedThreshold',
				label: 'Mean normalized threshold',
				nonExpert: nonExpertGroup.metrics.meanNormalizedThreshold,
				welch: welchTStatistic(
					expertRecords.map((record) => record.metric.meanNormalizedThreshold),
					nonExpertRecords.map((record) => record.metric.meanNormalizedThreshold)
				)
			}
		],
		groups: [expertGroup, nonExpertGroup],
		overallEllipsoidVolume: summarise(
			allAnalyzedMetrics.map((metric) => metric.ellipsoidVolume)
		),
		histogram: buildHistogram(
			expertRecords.map((record) => record.metric),
			nonExpertRecords.map((record) => record.metric)
		),
		normality: buildNormalityAnalysis(
			expertRecords.map((record) => record.metric),
			nonExpertRecords.map((record) => record.metric)
		)
	};
}

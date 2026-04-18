// @ts-nocheck
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
	computeEllipsoidProxyVolume,
	buildExactEllipsoidModelFromThresholdMeans,
	buildFittedEllipsoidModelFromThresholdMeans,
	MAX_LOCATION_BY_VECTOR,
	RECOVERED_AXIS_LIST
} from '../colorVisionMath.js';

const PARTICIPANT_DATA_DIR = path.join(process.cwd(), 'static', 'color-vision-data');
const MALE_FILENAME = 'color-vision-perception_male.json';
const FEMALE_FILENAME = 'color-vision-perception_female.json';
const ARCHIVED_VECTOR_BOUNDS = Object.freeze([167, 135, 175, 107]);
export const ELLIPSE_MODES = Object.freeze({
	EXACT: 'exact',
	INCLUDE_FITTED: 'include-fitted'
});

let participantGroupsPromise;
let combinedParticipantsPromise;

/**
 * @param {Record<string, any> | undefined} participant
 * @param {'exact' | 'include-fitted'} [ellipseMode]
 */
export function extractParticipantMetric(participant, ellipseMode = ELLIPSE_MODES.EXACT) {
	const thresholdsByVector = {
		1: [],
		2: [],
		3: [],
		4: []
	};
	let totalCorrect = 0;
	let totalTrials = 0;

	for (const record of Object.values(participant?.answers ?? {})) {
		if (!record || record.componentName === 'practice') {
			continue;
		}

		const answer = record.answer ?? {};
		const threshold = answer.threshold;
		const vector = answer.vector;
		const directionResponse = answer['direction-response'];

		if (
			typeof threshold !== 'number' ||
			typeof vector !== 'number' ||
			typeof directionResponse !== 'number' ||
			!(vector in thresholdsByVector)
		) {
			continue;
		}

		thresholdsByVector[vector].push(threshold);

		for (const guess of answer.guesses ?? []) {
			totalTrials += 1;

			if (guess.correct) {
				totalCorrect += 1;
			}
		}
	}

	for (const vector of [1, 2, 3, 4]) {
		if (!thresholdsByVector[vector].length) {
			return null;
		}
	}

	const thresholdMeans = {
		1: thresholdsByVector[1].reduce((sum, value) => sum + value, 0) / thresholdsByVector[1].length,
		2: thresholdsByVector[2].reduce((sum, value) => sum + value, 0) / thresholdsByVector[2].length,
		3: thresholdsByVector[3].reduce((sum, value) => sum + value, 0) / thresholdsByVector[3].length,
		4: thresholdsByVector[4].reduce((sum, value) => sum + value, 0) / thresholdsByVector[4].length
	};
	const allThresholds = Object.values(thresholdsByVector).flat();
	const exactEllipsoidModel = buildExactEllipsoidModelFromThresholdMeans(thresholdMeans);
	let ellipsoidModel = exactEllipsoidModel;

	if (!ellipsoidModel && ellipseMode === ELLIPSE_MODES.INCLUDE_FITTED) {
		ellipsoidModel = buildFittedEllipsoidModelFromThresholdMeans(thresholdMeans);
	}

	if (!ellipsoidModel) {
		return null;
	}

	return {
		accuracy: totalTrials ? totalCorrect / totalTrials : 0,
		ellipsoidModel,
		ellipsoidProxyVolume: computeEllipsoidProxyVolume(allThresholds),
		ellipsoidVolume: ellipsoidModel.volume,
		exactEllipsoidModel,
		fitKind: ellipsoidModel.fitKind,
		fitLoss: ellipsoidModel.fitLoss,
		maxRelativeRadiusError: ellipsoidModel.maxRelativeRadiusError,
		meanNormalizedThreshold:
			([1, 2, 3, 4]).reduce(
				(sum, vector) => sum + thresholdMeans[vector] / MAX_LOCATION_BY_VECTOR[vector],
				0
			) / 4,
		meanRawThreshold: allThresholds.reduce((sum, value) => sum + value, 0) / allThresholds.length,
		participantId: participant?.participantId ?? 'unknown',
		thresholdMeans,
		thresholdsByVector,
		totalCorrect,
		totalTrials
	};
}

async function loadParticipants(filename) {
	const filePath = path.join(PARTICIPANT_DATA_DIR, filename);
	const content = await readFile(filePath, 'utf-8');

	return /** @type {Record<string, any>[]} */ (JSON.parse(content));
}

export async function loadParticipantGroups() {
	if (!participantGroupsPromise) {
		participantGroupsPromise = Promise.all([
			loadParticipants(MALE_FILENAME),
			loadParticipants(FEMALE_FILENAME)
		]).then(([maleParticipants, femaleParticipants]) => ({
			femaleParticipants,
			maleParticipants
		}));
	}

	return participantGroupsPromise;
}

export async function loadCombinedParticipants() {
	if (!combinedParticipantsPromise) {
		combinedParticipantsPromise = loadParticipantGroups().then(
			({ maleParticipants, femaleParticipants }) => [
				...maleParticipants,
				...femaleParticipants
			]
		);
	}

	return combinedParticipantsPromise;
}

/**
 * @param {Record<string, any> | undefined} participant
 * @param {string} componentName
 */
function findAnswerByComponentName(participant, componentName) {
	for (const record of Object.values(participant?.answers ?? {})) {
		if (record?.componentName === componentName) {
			return record.answer ?? {};
		}
	}

	return {};
}

/**
 * @param {unknown} value
 */
function normalizeAnswerValue(value) {
	if (Array.isArray(value)) {
		return value
			.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
			.join(', ');
	}

	return typeof value === 'string' ? value : '';
}

/**
 * @param {Record<string, any> | undefined} participant
 */
export function extractExpertDemographics(participant) {
	const colorTheoryAnswers = findAnswerByComponentName(
		participant,
		'demographic-questionnaire-color-theory'
	);
	const makeupAnswers = findAnswerByComponentName(
		participant,
		'demographic-questionnaire-makeup'
	);

	return {
		color_hobby: normalizeAnswerValue(colorTheoryAnswers['color-hobby']),
		color_theory_class: normalizeAnswerValue(colorTheoryAnswers['color-theory-class']),
		makeup_familiarity: normalizeAnswerValue(makeupAnswers['makeup-familiarity']),
		makeup_products: normalizeAnswerValue(makeupAnswers['makeup-products']),
		participantId: participant?.participantId ?? 'unknown',
		use_makeup: normalizeAnswerValue(makeupAnswers['use-makeup'])
	};
}

/**
 * @param {Record<string, any>[]} participants
 * @param {'exact' | 'include-fitted'} [ellipseMode]
 */
function findFirstWorkedExample(participants, ellipseMode = ELLIPSE_MODES.EXACT) {
	for (let index = 0; index < participants.length; index += 1) {
		const metric = extractParticipantMetric(participants[index], ellipseMode);

		if (!metric) {
			continue;
		}

		return {
			group: 'male',
			index,
			metric
		};
	}

	return null;
}

/**
 * @param {'exact' | 'include-fitted'} [ellipseMode]
 */
export async function buildColorVisionMethods(ellipseMode = ELLIPSE_MODES.EXACT) {
	const { maleParticipants, femaleParticipants } = await loadParticipantGroups();
	const maleMetrics = maleParticipants
		.map((participant) => extractParticipantMetric(participant, ellipseMode))
		.filter((metric) => metric !== null);
	const femaleMetrics = femaleParticipants
		.map((participant) => extractParticipantMetric(participant, ellipseMode))
		.filter((metric) => metric !== null);
	const workedExample = findFirstWorkedExample(maleParticipants, ellipseMode);
	const workedInvalidExample = findFirstWorkedExample(maleParticipants, ELLIPSE_MODES.INCLUDE_FITTED);
	const exactMaleMetrics = maleParticipants
		.map((participant) => extractParticipantMetric(participant, ELLIPSE_MODES.EXACT))
		.filter((metric) => metric !== null);
	const exactFemaleMetrics = femaleParticipants
		.map((participant) => extractParticipantMetric(participant, ELLIPSE_MODES.EXACT))
		.filter((metric) => metric !== null);

	if (!workedExample) {
		throw new Error('Unable to build a worked ellipsoid example from the male participant file');
	}

	if (!workedInvalidExample) {
		throw new Error('Unable to build a worked invalid ellipsoid example from the male participant file');
	}

	const invalidMetric = maleParticipants
		.map((participant, index) => ({
			index,
			metric: extractParticipantMetric(participant, ELLIPSE_MODES.INCLUDE_FITTED)
		}))
		.find(({ metric }) => metric?.fitKind === 'fitted');

	if (!invalidMetric?.metric) {
		throw new Error('Unable to locate a participant who requires fitted ellipse fallback');
	}

	return {
		archive: {
			testName: 'fixedset',
			vectorBounds: ARCHIVED_VECTOR_BOUNDS
		},
		axes: RECOVERED_AXIS_LIST,
		dataset: {
			femaleCount: femaleMetrics.length,
			maleCount: maleMetrics.length
		},
		countsByMode: {
			exact: {
				femaleCount: exactFemaleMetrics.length,
				maleCount: exactMaleMetrics.length
			},
			includeFitted: {
				femaleCount: femaleMetrics.length,
				maleCount: maleMetrics.length
			}
		},
		ellipseMode,
		proxyComparison: {
			femaleMedianProxy: [...femaleMetrics].sort(
				(left, right) => left.ellipsoidProxyVolume - right.ellipsoidProxyVolume
			)[Math.floor(femaleMetrics.length / 2)].ellipsoidProxyVolume,
			maleMedianProxy: [...maleMetrics].sort(
				(left, right) => left.ellipsoidProxyVolume - right.ellipsoidProxyVolume
			)[Math.floor(maleMetrics.length / 2)].ellipsoidProxyVolume
		},
		workedExample: {
			...workedExample.metric,
			index: workedExample.index
		},
		workedInvalidExample: {
			...invalidMetric.metric,
			exactFitAvailable: Boolean(invalidMetric.metric.exactEllipsoidModel),
			index: invalidMetric.index
		}
	};
}

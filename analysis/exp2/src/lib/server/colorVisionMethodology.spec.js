// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildColorVisionAnalysis } from '../colorVisionGroupAnalysis.ts';
import { evaluateExpertClause, getDefaultExpertClause } from '../expertClause.ts';
import { buildParticipantAnalysisRecords } from './colorVisionAnalysis.ts';
import {
	buildColorVisionMethods,
	ELLIPSE_MODES,
	extractExpertDemographics,
	extractParticipantMetric,
	loadCombinedParticipants,
	loadParticipantGroups
} from './colorVisionMethodology.js';

function almostEqual(actual, expected, tolerance = 1e-5) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`expected ${actual} to be within ${tolerance} of ${expected}`
	);
}

test('worked example volume and axis metadata stay stable', async () => {
	const methods = await buildColorVisionMethods(ELLIPSE_MODES.EXACT);

	assert.equal(methods.axes[0].name, 'pink');
	assert.equal(methods.axes[1].name, 'magenta');
	assert.equal(methods.axes[2].name, 'blue');
	assert.equal(methods.axes[3].name, 'lighter');
	assert.equal(methods.workedExample.participantId, '69c2bcb720c7f3e4f4209d59');
	almostEqual(methods.workedExample.ellipsoidVolume, 1234.5128935976566);
	almostEqual(methods.workedExample.ellipsoidProxyVolume, 1392.421296296296);
});

test('histogram visibility regression uses reconstructed ellipsoid volume', async () => {
	const participants = await loadCombinedParticipants();
	const exactMetrics = participants
		.map((participant) => extractParticipantMetric(participant, ELLIPSE_MODES.EXACT))
		.filter(Boolean);
	const visibleMetrics = exactMetrics.filter((metric) => metric.ellipsoidVolume <= 12000);

	assert.equal(exactMetrics.length, 243);
	assert.equal(visibleMetrics.length, 221);
	assert.equal(exactMetrics.length - visibleMetrics.length, 22);
});

test('participant extraction returns a full reconstructed metric', async () => {
	const { maleParticipants } = await loadParticipantGroups();
	const metric = extractParticipantMetric(maleParticipants[1], ELLIPSE_MODES.EXACT);

	assert.ok(metric);
	assert.equal(metric.participantId, '69c2bcb720c7f3e4f4209d59');
	assert.deepEqual(metric.thresholdsByVector[1], [7, 11, 10]);
	assert.deepEqual(metric.thresholdsByVector[2], [8, 8, 8]);
	assert.deepEqual(metric.thresholdsByVector[3], [10, 10, 10]);
	assert.deepEqual(metric.thresholdsByVector[4], [13, 13, 26]);
	almostEqual(metric.thresholdMeans[1], 9.333333333333334, 1e-12);
	almostEqual(metric.thresholdMeans[4], 17.333333333333332, 1e-12);
	almostEqual(metric.ellipsoidModel.ellipse.major, 8.797379372393316);
	almostEqual(metric.ellipsoidVolume, 1234.5128935976566);
});

test('include-fitted mode rescues previously excluded participants', async () => {
	const { maleParticipants } = await loadParticipantGroups();
	const allParticipants = await loadCombinedParticipants();
	const exactMetrics = allParticipants
		.map((participant) => extractParticipantMetric(participant, ELLIPSE_MODES.EXACT))
		.filter(Boolean);
	const fittedMetrics = allParticipants
		.map((participant) => extractParticipantMetric(participant, ELLIPSE_MODES.INCLUDE_FITTED))
		.filter(Boolean);
	const invalidFallback = extractParticipantMetric(maleParticipants[0], ELLIPSE_MODES.INCLUDE_FITTED);

	assert.equal(exactMetrics.length, 243);
	assert.equal(fittedMetrics.length, 394);
	assert.ok(invalidFallback);
	assert.equal(invalidFallback.fitKind, 'fitted');
	almostEqual(invalidFallback.fitLoss, 0.013364084213102588);
	almostEqual(invalidFallback.maxRelativeRadiusError, 0.09546422232480078);
	almostEqual(invalidFallback.ellipsoidVolume, 2985.23889198811);
});

test('extractExpertDemographics normalizes exp2 questionnaire answers', async () => {
	const participants = await loadCombinedParticipants();
	const sampleParticipant = participants.find((participant) => {
		const demographics = extractExpertDemographics(participant);
		return demographics.color_hobby === 'Painting' && demographics.makeup_products === 'None';
	});

	assert.ok(sampleParticipant);

	const demographics = extractExpertDemographics(sampleParticipant);
	assert.equal(demographics.participantId, sampleParticipant.participantId);
	assert.equal(demographics.color_hobby, 'Painting');
	assert.equal(demographics.color_theory_class, 'No');
	assert.equal(demographics.makeup_familiarity, 'Yes');
	assert.equal(demographics.makeup_products, 'None');
	assert.equal(demographics.use_makeup, 'I do not use makeup');
});

test('default expert clause finds expert and non-expert participants in exp2 data', async () => {
	const participants = await loadCombinedParticipants();
	const demographics = participants.map((participant) => extractExpertDemographics(participant));
	const defaultClause = getDefaultExpertClause();
	const hobbyExpert = demographics.find((demo) => demo.color_hobby.includes('Graphic Design'));
	const theoryExpert = demographics.find((demo) => demo.color_theory_class === 'Yes');
	const makeupExpert = demographics.find((demo) => demo.use_makeup === 'I use it regularly');
	const nonExpert = demographics.find(
		(demo) =>
			demo.color_hobby === "I don't participate in any of the above" &&
			demo.color_theory_class === 'No' &&
			demo.use_makeup !== 'I use it regularly' &&
			demo.use_makeup !== 'I use it professionally'
	);

	assert.ok(hobbyExpert);
	assert.ok(theoryExpert);
	assert.ok(makeupExpert);
	assert.ok(nonExpert);
	assert.equal(evaluateExpertClause(defaultClause, hobbyExpert), true);
	assert.equal(evaluateExpertClause(defaultClause, theoryExpert), true);
	assert.equal(evaluateExpertClause(defaultClause, makeupExpert), true);
	assert.equal(evaluateExpertClause(defaultClause, nonExpert), false);
	assert.equal(
		evaluateExpertClause(defaultClause, {
			color_hobby: '',
			color_theory_class: '',
			makeup_familiarity: '',
			makeup_products: '',
			participantId: 'blank',
			use_makeup: ''
		}),
		false
	);
});

test('expert analysis keeps totals, histogram reconciliation, and deltas consistent', async () => {
	for (const mode of [ELLIPSE_MODES.EXACT, ELLIPSE_MODES.INCLUDE_FITTED]) {
		const participantRecords = await buildParticipantAnalysisRecords(mode);
		const analysis = buildColorVisionAnalysis(participantRecords, getDefaultExpertClause());
		const totalVisible = analysis.histogram.bins.reduce((sum, bin) => sum + bin.totalCount, 0);
		const {
			firstQuartile,
			maximum,
			median,
			minimum,
			thirdQuartile
		} = analysis.histogram.summary;
		const expertGroup = analysis.groups[0];
		const nonExpertGroup = analysis.groups[1];
		const trialAccuracyComparison = analysis.comparisons.find(
			(comparison) => comparison.id === 'trialAccuracy'
		);

		assert.equal(
			analysis.histogram.participantVolumes.length,
			analysis.histogram.visibleParticipantCount + analysis.histogram.omittedCount
		);
		assert.equal(
			expertGroup.participantCount + nonExpertGroup.participantCount,
			participantRecords.length
		);
		assert.equal(totalVisible, analysis.histogram.visibleParticipantCount);
		assert.ok(minimum <= firstQuartile);
		assert.ok(firstQuartile <= median);
		assert.ok(median <= thirdQuartile);
		assert.ok(thirdQuartile <= maximum);
		assert.ok(trialAccuracyComparison);
		almostEqual(
			trialAccuracyComparison.delta,
			trialAccuracyComparison.expert.mean - trialAccuracyComparison.nonExpert.mean
		);
	}
});

// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	buildDistributionComparison,
	interpretCohensD,
	ORIGINAL_STUDY_VOLUME_DISTRIBUTION
} from './distributionComparison.ts';

function almostEqual(actual, expected, tolerance = 1e-6) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`expected ${actual} to be within ${tolerance} of ${expected}`
	);
}

const SAMPLE = [1000, 2000, 3000, 4000, 5000];

test('buildDistributionComparison reports descriptives from the raw sample', () => {
	const result = buildDistributionComparison(SAMPLE, 'Test study');

	assert.equal(result.current.label, 'Test study');
	assert.equal(result.current.n, 5);
	almostEqual(result.current.mean, 3000);
	almostEqual(result.current.median, 3000);
	almostEqual(result.current.q1, 2000);
	almostEqual(result.current.q3, 4000);
	almostEqual(result.current.min, 1000);
	almostEqual(result.current.max, 5000);
	almostEqual(
		result.current.geoMean,
		(1000 * 2000 * 3000 * 4000 * 5000) ** (1 / 5),
		1e-6
	);
});

test('buildDistributionComparison compares against the original study summary', () => {
	const result = buildDistributionComparison(SAMPLE);

	assert.equal(result.original.n, ORIGINAL_STUDY_VOLUME_DISTRIBUTION.n);
	almostEqual(
		result.original.cv,
		ORIGINAL_STUDY_VOLUME_DISTRIBUTION.sd / ORIGINAL_STUDY_VOLUME_DISTRIBUTION.mean
	);
	almostEqual(
		result.welchRaw.meanDifference,
		3000 - ORIGINAL_STUDY_VOLUME_DISTRIBUTION.mean
	);
	almostEqual(result.logScale.medianRatio, 3000 / ORIGINAL_STUDY_VOLUME_DISTRIBUTION.median);
	almostEqual(result.tost.margin, 0.2 * ORIGINAL_STUDY_VOLUME_DISTRIBUTION.sd);
	assert.ok(result.logScale.probabilitySuperiority > 0);
	assert.ok(result.logScale.probabilitySuperiority < 1);
});

test('Monte-Carlo sensitivity check is reproducible for a fixed seed', () => {
	const first = buildDistributionComparison(SAMPLE);
	const second = buildDistributionComparison(SAMPLE);

	assert.equal(first.monteCarlo.ks.dStatistic, second.monteCarlo.ks.dStatistic);
	assert.equal(first.monteCarlo.ks.pValue, second.monteCarlo.ks.pValue);
	assert.equal(
		first.monteCarlo.mannWhitney.zScore,
		second.monteCarlo.mannWhitney.zScore
	);
	assert.ok(first.monteCarlo.ks.dStatistic >= 0 && first.monteCarlo.ks.dStatistic <= 1);
});

test('buildDistributionComparison rejects samples that are too small', () => {
	assert.throws(() => buildDistributionComparison([1000, 2000]));
});

test('interpretCohensD labels effect magnitude using Cohen benchmarks', () => {
	assert.equal(interpretCohensD(0.1), 'negligible');
	assert.equal(interpretCohensD(-0.19), 'negligible');
	assert.equal(interpretCohensD(0.2), 'small');
	assert.equal(interpretCohensD(-0.49), 'small');
	assert.equal(interpretCohensD(0.5), 'medium');
	assert.equal(interpretCohensD(0.79), 'medium');
	assert.equal(interpretCohensD(0.8), 'large');
	assert.equal(interpretCohensD(-1.4), 'large');
	assert.equal(interpretCohensD(Number.NaN), 'negligible');
});

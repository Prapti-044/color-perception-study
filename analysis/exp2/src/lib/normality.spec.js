// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { qqPlotPoints, shapiroWilk } from './normality.ts';

function almostEqual(actual, expected, tolerance = 1e-3) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`expected ${actual} to be within ${tolerance} of ${expected}`
	);
}

test('shapiroWilk: W is 1 for a constant sample', () => {
	const result = shapiroWilk([5, 5, 5, 5, 5]);
	assert.equal(result.W, 1);
	assert.equal(result.pValue, 1);
	assert.equal(result.verdict, 'fail-to-reject');
});

test('shapiroWilk: degenerate for n < 3', () => {
	const result = shapiroWilk([1, 2]);
	assert.equal(result.W, null);
	assert.equal(result.pValue, null);
	assert.equal(result.verdict, null);
	assert.equal(result.n, 2);
});

test('shapiroWilk: integer sequence 1..10 matches R shapiro.test', () => {
	// R: shapiro.test(1:10) -> W = 0.97016, p-value = 0.8912
	const result = shapiroWilk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	almostEqual(result.W, 0.97016, 1e-3);
	almostEqual(result.pValue, 0.8912, 1e-2);
	assert.equal(result.verdict, 'fail-to-reject');
});

test('shapiroWilk: small approximately-normal sample (n=8) matches scipy', () => {
	// scipy.stats.shapiro -> W = 0.98975, p = 0.99468
	const result = shapiroWilk([-0.3, 0.1, 0.4, -0.2, 0.9, -0.8, 0.2, 0.6]);
	almostEqual(result.W, 0.98975, 1e-3);
	almostEqual(result.pValue, 0.99468, 1e-2);
	assert.equal(result.verdict, 'fail-to-reject');
});

test('shapiroWilk: 1965 Shapiro–Wilk paper example (n=11) matches scipy', () => {
	// Weights-of-men example. scipy.stats.shapiro -> W = 0.78881, p = 0.00670
	const result = shapiroWilk([
		148, 154, 158, 160, 161, 162, 166, 170, 182, 195, 236
	]);
	almostEqual(result.W, 0.78881, 1e-3);
	almostEqual(result.pValue, 0.00670, 5e-3);
	assert.equal(result.verdict, 'reject');
});

test('shapiroWilk: heavy right-skew rejects normality', () => {
	// scipy.stats.shapiro -> W = 0.51990, p = 5.11e-6
	const result = shapiroWilk([
		1, 1, 1, 1, 2, 2, 2, 3, 3, 5, 5, 8, 15, 30, 80
	]);
	almostEqual(result.W, 0.51990, 1e-2);
	assert.ok(
		result.pValue < 0.001,
		`expected p < 0.001 for heavy right-skew, got ${result.pValue}`
	);
	assert.equal(result.verdict, 'reject');
});

test('shapiroWilk: bimodal sample rejects normality', () => {
	// scipy.stats.shapiro -> W = 0.66719, p = 3.53e-4
	const result = shapiroWilk([
		0, 0, 0.1, -0.1, 0.05, 10, 10, 10.1, 9.9, 10.05
	]);
	almostEqual(result.W, 0.66719, 1e-2);
	assert.ok(
		result.pValue < 0.01,
		`expected p < 0.01 for bimodal sample, got ${result.pValue}`
	);
	assert.equal(result.verdict, 'reject');
});

test('shapiroWilk: n=3 endpoints W=1 and W=3/4', () => {
	// [1,2,3] is perfectly linear -> W = 1, p = 1 (scipy confirmed)
	const exact = shapiroWilk([1, 2, 3]);
	almostEqual(exact.W, 1, 1e-6);
	almostEqual(exact.pValue, 1, 1e-6);
	assert.equal(exact.verdict, 'fail-to-reject');

	// Two duplicates and an extreme outlier -> W = 3/4 (the n=3 lower bound)
	const skewed = shapiroWilk([0, 0, 100]);
	almostEqual(skewed.W, 0.75, 1e-6);
	assert.ok(skewed.pValue < 0.05, `expected p < 0.05, got ${skewed.pValue}`);
	assert.equal(skewed.verdict, 'reject');
});

test('qqPlotPoints: empty / constant inputs return empty array', () => {
	assert.deepEqual(qqPlotPoints([]), []);
	assert.deepEqual(qqPlotPoints([1]), []);
	assert.deepEqual(qqPlotPoints([5, 5, 5, 5]), []);
});

test('qqPlotPoints: standardized sample + Blom quantiles are symmetric for 1..5', () => {
	const points = qqPlotPoints([1, 2, 3, 4, 5]);
	assert.equal(points.length, 5);
	// Middle point should sit exactly on the mean => sample quantile 0
	almostEqual(points[2].sample, 0, 1e-9);
	almostEqual(points[2].theoretical, 0, 1e-9);
	// Symmetric around zero
	almostEqual(points[0].sample + points[4].sample, 0, 1e-9);
	almostEqual(points[0].theoretical + points[4].theoretical, 0, 1e-9);
});

test('qqPlotPoints: near-normal sample tracks the y = x diagonal', () => {
	const values = [-1.5, -0.9, -0.4, 0, 0.2, 0.5, 0.9, 1.5];
	const points = qqPlotPoints(values);
	for (const { theoretical, sample } of points) {
		// With a near-standard-normal input, standardized sample should be
		// within ~0.4 of the theoretical quantile.
		assert.ok(
			Math.abs(sample - theoretical) < 0.4,
			`|sample - theoretical| >= 0.4 at theoretical=${theoretical}, sample=${sample}`
		);
	}
});

// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	RECOVERED_AXIS_LIST,
	buildEllipsoidModelFromThresholdMeans,
	buildExactEllipsoidModelFromThresholdMeans,
	buildFittedEllipsoidModelFromThresholdMeans,
	rgbToLuv,
	thresholdMeanToRadius
} from './colorVisionMath.js';

function almostEqual(actual, expected, tolerance = 1e-5) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`expected ${actual} to be within ${tolerance} of ${expected}`
	);
}

test('rgbToLuv reproduces the recovered pink endpoint', () => {
	const [l, u, v] = rgbToLuv([217.907015, 50.249592, 91.946166]);

	almostEqual(l, 49.459883, 1e-4);
	almostEqual(u, 116.626489, 1e-4);
	almostEqual(v, 7.252843, 1e-4);
});

test('recovered axis ordering is stable', () => {
	assert.deepEqual(
		RECOVERED_AXIS_LIST.map((axis) => axis.name),
		['pink', 'magenta', 'blue', 'lighter']
	);
});

test('threshold means convert to recovered radii and a valid ellipsoid', () => {
	almostEqual(thresholdMeanToRadius(9.333333333333334, 1), 6.569980891566266);
	almostEqual(thresholdMeanToRadius(8, 2), 5.808733123272654);
	almostEqual(thresholdMeanToRadius(10, 3), 6.061530295129987);
	almostEqual(thresholdMeanToRadius(17.333333333333332, 4), 6.355374100628931);

	const model = buildEllipsoidModelFromThresholdMeans({
		1: 9.333333333333334,
		2: 8,
		3: 10,
		4: 17.333333333333332
	});

	assert.ok(model);
	almostEqual(model.ellipse.major, 8.797379372393316);
	almostEqual(model.ellipse.minor, 5.2712374552628845);
	almostEqual(model.lightness, 6.355374100628931);
	almostEqual(model.volume, 1234.5128935976566);
});

test('exact-valid participants remain exact while invalid participants can be fitted', () => {
	const exactModel = buildExactEllipsoidModelFromThresholdMeans({
		1: 9.333333333333334,
		2: 8,
		3: 10,
		4: 17.333333333333332
	});

	assert.ok(exactModel);
	assert.equal(exactModel.fitKind, 'exact');

	const invalidExact = buildExactEllipsoidModelFromThresholdMeans({
		1: 8,
		2: 10.666666666666666,
		3: 18.333333333333332,
		4: 22.666666666666668
	});
	const fittedModel = buildFittedEllipsoidModelFromThresholdMeans({
		1: 8,
		2: 10.666666666666666,
		3: 18.333333333333332,
		4: 22.666666666666668
	});

	assert.equal(invalidExact, null);
	assert.ok(fittedModel);
	assert.equal(fittedModel.fitKind, 'fitted');
	assert.ok(Number.isFinite(fittedModel.volume));
	assert.ok(fittedModel.ellipse.major >= fittedModel.ellipse.minor);
	assert.ok(fittedModel.fitLoss > 0);
	assert.ok(fittedModel.maxRelativeRadiusError > 0);
});

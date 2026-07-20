// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	buildVolumeEquivalenceComparison,
	DEFAULT_VOLUME_EQUIVALENCE_MARGIN,
	ORIGINAL_STUDY_VOLUME_SUMMARY
} from './studyMeanEquivalence.ts';

function almostEqual(actual, expected, tolerance = 1e-6) {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`expected ${actual} to be within ${tolerance} of ${expected}`
	);
}

test('buildVolumeEquivalenceComparison reproduces the 394-participant comparison', () => {
	const result = buildVolumeEquivalenceComparison({
		label: 'This study',
		mean: 11667.414859496588,
		n: 394,
		sd: 93081.12148087847
	});

	assert.equal(result.reference, ORIGINAL_STUDY_VOLUME_SUMMARY);
	almostEqual(result.equivalenceMargin, DEFAULT_VOLUME_EQUIVALENCE_MARGIN);
	almostEqual(result.meanDifference, 7996.984859496588);
	almostEqual(result.standardError, 4690.050960718528);
	almostEqual(result.degreesOfFreedom, 393.23196302685653);
	almostEqual(result.tStatistic, 1.7050955152673712);
	almostEqual(result.pValueTwoSided, 0.0889663906521605);
	almostEqual(result.meanDifferenceCi90.lower, 264.3207668590276);
	almostEqual(result.meanDifferenceCi90.upper, 15729.648952134148);
	almostEqual(result.meanDifferenceCi95.lower, -1223.7254806235233);
	almostEqual(result.meanDifferenceCi95.upper, 17217.695199616697);
	almostEqual(result.requiredMarginForEquivalence, 15729.648952134148);
	assert.equal(result.tost.equivalent, false);
	almostEqual(result.tost.maxPValue, 0.8682342406668317);
});

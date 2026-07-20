import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import metadata from '../../data/scatterplots_metadata.json';
import type { MetadataFile, ScatterplotMetadata } from './types';
import {
	buildMakeupStimulusKeySet,
	getStandardTrialKey,
	getStandardTrialMetadataKey,
	parseFoundationColorsCsv
} from './makeup';

const foundationCsv = readFileSync(
	new URL('../../static/foundation-names/allShades.csv', import.meta.url),
	'utf8'
);
const foundationColors = parseFoundationColorsCsv(foundationCsv);
const scatterplotMetadata = metadata as MetadataFile;

describe('makeup stimulus classification', () => {
	it('reproduces the scatterplot page makeup subset across all scatterplots', () => {
		const keys = buildMakeupStimulusKeySet(scatterplotMetadata.scatterplots, foundationColors);

		expect(keys.size).toBe(84);
	});

	it('reproduces the scatterplot page makeup subset for small-difference stimuli', () => {
		const smallDiffScatterplots = scatterplotMetadata.scatterplots.filter(
			(scatterplot): scatterplot is ScatterplotMetadata =>
				scatterplot.diff_type === 'small'
				&& (scatterplot.axis === 'L' || scatterplot.axis === 'a' || scatterplot.axis === 'b')
		);
		const keys = buildMakeupStimulusKeySet(smallDiffScatterplots, foundationColors);
		const classifiedScatterplots = smallDiffScatterplots.filter((scatterplot) =>
			keys.has(getStandardTrialMetadataKey(scatterplot))
		);
		const byAxis = classifiedScatterplots.reduce(
			(counts, scatterplot) => {
				if (scatterplot.axis === 'L' || scatterplot.axis === 'a' || scatterplot.axis === 'b') {
					counts[scatterplot.axis] += 1;
				}
				return counts;
			},
			{ L: 0, a: 0, b: 0 }
		);

		expect(classifiedScatterplots).toHaveLength(81);
		expect(keys.size).toBe(81);
		expect(byAxis).toEqual({ L: 25, a: 29, b: 27 });
		expect(new Set(classifiedScatterplots.map((scatterplot) => scatterplot.index)).size).toBe(31);
	});
});

describe('standard trial key helpers', () => {
	it('match report trials to metadata keys by index and axis only', () => {
		const metadataKey = getStandardTrialMetadataKey({ index: 12, axis: 'L' });

		expect(metadataKey).toBe('12-L');
		expect(getStandardTrialKey({ scatter_index: 12, axis: 'L' })).toBe(metadataKey);
		expect(getStandardTrialKey({ scatter_index: 12, axis: 'a' })).not.toBe(metadataKey);
		expect(getStandardTrialKey({ scatter_index: 12, axis: undefined })).toBeNull();
	});
});

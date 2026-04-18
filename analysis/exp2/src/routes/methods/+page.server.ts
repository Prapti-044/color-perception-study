import type { PageServerLoad } from './$types';
import { buildParticipantAnalysisRecords } from '$lib/server/colorVisionAnalysis';
import { buildColorVisionMethods } from '$lib/server/colorVisionMethodology.js';

const methodsPromises: Record<'exact' | 'include-fitted', ReturnType<typeof buildColorVisionMethods> | undefined> = {
	exact: undefined,
	'include-fitted': undefined
};
const participantRecordPromises: Record<
	'exact' | 'include-fitted',
	ReturnType<typeof buildParticipantAnalysisRecords> | undefined
> = {
	exact: undefined,
	'include-fitted': undefined
};

export const prerender = false;

export const load = (async () => {
	return {
		participantRecordsByMode: {
			exact: await (participantRecordPromises.exact ??= buildParticipantAnalysisRecords('exact')),
			'include-fitted':
				await (participantRecordPromises['include-fitted'] ??=
					buildParticipantAnalysisRecords('include-fitted'))
		},
		methodsByMode: {
			exact: await (methodsPromises.exact ??= buildColorVisionMethods('exact')),
			'include-fitted':
				await (methodsPromises['include-fitted'] ??= buildColorVisionMethods('include-fitted'))
		}
	};
}) satisfies PageServerLoad;

import type { PageServerLoad } from './$types';
import { buildParticipantAnalysisRecords } from '$lib/server/colorVisionAnalysis';

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
		}
	};
}) satisfies PageServerLoad;

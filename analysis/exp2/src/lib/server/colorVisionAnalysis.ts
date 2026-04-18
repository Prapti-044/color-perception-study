import type { ParticipantAnalysisRecord } from '$lib/colorVisionGroupAnalysis';
import {
	ELLIPSE_MODES,
	extractExpertDemographics,
	extractParticipantMetric,
	loadCombinedParticipants
} from './colorVisionMethodology.js';

export async function buildParticipantAnalysisRecords(
	ellipseMode: 'exact' | 'include-fitted' = ELLIPSE_MODES.EXACT
): Promise<ParticipantAnalysisRecord[]> {
	const participants = await loadCombinedParticipants();

	return participants
		.map((participant: Record<string, unknown>) => {
			const metric = extractParticipantMetric(participant, ellipseMode);
			if (!metric) {
				return null;
			}

			return {
				demographics: extractExpertDemographics(participant),
				metric,
				participantId: metric.participantId
			};
		})
		.filter(
			(record: ParticipantAnalysisRecord | null): record is ParticipantAnalysisRecord =>
				record !== null
		);
}

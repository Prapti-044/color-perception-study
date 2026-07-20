// Data loading and parsing utilities
import { ATTENTION_CHECK_QUESTIONS, EXCLUDED_PARTICIPANT_IDS } from './constants';
import type {
	MetadataFile,
	ParticipantData,
	Demographics,
	AttentionCheck,
	ExperimentInfo,
	ColorBlindnessResult,
	TrialResponse,
	TrialDetails,
	ParticipantSummary,
	ScatterplotMetadata
} from './types';

/**
 * Parse user agent string to get a simplified browser description.
 */
function parseBrowserInfo(userAgent: string): string {
	if (!userAgent) return 'Unknown';

	let browser = 'Unknown Browser';
	if (userAgent.includes('Firefox')) {
		browser = 'Firefox';
	} else if (userAgent.includes('Edg')) {
		browser = 'Edge';
	} else if (userAgent.includes('Chrome')) {
		browser = 'Chrome';
	} else if (userAgent.includes('Safari')) {
		browser = 'Safari';
	}

	let osName = 'Unknown OS';
	if (userAgent.includes('Windows')) {
		osName = 'Windows';
	} else if (userAgent.includes('Mac OS') || userAgent.includes('Macintosh')) {
		osName = 'macOS';
	} else if (userAgent.includes('Linux')) {
		osName = 'Linux';
	} else if (userAgent.includes('Android')) {
		osName = 'Android';
	} else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
		osName = 'iOS';
	}

	return `${browser} on ${osName}`;
}

/**
 * Get the attention check question text by number.
 */
function getAttentionCheckQuestion(acNumber: number): string {
	if (acNumber in ATTENTION_CHECK_QUESTIONS) {
		return ATTENTION_CHECK_QUESTIONS[acNumber].question;
	}
	return `Attention Check #${acNumber}`;
}

/**
 * Load JSON data from a URL.
 */
async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
	}
	return response.json();
}

/**
 * Load all participant data from the three condition files.
 */
export async function loadAllData(): Promise<{
	metadata: MetadataFile;
	responses: TrialResponse[];
	demographics: Demographics[];
	attentionChecks: Record<string, AttentionCheck[]>;
	experimentInfo: Record<string, ExperimentInfo>;
}> {
	// Load metadata and all condition files in parallel
	const [metadata, dataL, dataA, dataB] = await Promise.all([
		fetchJson<MetadataFile>('/data/scatterplots_metadata.json'),
		fetchJson<ParticipantData[]>('/data/colormap-makeup-L_all.json'),
		fetchJson<ParticipantData[]>('/data/colormap-makeup-a_all.json'),
		fetchJson<ParticipantData[]>('/data/colormap-makeup-b_all.json')
	]);

	const demographicsList: Demographics[] = [];
	const attentionChecksByParticipant: Record<string, AttentionCheck[]> = {};
	const experimentInfoByParticipant: Record<string, ExperimentInfo> = {};
	const seenParticipants = new Set<string>();
	const allResponses: TrialResponse[] = [];

	const conditionData: Array<{ data: ParticipantData[]; condition: 'L' | 'a' | 'b' }> = [
		{ data: dataL, condition: 'L' },
		{ data: dataA, condition: 'a' },
		{ data: dataB, condition: 'b' }
	];

	for (const { data, condition } of conditionData) {
		for (const participant of data) {
			const pid = participant.participantId;
			
			// Skip excluded participants
			if (EXCLUDED_PARTICIPANT_IDS.includes(pid)) {
				continue;
			}
			
			const completed = participant.completed ?? false;
			const answers = participant.answers ?? {};

			if (!seenParticipants.has(pid)) {
				const demoData: Demographics = {
					participantId: pid,
					gender: 'Not specified',
					age: 'Not specified',
					education: 'Not specified',
					gender_other: '',
					education_other: '',
					strategies: 'Not specified',
					color_hobby: 'Not specified',
					color_theory_class: 'Not specified',
					color_theory_knowledge: 'Not specified',
					color_theory_knowledge_2: 'Not specified',
					makeup_familiarity: 'Not specified',
					use_makeup: 'Not specified',
					foundation_shade: 'Not specified',
					makeup_products: 'Not specified'
				};

				// Extract experiment-level info
				const metadataInfo = participant.metadata ?? {};
				const resolution = metadataInfo.resolution;
				const searchParams = participant.searchParams ?? {};

				// Calculate total experiment duration
				const startTimes: number[] = [];
				const endTimes: number[] = [];
				for (const val of Object.values(answers)) {
					if (val && typeof val === 'object') {
						if ('startTime' in val && val.startTime) {
							startTimes.push(val.startTime as number);
						}
						if ('endTime' in val && val.endTime) {
							endTimes.push(val.endTime as number);
						}
					}
				}

				let durationMinutes: number | null = null;
				let startTimestamp: number | null = null;
				if (startTimes.length > 0 && endTimes.length > 0) {
					const firstStart = Math.min(...startTimes);
					const lastEnd = Math.max(...endTimes);
					durationMinutes = (lastEnd - firstStart) / 1000 / 60;
					startTimestamp = firstStart;
				}

				// Extract color blindness test results
				const colorBlindnessResults: ColorBlindnessResult[] = [];
				for (const [key, val] of Object.entries(answers)) {
					if (key.toLowerCase().includes('color-blindness') && val && typeof val === 'object') {
						const answer = val.answer;
						const correctAnswers = val.correctAnswer;

						if (answer) {
							for (const [responseKey, responseVal] of Object.entries(answer)) {
								if (responseKey.includes('response') && !responseKey.includes('dontKnow')) {
									let correctVal: string | null = null;
									if (correctAnswers) {
										for (const ca of correctAnswers) {
											if (ca.id === responseKey) {
												correctVal = ca.answer;
												break;
											}
										}
									}

									const isCorrect = responseVal === correctVal;
									colorBlindnessResults.push({
										plate: responseKey,
										answer: String(responseVal),
										correct: correctVal,
										is_correct: isCorrect
									});
								}
							}
						}
					}
				}

				const cbPassed = colorBlindnessResults.filter((r) => r.is_correct).length;
				const cbTotal = colorBlindnessResults.length;

				experimentInfoByParticipant[pid] = {
					browser: parseBrowserInfo(metadataInfo.userAgent ?? ''),
					language: metadataInfo.language ?? 'N/A',
					screen_width: resolution?.width ?? null,
					screen_height: resolution?.height ?? null,
					color_depth: resolution?.colorDepth ?? null,
					orientation: resolution?.orientation ?? 'N/A',
					duration_minutes: durationMinutes,
					start_timestamp: startTimestamp,
					stage: participant.stage ?? 'N/A',
					rejected: participant.rejected ?? false,
					participant_tags: participant.participantTags ?? [],
					prolific_study_id: searchParams.STUDY_ID ?? 'N/A',
					prolific_session_id: searchParams.SESSION_ID ?? 'N/A',
					color_blindness_passed: cbPassed,
					color_blindness_total: cbTotal,
					color_blindness_results: colorBlindnessResults
				};

				const attentionChecks: AttentionCheck[] = [];

				for (const [key, value] of Object.entries(answers)) {
					if (key.toLowerCase().includes('demographic-questionnaire-color-theory')) {
						const demoAnswer = value.answer;
						if (demoAnswer) {
							demoData.strategies = (demoAnswer.strategies as string) ?? 'Not specified';
							const colorHobby = demoAnswer['color-hobby'] as string[] | undefined;
							demoData.color_hobby = Array.isArray(colorHobby)
								? colorHobby.join(', ')
								: String(colorHobby ?? 'Not specified');
							demoData.color_theory_class =
								(demoAnswer['color-theory-class'] as string) ?? 'Not specified';
							demoData.color_theory_knowledge =
								(demoAnswer['color-theory-knowledge'] as string) ?? 'Not specified';
							demoData.color_theory_knowledge_2 =
								(demoAnswer['color-theory-knowledge-2'] as string) ?? 'Not specified';
						}
					} else if (key.toLowerCase().includes('demographic-questionnaire-makeup')) {
						const demoAnswer = value.answer;
						if (demoAnswer) {
							demoData.makeup_familiarity =
								(demoAnswer['makeup-familiarity'] as string) ?? 'Not specified';
							demoData.use_makeup = (demoAnswer['use-makeup'] as string) ?? 'Not specified';
							demoData.foundation_shade =
								(demoAnswer['foundation-shade'] as string) ?? 'Not specified';
							const makeupProducts = demoAnswer['makeup-products'] as string[] | undefined;
							demoData.makeup_products = Array.isArray(makeupProducts)
								? makeupProducts.join(', ')
								: String(makeupProducts ?? 'Not specified');
						}
					} else if (
						key.toLowerCase().includes('demographic') &&
						!key.toLowerCase().includes('color-theory') &&
						!key.toLowerCase().includes('makeup')
					) {
						const demoAnswer = value.answer;
						if (demoAnswer) {
							demoData.gender = (demoAnswer.gender as string) ?? 'Not specified';
							demoData.age = (demoAnswer.age as string) ?? 'Not specified';
							demoData.education = (demoAnswer.education as string) ?? 'Not specified';
							demoData.gender_other = (demoAnswer['gender-other'] as string) ?? '';
							demoData.education_other = (demoAnswer['education-other'] as string) ?? '';
						}
					} else if (key.toLowerCase().includes('attention-check-')) {
						const acMatch = key.match(/attention-check-(\d+)_(\d+)/);
						if (acMatch) {
							const acNumber = parseInt(acMatch[1]);
							const acAnswer = value.answer;
							const acCorrectAnswerList = value.correctAnswer;

							let participantAnswer: string | null = null;
							let correctAnswer: string | null = null;
							const questionId = `attention-check${acNumber}`;

							if (acAnswer && questionId in acAnswer) {
								participantAnswer = acAnswer[questionId] as string;
							}

							if (acCorrectAnswerList) {
								for (const ca of acCorrectAnswerList) {
									if (ca.id === questionId) {
										correctAnswer = ca.answer;
										break;
									}
								}
							}

							const isCorrect = participantAnswer !== null && participantAnswer === correctAnswer;
							const questionPrompt = getAttentionCheckQuestion(acNumber);

							attentionChecks.push({
								number: acNumber,
								question: questionPrompt,
								participant_answer: participantAnswer ?? 'No answer',
								correct_answer: correctAnswer,
								is_correct: isCorrect
							});
						}
					}
				}

				attentionChecks.sort((a, b) => a.number - b.number);
				attentionChecksByParticipant[pid] = attentionChecks;
				demographicsList.push(demoData);
				seenParticipants.add(pid);
			}

			// Extract scatterplot trials
			for (const [key, value] of Object.entries(answers)) {
				if (!key.toLowerCase().includes('scatterplot')) continue;

				const idMatch = key.match(/scatterplot(-(samecolor|largediff))?-\d+_(\d+)/);
				if (!idMatch) continue;

				const trialType = (idMatch[2] as 'samecolor' | 'largediff') ?? 'standard';
				const trialOrder = parseInt(idMatch[3]);

				const vegaPath = value.parameters?.vegaSpecPath ?? '';
				const vegaMatch = vegaPath.match(/scatterplot_(\d+)\.json/);

				if (!vegaMatch) continue;

				const scatterIndex = parseInt(vegaMatch[1]);

				const answerValue = value.answer['scatterplot-response'];
				const answer = typeof answerValue === 'string' ? answerValue : null;

				const correctAnswerList = value.correctAnswer;
				const correctAnswer = correctAnswerList?.[0]?.answer ?? null;

				const startTime = value.startTime ?? 0;
				const endTime = value.endTime ?? -1;
				const rtMs = endTime > startTime ? endTime - startTime : null;

				allResponses.push({
					participantId: pid,
					condition,
					completed,
					stimulus_id: key,
					scatter_index: scatterIndex,
					trial_order: trialOrder,
					trial_type: trialType,
					answer: answer ? answer.trim().charAt(0).toUpperCase() + answer.trim().slice(1).toLowerCase() : null,
					correct_answer: correctAnswer,
					start_time_ms: startTime,
					end_time_ms: endTime,
					rt_ms: rtMs,
					vega_spec_path: vegaPath
				});
			}
		}
	}

	return {
		metadata,
		responses: allResponses,
		demographics: demographicsList,
		attentionChecks: attentionChecksByParticipant,
		experimentInfo: experimentInfoByParticipant
	};
}

/**
 * Join participant responses with ground-truth scatterplot metadata.
 */
export function buildTrialDataframe(
	responses: TrialResponse[],
	metadata: MetadataFile
): TrialDetails[] {
	const metadataMap = new Map<string, ScatterplotMetadata>();

	for (const item of metadata.scatterplots) {
		// Key for standard trials: index + axis
		metadataMap.set(`${item.index}-${item.axis}`, item);
		// Key for special trials: just index (they can match any axis in metadata)
		if (!metadataMap.has(`${item.index}`)) {
			metadataMap.set(`${item.index}`, item);
		}
	}

	const trials: TrialDetails[] = [];

	for (const response of responses) {
		let meta: ScatterplotMetadata | undefined;

		if (response.trial_type === 'standard') {
			meta = metadataMap.get(`${response.scatter_index}-${response.condition}`);
		} else {
			meta = metadataMap.get(`${response.scatter_index}`);
		}

		const reportedDiff = response.answer === 'Different';
		const reportedSame = response.answer === 'Same';
		const deltaE = meta?.delta_e ?? 0;
		const isDiffTrial = deltaE !== 0;
		const isSameTrial = deltaE === 0;
		const correct = (isDiffTrial && reportedDiff) || (isSameTrial && reportedSame);
		const isCorrect = response.answer === response.correct_answer;

		trials.push({
			...response,
			axis: meta?.axis,
			diff_type: meta?.diff_type,
			delta_e: deltaE,
			point_diameter_degrees: meta?.point_diameter_degrees,
			reported_diff: reportedDiff,
			reported_same: reportedSame,
			is_diff_trial: isDiffTrial,
			is_same_trial: isSameTrial,
			correct,
			is_correct: isCorrect
		});
	}

	return trials;
}

/**
 * Process trials and build participant summary (no exclusion applied).
 */
export function applyExclusion(
	trials: TrialDetails[]
): {
	filtered: TrialDetails[];
	summary: ParticipantSummary[];
} {
	// Calculate wrong same trials per participant
	const wrongSameByParticipant = new Map<string, number>();
	const meanRtByParticipant = new Map<string, number>();

	// Group trials by participant
	const trialsByParticipant = new Map<string, TrialDetails[]>();
	for (const trial of trials) {
		const pid = trial.participantId;
		if (!trialsByParticipant.has(pid)) {
			trialsByParticipant.set(pid, []);
		}
		trialsByParticipant.get(pid)!.push(trial);
	}

	// Calculate metrics per participant using ONLY the special trials (samecolor + largediff)
	// for exclusion criteria
	for (const [pid, participantTrials] of trialsByParticipant) {
		// Get the special exclusion trials (samecolor and largediff)
		const exclusionTrials = participantTrials.filter(
			(t) => t.trial_type === 'samecolor' || t.trial_type === 'largediff'
		);
		
		// Wrong same trials - count from samecolor trials only (they have delta_e === 0)
		const sameColorTrials = exclusionTrials.filter((t) => t.trial_type === 'samecolor');
		const wrongSame = sameColorTrials.filter((t) => !t.correct).length;
		wrongSameByParticipant.set(pid, wrongSame);

		// Also check large diff trials - if participant got these wrong, it indicates lack of engagement
		const largeDiffTrials = exclusionTrials.filter((t) => t.trial_type === 'largediff');
		const wrongLargeDiff = largeDiffTrials.filter((t) => !t.correct).length;
		
		// Update wrong same count to include wrong large diff trials
		// (both indicate engagement issues)
		wrongSameByParticipant.set(pid, wrongSame + wrongLargeDiff);

		// Mean RT - calculated on ALL trials (standard + special) for RT-based exclusion
		const rtValues = participantTrials.filter((t) => t.rt_ms !== null).map((t) => t.rt_ms!);
		const meanRt = rtValues.length > 0 ? rtValues.reduce((a, b) => a + b, 0) / rtValues.length : NaN;
		meanRtByParticipant.set(pid, meanRt);
	}

	// Add metrics to trials (no exclusion criteria applied)
	const updatedTrials: TrialDetails[] = trials.map((trial) => {
		const nWrongSame = wrongSameByParticipant.get(trial.participantId) ?? 0;
		const meanRtMs = meanRtByParticipant.get(trial.participantId) ?? NaN;

		return {
			...trial,
			n_wrong_same: nWrongSame,
			mean_rt_ms: isNaN(meanRtMs) ? undefined : meanRtMs,
			exclude_engagement: false,
			exclude_rt: false,
			excluded: false
		};
	});

	// Build participant summary
	const summaryMap = new Map<string, ParticipantSummary>();

	for (const trial of updatedTrials) {
		const key = `${trial.participantId}-${trial.condition}`;

		if (!summaryMap.has(key)) {
			summaryMap.set(key, {
				participantId: trial.participantId,
				condition: trial.condition,
				n_trials: 0,
				n_diff_trials: 0,
				n_same_trials: 0,
				n_wrong_same: trial.n_wrong_same ?? 0,
				mean_rt_ms: trial.mean_rt_ms ?? null,
				excluded: trial.excluded ?? false
			});
		}

		const summary = summaryMap.get(key)!;
		summary.n_trials++;
		if (trial.is_diff_trial) summary.n_diff_trials++;
		if (trial.is_same_trial) summary.n_same_trials++;
	}

	// Filter for analysis:
	// Exclude the 7 special trials (samecolor + largediff) - use only standard trials for analysis
	const filtered = updatedTrials.filter(
		(t) => t.trial_type === 'standard'
	);

	return {
		filtered,
		summary: Array.from(summaryMap.values())
	};
}

/**
 * Generate summary statistics for a participant.
 */
export function generateParticipantSummary(participantData: TrialDetails[]): {
	total_trials: number;
	answered_trials: number;
	completed: boolean;
	condition: string;
	accuracy: number;
	mean_rt_ms: number;
	median_rt_ms: number;
	small_diff_accuracy: number;
	large_diff_accuracy: number;
	no_diff_accuracy: number;
	n_small_diff: number;
	n_large_diff: number;
	n_no_diff: number;
} {
	const totalTrials = participantData.length;
	const answeredTrials = participantData.filter((t) => t.answer !== null).length;
	const completed = participantData.length > 0 ? participantData[0].completed : false;
	const condition = participantData.length > 0 ? participantData[0].condition : 'Unknown';

	const answeredData = participantData.filter((t) => t.answer !== null);
	const accuracy = answeredData.length > 0 ? answeredData.filter((t) => t.is_correct).length / answeredData.length : 0;

	const rtData = participantData.filter((t) => t.rt_ms !== null).map((t) => t.rt_ms!);
	const meanRt = rtData.length > 0 ? rtData.reduce((a, b) => a + b, 0) / rtData.length : 0;
	const sortedRt = [...rtData].sort((a, b) => a - b);
	const medianRt =
		sortedRt.length > 0
			? sortedRt.length % 2 === 0
				? (sortedRt[sortedRt.length / 2 - 1] + sortedRt[sortedRt.length / 2]) / 2
				: sortedRt[Math.floor(sortedRt.length / 2)]
			: 0;

	const smallDiffTrials = answeredData.filter((t) => t.diff_type === 'small');
	const largeDiffTrials = answeredData.filter((t) => t.diff_type === 'large');
	const noDiffTrials = answeredData.filter((t) => t.diff_type === 'none');

	const smallAccuracy =
		smallDiffTrials.length > 0
			? smallDiffTrials.filter((t) => t.is_correct).length / smallDiffTrials.length
			: 0;
	const largeAccuracy =
		largeDiffTrials.length > 0
			? largeDiffTrials.filter((t) => t.is_correct).length / largeDiffTrials.length
			: 0;
	const noDiffAccuracy =
		noDiffTrials.length > 0
			? noDiffTrials.filter((t) => t.is_correct).length / noDiffTrials.length
			: 0;

	return {
		total_trials: totalTrials,
		answered_trials: answeredTrials,
		completed,
		condition,
		accuracy,
		mean_rt_ms: meanRt,
		median_rt_ms: medianRt,
		small_diff_accuracy: smallAccuracy,
		large_diff_accuracy: largeAccuracy,
		no_diff_accuracy: noDiffAccuracy,
		n_small_diff: smallDiffTrials.length,
		n_large_diff: largeDiffTrials.length,
		n_no_diff: noDiffTrials.length
	};
}

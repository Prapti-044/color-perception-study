// Type definitions for the Colormap Makeup Study Analysis

export interface ScatterplotMetadata {
	axis: 'L' | 'a' | 'b';
	diff_type: 'small' | 'large' | 'none';
	delta_e: number;
	point_radius_pixels: number;
	point_diameter_degrees: number;
	point_area_pixels: number;
	plot_width: number;
	plot_height: number;
	target_color1_hex: string;
	target_color2_hex: string;
	target_color1_lab: { L: number; a: number; b: number };
	target_color2_lab: { L: number; a: number; b: number };
	distractor_color_hex: string;
	target_positions: Array<{ x: number; y: number }>;
	target_separation_pixels: number;
	n_distractors: number;
	n_total_points: number;
	ppi: number;
	viewing_distance_inches: number;
	filename: string;
	filepath: string;
	output_directory: string;
	index: number;
}

export interface MetadataFile {
	generated_date: string;
	total_scatterplots: number;
	scatterplots: ScatterplotMetadata[];
}

export interface ParticipantAnswer {
	answer: Record<string, unknown>;
	identifier: string;
	trialOrder: string;
	componentName: string;
	incorrectAnswers: Record<string, unknown>;
	startTime: number;
	endTime: number;
	parameters?: {
		vegaSpecPath?: string;
	};
	correctAnswer?: Array<{
		id: string;
		answer: string;
	}>;
}

export interface ParticipantMetadata {
	userAgent?: string;
	language?: string;
	resolution?: {
		width: number;
		height: number;
		colorDepth: number;
		orientation?: string;
	};
}

export interface ParticipantData {
	participantId: string;
	participantConfigHash: string;
	sequence: unknown;
	stage?: string;
	rejected?: boolean;
	completed?: boolean;
	participantTags?: string[];
	metadata?: ParticipantMetadata;
	searchParams?: {
		STUDY_ID?: string;
		SESSION_ID?: string;
	};
	answers?: Record<string, ParticipantAnswer>;
}

export interface Demographics {
	participantId: string;
	gender: string;
	age: string;
	education: string;
	gender_other: string;
	education_other: string;
	strategies: string;
	color_hobby: string;
	color_theory_class: string;
	color_theory_knowledge: string;
	color_theory_knowledge_2: string;
	makeup_familiarity: string;
	use_makeup: string;
	foundation_shade: string;
	makeup_products: string;
}

export interface AttentionCheck {
	number: number;
	question: string;
	participant_answer: string;
	correct_answer: string | null;
	is_correct: boolean;
}

export interface ColorBlindnessResult {
	plate: string;
	answer: string;
	correct: string | null;
	is_correct: boolean;
}

export interface ExperimentInfo {
	browser: string;
	language: string;
	screen_width: number | null;
	screen_height: number | null;
	color_depth: number | null;
	orientation: string;
	duration_minutes: number | null;
	start_timestamp: number | null;
	stage: string;
	rejected: boolean;
	participant_tags: string[];
	prolific_study_id: string;
	prolific_session_id: string;
	color_blindness_passed: number;
	color_blindness_total: number;
	color_blindness_results: ColorBlindnessResult[];
}

export interface TrialResponse {
	participantId: string;
	condition: 'L' | 'a' | 'b';
	completed: boolean;
	stimulus_id: string;
	scatter_index: number;
	trial_order: number;
	trial_type: 'standard' | 'samecolor' | 'largediff';
	answer: string | null;
	correct_answer: string | null;
	start_time_ms: number;
	end_time_ms: number;
	rt_ms: number | null;
	vega_spec_path: string;
}

export interface TrialDetails extends TrialResponse {
	// Merged from metadata
	axis?: 'L' | 'a' | 'b';
	diff_type?: string;
	delta_e?: number;
	point_diameter_degrees?: number;
	// Computed
	reported_diff: boolean;
	reported_same: boolean;
	is_diff_trial: boolean;
	is_same_trial: boolean;
	correct: boolean;
	is_correct: boolean;
	// Exclusion fields
	n_wrong_same?: number;
	mean_rt_ms?: number;
	exclude_engagement?: boolean;
	exclude_rt?: boolean;
	excluded?: boolean;
}

export interface ParticipantSummary {
	participantId: string;
	condition: string;
	n_trials: number;
	n_diff_trials: number;
	n_same_trials: number;
	n_wrong_same: number;
	mean_rt_ms: number | null;
	excluded: boolean;
}

export interface DiscriminabilityRow {
	axis: string;
	size_deg: number;
	delta_e: number;
	p: number;
	n_trials: number;
	n_participants: number;
}

export interface RegressionRow {
	axis: string;
	size_deg: number;
	slope: number;
	slope_se: number;
	r2: number;
	ND50: number;
	ND50_se: number;
}

export interface InverseModelRow {
	axis: string;
	c_x: number;
	k_x: number;
	R2: number;
}

export interface NDLinearFitRow {
	axis: string;
	A: number; // intercept (asymptotic ND as s → ∞)
	B: number; // coefficient of 1/s
	A_se: number; // standard error of A
	B_se: number; // standard error of B
	R2: number;
	n_points: number;
	sizes: number[];
	nd_values: number[];
	nd_se_values: number[];
}

export interface RegressionComparison {
	axis: string;
	size_deg: number;
	current_slope: number;
	ref_slope: number;
	slope_diff: number;
	slope_pct_diff: number;
	current_r2: number;
	ref_r2: number;
	r2_diff: number;
	current_nd50: number;
	ref_nd50: number;
	nd50_diff: number;
	ref_size_matched: number;
}

export interface InverseModelComparison {
	axis: string;
	current_c: number;
	ref_c: number;
	c_diff: number;
	current_k: number;
	ref_k: number;
	k_diff: number;
	current_r2: number;
	ref_r2: number;
	r2_diff: number;
}

export interface ParticipantReportSummary {
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
}

export interface AnalysisResult {
	metadata: MetadataFile;
	demographics: Demographics[];
	attentionChecks: Record<string, AttentionCheck[]>;
	experimentInfo: Record<string, ExperimentInfo>;
	trialDetails: TrialDetails[];
	participantSummary: ParticipantSummary[];
	discriminability: DiscriminabilityRow[];
	regression: RegressionRow[];
	inverseModel: InverseModelRow[];
	regressionComparison: RegressionComparison[];
	inverseModelComparison: InverseModelComparison[];
}


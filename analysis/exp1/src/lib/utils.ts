// Utility functions
import LZString from 'lz-string';
import type {
	Demographics,
	ExpertClauseGroupNode,
	ExpertClauseGroupOperator,
	ExpertClauseNode,
	ExpertClausePredicateNode,
	ExpertPredicateDefinition,
	ExpertPredicateField,
	ExpertPredicateOperator,
	ExpertiseGroup,
	SerializedExpertClauseGroupNode,
	SerializedExpertClauseNode,
	SerializedExpertClausePredicateNode
} from './types';

// Cache for vega specs
const vegaSpecCache = new Map<string, object>();

/**
 * Create a Vega Editor URL from a Vega-Lite spec.
 */
export function createVegaEditorUrl(spec: object): string {
	const specJson = JSON.stringify(spec);
	const compressed = LZString.compressToEncodedURIComponent(specJson);
	return `https://vega.github.io/editor/#/url/vega-lite/${compressed}`;
}

/**
 * Load a Vega spec from the given path.
 */
async function loadVegaSpec(vegaSpecPath: string): Promise<object | null> {
	// Convert path to static URL
	let path = vegaSpecPath;
	if (path.startsWith('/')) {
		path = path.slice(1);
	}

	// The vega specs are in the main public folder, not the report-app static folder
	// We'll need to fetch from the parent public directory
	// For now, return null since we don't have access to vega specs in report-app
	// In production, these would need to be copied or the path adjusted

	try {
		// Try fetching from relative path (assuming vega specs might be available)
		const response = await fetch(`/${path}`);
		if (response.ok) {
			return response.json();
		}
	} catch {
		// Spec not available
	}

	return null;
}

/**
 * Get the Vega Editor URL for a given spec path, using caching.
 */
export async function getVegaEditorUrlForPath(vegaSpecPath: string): Promise<string | null> {
	if (!vegaSpecPath) return null;

	if (vegaSpecCache.has(vegaSpecPath)) {
		return createVegaEditorUrl(vegaSpecCache.get(vegaSpecPath)!);
	}

	const spec = await loadVegaSpec(vegaSpecPath);
	if (spec) {
		vegaSpecCache.set(vegaSpecPath, spec);
		return createVegaEditorUrl(spec);
	}

	return null;
}

/**
 * Format a number with specified decimal places.
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2, signed: boolean = false): string {
	if (value === null || value === undefined || isNaN(value)) {
		return 'N/A';
	}
	const formatted = value.toFixed(decimals);
	if (signed && value > 0) {
		return `+${formatted}`;
	}
	return formatted;
}

/** Display label for a CIELAB axis in plots (L → L*, a → a*, b → b*). */
export function formatLabAxis(axis: string): string {
	return `${axis}*`;
}

/**
 * Format a percentage.
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
	if (value === null || value === undefined || isNaN(value)) {
		return 'N/A';
	}
	return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a timestamp to a readable date string.
 */
export function formatTimestamp(timestamp: number | null | undefined): string {
	if (!timestamp) return 'N/A';
	return new Date(timestamp).toLocaleString();
}

/**
 * Format duration in minutes.
 */
export function formatDuration(minutes: number | null | undefined): string {
	if (minutes === null || minutes === undefined || isNaN(minutes)) {
		return 'N/A';
	}
	return `${minutes.toFixed(1)} min`;
}

/**
 * Truncate a participant ID for display.
 */
export function truncateId(id: string, length: number = 16): string {
	if (id.length <= length) return id;
	return `${id.slice(0, length)}...`;
}

/**
 * Get badge class based on attention check performance.
 */
export function getAttentionBadgeClass(correct: number, total: number): string {
	if (total === 0) return 'bg-yellow-100 text-yellow-800';
	if (correct === total) return 'bg-green-100 text-green-800';
	if (correct >= total * 0.7) return 'bg-yellow-100 text-yellow-800';
	return 'bg-red-100 text-red-800';
}

/**
 * Get badge class based on exclusion status.
 */
export function getStatusBadgeClass(excluded: boolean): string {
	return excluded ? 'bg-red-500 text-white' : 'bg-green-100 text-green-800';
}

/**
 * Count occurrences of values in an array.
 */
export function countValues<T>(arr: T[]): Map<T, number> {
	const counts = new Map<T, number>();
	for (const item of arr) {
		counts.set(item, (counts.get(item) ?? 0) + 1);
	}
	return counts;
}

/**
 * Group an array by a key function.
 */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of arr) {
		const key = keyFn(item);
		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)!.push(item);
	}
	return groups;
}

/**
 * Custom axis order: L first, then a, then b
 */
const AXIS_ORDER: Record<string, number> = { L: 0, a: 1, b: 2 };

/**
 * Compare function for sorting by axis (L, a, b order) then by size.
 */
export function compareByAxisAndSize<T extends { axis?: string; size_deg?: number }>(
	a: T,
	b: T
): number {
	const axisA = a.axis ?? '';
	const axisB = b.axis ?? '';
	const orderA = AXIS_ORDER[axisA] ?? 99;
	const orderB = AXIS_ORDER[axisB] ?? 99;

	if (orderA !== orderB) return orderA - orderB;
	return (a.size_deg ?? 0) - (b.size_deg ?? 0);
}

/**
 * Compare function for sorting by axis (L, a, b order), size, then delta_e.
 */
export function compareByAxisSizeDeltaE<
	T extends { axis?: string; size_deg?: number; delta_e?: number }
>(a: T, b: T): number {
	const axisA = a.axis ?? '';
	const axisB = b.axis ?? '';
	const orderA = AXIS_ORDER[axisA] ?? 99;
	const orderB = AXIS_ORDER[axisB] ?? 99;

	if (orderA !== orderB) return orderA - orderB;
	if ((a.size_deg ?? 0) !== (b.size_deg ?? 0)) return (a.size_deg ?? 0) - (b.size_deg ?? 0);
	return (a.delta_e ?? 0) - (b.delta_e ?? 0);
}

type ExpertiseDemographics = Pick<
	Demographics,
	| 'makeup_familiarity'
	| 'use_makeup'
	| 'makeup_products'
	| 'color_hobby'
	| 'color_theory_class'
>;

const EMPTY_EXPERT_RESPONSES = new Set(['', 'Not specified']);
const MAKEUP_PRODUCTS_NONE_VALUE = 'None';
const COLOR_HOBBY_NONE_VALUE = "I don't participate in any of the above";

const MAKEUP_FAMILIARITY_OPTIONS = ['Yes', 'No'] as const;
const USE_MAKEUP_OPTIONS = [
	'I do not use makeup',
	'I use it occasionally',
	'I use it regularly',
	'I use it professionally'
] as const;
const REGULAR_OR_PROFESSIONAL_MAKEUP_USE_OPTIONS = new Set<string>([
	'I use it regularly',
	'I use it professionally'
]);
const NONE_OR_OCCASIONAL_MAKEUP_USE_OPTIONS = new Set<string>([
	'I do not use makeup',
	'I use it occasionally'
]);
const MAKEUP_PRODUCT_OPTIONS = [
	'Foundation',
	'Concealer',
	'Blush',
	'Bronzer',
	'Eyeshadow',
	'Eyeliner',
	'Mascara',
	'Lipstick',
	'Lip Gloss',
	'Setting Powder',
	'None'
] as const;
const COLOR_HOBBY_OPTIONS = [
	'Painting',
	'Drawing',
	'Graphic Design',
	'Photography',
	"I don't participate in any of the above"
] as const;
const COLOR_THEORY_CLASS_OPTIONS = ['Yes', 'No'] as const;

export const EXPERT_CLAUSE_QUERY_PARAM = 'expertClause';
export const EXPERT_CLAUSE_STORAGE_KEY = 'exp1-expert-clause';

function createExpertNodeId(): string {
	return `expert-clause-${Math.random().toString(36).slice(2, 10)}`;
}

function predicateDefinitionKey(
	field: ExpertPredicateField,
	operator: ExpertPredicateOperator,
	value?: string
): string {
	return `${field}::${operator}::${value ?? ''}`;
}

function checkboxNoneValue(field: ExpertPredicateField): string | null {
	if (field === 'makeup_products') return MAKEUP_PRODUCTS_NONE_VALUE;
	if (field === 'color_hobby') return COLOR_HOBBY_NONE_VALUE;
	return null;
}

function fieldLabel(field: ExpertPredicateField): string {
	switch (field) {
		case 'makeup_familiarity':
			return 'makeup familiarity';
		case 'use_makeup':
			return 'use makeup';
		case 'makeup_products':
			return 'makeup products';
		case 'color_hobby':
			return 'color hobby';
		case 'color_theory_class':
			return 'color theory class';
	}
}

function createPredicateDefinition(
	id: string,
	category: string,
	label: string,
	field: ExpertPredicateField,
	operator: ExpertPredicateOperator,
	value?: string
): ExpertPredicateDefinition {
	return {
		id,
		category,
		label,
		predicate: { field, operator, value }
	};
}

export const EXPERT_PREDICATE_DEFINITIONS: ExpertPredicateDefinition[] = [
	...MAKEUP_FAMILIARITY_OPTIONS.map((value) =>
		createPredicateDefinition(
			`makeup-familiarity-${value.toLowerCase()}`,
			'Makeup Familiarity',
			`makeup familiarity = ${value}`,
			'makeup_familiarity',
			'equals',
			value
		)
	),
	...USE_MAKEUP_OPTIONS.map((value) =>
		createPredicateDefinition(
			`use-makeup-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
			'Use Makeup',
			`use makeup = ${value}`,
			'use_makeup',
			'equals',
			value
		)
	),
	...MAKEUP_PRODUCT_OPTIONS.map((value) =>
		createPredicateDefinition(
			`makeup-products-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
			'Makeup Products',
			`makeup products contains ${value}`,
			'makeup_products',
			'contains',
			value
		)
	),
	createPredicateDefinition(
		'makeup-products-any-non-none',
		'Makeup Products',
		'makeup products contains any non-None option',
		'makeup_products',
		'contains_any_non_none'
	),
	...COLOR_HOBBY_OPTIONS.map((value) =>
		createPredicateDefinition(
			`color-hobby-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
			'Color Hobby',
			`color hobby contains ${value}`,
			'color_hobby',
			'contains',
			value
		)
	),
	createPredicateDefinition(
		'color-hobby-any-non-none',
		'Color Hobby',
		'color hobby contains any non-none option',
		'color_hobby',
		'contains_any_non_none'
	),
	...COLOR_THEORY_CLASS_OPTIONS.map((value) =>
		createPredicateDefinition(
			`color-theory-class-${value.toLowerCase()}`,
			'Color Theory Class',
			`color theory class = ${value}`,
			'color_theory_class',
			'equals',
			value
		)
	)
];

const EXPERT_PREDICATE_DEFINITION_LOOKUP = new Map(
	EXPERT_PREDICATE_DEFINITIONS.map((definition) => [
		predicateDefinitionKey(
			definition.predicate.field,
			definition.predicate.operator,
			definition.predicate.value
		),
		definition
	])
);

/**
 * Parse a comma-separated checkbox answer into individual selections.
 */
function parseCheckboxSelections(value: string): string[] {
	if (!value) return [];

	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0 && entry !== 'Not specified');
}

/**
 * Create a runtime group node.
 */
export function createExpertClauseGroupNode(
	operator: ExpertClauseGroupOperator = 'OR',
	children: ExpertClauseNode[] = []
): ExpertClauseGroupNode {
	return {
		id: createExpertNodeId(),
		type: 'group',
		operator,
		children
	};
}

/**
 * Create a runtime predicate node.
 */
export function createExpertClausePredicateNode(
	predicate:
		| Omit<ExpertClausePredicateNode, 'id' | 'type'>
		| ExpertPredicateDefinition
): ExpertClausePredicateNode {
	const source = 'predicate' in predicate ? predicate.predicate : predicate;
	return {
		id: createExpertNodeId(),
		type: 'predicate',
		field: source.field,
		operator: source.operator,
		value: source.value
	};
}

/**
 * Default expert clause matching the original full rule.
 */
export function getDefaultExpertClause(): ExpertClauseGroupNode {
	return createExpertClauseGroupNode('OR', [
		createExpertClauseGroupNode('OR', [
			createExpertClausePredicateNode({
				field: 'use_makeup',
				operator: 'equals',
				value: 'I use it regularly'
			}),
			createExpertClausePredicateNode({
				field: 'use_makeup',
				operator: 'equals',
				value: 'I use it professionally'
			})
		]),
		createExpertClausePredicateNode({
			field: 'color_theory_class',
			operator: 'equals',
			value: 'Yes'
		}),
		createExpertClausePredicateNode({
			field: 'color_hobby',
			operator: 'contains_any_non_none'
		})
	]);
}

/**
 * Get the label for a supported expert predicate.
 */
export function getExpertPredicateLabel(predicate: Omit<ExpertClausePredicateNode, 'id' | 'type'>): string {
	const definition = EXPERT_PREDICATE_DEFINITION_LOOKUP.get(
		predicateDefinitionKey(predicate.field, predicate.operator, predicate.value)
	);

	if (definition) {
		return definition.label;
	}

	if (predicate.operator === 'contains_any_non_none') {
		return `${fieldLabel(predicate.field)} contains any non-none option`;
	}

	if (predicate.operator === 'contains') {
		return `${fieldLabel(predicate.field)} contains ${predicate.value ?? 'unknown'}`;
	}

	return `${fieldLabel(predicate.field)} = ${predicate.value ?? 'unknown'}`;
}

/**
 * Build a human-readable summary for the active expert clause.
 */
export function getExpertClauseSummary(node: ExpertClauseNode, isRoot: boolean = true): string {
	if (node.type === 'predicate') {
		return getExpertPredicateLabel(node);
	}

	if (node.children.length === 0) {
		return isRoot ? '(empty expert clause)' : '(empty group)';
	}

	const summary = node.children
		.map((child) => getExpertClauseSummary(child, false))
		.join(` ${node.operator} `);

	return isRoot ? summary : `(${summary})`;
}

function getDemographicValue(
	demographics: ExpertiseDemographics,
	field: ExpertPredicateField
): string {
	return (demographics[field] ?? '').trim();
}

function matchesExpertPredicate(
	predicate: ExpertClausePredicateNode,
	demographics: ExpertiseDemographics
): boolean {
	const rawValue = getDemographicValue(demographics, predicate.field);
	if (EMPTY_EXPERT_RESPONSES.has(rawValue)) {
		return false;
	}

	if (predicate.operator === 'equals') {
		return rawValue === predicate.value;
	}

	const selections = parseCheckboxSelections(rawValue);
	if (selections.length === 0) {
		return false;
	}

	if (predicate.operator === 'contains') {
		return predicate.value !== undefined && selections.includes(predicate.value);
	}

	const noneValue = checkboxNoneValue(predicate.field);
	return noneValue !== null && selections.some((selection) => selection !== noneValue);
}

/**
 * Evaluate an expert clause against one participant's demographics.
 */
export function evaluateExpertClause(
	node: ExpertClauseNode,
	demographics: ExpertiseDemographics
): boolean {
	if (node.type === 'predicate') {
		return matchesExpertPredicate(node, demographics);
	}

	if (node.children.length === 0) {
		return false;
	}

	if (node.operator === 'AND') {
		return node.children.every((child) => evaluateExpertClause(child, demographics));
	}

	return node.children.some((child) => evaluateExpertClause(child, demographics));
}

/**
 * Group participant IDs using the active expert clause.
 */
export function getParticipantsByExpertClause(
	demographics: Demographics[],
	clause: ExpertClauseNode
): { colorExpert: Set<string>; nonExpert: Set<string> } {
	const colorExpert = new Set<string>();
	const nonExpert = new Set<string>();

	for (const demo of demographics) {
		if (evaluateExpertClause(clause, demo)) {
			colorExpert.add(demo.participantId);
		} else {
			nonExpert.add(demo.participantId);
		}
	}

	return { colorExpert, nonExpert };
}

/**
 * Group participant IDs by makeup-use frequency for the fixed makeup-use t-test.
 */
export function getParticipantsByMakeupUse(demographics: Demographics[]): {
	regularOrProfessional: Set<string>;
	noneOrOccasional: Set<string>;
	unclassified: Set<string>;
} {
	const regularOrProfessional = new Set<string>();
	const noneOrOccasional = new Set<string>();
	const unclassified = new Set<string>();

	for (const demo of demographics) {
		const useMakeup = demo.use_makeup.trim();

		if (REGULAR_OR_PROFESSIONAL_MAKEUP_USE_OPTIONS.has(useMakeup)) {
			regularOrProfessional.add(demo.participantId);
		} else if (NONE_OR_OCCASIONAL_MAKEUP_USE_OPTIONS.has(useMakeup)) {
			noneOrOccasional.add(demo.participantId);
		} else {
			unclassified.add(demo.participantId);
		}
	}

	return { regularOrProfessional, noneOrOccasional, unclassified };
}

/**
 * Group participant IDs by the fixed trained/untrained criteria.
 */
export function getParticipantsByTrainingExposure(demographics: Demographics[]): {
	trained: Set<string>;
	untrained: Set<string>;
	unclassified: Set<string>;
} {
	const trained = new Set<string>();
	const untrained = new Set<string>();
	const unclassified = new Set<string>();

	for (const demo of demographics) {
		const useMakeup = demo.use_makeup.trim();
		const colorTheoryClass = demo.color_theory_class.trim();
		const colorHobbies = parseCheckboxSelections(demo.color_hobby);
		const hasColorHobby = colorHobbies.some((selection) => selection !== COLOR_HOBBY_NONE_VALUE);
		const hasTraining =
			REGULAR_OR_PROFESSIONAL_MAKEUP_USE_OPTIONS.has(useMakeup)
			|| colorTheoryClass === 'Yes'
			|| hasColorHobby;
		const hasExplicitNoTraining =
			NONE_OR_OCCASIONAL_MAKEUP_USE_OPTIONS.has(useMakeup)
			&& colorTheoryClass === 'No'
			&& colorHobbies.includes(COLOR_HOBBY_NONE_VALUE)
			&& !hasColorHobby;

		if (hasTraining) {
			trained.add(demo.participantId);
		} else if (hasExplicitNoTraining) {
			untrained.add(demo.participantId);
		} else {
			unclassified.add(demo.participantId);
		}
	}

	return { trained, untrained, unclassified };
}

function isValidPredicateOperatorForField(
	field: ExpertPredicateField,
	operator: ExpertPredicateOperator
): boolean {
	switch (field) {
		case 'makeup_familiarity':
		case 'use_makeup':
		case 'color_theory_class':
			return operator === 'equals';
		case 'makeup_products':
		case 'color_hobby':
			return operator === 'contains' || operator === 'contains_any_non_none';
	}
}

function isSerializedPredicateNode(value: unknown): value is SerializedExpertClausePredicateNode {
	if (!value || typeof value !== 'object') return false;

	const node = value as Record<string, unknown>;
	if (node.type !== 'predicate') return false;
	if (
		typeof node.field !== 'string' ||
		typeof node.operator !== 'string' ||
		!isValidPredicateOperatorForField(node.field as ExpertPredicateField, node.operator as ExpertPredicateOperator)
	) {
		return false;
	}

	if (node.operator === 'contains_any_non_none') {
		return node.value === undefined;
	}

	return (
		typeof node.value === 'string' &&
		EXPERT_PREDICATE_DEFINITION_LOOKUP.has(
			predicateDefinitionKey(
				node.field as ExpertPredicateField,
				node.operator as ExpertPredicateOperator,
				node.value
			)
		)
	);
}

function isSerializedGroupNode(value: unknown): value is SerializedExpertClauseGroupNode {
	if (!value || typeof value !== 'object') return false;

	const node = value as Record<string, unknown>;
	return (
		node.type === 'group' &&
		(node.operator === 'AND' || node.operator === 'OR') &&
		Array.isArray(node.children) &&
		node.children.every((child) => isSerializedExpertClauseNode(child))
	);
}

function isSerializedExpertClauseNode(value: unknown): value is SerializedExpertClauseNode {
	return isSerializedPredicateNode(value) || isSerializedGroupNode(value);
}

function deserializeExpertClauseNode(node: SerializedExpertClauseNode): ExpertClauseNode {
	if (node.type === 'predicate') {
		return createExpertClausePredicateNode(node);
	}

	return createExpertClauseGroupNode(
		node.operator,
		node.children.map((child) => deserializeExpertClauseNode(child))
	);
}

function serializeExpertClauseNode(node: ExpertClauseNode): SerializedExpertClauseNode {
	if (node.type === 'predicate') {
		return {
			type: 'predicate',
			field: node.field,
			operator: node.operator,
			...(node.value !== undefined ? { value: node.value } : {})
		};
	}

	return {
		type: 'group',
		operator: node.operator,
		children: node.children.map((child) => serializeExpertClauseNode(child))
	};
}

/**
 * Serialize an expert clause for URL/local persistence.
 */
export function serializeExpertClause(clause: ExpertClauseNode): string {
	return JSON.stringify(serializeExpertClauseNode(clause));
}

/**
 * Deserialize a persisted expert clause. Returns null if invalid.
 */
export function deserializeExpertClause(serialized: string | null | undefined): ExpertClauseGroupNode | null {
	if (!serialized) {
		return null;
	}

	try {
		const parsed = JSON.parse(serialized) as unknown;
		if (!isSerializedGroupNode(parsed)) {
			return null;
		}
		return deserializeExpertClauseNode(parsed) as ExpertClauseGroupNode;
	} catch {
		return null;
	}
}

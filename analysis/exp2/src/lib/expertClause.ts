export interface ExpertDemographics {
	participantId: string;
	color_hobby: string;
	color_theory_class: string;
	makeup_familiarity: string;
	makeup_products: string;
	use_makeup: string;
}

export type ExpertiseGroup = 'colorExpert' | 'nonExpert';

export type ExpertClauseGroupOperator = 'AND' | 'OR';

export type ExpertPredicateField =
	| 'makeup_familiarity'
	| 'use_makeup'
	| 'makeup_products'
	| 'color_hobby'
	| 'color_theory_class';

export type ExpertPredicateOperator = 'equals' | 'contains' | 'contains_any_non_none';

export interface ExpertClausePredicateNode {
	id: string;
	type: 'predicate';
	field: ExpertPredicateField;
	operator: ExpertPredicateOperator;
	value?: string;
}

export interface ExpertClauseGroupNode {
	id: string;
	type: 'group';
	operator: ExpertClauseGroupOperator;
	children: ExpertClauseNode[];
}

export type ExpertClauseNode = ExpertClauseGroupNode | ExpertClausePredicateNode;

export interface SerializedExpertClausePredicateNode {
	type: 'predicate';
	field: ExpertPredicateField;
	operator: ExpertPredicateOperator;
	value?: string;
}

export interface SerializedExpertClauseGroupNode {
	type: 'group';
	operator: ExpertClauseGroupOperator;
	children: SerializedExpertClauseNode[];
}

export type SerializedExpertClauseNode =
	| SerializedExpertClauseGroupNode
	| SerializedExpertClausePredicateNode;

export interface ExpertPredicateDefinition {
	id: string;
	category: string;
	label: string;
	predicate: Omit<ExpertClausePredicateNode, 'id' | 'type'>;
}

type ExpertiseDemographics = Pick<
	ExpertDemographics,
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
export const EXPERT_CLAUSE_STORAGE_KEY = 'exp2-expert-clause';

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

function parseCheckboxSelections(value: string): string[] {
	if (!value) return [];

	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0 && entry !== 'Not specified');
}

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

export function getExpertPredicateLabel(
	predicate: Omit<ExpertClausePredicateNode, 'id' | 'type'>
): string {
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

export function getExpertClauseSummary(
	node: ExpertClauseNode,
	isRoot: boolean = true
): string {
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

export function getParticipantsByExpertClause(
	demographics: ExpertDemographics[],
	clause: ExpertClauseNode
): { colorExpert: Set<string>; nonExpert: Set<string> } {
	const colorExpert = new Set<string>();
	const nonExpert = new Set<string>();

	for (const demographicRecord of demographics) {
		if (evaluateExpertClause(clause, demographicRecord)) {
			colorExpert.add(demographicRecord.participantId);
		} else {
			nonExpert.add(demographicRecord.participantId);
		}
	}

	return { colorExpert, nonExpert };
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

function isSerializedPredicateNode(
	value: unknown
): value is SerializedExpertClausePredicateNode {
	if (!value || typeof value !== 'object') return false;

	const node = value as Record<string, unknown>;
	if (node.type !== 'predicate') return false;
	if (
		typeof node.field !== 'string' ||
		typeof node.operator !== 'string' ||
		!isValidPredicateOperatorForField(
			node.field as ExpertPredicateField,
			node.operator as ExpertPredicateOperator
		)
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

export function serializeExpertClause(clause: ExpertClauseNode): string {
	return JSON.stringify(serializeExpertClauseNode(clause));
}

export function deserializeExpertClause(
	serialized: string | null | undefined
): ExpertClauseGroupNode | null {
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

import { describe, expect, it } from 'vitest';
import type {
	Demographics,
	ExpertClauseNode,
	ExpertPredicateField,
	ExpertPredicateOperator
} from './types';
import {
	createExpertClauseGroupNode,
	createExpertClausePredicateNode,
	deserializeExpertClause,
	evaluateExpertClause,
	getDefaultExpertClause,
	getExpertClauseSummary,
	getParticipantsByExpertClause,
	getParticipantsByMakeupUse,
	getParticipantsByTrainingExposure,
	serializeExpertClause
} from './utils';

function createDemographics(overrides: Partial<Demographics> = {}): Demographics {
	return {
		participantId: 'participant-1',
		gender: 'Not specified',
		age: 'Not specified',
		education: 'Not specified',
		gender_other: '',
		education_other: '',
		strategies: 'Not specified',
		color_hobby: "I don't participate in any of the above",
		color_theory_class: 'No',
		color_theory_knowledge: 'Not specified',
		color_theory_knowledge_2: 'Not specified',
		makeup_familiarity: 'No',
		use_makeup: 'I do not use makeup',
		foundation_shade: 'Not specified',
		makeup_products: 'None',
		...overrides
	};
}

function createPredicate(
	field: ExpertPredicateField,
	operator: ExpertPredicateOperator,
	value?: string
) {
	return createExpertClausePredicateNode({ field, operator, value });
}

describe('evaluateExpertClause', () => {
	it('matches simple equals predicates', () => {
		const clause = createPredicate('makeup_familiarity', 'equals', 'Yes');

		expect(evaluateExpertClause(clause, createDemographics({ makeup_familiarity: 'Yes' }))).toBe(true);
		expect(evaluateExpertClause(clause, createDemographics({ makeup_familiarity: 'No' }))).toBe(false);
	});

	it('matches checkbox contains predicates', () => {
		const clause = createPredicate('makeup_products', 'contains', 'Foundation');

		expect(
			evaluateExpertClause(clause, createDemographics({ makeup_products: 'Foundation, Blush' }))
		).toBe(true);
		expect(evaluateExpertClause(clause, createDemographics({ makeup_products: 'Blush' }))).toBe(false);
	});

	it('matches checkbox contains_any_non_none predicates', () => {
		const makeupClause = createPredicate('makeup_products', 'contains_any_non_none');
		const hobbyClause = createPredicate('color_hobby', 'contains_any_non_none');

		expect(
			evaluateExpertClause(makeupClause, createDemographics({ makeup_products: 'Foundation, None' }))
		).toBe(true);
		expect(evaluateExpertClause(makeupClause, createDemographics({ makeup_products: 'None' }))).toBe(false);
		expect(evaluateExpertClause(hobbyClause, createDemographics({ color_hobby: 'Photography' }))).toBe(true);
		expect(
			evaluateExpertClause(
				hobbyClause,
				createDemographics({ color_hobby: "I don't participate in any of the above" })
			)
		).toBe(false);
	});

	it('supports nested boolean groups', () => {
		const clause = createExpertClauseGroupNode('OR', [
			createPredicate('makeup_familiarity', 'equals', 'Yes'),
			createExpertClauseGroupNode('AND', [
				createExpertClauseGroupNode('OR', [
					createPredicate('use_makeup', 'equals', 'I use it regularly'),
					createPredicate('use_makeup', 'equals', 'I use it professionally')
				]),
				createPredicate('makeup_products', 'contains_any_non_none')
			])
		]);

		expect(
			evaluateExpertClause(
				clause,
				createDemographics({
					use_makeup: 'I use it regularly',
					makeup_products: 'Foundation'
				})
			)
		).toBe(true);
		expect(
			evaluateExpertClause(
				clause,
				createDemographics({
					use_makeup: 'I use it regularly',
					makeup_products: 'None'
				})
			)
		).toBe(false);
	});

	it('treats nullish, blank, and not specified responses as non-matches', () => {
		const predicates: ExpertClauseNode[] = [
			createPredicate('makeup_familiarity', 'equals', 'Yes'),
			createPredicate('use_makeup', 'equals', 'I use it regularly'),
			createPredicate('makeup_products', 'contains_any_non_none'),
			createPredicate('color_hobby', 'contains_any_non_none'),
			createPredicate('color_theory_class', 'equals', 'Yes')
		];
		const demographics = createDemographics({
			makeup_familiarity: 'Not specified',
			use_makeup: '',
			makeup_products: 'Not specified',
			color_hobby: '',
			color_theory_class: 'Not specified'
		});

		for (const predicate of predicates) {
			expect(evaluateExpertClause(predicate, demographics)).toBe(false);
		}
	});
});

describe('default expert clause', () => {
	it('reproduces the current default expert rule', () => {
		const clause = getDefaultExpertClause();

		expect(
			evaluateExpertClause(
				clause,
				createDemographics({
					use_makeup: 'I use it professionally',
					makeup_products: 'None'
				})
			)
		).toBe(true);
		expect(
			evaluateExpertClause(
				clause,
				createDemographics({
					use_makeup: 'I use it regularly',
					makeup_products: 'None'
				})
			)
		).toBe(true);
		expect(evaluateExpertClause(clause, createDemographics({ color_hobby: 'Graphic Design' }))).toBe(true);
		expect(evaluateExpertClause(clause, createDemographics({ color_theory_class: 'Yes' }))).toBe(true);
		expect(evaluateExpertClause(clause, createDemographics({ makeup_familiarity: 'Yes' }))).toBe(false);
		expect(
			evaluateExpertClause(
				clause,
				createDemographics({
					use_makeup: 'I use it occasionally',
					makeup_products: 'Foundation'
				})
			)
		).toBe(false);
	});

	it('produces a readable summary', () => {
		expect(getExpertClauseSummary(getDefaultExpertClause())).toContain('use makeup = I use it regularly');
		expect(getExpertClauseSummary(getDefaultExpertClause())).toContain('color theory class = Yes');
	});
});

describe('expert clause persistence', () => {
	it('round-trips serialized clauses', () => {
		const clause = createExpertClauseGroupNode('AND', [
			createPredicate('makeup_familiarity', 'equals', 'Yes'),
			createPredicate('color_theory_class', 'equals', 'Yes')
		]);

		const serialized = serializeExpertClause(clause);
		const deserialized = deserializeExpertClause(serialized);

		expect(deserialized).not.toBeNull();
		expect(serializeExpertClause(deserialized!)).toBe(serialized);
	});

	it('rejects invalid serialized clauses', () => {
		expect(deserializeExpertClause('{"type":"group","operator":"XOR","children":[]}')).toBeNull();
		expect(
			deserializeExpertClause(
				'{"type":"predicate","field":"makeup_familiarity","operator":"equals","value":"Maybe"}'
			)
		).toBeNull();
	});
});

describe('getParticipantsByExpertClause', () => {
	it('groups matching and non-matching participants', () => {
		const clause = createExpertClauseGroupNode('OR', [
			createPredicate('makeup_familiarity', 'equals', 'Yes'),
			createPredicate('color_theory_class', 'equals', 'Yes')
		]);
		const demographics = [
			createDemographics({
				participantId: 'expert-1',
				makeup_familiarity: 'Yes'
			}),
			createDemographics({
				participantId: 'expert-2',
				color_theory_class: 'Yes'
			}),
			createDemographics({
				participantId: 'non-expert-1'
			})
		];

		const groups = getParticipantsByExpertClause(demographics, clause);

		expect([...groups.colorExpert]).toEqual(['expert-1', 'expert-2']);
		expect([...groups.nonExpert]).toEqual(['non-expert-1']);
	});
});

describe('getParticipantsByMakeupUse', () => {
	it('groups regular/professional makeup users separately from none/occasional users', () => {
		const demographics = [
			createDemographics({
				participantId: 'none',
				use_makeup: 'I do not use makeup'
			}),
			createDemographics({
				participantId: 'occasional',
				use_makeup: 'I use it occasionally'
			}),
			createDemographics({
				participantId: 'regular',
				use_makeup: 'I use it regularly'
			}),
			createDemographics({
				participantId: 'professional',
				use_makeup: 'I use it professionally'
			}),
			createDemographics({
				participantId: 'missing',
				use_makeup: 'Not specified'
			})
		];

		const groups = getParticipantsByMakeupUse(demographics);

		expect([...groups.regularOrProfessional]).toEqual(['regular', 'professional']);
		expect([...groups.noneOrOccasional]).toEqual(['none', 'occasional']);
		expect([...groups.unclassified]).toEqual(['missing']);
	});
});

describe('getParticipantsByTrainingExposure', () => {
	it('groups trained participants by makeup use, color theory class, or color hobbies', () => {
		const demographics = [
			createDemographics({
				participantId: 'makeup-regular',
				use_makeup: 'I use it regularly'
			}),
			createDemographics({
				participantId: 'makeup-professional',
				use_makeup: 'I use it professionally'
			}),
			createDemographics({
				participantId: 'color-theory',
				use_makeup: 'I do not use makeup',
				color_theory_class: 'Yes'
			}),
			createDemographics({
				participantId: 'color-hobby',
				use_makeup: 'I do not use makeup',
				color_hobby: 'Photography'
			}),
			createDemographics({
				participantId: 'untrained-none',
				use_makeup: 'I do not use makeup',
				color_theory_class: 'No',
				color_hobby: "I don't participate in any of the above"
			}),
			createDemographics({
				participantId: 'untrained-occasional',
				use_makeup: 'I use it occasionally',
				color_theory_class: 'No',
				color_hobby: "I don't participate in any of the above"
			}),
			createDemographics({
				participantId: 'missing',
				use_makeup: 'Not specified',
				color_theory_class: 'No',
				color_hobby: "I don't participate in any of the above"
			})
		];

		const groups = getParticipantsByTrainingExposure(demographics);

		expect([...groups.trained]).toEqual([
			'makeup-regular',
			'makeup-professional',
			'color-theory',
			'color-hobby'
		]);
		expect([...groups.untrained]).toEqual(['untrained-none', 'untrained-occasional']);
		expect([...groups.unclassified]).toEqual(['missing']);
	});
});

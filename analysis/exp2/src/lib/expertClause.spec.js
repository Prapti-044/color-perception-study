import test from 'node:test';
import assert from 'node:assert/strict';
import {
	createExpertClauseGroupNode,
	createExpertClausePredicateNode,
	deserializeExpertClause,
	evaluateExpertClause,
	getDefaultExpertClause,
	getExpertClauseSummary,
	serializeExpertClause
} from './expertClause.ts';

function createDemographics(overrides = {}) {
	return {
		color_hobby: "I don't participate in any of the above",
		color_theory_class: 'No',
		makeup_familiarity: 'No',
		makeup_products: 'None',
		participantId: 'participant-1',
		use_makeup: 'I do not use makeup',
		...overrides
	};
}

test('default expert clause matches the exp1 defaults', () => {
	const clause = getDefaultExpertClause();

	assert.equal(
		evaluateExpertClause(
			clause,
			createDemographics({ use_makeup: 'I use it professionally' })
		),
		true
	);
	assert.equal(
		evaluateExpertClause(clause, createDemographics({ color_hobby: 'Graphic Design' })),
		true
	);
	assert.equal(
		evaluateExpertClause(clause, createDemographics({ color_theory_class: 'Yes' })),
		true
	);
	assert.equal(
		evaluateExpertClause(
			clause,
			createDemographics({
				makeup_products: 'Foundation',
				use_makeup: 'I use it occasionally'
			})
		),
		false
	);
});

test('clause summaries and persistence round-trip cleanly', () => {
	const clause = createExpertClauseGroupNode('AND', [
		createExpertClausePredicateNode({
			field: 'color_theory_class',
			operator: 'equals',
			value: 'Yes'
		}),
		createExpertClausePredicateNode({
			field: 'color_hobby',
			operator: 'contains',
			value: 'Painting'
		})
	]);

	const summary = getExpertClauseSummary(clause);
	const serialized = serializeExpertClause(clause);
	const deserialized = deserializeExpertClause(serialized);

	assert.match(summary, /color theory class = Yes/);
	assert.match(summary, /color hobby contains Painting/);
	assert.ok(deserialized);
	assert.equal(serializeExpertClause(deserialized), serialized);
});

test('blank and not specified responses do not count as expertise', () => {
	const clause = getDefaultExpertClause();

	assert.equal(
		evaluateExpertClause(
			clause,
			createDemographics({
				color_hobby: '',
				color_theory_class: 'Not specified',
				makeup_familiarity: 'Not specified',
				makeup_products: 'Not specified',
				use_makeup: ''
			})
		),
		false
	);
});

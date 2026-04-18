<script lang="ts">
	import type {
		TrialDetails,
		Demographics,
		AttentionCheck,
		ExperimentInfo,
		ParticipantSummary
	} from '$lib/types';
	import { generateParticipantSummary } from '$lib/data-loader';
	import {
		formatNumber,
		formatPercent,
		formatTimestamp,
		formatDuration,
		getAttentionBadgeClass
	} from '$lib/utils';

	interface Props {
		participantId: string;
		trials: TrialDetails[];
		demographics?: Demographics;
		attentionChecks: AttentionCheck[];
		experimentInfo?: ExperimentInfo;
		participantSummaryRow?: ParticipantSummary;
		index: number;
	}

	let {
		participantId,
		trials,
		demographics,
		attentionChecks,
		experimentInfo,
		participantSummaryRow,
		index
	}: Props = $props();

	let expanded = $state(false);

	const summary = $derived(generateParticipantSummary(trials));
	const attentionCorrect = $derived(attentionChecks.filter((ac) => ac.is_correct).length);
	const attentionTotal = $derived(attentionChecks.length);
	const isExcluded = $derived(participantSummaryRow?.excluded ?? false);

	const sortedTrials = $derived([...trials].sort((a, b) => a.trial_order - b.trial_order));

	function getTrialRowClass(trial: TrialDetails): string {
		if (trial.trial_type === 'samecolor') return 'bg-blue-50';
		if (trial.trial_type === 'largediff') return 'bg-amber-50';
		return '';
	}
</script>

<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
	<!-- Header (always visible) -->
	<button
		type="button"
		class="flex w-full cursor-pointer items-center justify-between border-b border-slate-100 bg-white px-5 py-4 text-left transition-colors hover:bg-slate-50"
		onclick={() => (expanded = !expanded)}
	>
		<div>
			<h3 class="flex items-center gap-2 text-base font-semibold text-slate-800">
				<span>{summary.completed ? '✓' : '⚠'}</span>
				<span class="font-mono">{participantId}</span>
				{#if experimentInfo?.rejected}
					<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
						REJECTED
					</span>
				{/if}
				{#if isExcluded}
					<span class="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
						EXCLUDED
					</span>
				{/if}
			</h3>
			<div class="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
				<span><strong>Condition:</strong> {summary.condition}-axis</span>
				<span>|</span>
				<span><strong>Status:</strong> {summary.completed ? 'Completed' : 'Incomplete'}</span>
				<span>|</span>
				<span><strong>Trials:</strong> {summary.answered_trials}/{summary.total_trials}</span>
				<span>|</span>
				<span><strong>Accuracy:</strong> {formatPercent(summary.accuracy)}</span>
				<span>|</span>
				<span
					class="rounded-full px-2 py-0.5 text-xs font-semibold {getAttentionBadgeClass(attentionCorrect, attentionTotal)}"
				>
					AC: {attentionCorrect}/{attentionTotal}
				</span>
				{#if experimentInfo}
					<span
						class="rounded-full px-2 py-0.5 text-xs font-semibold {getAttentionBadgeClass(experimentInfo.color_blindness_passed, experimentInfo.color_blindness_total)}"
					>
						CV: {experimentInfo.color_blindness_passed}/{experimentInfo.color_blindness_total}
					</span>
				{/if}
			</div>
			{#if experimentInfo}
				<div class="mt-1 text-xs text-slate-400">
					Duration: {formatDuration(experimentInfo.duration_minutes)} |
					Started: {formatTimestamp(experimentInfo.start_timestamp)} |
					Screen: {experimentInfo.screen_width}×{experimentInfo.screen_height} |
					{experimentInfo.browser}
				</div>
			{/if}
		</div>
		<div
			class="text-blue-600 transition-transform duration-300"
			class:rotate-90={expanded}
		>
			▶
		</div>
	</button>

	<!-- Content (collapsible) -->
	{#if expanded}
		<div class="bg-slate-50 p-6">
			<!-- Demographics -->
			{#if demographics}
				<div class="mb-6 rounded-lg border-l-4 border-purple-500 bg-white p-5 shadow-sm">
					<h4 class="mb-4 text-sm font-semibold text-purple-700">Demographics</h4>
					<div class="grid gap-5 md:grid-cols-3">
						<div>
							<h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
								Basic Info
							</h5>
							<p class="text-sm">
								<span class="text-slate-500">Gender:</span> {demographics.gender}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Age:</span> {demographics.age}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Education:</span> {demographics.education}
							</p>
						</div>
						<div>
							<h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
								Makeup Experience
							</h5>
							<p class="text-sm">
								<span class="text-slate-500">Familiar:</span> {demographics.makeup_familiarity}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Usage:</span> {demographics.use_makeup}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Foundation:</span> {demographics.foundation_shade}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Products:</span> {demographics.makeup_products}
							</p>
						</div>
						<div>
							<h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
								Color Theory
							</h5>
							<p class="text-sm">
								<span class="text-slate-500">Taken Class:</span> {demographics.color_theory_class}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Hobbies:</span> {demographics.color_hobby}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Red+Yellow:</span>
								{demographics.color_theory_knowledge}
							</p>
							<p class="text-sm">
								<span class="text-slate-500">Red+Blue:</span>
								{demographics.color_theory_knowledge_2}
							</p>
						</div>
					</div>
					<div class="mt-4">
						<h5 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
							Strategies Used
						</h5>
						<p class="text-sm italic text-slate-600">{demographics.strategies}</p>
					</div>
				</div>
			{/if}

			<!-- Performance Summary -->
			<div class="mb-6 flex flex-wrap gap-5">
				<div class="flex-1 min-w-[250px] rounded-lg border-l-4 border-blue-500 bg-white p-5 shadow-sm">
					<h4 class="mb-3 text-sm font-semibold text-blue-700">Overall Performance</h4>
					<p class="text-sm">
						<span class="text-slate-500">Accuracy:</span>
						<span class="font-semibold text-blue-600">{formatPercent(summary.accuracy)}</span>
					</p>
					<p class="text-sm">
						<span class="text-slate-500">Mean RT:</span>
						<span class="font-semibold text-blue-600">{formatNumber(summary.mean_rt_ms, 0)} ms</span>
					</p>
					<p class="text-sm">
						<span class="text-slate-500">Median RT:</span>
						<span class="font-semibold text-blue-600"
							>{formatNumber(summary.median_rt_ms, 0)} ms</span
						>
					</p>
				</div>
				<div class="flex-1 min-w-[250px] rounded-lg border-l-4 border-green-500 bg-white p-5 shadow-sm">
					<h4 class="mb-3 text-sm font-semibold text-green-700">By Trial Type</h4>
					<p class="text-sm">
						<span class="text-slate-500">Small Diff:</span>
						<span class="font-semibold text-green-600"
							>{formatPercent(summary.small_diff_accuracy)}</span
						>
						<span class="text-slate-400">({summary.n_small_diff} trials)</span>
					</p>
					<p class="text-sm">
						<span class="text-slate-500">Large Diff:</span>
						<span class="font-semibold text-green-600"
							>{formatPercent(summary.large_diff_accuracy)}</span
						>
						<span class="text-slate-400">({summary.n_large_diff} trials)</span>
					</p>
					<p class="text-sm">
						<span class="text-slate-500">No Diff:</span>
						<span class="font-semibold text-green-600"
							>{formatPercent(summary.no_diff_accuracy)}</span
						>
						<span class="text-slate-400">({summary.n_no_diff} trials)</span>
					</p>
				</div>
			</div>

			<!-- Attention Checks Details -->
			{#if attentionChecks.length > 0 && attentionCorrect < attentionTotal}
				<div class="mb-6">
					<h4 class="mb-3 text-sm font-semibold text-slate-700">Attention Checks</h4>
					<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
						<table class="w-full text-sm">
							<thead>
								<tr>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										#
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Question
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Answer
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Correct
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Result
									</th>
								</tr>
							</thead>
							<tbody>
								{#each attentionChecks as ac}
									<tr class="border-b border-slate-100">
										<td class="px-3 py-2">#{ac.number}</td>
										<td class="px-3 py-2 text-slate-600">{ac.question}</td>
										<td class="px-3 py-2 {ac.is_correct ? 'text-green-600' : 'text-red-600'}">
											{ac.participant_answer}
										</td>
										<td class="px-3 py-2 text-slate-600">{ac.correct_answer}</td>
										<td class="px-3 py-2 {ac.is_correct ? 'text-green-600' : 'text-red-600'}">
											{ac.is_correct ? '✓' : '✗'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Comprehension Verification (CV) Details -->
			{#if experimentInfo && experimentInfo.color_blindness_passed < experimentInfo.color_blindness_total && experimentInfo.color_blindness_results && experimentInfo.color_blindness_results.length > 0}
				<div class="mb-6">
					<h4 class="mb-3 text-sm font-semibold text-slate-700">Comprehension Verification (CV)</h4>
					<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
						<table class="w-full text-sm">
							<thead>
								<tr>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Plate
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Participant Answer
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Correct Answer
									</th>
									<th
										class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
									>
										Result
									</th>
								</tr>
							</thead>
							<tbody>
								{#each experimentInfo.color_blindness_results as cv}
									<tr class="border-b border-slate-100">
										<td class="px-3 py-2 text-slate-600">{cv.plate}</td>
										<td class="px-3 py-2 {cv.is_correct ? 'text-green-600' : 'text-red-600'}">
											{cv.answer}
										</td>
										<td class="px-3 py-2 text-slate-600">{cv.correct ?? 'N/A'}</td>
										<td class="px-3 py-2 {cv.is_correct ? 'text-green-600' : 'text-red-600'}">
											{cv.is_correct ? '✓' : '✗'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Trial Details -->
			<h4 class="mb-3 text-sm font-semibold text-slate-700">Trial Details</h4>
			<div class="overflow-x-auto rounded-lg bg-white shadow-sm">
				<table class="w-full text-sm">
					<thead>
						<tr>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Trial
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Scatter #
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Axis
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Type
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								ΔE
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Size (°)
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Answer
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Correct
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								Result
							</th>
							<th
								class="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700"
							>
								RT (ms)
							</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedTrials as trial}
							<tr class="border-b border-slate-100 {getTrialRowClass(trial)}">
								<td class="px-3 py-2">{trial.trial_order}</td>
								<td class="px-3 py-2">{trial.scatter_index}</td>
								<td class="px-3 py-2">{trial.axis ?? '-'}</td>
								<td class="px-3 py-2">{trial.diff_type ?? '-'}</td>
								<td class="px-3 py-2">{formatNumber(trial.delta_e, 1)}</td>
								<td class="px-3 py-2">{formatNumber(trial.point_diameter_degrees, 2)}</td>
								<td class="px-3 py-2">{trial.answer ?? '-'}</td>
								<td class="px-3 py-2">{trial.correct_answer ?? '-'}</td>
								<td
									class="px-3 py-2 {trial.answer !== null
										? trial.is_correct
											? 'text-green-600 font-semibold'
											: 'text-red-600 font-semibold'
										: 'text-slate-400'}"
								>
									{trial.answer !== null ? (trial.is_correct ? '✓' : '✗') : '?'}
								</td>
								<td class="px-3 py-2">{formatNumber(trial.rt_ms, 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>


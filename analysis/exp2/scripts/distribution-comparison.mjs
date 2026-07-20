// Statistical comparison of ellipsoid-volume distributions:
//   Original study (published summary statistics only) vs. This study (full raw data).
//
// Run from the exp2 project root:  node scripts/distribution-comparison.mjs
//
// The original study is available only as a 5-number summary + mean/SD, so
// exact two-sample tests that need both raw samples (Mann-Whitney, KS) cannot
// be computed directly. We therefore use (a) summary-statistics-based tests
// that are exact given the reported moments (Welch t, TOST) and (b) log-normal
// model-based comparisons that are appropriate for a heavily right-skewed
// positive metric. A Monte-Carlo KS/MWU sensitivity check resamples the
// original from a log-normal matched to its published quartiles.

import pkg from 'jstat';
import {
	ELLIPSE_MODES,
	extractParticipantMetric,
	loadCombinedParticipants
} from '../src/lib/server/colorVisionMethodology.js';
import { shapiroWilk } from '../src/lib/normality.ts';

const { jStat } = pkg;

// --- Original study published summary (image 1 + ORIGINAL_STUDY_VOLUME_SUMMARY) ---
const ORIGINAL = {
	label: 'Original study',
	n: 29044,
	mean: 3670.43,
	sd: 13728.03,
	min: 21.68,
	q1: 804.62,
	median: 1558.38,
	q3: 3223.6,
	max: 1058397.76
};

const NORMAL_IQR_Z = 0.6744897501960817; // z for the 75th percentile

// ---------------------------------------------------------------- helpers ----
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function sampleSd(xs, m = meanOf(xs)) {
	if (xs.length < 2) return 0;
	const ss = xs.reduce((a, b) => a + (b - m) ** 2, 0);
	return Math.sqrt(ss / (xs.length - 1));
}

function quantileSorted(sorted, p) {
	const idx = (sorted.length - 1) * p;
	const lo = Math.floor(idx);
	const hi = Math.ceil(idx);
	if (lo === hi) return sorted[lo];
	return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function skewness(xs, m = meanOf(xs), s = sampleSd(xs, m)) {
	const n = xs.length;
	if (n < 3 || s === 0) return NaN;
	const sum = xs.reduce((a, b) => a + ((b - m) / s) ** 3, 0);
	return (n / ((n - 1) * (n - 2))) * sum;
}

function describe(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const m = meanOf(values);
	const s = sampleSd(values, m);
	const logs = values.map((v) => Math.log(v));
	const lm = meanOf(logs);
	const ls = sampleSd(logs, lm);
	return {
		n: values.length,
		mean: m,
		sd: s,
		cv: s / m,
		min: sorted[0],
		q1: quantileSorted(sorted, 0.25),
		median: quantileSorted(sorted, 0.5),
		q3: quantileSorted(sorted, 0.75),
		max: sorted[sorted.length - 1],
		skew: skewness(values, m, s),
		logMean: lm,
		logSd: ls,
		geoMean: Math.exp(lm),
		logSkew: skewness(logs, lm, ls),
		sorted
	};
}

// Welch two-sample t-test from summary stats (means, sds, ns).
function welchT(m1, s1, n1, m2, s2, n2) {
	const v1 = (s1 * s1) / n1;
	const v2 = (s2 * s2) / n2;
	const se = Math.sqrt(v1 + v2);
	const diff = m1 - m2;
	const t = diff / se;
	const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
	const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
	return { diff, se, t, df, p };
}

// TOST equivalence around +/- margin (raw scale), returns max of the two one-sided p's.
function tost(m1, s1, n1, m2, s2, n2, margin) {
	const v1 = (s1 * s1) / n1;
	const v2 = (s2 * s2) / n2;
	const se = Math.sqrt(v1 + v2);
	const diff = m1 - m2;
	const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
	const tLower = (diff + margin) / se; // H0: diff <= -margin
	const tUpper = (diff - margin) / se; // H0: diff >= +margin
	const pLower = 1 - jStat.studentt.cdf(tLower, df);
	const pUpper = jStat.studentt.cdf(tUpper, df);
	const maxP = Math.max(pLower, pUpper);
	return { margin, diff, pLower, pUpper, maxP, equivalent: maxP < 0.05 };
}

// Log-normal parameters of the original recovered two ways.
function originalLogNormalParams() {
	// (a) Method of moments from mean & SD.
	const cv2 = (ORIGINAL.sd / ORIGINAL.mean) ** 2;
	const sigmaMoM = Math.sqrt(Math.log(1 + cv2));
	const muMoM = Math.log(ORIGINAL.mean) - 0.5 * sigmaMoM ** 2;
	// (b) Robust: median -> mu, IQR ratio -> sigma (insensitive to the extreme max).
	const muQ = Math.log(ORIGINAL.median);
	const sigmaQ = Math.log(ORIGINAL.q3 / ORIGINAL.q1) / (2 * NORMAL_IQR_Z);
	return { muMoM, sigmaMoM, muQ, sigmaQ };
}

// Seeded RNG + Box-Muller for the Monte-Carlo sensitivity check.
function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sampleLogNormal(n, mu, sigma, rng) {
	const out = new Array(n);
	for (let i = 0; i < n; i += 1) {
		const u1 = Math.max(rng(), 1e-12);
		const u2 = rng();
		const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		out[i] = Math.exp(mu + sigma * z);
	}
	return out;
}

// Kolmogorov distribution Q(t) = 2 * sum (-1)^{k-1} exp(-2 k^2 t^2)
function kolmogorovQ(t) {
	if (t <= 0) return 1;
	let sum = 0;
	for (let k = 1; k <= 100; k += 1) {
		sum += (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * t * t);
	}
	return Math.max(0, Math.min(1, 2 * sum));
}

function ksTwoSample(a, b) {
	const s1 = [...a].sort((x, y) => x - y);
	const s2 = [...b].sort((x, y) => x - y);
	const n1 = s1.length;
	const n2 = s2.length;
	let i = 0;
	let j = 0;
	let d = 0;
	while (i < n1 && j < n2) {
		const x = s1[i];
		const y = s2[j];
		if (x <= y) i += 1;
		if (y <= x) j += 1;
		d = Math.max(d, Math.abs(i / n1 - j / n2));
	}
	const ne = (n1 * n2) / (n1 + n2);
	const t = (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * d;
	return { d, p: kolmogorovQ(t) };
}

// Mann-Whitney U with tie correction and normal approximation (two-sided).
function mannWhitney(a, b) {
	const n1 = a.length;
	const n2 = b.length;
	const combined = [
		...a.map((v) => ({ v, g: 0 })),
		...b.map((v) => ({ v, g: 1 }))
	].sort((x, y) => x.v - y.v);
	const N = combined.length;
	let idx = 0;
	let rankSum1 = 0;
	let tieTerm = 0;
	while (idx < N) {
		let end = idx;
		while (end + 1 < N && combined[end + 1].v === combined[idx].v) end += 1;
		const count = end - idx + 1;
		const avgRank = (idx + 1 + (end + 1)) / 2;
		for (let k = idx; k <= end; k += 1) {
			if (combined[k].g === 0) rankSum1 += avgRank;
		}
		tieTerm += count ** 3 - count;
		idx = end + 1;
	}
	const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
	const u2 = n1 * n2 - u1;
	const u = Math.min(u1, u2);
	const meanU = (n1 * n2) / 2;
	const sdU = Math.sqrt(
		((n1 * n2) / 12) * (N + 1 - tieTerm / (N * (N - 1)))
	);
	const z = (u - meanU) / sdU;
	const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
	return { u1, u2, u, z, p, probSuperiority: u1 / (n1 * n2) };
}

const fmt = (x, d = 2) =>
	Number.isFinite(x)
		? x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
		: String(x);
const pFmt = (p) => (p < 1e-4 ? p.toExponential(2) : p.toFixed(4));

// -------------------------------------------------------------------- main ----
async function main() {
	const participants = await loadCombinedParticipants();

	const volumesFor = (mode) =>
		participants
			.map((p) => extractParticipantMetric(p, mode))
			.filter((m) => m !== null)
			.map((m) => m.ellipsoidVolume);

	const exact = describe(volumesFor(ELLIPSE_MODES.EXACT));
	const fitted = describe(volumesFor(ELLIPSE_MODES.INCLUDE_FITTED));

	console.log('\n================ RAW DESCRIPTIVES ================');
	const cols = [
		['metric', 'Original (pub.)', 'Ours (exact)', 'Ours (+fitted)'],
		['n', ORIGINAL.n, exact.n, fitted.n],
		['mean', ORIGINAL.mean, exact.mean, fitted.mean],
		['SD', ORIGINAL.sd, exact.sd, fitted.sd],
		['CV', ORIGINAL.sd / ORIGINAL.mean, exact.cv, fitted.cv],
		['min', ORIGINAL.min, exact.min, fitted.min],
		['Q1', ORIGINAL.q1, exact.q1, fitted.q1],
		['median', ORIGINAL.median, exact.median, fitted.median],
		['Q3', ORIGINAL.q3, exact.q3, fitted.q3],
		['max', ORIGINAL.max, exact.max, fitted.max],
		['skewness', '—', exact.skew, fitted.skew],
		['geo-mean', '—', exact.geoMean, fitted.geoMean],
		['log-mean', '—', exact.logMean, fitted.logMean],
		['log-SD', '—', exact.logSd, fitted.logSd]
	];
	for (const [label, o, e, f] of cols) {
		const F = (v) => (typeof v === 'number' ? fmt(v, 3) : v);
		console.log(
			label.toString().padEnd(11) +
				F(o).toString().padStart(18) +
				F(e).toString().padStart(16) +
				F(f).toString().padStart(16)
		);
	}

	console.log('\nWhich mode matches the figure (min 242.61, Q1 1319.01, median 2496.90, Q3 5254.58, max 104353.54)?');
	console.log(
		`  exact:   min ${fmt(exact.min)}  Q1 ${fmt(exact.q1)}  med ${fmt(exact.median)}  Q3 ${fmt(exact.q3)}  max ${fmt(exact.max)}`
	);
	console.log(
		`  +fitted: min ${fmt(fitted.min)}  Q1 ${fmt(fitted.q1)}  med ${fmt(fitted.median)}  Q3 ${fmt(fitted.q3)}  max ${fmt(fitted.max)}`
	);

	// Run the full comparison for both modes.
	for (const [modeLabel, ours] of [
		['EXACT', exact],
		['INCLUDE-FITTED', fitted]
	]) {
		console.log(`\n\n#################### COMPARISON: ORIGINAL vs OURS (${modeLabel}) ####################`);

		// Normality of our sample (justifies log scale).
		const swRaw = shapiroWilk(ours.sorted);
		const swLog = shapiroWilk(ours.sorted.map((v) => Math.log(v)));
		console.log('\n-- Normality of our sample --');
		console.log(`  raw:  Shapiro-Wilk W=${fmt(swRaw.W, 4)}, p=${pFmt(swRaw.pValue)} -> ${swRaw.verdict}`);
		console.log(`  log:  Shapiro-Wilk W=${fmt(swLog.W, 4)}, p=${pFmt(swLog.pValue)} -> ${swLog.verdict}`);

		// 1. Welch t-test (raw).
		const w = welchT(ours.mean, ours.sd, ours.n, ORIGINAL.mean, ORIGINAL.sd, ORIGINAL.n);
		console.log('\n-- Welch two-sample t-test (RAW scale) --');
		console.log(`  mean diff (ours - orig) = ${fmt(w.diff)}  [ours ${fmt(ours.mean)} vs orig ${fmt(ORIGINAL.mean)}]`);
		console.log(`  t(${fmt(w.df, 1)}) = ${fmt(w.t, 3)},  p = ${pFmt(w.p)}`);

		// Glass's delta (control = original) and Cohen's d (raw pooled).
		const pooledSd = Math.sqrt(
			((ours.n - 1) * ours.sd ** 2 + (ORIGINAL.n - 1) * ORIGINAL.sd ** 2) /
				(ours.n + ORIGINAL.n - 2)
		);
		console.log(`  Cohen's d (raw, pooled SD) = ${fmt(w.diff / pooledSd, 3)}`);
		console.log(`  Glass's delta (vs orig SD) = ${fmt(w.diff / ORIGINAL.sd, 3)}`);

		// 2. TOST equivalence (margin 0.2 * orig SD).
		const margin = 0.2 * ORIGINAL.sd;
		const eq = tost(ours.mean, ours.sd, ours.n, ORIGINAL.mean, ORIGINAL.sd, ORIGINAL.n, margin);
		console.log('\n-- TOST equivalence (margin = 0.2 x orig SD) --');
		console.log(`  margin = +/- ${fmt(eq.margin)}, max one-sided p = ${pFmt(eq.maxP)} -> ${eq.equivalent ? 'EQUIVALENT' : 'NOT equivalent'}`);

		// 3. Log-scale comparison.
		const lp = originalLogNormalParams();
		console.log('\n-- Log-scale / ratio comparison (appropriate for skewed volumes) --');
		console.log(`  our log-mean = ${fmt(ours.logMean, 4)} (geo-mean ${fmt(ours.geoMean)}), log-SD = ${fmt(ours.logSd, 4)}`);
		console.log(`  orig log params (method-of-moments): mu=${fmt(lp.muMoM, 4)} (geo-mean ${fmt(Math.exp(lp.muMoM))}), sigma=${fmt(lp.sigmaMoM, 4)}`);
		console.log(`  orig log params (quantile/robust):   mu=${fmt(lp.muQ, 4)} (=ln median ${fmt(Math.exp(lp.muQ))}), sigma=${fmt(lp.sigmaQ, 4)}`);
		console.log(`  RATIO of medians (model-free)      = ${fmt(ours.median / ORIGINAL.median, 3)}x  (ours ${fmt(ours.median)} / orig ${fmt(ORIGINAL.median)})`);
		console.log(`  RATIO of geo-means (MoM orig)      = ${fmt(ours.geoMean / Math.exp(lp.muMoM), 3)}x`);
		console.log(`  RATIO of geo-means (quantile orig) = ${fmt(ours.geoMean / Math.exp(lp.muQ), 3)}x`);

		// Welch t on the log scale using quantile-based orig log params.
		const wlog = welchT(ours.logMean, ours.logSd, ours.n, lp.muQ, lp.sigmaQ, ORIGINAL.n);
		console.log(`  Welch t on log scale (orig quantile params): t(${fmt(wlog.df, 1)}) = ${fmt(wlog.t, 3)}, p = ${pFmt(wlog.p)}`);
		console.log(`  Cohen's d (log, quantile orig sigma-pooled) = ${fmt((ours.logMean - lp.muQ) / Math.sqrt((ours.logSd ** 2 + lp.sigmaQ ** 2) / 2), 3)}`);

		// Probability of superiority under log-normal (quantile orig params).
		const probSup = jStat.normal.cdf(
			(ours.logMean - lp.muQ) / Math.sqrt(ours.logSd ** 2 + lp.sigmaQ ** 2),
			0,
			1
		);
		console.log(`  P(our participant > orig participant) under log-normal = ${fmt(probSup, 3)}`);

		// 4. Monte-Carlo KS / Mann-Whitney sensitivity (original resampled log-normal).
		const rng = mulberry32(20240709);
		const simOrig = sampleLogNormal(ORIGINAL.n, lp.muQ, lp.sigmaQ, rng);
		const ks = ksTwoSample(ours.sorted, simOrig);
		const mwu = mannWhitney(ours.sorted, simOrig);
		console.log('\n-- Monte-Carlo sensitivity: orig resampled ~ LogNormal(quantile fit) --');
		console.log(`  KS two-sample:   D = ${fmt(ks.d, 4)}, p = ${pFmt(ks.p)}`);
		console.log(`  Mann-Whitney U:  z = ${fmt(mwu.z, 3)}, p = ${pFmt(mwu.p)}, P(ours>orig) = ${fmt(mwu.probSuperiority, 3)}`);
	}

	console.log('\n(Done.)\n');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

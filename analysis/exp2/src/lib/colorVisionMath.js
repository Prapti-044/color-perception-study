// @ts-nocheck
/** @typedef {{ 1?: number, 2?: number, 3?: number, 4?: number }} ThresholdMeanMap */
/** @typedef {'exact' | 'fitted'} FitKind */

export const MAX_LOCATION_BY_VECTOR = Object.freeze({
	1: 166,
	2: 134,
	3: 174,
	4: 106
});

export const HISTOGRAM_MAX_VOLUME = 12_000;
export const HISTOGRAM_BIN_WIDTH = 250;

export const RECOVERED_BASE_GRAY = Object.freeze({
	backgroundHex: '#787878',
	backgroundLuv: Object.freeze([50.46762, 0, 0]),
	backgroundRgb: Object.freeze([120.09168, 120.09168, 120.09168])
});

export const RECOVERED_AXES = Object.freeze({
	1: Object.freeze({
		backgroundHex: '#787878',
		backgroundLuv: Object.freeze([50.46762, 0, 0]),
		backgroundRgb: Object.freeze([120.09168, 120.09168, 120.09168]),
		deltaLuv: Object.freeze([-1.007737, 116.626499, 7.252836]),
		endpointHex: '#da325c',
		endpointImage: '/stimuli/1-166-0.png',
		endpointLuv: Object.freeze([49.459883, 116.626489, 7.252843]),
		endpointRgb: Object.freeze([217.907015, 50.249592, 91.946166]),
		maxLocation: 166,
		maxRadius: 116.85180283109261,
		name: 'pink',
		unitUv: Object.freeze([0.9980717421434949, 0.06206869516574314]),
		vector: 1
	}),
	2: Object.freeze({
		backgroundHex: '#787878',
		backgroundLuv: Object.freeze([50.295905, 0, 0]),
		backgroundRgb: Object.freeze([119.658718, 119.658718, 119.658718]),
		deltaLuv: Object.freeze([-0.554073, 94.804165, -21.880043]),
		endpointHex: '#d33685',
		endpointImage: '/stimuli/2-134-0.png',
		endpointLuv: Object.freeze([49.741832, 94.804155, -21.880036]),
		endpointRgb: Object.freeze([211.295269, 53.849918, 132.600326]),
		maxLocation: 134,
		maxRadius: 97.29627981481695,
		name: 'magenta',
		unitUv: Object.freeze([0.9743857154843092, -0.22488130951080765]),
		vector: 2
	}),
	3: Object.freeze({
		backgroundHex: '#777777',
		backgroundLuv: Object.freeze([49.99361, 0, 0]),
		backgroundRgb: Object.freeze([118.897191, 118.897191, 118.897191]),
		deltaLuv: Object.freeze([0.043656, 13.363038, -104.620659]),
		endpointHex: '#9156e7',
		endpointImage: '/stimuli/3-174-0.png',
		endpointLuv: Object.freeze([50.037266, 13.363028, -104.620653]),
		endpointRgb: Object.freeze([145.027732, 85.861338, 231.442088]),
		maxLocation: 174,
		maxRadius: 105.47062713526178,
		name: 'blue',
		unitUv: Object.freeze([0.1266987109754714, -0.9919411675887145]),
		vector: 3
	}),
	4: Object.freeze({
		backgroundHex: '#787878',
		backgroundLuv: Object.freeze([50.375156, 0, 0]),
		backgroundRgb: Object.freeze([119.858506, 119.858506, 119.858506]),
		deltaLuv: Object.freeze([38.865557, 0, 0]),
		endpointHex: '#e0e0e0',
		endpointImage: '/stimuli/4-106-0.png',
		endpointLuv: Object.freeze([89.240713, 0, 0]),
		endpointRgb: Object.freeze([224.179445, 224.179445, 224.179445]),
		maxLocation: 106,
		maxRadius: 38.865557,
		name: 'lighter',
		unitUv: Object.freeze([0, 0]),
		vector: 4
	})
});

export const RECOVERED_AXIS_LIST = Object.freeze(
	Object.values(RECOVERED_AXES).sort((left, right) => left.vector - right.vector)
);

/**
 * @param {number[]} values
 */
export function mean(values) {
	if (!values.length) {
		return 0;
	}

	return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * @param {number} channel
 */
export function srgbToLinear(channel) {
	const normalized = channel / 255;

	return normalized <= 0.04045
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {[number, number, number]} rgb
 */
export function rgbToXyz([red, green, blue]) {
	const r = srgbToLinear(red);
	const g = srgbToLinear(green);
	const b = srgbToLinear(blue);

	return [
		(0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100,
		(0.2126729 * r + 0.7151522 * g + 0.072175 * b) * 100,
		(0.0193339 * r + 0.119192 * g + 0.9503041 * b) * 100
	];
}

/**
 * @param {[number, number, number]} xyz
 */
export function xyzToLuv([x, y, z]) {
	const referenceWhite = [95.047, 100, 108.883];
	const [xRef, yRef, zRef] = referenceWhite;
	const denominator = x + 15 * y + 3 * z;
	const referenceDenominator = xRef + 15 * yRef + 3 * zRef;
	const uPrime = denominator === 0 ? 0 : (4 * x) / denominator;
	const vPrime = denominator === 0 ? 0 : (9 * y) / denominator;
	const uPrimeRef = (4 * xRef) / referenceDenominator;
	const vPrimeRef = (9 * yRef) / referenceDenominator;
	const yRatio = y / yRef;
	const l =
		yRatio > (6 / 29) ** 3 ? 116 * Math.cbrt(yRatio) - 16 : (29 / 3) ** 3 * yRatio;

	if (l === 0) {
		return [0, 0, 0];
	}

	return [l, 13 * l * (uPrime - uPrimeRef), 13 * l * (vPrime - vPrimeRef)];
}

/**
 * @param {[number, number, number]} rgb
 */
export function rgbToLuv(rgb) {
	return xyzToLuv(rgbToXyz(rgb));
}

/**
 * @param {number} thresholdMean
 * @param {number} vector
 */
export function thresholdMeanToRadius(thresholdMean, vector) {
	const maxLocation = MAX_LOCATION_BY_VECTOR[vector];
	const axis = RECOVERED_AXES[vector];

	if (!maxLocation || !axis) {
		throw new Error(`Unknown vector ${vector}`);
	}

	return (thresholdMean / maxLocation) * axis.maxRadius;
}

/**
 * @param {number[][]} matrix
 * @param {number[]} rhs
 */
export function solveLinear3x3(matrix, rhs) {
	const augmented = matrix.map((row, index) => [...row, rhs[index]]);

	for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
		let pivotRow = pivotIndex;

		for (let candidate = pivotIndex + 1; candidate < 3; candidate += 1) {
			if (Math.abs(augmented[candidate][pivotIndex]) > Math.abs(augmented[pivotRow][pivotIndex])) {
				pivotRow = candidate;
			}
		}

		if (Math.abs(augmented[pivotRow][pivotIndex]) < 1e-12) {
			throw new Error('Ellipse fit matrix is singular');
		}

		if (pivotRow !== pivotIndex) {
			[augmented[pivotIndex], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivotIndex]];
		}

		const pivot = augmented[pivotIndex][pivotIndex];

		for (let column = pivotIndex; column < 4; column += 1) {
			augmented[pivotIndex][column] /= pivot;
		}

		for (let row = 0; row < 3; row += 1) {
			if (row === pivotIndex) {
				continue;
			}

			const factor = augmented[row][pivotIndex];

			for (let column = pivotIndex; column < 4; column += 1) {
				augmented[row][column] -= factor * augmented[pivotIndex][column];
			}
		}
	}

	return [augmented[0][3], augmented[1][3], augmented[2][3]];
}

/**
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 */
export function getEllipseSemiaxes(alpha, beta, gamma) {
	const trace = alpha + gamma;
	const determinant = alpha * gamma - beta * beta;
	const discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * determinant));
	const eigenvalues = [(trace + discriminant) / 2, (trace - discriminant) / 2];

	if (eigenvalues.some((value) => value <= 0)) {
		throw new Error('Recovered ellipse is not positive definite');
	}

	const semiaxes = eigenvalues.map((value) => 1 / Math.sqrt(value)).sort((left, right) => right - left);

	return {
		eigenvalues,
		major: semiaxes[0],
		minor: semiaxes[1]
	};
}

/**
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 */
export function getEllipseRotation(alpha, beta, gamma) {
	return 0.5 * Math.atan2(2 * beta, alpha - gamma);
}

/**
 * @param {{ major: number, minor: number, rotation: number }} ellipse
 * @param {number} [pointCount]
 */
export function getChromaticEllipsePoints(ellipse, pointCount = 96) {
	return Array.from({ length: pointCount }, (_, index) => {
		const theta = (index / pointCount) * Math.PI * 2;
		const baseU = ellipse.major * Math.cos(theta);
		const baseV = ellipse.minor * Math.sin(theta);
		const cosRotation = Math.cos(ellipse.rotation);
		const sinRotation = Math.sin(ellipse.rotation);

		return {
			u: baseU * cosRotation - baseV * sinRotation,
			v: baseU * sinRotation + baseV * cosRotation
		};
	});
}

/**
 * @param {{ major: number, minor: number, rotation: number }} ellipse
 */
export function getQuadraticCoefficientsFromEllipse(ellipse) {
	const { major, minor, rotation } = ellipse;
	const cosRotation = Math.cos(rotation);
	const sinRotation = Math.sin(rotation);
	const invMajorSq = 1 / (major * major);
	const invMinorSq = 1 / (minor * minor);

	return {
		alpha: invMajorSq * cosRotation * cosRotation + invMinorSq * sinRotation * sinRotation,
		beta: (invMajorSq - invMinorSq) * sinRotation * cosRotation,
		gamma: invMajorSq * sinRotation * sinRotation + invMinorSq * cosRotation * cosRotation
	};
}

/**
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 * @param {number} minimumEigenvalue
 */
export function projectToPositiveDefiniteEllipse(alpha, beta, gamma, minimumEigenvalue = 1e-9) {
	const trace = alpha + gamma;
	const determinant = alpha * gamma - beta * beta;
	const discriminant = Math.sqrt(Math.max(0, trace * trace - 4 * determinant));
	const rawEigenvalues = [(trace + discriminant) / 2, (trace - discriminant) / 2];
	const clippedEigenvalues = rawEigenvalues.map((value) => Math.max(value, minimumEigenvalue));
	const rotation = getEllipseRotation(alpha, beta, gamma);
	const major = 1 / Math.sqrt(Math.min(...clippedEigenvalues));
	const minor = 1 / Math.sqrt(Math.max(...clippedEigenvalues));
	const normalizedRotation = normalizeEllipseParameters({
		major,
		minor,
		rotation
	}).rotation;

	return {
		eigenvalues: clippedEigenvalues,
		...getQuadraticCoefficientsFromEllipse({
			major,
			minor,
			rotation: normalizedRotation
		}),
		major,
		minor,
		rotation: normalizedRotation
	};
}

/**
 * @param {{ major: number, minor: number, rotation: number }} ellipse
 */
export function normalizeEllipseParameters(ellipse) {
	let { major, minor, rotation } = ellipse;

	major = Math.max(major, 1e-9);
	minor = Math.max(minor, 1e-9);
	rotation %= Math.PI;

	if (rotation < 0) {
		rotation += Math.PI;
	}

	if (minor > major) {
		[major, minor] = [minor, major];
		rotation = (rotation + Math.PI / 2) % Math.PI;
	}

	return {
		major,
		minor,
		rotation
	};
}

/**
 * @param {{ alpha: number, beta: number, gamma: number }} coefficients
 * @param {[number, number]} direction
 */
export function predictRadiusAlongDirection(coefficients, direction) {
	const [u, v] = direction;
	const denominator =
		coefficients.alpha * u * u + 2 * coefficients.beta * u * v + coefficients.gamma * v * v;

	if (!(denominator > 0) || !Number.isFinite(denominator)) {
		return Number.POSITIVE_INFINITY;
	}

	return 1 / Math.sqrt(denominator);
}

/**
 * @param {{ major: number, minor: number, rotation: number }} ellipse
 * @param {{ 1: number, 2: number, 3: number }} targetRadii
 */
export function scoreEllipseFit(ellipse, targetRadii) {
	const normalizedEllipse = normalizeEllipseParameters(ellipse);
	const coefficients = getQuadraticCoefficientsFromEllipse(normalizedEllipse);
	const relativeErrors = [1, 2, 3].map((vector) => {
		const predictedRadius = predictRadiusAlongDirection(coefficients, RECOVERED_AXES[vector].unitUv);
		const targetRadius = targetRadii[vector];

		return (predictedRadius - targetRadius) / targetRadius;
	});
	const loss = relativeErrors.reduce((sum, error) => sum + error * error, 0);

	return {
		coefficients,
		loss,
		maxRelativeRadiusError: Math.max(...relativeErrors.map((value) => Math.abs(value))),
		relativeErrors
	};
}

/**
 * @param {{ 1: number, 2: number, 3: number }} targetRadii
 * @param {{ alpha: number, beta: number, gamma: number }} seedCoefficients
 */
export function buildFittedChromaticEllipse(targetRadii, seedCoefficients) {
	const projectedSeed = projectToPositiveDefiniteEllipse(
		seedCoefficients.alpha,
		seedCoefficients.beta,
		seedCoefficients.gamma
	);
	const radiusValues = [targetRadii[1], targetRadii[2], targetRadii[3]];
	const minRadius = Math.min(...radiusValues);
	const maxRadius = Math.max(...radiusValues);
	const minBound = Math.max(minRadius * 0.35, 1e-6);
	const maxBound = maxRadius * 3;

	function clampEllipse(ellipse) {
		const normalized = normalizeEllipseParameters(ellipse);

		return normalizeEllipseParameters({
			major: Math.min(Math.max(normalized.major, minBound), maxBound),
			minor: Math.min(Math.max(normalized.minor, minBound), maxBound),
			rotation: normalized.rotation
		});
	}

	const seedOptions = [
		clampEllipse({
			major: projectedSeed.major,
			minor: projectedSeed.minor,
			rotation: projectedSeed.rotation
		}),
		clampEllipse({
			major: maxRadius,
			minor: minRadius,
			rotation: projectedSeed.rotation
		}),
		clampEllipse({
			major: Math.max(targetRadii[1], targetRadii[3]),
			minor: Math.min(targetRadii[1], targetRadii[3]),
			rotation: 0
		})
	];
	let bestEllipse = seedOptions[0];
	let bestScore = scoreEllipseFit(bestEllipse, targetRadii);

	for (const seed of seedOptions.slice(1)) {
		const seedScore = scoreEllipseFit(seed, targetRadii);

		if (seedScore.loss < bestScore.loss) {
			bestEllipse = seed;
			bestScore = seedScore;
		}
	}

	let logMajorStep = 0.18;
	let logMinorStep = 0.18;
	let rotationStep = Math.PI / 24;

	for (let outer = 0; outer < 28; outer += 1) {
		let improved = false;
		const candidates = [
			{ major: bestEllipse.major * Math.exp(logMajorStep), minor: bestEllipse.minor, rotation: bestEllipse.rotation },
			{ major: bestEllipse.major * Math.exp(-logMajorStep), minor: bestEllipse.minor, rotation: bestEllipse.rotation },
			{ major: bestEllipse.major, minor: bestEllipse.minor * Math.exp(logMinorStep), rotation: bestEllipse.rotation },
			{ major: bestEllipse.major, minor: bestEllipse.minor * Math.exp(-logMinorStep), rotation: bestEllipse.rotation },
			{ major: bestEllipse.major, minor: bestEllipse.minor, rotation: bestEllipse.rotation + rotationStep },
			{ major: bestEllipse.major, minor: bestEllipse.minor, rotation: bestEllipse.rotation - rotationStep }
		];

		for (const candidate of candidates) {
			const normalizedCandidate = clampEllipse(candidate);
			const candidateScore = scoreEllipseFit(normalizedCandidate, targetRadii);

			if (candidateScore.loss + 1e-12 < bestScore.loss) {
				bestEllipse = normalizedCandidate;
				bestScore = candidateScore;
				improved = true;
			}
		}

		if (!improved) {
			logMajorStep *= 0.5;
			logMinorStep *= 0.5;
			rotationStep *= 0.5;

			if (Math.max(logMajorStep, logMinorStep, rotationStep) < 1e-5) {
				break;
			}
		}
	}

	return {
		ellipse: bestEllipse,
		...bestScore
	};
}

/**
 * @param {ThresholdMeanMap} thresholdMeans
 */
export function buildExactEllipsoidModelFromThresholdMeans(thresholdMeans) {
	const requiredVectors = [1, 2, 3, 4];

	for (const vector of requiredVectors) {
		const value = thresholdMeans[vector];

		if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
			return null;
		}
	}

	const radii = {
		1: thresholdMeanToRadius(thresholdMeans[1], 1),
		2: thresholdMeanToRadius(thresholdMeans[2], 2),
		3: thresholdMeanToRadius(thresholdMeans[3], 3),
		4: thresholdMeanToRadius(thresholdMeans[4], 4)
	};
	const rows = [1, 2, 3].map((vector) => {
		const [u, v] = RECOVERED_AXES[vector].unitUv;

		return [u * u, 2 * u * v, v * v];
	});
	const rhs = [1, 2, 3].map((vector) => 1 / (radii[vector] * radii[vector]));
	let coefficients;

	try {
		coefficients = solveLinear3x3(rows, rhs);
	} catch {
		return null;
	}

	const [alpha, beta, gamma] = coefficients;
	let semiaxes;

	try {
		semiaxes = getEllipseSemiaxes(alpha, beta, gamma);
	} catch {
		return null;
	}

	const lightness = radii[4];
	const rotation = getEllipseRotation(alpha, beta, gamma);
	const volume = (4 / 3) * Math.PI * semiaxes.major * semiaxes.minor * lightness;

	return {
		fitKind: /** @type {FitKind} */ ('exact'),
		fitLoss: 0,
		maxRelativeRadiusError: 0,
		chromaticRadii: Object.freeze({
			pink: radii[1],
			magenta: radii[2],
			blue: radii[3]
		}),
		coefficients: Object.freeze({
			alpha,
			beta,
			gamma
		}),
		ellipse: Object.freeze({
			major: semiaxes.major,
			minor: semiaxes.minor,
			points: getChromaticEllipsePoints({
				major: semiaxes.major,
				minor: semiaxes.minor,
				rotation
			}),
			rotation
		}),
		eigenvalues: semiaxes.eigenvalues,
		lightness,
		volume
	};
}

/**
 * @param {ThresholdMeanMap} thresholdMeans
 */
export function buildFittedEllipsoidModelFromThresholdMeans(thresholdMeans) {
	const requiredVectors = [1, 2, 3, 4];

	for (const vector of requiredVectors) {
		const value = thresholdMeans[vector];

		if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
			return null;
		}
	}

	const radii = {
		1: thresholdMeanToRadius(thresholdMeans[1], 1),
		2: thresholdMeanToRadius(thresholdMeans[2], 2),
		3: thresholdMeanToRadius(thresholdMeans[3], 3),
		4: thresholdMeanToRadius(thresholdMeans[4], 4)
	};
	const rows = [1, 2, 3].map((vector) => {
		const [u, v] = RECOVERED_AXES[vector].unitUv;

		return [u * u, 2 * u * v, v * v];
	});
	const rhs = [1, 2, 3].map((vector) => 1 / (radii[vector] * radii[vector]));
	let coefficients;

	try {
		coefficients = solveLinear3x3(rows, rhs);
	} catch {
		coefficients = [1 / (radii[1] * radii[1]), 0, 1 / (radii[3] * radii[3])];
	}

	const fittedChromaticEllipse = buildFittedChromaticEllipse(
		{
			1: radii[1],
			2: radii[2],
			3: radii[3]
		},
		{
			alpha: coefficients[0],
			beta: coefficients[1],
			gamma: coefficients[2]
		}
	);
	const normalizedEllipse = normalizeEllipseParameters(fittedChromaticEllipse.ellipse);
	const normalizedCoefficients = getQuadraticCoefficientsFromEllipse(normalizedEllipse);
	const lightness = radii[4];
	const volume = (4 / 3) * Math.PI * normalizedEllipse.major * normalizedEllipse.minor * lightness;

	return {
		fitKind: /** @type {FitKind} */ ('fitted'),
		fitLoss: fittedChromaticEllipse.loss,
		maxRelativeRadiusError: fittedChromaticEllipse.maxRelativeRadiusError,
		chromaticRadii: Object.freeze({
			pink: radii[1],
			magenta: radii[2],
			blue: radii[3]
		}),
		coefficients: Object.freeze(normalizedCoefficients),
		ellipse: Object.freeze({
			major: normalizedEllipse.major,
			minor: normalizedEllipse.minor,
			points: getChromaticEllipsePoints(normalizedEllipse),
			rotation: normalizedEllipse.rotation
		}),
		eigenvalues: Object.freeze([
			1 / (normalizedEllipse.minor * normalizedEllipse.minor),
			1 / (normalizedEllipse.major * normalizedEllipse.major)
		]),
		lightness,
		volume
	};
}

/**
 * @param {ThresholdMeanMap} thresholdMeans
 */
export function buildEllipsoidModelFromThresholdMeans(thresholdMeans) {
	return buildExactEllipsoidModelFromThresholdMeans(thresholdMeans);
}

/**
 * @param {number[]} thresholds
 */
export function computeEllipsoidProxyVolume(thresholds) {
	return mean(thresholds) ** 3;
}

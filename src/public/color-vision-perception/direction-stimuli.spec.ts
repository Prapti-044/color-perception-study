import { describe, expect, test } from 'vitest';
import {
  computeNextLocation,
  computeThreshold,
  randomDirection,
  randomEasyStep,
  randomVector,
  TrialResult,
} from './direction-stimuli';

// ─── randomDirection ──────────────────────────────────────────────────────────

describe('randomDirection', () => {
  test('returns an integer between 1 and 8 inclusive', () => {
    for (let i = 0; i < 200; i += 1) {
      const d = randomDirection();
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(8);
      expect(Number.isInteger(d)).toBe(true);
    }
  });
});

// ─── randomVector ─────────────────────────────────────────────────────────────

describe('randomVector', () => {
  test('returns an integer between 0 and 3 inclusive', () => {
    for (let i = 0; i < 200; i += 1) {
      const v = randomVector();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(3);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

// ─── randomEasyStep ───────────────────────────────────────────────────────────

describe('randomEasyStep', () => {
  test('returns an integer between 140 and 185 inclusive', () => {
    for (let i = 0; i < 200; i += 1) {
      const s = randomEasyStep();
      expect(s).toBeGreaterThanOrEqual(140);
      expect(s).toBeLessThanOrEqual(185);
      expect(Number.isInteger(s)).toBe(true);
    }
  });
});

// ─── computeNextLocation ──────────────────────────────────────────────────────

describe('computeNextLocation', () => {
  const MAX = 185;

  // ── Correct answer (search left / harder) ──

  test('correct at starting location with no prior tests → midpoint to 0', () => {
    const next = computeNextLocation([], 175, true, MAX);
    // midpoint of 175 and 0 = 88 (rounded)
    expect(next).toBe(88);
  });

  test('correct → searches toward lower neighbor', () => {
    // Previously tested at 50 and 100. Correct at 100 → neighbor below is 50.
    const next = computeNextLocation([50, 100], 100, true, MAX);
    // midpoint of 100 and 50 = 75
    expect(next).toBe(75);
  });

  test('correct → converges when gap to lower neighbor is 1', () => {
    const next = computeNextLocation([99], 100, true, MAX);
    // gap is 1 → converged
    expect(next).toBeNull();
  });

  test('correct with current already tested → still searches left toward 0', () => {
    const next = computeNextLocation([100], 100, true, MAX);
    // deduped sorted = [100], lower neighbor = 0, gap = 100 → midpoint 50
    expect(next).toBe(50);
  });

  test('correct at location 1 → converges (gap to 0 is 1)', () => {
    const next = computeNextLocation([], 1, true, MAX);
    // lower neighbor is 0, gap = 1 → converged
    expect(next).toBeNull();
  });

  // ── Wrong answer (search right / easier) ──

  test('wrong at starting location with no prior tests → midpoint to maxLocation', () => {
    const next = computeNextLocation([], 100, false, MAX);
    // midpoint of 100 and 185 = 143 (rounded)
    expect(next).toBe(143);
  });

  test('wrong → searches toward upper neighbor', () => {
    // Previously tested at 50 and 150. Wrong at 50 → neighbor above is 150.
    const next = computeNextLocation([50, 150], 50, false, MAX);
    // midpoint of 50 and 150 = 100
    expect(next).toBe(100);
  });

  test('wrong → converges when gap to upper neighbor is 1', () => {
    const next = computeNextLocation([101], 100, false, MAX);
    // gap is 1 → converged
    expect(next).toBeNull();
  });

  test('wrong at maxLocation - 1 → converges (gap to maxLocation is 1)', () => {
    const next = computeNextLocation([], 184, false, MAX);
    // upper neighbor is 185, gap = 1 → converged
    expect(next).toBeNull();
  });

  // ── Full staircase simulation ──

  test('simulates a realistic staircase converging in finite steps', () => {
    const tested: number[] = [];
    let location = 175;
    let steps = 0;
    const maxSteps = 50;

    // Simulate: correct when location >= 100, wrong otherwise
    while (steps < maxSteps) {
      const correct = location >= 100;
      tested.push(location);
      const next = computeNextLocation(tested, location, correct, MAX);
      if (next === null) break;
      location = next;
      steps += 1;
    }

    expect(steps).toBeLessThan(maxSteps);
    expect(steps).toBeGreaterThan(0);
  });

  // ── Edge cases ──

  test('handles duplicate tested locations gracefully', () => {
    const next = computeNextLocation([100, 100, 50], 100, true, MAX);
    // lower neighbor is 50, midpoint = 75
    expect(next).toBe(75);
  });

  test('handles unsorted tested locations', () => {
    const next = computeNextLocation([150, 50, 100], 100, true, MAX);
    // lower neighbor is 50, midpoint = 75
    expect(next).toBe(75);
  });

  test('wrong at location 0 → midpoint to smallest above', () => {
    const next = computeNextLocation([0, 100], 0, false, MAX);
    // upper neighbor is 100, midpoint = 50
    expect(next).toBe(50);
  });
});

// ─── computeThreshold ─────────────────────────────────────────────────────────

describe('computeThreshold', () => {
  const MAX = 185;

  const makeTrial = (location: number, correct: boolean): TrialResult => ({
    location,
    direction: 1,
    response: 'mid-right',
    correct,
    responseTimeMs: 500,
  });

  test('returns smallest correct location', () => {
    const guesses: TrialResult[] = [
      makeTrial(175, true),
      makeTrial(88, false),
      makeTrial(131, true),
      makeTrial(109, true),
      makeTrial(98, false),
      makeTrial(104, true),
      makeTrial(101, true),
      makeTrial(99, false),
    ];

    expect(computeThreshold(guesses, MAX)).toBe(101);
  });

  test('returns maxLocation when no correct answers exist', () => {
    const guesses: TrialResult[] = [
      makeTrial(175, false),
      makeTrial(180, false),
    ];

    expect(computeThreshold(guesses, MAX)).toBe(MAX);
  });

  test('returns the single correct location', () => {
    const guesses: TrialResult[] = [
      makeTrial(175, true),
      makeTrial(88, false),
    ];

    expect(computeThreshold(guesses, MAX)).toBe(175);
  });

  test('handles all-correct guesses', () => {
    const guesses: TrialResult[] = [
      makeTrial(175, true),
      makeTrial(88, true),
      makeTrial(44, true),
    ];

    expect(computeThreshold(guesses, MAX)).toBe(44);
  });

  test('handles empty guesses array', () => {
    expect(computeThreshold([], MAX)).toBe(MAX);
  });
});

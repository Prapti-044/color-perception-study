import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import Color from 'colorjs.io';
import { StimulusParams } from '../../store/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The 8 named directions a participant can click */
type Direction = 'top-left' | 'top-mid' | 'top-right' | 'mid-left' | 'mid-right' | 'bottom-left' | 'bottom-mid' | 'bottom-right';

/** A participant response is either a direction or "can't tell" */
type Response = Direction | 'cant-tell';

/** Phases of a single adaptive set (or practice) */
type Phase = 'trial' | 'inter-trial' | 'feedback' | 'complete';

/** One recorded trial within an adaptive set */
export interface TrialResult {
  location: number;
  direction: number;
  response: string;
  correct: boolean;
  responseTimeMs: number;
}

/** Parameters passed from the study config */
interface DirectionStimuliParams {
  vector: number;
  startingLocation: number;
  maxLocation?: number;
  setIndex?: number;
  totalSets?: number;
  /** When true, runs in unlimited practice mode with feedback and easy stimuli */
  practice?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_LOCATION = 185;
const INTER_TRIAL_DELAY_MS = 500;
const FEEDBACK_DELAY_MS = 2000;

/** Practice mode uses easy (high-contrast) step values in this range */
const PRACTICE_EASY_MIN_STEP = 140;
const PRACTICE_EASY_MAX_STEP = 185;

/**
 * Mapping from direction number (1-8) to named Direction.
 * direction 1 = 0° (right), direction 2 = 45° (bottom-right in SVG), etc.
 */
const CORRECT_ANSWERS: Record<number, Direction> = {
  1: 'mid-right',
  2: 'bottom-right',
  3: 'bottom-mid',
  4: 'bottom-left',
  5: 'mid-left',
  6: 'top-left',
  7: 'top-mid',
  8: 'top-right',
};

type VEC = [number, number, number];

// Vectors in RGB matching the reference Stimuli component
const VECTORS_IN_RGB: VEC[] = [
  [1, 0, 0], // Red
  [0, 0, 1], // Blue
  [1, 0, 1], // Magenta (Purple)
  [1, 1, 1], // White
];

// Pre-compute LUV vectors from the RGB vectors
const VECTORS_IN_LUV: VEC[] = VECTORS_IN_RGB.map((rgb) => {
  const color = new Color('srgb', rgb).to('luv');
  return [color.luv.l, color.luv.u, color.luv.v] as VEC;
});

const LUV_MIDPOINT: VEC = [50, 0, 0];

const NUMBER_CIRCLES_PER_ROW = 50;
const RADIUS = 5;
const SVG_WIDTH = RADIUS * 2 * NUMBER_CIRCLES_PER_ROW;
const SVG_HEIGHT = RADIUS * 2 * NUMBER_CIRCLES_PER_ROW;

// ─── Pure helpers (exported for testing) ──────────────────────────────────────

function interpolate3D(start: VEC, end: VEC, t: number): VEC {
  return [
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ];
}

/** Pick a random integer direction in [1, 8] */
export function randomDirection(): number {
  return Math.floor(Math.random() * 8) + 1;
}

/** Pick a random vector index in [0, 3] */
export function randomVector(): number {
  return Math.floor(Math.random() * VECTORS_IN_RGB.length);
}

/** Pick a random easy step value for practice trials */
export function randomEasyStep(): number {
  return (
    Math.floor(
      Math.random() * (PRACTICE_EASY_MAX_STEP - PRACTICE_EASY_MIN_STEP + 1),
    ) + PRACTICE_EASY_MIN_STEP
  );
}

/**
 * Adaptive bisection staircase: compute the next location to test.
 *
 * After a **correct** answer at `currentLocation`, the search moves toward
 * harder (lower) values.  After a **wrong** answer it moves toward easier
 * (higher) values.  The search converges when the gap between adjacent
 * tested values is <= 1.
 *
 * @returns The next location, or `null` when the search has converged.
 */
export function computeNextLocation(
  testedLocations: number[],
  currentLocation: number,
  wasCorrect: boolean,
  maxLocation: number,
): number | null {
  const sorted = [...new Set([...testedLocations, currentLocation])].sort(
    (a, b) => a - b,
  );

  if (wasCorrect) {
    // Search left (harder): find the largest value below currentLocation
    const lowerValues = sorted.filter((l) => l < currentLocation);
    const lowerNeighbor = lowerValues.length > 0
      ? lowerValues[lowerValues.length - 1]
      : 0;

    if (currentLocation - lowerNeighbor <= 1) return null; // converged
    return Math.round((currentLocation + lowerNeighbor) / 2);
  }

  // Search right (easier): find the smallest value above currentLocation
  const higherValues = sorted.filter((l) => l > currentLocation);
  const upperNeighbor = higherValues.length > 0 ? higherValues[0] : maxLocation;

  if (upperNeighbor - currentLocation <= 1) return null; // converged
  return Math.round((currentLocation + upperNeighbor) / 2);
}

/**
 * Compute the threshold from a completed set of guesses.
 * Threshold = smallest location where the participant answered correctly.
 * If no correct answers exist, returns `maxLocation` (worst case).
 */
export function computeThreshold(
  guesses: TrialResult[],
  maxLocation: number,
): number {
  const correctLocations = guesses
    .filter((g) => g.correct)
    .map((g) => g.location);

  if (correctLocations.length === 0) return maxLocation;
  return Math.min(...correctLocations);
}

// ─── SVG stimulus generation ──────────────────────────────────────────────────

/**
 * Generate the array of rect fill colors for the stimuli SVG.
 * Each call produces fresh random lightness perturbation so the participant
 * cannot memorize the noise pattern across trials.
 */
function generateStimuliRects(
  direction: number,
  step: number,
  vector: number,
): { x: number; y: number; fill: string }[] {
  const directionAngle = (360 / 8) * (direction - 1);
  const directionRadians = (directionAngle * Math.PI) / 180;
  const rayDirX = Math.cos(directionRadians);
  const rayDirY = Math.sin(directionRadians);

  const interpolatedColor = interpolate3D(
    LUV_MIDPOINT,
    VECTORS_IN_LUV[vector],
    step / 185,
  );

  const rects: { x: number; y: number; fill: string }[] = [];

  for (let i = 0; i < NUMBER_CIRCLES_PER_ROW; i += 1) {
    for (let j = 0; j < NUMBER_CIRCLES_PER_ROW; j += 1) {
      const distX = i - NUMBER_CIRCLES_PER_ROW / 2;
      const distY = j - NUMBER_CIRCLES_PER_ROW / 2;
      const dist = Math.sqrt(distX * distX + distY * distY);
      const inRing = dist >= 12 && dist < 19;

      const CUTOUT_DIST = 5;
      const perpDist = Math.abs(distX * rayDirY - distY * rayDirX);
      const dotProduct = distX * rayDirX + distY * rayDirY;
      const angleWithinCutout = perpDist <= CUTOUT_DIST && dotProduct > 0;

      const inC = inRing && !angleWithinCutout;
      const color = new Color('luv', inC ? interpolatedColor : LUV_MIDPOINT);
      const labColor = new Color(color).to('luv');

      const lightnessPerturb = Math.random() * 20 - 10;
      labColor.luv.l = Math.min(
        100,
        Math.max(0, (labColor.luv?.l || 0) + lightnessPerturb),
      );
      const outputColor = labColor.to('srgb').toString();

      rects.push({
        x: i * RADIUS * 2,
        y: j * RADIUS * 2,
        fill: outputColor,
      });
    }
  }

  return rects;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DirectionStimuli({
  parameters,
  setAnswer,
}: StimulusParams<DirectionStimuliParams>) {
  const {
    vector,
    startingLocation,
    maxLocation = DEFAULT_MAX_LOCATION,
    setIndex,
    totalSets,
    practice = false,
  } = parameters;

  // ── State ─────────────────────────────────────────────────────────────────

  const [currentLocation, setCurrentLocation] = useState<number>(
    practice ? randomEasyStep : startingLocation,
  );
  const [currentDirection, setCurrentDirection] = useState<number>(randomDirection);
  const [currentVector, setCurrentVector] = useState<number>(
    practice ? randomVector : vector,
  );
  const [guesses, setGuesses] = useState<TrialResult[]>([]);
  const [phase, setPhase] = useState<Phase>('trial');

  /** Timestamp of when the current trial was presented */
  const trialStartTime = useRef<number>(Date.now());

  /** Stores the next location to show after the inter-trial delay */
  const nextLocationRef = useRef<number | null>(null);

  // ── Feedback state (practice mode only) ───────────────────────────────────

  /** The response the participant chose on the current feedback trial */
  const [feedbackResponse, setFeedbackResponse] = useState<Response | null>(null);

  /** The correct Direction for the current feedback trial */
  const [feedbackCorrectDir, setFeedbackCorrectDir] = useState<Direction | null>(null);

  /** Whether the participant's response was correct */
  const [feedbackIsCorrect, setFeedbackIsCorrect] = useState<boolean>(false);

  // ── Effects ───────────────────────────────────────────────────────────────

  // In practice mode, enable the Next button immediately so the participant
  // can leave whenever they feel ready.
  useEffect(() => {
    if (practice) {
      setAnswer({
        status: true,
        provenanceGraph: undefined,
        answers: {
          'direction-response': 'practice',
          'practice-trials': 0,
        },
      });
    }
  // Run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset trial timer whenever we enter a new trial
  useEffect(() => {
    if (phase === 'trial') {
      trialStartTime.current = Date.now();
    }
  }, [phase, currentDirection, currentLocation]);

  // Handle the inter-trial delay (real mode) with proper cleanup
  useEffect(() => {
    if (phase !== 'inter-trial') return undefined;

    const timer = setTimeout(() => {
      if (nextLocationRef.current !== null) {
        setCurrentLocation(nextLocationRef.current);
        setCurrentDirection(randomDirection());
        nextLocationRef.current = null;
      }
      setPhase('trial');
    }, INTER_TRIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  // Handle the feedback delay (practice mode): show feedback, then advance
  useEffect(() => {
    if (phase !== 'feedback') return undefined;

    const timer = setTimeout(() => {
      // Generate fresh random params for the next practice trial
      setCurrentDirection(randomDirection());
      setCurrentVector(randomVector());
      setCurrentLocation(randomEasyStep());
      setFeedbackResponse(null);
      setFeedbackCorrectDir(null);
      setPhase('trial');
    }, FEEDBACK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  // ── Derived values ────────────────────────────────────────────────────────

  // In practice mode the vector changes per trial; in real mode it's fixed.
  const activeVector = practice ? currentVector : vector;

  // Memoize stimulus SVG rects for the current trial
  const rects = useMemo(
    () => generateStimuliRects(currentDirection, currentLocation, activeVector),
    [currentDirection, currentLocation, activeVector],
  );

  // ── Process a participant response ────────────────────────────────────────

  const handleResponse = useCallback(
    (response: Response) => {
      if (phase !== 'trial') return; // ignore clicks during feedback / inter-trial / complete

      const correctAnswer = CORRECT_ANSWERS[currentDirection];
      const isCorrect = response !== 'cant-tell' && response === correctAnswer;
      const responseTimeMs = Date.now() - trialStartTime.current;

      const trial: TrialResult = {
        location: currentLocation,
        direction: currentDirection,
        response,
        correct: isCorrect,
        responseTimeMs,
      };

      const updatedGuesses = [...guesses, trial];
      setGuesses(updatedGuesses);

      if (practice) {
        // Practice mode: show feedback, then auto-advance
        setFeedbackResponse(response);
        setFeedbackCorrectDir(correctAnswer);
        setFeedbackIsCorrect(isCorrect);
        setPhase('feedback');

        // Update answer with practice trial count so the data records it
        setAnswer({
          status: true,
          provenanceGraph: undefined,
          answers: {
            'direction-response': 'practice',
            'practice-trials': updatedGuesses.length,
          },
        });
      } else {
        // Real mode: adaptive staircase
        const testedLocations = updatedGuesses.map((g) => g.location);
        const nextLocation = computeNextLocation(
          testedLocations,
          currentLocation,
          isCorrect,
          maxLocation,
        );

        if (nextLocation === null) {
          // Converged – compute threshold and report results
          const threshold = computeThreshold(updatedGuesses, maxLocation);

          setPhase('complete');
          setAnswer({
            status: true,
            provenanceGraph: undefined,
            answers: {
              'direction-response': threshold,
              threshold,
              vector,
              'set-index': setIndex ?? 0,
              'trial-count': updatedGuesses.length,
              guesses: JSON.stringify(updatedGuesses),
            },
          });
        } else {
          // Store next location and transition through inter-trial blank
          nextLocationRef.current = nextLocation;
          setPhase('inter-trial');
        }
      }
    },
    [
      phase, practice, currentDirection, currentLocation, guesses,
      maxLocation, setAnswer, setIndex, vector,
    ],
  );

  // ── Direction button ──────────────────────────────────────────────────────

  const directionsBasePath = '/color-vision-perception/assets/directions';

  /**
   * Compute the border style for a direction button.
   * During the feedback phase in practice mode, highlight correct / incorrect.
   */
  const getButtonBorder = (dir: Direction): string => {
    if (phase !== 'feedback') return '3px solid transparent';
    if (dir === feedbackCorrectDir) return '3px solid #2ecc71'; // green = correct
    if (dir === feedbackResponse && !feedbackIsCorrect) return '3px solid #e74c3c'; // red = wrong
    return '3px solid transparent';
  };

  const DirectionButton = ({ direction: dir }: { direction: Direction }) => (
    <button
      type="button"
      onClick={() => handleResponse(dir)}
      disabled={phase !== 'trial'}
      style={{
        background: 'transparent',
        border: getButtonBorder(dir),
        borderRadius: '8px',
        cursor: phase === 'trial' ? 'pointer' : 'default',
        padding: '4px',
        opacity: phase === 'trial' || phase === 'feedback' ? 1 : 0.5,
        transition: 'border-color 0.2s ease, opacity 0.2s ease',
      }}
    >
      <img
        src={`${directionsBasePath}/${dir}.svg`}
        alt={`Direction: ${dir}`}
        style={{ width: '60px', height: '60px', display: 'block' }}
      />
    </button>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  // Inter-trial blank screen (fixation dot) — real mode only
  if (phase === 'inter-trial') {
    return (
      <div
        style={{
          width: '100%',
          height: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#999',
          }}
        />
      </div>
    );
  }

  // Set complete screen — real mode only
  if (phase === 'complete') {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          paddingTop: '4rem',
        }}
      >
        <h2
          style={{
            color: '#3b6178',
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}
        >
          Set complete!
        </h2>
        <p style={{ color: '#888', fontSize: '1rem' }}>
          Completed
          {' '}
          {guesses.length}
          {' '}
          trials. Click Next to continue.
        </p>
      </div>
    );
  }

  // ── Active trial / feedback ───────────────────────────────────────────────

  const feedbackText = phase === 'feedback'
    ? (feedbackIsCorrect ? 'Correct!' : `Incorrect! The opening was ${feedbackCorrectDir?.replace('-', ' ') ?? ''}.`)
    : null;

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        paddingTop: '2rem',
      }}
    >
      {/* Title */}
      <h2
        style={{
          color: '#3b6178',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          margin: 0,
        }}
      >
        {practice ? 'Practice — Find the opening of the circle!' : 'Find the opening of the circle!'}
      </h2>

      {/* Counters and practice hint */}
      <div style={{ textAlign: 'center' }}>
        {!practice && setIndex !== undefined && totalSets !== undefined && (
          <p
            style={{
              color: '#888',
              fontSize: '1rem',
              margin: '0.25rem 0',
              fontStyle: 'italic',
            }}
          >
            Set
            {' '}
            {setIndex}
            {' '}
            of
            {' '}
            {totalSets}
          </p>
        )}
        {practice && (
          <p
            style={{
              color: '#888',
              fontSize: '0.875rem',
              margin: '0.25rem 0',
              fontStyle: 'italic',
            }}
          >
            Try as many as you like. Click
            {' '}
            <strong>Next</strong>
            {' '}
            when you feel ready.
          </p>
        )}
        <p
          style={{
            color: '#aaa',
            fontSize: '0.875rem',
            margin: '0.25rem 0',
          }}
        >
          Trial
          {' '}
          {guesses.length + 1}
        </p>
      </div>

      {/* Feedback banner (practice mode) */}
      {feedbackText && (
        <p
          style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            margin: '0.25rem 0',
            color: feedbackIsCorrect ? '#2ecc71' : '#e74c3c',
          }}
        >
          {feedbackText}
        </p>
      )}

      {/* Container for grid and "I can't tell!" button */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '2rem',
          marginTop: '1rem',
        }}
      >
        {/* Main grid with center stimuli and direction buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto auto auto',
            gridTemplateRows: 'auto auto auto',
            gap: '10px',
            alignItems: 'center',
            justifyItems: 'center',
          }}
        >
          {/* Top row */}
          <DirectionButton direction="top-left" />
          <DirectionButton direction="top-mid" />
          <DirectionButton direction="top-right" />

          {/* Middle row */}
          <DirectionButton direction="mid-left" />

          {/* Center stimuli SVG */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '350px',
              maxHeight: '350px',
            }}
          >
            <svg
              width={SVG_WIDTH + 10}
              height={SVG_HEIGHT + 10}
              viewBox={`0 0 ${SVG_WIDTH + 10} ${SVG_HEIGHT + 10}`}
              style={{ maxWidth: '350px', maxHeight: '350px', display: 'block' }}
            >
              <rect width={SVG_WIDTH + 5} height={SVG_HEIGHT + 5} fill="black" />
              <g transform="translate(5, 5)">
                {rects.map((r) => (
                  <rect
                    key={`${r.x}-${r.y}`}
                    x={r.x}
                    y={r.y}
                    width={RADIUS}
                    height={RADIUS}
                    fill={r.fill}
                  />
                ))}
              </g>
            </svg>
          </div>

          <DirectionButton direction="mid-right" />

          {/* Bottom row */}
          <DirectionButton direction="bottom-left" />
          <DirectionButton direction="bottom-mid" />
          <DirectionButton direction="bottom-right" />
        </div>

        {/* "I can't tell!" button */}
        <button
          type="button"
          onClick={() => handleResponse('cant-tell')}
          disabled={phase !== 'trial'}
          style={{
            marginLeft: '4rem',
            padding: '7px 4px',
            fontSize: '1rem',
            border: '6px solid black',
            backgroundColor: 'black',
            color: 'white',
            cursor: phase === 'trial' ? 'pointer' : 'default',
            opacity: phase === 'trial' ? 1 : 0.5,
            transition: 'all 0.2s ease',
          }}
        >
          I CAN&apos;T TELL!
        </button>
      </div>
    </div>
  );
}

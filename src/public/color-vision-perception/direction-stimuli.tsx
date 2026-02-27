import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { type JsonValue, StimulusParams } from '../../store/types';
import { useCurrentIdentifier } from '../../routes/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The 8 named directions a participant can click */
type Direction = 'top-left' | 'top-mid' | 'top-right' | 'mid-left' | 'mid-right' | 'bottom-left' | 'bottom-mid' | 'bottom-right';

/** A participant response is either a direction or "can't tell" */
type Response = Direction | 'cant-tell';

/** Phases of a single adaptive set (or practice) */
type Phase = 'trial' | 'feedback' | 'complete';

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
  maxLocation: number;
  setIndex?: number;
  totalSets?: number;
  /** When true, runs in unlimited practice mode with feedback and easy stimuli */
  practice?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEEDBACK_DELAY_MS = 2000;

/** Practice mode samples across full range (hardest to easiest). */
const PRACTICE_MIN_STEP = 50;
const PRACTICE_MAX_STEP = 106;

/**
 * vector 1 range is 0-166 steps.
 * vector 2 range is 0-134 steps.
 * vector 3 range is 0-174 steps.
 * vector 4 range is 0-106 steps.
 */

const CORRECT_ANSWERS: Record<number, Direction> = {
  0: 'bottom-mid',
  1: 'bottom-left',
  2: 'bottom-right',
  3: 'mid-left',
  4: 'mid-right',
  5: 'top-left',
  6: 'top-right',
  7: 'top-mid',
};

const PUBLIC_BASE_PATH = '/color-perception-study';  // for github pages
// const PUBLIC_BASE_PATH = 'http://localhost:8080/'; // for local development
const STIMULI_BASE_PATH = `${PUBLIC_BASE_PATH}/color-vision-perception/assets/stimuli`;

// ─── Pure helpers (exported for testing) ──────────────────────────────────────

/** Pick a random integer direction index in [0, 7] */
export function randomDirection(): number {
  return Math.floor(Math.random() * 8);
}

const NUM_VECTORS = 4;

/** Pick a random vector index in [1, 4] */
export function randomVector(): number {
  return Math.floor(Math.random() * NUM_VECTORS) + 1;
}

/** Pick a random step value across full practice range */
export function randomPracticeStep(): number {
  return (
    Math.floor(
      Math.random() * (PRACTICE_MAX_STEP - PRACTICE_MIN_STEP + 1),
    ) + PRACTICE_MIN_STEP
  );
}

/**
 * Adaptive bisection staircase: compute the next location to test.
 *
 * Uses the participant's full response history to maintain bounds:
 * - lower bound = highest location ever answered wrong
 * - upper bound = lowest location ever answered correct
 * The next test is the midpoint of [lower, upper], so:
 * - a correct response always pushes the search lower
 * - a wrong response always pushes the search higher
 * Search converges when upper - lower <= 1.
 *
 * @returns The next location, or `null` when the search has converged.
 */
export function computeNextLocation(
  guesses: TrialResult[],
  maxLocation: number,
): number | null {
  const wrongLocations = guesses
    .filter((g) => !g.correct)
    .map((g) => g.location);
  const correctLocations = guesses
    .filter((g) => g.correct)
    .map((g) => g.location);

  // Lower bound = largest known-wrong location; Upper bound = smallest known-correct.
  const lowerBound = wrongLocations.length > 0 ? Math.max(...wrongLocations) : 0;
  const upperBound = correctLocations.length > 0 ? Math.min(...correctLocations) : maxLocation;

  if (upperBound - lowerBound <= 1) return null; // converged
  return Math.floor((lowerBound + upperBound) / 2);
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DirectionStimuli({
  parameters,
  setAnswer,
}: StimulusParams<DirectionStimuliParams>) {
  const {
    vector,
    maxLocation,
    setIndex,
    totalSets,
    practice = false,
  } = parameters;

  // ── State ─────────────────────────────────────────────────────────────────

  const identifier = useCurrentIdentifier();
  const currentTrialIndex = parseInt(identifier.split('_')[1], 10);
  const currentSetIndex = currentTrialIndex > 10 ? currentTrialIndex - 4 : currentTrialIndex - 3;

  const [currentLocation, setCurrentLocation] = useState<number>(
    practice ? randomPracticeStep : () => Math.round(maxLocation / 2),
  );
  const [currentDirection, setCurrentDirection] = useState<number>(randomDirection);
  const [currentVector, setCurrentVector] = useState<number>(
    practice ? randomVector : vector,
  );
  const [guesses, setGuesses] = useState<TrialResult[]>([]);
  const [phase, setPhase] = useState<Phase>('trial');

  /** Timestamp of when the current trial was presented */
  const trialStartTime = useRef<number>(Date.now());

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

  // Handle the feedback delay (practice mode): show feedback, then advance
  useEffect(() => {
    if (phase !== 'feedback') return undefined;

    const timer = setTimeout(() => {
      // Generate fresh random params for the next practice trial
      setCurrentDirection(randomDirection());
      setCurrentVector(randomVector());
      setCurrentLocation(randomPracticeStep());
      setFeedbackResponse(null);
      setFeedbackCorrectDir(null);
      setPhase('trial');
    }, FEEDBACK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  // ── Derived values ────────────────────────────────────────────────────────

  // In practice mode the vector changes per trial; in real mode it's fixed.
  const activeVector = practice ? currentVector : vector;

  // File naming: vector is 1-indexed and direction is 0-indexed.
  const stimulusPath = `${STIMULI_BASE_PATH}/${activeVector}-${currentLocation}-${currentDirection}.png`;

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
        const nextLocation = computeNextLocation(updatedGuesses, maxLocation);

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
              guesses: updatedGuesses as unknown as JsonValue[],
            },
          });
        } else {
          const nextDir = randomDirection();
          // Preload the next stimulus so it appears instantly on re-render
          const img = new Image();
          img.src = `${STIMULI_BASE_PATH}/${activeVector}-${nextLocation}-${nextDir}.png`;
          setCurrentLocation(nextLocation);
          setCurrentDirection(nextDir);
        }
      }
    },
    [
      phase, practice, currentDirection, currentLocation, guesses,
      maxLocation, setAnswer, setIndex, vector,
    ],
  );

  // ── Direction button ──────────────────────────────────────────────────────

  const directionsBasePath = `${PUBLIC_BASE_PATH}/color-vision-perception/assets/directions`;

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
      onClick={() => {
        handleResponse(dir);
      }}
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
      <h2
        style={{
          color: 'blue',
          fontSize: '1.25rem',
          fontWeight: 700,
          margin: '0 0 0.5rem 0',
        }}
      >
        Find the opening of the circle
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
            {currentSetIndex}
            {' '}
            of
            {' '}
            {totalSets}
          </p>
        )}
        {practice && (
          <div
            style={{
              marginTop: '0.75rem',
              maxWidth: '56rem',
              textAlign: 'left',
              color: '#666',
              fontSize: '0.95rem',
              lineHeight: 1.5,
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#3b6178',
              }}
            >
              Practice Interface
            </h2>
            <h3
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#3b6178',
              }}
            >
              How the trials work
            </h3>
            <p style={{ margin: '0.25rem 0' }}>
              We will show you a colored image with a circle in it, your task is to identify where the{' '}
              <strong><em>opening of the circle is in the image.</em></strong>
            </p>
            <p style={{ margin: '1.2rem 0 0.25rem 0' }}>
              Click on the button on the side that you think the opening is to move on to the next image.
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              If you can&apos;t tell where the opening of the circle is, click on the <strong style={{ color: 'blue' }}>I CAN&apos;T TELL!</strong> button to the bottom
              right.
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              Try to answer each one as fast as you can. There will be 12 sets of images.
            </p>
            <p style={{ margin: '1rem 0 0.25rem 0' }}>
              The trials will look something like this.
            </p>
            <p style={{ margin: '1rem 0', fontStyle: 'italic' }}>
              Click on your guess and see how you do!
            </p>
            <p
              style={{
                color: '#888',
                fontSize: '1rem',
                margin: '0.75rem 0 0.25rem 0',
                fontStyle: 'italic',
              }}
            >
              Try as many as you like. Click
              {' '}
              <strong>Next</strong>
              {' '}
              when you feel ready to proceed to the main study.
            </p>
          </div>
        )}
        <p
          style={{
            color: '#aaa',
            fontSize: '0.875rem',
            margin: '0.25rem 0',
          }}
        >
          Set
          {' '}
          {currentSetIndex + 1}
          {' '}
          out of
          {' '}
          {totalSets}
        </p>
      </div>

      {/* Feedback banner (practice mode) — always reserve space to keep stimuli fixed */}
      {practice && (
        <div
          style={{
            minHeight: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0.25rem 0',
          }}
          aria-live="polite"
        >
          {feedbackText ? (
            <p
              style={{
                fontSize: '1.125rem',
                fontWeight: 'bold',
                margin: 0,
                color: feedbackIsCorrect ? '#2ecc71' : '#e74c3c',
              }}
            >
              {feedbackText}
            </p>
          ) : (
            <span style={{ visibility: 'hidden', fontSize: '1.125rem', fontWeight: 'bold' }}>
              Correct!
            </span>
          )}
        </div>
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

          {/* Center stimulus image */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '350px',
              maxHeight: '350px',
            }}
          >
            <img
              src={stimulusPath}
              alt="Color stimulus"
              style={{ maxWidth: '350px', maxHeight: '350px', display: 'block' }}
            />
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
    {/* Debug: print stimulusPath */}
    {/* <div style={{ marginTop: '1rem', fontSize: '0.90em', color: '#888' }}>
      stimulusPath: <code>{stimulusPath}</code>
    </div> */}
    </div>
  );
}

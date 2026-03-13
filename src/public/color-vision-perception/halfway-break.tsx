import { useState } from 'react';
import { StimulusParams } from '../../store/types';
import { useNextStep } from '../../store/hooks/useNextStep';

type Direction =
  | 'top-left'
  | 'top-mid'
  | 'top-right'
  | 'mid-left'
  | 'mid-right'
  | 'bottom-left'
  | 'bottom-mid'
  | 'bottom-right';

interface HalfwayBreakParams {}

const PUBLIC_BASE_PATH = '/color-perception-study'; //github_pages
// const PUBLIC_BASE_PATH = 'http://localhost:8080/'; // for local development
const HALFWAY_BASE_PATH = `${PUBLIC_BASE_PATH}/color-vision-perception/assets/halfway_pics`;
const SQUIRREL_IMG_PATH = `${PUBLIC_BASE_PATH}/color-vision-perception/assets/squirrel.jpg`;

const CORRECT_DIRECTIONS: Direction[] = ['bottom-left', 'bottom-mid'];

export default function HalfwayBreak({
  setAnswer,
}: StimulusParams<HalfwayBreakParams>) {
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const { goToNextStep } = useNextStep();

  const handleClick = (dir: Direction) => {
    if (selectedDirection !== null) return;

    const correct = CORRECT_DIRECTIONS.includes(dir);
    setSelectedDirection(dir);
    setAnswer({
      status: true,
      provenanceGraph: undefined,
      answers: {
        'halfway-guess': dir,
        'halfway-correct': correct,
      },
    });
    goToNextStep();
  };

  const getButtonBorder = (dir: Direction): string => {
    if (selectedDirection !== dir) {
      return '2px solid #bbb';
    }

    return '2px solid #1e90ff';
  };

  const renderDirectionButton = (dir: Direction, imgFile: string, alt: string) => (
    <button
      type="button"
      onClick={() => handleClick(dir)}
      disabled={selectedDirection !== null}
      style={{
        width: '62px',
        height: '62px',
        padding: 0,
        borderRadius: '8px',
        background: '#fff',
        cursor: selectedDirection === null ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        border: getButtonBorder(dir),
        boxShadow: 'none',
      }}
    >
      <img
        src={`${HALFWAY_BASE_PATH}/${imgFile}`}
        alt={alt}
        style={{
          width: '50px',
          height: '50px',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </button>
  );

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.5rem 1rem 2rem',
        textAlign: 'center' as const,
      }}
    >
      <p
        style={{
          color: '#4682B4',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginTop: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        Great Job! You are Almost There!
      </p>

      <p>Take a break, enjoy the company of this squirrel :)</p>

      <p>
        <strong>Click</strong>
        {' '}
        the direction of the squirrel&apos;s front paw.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto',
          gridTemplateRows: 'auto auto auto',
          gap: '10px',
          alignItems: 'center',
          justifyItems: 'center',
          justifyContent: 'center',
          marginTop: '1.5rem',
        }}
        aria-label="Direction button grid around squirrel image"
      >
        {/* Top row */}
        {renderDirectionButton('top-left', 'top-left.png', 'Top left')}
        {renderDirectionButton('top-mid', 'top-mid.png', 'Top middle')}
        {renderDirectionButton('top-right', 'top-right.png', 'Top right')}

        {/* Middle row */}
        {renderDirectionButton('mid-left', 'mid-left.png', 'Middle left')}
        <img
          src={SQUIRREL_IMG_PATH}
          alt="Squirrel"
          style={{
            width: '320px',
            maxWidth: '60vw',
            height: 'auto',
            display: 'block',
          }}
        />
        {renderDirectionButton('mid-right', 'mid-right.png', 'Middle right')}

        {/* Bottom row */}
        {renderDirectionButton('bottom-left', 'bottom-left.png', 'Bottom left')}
        {renderDirectionButton('bottom-mid', 'bottom-mid.png', 'Bottom middle')}
        {renderDirectionButton('bottom-right', 'bottom-right.png', 'Bottom right')}
      </div>

      {/* No feedback text is shown for this halfway break */}
    </div>
  );
}


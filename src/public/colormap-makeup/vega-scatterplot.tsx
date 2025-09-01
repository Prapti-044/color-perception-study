import { useCallback, useEffect, useState } from 'react';
import { VegaLite } from 'react-vega';
import { StimulusParams } from '../../store/types';

export default function VegaLiteComponent({ parameters, setAnswer }: StimulusParams<{
    vegaSpecPath: string;
}>) {
  const { vegaSpecPath } = parameters;
  const [spec, setSpec] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [selectedButton, setSelectedButton] = useState<'Same' | 'Different' | null>(null);

  // Load the Vega spec JSON
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const fullUrl = `/color-perception-study/${vegaSpecPath}`; // for github pages
    // const fullUrl = `${vegaSpecPath}`; // for local development
    fetch(fullUrl)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          setSpec(json);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => { isMounted = false; };
  }, [vegaSpecPath]);

  // Handle answer
  const handleAnswer = useCallback((answer: 'Same' | 'Different') => {
    setSelectedButton(answer);
    setAnswer({
      status: true,
      provenanceGraph: undefined,
      answers: {
        'scatterplot-response': answer,
      },
    });
  }, [setAnswer]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        handleAnswer('Same');
      } else if (e.key === 'j' || e.key === 'J') {
        handleAnswer('Different');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnswer]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginTop: '5rem',
      }}
    >
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #3498db',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}
      {!loading && spec !== null && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '7rem',
              marginBottom: '6rem',
            }}
          >
            <button
              type="button"
              style={{
                padding: '5px 10px',
                fontSize: '16px',
                border: '2px solid #3498db',
                backgroundColor: selectedButton === 'Same' ? '#3498db' : 'transparent',
                color: selectedButton === 'Same' ? 'white' : '#3498db',
                borderRadius: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => handleAnswer('Same')}
              onMouseEnter={(e) => {
                if (selectedButton !== 'Same') {
                  e.currentTarget.style.backgroundColor = '#3498db';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedButton !== 'Same') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#3498db';
                }
              }}
            >
              Same
              {' '}
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#333',
                  marginLeft: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                f
              </span>
            </button>
            <button
              type="button"
              style={{
                padding: '5px 10px',
                fontSize: '16px',
                border: '2px solid #e74c3c',
                backgroundColor: selectedButton === 'Different' ? '#e74c3c' : 'transparent',
                color: selectedButton === 'Different' ? 'white' : '#e74c3c',
                borderRadius: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => handleAnswer('Different')}
              onMouseEnter={(e) => {
                if (selectedButton !== 'Different') {
                  e.currentTarget.style.backgroundColor = '#e74c3c';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedButton !== 'Different') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#e74c3c';
                }
              }}
            >
              Different
              {' '}
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#333',
                  marginLeft: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                j
              </span>
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div style={{ maxWidth: 600, width: '100%' }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <VegaLite spec={spec as any} actions={false} />
            </div>
          </div>
        </>
      )}
      {!loading && !spec && (
        <div style={{ color: '#e74c3c', fontSize: '16px' }}>
          Failed to load visualization.
        </div>
      )}
    </div>
  );
}

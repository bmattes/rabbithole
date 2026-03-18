import { useEffect, useRef, useState } from 'react'
import { Puzzle, getTodaysPuzzleWithFallback } from './lib/api'
import { todayUTC, getCategoryFallbacks } from './lib/categoryRotation'
import { PuzzleCanvas } from './components/PuzzleCanvas'
import { ResultsScreen } from './components/ResultsScreen'

type AppState = 'loading' | 'playing' | 'results' | 'error'

const APP_STORE_URL = 'https://apps.apple.com/ca/app/hops-daily-word-puzzle/id6760190245'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [playerPath, setPlayerPath] = useState<string[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const dateStr = todayUTC()
    const categoryIds = getCategoryFallbacks(dateStr)
    getTodaysPuzzleWithFallback(categoryIds, dateStr)
      .then((p) => {
        if (!p) {
          setAppState('error')
        } else {
          setPuzzle(p)
          setAppState('playing')
          startTimeRef.current = Date.now()
        }
      })
      .catch(() => setAppState('error'))
  }, [])

  function handlePathComplete(path: string[]) {
    setElapsedMs(startTimeRef.current ? Date.now() - startTimeRef.current : 0)
    setPlayerPath(path)
    setAppState('results')
  }

  const startId =
    puzzle?.bubbles.find(
      (b) => b.label.toLowerCase() === puzzle.start_concept.toLowerCase()
    )?.id ?? puzzle?.bubbles[0].id ?? ''

  const endId =
    puzzle?.bubbles.find(
      (b) => b.label.toLowerCase() === puzzle.end_concept.toLowerCase()
    )?.id ?? puzzle?.bubbles[puzzle.bubbles.length - 1]?.id ?? ''

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9f9f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Header */}
        <header
          style={{
            paddingTop: 20,
            paddingBottom: 12,
            borderBottom: '1px solid #e5e5e5',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.5 }}>
              Hops
            </h1>
            {puzzle && (
              <span style={{ fontSize: 13, color: '#999', fontWeight: 500 }}>
                {puzzle.category_name} · Easy
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {appState === 'loading' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 14,
              }}
            >
              Loading today's puzzle…
            </div>
          )}

          {appState === 'error' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                textAlign: 'center',
                padding: '40px 0',
              }}
            >
              <p style={{ fontSize: 16, color: '#666' }}>Something went wrong. Try refreshing.</p>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#7c3aed',
                  color: '#fff',
                  padding: '14px 24px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Download Hops — Free on iOS
              </a>
            </div>
          )}

          {appState === 'playing' && puzzle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>
                Connect{' '}
                <strong style={{ color: '#16a34a' }}>{puzzle.start_concept}</strong>
                {' '}to{' '}
                <strong style={{ color: '#dc2626' }}>{puzzle.end_concept}</strong>
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                <PuzzleCanvas
                  bubbles={puzzle.bubbles}
                  connections={puzzle.connections}
                  startId={startId}
                  endId={endId}
                  minHops={puzzle.optimal_path.length - 1}
                  onPathComplete={handlePathComplete}
                />
              </div>
            </div>
          )}

          {appState === 'results' && puzzle && (
            <ResultsScreen puzzle={puzzle} playerPath={playerPath} elapsedMs={elapsedMs} />
          )}
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: '16px 0',
            textAlign: 'center',
            borderTop: '1px solid #e5e5e5',
            marginTop: 20,
          }}
        >
          <span style={{ fontSize: 12, color: '#ccc' }}>deepr.fm</span>
        </footer>
      </div>
    </div>
  )
}

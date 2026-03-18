import React from 'react'
import { Puzzle } from '../lib/api'

// Mirrors mobile scoring — node is 'right' if same id at same position, 'onpath' if on optimal
// but wrong position, 'off' if not on optimal path at all.
type NodeStatus = 'start' | 'end' | 'right' | 'onpath' | 'off'

function getNodeStatuses(playerPath: string[], optimalPath: string[]): NodeStatus[] {
  const optimalSet = new Set(optimalPath)
  return playerPath.map((id, i) => {
    if (i === 0) return 'start'
    if (i === playerPath.length - 1) return 'end'
    if (optimalPath[i] === id) return 'right'
    if (optimalSet.has(id)) return 'onpath'
    return 'off'
  })
}

function nodeStyle(status: NodeStatus): React.CSSProperties {
  if (status === 'start') return { background: '#dcfce7', color: '#16a34a' }
  if (status === 'end') return { background: '#fee2e2', color: '#dc2626' }
  if (status === 'right') return { background: '#dcfce7', color: '#16a34a' }
  if (status === 'onpath') return { background: '#fef9c3', color: '#854d0e' }
  return { background: '#f3f3f1', color: '#1a1a1a' }
}

function PathCard({
  label,
  ids,
  labels,
  optimalPath,
  isPlayerPath,
}: {
  label: string
  ids: string[]
  labels: string[]
  optimalPath: string[]
  isPlayerPath: boolean
}) {
  const statuses = isPlayerPath ? getNodeStatuses(ids, optimalPath) : ids.map((_, i) =>
    i === 0 ? 'start' : i === ids.length - 1 ? 'end' : 'right'
  ) as NodeStatus[]

  const hops = ids.length - 1
  const optimalHops = optimalPath.length - 1
  const isOptimal = isPlayerPath
    ? ids.length === optimalPath.length && ids.every((id, i) => id === optimalPath[i])
    : true

  const hopColor = isOptimal ? '#16a34a' : hops <= optimalHops + 1 ? '#d97706' : '#dc2626'
  const hopLabel = isOptimal
    ? `${hops} hop${hops !== 1 ? 's' : ''} ✓`
    : `${hops} hop${hops !== 1 ? 's' : ''} · optimal is ${optimalHops}`

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${isOptimal ? '#bbf7d0' : '#e5e5e5'}`,
      borderRadius: 16,
      padding: '16px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontSize: 11,
        textTransform: 'uppercase' as const,
        letterSpacing: 2,
        color: '#999',
        marginBottom: 10,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' }}>
        {labels.map((l, i) => (
          <React.Fragment key={i}>
            <span style={{
              ...nodeStyle(statuses[i]),
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
            }}>
              {l}
            </span>
            {i < labels.length - 1 && <span style={{ color: '#ccc', fontSize: 14 }}>→</span>}
          </React.Fragment>
        ))}
      </div>
      {isPlayerPath && (
        <div style={{ marginTop: 10, fontSize: 12, color: hopColor, fontWeight: 600 }}>
          {hopLabel}
        </div>
      )}
    </div>
  )
}

// --- Scoring (mirrors mobile/lib/scoring.ts) ---
const TIME_CEILING = 400 // easy only on web
const TIME_DECAY_MS = 180000
const TIME_FLOOR = 50
const TIME_FLOOR_MS = 300000
const NODE_BUDGET = 600 // easy only on web

function computeTimeScore(elapsedMs: number): number {
  if (elapsedMs >= TIME_FLOOR_MS) return TIME_FLOOR
  return Math.max(TIME_FLOOR, Math.round(TIME_CEILING * Math.exp(-elapsedMs / TIME_DECAY_MS)))
}

type NodeCategory = 'right_place' | 'wrong_place' | 'wrong_node'
interface NodeScore { id: string; label: string; category: NodeCategory; points: number }

function computeNodeScores(
  playerPath: string[],
  optimalPath: string[],
  labelMap: Record<string, string>,
): NodeScore[] {
  const intermediates = playerPath.slice(1, -1)
  if (intermediates.length === 0) return []
  const perNode = NODE_BUDGET / intermediates.length
  const optimalIntermediates = optimalPath.slice(1, -1)
  const optimalSet = new Set(optimalIntermediates)
  const awardedWrongPlace = new Set<string>()

  return intermediates.map((id, i) => {
    let category: NodeCategory
    let points: number
    if (optimalIntermediates[i] === id) {
      category = 'right_place'; points = Math.round(perNode)
    } else if (optimalSet.has(id) && !awardedWrongPlace.has(id)) {
      awardedWrongPlace.add(id); category = 'wrong_place'; points = Math.round(perNode * 0.4)
    } else {
      category = 'wrong_node'; points = 0
    }
    return { id, label: labelMap[id] ?? id, category, points }
  })
}

// --- End scoring ---

interface ResultsScreenProps {
  puzzle: Puzzle
  playerPath: string[]
  elapsedMs: number
}

const APP_STORE_URL = 'https://apps.apple.com/ca/app/hops-daily-word-puzzle/id6760190245'

export function ResultsScreen({ puzzle, playerPath, elapsedMs }: ResultsScreenProps) {
  const idToLabel: Record<string, string> = {}
  for (const b of puzzle.bubbles) idToLabel[b.id] = b.label

  const pathLabels = playerPath.map((id) => idToLabel[id] ?? id)
  const optimalLabels = puzzle.optimal_path.map((id) => idToLabel[id] ?? id)
  const isOptimal = playerPath.length === puzzle.optimal_path.length &&
    playerPath.every((id, i) => id === puzzle.optimal_path[i])
  const optimalHops = puzzle.optimal_path.length - 1

  const timeScore = computeTimeScore(elapsedMs)
  const nodeScores = computeNodeScores(playerPath, puzzle.optimal_path, idToLabel)
  const nodeTotal = nodeScores.reduce((s, n) => s + n.points, 0)
  const finalScore = Math.max(100, Math.min(1000, timeScore + nodeTotal))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 0' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', textAlign: 'center' }}>
        {isOptimal ? 'Perfect!' : 'You solved it!'}
      </h1>

      {/* Score */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#1a1a1a', lineHeight: 1 }}>
          {finalScore}
        </div>
        <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>out of 1000</div>
      </div>

      {/* Score breakdown */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 2, color: '#999', marginBottom: 12, fontWeight: 600 }}>
          Score Breakdown
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: '#1a1a1a' }}>Time bonus</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>{timeScore}</span>
        </div>
        {nodeScores.map((n, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: '#1a1a1a' }}>
              {n.label}{' '}
              <span style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>
                {n.category === 'right_place' ? 'right spot' : n.category === 'wrong_place' ? 'on path' : 'off path'}
              </span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: n.points === 0 ? '#ccc' : '#7c3aed' }}>
              {n.points}
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #e5e5e5', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>Total</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>{finalScore}</span>
        </div>
      </div>

      {/* Your path */}
      <PathCard
        label="Your Path"
        ids={playerPath}
        labels={pathLabels}
        optimalPath={puzzle.optimal_path}
        isPlayerPath={true}
      />

      {/* Optimal path — always shown when player didn't match it */}
      {!isOptimal && (
        <PathCard
          label={`Optimal Path · ${optimalHops} hop${optimalHops !== 1 ? 's' : ''}`}
          ids={puzzle.optimal_path}
          labels={optimalLabels}
          optimalPath={puzzle.optimal_path}
          isPlayerPath={false}
        />
      )}

      {/* Narrative */}
      {puzzle.narrative && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e5e5',
            borderRadius: 12,
            padding: '14px 18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, fontStyle: 'italic' }}>
            "{puzzle.narrative}"
          </p>
        </div>
      )}

      {/* App Store CTA */}
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          background: '#7c3aed',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: 14,
          fontWeight: 700,
          fontSize: 16,
          textAlign: 'center',
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
        }}
      >
        Download Hops — Free on iOS
      </a>
      <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        21 categories · Easy, Medium &amp; Hard · new puzzle daily
      </p>
    </div>
  )
}

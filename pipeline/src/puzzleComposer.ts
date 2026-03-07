import { Entity, Graph, findShortestPath } from './graphBuilder'

export interface PuzzleBubble {
  id: string
  label: string
  position: { x: number; y: number }
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface ComposedPuzzle {
  startId: string
  endId: string
  bubbles: PuzzleBubble[]
  connections: Record<string, string[]>
  optimalPath: string[]
  difficulty: Difficulty
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Count how many distinct shortest paths exist (up to a cap, for performance)
function countShortestPaths(startId: string, endId: string, graph: Graph, optimalLength: number, cap = 20): number {
  let count = 0
  const queue: string[][] = [[startId]]

  while (queue.length > 0) {
    const path = queue.shift()!
    if (path.length > optimalLength) break
    const current = path[path.length - 1]
    if (current === endId) {
      count++
      if (count >= cap) return cap
      continue
    }
    for (const neighbor of graph[current] ?? []) {
      if (!path.includes(neighbor)) {
        queue.push([...path, neighbor])
      }
    }
  }

  return count
}

interface CompositionParams {
  /** Minimum optimal path length (nodes, not hops). Default 5 (= 4 hops). */
  minPathLength: number
  /** Familiarity score below which intermediates are considered "obscure". Default 60. */
  obscureThreshold: number
}

const DEFAULT_PARAMS: CompositionParams = { minPathLength: 5, obscureThreshold: 60 }

function computeDifficulty(
  optimalPath: string[],
  pathCount: number,
  entityMap: Map<string, Entity>,
  params: CompositionParams = DEFAULT_PARAMS,
): Difficulty {
  const hops = optimalPath.length - 1

  // Average familiarity of intermediate nodes (exclude start/end)
  // Prefer pageviews (Wikipedia monthly traffic) over sitelinks — better pop culture signal
  // pageviews scale: ~50k = moderately known, ~500k = well-known, ~2M+ = famous
  // sitelinks scale: ~50 = moderately known, ~150 = well-known
  const middleIds = optimalPath.slice(1, -1)
  const familiarityValues = middleIds.map(id => {
    const e = entityMap.get(id)
    if (!e) return 0
    if (e.pageviews !== undefined) return e.pageviews / 3000  // normalize to ~sitelinks scale
    return e.sitelinks ?? 0
  }).filter(s => s > 0)
  const avgFamiliarity = familiarityValues.length > 0
    ? familiarityValues.reduce((a, b) => a + b, 0) / familiarityValues.length
    : 0

  // familiarity: high (>150 normalized) = well-known, low (<obscureThreshold) = obscure
  const familiar = avgFamiliarity > 150
  const obscure = avgFamiliarity < params.obscureThreshold || avgFamiliarity === 0

  // Hard: long path OR obscure intermediates with few routes
  if (hops >= 6) return 'hard'
  if (hops === 5 && (obscure || pathCount <= 3)) return 'hard'
  if (hops === 5) return 'medium'
  // 4-hop puzzles: easy if intermediates are reasonably well-known
  if (hops === 4 && familiar) return 'easy'
  if (hops === 4 && !obscure) return 'easy'
  // 3-hop puzzles: always easy (only reachable when minPathLength is relaxed to 4)
  if (hops === 3) return 'easy'
  return 'medium'
}

function scatterPositions(
  ids: string[],
  startId: string,
  endId: string
): Record<string, { x: number; y: number }> {
  const W = 390
  const H = 650
  const positions: Record<string, { x: number; y: number }> = {}

  positions[startId] = { x: W / 2, y: 80 }
  positions[endId] = { x: W / 2, y: H - 80 }

  const middleIds = ids.filter(id => id !== startId && id !== endId)
  middleIds.forEach((id, i) => {
    const cols = 3
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 75 + col * ((W - 150) / (cols - 1)) + (Math.random() - 0.5) * 20
    const y = 170 + row * 100 + (Math.random() - 0.5) * 20
    positions[id] = { x, y }
  })

  return positions
}

export function composePuzzle({
  entities,
  graph,
  startId,
  endId,
  targetBubbleCount = 12,
  params = DEFAULT_PARAMS,
}: {
  entities: Entity[]
  graph: Graph
  startId: string
  endId: string
  targetBubbleCount?: number
  params?: CompositionParams
}): ComposedPuzzle | null {
  const optimalPath = findShortestPath(startId, endId, graph)
  if (!optimalPath) return null
  if (optimalPath.length < params.minPathLength || optimalPath.length > 8) return null

  const entityMap = new Map(entities.map(e => [e.id, e]))

  // Only include entities with readable labels as bubble candidates
  const hasGoodLabel = (id: string) => {
    const label = entityMap.get(id)?.label ?? ''
    return label.length > 0 && label.length <= 35
  }

  const candidateIds = new Set<string>(optimalPath.filter(hasGoodLabel))
  // Ensure path endpoints are always included even if labels are long
  candidateIds.add(optimalPath[0])
  candidateIds.add(optimalPath[optimalPath.length - 1])

  // When the path is short (3 hops), skip adding neighbors of start/end to the
  // bubble set — they can create shortcuts that collapse the trimmed path below minimum.
  const hopsRaw = optimalPath.length - 1
  const noExpandEndpoints = hopsRaw <= 3
  const expandIds = noExpandEndpoints
    ? optimalPath.slice(1, -1)   // intermediates only
    : optimalPath

  for (const id of expandIds) {
    const neighbors = shuffle(graph[id] ?? [])
    for (const n of neighbors.slice(0, 4)) {
      if (hasGoodLabel(n)) candidateIds.add(n)
    }
  }

  const allEntityIds = shuffle(entities.map(e => e.id).filter(id => !candidateIds.has(id)))
  const orphanCount = 2
  const orphans = allEntityIds.slice(0, orphanCount)

  // Start first, end last — middle filled from other candidates and orphans
  const otherCandidates = Array.from(candidateIds).filter(id => id !== startId && id !== endId)
  const middleIds = [
    ...otherCandidates.slice(0, targetBubbleCount - orphanCount - 2),
    ...orphans,
  ]
  const allBubbleIds = [startId, ...middleIds, endId]

  const positions = scatterPositions(allBubbleIds, startId, endId)

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const bubbles: PuzzleBubble[] = allBubbleIds.map(id => ({
    id,
    label: capitalize(entityMap.get(id)?.label ?? id),
    position: positions[id],
  }))

  const bubbleSet = new Set(allBubbleIds)
  const connections: Record<string, string[]> = {}
  for (const id of allBubbleIds) {
    connections[id] = (graph[id] ?? []).filter(n => bubbleSet.has(n))
    if (orphans.includes(id)) connections[id] = []
  }

  // Re-run BFS on the trimmed connections graph — the subset may have a shorter path
  const trimmedGraph: Graph = connections
  const trueOptimalPath = findShortestPath(startId, endId, trimmedGraph) ?? optimalPath

  // Reject if the true optimal in the trimmed graph is shorter than our minimum
  if (trueOptimalPath.length < params.minPathLength) return null

  const pathCount = countShortestPaths(startId, endId, trimmedGraph, trueOptimalPath.length)
  const difficulty = computeDifficulty(trueOptimalPath, pathCount, entityMap, params)

  return { startId, endId, bubbles, connections, optimalPath: trueOptimalPath, difficulty }
}

// Hop range (inclusive) that can plausibly produce each difficulty after trimming.
const DIFFICULTY_HOP_RANGE: Record<Difficulty, [number, number]> = {
  easy:   [3, 5],
  medium: [4, 6],
  hard:   [5, 8],
}

/**
 * Build a pool of start/end pairs whose raw graph distance falls within [minHops, maxHops].
 * Samples up to `sampleBudget` random pairs to find `targetSize` qualifying pairs.
 */
function buildPairPool(
  entityIds: string[],
  graph: Graph,
  minHops: number,
  maxHops: number,
  targetSize: number,
  sampleBudget: number,
): Array<[string, string]> {
  const pool: Array<[string, string]> = []
  for (let i = 0; i < sampleBudget && pool.length < targetSize; i++) {
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue
    const path = findShortestPath(startId, endId, graph)
    if (!path) continue
    const hops = path.length - 1
    if (hops >= minHops && hops <= maxHops) pool.push([startId, endId])
  }
  return pool
}

/**
 * Attempt to compose a puzzle that matches the target difficulty.
 * Uses an adaptive retry ladder: if early rounds fail, progressively relaxes
 * composition constraints before giving up.
 * Each round pre-filters start/end pairs by raw hop distance so we don't waste
 * attempts on pairs that can never produce the target difficulty.
 */
export function composePuzzleForDifficulty({
  entities,
  graph,
  entityIds,
  targetDifficulty,
  targetBubbleCount = 12,
}: {
  entities: Entity[]
  graph: Graph
  entityIds: string[]
  targetDifficulty: Difficulty
  targetBubbleCount?: number
}): ComposedPuzzle | null {
  // Retry ladder: each round tries with progressively relaxed params.
  const rounds: Array<{ attempts: number; params: CompositionParams }> = [
    // Round 1: strict defaults
    { attempts: 50, params: { minPathLength: 5, obscureThreshold: 60 } },
    // Round 2: relax obscure threshold — more 4-hop paths qualify as easy
    { attempts: 50, params: { minPathLength: 5, obscureThreshold: 30 } },
    // Round 3: also allow 3-hop paths — last resort for sparse graphs
    { attempts: 75, params: { minPathLength: 4, obscureThreshold: 30 } },
  ]

  const [minHops, maxHops] = DIFFICULTY_HOP_RANGE[targetDifficulty]

  for (const round of rounds) {
    const roundMinHops = Math.max(minHops, round.params.minPathLength - 1)
    // Pre-build a pool of pairs in the right hop range — avoids wasting attempts
    // on hub-dominated graphs where most pairs are too close together.
    const pool = buildPairPool(entityIds, graph, roundMinHops, maxHops, round.attempts, round.attempts * 10)
    const source = pool.length >= 10 ? pool : null  // fall back to random if pool too thin

    for (let attempt = 0; attempt < round.attempts; attempt++) {
      let startId: string, endId: string
      if (source) {
        const pair = source[Math.floor(Math.random() * source.length)]
        ;[startId, endId] = pair
      } else {
        startId = entityIds[Math.floor(Math.random() * entityIds.length)]
        endId = entityIds[Math.floor(Math.random() * entityIds.length)]
        if (startId === endId) continue
      }

      const puzzle = composePuzzle({ entities, graph, startId, endId, targetBubbleCount, params: round.params })
      if (puzzle && puzzle.difficulty === targetDifficulty) {
        return puzzle
      }
    }
  }
  return null
}

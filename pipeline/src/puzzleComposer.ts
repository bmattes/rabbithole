import { Entity, Graph, findShortestPath } from './graphBuilder'
import { DomainOverrides } from './domainConfig'

// --- Tunable quality constants (global defaults) ---
const MIN_QUALITY_SCORE = 40          // minimum path quality to be a candidate
const MAX_CANDIDATES = 5              // how many candidates to collect before selecting best
const HUB_RELATEDIDS_THRESHOLD = 50   // nodes with more edges than this are hubs
const MAX_MUTUAL_NEIGHBORS = 3        // reject pairs with too many shared connections
const MAX_HUB_RATIO = 0.0             // reject any hub as an intermediate (0 = zero tolerance)

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

export interface PathQualityScore {
  total: number               // 0-100 composite
  anchorFamiliarity: number   // are start/end well-known? (0-30)
  intermediateBalance: number // are intermediates specific, not hubs? (0-40)
  surpriseFactor: number      // are start/end surprising to be connected? (0-20)
  hubPenalty: number          // deduction for abstract hub intermediates (-30 to 0)
}

function entityFamiliarityScore(e: Entity): number {
  if (e.pageviews !== undefined) return e.pageviews / 3000
  return e.sitelinks ?? 0
}

function isHubEntity(e: Entity): boolean {
  return e.relatedIds.length >= HUB_RELATEDIDS_THRESHOLD || e.entityType === 'category'
}

export function scorePathQuality(
  optimalPath: string[],
  entityMap: Map<string, Entity>,
  graph: Graph,
  hubThreshold = HUB_RELATEDIDS_THRESHOLD,
): PathQualityScore {
  const startEntity = entityMap.get(optimalPath[0])
  const endEntity = entityMap.get(optimalPath[optimalPath.length - 1])

  // anchorFamiliarity (0-30): avg familiarity of start + end, capped at score 150 → 30pts
  const startFam = startEntity ? entityFamiliarityScore(startEntity) : 0
  const endFam = endEntity ? entityFamiliarityScore(endEntity) : 0
  const avgAnchorFam = (startFam + endFam) / 2
  const anchorFamiliarity = Math.min(30, (avgAnchorFam / 150) * 30)

  // intermediateBalance (0-40): Goldilocks zone — peaks at familiarity 60-120
  // Too high (>200) = boring hub; too low (<10) = unguessable
  const middleIds = optimalPath.slice(1, -1)
  let intermediateBalance = 0
  if (middleIds.length > 0) {
    const scores = middleIds.map(id => {
      const e = entityMap.get(id)
      if (!e) return 0
      const fam = entityFamiliarityScore(e)
      // Goldilocks: peak at fam ~30-60 (recognisable but specific), fade hard above 80 (hub territory)
      if (fam <= 0) return 0
      if (fam < 10) return (fam / 10) * 20          // ramp up: 0-20pts
      if (fam <= 60) return 20 + ((fam - 10) / 50) * 20  // ramp to peak: 20-40pts
      if (fam <= 80) return 40                            // narrow peak: 40pts
      return Math.max(0, 40 - ((fam - 80) / 80) * 40)    // steep fade above 80: hubs score near 0
    })
    intermediateBalance = scores.reduce((a, b) => a + b, 0) / scores.length
  } else {
    intermediateBalance = 20  // no intermediates: neutral score
  }

  // surpriseFactor (0-20): fewer mutual neighbors = more surprising connection
  const startNeighbors = new Set(graph[optimalPath[0]] ?? [])
  const endNeighborsList = graph[optimalPath[optimalPath.length - 1]] ?? []
  const mutualCount = endNeighborsList.filter(n => startNeighbors.has(n)).length
  const surpriseFactor = Math.max(0, 20 - mutualCount * 4)

  // hubPenalty (-30 to 0): -10 per hub intermediate, max -30
  const hubCount = middleIds.filter(id => {
    const e = entityMap.get(id)
    return e ? (e.relatedIds.length >= hubThreshold || e.entityType === 'category') : false
  }).length
  const hubPenalty = -Math.min(30, hubCount * 10)

  const total = Math.max(0, Math.min(100,
    anchorFamiliarity + intermediateBalance + surpriseFactor + hubPenalty
  ))

  return { total, anchorFamiliarity, intermediateBalance, surpriseFactor, hubPenalty }
}

export function composePuzzle({
  entities,
  graph,
  startId,
  endId,
  targetBubbleCount = 12,
  params = DEFAULT_PARAMS,
  domainOverrides,
}: {
  entities: Entity[]
  graph: Graph
  startId: string
  endId: string
  targetBubbleCount?: number
  params?: CompositionParams
  domainOverrides?: DomainOverrides
}): ComposedPuzzle | null {
  const effectiveMinQuality = domainOverrides?.minQualityScore ?? MIN_QUALITY_SCORE
  const effectiveMaxHubRatio = domainOverrides?.maxHubRatio ?? MAX_HUB_RATIO
  const effectiveMaxMutual = domainOverrides?.maxMutualNeighbors ?? MAX_MUTUAL_NEIGHBORS
  const effectiveHubThreshold = domainOverrides?.hubRelatedIdsThreshold ?? HUB_RELATEDIDS_THRESHOLD
  const optimalPath = findShortestPath(startId, endId, graph)
  if (!optimalPath) return null
  if (optimalPath.length < params.minPathLength || optimalPath.length > 8) return null

  const entityMap = new Map(entities.map(e => [e.id, e]))

  // Reject if any two nodes in the path share the same label (e.g. God of War 2005 vs 2018)
  const pathLabels = optimalPath.map(id => entityMap.get(id)?.label?.toLowerCase() ?? id)
  if (new Set(pathLabels).size < pathLabels.length) return null

  // Reject if start and end share too many mutual neighbors — too obviously connected
  const startNeighbors = new Set(graph[startId] ?? [])
  const endNeighborsList = graph[endId] ?? []
  const mutualCount = endNeighborsList.filter(n => startNeighbors.has(n)).length
  if (mutualCount > effectiveMaxMutual) return null

  // Reject paths where the majority of intermediates are abstract hub nodes
  const pathMiddleIds = optimalPath.slice(1, -1)
  const hubRatio = pathMiddleIds.filter(id => {
    const e = entityMap.get(id)
    return e ? (e.relatedIds.length >= effectiveHubThreshold || e.entityType === 'category') : false
  }).length / Math.max(pathMiddleIds.length, 1)
  if (hubRatio > effectiveMaxHubRatio) return null

  // Only include entities with readable labels as bubble candidates
  const hasGoodLabel = (id: string) => {
    const label = entityMap.get(id)?.label ?? ''
    return label.length > 0 && label.length <= 35
  }

  // All path nodes must always be present in bubbles so optimal_path IDs resolve to labels.
  // hasGoodLabel is applied only to neighbor expansion candidates, not the path itself.
  const candidateIds = new Set<string>(optimalPath)

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
      if (hasGoodLabel(n) && n !== startId && n !== endId) candidateIds.add(n)
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

  // Reject paths that score too low on overall quality
  const qualityScore = scorePathQuality(trueOptimalPath, entityMap, trimmedGraph, effectiveHubThreshold)
  if (qualityScore.total < effectiveMinQuality) return null

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
  domainOverrides,
}: {
  entities: Entity[]
  graph: Graph
  entityIds: string[]
  targetDifficulty: Difficulty
  targetBubbleCount?: number
  domainOverrides?: DomainOverrides
}): ComposedPuzzle | null {
  // Resolve effective quality thresholds (domain overrides take precedence over globals)
  const effectiveMinQuality = domainOverrides?.minQualityScore ?? MIN_QUALITY_SCORE
  const effectiveMaxHubRatio = domainOverrides?.maxHubRatio ?? MAX_HUB_RATIO
  const effectiveMaxMutual = domainOverrides?.maxMutualNeighbors ?? MAX_MUTUAL_NEIGHBORS
  const effectiveHubThreshold = domainOverrides?.hubRelatedIdsThreshold ?? HUB_RELATEDIDS_THRESHOLD
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

  const candidates: Array<{ puzzle: ComposedPuzzle; score: number }> = []

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

      const puzzle = composePuzzle({ entities, graph, startId, endId, targetBubbleCount, params: round.params, domainOverrides })
      if (puzzle && puzzle.difficulty === targetDifficulty) {
        const entityMap = new Map(entities.map(e => [e.id, e]))
        const score = scorePathQuality(puzzle.optimalPath, entityMap, puzzle.connections as Graph, effectiveHubThreshold)
        // Only keep candidates above the effective quality floor
        if (score.total >= effectiveMinQuality) {
          candidates.push({ puzzle, score: score.total })
          if (candidates.length >= MAX_CANDIDATES) break
        }
      }
    }

    // If we have enough candidates, stop trying further rounds
    if (candidates.length >= MAX_CANDIDATES) break
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].puzzle
}

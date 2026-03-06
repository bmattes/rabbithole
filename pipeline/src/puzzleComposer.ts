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

function computeDifficulty(optimalPath: string[], pathCount: number, entityMap: Map<string, Entity>): Difficulty {
  const hops = optimalPath.length - 1

  // Average sitelinks of intermediate nodes (exclude start/end)
  const middleIds = optimalPath.slice(1, -1)
  const sitelinkValues = middleIds.map(id => entityMap.get(id)?.sitelinks ?? 0).filter(s => s > 0)
  const avgSitelinks = sitelinkValues.length > 0
    ? sitelinkValues.reduce((a, b) => a + b, 0) / sitelinkValues.length
    : 0

  // familiarity: high (>150 sitelinks avg) = well-known, low (<50) = obscure
  const familiar = avgSitelinks > 150
  const obscure = avgSitelinks < 60 || avgSitelinks === 0

  // Hard: long path OR obscure intermediates with few routes
  if (hops >= 6) return obscure ? 'hard' : 'medium'
  if (hops === 5 && obscure && pathCount <= 4) return 'hard'
  if (hops === 5) return 'medium'
  // 4-hop puzzles: easy only if intermediates are well-known AND many paths exist
  if (hops === 4 && familiar && pathCount >= 8) return 'easy'
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
}: {
  entities: Entity[]
  graph: Graph
  startId: string
  endId: string
  targetBubbleCount?: number
}): ComposedPuzzle | null {
  const optimalPath = findShortestPath(startId, endId, graph)
  if (!optimalPath) return null
  if (optimalPath.length < 5 || optimalPath.length > 8) return null

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

  for (const id of optimalPath) {
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
  if (trueOptimalPath.length < 5) return null

  const pathCount = countShortestPaths(startId, endId, trimmedGraph, trueOptimalPath.length)
  const difficulty = computeDifficulty(trueOptimalPath, pathCount, entityMap)

  return { startId, endId, bubbles, connections, optimalPath: trueOptimalPath, difficulty }
}

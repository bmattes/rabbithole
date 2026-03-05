import { Entity, Graph, findShortestPath } from './graphBuilder'

export interface PuzzleBubble {
  id: string
  label: string
  position: { x: number; y: number }
}

export interface ComposedPuzzle {
  startId: string
  endId: string
  bubbles: PuzzleBubble[]
  connections: Record<string, string[]>
  optimalPath: string[]
}

function scatterPositions(
  ids: string[],
  startId: string,
  endId: string
): Record<string, { x: number; y: number }> {
  const W = 390
  const H = 700
  const positions: Record<string, { x: number; y: number }> = {}

  positions[startId] = { x: W / 2, y: 100 }
  positions[endId] = { x: W / 2, y: H - 100 }

  const middleIds = ids.filter(id => id !== startId && id !== endId)
  middleIds.forEach((id, i) => {
    const cols = 3
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 80 + col * ((W - 160) / (cols - 1)) + (Math.random() - 0.5) * 30
    const y = 200 + row * 140 + (Math.random() - 0.5) * 30
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
  if (optimalPath.length < 3 || optimalPath.length > 8) return null

  const entityMap = new Map(entities.map(e => [e.id, e]))

  const candidateIds = new Set<string>(optimalPath)
  for (const id of optimalPath) {
    const neighbors = graph[id] ?? []
    for (const n of neighbors.slice(0, 3)) candidateIds.add(n)
  }

  const allEntityIds = entities.map(e => e.id).filter(id => !candidateIds.has(id))
  const orphanCount = 2
  const orphans = allEntityIds.slice(0, orphanCount)
  const bubbleIds = Array.from(candidateIds).slice(0, targetBubbleCount - orphanCount)
  const allBubbleIds = [...bubbleIds, ...orphans]

  const positions = scatterPositions(allBubbleIds, startId, endId)

  const bubbles: PuzzleBubble[] = allBubbleIds.map(id => ({
    id,
    label: entityMap.get(id)?.label ?? id,
    position: positions[id],
  }))

  const bubbleSet = new Set(allBubbleIds)
  const connections: Record<string, string[]> = {}
  for (const id of allBubbleIds) {
    connections[id] = (graph[id] ?? []).filter(n => bubbleSet.has(n))
    if (orphans.includes(id)) connections[id] = []
  }

  return { startId, endId, bubbles, connections, optimalPath }
}

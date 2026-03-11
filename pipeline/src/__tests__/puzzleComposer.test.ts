import { composePuzzle } from '../puzzleComposer'
import { buildGraph, Entity, Graph } from '../graphBuilder'

const entities: Entity[] = [
  { id: 'Q1', label: 'The Godfather', relatedIds: ['Q2', 'Q3'] },
  { id: 'Q2', label: 'Coppola', relatedIds: ['Q1', 'Q4', 'Q5'] },
  { id: 'Q3', label: 'Brando', relatedIds: ['Q1', 'Q6'] },
  { id: 'Q4', label: 'Apocalypse Now', relatedIds: ['Q2', 'Q5'] },
  { id: 'Q5', label: 'Vietnam War', relatedIds: ['Q2', 'Q4'] },
  { id: 'Q6', label: 'Streetcar Named Desire', relatedIds: ['Q3'] },
]

// Richer graph for distractor type tests
// Path: Q1 → Q2 → Q3 → Q4 → Q5 (4 hops)
// Isolated nodes (zero edges to any path node): Q10–Q14
// Branch nodes (connect to exactly 1 path node): Q20(→Q2), Q21(→Q3), Q22(→Q4)
// Multi-connected node (connects to 2 path nodes): Q30(→Q2,→Q4) — NOT a valid branch distractor
const richEntities: Entity[] = [
  { id: 'Q1', label: 'Alpha', relatedIds: ['Q2'] },
  { id: 'Q2', label: 'Beta', relatedIds: ['Q1', 'Q3', 'Q20', 'Q30'] },
  { id: 'Q3', label: 'Gamma', relatedIds: ['Q2', 'Q4', 'Q21'] },
  { id: 'Q4', label: 'Delta', relatedIds: ['Q3', 'Q5', 'Q22', 'Q30'] },
  { id: 'Q5', label: 'Epsilon', relatedIds: ['Q4'] },
  { id: 'Q10', label: 'Island One', relatedIds: [] },
  { id: 'Q11', label: 'Island Two', relatedIds: [] },
  { id: 'Q12', label: 'Island Three', relatedIds: [] },
  { id: 'Q13', label: 'Island Four', relatedIds: [] },
  { id: 'Q14', label: 'Island Five', relatedIds: [] },
  { id: 'Q20', label: 'Branch Beta', relatedIds: ['Q2'] },
  { id: 'Q21', label: 'Branch Gamma', relatedIds: ['Q3'] },
  { id: 'Q22', label: 'Branch Delta', relatedIds: ['Q4'] },
  { id: 'Q30', label: 'Multi Connect', relatedIds: ['Q2', 'Q4'] },
]

describe('composePuzzle', () => {
  it('returns a puzzle with start, end, and bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({
      entities, graph, startId: 'Q1', endId: 'Q4',
      params: { minPathLength: 3, obscureThreshold: 0 },
      domainOverrides: { minQualityScore: 0, maxHubRatio: 1.0, maxMutualNeighbors: 100 },
    })
    expect(puzzle).not.toBeNull()
    expect(puzzle!.startId).toBe('Q1')
    expect(puzzle!.endId).toBe('Q4')
    expect(puzzle!.bubbles.length).toBeGreaterThanOrEqual(4)
    expect(puzzle!.optimalPath.length).toBeGreaterThanOrEqual(2)
  })

  it('includes the optimal path nodes in bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({
      entities, graph, startId: 'Q1', endId: 'Q4',
      params: { minPathLength: 3, obscureThreshold: 0 },
      domainOverrides: { minQualityScore: 0, maxHubRatio: 1.0, maxMutualNeighbors: 100 },
    })
    const bubbleIds = puzzle!.bubbles.map(b => b.id)
    for (const id of puzzle!.optimalPath) {
      expect(bubbleIds).toContain(id)
    }
  })

  it('returns null when no path exists', () => {
    const isolated: Entity[] = [
      { id: 'QA', label: 'Island A', relatedIds: [] },
      { id: 'QB', label: 'Island B', relatedIds: [] },
    ]
    const graph = buildGraph(isolated)
    const puzzle = composePuzzle({ entities: isolated, graph, startId: 'QA', endId: 'QB' })
    expect(puzzle).toBeNull()
  })
})

// Shared overrides for distractor tests: disable quality/hub filters so test graph passes
const testOverrides = { minQualityScore: 0, maxHubRatio: 1.0, maxMutualNeighbors: 100 }

describe('Easy distractor isolation', () => {
  it('easy bubbles have no edges to any path node', () => {
    const graph = buildGraph(richEntities)
    const puzzle = composePuzzle({
      entities: richEntities,
      graph,
      startId: 'Q1',
      endId: 'Q5',
      params: { minPathLength: 5, obscureThreshold: 0 },
      domainOverrides: testOverrides,
      distractorMode: 'easy',
    })
    expect(puzzle).not.toBeNull()
    const pathIds = new Set(puzzle!.optimalPath)
    for (const bubble of puzzle!.bubbles) {
      if (pathIds.has(bubble.id)) continue
      // Non-path bubbles must have zero edges to any path node
      const neighbors = graph[bubble.id] ?? []
      for (const pathId of pathIds) {
        expect(neighbors).not.toContain(pathId)
      }
    }
  })
})

describe('Medium branch distractors', () => {
  it('medium non-path bubbles connect to at most one path node', () => {
    const graph = buildGraph(richEntities)
    const puzzle = composePuzzle({
      entities: richEntities,
      graph,
      startId: 'Q1',
      endId: 'Q5',
      params: { minPathLength: 5, obscureThreshold: 0 },
      domainOverrides: testOverrides,
      distractorMode: 'medium',
    })
    expect(puzzle).not.toBeNull()
    const pathIds = new Set(puzzle!.optimalPath)
    for (const bubble of puzzle!.bubbles) {
      if (pathIds.has(bubble.id)) continue
      const neighbors = graph[bubble.id] ?? []
      const pathConnections = neighbors.filter(n => pathIds.has(n))
      expect(pathConnections.length).toBeLessThanOrEqual(1)
    }
  })
})

// --- Multi-path graph for Hard tests ---
// Optimal path (3 hops, 4 nodes):  Q1 → Q2 → Q3 → Q4
// Alt path A (5 hops, 6 nodes):    Q1 → Q2 → Q5 → Q6 → Q7 → Q4
//   (detours through Q5→Q6→Q7 before reaching Q4)
// Alt path B (5 hops, 6 nodes):    Q1 → Q8 → Q9 → Q10 → Q3 → Q4
//   (goes around the left side through Q8→Q9→Q10 then rejoins Q3)
// Note: findAlternativePaths finds paths strictly LONGER than optimal (len>4),
//   so alt paths must have more nodes than the 4-node optimal.
// Isolated distractors: Q20–Q24
const multiPathEntities: Entity[] = [
  // Optimal spine
  { id: 'Q1',  label: 'Start Node',    relatedIds: ['Q2', 'Q8'] },
  { id: 'Q2',  label: 'Junction',      relatedIds: ['Q1', 'Q3', 'Q5'] },
  { id: 'Q3',  label: 'Mid Core',      relatedIds: ['Q2', 'Q4', 'Q10'] },
  { id: 'Q4',  label: 'End Node',      relatedIds: ['Q3', 'Q7', 'Q10'] },
  // Alt path A detour nodes
  { id: 'Q5',  label: 'Alt Branch A1', relatedIds: ['Q2', 'Q6'] },
  { id: 'Q6',  label: 'Alt Branch A2', relatedIds: ['Q5', 'Q7'] },
  { id: 'Q7',  label: 'Alt Bridge',    relatedIds: ['Q6', 'Q4'] },
  // Alt path B detour nodes
  { id: 'Q8',  label: 'Alt Branch B1', relatedIds: ['Q1', 'Q9'] },
  { id: 'Q9',  label: 'Alt Branch B2', relatedIds: ['Q8', 'Q10'] },
  { id: 'Q10', label: 'Alt Bridge B',  relatedIds: ['Q9', 'Q3', 'Q4'] },
  // Isolated distractors
  { id: 'Q20', label: 'Island One',    relatedIds: [] },
  { id: 'Q21', label: 'Island Two',    relatedIds: [] },
  { id: 'Q22', label: 'Island Three',  relatedIds: [] },
  { id: 'Q23', label: 'Island Four',   relatedIds: [] },
  { id: 'Q24', label: 'Island Five',   relatedIds: [] },
]

/**
 * Count all simple paths from start to end in the connections graph
 * within a hop budget (inclusive). Used to verify multi-path puzzles.
 */
function countAllPaths(
  startId: string,
  endId: string,
  connections: Graph,
  maxHops = 10,
): number {
  let count = 0
  const dfs = (current: string, visited: Set<string>, hops: number) => {
    if (current === endId) { count++; return }
    if (hops >= maxHops) return
    for (const neighbor of connections[current] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        dfs(neighbor, visited, hops + 1)
        visited.delete(neighbor)
      }
    }
  }
  const visited = new Set<string>([startId])
  dfs(startId, visited, 0)
  return count
}

describe('Hard multi-path puzzles', () => {
  it('hard puzzle has at least 2 valid complete paths in the bubble subgraph', () => {
    const graph = buildGraph(multiPathEntities)
    const puzzle = composePuzzle({
      entities: multiPathEntities,
      graph,
      startId: 'Q1',
      endId: 'Q4',
      params: { minPathLength: 4, obscureThreshold: 0 },
      domainOverrides: testOverrides,
      distractorMode: 'hard',
    })
    expect(puzzle).not.toBeNull()
    const pathCount = countAllPaths(puzzle!.startId, puzzle!.endId, puzzle!.connections)
    expect(pathCount).toBeGreaterThanOrEqual(2)
  })

  it('hard puzzle exposes alternativePaths field with at least one entry', () => {
    const graph = buildGraph(multiPathEntities)
    const puzzle = composePuzzle({
      entities: multiPathEntities,
      graph,
      startId: 'Q1',
      endId: 'Q4',
      params: { minPathLength: 4, obscureThreshold: 0 },
      domainOverrides: testOverrides,
      distractorMode: 'hard',
    })
    expect(puzzle).not.toBeNull()
    expect(puzzle!.alternativePaths).toBeDefined()
    expect(puzzle!.alternativePaths!.length).toBeGreaterThanOrEqual(1)
  })

  it('all nodes from alternativePaths are present as bubbles', () => {
    const graph = buildGraph(multiPathEntities)
    const puzzle = composePuzzle({
      entities: multiPathEntities,
      graph,
      startId: 'Q1',
      endId: 'Q4',
      params: { minPathLength: 4, obscureThreshold: 0 },
      domainOverrides: testOverrides,
      distractorMode: 'hard',
    })
    expect(puzzle).not.toBeNull()
    const bubbleIds = new Set(puzzle!.bubbles.map(b => b.id))
    for (const altPath of puzzle!.alternativePaths ?? []) {
      for (const nodeId of altPath) {
        expect(bubbleIds).toContain(nodeId)
      }
    }
  })
})

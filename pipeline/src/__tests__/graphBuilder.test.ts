import { buildGraph, findShortestPath } from '../graphBuilder'

const mockEntities = [
  { id: 'Q1', label: 'The Godfather', relatedIds: ['Q2', 'Q3'] },
  { id: 'Q2', label: 'Francis Coppola', relatedIds: ['Q1', 'Q4'] },
  { id: 'Q3', label: 'Marlon Brando', relatedIds: ['Q1'] },
  { id: 'Q4', label: 'Apocalypse Now', relatedIds: ['Q2'] },
]

describe('buildGraph', () => {
  it('creates adjacency map from entities', () => {
    const graph = buildGraph(mockEntities)
    expect(graph['Q1']).toContain('Q2')
    expect(graph['Q1']).toContain('Q3')
    expect(graph['Q2']).toContain('Q4')
  })
})

describe('findShortestPath', () => {
  it('finds shortest path between two nodes', () => {
    const graph = buildGraph(mockEntities)
    const path = findShortestPath('Q1', 'Q4', graph)
    expect(path).toEqual(['Q1', 'Q2', 'Q4'])
  })

  it('returns null when no path exists', () => {
    // Q3 only connects to Q1, and Q1 only connects to Q2/Q3 — no route to Q4 without bidirectional edges
    const isolatedEntities = [
      { id: 'Q3', label: 'Marlon Brando', relatedIds: [] },
      { id: 'Q4', label: 'Apocalypse Now', relatedIds: [] },
    ]
    const graph = buildGraph(isolatedEntities)
    const path = findShortestPath('Q3', 'Q4', graph)
    expect(path).toBeNull()
  })
})

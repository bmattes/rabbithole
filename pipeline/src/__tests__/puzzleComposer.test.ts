import { composePuzzle } from '../puzzleComposer'
import { buildGraph, Entity } from '../graphBuilder'

const entities: Entity[] = [
  { id: 'Q1', label: 'The Godfather', relatedIds: ['Q2', 'Q3'] },
  { id: 'Q2', label: 'Coppola', relatedIds: ['Q1', 'Q4', 'Q5'] },
  { id: 'Q3', label: 'Brando', relatedIds: ['Q1', 'Q6'] },
  { id: 'Q4', label: 'Apocalypse Now', relatedIds: ['Q2', 'Q5'] },
  { id: 'Q5', label: 'Vietnam War', relatedIds: ['Q2', 'Q4'] },
  { id: 'Q6', label: 'Streetcar Named Desire', relatedIds: ['Q3'] },
]

describe('composePuzzle', () => {
  it('returns a puzzle with start, end, and bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({ entities, graph, startId: 'Q1', endId: 'Q4' })
    expect(puzzle).not.toBeNull()
    expect(puzzle!.startId).toBe('Q1')
    expect(puzzle!.endId).toBe('Q4')
    expect(puzzle!.bubbles.length).toBeGreaterThanOrEqual(4)
    expect(puzzle!.optimalPath.length).toBeGreaterThanOrEqual(2)
  })

  it('includes the optimal path nodes in bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({ entities, graph, startId: 'Q1', endId: 'Q4' })
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

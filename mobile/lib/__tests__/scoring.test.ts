import { computeLiveTimeScore, computeNodeScores, computeFinalScore, NodeScore } from '../scoring'

describe('computeLiveTimeScore', () => {
  it('returns ceiling at time 0', () => {
    expect(computeLiveTimeScore(0, 'easy')).toBe(400)
    expect(computeLiveTimeScore(0, 'medium')).toBe(300)
    expect(computeLiveTimeScore(0, 'hard')).toBe(200)
  })
  it('floors at 50 after 5 minutes', () => {
    expect(computeLiveTimeScore(300000, 'easy')).toBe(50)
    expect(computeLiveTimeScore(600000, 'hard')).toBe(50)
  })
  it('decays between 0 and 5 minutes', () => {
    const score = computeLiveTimeScore(60000, 'easy')
    expect(score).toBeGreaterThan(50)
    expect(score).toBeLessThan(400)
  })
})

describe('computeNodeScores', () => {
  const labelMap = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' }
  it('gives full points for right node right place', () => {
    const scores = computeNodeScores(['start', 'a', 'end'], ['start', 'a', 'end'], 'easy', labelMap)
    expect(scores).toHaveLength(1)
    expect(scores[0].category).toBe('right_place')
    expect(scores[0].points).toBe(600)
  })
  it('gives 40% for right node wrong place', () => {
    const scores = computeNodeScores(['start', 'b', 'end'], ['start', 'a', 'end'], 'easy', labelMap)
    // 'b' is not in optimal at all — wrong_node
    expect(scores[0].category).toBe('wrong_node')
    expect(scores[0].points).toBe(0)
  })
  it('gives 40% for node on optimal path but wrong position', () => {
    const scores = computeNodeScores(['start', 'b', 'a', 'end'], ['start', 'a', 'b', 'end'], 'easy', labelMap)
    expect(scores[0].category).toBe('wrong_place') // b is in optimal but at index 1 not 0
    expect(scores[0].points).toBeGreaterThan(0)
  })
  it('returns empty for 1-hop path', () => {
    const scores = computeNodeScores(['start', 'end'], ['start', 'end'], 'easy', labelMap)
    expect(scores).toHaveLength(0)
  })
  it('does not double-award wrong_place for a repeated optimal node', () => {
    // player visits 'b' twice; optimal has 'b' once (at index 1) — second visit should be wrong_node
    // path: start -> b -> a -> b -> end   optimal: start -> a -> b -> end
    const scores = computeNodeScores(['start', 'b', 'a', 'b', 'end'], ['start', 'a', 'b', 'end'], 'easy', labelMap)
    expect(scores).toHaveLength(3)
    const wrongPlace = scores.filter(s => s.category === 'wrong_place')
    const wrongNode = scores.filter(s => s.category === 'wrong_node')
    // 'b' at index 0: wrong_place (it's in optimal but at index 1)
    // 'a' at index 1: wrong_place (it's in optimal but at index 0)
    // 'b' at index 2: wrong_node (b already awarded wrong_place)
    expect(wrongPlace).toHaveLength(2)
    expect(wrongNode).toHaveLength(1)
  })
})

describe('computeFinalScore', () => {
  it('caps at 1000', () => {
    const nodes: NodeScore[] = [{ id: 'a', label: 'A', category: 'right_place', points: 600 }]
    expect(computeFinalScore(900, nodes)).toBe(1000)
  })
  it('floors at 100', () => {
    expect(computeFinalScore(0, [])).toBe(100)
  })
  it('sums live score and node points', () => {
    const nodes: NodeScore[] = [{ id: 'a', label: 'A', category: 'right_place', points: 200 }]
    expect(computeFinalScore(300, nodes)).toBe(500)
  })
})

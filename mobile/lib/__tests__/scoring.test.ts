import { computeLiveTimeScore, computeNodeScores, computeFinalScore, computePathMultiplier, NodeScore } from '../scoring'

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

  describe('Hard difficulty with alternate paths', () => {
    // optimal: start -> a -> b -> end (3 hops)
    // alt path: start -> c -> d -> e -> end (4 hops)
    const optimalPath = ['start', 'a', 'b', 'end']
    const altPaths = [['start', 'c', 'd', 'e', 'end']]

    it('node on alternate path gets wrong_place (partial credit) not wrong_node on Hard', () => {
      // player takes: start -> c -> end — 'c' is on the alt path
      const scores = computeNodeScores(['start', 'c', 'end'], optimalPath, 'hard', labelMap, altPaths)
      expect(scores).toHaveLength(1)
      expect(scores[0].id).toBe('c')
      expect(scores[0].category).toBe('wrong_place')
      expect(scores[0].points).toBeGreaterThan(0)
    })

    it('node NOT on any path gets wrong_node on Hard', () => {
      // player takes: start -> e -> end — wait, 'e' IS on alt path
      // use a node not on any path
      const scores = computeNodeScores(['start', 'z', 'end'], optimalPath, 'hard', { ...labelMap, z: 'Z' }, altPaths)
      expect(scores).toHaveLength(1)
      expect(scores[0].id).toBe('z')
      expect(scores[0].category).toBe('wrong_node')
      expect(scores[0].points).toBe(0)
    })

    it('Easy/Medium: alternate paths ignored — node on alt path is still wrong_node', () => {
      const scoresEasy = computeNodeScores(['start', 'c', 'end'], optimalPath, 'easy', labelMap, altPaths)
      expect(scoresEasy[0].category).toBe('wrong_node')
      expect(scoresEasy[0].points).toBe(0)

      const scoresMedium = computeNodeScores(['start', 'c', 'end'], optimalPath, 'medium', labelMap, altPaths)
      expect(scoresMedium[0].category).toBe('wrong_node')
      expect(scoresMedium[0].points).toBe(0)
    })

    it('does not double-award wrong_place for same alt-path node visited twice on Hard', () => {
      // player: start -> c -> c -> end — second 'c' should be wrong_node
      const scores = computeNodeScores(['start', 'c', 'c', 'end'], optimalPath, 'hard', labelMap, altPaths)
      expect(scores).toHaveLength(2)
      expect(scores[0].category).toBe('wrong_place')
      expect(scores[1].category).toBe('wrong_node')
    })
  })
})

describe('computePathMultiplier', () => {
  const optimalPath = ['start', 'a', 'b', 'end']
  const altPaths = [['start', 'c', 'd', 'e', 'end']]

  it('returns 1.0 for optimal path taken exactly', () => {
    const mult = computePathMultiplier(['start', 'a', 'b', 'end'], optimalPath)
    expect(mult).toBeCloseTo(1.0)
  })

  it('applies extra-hop penalty for longer path', () => {
    // 4 hops vs 3 optimal = 1 extra hop → 0.80 penalty
    const mult = computePathMultiplier(['start', 'a', 'b', 'x', 'end'], optimalPath)
    expect(mult).toBeCloseTo(0.80 * Math.pow(0.85, 1), 5) // x is off-path too
  })

  it('no off-path penalty for nodes on alternate path when alternativePaths provided', () => {
    // player takes alt path: start -> c -> d -> e -> end (4 hops vs optimal 3)
    // extra hops = 1, but c/d/e are on altPath so off-path penalty = 0
    const mult = computePathMultiplier(['start', 'c', 'd', 'e', 'end'], optimalPath, altPaths)
    expect(mult).toBeCloseTo(Math.pow(0.80, 1)) // only hop penalty
  })

  it('without alternativePaths, alt-path nodes incur off-path penalty', () => {
    // same path, no alternativePaths param
    const mult = computePathMultiplier(['start', 'c', 'd', 'e', 'end'], optimalPath)
    expect(mult).toBeCloseTo(Math.pow(0.80, 1) * Math.pow(0.85, 3)) // 3 off-path nodes + 1 extra hop
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

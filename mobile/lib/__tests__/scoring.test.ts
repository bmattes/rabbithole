import { computeScore, computePathMultiplier, computeTimeMultiplier } from '../scoring'

describe('computePathMultiplier', () => {
  it('returns 1.0 for optimal path', () => {
    expect(computePathMultiplier(4, 4)).toBe(1.0)
  })

  it('returns less than 1.0 for longer path', () => {
    expect(computePathMultiplier(4, 8)).toBe(0.5)
  })

  it('clamps to 1.0 if player path is shorter (should not happen but safe)', () => {
    expect(computePathMultiplier(4, 2)).toBe(1.0)
  })
})

describe('computeTimeMultiplier', () => {
  it('returns 1.0 at 0ms', () => {
    expect(computeTimeMultiplier(0)).toBe(1.0)
  })

  it('returns ~0.5 at 5 minutes', () => {
    const result = computeTimeMultiplier(5 * 60 * 1000)
    expect(result).toBeCloseTo(0.5, 1)
  })

  it('never goes below 0.1', () => {
    expect(computeTimeMultiplier(99 * 60 * 1000)).toBeGreaterThanOrEqual(0.1)
  })
})

describe('computeScore', () => {
  it('returns 1000 for perfect path at 0ms', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 4, timeMs: 0 })).toBe(1000)
  })

  it('returns less than 1000 for longer path', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 6, timeMs: 0 })).toBeLessThan(1000)
  })

  it('returns less than 1000 for slow completion', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 4, timeMs: 300000 })).toBeLessThan(1000)
  })
})

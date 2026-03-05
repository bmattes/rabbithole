import { validatePath, findBreakPoints } from '../pathValidation'

const connections: Record<string, string[]> = {
  'start': ['A', 'B'],
  'A': ['start', 'C'],
  'B': ['start', 'C'],
  'C': ['A', 'B', 'end'],
  'end': ['C'],
  'orphan': [],
}

describe('validatePath', () => {
  it('returns valid for a connected path', () => {
    expect(validatePath(['start', 'A', 'C', 'end'], connections)).toBe(true)
  })

  it('returns invalid if any adjacent pair has no connection', () => {
    expect(validatePath(['start', 'orphan', 'end'], connections)).toBe(false)
  })

  it('returns invalid for path including orphan bubble', () => {
    expect(validatePath(['start', 'A', 'orphan', 'end'], connections)).toBe(false)
  })

  it('returns valid for single-hop path', () => {
    expect(validatePath(['start', 'end'], { start: ['end'], end: ['start'] })).toBe(true)
  })
})

describe('findBreakPoints', () => {
  it('returns empty array for valid path', () => {
    expect(findBreakPoints(['start', 'A', 'C', 'end'], connections)).toEqual([])
  })

  it('returns index of break for invalid path', () => {
    const breaks = findBreakPoints(['start', 'A', 'orphan', 'end'], connections)
    expect(breaks).toEqual([2])
  })

  it('returns multiple break indices', () => {
    const breaks = findBreakPoints(['start', 'orphan', 'A', 'orphan', 'end'], connections)
    expect(breaks).toEqual([1, 3])
  })
})

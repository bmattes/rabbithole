import {
  xpForLevel,
  levelFromXP,
  titleForLevel,
  computeRunXP,
  UNLOCK_MILESTONES,
  xpProgressInCurrentLevel,
  getUnlockedDifficulties,
  getCategorySlotCount,
} from '../progression'

describe('xpForLevel', () => {
  it('returns 400 for early levels', () => {
    expect(xpForLevel(1)).toBe(400)
    expect(xpForLevel(5)).toBe(400)
    expect(xpForLevel(10)).toBe(400)
  })
  it('returns 1000 for mid levels', () => {
    expect(xpForLevel(11)).toBe(1000)
    expect(xpForLevel(20)).toBe(1000)
    expect(xpForLevel(30)).toBe(1000)
  })
  it('returns 3000 for late levels', () => {
    expect(xpForLevel(31)).toBe(3000)
    expect(xpForLevel(50)).toBe(3000)
  })
  it('returns 5000 for infinite levels', () => {
    expect(xpForLevel(51)).toBe(5000)
    expect(xpForLevel(100)).toBe(5000)
  })
})

describe('levelFromXP', () => {
  it('level 1 at 0 XP', () => {
    expect(levelFromXP(0)).toBe(1)
  })
  it('level 1 at negative XP', () => {
    expect(levelFromXP(-100)).toBe(1)
  })
  it('advances to level 2 after enough XP', () => {
    expect(levelFromXP(400)).toBe(2)
  })
  it('10 levels * 400 XP = level 11', () => {
    expect(levelFromXP(4000)).toBe(11)
  })
})

describe('xpProgressInCurrentLevel', () => {
  it('at 0 XP, 0/400 progress', () => {
    const p = xpProgressInCurrentLevel(0)
    expect(p.current).toBe(0)
    expect(p.required).toBe(400)
  })
  it('at 200 XP, 200/400 progress in level 1', () => {
    const p = xpProgressInCurrentLevel(200)
    expect(p.current).toBe(200)
    expect(p.required).toBe(400)
  })
  it('at 4100 XP (level 11), shows progress within level 11', () => {
    const p = xpProgressInCurrentLevel(4100)
    expect(p.current).toBe(100)
    expect(p.required).toBe(1000)
  })
  it('at exactly 400 XP, shows level 2 with 0/400 progress', () => {
    const p = xpProgressInCurrentLevel(400)
    expect(p.current).toBe(0)
    expect(p.required).toBe(400)
  })
})

describe('titleForLevel', () => {
  it('Curious for 1-4', () => {
    expect(titleForLevel(1)).toBe('Curious')
    expect(titleForLevel(4)).toBe('Curious')
  })
  it('Wanderer for 5-9', () => {
    expect(titleForLevel(5)).toBe('Wanderer')
    expect(titleForLevel(9)).toBe('Wanderer')
  })
  it('Explorer for 10-14', () => {
    expect(titleForLevel(10)).toBe('Explorer')
  })
  it('Explorer for up to level 14', () => {
    expect(titleForLevel(14)).toBe('Explorer')
  })
  it('Deep Diver for 15-19', () => {
    expect(titleForLevel(15)).toBe('Deep Diver')
  })
  it('Rabbit for 20-29', () => {
    expect(titleForLevel(20)).toBe('Rabbit')
  })
  it('White Rabbit for 30-49', () => {
    expect(titleForLevel(30)).toBe('White Rabbit')
  })
  it('Mad Hatter for 50-99', () => {
    expect(titleForLevel(50)).toBe('Mad Hatter')
  })
  it('The Rabbit Hole for 100+', () => {
    expect(titleForLevel(100)).toBe('The Rabbit Hole')
  })
})

describe('computeRunXP', () => {
  it('awards 100 base XP for easy', () => {
    expect(computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 0 })).toBe(100)
  })
  it('awards 200 base XP for medium', () => {
    expect(computeRunXP({ difficulty: 'medium', isOptimalPath: false, timeMs: 999999, streakDay: 0 })).toBe(200)
  })
  it('awards 350 base XP for hard', () => {
    expect(computeRunXP({ difficulty: 'hard', isOptimalPath: false, timeMs: 999999, streakDay: 0 })).toBe(350)
  })
  it('adds 50 optimal path bonus', () => {
    const base = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 0 })
    const withOptimal = computeRunXP({ difficulty: 'easy', isOptimalPath: true, timeMs: 999999, streakDay: 0 })
    expect(withOptimal - base).toBe(50)
  })
  it('adds speed bonus for fast completion (under 30s)', () => {
    const slow = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 1 })
    const fast = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 1000, streakDay: 1 })
    expect(fast).toBeGreaterThan(slow)
  })
  it('adds streak bonus of 25 * streakDay', () => {
    const day1 = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 1 })
    const day3 = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 3 })
    expect(day3 - day1).toBe(50) // 25 * (3-1)
  })
})

describe('getUnlockedDifficulties', () => {
  it('only easy before level 5', () => {
    expect(getUnlockedDifficulties(1)).toEqual(['easy'])
    expect(getUnlockedDifficulties(4)).toEqual(['easy'])
  })
  it('easy + medium at level 5', () => {
    expect(getUnlockedDifficulties(5)).toEqual(['easy', 'medium'])
  })
  it('all difficulties at level 12', () => {
    expect(getUnlockedDifficulties(12)).toEqual(['easy', 'medium', 'hard'])
  })
})

describe('getCategorySlotCount', () => {
  it('2 slots before level 8', () => {
    expect(getCategorySlotCount(1)).toBe(2)
    expect(getCategorySlotCount(7)).toBe(2)
  })
  it('3 slots at level 8', () => {
    expect(getCategorySlotCount(8)).toBe(3)
  })
  it('4 slots at level 16', () => {
    expect(getCategorySlotCount(16)).toBe(4)
  })
  it('5 slots at level 22', () => {
    expect(getCategorySlotCount(22)).toBe(5)
  })
})

describe('UNLOCK_MILESTONES', () => {
  it('has medium difficulty unlock at level 5', () => {
    const m = UNLOCK_MILESTONES.find(m => m.level === 5)
    expect(m?.type).toBe('difficulty')
    expect(m?.unlock).toBe('medium')
  })
  it('has hard difficulty unlock at level 12', () => {
    const m = UNLOCK_MILESTONES.find(m => m.level === 12)
    expect(m?.type).toBe('difficulty')
    expect(m?.unlock).toBe('hard')
  })
  it('has category slot unlocks at 8, 16, 22', () => {
    const slots = UNLOCK_MILESTONES.filter(m => m.type === 'category_slot').map(m => m.level)
    expect(slots).toContain(8)
    expect(slots).toContain(16)
    expect(slots).toContain(22)
  })
})

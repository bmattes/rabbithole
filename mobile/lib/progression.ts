export type Difficulty = 'easy' | 'medium' | 'hard'

export interface UnlockMilestone {
  level: number
  type: 'difficulty' | 'category_slot'
  unlock?: string
}

export const UNLOCK_MILESTONES: UnlockMilestone[] = [
  { level: 5,  type: 'difficulty',    unlock: 'medium' },
  { level: 8,  type: 'category_slot' },
  { level: 12, type: 'difficulty',    unlock: 'hard' },
  { level: 16, type: 'category_slot' },
  { level: 22, type: 'category_slot' },
]

const BASE_XP: Record<Difficulty, number> = {
  easy:   100,
  medium: 200,
  hard:   350,
}

const OPTIMAL_BONUS        = 50
const MAX_SPEED_BONUS      = 50
const SPEED_THRESHOLD_MS   = 30_000
const STREAK_BONUS_PER_DAY = 25

export function computeRunXP({
  difficulty,
  isOptimalPath,
  timeMs,
  streakDay,
}: {
  difficulty: Difficulty
  isOptimalPath: boolean
  timeMs: number
  streakDay: number
}): number {
  const base    = BASE_XP[difficulty]
  const optimal = isOptimalPath ? OPTIMAL_BONUS : 0
  const speed   = Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - timeMs / SPEED_THRESHOLD_MS))
  const streak  = STREAK_BONUS_PER_DAY * Math.max(0, streakDay)
  return base + optimal + speed + streak
}

export function xpForLevel(level: number): number {
  if (level <= 10) return 400
  if (level <= 30) return 1000
  if (level <= 50) return 3000
  return 5000
}

function computeLevelAndRemainder(totalXP: number): { level: number; remainder: number } {
  if (totalXP <= 0) return { level: 1, remainder: 0 }
  let level = 1
  let remaining = totalXP
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, remainder: remaining }
}

export function levelFromXP(totalXP: number): number {
  return computeLevelAndRemainder(totalXP).level
}

export function xpProgressInCurrentLevel(totalXP: number): { current: number; required: number } {
  const { level, remainder } = computeLevelAndRemainder(totalXP)
  return { current: remainder, required: xpForLevel(level) }
}

const TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 100, title: 'The Rabbit Hole' },
  { minLevel: 50,  title: 'Mad Hatter' },
  { minLevel: 30,  title: 'White Rabbit' },
  { minLevel: 20,  title: 'Rabbit' },
  { minLevel: 15,  title: 'Deep Diver' },
  { minLevel: 10,  title: 'Explorer' },
  { minLevel: 5,   title: 'Wanderer' },
  { minLevel: 1,   title: 'Curious' },
]

export function titleForLevel(level: number): string {
  return (TITLES.find(t => level >= t.minLevel) ?? TITLES[TITLES.length - 1]).title
}

export function getUnlockedDifficulties(level: number): Difficulty[] {
  const difficulties: Difficulty[] = ['easy']
  if (level >= 5)  difficulties.push('medium')
  if (level >= 12) difficulties.push('hard')
  return difficulties
}

export function getCategorySlotCount(level: number): number {
  if (level >= 22) return 6
  if (level >= 16) return 5
  if (level >= 8)  return 4
  return 4
}

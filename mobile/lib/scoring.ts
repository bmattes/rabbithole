const BASE_POINTS = 1000
const TIME_HALF_LIFE_MS = 5 * 60 * 1000 // 5 minutes to reach 0.5 multiplier
const MIN_TIME_MULTIPLIER = 0.1

export function computePathMultiplier(optimalHops: number, playerHops: number): number {
  return Math.min(1.0, optimalHops / playerHops)
}

export function computeTimeMultiplier(timeMs: number): number {
  const raw = Math.pow(0.5, timeMs / TIME_HALF_LIFE_MS)
  return Math.max(MIN_TIME_MULTIPLIER, raw)
}

export function computeScore({
  optimalHops,
  playerHops,
  timeMs,
}: {
  optimalHops: number
  playerHops: number
  timeMs: number
}): number {
  const pathMultiplier = computePathMultiplier(optimalHops, playerHops)
  const timeMultiplier = computeTimeMultiplier(timeMs)
  return Math.round(BASE_POINTS * pathMultiplier * timeMultiplier)
}

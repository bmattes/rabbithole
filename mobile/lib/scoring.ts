const BASE_POINTS = 1000
const TIME_HALF_LIFE_MS = 5 * 60 * 1000 // 5 minutes to reach 0.5 multiplier
const MIN_TIME_MULTIPLIER = 0.1
const EXTRA_HOP_PENALTY = 0.20   // each hop beyond optimal: -20%
const OFF_PATH_PENALTY = 0.15    // each node not on optimal path: -15%

export function computePathMultiplier(
  playerPath: string[],
  optimalPath: string[]
): number {
  const optimalSet = new Set(optimalPath)
  const playerHops = playerPath.length - 1
  const optimalHops = optimalPath.length - 1

  const extraHops = Math.max(0, playerHops - optimalHops)
  // Count middle nodes (exclude start/end) that aren't on the optimal path
  const offPathNodes = playerPath.slice(1, -1).filter(id => !optimalSet.has(id)).length

  const hopPenalty = Math.pow(1 - EXTRA_HOP_PENALTY, extraHops)
  const offPathPenalty = Math.pow(1 - OFF_PATH_PENALTY, offPathNodes)

  return hopPenalty * offPathPenalty
}

export function computeTimeMultiplier(timeMs: number): number {
  const raw = Math.pow(0.5, timeMs / TIME_HALF_LIFE_MS)
  return Math.max(MIN_TIME_MULTIPLIER, raw)
}

export function computeScore({
  playerPath,
  optimalPath,
  timeMs,
}: {
  playerPath: string[]
  optimalPath: string[]
  timeMs: number
}): number {
  const pathMultiplier = computePathMultiplier(playerPath, optimalPath)
  const timeMultiplier = computeTimeMultiplier(timeMs)
  return Math.round(BASE_POINTS * pathMultiplier * timeMultiplier)
}

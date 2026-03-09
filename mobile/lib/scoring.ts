// Difficulty-based time score ceilings (max points from time alone)
export const TIME_CEILING: Record<string, number> = {
  easy: 400,
  medium: 300,
  hard: 200,
}

// Difficulty-based node score budgets (max points from node quality)
export const NODE_BUDGET: Record<string, number> = {
  easy: 600,
  medium: 700,
  hard: 800,
}

const TIME_DECAY_MS = 180000  // 3 minutes to reach ~e^-1 of ceiling
const TIME_FLOOR = 50         // minimum time score (floors after ~5 min)
const TIME_FLOOR_MS = 300000  // 5 minutes — hard floor

/** Current live time score based on elapsed ms and difficulty */
export function computeLiveTimeScore(elapsedMs: number, difficulty: string): number {
  if (elapsedMs >= TIME_FLOOR_MS) return TIME_FLOOR
  const ceiling = TIME_CEILING[difficulty] ?? TIME_CEILING.easy
  return Math.max(TIME_FLOOR, Math.round(ceiling * Math.exp(-elapsedMs / TIME_DECAY_MS)))
}

export type NodeCategory = 'right_place' | 'wrong_place' | 'wrong_node'

export interface NodeScore {
  id: string
  label: string
  category: NodeCategory
  points: number
}

/**
 * Score each intermediate node in the player's final path.
 * Start and end nodes are excluded.
 */
export function computeNodeScores(
  playerPath: string[],
  optimalPath: string[],
  difficulty: string,
  labelMap: Record<string, string>
): NodeScore[] {
  const budget = NODE_BUDGET[difficulty] ?? NODE_BUDGET.easy
  const intermediates = playerPath.slice(1, -1)
  const numIntermediates = intermediates.length
  if (numIntermediates === 0) return []

  const perNode = budget / numIntermediates
  const optimalIntermediates = optimalPath.slice(1, -1)
  const optimalSet = new Set(optimalIntermediates)

  return intermediates.map((id, i) => {
    let category: NodeCategory
    let points: number

    if (optimalIntermediates[i] === id) {
      category = 'right_place'
      points = Math.round(perNode)
    } else if (optimalSet.has(id)) {
      category = 'wrong_place'
      points = Math.round(perNode * 0.4)
    } else {
      category = 'wrong_node'
      points = 0
    }

    return { id, label: labelMap[id] ?? id, category, points }
  })
}

/** Compute final score: liveScore + nodeScores, capped at 1000, floored at 100 */
export function computeFinalScore(liveScore: number, nodeScores: NodeScore[]): number {
  const nodeTotal = nodeScores.reduce((sum, n) => sum + n.points, 0)
  return Math.max(100, Math.min(1000, liveScore + nodeTotal))
}

// Keep for XP calculation
export function computePathMultiplier(
  playerPath: string[],
  optimalPath: string[]
): number {
  const optimalSet = new Set(optimalPath)
  const playerHops = playerPath.length - 1
  const optimalHops = optimalPath.length - 1
  const extraHops = Math.max(0, playerHops - optimalHops)
  const offPathNodes = playerPath.slice(1, -1).filter(id => !optimalSet.has(id)).length
  const hopPenalty = Math.pow(0.80, extraHops)
  const offPathPenalty = Math.pow(0.85, offPathNodes)
  return hopPenalty * offPathPenalty
}

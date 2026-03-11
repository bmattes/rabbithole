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
 *
 * For Hard difficulty, nodes on any alternativePath are treated as on-path
 * (awarded 'wrong_place' partial credit rather than 'wrong_node' zero).
 */
export function computeNodeScores(
  playerPath: string[],
  optimalPath: string[],
  difficulty: string,
  labelMap: Record<string, string>,
  alternativePaths?: string[][] | null
): NodeScore[] {
  const budget = NODE_BUDGET[difficulty] ?? NODE_BUDGET.easy
  const intermediates = playerPath.slice(1, -1)
  const numIntermediates = intermediates.length
  if (numIntermediates === 0) return []

  const perNode = budget / numIntermediates
  const optimalIntermediates = optimalPath.slice(1, -1)
  const optimalSet = new Set(optimalIntermediates)
  const awardedWrongPlace = new Set<string>()

  // Build a set of all intermediate nodes across all alternate paths (Hard only)
  const altPathSet = new Set<string>()
  if (difficulty === 'hard' && alternativePaths) {
    for (const ap of alternativePaths) {
      for (const nodeId of ap.slice(1, -1)) {
        altPathSet.add(nodeId)
      }
    }
  }

  return intermediates.map((id, i) => {
    let category: NodeCategory
    let points: number

    if (optimalIntermediates[i] === id) {
      category = 'right_place'
      points = Math.round(perNode)
    } else if (optimalSet.has(id) && !awardedWrongPlace.has(id)) {
      awardedWrongPlace.add(id)
      category = 'wrong_place'
      points = Math.round(perNode * 0.4)
    } else if (difficulty === 'hard' && altPathSet.has(id) && !awardedWrongPlace.has(id)) {
      // Node is on a valid alternate path — treat as partial credit (wrong_place)
      awardedWrongPlace.add(id)
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

// Note: currently used for XP calculation via the results screen — see computeRunXP in api.ts.
// The alternativePaths param is wired for future XP integration; not yet called from production scoring.
export function computePathMultiplier(
  playerPath: string[],
  optimalPath: string[],
  alternativePaths?: string[][] | null
): number {
  const optimalSet = new Set(optimalPath)
  const playerHops = playerPath.length - 1
  const optimalHops = optimalPath.length - 1
  const extraHops = Math.max(0, playerHops - optimalHops)

  // Build set of all nodes across all alternate paths
  const altSet = new Set<string>()
  if (alternativePaths) {
    for (const ap of alternativePaths) {
      for (const nodeId of ap) {
        altSet.add(nodeId)
      }
    }
  }

  // Nodes not on the optimal path AND not on any alternate path are penalized
  const offPathNodes = playerPath.slice(1, -1).filter(
    id => !optimalSet.has(id) && !altSet.has(id)
  ).length
  const hopPenalty = Math.pow(0.80, extraHops)
  const offPathPenalty = Math.pow(0.85, offPathNodes)
  return hopPenalty * offPathPenalty
}

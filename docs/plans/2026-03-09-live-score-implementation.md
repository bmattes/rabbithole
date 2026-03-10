# Live Score System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the elapsed timer in the puzzle header with a live score that counts down from a difficulty-based ceiling, penalizes mistakes in real-time, then adds node quality bonuses at completion.

**Architecture:** Live time score decays exponentially from a ceiling (400/300/200 by difficulty), penalty events from PuzzleCanvas fire callbacks that subtract from the score. At completion, node bonuses (600/700/800 budget split across intermediates) are added and the final score is capped at 1000. Results screen shows a breakdown of time score + node scores.

**Tech Stack:** React Native, TypeScript, expo-router URL params, `requestAnimationFrame` for smooth countdown.

---

### Task 1: Rewrite `mobile/lib/scoring.ts`

**Files:**
- Modify: `mobile/lib/scoring.ts`

**Step 1: Replace the file contents**

```typescript
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
```

**Step 2: Verify TypeScript compiles**
```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to scoring.ts

**Step 3: Commit**
```bash
git add mobile/lib/scoring.ts
git commit -m "feat: rewrite scoring — live time decay + node quality bonuses"
```

---

### Task 2: Add `onBacktrack` and `onReset` callbacks to PuzzleCanvas

**Files:**
- Modify: `mobile/components/PuzzleCanvas.tsx`

**Step 1: Add props to the interface** (around line 18)

Find the props interface and add:
```typescript
onBacktrack?: () => void
onReset?: () => void
```

**Step 2: Destructure the new props** (around line 82)

Add to destructuring:
```typescript
onBacktrack,
onReset,
```

**Step 3: Add refs for the callbacks** (around line 147)

```typescript
const onBacktrackRef = useRef(onBacktrack)
const onResetRef = useRef(onReset)
onBacktrackRef.current = onBacktrack
onResetRef.current = onReset
```

**Step 4: Fire `onBacktrack` when trimming path** (around line 235, inside `connectBubbleRef`)

Find the block that removes nodes from path (where `existingIndex` is found). After the `setSettledIds` call, add:
```typescript
onBacktrackRef.current?.()
```

**Step 5: Fire `onReset` when path is cleared** (around line 298, inside `onPanResponderGrant`)

Find where `activePathRef.current = []` is set when finger misses checkpoint. After `setSettledIds(new Set())`, add:
```typescript
if (activePathRef.current.length > 1) onResetRef.current?.()
```
Note: check `length > 1` BEFORE clearing so we only fire for non-trivial resets (path had at least start + one node).

**Step 6: Verify TypeScript compiles**
```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

**Step 7: Commit**
```bash
git add mobile/components/PuzzleCanvas.tsx
git commit -m "feat: add onBacktrack and onReset callbacks to PuzzleCanvas"
```

---

### Task 3: Live score state + display in puzzle screen header

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`

**Step 1: Import new scoring functions**

Replace:
```typescript
import { computeScore } from '../../lib/scoring'
```
With:
```typescript
import { computeLiveTimeScore, computeNodeScores, computeFinalScore } from '../../lib/scoring'
```

**Step 2: Add live score state** (after existing useState declarations, ~line 90)

```typescript
const [liveScore, setLiveScore] = useState(0)
const liveScoreRef = useRef(0)
const penaltyRef = useRef(0)  // accumulated penalties not yet subtracted from rAF value
const [penaltyFlash, setPenaltyFlash] = useState<number | null>(null)  // shown briefly in header
```

**Step 3: Initialize live score when difficulty is known**

Add after `const difficulty = ...` line (~line 87):
```typescript
const timeCeiling = difficulty === 'hard' ? 200 : difficulty === 'medium' ? 300 : 400
```

**Step 4: Run rAF loop for live score decay**

Add this effect after the `useEffect` that starts the timer (~line 142):
```typescript
useEffect(() => {
  if (!started) return
  let animFrameId: number
  const tick = () => {
    const timeScore = computeLiveTimeScore(elapsed, difficulty)
    const penalties = penaltyRef.current
    const score = Math.max(0, timeScore - penalties)
    liveScoreRef.current = score
    setLiveScore(score)
    animFrameId = requestAnimationFrame(tick)
  }
  animFrameId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(animFrameId)
}, [started, elapsed, difficulty])
```

**Step 5: Add penalty handlers**

```typescript
function handleBacktrack() {
  penaltyRef.current += 25
  setPenaltyFlash(-25)
  setTimeout(() => setPenaltyFlash(null), 800)
}

function handleReset() {
  penaltyRef.current += 100
  setPenaltyFlash(-100)
  setTimeout(() => setPenaltyFlash(null), 800)
}
```

**Step 6: Update `handlePathComplete`**

Replace the `computeScore` call:
```typescript
async function handlePathComplete(path: string[]) {
  const timeMs = stop()
  const labelMap = Object.fromEntries(puzzle!.bubbles.map(b => [b.id, b.label]))
  const nodeScores = computeNodeScores(path, puzzle!.optimal_path, difficulty, labelMap)
  const finalScore = computeFinalScore(liveScoreRef.current, nodeScores)
  const nodeScoresParam = encodeURIComponent(JSON.stringify(nodeScores))

  const playerPathLabels = path.map(id => labelMap[id] ?? id).join('|')
  const optimalPathLabels = puzzle!.optimal_path.map(id => labelMap[id] ?? id).join('|')

  if (!puzzle!.id.startsWith('mock-') && userId) {
    await submitRun({ puzzleId: puzzle!.id, userId, path, timeMs, score: finalScore })
  }

  const narrativeParam = puzzle!.narrative ? `&narrative=${encodeURIComponent(puzzle!.narrative)}` : ''
  const categoryParam = categoryName ? `&categoryName=${encodeURIComponent(categoryName)}` : ''
  const dateParam = puzzle!.date ? `&puzzleDate=${encodeURIComponent(puzzle!.date)}` : ''
  router.replace(
    `/results/${puzzle!.id}?score=${finalScore}&timeMs=${timeMs}&hops=${path.length - 1}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}&difficulty=${difficulty}&liveScore=${liveScoreRef.current}&nodeScores=${nodeScoresParam}${narrativeParam}${categoryParam}${dateParam}`
  )
}
```

**Step 7: Wire callbacks to PuzzleCanvas** (find the PuzzleCanvas JSX ~line 254)

Add props:
```typescript
onBacktrack={handleBacktrack}
onReset={handleReset}
```

**Step 8: Replace header timer display**

Find the header render section with `timerColor`, `minutes`, `seconds`. Replace the timer Text with:
```tsx
<View style={styles.scoreDisplay}>
  <Text style={[styles.scoreNum, { color: liveScore > 200 ? colors.textPrimary : '#dc2626' }]}>
    {liveScore}
  </Text>
  {penaltyFlash !== null && (
    <Text style={styles.penaltyFlash}>{penaltyFlash}</Text>
  )}
</View>
```

**Step 9: Add styles**

```typescript
scoreDisplay: { alignItems: 'flex-end' },
scoreNum: { fontSize: 22, fontWeight: '800' },
penaltyFlash: { color: '#dc2626', fontSize: 13, fontWeight: '700', textAlign: 'right' },
```

**Step 10: Remove now-unused timer vars** (`timerColor`, `minutes`, `seconds`)

**Step 11: Verify TypeScript compiles**
```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

**Step 12: Commit**
```bash
git add mobile/app/puzzle/[id].tsx
git commit -m "feat: live score countdown in puzzle header with penalty flash"
```

---

### Task 4: Results screen — node score breakdown

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Import new types**

```typescript
import type { NodeScore } from '../../lib/scoring'
```

**Step 2: Parse `nodeScores` from params** (around line 66)

Add to `useLocalSearchParams`:
```typescript
liveScore: string
nodeScores: string
```

Then parse:
```typescript
const liveScoreNum = parseInt(liveScore ?? '0')
const nodeScoresList: NodeScore[] = nodeScores ? JSON.parse(decodeURIComponent(nodeScores)) : []
const nodeTotal = nodeScoresList.reduce((s, n) => s + n.points, 0)
```

**Step 3: Add score breakdown section** in the paths card area, below the path display and above the stats card.

Replace the path comparison card section with this updated version that adds a breakdown row under the player path column:

```tsx
{/* Score breakdown */}
{nodeScoresList.length > 0 && (
  <View style={styles.breakdownCard}>
    <Text style={styles.breakdownTitle}>Score Breakdown</Text>
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownItem}>Time score</Text>
      <Text style={styles.breakdownPts}>{liveScoreNum}</Text>
    </View>
    {nodeScoresList.map((n, i) => (
      <View key={i} style={styles.breakdownRow}>
        <Text style={styles.breakdownItem}>
          {n.label}
          <Text style={styles.breakdownCat}>
            {' '}({n.category === 'right_place' ? 'right place' : n.category === 'wrong_place' ? 'wrong place' : 'wrong node'})
          </Text>
        </Text>
        <Text style={[styles.breakdownPts, n.points === 0 && styles.breakdownZero]}>
          +{n.points}
        </Text>
      </View>
    ))}
    <View style={[styles.breakdownRow, styles.breakdownTotal]}>
      <Text style={styles.breakdownTotalLabel}>Total</Text>
      <Text style={styles.breakdownTotalPts}>{scoreNum}</Text>
    </View>
  </View>
)}
```

**Step 4: Add styles**

```typescript
breakdownCard: {
  backgroundColor: colors.bgCard,
  borderRadius: 20,
  padding: 20,
  width: '100%',
  marginBottom: 16,
  borderWidth: 1,
  borderColor: colors.border,
},
breakdownTitle: {
  color: colors.textTertiary,
  fontSize: 12,
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 12,
},
breakdownRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 4,
},
breakdownItem: { color: colors.textPrimary, fontSize: 14, flex: 1 },
breakdownCat: { color: colors.textTertiary, fontSize: 12, fontStyle: 'italic' },
breakdownPts: { color: colors.accent, fontSize: 14, fontWeight: '700' },
breakdownZero: { color: colors.textTertiary },
breakdownTotal: {
  borderTopWidth: 1,
  borderTopColor: colors.border,
  marginTop: 8,
  paddingTop: 8,
},
breakdownTotalLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
breakdownTotalPts: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
```

**Step 5: Verify TypeScript compiles**
```bash
cd mobile && npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**
```bash
git add mobile/app/results/[id].tsx
git commit -m "feat: results screen score breakdown — time + per-node scores"
```

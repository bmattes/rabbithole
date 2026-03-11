# Gameplay Redesign: Deduction / Exploration / Optimization

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "path of fixed length" puzzle model with three genuinely distinct cognitive challenges — one per difficulty — each with a different structure of distractors and multiple paths.

**Architecture:** Pipeline generates puzzle-type-specific bubble sets; mobile renders them identically (same canvas) but the scoring and "how to play" framing changes per difficulty.

**Tech Stack:** TypeScript pipeline (Node.js), React Native / Expo mobile, Supabase (Postgres)

---

## The Three Models

### Easy — Deduction: "Can you identify THE bridge?"
- **Structure:** One valid complete path (Start → bridge₁ → bridge₂ → End). Remaining bubbles are **island distractors** — domain-relevant but zero Wikidata edges to any path node.
- **Player experience:** Which of these 7 bubbles is the one that connects Start to End? Pure elimination/deduction.
- **Example:** Minecraft → [Mojang] → Microsoft. Distractors: Nintendo, Valve, EA, Epic Games, Roblox, Ubisoft — all game publishers with no Wikidata connection to Minecraft or Microsoft.

### Medium — Exploration: "Can you navigate the tree?"
- **Structure:** One valid complete path. Additional bubbles connect to 1-2 path nodes but **dead-end** before reaching End.
- **Player experience:** Multiple branches start promisingly but only one route completes. Must backtrack.
- **Example:** Zidane → Real Madrid → Champions League → Liverpool. Dead ends: Juventus (connects to Zidane, not Liverpool), France (connects to Zidane, not Liverpool), Benzema (connects to Real Madrid, not Liverpool).

### Hard — Optimization: "Can you find the shortest route?"
- **Structure:** 2-3 valid complete paths from Start to End. One is shorter (optimal). Scored by route length.
- **Player experience:** Completion is easy; finding the *shortest* path is the challenge.
- **Example:** Thierry Henry → Arsène Wenger. Path A (optimal, 3 hops): Henry→Arsenal→Wenger. Path B (4 hops): Henry→France→1998 World Cup→Wenger.

---

## Key Design Rules

1. **Easy distractors must have zero Wikidata edges to any path node** — verified programmatically, never manually curated.
2. **Medium dead-end branches connect to exactly one path node** — they can't "skip" to the End.
3. **Hard paths differ by hop count** — the optimal path is strictly shorter, not just different.
4. **Total bubble count stays at 12** (current default `targetBubbleCount`).

---

## Files

| File | Change |
|------|--------|
| `pipeline/src/puzzleComposer.ts` | New distractor sourcing logic per difficulty type |
| `pipeline/src/puzzleQC.ts` | Add validation for distractor isolation (Easy) and branch structure (Medium) |
| `pipeline/src/scripts/run-domain.ts` | No change needed — already threads `difficulty` through |
| `mobile/app/puzzle/[id].tsx` | Hard difficulty: show "find shortest path" framing, update score display |
| `mobile/app/howtoplay.tsx` | Update all three difficulty descriptions |
| `mobile/app/onboarding.tsx` | Update difficulty intro copy |
| `mobile/components/PuzzleCanvas.tsx` | Optional: "no connection" feedback when dragging between two island distractors |
| `supabase/migrations/` | No schema change needed — `optimal_path` and `bubbles` are already flexible |

---

## Task 1: Pipeline — Easy distractor sourcing

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`

The core change: after `composePuzzleForDifficulty` finds a valid path for Easy difficulty, replace the current distractor selection (which just picks random domain entities) with **isolated distractor selection** — nodes that share zero edges with any path node.

- [ ] **Step 1: Read the current distractor/bubble selection logic**

  Read `pipeline/src/puzzleComposer.ts` — find where `bubbles` is assembled beyond the path nodes. Understand the current selection.

- [ ] **Step 2: Write the failing test**

  In `pipeline/src/tests/puzzleComposer.test.ts`, add:
  ```typescript
  describe('Easy distractor isolation', () => {
    it('easy bubbles have no edges to any path node', () => {
      // build a minimal graph and entity list
      // call composePuzzleForDifficulty({ targetDifficulty: 'easy', ... })
      // for each non-path bubble, assert no edge to any path node exists
      const puzzle = composePuzzleForDifficulty(...)
      const pathIds = new Set(puzzle.optimalPath)
      for (const bubble of puzzle.bubbles) {
        if (pathIds.has(bubble.id)) continue
        const neighbors = graph[bubble.id] ?? []
        for (const pathId of pathIds) {
          expect(neighbors).not.toContain(pathId)
        }
      }
    })
  })
  ```

  Run: `cd pipeline && npx jest --no-coverage src/tests/puzzleComposer.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement isolated distractor selection**

  In `composePuzzleForDifficulty`, after the path is found for Easy:
  ```typescript
  function selectIsolatedDistractors(
    pathIds: Set<string>,
    entities: Entity[],
    graph: Graph,
    count: number,
  ): string[] {
    return entities
      .filter(e => !pathIds.has(e.id))
      .filter(e => {
        // zero edges to any path node
        const neighbors = new Set(graph[e.id] ?? [])
        for (const pid of pathIds) {
          if (neighbors.has(pid)) return false
          if ((graph[pid] ?? []).includes(e.id)) return false
        }
        return true
      })
      .sort(() => Math.random() - 0.5)  // shuffle
      .slice(0, count)
      .map(e => e.id)
  }
  ```

  Wire into Easy bubble assembly. Fall back to current behavior if not enough isolated candidates.

- [ ] **Step 4: Run test to verify it passes**

  Run: `cd pipeline && npx jest --no-coverage src/tests/puzzleComposer.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add pipeline/src/puzzleComposer.ts pipeline/src/tests/puzzleComposer.test.ts
  git commit -m "feat(pipeline): Easy puzzles use isolated distractors (zero edges to path)"
  ```

---

## Task 2: Pipeline — Medium dead-end branch sourcing

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`

For Medium, replace random distractors with **branch nodes** — entities that connect to exactly one path node but have no path to End.

- [ ] **Step 1: Write the failing test**
  ```typescript
  describe('Medium branch distractors', () => {
    it('medium non-path bubbles connect to at most one path node', () => {
      const puzzle = composePuzzleForDifficulty({ targetDifficulty: 'medium', ... })
      const pathIds = new Set(puzzle.optimalPath)
      for (const bubble of puzzle.bubbles) {
        if (pathIds.has(bubble.id)) continue
        const neighbors = graph[bubble.id] ?? []
        const pathConnections = neighbors.filter(n => pathIds.has(n))
        expect(pathConnections.length).toBeLessThanOrEqual(1)
      }
    })
  })
  ```

- [ ] **Step 2: Implement branch distractor selection**
  ```typescript
  function selectBranchDistractors(
    pathIds: Set<string>,
    endId: string,
    entities: Entity[],
    graph: Graph,
    count: number,
  ): string[] {
    return entities
      .filter(e => !pathIds.has(e.id))
      .filter(e => {
        const neighbors = new Set(graph[e.id] ?? [])
        const pathConnections = [...pathIds].filter(pid => neighbors.has(pid))
        // Must connect to exactly 1 path node, and NOT be the End itself
        return pathConnections.length === 1 && e.id !== endId
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map(e => e.id)
  }
  ```

  Mix: ~half branch distractors, ~half isolated distractors (for padding when branch candidates are scarce).

- [ ] **Step 3: Run tests, commit**
  ```bash
  git commit -m "feat(pipeline): Medium puzzles use dead-end branch distractors"
  ```

---

## Task 3: Pipeline — Hard multi-path selection

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`
- Modify: `pipeline/src/graphBuilder.ts` (may need BFS that returns ALL shortest paths, not just one)

For Hard, find a Start/End pair where multiple complete paths exist, choose the puzzle where the shortest path is strictly shorter than alternatives.

- [ ] **Step 1: Write the failing test**
  ```typescript
  describe('Hard multi-path puzzles', () => {
    it('hard puzzle has at least 2 valid complete paths', () => {
      const puzzle = composePuzzleForDifficulty({ targetDifficulty: 'hard', ... })
      // Count how many bubble subsets form a valid Start→End path
      // (simplified: check that optimalPath length < max path length in bubbles)
      expect(puzzle.alternativePaths?.length).toBeGreaterThanOrEqual(1)
    })
  })
  ```

- [ ] **Step 2: Add `alternativePaths` to `ComposedPuzzle` type**
  ```typescript
  interface ComposedPuzzle {
    // existing fields...
    alternativePaths?: string[][]  // other valid paths, longer than optimalPath
  }
  ```

- [ ] **Step 3: Implement multi-path BFS in composer**

  For Hard: after finding a shortest path, do a second BFS pass that finds all paths up to `optimalPath.length + 2` hops. If at least one alternative exists, include those path nodes in the bubble set (they become the "red herring" route).

- [ ] **Step 4: Run tests, commit**
  ```bash
  git commit -m "feat(pipeline): Hard puzzles include alternative paths for multi-route optimization"
  ```

---

## Task 4: Mobile — Hard difficulty framing

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Modify: `mobile/components/PuzzleCanvas.tsx` (if needed)

Hard difficulty currently shows "find the path". Change to "find the shortest path" and show hop count feedback.

- [ ] **Step 1: Read the puzzle screen**

  Read `mobile/app/puzzle/[id].tsx` — understand how difficulty is read and how the header/completion state is rendered.

- [ ] **Step 2: Update Hard completion message**

  On path completion for Hard:
  - If player used `optimalPath.length` hops: "Optimal! You found the shortest route."
  - If player used more hops: "You found a path! The optimal route was N hops." (show optimal path)

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "feat(mobile): Hard difficulty shows optimal vs actual path length on completion"
  ```

---

## Task 5: Mobile — How to play + Onboarding copy

**Files:**
- Modify: `mobile/app/howtoplay.tsx`
- Modify: `mobile/app/onboarding.tsx`

- [ ] **Step 1: Read current howtoplay and onboarding**

- [ ] **Step 2: Update difficulty descriptions**

  Replace current descriptions with:
  - **Easy:** "One path connects Start to End. Can you identify THE bridge among the distractors?"
  - **Medium:** "Only one route completes. Can you navigate through the dead ends?"
  - **Hard:** "Multiple paths work — but only one is shortest. Can you find the optimal route?"

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "feat(mobile): update how-to-play and onboarding for new difficulty models"
  ```

---

## Open Questions (decide before implementing Task 1)

1. **Fallback behavior:** If we can't find enough isolated distractors for Easy (sparse graph), fall back to current behavior or reduce bubble count? Recommendation: fall back silently and log a warning.

2. **Easy "no connection" feedback:** When player drags an island distractor onto another island distractor, show a subtle "no connection" shake? Currently nothing happens. This could teach the model but might feel frustrating. Decision needed before PuzzleCanvas changes.

3. **Hard scoring:** Currently time + path-length based. With multi-path Hard, the scoring already rewards shorter paths via `optimalPathBonus`. Verify this is sufficient or adjust weights.

4. **DB schema:** `alternativePaths` from Task 3 — store in `puzzles` table or derive at play time from `bubbles`+`connections`? Recommend storing as `alternative_paths jsonb` column for transparency.

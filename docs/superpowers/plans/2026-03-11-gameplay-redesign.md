# Gameplay Redesign: Deduction / Exploration / Optimization — All Domains

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "path of fixed length" puzzle model with three genuinely distinct cognitive challenges — one per difficulty — each with a different structure of distractors and multiple paths. Validated on Videogames in the 2026-03-10 plan; this plan generalizes to ALL domains.

**Reference:** `docs/superpowers/plans/2026-03-10-puzzle-redesign-videogames.md` — the canonical design spec. Everything here is derived from that document.

---

## The Three Models

### Easy — Deduction: "Can you identify THE bridge?"
- **Structure:** One valid complete path (Start → bridge₁ → bridge₂ → End). Remaining bubbles are **island distractors** — domain-relevant but zero Wikidata edges to any path node.
- **Player experience:** Which of these bubbles is THE one that connects Start to End? Pure elimination.
- **Win condition:** Reach End via any connected sequence. With only one valid path, this is equivalent to finding the optimal path.

### Medium — Exploration: "Can you navigate the tree?"
- **Structure:** One valid complete path. Additional bubbles connect to 1-2 path nodes but **dead-end** before reaching End.
- **Player experience:** Multiple branches start promisingly but only one route completes. Must backtrack.
- **Win condition:** Reach End via any connected sequence. Players who take a longer detour through a dead-end and back still win — just with fewer points.

### Hard — Optimization: "Can you find the shortest route?"
- **Structure:** 2-3 valid complete paths of different lengths. One is strictly shorter (optimal).
- **Player experience:** Completion is achievable via multiple routes; finding the *shortest* is the real challenge.
- **Win condition:** Reach End via any connected sequence. Scoring rewards path length vs. optimal.

---

## Key Design Rules

1. **Easy distractors have zero Wikidata edges to any path node** — verified programmatically.
2. **Medium distractors connect to at most 1 path node and cannot reach End** — dead-ends only.
3. **Hard has 2-3 verified complete paths** — optimal path is strictly shorter, not just different.
4. **Total bubble count stays at 12** (current `targetBubbleCount`).
5. **Win condition is reach-the-End, not match-the-stored-path** — any connected sequence wins. Scoring compares player hops to `optimalPath.length`.
6. **Narrative describes the optimal path** — LLM-generated description tells the story of the specific `optimalPath`, not just the topic area.
7. **Bridge nodes have difficulty classifications** — Easy bridges are universally recognizable; Medium bridges require some domain knowledge; Hard bridges require expertise.
8. **Hub nodes are blacklisted as bridges** — nodes with too many connections (threshold varies by domain) make trivially-guesssable bridges and are never used as intermediates.

---

## Bridge Node Difficulty Classification

From the videogames design — generalized to all domains:

**Two-axis model:**

**Axis 1 — Node type baseline:**
| Entity Type | Baseline Difficulty | Notes |
|-------------|--------------------|----|
| character / series / platform | Easy | Universally recognizable |
| real-world location (city, country) | Easy | But often a hub — check count |
| fictional location / setting | Medium | Requires domain familiarity |
| company / publisher (sitelinks ≥ 100) | Easy | else Medium |
| developer / studio | Medium | Unless very famous |
| person (director, composer, coach) | Medium–Hard | Depends on sitelinks |
| award / genre / movement | Easy–Medium | Depends on recognition |

**Axis 2 — Sitelinks adjustment:**
- ≥ 100 sitelinks → shift one level easier
- 20–99 sitelinks → stay at baseline
- < 20 sitelinks → shift one level harder

**Hub threshold (by domain):** A node connecting to more than N anchors of the domain type is a hub and blacklisted as a bridge. N varies:
- Videogames: 6 games
- Soccer: ~8 clubs
- Movies: ~12 films
- Other domains: tune empirically, default 10

---

## Distractor Isolation Rules

**Easy:** For each distractor D and each path node P — no edge exists between D and P in the full graph. Verified by checking both `graph[D]` and `graph[P]`.

**Medium:** Distractors connected to path nodes are allowed, but must not be able to reach `endId` within the remaining hop budget. Dead-end = no path to End.

**Hard:** No strict distractor isolation — some distractors may be on the longer valid paths (they're part of the alternate routes).

---

## Connection Themes

Every puzzle's path has an edge-type sequence. Store as `connection_theme` on the puzzle:

```
game →[features character]→ character →[developed by]→ developer →[published by]→ publisher →[released on]→ game
Theme: "character → developer → publisher"
```

This is domain-agnostic: soccer puzzle might be `"played for → coached by → managed"`, movies might be `"directed → produced by → starred in"`.

Stored in `puzzles.connection_theme` (new DB column). Show as a hint or subtitle on the puzzle screen.

---

## Narrative for the Optimal Path

Currently the LLM writes a generic topic description. Change to: describe the specific `optimalPath` as a story.

Prompt template:
```
Write a 1-2 sentence puzzle description that hints at the connection without revealing it.
Start: {startLabel}
End: {endLabel}
Path: {label1} → {label2} → ... → {endLabel}

Make it feel like a journey worth taking. Don't list the path nodes directly.
```

Example output: *"From the frontlines of Hyrule to the boardrooms of Seattle — this path winds through a legendary franchise, its long-time developer, and the company that eventually acquired them."*

---

## Files to Change

| File | Change |
|------|--------|
| `pipeline/src/puzzleComposer.ts` | Already updated: `distractorMode` param, `selectIsolatedDistractors()`, `selectBranchDistractors()` ✓ |
| `pipeline/src/nodeClassifier.ts` | Create: classify bridge nodes per domain (generalize from videogames plan) |
| `pipeline/src/puzzleQC.ts` | Add validation: distractor isolation check (Easy), dead-end check (Medium), path-count check (Hard) |
| `pipeline/src/scripts/run-domain.ts` | Thread `distractorMode` from difficulty into `composePuzzleForDifficulty` |
| `mobile/app/puzzle/[id].tsx` | Change win condition: any path to End wins; update scoring |
| `mobile/app/howtoplay.tsx` | Update difficulty descriptions |
| `mobile/app/onboarding.tsx` | Update difficulty intro copy |
| `supabase/migrations/` | Add `connection_theme text` column to `puzzles` |

---

## Implementation Status

- [x] **Task 1 (Easy isolated distractors):** `selectIsolatedDistractors()` implemented in `puzzleComposer.ts`, tests pass. Committed `498af53`.
- [x] **Task 2 (Medium branch distractors):** `selectBranchDistractors()` implemented, tests pass. Committed `498af53`.
- [ ] **Task 3 (Hard multi-path selection):** Find Start/End pairs with 2-3 verified paths; include alternate path nodes in bubble set.
- [ ] **Task 4 (Mobile win condition):** Any path to End wins; scoring compares player hops to optimal.
- [ ] **Task 5 (Mobile Hard framing):** Show "find the shortest route" UI; on completion show optimal vs actual.
- [ ] **Task 6 (How to play + Onboarding copy):** Update all three difficulty descriptions.
- [ ] **Task 7 (Narrative for optimal path):** Update LLM prompt to tell the story of the specific path.
- [ ] **Task 8 (Connection themes):** Derive edge-type sequence from path; store as `connection_theme`; add DB column.

---

## Task 3: Pipeline — Hard multi-path selection

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`

For Hard, find a Start/End pair where 2-3 complete paths exist, with the optimal strictly shorter than alternatives. Include the alternate path nodes in the bubble set so players can discover them.

- [ ] **Step 1: Write failing test**
  ```typescript
  describe('Hard multi-path puzzles', () => {
    it('hard puzzle has at least 2 valid complete paths in the bubble subgraph', () => {
      const puzzle = composePuzzleForDifficulty({ ..., targetDifficulty: 'hard' })
      // Count distinct paths in puzzle.connections
      const pathCount = countAllPaths(puzzle.startId, puzzle.endId, puzzle.connections)
      expect(pathCount).toBeGreaterThanOrEqual(2)
    })
  })
  ```

- [ ] **Step 2: Add `alternativePaths` to `ComposedPuzzle`**
  ```typescript
  interface ComposedPuzzle {
    // existing...
    alternativePaths?: string[][]  // valid paths longer than optimalPath
  }
  ```

- [ ] **Step 3: Implement multi-path BFS in `composePuzzle`**

  For Hard: after finding the optimal path, do a second BFS pass finding all paths up to `optimalPath.length + 2` hops. If at least one alternative exists, include those extra path nodes in the bubble set. Return `alternativePaths` on the puzzle.

- [ ] **Step 4: Run tests, commit**
  ```bash
  git commit -m "feat(pipeline): Hard puzzles include alternate paths for multi-route optimization"
  ```

---

## Task 4: Mobile — Free-path win condition

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Modify: `mobile/components/PuzzleCanvas.tsx` (if path validation lives there)

- [ ] **Step 1: Find win detection** — search for where player's path is compared to `optimalPath`.

- [ ] **Step 2: Replace exact-match check with reachability check**

  Replace: `playerPath.join(',') === optimalPath.join(',')`
  With: player has reached `endId` via a connected sequence (each consecutive pair has an edge in `connections`)

- [ ] **Step 3: Update scoring for path length delta**

  `optimalPathBonus` compares `playerPath.length` vs `puzzle.optimalPath.length`:
  - Optimal length → full bonus
  - 1 extra hop → partial bonus
  - 2+ extra hops → no bonus

- [ ] **Step 4: Commit**
  ```bash
  git commit -m "feat(mobile): any valid path from Start to End wins — free-path win condition"
  ```

---

## Task 5: Mobile — Hard difficulty framing

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`

- [ ] **Step 1:** On Hard completion, show:
  - If optimal: "Optimal! You found the shortest route."
  - If longer: "You completed it! The shortest route was N hops." (show optimal path)

- [ ] **Step 2: Commit**
  ```bash
  git commit -m "feat(mobile): Hard difficulty shows optimal vs actual path length on completion"
  ```

---

## Task 6: Mobile — How to play + Onboarding copy

**Files:**
- Modify: `mobile/app/howtoplay.tsx`
- Modify: `mobile/app/onboarding.tsx`

- [ ] **Step 1: Read current files**

- [ ] **Step 2: Update descriptions**
  - **Easy:** "One path connects Start to End. The other bubbles are red herrings — can you find THE bridge?"
  - **Medium:** "Only one route completes the connection. Can you navigate through the dead ends?"
  - **Hard:** "Multiple paths work — but only one is shortest. Can you find the optimal route?"

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "feat(mobile): update how-to-play and onboarding for new difficulty models"
  ```

---

## Task 7: Pipeline — Narrative for optimal path

**Files:**
- Find and modify LLM narrative generation in `pipeline/src/`

- [ ] **Step 1:** Search for OpenAI/LLM calls — find where narrative/description is generated.

- [ ] **Step 2:** Update prompt to include the optimal path labels and instruct the LLM to write a path-specific story (see prompt template above).

- [ ] **Step 3: Commit**
  ```bash
  git commit -m "feat(pipeline): narrative generation uses optimal path for story-driven descriptions"
  ```

---

## Task 8: Connection themes

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts` — add `buildConnectionTheme()` to `ComposedPuzzle`
- Create: `supabase/migrations/YYYYMMDD_add_connection_theme.sql`
- Modify: `pipeline/src/index.ts` — store `connection_theme` on publish

- [ ] **Step 1:** Add `connectionTheme?: string` to `ComposedPuzzle` interface.

- [ ] **Step 2:** Implement `buildConnectionTheme(path, edgeLabels, entityMap)` — walks the path, looks up `edgeLabels[a|b]` for each hop, falls back to `entityType` of the node.

- [ ] **Step 3:** Wire into `composePuzzle` return value.

- [ ] **Step 4:** Write and apply DB migration.

- [ ] **Step 5:** Store on publish in `index.ts`.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(pipeline): add connection_theme to puzzles — edge-type sequence as puzzle descriptor"
  ```

---

## Open Questions

1. **Hard scoring weights:** `optimalPathBonus` already rewards shorter paths. Verify current weights are sufficient with the new multi-path Hard structure, or adjust.

2. **DB schema for `alternativePaths`:** Store in `puzzles.alternative_paths jsonb` for transparency, or derive at play time from `bubbles`+`connections`? Recommendation: derive at play time — avoids schema change and `connections` already has the full subgraph.

3. **Connection theme display in mobile:** Where and how? Subtitle under the puzzle title? Revealed as a hint? Decide before Task 8 is wired into the UI.

4. **Generalizing node classifier beyond videogames:** The `nodeClassifier.ts` from the videogames plan is domain-specific. For other domains, the same two-axis model applies but hub thresholds and type baselines differ. Build as a domain-configurable module.

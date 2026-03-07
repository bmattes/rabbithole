# Per-Difficulty Puzzles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate 3 puzzles per category per day (easy, medium, hard) and serve the correct difficulty to each player based on their progression level.

**Architecture:** The `puzzles` table unique constraint changes from `(category_id, date)` to `(category_id, date, difficulty)`. The pipeline runs 3 composition attempts per category targeting each difficulty tier, retrying until it finds a valid puzzle that matches. The mobile app reads the player's unlocked difficulties from `useProgression` and fetches the hardest difficulty they've unlocked when loading a puzzle.

**Tech Stack:** Supabase (Postgres migration), Node.js pipeline (TypeScript), React Native / Expo mobile app (TypeScript).

---

## Phase 1: Schema Migration

### Task 1: Update puzzles table unique constraint

**Files:**
- Create: `supabase/migrations/20260307_per_difficulty_puzzles.sql`

**Step 1: Create the migration file**

```sql
-- supabase/migrations/20260307_per_difficulty_puzzles.sql

-- Drop the old unique constraint (one puzzle per category per day)
ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_category_id_date_key;

-- Add new unique constraint (one puzzle per category per day per difficulty)
ALTER TABLE puzzles ADD CONSTRAINT puzzles_category_id_date_difficulty_key
  UNIQUE (category_id, date, difficulty);

-- Add difficulty column if it doesn't exist (it was added in a prior migration but confirm)
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy';
```

**Step 2: Run the migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run.

Expected: No errors. Verify in Table Editor that `puzzles` no longer has `puzzles_category_id_date_key` and has `puzzles_category_id_date_difficulty_key` instead.

**Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260307_per_difficulty_puzzles.sql
git commit -m "feat: change puzzles unique constraint to (category_id, date, difficulty)"
```

---

## Phase 2: Pipeline — Target-Difficulty Composition

### Task 2: Add difficulty-targeted composition to puzzleComposer.ts

The pipeline needs to generate puzzles that hit specific difficulty tiers. Currently `composePuzzle` finds any valid puzzle and reports its difficulty. We need a wrapper that retries until it finds a puzzle matching the target difficulty.

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`

**Step 1: Add `composePuzzleForDifficulty` function at the end of the file**

```typescript
/**
 * Attempt to compose a puzzle that matches the target difficulty.
 * Retries up to maxAttempts times, picking random start/end pairs each time.
 * Returns the first puzzle that matches, or null if none found.
 */
export function composePuzzleForDifficulty({
  entities,
  graph,
  entityIds,
  targetDifficulty,
  targetBubbleCount = 12,
  maxAttempts = 150,
}: {
  entities: Entity[]
  graph: Graph
  entityIds: string[]
  targetDifficulty: Difficulty
  targetBubbleCount?: number
  maxAttempts?: number
}): ComposedPuzzle | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue

    const puzzle = composePuzzle({ entities, graph, startId, endId, targetBubbleCount })
    if (puzzle && puzzle.difficulty === targetDifficulty) {
      return puzzle
    }
  }
  return null
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/bmattes/Documents/RabbitHole/pipeline && npx tsc --noEmit 2>&1
```
Expected: No errors.

**Step 3: Commit**

```bash
git add pipeline/src/puzzleComposer.ts
git commit -m "feat: add composePuzzleForDifficulty — retry until target difficulty matched"
```

---

### Task 3: Update pipeline index.ts to generate 3 puzzles per category

**Files:**
- Modify: `pipeline/src/index.ts`

**Step 1: Read the current file** to understand exact structure before editing.

**Step 2: Replace `generatePuzzleForCategory` with a difficulty-aware version**

Replace the entire `generatePuzzleForCategory` function with:

```typescript
async function generatePuzzleForCategory(
  categoryId: string,
  categoryName: string,
  domain: CategoryDomain,
  date: string
) {
  console.log(`\n[${categoryName}] Fetching entities from Wikidata...`)
  const entities = await fetchEntities(domain, 1500)
  console.log(`[${categoryName}] Got ${entities.length} entities`)

  const graph = buildGraph(entities)

  const ANCHOR_TYPES: Record<string, string[]> = {
    movies: ['film'],
    sport: ['person', 'team', 'city'],
    music: ['person', 'song'],
    science: ['person'],
    history: ['person'],
  }
  const anchorTypes = ANCHOR_TYPES[domain] ?? null

  const entityIds = entities
    .filter(e => {
      if (e.relatedIds.length < 2) return false
      if (e.label.length > 30) return false
      if (anchorTypes && e.entityType && !anchorTypes.includes(e.entityType)) return false
      return true
    })
    .map(e => e.id)

  const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

  for (const difficulty of difficulties) {
    // Skip if already published for this date + difficulty
    const { data: existing } = await supabase
      .from('puzzles')
      .select('id')
      .eq('category_id', categoryId)
      .eq('date', date)
      .eq('difficulty', difficulty)
      .eq('status', 'published')
      .single()

    if (existing) {
      console.log(`[${categoryName}/${difficulty}] ✓ Already published for ${date}, skipping`)
      continue
    }

    console.log(`[${categoryName}/${difficulty}] Composing puzzle...`)
    const puzzle = composePuzzleForDifficulty({
      entities,
      graph,
      entityIds,
      targetDifficulty: difficulty,
      maxAttempts: 150,
    })

    if (!puzzle) {
      console.error(`[${categoryName}/${difficulty}] Failed to compose puzzle after 150 attempts`)
      continue
    }

    const entityMap = new Map(entities.map(e => [e.id, e]))
    const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)
    console.log(`[${categoryName}/${difficulty}] Path: ${pathLabels.join(' → ')}`)

    console.log(`[${categoryName}/${difficulty}] Generating narrative...`)
    const narrative = await generateNarrative({
      startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
      endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
      pathLabels,
      category: categoryName,
    })

    const { data, error } = await supabase.from('puzzles').upsert({
      category_id: categoryId,
      date,
      start_concept: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
      end_concept: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
      bubbles: puzzle.bubbles,
      connections: puzzle.connections,
      optimal_path: puzzle.optimalPath,
      difficulty: puzzle.difficulty,
      narrative,
      status: 'published',
    }, { onConflict: 'category_id,date,difficulty' }).select('id').single()

    if (error) {
      console.error(`[${categoryName}/${difficulty}] DB error:`, error.message)
      continue
    }

    console.log(`[${categoryName}/${difficulty}] ✓ Published puzzle ${data.id}`)
  }
}
```

Also add `Difficulty` to the import from `./puzzleComposer`:
```typescript
import { composePuzzle, composePuzzleForDifficulty, Difficulty } from './puzzleComposer'
```

**Step 3: Verify TypeScript compiles**

```bash
cd /Users/bmattes/Documents/RabbitHole/pipeline && npx tsc --noEmit 2>&1
```
Expected: No errors.

**Step 4: Commit**

```bash
git add pipeline/src/index.ts
git commit -m "feat: generate easy + medium + hard puzzle per category per day"
```

---

## Phase 3: Mobile App — Serve Correct Difficulty

### Task 4: Update getTodaysPuzzle to accept difficulty parameter

**Files:**
- Modify: `mobile/lib/api.ts`

**Step 1: Read the current `getTodaysPuzzle` function** (around line 25-45).

**Step 2: Replace `getTodaysPuzzle` to accept an optional difficulty**

```typescript
export async function getTodaysPuzzle(
  categoryId: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'easy'
): Promise<Puzzle | null> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('difficulty', difficulty)
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (error) return null

  const { data: cat } = await supabase
    .from('categories')
    .select('wikidata_domain')
    .eq('id', categoryId)
    .single()

  return { ...data, domain: cat?.wikidata_domain ?? null } as Puzzle
}
```

**Step 3: Check TypeScript**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 4: Commit**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && git add lib/api.ts
git commit -m "feat: getTodaysPuzzle accepts difficulty parameter"
```

---

### Task 5: Update usePuzzle hook to pass player's difficulty

**Files:**
- Modify: `mobile/hooks/usePuzzle.ts`

**Step 1: Update the hook signature to accept difficulty**

Replace the entire file with:

```typescript
import { useEffect, useState } from 'react'
import { getTodaysPuzzle, Puzzle } from '../lib/api'

export function usePuzzle(
  categoryId: string,
  userId?: string | null,
  difficulty: 'easy' | 'medium' | 'hard' = 'easy'
) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getTodaysPuzzle(categoryId, difficulty)
      .then((p) => {
        if (!p) setError('No puzzle found for today')
        else setPuzzle(p)
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false))
  }, [categoryId, userId, difficulty])

  return { puzzle, loading, error }
}
```

**Step 2: Check TypeScript**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 3: Commit**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && git add hooks/usePuzzle.ts
git commit -m "feat: usePuzzle accepts difficulty parameter"
```

---

### Task 6: Update puzzle screen to derive and pass correct difficulty

The puzzle screen gets a `categoryId` from route params. It needs to know the player's highest unlocked difficulty for that category and pass it to `usePuzzle`.

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`

**Step 1: Read the current file** fully before editing.

**Step 2: Add imports and derive difficulty**

Add imports:
```typescript
import { useProgression } from '../../hooks/useProgression'
```

Inside `PuzzleScreen`, after `const { userId } = useAuth()`:
```typescript
const progression = useProgression(userId)
// Serve the hardest difficulty the player has unlocked
const unlockedDifficulties = progression.unlockedDifficulties
const difficulty = unlockedDifficulties[unlockedDifficulties.length - 1] // last = hardest
```

**Step 3: Pass difficulty to usePuzzle**

Find:
```typescript
const { puzzle: livePuzzle, loading } = usePuzzle(categoryId, userId)
```

Replace with:
```typescript
const { puzzle: livePuzzle, loading } = usePuzzle(categoryId, userId, difficulty)
```

**Step 4: Also pass difficulty to XP computation in results**

The results screen currently stubs `difficulty: 'easy'`. Now that the puzzle screen knows the difficulty, pass it as a route param to the results screen.

Find where `router.push` navigates to results (around line 79). Add `&difficulty=${difficulty}` to the URL:

```typescript
router.push(
  `/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}&hops=${hops}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}&difficulty=${difficulty}${narrativeParam}`
)
```

**Step 5: Check TypeScript**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 6: Commit**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && git add "app/puzzle/[id].tsx"
git commit -m "feat: puzzle screen derives and passes player's highest unlocked difficulty"
```

---

### Task 7: Wire difficulty into results screen XP computation

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Read the current file** to find the params destructuring and XP useEffect.

**Step 2: Add difficulty to params destructuring**

Find the `useLocalSearchParams` call and add `difficulty`:
```typescript
const { id: puzzleId, score, timeMs, hops, optimalHops, playerPath, optimalPath, narrative, difficulty } =
  useLocalSearchParams<{
    id: string
    score: string
    timeMs: string
    hops: string
    optimalHops: string
    playerPath: string
    optimalPath: string
    narrative: string
    difficulty: string
  }>()
```

**Step 3: Use real difficulty in computeRunXP**

Find in the XP useEffect:
```typescript
difficulty: 'easy', // stub — puzzle difficulty not passed via params yet
```

Replace with:
```typescript
difficulty: (difficulty as 'easy' | 'medium' | 'hard') ?? 'easy',
```

**Step 4: Check TypeScript**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 5: Commit**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && git add "app/results/[id].tsx"
git commit -m "feat: use real puzzle difficulty for XP computation on results screen"
```

---

## Phase 4: Regenerate Today's Puzzles

### Task 8: Run the pipeline to generate today's puzzles

**Step 1: Make sure pipeline .env has correct credentials**

```bash
cat /Users/bmattes/Documents/RabbitHole/pipeline/.env
```
Expected: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` all set.

**Step 2: Run the pipeline for today**

```bash
cd /Users/bmattes/Documents/RabbitHole/pipeline && npx ts-node src/index.ts
```

Expected output per category:
```
[Movies/easy] Composing puzzle...
[Movies/easy] Path: X → Y → Z → ...
[Movies/easy] Generating narrative...
[Movies/easy] ✓ Published puzzle <uuid>
[Movies/medium] Composing puzzle...
...
[Movies/hard] ✓ Published puzzle <uuid>
```

**Step 3: Verify in Supabase**

Run this SQL in Supabase Dashboard:
```sql
SELECT c.name, p.difficulty, p.date, p.start_concept, p.end_concept
FROM puzzles p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'published'
ORDER BY c.name, p.difficulty;
```

Expected: 3 rows per active category (easy, medium, hard) for today's date.

**Step 4: Test on device**

- Level 1 player (new user) → should see Easy puzzle when tapping a category
- After leveling up past 5 → should see Medium puzzle

---

## Open Items

- `streakDay` in results screen is still hardcoded to `0` — needs real streak value from `awardXP` return or `useProgression`. Deferred.
- The `composePuzzleForDifficulty` retry budget (150 attempts) may not always find a `hard` puzzle for some domains — pipeline will log a failure and skip that difficulty. Monitor in production.
- Existing puzzles in DB with the old `(category_id, date)` constraint will have `difficulty = 'easy'` (the default) — they won't be matched for medium/hard players until the pipeline re-runs for each date.

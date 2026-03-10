# Edge Labels Hint System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store the relationship type for every edge in each puzzle (e.g. "cast member of", "directed by", "signed to") and display it as a floating hint pill when a player's drag line hovers over a connected bubble.

**Architecture:** Add `edgeLabel` to each `sq()` subquery declaration in the pipeline; build an `edgeLabels` map during graph construction; persist as `edge_labels jsonb` on the `puzzles` table; pass it through the API and component tree to `PuzzleCanvas`; render a floating pill on the drag line mid-point when hovering a valid connected node.

**Tech Stack:** TypeScript, Supabase (Postgres jsonb), React Native (Animated, PanResponder), Expo

---

### Task 1: DB Migration — add `edge_labels` column

**Files:**
- Create: `supabase/migrations/20260309_edge_labels.sql`

**Step 1: Write the migration**

```sql
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS edge_labels jsonb;
```

**Step 2: Apply it**

Paste into Supabase Dashboard → SQL Editor and run. No rollback needed (nullable column).

**Step 3: Commit**

```bash
git add supabase/migrations/20260309_edge_labels.sql
git commit -m "feat: add edge_labels column to puzzles"
```

---

### Task 2: Pipeline — add `edgeLabel` to `sq()` and subquery declarations

**Files:**
- Modify: `pipeline/src/wikidata.ts`

**Step 1: Update the `TaggedSubquery` interface and `sq()` helper**

Find the `sq()` function (~line 50) and add `edgeLabel`:

```typescript
// Before
function sq(difficulty: SubqueryDifficulty, types: [string, string], query: (limit: number) => string): TaggedSubquery {
  return { difficulty, types, query }
}

// After
function sq(difficulty: SubqueryDifficulty, types: [string, string], query: (limit: number) => string, edgeLabel?: string): TaggedSubquery {
  return { difficulty, types, query, edgeLabel }
}
```

Also add `edgeLabel?: string` to the `TaggedSubquery` interface (find it near the top of the file).

**Step 2: Add `edgeLabel` to every `sq()` call**

Go through every `sq()` call and add the label as the 4th argument. Reference table:

| Domain | types[0] | types[1] | Property | edgeLabel |
|--------|----------|----------|----------|-----------|
| sport | person | team | P54 | `"played for"` |
| sport | team | city | P131 | `"based in"` |
| sport | person | team | P6087 | `"coached"` |
| movies | film | person | P161 | `"cast member of"` |
| movies | film | person | P57 | `"directed by"` |
| movies | film | company | P272 | `"produced by"` |
| music | song | person | P175 | `"performed by"` |
| music | person | label | P264 | `"signed to"` |
| music | person | person | P737 | `"influenced by"` |
| videogames | game | series | P179 | `"part of series"` |
| videogames | series | company | P178/P123 | `"developed by"` |
| videogames | person | game | P8345 | `"appears in"` |
| videogames | game | company | P178 | `"developed by"` |
| videogames | game | company | P123 | `"published by"` |
| tv | show | person | P161 | `"cast member of"` |
| tv | show | person | P57/P162 | `"directed by"` |
| geography | city | country | P17 | `"located in"` |
| geography | country | continent | P30 | `"on continent"` |
| geography | capital | country | P17 | `"capital of"` |
| science | person | institution | P108 | `"worked at"` |
| science | person | field | P101 | `"worked in"` |
| history | person | party | P102 | `"member of"` |
| history | person | position | P39 | `"held office"` |
| literature | book | person | P50 | `"written by"` |
| literature | person | movement | P135 | `"part of movement"` |
| art | painting | person | P170 | `"created by"` |
| art | person | movement | P135 | `"part of movement"` |
| mythology | deity | pantheon | P17 | `"from mythology"` |
| philosophy | person | school | P135 | `"school of thought"` |
| space | person | agency | P108 | `"worked at"` |
| royals | person | country | P27 | `"monarch of"` |
| military | person | country | P27 | `"served"` |
| soccer | person | team | P54 | `"played for"` |
| soccer | team | league | P118 | `"plays in"` |
| basketball | person | team | P54 | `"played for"` |
| americanfootball | person | team | P54 | `"played for"` |
| tennis | person | country | P27 | `"represents"` |
| food | dish | country | P17 | `"originates from"` |
| comics | character | publisher | P123 | `"published by"` |

For any `sq()` calls not in this table, use a sensible generic based on the types (e.g. `person+person` → `"connected to"`).

**Step 3: TypeScript check**

```bash
cd pipeline && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add pipeline/src/wikidata.ts
git commit -m "feat: add edgeLabel to all sq() subquery declarations"
```

---

### Task 3: Pipeline — capture edge labels during graph construction

**Files:**
- Modify: `pipeline/src/wikidata.ts` (the `fetchEntities` / result-processing section ~line 700+)
- Modify: `pipeline/src/entityCache.ts` (the `Entity` / return type)

**Step 1: Add `edgeLabels` to the entity fetch return type**

In `entityCache.ts` (or wherever `Entity` is defined), find the return type of `fetchEntitiesCached` and add:

```typescript
export interface FetchResult {
  entities: Entity[]
  edgeLabels: Record<string, string>  // key: "idA|idB", value: label string
}
```

If `fetchEntitiesCached` currently returns `Entity[]` directly, change it to return `FetchResult`.

**Step 2: Build the `edgeLabels` map in `wikidata.ts`**

In the section where pairs `(aId, bId)` are processed (~line 720), capture the label from the subquery that produced this row. The subquery result loop needs to know which `TaggedSubquery` it came from.

Find the loop that iterates over subquery results and thread the `edgeLabel` through:

```typescript
// When processing a row from subquery sq:
const label = sq.edgeLabel
if (label) {
  edgeLabels[`${aId}|${bId}`] = label
  edgeLabels[`${bId}|${aId}`] = label  // store both directions
}
```

Return `{ entities: Array.from(entityMap.values()), edgeLabels }` from `fetchEntities`.

**Step 3: Update MusicBrainz to return edgeLabels too**

In `musicbrainz.ts`, the relationship types are known. Add labels:
- band membership → `"member of"`
- record label → `"signed to"`
- artist collaboration → `"collaborated with"`

Return `{ entities, edgeLabels }` from the MusicBrainz fetch function.

**Step 4: Update `entityCache.ts`**

`fetchEntitiesCached` caches and returns entities. Update it to also cache and return `edgeLabels`. The cache file can store both together as `{ entities, edgeLabels }`.

**Step 5: TypeScript check**

```bash
cd pipeline && npx tsc --noEmit
```

Fix any type errors from callers of `fetchEntitiesCached` (they now get `{ entities, edgeLabels }` instead of `Entity[]`).

**Step 6: Commit**

```bash
git add pipeline/src/wikidata.ts pipeline/src/entityCache.ts pipeline/src/musicbrainz.ts
git commit -m "feat: capture edge labels during graph construction"
```

---

### Task 4: Pipeline — thread edgeLabels through composer and publish

**Files:**
- Modify: `pipeline/src/puzzleComposer.ts`
- Modify: `pipeline/src/scripts/run-domain.ts`
- Modify: `pipeline/src/index.ts`

**Step 1: Add `edgeLabels` to `composePuzzleForDifficulty` input and output**

In `puzzleComposer.ts`, update the function signature to accept `edgeLabels: Record<string, string>` and return it filtered to only edges that survive the graph trim:

```typescript
// Input
interface ComposeInput {
  entities: Entity[]
  graph: Graph
  entityIds: string[]
  targetDifficulty: Difficulty
  domainOverrides?: any
  edgeLabels: Record<string, string>
}

// Output — add to return object
return { startId, endId, bubbles, connections, optimalPath, difficulty, edgeLabels: filteredEdgeLabels }
```

Filter `edgeLabels` to only keys where both IDs appear in `allBubbleIds`:

```typescript
const filteredEdgeLabels: Record<string, string> = {}
for (const [key, label] of Object.entries(edgeLabels)) {
  const [a, b] = key.split('|')
  if (bubbleSet.has(a) && bubbleSet.has(b)) {
    filteredEdgeLabels[key] = label
  }
}
```

**Step 2: Update `run-domain.ts` publish path**

In the upsert call, add `edge_labels: puzzle.edgeLabels ?? null`.

Also update the draft save/load to include `edgeLabels`.

**Step 3: Update `index.ts` publish path**

Same — add `edge_labels: puzzle.edgeLabels ?? null` to the upsert.

**Step 4: TypeScript check**

```bash
cd pipeline && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add pipeline/src/puzzleComposer.ts pipeline/src/scripts/run-domain.ts pipeline/src/index.ts
git commit -m "feat: thread edge labels through composer and publish to DB"
```

---

### Task 5: Mobile API — read `edge_labels` from DB

**Files:**
- Modify: `mobile/lib/api.ts`

**Step 1: Add `edgeLabels` to the `Puzzle` interface**

```typescript
export interface Puzzle {
  // ... existing fields ...
  edgeLabels?: Record<string, string>  // "idA|idB" → "cast member of"
}
```

**Step 2: Read it in `getTodaysPuzzle` (and any archive fetch)**

In the Supabase select query, add `edge_labels` to the selected columns. Map it to `edgeLabels` in the returned object:

```typescript
edgeLabels: (data.edge_labels as Record<string, string>) ?? undefined,
```

**Step 3: TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep -v '__tests__'
```

**Step 4: Commit**

```bash
git add mobile/lib/api.ts
git commit -m "feat: read edge_labels from DB into Puzzle type"
```

---

### Task 6: Mobile — pass edgeLabels to PuzzleCanvas

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Modify: `mobile/components/PuzzleCanvas.tsx`

**Step 1: Thread `edgeLabels` from puzzle screen to canvas**

In `puzzle/[id].tsx`, find where `PuzzleCanvas` is rendered and add:

```tsx
<PuzzleCanvas
  // ... existing props ...
  edgeLabels={puzzle.edgeLabels}
/>
```

**Step 2: Add `edgeLabels` to `PuzzleCanvasProps`**

```typescript
interface PuzzleCanvasProps {
  // ... existing ...
  edgeLabels?: Record<string, string>
}
```

**Step 3: Pass edgeLabels into the ref so the PanResponder can access it**

```typescript
const edgeLabelsRef = useRef(edgeLabels)
edgeLabelsRef.current = edgeLabels
```

**Step 4: Commit**

```bash
git add mobile/app/puzzle/[id].tsx mobile/components/PuzzleCanvas.tsx
git commit -m "feat: thread edgeLabels prop through puzzle screen to canvas"
```

---

### Task 7: Mobile — render the hint pill on drag

**Files:**
- Modify: `mobile/components/PuzzleCanvas.tsx`

**Step 1: Add `hintLabel` state**

```typescript
const [hintLabel, setHintLabel] = useState<string | null>(null)
const [hintPos, setHintPos] = useState<{ x: number; y: number } | null>(null)
```

**Step 2: Compute hint when hovering a connected bubble**

In `onPanResponderMove`, after `setHoveringId(overBubble.id)`, look up the edge label:

```typescript
// After setting hoveringId:
const lastId = activePathRef.current[activePathRef.current.length - 1]
const labels = edgeLabelsRef.current
const key1 = `${lastId}|${overBubble.id}`
const key2 = `${overBubble.id}|${lastId}`
const label = labels?.[key1] ?? labels?.[key2] ?? null

// Only show hint if these two nodes are actually connected
const isConnected = connectionsRef.current[lastId]?.includes(overBubble.id)
setHintLabel(isConnected ? label : null)

// Position: midpoint between lastBubble and overBubble
const lastBubble = bubblesRef.current.find(b => b.id === lastId)
if (lastBubble && isConnected && label) {
  setHintPos({
    x: (lastBubble.position.x + overBubble.position.x) / 2,
    y: (lastBubble.position.y + overBubble.position.y) / 2,
  })
}
```

**Step 3: Clear hint on lift and on connect**

In `onPanResponderRelease` and `onPanResponderTerminate`, add:
```typescript
setHintLabel(null)
setHintPos(null)
```

In `connectBubbleRef`, add the same two clears.

**Step 4: Render the hint pill**

In the canvas JSX, after the drag line and before the bubbles:

```tsx
{hintLabel && hintPos && (
  <View
    pointerEvents="none"
    style={[
      hintStyles.pill,
      {
        position: 'absolute',
        left: hintPos.x,
        top: hintPos.y,
        transform: [{ translateX: -60 }, { translateY: -14 }],
      },
    ]}
  >
    <Text style={hintStyles.text}>{hintLabel}</Text>
  </View>
)}
```

**Step 5: Add pill styles**

```typescript
const hintStyles = StyleSheet.create({
  pill: {
    width: 120,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})
```

**Step 6: TypeScript check**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep -v '__tests__'
```

Expected: no errors.

**Step 7: Commit**

```bash
git add mobile/components/PuzzleCanvas.tsx
git commit -m "feat: show edge label hint pill when hovering connected bubble"
```

---

### Task 8: Re-generate today's puzzles with edge labels (optional)

Today's 75 published puzzles don't have `edge_labels` yet (null). The hint system degrades gracefully — no pill shown when labels are absent. For full hint support on live puzzles, re-run the pipeline for today's date.

Alternatively, just let the next day's generation pick it up naturally.

**If re-running today:**
```bash
cd pipeline
npx ts-node src/scripts/delete-date.ts 2026-03-09   # clear today if needed
npx ts-node src/scripts/run-domain.ts --domain movies --date 2026-03-09
# ... repeat per domain or run full pipeline
```

---

### Task 9: Final check and TestFlight build

**Step 1: Smoke test on device**

- Open a puzzle, start dragging from Start bubble
- Drag over a connected bubble — hint pill should appear
- Drag over an unconnected bubble — no pill
- Drag over a bubble when no `edgeLabels` in puzzle — no pill, no crash

**Step 2: Build for TestFlight**

```bash
cd mobile
eas build --platform ios --profile preview
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: edge label hint system — show connection type on drag hover"
```

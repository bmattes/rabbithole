# Hints System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a consumable daily hints system to the puzzle screen with 4 hint types (Connection, Shuffle, Flash, Bridge), tracked per-user per-day in Supabase.

**Architecture:** A `hint_usage` Supabase table tracks daily consumption per user. A `useHints` hook reads/writes inventory. The puzzle screen renders a `HintTray` component with 4 buttons. Each hint type either mutates PuzzleCanvas state (Shuffle, Bridge, Flash) or toggles a mode on PuzzleCanvas (Connection). PuzzleCanvas gains new optional props for each hint's effect.

**Tech Stack:** React Native, Expo, Supabase (postgres), TypeScript, React Native Reanimated (already in project for animations)

---

## Key Files to Understand First

- `mobile/app/puzzle/[id].tsx` — puzzle screen, renders PuzzleCanvas, owns state
- `mobile/components/PuzzleCanvas.tsx` — canvas with bubbles, drag-to-connect, hint pill (edgeLabels)
- `mobile/lib/api.ts` — Supabase query functions, `Puzzle` interface
- `mobile/hooks/useProgression.ts` — pattern to follow for new hooks
- `supabase/migrations/` — where to add the new migration

---

## Task 1: DB Migration — hint_usage table

**Files:**
- Create: `supabase/migrations/20260309_hint_usage.sql`

**Step 1: Write the migration**

```sql
create table if not exists hint_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  hints_used integer not null default 0,
  unique(user_id, usage_date)
);

alter table hint_usage enable row level security;

create policy "Users can read own hint usage"
  on hint_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own hint usage"
  on hint_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own hint usage"
  on hint_usage for update
  using (auth.uid() = user_id);
```

**Step 2: Apply it**

Apply via Supabase Dashboard → SQL Editor. Paste the migration and run it.

**Step 3: Verify**

In Supabase Dashboard → Table Editor, confirm `hint_usage` table exists with columns: `id`, `user_id`, `usage_date`, `hints_used`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260309_hint_usage.sql
git commit -m "feat: add hint_usage table for daily consumable hints"
```

---

## Task 2: useHints hook

**Files:**
- Create: `mobile/hooks/useHints.ts`

This hook reads today's hint usage for the current user and exposes a `useHint()` function that increments the counter. Returns `hintsRemaining` (3 - hints_used), `loading`, and `useHint`.

**Step 1: Write the hook**

```typescript
// mobile/hooks/useHints.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DAILY_HINT_LIMIT = 3

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useHints(userId: string | null) {
  const [hintsUsed, setHintsUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = localDateString()

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('hint_usage')
      .select('hints_used')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()
    setHintsUsed(data?.hints_used ?? 0)
    setLoading(false)
  }, [userId, today])

  useEffect(() => { load() }, [load])

  const useHint = useCallback(async (): Promise<boolean> => {
    if (!userId || hintsUsed >= DAILY_HINT_LIMIT) return false
    const next = hintsUsed + 1
    setHintsUsed(next)  // optimistic update
    const { error } = await supabase
      .from('hint_usage')
      .upsert({ user_id: userId, usage_date: today, hints_used: next }, { onConflict: 'user_id,usage_date' })
    if (error) {
      setHintsUsed(hintsUsed)  // revert on error
      return false
    }
    return true
  }, [userId, hintsUsed, today])

  return {
    hintsRemaining: Math.max(0, DAILY_HINT_LIMIT - hintsUsed),
    loading,
    useHint,
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors related to `useHints.ts`.

**Step 3: Commit**

```bash
git add mobile/hooks/useHints.ts
git commit -m "feat: useHints hook — daily consumable hint inventory from Supabase"
```

---

## Task 3: PuzzleCanvas — new hint props + Connection mode

**Files:**
- Modify: `mobile/components/PuzzleCanvas.tsx`

Add 4 new optional props to `PuzzleCanvasProps`:

```typescript
connectionModeActive?: boolean       // Connection hint: show labels on hover (no dwell required to see)
bridgeNodeId?: string | null         // Bridge hint: ID of revealed optimal-path node
flashPaths?: string[][]              // Flash hint: paths to animate (controlled externally)
shuffledBubbles?: BubbleData[]       // Shuffle hint: parent passes re-positioned bubbles
onConnectionModeUsed?: () => void    // called when connection is made while mode active
```

**Connection mode changes (lines ~212-231 in current file):**

Currently the hint pill shows whenever `edgeLabels` has a match. With Connection mode, nothing changes about the pill logic — it already works. The only change needed is: when `connectionModeActive` is true, also show the label for bubbles that are NOT yet connected (i.e. show "no connection" state more explicitly). Actually, the current logic already handles this: if no label exists, pill is hidden — that IS the "not connected" signal.

So for Connection mode: no canvas changes needed beyond accepting and passing through `connectionModeActive`. The parent (`puzzle/[id].tsx`) controls whether the mode is active; when `onConnectionModeUsed` fires (a connection is made), parent deactivates mode and calls `useHint()`.

**Bridge node highlight:**

When `bridgeNodeId` is set, pass it down to `Bubble` via a new `bridgeNodeId` prop on canvas. The `Bubble` component needs a new `'bridge'` BubbleState (or render a highlight ring).

**Changes to `PuzzleCanvasProps`:**

```typescript
interface PuzzleCanvasProps {
  bubbles: BubbleData[]
  connections: Record<string, string[]>
  startId: string
  endId: string
  minHops: number
  onPathComplete: (path: string[]) => void
  onPathChange?: (path: string[]) => void
  onCanvasLayout?: (height: number) => void
  edgeLabels?: Record<string, string>
  connectionModeActive?: boolean
  onConnectionModeUsed?: () => void
  bridgeNodeId?: string | null
  flashPaths?: string[][] | null
  onFlashComplete?: () => void
}
```

**Changes to `connectBubbleRef` (around line 142):**

```typescript
// After successful connection, if connection mode was active, notify parent
if (connectionModeActiveRef.current) {
  onConnectionModeUsedRef.current?.()
}
```

Add `connectionModeActiveRef` and `onConnectionModeUsedRef` alongside the other refs (lines 60-75).

**Changes to `getBubbleState` (around line 270):**

```typescript
function getBubbleState(id: string): BubbleState {
  if (id === startId) return 'start'
  if (id === endId) return 'end'
  if (id === bridgeNodeId) return 'bridge'
  if (activePath.includes(id) && settledIds.has(id)) return 'active'
  if (id === hoveringId) return 'active'
  return 'idle'
}
```

**Step 1: Add the new props, refs, and updated getBubbleState to PuzzleCanvas.tsx**

Follow the existing ref pattern (lines 60-75): add `connectionModeActiveRef`, `onConnectionModeUsedRef`, `bridgeNodeIdRef`.

After `connectBubbleRef` fires successfully (after the haptic, around line 141), add:
```typescript
if (connectionModeActiveRef.current) {
  onConnectionModeUsedRef.current?.()
}
```

Update `getBubbleState` to return `'bridge'` for `bridgeNodeId`.

**Step 2: Update Bubble component to handle 'bridge' state**

Open `mobile/components/Bubble.tsx`. Add `'bridge'` to the `BubbleState` type and render it with a gold/amber ring (use `#f59e0b` border color, 3px width) to distinguish it from active/idle.

**Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add mobile/components/PuzzleCanvas.tsx mobile/components/Bubble.tsx
git commit -m "feat: PuzzleCanvas — connection mode, bridge node highlight props"
```

---

## Task 4: Flash hint animation in PuzzleCanvas

**Files:**
- Modify: `mobile/components/PuzzleCanvas.tsx`

When `flashPaths` prop is set (non-null, non-empty), run a flash animation sequence:
- Each path in the array gets highlighted for 400ms, then cleared, then next path
- Order is whatever the parent passed (parent randomises)
- After all paths shown, call `onFlashComplete`
- Use a local `flashActivePath` state (separate from `activePath`) to render the flash lines

**Flash rendering (add after the active path lines render, around line 292):**

```tsx
{flashActivePath.length > 1 && flashActivePath.slice(0, -1).map((id, i) => {
  const from = getBubble(id)
  const to = getBubble(flashActivePath[i + 1])
  if (!from || !to) return null
  return (
    <ConnectionLine
      key={`flash-${id}-${flashActivePath[i+1]}`}
      from={from.position}
      to={to.position}
      active
      flash  // new prop on ConnectionLine for a different color (amber/gold)
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
    />
  )
})}
```

**Flash sequence effect (add useEffect):**

```typescript
const [flashActivePath, setFlashActivePath] = useState<string[]>([])

useEffect(() => {
  if (!flashPaths || flashPaths.length === 0) {
    setFlashActivePath([])
    return
  }
  let cancelled = false
  async function runFlash() {
    for (const path of flashPaths!) {
      if (cancelled) return
      setFlashActivePath(path)
      await new Promise(r => setTimeout(r, 400))
      if (cancelled) return
      setFlashActivePath([])
      await new Promise(r => setTimeout(r, 150))
    }
    if (!cancelled) onFlashComplete?.()
  }
  runFlash()
  return () => { cancelled = true; setFlashActivePath([]) }
}, [flashPaths])
```

**ConnectionLine flash prop:**

In `mobile/components/ConnectionLine.tsx`, add an optional `flash?: boolean` prop. When true, render the line in amber (`#f59e0b`) instead of the default active color.

**Step 1: Add `flashActivePath` state and `useEffect` to PuzzleCanvas**

**Step 2: Add flash rendering lines (above the active-path lines for z-order)**

**Step 3: Add `flash` prop to ConnectionLine and render in amber when set**

**Step 4: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add mobile/components/PuzzleCanvas.tsx mobile/components/ConnectionLine.tsx
git commit -m "feat: Flash hint animation — rapid path reveal sequence in PuzzleCanvas"
```

---

## Task 5: HintTray component

**Files:**
- Create: `mobile/components/HintTray.tsx`

A row of 4 hint buttons shown below the puzzle canvas. Shows remaining count. Buttons disabled when `hintsRemaining === 0` or when a hint is already active.

```typescript
// mobile/components/HintTray.tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors } from '../lib/theme'

export type HintType = 'connection' | 'shuffle' | 'flash' | 'bridge'

interface HintTrayProps {
  hintsRemaining: number
  activeHint: HintType | null
  onUseHint: (type: HintType) => void
  connectionAvailable: boolean  // false if no edgeLabels on this puzzle
}

const HINTS: Array<{ type: HintType; label: string; icon: string; description: string }> = [
  { type: 'connection', label: 'Connection', icon: '🔗', description: 'See how nodes connect' },
  { type: 'shuffle',    label: 'Shuffle',    icon: '🔀', description: 'Rearrange the bubbles' },
  { type: 'flash',      label: 'Flash',      icon: '⚡', description: 'Glimpse possible paths' },
  { type: 'bridge',     label: 'Bridge',     icon: '🌉', description: 'Reveal one path node' },
]

export function HintTray({ hintsRemaining, activeHint, onUseHint, connectionAvailable }: HintTrayProps) {
  const depleted = hintsRemaining === 0

  return (
    <View style={styles.tray}>
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Hints</Text>
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, i < hintsRemaining ? styles.dotActive : styles.dotUsed]} />
          ))}
        </View>
      </View>
      <View style={styles.buttons}>
        {HINTS.map(h => {
          const isActive = activeHint === h.type
          const disabled = depleted || (activeHint !== null && !isActive) || (h.type === 'connection' && !connectionAvailable)
          return (
            <Pressable
              key={h.type}
              style={[styles.btn, isActive && styles.btnActive, disabled && styles.btnDisabled]}
              onPress={() => !disabled && onUseHint(h.type)}
              disabled={disabled}
            >
              <Text style={styles.btnIcon}>{h.icon}</Text>
              <Text style={[styles.btnLabel, disabled && styles.btnLabelDisabled]}>{h.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tray: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  countLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#7c3aed' },
  dotUsed: { backgroundColor: colors.border },
  buttons: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)' },
  btnDisabled: { opacity: 0.35 },
  btnIcon: { fontSize: 18, marginBottom: 2 },
  btnLabel: { color: colors.textPrimary, fontSize: 10, fontWeight: '600' },
  btnLabelDisabled: { color: colors.textTertiary },
})
```

**Step 1: Create `HintTray.tsx` with the code above**

**Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add mobile/components/HintTray.tsx
git commit -m "feat: HintTray component — 4 hint buttons with remaining count display"
```

---

## Task 6: Wire hints into puzzle screen

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`

This is where all hint logic lives. Import `useHints`, `HintTray`, wire up each hint type.

**New state to add:**

```typescript
const { hintsRemaining, useHint } = useHints(userId)
const [activeHint, setActiveHint] = useState<HintType | null>(null)
const [bridgeNodeId, setBridgeNodeId] = useState<string | null>(null)
const [flashPaths, setFlashPaths] = useState<string[][] | null>(null)
const [shuffledBubbles, setShuffledBubbles] = useState<typeof layoutBubbles | null>(null)
```

**Bubbles to pass to canvas:** `shuffledBubbles ?? layoutBubbles`

**Hint handler:**

```typescript
async function handleUseHint(type: HintType) {
  const ok = await useHint()
  if (!ok) return

  if (type === 'connection') {
    setActiveHint('connection')
    // mode deactivates when connection is made (onConnectionModeUsed callback)
  }

  if (type === 'shuffle') {
    // Re-scatter the non-start/non-end bubbles
    const bubbles = shuffledBubbles ?? layoutBubbles
    const n = bubbles.length
    const fixed = new Set([0, n - 1])
    const positions = separateBubbles(
      bubbles.map(b => b.position).map((p, i) => fixed.has(i) ? p : {
        x: 60 + Math.random() * (SW - 120),
        y: 150 + Math.random() * ((canvasHeight - 80) - 150),
      }),
      SW,
      canvasHeight,
      fixed
    )
    setShuffledBubbles(bubbles.map((b, i) => ({ ...b, position: positions[i] })))
    setActiveHint(null)
  }

  if (type === 'flash') {
    // Build fake paths: take 2-3 random walks of same length as optimal path
    const realPath = puzzle!.optimal_path
    const allBubbleIds = (shuffledBubbles ?? layoutBubbles).map(b => b.id)
    const fakePaths = buildFakePaths(realPath, allBubbleIds, puzzle!.connections, 2)
    const allPaths = [...fakePaths, realPath].sort(() => Math.random() - 0.5)
    setFlashPaths(allPaths)
    setActiveHint('flash')
  }

  if (type === 'bridge') {
    // Pick a random intermediate node from optimal path
    const intermediates = puzzle!.optimal_path.slice(1, -1)
    if (intermediates.length > 0) {
      const pick = intermediates[Math.floor(Math.random() * intermediates.length)]
      setBridgeNodeId(pick)
    }
    setActiveHint(null)
  }
}
```

**Helper function `buildFakePaths` (add near the top of the component file, outside the component):**

```typescript
function buildFakePaths(
  realPath: string[],
  allIds: string[],
  connections: Record<string, string[]>,
  count: number
): string[][] {
  const results: string[][] = []
  for (let i = 0; i < count; i++) {
    // Random walk of same length as realPath from a random start
    const start = allIds[Math.floor(Math.random() * allIds.length)]
    const path = [start]
    for (let step = 1; step < realPath.length; step++) {
      const current = path[path.length - 1]
      const neighbors = (connections[current] ?? []).filter(n => !path.includes(n))
      if (neighbors.length === 0) break
      path.push(neighbors[Math.floor(Math.random() * neighbors.length)])
    }
    if (path.length >= 2) results.push(path)
  }
  return results
}
```

**Layout change — add HintTray below PuzzleCanvas:**

Change the outer container to `flex: 1` with a column layout (already is), then after `</PuzzleCanvas>` add:

```tsx
<HintTray
  hintsRemaining={hintsRemaining}
  activeHint={activeHint}
  onUseHint={handleUseHint}
  connectionAvailable={!!(puzzle.edgeLabels && Object.keys(puzzle.edgeLabels).length > 0)}
/>
```

**PuzzleCanvas props to add:**

```tsx
connectionModeActive={activeHint === 'connection'}
onConnectionModeUsed={() => setActiveHint(null)}
bridgeNodeId={bridgeNodeId}
flashPaths={flashPaths}
onFlashComplete={() => { setFlashPaths(null); setActiveHint(null) }}
```

**Pass `shuffledBubbles ?? layoutBubbles` as `bubbles` prop.**

**Imports to add:**

```typescript
import { useHints } from '../../hooks/useHints'
import { HintTray, HintType } from '../../components/HintTray'
```

**Step 1: Add all new state, imports, `buildFakePaths`, and `handleUseHint` to `puzzle/[id].tsx`**

**Step 2: Add `HintTray` below `PuzzleCanvas` in JSX**

**Step 3: Add new props to `PuzzleCanvas` invocation**

**Step 4: Change `bubbles={layoutBubbles}` to `bubbles={shuffledBubbles ?? layoutBubbles}`**

**Step 5: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add mobile/app/puzzle/[id].tsx
git commit -m "feat: wire all 4 hint types into puzzle screen with useHints inventory"
```

---

## Task 7: Connection mode — gate hint pill behind active mode

**Files:**
- Modify: `mobile/components/PuzzleCanvas.tsx`

Currently the hint pill always shows when hovering a bubble with a matching edge label. With Connection mode, the pill should ONLY show when `connectionModeActive` is true. Otherwise it's always visible, defeating the purpose.

**Change the hint pill condition (around line 215-231):**

```typescript
// Only show hint pill when connection mode is active
const tipId = activePathRef.current[activePathRef.current.length - 1]
if (tipId && connectionModeActiveRef.current) {
  const labels = edgeLabelsRef.current
  const label = labels?.[`${tipId}|${overBubble.id}`] ?? labels?.[`${overBubble.id}|${tipId}`] ?? null
  const tipBubbleData = bubblesRef.current.find(b => b.id === tipId)
  if (label && tipBubbleData) {
    setHintLabel(label)
    setHintPos({ ... })
  } else {
    setHintLabel(null)
    setHintPos(null)
  }
} else {
  setHintLabel(null)
  setHintPos(null)
}
```

Also clear hintLabel/hintPos when connectionModeActive becomes false (add a useEffect):

```typescript
useEffect(() => {
  if (!connectionModeActive) {
    setHintLabel(null)
    setHintPos(null)
  }
}, [connectionModeActive])
```

**Step 1: Update the hint pill logic in PuzzleCanvas to gate on `connectionModeActiveRef.current`**

**Step 2: Add useEffect to clear hint pill when mode deactivates**

**Step 3: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add mobile/components/PuzzleCanvas.tsx
git commit -m "fix: gate Connection hint pill behind connectionModeActive flag"
```

---

## Task 8: Shuffle animation

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Modify: `mobile/components/PuzzleCanvas.tsx` (optional: accept an `animated` prop to animate position changes)

The simplest approach: when `shuffledBubbles` changes, PuzzleCanvas already re-renders bubbles at new positions. To add a scatter animation, use React Native's `Animated.spring` on each bubble position change inside the `Bubble` component.

Actually, keep it simple for v1: the bubbles just snap to new positions instantly. The "shuffle" feeling comes from the haptic + the visual change. Add a haptic in `handleUseHint` for shuffle:

```typescript
if (type === 'shuffle') {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  // ... existing shuffle logic
}
```

Import `Haptics` at the top of `puzzle/[id].tsx`:
```typescript
import * as Haptics from 'expo-haptics'
```

**Step 1: Add Haptics import and call in shuffle handler**

**Step 2: Verify TypeScript compiles**

```bash
cd mobile && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add mobile/app/puzzle/[id].tsx
git commit -m "feat: shuffle hint haptic feedback"
```

---

## Manual Testing Checklist

Before considering this done, manually verify on device:

1. **Hint count**: Open a puzzle. Tray shows 3 dots (3 hints remaining).
2. **Connection hint**: Tap Connection → button highlights. Drag from start bubble → hover a connected neighbor → hint pill appears with label. Complete connection → button deactivates, count drops to 2.
3. **Connection gate**: Without Connection mode active, hover bubbles → no pill shown.
4. **Shuffle hint**: Tap Shuffle → non-path bubbles scatter to new positions. Count drops.
5. **Flash hint**: Tap Flash → several paths flash in random order (amber color), then disappear. Count drops.
6. **Bridge hint**: Tap Bridge → one intermediate bubble gets gold ring highlight. It stays for rest of puzzle. Count drops.
7. **Depleted state**: Use all 3 hints → all buttons go grey/disabled.
8. **Daily reset**: Hints replenish the next calendar day (verify via Supabase: delete today's row from `hint_usage` and reload).
9. **No edgeLabels puzzle**: Connection button should be disabled (e.g. Music/HipHop puzzles have no edge labels).

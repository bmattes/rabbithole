# RabbitHole Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a daily puzzle mobile game where players trace a continuous finger path through scattered concept bubbles to find connections between a Start and End concept, with global leaderboards and an AI-generated narrative recap.

**Architecture:** React Native + Expo mobile app backed by Supabase (Postgres + Auth + Realtime). Puzzles are generated nightly by a Node.js script using Wikidata SPARQL queries to build a semantic knowledge graph, with BFS pathfinding to find optimal routes. Claude API generates the "RabbitHole" narrative for each puzzle's optimal path.

**Tech Stack:** Expo SDK 51+, React Native Reanimated 3, React Native Gesture Handler, Expo Haptics, Supabase JS client, Node.js (pipeline), Anthropic SDK (narrative generation), TypeScript throughout.

---

## Phase 1: Project Scaffold & Supabase Setup

### Task 1: Initialize Expo App

**Files:**
- Create: `mobile/` (Expo app root)

**Step 1: Scaffold the Expo app**

```bash
cd /Users/bmattes/Documents/RabbitHole
npx create-expo-app mobile --template blank-typescript
cd mobile
```

**Step 2: Install core dependencies**

```bash
npx expo install expo-haptics expo-router react-native-reanimated react-native-gesture-handler
npm install @supabase/supabase-js
```

**Step 3: Install dev dependencies**

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
```

**Step 4: Verify app boots**

```bash
npx expo start
```
Expected: Metro bundler starts, QR code shown, no errors.

**Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Expo app with core dependencies"
```

---

### Task 2: Supabase Project & Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Create Supabase project**

Go to https://supabase.com, create a new project called `rabbithole`. Save the project URL and anon key.

**Step 2: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  wikidata_domain text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Puzzle status enum
create type puzzle_status as enum ('pending_review', 'approved', 'published');

-- Puzzles
create table puzzles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) not null,
  date date not null,
  start_concept text not null,
  end_concept text not null,
  bubbles jsonb not null default '[]',
  connections jsonb not null default '{}',
  optimal_path jsonb not null default '[]',
  narrative text,
  status puzzle_status not null default 'pending_review',
  created_at timestamptz default now(),
  unique(category_id, date)
);

-- Users (extends Supabase auth.users)
create table users (
  id uuid primary key references auth.users(id),
  display_name text not null,
  avatar text,
  streak integer not null default 0,
  created_at timestamptz default now()
);

-- Player runs
create table player_runs (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid references puzzles(id) not null,
  user_id uuid references users(id) not null,
  path jsonb not null default '[]',
  time_ms integer not null,
  score integer not null,
  created_at timestamptz default now(),
  unique(puzzle_id, user_id)
);

-- Leaderboard view
create or replace view leaderboard as
  select
    pr.puzzle_id,
    pr.user_id,
    u.display_name,
    u.avatar,
    pr.score,
    pr.time_ms,
    pr.path,
    rank() over (partition by pr.puzzle_id order by pr.score desc, pr.time_ms asc) as rank
  from player_runs pr
  join users u on u.id = pr.user_id;

-- Row Level Security
alter table users enable row level security;
alter table player_runs enable row level security;

create policy "Users can read all users" on users for select using (true);
create policy "Users can update own profile" on users for update using (auth.uid() = id);
create policy "Users can insert own profile" on users for insert with check (auth.uid() = id);

create policy "Anyone can read published puzzles" on puzzles for select using (status = 'published');
create policy "Anyone can read categories" on categories for select using (active = true);
create policy "Anyone can read leaderboard" on player_runs for select using (true);
create policy "Users can insert own runs" on player_runs for insert with check (auth.uid() = user_id);
```

**Step 3: Write seed data**

Create `supabase/seed.sql`:

```sql
insert into categories (name, wikidata_domain, active) values
  ('Movies', 'film', true),
  ('Music', 'music', true),
  ('Sports', 'sport', true);
```

**Step 4: Apply migration**

In Supabase dashboard -> SQL Editor, paste and run the migration, then the seed.

**Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema and seed data"
```

---

### Task 3: Supabase Client & Environment Config

**Files:**
- Create: `mobile/lib/supabase.ts`
- Create: `mobile/.env.local`

**Step 1: Create env file**

Create `mobile/.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Step 2: Create Supabase client**

Create `mobile/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})
```

**Step 3: Add .env.local to .gitignore**

```bash
echo ".env.local" >> mobile/.gitignore
```

**Step 4: Commit**

```bash
git add mobile/lib/ mobile/.gitignore
git commit -m "feat: add Supabase client with env config"
```

---

## Phase 2: Scoring Logic (TDD First)

### Task 4: Implement Scoring Algorithm

**Files:**
- Create: `mobile/lib/scoring.ts`
- Create: `mobile/lib/__tests__/scoring.test.ts`

**Step 1: Write the failing tests**

Create `mobile/lib/__tests__/scoring.test.ts`:

```typescript
import { computeScore, computePathMultiplier, computeTimeMultiplier } from '../scoring'

describe('computePathMultiplier', () => {
  it('returns 1.0 for optimal path', () => {
    expect(computePathMultiplier(4, 4)).toBe(1.0)
  })

  it('returns less than 1.0 for longer path', () => {
    expect(computePathMultiplier(4, 8)).toBe(0.5)
  })

  it('clamps to 1.0 if player path is shorter (should not happen but safe)', () => {
    expect(computePathMultiplier(4, 2)).toBe(1.0)
  })
})

describe('computeTimeMultiplier', () => {
  it('returns 1.0 at 0ms', () => {
    expect(computeTimeMultiplier(0)).toBe(1.0)
  })

  it('returns ~0.5 at 5 minutes', () => {
    const result = computeTimeMultiplier(5 * 60 * 1000)
    expect(result).toBeCloseTo(0.5, 1)
  })

  it('never goes below 0.1', () => {
    expect(computeTimeMultiplier(99 * 60 * 1000)).toBeGreaterThanOrEqual(0.1)
  })
})

describe('computeScore', () => {
  it('returns 1000 for perfect path at 0ms', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 4, timeMs: 0 })).toBe(1000)
  })

  it('returns less than 1000 for longer path', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 6, timeMs: 0 })).toBeLessThan(1000)
  })

  it('returns less than 1000 for slow completion', () => {
    expect(computeScore({ optimalHops: 4, playerHops: 4, timeMs: 300000 })).toBeLessThan(1000)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest lib/__tests__/scoring.test.ts
```
Expected: FAIL — "Cannot find module '../scoring'"

**Step 3: Implement scoring**

Create `mobile/lib/scoring.ts`:

```typescript
const BASE_POINTS = 1000
const TIME_HALF_LIFE_MS = 5 * 60 * 1000 // 5 minutes to reach 0.5 multiplier
const MIN_TIME_MULTIPLIER = 0.1

export function computePathMultiplier(optimalHops: number, playerHops: number): number {
  return Math.min(1.0, optimalHops / playerHops)
}

export function computeTimeMultiplier(timeMs: number): number {
  // Exponential decay: 1.0 at 0ms, ~0.5 at 5min
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
```

**Step 4: Run tests to verify they pass**

```bash
npx jest lib/__tests__/scoring.test.ts
```
Expected: PASS (3 test suites, all green)

**Step 5: Commit**

```bash
git add mobile/lib/scoring.ts mobile/lib/__tests__/scoring.test.ts
git commit -m "feat: add scoring algorithm with tests"
```

---

### Task 5: Implement Path Validation Logic

**Files:**
- Create: `mobile/lib/pathValidation.ts`
- Create: `mobile/lib/__tests__/pathValidation.test.ts`

**Step 1: Write failing tests**

Create `mobile/lib/__tests__/pathValidation.test.ts`:

```typescript
import { validatePath, findBreakPoints } from '../pathValidation'

const connections: Record<string, string[]> = {
  'start': ['A', 'B'],
  'A': ['start', 'C'],
  'B': ['start', 'C'],
  'C': ['A', 'B', 'end'],
  'end': ['C'],
  'orphan': [], // no connections
}

describe('validatePath', () => {
  it('returns valid for a connected path', () => {
    expect(validatePath(['start', 'A', 'C', 'end'], connections)).toBe(true)
  })

  it('returns invalid if any adjacent pair has no connection', () => {
    expect(validatePath(['start', 'orphan', 'end'], connections)).toBe(false)
  })

  it('returns invalid for path including orphan bubble', () => {
    expect(validatePath(['start', 'A', 'orphan', 'end'], connections)).toBe(false)
  })

  it('returns valid for single-hop path', () => {
    expect(validatePath(['start', 'end'], { start: ['end'], end: ['start'] })).toBe(true)
  })
})

describe('findBreakPoints', () => {
  it('returns empty array for valid path', () => {
    expect(findBreakPoints(['start', 'A', 'C', 'end'], connections)).toEqual([])
  })

  it('returns index of break for invalid path', () => {
    // break between index 1 (A) and index 2 (orphan)
    const breaks = findBreakPoints(['start', 'A', 'orphan', 'end'], connections)
    expect(breaks).toEqual([2])
  })

  it('returns multiple break indices', () => {
    const breaks = findBreakPoints(['start', 'orphan', 'A', 'orphan', 'end'], connections)
    expect(breaks).toEqual([1, 3])
  })
})
```

**Step 2: Run to verify failure**

```bash
npx jest lib/__tests__/pathValidation.test.ts
```
Expected: FAIL

**Step 3: Implement path validation**

Create `mobile/lib/pathValidation.ts`:

```typescript
export function validatePath(
  path: string[],
  connections: Record<string, string[]>
): boolean {
  return findBreakPoints(path, connections).length === 0
}

export function findBreakPoints(
  path: string[],
  connections: Record<string, string[]>
): number[] {
  const breaks: number[] = []
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const neighbors = connections[prev] ?? []
    if (!neighbors.includes(curr)) {
      breaks.push(i)
    }
  }
  return breaks
}
```

**Step 4: Run tests**

```bash
npx jest lib/__tests__/pathValidation.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add mobile/lib/pathValidation.ts mobile/lib/__tests__/pathValidation.test.ts
git commit -m "feat: add path validation with break point detection"
```

---

## Phase 3: Navigation & Screen Shells

### Task 6: Setup Expo Router Navigation

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx` (Today's Puzzles)
- Create: `mobile/app/(tabs)/leaderboard.tsx`
- Create: `mobile/app/(tabs)/profile.tsx`
- Create: `mobile/app/puzzle/[id].tsx`
- Create: `mobile/app/results/[id].tsx`

**Step 1: Create root layout**

Create `mobile/app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
```

**Step 2: Create tabs layout**

Create `mobile/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#222' },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  )
}
```

**Step 3: Create shell screens**

Create `mobile/app/(tabs)/index.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native'

export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Today's Puzzles</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 18 },
})
```

Create `mobile/app/(tabs)/leaderboard.tsx` — same shell pattern, label "Leaderboard".
Create `mobile/app/(tabs)/profile.tsx` — same shell pattern, label "Profile".

Create `mobile/app/puzzle/[id].tsx`:

```typescript
import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

export default function PuzzleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Puzzle {id}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 18 },
})
```

Create `mobile/app/results/[id].tsx` — same shell pattern, label "Results {id}".

**Step 4: Verify navigation works**

```bash
npx expo start
```
Expected: App shows tabs, tapping navigates between screens.

**Step 5: Commit**

```bash
git add mobile/app/
git commit -m "feat: add Expo Router navigation with tab and stack screens"
```

---

## Phase 4: The Puzzle Canvas

### Task 7: Bubble Component

**Files:**
- Create: `mobile/components/Bubble.tsx`
- Create: `mobile/components/__tests__/Bubble.test.tsx`

**Step 1: Write failing test**

Create `mobile/components/__tests__/Bubble.test.tsx`:

```typescript
import React from 'react'
import { render } from '@testing-library/react-native'
import { Bubble } from '../Bubble'

describe('Bubble', () => {
  it('renders label text', () => {
    const { getByText } = render(
      <Bubble label="The Godfather" state="idle" position={{ x: 100, y: 200 }} />
    )
    expect(getByText('The Godfather')).toBeTruthy()
  })

  it('renders with active style when state is active', () => {
    const { getByTestId } = render(
      <Bubble label="Test" state="active" position={{ x: 0, y: 0 }} />
    )
    expect(getByTestId('bubble-container')).toBeTruthy()
  })
})
```

**Step 2: Run to verify failure**

```bash
npx jest components/__tests__/Bubble.test.tsx
```
Expected: FAIL

**Step 3: Implement Bubble component**

Create `mobile/components/Bubble.tsx`:

```typescript
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken'

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
}

export const BUBBLE_RADIUS = 44

const STATE_COLORS: Record<BubbleState, string> = {
  idle: '#1e1e2e',
  active: '#7c3aed',
  start: '#16a34a',
  end: '#dc2626',
  broken: '#ef4444',
}

export function Bubble({ label, state, position }: BubbleProps) {
  return (
    <View
      testID="bubble-container"
      style={[
        styles.bubble,
        {
          backgroundColor: STATE_COLORS[state],
          left: position.x - BUBBLE_RADIUS,
          top: position.y - BUBBLE_RADIUS,
        },
      ]}
    >
      <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_RADIUS * 2,
    height: BUBBLE_RADIUS * 2,
    borderRadius: BUBBLE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
})
```

**Step 4: Run tests**

```bash
npx jest components/__tests__/Bubble.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add mobile/components/Bubble.tsx mobile/components/__tests__/Bubble.test.tsx
git commit -m "feat: add Bubble component with state-based colors"
```

---

### Task 8: Connection Line Component

**Files:**
- Create: `mobile/components/ConnectionLine.tsx`

**Step 1: Implement ConnectionLine**

This component draws an SVG cubic bezier curve between two points. No test needed (pure visual, no logic).

Create `mobile/components/ConnectionLine.tsx`:

```typescript
import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { StyleSheet, View } from 'react-native'

interface Point {
  x: number
  y: number
}

interface ConnectionLineProps {
  from: Point
  to: Point
  active?: boolean
  broken?: boolean
  width: number
  height: number
}

function cubicBezierPath(from: Point, to: Point): string {
  const cx1 = from.x
  const cy1 = from.y + (to.y - from.y) * 0.4
  const cx2 = to.x
  const cy2 = to.y - (to.y - from.y) * 0.4
  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`
}

export function ConnectionLine({ from, to, active, broken, width, height }: ConnectionLineProps) {
  const color = broken ? '#ef4444' : active ? '#7c3aed' : 'rgba(255,255,255,0.3)'
  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path
          d={cubicBezierPath(from, to)}
          stroke={color}
          strokeWidth={broken ? 3 : 2}
          fill="none"
          strokeDasharray={broken ? '8,4' : undefined}
        />
      </Svg>
    </View>
  )
}
```

**Step 2: Install react-native-svg**

```bash
npx expo install react-native-svg
```

**Step 3: Commit**

```bash
git add mobile/components/ConnectionLine.tsx
git commit -m "feat: add ConnectionLine component with bezier curves"
```

---

### Task 9: Puzzle Canvas with Gesture Tracing

**Files:**
- Create: `mobile/components/PuzzleCanvas.tsx`

This is the core interaction component. It handles the continuous trace gesture, checkpoint logic, and renders bubbles + lines.

**Step 1: Create PuzzleCanvas**

Create `mobile/components/PuzzleCanvas.tsx`:

```typescript
import React, { useCallback, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import { Bubble, BUBBLE_RADIUS, BubbleState } from './Bubble'
import { ConnectionLine } from './ConnectionLine'

export interface BubbleData {
  id: string
  label: string
  position: { x: number; y: number }
}

interface PuzzleCanvasProps {
  bubbles: BubbleData[]
  connections: Record<string, string[]>
  startId: string
  endId: string
  onPathComplete: (path: string[]) => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

function hitTest(point: { x: number; y: number }, bubble: BubbleData): boolean {
  const dx = point.x - bubble.position.x
  const dy = point.y - bubble.position.y
  return Math.sqrt(dx * dx + dy * dy) <= BUBBLE_RADIUS * 1.2 // slightly forgiving
}

export function PuzzleCanvas({
  bubbles,
  connections,
  startId,
  endId,
  onPathComplete,
}: PuzzleCanvasProps) {
  const [activePath, setActivePath] = useState<string[]>([])
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null)
  const [isTracing, setIsTracing] = useState(false)
  const activePathRef = useRef<string[]>([])

  const getBubble = useCallback(
    (id: string) => bubbles.find((b) => b.id === id),
    [bubbles]
  )

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(({ x, y }) => {
      // Must start on the Start bubble
      const start = getBubble(startId)
      if (!start || !hitTest({ x, y }, start)) return
      activePathRef.current = [startId]
      setActivePath([startId])
      setIsTracing(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    })
    .onUpdate(({ x, y }) => {
      if (!isTracing) return
      setFingerPos({ x, y })

      const currentPath = activePathRef.current
      const lastId = currentPath[currentPath.length - 1]

      // Check if finger is over a new bubble
      for (const bubble of bubbles) {
        if (!hitTest({ x, y }, bubble)) continue
        if (bubble.id === lastId) continue // already on this one

        // Check if we're backtracking to an earlier bubble
        const existingIndex = currentPath.indexOf(bubble.id)
        if (existingIndex !== -1) {
          // Reroute: trim path back to this bubble
          const newPath = currentPath.slice(0, existingIndex + 1)
          activePathRef.current = newPath
          setActivePath([...newPath])
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          return
        }

        // New bubble — add to path
        const newPath = [...currentPath, bubble.id]
        activePathRef.current = newPath
        setActivePath(newPath)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        // If we hit the End bubble, complete
        if (bubble.id === endId) {
          setFingerPos(null)
          setIsTracing(false)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onPathComplete(newPath)
        }
        return
      }
    })
    .onEnd(() => {
      // Snap back to last checkpoint — just hide the live finger line
      setFingerPos(null)
      if (activePathRef.current[activePathRef.current.length - 1] !== endId) {
        setIsTracing(false)
        // Path stays at last checkpoint — user can re-press to continue
        // For simplicity in v1: reset on lift if not complete
        // TODO: implement true checkpoint resume in v2
        activePathRef.current = []
        setActivePath([])
      }
    })

  function getBubbleState(id: string): BubbleState {
    if (id === startId) return 'start'
    if (id === endId) return 'end'
    if (activePath.includes(id)) return 'active'
    return 'idle'
  }

  const lastBubble = activePath.length > 0 ? getBubble(activePath[activePath.length - 1]) : null

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.canvas}>
        {/* Draw connection lines for active path */}
        {activePath.slice(0, -1).map((id, i) => {
          const from = getBubble(id)
          const to = getBubble(activePath[i + 1])
          if (!from || !to) return null
          return (
            <ConnectionLine
              key={`${id}-${activePath[i + 1]}`}
              from={from.position}
              to={to.position}
              active
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
            />
          )
        })}

        {/* Live line from last checkpoint to finger */}
        {isTracing && lastBubble && fingerPos && (
          <ConnectionLine
            from={lastBubble.position}
            to={fingerPos}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        )}

        {/* Render bubbles */}
        {bubbles.map((bubble) => (
          <Bubble
            key={bubble.id}
            label={bubble.label}
            state={getBubbleState(bubble.id)}
            position={bubble.position}
          />
        ))}
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
})
```

**Step 2: Verify it renders**

Wire `PuzzleCanvas` into `mobile/app/puzzle/[id].tsx` with hardcoded mock data and verify it displays.

```typescript
// Temporary: add to puzzle/[id].tsx to test
const MOCK_BUBBLES = [
  { id: 'start', label: 'The Godfather', position: { x: 200, y: 120 } },
  { id: 'b1', label: 'Francis Coppola', position: { x: 120, y: 280 } },
  { id: 'b2', label: 'Marlon Brando', position: { x: 280, y: 300 } },
  { id: 'end', label: 'Apocalypse Now', position: { x: 200, y: 520 } },
]
const MOCK_CONNECTIONS = {
  start: ['b1', 'b2'],
  b1: ['start', 'end'],
  b2: ['start'],
  end: ['b1'],
}
```

**Step 3: Commit**

```bash
git add mobile/components/PuzzleCanvas.tsx
git commit -m "feat: add PuzzleCanvas with continuous trace gesture and checkpoint logic"
```

---

## Phase 5: Data Layer

### Task 10: Puzzle Data Fetching

**Files:**
- Create: `mobile/lib/api.ts`
- Create: `mobile/lib/__tests__/api.test.ts`

**Step 1: Write failing tests**

Create `mobile/lib/__tests__/api.test.ts`:

```typescript
import { getTodaysPuzzle, submitRun } from '../api'

// Mock Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'puzzle-1',
        start_concept: 'The Godfather',
        end_concept: 'Apocalypse Now',
        bubbles: [],
        connections: {},
        optimal_path: [],
      },
      error: null,
    }),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}))

describe('getTodaysPuzzle', () => {
  it('returns puzzle data for a category', async () => {
    const puzzle = await getTodaysPuzzle('movies-category-id')
    expect(puzzle).not.toBeNull()
    expect(puzzle?.start_concept).toBe('The Godfather')
  })
})
```

**Step 2: Run to verify failure**

```bash
npx jest lib/__tests__/api.test.ts
```

**Step 3: Implement API layer**

Create `mobile/lib/api.ts`:

```typescript
import { supabase } from './supabase'

export interface Puzzle {
  id: string
  category_id: string
  date: string
  start_concept: string
  end_concept: string
  bubbles: Array<{ id: string; label: string; position: { x: number; y: number } }>
  connections: Record<string, string[]>
  optimal_path: string[]
  narrative: string | null
}

export async function getTodaysPuzzle(categoryId: string): Promise<Puzzle | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('date', today)
    .eq('status', 'published')
    .single()

  if (error) return null
  return data as Puzzle
}

export async function submitRun({
  puzzleId,
  userId,
  path,
  timeMs,
  score,
}: {
  puzzleId: string
  userId: string
  path: string[]
  timeMs: number
  score: number
}): Promise<void> {
  await supabase.from('player_runs').insert({
    puzzle_id: puzzleId,
    user_id: userId,
    path,
    time_ms: timeMs,
    score,
  })
}

export async function getLeaderboard(puzzleId: string) {
  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .order('rank', { ascending: true })
    .limit(50)
  return data ?? []
}

export async function getCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
  return data ?? []
}
```

**Step 4: Run tests**

```bash
npx jest lib/__tests__/api.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add mobile/lib/api.ts mobile/lib/__tests__/api.test.ts
git commit -m "feat: add Supabase data fetching layer for puzzles and leaderboard"
```

---

## Phase 6: Full Puzzle Screen

### Task 11: Wire Puzzle Screen with Real Data

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Create: `mobile/hooks/usePuzzle.ts`
- Create: `mobile/hooks/useTimer.ts`

**Step 1: Create useTimer hook**

Create `mobile/hooks/useTimer.ts`:

```typescript
import { useEffect, useRef, useState } from 'react'

export function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    startRef.current = Date.now()
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current!)
    }, 100)
  }

  function stop(): number {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    return elapsed
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return { elapsed, running, start, stop }
}
```

**Step 2: Create usePuzzle hook**

Create `mobile/hooks/usePuzzle.ts`:

```typescript
import { useEffect, useState } from 'react'
import { getTodaysPuzzle, Puzzle } from '../lib/api'

export function usePuzzle(categoryId: string) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTodaysPuzzle(categoryId)
      .then((p) => {
        if (!p) setError('No puzzle found for today')
        else setPuzzle(p)
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false))
  }, [categoryId])

  return { puzzle, loading, error }
}
```

**Step 3: Update puzzle screen**

Replace contents of `mobile/app/puzzle/[id].tsx`:

```typescript
import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { computeScore } from '../../lib/scoring'
import { findBreakPoints } from '../../lib/pathValidation'
import { submitRun } from '../../lib/api'

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { puzzle, loading, error } = usePuzzle(categoryId)
  const { elapsed, start, stop } = useTimer()
  const [started, setStarted] = useState(false)
  const [completedPath, setCompletedPath] = useState<string[] | null>(null)

  if (loading) return <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>
  if (error || !puzzle) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>

  function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const breaks = findBreakPoints(path, puzzle!.connections)

    if (breaks.length > 0) {
      // Show break points — canvas handles visual feedback
      // Player must fix and resubmit (timer keeps running)
      return
    }

    const score = computeScore({
      optimalHops: puzzle!.optimal_path.length - 1,
      playerHops: path.length - 1,
      timeMs,
    })

    // Submit and navigate to results
    submitRun({
      puzzleId: puzzle!.id,
      userId: 'TODO-auth-user-id', // replace with real auth in Task 12
      path,
      timeMs,
      score,
    })

    router.replace(`/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}`)
  }

  const timerColor = elapsed < 60000 ? '#fff' : elapsed < 180000 ? '#eab308' : '#f97316'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.timer, { color: timerColor }]}>
          {Math.floor(elapsed / 60000)}:{String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}
        </Text>
      </View>

      <PuzzleCanvas
        bubbles={puzzle.bubbles}
        connections={puzzle.connections}
        startId={puzzle.bubbles[0]?.id}
        endId={puzzle.bubbles[puzzle.bubbles.length - 1]?.id}
        onPathComplete={handlePathComplete}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  timer: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  error: { color: '#ef4444', fontSize: 16 },
})
```

**Step 4: Commit**

```bash
git add mobile/app/puzzle/ mobile/hooks/
git commit -m "feat: wire puzzle screen with live data, timer, and scoring"
```

---

## Phase 7: Results Screen

### Task 12: Results & Narrative Screen

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Implement results screen**

Replace `mobile/app/results/[id].tsx`:

```typescript
import React from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

export default function ResultsScreen() {
  const { id: puzzleId, score, timeMs } = useLocalSearchParams<{
    id: string
    score: string
    timeMs: string
  }>()

  const totalMs = parseInt(timeMs ?? '0')
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RabbitHole</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Your Score</Text>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.timeValue}>{minutes}:{String(seconds).padStart(2, '0')}</Text>
      </View>

      {/* TODO Task 13: show optimal path vs player path */}
      {/* TODO Task 13: show AI narrative */}

      <Pressable style={styles.button} onPress={() => router.replace('/leaderboard')}>
        <Text style={styles.buttonText}>See Leaderboard</Text>
      </Pressable>

      <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/')}>
        <Text style={styles.buttonSecondaryText}>Back to Today</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, alignItems: 'center' },
  title: { color: '#7c3aed', fontSize: 32, fontWeight: '800', marginBottom: 40 },
  scoreCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  scoreLabel: { color: '#888', fontSize: 14, marginBottom: 8 },
  scoreValue: { color: '#fff', fontSize: 64, fontWeight: '800' },
  timeValue: { color: '#7c3aed', fontSize: 20, marginTop: 8 },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: '#888', fontSize: 15 },
})
```

**Step 2: Commit**

```bash
git add mobile/app/results/
git commit -m "feat: add results screen with score display"
```

---

## Phase 8: Puzzle Generation Pipeline

### Task 13: Node.js Pipeline Scaffold

**Files:**
- Create: `pipeline/package.json`
- Create: `pipeline/src/wikidata.ts`
- Create: `pipeline/src/graphBuilder.ts`
- Create: `pipeline/src/__tests__/graphBuilder.test.ts`
- Create: `pipeline/src/puzzleComposer.ts`
- Create: `pipeline/src/narrativeGenerator.ts`
- Create: `pipeline/src/index.ts`

**Step 1: Initialize pipeline project**

```bash
mkdir -p /Users/bmattes/Documents/RabbitHole/pipeline/src
cd /Users/bmattes/Documents/RabbitHole/pipeline
npm init -y
npm install typescript @anthropic-ai/sdk node-cron dotenv
npm install --save-dev @types/node jest ts-jest @types/jest
npx tsc --init
```

**Step 2: Write failing graph builder tests**

Create `pipeline/src/__tests__/graphBuilder.test.ts`:

```typescript
import { buildGraph, findShortestPath } from '../graphBuilder'

const mockEntities = [
  { id: 'Q1', label: 'The Godfather', relatedIds: ['Q2', 'Q3'] },
  { id: 'Q2', label: 'Francis Coppola', relatedIds: ['Q1', 'Q4'] },
  { id: 'Q3', label: 'Marlon Brando', relatedIds: ['Q1'] },
  { id: 'Q4', label: 'Apocalypse Now', relatedIds: ['Q2'] },
]

describe('buildGraph', () => {
  it('creates adjacency map from entities', () => {
    const graph = buildGraph(mockEntities)
    expect(graph['Q1']).toContain('Q2')
    expect(graph['Q1']).toContain('Q3')
    expect(graph['Q2']).toContain('Q4')
  })
})

describe('findShortestPath', () => {
  it('finds shortest path between two nodes', () => {
    const graph = buildGraph(mockEntities)
    const path = findShortestPath('Q1', 'Q4', graph)
    expect(path).toEqual(['Q1', 'Q2', 'Q4'])
  })

  it('returns null when no path exists', () => {
    const graph = buildGraph(mockEntities)
    const path = findShortestPath('Q3', 'Q4', graph)
    expect(path).toBeNull()
  })
})
```

**Step 3: Run to verify failure**

```bash
npx jest src/__tests__/graphBuilder.test.ts
```

**Step 4: Implement graph builder**

Create `pipeline/src/graphBuilder.ts`:

```typescript
export interface Entity {
  id: string
  label: string
  relatedIds: string[]
}

export type Graph = Record<string, string[]>

export function buildGraph(entities: Entity[]): Graph {
  const graph: Graph = {}
  for (const entity of entities) {
    graph[entity.id] = entity.relatedIds
  }
  return graph
}

export function findShortestPath(
  startId: string,
  endId: string,
  graph: Graph
): string[] | null {
  const queue: string[][] = [[startId]]
  const visited = new Set<string>([startId])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]

    if (current === endId) return path

    for (const neighbor of graph[current] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }

  return null
}
```

**Step 5: Run tests**

```bash
npx jest src/__tests__/graphBuilder.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add pipeline/
git commit -m "feat: add pipeline graph builder with BFS pathfinding"
```

---

### Task 14: Wikidata SPARQL Client

**Files:**
- Create: `pipeline/src/wikidata.ts`
- Create: `pipeline/src/__tests__/wikidata.test.ts`

**Step 1: Write failing test**

Create `pipeline/src/__tests__/wikidata.test.ts`:

```typescript
import { fetchMovieEntities } from '../wikidata'

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({
    results: {
      bindings: [
        {
          film: { value: 'http://www.wikidata.org/entity/Q47703' },
          filmLabel: { value: 'The Godfather' },
          related: { value: 'http://www.wikidata.org/entity/Q128518' },
          relatedLabel: { value: 'Francis Ford Coppola' },
        }
      ]
    }
  })
}) as jest.Mock

describe('fetchMovieEntities', () => {
  it('returns entities with labels and related IDs', async () => {
    const entities = await fetchMovieEntities(10)
    expect(entities.length).toBeGreaterThan(0)
    expect(entities[0]).toHaveProperty('label')
    expect(entities[0]).toHaveProperty('relatedIds')
  })
})
```

**Step 2: Implement Wikidata client**

Create `pipeline/src/wikidata.ts`:

```typescript
import { Entity } from './graphBuilder'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

// Fetch notable films and their directors/actors from Wikidata
const MOVIES_QUERY = (limit: number) => `
SELECT ?film ?filmLabel ?related ?relatedLabel WHERE {
  ?film wdt:P31 wd:Q11424.        # instance of film
  ?film wdt:P57|wdt:P161 ?related. # director or cast member
  ?film wikibase:sitelinks ?links.
  FILTER(?links > 500)            # reasonably well-known
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?links)
LIMIT ${limit}
`

function extractId(uri: string): string {
  return uri.split('/').pop()!
}

export async function fetchMovieEntities(limit = 200): Promise<Entity[]> {
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(MOVIES_QUERY(limit))}&format=json`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RabbitHoleGame/1.0 (puzzle-generator)' }
  })
  const data = await response.json()

  const entityMap = new Map<string, Entity>()

  for (const binding of data.results.bindings) {
    const filmId = extractId(binding.film.value)
    const filmLabel = binding.filmLabel.value
    const relatedId = extractId(binding.related.value)

    if (!entityMap.has(filmId)) {
      entityMap.set(filmId, { id: filmId, label: filmLabel, relatedIds: [] })
    }
    entityMap.get(filmId)!.relatedIds.push(relatedId)

    // Also add the related entity if not present
    if (!entityMap.has(relatedId)) {
      entityMap.set(relatedId, {
        id: relatedId,
        label: binding.relatedLabel?.value ?? relatedId,
        relatedIds: [filmId],
      })
    } else {
      const related = entityMap.get(relatedId)!
      if (!related.relatedIds.includes(filmId)) {
        related.relatedIds.push(filmId)
      }
    }
  }

  return Array.from(entityMap.values())
}
```

**Step 3: Run tests**

```bash
npx jest src/__tests__/wikidata.test.ts
```
Expected: PASS

**Step 4: Commit**

```bash
git add pipeline/src/wikidata.ts pipeline/src/__tests__/wikidata.test.ts
git commit -m "feat: add Wikidata SPARQL client for movie entity fetching"
```

---

### Task 15: Puzzle Composer

**Files:**
- Create: `pipeline/src/puzzleComposer.ts`
- Create: `pipeline/src/__tests__/puzzleComposer.test.ts`

**Step 1: Write failing tests**

Create `pipeline/src/__tests__/puzzleComposer.test.ts`:

```typescript
import { composePuzzle } from '../puzzleComposer'
import { buildGraph, Entity } from '../graphBuilder'

const entities: Entity[] = [
  { id: 'Q1', label: 'The Godfather', relatedIds: ['Q2', 'Q3'] },
  { id: 'Q2', label: 'Coppola', relatedIds: ['Q1', 'Q4', 'Q5'] },
  { id: 'Q3', label: 'Brando', relatedIds: ['Q1', 'Q6'] },
  { id: 'Q4', label: 'Apocalypse Now', relatedIds: ['Q2', 'Q5'] },
  { id: 'Q5', label: 'Vietnam War', relatedIds: ['Q2', 'Q4'] },
  { id: 'Q6', label: 'Streetcar Named Desire', relatedIds: ['Q3'] },
]

describe('composePuzzle', () => {
  it('returns a puzzle with start, end, and bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({ entities, graph, startId: 'Q1', endId: 'Q4' })
    expect(puzzle).not.toBeNull()
    expect(puzzle!.startId).toBe('Q1')
    expect(puzzle!.endId).toBe('Q4')
    expect(puzzle!.bubbles.length).toBeGreaterThanOrEqual(4)
    expect(puzzle!.optimalPath.length).toBeGreaterThanOrEqual(2)
  })

  it('includes the optimal path nodes in bubbles', () => {
    const graph = buildGraph(entities)
    const puzzle = composePuzzle({ entities, graph, startId: 'Q1', endId: 'Q4' })
    const bubbleIds = puzzle!.bubbles.map(b => b.id)
    for (const id of puzzle!.optimalPath) {
      expect(bubbleIds).toContain(id)
    }
  })
})
```

**Step 2: Implement puzzle composer**

Create `pipeline/src/puzzleComposer.ts`:

```typescript
import { Entity, Graph, findShortestPath } from './graphBuilder'
import { Dimensions } from './layout'

export interface PuzzleBubble {
  id: string
  label: string
  position: { x: number; y: number }
}

export interface ComposedPuzzle {
  startId: string
  endId: string
  bubbles: PuzzleBubble[]
  connections: Record<string, string[]>
  optimalPath: string[]
}

// Distribute bubbles in a rough scatter layout
function scatterPositions(ids: string[], startId: string, endId: string): Record<string, { x: number; y: number }> {
  const W = 390 // iPhone screen width
  const H = 700 // usable height
  const positions: Record<string, { x: number; y: number }> = {}

  positions[startId] = { x: W / 2, y: 100 }
  positions[endId] = { x: W / 2, y: H - 100 }

  const middleIds = ids.filter(id => id !== startId && id !== endId)
  middleIds.forEach((id, i) => {
    const cols = 3
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 80 + col * ((W - 160) / (cols - 1)) + (Math.random() - 0.5) * 30
    const y = 200 + row * 140 + (Math.random() - 0.5) * 30
    positions[id] = { x, y }
  })

  return positions
}

export function composePuzzle({
  entities,
  graph,
  startId,
  endId,
  targetBubbleCount = 12,
}: {
  entities: Entity[]
  graph: Graph
  startId: string
  endId: string
  targetBubbleCount?: number
}): ComposedPuzzle | null {
  const optimalPath = findShortestPath(startId, endId, graph)
  if (!optimalPath) return null
  if (optimalPath.length < 3 || optimalPath.length > 8) return null

  const entityMap = new Map(entities.map(e => [e.id, e]))

  // Collect on-path nodes plus neighbors as valid candidates
  const candidateIds = new Set<string>(optimalPath)
  for (const id of optimalPath) {
    const neighbors = graph[id] ?? []
    for (const n of neighbors.slice(0, 3)) candidateIds.add(n)
  }

  // Fill to target count, then add a couple orphans
  const allEntityIds = entities.map(e => e.id).filter(id => !candidateIds.has(id))
  const orphanCount = 2
  const orphans = allEntityIds.slice(0, orphanCount)
  const bubbleIds = Array.from(candidateIds).slice(0, targetBubbleCount - orphanCount)
  const allBubbleIds = [...bubbleIds, ...orphans]

  const positions = scatterPositions(allBubbleIds, startId, endId)

  const bubbles: PuzzleBubble[] = allBubbleIds.map(id => ({
    id,
    label: entityMap.get(id)?.label ?? id,
    position: positions[id],
  }))

  // Build connections subgraph (only between included bubbles)
  const bubbleSet = new Set(allBubbleIds)
  const connections: Record<string, string[]> = {}
  for (const id of allBubbleIds) {
    connections[id] = (graph[id] ?? []).filter(n => bubbleSet.has(n))
    // orphans get no connections
    if (orphans.includes(id)) connections[id] = []
  }

  return { startId, endId, bubbles, connections, optimalPath }
}
```

**Step 3: Run tests**

```bash
npx jest src/__tests__/puzzleComposer.test.ts
```
Expected: PASS

**Step 4: Commit**

```bash
git add pipeline/src/puzzleComposer.ts pipeline/src/__tests__/puzzleComposer.test.ts
git commit -m "feat: add puzzle composer with orphan bubbles and scatter layout"
```

---

### Task 16: AI Narrative Generator

**Files:**
- Create: `pipeline/src/narrativeGenerator.ts`
- Create: `pipeline/.env`

**Step 1: Create .env**

Create `pipeline/.env`:

```
ANTHROPIC_API_KEY=your-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

```bash
echo ".env" >> pipeline/.gitignore
```

**Step 2: Implement narrative generator**

Create `pipeline/src/narrativeGenerator.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function generateNarrative({
  startLabel,
  endLabel,
  pathLabels,
  category,
}: {
  startLabel: string
  endLabel: string
  pathLabels: string[]
  category: string
}): Promise<string> {
  const pathString = pathLabels.join(' → ')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Write a 2-3 sentence "RabbitHole" narrative that explains the connection from "${startLabel}" to "${endLabel}" through this path: ${pathString}.

Category: ${category}

The narrative should be engaging and explain WHY each connection makes sense, like a curious fact trail. Be concise and enthusiastic. No bullet points, just flowing prose.`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text
}
```

**Step 3: Commit**

```bash
git add pipeline/src/narrativeGenerator.ts pipeline/.gitignore
git commit -m "feat: add Claude-powered narrative generator for puzzle recap"
```

---

### Task 17: Pipeline Orchestrator & Cron

**Files:**
- Create: `pipeline/src/index.ts`

**Step 1: Implement orchestrator**

Create `pipeline/src/index.ts`:

```typescript
import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { fetchMovieEntities } from './wikidata'
import { buildGraph, findShortestPath } from './graphBuilder'
import { composePuzzle } from './puzzleComposer'
import { generateNarrative } from './narrativeGenerator'
import cron from 'node-cron'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function generatePuzzlesForCategory(categoryId: string, categoryName: string) {
  console.log(`Generating puzzle for category: ${categoryName}`)

  const entities = await fetchMovieEntities(300)
  const graph = buildGraph(entities)
  const entityIds = entities.map(e => e.id)

  // Find a good start/end pair
  let puzzle = null
  let attempts = 0
  while (!puzzle && attempts < 50) {
    attempts++
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue
    puzzle = composePuzzle({ entities, graph, startId, endId })
  }

  if (!puzzle) {
    console.error(`Failed to compose puzzle after ${attempts} attempts`)
    return
  }

  const entityMap = new Map(entities.map(e => [e.id, e]))
  const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)

  const narrative = await generateNarrative({
    startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    pathLabels,
    category: categoryName,
  })

  // Store as pending_review for tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { error } = await supabase.from('puzzles').insert({
    category_id: categoryId,
    date,
    start_concept: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    end_concept: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    bubbles: puzzle.bubbles,
    connections: puzzle.connections,
    optimal_path: puzzle.optimalPath,
    narrative,
    status: 'pending_review',
  })

  if (error) console.error('Failed to insert puzzle:', error)
  else console.log(`Puzzle generated for ${date}: ${pathLabels.join(' → ')}`)
}

async function runPipeline() {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)

  if (!categories) return

  for (const cat of categories) {
    await generatePuzzlesForCategory(cat.id, cat.name)
  }
}

// Run immediately on start, then nightly at 2am
runPipeline()
cron.schedule('0 2 * * *', runPipeline)

console.log('RabbitHole pipeline running. Cron: nightly at 2am.')
```

**Step 2: Add start script to package.json**

```bash
cd pipeline && npm pkg set scripts.start="ts-node src/index.ts" scripts.test="jest"
```

**Step 3: Test run (dry run with console output)**

```bash
cd pipeline && npx ts-node src/index.ts
```
Expected: Logs puzzle generation, inserts to Supabase.

**Step 4: Commit**

```bash
git add pipeline/src/index.ts pipeline/package.json
git commit -m "feat: add pipeline orchestrator with nightly cron"
```

---

## Phase 9: Auth & Today Screen

### Task 18: Anonymous Auth & Today Screen

**Files:**
- Create: `mobile/hooks/useAuth.ts`
- Modify: `mobile/app/(tabs)/index.tsx`

**Step 1: Create auth hook**

Create `mobile/hooks/useAuth.ts`:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (!error && data.user) {
      // Create user profile
      await supabase.from('users').upsert({
        id: data.user.id,
        display_name: `Player${Math.floor(Math.random() * 9999)}`,
      })
    }
  }

  return { session, loading, signInAnonymously, userId: session?.user.id ?? null }
}
```

**Step 2: Update Today screen with category list**

Replace `mobile/app/(tabs)/index.tsx`:

```typescript
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { getCategories } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

export default function TodayScreen() {
  const { session, loading: authLoading, signInAnonymously } = useAuth()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    if (!session) signInAnonymously()
  }, [session])

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  if (authLoading) return (
    <View style={styles.center}>
      <ActivityIndicator color="#7c3aed" />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RabbitHole</Text>
      <Text style={styles.subtitle}>Today's Puzzles</Text>

      {categories.map(cat => (
        <Pressable
          key={cat.id}
          style={styles.categoryCard}
          onPress={() => router.push(`/puzzle/${cat.id}`)}
        >
          <Text style={styles.categoryName}>{cat.name}</Text>
          <Text style={styles.categoryArrow}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 80 },
  title: { color: '#7c3aed', fontSize: 36, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 16, marginBottom: 40 },
  categoryCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  categoryName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  categoryArrow: { color: '#7c3aed', fontSize: 20 },
})
```

**Step 3: Commit**

```bash
git add mobile/hooks/useAuth.ts mobile/app/(tabs)/index.tsx
git commit -m "feat: add anonymous auth and category selection on Today screen"
```

---

## Phase 10: Polish Pass

### Task 19: Bubble Entry Animation

**Files:**
- Modify: `mobile/components/Bubble.tsx`

Add staggered entry animation using Reanimated 3. Each bubble floats in from slightly off-screen with a spring, with a stagger delay based on its index.

**Step 1: Update Bubble to accept an `index` prop and animate entry**

```typescript
// Add to Bubble props
index?: number

// Inside Bubble component
const translateY = useSharedValue(60)
const opacity = useSharedValue(0)

useEffect(() => {
  const delay = (index ?? 0) * 60
  setTimeout(() => {
    translateY.value = withSpring(0, { damping: 14 })
    opacity.value = withSpring(1)
  }, delay)
}, [])

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: translateY.value }],
  opacity: opacity.value,
}))

// Wrap the View in <Animated.View style={animatedStyle}>
```

**Step 2: Pass index from PuzzleCanvas**

```typescript
{bubbles.map((bubble, i) => (
  <Bubble key={bubble.id} ... index={i} />
))}
```

**Step 3: Commit**

```bash
git add mobile/components/Bubble.tsx mobile/components/PuzzleCanvas.tsx
git commit -m "feat: add staggered bubble entry animations"
```

---

### Task 20: Completion Ripple Effect

**Files:**
- Create: `mobile/components/RippleEffect.tsx`
- Modify: `mobile/components/PuzzleCanvas.tsx`

**Step 1: Create ripple component**

Create `mobile/components/RippleEffect.tsx`:

```typescript
import React, { useEffect } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { StyleSheet } from 'react-native'

interface RippleEffectProps {
  center: { x: number; y: number }
  onComplete?: () => void
}

export function RippleEffect({ center, onComplete }: RippleEffectProps) {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withTiming(4, { duration: 600, easing: Easing.out(Easing.quad) })
    opacity.value = withTiming(0, { duration: 600 }, (finished) => {
      if (finished && onComplete) onComplete()
    })
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    left: center.x - 40,
    top: center.y - 40,
  }))

  return <Animated.View style={[styles.ripple, style]} />
}

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
    pointerEvents: 'none',
  },
})
```

**Step 2: Trigger ripple on chain completion in PuzzleCanvas**

Add state `rippleCenter` and render `<RippleEffect>` when chain completes.

**Step 3: Commit**

```bash
git add mobile/components/RippleEffect.tsx mobile/components/PuzzleCanvas.tsx
git commit -m "feat: add completion ripple animation"
```

---

## Phase 11: Leaderboard Screen

### Task 21: Leaderboard Screen

**Files:**
- Modify: `mobile/app/(tabs)/leaderboard.tsx`

**Step 1: Implement leaderboard**

```typescript
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { getLeaderboard, getCategories } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

export default function LeaderboardScreen() {
  const { userId } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load leaderboard for first available category's today puzzle
    // Simplified: fetch by known puzzle ID — in v2 add category picker
    setLoading(false)
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      {loading ? (
        <ActivityIndicator color="#7c3aed" />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No entries yet today. Be first!</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item, index }) => (
            <View style={[styles.row, item.user_id === userId && styles.myRow]}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.score}>{item.score}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 80, paddingHorizontal: 20 },
  title: { color: '#7c3aed', fontSize: 28, fontWeight: '800', marginBottom: 32 },
  empty: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  myRow: { backgroundColor: '#1e1e2e', borderRadius: 10, paddingHorizontal: 12, marginHorizontal: -12 },
  rank: { color: '#555', width: 36, fontSize: 14 },
  name: { flex: 1, color: '#fff', fontSize: 16 },
  score: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
})
```

**Step 2: Commit**

```bash
git add mobile/app/(tabs)/leaderboard.tsx
git commit -m "feat: add leaderboard screen shell"
```

---

## Remaining TODOs (Post-MVP)

These are deliberately deferred — validate the core loop first:

- [ ] Display optimal path vs player path on results screen
- [ ] Show narrative from `puzzle.narrative` on results screen
- [ ] Admin review interface (Supabase Studio works fine for v1)
- [ ] Streak tracking
- [ ] Share card generation
- [ ] Multiple categories in leaderboard picker
- [ ] Push notifications for daily puzzle
- [ ] True checkpoint-resume (lift finger, re-press to continue from checkpoint)
- [ ] Particle shimmer along connection lines
- [ ] Bubble repulsion physics

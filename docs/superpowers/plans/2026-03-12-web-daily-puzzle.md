# RabbitHole Web Daily Puzzle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone React + Vite web app at `deepr.fm/play` that serves a free daily easy puzzle, rotating through all 21 active categories, stateless, with an iOS App Store download CTA on the results screen.

**Architecture:** New `web/` directory at the repo root — plain React + Vite + TypeScript, no React Native. Fetches today's puzzle from Supabase (anon key, browser-safe). The puzzle canvas is reimplemented with HTML divs + SVG lines + pointer events. Deployed to Cloudflare Pages, routed via the existing deeplink-service Workers config.

**Tech Stack:** React 18, Vite 5, TypeScript, `@supabase/supabase-js`, Cloudflare Pages, existing `deeplink-service` Cloudflare Worker

---

## Chunk 1: Scaffold + data layer + Bubble component

### Task 1: Scaffold the web/ directory

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/.env.example`
- Create: `web/.gitignore`

- [ ] **Step 1: Create package.json**

```bash
mkdir -p /Users/bmattes/Desktop/RabbitHole/web/src/lib
mkdir -p /Users/bmattes/Desktop/RabbitHole/web/src/components
```

Create `web/package.json`:

```json
{
  "name": "rabbithole-web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

Create `web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

Create `web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="RabbitHole — daily word connection puzzle. Connect Start to End through the concept web." />
    <title>RabbitHole — Daily Puzzle</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #f9f9f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

Create `web/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create .env.example and .gitignore**

Create `web/.env.example`:

```
VITE_SUPABASE_URL=https://eaevegumlihsuagccczq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Create `web/.gitignore`:

```
node_modules
dist
.env
```

- [ ] **Step 7: Install dependencies and verify build toolchain works**

```bash
cd web && npm install
```

Expected: `node_modules/` populated, no errors.

```bash
cd web && npx tsc --noEmit
```

Expected: no TypeScript errors (only `src/main.tsx` exists so far — may complain about missing `App` import, which is fine for now).

- [ ] **Step 8: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/
git commit -m "feat(web): scaffold Vite + React web app"
```

---

### Task 2: Data layer — supabase.ts, categoryRotation.ts, api.ts

**Files:**
- Create: `web/src/lib/supabase.ts`
- Create: `web/src/lib/categoryRotation.ts`
- Create: `web/src/lib/api.ts`

**Context:** The category rotation is deterministic — `dayIndex = Math.floor(Date.UTC(y,m,d) / 86400000) % 21`. The 21 category IDs (in rotation order) are hardcoded from the DB. The Supabase query is identical to `mobile/lib/api.ts::getTodaysPuzzle` but uses the anon key and `VITE_` env var prefix.

- [ ] **Step 1: Create web/src/lib/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Create web/src/lib/categoryRotation.ts**

The 21 category IDs match the `categories` table (confirmed). Order is curated for broad appeal — starts with high-familiarity categories.

```typescript
// Ordered by broad appeal — determines which category shows on each day of the 21-day cycle
const CATEGORY_ROTATION: string[] = [
  '5f522844-78b3-464f-9105-d15a8f746d28', // Movies
  '4509f7c8-ca02-49b7-a6ab-113523b02cc3', // World History
  '55dcfe2f-84d7-44d6-9558-97de003c436e', // Science
  'b705171c-177e-4a32-b82d-d0b968c8e72f', // TV Shows
  'e8330146-febe-45ca-97ca-8999d2c6f30d', // Football / Soccer
  '3eb16608-c9a6-4bbe-854e-fcc7903fec63', // Literature
  'bfe96173-55b2-48ba-8f48-0fc0b6f7c48a', // Geography
  '7b932160-d1a9-43b6-b165-4e3e826a7da2', // Rock Music
  '59b7e254-b17f-4d69-8554-6e45d1084839', // Space & Astronomy
  '6314e218-91c5-4a29-abb6-8aa8db8b4177', // Video Games
  '3f05b508-d942-4fca-81e9-4a1d036b2808', // Food & Cuisine
  'b6353186-74d1-49ab-b159-3bd2aa1b514c', // Philosophy
  'e9bf593d-966b-424b-9b97-13e0b18577fe', // Comics
  '3d5fd2ac-6e6a-4e87-98e8-6efbcb52c9fd', // Basketball
  '4b06167c-5cb6-448f-aa91-06272425e835', // Visual Art
  '148643e8-d8b0-49bd-a0f9-0cfd9ba8024e', // Hip-Hop
  'c31fd646-f615-413e-9238-9987af82a93b', // Military History
  '8a6efe6b-047a-4883-ad8f-b8bdd1c79345', // Royals & Monarchs
  '43b3e56b-c343-43ca-836d-0b33cfb05d3e', // Classical Music
  '1aa0ea06-222b-4331-822b-325bd53cd5ea', // Country Music
  'b607becf-ab90-4a35-9595-f6473612d364', // American Football
]

/**
 * Returns the category ID for a given UTC date string (YYYY-MM-DD).
 * Deterministic: same date always returns same category worldwide.
 */
export function getCategoryForDate(utcDateStr: string): string {
  const [y, m, d] = utcDateStr.split('-').map(Number)
  const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  const index = daysSinceEpoch % CATEGORY_ROTATION.length
  return CATEGORY_ROTATION[index]
}

/**
 * Returns today's UTC date as a YYYY-MM-DD string.
 */
export function todayUTC(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns up to `maxTries` category IDs starting from the given date's index,
 * wrapping around. Used for fallback when primary category has no puzzle.
 */
export function getCategoryFallbacks(utcDateStr: string, maxTries = 21): string[] {
  const [y, m, d] = utcDateStr.split('-').map(Number)
  const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  const startIndex = daysSinceEpoch % CATEGORY_ROTATION.length
  return Array.from({ length: maxTries }, (_, i) =>
    CATEGORY_ROTATION[(startIndex + i) % CATEGORY_ROTATION.length]
  )
}
```

- [ ] **Step 3: Create web/src/lib/api.ts**

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
  category_name?: string
}

/**
 * Fetches today's easy puzzle for the given category.
 * Returns null if no published easy puzzle exists for today's date.
 */
export async function getTodaysPuzzle(
  categoryId: string,
  dateStr: string
): Promise<Puzzle | null> {
  const { data: puzzleData, error: puzzleError } = await supabase
    .from('puzzles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('difficulty', 'easy')
    .eq('date', dateStr)
    .eq('status', 'published')
    .single()

  if (puzzleError || !puzzleData) return null

  const { data: catData } = await supabase
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .single()

  return {
    ...puzzleData,
    category_name: catData?.name ?? undefined,
  } as Puzzle
}

/**
 * Tries each category in `categoryIds` in order until a puzzle is found.
 * Returns null only if all categories fail.
 */
export async function getTodaysPuzzleWithFallback(
  categoryIds: string[],
  dateStr: string
): Promise<Puzzle | null> {
  for (const categoryId of categoryIds) {
    const puzzle = await getTodaysPuzzle(categoryId, dateStr)
    if (puzzle) return puzzle
  }
  return null
}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd /Users/bmattes/Desktop/RabbitHole/web && npx tsc --noEmit
```

Expected: No errors (may warn about unused imports in main.tsx until App.tsx exists — that's fine).

- [ ] **Step 5: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/src/lib/
git commit -m "feat(web): data layer — supabase client, category rotation, puzzle API"
```

---

### Task 3: Bubble component

**Files:**
- Create: `web/src/components/Bubble.tsx`

**Context:** The mobile `Bubble.tsx` uses React Native SVG + Animated. The web version is a plain `div` with inline styles. Same visual states: `start` (green), `end` (red), `active` (purple text + border), `idle`, `broken` (red text).

- [ ] **Step 1: Create web/src/components/Bubble.tsx**

```tsx
import React from 'react'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken'

export interface BubbleData {
  id: string
  label: string
  position: { x: number; y: number }
}

// Bubble dimensions — match mobile constants for layout compatibility
export const BUBBLE_W = 140
export const BUBBLE_H = 52

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
  hovering?: boolean
}

const BG: Record<BubbleState, string> = {
  idle: '#ffffff',
  active: '#ffffff',
  start: '#16a34a',
  end: '#dc2626',
  broken: '#ffffff',
}

const BORDER: Record<BubbleState, string> = {
  idle: '#e5e5e5',
  active: '#7c3aed',
  start: '#16a34a',
  end: '#dc2626',
  broken: '#ef4444',
}

const TEXT: Record<BubbleState, string> = {
  idle: '#1a1a1a',
  active: '#7c3aed',
  start: '#ffffff',
  end: '#ffffff',
  broken: '#ef4444',
}

export function Bubble({ label, state, position, hovering }: BubbleProps) {
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1)
  const isHovering = hovering && state === 'idle'

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        minWidth: 100,
        maxWidth: BUBBLE_W,
        height: BUBBLE_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        borderRadius: BUBBLE_H / 2,
        background: BG[state],
        border: `2px solid ${isHovering ? '#7c3aed' : BORDER[state]}`,
        boxShadow: state === 'start' || state === 'end'
          ? '0 2px 8px rgba(0,0,0,0.12)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        cursor: 'default',
        userSelect: 'none',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        whiteSpace: 'nowrap',
        pointerEvents: 'none', // canvas div handles all pointer events
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: state === 'start' || state === 'end' ? 700 : 600,
          color: TEXT[state],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {displayLabel}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/src/components/Bubble.tsx
git commit -m "feat(web): Bubble component — div-based pill with web visual states"
```

---

## Chunk 2: PuzzleCanvas + ResultsScreen + App + deployment

### Task 4: PuzzleCanvas component

**Files:**
- Create: `web/src/components/PuzzleCanvas.tsx`

**Context:** The mobile `PuzzleCanvas` uses `PanResponder` which doesn't exist on web. The web version uses `onPointerDown` / `onPointerMove` / `onPointerUp` on a container `div`. `e.currentTarget.setPointerCapture(e.pointerId)` ensures drag events continue even when the pointer leaves a bubble. Hit detection uses the bubble's center position and `BUBBLE_W`/`BUBBLE_H` bounds (same as mobile `hitTest`). SVG lines overlay the bubbles. The dwell mechanic (hover over bubble for 300ms to connect) is preserved using `setTimeout`.

- [ ] **Step 1: Create web/src/components/PuzzleCanvas.tsx**

```tsx
import React, { useCallback, useRef, useState } from 'react'
import { Bubble, BubbleData, BubbleState, BUBBLE_W, BUBBLE_H } from './Bubble'

interface PuzzleCanvasProps {
  bubbles: BubbleData[]
  connections: Record<string, string[]>
  startId: string
  endId: string
  minHops: number
  onPathComplete: (path: string[]) => void
}

const DWELL_MS = 300

function hitTest(
  point: { x: number; y: number },
  bubble: BubbleData
): boolean {
  return (
    Math.abs(point.x - bubble.position.x) <= (BUBBLE_W + 40) / 2 &&
    Math.abs(point.y - bubble.position.y) <= BUBBLE_H / 2
  )
}

function toCanvasCoords(
  e: React.PointerEvent<HTMLDivElement>,
  containerRef: React.RefObject<HTMLDivElement>
): { x: number; y: number } {
  const rect = containerRef.current!.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

export function PuzzleCanvas({
  bubbles,
  connections,
  startId,
  endId,
  minHops,
  onPathComplete,
}: PuzzleCanvasProps) {
  const [activePath, setActivePath] = useState<string[]>([])
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveringId, setHoveringId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const activePathRef = useRef<string[]>([])
  const isTracingRef = useRef(false)
  const dwellBubbleRef = useRef<string | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubblesRef = useRef(bubbles)
  bubblesRef.current = bubbles
  const onPathCompleteRef = useRef(onPathComplete)
  onPathCompleteRef.current = onPathComplete

  function clearDwell() {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    dwellBubbleRef.current = null
    setHoveringId(null)
  }

  const connectBubble = useCallback((bubble: BubbleData) => {
    const currentPath = activePathRef.current
    const existingIndex = currentPath.indexOf(bubble.id)

    if (existingIndex !== -1) {
      // Backtrack: trim path to this bubble
      const trimmed = currentPath.slice(0, existingIndex + 1)
      activePathRef.current = trimmed
      setActivePath([...trimmed])
    } else {
      // Block reaching end before minHops
      if (bubble.id === endId && currentPath.length < minHops) return
      const newPath = [...currentPath, bubble.id]
      activePathRef.current = newPath
      setActivePath(newPath)

      if (bubble.id === endId) {
        // Short pause so player sees the completed path, then fire callback
        setTimeout(() => {
          onPathCompleteRef.current(newPath)
        }, 600)
      }
    }
    setHoveringId(null)
  }, [endId, minHops])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = toCanvasCoords(e, containerRef)
    const currentPath = activePathRef.current

    if (currentPath.length > 0) {
      // Resume from last bubble or reset
      const lastBubble = bubblesRef.current.find(b => b.id === currentPath[currentPath.length - 1])
      if (lastBubble && hitTest({ x, y }, lastBubble)) {
        isTracingRef.current = true
      } else {
        activePathRef.current = []
        setActivePath([])
        isTracingRef.current = false
      }
      return
    }

    // Start from start bubble only
    const startBubble = bubblesRef.current.find(b => b.id === startId)
    if (!startBubble || !hitTest({ x, y }, startBubble)) return
    isTracingRef.current = true
    activePathRef.current = [startId]
    setActivePath([startId])
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTracingRef.current) return
    const { x, y } = toCanvasCoords(e, containerRef)
    setFingerPos({ x, y })

    const currentPath = activePathRef.current
    const lastId = currentPath[currentPath.length - 1]

    // Find bubble under pointer (skip current last node)
    const overBubble = bubblesRef.current.find(
      b => b.id !== lastId && hitTest({ x, y }, b)
    ) ?? null

    if (!overBubble) {
      clearDwell()
      return
    }

    if (overBubble.id === dwellBubbleRef.current) return

    clearDwell()
    dwellBubbleRef.current = overBubble.id
    setHoveringId(overBubble.id)

    const captured = overBubble
    dwellTimerRef.current = setTimeout(() => {
      if (isTracingRef.current && dwellBubbleRef.current === captured.id) {
        connectBubble(captured)
        dwellBubbleRef.current = null
      }
    }, DWELL_MS)
  }

  function onPointerUp() {
    clearDwell()
    setFingerPos(null)
    isTracingRef.current = false
  }

  function getBubbleState(id: string): BubbleState {
    if (id === startId) return 'start'
    if (id === endId) return 'end'
    if (activePath.includes(id)) return 'active'
    return 'idle'
  }

  // Canvas dimensions: bounding box of all bubble positions + padding
  const canvasWidth = Math.max(...bubbles.map(b => b.position.x)) + BUBBLE_W
  const canvasHeight = Math.max(...bubbles.map(b => b.position.y)) + BUBBLE_H + 20

  const lastBubble = activePath.length > 0
    ? bubbles.find(b => b.id === activePath[activePath.length - 1])
    : null

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative',
        width: canvasWidth,
        height: canvasHeight,
        touchAction: 'none', // prevent scroll while dragging on mobile
        cursor: 'crosshair',
      }}
    >
      {/* SVG connection lines — rendered below bubbles */}
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        width={canvasWidth}
        height={canvasHeight}
      >
        {/* Settled path lines */}
        {activePath.slice(0, -1).map((id, i) => {
          const from = bubbles.find(b => b.id === id)
          const to = bubbles.find(b => b.id === activePath[i + 1])
          if (!from || !to) return null
          return (
            <line
              key={`${id}-${activePath[i + 1]}`}
              x1={from.position.x}
              y1={from.position.y}
              x2={to.position.x}
              y2={to.position.y}
              stroke="#7c3aed"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={1}
            />
          )
        })}
        {/* Trailing line from last node to finger */}
        {isTracingRef.current && lastBubble && fingerPos && (
          <line
            x1={lastBubble.position.x}
            y1={lastBubble.position.y}
            x2={fingerPos.x}
            y2={fingerPos.y}
            stroke="#7c3aed"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.35}
            strokeDasharray="6 4"
          />
        )}
      </svg>

      {/* Bubbles */}
      {bubbles.map(bubble => (
        <Bubble
          key={bubble.id}
          label={bubble.label}
          state={getBubbleState(bubble.id)}
          position={bubble.position}
          hovering={bubble.id === hoveringId}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/src/components/PuzzleCanvas.tsx
git commit -m "feat(web): PuzzleCanvas — pointer events + SVG lines + dwell mechanic"
```

---

### Task 5: ResultsScreen component

**Files:**
- Create: `web/src/components/ResultsScreen.tsx`

**Context:** Shown after `onPathComplete` fires. Displays solved path, optimal badge, narrative, and iOS download CTA. The App Store URL for RabbitHole should point to the live listing — use `https://apps.apple.com/app/rabbithole/id6741993022` (the real bundle ID is `com.benmattes.rabbithole`; confirm the App Store ID with the user or use the placeholder URL pattern). Purple CTA button (`#7c3aed`).

- [ ] **Step 1: Create web/src/components/ResultsScreen.tsx**

```tsx
import React from 'react'
import { Puzzle } from '../lib/api'

interface ResultsScreenProps {
  puzzle: Puzzle
  playerPath: string[]  // array of bubble IDs
}

// App Store URL for RabbitHole — update with real App Store ID before launch
const APP_STORE_URL = 'https://apps.apple.com/app/id6741993022'

export function ResultsScreen({ puzzle, playerPath }: ResultsScreenProps) {
  // Map IDs to labels for display
  const idToLabel: Record<string, string> = {}
  for (const b of puzzle.bubbles) {
    idToLabel[b.id] = b.label
  }

  const pathLabels = playerPath.map(id => idToLabel[id] ?? id)
  const isOptimal = playerPath.length === puzzle.optimal_path.length
  const hops = playerPath.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 0' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', textAlign: 'center' }}>
        You solved it!
      </h1>

      {/* Path display */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: '#999',
          marginBottom: 10,
          fontWeight: 600,
        }}>
          Your Path
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}>
          {pathLabels.map((label, i) => (
            <React.Fragment key={i}>
              <span style={{
                background: i === 0 ? '#dcfce7' : i === pathLabels.length - 1 ? '#fee2e2' : '#f3f3f1',
                color: i === 0 ? '#16a34a' : i === pathLabels.length - 1 ? '#dc2626' : '#1a1a1a',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
              }}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </span>
              {i < pathLabels.length - 1 && (
                <span style={{ color: '#ccc', fontSize: 14 }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <span style={{
            fontSize: 12,
            color: '#7c3aed',
            fontWeight: 600,
          }}>
            {hops} hop{hops !== 1 ? 's' : ''}
          </span>
          {isOptimal && (
            <span style={{
              fontSize: 12,
              color: '#16a34a',
              fontWeight: 600,
            }}>
              · Optimal path ✓
            </span>
          )}
        </div>
      </div>

      {/* Narrative */}
      {puzzle.narrative && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: '14px 18px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <p style={{
            fontSize: 14,
            color: '#444',
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}>
            "{puzzle.narrative}"
          </p>
        </div>
      )}

      {/* App Store CTA */}
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          background: '#7c3aed',
          color: '#ffffff',
          padding: '16px 24px',
          borderRadius: 14,
          fontWeight: 700,
          fontSize: 16,
          textAlign: 'center',
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
        }}
      >
        Download RabbitHole — Free on iOS
      </a>
      <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        20 categories · Easy, Medium &amp; Hard · new puzzle daily
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/src/components/ResultsScreen.tsx
git commit -m "feat(web): ResultsScreen — path display, narrative, App Store CTA"
```

---

### Task 6: App.tsx — wire everything together

**Files:**
- Create: `web/src/App.tsx`

**Context:** State machine: `loading` → fetch puzzle (with category fallback) → `playing` or `error`. `playing` → path complete → `results`. App reads today's UTC date, gets category fallbacks, calls `getTodaysPuzzleWithFallback`. Header shows "RabbitHole" + category name + "Easy". Max width 480px centered.

- [ ] **Step 1: Create web/src/App.tsx**

```tsx
import React, { useEffect, useState } from 'react'
import { Puzzle, getTodaysPuzzleWithFallback } from './lib/api'
import { todayUTC, getCategoryFallbacks } from './lib/categoryRotation'
import { PuzzleCanvas } from './components/PuzzleCanvas'
import { ResultsScreen } from './components/ResultsScreen'

type AppState = 'loading' | 'playing' | 'results' | 'error'

const APP_STORE_URL = 'https://apps.apple.com/app/id6741993022'

export default function App() {
  const [state, setState] = useState<AppState>('loading')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [playerPath, setPlayerPath] = useState<string[]>([])

  useEffect(() => {
    const dateStr = todayUTC()
    const categoryIds = getCategoryFallbacks(dateStr)
    getTodaysPuzzleWithFallback(categoryIds, dateStr)
      .then(p => {
        if (!p) {
          setState('error')
        } else {
          setPuzzle(p)
          setState('playing')
        }
      })
      .catch(() => setState('error'))
  }, [])

  function handlePathComplete(path: string[]) {
    setPlayerPath(path)
    setState('results')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9f9f7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Max-width container */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <header style={{
          paddingTop: 20,
          paddingBottom: 12,
          borderBottom: '1px solid #e5e5e5',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#1a1a1a',
              letterSpacing: -0.5,
            }}>
              RabbitHole
            </h1>
            {puzzle && (
              <span style={{ fontSize: 13, color: '#999', fontWeight: 500 }}>
                {puzzle.category_name} · Easy
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {state === 'loading' && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 14,
            }}>
              Loading today's puzzle…
            </div>
          )}

          {state === 'error' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              textAlign: 'center',
              padding: '40px 0',
            }}>
              <p style={{ fontSize: 16, color: '#666' }}>
                Something went wrong. Try refreshing.
              </p>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#7c3aed',
                  color: '#fff',
                  padding: '14px 24px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Download RabbitHole — Free on iOS
              </a>
            </div>
          )}

          {state === 'playing' && puzzle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>
                Connect{' '}
                <strong style={{ color: '#16a34a' }}>{puzzle.start_concept}</strong>
                {' '}to{' '}
                <strong style={{ color: '#dc2626' }}>{puzzle.end_concept}</strong>
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                <PuzzleCanvas
                  bubbles={puzzle.bubbles}
                  connections={puzzle.connections}
                  startId={puzzle.bubbles.find(b => b.label.toLowerCase() === puzzle.start_concept.toLowerCase())?.id ?? puzzle.bubbles[0].id}
                  endId={puzzle.bubbles.find(b => b.label.toLowerCase() === puzzle.end_concept.toLowerCase())?.id ?? puzzle.bubbles[puzzle.bubbles.length - 1].id}
                  minHops={puzzle.optimal_path.length - 1}
                  onPathComplete={handlePathComplete}
                />
              </div>
            </div>
          )}

          {state === 'results' && puzzle && (
            <ResultsScreen puzzle={puzzle} playerPath={playerPath} />
          )}
        </main>

        {/* Footer */}
        <footer style={{
          padding: '16px 0',
          textAlign: 'center',
          borderTop: '1px solid #e5e5e5',
          marginTop: 20,
        }}>
          <span style={{ fontSize: 12, color: '#ccc' }}>deepr.fm</span>
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/bmattes/Desktop/RabbitHole/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Create a .env file with real credentials and run the dev server**

Copy `web/.env.example` to `web/.env` and fill in the real Supabase URL and anon key (find the anon key in `mobile/.env` — it's `EXPO_PUBLIC_SUPABASE_ANON_KEY`):

```bash
cd /Users/bmattes/Desktop/RabbitHole/web && npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`. Open in browser.

- [ ] **Step 4: Verify the puzzle loads and is playable**

Open `http://localhost:5173`. You should see:
- Header: "RabbitHole" + category name + "Easy"
- Bubbles rendered on a white canvas
- Drag from the green start bubble — dwell 300ms on each connected bubble to build a path
- Reach the red end bubble → brief pause → results screen appears
- Results screen shows path, optional narrative, purple CTA button

- [ ] **Step 5: Verify on mobile Safari (or DevTools mobile emulation)**

In Chrome DevTools, toggle device toolbar (iPhone 12 size). Confirm:
- Bubbles are tappable
- Drag works without scroll interference (due to `touchAction: none`)
- Canvas doesn't overflow viewport horizontally

- [ ] **Step 6: Commit**

```bash
cd /Users/bmattes/Desktop/RabbitHole
git add web/src/App.tsx
git commit -m "feat(web): App.tsx — state machine, puzzle fetch with fallback, full layout"
```

---

### Task 7: Deployment — Cloudflare Pages + deepr.fm/play route

**Files:**
- Modify: `/Users/bmattes/Documents/PodcastApp/deeplink-service/wrangler.toml` (add `/play*` route after Pages URL is known)

**Context:** This task has two manual sub-steps (creating the Pages project on the Cloudflare dashboard) before the code change. The `deeplink-service` worker at `deepr.fm` handles all deepr.fm routing. We need it to proxy `/play*` requests to the new Cloudflare Pages deployment. Read `wrangler.toml` first before modifying.

- [ ] **Step 1: Build the production bundle**

```bash
cd /Users/bmattes/Desktop/RabbitHole/web && npm run build
```

Expected: `web/dist/` created. Check `dist/index.html` exists.

- [ ] **Step 2: Create a Cloudflare Pages project (manual — dashboard)**

Go to Cloudflare Dashboard → Pages → Create a project → "Direct Upload".
- Project name: `rabbithole-web`
- Upload the contents of `web/dist/` (drag and drop the folder)
- Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Note the resulting Pages URL (e.g. `https://rabbithole-web.pages.dev`).

> **Note:** Vite bakes env vars into the bundle at build time. The Pages env vars only matter if you later set up CI/CD. For the initial upload, the vars are already baked in from your local `.env`. For future deploys via CI, set them as Pages env vars.

- [ ] **Step 3: Verify the Pages deployment works**

Open the `*.pages.dev` URL in your browser. Confirm the puzzle loads and is playable.

- [ ] **Step 4: Read the existing deeplink-service wrangler.toml**

```bash
cat /Users/bmattes/Documents/PodcastApp/deeplink-service/wrangler.toml
```

Understand the existing routing structure before modifying.

- [ ] **Step 5: Add the /play route to deeplink-service**

Read `/Users/bmattes/Documents/PodcastApp/deeplink-service/src/index.ts` to understand how routes are handled, then add a proxy/redirect for `/play*` pointing to the Pages deployment URL from Step 2.

The implementation depends on the existing routing pattern. The most common approach for Cloudflare Workers proxying to Pages is a `fetch` passthrough:

```typescript
// In the route handler, add before other routes:
if (url.pathname.startsWith('/play')) {
  const pagesUrl = new URL(request.url)
  pagesUrl.hostname = 'rabbithole-web.pages.dev'  // replace with actual Pages hostname
  return fetch(new Request(pagesUrl.toString(), request))
}
```

- [ ] **Step 6: Test the proxy locally**

```bash
cd /Users/bmattes/Documents/PodcastApp/deeplink-service && wrangler dev --port 8788
```

Open `http://localhost:8788/play` — should render the RabbitHole web app.

- [ ] **Step 7: Deploy deeplink-service (requires user confirmation)**

**STOP — confirm with user before running this command.** This deploys to production deepr.fm.

```bash
cd /Users/bmattes/Documents/PodcastApp/deeplink-service && wrangler deploy
```

- [ ] **Step 8: Verify deepr.fm/play works**

Open `https://deepr.fm/play` in a browser. Confirm the puzzle loads.

- [ ] **Step 9: Commit the deeplink-service change**

```bash
cd /Users/bmattes/Documents/PodcastApp
git add deeplink-service/
git commit -m "feat(deeplink): proxy /play to rabbithole-web Pages deployment"
```

---

## Notes for the implementer

**startId / endId lookup in App.tsx:** The `start_concept` and `end_concept` fields in the DB are human-readable labels (e.g. "The Godfather"). The `bubbles` array has `{ id, label, position }`. The App.tsx lookup matches `b.label.toLowerCase() === puzzle.start_concept.toLowerCase()`. This is the same approach the mobile app uses — labels are stable.

**`optimal_path` is an array of entity IDs** (e.g. `["Q123", "Q456", ...]`) including both endpoints. `playerPath` is also an array of entity IDs from `bubbles[].id`. `playerPath.length === puzzle.optimal_path.length` means the player used the optimal number of hops.

**Bubble positions from the DB** are already laid out by the pipeline's composer. The canvas width/height is computed dynamically from the max x/y of bubble positions + padding — so the canvas always fits the puzzle's layout without hardcoded dimensions.

**`touchAction: none` on the canvas div** is essential for mobile. Without it, pointer events get interrupted by the browser's scroll gesture recogniser mid-drag.

**App Store ID:** The bundle identifier is `com.benmattes.rabbithole`. The placeholder URL `https://apps.apple.com/app/id6741993022` should be verified against the actual App Store listing and updated if different.

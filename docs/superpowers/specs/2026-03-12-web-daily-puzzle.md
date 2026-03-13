# RabbitHole Web Daily Puzzle

**Date:** 2026-03-12
**Status:** Approved for implementation

## Problem

RabbitHole has no web presence. Puzzle generation is automated and there's a 30-day buffer, but no way to share the game organically on Twitter or drive installs without an App Store listing. A free web-playable daily puzzle at `deepr.fm/play` lets players discover the mechanic and funnels them toward the iOS app.

## Solution

A standalone React + Vite web app at `deepr.fm/play`. Players get one free daily puzzle — always Easy difficulty, rotating through all 21 active categories. No auth, no persistence, no score storage. After solving, they see their path, the AI narrative, and a prominent iOS download CTA.

---

## Architecture

### New directory: `web/`

Standalone Vite + React app. No React Native dependency. Shares only Supabase credentials (via env vars) and the `Puzzle` type shape with the mobile app.

```
web/
  src/
    lib/
      supabase.ts          ← browser Supabase client (anon key)
      api.ts               ← getTodaysPuzzle(categoryId) — same query as mobile
      categoryRotation.ts  ← deterministic date→category mapping
    components/
      PuzzleCanvas.tsx     ← reimplemented with HTML divs + SVG + pointer events
      Bubble.tsx           ← div-based pill, same visual states as mobile
      ResultsScreen.tsx    ← path + narrative + App Store CTA
    App.tsx                ← state machine: loading → puzzle → playing → results
  index.html
  vite.config.ts
  package.json
  .env                     ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

### Data flow

1. `categoryRotation.ts` maps today's date to a category ID — deterministic, no API call
2. `api.ts` queries Supabase: `puzzles` table, `difficulty=easy`, `date=today`, `status=published`
3. Puzzle data (`bubbles`, `connections`, `optimal_path`, `narrative`) passed to `PuzzleCanvas`
4. On path completion, transition to `ResultsScreen`

### Category rotation

All 21 active categories in a fixed ordered array (confirmed via `categories` table; 21 is the canonical count). `dayIndex = daysSinceEpoch % 21`. Deterministic — same date always shows same category everywhere in the world (uses UTC date). Order is curated for broad appeal:

```
Movies, World History, Science, TV Shows, Football/Soccer, Literature,
Geography, Rock Music, Space & Astronomy, Video Games, Food & Cuisine,
Philosophy, Comics, Basketball, Visual Art, Hip-Hop, Military History,
Royals & Monarchs, Classical Music, Country Music, American Football
```

---

## Components

### `PuzzleCanvas.tsx`

The core interactive component. Reimplemented for web — no React Native, no PanResponder.

**Rendering:** Absolutely-positioned `div` container. Each bubble is a `div` styled as a pill. Connection lines are SVG `<line>` elements overlaid on the canvas. Canvas size adapts to viewport width (max 480px, centered).

**Interaction:** `onPointerDown` / `onPointerMove` / `onPointerUp` on the container div. `setPointerCapture` ensures drag continues outside bubbles. Hit detection via bounding rect comparison. Same logical state machine as mobile: idle → dragging → dwell-select → path-building.

**States mirrored from mobile:**
- `start` — green pill
- `end` — red pill
- `active` — purple text
- `idle` — default
- `broken` — red text (wrong connection attempt)

No haptics (web). No hint system. No shuffle.

### `Bubble.tsx`

Pure div implementation. Pill shape via `border-radius: 30px`. Width auto-fits label text (min 100px, max 200px). Same color mapping as mobile theme.

### `ResultsScreen.tsx`

Shown after `onPathComplete` fires. Displays:
- "You solved it!" heading
- The player's path as a horizontal chain of bubble labels with `→` separators
- Optimal badge if `path.length === optimalPath.length` (`optimal_path` in the DB stores all nodes including start and end, same as the player's path)
- AI narrative paragraph (from `puzzle.narrative`)
- Purple "Download RabbitHole — Free on iOS" button linking to App Store

No score calculation, no timer, no stats.

### `App.tsx`

Simple state machine:
```
'loading' → fetch puzzle → 'playing'
'playing' → path complete → 'results'
```

Header: "RabbitHole" wordmark + today's category name + "Easy".
Footer: "deepr.fm" — subtle brand tie-in.

---

## Visual Design

**Background:** `#f9f9f7` (light, same as mobile light theme)
**Accent / CTA button:** `#7c3aed` (purple, same as mobile)
**Start bubble:** `#16a34a` green
**End bubble:** `#dc2626` red
**Active bubble text:** `#7c3aed`
**Font:** System sans-serif stack
**Max width:** 480px centered — feels like a phone in the browser
**Connection lines:** SVG, `#7c3aed` with 0.3 opacity when inactive, full opacity when active path

---

## Deployment

**Build:** `vite build` → `web/dist/`
**Host:** Cloudflare Pages (new Pages project `rabbithole-web`, same Cloudflare account as Deepr)
**Route:** `deepr.fm/play` — after the Pages project is created and assigned its `*.pages.dev` URL, add a route in the existing `deeplink-service/wrangler.toml` that proxies `/play*` to that Pages URL. This is the final deployment sub-step.
**Env vars on Pages:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only — no service key in browser)
**Mobile browsers:** `pointer` events (`onPointerDown`/`onPointerMove`/`onPointerUp` + `setPointerCapture`) work correctly on mobile Safari and Chrome without touch-specific workarounds.

---

## Error handling

- **No puzzle for today's category / Supabase fetch fails:** `App.tsx` tracks an `error` state (alongside `loading`/`playing`/`results`). On error, show "Something went wrong, try refreshing." with an App Store CTA.
- **Category has no easy puzzle:** Iterate forward through the rotation array (`dayIndex+1`, `dayIndex+2`, …) until a published easy puzzle is found for today's date. Retry at most 21 times before falling back to the error state.

---

## Out of scope

- Auth / user accounts
- Score persistence
- Share to Twitter button
- Hints / connection mode
- Medium / hard difficulties
- Category selection
- Leaderboard

---

## File structure in repo

```
web/                    ← new top-level directory
mobile/                 ← unchanged
pipeline/               ← unchanged
.github/workflows/      ← unchanged
```

No changes to the mobile app or pipeline.

---

## Implementation steps

1. Scaffold `web/` with Vite + React + TypeScript
2. Implement `categoryRotation.ts` + `api.ts`
3. Implement `Bubble.tsx` (div-based)
4. Implement `PuzzleCanvas.tsx` (pointer events + SVG lines)
5. Implement `ResultsScreen.tsx`
6. Wire together in `App.tsx`
7. Deploy to Cloudflare Pages + configure `deepr.fm/play` route

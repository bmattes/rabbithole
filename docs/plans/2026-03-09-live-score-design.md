# Live Score System Design
Date: 2026-03-09

## Overview

Replace the timer-counting-up in the puzzle header with a live score counting down. The score reflects time pressure and in-game mistakes in real time. At completion, node quality bonuses are added and the final score is shown on the results screen with a clear breakdown explaining the delta.

## Scoring Architecture

### Live Score (puzzle screen)

Shown in the header, replaces the elapsed timer.

**Initial value**: 400 (easy), 300 (medium), 200 (hard)

**Time decay**: exponential decay, floors at 50 after 5 minutes
- Formula: `max(50, ceiling * e^(-t / 180000))`
- At 15s: ~390 (easy), ~290 (medium), ~190 (hard)
- At 2min: ~280 / ~210 / ~140
- At 5min+: 50 (floor)

**In-game penalties** (applied immediately, visible as flash on screen):
- Backtrack (remove last node): -25
- Full reset (lift finger mid-path, path abandoned): -100
- Score floors at 0

### Node Score (applied at completion)

**Node budget by difficulty**:
- Easy: 600 pts
- Medium: 700 pts
- Hard: 800 pts

**Per-node value** = `budget / numIntermediates` (start/end nodes excluded)

**Node categories** (applied to each intermediate in player's final path):
- Right node, right place (on optimal path, correct position): `perNodeValue` pts
- Right node, wrong place (on optimal path, wrong position): `perNodeValue * 0.4` pts
- Wrong node (not on optimal path): 0 pts

### Final Score

`finalScore = min(1000, liveScore + nodeScore)`

Floored at a minimum of 100 (so even a terrible run gets something).

## Puzzle Screen Changes

- Header: replace `elapsed` timer display with live `liveScore` (integer, counts down)
- Flash `-25` or `-100` penalty text briefly next to the score on penalty events
- `useTimer` hook still runs internally (needed for decay calculation), but elapsed is not shown
- `liveScore` is a `useState` updated via `requestAnimationFrame` loop (60fps decay)
- Penalty events come from `PuzzleCanvas` via two new callbacks: `onBacktrack` and `onReset`
- `liveScore` ref passed to `handlePathComplete` at completion time

## Results Screen Changes

- `liveScore` passed as new URL param (replaces `timeMs` for display purposes; `timeMs` still passed for record-keeping)
- Path breakdown section shows each intermediate node with its category label and points:
  - "Right node, right place +83"
  - "Right node, wrong place +33"
  - "Wrong node +0"
- Summary line: "Time score: 312 + Node score: 449 = 761"
- Final score shown with existing count-up animation

## Scoring Library Changes (`mobile/lib/scoring.ts`)

New exports:
- `computeLiveTimeScore(elapsed, difficulty)` — returns current live score from time alone
- `computeNodeScores(playerPath, optimalPath, difficulty)` — returns array of `{ id, category, points }` per intermediate
- `NODE_BUDGET` — record of budget by difficulty
- `TIME_CEILING` — record of ceiling by difficulty

Remove: `computeTimeMultiplier`, `computeScore` (replaced entirely)
Keep: `computePathMultiplier` (may be useful for XP calculation)

## PuzzleCanvas Changes

Two new optional callbacks:
- `onBacktrack?: () => void` — fired when last node removed from active path
- `onReset?: () => void` — fired when path is fully cleared (finger lifted mid-path, not on end node)

## Data Flow

```
useTimer (internal) → elapsed ms
elapsed → computeLiveTimeScore → liveScore state (rAF loop)
PuzzleCanvas onBacktrack → liveScore -= 25
PuzzleCanvas onReset → liveScore -= 100
handlePathComplete → { liveScore, path } → computeNodeScores → finalScore
finalScore + liveScore + nodeBreakdown → router.replace('/results/...')
results screen → renders breakdown
```

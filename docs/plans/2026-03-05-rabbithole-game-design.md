# RabbitHole — Game Design Document
*Created: 2026-03-05*

## Overview

RabbitHole is a NYT Games-style daily puzzle mobile game inspired by the Wikipedia Speed Run (Wiki Game). Players trace a continuous path through a scattered field of concept bubbles, connecting a Start concept to an End concept via intermediate "hops." Every player sees the same Puzzle of the Day (POTD), enabling global leaderboards.

---

## Core Game Loop

1. Player opens app, selects a category (e.g. Movies)
2. Today's puzzle loads — Start and End concepts pinned, hop bubbles scattered in between
3. Player traces a continuous finger path from Start through chosen hops to End
4. On submit: score computed, broken chains flagged for retry, AI narrative revealed
5. Results shared, leaderboard checked, return tomorrow

---

## Puzzle Structure

Each POTD contains:
- **Category** — thematic domain (Movies, Music, Sports, etc.)
- **Start concept** — 1-3 words, pinned top center
- **End concept** — 1-3 words, pinned bottom center
- **Hop bubbles** — 10-15 intermediate concepts scattered on screen (count TBD via playtesting)
- **Connections graph** — defines which bubbles have known logical relationships
- **Optimal path** — pre-computed ideal sequence (hidden until results)
- **Orphan bubbles** — some bubbles intentionally have no valid connections; including them breaks the chain
- **RabbitHole narrative** — AI-written 2-3 sentence story explaining the optimal path

---

## Interaction Design

### The Continuous Trace Mechanic
- **Press and hold** Start bubble -> timer begins, game starts
- **Drag continuously** — live elastic line follows finger in real time
- **Pass through a bubble** -> it activates (lights up, haptic tick), becomes a checkpoint
- **Lift finger mid-path** -> line snaps back to last activated bubble (checkpoint preserved)
- **Re-enter a previous bubble** -> allowed; path reroutes from that point
- **Reach End bubble and lift** -> chain complete, Submit appears
- **Lift anywhere except End** -> snaps back to last checkpoint

### Submission & Broken Chains
- Any path can be submitted — no move restrictions during play
- If submitted path contains a bubble with no valid connection to its neighbor -> chain "snaps" at that point visually
- Player sees exactly where the break is, fixes it, resubmits
- Timer continues running through all attempts
- No attempt limit

---

## Micro-interactions & Feel

The core design principle: **every gesture should feel delicious.**

### Drag & Connect
- Press bubble -> subtle scale-up + glow pulse + medium haptic "grab"
- Dragging -> live elastic curved line (not rigid), slightly trails finger
- Hovering over valid neighbor -> bubble "breathes" larger + color invites connection + soft haptic tick
- Activating a bubble -> satisfying snap haptic + bubble bounces + line solidifies with shimmer

### Chain Building
- Connected bubbles glow progressively brighter
- Animated particle shimmer flows along the path lines (direction: Start to current position)
- Lifting finger -> line gracefully retracts to checkpoint

### Completion
- Chain complete -> radial ripple from End bubble + completion haptic pattern
- Submit button pulses in
- Broken chain -> animated "snap" at break point + thud haptic + red flash

### Ambient
- Timer shifts color white -> yellow -> orange as time passes (ambient pressure, not stressful)
- Bubbles loaded with staggered float-in animation, settle with gentle bounce
- Bubbles subtly repel each other if dragged over (never feel static)

### Tech: React Native Reanimated 3 + Expo Haptics + Gesture Handler

---

## Scoring

```
score = base_points x path_multiplier x time_multiplier

path_multiplier = optimal_hops / player_hops   (1.0 = perfect, <1.0 = suboptimal)
time_multiplier = decay function (1.0 at 0s -> ~0.5 at 5min)
base_points = 1000  (TBD)
```

Specific constants are tunable via playtesting. The formula rewards both optimal pathing and speed, with neither fully dominating — a fast suboptimal path can beat a slow perfect path.

---

## Results Screen

- Player's path visualized as a lit chain
- Optimal path revealed alongside it
- Score breakdown: path quality + time components
- **The RabbitHole** — AI narrative explaining the optimal connection
- Share card (NYT-style, path length + time, no spoilers)
- Leaderboard teaser -> tap for full board

---

## Categories (v1)

3-5 curated categories at launch (exact set TBD), chosen for richness of Wikidata entity relationships. Candidates: Movies, Music, Sports, Science, History. Each category has its own POTD and leaderboard.

---

## Puzzle Generation Pipeline

### Automated Nightly Cron
1. **Wikidata SPARQL** — fetch entities + relationships for each active category
2. **Graph builder** — adjacency graph of concepts weighted by relationship strength
3. **Puzzle composer** — BFS/Dijkstra finds start/end pairs with 3-5 step optimal paths; selects hop bubbles (mix of on-path and plausible-but-wrong orphans)
4. **Quality filter** — auto-rejects if optimal path < 3 or > 7 hops, too many orphans, concepts too obscure
5. **AI narrative** — Claude API generates RabbitHole text for optimal path
6. **Staged** to puzzles_pending with status pending_review

### Admin Review Interface
- Lightweight screen showing next 7 days of pending puzzles per category
- Per puzzle: bubble layout preview, optimal path, narrative
- Actions: Approve | Reject + Regenerate | Edit narrative
- Fully automated if not reviewed — pipeline publishes approved puzzles on schedule

---

## Data Schema (Supabase / Postgres)

```sql
categories
  id, name, wikidata_domain, active

puzzles
  id, category_id, date, start_concept, end_concept,
  bubbles JSONB,          -- [{id, label, position}]
  connections JSONB,      -- {bubble_id: [connected_bubble_ids]}
  optimal_path JSONB,     -- [bubble_id, ...]
  narrative TEXT,
  status ENUM(pending_review, approved, published)

player_runs
  id, puzzle_id, user_id, path JSONB, time_ms, score, created_at

-- leaderboard as materialized view over player_runs

users
  id, display_name, avatar, streak, created_at
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo |
| Animations | Reanimated 3 + Gesture Handler |
| Haptics | Expo Haptics |
| Backend / DB | Supabase (Postgres + Auth + Realtime) |
| Puzzle pipeline | Node.js cron script |
| Graph data source | Wikidata SPARQL |
| AI narrative | Claude API |
| Pipeline hosting | Supabase Edge Functions or lightweight VPS cron |

---

## Screen Flow

```
Splash -> Home
Home -> Category Select -> Puzzle (active game) -> Results/Recap -> Leaderboard
Bottom tabs: Today's Puzzles | Leaderboard | Profile
```

---

## Open Questions / Tuning (Post-Playtesting)

- Optimal bubble count (currently estimated 10-15)
- Scoring constants (base points, time decay curve)
- Orphan bubble ratio (how many dead-ends per puzzle)
- Category list for v1 launch
- Whether timer is hidden or visible during play

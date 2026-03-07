# RabbitHole — Progression & Monetization Design
*Created: 2026-03-06*

## Overview

RabbitHole targets casual players (NYT Games audience) and knowledge enthusiasts. The progression system uses a classic XP → Level → Unlock model. Monetization is a generous freemium subscription — the free tier is complete, subscribers pay for archive depth and identity.

---

## XP & Leveling

### XP Sources

| Action | XP |
|--------|-----|
| Complete Easy puzzle | 100 |
| Complete Medium puzzle | 200 |
| Complete Hard puzzle | 350 |
| Optimal path bonus | +50 |
| Speed bonus | up to +50 (decay curve) |
| Daily streak bonus | +25 x streak day (day 3 = +75, day 7 = +175) |

### Level Curve

| Range | XP per level | Notes |
|-------|-------------|-------|
| 1-10 | 300-500 | Fast early hook |
| 11-30 | 800-1500 | Meaningful content unlocks |
| 31-50 | 2000-4000 | All content unlocked, prestige only |
| 51+ | ~5000 (flat) | Infinite — pure bragging rights |

---

## Unlock Progression

### Starting State (Level 1)
- 2 categories (Movies + one other TBD)
- Easy difficulty only

### Content Unlock Milestones

| Level | Unlock |
|-------|--------|
| 1 | Easy puzzles, 2 starter categories |
| 5 | Medium difficulty |
| 8 | Player chooses 3rd category |
| 12 | Hard difficulty |
| 16 | Player chooses 4th category |
| 22 | Player chooses 5th category (all categories unlocked) |
| 30 | All content unlocked — prestige from here |

### Design Principle
A free player who plays daily hits level 12 (Hard unlocked) in roughly 3-4 weeks. Fast enough to feel rewarding, slow enough to build habit.

Category unlocks are **player-chosen** — at each category milestone, the player picks which category to unlock from those remaining. This makes progression feel personal rather than arbitrary.

---

## Level Titles

Shown on profile and leaderboard. Purely cosmetic, Alice in Wonderland / rabbit hole themed.

| Levels | Title |
|--------|-------|
| 1-4 | Curious |
| 5-9 | Wanderer |
| 10-14 | Explorer |
| 15-19 | Deep Diver |
| 20-29 | Rabbit |
| 30-49 | White Rabbit |
| 50-99 | Mad Hatter |
| 100+ | The Rabbit Hole |

---

## Business Model: RabbitHole+

### Pricing
- $2.99/month
- $19.99/year (~44% saving)

### What Subscribers Get
- Full puzzle archive (30+ days, all categories)
- Profile badge ("+" icon next to name on leaderboard)
- No gameplay advantages — no skipping progression

### What's Always Free
- Today's puzzle in all unlocked categories/difficulties
- Last 7 days archive
- Full XP/leveling system
- All content unlocks (difficulties + categories) through leveling
- Leaderboard access
- Streaks and stats

**No ads. Ever.**

### Go-to-Market
- Launch fully free — no subscription prompt for first 30 days
- Let players reach level 5-8 before any paywall is shown (they're invested by then)
- Subscription prompt appears naturally when a player tries to access an archived puzzle beyond 7 days
- No aggressive upsell, no nag screens

---

## Open Questions (Post-Launch Tuning)
- Which 2 categories ship as starter categories
- Exact XP constants (tune via playtesting)
- Speed bonus decay curve shape
- Whether streak bonus resets on the 8th day or compounds indefinitely

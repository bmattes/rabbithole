# RabbitHole — Project Context

## What It Is
Daily puzzle mobile game. Players trace a path through concept bubbles to connect a Start and End concept. React Native + Expo mobile app backed by Supabase.

## Tech Stack
- Mobile: Expo SDK 54, React Native 0.81.5, expo-router, TypeScript
- Backend: Supabase (Postgres + Auth)
- Build: EAS (profile: `preview` = TestFlight, `development` = dev client)
- Pipeline: Node.js + Wikidata SPARQL + OpenAI for narrative generation

## Key Commands
```bash
cd mobile
npx expo start --dev-client   # run on device (after dev build installed)
npx expo run:ios --device     # build + install via USB
eas build --platform ios --profile preview   # TestFlight build
eas build --platform ios --profile development  # dev client build
npx jest --no-coverage        # run tests
```

## Supabase
- Project URL: https://eaevegumlihsuagccczq.supabase.co
- Migrations: `supabase/migrations/`
- Must be applied manually via Supabase Dashboard → SQL Editor

## Categories (Production)

**Starter categories for new users:** Movies + Soccer

### Active Wikidata domains (22)
| Name | wikidata_domain | ID |
|------|----------------|-----|
| American Football | americanfootball | b607becf-ab90-4a35-9595-f6473612d364 |
| Basketball | basketball | 3d5fd2ac-6e6a-4e87-98e8-6efbcb52c9fd |
| Classical Music | music | 43b3e56b-c343-43ca-836d-0b33cfb05d3e |
| Comics | comics | e9bf593d-966b-424b-9b97-13e0b18577fe |
| Country Music | mb_country | 1aa0ea06-222b-4331-822b-325bd53cd5ea |
| Food & Cuisine | food | 3f05b508-d942-4fca-81e9-4a1d036b2808 |
| Football / Soccer | soccer | e8330146-febe-45ca-97ca-8999d2c6f30d |
| Geography | geography | bfe96173-55b2-48ba-8f48-0fc0b6f7c48a |
| Hip-Hop | mb_hiphop | 148643e8-d8b0-49bd-a0f9-0cfd9ba8024e |
| Literature | literature | 3eb16608-c9a6-4bbe-854e-fcc7903fec63 |
| Military History | military | c31fd646-f615-413e-9238-9987af82a93b |
| Movies | movies | 5f522844-78b3-464f-9105-d15a8f746d28 |
| Philosophy | philosophy | b6353186-74d1-49ab-b159-3bd2aa1b514c |
| Rock Music | mb_rock | 7b932160-d1a9-43b6-b165-4e3e826a7da2 |
| Royals & Monarchs | royals | 8a6efe6b-047a-4883-ad8f-b8bdd1c79345 |
| Science | science | 55dcfe2f-84d7-44d6-9558-97de003c436e |
| Space & Astronomy | space | 59b7e254-b17f-4d69-8554-6e45d1084839 |
| TV Shows | tv | b705171c-177e-4a32-b82d-d0b968c8e72f |
| Video Games | videogames | 6314e218-91c5-4a29-abb6-8aa8db8b4177 |
| Visual Art | art | 4b06167c-5cb6-448f-aa91-06272425e835 |
| World History | history | 4509f7c8-ca02-49b7-a6ab-113523b02cc3 |

### Inactive / problematic domains
| Name | wikidata_domain | Reason |
|------|----------------|--------|
| Pop Music | mb_pop | Wikidata label graph too cross-genre — major labels pull in McCartney, Bowie, etc.; set active=false 2026-03-10 |
| R&B / Soul | mb_rnb | Wikidata label graph cross-genre pollution + P737 influence subquery times out; set active=false 2026-03-10 |
| Mythology | mythology | Wikidata graph too small/slow — deity graph only 613 entities, Wikidata refresh consistently times out; set active=false 2026-03-10 |
| Sport | sport | Medium/hard structurally broken — Wikidata multi-subquery timeouts; set active=false 2026-03-09 |
| Tennis | tennis | Easy permanently impossible (graph too sparse, only 194 anchors); set active=false 2026-03-09 |
| Electronic Music | mb_electronic | Deactivated (replaced by other music genres) |
| History (old) | history | Duplicate — World History row is the active one |
| Music (old) | music | Duplicate — Classical Music row is the active one |

### Adding a new domain
1. Add SPARQL subqueries to `pipeline/src/wikidata.ts` — add a new `SUBQUERY_MAP[domain]` entry with `sq()` calls (each with an edge label 4th param)
2. Add anchor types to `ANCHOR_TYPES` in both `pipeline/src/index.ts` and `pipeline/src/scripts/run-domain.ts`
3. If country nodes cause wrong-domain bridges, add domain to `COUNTRY_STRIP_DOMAINS` in `run-domain.ts`
4. Insert category row in Supabase `categories` table (`name`, `wikidata_domain`, `active=true`)
5. Add `CONNECTION_TYPES[domain]` entry in `pipeline/src/puzzleQC.ts`
6. Test: `npx ts-node src/scripts/agent-loop.ts --domain <domain> --date YYYY-MM-DD`

## Progression System
- XP: Easy=100, Medium=200, Hard=350 base + optimal path bonus (+50) + speed bonus (up to +50) + streak bonus (25×day)
- Level curve: 1-10=400 XP/level, 11-30=1000, 31-50=3000, 51+=5000
- Unlocks: Medium at level 5, Hard at level 12; category slots at 8, 16, 22
- Titles: Curious(1-4), Wanderer(5-9), Explorer(10-14), Deep Diver(15-19), Rabbit(20-29), White Rabbit(30-49), Mad Hatter(50-99), The Rabbit Hole(100+)

## Monetization
- RabbitHole+: $2.99/mo or $19.99/yr
- Free: today's puzzle + 7-day archive, all unlocked categories/difficulties
- Paid: full archive (30+ days) + leaderboard badge
- RevenueCat integration: not yet wired (SubscribeModal is UI-only stub)

## Pipeline — Generating Puzzles

### Preferred: Parallel agent-loop per domain

Use `agent-loop.ts` — one subagent per domain, all dispatched in parallel. Each agent:
1. Runs dry-run QC for all 3 difficulties
2. Diagnoses failures and adjusts `DOMAIN_CONFIG` (hub threshold, quality floor, etc.)
3. Retries up to 6 rounds until all 3 pass
4. Publishes passing puzzles; partial publish if some difficulties still fail

```bash
# From pipeline/ directory:
npx ts-node src/scripts/agent-loop.ts --domain <domain> --date YYYY-MM-DD
```

**To run all domains**: dispatch one `Agent` tool call per domain simultaneously (they are independent and safe to parallelize). Use `subagent_type: general-purpose`. Active Wikidata domains: `history`, `movies`, `soccer`, `science`, `geography`, `literature`, `philosophy`, `royals`, `military`, `space`, `food`, `comics`, `tv`, `videogames`, `art`, `basketball`, `americanfootball`. Music genres (Wikidata-backed, pass as `mb_*` domain name): `mb_rock`, `mb_hiphop`, `mb_pop`, `mb_country`, `mb_rnb`.

**Before dispatching**: check what's already published to avoid redundant work:
```bash
# From pipeline/ directory:
node check-today.js   # lists categories missing puzzles for today
```

**Entity caches** live in `pipeline/.entity-cache/` (7-day TTL). First attempt uses cache; retries force-refresh. Caches ARE used — slow retries are due to force-refresh + MusicBrainz rate limiting, not cache misses.

**Puzzle date**: always use today's date so tomorrow's run doesn't stomp. Pass `--date YYYY-MM-DD` explicitly.

### Legacy sequential runner
```bash
cd pipeline && npx ts-node src/index.ts --date YYYY-MM-DD
```
Runs all 26 categories sequentially. Slower and harder to monitor — prefer the parallel agent approach above.

## Pipeline — Domain-Specific Notes

- **food, space**: country nodes (e.g. Egypt, Germany) create wrong-domain bridges — stripped via `COUNTRY_STRIP_DOMAINS` in `run-domain.ts`
- **mb_* music domains**: now Wikidata-backed (not MusicBrainz) — genre-filtered SPARQL subqueries, pageview enrichment works, no rate limiting. Hard difficulty tends toward label-hub paths; agent-loop auto-tunes `hubRelatedIdsThreshold` to fix this.
- **tennis easy**: structurally impossible — person→team graph can't produce 4-hop paths with only 194 anchors; tennis easy will always fail
- **sport**: medium/hard permanently broken (Wikidata multi-subquery timeouts); set `active=false`; easy works but not useful alone
- **MusicBrainz domains** (mb_*): no Wikidata QIDs so `edge_labels` will always be empty — this is expected, not a bug
- **Domain config overrides**: live in `pipeline/.entity-cache/domain-config/<domain>.json` — written by agent-loop, read at compose time. Keys: `minQualityScore`, `maxHubRatio`, `hubRelatedIdsThreshold`, `minAnchorFamiliarity`, `maxMutualNeighbors`

## edge_labels

Each puzzle has `edge_labels: Record<string, string>` — a map from `"entityIdA|entityIdB"` to a human-readable relationship like `"fought in"` or `"member of"`. Populated during entity fetch from the `edgeLabel` param on each `sq()` SPARQL subquery. Used by the mobile app to show a hint pill when the player drags between connected bubbles.

- **DB column**: `puzzles.edge_labels` (jsonb, nullable)
- **Pipeline**: `fetchEntitiesCached` returns `{ entities, edgeLabels }` — threaded through composer and stored on publish
- **Mobile**: read via `puzzle.edge_labels` from Supabase, passed as `edgeLabels` prop to `PuzzleCanvas`

## Known Stubs / TODO
- `streakDay` in results screen is hardcoded to `0` — needs real streak value wired in
- `SubscribeModal` onSubscribe handler needs RevenueCat wiring
- Difficulty gating on home screen is display-only (no enforcement on navigation)

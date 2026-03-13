# Puzzle Redesign — Videogames Domain Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the videogames puzzle pipeline to produce provably fair, satisfying puzzles with a single correct path (Easy), dead-end branches (Medium), or multiple ranked paths (Hard), using typed edges and difficulty-classified bridge nodes.

**Architecture:** Expand Wikidata SPARQL queries for videogames with 6 new relationship types (character, setting, composer, director, platform, publisher). Classify every bridge node by difficulty using type + sitelinks heuristics, with LLM fallback for ambiguous nodes. Generate puzzles that enforce structural constraints (path count, distractor isolation) per difficulty. Store connection themes (edge-type sequences) for display as daily hint text.

**Tech Stack:** Node.js, TypeScript, Wikidata SPARQL, existing `pipeline/` codebase (entityCache, puzzleComposer, puzzleQC), Claude API for node classification fallback.

---

## Background & Design Decisions

### The problem with current puzzles
The current graph has ~147 videogame nodes with 5 edge types, all company-level relationships. Every node connects to every other node through 1-2 hops via hub companies (Sony, Nintendo, EA). Players can't reason about which connections are valid — they all feel arbitrary.

### New puzzle structure

**Easy (4 hops, 12 nodes total):**
- Exactly ONE valid path from start to end within the 12-node subgraph
- 7 distractors have ZERO edges to any path node — completely isolated
- Bridge nodes must all be "Easy-rated" (high public familiarity)
- Player task: deduction — "which of these 7 is THE bridge?"

**Medium (4-5 hops, 12 nodes total):**
- Exactly ONE valid complete path
- Distractors may connect to path nodes but must DEAD-END (cannot reach the end)
- At least one "Medium-rated" bridge node, no Hard-rated bridges
- Player task: exploration — backtrack from dead ends to find the one true path

**Hard (4-6 hops optimal, 12 nodes total):**
- 2-3 valid complete paths of different lengths
- Optimal path is 4-5 hops; longer paths are also valid
- At least one "Hard-rated" bridge node
- Player task: optimisation — find the SHORTEST complete route

### Edge types (new SPARQL subqueries needed)
| Property | Edge label | Easy | Medium | Hard | Notes |
|----------|-----------|------|--------|------|-------|
| P179 (series) | part of series | ✅ | ✅ | ⚠️ obscure | max 20 game connections |
| P178 (developer) | developed by | ❌ | ✅ | ✅ | 5-25 game connections only |
| P123 (publisher) | published by | ⚠️ | ✅ | ⚠️ | boutique only, max 40 games — NEVER for EA/Sony/Nintendo |
| P674 (character) | features character | ✅ | ✅ | ✅ crossover | max 15 appearances — NEVER for Mario/Luigi/Sonic |
| P840 (setting) | set in | ✅ fictional | ✅ fictional | ✅ fictional | FICTIONAL ONLY — real-world is NEVER (hub) |
| P86 (composer) | music by | ❌ | ⚠️ famous only | ✅ | Koji Kondo=Medium, Sakimoto/Mitsuda=Hard |
| P57 (director/designer) | directed by | ❌ | ✅ Miyamoto/Kojima | ✅ auteurs | 2-8 game portfolios |
| P725 (voice actor) | voiced by | ❌ | ✅ top 10 only | ⚠️ | Troy Baker/Nolan North tier |
| P408 (game engine) | runs on | ❌ | ❌ | ✅ studio-era | Build/idTech3/Infinity — NEVER for UE4/Unity |
| P749/P127 (dev→publisher) | owned by | ❌ | ✅ | ✅ | already in SPARQL |

**REMOVED from original plan (all agents said NEVER):**
- P400 (platform) — extreme hub, 558+ games per platform, no "aha" value
- P136 (genre) — extreme hub, 370+ games per genre, teaches nothing

### Bridge node difficulty classification
Two-axis model:

**Axis 1 — Node type baseline:**
- character: Easy baseline
- series: Easy baseline
- platform: Always Easy
- real-world setting: Always Easy
- fictional setting: Medium baseline
- publisher (sitelinks ≥ 100): Easy; else Medium
- developer: Medium baseline
- director: Medium baseline
- composer: Hard baseline

**Axis 2 — Sitelinks adjustment:**
- ≥ 100 sitelinks → shift one level easier
- 20–99 sitelinks → stay at baseline
- < 20 sitelinks → shift one level harder

Examples: Koji Kondo (composer, 67 sitelinks) = Hard baseline, no shift = **Hard**. Nintendo (developer, 174 sitelinks) = Medium baseline, shift easier = **Easy**.

### Hub nodes — blacklisted as bridges
These are too connected to make meaningful bridges (but fine as distractors):
- Settings: United States, Japan, France, New York City
- Characters: Mario (81 games), Luigi (58), Sonic (22)
- Developers: Capcom (79 games), Nintendo EAD (68), Konami (57), EA Vancouver (47)
- Platforms: always Easy but too hub-like for Medium/Hard
- Publishers: Sony, Nintendo, EA (use as distractor, not bridge)

Hub threshold: node connects to > 6 games of the type being queried.

### Connection themes
Every puzzle's path has an edge-type sequence. This maps to a human-readable hint:

```
game →[part_of_series]→ series →[developed_by]→ developer →[published_by]→ publisher →[released_on]→ game
Theme hint: "series, studio, publisher, platform"
```

Stored in `puzzles.connection_theme` (new DB column) and shown at the top of the puzzle screen.

### Distractor isolation rules
**Easy:** For each distractor node D and each path node P — verify no edge exists between D and P in the full graph.

**Medium:** Distractors connected to path nodes are allowed, but must not reach the END node within the remaining hop budget.

**Hard:** No strict distractor isolation — some distractors may be on the longer valid paths.

### Scale estimate
- 158 ideal composer bridges + 82 directors + 133 series + 141 settings + 104 developers + 89 characters = ~700 ideal bridge nodes
- Each bridge yields ~3 game pairs on average = ~2,100 2-hop game↔game pairs
- Chaining two 2-hop segments → hundreds of thousands of candidate 4-hop paths
- After Easy isolation check (~5-10% survival) → **10,000+ valid Easy puzzles**
- At 1 puzzle/day: 27+ years of non-duplicate videogames Easy puzzles alone

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `pipeline/src/wikidata.ts` | Modify | Add 4 new SPARQL subqueries to `VIDEOGAMES_SUBQUERIES` |
| `pipeline/src/nodeClassifier.ts` | Create | Classify bridge nodes by difficulty using type + sitelinks + LLM fallback |
| `pipeline/src/puzzleComposerV2.ts` | Create | New composer enforcing path-count and isolation constraints |
| `pipeline/src/scripts/vg-explore.ts` | Modify | Update to use new graph; verify path finding works |
| `pipeline/src/scripts/generate-puzzles-v2.ts` | Create | End-to-end generator using new composer; outputs puzzles for review |
| `pipeline/.entity-cache/node-difficulty-videogames.json` | Create (generated) | Cached difficulty classifications per node ID |
| `supabase/migrations/YYYYMMDD_add_connection_theme.sql` | Create | Add `connection_theme` column to `puzzles` table |

---

## Chunk 1: Expanded SPARQL + richer graph

### Task 1: Add new SPARQL subqueries to videogames

**Files:**
- Modify: `pipeline/src/wikidata.ts` (find `VIDEOGAMES_SUBQUERIES` array, currently lines 137-185)

The current subqueries fetch: game→series, series→developer, character→game, game→developer, game→publisher, developer→publisher, game→engine.

We need to add: game→character (P674, fictional chars only), game→setting (P840), game→composer (P86), game→director (P57), game→platform (P400).

- [ ] **Step 1: Add character subquery (P674)**

In `pipeline/src/wikidata.ts`, add to `VIDEOGAMES_SUBQUERIES` after the existing character→game subquery:

```typescript
// Game → featured character (easy: Mario, Kratos, Master Chief)
sq('easy', ['game', 'character'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P674 ?b.
  ?b wdt:P31 wd:Q15773347.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 10)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT ${limit}`, 'features character'),
```

- [ ] **Step 2: Add setting subquery (P840)**

```typescript
// Game → narrative location (easy: real-world; medium: fictional)
sq('easy', ['game', 'location'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links ?blinks WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P840 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?blinks) LIMIT ${limit}`, 'set in'),
```

- [ ] **Step 3: Add composer subquery (P86)**

```typescript
// Game → composer (hard: requires domain expertise)
sq('hard', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P86 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'music composed by'),
```

- [ ] **Step 4: Add director subquery (P57)**

```typescript
// Game → director/designer (medium: Miyamoto, Kojima well-known; most others obscure)
sq('medium', ['game', 'person'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P57 ?b.
  ?b wdt:P31 wd:Q5.
  ?a wikibase:sitelinks ?links. FILTER(?links > 15)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'directed by'),
```

- [ ] **Step 5: Add platform subquery (P400)**

```typescript
// Game → platform (easy: PlayStation, Xbox, Nintendo Switch — universally known)
sq('easy', ['game', 'platform'], (limit) => `
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ?a wdt:P31 wd:Q7889; wdt:P400 ?b.
  ?a wikibase:sitelinks ?links. FILTER(?links > 20)
  ?b wikibase:sitelinks ?blinks. FILTER(?blinks > 30)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT ${limit}`, 'released on'),
```

- [ ] **Step 6: Clear cache and verify graph size**

```bash
cd pipeline
rm -f .entity-cache/videogames-hard.json
npx ts-node src/scripts/vg-explore.ts 2>/dev/null | head -5
```

Expected: `Got 400+ entities` (up from 147)

- [ ] **Step 7: Verify key nodes are now present**

Update `vg-explore.ts` to check for: Kratos, Master Chief, Greece, Halo: Combat Evolved, Bungie, PlayStation 4.

Expected: all found with neighbors.

- [ ] **Step 8: Commit**

```bash
git add pipeline/src/wikidata.ts pipeline/src/scripts/vg-explore.ts
git commit -m "feat(pipeline): expand videogames SPARQL with character, setting, composer, director, platform edges"
```

---

## Chunk 2: Node difficulty classifier

### Task 2: Build nodeClassifier.ts

**Files:**
- Create: `pipeline/src/nodeClassifier.ts`
- Create: `pipeline/src/scripts/classify-nodes-vg.ts`

This module takes the entity list + graph, and assigns each node a `bridgeDifficulty: 'easy' | 'medium' | 'hard' | 'hub'`. Hub = too connected to use as a bridge.

- [ ] **Step 1: Define the classifier interface**

Create `pipeline/src/nodeClassifier.ts`:

```typescript
import { Entity } from './graphBuilder'

export type BridgeDifficulty = 'easy' | 'medium' | 'hard' | 'hub'

export interface ClassifiedNode {
  id: string
  label: string
  entityType: string
  sitelinks: number
  gameCount: number        // how many games connect to this node
  bridgeDifficulty: BridgeDifficulty
  bridgeReason: string     // human-readable explanation
}

// Hub threshold: node connects to more than this many games → too connected to bridge
const HUB_GAME_COUNT = 6

// Sitelink thresholds
const HIGH_SITELINKS = 100
const LOW_SITELINKS = 20

// Nodes that are always hubs regardless of game count
const ALWAYS_HUB_LABELS = new Set([
  'United States', 'Japan', 'France', 'New York City', 'United Kingdom',
  'Mario', 'Luigi', 'Sonic the Hedgehog',
])

export function classifyNode(
  entity: Entity,
  gameCount: number,
): ClassifiedNode {
  const links = entity.sitelinks ?? 0
  const type = entity.entityType ?? 'other'
  const label = entity.label

  // Hub check first
  if (gameCount > HUB_GAME_COUNT || ALWAYS_HUB_LABELS.has(label)) {
    return make(entity, gameCount, 'hub', `connects to ${gameCount} games (hub threshold ${HUB_GAME_COUNT})`)
  }

  // Type baseline + sitelinks adjustment
  let base: BridgeDifficulty
  let reason: string

  if (type === 'character') {
    base = 'easy'; reason = 'character (easy baseline)'
  } else if (type === 'series') {
    base = 'easy'; reason = 'series (easy baseline)'
  } else if (type === 'platform') {
    return make(entity, gameCount, 'easy', 'platform (always easy)')
  } else if (type === 'location') {
    // Real-world locations have high sitelinks; fictional ones are lower
    base = links >= HIGH_SITELINKS ? 'easy' : 'medium'
    reason = `location (${links >= HIGH_SITELINKS ? 'real-world' : 'fictional/regional'})`
  } else if (type === 'company') {
    base = links >= HIGH_SITELINKS ? 'easy' : 'medium'
    reason = `company sitelinks=${links}`
  } else if (type === 'person') {
    // Composers vs directors distinguished by how they got into graph
    // For now use sitelinks as proxy
    base = links >= HIGH_SITELINKS ? 'medium' : 'hard'
    reason = `person sitelinks=${links}`
  } else {
    base = 'medium'; reason = `type=${type} sitelinks=${links}`
  }

  // Sitelinks adjustment
  let final = base
  if (links >= HIGH_SITELINKS && base !== 'easy') {
    final = base === 'hard' ? 'medium' : 'easy'
    reason += ' → shifted easier (high sitelinks)'
  } else if (links < LOW_SITELINKS && base !== 'hard') {
    final = base === 'easy' ? 'medium' : 'hard'
    reason += ' → shifted harder (low sitelinks)'
  }

  return make(entity, gameCount, final, reason)
}

function make(entity: Entity, gameCount: number, d: BridgeDifficulty, reason: string): ClassifiedNode {
  return {
    id: entity.id,
    label: entity.label,
    entityType: entity.entityType ?? 'other',
    sitelinks: entity.sitelinks ?? 0,
    gameCount,
    bridgeDifficulty: d,
    bridgeReason: reason,
  }
}
```

- [ ] **Step 2: Write classifier script**

Create `pipeline/src/scripts/classify-nodes-vg.ts`:

```typescript
import * as fs from 'fs'
import * as path from 'path'
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'
import { classifyNode, ClassifiedNode } from '../nodeClassifier'

const CACHE_PATH = path.join(__dirname, '../../.entity-cache/node-difficulty-videogames.json')

async function main() {
  const { entities } = await fetchEntitiesCached('videogames', 300)
  const graph = buildGraph(entities)

  // Count how many game-type nodes each non-game node connects to
  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))

  const results: ClassifiedNode[] = []
  for (const entity of entities) {
    if (entity.entityType === 'game') continue  // games are anchors, not bridges
    const neighbors = graph[entity.id] ?? []
    const gameCount = neighbors.filter(n => gameIds.has(n)).length
    results.push(classifyNode(entity, gameCount))
  }

  // Print summary
  const byDiff: Record<string, ClassifiedNode[]> = { easy: [], medium: [], hard: [], hub: [] }
  for (const n of results) byDiff[n.bridgeDifficulty].push(n)

  console.log('\n=== Node difficulty classification ===\n')
  for (const [diff, nodes] of Object.entries(byDiff)) {
    console.log(`${diff.toUpperCase()} (${nodes.length}):`)
    console.log(' ', nodes.slice(0, 10).map(n => `${n.label}(${n.sitelinks}sl,${n.gameCount}g)`).join(', '))
    console.log()
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(results, null, 2))
  console.log(`Saved to ${CACHE_PATH}`)
}

main().catch(console.error)
```

- [ ] **Step 3: Run and review output**

```bash
cd pipeline
npx ts-node src/scripts/classify-nodes-vg.ts 2>/dev/null
```

Expected output: 4 sections (Easy/Medium/Hard/Hub) with labelled nodes. Manually verify:
- Kratos → Easy ✓
- Greece → Easy ✓
- Santa Monica Studio → Medium ✓
- Koji Kondo → Hard or Medium ✓
- Mario → Hub ✓
- United States → Hub ✓

If classification looks wrong, adjust thresholds in `nodeClassifier.ts`.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/nodeClassifier.ts pipeline/src/scripts/classify-nodes-vg.ts
git commit -m "feat(pipeline): node difficulty classifier for bridge nodes"
```

---

## Chunk 3: New puzzle composer with structural constraints

### Task 3: Build puzzleComposerV2.ts

**Files:**
- Create: `pipeline/src/puzzleComposerV2.ts`

This is the core new logic. Takes the enriched entity graph + node difficulty classifications, finds valid (start, end, path) tuples per difficulty, selects distractors with the appropriate isolation rules, and outputs a puzzle with a connection theme.

- [ ] **Step 1: Define types**

```typescript
export interface PuzzleV2 {
  startId: string
  endId: string
  path: string[]           // full path including start and end
  distractors: string[]    // 7 distractor node IDs
  connectionTheme: string  // e.g. "character → setting → developer"
  difficulty: 'easy' | 'medium' | 'hard'
  edgeLabels: Record<string, string>  // existing format
  pathCount: number        // verified: 1 for easy/medium, 2-3 for hard
}
```

- [ ] **Step 2: Implement path finder with difficulty constraints**

```typescript
// findPaths: BFS all paths of exactly targetHops between start and end
// Returns paths where ALL bridge nodes satisfy difficultyConstraint
function findPaths(
  startId: string,
  endId: string,
  graph: Graph,
  nodeClass: Map<string, ClassifiedNode>,
  maxHops: number,
  allowedBridgeDifficulties: Set<BridgeDifficulty>,
): string[][] {
  const results: string[][] = []
  const queue: string[][] = [[startId]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const last = path[path.length - 1]
    if (last === endId && path.length >= 3) { results.push(path); continue }
    if (path.length - 1 >= maxHops) continue
    for (const n of graph[last] ?? []) {
      if (path.includes(n)) continue
      // Check bridge node difficulty (skip start/end)
      if (n !== endId) {
        const cls = nodeClass.get(n)
        if (cls && !allowedBridgeDifficulties.has(cls.bridgeDifficulty)) continue
      }
      queue.push([...path, n])
    }
  }
  return results
}
```

- [ ] **Step 3: Implement Easy distractor selector**

```typescript
// Easy rule: distractors have ZERO edges to ANY path node
function selectEasyDistractors(
  path: string[],
  allNodes: string[],
  graph: Graph,
  nodeClass: Map<string, ClassifiedNode>,
  count: number,
): string[] | null {
  const pathSet = new Set(path)
  const pathNeighbors = new Set<string>()
  for (const p of path) {
    for (const n of graph[p] ?? []) pathNeighbors.add(n)
  }

  const candidates = allNodes.filter(id =>
    !pathSet.has(id) &&
    !pathNeighbors.has(id) &&
    nodeClass.get(id)?.bridgeDifficulty !== 'hub'
  )

  if (candidates.length < count) return null

  // Prefer high-familiarity distractors (tempting but wrong)
  candidates.sort((a, b) => (nodeClass.get(b)?.sitelinks ?? 0) - (nodeClass.get(a)?.sitelinks ?? 0))
  return candidates.slice(0, count)
}
```

- [ ] **Step 4: Implement Medium distractor selector**

```typescript
// Medium rule: distractors may connect to path nodes but must dead-end
// (cannot complete a route to endId within remaining hops)
function selectMediumDistractors(
  path: string[],
  endId: string,
  allNodes: string[],
  graph: Graph,
  nodeClass: Map<string, ClassifiedNode>,
  count: number,
): string[] | null {
  const pathSet = new Set(path)
  const remainingHops = 6 - (path.length - 1)  // max hops from any distractor to end

  const candidates = allNodes.filter(id => {
    if (pathSet.has(id)) return false
    if (nodeClass.get(id)?.bridgeDifficulty === 'hub') return false
    // Check: cannot reach endId within remainingHops
    const reachable = bfsMaxHops(id, endId, graph, remainingHops)
    return !reachable
  })

  if (candidates.length < count) return null
  candidates.sort((a, b) => (nodeClass.get(b)?.sitelinks ?? 0) - (nodeClass.get(a)?.sitelinks ?? 0))
  return candidates.slice(0, count)
}
```

- [ ] **Step 5: Implement connection theme labeler**

```typescript
// Derive human-readable theme from the edge types along the path
function buildConnectionTheme(
  path: string[],
  edgeLabels: Record<string, string>,
  nodeClass: Map<string, ClassifiedNode>,
): string {
  const parts: string[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const label = edgeLabels[`${a}|${b}`] ?? edgeLabels[`${b}|${a}`]
    if (label) parts.push(label)
    else {
      const type = nodeClass.get(b)?.entityType ?? 'unknown'
      parts.push(type)
    }
  }
  return parts.join(' → ')
}
```

- [ ] **Step 6: Implement main composePuzzleV2 function**

```typescript
export function composePuzzleV2(
  entities: Entity[],
  graph: Graph,
  edgeLabels: Record<string, string>,
  nodeClassifications: ClassifiedNode[],
  difficulty: 'easy' | 'medium' | 'hard',
  alreadyUsed: Set<string>,  // "startId|endId" pairs to skip
): PuzzleV2 | null {
  const nodeClass = new Map(nodeClassifications.map(n => [n.id, n]))
  const gameNodes = entities.filter(e => e.entityType === 'game' && (e.sitelinks ?? 0) > 20)
  const allNodeIds = entities.map(e => e.id)

  const allowedBridgeDiffs: Record<string, Set<BridgeDifficulty>> = {
    easy:   new Set(['easy']),
    medium: new Set(['easy', 'medium']),
    hard:   new Set(['easy', 'medium', 'hard']),
  }

  const maxHops: Record<string, number> = { easy: 4, medium: 5, hard: 6 }
  const minHops: Record<string, number> = { easy: 4, medium: 4, hard: 4 }

  // Shuffle game pairs and try until we find a valid puzzle
  const pairs = shuffle(gameNodes.flatMap((a, i) =>
    gameNodes.slice(i + 1).map(b => [a.id, b.id] as [string, string])
  ))

  for (const [startId, endId] of pairs) {
    const pairKey = `${startId}|${endId}`
    if (alreadyUsed.has(pairKey) || alreadyUsed.has(`${endId}|${startId}`)) continue

    const paths = findPaths(startId, endId, graph, nodeClass, maxHops[difficulty], allowedBridgeDiffs[difficulty])
    const validPaths = paths.filter(p => p.length - 1 >= minHops[difficulty])

    if (difficulty === 'easy' || difficulty === 'medium') {
      if (validPaths.length !== 1) continue  // must have exactly 1 path
    } else {
      if (validPaths.length < 2 || validPaths.length > 3) continue  // 2-3 paths for hard
    }

    const chosenPath = validPaths.reduce((shortest, p) => p.length < shortest.length ? p : shortest)

    const distractors = difficulty === 'easy'
      ? selectEasyDistractors(chosenPath, allNodeIds, graph, nodeClass, 7)
      : selectMediumDistractors(chosenPath, endId, allNodeIds, graph, nodeClass, 7)

    if (!distractors) continue

    // Verify Easy isolation: within 12-node subgraph, still only 1 path?
    if (difficulty === 'easy') {
      const subgraphNodes = new Set([...chosenPath, ...distractors])
      const subgraph: Graph = {}
      for (const id of subgraphNodes) {
        subgraph[id] = (graph[id] ?? []).filter(n => subgraphNodes.has(n))
      }
      const pathsInSubgraph = findPaths(startId, endId, subgraph, nodeClass, 4, allowedBridgeDiffs.hard)
      if (pathsInSubgraph.length !== 1) continue  // distractor accidentally bridged
    }

    const theme = buildConnectionTheme(chosenPath, edgeLabels, nodeClass)

    return {
      startId, endId,
      path: chosenPath,
      distractors,
      connectionTheme: theme,
      difficulty,
      edgeLabels,
      pathCount: validPaths.length,
    }
  }

  return null
}
```

- [ ] **Step 7: Commit**

```bash
git add pipeline/src/puzzleComposerV2.ts
git commit -m "feat(pipeline): new puzzle composer v2 with path-count and isolation constraints"
```

---

## Chunk 4: End-to-end generator + validation script

### Task 4: Build generate-puzzles-v2.ts

**Files:**
- Create: `pipeline/src/scripts/generate-puzzles-v2.ts`

This script generates sample puzzles for manual review. Output should be human-readable so you can validate quality before wiring into the live pipeline.

- [ ] **Step 1: Write the generator script**

```typescript
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'
import { classifyNode, ClassifiedNode } from '../nodeClassifier'
import { composePuzzleV2 } from '../puzzleComposerV2'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const difficulty = (process.argv[2] ?? 'easy') as 'easy' | 'medium' | 'hard'
  const count = parseInt(process.argv[3] ?? '5')

  console.log(`\nGenerating ${count} ${difficulty} puzzles for videogames...\n`)

  const { entities, edgeLabels } = await fetchEntitiesCached('videogames', 300)
  const graph = buildGraph(entities)

  // Make graph bidirectional
  for (const [id, neighbors] of Object.entries(graph)) {
    for (const n of neighbors) {
      if (!graph[n]) graph[n] = []
      if (!graph[n].includes(id)) graph[n].push(id)
    }
  }

  const nameMap = new Map(entities.map(e => [e.id, e.label]))
  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))

  // Classify all non-game nodes
  const classifications: ClassifiedNode[] = entities
    .filter(e => e.entityType !== 'game')
    .map(entity => {
      const gameCount = (graph[entity.id] ?? []).filter(n => gameIds.has(n)).length
      return classifyNode(entity, gameCount)
    })

  const used = new Set<string>()
  const puzzles = []

  for (let i = 0; i < count; i++) {
    const puzzle = composePuzzleV2(entities, graph, edgeLabels, classifications, difficulty, used)
    if (!puzzle) { console.log(`Could not generate puzzle ${i+1}`); continue }
    used.add(`${puzzle.startId}|${puzzle.endId}`)
    puzzles.push(puzzle)

    // Pretty print
    const pathLabels = puzzle.path.map(id => nameMap.get(id) ?? id)
    const distractorLabels = puzzle.distractors.map(id => nameMap.get(id) ?? id)
    console.log(`--- Puzzle ${i+1} (${difficulty}) ---`)
    console.log(`Path (${puzzle.path.length - 1} hops): ${pathLabels.join(' → ')}`)
    console.log(`Theme: ${puzzle.connectionTheme}`)
    console.log(`Distractors: ${distractorLabels.join(' · ')}`)
    console.log(`Path count in full graph: ${puzzle.pathCount}`)
    console.log()
  }
}

main().catch(console.error)
```

- [ ] **Step 2: Run and review Easy puzzles**

```bash
cd pipeline
npx ts-node src/scripts/generate-puzzles-v2.ts easy 5 2>/dev/null
```

For each puzzle, manually verify:
1. Path makes sense (you could explain it to someone)
2. Distractors are recognisable but clearly don't bridge
3. Connection theme hint is helpful
4. You cannot find an alternative path through the cloud

- [ ] **Step 3: Run and review Medium puzzles**

```bash
npx ts-node src/scripts/generate-puzzles-v2.ts medium 5 2>/dev/null
```

Verify at least one dead-end branch exists in the node cloud.

- [ ] **Step 4: Run and review Hard puzzles**

```bash
npx ts-node src/scripts/generate-puzzles-v2.ts hard 5 2>/dev/null
```

Verify 2-3 paths exist and the shortest is identifiably optimal.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/scripts/generate-puzzles-v2.ts
git commit -m "feat(pipeline): end-to-end v2 puzzle generator with human-readable output for review"
```

---

## Chunk 5: DB migration + publish integration

### Task 5: Add connection_theme to DB and wire into publish

**Files:**
- Create: `supabase/migrations/20260310_add_connection_theme.sql`
- Modify: `pipeline/src/index.ts` (puzzle publish step)

Only do this after manual review confirms puzzle quality in Task 4.

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260310_add_connection_theme.sql`:

```sql
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS connection_theme text;
COMMENT ON COLUMN puzzles.connection_theme IS 'Human-readable edge-type sequence, e.g. "features character → set in → developed by"';
```

Apply via Supabase Dashboard → SQL Editor.

- [ ] **Step 2: Update publish step in index.ts**

In `pipeline/src/index.ts`, find where puzzles are inserted/updated and add `connection_theme` to the payload.

- [ ] **Step 3: Swap composer in agent-loop for videogames**

Add a flag `--v2` to `agent-loop.ts` that uses `composePuzzleV2` instead of the original composer when domain is `videogames`.

- [ ] **Step 4: Test full pipeline dry-run**

```bash
cd pipeline
npx ts-node src/scripts/agent-loop.ts --domain videogames --date 2026-03-11 --dry-run --v2
```

Expected: 3 puzzles generated (easy/medium/hard), all pass QC, connection themes populated.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260310_add_connection_theme.sql pipeline/src/index.ts
git commit -m "feat(pipeline): wire connection_theme into puzzle publish for videogames v2"
```

---

## Success criteria

Before declaring this complete:

- [ ] Graph has 400+ videogames entities (up from 147)
- [ ] node-difficulty-videogames.json classifies Kratos=easy, Santa Monica Studio=medium, Koji Kondo=hard, Mario=hub, United States=hub
- [ ] Easy puzzles: 0 alternative paths in 12-node subgraph (verified by isolation check)
- [ ] Medium puzzles: at least 1 dead-end branch, exactly 1 complete path
- [ ] Hard puzzles: 2-3 complete paths, shortest is identifiably optimal
- [ ] You (Ben) can play 10 generated Easy puzzles and find each satisfying and fair
- [ ] Connection theme strings are readable: "features character → set in → developed by"
- [ ] No duplicate (start, end) pairs across generated puzzles

## Out of scope for this plan (next steps after validation)

- Generalising to other domains (Movies, Soccer, etc.) — templatise after videogames passes
- LLM persona fallback for ambiguous node classification — sitelinks heuristic first
- Mobile UI changes to display `connection_theme` — separate plan
- Used-pairs DB table for long-term deduplication — separate plan

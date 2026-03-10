/**
 * generate-puzzles-v2.ts
 *
 * Generates sample videogames puzzles for human review.
 * Uses the expanded graph (character, setting, composer, director edges)
 * and scores each path for narrative quality via Claude.
 *
 * Usage:
 *   npx ts-node src/scripts/generate-puzzles-v2.ts [count]
 *   npx ts-node src/scripts/generate-puzzles-v2.ts 10
 */

import OpenAI from 'openai'
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, Entity } from '../graphBuilder'

const COUNT = parseInt(process.argv[2] ?? '10')
const MIN_QUALITY = 6   // out of 10 — discard paths scoring below this
const MIN_GAME_SITELINKS = 20  // games must be reasonably well-known
const MAX_PATH_HOPS = 6

// Person/location nodes only connect to games (never to each other), so they can
// only form 2-hop bridges: game → person/location → game.
// Company/series nodes form longer chains (4-6 hops).
// We run two separate BFS modes and mix results.
const INTERESTING_BRIDGE_TYPES = new Set(['person', 'location'])
const MIN_BRIDGE_SITELINKS = 15  // bridge node must be recognisable

interface ScoredPath {
  startLabel: string
  endLabel: string
  path: string[]          // entity IDs
  pathLabels: string[]    // human-readable labels
  edgeLabels: string[]    // relationship types along path
  hops: number
  qualityScore: number    // 1-10 from LLM
  narrative: string       // 2-sentence narrative
  bridgeTypes: string[]   // entityType of middle nodes
}

async function scorePath(
  client: OpenAI,
  startLabel: string,
  endLabel: string,
  pathLabels: string[],
  edgeLabels: string[],
): Promise<{ score: number; narrative: string }> {
  const pathStr = pathLabels.join(' → ')
  const edgeStr = edgeLabels.join(' → ')

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are evaluating a videogame puzzle path for quality.

Path: ${pathStr}
Connections: ${edgeStr}

Score this path 1-10 on "rabbit hole quality":
- 10 = surprising, satisfying, tells a great story ("I didn't know that connected!")
- 7-9 = good connection, clear and interesting
- 4-6 = acceptable but feels like trivia or org chart
- 1-3 = boring, arbitrary, or corporate (e.g. "both published by same conglomerate")

Reply with ONLY: SCORE: <number>\nNARRATIVE: <2 sentences explaining the connection engagingly>`,
    }],
  })

  const text = response.choices[0]?.message?.content ?? ''
  const scoreMatch = text.match(/SCORE:\s*(\d+)/)
  const narrativeMatch = text.match(/NARRATIVE:\s*(.+)/s)

  return {
    score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
    narrative: narrativeMatch ? narrativeMatch[1].trim() : '',
  }
}

async function main() {
  console.log(`\nGenerating ${COUNT} scored videogames puzzles...\n`)

  const client = new OpenAI()
  const { entities, edgeLabels: edgeLabelMap } = await fetchEntitiesCached('videogames', 2000)

  // Build bidirectional graph
  const rawGraph = buildGraph(entities)
  const graph: Record<string, string[]> = {}
  for (const [id, neighbors] of Object.entries(rawGraph)) {
    if (!graph[id]) graph[id] = []
    for (const n of neighbors as string[]) {
      if (!graph[n]) graph[n] = []
      if (!graph[id].includes(n)) graph[id].push(n)
      if (!graph[n].includes(id)) graph[n].push(id)
    }
  }

  const entityMap = new Map<string, Entity>(entities.map(e => [e.id, e]))
  const nameMap = new Map<string, string>(entities.map(e => [e.id, e.label]))
  const gameNodes = entities.filter(e =>
    e.entityType === 'game' && (e.sitelinks ?? 0) >= MIN_GAME_SITELINKS
  ).sort((a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0))

  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))

  // BFS: finds shortest path of 3-6 hops.
  // Games ARE allowed as intermediate nodes — this enables paths like:
  //   Sonic → [Sonic character] → Super Smash Bros. → [Mario character] → Mario
  // Min hop count varies by bridge type:
  //   2 hops allowed only if path goes through a person or location (meaningful bridge)
  //   3+ hops required for pure company/series paths (avoid trivially obvious connections)
  function findPath(startId: string, endId: string): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      const hops = path.length - 1

      if (last === endId) {
        if (hops < 4) continue  // minimum 4 hops — short paths are too obvious
        return path
      }

      if (hops >= MAX_PATH_HOPS) continue

      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        // Allow intermediate games only if the path already passes through an interesting
        // person or location bridge — otherwise we get boring game→series→game chains
        if (gameIds.has(n) && n !== endId) {
          const hasInteresting = path.slice(1).some(id => {
            const e = entityMap.get(id)
            return INTERESTING_BRIDGE_TYPES.has(e?.entityType ?? '')
          })
          if (!hasInteresting) continue
        }
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  function getEdgeLabel(aId: string, bId: string): string {
    return edgeLabelMap[`${aId}|${bId}`] ?? edgeLabelMap[`${bId}|${aId}`] ?? '→'
  }

  const results: ScoredPath[] = []
  const usedPairs = new Set<string>()
  let attempts = 0
  const maxAttempts = gameNodes.length * 10

  while (results.length < COUNT && attempts < maxAttempts) {
    attempts++

    // Pick two random well-known games
    const i = Math.floor(Math.random() * Math.min(gameNodes.length, 100))
    const j = Math.floor(Math.random() * Math.min(gameNodes.length, 100))
    if (i === j) continue

    const start = gameNodes[i]
    const end = gameNodes[j]
    const pairKey = [start.id, end.id].sort().join('|')
    if (usedPairs.has(pairKey)) continue
    usedPairs.add(pairKey)

    const path = findPath(start.id, end.id)
    if (!path) continue

    const pathLabels = path.map(id => nameMap.get(id) ?? id)
    const edgeLabels = path.slice(0, -1).map((id, i) => getEdgeLabel(id, path[i + 1]))
    const bridgeTypes = path.slice(1, -1).map(id => entityMap.get(id)?.entityType ?? '?')

    process.stdout.write(`  Scoring: ${start.label} → ... → ${end.label} (${path.length - 1} hops)... `)

    const { score, narrative } = await scorePath(client, start.label, end.label, pathLabels, edgeLabels)
    console.log(`${score}/10`)

    if (score < MIN_QUALITY) continue

    results.push({
      startLabel: start.label,
      endLabel: end.label,
      path,
      pathLabels,
      edgeLabels,
      hops: path.length - 1,
      qualityScore: score,
      narrative,
      bridgeTypes,
    })
  }

  // Print results
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${results.length} QUALITY PUZZLES (score ≥ ${MIN_QUALITY}/10)`)
  console.log('='.repeat(60))

  results.sort((a, b) => b.qualityScore - a.qualityScore)

  for (const [i, p] of results.entries()) {
    console.log(`\n--- Puzzle ${i + 1} (${p.hops} hops, quality: ${p.qualityScore}/10) ---`)
    console.log(`START: ${p.startLabel}`)
    console.log(`END:   ${p.endLabel}`)
    console.log(`PATH:  ${p.pathLabels.join(' → ')}`)
    console.log(`EDGES: ${p.edgeLabels.join(' → ')}`)
    console.log(`TYPES: ${['game', ...p.bridgeTypes, 'game'].join(' → ')}`)
    console.log(`\n"${p.narrative}"`)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Attempts: ${attempts} | Scored: ${usedPairs.size} | Passed quality gate: ${results.length}`)
}

main().catch(console.error)

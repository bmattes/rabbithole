/**
 * domain-diagnostic.ts
 *
 * For each domain, samples 30 random paths through the existing graph,
 * scores them for puzzle quality, then asks an LLM to reason about:
 *   1. Which existing bridge types produce interesting vs boring paths
 *   2. What Wikidata properties are missing that would add rich bridges
 *   3. Whether anchor-type nodes should be traversable as intermediates
 *
 * Usage:
 *   npx ts-node src/scripts/domain-diagnostic.ts [domain1 domain2 ...]
 *   npx ts-node src/scripts/domain-diagnostic.ts movies soccer literature
 *   npx ts-node src/scripts/domain-diagnostic.ts   # all domains
 *
 * Output: docs/domain-diagnostics.md
 */

import * as fs from 'fs'
import * as path from 'path'
import OpenAI from 'openai'
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, Entity } from '../graphBuilder'

const DOMAINS = [
  'movies', 'soccer', 'science', 'geography', 'literature', 'philosophy',
  'royals', 'military', 'mythology', 'space', 'food', 'comics', 'tv',
  'art', 'history', 'basketball', 'americanfootball', 'music',
]

// Known anchor type per domain — the entity type that starts/ends puzzles
const KNOWN_ANCHOR_TYPES: Record<string, string> = {
  movies: 'film',
  soccer: 'team',
  basketball: 'team',
  americanfootball: 'team',
  music: 'person',
  science: 'person',
  history: 'person',
  military: 'person',
  royals: 'person',
  philosophy: 'person',
  art: 'artwork',
  literature: 'book',
  geography: 'city',
  mythology: 'person',
  space: 'person',
  food: 'dish',
  comics: 'person',
  tv: 'series',
  videogames: 'game',
}

const MB_DOMAINS = ['mb_rock', 'mb_hiphop', 'mb_pop', 'mb_country', 'mb_rnb']

// Wikidata knowledge for the LLM — commonly useful properties per domain type
const WIKIDATA_REFERENCE = `
Common Wikidata properties that produce interesting puzzle bridges:
- P136: genre (works well for films, games, music, books)
- P840: narrative setting / set in (films, books, games — real-world locations)
- P915: filming location (films — actual shoot location)
- P161: cast member (films, TV)
- P57: director (films, games)
- P86: composer (films, games)
- P725: voice actor (animated films, games)
- P166: award received (persons, films — e.g. "both won an Oscar")
- P19: place of birth (persons — bridges via hometown)
- P27: country of citizenship (persons)
- P495: country of origin (works)
- P400: platform (games — consoles)
- P413: position played (sports — goalkeeper, striker)
- P286: head coach / manager (sports teams)
- P54: member of sports team (athletes)
- P264: record label (musicians)
- P737: influenced by (musicians, philosophers, writers)
- P135: movement (artists, writers, philosophers)
- P108: employer (persons)
- P69: educated at (persons)
- P175: performer (songs)
- P179: series (games, films, TV)
- P674: character (games — featured fictional characters)
- P50: author (books)
- P170: creator (artworks)
- P571: inception year (for era-based grouping)
`

interface PathSample {
  pathLabels: string[]
  edgeLabels: string[]
  bridgeTypes: string[]
  hops: number
}

function buildBidirectionalGraph(entities: Entity[]): Record<string, string[]> {
  const rawGraph = buildGraph(entities)
  const graph: Record<string, string[]> = {}
  for (const [id, neighbors] of Object.entries(rawGraph)) {
    if (!graph[id]) graph[id] = []
    for (const n of neighbors as string[]) {
      if (!graph[n]) graph[n] = []
      if (!(graph[id] as string[]).includes(n)) (graph[id] as string[]).push(n)
      if (!(graph[n] as string[]).includes(id)) (graph[n] as string[]).push(id)
    }
  }
  return graph
}

function samplePaths(
  entities: Entity[],
  graph: Record<string, string[]>,
  edgeLabelMap: Record<string, string>,
  anchorType: string | null,
  n = 30,
): PathSample[] {
  const entityMap = new Map<string, Entity>(entities.map(e => [e.id, e]))
  const anchors = anchorType
    ? entities.filter(e => e.entityType === anchorType && (e.sitelinks ?? 0) >= 15)
    : entities.filter(e => (e.sitelinks ?? 0) >= 15)

  if (anchors.length < 2) return []

  const samples: PathSample[] = []
  const tried = new Set<string>()

  for (let attempt = 0; attempt < n * 20 && samples.length < n; attempt++) {
    const start = anchors[Math.floor(Math.random() * Math.min(anchors.length, 80))]
    const end = anchors[Math.floor(Math.random() * Math.min(anchors.length, 80))]
    if (start.id === end.id) continue
    const key = [start.id, end.id].sort().join('|')
    if (tried.has(key)) continue
    tried.add(key)

    // BFS — allow any intermediate, just enforce hop range
    const queue: string[][] = [[start.id]]
    const visited = new Set<string>([start.id])
    let found: string[] | null = null

    while (queue.length > 0 && !found) {
      const p = queue.shift()!
      const last = p[p.length - 1]
      if (last === end.id && p.length - 1 >= 3) { found = p; break }
      if (p.length - 1 >= 6) continue
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        visited.add(n)
        queue.push([...p, n])
      }
    }

    if (!found) continue

    const pathLabels = found.map(id => entityMap.get(id)?.label ?? id)
    const edgeLabels = found.slice(0, -1).map((id, i) =>
      edgeLabelMap[`${id}|${found![i + 1]}`] ?? edgeLabelMap[`${found![i + 1]}|${id}`] ?? '→'
    )
    const bridgeTypes = found.slice(1, -1).map(id => entityMap.get(id)?.entityType ?? '?')
    samples.push({ pathLabels, edgeLabels, bridgeTypes, hops: found.length - 1 })
  }

  return samples
}

async function analyzeDomain(
  client: OpenAI,
  domain: string,
  samples: PathSample[],
  entityTypeCounts: Record<string, number>,
  anchorType: string | null,
): Promise<string> {
  const pathsStr = samples.slice(0, 20).map((p, i) =>
    `${i + 1}. ${p.pathLabels.join(' → ')}\n   via: ${p.edgeLabels.join(' → ')}\n   types: ${p.bridgeTypes.join(' → ')}`
  ).join('\n\n')

  const typeStr = Object.entries(entityTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}: ${c}`)
    .join(', ')

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are a puzzle designer analyzing a domain called "${domain}" for a trivia game called RabbitHole.

Players connect two "${anchorType ?? 'entity'}" nodes by hopping through intermediate bridge nodes.
The graph currently contains these entity types: ${typeStr}
The anchor type (start/end nodes) is: ${anchorType ?? 'mixed'}

Here are ${samples.length} sample paths generated from the current graph:

${pathsStr}

${WIKIDATA_REFERENCE}

Based on these paths, answer CONCISELY:

1. BRIDGE_QUALITY: Which bridge types in current paths feel interesting/surprising to a player vs boring/obvious? (1-2 sentences)

2. MISSING_BRIDGES: What 2-4 Wikidata properties would add the most interesting new bridges for this domain? For each, give: property (P-number + name), example connection it would create, and why it's interesting for players. Format as a bullet list.

3. ANCHOR_TRAVERSAL: Should the anchor type ("${anchorType ?? 'entity'}") be allowed as an INTERMEDIATE node when an interesting bridge already exists in the path? For example: film→actor→film→director→film. Yes/No and why in one sentence.

4. DIFFICULTY_VERDICT: Rate the current graph's ability to produce Easy/Medium/Hard puzzles (1-5 each) and the biggest gap.

Reply with ONLY these 4 sections, labeled exactly as shown.`,
    }],
  })

  return response.choices[0]?.message?.content ?? ''
}

async function runDomain(client: OpenAI, domain: string): Promise<string> {
  process.stdout.write(`  [${domain}] loading...`)

  let entities: Entity[]
  let edgeLabelMap: Record<string, string>

  try {
    const result = await fetchEntitiesCached(domain as any, 1500)
    entities = result.entities
    edgeLabelMap = result.edgeLabels
  } catch (e: any) {
    console.log(` ERROR: ${e.message}`)
    return `## ${domain}\n\nERROR: ${e.message}\n`
  }

  const graph = buildBidirectionalGraph(entities)

  // Count entity types
  const typeCounts: Record<string, number> = {}
  for (const e of entities) {
    const t = e.entityType ?? 'unknown'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  const anchorType = KNOWN_ANCHOR_TYPES[domain] ?? null

  console.log(` ${entities.length} entities (${Object.entries(typeCounts).map(([t,c]) => `${t}:${c}`).join(', ')})`)

  const samples = samplePaths(entities, graph, edgeLabelMap, anchorType)
  process.stdout.write(`  [${domain}] sampled ${samples.length} paths, analyzing...`)

  const analysis = await analyzeDomain(client, domain, samples, typeCounts, anchorType)
  console.log(` done`)

  return `## ${domain}\n\n**Entities:** ${entities.length} | **Anchor:** ${anchorType} | **Paths sampled:** ${samples.length}\n\n${analysis}\n`
}

async function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : DOMAINS

  console.log(`\nRunning domain diagnostics for: ${targets.join(', ')}\n`)

  const client = new OpenAI()
  const sections: string[] = []

  sections.push(`# Domain Diagnostics Report\n\nGenerated: ${new Date().toISOString()}\n\nDomains analyzed: ${targets.join(', ')}\n\n---\n`)

  // Run sequentially to avoid rate limits
  for (const domain of targets) {
    const section = await runDomain(client, domain)
    sections.push(section)
    // Small delay between domains
    await new Promise(r => setTimeout(r, 1000))
  }

  const output = sections.join('\n---\n\n')
  const outPath = path.join(__dirname, '../../../docs/domain-diagnostics.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, output)

  console.log(`\nReport written to: docs/domain-diagnostics.md`)
}

main().catch(console.error)

/**
 * graph-repair-agent.ts
 *
 * Autonomous graph repair loop for domains with structural failures.
 * When the agent-loop hits a structural failure (config levers exhausted,
 * still can't compose puzzles), this agent:
 *
 * 1. Fetches the current entity graph (force-refresh)
 * 2. Runs path-density analysis — counts valid anchor pairs per difficulty
 * 3. Identifies which intermediate node types are missing / overused
 * 4. Calls Claude to reason about missing Wikidata properties
 * 5. Claude generates new sq() subquery calls as TypeScript
 * 6. Agent applies them to the domain file
 * 7. Clears cache, re-fetches, re-measures
 * 8. Loops until density threshold met or max iterations
 *
 * Usage:
 *   npx ts-node src/scripts/graph-repair-agent.ts --domain literature
 *   npx ts-node src/scripts/graph-repair-agent.ts --domain food --target-pairs 300
 *
 * Called by agent-loop.ts when structural_failure is detected.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import * as fs from 'fs'
import * as path from 'path'
import OpenAI from 'openai'
import { fetchEntities } from '../wikidata'
import { buildGraph, Entity, findShortestPath } from '../graphBuilder'
import { CategoryDomain } from '../wikidata'

// CLI args
const domainArg = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--domain') + 1]
const targetPairsArg = process.argv.find(a => a.startsWith('--target-pairs='))?.split('=')[1]
const missingDifficultiesArg = process.argv.find(a => a.startsWith('--missing='))?.split('=')[1]

if (!domainArg) {
  console.error('Usage: npx ts-node src/scripts/graph-repair-agent.ts --domain <domain> [--target-pairs N] [--missing easy,medium,hard]')
  process.exit(1)
}

const domain = domainArg as CategoryDomain
const TARGET_ANCHOR_PAIRS = parseInt(targetPairsArg ?? '200')  // min valid 4-hop pairs to consider graph healthy
const MAX_ITERATIONS = 5
const missingDifficulties = missingDifficultiesArg?.split(',') ?? ['easy', 'medium', 'hard']

const DOMAINS_DIR = path.join(__dirname, '../domains')
const CACHE_DIR = path.join(__dirname, '../../../.entity-cache')

// Known anchor type per domain (the entity type used as start/end nodes)
const ANCHOR_TYPES: Record<string, string> = {
  movies: 'film', soccer: 'team', basketball: 'team', americanfootball: 'team',
  music: 'person', science: 'person', history: 'person', military: 'person',
  royals: 'person', philosophy: 'person', mythology: 'person', space: 'person',
  comics: 'person', art: 'artwork', literature: 'book', geography: 'city',
  food: 'dish', tv: 'series', videogames: 'game',
  mb_rock: 'person', mb_hiphop: 'person', mb_country: 'person',
  mb_pop: 'person', mb_rnb: 'person',
}

// Min sitelinks for an anchor to qualify as a valid start/end node
const ANCHOR_SITELINKS_MIN: Record<string, number> = {
  easy: 30, medium: 15, hard: 5,
}

const WIKIDATA_PROPERTIES = `
Common Wikidata properties that produce interesting puzzle bridges:
P19: place of birth | P20: place of death | P27: country of citizenship
P50: author | P57: director | P58: screenwriter | P69: educated at
P86: composer | P106: occupation | P108: employer | P123: publisher
P135: movement | P136: genre | P161: cast member | P166: award received
P170: creator | P175: performer | P176: manufacturer | P178: developer
P179: series | P264: record label | P286: head coach | P400: platform
P413: position played | P495: country of origin | P674: featured character
P737: influenced by | P800: notable work | P840: set in | P915: filming location
P1923: participant (for events/tournaments) | P2012: cuisine
P31: instance of (used in FILTER to restrict types)
`

interface GraphStats {
  totalEntities: number
  typeCounts: Record<string, number>
  anchorCount: number
  validPairsPerDifficulty: Record<string, number>
  topHubs: Array<{ label: string; degree: number; type: string }>
  samplePaths: Array<{ path: string[]; bridgeTypes: string[]; hops: number }>
  intermediateTypeCounts: Record<string, number>  // which types appear as bridges
}

function buildBidirectionalGraph(entities: Entity[]): Record<string, string[]> {
  const graph = buildGraph(entities)
  const bidi: Record<string, string[]> = {}
  for (const [id, neighbors] of Object.entries(graph)) {
    if (!bidi[id]) bidi[id] = []
    for (const n of neighbors) {
      if (!bidi[n]) bidi[n] = []
      if (!bidi[id].includes(n)) bidi[id].push(n)
      if (!bidi[n].includes(id)) bidi[n].push(id)
    }
  }
  return bidi
}

function analyzeGraph(entities: Entity[]): GraphStats {
  const graph = buildBidirectionalGraph(entities)
  const entityMap = new Map(entities.map(e => [e.id, e]))
  const anchorType = ANCHOR_TYPES[domain as string]

  const typeCounts: Record<string, number> = {}
  for (const e of entities) {
    const t = e.entityType ?? 'unknown'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  const anchors = entities.filter(e =>
    (!anchorType || e.entityType === anchorType) && (e.sitelinks ?? 0) >= 10
  )

  // Sample up to 500 random pairs per difficulty to estimate pair density
  const validPairs: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
  const samplePaths: Array<{ path: string[]; bridgeTypes: string[]; hops: number }> = []
  const intermediateTypeCounts: Record<string, number> = {}

  const tried = new Set<string>()
  let attempts = 0

  while (attempts < 2000 && tried.size < 500) {
    attempts++
    const a = anchors[Math.floor(Math.random() * anchors.length)]
    const b = anchors[Math.floor(Math.random() * anchors.length)]
    if (!a || !b || a.id === b.id) continue
    const key = [a.id, b.id].sort().join('|')
    if (tried.has(key)) continue
    tried.add(key)

    const p = findShortestPath(a.id, b.id, graph)
    if (!p) continue
    const hops = p.length - 1
    if (hops >= 4) validPairs['hard']++
    if (hops >= 4 && hops <= 5) validPairs['medium']++
    if (hops === 4) validPairs['easy']++

    if (samplePaths.length < 20 && hops >= 3 && hops <= 6) {
      const pathLabels = p.map(id => entityMap.get(id)?.label ?? id)
      const bridgeTypes = p.slice(1, -1).map(id => entityMap.get(id)?.entityType ?? '?')
      samplePaths.push({ path: pathLabels, bridgeTypes, hops })
      for (const bt of bridgeTypes) {
        intermediateTypeCounts[bt] = (intermediateTypeCounts[bt] ?? 0) + 1
      }
    }
  }

  // Extrapolate: if we sampled `tried.size` pairs and found `validPairs.easy`,
  // the total pairs ≈ (anchors.length^2 / 2) * (validPairs.easy / tried.size)
  const scale = tried.size > 0 ? (anchors.length * anchors.length / 2) / tried.size : 1
  const estimated: Record<string, number> = {}
  for (const diff of ['easy', 'medium', 'hard']) {
    estimated[diff] = Math.round(validPairs[diff] * scale)
  }

  // Top hubs
  const topHubs = entities
    .map(e => ({ label: e.label, degree: (graph[e.id] ?? []).length, type: e.entityType ?? '?' }))
    .filter(e => e.degree >= 10)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 15)

  return {
    totalEntities: entities.length,
    typeCounts,
    anchorCount: anchors.length,
    validPairsPerDifficulty: estimated,
    topHubs,
    samplePaths,
    intermediateTypeCounts,
  }
}

function clearDomainCache(): void {
  const patterns = [
    `${domain}.json`,
    `${domain}-easy.json`,
    `${domain}-medium.json`,
    `${domain}-hard.json`,
  ]
  for (const f of patterns) {
    const p = path.join(CACHE_DIR, f)
    if (fs.existsSync(p)) {
      fs.unlinkSync(p)
      console.log(`  [cache] deleted ${f}`)
    }
  }
}

function readDomainFile(): string {
  const domainName = domain.replace('mb_', '')
  const filePath = path.join(DOMAINS_DIR, `${domainName}.ts`)
  if (!fs.existsSync(filePath)) throw new Error(`Domain file not found: ${filePath}`)
  return fs.readFileSync(filePath, 'utf8')
}

function writeDomainFile(content: string): void {
  const domainName = domain.replace('mb_', '')
  const filePath = path.join(DOMAINS_DIR, `${domainName}.ts`)
  fs.writeFileSync(filePath, content)
  console.log(`  [file] wrote ${filePath}`)
}

function extractNewSubqueries(llmResponse: string): string | null {
  // Look for a TypeScript code block in the response
  const match = llmResponse.match(/```typescript\n([\s\S]*?)\n```/)
    ?? llmResponse.match(/```ts\n([\s\S]*?)\n```/)
    ?? llmResponse.match(/```\n([\s\S]*?)\n```/)
  return match?.[1]?.trim() ?? null
}

function applySubqueriesToDomainFile(domainContent: string, newSubqueries: string): string {
  // Find the closing `]` of the SUBQUERIES array and insert before it
  const closingIdx = domainContent.lastIndexOf(']')
  if (closingIdx === -1) throw new Error('Could not find closing ] in domain file')

  const before = domainContent.slice(0, closingIdx)
  const after = domainContent.slice(closingIdx)

  // Ensure there's a comma after the last existing entry
  const trimmed = before.trimEnd()
  const needsComma = !trimmed.endsWith(',')

  return trimmed + (needsComma ? ',' : '') + '\n  // --- graph-repair-agent additions ---\n  ' + newSubqueries.split('\n').join('\n  ') + '\n' + after
}

async function runRepairIteration(client: OpenAI, iteration: number, stats: GraphStats): Promise<string | null> {
  const anchorType = ANCHOR_TYPES[domain as string] ?? 'entity'
  const domainContent = readDomainFile()

  const statsStr = `
Domain: ${domain}
Anchor type: ${anchorType}
Total entities: ${stats.totalEntities}
Anchor nodes (sitelinks ≥ 10): ${stats.anchorCount}

Entity type distribution:
${Object.entries(stats.typeCounts).sort((a,b) => b[1]-a[1]).map(([t,c]) => `  ${t}: ${c}`).join('\n')}

Estimated valid anchor pairs:
  easy (exactly 4 hops): ${stats.validPairsPerDifficulty['easy']} (target: ${TARGET_ANCHOR_PAIRS})
  medium (4-5 hops): ${stats.validPairsPerDifficulty['medium']}
  hard (4+ hops): ${stats.validPairsPerDifficulty['hard']}

Top hub nodes (most connected — these dominate paths and make puzzles too easy):
${stats.topHubs.map(h => `  ${h.label} [${h.type}] degree=${h.degree}`).join('\n')}

Intermediate node types seen in sampled paths:
${Object.entries(stats.intermediateTypeCounts).sort((a,b)=>b[1]-a[1]).map(([t,c]) => `  ${t}: ${c}`).join('\n')}

Sample paths (first 12):
${stats.samplePaths.slice(0, 12).map((p, i) =>
  `  ${i+1}. [${p.hops} hops] ${p.path.join(' → ')} (bridges: ${p.bridgeTypes.join(', ')})`
).join('\n')}
`

  const missingStr = missingDifficulties.join(', ')

  const prompt = `You are a puzzle graph engineer for RabbitHole, a trivia connection game.

Players trace a path through concept bubbles connecting a Start node to an End node. Both are "${anchorType}" nodes.
A puzzle needs at minimum 4 hops (5 nodes). Puzzles are categorized by difficulty.

PROBLEM: The ${domain} domain is failing to compose puzzles for difficulty: ${missingStr}
The graph needs at least ${TARGET_ANCHOR_PAIRS} valid 4-hop anchor pairs for easy difficulty.
Currently it has approximately ${stats.validPairsPerDifficulty['easy']}.

CURRENT GRAPH STATS:
${statsStr}

CURRENT DOMAIN FILE (pipeline/src/domains/${domain.replace('mb_', '')}.ts):
\`\`\`typescript
${domainContent}
\`\`\`

AVAILABLE WIKIDATA PROPERTIES:
${WIKIDATA_PROPERTIES}

YOUR TASK:
Add 2-4 new sq() subquery calls that will significantly increase the number of valid 4-hop paths between ${anchorType} nodes.

RULES:
1. Each sq() call must follow this exact format:
   sq('difficulty', ['typeA', 'typeB'], (limit) => \`SPARQL...\`, 'edge label'),
2. Choose difficulties that help the failing difficulties: ${missingStr}
3. Avoid hub nodes — don't add properties that connect to ultra-generic nodes like countries, major cities, top-level genres
4. Each new bridge type should feel knowable and interesting to a player (not just a data property)
5. The SPARQL must be valid Wikidata SPARQL with SERVICE wikibase:label
6. Use sitelinks filters to avoid obscure nodes: FILTER(?links > N) where N is appropriate (10-30 typically)
7. Think about what makes a 4-hop path: anchor → bridge1 → bridge2 → bridge3? → anchor. What new intermediate types could serve as bridge1/bridge2?

Respond with ONLY a TypeScript code block containing the new sq() calls (no imports, no exports, just the sq() call expressions separated by commas). Example format:

\`\`\`typescript
sq('easy', ['person', 'other'], (limit) => \`
SELECT DISTINCT ?a ?aLabel ?b ?bLabel ?links WHERE {
  ...
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT \${limit}\`, 'edge label here'),
sq('medium', ['person', 'other'], (limit) => \`
...
\`, 'another edge label'),
\`\`\`

Think carefully about what specific properties will create new multi-hop paths for ${domain} at ${missingStr} difficulty.`

  console.log(`\n  [openai] requesting new subqueries (iteration ${iteration})...`)

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = response.choices[0]?.message?.content ?? ''
  console.log(`  [openai] response received (${responseText.length} chars)`)

  const newSubqueries = extractNewSubqueries(responseText)
  if (!newSubqueries) {
    console.log('  [claude] could not extract subqueries from response')
    console.log('  Response:', responseText.slice(0, 500))
    return null
  }

  console.log(`  [claude] extracted subqueries:\n${newSubqueries.slice(0, 600)}...`)
  return newSubqueries
}

async function run() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`graph-repair-agent: ${domain}`)
  console.log(`Missing difficulties: ${missingDifficulties.join(', ')}`)
  console.log(`Target valid pairs (easy): ${TARGET_ANCHOR_PAIRS}`)
  console.log('='.repeat(60))

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set')
    process.exit(1)
  }

  const client = new OpenAI({ apiKey })

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${MAX_ITERATIONS} ---`)

    // Force-fetch fresh entities — only fetch up to the highest difficulty we need
    // (avoids running expensive hard subqueries like P737 when only easy/medium is missing)
    const highestNeeded = missingDifficulties.includes('hard') ? 'hard'
      : missingDifficulties.includes('medium') ? 'medium' : 'easy'
    console.log(`  Fetching ${domain} entities (force-refresh, maxDifficulty=${highestNeeded})...`)
    clearDomainCache()
    let entities: Entity[]
    try {
      const result = await fetchEntities(domain as any, 1500, highestNeeded as any)
      entities = result.entities
      console.log(`  Fetched ${entities.length} entities`)
    } catch (e: any) {
      console.error(`  Fetch failed: ${e.message}`)
      break
    }

    // Analyze graph
    console.log('  Analyzing graph...')
    const stats = analyzeGraph(entities)
    console.log(`  Anchor pairs — easy: ${stats.validPairsPerDifficulty['easy']}, medium: ${stats.validPairsPerDifficulty['medium']}, hard: ${stats.validPairsPerDifficulty['hard']}`)
    console.log(`  Top hubs: ${stats.topHubs.slice(0, 5).map(h => h.label).join(', ')}`)

    // Check if we've hit the target
    const needingFix = missingDifficulties.filter(d => {
      const pairs = stats.validPairsPerDifficulty[d] ?? 0
      return pairs < TARGET_ANCHOR_PAIRS
    })

    if (needingFix.length === 0) {
      console.log(`\n✓ Graph is healthy! All missing difficulties now have ${TARGET_ANCHOR_PAIRS}+ valid anchor pairs.`)
      console.log(`REPAIR_SUCCESS ${JSON.stringify({ domain, iterations: iteration, stats: stats.validPairsPerDifficulty })}`)
      process.exit(0)
    }

    console.log(`  Still insufficient for: ${needingFix.join(', ')}`)

    if (iteration === MAX_ITERATIONS) {
      console.log('\n⚠ Max iterations reached without hitting target.')
      console.log(`REPAIR_PARTIAL ${JSON.stringify({ domain, iterations: iteration, stats: stats.validPairsPerDifficulty })}`)
      process.exit(1)
    }

    // Ask Claude for new subqueries
    const newSubqueries = await runRepairIteration(client, iteration, stats)
    if (!newSubqueries) {
      console.log('  Skipping iteration — no valid subqueries generated')
      continue
    }

    // Apply to domain file
    try {
      const domainContent = readDomainFile()
      const updated = applySubqueriesToDomainFile(domainContent, newSubqueries)
      writeDomainFile(updated)
      console.log('  Domain file updated.')
    } catch (e: any) {
      console.error(`  Failed to update domain file: ${e.message}`)
      continue
    }
  }

  console.log(`REPAIR_FAILED ${JSON.stringify({ domain, reason: 'exhausted iterations' })}`)
  process.exit(1)
}

run().catch(err => { console.error(err); process.exit(2) })

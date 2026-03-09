/**
 * Diagnose failing puzzle categories.
 * Usage: npx ts-node src/scripts/diagnose-easy.ts
 */
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, findShortestPath, Entity, Graph } from '../graphBuilder'
import { CategoryDomain } from '../wikidata'

const CASES: Array<{ name: string; domain: CategoryDomain; difficulty: 'easy' | 'medium' | 'hard' }> = [
  { name: 'Pop Music',          domain: 'mb_pop',     difficulty: 'easy' },
  { name: 'Mythology',          domain: 'mythology',  difficulty: 'hard' },
  { name: 'Space & Astronomy',  domain: 'space',      difficulty: 'medium' },
]

const SAMPLES = 2000

function avgFamiliarity(path: string[], entityMap: Map<string, Entity>): number {
  const middle = path.slice(1, -1)
  const vals = middle.map(id => {
    const e = entityMap.get(id)
    if (!e) return 0
    return e.pageviews !== undefined ? e.pageviews / 3000 : (e.sitelinks ?? 0)
  }).filter(v => v > 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

function classifyPath(path: string[], entityMap: Map<string, Entity>): string {
  const hops = path.length - 1
  const avg = avgFamiliarity(path, entityMap)
  const familiar = avg > 150
  const obscure30 = avg < 30 || avg === 0
  const obscure60 = avg < 60 || avg === 0

  if (hops >= 6) return 'hard'
  if (hops === 5 && (obscure60)) return 'hard(obscure)'
  if (hops === 5) return 'medium'
  if (hops === 4 && familiar) return 'easy'
  if (hops === 4 && !obscure60) return 'easy'
  if (hops === 4 && !obscure30) return 'easy(relaxed)'
  if (hops === 3) return 'easy(3hop)'
  return `medium(avg=${avg.toFixed(0)})`
}

async function diagnose(name: string, domain: CategoryDomain, targetDifficulty: string) {
  console.log(`\n=== ${name} / ${targetDifficulty} ===`)
  const { entities } = await fetchEntitiesCached(domain)
  const graph = buildGraph(entities)
  const entityMap = new Map(entities.map(e => [e.id, e]))

  const entityIds = entities
    .filter(e => e.relatedIds.length >= 2 && e.label.length <= 30)
    .map(e => e.id)

  console.log(`Entities: ${entities.length}, eligible anchors: ${entityIds.length}`)

  const classified: Record<string, number> = {}
  let noPath = 0

  for (let i = 0; i < SAMPLES; i++) {
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue

    const path = findShortestPath(startId, endId, graph)
    if (!path) { noPath++; continue }

    const label = classifyPath(path, entityMap)
    classified[label] = (classified[label] ?? 0) + 1
  }

  const sorted = Object.entries(classified).sort(([, a], [, b]) => b - a)
  console.log(`Path classifications over ${SAMPLES} samples (no path: ${noPath}):`)
  for (const [label, count] of sorted) {
    const pct = (count / SAMPLES * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(count / SAMPLES * 50))
    console.log(`  ${label.padEnd(22)} ${String(count).padStart(4)} (${pct}%) ${bar}`)
  }
}

async function main() {
  for (const c of CASES) {
    await diagnose(c.name, c.domain, c.difficulty)
  }
}

main().catch(console.error)

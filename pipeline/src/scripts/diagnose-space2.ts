/**
 * Space path length distribution — what fraction of reachable pairs are each hop count?
 */
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, findShortestPath } from '../graphBuilder'

async function main() {
  const { entities } = await fetchEntitiesCached('space')
  const graph = buildGraph(entities)
  const entityIds = entities.filter(e => e.relatedIds.length >= 2 && e.label.length <= 30).map(e => e.id)

  const dist: Record<number, number> = {}
  let noPath = 0
  const N = 3000

  for (let i = 0; i < N; i++) {
    const s = entityIds[Math.floor(Math.random() * entityIds.length)]
    const e = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (s === e) continue
    const path = findShortestPath(s, e, graph)
    if (!path) { noPath++; continue }
    const hops = path.length - 1
    dist[hops] = (dist[hops] ?? 0) + 1
  }

  console.log(`Path hop distribution (${N} samples, no path: ${noPath}):`)
  for (const [hops, count] of Object.entries(dist).sort(([a],[b]) => Number(a)-Number(b))) {
    const pct = (count / N * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(count / N * 60))
    console.log(`  ${hops} hops: ${String(count).padStart(4)} (${pct}%) ${bar}`)
  }
}
main().catch(console.error)

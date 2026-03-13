import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'

async function main() {
  const LIMIT = parseInt(process.argv[2] ?? '500')
  const forceRefresh = process.argv.includes('--force')
  console.log(`\nFetching videogames entities with limit=${LIMIT}${forceRefresh ? ' (force-refresh)' : ''}...`)
  const { entities } = await fetchEntitiesCached('videogames', LIMIT, { forceRefresh })

  console.log(`Total entities: ${entities.length}`)
  const byType: Record<string, number> = {}
  for (const e of entities) {
    const t = e.entityType ?? 'unknown'
    byType[t] = (byType[t] || 0) + 1
  }
  console.log('By type:', JSON.stringify(byType))

  // Build bidirectional graph
  const graph = buildGraph(entities)
  for (const [id, neighbors] of Object.entries(graph)) {
    for (const n of neighbors) {
      if (!graph[n]) graph[n] = []
      if (!(graph[n] as string[]).includes(id)) (graph[n] as string[]).push(id)
    }
  }

  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))
  const gameList = [...gameIds]
  const nameMap = new Map(entities.map(e => [e.id, e.label]))

  // Count game connectivity
  const gameConnectivity = gameList.map(id => ({
    id, label: nameMap.get(id)!, neighbors: (graph[id] ?? []).length
  })).sort((a, b) => b.neighbors - a.neighbors)

  console.log(`\nGame nodes: ${gameList.length}`)
  console.log('Top 10 most connected games:')
  gameConnectivity.slice(0, 10).forEach(g => console.log(`  ${g.label}: ${g.neighbors} neighbors`))

  // Sample valid 4-hop paths (check up to 2000 pairs for speed)
  let exactlyOnePath = 0
  let zeroPaths = 0
  let multiPaths = 0
  const samplePaths: string[] = []

  function findPaths4Hop(startId: string, endId: string): string[][] {
    const results: string[][] = []
    const queue: string[][] = [[startId]]
    while (queue.length > 0) {
      const path = queue.shift()!
      if (path.length === 5) {
        if (path[4] === endId) results.push(path)
        continue
      }
      const last = path[path.length - 1]
      for (const n of graph[last] ?? []) {
        if (path.includes(n)) continue
        // Middle nodes (positions 1, 2, 3) must not be games
        if (path.length < 4 && gameIds.has(n)) continue
        // Position 4 must be endId (a game)
        if (path.length === 4 && n !== endId) continue
        queue.push([...path, n])
      }
    }
    return results
  }

  const totalPairs = gameList.length * (gameList.length - 1) / 2
  const pairsToCheck = Math.min(totalPairs, 2000)
  let checked = 0
  outer: for (let i = 0; i < gameList.length; i++) {
    for (let j = i + 1; j < gameList.length; j++) {
      if (checked >= pairsToCheck) break outer
      checked++
      const paths = findPaths4Hop(gameList[i], gameList[j])
      if (paths.length === 0) zeroPaths++
      else if (paths.length === 1) {
        exactlyOnePath++
        if (samplePaths.length < 5) {
          const labels = paths[0].map(id => nameMap.get(id) ?? id)
          samplePaths.push(labels.join(' → '))
        }
      } else multiPaths++
    }
  }

  const total = exactlyOnePath + zeroPaths + multiPaths
  console.log(`\nPairs checked: ${checked} of ${totalPairs} total`)
  console.log(`Exactly 1 path (Easy candidates): ${exactlyOnePath} (${(exactlyOnePath / total * 100).toFixed(1)}%)`)
  console.log(`0 paths: ${zeroPaths}`)
  console.log(`2+ paths (Medium/Hard candidates): ${multiPaths}`)

  if (totalPairs > pairsToCheck) {
    const scaleFactor = totalPairs / pairsToCheck
    console.log(`Estimated total Easy puzzles (scaled): ~${Math.round(exactlyOnePath * scaleFactor)}`)
  }

  console.log('\nSample Easy paths:')
  samplePaths.forEach(p => console.log(' ', p))
}

main().catch(console.error)

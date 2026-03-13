import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, Entity } from '../graphBuilder'

async function main() {
  console.log('Fetching videogames entities with limit=2000...')
  const { entities } = await fetchEntitiesCached('videogames', 2000)

  console.log(`Total entities: ${entities.length}`)
  const byType: Record<string, number> = {}
  for (const e of entities) {
    const t = e.entityType ?? 'unknown'
    byType[t] = (byType[t] || 0) + 1
  }
  console.log('By type:', JSON.stringify(byType))

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

  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))
  const gameList = [...gameIds]
  const nameMap = new Map(entities.map(e => [e.id, e.label]))

  console.log(`\nGame nodes: ${gameList.length}`)
  console.log(`Total pairs: ${gameList.length * (gameList.length - 1) / 2}`)

  // BFS to find shortest path between two nodes
  // Middle nodes must NOT be games (only start/end are games)
  function shortestPath(startId: string, endId: string, maxHops: number): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      if (last === endId && path.length >= 3) return path
      if (path.length - 1 >= maxHops) continue
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        // Middle nodes cannot be games
        if (n !== endId && gameIds.has(n)) continue
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  let validPairs = 0
  let zeroPairs = 0
  const hopDistribution: Record<number, number> = {}
  const samplePaths: Array<{path: string[], labels: string[]}> = []

  // Check up to 3000 pairs for speed
  const MAX_PAIRS = 3000
  let checked = 0

  outer: for (let i = 0; i < gameList.length; i++) {
    for (let j = i + 1; j < gameList.length; j++) {
      if (checked >= MAX_PAIRS) break outer
      checked++

      const path = shortestPath(gameList[i], gameList[j], 6)
      if (!path) {
        zeroPairs++
      } else {
        validPairs++
        const hops = path.length - 1
        hopDistribution[hops] = (hopDistribution[hops] || 0) + 1
        if (samplePaths.length < 30) {
          samplePaths.push({
            path,
            labels: path.map(id => nameMap.get(id) ?? id)
          })
        }
      }
    }
  }

  const total = validPairs + zeroPairs
  const pct = (validPairs / total * 100).toFixed(1)
  const totalPairs = gameList.length * (gameList.length - 1) / 2
  const scaleFactor = totalPairs / checked

  console.log(`\nPairs checked: ${checked}`)
  console.log(`Valid pairs (has path): ${validPairs} (${pct}%)`)
  console.log(`No path: ${zeroPairs}`)
  console.log(`Hop distribution:`, JSON.stringify(hopDistribution))
  console.log(`\nEstimated total valid puzzles: ~${Math.round(validPairs * scaleFactor)}`)
  console.log(`(scaled from ${checked} sample to ${totalPairs} total pairs)`)

  console.log(`\n=== 30 SAMPLE OPTIMAL PATHS ===`)
  for (const s of samplePaths) {
    console.log(s.labels.join(' → '))
  }
}

main().catch(console.error)

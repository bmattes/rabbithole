import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'

const ALWAYS_BLOCK_LABELS = new Set([
  'United States', 'Japan', 'France', 'Germany', 'Italy', 'Spain', 'Russia',
  'United Kingdom', 'New York City', 'London', 'Paris',
])

async function main() {
  console.log('Fetching videogames entities with limit=2000...')
  const { entities } = await fetchEntitiesCached('videogames', 2000)

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
  const entityMap = new Map(entities.map(e => [e.id, e]))

  function isAllowedBridge(id: string): boolean {
    if (gameIds.has(id)) return false
    const e = entityMap.get(id)
    if (!e) return false
    if (ALWAYS_BLOCK_LABELS.has(e.label)) return false
    const gameDegree = (graph[id] ?? []).filter(n => gameIds.has(n)).length
    return gameDegree <= 15
  }

  // Print bridge pool summary
  const bridges = entities.filter(e => isAllowedBridge(e.id))
  const byType: Record<string, number> = {}
  for (const e of bridges) {
    const t = e.entityType ?? 'unknown'
    byType[t] = (byType[t] || 0) + 1
  }
  console.log(`\nBridge pool: ${bridges.length} nodes`)
  console.log('By type:', JSON.stringify(byType))

  // Show what got blocked by degree cap
  const blocked = entities.filter(e => {
    if (gameIds.has(e.id)) return false
    const gameDegree = (graph[e.id] ?? []).filter(n => gameIds.has(n)).length
    return gameDegree > 15 || ALWAYS_BLOCK_LABELS.has(e.label)
  })
  console.log(`\nBlocked nodes (${blocked.length}):`, blocked.map(e => `${e.label}(${(graph[e.id]??[]).filter(n=>gameIds.has(n)).length}g)`).join(', '))

  // BFS: shortest path 4-6 hops
  function shortestPath(startId: string, endId: string): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      if (last === endId && path.length >= 5) return path
      if (path.length > 7) continue
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        if (n === endId) {
          if (path.length >= 4) { visited.add(n); queue.push([...path, n]) }
          continue
        }
        if (!isAllowedBridge(n)) continue
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  let validPairs = 0
  let zeroPairs = 0
  const hopDist: Record<number, number> = {}
  const samplePaths: Array<{path: string, types: string}> = []

  const MAX_PAIRS = 5000
  let checked = 0

  outer: for (let i = 0; i < gameList.length; i++) {
    for (let j = i + 1; j < gameList.length; j++) {
      if (checked >= MAX_PAIRS) break outer
      checked++
      const path = shortestPath(gameList[i], gameList[j])
      if (!path) { zeroPairs++; continue }
      validPairs++
      const hops = path.length - 1
      hopDist[hops] = (hopDist[hops] || 0) + 1
      if (samplePaths.length < 40) {
        const labels = path.map(id => nameMap.get(id) ?? id).join(' → ')
        const types = path.map(id => {
          if (gameIds.has(id)) return 'game'
          return entityMap.get(id)?.entityType ?? '?'
        }).join(' → ')
        samplePaths.push({ path: labels, types })
      }
    }
  }

  const totalPairs = gameList.length * (gameList.length - 1) / 2
  const scaleFactor = totalPairs / checked

  console.log(`\nGame nodes: ${gameList.length}`)
  console.log(`Pairs checked: ${checked}`)
  console.log(`Valid: ${validPairs} (${(validPairs/(validPairs+zeroPairs)*100).toFixed(1)}%)`)
  console.log(`Hop distribution:`, JSON.stringify(hopDist))
  console.log(`Estimated total valid puzzles: ~${Math.round(validPairs * scaleFactor)}`)

  console.log(`\n=== 40 SAMPLE PATHS ===`)
  samplePaths.forEach(s => {
    console.log(s.path)
    console.log('  types:', s.types)
    console.log()
  })
}

main().catch(console.error)

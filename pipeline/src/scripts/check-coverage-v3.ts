import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'

const MEGA_HUB_LABELS = new Set([
  'Microsoft', 'Sony', 'Sony Interactive Entertainment', 'Nintendo',
  'Electronic Arts', 'EA', 'Activision', 'Activision Blizzard',
  'Ubisoft', 'Take-Two Interactive', 'Tencent', '2K', 'THQ',
  'Sega', 'Namco', 'Bandai Namco', 'Atari', 'Square Enix',
  'Konami', 'Capcom', 'Bethesda Softworks', 'Bethesda',
  'Warner Bros. Games', 'Warner Bros. Interactive Entertainment',
  'Xbox Game Studios', 'PlayStation Studios',
])

async function main() {
  console.log('Fetching videogames entities with limit=2000...')
  const { entities } = await fetchEntitiesCached('videogames', 2000)

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

  // Build blocklist: mega-hub labels + any node connecting to >8 games
  const blockedIds = new Set<string>()
  for (const e of entities) {
    if (gameIds.has(e.id)) continue
    if (MEGA_HUB_LABELS.has(e.label)) {
      blockedIds.add(e.id)
      continue
    }
    const gameNeighbors = (graph[e.id] ?? []).filter(n => gameIds.has(n)).length
    if (gameNeighbors > 8) {
      blockedIds.add(e.id)
    }
  }

  console.log(`Blocked hub nodes: ${blockedIds.size}`)
  console.log('Sample blocked nodes:', [...blockedIds].slice(0, 15).map(id => nameMap.get(id)).join(', '))

  // BFS to find shortest path, never routing through blocked nodes
  function shortestPath(startId: string, endId: string, maxHops: number): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      if (last === endId && path.length >= 5) return path  // min 4 hops
      if (path.length - 1 >= maxHops) continue
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        // Never route through blocked hub nodes
        if (blockedIds.has(n)) continue
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
  const samplePaths: string[] = []

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
        if (samplePaths.length < 40) {
          samplePaths.push(path.map(id => nameMap.get(id) ?? id).join(' → '))
        }
      }
    }
  }

  const total = validPairs + zeroPairs
  const totalPairs = gameList.length * (gameList.length - 1) / 2
  const scaleFactor = totalPairs / checked

  console.log(`\nGame nodes: ${gameList.length}`)
  console.log(`Pairs checked: ${checked}`)
  console.log(`Valid pairs: ${validPairs} (${(validPairs/total*100).toFixed(1)}%)`)
  console.log(`Hop distribution:`, JSON.stringify(hopDistribution))
  console.log(`Estimated total valid puzzles: ~${Math.round(validPairs * scaleFactor)}`)

  console.log(`\n=== 40 SAMPLE PATHS (hub-stripped) ===`)
  samplePaths.forEach(p => console.log(p))
}

main().catch(console.error)

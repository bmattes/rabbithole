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

  // Diagnostic: top 40 non-game nodes by game connections
  const nonGameNodes = entities.filter(e => !gameIds.has(e.id))
  const withDegree = nonGameNodes.map(e => ({
    id: e.id,
    label: e.label,
    type: e.entityType ?? 'unknown',
    sitelinks: e.sitelinks ?? 0,
    gameDegree: (graph[e.id] ?? []).filter(n => gameIds.has(n)).length,
    totalDegree: (graph[e.id] ?? []).length,
  })).sort((a, b) => b.gameDegree - a.gameDegree)

  console.log('\n=== TOP 40 NON-GAME NODES BY GAME CONNECTIONS ===')
  withDegree.slice(0, 40).forEach(n =>
    console.log(`${n.label} [${n.type}, ${n.sitelinks}sl] — ${n.gameDegree} game neighbors`)
  )

  // Build blocklist: only explicit mega-hub labels
  const blockedIds = new Set<string>()
  for (const e of entities) {
    if (MEGA_HUB_LABELS.has(e.label)) blockedIds.add(e.id)
  }
  console.log(`\nBlocked ${blockedIds.size} mega-hub nodes:`, [...blockedIds].map(id => nameMap.get(id)).join(', '))

  // BFS: shortest path of 4-6 hops, no mega-hubs, no game middle nodes
  function shortestPath(startId: string, endId: string): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      if (last === endId && path.length >= 5) return path  // min 4 hops
      if (path.length > 7) continue  // max 6 hops
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        if (blockedIds.has(n)) continue
        if (n !== endId && gameIds.has(n)) continue
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  let validPairs = 0
  let zeroPairs = 0
  const hopDist: Record<number, number> = {}
  const samplePaths: string[] = []

  const MAX_PAIRS = 3000
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
        samplePaths.push(path.map(id => nameMap.get(id) ?? id).join(' → '))
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
  samplePaths.forEach(p => console.log(p))
}

main().catch(console.error)

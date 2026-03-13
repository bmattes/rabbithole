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
  // Character hubs - too many games
  'Mario', 'Luigi', 'Sonic the Hedgehog', 'Pikachu',
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

  // Round 1 allowed bridge types: series, character (person type = fictional), location (real-world, high sitelinks)
  // company nodes are NOT allowed in Round 1
  function isAllowedBridge(id: string): boolean {
    const e = entityMap.get(id)
    if (!e) return false
    if (gameIds.has(id)) return false  // games are anchors only
    if (MEGA_HUB_LABELS.has(e.label)) return false

    const type = e.entityType ?? 'unknown'
    const sitelinks = e.sitelinks ?? 0

    // Round 1: only series, characters, and high-sitelinks real locations
    if (type === 'series') return true
    if (type === 'person') return true  // characters (P674 brings in fictional persons)
    if (type === 'location') return sitelinks >= 30  // real-world only (fictional worlds have low sitelinks)
    // company, unknown, other types: NOT in Round 1
    return false
  }

  // Print what's in Round 1 bridge pool
  const bridgePool = entities.filter(e => isAllowedBridge(e.id))
  const byType: Record<string, number> = {}
  for (const e of bridgePool) {
    const t = e.entityType ?? 'unknown'
    byType[t] = (byType[t] || 0) + 1
  }
  console.log(`\nRound 1 bridge pool: ${bridgePool.length} nodes`)
  console.log('By type:', JSON.stringify(byType))
  console.log('Sample bridges:', bridgePool.slice(0, 20).map(e => `${e.label}[${e.entityType}]`).join(', '))

  // === BIPARTITE STRUCTURE DIAGNOSTIC ===
  // Check whether any allowed bridge connects to another allowed bridge
  // (if not, the graph is strictly bipartite game↔bridge with max 2-hop game-to-game paths)
  const bridgeIds = new Set(bridgePool.map(e => e.id))
  let bridgeToBridgeEdges = 0
  const bridgeToBridgeExamples: string[] = []
  for (const b of bridgePool) {
    for (const n of graph[b.id] ?? []) {
      if (bridgeIds.has(n)) {
        bridgeToBridgeEdges++
        if (bridgeToBridgeExamples.length < 5) {
          bridgeToBridgeExamples.push(`${b.label}[${b.entityType}] ↔ ${nameMap.get(n) ?? n}[${entityMap.get(n)?.entityType}]`)
        }
      }
    }
  }
  console.log(`\n=== BIPARTITE DIAGNOSTIC ===`)
  console.log(`Bridge-to-bridge edges (Round 1 only): ${bridgeToBridgeEdges}`)
  if (bridgeToBridgeExamples.length > 0) {
    console.log('Examples:', bridgeToBridgeExamples.join(', '))
  } else {
    console.log('NONE — graph is strictly bipartite (game↔bridge only)')
    console.log('Max reachable game-to-game path via Round 1 bridges: 2 hops (game→bridge→game)')
    console.log('This means 4-hop minimum cannot be met with Round 1 bridges alone.')
  }

  // Also check what entity types actually connect to other entity types
  const typePairCounts: Record<string, number> = {}
  for (const e of entities) {
    for (const nId of graph[e.id] ?? []) {
      const nType = entityMap.get(nId)?.entityType ?? 'unknown'
      const key = `${e.entityType ?? 'unknown'} → ${nType}`
      typePairCounts[key] = (typePairCounts[key] || 0) + 1
    }
  }
  console.log('\nAll edge type pairs in this graph (counts):')
  Object.entries(typePairCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`))

  // === RELAXED BFS: find shortest path regardless of hop minimum ===
  // This reveals how short paths actually are (to understand why 4-hop minimum fails)
  function shortestPathAny(startId: string, endId: string): string[] | null {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])
    while (queue.length > 0) {
      const path = queue.shift()!
      const last = path[path.length - 1]
      if (last === endId) return path
      if (path.length > 9) continue  // max 8 hops
      for (const n of graph[last] ?? []) {
        if (visited.has(n)) continue
        if (n === endId) { visited.add(n); queue.push([...path, n]); continue }
        if (!isAllowedBridge(n)) continue
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  // BFS: shortest path of exactly 4-6 hops using only allowed bridge types
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
        if (n === endId) {
          // Only accept end node if we've taken at least 4 hops
          if (path.length >= 4) {
            visited.add(n)
            queue.push([...path, n])
          }
          continue
        }
        if (!isAllowedBridge(n)) continue
        visited.add(n)
        queue.push([...path, n])
      }
    }
    return null
  }

  // Relaxed coverage check (any hop count) to understand connectivity
  let relaxedValid = 0
  let relaxedZero = 0
  const relaxedHopDist: Record<number, number> = {}
  const relaxedSamplePaths: string[] = []
  const MAX_RELAXED = 500
  let relaxedChecked = 0
  outer2: for (let i = 0; i < gameList.length; i++) {
    for (let j = i + 1; j < gameList.length; j++) {
      if (relaxedChecked >= MAX_RELAXED) break outer2
      relaxedChecked++
      const path = shortestPathAny(gameList[i], gameList[j])
      if (!path) { relaxedZero++; continue }
      relaxedValid++
      const hops = path.length - 1
      relaxedHopDist[hops] = (relaxedHopDist[hops] || 0) + 1
      if (relaxedSamplePaths.length < 20) {
        relaxedSamplePaths.push(path.map(id => nameMap.get(id) ?? id).join(' → '))
      }
    }
  }
  console.log(`\n=== RELAXED BFS (any hop count, first ${MAX_RELAXED} pairs) ===`)
  console.log(`Connected: ${relaxedValid}/${relaxedChecked} (${(relaxedValid/relaxedChecked*100).toFixed(1)}%)`)
  console.log(`Hop distribution:`, JSON.stringify(relaxedHopDist))
  console.log('Sample paths (any length):')
  relaxedSamplePaths.forEach(p => console.log(' ', p))

  // Full 4-6 hop coverage check
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

  console.log(`\n=== STRICT BFS (4–6 hops, ${MAX_PAIRS} pairs) ===`)
  console.log(`Game nodes: ${gameList.length}`)
  console.log(`Pairs checked: ${checked}`)
  console.log(`Valid: ${validPairs} (${(validPairs/(validPairs+zeroPairs)*100).toFixed(1)}%)`)
  console.log(`Hop distribution:`, JSON.stringify(hopDist))
  console.log(`Estimated total valid puzzles: ~${Math.round(validPairs * scaleFactor)}`)

  console.log(`\n=== SAMPLE PATHS (Round 1 bridges only, 4–6 hops) ===`)
  samplePaths.forEach(p => console.log(p))
}

main().catch(console.error)

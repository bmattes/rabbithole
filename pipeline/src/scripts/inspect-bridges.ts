import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, Entity } from '../graphBuilder'

async function main() {
  const { entities } = await fetchEntitiesCached('videogames', 2000)
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
  const entityMap = new Map<string, Entity>(entities.map(e => [e.id, e]))
  const gameIds = new Set(entities.filter(e => e.entityType === 'game').map(e => e.id))

  const persons = entities.filter(e => e.entityType === 'person' && (e.sitelinks ?? 0) > 10)
    .sort((a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0))
  console.log(`Notable persons (>10sl): ${persons.length}`)
  for (const p of persons.slice(0, 15)) {
    const neighbors = graph[p.id] ?? []
    const gameNeighbors = (neighbors as string[]).filter(n => gameIds.has(n))
    const gameNames = gameNeighbors.slice(0, 3).map(id => entityMap.get(id)?.label ?? id)
    console.log(`  ${p.label} (${p.sitelinks}sl): ${gameNeighbors.length} games — ${gameNames.join(', ')}`)
  }

  const locations = entities.filter(e => e.entityType === 'location' && (e.sitelinks ?? 0) > 10)
    .sort((a, b) => (b.sitelinks ?? 0) - (a.sitelinks ?? 0))
  console.log(`\nNotable locations (>10sl): ${locations.length}`)
  for (const loc of locations.slice(0, 10)) {
    const neighbors = graph[loc.id] ?? []
    const gameNeighbors = (neighbors as string[]).filter(n => gameIds.has(n))
    const gameNames = gameNeighbors.slice(0, 3).map(id => entityMap.get(id)?.label ?? id)
    console.log(`  ${loc.label} (${loc.sitelinks}sl): ${gameNeighbors.length} games — ${gameNames.join(', ')}`)
  }

  // Check if persons connect to anything other than games
  console.log('\nPerson bridge connectivity (do they connect to non-game nodes?):')
  for (const p of persons.slice(0, 10)) {
    const neighbors = (graph[p.id] ?? []) as string[]
    const nonGame = neighbors.filter(n => !gameIds.has(n))
    const nonGameTypes = nonGame.map(id => entityMap.get(id)?.entityType ?? '?')
    const typeCounts: Record<string, number> = {}
    for (const t of nonGameTypes) typeCounts[t] = (typeCounts[t] ?? 0) + 1
    console.log(`  ${p.label}: games=${neighbors.filter(n => gameIds.has(n)).length} non-game=${JSON.stringify(typeCounts)}`)
  }
}

main().catch(console.error)

import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'

async function main() {
  const { entities } = await fetchEntitiesCached('videogames', 300)
  const graph = buildGraph(entities)
  for (const [id, neighbors] of Object.entries(graph)) {
    const e = entities.find(e => e.id === id)!
    if (!e) continue
    const ns = neighbors.map(n => entities.find(e => e.id === n)?.label || n)
    console.log(`${e.label}: [${ns.join(', ')}]`)
  }
}
main().catch(console.error)

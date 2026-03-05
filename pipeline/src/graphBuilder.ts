export interface Entity {
  id: string
  label: string
  relatedIds: string[]
}

export type Graph = Record<string, string[]>

export function buildGraph(entities: Entity[]): Graph {
  const graph: Graph = {}
  for (const entity of entities) {
    graph[entity.id] = entity.relatedIds
  }
  return graph
}

export function findShortestPath(
  startId: string,
  endId: string,
  graph: Graph
): string[] | null {
  const queue: string[][] = [[startId]]
  const visited = new Set<string>([startId])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]

    if (current === endId) return path

    for (const neighbor of graph[current] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }

  return null
}

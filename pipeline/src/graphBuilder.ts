export interface Entity {
  id: string
  label: string
  relatedIds: string[]
  sitelinks?: number
  pageviews?: number  // monthly Wikipedia pageviews — better popularity signal than sitelinks
  // 'person' | 'team' | 'city' | 'film' | 'song' | 'label' | 'category' | 'other'
  entityType?: string
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
  graph: Graph,
  /**
   * Optional filter for intermediate nodes. When provided, a node can only
   * appear in the middle of the path if this function returns true.
   * Start and end nodes are never filtered.
   *
   * Example: restrict intermediates to non-anchor types, but allow anchor-type
   * nodes once an "interesting" bridge (person, location, genre, platform) has
   * already appeared in the path.
   */
  intermediateFilter?: (nodeId: string, pathSoFar: string[]) => boolean,
): string[] | null {
  const queue: string[][] = [[startId]]
  const visited = new Set<string>([startId])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]

    if (current === endId) return path

    for (const neighbor of graph[current] ?? []) {
      if (visited.has(neighbor)) continue
      if (neighbor !== endId && intermediateFilter && !intermediateFilter(neighbor, path)) continue
      visited.add(neighbor)
      queue.push([...path, neighbor])
    }
  }

  return null
}

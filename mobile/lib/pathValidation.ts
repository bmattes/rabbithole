export function validatePath(
  path: string[],
  connections: Record<string, string[]>
): boolean {
  return findBreakPoints(path, connections).length === 0
}

export function findBreakPoints(
  path: string[],
  connections: Record<string, string[]>
): number[] {
  const breaks: number[] = []
  const breakSet = new Set<number>()

  for (let i = 1; i < path.length; i++) {
    // If the previous node was itself a break point, skip — can't chain from invalid
    if (breakSet.has(i - 1)) continue

    const prev = path[i - 1]
    const curr = path[i]
    const neighbors = connections[prev] ?? []
    if (!neighbors.includes(curr)) {
      breaks.push(i)
      breakSet.add(i)
    }
  }
  return breaks
}

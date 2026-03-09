/**
 * Simulate composePuzzle for Space medium to find why trimmed graph collapses paths.
 * Usage: npx ts-node src/scripts/diagnose-space.ts
 */
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph, findShortestPath, Entity, Graph } from '../graphBuilder'

const SAMPLES = 500

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function main() {
  const { entities } = await fetchEntitiesCached('space')
  const graph = buildGraph(entities)
  const entityMap = new Map(entities.map(e => [e.id, e]))

  const entityIds = entities
    .filter(e => e.relatedIds.length >= 2 && e.label.length <= 30)
    .map(e => e.id)

  console.log(`Entities: ${entities.length}, eligible anchors: ${entityIds.length}`)

  // Track why each raw medium path (5 hops, length 6) gets rejected
  const reasons: Record<string, number> = {}
  let rawMediumFound = 0

  for (let i = 0; i < SAMPLES * 10 && rawMediumFound < SAMPLES; i++) {
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue

    const optimalPath = findShortestPath(startId, endId, graph)
    if (!optimalPath) continue

    const hops = optimalPath.length - 1
    // Only look at raw 5-hop paths (which should classify medium)
    if (hops !== 5) continue
    rawMediumFound++

    // Simulate composePuzzle bubble building
    const hasGoodLabel = (id: string) => {
      const label = entityMap.get(id)?.label ?? ''
      return label.length > 0 && label.length <= 35
    }

    const candidateIds = new Set<string>(optimalPath.filter(hasGoodLabel))
    candidateIds.add(optimalPath[0])
    candidateIds.add(optimalPath[optimalPath.length - 1])

    for (const id of optimalPath) {
      const neighbors = shuffle(graph[id] ?? [])
      for (const n of neighbors.slice(0, 4)) {
        if (hasGoodLabel(n)) candidateIds.add(n)
      }
    }

    const allEntityIds = shuffle(entities.map(e => e.id).filter(id => !candidateIds.has(id)))
    const orphans = allEntityIds.slice(0, 2)
    const otherCandidates = Array.from(candidateIds).filter(id => id !== startId && id !== endId)
    const middleIds = [...otherCandidates.slice(0, 8), ...orphans]
    const allBubbleIds = [startId, ...middleIds, endId]

    const bubbleSet = new Set(allBubbleIds)
    const connections: Record<string, string[]> = {}
    for (const id of allBubbleIds) {
      connections[id] = (graph[id] ?? []).filter(n => bubbleSet.has(n))
      if (orphans.includes(id)) connections[id] = []
    }

    const trimmedPath = findShortestPath(startId, endId, connections) ?? optimalPath
    const trimmedHops = trimmedPath.length - 1

    if (trimmedHops < trimmedPath.length - 1) {
      // shouldn't happen
    }

    if (trimmedHops < 4) {
      reasons[`collapsed to ${trimmedHops} hops`] = (reasons[`collapsed to ${trimmedHops} hops`] ?? 0) + 1
    } else if (trimmedHops !== hops) {
      reasons[`changed hops: ${hops}→${trimmedHops}`] = (reasons[`changed hops: ${hops}→${trimmedHops}`] ?? 0) + 1
    } else {
      // Would pass — check familiarity
      const avg = trimmedPath.slice(1, -1).map(id => {
        const e = entityMap.get(id)
        if (!e) return 0
        return e.pageviews !== undefined ? e.pageviews / 3000 : (e.sitelinks ?? 0)
      }).filter(v => v > 0).reduce((a, b, _, arr) => a + b / arr.length, 0)
      const obscure = avg < 60 || avg === 0
      if (trimmedHops === 5 && obscure) {
        reasons[`5-hop obscure→hard (avg=${avg.toFixed(0)})`] = (reasons[`5-hop obscure→hard (avg=${avg.toFixed(0)})`] ?? 0) + 1
      } else {
        reasons[`would publish as medium (avg=${avg.toFixed(0)})`] = (reasons[`would publish as medium (avg=${avg.toFixed(0)})`] ?? 0) + 1
      }
    }
  }

  console.log(`\nOf ${rawMediumFound} raw 5-hop paths sampled:`)
  for (const [reason, count] of Object.entries(reasons).sort(([,a],[,b]) => b-a)) {
    console.log(`  ${String(count).padStart(4)}  ${reason}`)
  }
}

main().catch(console.error)

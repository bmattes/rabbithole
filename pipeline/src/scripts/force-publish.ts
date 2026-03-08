/**
 * force-publish.ts — compose and publish the best available puzzle for a specific domain/difficulty
 * even if QC score is below 7. Used as a last resort for structurally difficult domains.
 */
import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
import { CategoryDomain, SubqueryDifficulty } from '../wikidata'
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'
import { composePuzzleForDifficulty, scorePathQuality, Difficulty } from '../puzzleComposer'
import { generateNarrative } from '../narrativeGenerator'
import { evaluatePuzzle, CONNECTION_TYPES } from '../puzzleQC'
import { readDomainOverrides } from '../domainConfig'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const domainArg = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--domain') + 1]
const diffArg = process.argv.find(a => a.startsWith('--difficulty='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--difficulty') + 1]
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))

if (!domainArg || !diffArg || !dateArg) {
  console.error('Usage: npx ts-node src/scripts/force-publish.ts --domain <d> --difficulty <easy|medium|hard> <YYYY-MM-DD>')
  process.exit(1)
}

const domain = domainArg as CategoryDomain
const difficulty = diffArg as Difficulty
const date = dateArg

const UNGUESSABLE_TYPES = new Set(['office', 'field', 'category'])
const DIFFICULTY_TO_MAX_SUBQUERY: Record<Difficulty, SubqueryDifficulty> = { easy: 'easy', medium: 'medium', hard: 'hard' }

function filterEntities(entities: any[]): any[] {
  const isBad = (e: any) => UNGUESSABLE_TYPES.has(e.entityType) || /^Q\d+$/.test(e.label ?? '')
  const badIds = new Set(entities.filter(isBad).map((e: any) => e.id))
  if (badIds.size === 0) return entities
  return entities.filter((e: any) => !isBad(e)).map((e: any) => ({ ...e, relatedIds: e.relatedIds.filter((id: string) => !badIds.has(id)) }))
}

;(async () => {
  const { data: cats } = await sb.from('categories').select('id').eq('wikidata_domain', domain).eq('active', true).limit(1)
  const categoryId = cats?.[0]?.id
  if (!categoryId) { console.error('Category not found'); process.exit(1) }

  const domainOverrides = readDomainOverrides(domain)
  const maxDifficulty = DIFFICULTY_TO_MAX_SUBQUERY[difficulty]

  // Try up to 5 times, keep the best QC score
  let bestPuzzle: any = null, bestScore = 0, bestPath: string[] = []

  for (let attempt = 1; attempt <= 5; attempt++) {
    const entities = await fetchEntitiesCached(domain, 3000, { forceRefresh: attempt === 1, maxDifficulty })
    const filtered = filterEntities(entities)
    const graph = buildGraph(filtered)
    const entityIds = filtered.filter((e: any) => e.relatedIds.length >= 2 && e.label.length <= 30 && !/^Q\d+$/.test(e.label)).map((e: any) => e.id)
    const puzzle = composePuzzleForDifficulty({ entities: filtered, graph, entityIds, targetDifficulty: difficulty, domainOverrides })
    if (!puzzle) { console.log(`Attempt ${attempt}: no puzzle composed`); continue }
    const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
    const pathLabels = puzzle.optimalPath.map(id => (entityMap.get(id) as any)?.label ?? id)
    const connectionType = (CONNECTION_TYPES as any)[domain]?.[difficulty] ?? 'related concepts'
    const qcResult = await evaluatePuzzle(domain, difficulty, pathLabels, connectionType, domain)
    console.log(`Attempt ${attempt}: ${qcResult.score}/10 — ${pathLabels.join(' → ')}`)
    if (qcResult.score > bestScore) { bestScore = qcResult.score; bestPuzzle = puzzle; bestPath = pathLabels }
    if (qcResult.pass) break
  }

  if (!bestPuzzle) { console.error('No puzzle found'); process.exit(1) }

  const entities = await fetchEntitiesCached(domain, 3000, { forceRefresh: false, maxDifficulty })
  const filtered = filterEntities(entities)
  const entityMap = new Map(filtered.map((e: any) => [e.id, e]))

  console.log(`\nPublishing best path (${bestScore}/10): ${bestPath.join(' → ')}`)

  const narrative = await generateNarrative({
    startLabel: capitalize((entityMap.get(bestPuzzle.startId) as any)?.label ?? bestPuzzle.startId),
    endLabel: capitalize((entityMap.get(bestPuzzle.endId) as any)?.label ?? bestPuzzle.endId),
    pathLabels: bestPath.map(capitalize),
    category: domain,
  })

  const { error } = await sb.from('puzzles').upsert({
    category_id: categoryId, date,
    start_concept: capitalize((entityMap.get(bestPuzzle.startId) as any)?.label ?? bestPuzzle.startId),
    end_concept: capitalize((entityMap.get(bestPuzzle.endId) as any)?.label ?? bestPuzzle.endId),
    bubbles: bestPuzzle.bubbles, connections: bestPuzzle.connections,
    optimal_path: bestPuzzle.optimalPath, difficulty: bestPuzzle.difficulty,
    narrative, status: 'published', qc_score: bestScore,
  }, { onConflict: 'category_id,date,difficulty' })

  if (error) { console.error('DB error:', error.message); process.exit(1) }
  console.log(`✓ Published ${domain}/${difficulty} at ${bestScore}/10`)
})()

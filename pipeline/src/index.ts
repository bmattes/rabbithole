import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { CategoryDomain, SubqueryDifficulty } from './wikidata'
import { fetchEntitiesCached } from './entityCache'
import { buildGraph } from './graphBuilder'
import { composePuzzleForDifficulty, Difficulty, IntermediateFilterConfig } from './puzzleComposer'
import { DOMAIN_CONFIG } from './domainConfig'
import { generateNarrative } from './narrativeGenerator'
import { evaluatePuzzle, CONNECTION_TYPES } from './puzzleQC'
import { checkDuplicate } from './puzzleDedup'
import cron from 'node-cron'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const ANCHOR_TYPES: Record<string, string[]> = {
  movies: ['film'],
  sport: ['person', 'team', 'city'],
  music: ['person'],
  science: ['person'],
  history: ['person'],
  military: ['person'],
  royals: ['person'],
  food: ['dish', 'ingredient'],
  basketball: ['person', 'team'],
  americanfootball: ['person', 'team'],
  videogames: ['game'],
  literature: ['book'],
  art: ['artwork'],
  geography: ['city'],
  soccer: ['team'],
  tv: ['series'],
  // genre-specific music domains (Wikidata-backed, replaces mb_*)
  rock: ['person'],
  hiphop: ['person'],
  pop: ['person'],
  rnb: ['person'],
  country: ['person'],
  // mb_* aliases kept for backwards compat (entityCache maps them to the above)
  mb_rock: ['person'],
  mb_hiphop: ['person'],
  mb_pop: ['person'],
  mb_rnb: ['person'],
  mb_country: ['person'],
}

// Domains where the anchor type can also appear as an intermediate node,
// bridged via an "interesting" non-anchor type (person, location, genre, platform).
// e.g. game → character → game → genre → game
// e.g. film → genre → film → location → film
const INTERMEDIATE_BRIDGE_TYPES: Record<string, Set<string>> = {
  videogames: new Set(['person', 'location', 'genre', 'platform']),
  movies: new Set(['person', 'genre', 'location', 'other']),  // film→actor→film, film→genre→film, film→award→film
  tv: new Set(['person', 'genre', 'network', 'character']),    // series→cast→series, series→genre→series, series→character→series
  literature: new Set(['person', 'movement', 'field', 'genre']), // book→author→book, book→genre→book
  art: new Set(['person', 'movement', 'country']),             // artwork→painter→artwork, artist→movement→artist
}

// Entity types that make unguessable bridge nodes — abstract offices, government
// positions, academic fields. Tagged explicitly in their subqueries so we can
// strip them from the graph before puzzle composition.
const UNGUESSABLE_TYPES = new Set(['office', 'field', 'category'])

// Normalised familiarity score: use pageviews if available, fall back to sitelinks
function entityFamiliarity(e: any): number {
  if (e.pageviews !== undefined) return e.pageviews / 3000
  return e.sitelinks ?? 0
}

// Min anchor familiarity by difficulty: easy needs famous nodes, hard can use more obscure ones
const MIN_ANCHOR_FAMILIARITY: Record<Difficulty, number> = {
  easy:   40,   // ~sitelinks 40 or ~120k pageviews/mo — moderately well-known
  medium: 20,
  hard:   0,    // no floor for hard — allows expert-level endpoints
}

function filterEntities(entities: any[], domain: CategoryDomain): any[] {
  const isBad = (e: any) => UNGUESSABLE_TYPES.has(e.entityType) || /^Q\d+$/.test(e.label ?? '')
  const badIds = new Set(entities.filter(isBad).map((e: any) => e.id))
  if (badIds.size === 0) return entities
  console.log(`  [${domain}] stripping ${badIds.size} unguessable/unlabelled bridge nodes`)
  return entities
    .filter((e: any) => !isBad(e))
    .map((e: any) => ({ ...e, relatedIds: e.relatedIds.filter((id: string) => !badIds.has(id)) }))
}

function buildEntityIds(entities: any[], domain: CategoryDomain, difficulty: Difficulty): string[] {
  const anchorTypes = ANCHOR_TYPES[domain] ?? null
  const overrides = DOMAIN_CONFIG[domain]
  const minFamiliarity = overrides?.minAnchorFamiliarity !== undefined
    ? overrides.minAnchorFamiliarity
    : MIN_ANCHOR_FAMILIARITY[difficulty]
  return entities
    .filter((e: any) => {
      if (e.relatedIds.length < 2) return false
      if (e.label.length > 30) return false
      if (/^Q\d+$/.test(e.label)) return false  // reject unlabelled Wikidata entities
      if (anchorTypes && e.entityType && !anchorTypes.includes(e.entityType)) return false
      if (minFamiliarity > 0 && entityFamiliarity(e) < minFamiliarity) return false
      return true
    })
    .map((e: any) => e.id)
}

// Map each puzzle difficulty to the max subquery difficulty to include.
// easy puzzles only use easy subqueries; medium adds medium; hard uses all.
const DIFFICULTY_TO_MAX_SUBQUERY: Record<Difficulty, SubqueryDifficulty> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
}

async function attemptDifficulty(
  difficulty: Difficulty,
  domain: CategoryDomain,
  categoryId: string,
  categoryName: string,
  date: string,
  forceRefresh: boolean,
  entityLimit = 1500,
  attempt = 1,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('puzzles')
    .select('id')
    .eq('category_id', categoryId)
    .eq('date', date)
    .eq('difficulty', difficulty)
    .eq('status', 'published')
    .single()

  if (existing) {
    console.log(`[${categoryName}/${difficulty}] ✓ Already published for ${date}, skipping`)
    return true
  }

  const maxDifficulty = DIFFICULTY_TO_MAX_SUBQUERY[difficulty]
  console.log(`[${categoryName}/${difficulty}] Fetching entities (max subquery: ${maxDifficulty})...`)
  const { entities: rawEntities, edgeLabels } = await fetchEntitiesCached(domain, entityLimit, { forceRefresh, maxDifficulty })
  console.log(`[${categoryName}/${difficulty}] Got ${rawEntities.length} entities`)

  const filtered = filterEntities(rawEntities, domain)
  if (filtered.length < rawEntities.length) {
    console.log(`[${categoryName}/${difficulty}] Stripped ${rawEntities.length - filtered.length} abstract bridge nodes`)
  }

  const graph = buildGraph(filtered)
  const entityIds = buildEntityIds(filtered, domain, difficulty)

  console.log(`[${categoryName}/${difficulty}] Composing puzzle...`)
  const domainOverrides = DOMAIN_CONFIG[domain]
  const anchorType = (ANCHOR_TYPES[domain] ?? [])[0]
  const interestingTypes = INTERMEDIATE_BRIDGE_TYPES[domain]
  const intermediateFilterConfig: IntermediateFilterConfig | undefined =
    anchorType && interestingTypes ? { anchorType, interestingTypes } : undefined
  const puzzle = composePuzzleForDifficulty({ entities: filtered, graph, entityIds, targetDifficulty: difficulty, domainOverrides, intermediateFilterConfig })

  if (!puzzle) return false

  const entityMap = new Map(filtered.map(e => [e.id, e]))

  // Reject puzzles where start/end don't have labels in the entity map
  if (!entityMap.has(puzzle.startId) || !entityMap.has(puzzle.endId)) {
    console.log(`[${categoryName}/${difficulty}] ✗ Rejected: start/end has no label (${puzzle.startId} / ${puzzle.endId})`)
    return false
  }

  const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)
  console.log(`[${categoryName}/${difficulty}] Path: ${pathLabels.join(' → ')}`)

  // Cross-day deduplication check
  const dedup = await checkDuplicate(supabase, categoryId, difficulty, date, puzzle.optimalPath)
  if (dedup.isDuplicate) {
    console.log(`[${categoryName}/${difficulty}] ✗ DEDUP rejected: ${dedup.reason}`)
    return false
  }

  console.log(`[${categoryName}/${difficulty}] Generating narrative...`)
  const narrative = await generateNarrative({
    startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    pathLabels,
    category: categoryName,
  })

  // Filter edgeLabels to only edges between bubbles in this puzzle
  const bubbleSet = new Set(puzzle.bubbles.map((b: any) => b.id))
  const filteredEdgeLabels: Record<string, string> = {}
  for (const [key, label] of Object.entries(edgeLabels)) {
    const [a, b] = key.split('|')
    if (bubbleSet.has(a) && bubbleSet.has(b)) filteredEdgeLabels[key] = label
  }

  const { data, error } = await supabase.from('puzzles').upsert({
    category_id: categoryId,
    date,
    start_concept: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
    end_concept: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
    bubbles: puzzle.bubbles,
    connections: puzzle.connections,
    optimal_path: puzzle.optimalPath,
    difficulty: puzzle.difficulty,
    narrative,
    status: 'published',
    edge_labels: Object.keys(filteredEdgeLabels).length > 0 ? filteredEdgeLabels : null,
  }, { onConflict: 'category_id,date,difficulty' }).select('id').single()

  if (error) {
    console.error(`[${categoryName}/${difficulty}] DB error:`, error.message)
    return false
  }

  console.log(`[${categoryName}/${difficulty}] ✓ Published puzzle ${data.id}`)

  // Inline QC — evaluate the puzzle right after publishing
  const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'
  process.stdout.write(`[${categoryName}/${difficulty}] QC: ${pathLabels.join(' → ')}\n  Evaluating... `)
  try {
    const qcResult = await evaluatePuzzle(categoryName, difficulty, pathLabels, connectionType, domain)
    if (qcResult.pass) {
      console.log(`✓ PASS (${qcResult.score}/10) — ${qcResult.verdict}`)
      await supabase.from('puzzles').update({ qc_score: qcResult.score }).eq('id', data.id)
      return true
    } else {
      console.log(`✗ FAIL (${qcResult.score}/10) — ${qcResult.verdict}`)
      for (const issue of qcResult.issues) console.log(`    ⚠ ${issue}`)
      // Delete this puzzle so the caller can retry
      await supabase.from('puzzles').delete().eq('id', data.id)
      return false
    }
  } catch (err: any) {
    console.log(`QC error: ${err.message} — keeping puzzle`)
    return true
  }
}

async function generatePuzzleForCategory(
  categoryId: string,
  categoryName: string,
  domain: CategoryDomain,
  date: string
) {
  const forceRefresh = process.argv.includes('--refresh-cache')
  const allDifficulties: Difficulty[] = ['easy', 'medium', 'hard']

  for (const difficulty of allDifficulties) {
    // Up to 3 attempts: 1500 entities → 3000 → 3000 (force refresh)
    const retryConfigs = [
      { entityLimit: 1500, forceRefresh },
      { entityLimit: 3000, forceRefresh: true },
      { entityLimit: 3000, forceRefresh: true },
    ]
    let passed = false
    for (let i = 0; i < retryConfigs.length; i++) {
      const cfg = retryConfigs[i]
      if (i > 0) console.log(`[${categoryName}/${difficulty}] Retry ${i}/${retryConfigs.length - 1}...`)
      const ok = await attemptDifficulty(difficulty, domain, categoryId, categoryName, date, cfg.forceRefresh, cfg.entityLimit, i + 1)
      if (ok) { passed = true; break }
    }
    if (!passed) console.error(`[${categoryName}/${difficulty}] Failed after all retries`)
  }
}

async function runPipeline(targetDate?: string) {
  const date = targetDate ?? new Date().toISOString().split('T')[0]
  console.log(`\n=== RabbitHole Pipeline — ${date} ===`)

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, wikidata_domain')
    .eq('active', true)

  if (error || !categories?.length) {
    console.error('No active categories found:', error?.message)
    return
  }

  console.log(`Found ${categories.length} active categories`)

  for (const cat of categories) {
    try {
      await generatePuzzleForCategory(cat.id, cat.name, cat.wikidata_domain as CategoryDomain, date)
    } catch (err) {
      console.error(`[${cat.name}] Error:`, err)
    }
  }

  console.log('\n=== Pipeline complete ===')
}

// CLI: node -r ts-node/register src/index.ts [--date YYYY-MM-DD]
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))
runPipeline(dateArg)

// Also schedule nightly at 2am
cron.schedule('0 2 * * *', () => runPipeline())

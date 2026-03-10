/**
 * run-domain.ts
 *
 * Compose and optionally publish puzzles for a single domain/date.
 * Used by agent-loop.ts for iterative domain tuning.
 *
 * Usage:
 *   npx ts-node src/scripts/run-domain.ts --domain history --date 2026-03-08 [--dry-run] [--refresh-cache]
 *
 * --dry-run   : compose + QC score only, no Supabase write, no narrative generation
 * --refresh-cache : force re-fetch entities from Wikidata (ignores local cache)
 *
 * Output (stdout, one JSON line per difficulty at the end):
 *   RESULT {"domain":"history","difficulty":"easy","score":7.5,"pass":true,"path":["A","B","C"],"issues":[]}
 */

import * as dotenv from 'dotenv'
dotenv.config()

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { CategoryDomain, SubqueryDifficulty } from '../wikidata'
import { fetchEntitiesCached } from '../entityCache'
import { buildGraph } from '../graphBuilder'
import { composePuzzleForDifficulty, scorePathQuality, Difficulty, ComposedPuzzle } from '../puzzleComposer'
import { generateNarrative } from '../narrativeGenerator'
import { evaluatePuzzle, CONNECTION_TYPES } from '../puzzleQC'
import { readDomainOverrides } from '../domainConfig'
import { checkDuplicate } from '../puzzleDedup'

// Temp dir for dry-run puzzle cache — publish pass reads these instead of recomposing
const PUZZLE_CACHE_DIR = path.join(__dirname, '../../../.entity-cache/puzzle-drafts')

interface PuzzleDraft {
  puzzle: ComposedPuzzle
  pathLabels: string[]
  qcScore: number
  qualityScore: number
  edgeLabels?: Record<string, string>
}

function draftPath(difficulty: Difficulty): string {
  if (!fs.existsSync(PUZZLE_CACHE_DIR)) fs.mkdirSync(PUZZLE_CACHE_DIR, { recursive: true })
  return path.join(PUZZLE_CACHE_DIR, `${domain}-${date}-${difficulty}.json`)
}

function saveDraft(difficulty: Difficulty, draft: PuzzleDraft): void {
  fs.writeFileSync(draftPath(difficulty), JSON.stringify(draft))
}

function loadDraft(difficulty: Difficulty): PuzzleDraft | null {
  const p = draftPath(difficulty)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---- CLI args ----
const domainArg = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--domain') + 1]
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE_REFRESH = process.argv.includes('--refresh-cache')

if (!domainArg || !dateArg) {
  console.error('Usage: npx ts-node src/scripts/run-domain.ts --domain <domain> --date <YYYY-MM-DD> [--dry-run] [--refresh-cache]')
  process.exit(1)
}

const domain = domainArg as CategoryDomain
const date = dateArg

// Mirror of index.ts ANCHOR_TYPES
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
}

const UNGUESSABLE_TYPES = new Set(['office', 'field', 'category'])
// For food/space domains: country nodes create wrong_domain bridges — strip them from the graph
const FOOD_UNGUESSABLE_TYPES = new Set(['office', 'field', 'category', 'country'])
const COUNTRY_STRIP_DOMAINS = new Set(['food', 'space'])

function filterEntities(entities: any[], domainName?: string): any[] {
  const types = (domainName && COUNTRY_STRIP_DOMAINS.has(domainName)) ? FOOD_UNGUESSABLE_TYPES : UNGUESSABLE_TYPES
  const isBad = (e: any) => types.has(e.entityType) || /^Q\d+$/.test(e.label ?? '')
  const badIds = new Set(entities.filter(isBad).map((e: any) => e.id))
  if (badIds.size === 0) return entities
  return entities
    .filter((e: any) => !isBad(e))
    .map((e: any) => ({ ...e, relatedIds: e.relatedIds.filter((id: string) => !badIds.has(id)) }))
}

function entityFamiliarity(e: any): number {
  if (e.pageviews !== undefined) return e.pageviews / 3000
  return e.sitelinks ?? 0
}

const MIN_ANCHOR_FAMILIARITY: Record<Difficulty, number> = {
  easy: 40,
  medium: 20,
  hard: 0,
}

function buildEntityIds(entities: any[], difficulty: Difficulty): string[] {
  const anchorTypes = ANCHOR_TYPES[domain] ?? null
  const overrides = readDomainOverrides(domain)
  const minFamiliarity = overrides?.minAnchorFamiliarity !== undefined
    ? overrides.minAnchorFamiliarity
    : MIN_ANCHOR_FAMILIARITY[difficulty]
  return entities
    .filter((e: any) => {
      if (e.relatedIds.length < 2) return false
      if (e.label.length > 30) return false
      if (/^Q\d+$/.test(e.label)) return false
      if (anchorTypes && e.entityType && !anchorTypes.includes(e.entityType)) return false
      if (minFamiliarity > 0 && entityFamiliarity(e) < minFamiliarity) return false
      return true
    })
    .map((e: any) => e.id)
}

const DIFFICULTY_TO_MAX_SUBQUERY: Record<Difficulty, SubqueryDifficulty> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
}

interface DomainResult {
  domain: CategoryDomain
  difficulty: Difficulty
  score: number
  pass: boolean
  path: string[]
  issues: string[]
  qualityScore?: number
}

async function runDifficulty(difficulty: Difficulty, entityLimit: number): Promise<DomainResult | null> {
  const domainOverrides = readDomainOverrides(domain)

  // On publish pass: reuse the draft puzzle from dry-run to avoid non-determinism
  if (!DRY_RUN) {
    const draft = loadDraft(difficulty)
    if (draft) {
      console.log(`[${domain}/${difficulty}] Using draft puzzle: ${draft.pathLabels.join(' → ')}`)
      const puzzle = draft.puzzle

      // Re-fetch entities only for narrative generation (need labels)
      const maxDifficulty = DIFFICULTY_TO_MAX_SUBQUERY[difficulty]
      const { entities: rawEntities } = await fetchEntitiesCached(domain, entityLimit, { forceRefresh: false, maxDifficulty })
      const filtered = filterEntities(rawEntities, domain)
      const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
      const pathLabels = draft.pathLabels

      const narrative = await generateNarrative({
        startLabel: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
        endLabel: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
        pathLabels: pathLabels.map(capitalize),
        category: domain,
      })

      await supabase.from('puzzles').upsert({
        category_id: await getCategoryId(domain),
        date,
        start_concept: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
        end_concept: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
        bubbles: puzzle.bubbles,
        connections: puzzle.connections,
        optimal_path: puzzle.optimalPath,
        difficulty: puzzle.difficulty,
        narrative,
        status: 'published',
        qc_score: draft.qcScore,
        edge_labels: draft.edgeLabels ?? null,
      }, { onConflict: 'category_id,date,difficulty' })

      console.log(`[${domain}/${difficulty}] ✓ Published (from draft)`)
      return { domain, difficulty, score: draft.qcScore, pass: true, path: pathLabels, issues: [], qualityScore: draft.qualityScore }
    }
    // No draft — fall through to compose fresh (shouldn't happen in normal flow)
  }

  // Compose fresh puzzle
  const maxDifficulty = DIFFICULTY_TO_MAX_SUBQUERY[difficulty]
  const { entities: rawEntities, edgeLabels } = await fetchEntitiesCached(domain, entityLimit, { forceRefresh: FORCE_REFRESH, maxDifficulty })
  const filtered = filterEntities(rawEntities, domain)
  const graph = buildGraph(filtered)
  const entityIds = buildEntityIds(filtered, difficulty)

  const puzzle = composePuzzleForDifficulty({ entities: filtered, graph, entityIds, targetDifficulty: difficulty, domainOverrides })
  if (!puzzle) {
    console.log(`[${domain}/${difficulty}] No puzzle composed (limit=${entityLimit})`)
    return null
  }

  const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
  const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)
  const qScore = scorePathQuality(puzzle.optimalPath, entityMap as any, puzzle.connections as any, domainOverrides?.hubRelatedIdsThreshold)

  console.log(`[${domain}/${difficulty}] Path: ${pathLabels.join(' → ')} (quality=${qScore.total.toFixed(1)})`)

  // Cross-day deduplication check (dry-run only — publish uses the saved draft)
  if (DRY_RUN) {
    const categoryId = await getCategoryId(domain)
    if (categoryId) {
      const dedup = await checkDuplicate(supabase, categoryId, difficulty, date, puzzle.optimalPath)
      if (dedup.isDuplicate) {
        console.log(`[${domain}/${difficulty}] ✗ DEDUP rejected: ${dedup.reason}`)
        return null
      }
    }
  }

  const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'
  const qcResult = await evaluatePuzzle(domain, difficulty, pathLabels, connectionType, domain)

  console.log(`[${domain}/${difficulty}] QC: ${qcResult.pass ? '✓ PASS' : '✗ FAIL'} (${qcResult.score}/10) — ${qcResult.verdict}`)
  for (const issue of qcResult.issues) console.log(`  ⚠ ${issue}`)

  // Save passing puzzle as draft for the publish pass
  if (DRY_RUN && qcResult.pass) {
    const bubbleSet = new Set(puzzle.bubbles.map((b: any) => b.id))
    const filteredEdgeLabels: Record<string, string> = {}
    for (const [key, label] of Object.entries(edgeLabels)) {
      const [a, b] = key.split('|')
      if (bubbleSet.has(a) && bubbleSet.has(b)) filteredEdgeLabels[key] = label
    }
    saveDraft(difficulty, { puzzle, pathLabels, qcScore: qcResult.score, qualityScore: qScore.total, edgeLabels: filteredEdgeLabels })
  }

  return {
    domain,
    difficulty,
    score: qcResult.score,
    pass: qcResult.pass,
    path: pathLabels,
    issues: qcResult.issues,
    qualityScore: qScore.total,
  }
}

let _categoryId: string | null = null
async function getCategoryId(domain: CategoryDomain): Promise<string> {
  if (_categoryId) return _categoryId
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('wikidata_domain', domain)
    .eq('active', true)
    .limit(1)
  _categoryId = data?.[0]?.id ?? ''
  return _categoryId!
}

async function run() {
  console.log(`\n=== run-domain: ${domain} / ${date}${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`)
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard']
  const results: DomainResult[] = []

  for (const difficulty of difficulties) {
    // Try with 1500 entities first, then 3000 on failure
    let result = await runDifficulty(difficulty, 1500)
    if (!result) result = await runDifficulty(difficulty, 3000)
    if (result) results.push(result)
  }

  // Machine-readable summary lines for agent-loop.ts to parse
  for (const r of results) {
    process.stdout.write(`RESULT ${JSON.stringify(r)}\n`)
  }

  const allPass = results.length === 3 && results.every(r => r.pass)
  console.log(`\n=== ${domain} done: ${results.filter(r => r.pass).length}/3 passed ===`)
  process.exit(allPass ? 0 : 1)
}

run().catch(err => { console.error(err); process.exit(2) })

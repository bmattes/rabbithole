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
import { composePuzzleForDifficulty, scorePathQuality, Difficulty, ComposedPuzzle, IntermediateFilterConfig } from '../puzzleComposer'
import { evaluateAndSelectPuzzle, PuzzleCandidate, CONNECTION_TYPES } from '../puzzleQC'
import { readDomainOverrides } from '../domainConfig'
import { checkDuplicate } from '../puzzleDedup'

// Temp dir for dry-run puzzle cache — publish pass reads these instead of recomposing
const PUZZLE_CACHE_DIR = path.join(__dirname, '../../../.entity-cache/puzzle-drafts')

interface PuzzleDraft {
  puzzle: ComposedPuzzle
  pathLabels: string[]
  qcScore: number
  qualityScore: number
  narrative: string
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
const MAX_LLM_CANDIDATES = 5  // collect up to this many distinct paths before calling LLM

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
  videogames: ['game'],
  literature: ['book'],
  art: ['artwork'],
  geography: ['city'],
  soccer: ['team'],
  tv: ['series'],
  rock: ['person'],
  hiphop: ['person'],
  pop: ['person'],
  rnb: ['person'],
  country: ['person'],
  mb_rock: ['person'],
  mb_hiphop: ['person'],
  mb_pop: ['person'],
  mb_rnb: ['person'],
  mb_country: ['person'],
}

// Mirror of index.ts INTERMEDIATE_BRIDGE_TYPES
const INTERMEDIATE_BRIDGE_TYPES: Record<string, Set<string>> = {
  videogames: new Set(['person', 'location', 'genre', 'platform']),
  movies: new Set(['person', 'genre', 'location', 'other']),
  tv: new Set(['person', 'genre', 'network', 'character']),
  literature: new Set(['person', 'movement', 'field', 'genre']),
  art: new Set(['person', 'movement', 'country']),
}

const UNGUESSABLE_TYPES = new Set(['office', 'field', 'category'])
// For food/space domains: country nodes create wrong_domain bridges — strip them from the graph
const FOOD_UNGUESSABLE_TYPES = new Set(['office', 'field', 'category', 'country'])
const COUNTRY_STRIP_DOMAINS = new Set(['food'])

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

async function isAlreadyPublished(difficulty: Difficulty): Promise<boolean> {
  const categoryId = await getCategoryId(domain)
  if (!categoryId) return false
  const { data } = await supabase
    .from('puzzles')
    .select('id')
    .eq('category_id', categoryId)
    .eq('date', date)
    .eq('difficulty', difficulty)
    .eq('status', 'published')
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function runDifficulty(difficulty: Difficulty, entityLimit: number): Promise<DomainResult | null> {
  const domainOverrides = readDomainOverrides(domain)

  // Skip difficulties that are already published (both dry-run and publish passes)
  if (await isAlreadyPublished(difficulty)) {
    console.log(`[${domain}/${difficulty}] ✓ Already published for ${date}, skipping`)
    return { domain, difficulty, score: 10, pass: true, path: [], issues: [], qualityScore: 0 }
  }

  // On publish pass: reuse the draft puzzle from dry-run to avoid non-determinism
  if (!DRY_RUN) {
    const draft = loadDraft(difficulty)
    if (draft) {
      console.log(`[${domain}/${difficulty}] Using draft puzzle: ${draft.pathLabels.join(' → ')}`)
      const puzzle = draft.puzzle
      const pathLabels = draft.pathLabels

      // Narrative was generated during dry-run story selection — use it directly
      const narrative = draft.narrative ?? ''

      await supabase.from('puzzles').upsert({
        category_id: await getCategoryId(domain),
        date,
        start_concept: capitalize(puzzle.bubbles.find((b: any) => b.id === puzzle.startId)?.label ?? puzzle.startId),
        end_concept: capitalize(puzzle.bubbles.find((b: any) => b.id === puzzle.endId)?.label ?? puzzle.endId),
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

  const anchorType = (ANCHOR_TYPES[domain] ?? [])[0]
  const interestingTypes = INTERMEDIATE_BRIDGE_TYPES[domain]
  const intermediateFilterConfig: IntermediateFilterConfig | undefined =
    anchorType && interestingTypes ? { anchorType, interestingTypes } : undefined

  // Collect up to MAX_LLM_CANDIDATES distinct start/end pairs before calling LLM
  const candidates: Array<{ puzzle: ComposedPuzzle; pathLabels: string[]; qualityScore: number; edgeLabels: Record<string, string> }> = []
  const usedStartEnds = new Set<string>()

  for (let attempt = 0; attempt < MAX_LLM_CANDIDATES * 3 && candidates.length < MAX_LLM_CANDIDATES; attempt++) {
    const puzzle = composePuzzleForDifficulty({ entities: filtered, graph, entityIds, targetDifficulty: difficulty, domainOverrides, intermediateFilterConfig })
    if (!puzzle) continue

    // Avoid near-identical start/end pairs
    const pairKey = `${puzzle.startId}|${puzzle.endId}`
    if (usedStartEnds.has(pairKey)) continue
    usedStartEnds.add(pairKey)

    const entityMap = new Map(filtered.map((e: any) => [e.id, e]))
    const pathLabels = puzzle.optimalPath.map((id: string) => entityMap.get(id)?.label ?? id)

    // Cross-day deduplication check (dry-run only — publish uses the saved draft)
    if (DRY_RUN) {
      const categoryId = await getCategoryId(domain)
      if (categoryId) {
        const dedup = await checkDuplicate(supabase, categoryId, difficulty, date, puzzle.optimalPath)
        if (dedup.isDuplicate) {
          console.log(`[${domain}/${difficulty}] ✗ DEDUP rejected (attempt ${attempt + 1}): ${dedup.reason}`)
          continue
        }
      }
    }

    const qScore = scorePathQuality(puzzle.optimalPath, entityMap as any, puzzle.connections as any, domainOverrides?.hubRelatedIdsThreshold)
    console.log(`[${domain}/${difficulty}] Candidate ${candidates.length + 1}: ${pathLabels.join(' → ')} (quality=${qScore.total.toFixed(1)})`)

    // Build filtered edge labels for this candidate
    const bubbleSet = new Set(puzzle.bubbles.map((b: any) => b.id))
    const filteredEdgeLabels: Record<string, string> = {}
    for (const [key, label] of Object.entries(edgeLabels)) {
      const [a, b] = key.split('|')
      if (bubbleSet.has(a) && bubbleSet.has(b)) filteredEdgeLabels[key] = label
    }

    candidates.push({ puzzle, pathLabels, qualityScore: qScore.total, edgeLabels: filteredEdgeLabels })
  }

  if (candidates.length === 0) {
    console.log(`[${domain}/${difficulty}] No puzzle composed (limit=${entityLimit})`)
    return null
  }

  // LLM: evaluate all candidates for validity + story quality, pick winner, write narrative
  const connectionType = CONNECTION_TYPES[domain]?.[difficulty] ?? 'related concepts'
  const llmCandidates: PuzzleCandidate[] = candidates.map((c, i) => ({ pathLabels: c.pathLabels, index: i }))

  console.log(`[${domain}/${difficulty}] Evaluating ${candidates.length} candidate(s) for story quality...`)
  const selection = await evaluateAndSelectPuzzle(llmCandidates, domain, difficulty, connectionType)

  if (!selection || !selection.qcResult.pass) {
    const score = selection?.qcResult.score ?? 0
    const verdict = selection?.qcResult.verdict ?? 'no valid candidates'
    console.log(`[${domain}/${difficulty}] QC: ✗ FAIL (${score}/10) — ${verdict}`)
    for (const issue of selection?.qcResult.issues ?? []) console.log(`  ⚠ ${issue}`)
    return {
      domain, difficulty,
      score,
      pass: false,
      path: candidates[0]?.pathLabels ?? [],
      issues: selection?.qcResult.issues ?? [],
      qualityScore: candidates[0]?.qualityScore ?? 0,
    }
  }

  const winner = candidates[selection.winnerIndex]
  const storyScoresStr = selection.storyScores.map((s, i) => `${i + 1}:${s}`).join(' ')
  console.log(`[${domain}/${difficulty}] QC: ✓ PASS (${selection.qcResult.score}/10) — story scores: [${storyScoresStr}] — winner: ${selection.winnerIndex + 1}`)
  console.log(`[${domain}/${difficulty}] Path: ${winner.pathLabels.join(' → ')}`)
  for (const issue of selection.qcResult.issues) console.log(`  ⚠ ${issue}`)

  // Save winning puzzle as draft for the publish pass (includes narrative from story selection)
  if (DRY_RUN) {
    saveDraft(difficulty, {
      puzzle: winner.puzzle,
      pathLabels: winner.pathLabels,
      qcScore: selection.qcResult.score,
      qualityScore: winner.qualityScore,
      narrative: selection.narrative,
      edgeLabels: winner.edgeLabels,
    })
  }

  return {
    domain,
    difficulty,
    score: selection.qcResult.score,
    pass: true,
    path: winner.pathLabels,
    issues: selection.qcResult.issues,
    qualityScore: winner.qualityScore,
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

  const domainOverrides = readDomainOverrides(domain)
  const maxLimit = domainOverrides.maxEntityLimit ?? 3000

  for (const difficulty of difficulties) {
    // Try with 1500 entities first, then up to maxLimit on failure
    let result = await runDifficulty(difficulty, 1500)
    if (!result && maxLimit > 1500) result = await runDifficulty(difficulty, maxLimit)
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

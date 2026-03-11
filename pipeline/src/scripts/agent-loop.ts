/**
 * agent-loop.ts
 *
 * Agentic per-domain puzzle quality loop. Runs dry-run composition + QC,
 * diagnoses failures, updates DOMAIN_CONFIG for this domain, retries.
 * When all 3 difficulties pass (or max rounds exceeded), runs a final
 * publish pass (without --dry-run).
 *
 * Designed to be invoked as a Claude Agent tool subagent — one per domain,
 * all running in parallel.
 *
 * Usage:
 *   npx ts-node src/scripts/agent-loop.ts --domain history --date 2026-03-08
 *
 * The agent reads DOMAIN_CONFIG, updates only its own domain's entry,
 * and never touches other domains' config.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { readDomainOverrides, writeDomainOverrides, DomainOverrides } from '../domainConfig'
import { CategoryDomain } from '../wikidata'

const PUZZLE_CACHE_DIR = path.join(__dirname, '../../../.entity-cache/puzzle-drafts')

function clearDrafts(): void {
  if (!fs.existsSync(PUZZLE_CACHE_DIR)) return
  for (const f of fs.readdirSync(PUZZLE_CACHE_DIR)) {
    if (f.startsWith(`${domain}-${date}-`)) {
      fs.unlinkSync(path.join(PUZZLE_CACHE_DIR, f))
    }
  }
}

// ---- CLI args ----
const domainArg = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--domain') + 1]
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))
const FORCE_REFRESH = process.argv.includes('--refresh-cache')

if (!domainArg || !dateArg) {
  console.error('Usage: npx ts-node src/scripts/agent-loop.ts --domain <domain> --date <YYYY-MM-DD> [--refresh-cache]')
  process.exit(1)
}

const domain = domainArg as CategoryDomain
const date = dateArg
const MAX_ROUNDS = 10
const SCRIPT_DIR = path.join(__dirname)

interface RoundResult {
  domain: string
  difficulty: string
  score: number
  pass: boolean
  path: string[]
  issues: string[]
  qualityScore?: number
}

// Run run-domain.ts with --dry-run and parse RESULT lines
function runDryRun(extraArgs = '', forceRefresh = false): RoundResult[] {
  const refreshFlag = (FORCE_REFRESH || forceRefresh) ? '--refresh-cache' : ''
  const cmd = `npx ts-node ${SCRIPT_DIR}/run-domain.ts --domain ${domain} --date ${date} --dry-run ${refreshFlag} ${extraArgs}`
  console.log(`\n  $ ${cmd.trim()}`)
  let output = ''
  try {
    output = execSync(cmd, { cwd: path.join(__dirname, '../../'), encoding: 'utf8', stdio: 'pipe' })
  } catch (e: any) {
    // Non-zero exit is fine — puzzles may have failed QC
    output = (e.stdout ?? '') + (e.stderr ?? '')
  }
  // Print the output for visibility
  console.log(output.split('\n').map(l => '  ' + l).join('\n'))

  const results: RoundResult[] = []
  for (const line of output.split('\n')) {
    if (line.startsWith('RESULT ')) {
      try {
        results.push(JSON.parse(line.slice(7)))
      } catch {}
    }
  }
  return results
}

// Run the final publish pass (no --dry-run), return parsed results
function runPublish(): RoundResult[] {
  const refreshFlag = FORCE_REFRESH ? '--refresh-cache' : ''
  const cmd = `npx ts-node ${SCRIPT_DIR}/run-domain.ts --domain ${domain} --date ${date} ${refreshFlag}`
  console.log(`\n  $ ${cmd.trim()}`)
  let output = ''
  try {
    output = execSync(cmd, { cwd: path.join(__dirname, '../../'), encoding: 'utf8', stdio: 'pipe' })
    console.log(output.split('\n').map(l => '  ' + l).join('\n'))
  } catch (e: any) {
    output = (e.stdout ?? '') + (e.stderr ?? '')
    console.log(output.split('\n').map((l: string) => '  ' + l).join('\n'))
  }
  const results: RoundResult[] = []
  for (const line of output.split('\n')) {
    if (line.startsWith('RESULT ')) {
      try { results.push(JSON.parse(line.slice(7))) } catch {}
    }
  }
  return results
}

function updateDomainConfig(overrides: DomainOverrides): void {
  writeDomainOverrides(domain, overrides)
  console.log(`  [config] Updated ${domain}: ${JSON.stringify(overrides)}`)
}

interface DiagnoseResult {
  overrides: DomainOverrides
  forceRefresh: boolean
  structural?: boolean  // graph shape is the problem — SPARQL subqueries need new edge types
}

// Diagnose failures and return suggested override adjustments + whether to force-refresh entities
function diagnose(results: RoundResult[], currentOverrides: DomainOverrides): DiagnoseResult | null {
  const failing = results.filter(r => !r.pass)
  const missing = 3 - results.length  // difficulties that produced no puzzle at all

  if (failing.length === 0 && missing === 0) return null  // all good

  const next: DomainOverrides = { ...currentOverrides }

  // Check for "wrong_domain" issues — paths route through unrelated geographic/category nodes.
  // The entity graph itself is the problem; force a fresh fetch with larger entity set so the
  // composer has more domain-specific candidates to choose from.
  const wrongDomainIssues = failing.flatMap(r => r.issues).filter(i => i.includes('wrong_domain') || i.includes('wrong domain'))
  if (wrongDomainIssues.length > 0) {
    // Also relax hub threshold slightly so same-domain hubs don't block paths
    const cur = next.hubRelatedIdsThreshold ?? 50
    next.hubRelatedIdsThreshold = Math.max(20, cur - 10)
    console.log(`  [diagnose] Wrong-domain bridges — force-refreshing entities, lowering hubThreshold to ${next.hubRelatedIdsThreshold}`)
    return { overrides: next, forceRefresh: true }
  }

  // If puzzles aren't composing at all — graph too sparse after filtering
  if (missing > 0 || results.length === 0) {
    // First: zero out anchor familiarity floor — non-person anchors (dishes, books, soldiers)
    // are rarely Wikipedia-famous enough to pass default MIN_ANCHOR_FAMILIARITY (easy=40, medium=20)
    const curFamiliarity = next.minAnchorFamiliarity ?? 20  // treat undefined as non-zero default
    if (curFamiliarity > 0) {
      next.minAnchorFamiliarity = 0
      console.log(`  [diagnose] No puzzle produced — zeroing minAnchorFamiliarity (was ${curFamiliarity})`)
      return { overrides: next, forceRefresh: false }
    }
    // Also lower hub threshold so conflict/event nodes can serve as intermediates
    const curThreshold = next.hubRelatedIdsThreshold ?? 50
    if (curThreshold > 20) {
      next.hubRelatedIdsThreshold = Math.max(20, curThreshold - 20)
      console.log(`  [diagnose] No puzzle produced — lowering hubThreshold to ${next.hubRelatedIdsThreshold}`)
      return { overrides: next, forceRefresh: false }
    }
    // Loosen quality and hub ratio
    const cur = next.minQualityScore ?? 40
    if (cur > 10) {
      next.minQualityScore = Math.max(10, cur - 10)
      const curHub = next.maxHubRatio ?? 0.0
      next.maxHubRatio = Math.min(0.8, curHub + 0.2)
      console.log(`  [diagnose] No puzzle produced — loosening quality floor to ${next.minQualityScore}, hubRatio to ${next.maxHubRatio}`)
      return { overrides: next, forceRefresh: false }
    }
    // All levers maxed — graph is structurally unable to produce paths at this difficulty.
    // No config change will fix this; the SPARQL subqueries need new edge types.
    console.log(`  [diagnose] STRUCTURAL FAILURE — all config levers exhausted, graph shape insufficient for ${domain} easy/medium. Add more SPARQL subquery types to wikidata.ts.`)
    return { overrides: next, forceRefresh: false, structural: true }
  }

  // Check for "abstract" issues — intermediates are too generic
  const abstractIssues = failing.flatMap(r => r.issues).filter(i => i.includes('abstract'))
  if (abstractIssues.length > 0) {
    // Lower hub threshold so more nodes are classified as hubs and rejected
    const cur = next.hubRelatedIdsThreshold ?? 50
    next.hubRelatedIdsThreshold = Math.max(5, cur - 10)
    console.log(`  [diagnose] Abstract intermediates — lowering hubThreshold to ${next.hubRelatedIdsThreshold}`)
    return { overrides: next, forceRefresh: false }
  }

  // Check for "obscure" issues — endpoints or intermediates too unknown
  const obscureIssues = failing.flatMap(r => r.issues).filter(i => i.includes('obscure'))
  if (obscureIssues.length > 0) {
    // Already handled by MIN_ANCHOR_FAMILIARITY in buildEntityIds — lower quality floor instead
    const cur = next.minQualityScore ?? 40
    next.minQualityScore = Math.max(10, cur - 8)
    console.log(`  [diagnose] Obscure connections — lowering minQualityScore to ${next.minQualityScore}`)
    return { overrides: next, forceRefresh: false }
  }

  // Generic: just lower quality floor slightly
  const cur = next.minQualityScore ?? 40
  next.minQualityScore = Math.max(10, cur - 5)
  console.log(`  [diagnose] General failures — lowering minQualityScore to ${next.minQualityScore}`)
  return { overrides: next, forceRefresh: false }
}

async function run() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`agent-loop: ${domain} / ${date}`)
  console.log('='.repeat(60))

  // Read current config for this domain from sidecar file
  let currentOverrides: DomainOverrides = readDomainOverrides(domain)

  // Accumulate best passing result per difficulty across all rounds
  const bestResults = new Map<string, RoundResult>()

  let lastResults: RoundResult[] = []
  let round = 0
  let nextForceRefresh = false  // escalate to force-refresh when diagnosis requests it
  let stuckCount = 0  // rounds with no config change and no improvement
  let structuralFailure = false  // graph shape can't produce paths — needs SPARQL fix

  while (round < MAX_ROUNDS) {
    round++
    console.log(`\n--- Round ${round}/${MAX_ROUNDS} ---`)

    clearDrafts()  // ensure publish pass gets fresh drafts from this round
    lastResults = runDryRun('', nextForceRefresh)
    nextForceRefresh = false  // reset after use

    // Accumulate passing results — keep best score per difficulty
    for (const r of lastResults) {
      if (r.pass) {
        const existing = bestResults.get(r.difficulty)
        if (!existing || r.score > existing.score) {
          bestResults.set(r.difficulty, r)
        }
      }
    }

    const passing = lastResults.filter(r => r.pass).length
    const total = lastResults.length
    const totalPassed = bestResults.size
    console.log(`\n  Results: ${passing}/${total} passed (${3 - total} not composed) — ${totalPassed}/3 total passing`)

    // Publish any newly passing difficulties immediately so we don't lose them
    if (passing > 0) {
      console.log(`\n  Publishing ${passing} passing difficult${passing === 1 ? 'y' : 'ies'}...`)
      const publishResults = runPublish()
      // Merge publish results into bestResults (catches already-published skips)
      for (const r of publishResults) {
        if (r.pass) {
          const existing = bestResults.get(r.difficulty)
          if (!existing || r.score > existing.score) {
            bestResults.set(r.difficulty, r)
          }
        }
      }
    }

    // Success condition: all 3 difficulties have passed (across all rounds)
    if (bestResults.size === 3) {
      console.log(`\n✓ All 3 difficulties pass for ${domain}!`)
      console.log(`\nFINAL ${JSON.stringify({ domain, status: 'success', rounds: round, results: Array.from(bestResults.values()) })}`)
      process.exit(0)
    }

    // Diagnose failures using this round's results (skip if all 3 now in bestResults)
    if (bestResults.size === 3) break
    const diagnosis = diagnose(lastResults, currentOverrides)
    if (!diagnosis) {
      console.log('  No further adjustments possible.')
      stuckCount++
    } else {
      const { overrides: suggested, forceRefresh: shouldRefresh, structural } = diagnosis

      if (structural) {
        const missingNow = ['easy', 'medium', 'hard'].filter(d => !bestResults.has(d))
        console.log(`  Structural graph failure — launching graph-repair-agent for ${missingNow.join(', ')}...`)
        const repairCmd = `npx ts-node ${SCRIPT_DIR}/graph-repair-agent.ts --domain ${domain} --missing ${missingNow.join(',')}`
        console.log(`  $ ${repairCmd}`)
        try {
          const repairOutput = execSync(repairCmd, { cwd: path.join(__dirname, '../../'), encoding: 'utf8', stdio: 'pipe', timeout: 20 * 60 * 1000 })
          console.log(repairOutput.split('\n').map(l => '  ' + l).join('\n'))
          if (repairOutput.includes('REPAIR_SUCCESS')) {
            console.log('  Graph repaired — resetting config and retrying composition...')
            // Reset overrides so we start fresh with the enriched graph
            currentOverrides = {}
            updateDomainConfig(currentOverrides)
            nextForceRefresh = true
            stuckCount = 0
            // Continue the main loop — don't break
          } else {
            console.log('  Graph repair did not reach target — continuing with what we have.')
            structuralFailure = true
            nextForceRefresh = true  // at least try with whatever new subqueries were added
          }
        } catch (e: any) {
          const repairOutput = (e.stdout ?? '') + (e.stderr ?? '')
          console.log(repairOutput.split('\n').map((l: string) => '  ' + l).join('\n'))
          if (repairOutput.includes('REPAIR_SUCCESS')) {
            currentOverrides = {}
            updateDomainConfig(currentOverrides)
            nextForceRefresh = true
            stuckCount = 0
          } else {
            structuralFailure = true
            nextForceRefresh = true
          }
        }
        if (structuralFailure) break
        continue  // skip the rest of this iteration and retry composition
      }

      if (shouldRefresh) nextForceRefresh = true

      if (JSON.stringify(suggested) !== JSON.stringify(currentOverrides)) {
        currentOverrides = suggested
        updateDomainConfig(currentOverrides)
        stuckCount = 0  // reset stuck counter on config change
      } else if (shouldRefresh) {
        console.log('  Config unchanged but forcing entity refresh next round.')
        stuckCount = 0
      } else {
        stuckCount++
        console.log(`  Config unchanged and no refresh needed (stuck ${stuckCount}/3).`)
      }
    }

    // If stuck for 3 rounds with no improvement, force a cache refresh and keep going
    if (stuckCount >= 3) {
      console.log('  Forcing cache refresh to break out of stuck state.')
      nextForceRefresh = true
      stuckCount = 0
    }
  }

  // Final report
  const allResults = Array.from(bestResults.values())
  const finalPassing = allResults.filter(r => r.pass).length
  const status = finalPassing === 3 ? 'success' : structuralFailure ? 'structural_failure' : 'partial'
  if (structuralFailure) {
    const missingDifficulties = ['easy', 'medium', 'hard'].filter(d => !bestResults.has(d))
    console.log(`\n⚠ STRUCTURAL FAILURE for ${domain}: ${missingDifficulties.join(', ')} need new SPARQL subquery edge types in wikidata.ts`)
  }
  console.log(`\nFINAL ${JSON.stringify({
    domain,
    status,
    rounds: round,
    results: allResults,
  })}`)
  process.exit(finalPassing === 3 ? 0 : 1)
}

run().catch(err => { console.error(err); process.exit(2) })

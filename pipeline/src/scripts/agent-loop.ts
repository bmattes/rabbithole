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
const MAX_ROUNDS = 6
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
function runDryRun(extraArgs = ''): RoundResult[] {
  const refreshFlag = FORCE_REFRESH ? '--refresh-cache' : ''
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

// Run the final publish pass (no --dry-run)
function runPublish(): void {
  const refreshFlag = FORCE_REFRESH ? '--refresh-cache' : ''
  const cmd = `npx ts-node ${SCRIPT_DIR}/run-domain.ts --domain ${domain} --date ${date} ${refreshFlag}`
  console.log(`\n  $ ${cmd.trim()}`)
  try {
    const output = execSync(cmd, { cwd: path.join(__dirname, '../../'), encoding: 'utf8', stdio: 'pipe' })
    console.log(output.split('\n').map(l => '  ' + l).join('\n'))
  } catch (e: any) {
    console.log(((e.stdout ?? '') + (e.stderr ?? '')).split('\n').map((l: string) => '  ' + l).join('\n'))
  }
}

function updateDomainConfig(overrides: DomainOverrides): void {
  writeDomainOverrides(domain, overrides)
  console.log(`  [config] Updated ${domain}: ${JSON.stringify(overrides)}`)
}

// Diagnose failures and return suggested override adjustments
function diagnose(results: RoundResult[], currentOverrides: DomainOverrides): DomainOverrides | null {
  const failing = results.filter(r => !r.pass)
  const missing = 3 - results.length  // difficulties that produced no puzzle at all

  if (failing.length === 0 && missing === 0) return null  // all good

  const next: DomainOverrides = { ...currentOverrides }

  // If puzzles aren't composing at all — graph too sparse after filtering
  if (missing > 0 || results.length === 0) {
    const cur = next.minQualityScore ?? 40
    next.minQualityScore = Math.max(10, cur - 10)
    const curHub = next.maxHubRatio ?? 0.0
    next.maxHubRatio = Math.min(0.5, curHub + 0.15)
    console.log(`  [diagnose] No puzzle produced — loosening quality floor to ${next.minQualityScore}, hubRatio to ${next.maxHubRatio}`)
    return next
  }

  // Check for "abstract" issues — intermediates are too generic
  const abstractIssues = failing.flatMap(r => r.issues).filter(i => i.includes('abstract'))
  if (abstractIssues.length > 0) {
    // Lower hub threshold so more nodes are classified as hubs and rejected
    const cur = next.hubRelatedIdsThreshold ?? 50
    next.hubRelatedIdsThreshold = Math.max(5, cur - 10)
    console.log(`  [diagnose] Abstract intermediates — lowering hubThreshold to ${next.hubRelatedIdsThreshold}`)
    return next
  }

  // Check for "obscure" issues — endpoints or intermediates too unknown
  const obscureIssues = failing.flatMap(r => r.issues).filter(i => i.includes('obscure'))
  if (obscureIssues.length > 0) {
    // Already handled by MIN_ANCHOR_FAMILIARITY in buildEntityIds — lower quality floor instead
    const cur = next.minQualityScore ?? 40
    next.minQualityScore = Math.max(10, cur - 8)
    console.log(`  [diagnose] Obscure connections — lowering minQualityScore to ${next.minQualityScore}`)
    return next
  }

  // Generic: just lower quality floor slightly
  const cur = next.minQualityScore ?? 40
  next.minQualityScore = Math.max(10, cur - 5)
  console.log(`  [diagnose] General failures — lowering minQualityScore to ${next.minQualityScore}`)
  return next
}

async function run() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`agent-loop: ${domain} / ${date}`)
  console.log('='.repeat(60))

  // Read current config for this domain from sidecar file
  let currentOverrides: DomainOverrides = readDomainOverrides(domain)

  let lastResults: RoundResult[] = []
  let round = 0

  while (round < MAX_ROUNDS) {
    round++
    console.log(`\n--- Round ${round}/${MAX_ROUNDS} ---`)

    clearDrafts()  // ensure publish pass gets fresh drafts from this round
    lastResults = runDryRun()

    const passing = lastResults.filter(r => r.pass).length
    const total = lastResults.length
    console.log(`\n  Results: ${passing}/${total} passed (${3 - total} not composed)`)

    // Success condition: all 3 difficulties composed and passed QC
    if (total === 3 && passing === 3) {
      console.log(`\n✓ All 3 difficulties pass for ${domain}! Running publish pass...`)
      runPublish()
      console.log(`\nFINAL ${JSON.stringify({ domain, status: 'success', rounds: round, results: lastResults })}`)
      process.exit(0)
    }

    // Diagnose and update config
    const suggested = diagnose(lastResults, currentOverrides)
    if (!suggested) {
      console.log('  No further adjustments possible.')
      break
    }

    // Only update if something actually changed
    if (JSON.stringify(suggested) !== JSON.stringify(currentOverrides)) {
      currentOverrides = suggested
      updateDomainConfig(currentOverrides)
    } else {
      console.log('  Config unchanged — stopping early.')
      break
    }
  }

  // Partial success: publish what passed, report what didn't
  const passing = lastResults.filter(r => r.pass)
  if (passing.length > 0) {
    console.log(`\n⚠ Partial success (${passing.length}/3). Running publish for passing difficulties...`)
    runPublish()
  }

  console.log(`\nFINAL ${JSON.stringify({
    domain,
    status: lastResults.filter(r => r.pass).length === 3 ? 'success' : 'partial',
    rounds: round,
    results: lastResults,
  })}`)
  process.exit(lastResults.filter(r => r.pass).length === 3 ? 0 : 1)
}

run().catch(err => { console.error(err); process.exit(2) })

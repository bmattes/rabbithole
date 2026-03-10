/**
 * backfill-edge-labels.ts
 * For published puzzles missing edge_labels, uses cached entity data to patch them.
 * Does NOT trigger new Wikidata fetches — only uses what's already cached.
 * 
 * Usage: npx ts-node src/scripts/backfill-edge-labels.ts --date 2026-03-09
 */
import * as dotenv from 'dotenv'
dotenv.config()

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { SubqueryDifficulty } from '../wikidata'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const CACHE_DIR = path.join(__dirname, '../../../.entity-cache')

const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))
if (!dateArg) { console.error('Usage: npx ts-node backfill-edge-labels.ts YYYY-MM-DD'); process.exit(1) }

function readCacheEdgeLabels(domain: string, difficulty: SubqueryDifficulty): Record<string, string> | null {
  const file = path.join(CACHE_DIR, `${domain}-${difficulty}.json`)
  if (!fs.existsSync(file)) return null
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const labels = data.edgeLabels || {}
    return Object.keys(labels).length > 0 ? labels : null
  } catch { return null }
}

async function main() {
  const { data: puzzles } = await sb.from('puzzles')
    .select('id, category_id, difficulty, bubbles, edge_labels')
    .eq('date', dateArg).eq('status', 'published')

  const { data: cats } = await sb.from('categories').select('id, name, wikidata_domain').eq('active', true)
  const catMap: Record<string, { name: string; domain: string }> = {}
  for (const c of cats || []) catMap[c.id] = { name: c.name, domain: c.wikidata_domain }

  const missing = (puzzles || []).filter(p => Object.keys(p.edge_labels || {}).length === 0)
  console.log(`${missing.length} puzzles missing edge_labels`)

  let updated = 0, skipped = 0
  for (const puzzle of missing) {
    const { name, domain } = catMap[puzzle.category_id] || {}
    if (!domain || domain.startsWith('mb_')) { skipped++; continue }

    const edgeLabels = readCacheEdgeLabels(domain, puzzle.difficulty as SubqueryDifficulty)
    if (!edgeLabels) {
      console.log(`  ○ ${name}/${puzzle.difficulty}: no cached edge labels — needs re-fetch`)
      skipped++
      continue
    }

    const bubbleSet = new Set((puzzle.bubbles || []).map((b: any) => b.id))
    const filtered: Record<string, string> = {}
    for (const [k, label] of Object.entries(edgeLabels)) {
      const [a, b] = k.split('|')
      if (bubbleSet.has(a) && bubbleSet.has(b)) filtered[k] = label
    }

    if (Object.keys(filtered).length > 0) {
      const { error } = await sb.from('puzzles').update({ edge_labels: filtered }).eq('id', puzzle.id)
      if (error) { console.log(`  ✗ ${name}/${puzzle.difficulty}: ${error.message}`); skipped++ }
      else { console.log(`  ✓ ${name}/${puzzle.difficulty}: ${Object.keys(filtered).length} edges`); updated++ }
    } else {
      console.log(`  ○ ${name}/${puzzle.difficulty}: no matching edges in cache`)
      skipped++
    }
  }

  console.log(`\nUpdated: ${updated}, Skipped/missing cache: ${skipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })

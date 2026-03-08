import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data } = await supabase
    .from('puzzles')
    .select('difficulty, categories(wikidata_domain)')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .order('difficulty')
  
  if (!data) { console.log('no data'); return }
  
  const byDomain: Record<string, string[]> = {}
  for (const p of data) {
    const domain = (p as any).categories?.wikidata_domain ?? 'unknown'
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(p.difficulty)
  }
  
  const sorted = Object.entries(byDomain).sort(([a], [b]) => a.localeCompare(b))
  for (const [domain, diffs] of sorted) {
    const status = diffs.length === 3 ? '✓' : diffs.length > 0 ? '⚠' : '✗'
    console.log(`${status} ${domain}: ${diffs.join(', ')} (${diffs.length}/3)`)
  }
  console.log(`\nTotal domains: ${sorted.length}, Total puzzles: ${data.length}`)
}
main()

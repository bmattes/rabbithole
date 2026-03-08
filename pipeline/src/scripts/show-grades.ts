import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data } = await supabase
    .from('puzzles')
    .select('difficulty, optimal_path, categories(wikidata_domain)')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .order('difficulty')
  
  if (!data) { console.log('no data'); return }
  
  // Group by domain
  const byDomain: Record<string, any[]> = {}
  for (const p of data) {
    const domain = (p as any).categories?.wikidata_domain ?? 'unknown'
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(p)
  }
  
  const sorted = Object.entries(byDomain).sort(([a], [b]) => a.localeCompare(b))
  for (const [domain, puzzles] of sorted) {
    const diffMap: Record<string, string[]> = {}
    for (const p of puzzles) diffMap[p.difficulty] = p.optimal_path
    
    const fmt = (diff: string) => {
      const path = diffMap[diff]
      if (!path) return `  ${diff}: —`
      return `  ${diff}: ${path.join(' → ')}`
    }
    
    const count = puzzles.length
    const mark = count === 3 ? '✓' : '⚠'
    console.log(`\n${mark} ${domain} (${count}/3)`)
    for (const d of ['easy', 'medium', 'hard']) fmt(d) !== `  ${d}: —` && console.log(fmt(d))
  }
  console.log(`\nTotal: ${data.length} puzzles across ${sorted.length} domains`)
}
main()

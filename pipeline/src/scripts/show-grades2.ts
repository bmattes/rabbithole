import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data } = await supabase
    .from('puzzles')
    .select('difficulty, start_concept, end_concept, bubbles, categories(wikidata_domain)')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .order('difficulty')
  
  if (!data) { console.log('no data'); return }
  
  const byDomain: Record<string, any[]> = {}
  for (const p of data) {
    const domain = (p as any).categories?.wikidata_domain ?? 'unknown'
    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain].push(p)
  }
  
  const diffOrder = ['easy', 'medium', 'hard']
  const sorted = Object.entries(byDomain).sort(([a], [b]) => a.localeCompare(b))
  for (const [domain, puzzles] of sorted) {
    const count = puzzles.length
    const mark = count === 3 ? '✓' : '⚠'
    console.log(`\n${mark} ${domain} (${count}/3)`)
    
    const byDiff: Record<string, any> = {}
    for (const p of puzzles) byDiff[p.difficulty] = p
    
    for (const diff of diffOrder) {
      const p = byDiff[diff]
      if (!p) continue
      // bubbles is array of {id, label} objects
      const labels = Array.isArray(p.bubbles) 
        ? p.bubbles.map((b: any) => typeof b === 'object' ? b.label : b).join(' → ')
        : `${p.start_concept} → ... → ${p.end_concept}`
      console.log(`  ${diff}: ${labels}`)
    }
  }
  console.log(`\nTotal: ${data.length} puzzles across ${sorted.length} domains`)
}
main()

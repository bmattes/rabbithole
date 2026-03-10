import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data } = await sb.from('puzzles')
    .select('difficulty, start_concept, end_concept, edge_labels, qc_score')
    .eq('date', '2026-03-09')
    .eq('status', 'published')
    .in('difficulty', ['easy','medium','hard'])
    .order('difficulty')
  // filter to tv by joining categories
  const { data: cats } = await sb.from('categories').select('id').eq('wikidata_domain', 'tv')
  const catIds = cats?.map((c: any) => c.id) ?? []
  const { data: tv } = await sb.from('puzzles')
    .select('difficulty, start_concept, end_concept, edge_labels')
    .eq('date', '2026-03-09')
    .eq('status', 'published')
    .in('category_id', catIds)
  console.log('TV puzzles:')
  tv?.forEach((p: any) => console.log(`  ${p.difficulty}: ${p.start_concept} → ${p.end_concept} | edge_labels: ${Object.keys(p.edge_labels ?? {}).length}`))
}
main().catch(console.error)

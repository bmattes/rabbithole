import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data } = await sb.from('puzzles')
    .select('difficulty, edge_labels, start_concept, end_concept, categories(wikidata_domain)')
    .eq('date', '2026-03-09')
    .eq('status', 'published')
    .order('difficulty')
  const history = data?.filter((p: any) => (p.categories as any)?.wikidata_domain === 'history')
  history?.forEach((p: any) => {
    const labelCount = p.edge_labels ? Object.keys(p.edge_labels).length : 0
    console.log(p.difficulty, p.start_concept, '->', p.end_concept, 'edge_labels:', labelCount)
  })
}
main().catch(console.error)

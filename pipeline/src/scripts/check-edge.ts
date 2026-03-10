import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data, error } = await sb.from('puzzles')
    .select('difficulty, edge_labels, categories(wikidata_domain)')
    .eq('date', '2026-03-09')
    .eq('status', 'published')
  if (error) { console.error(error); return }
  const total = data?.length ?? 0
  const withLabels = data?.filter((p: any) => p.edge_labels && Object.keys(p.edge_labels).length > 0).length ?? 0
  console.log(`Total: ${total}, With edge_labels: ${withLabels}, Missing: ${total - withLabels}`)
  data?.filter((p: any) => !p.edge_labels || Object.keys(p.edge_labels).length === 0)
    .forEach((p: any) => console.log(' -', (p.categories as any)?.wikidata_domain, p.difficulty))
}
main().catch(console.error)

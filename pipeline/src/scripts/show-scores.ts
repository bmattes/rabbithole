import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data } = await supabase
    .from('puzzles')
    .select('difficulty, start_concept, end_concept, categories(wikidata_domain)')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .order('difficulty')
  
  if (!data) { console.log('no data'); return }
  
  console.log('QC scores are not stored in the DB — they were logged during the agent runs but not persisted.')
  console.log('Total puzzles:', data.length)
}
main()

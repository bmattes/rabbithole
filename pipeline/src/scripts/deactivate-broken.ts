import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  // Deactivate tennis (easy permanently broken, graph too sparse)
  // sport already deactivated earlier
  const { data, error } = await sb.from('categories')
    .update({ active: false })
    .eq('wikidata_domain', 'tennis')
    .select('name, wikidata_domain, active')
  if (error) { console.error(error); return }
  console.log('Deactivated:', data)
  
  // Confirm sport is still inactive
  const { data: sport } = await sb.from('categories')
    .select('name, wikidata_domain, active')
    .eq('wikidata_domain', 'sport')
  console.log('Sport status:', sport)
}
main().catch(console.error)

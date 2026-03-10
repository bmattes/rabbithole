import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data, error } = await sb.from('categories')
    .update({ active: false })
    .eq('wikidata_domain', 'sport')
    .select('id, name, wikidata_domain, active')
  if (error) { console.error(error); return }
  console.log('Deactivated:', data)
}
main().catch(console.error)

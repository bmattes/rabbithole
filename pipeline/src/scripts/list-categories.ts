import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data } = await sb.from('categories').select('id, name, wikidata_domain, active').order('name')
  data?.forEach((c: any) => console.log(`${c.active ? '✓' : '✗'} ${c.name.padEnd(20)} ${c.wikidata_domain.padEnd(20)} ${c.id}`))
}
main().catch(console.error)

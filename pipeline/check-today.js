const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
async function main() {
  const { data: cats } = await sb.from('categories').select('id, name, wikidata_domain').eq('active', true).order('name')
  const date = process.argv[2] || new Date().toISOString().split('T')[0]
  const { data: puzzles } = await sb.from('puzzles').select('category_id, difficulty').eq('date', date).eq('status', 'published')
  const bycat = {}
  for (const p of puzzles || []) {
    if (!bycat[p.category_id]) bycat[p.category_id] = []
    bycat[p.category_id].push(p.difficulty)
  }
  let missingCount = 0
  for (const cat of cats || []) {
    const mb = cat.wikidata_domain.startsWith('mb_')
    const missing = ['easy','medium','hard'].filter(d => !(bycat[cat.id]||[]).includes(d))
    if (missing.length > 0) {
      missingCount += missing.length
      console.log((mb ? '[MB] ' : '     ') + cat.name.padEnd(30) + ' id=' + cat.id + ' domain=' + cat.wikidata_domain + ' | missing: ' + missing.join(','))
    }
  }
  console.log(`done (date: ${date})`)
  process.exit(missingCount > 0 ? 1 : 0)
}
main().catch(console.error)

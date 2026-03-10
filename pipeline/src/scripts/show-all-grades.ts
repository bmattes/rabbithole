import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
async function main() {
  const { data: cats } = await sb.from('categories').select('id,name').eq('active', true)
  const catMap = new Map((cats ?? []).map((c: any) => [c.id, c.name]))
  const { data: puzzles } = await sb.from('puzzles')
    .select('category_id, difficulty, qc_score, start_concept, end_concept')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .order('category_id')
  if (!puzzles) { console.log('no puzzles'); return }

  const order: Record<string,number> = { easy: 0, medium: 1, hard: 2 }
  const byCategory: Record<string, any[]> = {}
  for (const p of puzzles) {
    const name = catMap.get(p.category_id) ?? p.category_id
    if (!byCategory[name]) byCategory[name] = []
    byCategory[name].push(p)
  }

  const rows: string[] = []
  let total = 0, count = 0, missing = 0
  for (const name of Object.keys(byCategory).sort()) {
    const diffs = byCategory[name].sort((a,b) => order[a.difficulty] - order[b.difficulty])
    for (const p of diffs) {
      const score = p.qc_score != null ? p.qc_score.toFixed(1) : 'NULL'
      if (p.qc_score != null) { total += p.qc_score; count++ }
      else missing++
      const flag = p.qc_score == null ? ' ?' : p.qc_score < 7 ? ' !' : p.qc_score >= 8 ? ' *' : ''
      rows.push(`${name.padEnd(28)} ${p.difficulty.padEnd(7)} ${score.padStart(4)}${flag}`)
    }
  }
  console.log(`${'Category'.padEnd(28)} ${'Diff'.padEnd(7)} ${'Score'}`)
  console.log('-'.repeat(48))
  for (const r of rows) console.log(r)
  console.log('-'.repeat(48))
  console.log(`${count} puzzles | avg ${(total/count).toFixed(2)} | ${missing} null | ! = <7 | * = 8+`)
}
main()

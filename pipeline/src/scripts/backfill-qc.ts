import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'
import { evaluatePuzzle, CONNECTION_TYPES } from '../puzzleQC'
import { CategoryDomain } from '../wikidata'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

(async () => {
  const { data: cats } = await sb.from('categories').select('id, wikidata_domain').eq('active', true)
  const catMap = Object.fromEntries(cats!.map((c: any) => [c.id, c.wikidata_domain]))

  const { data } = await sb.from('puzzles')
    .select('id, category_id, difficulty, optimal_path, bubbles')
    .eq('date', '2026-03-08')
    .eq('status', 'published')
    .is('qc_score', null)

  const puzzles = data!.map((r: any) => {
    const domain = catMap[r.category_id] || r.category_id
    const bubbleMap = Object.fromEntries((r.bubbles || []).map((b: any) => [b.id, b.label]))
    const pathLabels = (r.optimal_path || []).map((id: string) => bubbleMap[id] || id)
    return { id: r.id, domain: domain as CategoryDomain, difficulty: r.difficulty, pathLabels }
  })

  console.log(`\nBackfilling ${puzzles.length} QC scores...\n`)
  let pass = 0, fail = 0
  for (const p of puzzles) {
    const connectionType = (CONNECTION_TYPES as any)[p.domain]?.[p.difficulty] ?? 'related concepts'
    process.stdout.write(`  ${p.domain}/${p.difficulty}: ${p.pathLabels.join(' → ')}\n    → `)
    try {
      const result = await evaluatePuzzle(p.domain, p.difficulty as any, p.pathLabels, connectionType, p.domain)
      console.log(`${result.pass ? '✓' : '✗'} ${result.score}/10 — ${result.verdict}`)
      await sb.from('puzzles').update({ qc_score: result.score }).eq('id', p.id)
      if (result.pass) pass++; else fail++
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`)
    }
  }
  console.log(`\nDone: ${pass} pass, ${fail} fail`)
})()

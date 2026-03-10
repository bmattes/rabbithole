import * as dotenv from 'dotenv'
dotenv.config()
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const { data: cats } = await supabase.from('categories').select('id, name').eq('wikidata_domain', 'food')
  const foodId = cats?.[0]?.id
  
  const { data: foodPuzzles } = await supabase
    .from('puzzles')
    .select('difficulty, bubbles, connections, optimal_path, edge_labels')
    .eq('category_id', foodId)
    .eq('date', '2026-03-09')
    .eq('difficulty', 'easy')

  const p = foodPuzzles?.[0]
  if (!p) { console.log('no puzzle'); return }
  
  const bubbles = p.bubbles as any[]
  const connections = p.connections as Record<string, string[]>
  const edgeLabels = p.edge_labels as Record<string, string> | null
  const optimalPath = p.optimal_path as string[]
  const labelMap = Object.fromEntries(bubbles.map((b:any) => [b.id, b.label]))
  
  console.log('=== Connections graph (all edges) ===')
  for (const [id, neighbors] of Object.entries(connections)) {
    if (neighbors.length > 0) {
      console.log(`${labelMap[id]}: [${neighbors.map((n:string) => labelMap[n]).join(', ')}]`)
    }
  }
  
  console.log('\n=== Optimal path ===')
  console.log(optimalPath.map((id:string) => labelMap[id]).join(' → '))
  
  console.log('\n=== All edge labels ===')
  for (const [key, label] of Object.entries(edgeLabels ?? {})) {
    const [a, b] = key.split('|')
    console.log(`${labelMap[a]} — ${labelMap[b]}: ${label}`)
  }
}
main().catch(console.error)

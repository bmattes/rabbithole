import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { fetchEntities, CategoryDomain } from './wikidata'
import { buildGraph } from './graphBuilder'
import { composePuzzle } from './puzzleComposer'
import { generateNarrative } from './narrativeGenerator'
import cron from 'node-cron'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function generatePuzzleForCategory(
  categoryId: string,
  categoryName: string,
  domain: CategoryDomain,
  date: string
) {
  console.log(`\n[${categoryName}] Fetching entities from Wikidata...`)
  const entities = await fetchEntities(domain, 400)
  console.log(`[${categoryName}] Got ${entities.length} entities`)

  const graph = buildGraph(entities)
  const entityIds = entities
    .filter(e => e.relatedIds.length >= 2) // only well-connected nodes as start/end
    .map(e => e.id)

  let puzzle = null
  let attempts = 0
  while (!puzzle && attempts < 100) {
    attempts++
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue
    puzzle = composePuzzle({ entities, graph, startId, endId, targetBubbleCount: 16 })
  }

  if (!puzzle) {
    console.error(`[${categoryName}] Failed to compose puzzle after ${attempts} attempts`)
    return null
  }

  const entityMap = new Map(entities.map(e => [e.id, e]))
  const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)
  console.log(`[${categoryName}] Path: ${pathLabels.join(' → ')}`)

  console.log(`[${categoryName}] Generating narrative...`)
  const narrative = await generateNarrative({
    startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    pathLabels,
    category: categoryName,
  })

  const { data, error } = await supabase.from('puzzles').upsert({
    category_id: categoryId,
    date,
    start_concept: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    end_concept: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    bubbles: puzzle.bubbles,
    connections: puzzle.connections,
    optimal_path: puzzle.optimalPath,
    narrative,
    status: 'published',
  }, { onConflict: 'category_id,date' }).select('id').single()

  if (error) {
    console.error(`[${categoryName}] DB error:`, error.message)
    return null
  }

  console.log(`[${categoryName}] ✓ Published puzzle ${data.id} for ${date}`)
  return data.id
}

async function runPipeline(targetDate?: string) {
  const date = targetDate ?? new Date().toISOString().split('T')[0]
  console.log(`\n=== RabbitHole Pipeline — ${date} ===`)

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, wikidata_domain')
    .eq('active', true)

  if (error || !categories?.length) {
    console.error('No active categories found:', error?.message)
    return
  }

  console.log(`Found ${categories.length} active categories`)

  for (const cat of categories) {
    try {
      await generatePuzzleForCategory(cat.id, cat.name, cat.wikidata_domain as CategoryDomain, date)
    } catch (err) {
      console.error(`[${cat.name}] Error:`, err)
    }
  }

  console.log('\n=== Pipeline complete ===')
}

// CLI: node -r ts-node/register src/index.ts [--date YYYY-MM-DD]
const dateArg = process.argv.find(a => a.match(/^\d{4}-\d{2}-\d{2}$/))
runPipeline(dateArg)

// Also schedule nightly at 2am
cron.schedule('0 2 * * *', () => runPipeline())

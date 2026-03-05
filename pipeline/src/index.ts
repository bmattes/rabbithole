import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { fetchMovieEntities } from './wikidata'
import { buildGraph } from './graphBuilder'
import { composePuzzle } from './puzzleComposer'
import { generateNarrative } from './narrativeGenerator'
import cron from 'node-cron'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function generatePuzzlesForCategory(categoryId: string, categoryName: string) {
  console.log(`Generating puzzle for category: ${categoryName}`)

  const entities = await fetchMovieEntities(300)
  const graph = buildGraph(entities)
  const entityIds = entities.map(e => e.id)

  let puzzle = null
  let attempts = 0
  while (!puzzle && attempts < 50) {
    attempts++
    const startId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const endId = entityIds[Math.floor(Math.random() * entityIds.length)]
    if (startId === endId) continue
    puzzle = composePuzzle({ entities, graph, startId, endId })
  }

  if (!puzzle) {
    console.error(`Failed to compose puzzle after ${attempts} attempts`)
    return
  }

  const entityMap = new Map(entities.map(e => [e.id, e]))
  const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)

  const narrative = await generateNarrative({
    startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    pathLabels,
    category: categoryName,
  })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { error } = await supabase.from('puzzles').insert({
    category_id: categoryId,
    date,
    start_concept: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
    end_concept: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
    bubbles: puzzle.bubbles,
    connections: puzzle.connections,
    optimal_path: puzzle.optimalPath,
    narrative,
    status: 'pending_review',
  })

  if (error) console.error('Failed to insert puzzle:', error)
  else console.log(`Puzzle generated for ${date}: ${pathLabels.join(' → ')}`)
}

async function runPipeline() {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('active', true)

  if (!categories) return

  for (const cat of categories) {
    await generatePuzzlesForCategory(cat.id, cat.name)
  }
}

runPipeline()
cron.schedule('0 2 * * *', runPipeline)

console.log('RabbitHole pipeline running. Cron: nightly at 2am.')

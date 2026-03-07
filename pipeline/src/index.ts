import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { CategoryDomain } from './wikidata'
import { fetchEntitiesCached } from './entityCache'
import { buildGraph } from './graphBuilder'
import { composePuzzleForDifficulty, Difficulty } from './puzzleComposer'
import { generateNarrative } from './narrativeGenerator'
import cron from 'node-cron'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

async function generatePuzzleForCategory(
  categoryId: string,
  categoryName: string,
  domain: CategoryDomain,
  date: string
) {
  console.log(`\n[${categoryName}] Fetching entities from Wikidata...`)
  const forceRefresh = process.argv.includes('--refresh-cache')
  const entities = await fetchEntitiesCached(domain, 1500, { forceRefresh })
  console.log(`[${categoryName}] Got ${entities.length} entities`)

  const graph = buildGraph(entities)

  const ANCHOR_TYPES: Record<string, string[]> = {
    movies: ['film'],
    sport: ['person', 'team', 'city'],
    music: ['person', 'song'],
    science: ['person'],
    history: ['person'],
  }
  const anchorTypes = ANCHOR_TYPES[domain] ?? null

  const entityIds = entities
    .filter(e => {
      if (e.relatedIds.length < 2) return false
      if (e.label.length > 30) return false
      if (anchorTypes && e.entityType && !anchorTypes.includes(e.entityType)) return false
      return true
    })
    .map(e => e.id)

  const difficulties: Difficulty[] = ['easy', 'medium', 'hard']

  for (const difficulty of difficulties) {
    // Skip if already published for this date + difficulty
    const { data: existing } = await supabase
      .from('puzzles')
      .select('id')
      .eq('category_id', categoryId)
      .eq('date', date)
      .eq('difficulty', difficulty)
      .eq('status', 'published')
      .single()

    if (existing) {
      console.log(`[${categoryName}/${difficulty}] ✓ Already published for ${date}, skipping`)
      continue
    }

    console.log(`[${categoryName}/${difficulty}] Composing puzzle...`)
    const puzzle = composePuzzleForDifficulty({
      entities,
      graph,
      entityIds,
      targetDifficulty: difficulty,
      maxAttempts: 150,
    })

    if (!puzzle) {
      console.error(`[${categoryName}/${difficulty}] Failed to compose puzzle after 150 attempts`)
      continue
    }

    const entityMap = new Map(entities.map(e => [e.id, e]))
    const pathLabels = puzzle.optimalPath.map(id => entityMap.get(id)?.label ?? id)
    console.log(`[${categoryName}/${difficulty}] Path: ${pathLabels.join(' → ')}`)

    console.log(`[${categoryName}/${difficulty}] Generating narrative...`)
    const narrative = await generateNarrative({
      startLabel: entityMap.get(puzzle.startId)?.label ?? puzzle.startId,
      endLabel: entityMap.get(puzzle.endId)?.label ?? puzzle.endId,
      pathLabels,
      category: categoryName,
    })

    const { data, error } = await supabase.from('puzzles').upsert({
      category_id: categoryId,
      date,
      start_concept: capitalize(entityMap.get(puzzle.startId)?.label ?? puzzle.startId),
      end_concept: capitalize(entityMap.get(puzzle.endId)?.label ?? puzzle.endId),
      bubbles: puzzle.bubbles,
      connections: puzzle.connections,
      optimal_path: puzzle.optimalPath,
      difficulty: puzzle.difficulty,
      narrative,
      status: 'published',
    }, { onConflict: 'category_id,date,difficulty' }).select('id').single()

    if (error) {
      console.error(`[${categoryName}/${difficulty}] DB error:`, error.message)
      continue
    }

    console.log(`[${categoryName}/${difficulty}] ✓ Published puzzle ${data.id}`)
  }
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

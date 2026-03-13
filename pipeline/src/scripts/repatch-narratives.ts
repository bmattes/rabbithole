/**
 * repatch-narratives.ts
 *
 * Regenerates the narrative column for all published puzzles in a date range
 * using the updated prompt (explicit factual relationships per hop).
 * Does NOT touch paths, QC scores, or status — narrative column only.
 *
 * Usage:
 *   npx ts-node src/scripts/repatch-narratives.ts
 *   npx ts-node src/scripts/repatch-narratives.ts --start 2026-03-13 --end 2026-04-11
 *   npx ts-node src/scripts/repatch-narratives.ts --dry-run
 */

import * as dotenv from 'dotenv'
dotenv.config()

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { CONNECTION_TYPES, REVIEWER_PERSONAS } from '../puzzleQC'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const openai = new OpenAI()

const DRY_RUN = process.argv.includes('--dry-run')
const startArg = process.argv.find((a, i) => process.argv[i - 1] === '--start') ?? '2026-03-13'
const endArg   = process.argv.find((a, i) => process.argv[i - 1] === '--end')   ?? '2026-04-11'

async function generateNarrative(
  pathLabels: string[],
  domain: string,
  difficulty: string,
): Promise<string> {
  const connectionType = (CONNECTION_TYPES as any)[domain]?.[difficulty] ?? 'related concepts'
  const personaTier = (REVIEWER_PERSONAS as any)[domain]
  const persona = personaTier?.[difficulty as 'easy' | 'medium' | 'hard']
    ?? 'You are a well-read enthusiast with solid knowledge across many topics.'

  const pathStr = pathLabels.join(' → ')

  const prompt = `${persona}

You are writing the narrative reveal for a solved puzzle in Hops, a daily trivia game where players hop through connected concepts.

The puzzle path is: ${pathStr}
Category: ${domain} | Difficulty: ${difficulty} | Connections via: ${connectionType}

Write a 2-3 sentence narrative that explains HOW each node connects to the next. Every single hop must name the exact factual relationship — not atmosphere, not vague transitions.

Rules:
- For EVERY hop, state the explicit fact: "X is a [type]", "X was directed by Y", "X and Y both starred in Z", "X is set in Y", "X won the Y award", "X is published by Y", "X is a member of Y", etc.
- NEVER use vague filler: "leads to", "connects to", "expands into", "ventures into", "takes us to", "bridges to", "links to"
- Each sentence should feel like a fact you'd find in an encyclopedia entry, not a tour guide monologue
- No flowery intro phrases like "Experience the thrill of..." or "Journey through..."
- Just clear, factual, connected sentences that explain the path

Example for "Saw → Horror film → Apocalypse Now → War film → Dr. Strangelove":
"Saw is classified as a horror film, a genre also claimed by Apocalypse Now — a Vietnam war drama that doubles as a psychological horror. Apocalypse Now is also a war film, a category that includes Dr. Strangelove, Stanley Kubrick's dark comedy about nuclear warfare."

Now write the narrative for: ${pathStr}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}

async function main() {
  console.log(`\n=== Narrative Repatch: ${startArg} → ${endArg}${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`)

  const { data: cats } = await sb.from('categories').select('id, name, wikidata_domain').eq('active', true)
  const catMap = Object.fromEntries((cats ?? []).map((c: any) => [c.id, { name: c.name, domain: c.wikidata_domain }]))

  const { data: puzzles, error } = await sb
    .from('puzzles')
    .select('id, category_id, difficulty, optimal_path, bubbles')
    .eq('status', 'published')
    .gte('date', startArg)
    .lte('date', endArg)
    .order('date', { ascending: true })

  if (error || !puzzles?.length) {
    console.error('No puzzles found:', error?.message)
    return
  }

  console.log(`Found ${puzzles.length} puzzles to repatch\n`)

  let done = 0
  let failed = 0

  for (const puzzle of puzzles) {
    const cat = catMap[puzzle.category_id]
    const domain = cat?.domain ?? puzzle.category_id
    const name = cat?.name ?? domain
    const difficulty: string = puzzle.difficulty

    const bubbleMap: Record<string, string> = {}
    for (const b of (puzzle.bubbles as any[]) ?? []) bubbleMap[b.id] = b.label
    const pathLabels = (puzzle.optimal_path as string[]).map(id => bubbleMap[id] ?? id)

    process.stdout.write(`  [${name}/${difficulty}] ${pathLabels.join(' → ')}\n    → `)

    try {
      const narrative = await generateNarrative(pathLabels, domain, difficulty)

      if (DRY_RUN) {
        console.log(`DRY RUN — narrative would be:\n    "${narrative}"\n`)
      } else {
        const { error: updateError } = await sb
          .from('puzzles')
          .update({ narrative })
          .eq('id', puzzle.id)

        if (updateError) {
          console.log(`ERROR updating: ${updateError.message}`)
          failed++
        } else {
          console.log(`✓ done`)
          done++
        }
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`)
      failed++
    }
  }

  console.log(`\n=== Done: ${done} updated, ${failed} failed ===`)
}

main().catch(console.error)

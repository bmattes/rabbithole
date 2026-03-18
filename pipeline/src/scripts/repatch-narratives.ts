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

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const openai = new OpenAI()

const DRY_RUN = process.argv.includes('--dry-run')
const startArg = process.argv.find((a, i) => process.argv[i - 1] === '--start') ?? '2026-03-13'
const endArg   = process.argv.find((a, i) => process.argv[i - 1] === '--end')   ?? '2026-04-11'

async function generateNarrative(
  pathLabels: string[],
  pathIds: string[],
  edgeLabels: Record<string, string>,
): Promise<string> {
  // Build annotated hop list: "A --[relationship]--> B"
  // Note: edge_labels keys may be stored in either direction; pick whichever exists.
  // For symmetric/ambiguous labels (influenced by, connected to, related to) the direction
  // in the key tells us nothing — just pass the label and let the prompt handle phrasing.
  const hops: string[] = []
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i]
    const b = pathIds[i + 1]
    const rel = edgeLabels[`${a}|${b}`] ?? edgeLabels[`${b}|${a}`] ?? 'connected to'
    hops.push(`${pathLabels[i]} <--[${rel}]--> ${pathLabels[i + 1]}`)
  }
  const hopsStr = hops.join('\n')
  const pathStr = pathLabels.join(' → ')

  const prompt = `You are writing a 2-3 sentence narrative reveal for a puzzle called Hops.

The path, with each hop's verified relationship (direction may be either way — use whichever makes factual sense):
${hopsStr}

Rules:
1. Every sentence must state the factual relationship shown. Use it verbatim or a natural synonym (e.g. "signed to" → "released on", "member of" → "played for", "directed by" → "helmed by", "influenced by" → "drew inspiration from").
2. Do NOT invent facts, people, or connections outside the path above.
3. Write like an excited fan sharing a deep cut — warm and specific, not a tour guide.
4. BANNED words/phrases: "journey", "venture", "dive into", "world of", "realm of", "leads to", "connects to", "Start your", "Begin with", "What a", "Isn't it", "Can you believe", "talk about", "in its own right", "tapestry", "legacy"

Example — path "Saw --[genre]--> Horror film --[genre]--> Apocalypse Now --[genre]--> War film --[genre]--> Dr. Strangelove":
"Saw is a horror film — and so, surprisingly, is Apocalypse Now, Coppola's Vietnam nightmare that doubles as pure psychological dread. Apocalypse Now is also a war film, a genre Dr. Strangelove shares, Kubrick's pitch-black comedy about nuclear annihilation."

Now write the narrative for: ${pathStr}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
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
    .select('id, category_id, difficulty, optimal_path, bubbles, edge_labels')
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
    const pathIds = puzzle.optimal_path as string[]
    const pathLabels = pathIds.map((id: string) => bubbleMap[id] ?? id)
    const edgeLabels = (puzzle.edge_labels ?? {}) as Record<string, string>

    process.stdout.write(`  [${name}/${difficulty}] ${pathLabels.join(' → ')}\n    → `)

    try {
      const narrative = await generateNarrative(pathLabels, pathIds, edgeLabels)

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

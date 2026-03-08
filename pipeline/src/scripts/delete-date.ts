import * as dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'

const date = process.argv[2]
if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
  console.error('Usage: npx ts-node src/scripts/delete-date.ts YYYY-MM-DD')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function run() {
  // First fetch puzzle IDs for the date
  const { data: puzzles, error: fetchError } = await supabase
    .from('puzzles')
    .select('id')
    .eq('date', date)

  if (fetchError) { console.error('Fetch error:', fetchError.message); process.exit(1) }
  if (!puzzles?.length) { console.log(`No puzzles found for ${date}`); process.exit(0) }

  const ids = puzzles.map(p => p.id)
  console.log(`Found ${ids.length} puzzles, deleting player_runs first...`)

  const { error: runsError } = await supabase
    .from('player_runs')
    .delete()
    .in('puzzle_id', ids)

  if (runsError) { console.error('player_runs delete error:', runsError.message); process.exit(1) }

  const { error: puzzleError } = await supabase
    .from('puzzles')
    .delete()
    .eq('date', date)

  if (puzzleError) console.error('puzzles delete error:', puzzleError.message)
  else console.log(`Deleted all puzzles (and their runs) for ${date}`)
  process.exit(0)
}

run()

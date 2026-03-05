import { supabase } from './supabase'

export interface Puzzle {
  id: string
  category_id: string
  date: string
  start_concept: string
  end_concept: string
  bubbles: Array<{ id: string; label: string; position: { x: number; y: number } }>
  connections: Record<string, string[]>
  optimal_path: string[]
  narrative: string | null
}

export async function getTodaysPuzzle(categoryId: string): Promise<Puzzle | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('date', today)
    .eq('status', 'published')
    .single()

  if (error) return null
  return data as Puzzle
}

export async function submitRun({
  puzzleId,
  userId,
  path,
  timeMs,
  score,
}: {
  puzzleId: string
  userId: string
  path: string[]
  timeMs: number
  score: number
}): Promise<void> {
  await supabase.from('player_runs').insert({
    puzzle_id: puzzleId,
    user_id: userId,
    path,
    time_ms: timeMs,
    score,
  })
}

export async function getLeaderboard(puzzleId: string) {
  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('puzzle_id', puzzleId)
    .order('rank', { ascending: true })
    .limit(50)
  return data ?? []
}

export async function getLeaderboardToday() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('player_runs')
    .select('user_id, score, time_ms, users(display_name), puzzles(date, start_concept, end_concept)')
    .eq('puzzles.date', today)
    .order('score', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function getCategories() {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
  return data ?? []
}

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
  difficulty?: 'easy' | 'medium' | 'hard'
  domain?: string
}

export function localDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isInFreeArchive(puzzleDateStr: string): boolean {
  const [y, m, d] = puzzleDateStr.split('-').map(Number)
  const puzzleDate = new Date(y, m - 1, d) // local midnight — avoids UTC-shift from date-only ISO strings
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  // Compare date-only (zero out time component)
  cutoff.setHours(0, 0, 0, 0)
  return puzzleDate >= cutoff
}

export async function getTodaysPuzzle(
  categoryId: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'easy'
): Promise<Puzzle | null> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('category_id', categoryId)
    .eq('difficulty', difficulty)
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (error) return null

  const { data: cat } = await supabase
    .from('categories')
    .select('wikidata_domain')
    .eq('id', categoryId)
    .single()

  return { ...data, domain: cat?.wikidata_domain ?? null } as Puzzle
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
  console.log('[submitRun]', { puzzleId, userId, score })

  // Ensure user row exists before inserting run (FK constraint)
  // ignoreDuplicates: true — don't overwrite display_name if already set
  const { error: userError } = await supabase.from('users').upsert({
    id: userId,
    display_name: `Player${Math.floor(Math.random() * 9999)}`,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (userError) console.error('[submitRun] user upsert failed:', userError.message, userError.code)
  else console.log('[submitRun] user upsert ok')

  const { error } = await supabase.from('player_runs').upsert({
    puzzle_id: puzzleId,
    user_id: userId,
    path,
    time_ms: timeMs,
    score,
  }, { onConflict: 'puzzle_id,user_id' })
  if (error) console.error('[submitRun] run upsert failed:', error.message, error.code)
  else console.log('[submitRun] run upsert ok')
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
  // Fetch the most recent published puzzles (one per category) — no date filter
  const { data: puzzles } = await supabase
    .from('puzzles')
    .select('id')
    .eq('status', 'published')

  if (!puzzles || puzzles.length === 0) return []

  const puzzleIds = puzzles.map(p => p.id)

  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, display_name, score, time_ms, puzzle_id')
    .in('puzzle_id', puzzleIds)
    .order('score', { ascending: false })
    .limit(50)

  if (error) console.error('[getLeaderboardToday] error:', error.message)
  return data ?? []
}

export async function getLeaderboardForCategory(categoryId: string) {
  // Get most recent published puzzle for this category
  const { data: puzzle } = await supabase
    .from('puzzles')
    .select('id')
    .eq('category_id', categoryId)
    .eq('status', 'published')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (!puzzle) return []

  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, display_name, score, time_ms')
    .eq('puzzle_id', puzzle.id)
    .order('score', { ascending: false })
    .limit(50)

  if (error) console.error('[getLeaderboardForCategory] error:', error.message)
  return data ?? []
}

export async function getCategories(userId?: string | null) {
  const { data: cats } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
  if (!cats) return []

  // For each category, fetch the latest puzzle id+difficulty, and check if user completed it
  const enriched = await Promise.all(
    cats.map(async cat => {
      const { data: puzzle } = await supabase
        .from('puzzles')
        .select('id, difficulty')
        .eq('category_id', cat.id)
        .eq('status', 'published')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      let completed = false
      if (puzzle && userId) {
        const { data: run } = await supabase
          .from('player_runs')
          .select('puzzle_id')
          .eq('puzzle_id', puzzle.id)
          .eq('user_id', userId)
          .limit(1)
          .single()
        completed = !!run
      }

      return { ...cat, difficulty: puzzle?.difficulty ?? null, completed }
    })
  )
  return enriched
}

import AsyncStorage from '@react-native-async-storage/async-storage'

const DISPLAY_NAME_KEY = 'rh_display_name'

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  if (!trimmed) return
  const { error } = await supabase.from('users').update({ display_name: trimmed }).eq('id', userId)
  if (error) { console.error('[updateDisplayName] error:', error.message); return }
  await AsyncStorage.setItem(DISPLAY_NAME_KEY, trimmed)
}

export async function getDisplayName(userId: string): Promise<string | null> {
  // Return cached value immediately, then sync from Supabase in background
  const cached = await AsyncStorage.getItem(DISPLAY_NAME_KEY)
  if (cached) return cached
  const { data } = await supabase.from('users').select('display_name').eq('id', userId).single()
  const name = data?.display_name ?? null
  if (name) await AsyncStorage.setItem(DISPLAY_NAME_KEY, name)
  return name
}

export async function getMyRuns(userId: string) {
  const { data, error } = await supabase
    .from('player_runs')
    .select('puzzle_id, score, time_ms, path, created_at, puzzles(category_id, start_concept, end_concept, categories(name, wikidata_domain))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) console.error('[getMyRuns] error:', error.message)
  return data ?? []
}

export async function awardXP({
  userId,
  xp,
  playedDate,
}: {
  userId: string
  xp: number
  playedDate: string // 'YYYY-MM-DD'
}): Promise<{ totalXP: number; newStreak: number }> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('total_xp, streak, last_played_date')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    console.error('[awardXP] fetch failed:', fetchError?.message)
    return { totalXP: 0, newStreak: 0 }
  }

  const lastPlayed = user.last_played_date as string | null
  const yesterday = new Date(playedDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = user.streak as number
  if (lastPlayed === yesterdayStr) {
    newStreak = (user.streak as number) + 1
  } else if (lastPlayed !== playedDate) {
    newStreak = 1
  }

  const newTotalXP = (user.total_xp as number) + xp

  const { error: updateError } = await supabase
    .from('users')
    .update({
      total_xp: newTotalXP,
      streak: newStreak,
      last_played_date: playedDate,
    })
    .eq('id', userId)

  if (updateError) {
    console.error('[awardXP] update failed:', updateError.message)
    return { totalXP: 0, newStreak: 0 }
  }

  return { totalXP: newTotalXP, newStreak }
}

export async function getProgression(userId: string): Promise<{
  totalXP: number
  streak: number
  unlockedCategories: string[]
  isSubscriber: boolean
} | null> {
  const { data, error } = await supabase
    .from('users')
    .select('total_xp, streak, unlocked_categories, is_subscriber')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  return {
    totalXP: (data.total_xp as number) ?? 0,
    streak: (data.streak as number) ?? 0,
    unlockedCategories: (data.unlocked_categories as string[]) ?? [],
    isSubscriber: (data.is_subscriber as boolean) ?? false,
  }
}

export async function saveUnlockedCategory(userId: string, categoryId: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('users')
    .select('unlocked_categories')
    .eq('id', userId)
    .single()

  if (fetchError) {
    console.error('[saveUnlockedCategory] fetch failed:', fetchError.message)
    return
  }

  const current: string[] = (data?.unlocked_categories as string[]) ?? []
  if (current.includes(categoryId)) return

  const { error } = await supabase
    .from('users')
    .update({ unlocked_categories: [...current, categoryId] })
    .eq('id', userId)

  if (error) console.error('[saveUnlockedCategory] update failed:', error.message)
}

import { supabase } from './supabase'
import { computeRunXP } from './progression'

export interface Puzzle {
  id: string
  category_id: string
  date: string
  start_concept: string
  end_concept: string
  bubbles: Array<{ id: string; label: string; position: { x: number; y: number } }>
  connections: Record<string, string[]>
  optimal_path: string[]
  alternative_paths: string[][] | null
  narrative: string | null
  difficulty?: 'easy' | 'medium' | 'hard'
  domain?: string
  edgeLabels?: Record<string, string>  // "idA|idB" → "cast member of"
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
    .eq('date', localDateString())
    .single()

  if (error) return null

  const { data: cat } = await supabase
    .from('categories')
    .select('wikidata_domain')
    .eq('id', categoryId)
    .single()

  return {
    ...data,
    domain: cat?.wikidata_domain ?? null,
    edgeLabels: (data.edge_labels as Record<string, string>) ?? undefined,
  } as Puzzle
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

  const { error } = await supabase.from('player_runs').insert({
    puzzle_id: puzzleId,
    user_id: userId,
    path,
    time_ms: timeMs,
    score,
  })
  if (error) console.error('[submitRun] run insert failed:', error.message, error.code)
  else console.log('[submitRun] run insert ok')
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

export async function getLeaderboardForCategory(categoryId: string, difficulty: 'easy' | 'medium' | 'hard' = 'easy') {
  const { data: puzzle } = await supabase
    .from('puzzles')
    .select('id')
    .eq('category_id', categoryId)
    .eq('status', 'published')
    .eq('difficulty', difficulty)
    .eq('date', localDateString())
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

export async function getCategories(userId?: string | null, difficulty: 'easy' | 'medium' | 'hard' = 'easy') {
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
        .eq('difficulty', difficulty)
        .eq('date', localDateString())
        .single()

      let completed = false
      if (userId) {
        // Check if user completed any puzzle for this category today
        const { data: run } = await supabase
          .from('player_runs')
          .select('puzzle_id')
          .eq('user_id', userId)
          .in('puzzle_id', await supabase
            .from('puzzles')
            .select('id')
            .eq('category_id', cat.id)
            .eq('status', 'published')
            .eq('date', localDateString())
            .then(r => (r.data ?? []).map((p: { id: string }) => p.id))
          )
          .limit(1)
          .maybeSingle()
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
    .select('puzzle_id, score, time_ms, path, created_at, puzzles(category_id, start_concept, end_concept, optimal_path, narrative, difficulty, bubbles, categories(name, wikidata_domain))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) console.error('[getMyRuns] error:', error.message)
  return data ?? []
}

export async function awardXP({
  userId,
  difficulty,
  isOptimalPath,
  timeMs,
  playedDate,
}: {
  userId: string
  difficulty: 'easy' | 'medium' | 'hard'
  isOptimalPath: boolean
  timeMs: number
  playedDate: string // 'YYYY-MM-DD'
}): Promise<{ earnedXP: number; totalXP: number; newStreak: number }> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('total_xp, streak, last_played_date')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    console.error('[awardXP] fetch failed:', fetchError?.message)
    return { earnedXP: 0, totalXP: 0, newStreak: 0 }
  }

  const lastPlayed = user.last_played_date as string | null
  const yesterday = new Date(playedDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Compute new streak first so streakDay is accurate for XP calculation
  let newStreak = user.streak as number
  if (lastPlayed === yesterdayStr) {
    newStreak = (user.streak as number) + 1
  } else if (lastPlayed !== playedDate) {
    newStreak = 1
  }

  const earnedXP = computeRunXP({ difficulty, isOptimalPath, timeMs, streakDay: newStreak })
  const newTotalXP = (user.total_xp as number) + earnedXP

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
    return { earnedXP: 0, totalXP: 0, newStreak: 0 }
  }

  return { earnedXP, totalXP: newTotalXP, newStreak }
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
  return saveUnlockedCategories(userId, [categoryId])
}

export async function saveUnlockedCategories(userId: string, categoryIds: string[]): Promise<void> {
  // Upsert: create the user row if it doesn't exist yet (onboarding case),
  // or merge new category IDs into the existing array.
  const { data: existing } = await supabase
    .from('users')
    .select('unlocked_categories')
    .eq('id', userId)
    .maybeSingle()

  const current: string[] = (existing?.unlocked_categories as string[]) ?? []
  const merged = [...new Set([...current, ...categoryIds])]

  // Insert with a placeholder display_name (not-null constraint);
  // on conflict (user already exists) only update unlocked_categories.
  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({ unlocked_categories: merged })
      .eq('id', userId)
    if (error) console.error('[saveUnlockedCategories] update failed:', error.message)
  } else {
    const { error } = await supabase
      .from('users')
      .insert({ id: userId, display_name: `Player${Math.floor(Math.random() * 9999)}`, unlocked_categories: merged })
    if (error) console.error('[saveUnlockedCategories] insert failed:', error.message)
  }

}

export async function getPathStats(
  puzzleId: string,
  playerHops: number,
  optimalHops: number,
  userId?: string | null
): Promise<{ totalPlayers: number; optimalPathPct: number; sameHopsPct: number }> {
  let query = supabase
    .from('player_runs')
    .select('path')
    .eq('puzzle_id', puzzleId)

  if (userId) {
    query = query.neq('user_id', userId)
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { totalPlayers: 0, optimalPathPct: 0, sameHopsPct: 0 }
  }

  const total = data.length
  const hopCounts = data.map(r => (r.path as string[]).length - 1)
  const optimalCount = hopCounts.filter(h => h === optimalHops).length
  const sameHopsCount = hopCounts.filter(h => h === playerHops).length

  return {
    totalPlayers: total,
    optimalPathPct: Math.round((optimalCount / total) * 100),
    sameHopsPct: Math.round((sameHopsCount / total) * 100),
  }
}

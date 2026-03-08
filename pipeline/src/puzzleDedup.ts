/**
 * puzzleDedup.ts
 *
 * Cross-day puzzle deduplication.
 * Fetches recent published paths for a domain and checks if a candidate
 * path is too similar to any of them.
 *
 * Rules:
 *  1. Exact path match → always reject (any date)
 *  2. Same start/end anchors used in last 7 days → reject
 *  3. Shares 3+ consecutive nodes with any prior path (last 30 days) → reject
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface DedupResult {
  isDuplicate: boolean
  reason?: string
}

/** Fetch all optimal_path arrays for a domain in the past N days (excluding today). */
async function fetchRecentPaths(
  supabase: SupabaseClient,
  categoryId: string,
  difficulty: string,
  today: string,
  days: number,
): Promise<string[][]> {
  // date N days ago
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('puzzles')
    .select('optimal_path')
    .eq('category_id', categoryId)
    .eq('difficulty', difficulty)
    .eq('status', 'published')
    .gte('date', cutoffStr)
    .lt('date', today)

  if (error || !data) return []
  return data.map((row: any) => row.optimal_path as string[]).filter(Boolean)
}

/** Check if two paths share N or more consecutive nodes. */
function hasConsecutiveOverlap(a: string[], b: string[], minRun: number): boolean {
  for (let i = 0; i <= a.length - minRun; i++) {
    const sub = a.slice(i, i + minRun).join('|')
    for (let j = 0; j <= b.length - minRun; j++) {
      if (b.slice(j, j + minRun).join('|') === sub) return true
    }
  }
  return false
}

/**
 * Check whether a candidate path is too similar to recent puzzles for this domain.
 *
 * @param supabase     Supabase client
 * @param categoryId   UUID of this domain's category row
 * @param difficulty   'easy' | 'medium' | 'hard'
 * @param today        YYYY-MM-DD — the date being published
 * @param candidatePath  Array of Wikidata/MB IDs for the proposed optimal path
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  categoryId: string,
  difficulty: string,
  today: string,
  candidatePath: string[],
): Promise<DedupResult> {
  const [paths30, paths7] = await Promise.all([
    fetchRecentPaths(supabase, categoryId, difficulty, today, 30),
    fetchRecentPaths(supabase, categoryId, difficulty, today, 7),
  ])

  const startId = candidatePath[0]
  const endId = candidatePath[candidatePath.length - 1]
  const candidateKey = candidatePath.join('|')

  // Rule 1: exact path match in last 30 days
  for (const prior of paths30) {
    if (prior.join('|') === candidateKey) {
      return { isDuplicate: true, reason: 'exact path repeated from prior day' }
    }
  }

  // Rule 2: same start/end anchors in last 7 days
  for (const prior of paths7) {
    const priorStart = prior[0]
    const priorEnd = prior[prior.length - 1]
    if (priorStart === startId && priorEnd === endId) {
      return { isDuplicate: true, reason: `same start/end anchors used within last 7 days` }
    }
    // Also reject reversed anchor pair
    if (priorStart === endId && priorEnd === startId) {
      return { isDuplicate: true, reason: `reversed start/end anchors used within last 7 days` }
    }
  }

  // Rule 3: 3+ consecutive node overlap in last 30 days
  for (const prior of paths30) {
    if (hasConsecutiveOverlap(candidatePath, prior, 3)) {
      return { isDuplicate: true, reason: `shares 3+ consecutive nodes with a prior path` }
    }
  }

  return { isDuplicate: false }
}

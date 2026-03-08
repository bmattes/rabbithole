import { useEffect, useState } from 'react'
import { getTodaysPuzzle, Puzzle } from '../lib/api'
import { supabase } from '../lib/supabase'

export function usePuzzle(
  categoryId: string,
  userId?: string | null,
  difficulty: 'easy' | 'medium' | 'hard' = 'easy'
) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getTodaysPuzzle(categoryId, difficulty)
      .then(async (p) => {
        if (!p) { setError('No puzzle found for today'); return }
        // Check if user already has a run for this puzzle
        const { data: existing } = await supabase
          .from('player_runs')
          .select('puzzle_id')
          .eq('puzzle_id', p.id)
          .eq('user_id', userId)
          .limit(1)
          .single()
        if (existing) {
          setAlreadyCompleted(true)
        } else {
          setPuzzle(p)
        }
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false))
  }, [categoryId, userId, difficulty])

  return { puzzle, loading, error, alreadyCompleted }
}

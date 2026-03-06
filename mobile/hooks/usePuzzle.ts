import { useEffect, useState } from 'react'
import { getTodaysPuzzle, Puzzle } from '../lib/api'

export function usePuzzle(categoryId: string, userId?: string | null) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getTodaysPuzzle(categoryId)
      .then((p) => {
        if (!p) setError('No puzzle found for today')
        else setPuzzle(p)
      })
      .catch(() => setError('Failed to load puzzle'))
      .finally(() => setLoading(false))
  }, [categoryId, userId])

  return { puzzle, loading, error }
}

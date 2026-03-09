import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const DAILY_HINT_LIMIT = 3

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface HintsState {
  hintsRemaining: number
  loading: boolean
  useHint: () => Promise<boolean>
  refresh: () => void
}

export function useHints(userId: string | null): HintsState {
  const [hintsUsed, setHintsUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = useMemo(() => localDateString(), [])
  const inFlightRef = useRef(false)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('hint_usages')
      .select('hints_used')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()
    setHintsUsed(data?.hints_used ?? 0)
    setLoading(false)
  }, [userId, today])

  useEffect(() => { load() }, [load])

  const useHint = useCallback(async (): Promise<boolean> => {
    if (!userId || hintsUsed >= DAILY_HINT_LIMIT || inFlightRef.current) return false
    inFlightRef.current = true
    const next = hintsUsed + 1
    setHintsUsed(next)  // optimistic update
    const { error } = await supabase
      .from('hint_usages')
      .upsert({ user_id: userId, usage_date: today, hints_used: next }, { onConflict: 'user_id,usage_date' })
    inFlightRef.current = false
    if (error) {
      setHintsUsed(hintsUsed)  // revert on error
      return false
    }
    return true
  }, [userId, hintsUsed, today])

  return {
    hintsRemaining: Math.max(0, DAILY_HINT_LIMIT - hintsUsed),
    loading,
    useHint,
    refresh: load,
  }
}

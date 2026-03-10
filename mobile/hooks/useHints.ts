import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { HintType } from '../components/HintTray'

const DAILY_LIMIT_PER_TYPE = 3

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type UsedCounts = Record<HintType, number>

const EMPTY_COUNTS: UsedCounts = { connection: 0, shuffle: 0, flash: 0, bridge: 0 }

export interface HintsState {
  remainingByType: Record<HintType, number>
  loading: boolean
  useHint: (type: HintType) => Promise<boolean>
  refresh: () => void
}

export function useHints(userId: string | null): HintsState {
  const [used, setUsed] = useState<UsedCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(true)
  const today = useMemo(() => localDateString(), [])
  const inFlightRef = useRef(false)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('hint_usages')
      .select('connection_used, shuffle_used, flash_used, bridge_used')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()
    if (data) {
      setUsed({
        connection: data.connection_used ?? 0,
        shuffle:    data.shuffle_used    ?? 0,
        flash:      data.flash_used      ?? 0,
        bridge:     data.bridge_used     ?? 0,
      })
    } else {
      setUsed(EMPTY_COUNTS)
    }
    setLoading(false)
  }, [userId, today])

  useEffect(() => { load() }, [load])

  const useHint = useCallback(async (type: HintType): Promise<boolean> => {
    if (!userId || used[type] >= DAILY_LIMIT_PER_TYPE || inFlightRef.current) return false
    inFlightRef.current = true
    const next = { ...used, [type]: used[type] + 1 }
    setUsed(next)  // optimistic update
    const col = `${type}_used` as const
    const { error } = await supabase
      .from('hint_usages')
      .upsert(
        { user_id: userId, usage_date: today, [col]: next[type] },
        { onConflict: 'user_id,usage_date' }
      )
    inFlightRef.current = false
    if (error) {
      setUsed(used)  // revert on error
      return false
    }
    return true
  }, [userId, used, today])

  return {
    remainingByType: {
      connection: Math.max(0, DAILY_LIMIT_PER_TYPE - used.connection),
      shuffle:    Math.max(0, DAILY_LIMIT_PER_TYPE - used.shuffle),
      flash:      Math.max(0, DAILY_LIMIT_PER_TYPE - used.flash),
      bridge:     Math.max(0, DAILY_LIMIT_PER_TYPE - used.bridge),
    },
    loading,
    useHint,
    refresh: load,
  }
}

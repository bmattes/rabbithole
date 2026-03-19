import { useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getProgression } from '../lib/api'
import {
  levelFromXP,
  titleForLevel,
  xpProgressInCurrentLevel,
  getUnlockedDifficulties,
  getCategorySlotCount,
  type Difficulty,
} from '../lib/progression'

const PROGRESSION_CACHE_KEY = 'rh_progression_cache'

export interface ProgressionState {
  totalXP: number
  level: number
  title: string
  xpInLevel: number
  xpForNextLevel: number
  streak: number
  unlockedCategories: string[]
  unlockedDifficulties: Difficulty[]
  categorySlots: number
  isSubscriber: boolean
  loading: boolean
  refresh: () => void
}

export function useProgression(userId: string | null): ProgressionState {
  const [totalXP, setTotalXP] = useState(0)
  const [streak, setStreak] = useState(0)
  const [unlockedCategories, setUnlockedCategories] = useState<string[]>([])
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [loading, setLoading] = useState(userId !== null)

  // Load cached progression instantly on mount, then fetch from Supabase
  useEffect(() => {
    if (!userId) return
    AsyncStorage.getItem(PROGRESSION_CACHE_KEY).then(raw => {
      if (!raw) return
      try {
        const cached = JSON.parse(raw)
        if (cached.userId === userId) {
          setTotalXP(cached.totalXP ?? 0)
          setStreak(cached.streak ?? 0)
          setUnlockedCategories(cached.unlockedCategories ?? [])
          setIsSubscriber(cached.isSubscriber ?? false)
        }
      } catch {}
    })
  }, [userId])

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await getProgression(userId)
    if (data) {
      setTotalXP(data.totalXP)
      setStreak(data.streak)
      setUnlockedCategories(data.unlockedCategories)
      setIsSubscriber(data.isSubscriber)
      // Persist to cache for instant load on next relaunch
      AsyncStorage.setItem(PROGRESSION_CACHE_KEY, JSON.stringify({
        userId,
        totalXP: data.totalXP,
        streak: data.streak,
        unlockedCategories: data.unlockedCategories,
        isSubscriber: data.isSubscriber,
      }))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const level = levelFromXP(totalXP)
  const title = titleForLevel(level)
  const { current: xpInLevel, required: xpForNextLevel } = xpProgressInCurrentLevel(totalXP)

  return {
    totalXP,
    level,
    title,
    xpInLevel,
    xpForNextLevel,
    streak,
    unlockedCategories,
    unlockedDifficulties: __DEV__ ? ['easy'] : getUnlockedDifficulties(level),
    categorySlots: getCategorySlotCount(level),
    isSubscriber,
    loading,
    refresh: load,
  }
}

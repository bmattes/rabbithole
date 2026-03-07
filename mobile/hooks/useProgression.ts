import { useEffect, useState, useCallback } from 'react'
import { getProgression } from '../lib/api'
import {
  levelFromXP,
  titleForLevel,
  xpProgressInCurrentLevel,
  getUnlockedDifficulties,
  getCategorySlotCount,
  type Difficulty,
} from '../lib/progression'

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
    unlockedDifficulties: getUnlockedDifficulties(level),
    categorySlots: getCategorySlotCount(level),
    isSubscriber,
    loading,
    refresh: load,
  }
}

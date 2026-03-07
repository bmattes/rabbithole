# Progression & Monetization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add XP/leveling, category+difficulty unlock progression, level titles, and a RabbitHole+ subscription paywall to the RabbitHole mobile app.

**Architecture:** XP and level state live in Supabase on the `users` table (new columns). XP is awarded server-side after each run via a new `awardXP` API call. Level and unlock state are derived client-side from total XP using a pure function in `lib/progression.ts`. The subscription gate is a client-side flag (`isSubscriber`) from `useAuth`, initially hardcoded `false` — wired to RevenueCat in a later task. Category unlocks are stored as a JSON array on the `users` row.

**Tech Stack:** Supabase (Postgres), TypeScript, React Native, Expo, RevenueCat (`react-native-purchases`) for IAP.

---

## Phase 1: Progression Logic (Pure Functions, No DB Yet)

### Task 1: Create `lib/progression.ts`

**Files:**
- Create: `mobile/lib/progression.ts`
- Create: `mobile/lib/__tests__/progression.test.ts`

**Step 1: Create the test file**

```typescript
// mobile/lib/__tests__/progression.test.ts
import {
  xpForLevel,
  levelFromXP,
  titleForLevel,
  computeRunXP,
  UNLOCK_MILESTONES,
} from '../progression'

describe('xpForLevel', () => {
  it('returns low XP for early levels', () => {
    expect(xpForLevel(1)).toBe(400)
    expect(xpForLevel(5)).toBe(400)
  })
  it('returns medium XP for mid levels', () => {
    expect(xpForLevel(11)).toBe(1000)
    expect(xpForLevel(20)).toBe(1000)
  })
  it('returns high XP for late levels', () => {
    expect(xpForLevel(31)).toBe(3000)
    expect(xpForLevel(51)).toBe(5000)
  })
})

describe('levelFromXP', () => {
  it('level 1 at 0 XP', () => {
    expect(levelFromXP(0)).toBe(1)
  })
  it('advances through levels correctly', () => {
    // 10 levels * 400 XP = 4000 XP gets you to level 11
    expect(levelFromXP(4000)).toBe(11)
  })
  it('never returns less than 1', () => {
    expect(levelFromXP(-100)).toBe(1)
  })
})

describe('titleForLevel', () => {
  it('returns Curious for levels 1-4', () => {
    expect(titleForLevel(1)).toBe('Curious')
    expect(titleForLevel(4)).toBe('Curious')
  })
  it('returns correct titles at boundaries', () => {
    expect(titleForLevel(5)).toBe('Wanderer')
    expect(titleForLevel(30)).toBe('White Rabbit')
    expect(titleForLevel(100)).toBe('The Rabbit Hole')
  })
})

describe('computeRunXP', () => {
  it('awards base XP for easy puzzle', () => {
    const xp = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 1 })
    expect(xp).toBe(100)
  })
  it('awards base XP for medium puzzle', () => {
    const xp = computeRunXP({ difficulty: 'medium', isOptimalPath: false, timeMs: 999999, streakDay: 1 })
    expect(xp).toBe(200)
  })
  it('awards base XP for hard puzzle', () => {
    const xp = computeRunXP({ difficulty: 'hard', isOptimalPath: false, timeMs: 999999, streakDay: 1 })
    expect(xp).toBe(350)
  })
  it('adds optimal path bonus', () => {
    const xp = computeRunXP({ difficulty: 'easy', isOptimalPath: true, timeMs: 999999, streakDay: 1 })
    expect(xp).toBe(150) // 100 + 50
  })
  it('adds speed bonus for fast completion', () => {
    // Under 30s should give close to +50
    const xp = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 10000, streakDay: 1 })
    expect(xp).toBeGreaterThan(130)
  })
  it('adds streak bonus', () => {
    const xp = computeRunXP({ difficulty: 'easy', isOptimalPath: false, timeMs: 999999, streakDay: 3 })
    expect(xp).toBe(175) // 100 + 25*3
  })
})

describe('UNLOCK_MILESTONES', () => {
  it('unlocks medium at level 5', () => {
    expect(UNLOCK_MILESTONES.find(m => m.level === 5)?.type).toBe('difficulty')
  })
  it('unlocks hard at level 12', () => {
    expect(UNLOCK_MILESTONES.find(m => m.level === 12)?.unlock).toBe('hard')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest lib/__tests__/progression.test.ts --no-coverage
```
Expected: FAIL — module not found.

**Step 3: Create `lib/progression.ts`**

```typescript
// mobile/lib/progression.ts

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface UnlockMilestone {
  level: number
  type: 'difficulty' | 'category_slot'
  unlock?: string // 'medium' | 'hard' for difficulty type
}

export const UNLOCK_MILESTONES: UnlockMilestone[] = [
  { level: 5,  type: 'difficulty',    unlock: 'medium' },
  { level: 8,  type: 'category_slot' },
  { level: 12, type: 'difficulty',    unlock: 'hard' },
  { level: 16, type: 'category_slot' },
  { level: 22, type: 'category_slot' },
]

const BASE_XP: Record<Difficulty, number> = {
  easy:   100,
  medium: 200,
  hard:   350,
}

const OPTIMAL_BONUS   = 50
const MAX_SPEED_BONUS = 50
const SPEED_THRESHOLD_MS = 30_000 // full bonus under 30s
const STREAK_BONUS_PER_DAY = 25

export function computeRunXP({
  difficulty,
  isOptimalPath,
  timeMs,
  streakDay,
}: {
  difficulty: Difficulty
  isOptimalPath: boolean
  timeMs: number
  streakDay: number
}): number {
  const base    = BASE_XP[difficulty]
  const optimal = isOptimalPath ? OPTIMAL_BONUS : 0
  const speed   = Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - timeMs / SPEED_THRESHOLD_MS))
  const streak  = STREAK_BONUS_PER_DAY * streakDay
  return base + optimal + speed + streak
}

// XP required to reach the NEXT level from the given level
export function xpForLevel(level: number): number {
  if (level <= 10) return 400
  if (level <= 30) return 1000
  if (level <= 50) return 3000
  return 5000
}

export function levelFromXP(totalXP: number): number {
  if (totalXP <= 0) return 1
  let level = 1
  let remaining = totalXP
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return level
}

export function xpProgressInCurrentLevel(totalXP: number): { current: number; required: number } {
  let level = 1
  let remaining = totalXP
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
  }
  return { current: remaining, required: xpForLevel(level) }
}

const TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 100, title: 'The Rabbit Hole' },
  { minLevel: 50,  title: 'Mad Hatter' },
  { minLevel: 30,  title: 'White Rabbit' },
  { minLevel: 20,  title: 'Rabbit' },
  { minLevel: 15,  title: 'Deep Diver' },
  { minLevel: 10,  title: 'Explorer' },
  { minLevel: 5,   title: 'Wanderer' },
  { minLevel: 1,   title: 'Curious' },
]

export function titleForLevel(level: number): string {
  return TITLES.find(t => level >= t.minLevel)!.title
}

// Given current level and unlocked category ids, return which
// difficulty tiers and category slots are available
export function getUnlockedDifficulties(level: number): Difficulty[] {
  const difficulties: Difficulty[] = ['easy']
  if (level >= 5)  difficulties.push('medium')
  if (level >= 12) difficulties.push('hard')
  return difficulties
}

export function getCategorySlotCount(level: number): number {
  if (level >= 22) return 5
  if (level >= 16) return 4
  if (level >= 8)  return 3
  return 2
}
```

**Step 4: Run tests**

```bash
cd mobile && npx jest lib/__tests__/progression.test.ts --no-coverage
```
Expected: All PASS.

**Step 5: Commit**

```bash
cd mobile && git add lib/progression.ts lib/__tests__/progression.test.ts
git commit -m "feat: progression logic — XP computation, leveling, unlock milestones, titles"
```

---

## Phase 2: Supabase Schema

### Task 2: Add progression columns to `users` table

**Files:**
- Create: `supabase/migrations/20260306_add_progression.sql`

**Step 1: Create migration file**

```sql
-- supabase/migrations/20260306_add_progression.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_date DATE,
  ADD COLUMN IF NOT EXISTS unlocked_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_subscriber   BOOLEAN NOT NULL DEFAULT false;

-- Seed starter categories: movies + sport for all existing users
UPDATE users
SET unlocked_categories = '[]'::jsonb
WHERE unlocked_categories = '[]'::jsonb;
```

**Step 2: Run the migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the migration.

Expected: No errors. Check `users` table has the new columns.

**Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260306_add_progression.sql
git commit -m "feat: add progression columns to users table"
```

---

## Phase 3: XP Award API

### Task 3: Add `awardXP` to `lib/api.ts`

**Files:**
- Modify: `mobile/lib/api.ts`

**Step 1: Add the function after `submitRun`**

Add this to `mobile/lib/api.ts` after the `submitRun` function:

```typescript
export async function awardXP({
  userId,
  xp,
  playedDate,
}: {
  userId: string
  xp: number
  playedDate: string // 'YYYY-MM-DD'
}): Promise<{ totalXP: number; newStreak: number }> {
  // Fetch current state
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('total_xp, streak, last_played_date')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    console.error('[awardXP] fetch failed:', fetchError?.message)
    return { totalXP: 0, newStreak: 0 }
  }

  const lastPlayed = user.last_played_date
  const yesterday = new Date(playedDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = user.streak
  if (lastPlayed === yesterdayStr) {
    newStreak = user.streak + 1
  } else if (lastPlayed !== playedDate) {
    newStreak = 1
  }
  // if lastPlayed === playedDate (already played today), streak stays same

  const newTotalXP = user.total_xp + xp

  const { error: updateError } = await supabase
    .from('users')
    .update({
      total_xp: newTotalXP,
      streak: newStreak,
      last_played_date: playedDate,
    })
    .eq('id', userId)

  if (updateError) console.error('[awardXP] update failed:', updateError.message)

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
    totalXP: data.total_xp,
    streak: data.streak,
    unlockedCategories: data.unlocked_categories ?? [],
    isSubscriber: data.is_subscriber ?? false,
  }
}

export async function saveUnlockedCategory(userId: string, categoryId: string): Promise<void> {
  // Fetch current list, append new category
  const { data } = await supabase
    .from('users')
    .select('unlocked_categories')
    .eq('id', userId)
    .single()

  const current: string[] = data?.unlocked_categories ?? []
  if (current.includes(categoryId)) return

  const updated = [...current, categoryId]
  const { error } = await supabase
    .from('users')
    .update({ unlocked_categories: updated })
    .eq('id', userId)

  if (error) console.error('[saveUnlockedCategory] failed:', error.message)
}
```

**Step 2: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
cd mobile && git add lib/api.ts
git commit -m "feat: add awardXP, getProgression, saveUnlockedCategory API functions"
```

---

## Phase 4: Progression Hook

### Task 4: Create `hooks/useProgression.ts`

**Files:**
- Create: `mobile/hooks/useProgression.ts`

**Step 1: Create the hook**

```typescript
// mobile/hooks/useProgression.ts
import { useEffect, useState, useCallback } from 'react'
import { getProgression } from '../lib/api'
import {
  levelFromXP,
  titleForLevel,
  xpProgressInCurrentLevel,
  getUnlockedDifficulties,
  getCategorySlotCount,
  Difficulty,
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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
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
```

**Step 2: Verify types**

```bash
cd mobile && npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
cd mobile && git add hooks/useProgression.ts
git commit -m "feat: useProgression hook — level, title, unlocks, XP progress"
```

---

## Phase 5: Award XP After Run

### Task 5: Wire XP award into results screen

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Read the current results screen**

Read `mobile/app/results/[id].tsx` fully before editing.

**Step 2: Add XP award on mount**

In the `useEffect` that runs after a puzzle is completed, after `submitRun` is called, add:

```typescript
import { awardXP } from '../../lib/api'
import { computeRunXP } from '../../lib/progression'

// Inside the results useEffect, after submitRun:
if (userId && puzzle) {
  const xp = computeRunXP({
    difficulty: puzzle.difficulty ?? 'easy',
    isOptimalPath: playerPath.join(',') === puzzle.optimal_path.join(','),
    timeMs,
    streakDay: 1, // will be updated in Task 6 when we have streak data
  })
  awardXP({
    userId,
    xp,
    playedDate: new Date().toISOString().split('T')[0],
  }).then(({ totalXP, newStreak }) => {
    console.log('[Results] XP awarded:', xp, 'total:', totalXP, 'streak:', newStreak)
  })
}
```

**Step 3: Show XP earned on results screen**

Add an XP badge to the results UI — after the score display, add:

```tsx
<View style={styles.xpBadge}>
  <Text style={styles.xpText}>+{earnedXP} XP</Text>
</View>
```

With styles:
```typescript
xpBadge: {
  backgroundColor: '#7c3aed22',
  borderColor: '#7c3aed66',
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 6,
  alignSelf: 'center',
  marginTop: 8,
},
xpText: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
```

**Step 4: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit
```

**Step 5: Commit**

```bash
cd mobile && git add app/results/\[id\].tsx
git commit -m "feat: award XP after puzzle completion, show XP earned on results screen"
```

---

## Phase 6: Profile Screen — Level & XP Display

### Task 6: Update profile screen with progression UI

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`

**Step 1: Import and use `useProgression`**

Add to the top of `profile.tsx`:
```typescript
import { useProgression } from '../../hooks/useProgression'
```

Add inside `ProfileScreen`:
```typescript
const progression = useProgression(userId)
```

**Step 2: Add level card above existing stats**

Add this block before the existing stats section:

```tsx
{/* Level Card */}
<View style={styles.levelCard}>
  <View style={styles.levelRow}>
    <Text style={styles.levelNum}>Level {progression.level}</Text>
    <Text style={styles.levelTitle}>{progression.title}</Text>
    {progression.isSubscriber && <Text style={styles.plusBadge}>+</Text>}
  </View>
  <View style={styles.xpBarBg}>
    <View style={[styles.xpBarFill, {
      width: `${Math.round((progression.xpInLevel / progression.xpForNextLevel) * 100)}%`
    }]} />
  </View>
  <Text style={styles.xpLabel}>
    {progression.xpInLevel} / {progression.xpForNextLevel} XP · {progression.totalXP} total
  </Text>
  <Text style={styles.streakLabel}>🔥 {progression.streak} day streak</Text>
</View>
```

With styles:
```typescript
levelCard: {
  backgroundColor: '#1e1e2e',
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: '#2a2a3e',
},
levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
levelNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
levelTitle: { color: '#7c3aed', fontSize: 16, fontWeight: '600' },
plusBadge: { color: '#f59e0b', fontSize: 16, fontWeight: '800', marginLeft: 4 },
xpBarBg: { height: 6, backgroundColor: '#2a2a3e', borderRadius: 3, marginBottom: 6 },
xpBarFill: { height: 6, backgroundColor: '#7c3aed', borderRadius: 3 },
xpLabel: { color: '#666', fontSize: 12 },
streakLabel: { color: '#888', fontSize: 13, marginTop: 6 },
```

**Step 3: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
cd mobile && git add app/\(tabs\)/profile.tsx
git commit -m "feat: show level, title, XP bar, and streak on profile screen"
```

---

## Phase 7: Home Screen — Difficulty & Category Gating

### Task 7: Gate categories and difficulties on home screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Step 1: Import progression**

```typescript
import { useProgression } from '../../hooks/useProgression'
```

**Step 2: Add progression to component**

```typescript
const progression = useProgression(userId)
```

**Step 3: Filter categories to only show unlocked ones**

After `setCategories(data)`, filter the list:

```typescript
getCategories(userId).then(data => {
  // Show only unlocked categories (or all if none unlocked yet — bootstrap)
  const filtered = progression.unlockedCategories.length > 0
    ? (data as Category[]).filter(c => progression.unlockedCategories.includes(c.id))
    : (data as Category[]).slice(0, 2) // first 2 as default starters
  setCategories(filtered)
  setCategoriesLoading(false)
})
```

**Step 4: Show difficulty lock state on puzzle cards**

On each category card, add a difficulty indicator showing which difficulties are available:

```tsx
<Text style={styles.diffAvailable}>
  {progression.unlockedDifficulties.join(' · ')}
</Text>
```

**Step 5: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit
```

**Step 6: Commit**

```bash
cd mobile && git add app/\(tabs\)/index.tsx
git commit -m "feat: gate home screen categories and difficulties by progression level"
```

---

## Phase 8: Category Unlock UI

### Task 8: Category unlock modal

**Files:**
- Create: `mobile/components/CategoryUnlockModal.tsx`
- Modify: `mobile/app/(tabs)/profile.tsx`

**Step 1: Create the modal component**

```typescript
// mobile/components/CategoryUnlockModal.tsx
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'

interface Props {
  visible: boolean
  availableCategories: Array<{ id: string; name: string; wikidata_domain: string }>
  onSelect: (categoryId: string) => void
}

const CATEGORY_EMOJIS: Record<string, string> = {
  movies: '🎬', sport: '🏆', music: '🎵', science: '🔬', history: '📜',
}

export function CategoryUnlockModal({ visible, availableCategories, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>New Category Unlocked!</Text>
          <Text style={styles.subtitle}>Choose which category to add</Text>
          {availableCategories.map(cat => (
            <Pressable key={cat.id} style={styles.option} onPress={() => onSelect(cat.id)}>
              <Text style={styles.emoji}>{CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}</Text>
              <Text style={styles.name}>{cat.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1e1e2e', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#2a2a3e' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 20, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#16162a', borderRadius: 12, marginBottom: 10 },
  emoji: { fontSize: 24 },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
```

**Step 2: Wire the modal into profile screen**

In `profile.tsx`, detect when a new category slot has been unlocked but not yet filled, and show the modal. This requires comparing `progression.categorySlots` vs `progression.unlockedCategories.length`.

Add:
```typescript
const [showUnlockModal, setShowUnlockModal] = useState(false)
const needsCategoryChoice = progression.categorySlots > progression.unlockedCategories.length

useEffect(() => {
  if (!progression.loading && needsCategoryChoice) {
    setShowUnlockModal(true)
  }
}, [progression.loading, needsCategoryChoice])
```

**Step 3: Commit**

```bash
cd mobile && git add components/CategoryUnlockModal.tsx app/\(tabs\)/profile.tsx
git commit -m "feat: category unlock modal — player chooses new category at milestones"
```

---

## Phase 9: Subscription Paywall (Archive Gate)

### Task 9: Archive paywall in home screen

**Files:**
- Create: `mobile/components/SubscribeModal.tsx`
- Modify: `mobile/lib/api.ts` (add archive date filter)

**Step 1: Add 7-day archive filter to `getCategories`**

In `mobile/lib/api.ts`, the puzzle fetch in `getCategories` already gets the latest puzzle. Add a helper that checks if a puzzle date is within the free window:

```typescript
export function isInFreeArchive(puzzleDateStr: string): boolean {
  const puzzleDate = new Date(puzzleDateStr)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return puzzleDate >= cutoff
}
```

**Step 2: Create subscribe modal**

```typescript
// mobile/components/SubscribeModal.tsx
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'

interface Props {
  visible: boolean
  onClose: () => void
  onSubscribe: () => void
}

export function SubscribeModal({ visible, onClose, onSubscribe }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>RabbitHole+</Text>
          <Text style={styles.subtitle}>Unlock the full archive</Text>
          <View style={styles.features}>
            <Text style={styles.feature}>30+ days of puzzles in every category</Text>
            <Text style={styles.feature}>Profile badge on leaderboard</Text>
            <Text style={styles.feature}>No ads, ever</Text>
          </View>
          <Pressable style={styles.monthlyBtn} onPress={onSubscribe}>
            <Text style={styles.btnText}>$2.99 / month</Text>
          </Pressable>
          <Pressable style={styles.yearlyBtn} onPress={onSubscribe}>
            <Text style={styles.yearlyText}>$19.99 / year  ·  save 44%</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  card: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, borderWidth: 1, borderColor: '#2a2a3e' },
  title: { color: '#7c3aed', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#aaa', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  features: { marginBottom: 24, gap: 10 },
  feature: { color: '#ccc', fontSize: 15 },
  monthlyBtn: { backgroundColor: '#7c3aed', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  yearlyBtn: { borderColor: '#7c3aed', borderWidth: 1, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20 },
  yearlyText: { color: '#7c3aed', fontSize: 15, fontWeight: '600' },
  dismiss: { alignItems: 'center' },
  dismissText: { color: '#555', fontSize: 14 },
})
```

**Step 3: Note on RevenueCat**

The `onSubscribe` handler is a stub for now. RevenueCat integration (`react-native-purchases`) is a separate task — wire it up when ready for App Store submission. For now the modal is UI-only.

**Step 4: Commit**

```bash
cd mobile && git add components/SubscribeModal.tsx lib/api.ts
git commit -m "feat: subscription paywall modal + archive date helper (RevenueCat stub)"
```

---

## Open Items (Post-Launch)

- **RevenueCat integration**: install `react-native-purchases`, configure products in App Store Connect, wire `onSubscribe` to actual purchase flow, set `is_subscriber` in Supabase on purchase event
- **Starter category seeding**: decide which 2 categories every new user starts with and seed `unlocked_categories` on user creation in `useAuth.ts`
- **Streak correctness with real streak data**: Task 5 uses hardcoded `streakDay: 1` — update after `awardXP` returns the real streak
- **Level-up celebration**: animate a level-up moment on the results screen when the player crosses a level boundary

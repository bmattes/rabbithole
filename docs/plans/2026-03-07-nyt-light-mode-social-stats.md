# NYT Light Mode + Social Stats Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the entire app with a clean NYT Games light-mode aesthetic and add post-game social path stats ("X% of players found the optimal path") plus a shareable emoji run card.

**Architecture:** A shared `theme.ts` file defines the light-mode color palette; all screens swap their hardcoded dark colors to theme tokens. A new `getPathStats` API function queries `player_runs` for crowd comparison data. The results screen gains a "How others played" section and a shareable text card generated from emoji path encoding.

**Tech Stack:** React Native / Expo SDK 54, TypeScript, Supabase (Postgres), expo-router, React Native `Share` API.

---

## Phase 1: Theme Foundation

### Task 1: Create shared theme.ts

**Files:**
- Create: `mobile/lib/theme.ts`

**Step 1: Create the file**

```typescript
// mobile/lib/theme.ts

export const colors = {
  // Backgrounds
  bg: '#f9f9f7',
  bgCard: '#ffffff',
  bgCardAlt: '#f3f3f1',
  bgInput: '#f3f3f1',

  // Borders
  border: '#e5e5e5',
  borderStrong: '#d0d0d0',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#ffffff',

  // Brand
  accent: '#7c3aed',
  accentLight: '#ede9fe',
  accentMuted: '#7c3aed22',

  // Difficulty
  easy: '#22c55e',
  easyBg: '#f0fdf4',
  medium: '#d97706',   // darker amber — readable on white
  mediumBg: '#fffbeb',
  hard: '#dc2626',     // darker red — readable on white
  hardBg: '#fef2f2',

  // Status
  success: '#22c55e',
  warning: '#d97706',
  error: '#dc2626',

  // Tab bar
  tabBar: '#ffffff',
  tabBorder: '#e5e5e5',
  tabActive: '#7c3aed',
  tabInactive: '#999999',
}

export const typography = {
  titleLg: { fontSize: 32, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
  titleMd: { fontSize: 24, fontWeight: '800' as const, color: colors.textPrimary },
  titleSm: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  bodyLg: { fontSize: 16, color: colors.textPrimary },
  bodyMd: { fontSize: 14, color: colors.textPrimary },
  bodySm: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 11, fontWeight: '700' as const, color: colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  mono: { fontSize: 13, fontFamily: 'monospace', color: colors.textSecondary },
}

export const layout = {
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  cardSm: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
}
```

**Step 2: Verify TypeScript**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```
Expected: No errors.

**Step 3: Commit**

```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add lib/theme.ts
git commit -m "feat: add shared light-mode theme tokens"
```

---

## Phase 2: Restyle Screens

### Task 2: Restyle Home screen (Today tab)

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Step 1: Read the current file** — understand exact StyleSheet keys in use.

**Step 2: Add theme import**

Add at top of imports:
```typescript
import { colors } from '../../lib/theme'
```

**Step 3: Replace the StyleSheet**

Replace the entire `const styles = StyleSheet.create({...})` block at the bottom with:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.accent, fontSize: 36, fontWeight: '800', marginBottom: 4, letterSpacing: -1 },
  subtitle: { color: colors.textTertiary, fontSize: 15, marginBottom: 40, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardDone: { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
  cardEmoji: { fontSize: 24, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  cardTitleDone: { color: colors.textTertiary },
  diffBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardHint: { color: colors.textTertiary, fontSize: 12, marginTop: 3 },
  diffAvailable: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  cardArrow: { color: colors.accent, fontSize: 20, marginLeft: 8 },
  cardCheck: { color: colors.success, fontSize: 20, fontWeight: '700', marginLeft: 8 },
})
```

**Step 4: Update difficulty badge colors** — these reference local variables `DIFFICULTY_COLORS` so they still work, but update that constant to use readable-on-white values:

Find:
```typescript
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#eab308',
  hard: '#ef4444',
}
```

Replace with:
```typescript
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#d97706',
  hard: '#dc2626',
}
```

**Step 5: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 6: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/(tabs)/index.tsx"
git commit -m "feat: light mode — Today screen"
```

---

### Task 3: Restyle Puzzle screen

**Files:**
- Modify: `mobile/app/puzzle/[id].tsx`
- Modify: `mobile/components/Bubble.tsx`
- Modify: `mobile/components/ConnectionLine.tsx`

**Step 1: Read all three files** before editing.

**Step 2: Update puzzle/[id].tsx**

Add import:
```typescript
import { colors } from '../../lib/theme'
```

Replace the StyleSheet:
```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: 12, paddingTop: 2 },
  backText: { color: colors.accent, fontSize: 22 },
  headerMiddle: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  constraintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  constraint: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  diffBadge: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  diffEasy: { color: '#22c55e', backgroundColor: '#f0fdf4' },
  diffMedium: { color: '#d97706', backgroundColor: '#fffbeb' },
  diffHard: { color: '#dc2626', backgroundColor: '#fef2f2' },
  headerRight: { alignItems: 'flex-end', marginLeft: 12 },
  timer: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  hopBadge: { flexDirection: 'row', alignItems: 'baseline' },
  hopCount: { fontSize: 15, fontWeight: '800' },
  hopLabel: { color: colors.textTertiary, fontSize: 12 },
  error: { color: colors.error, fontSize: 16, marginBottom: 20 },
  backFallback: { paddingVertical: 10, paddingHorizontal: 20 },
  backFallbackText: { color: colors.accent, fontSize: 16 },
})
```

Also update the `timerColor` line — replace dark colors with light-readable versions:
```typescript
const timerColor = elapsed < 60000 ? colors.textPrimary : elapsed < 180000 ? '#d97706' : '#dc2626'
```

**Step 3: Update Bubble.tsx**

Read the file first. The bubble component uses dark background styles. Update:
- Idle bubble: white background `#ffffff`, border `#e5e5e5`, label `#1a1a1a`
- Active/in-path bubble: `#7c3aed` background, white label (keep as-is — this is correct contrast)
- Start bubble: light purple bg `#ede9fe`, accent border, accent label
- End bubble: same as start until reached, then filled purple

The exact changes depend on what you find in the file — adapt to the existing structure.

**Step 4: Update ConnectionLine.tsx**

Read the file. The active connection line color is likely `#7c3aed` or similar — keep that. The canvas background in PuzzleCanvas.tsx:

In `mobile/components/PuzzleCanvas.tsx`, find:
```typescript
canvas: { flex: 1, backgroundColor: '#0a0a0a' },
```
Replace with:
```typescript
canvas: { flex: 1, backgroundColor: colors.bg },
```
Add `import { colors } from '../lib/theme'` at top.

**Step 5: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 6: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/puzzle/[id].tsx" components/Bubble.tsx components/ConnectionLine.tsx components/PuzzleCanvas.tsx
git commit -m "feat: light mode — puzzle screen and canvas"
```

---

### Task 4: Restyle Results screen

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Read the current file.**

**Step 2: Add theme import**
```typescript
import { colors } from '../../lib/theme'
```

**Step 3: Replace StyleSheet**

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 72, alignItems: 'center' },
  title: { color: colors.accent, fontSize: 32, fontWeight: '800', marginBottom: 24, letterSpacing: -0.5 },
  scoreCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  grade: { color: colors.accent, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  scoreValue: { color: colors.textPrimary, fontSize: 72, fontWeight: '800', lineHeight: 80 },
  scoreLabel: { color: colors.textTertiary, fontSize: 14, marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: 16 },
  statValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  pathsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathCol: { flex: 1 },
  pathTitle: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  optimalBanner: { backgroundColor: colors.accentLight, borderRadius: 10, padding: 10, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#c4b5fd' },
  optimalBannerText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  pathDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  narrativeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  narrativeTitle: { color: colors.accent, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  narrativeSubtitle: { color: colors.textTertiary, fontSize: 11, marginBottom: 10 },
  narrativeText: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  narrativeBold: { color: colors.textPrimary, fontWeight: '700' },
  narrativeNum: { color: colors.accent, fontWeight: '400', fontSize: 12 },
  narrativePlaceholder: { color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: colors.textTertiary, fontSize: 15 },
  xpBadge: {
    backgroundColor: colors.accentLight,
    borderColor: '#c4b5fd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
    marginTop: 8,
  },
  xpText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
})
```

Also update `pathStyles`:
```typescript
const pathStyles = StyleSheet.create({
  row: { alignItems: 'flex-start', width: '100%' },
  stepRow: { alignItems: 'center', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  arrow: { color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 2 },
})
```

**Step 4: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 5: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/results/[id].tsx"
git commit -m "feat: light mode — results screen"
```

---

### Task 5: Restyle Profile and Leaderboard screens

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`
- Modify: `mobile/app/(tabs)/leaderboard.tsx`

**Step 1: Read both files.**

**Step 2: For both files**, add `import { colors } from '../../lib/theme'` and replace all dark color literals:

| Old | New |
|-----|-----|
| `'#0a0a0a'` (bg) | `colors.bg` |
| `'#1e1e2e'` (card) | `colors.bgCard` |
| `'#14141e'` (input/alt) | `colors.bgInput` |
| `'#2a2a3e'` (border) | `colors.border` |
| `'#fff'` (primary text) | `colors.textPrimary` |
| `'#888'`, `'#666'` (secondary) | `colors.textSecondary` |
| `'#555'` (tertiary) | `colors.textTertiary` |
| `'#444'` (placeholder) | `colors.textTertiary` |
| `'#7c3aed'` (accent) | `colors.accent` |
| `'#a78bfa'` (accent light text) | `colors.accent` |

For the profile `TextInput`, update `placeholderTextColor` to `colors.textTertiary` and `color` to `colors.textPrimary`.

**Step 3: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 4: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/(tabs)/profile.tsx" "app/(tabs)/leaderboard.tsx"
git commit -m "feat: light mode — profile and leaderboard screens"
```

---

### Task 6: Restyle tab bar and modals

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/components/CategoryUnlockModal.tsx`
- Modify: `mobile/components/SubscribeModal.tsx`

**Step 1: Read all three files.**

**Step 2: Update `_layout.tsx`** — the tab bar `tabBarStyle` should use:
```typescript
tabBarStyle: {
  backgroundColor: colors.tabBar,
  borderTopColor: colors.tabBorder,
  borderTopWidth: 1,
}
tabBarActiveTintColor: colors.tabActive,
tabBarInactiveTintColor: colors.tabInactive,
```
Add `import { colors } from '../../lib/theme'`.

**Step 3: Update both modals** — same dark→light color swap as Task 5. Modal backgrounds go to `colors.bgCard`, overlay stays dark semi-transparent `rgba(0,0,0,0.5)`.

**Step 4: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 5: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/(tabs)/_layout.tsx" components/CategoryUnlockModal.tsx components/SubscribeModal.tsx
git commit -m "feat: light mode — tab bar and modals"
```

---

## Phase 3: Social Stats

### Task 7: Add getPathStats to api.ts

**Files:**
- Modify: `mobile/lib/api.ts`

**Step 1: Add the function at the end of the file**

```typescript
export async function getPathStats(
  puzzleId: string,
  playerPath: string[] // array of bubble IDs in order
): Promise<{ totalPlayers: number; optimalPathPct: number; exactMatchPct: number }> {
  const { data, error } = await supabase
    .from('player_runs')
    .select('path')
    .eq('puzzle_id', puzzleId)

  if (error || !data || data.length === 0) {
    return { totalPlayers: 0, optimalPathPct: 0, exactMatchPct: 0 }
  }

  const total = data.length

  // We don't have the optimal path stored directly on player_runs.
  // Proxy: players who used the minimum number of hops are "optimal path finders".
  // Find the minimum hop count among all players.
  const hopCounts = data.map(r => (r.path as string[]).length - 1)
  const minHops = Math.min(...hopCounts)
  const optimalCount = hopCounts.filter(h => h === minHops).length

  // Exact path match: serialize player's path and compare
  const playerPathStr = playerPath.join(',')
  const exactCount = data.filter(r => (r.path as string[]).join(',') === playerPathStr).length

  return {
    totalPlayers: total,
    optimalPathPct: Math.round((optimalCount / total) * 100),
    exactMatchPct: Math.round((exactCount / total) * 100),
  }
}
```

**Step 2: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 3: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add lib/api.ts
git commit -m "feat: getPathStats — crowd comparison data for results screen"
```

---

### Task 8: Add social stats section to results screen

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Read the current file** to find the exact location of the XP useEffect and the JSX structure.

**Step 2: Add state and effect for path stats**

After the existing `const [earnedXP, setEarnedXP] = useState(0)` line, add:
```typescript
const [pathStats, setPathStats] = useState<{ totalPlayers: number; optimalPathPct: number; exactMatchPct: number } | null>(null)
```

Add import at top:
```typescript
import { awardXP, getPathStats, localDateString } from '../../lib/api'
```

Add a new useEffect after the XP useEffect:
```typescript
useEffect(() => {
  if (!puzzleId || playerLabels.length === 0) return
  // playerLabels are string labels, but getPathStats needs IDs.
  // We pass the raw playerPath param (IDs encoded as '|' separated) instead.
  const rawIds = playerPath ? decodeURIComponent(playerPath).split('|') : []
  if (rawIds.length === 0) return
  getPathStats(puzzleId, rawIds).then(setPathStats)
}, [puzzleId])
```

**Note:** `playerPath` param contains bubble labels, not IDs (it's encoded for display). The `player_runs.path` column stores IDs. Since we can't easily get IDs on the results screen, `getPathStats` should compare on path *length* for the optimal stat, and skip exact match if there's a mismatch. See the note in Step 3.

**Step 3: Update getPathStats to be path-length based** (update Task 7's function)

Actually, `player_runs.path` stores bubble IDs (from `submitRun`). The results screen encodes *labels* for display. So exact path match won't work by comparing IDs to labels. The simplest fix: make `exactMatchPct` compare hop counts that match the player's hop count (not exact ID path), and add a note in the UI that says "same number of hops" not "exact same path."

Update `getPathStats` signature to:
```typescript
export async function getPathStats(
  puzzleId: string,
  playerHops: number
): Promise<{ totalPlayers: number; optimalPathPct: number; sameHopsPct: number }>
```

And the implementation:
```typescript
export async function getPathStats(
  puzzleId: string,
  playerHops: number
): Promise<{ totalPlayers: number; optimalPathPct: number; sameHopsPct: number }> {
  const { data, error } = await supabase
    .from('player_runs')
    .select('path')
    .eq('puzzle_id', puzzleId)

  if (error || !data || data.length === 0) {
    return { totalPlayers: 0, optimalPathPct: 0, sameHopsPct: 0 }
  }

  const total = data.length
  const hopCounts = data.map(r => (r.path as string[]).length - 1)
  const minHops = Math.min(...hopCounts)
  const optimalCount = hopCounts.filter(h => h === minHops).length
  const sameHopsCount = hopCounts.filter(h => h === playerHops).length

  return {
    totalPlayers: total,
    optimalPathPct: Math.round((optimalCount / total) * 100),
    sameHopsPct: Math.round((sameHopsCount / total) * 100),
  }
}
```

And call it with `hopsNum`:
```typescript
getPathStats(puzzleId, hopsNum).then(setPathStats)
```

**Step 4: Add social stats card to JSX**

Insert this block after the `pathsCard` View and before the `narrativeCard` View:

```tsx
{pathStats && pathStats.totalPlayers >= 2 && (
  <View style={styles.statsCard}>
    <Text style={styles.statsTitle}>How others played</Text>
    <View style={styles.statsRow2}>
      <View style={styles.statItem}>
        <Text style={styles.statBig}>{pathStats.optimalPathPct}%</Text>
        <Text style={styles.statDesc}>found the optimal path</Text>
      </View>
      <View style={styles.statDivider2} />
      <View style={styles.statItem}>
        <Text style={styles.statBig}>{pathStats.sameHopsPct}%</Text>
        <Text style={styles.statDesc}>took {hopsNum} hop{hopsNum !== 1 ? 's' : ''} like you</Text>
      </View>
    </View>
    <Text style={styles.statFooter}>{pathStats.totalPlayers} player{pathStats.totalPlayers !== 1 ? 's' : ''} completed this puzzle</Text>
  </View>
)}
```

Add to StyleSheet:
```typescript
statsCard: {
  backgroundColor: colors.bgCard,
  borderRadius: 20,
  padding: 20,
  width: '100%',
  marginBottom: 16,
  borderWidth: 1,
  borderColor: colors.border,
},
statsTitle: { color: colors.textTertiary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
statsRow2: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
statItem: { flex: 1, alignItems: 'center' },
statBig: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
statDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center' },
statDivider2: { width: 1, height: 40, backgroundColor: colors.border },
statFooter: { color: colors.textTertiary, fontSize: 12, textAlign: 'center' },
```

**Step 5: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 6: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/results/[id].tsx" lib/api.ts
git commit -m "feat: social path stats on results screen"
```

---

### Task 9: Add shareable run card to results screen

**Files:**
- Modify: `mobile/app/results/[id].tsx`

**Step 1: Read the current file** to find the bottom buttons section.

**Step 2: Add Share import**

```typescript
import { Share } from 'react-native'
```

**Step 3: Add share function inside the component**

Add this function inside `ResultsScreen`, after the existing state declarations:

```typescript
const DIFFICULTY_EMOJI: Record<string, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
const diffEmoji = DIFFICULTY_EMOJI[(difficulty as string) ?? 'easy'] ?? '🟢'

function buildShareText(): string {
  const hopDots = Array.from({ length: hopsNum }, (_, i) => {
    if (i === 0) return '🐇' // start
    if (i === hopsNum - 1) return '🏁' // end
    return samePathAsOptimal ? '🟣' : playerLabels.length > i + 1 ? '⚪' : '⚪'
  }).join('')

  const lines = [
    `RabbitHole 🐇`,
    `${diffEmoji} — ${hopsNum} hop${hopsNum !== 1 ? 's' : ''} (optimal: ${optimalHopsNum})`,
    hopDots,
    playerLabels[0] + ' → ' + playerLabels[playerLabels.length - 1],
  ]

  if (pathStats && pathStats.totalPlayers >= 2) {
    lines.push(`${pathStats.optimalPathPct}% of players found optimal`)
  }

  lines.push(`\nrabbitholeapp.com`)
  return lines.join('\n')
}

async function handleShare() {
  const text = buildShareText()
  await Share.share({ message: text })
}
```

**Step 4: Add share button to JSX**

Find the "Back to Today" button block. Insert above it:

```tsx
<Pressable style={styles.shareButton} onPress={handleShare}>
  <Text style={styles.shareButtonText}>Share Result</Text>
</Pressable>
```

Add to StyleSheet:
```typescript
shareButton: {
  backgroundColor: colors.bgCard,
  borderRadius: 14,
  paddingVertical: 16,
  width: '100%',
  alignItems: 'center',
  marginBottom: 12,
  borderWidth: 1,
  borderColor: colors.border,
},
shareButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
```

**Step 5: Verify TypeScript**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile && npx tsc --noEmit 2>&1
```

**Step 6: Commit**
```bash
cd /Users/bmattes/Documents/RabbitHole/mobile
git add "app/results/[id].tsx"
git commit -m "feat: shareable run card on results screen"
```

---

## Open Items

- The `localDateString` export from `api.ts` was added in a prior task — confirm it's exported if the results screen imports it directly.
- Bubble component internals depend on what's currently in `Bubble.tsx` — Task 3 says to read it first and adapt; don't blindly overwrite.
- `difficulty` param on results screen is wired in Task 7 of the per-difficulty plan (runs in parallel with this plan) — the share card uses it, so Task 9 here depends on that being complete.
- Social stats only show when `totalPlayers >= 2` to avoid showing 100%/0% with a single player.

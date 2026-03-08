import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { colors } from '../../lib/theme'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { getMyRuns, getDisplayName, updateDisplayName, getCategories, saveUnlockedCategory } from '../../lib/api'
import { CategoryUnlockModal } from '../../components/CategoryUnlockModal'
import { CATEGORY_EMOJIS } from '../../lib/categoryEmojis'

export default function ProfileScreen() {
  const { userId } = useAuth()
  const progression = useProgression(userId)
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [availableToUnlock, setAvailableToUnlock] = useState<Array<{ id: string; name: string; wikidata_domain: string }>>([])

  useEffect(() => {
    if (!userId) return
    getMyRuns(userId).then(setRuns).finally(() => setLoading(false))
    getDisplayName(userId).then(name => { if (name) setDisplayName(name) })
  }, [userId])

  useEffect(() => {
    if (progression.loading) return
    const needsChoice = progression.categorySlots > progression.unlockedCategories.length
    if (!needsChoice) return
    let cancelled = false
    getCategories(null).then(all => {
      if (cancelled) return
      const available = (all as Array<{ id: string; name: string; wikidata_domain: string }>)
        .filter(c => !progression.unlockedCategories.includes(c.id))
      setAvailableToUnlock(available)
      if (available.length > 0) setShowUnlockModal(true)
    })
    return () => { cancelled = true }
  }, [progression.loading, progression.categorySlots, progression.unlockedCategories])

  async function handleCategoryUnlock(categoryId: string) {
    setShowUnlockModal(false)
    if (!userId) return
    await saveUnlockedCategory(userId, categoryId)
    progression.refresh()
  }

  async function handleSaveName() {
    if (!userId || !displayName.trim()) return
    setSaving(true)
    await updateDisplayName(userId, displayName)
    setSaving(false)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }

  // Aggregate stats per category
  const byCategory = runs.reduce((acc, run) => {
    const cat = run.puzzles?.categories
    if (!cat) return acc
    const key = cat.name
    if (!acc[key]) acc[key] = { name: key, domain: cat.wikidata_domain, runs: [] }
    acc[key].runs.push(run)
    return acc
  }, {} as Record<string, { name: string; domain: string; runs: any[] }>)

  const categoryStats = Object.values(byCategory).map((cat: any) => {
    const scores = cat.runs.map((r: any) => r.score)
    const best = Math.max(...scores)
    const avg = Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length)
    const avgSecs = Math.round(cat.runs.reduce((s: number, r: any) => s + r.time_ms, 0) / cat.runs.length / 1000)
    return { ...cat, best, avg, avgSecs, count: cat.runs.length }
  })

  const totalRuns = runs.length
  const bestScore = runs.length ? Math.max(...runs.map(r => r.score)) : 0

  const xpPct = Math.round((progression.xpInLevel / progression.xpForNextLevel) * 100)

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profile</Text>

      {/* Hero: Level + progression */}
      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <View>
            <Text style={styles.levelTitle}>{progression.title}</Text>
            <Text style={styles.levelNum}>Level {progression.level}</Text>
          </View>
          <View style={styles.levelRight}>
            {progression.streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {progression.streak}</Text>
              </View>
            )}
            {progression.isSubscriber && <Text style={styles.plusBadge}>RH+</Text>}
          </View>
        </View>
        <View style={styles.xpBarBg}>
          <View style={[styles.xpBarFill, { width: `${xpPct}%` as any }]} />
        </View>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>{progression.xpInLevel} / {progression.xpForNextLevel} XP to next level</Text>
          <Text style={styles.xpTotal}>{progression.totalXP} total</Text>
        </View>
      </View>

      {/* Display name */}
      <View style={styles.nameCard}>
        <Text style={styles.nameLabel}>Display Name</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textTertiary}
            maxLength={24}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saved ? '✓' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : totalRuns === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No puzzles completed yet</Text>
          <Text style={styles.emptySub}>Your stats will appear here after your first run.</Text>
        </View>
      ) : (
        <>
          {/* Summary row */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{totalRuns}</Text>
              <Text style={styles.summaryLabel}>Puzzles</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{bestScore}</Text>
              <Text style={styles.summaryLabel}>Best Score</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{categoryStats.length}</Text>
              <Text style={styles.summaryLabel}>Categories</Text>
            </View>
          </View>

          {/* Per-category breakdown */}
          <Text style={styles.sectionHeader}>By Category</Text>
          {categoryStats.map((cat: any) => (
            <View key={cat.name} style={styles.catCard}>
              <View style={styles.catHeader}>
                <Text style={styles.catEmoji}>{CATEGORY_EMOJIS[cat.domain] ?? '🐇'}</Text>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catCount}>{cat.count} {cat.count === 1 ? 'run' : 'runs'}</Text>
              </View>
              <View style={styles.catStats}>
                <View style={styles.catStat}>
                  <Text style={styles.catStatVal}>{cat.best}</Text>
                  <Text style={styles.catStatLabel}>Best</Text>
                </View>
                <View style={styles.catStat}>
                  <Text style={styles.catStatVal}>{cat.avg}</Text>
                  <Text style={styles.catStatLabel}>Avg Score</Text>
                </View>
                <View style={styles.catStat}>
                  <Text style={styles.catStatVal}>{cat.avgSecs}s</Text>
                  <Text style={styles.catStatLabel}>Avg Time</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Recent runs */}
          <Text style={styles.sectionHeader}>Recent Runs</Text>
          {runs.slice(0, 10).map((run, i) => {
            const cat = run.puzzles?.categories
            const puzzle = run.puzzles
            const bubbles = (puzzle?.bubbles as Array<{ id: string; label: string }> | undefined) ?? []
            const labelMap = Object.fromEntries(bubbles.map(b => [b.id, b.label]))
            const playerLabels = (run.path as string[]).map(id => labelMap[id] ?? id).join('|')
            const optimalLabels = (puzzle?.optimal_path as string[] | undefined)?.map(id => labelMap[id] ?? id).join('|') ?? ''
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.runRow, pressed && styles.runRowPressed]}
                onPress={() => {
                  if (!run.puzzle_id || !puzzle) return
                  const narrativeParam = puzzle.narrative ? `&narrative=${encodeURIComponent(puzzle.narrative)}` : ''
                  const categoryParam = cat?.name ? `&categoryName=${encodeURIComponent(cat.name)}` : ''
                  router.push(
                    `/results/${run.puzzle_id}?score=${run.score}&timeMs=${run.time_ms}&hops=${run.path.length - 1}&optimalHops=${(puzzle.optimal_path as string[]).length - 1}&playerPath=${encodeURIComponent(playerLabels)}&optimalPath=${encodeURIComponent(optimalLabels)}&difficulty=${puzzle.difficulty ?? 'easy'}&skipXP=1${narrativeParam}${categoryParam}`
                  )
                }}
              >
                <Text style={styles.runEmoji}>{CATEGORY_EMOJIS[cat?.wikidata_domain] ?? '🐇'}</Text>
                <View style={styles.runInfo}>
                  <Text style={styles.runTitle} numberOfLines={1}>
                    {puzzle?.start_concept} → {puzzle?.end_concept}
                  </Text>
                  <Text style={styles.runMeta}>
                    {Math.round(run.time_ms / 1000)}s · {run.path.length - 1} hops
                  </Text>
                </View>
                <Text style={styles.runScore}>{run.score}</Text>
                <Text style={styles.runChevron}>›</Text>
              </Pressable>
            )
          })}
        </>
      )}
    </ScrollView>
    <CategoryUnlockModal
      visible={showUnlockModal}
      availableCategories={availableToUnlock}
      onSelect={handleCategoryUnlock}
    />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 60 },
  title: { color: colors.accent, fontSize: 28, fontWeight: '800', marginBottom: 20 },
  levelCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  levelRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelTitle: { color: colors.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  levelNum: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  streakBadge: { backgroundColor: colors.accentLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  streakText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  plusBadge: { color: '#f59e0b', fontSize: 12, fontWeight: '800', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  xpBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, marginBottom: 8 },
  xpBarFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { color: colors.textSecondary, fontSize: 12 },
  xpTotal: { color: colors.textTertiary, fontSize: 12 },
  nameCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyContainer: { marginTop: 60, alignItems: 'center' },
  empty: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: colors.textTertiary, fontSize: 13, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryVal: { color: colors.accent, fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  sectionHeader: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  catCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catEmoji: { fontSize: 18, marginRight: 10 },
  catName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  catCount: { color: colors.textTertiary, fontSize: 12 },
  catStats: { flexDirection: 'row', gap: 8 },
  catStat: { flex: 1, alignItems: 'center', backgroundColor: colors.bgInput, borderRadius: 8, paddingVertical: 8 },
  catStatVal: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  catStatLabel: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  runRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  runRowPressed: { opacity: 0.6 },
  runEmoji: { fontSize: 16, marginRight: 12 },
  runInfo: { flex: 1 },
  runTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  runMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  runScore: { color: colors.accent, fontSize: 16, fontWeight: '700', marginLeft: 12 },
  runChevron: { color: colors.textTertiary, fontSize: 20, marginLeft: 6 },
})

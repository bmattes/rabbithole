import React, { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { getMyRuns, getDisplayName, updateDisplayName } from '../../lib/api'

const CATEGORY_EMOJIS: Record<string, string> = {
  movies: '🎬',
  sport: '🏆',
  music: '🎵',
  science: '🔬',
  history: '📜',
}

export default function ProfileScreen() {
  const { userId } = useAuth()
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!userId) return
    getMyRuns(userId).then(setRuns).finally(() => setLoading(false))
    getDisplayName(userId).then(name => { if (name) setDisplayName(name) })
  }, [userId])

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profile</Text>

      {/* Username */}
      <View style={styles.nameCard}>
        <Text style={styles.nameLabel}>Display Name</Text>
        <Text style={styles.nameHint}>Shown on leaderboards</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#444"
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

      <Text style={styles.title2}>My Stats</Text>

      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 40 }} />
      ) : totalRuns === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No runs yet</Text>
          <Text style={styles.emptySub}>Complete a puzzle to see your stats here.</Text>
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
            return (
              <View key={i} style={styles.runRow}>
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
              </View>
            )
          })}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 60 },
  title: { color: '#7c3aed', fontSize: 28, fontWeight: '800', marginBottom: 20 },
  title2: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16, marginTop: 8 },
  nameCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  nameLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  nameHint: { color: '#555', fontSize: 12, marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    backgroundColor: '#14141e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyContainer: { marginTop: 60, alignItems: 'center' },
  empty: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#555', fontSize: 13 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  summaryVal: { color: '#7c3aed', fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  sectionHeader: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  catCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catEmoji: { fontSize: 18, marginRight: 10 },
  catName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  catCount: { color: '#555', fontSize: 12 },
  catStats: { flexDirection: 'row', gap: 8 },
  catStat: { flex: 1, alignItems: 'center', backgroundColor: '#14141e', borderRadius: 8, paddingVertical: 8 },
  catStatVal: { color: '#a78bfa', fontSize: 18, fontWeight: '700' },
  catStatLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  runRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  runEmoji: { fontSize: 16, marginRight: 12 },
  runInfo: { flex: 1 },
  runTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  runMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  runScore: { color: '#7c3aed', fontSize: 16, fontWeight: '700', marginLeft: 12 },
})

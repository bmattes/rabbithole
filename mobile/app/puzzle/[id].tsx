import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { computeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'
import { separateBubbles } from '../../lib/bubbleLayout'
import { colors } from '../../lib/theme'


const DOMAIN_HINTS: Record<string, string> = {
  movies: 'via directors, cast & studios',
  sport: 'via teams, cities & coaches',
  music: 'via performers, covers & influences',
  science: 'via institutions & fields',
  history: 'via parties & offices',
}

const { width: SW } = Dimensions.get('window')

export default function PuzzleScreen() {
  const { id: categoryId, categoryName } = useLocalSearchParams<{ id: string; categoryName?: string }>()
  const { elapsed, start, stop } = useTimer()
  const { userId } = useAuth()
  const progression = useProgression(userId)
  const unlockedDifficulties = progression.unlockedDifficulties
  const difficulty = (unlockedDifficulties[unlockedDifficulties.length - 1] ?? 'easy') as 'easy' | 'medium' | 'hard'
  const { puzzle: livePuzzle, loading, alreadyCompleted } = usePuzzle(categoryId, userId, difficulty)
  const [started, setStarted] = useState(false)
  const [currentHops, setCurrentHops] = useState(0)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const canvasHeightSetRef = useRef(false)

  const puzzle = livePuzzle
  const domain = puzzle?.domain
  const optimalHops = puzzle ? puzzle.optimal_path.length - 1 : 0

  const layoutBubbles = useMemo(() => {
    if (!puzzle || canvasHeight === 0) return []
    const n = puzzle.bubbles.length
    const fixedIndices = new Set([0, n - 1])
    const positions = separateBubbles(
      puzzle.bubbles.map(b => b.position),
      SW,
      canvasHeight,
      fixedIndices
    )
    return puzzle.bubbles.map((b, i) => ({ ...b, position: positions[i] }))
  }, [puzzle?.id, canvasHeight])

  useEffect(() => {
    if (layoutBubbles.length > 0 && !started) { start(); setStarted(true) }
  }, [layoutBubbles.length])

  useEffect(() => {
    if (alreadyCompleted) router.replace('/(tabs)')
  }, [alreadyCompleted])

  if (loading) return <View style={styles.center}><ActivityIndicator color="#7c3aed" size="large" /></View>
  if (!puzzle) return (
    <View style={styles.center}>
      <Text style={styles.error}>No puzzle available</Text>
      <Pressable onPress={() => router.back()} style={styles.backFallback}>
        <Text style={styles.backFallbackText}>← Back</Text>
      </Pressable>
    </View>
  )

  async function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const hops = path.length - 1
    const score = computeScore({ playerPath: path, optimalPath: puzzle!.optimal_path, timeMs })

    const labelMap = Object.fromEntries(puzzle!.bubbles.map(b => [b.id, b.label]))
    const playerPathLabels = path.map(id => labelMap[id] ?? id).join('|')
    const optimalPathLabels = puzzle!.optimal_path.map(id => labelMap[id] ?? id).join('|')

    if (!puzzle!.id.startsWith('mock-') && userId) {
      await submitRun({ puzzleId: puzzle!.id, userId, path, timeMs, score })
    }

    const narrativeParam = puzzle!.narrative ? `&narrative=${encodeURIComponent(puzzle!.narrative)}` : ''
    const categoryParam = categoryName ? `&categoryName=${encodeURIComponent(categoryName)}` : ''
    const dateParam = puzzle!.date ? `&puzzleDate=${encodeURIComponent(puzzle!.date)}` : ''
    router.replace(
      `/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}&hops=${hops}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}&difficulty=${difficulty}${narrativeParam}${categoryParam}${dateParam}`
    )
  }

  const timerColor = elapsed < 60000 ? colors.textPrimary : elapsed < 180000 ? '#d97706' : '#dc2626'
  const minutes = Math.floor(elapsed / 60000)
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
  const hopColor = currentHops === 0 ? '#555' : currentHops <= optimalHops ? '#7c3aed' : '#eab308'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerMiddle}>
          <Text style={styles.title}>{puzzle.start_concept} → {puzzle.end_concept}</Text>
          <View style={styles.constraintRow}>
            {puzzle.domain && DOMAIN_HINTS[puzzle.domain] && (
              <Text style={styles.constraint}>{DOMAIN_HINTS[puzzle.domain]}</Text>
            )}
            {puzzle.difficulty && (
              <Text style={[styles.diffBadge, puzzle.difficulty === 'hard' ? styles.diffHard : puzzle.difficulty === 'medium' ? styles.diffMedium : styles.diffEasy]}>
                {puzzle.difficulty}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.timer, { color: timerColor }]}>{minutes}:{seconds}</Text>
          <View style={styles.hopBadge}>
            <Text style={[styles.hopCount, { color: hopColor }]}>{currentHops}</Text>
            <Text style={styles.hopLabel}> / {optimalHops} hops</Text>
          </View>
        </View>
      </View>
      <PuzzleCanvas
        bubbles={layoutBubbles}
        connections={puzzle.connections}
        startId={puzzle.bubbles[0]?.id}
        endId={puzzle.bubbles[puzzle.bubbles.length - 1]?.id}
        minHops={optimalHops}
        onPathComplete={handlePathComplete}
        onPathChange={(path) => setCurrentHops(Math.max(0, path.length - 1))}
        edgeLabels={puzzle.edgeLabels}
        onCanvasLayout={h => {
          if (!canvasHeightSetRef.current && h > 0) {
            canvasHeightSetRef.current = true
            setCanvasHeight(h)
          }
        }}
      />
    </View>
  )
}

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

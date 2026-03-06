import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { useAuth } from '../../hooks/useAuth'
import { computeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'
import { separateBubbles } from '../../lib/bubbleLayout'


const DOMAIN_HINTS: Record<string, string> = {
  movies: 'via directors, cast & studios',
  sport: 'via teams, cities & coaches',
  music: 'via performers, covers & influences',
  science: 'via institutions & fields',
  history: 'via parties & offices',
}

const { width: SW } = Dimensions.get('window')

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { elapsed, start, stop } = useTimer()
  const { userId } = useAuth()
  const { puzzle: livePuzzle, loading } = usePuzzle(categoryId, userId)
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
    if (puzzle && !started) { start(); setStarted(true) }
  }, [puzzle])

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
      submitRun({ puzzleId: puzzle!.id, userId, path, timeMs, score })
    }

    const narrativeParam = puzzle!.narrative ? `&narrative=${encodeURIComponent(puzzle!.narrative)}` : ''
    router.replace(
      `/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}&hops=${hops}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}${narrativeParam}`
    )
  }

  const timerColor = elapsed < 60000 ? '#fff' : elapsed < 180000 ? '#eab308' : '#f97316'
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
  backBtn: { paddingRight: 10, paddingTop: 2 },
  backText: { color: '#7c3aed', fontSize: 22 },
  headerMiddle: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 21 },
  constraintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  constraint: { color: '#7c3aed', fontSize: 11, fontWeight: '600' },
  diffBadge: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  diffEasy: { color: '#22c55e', backgroundColor: '#22c55e22' },
  diffMedium: { color: '#eab308', backgroundColor: '#eab30822' },
  diffHard: { color: '#ef4444', backgroundColor: '#ef444422' },
  headerRight: { alignItems: 'flex-end', marginLeft: 12 },
  timer: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  hopBadge: { flexDirection: 'row', alignItems: 'baseline' },
  hopCount: { fontSize: 15, fontWeight: '800' },
  hopLabel: { color: '#555', fontSize: 12 },
  error: { color: '#ef4444', fontSize: 16, marginBottom: 20 },
  backFallback: { paddingVertical: 10, paddingHorizontal: 20 },
  backFallbackText: { color: '#7c3aed', fontSize: 16 },
})

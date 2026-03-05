import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { useAuth } from '../../hooks/useAuth'
import { computeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'
import { separateBubbles } from '../../lib/bubbleLayout'
import { MOCK_PUZZLES } from '../../lib/puzzles'

const { width: SW, height: SH } = Dimensions.get('window')
const CANVAS_HEIGHT = SH - 130

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { puzzle: livePuzzle, loading } = usePuzzle(categoryId)
  const { elapsed, start, stop } = useTimer()
  const { userId } = useAuth()
  const [started, setStarted] = useState(false)
  const [currentHops, setCurrentHops] = useState(0)

  const mockPuzzle = MOCK_PUZZLES[categoryId] ?? MOCK_PUZZLES['movies']
  const puzzle = livePuzzle ?? (!loading ? mockPuzzle : null)
  const optimalHops = puzzle ? puzzle.optimal_path.length - 1 : 0

  const layoutBubbles = useMemo(() => {
    if (!puzzle) return []
    const fixedIndices = new Set([0, puzzle.bubbles.length - 1])
    const positions = separateBubbles(
      puzzle.bubbles.map(b => b.position),
      SW,
      CANVAS_HEIGHT,
      fixedIndices
    )
    return puzzle.bubbles.map((b, i) => ({ ...b, position: positions[i] }))
  }, [puzzle?.id])

  useEffect(() => {
    if (puzzle && !started) { start(); setStarted(true) }
  }, [puzzle])

  if (loading) return <View style={styles.center}><ActivityIndicator color="#7c3aed" size="large" /></View>
  if (!puzzle) return <View style={styles.center}><Text style={styles.error}>No puzzle available</Text></View>

  function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const hops = path.length - 1
    const score = computeScore({ optimalHops, playerHops: hops, timeMs })

    const labelMap = Object.fromEntries(puzzle!.bubbles.map(b => [b.id, b.label]))
    const playerPathLabels = path.map(id => labelMap[id] ?? id).join('|')
    const optimalPathLabels = puzzle!.optimal_path.map(id => labelMap[id] ?? id).join('|')

    if (!puzzle!.id.startsWith('mock-') && userId) {
      submitRun({ puzzleId: puzzle!.id, userId, path, timeMs, score })
    }

    router.replace(
      `/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}&hops=${hops}&optimalHops=${optimalHops}&playerPath=${encodeURIComponent(playerPathLabels)}&optimalPath=${encodeURIComponent(optimalPathLabels)}`
    )
  }

  const timerColor = elapsed < 60000 ? '#fff' : elapsed < 180000 ? '#eab308' : '#f97316'
  const minutes = Math.floor(elapsed / 60000)
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
  const hopColor = currentHops === 0 ? '#555' : currentHops <= optimalHops ? '#7c3aed' : '#eab308'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RabbitHole</Text>
        <Text style={[styles.timer, { color: timerColor }]}>{minutes}:{seconds}</Text>
      </View>
      <View style={styles.subheader}>
        <Text style={styles.prompt}>{puzzle.start_concept} → {puzzle.end_concept}</Text>
        <View style={styles.hopBadge}>
          <Text style={[styles.hopCount, { color: hopColor }]}>{currentHops}</Text>
          <Text style={styles.hopLabel}> / {optimalHops} hops</Text>
        </View>
      </View>
      <PuzzleCanvas
        bubbles={layoutBubbles}
        connections={puzzle.connections}
        startId={puzzle.bubbles[0]?.id}
        endId={puzzle.bubbles[puzzle.bubbles.length - 1]?.id}
        onPathComplete={handlePathComplete}
        onPathChange={(path) => setCurrentHops(Math.max(0, path.length - 1))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { color: '#7c3aed', fontSize: 24, fontWeight: '800' },
  timer: { fontSize: 20, fontWeight: '700' },
  subheader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  prompt: { color: '#888', fontSize: 13, flex: 1 },
  hopBadge: { flexDirection: 'row', alignItems: 'baseline' },
  hopCount: { fontSize: 18, fontWeight: '800' },
  hopLabel: { color: '#555', fontSize: 13 },
  error: { color: '#ef4444', fontSize: 16 },
})

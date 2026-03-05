import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { computeScore } from '../../lib/scoring'
import { findBreakPoints } from '../../lib/pathValidation'
import { submitRun } from '../../lib/api'

// Mock data used when no Supabase puzzle is available
const MOCK_PUZZLE = {
  id: 'mock-puzzle',
  category_id: 'mock',
  date: '',
  start_concept: 'The Godfather',
  end_concept: 'Apocalypse Now',
  narrative: null,
  bubbles: [
    { id: 'start', label: 'The Godfather', position: { x: 195, y: 120 } },
    { id: 'b1', label: 'Francis Coppola', position: { x: 100, y: 280 } },
    { id: 'b2', label: 'Marlon Brando', position: { x: 290, y: 260 } },
    { id: 'b3', label: 'Al Pacino', position: { x: 80, y: 420 } },
    { id: 'b4', label: 'Vietnam War', position: { x: 290, y: 430 } },
    { id: 'orphan', label: 'Citizen Kane', position: { x: 190, y: 355 } },
    { id: 'end', label: 'Apocalypse Now', position: { x: 195, y: 570 } },
  ],
  connections: {
    start: ['b1', 'b2'],
    b1: ['start', 'b3', 'end'],
    b2: ['start', 'b4'],
    b3: ['b1', 'end'],
    b4: ['b2', 'end'],
    orphan: [],
    end: ['b1', 'b3', 'b4'],
  } as Record<string, string[]>,
  optimal_path: ['start', 'b1', 'end'],
}

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { puzzle: livePuzzle, loading, error } = usePuzzle(categoryId)
  const { elapsed, running, start, stop } = useTimer()
  const [started, setStarted] = useState(false)

  // Use live puzzle if available, otherwise fall back to mock
  const puzzle = livePuzzle ?? (!loading ? MOCK_PUZZLE : null)

  useEffect(() => {
    if (puzzle && !started) {
      start()
      setStarted(true)
    }
  }, [puzzle])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    )
  }

  if (!puzzle) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'No puzzle available'}</Text>
      </View>
    )
  }

  function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const breaks = findBreakPoints(path, puzzle!.connections)
    if (breaks.length > 0) return // invalid path, keep going

    const score = computeScore({
      optimalHops: puzzle!.optimal_path.length - 1,
      playerHops: path.length - 1,
      timeMs,
    })

    if (puzzle!.id !== 'mock-puzzle') {
      submitRun({
        puzzleId: puzzle!.id,
        userId: 'anon', // replaced with real auth in Task 18
        path,
        timeMs,
        score,
      })
    }

    router.replace(`/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}`)
  }

  const timerColor = elapsed < 60000 ? '#fff' : elapsed < 180000 ? '#eab308' : '#f97316'
  const minutes = Math.floor(elapsed / 60000)
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')

  const startId = puzzle.bubbles[0]?.id
  const endId = puzzle.bubbles[puzzle.bubbles.length - 1]?.id

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RabbitHole</Text>
        <Text style={[styles.timer, { color: timerColor }]}>{minutes}:{seconds}</Text>
      </View>
      <Text style={styles.prompt}>
        {puzzle.start_concept} → {puzzle.end_concept}
      </Text>
      <PuzzleCanvas
        bubbles={puzzle.bubbles}
        connections={puzzle.connections}
        startId={startId}
        endId={endId}
        onPathComplete={handlePathComplete}
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
  prompt: { color: '#888', fontSize: 13, paddingHorizontal: 20, paddingBottom: 8 },
  error: { color: '#ef4444', fontSize: 16 },
})

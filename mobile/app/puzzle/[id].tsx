import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { computeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'

// 15 bubbles: optimal path is start→b2→b7→end (3 hops)
// Multiple valid longer routes exist, plus 3 orphans
const MOCK_PUZZLE = {
  id: 'mock-puzzle',
  category_id: 'mock',
  date: '',
  start_concept: 'The Godfather',
  end_concept: 'Apocalypse Now',
  narrative: null,
  bubbles: [
    // Start
    { id: 'start', label: 'The Godfather',     position: { x: 195, y: 100 } },
    // Tier 1 — directly connected to start
    { id: 'b1',    label: 'Marlon Brando',      position: { x:  80, y: 210 } },
    { id: 'b2',    label: 'Francis Coppola',    position: { x: 195, y: 200 } },
    { id: 'b3',    label: 'Al Pacino',          position: { x: 310, y: 210 } },
    // Tier 2 — mid-level connectors
    { id: 'b4',    label: 'The Conversation',   position: { x:  55, y: 330 } },
    { id: 'b5',    label: 'Godfather II',        position: { x: 155, y: 320 } },
    { id: 'b6',    label: 'Scarface',            position: { x: 310, y: 320 } },
    { id: 'b7',    label: 'Vietnam War',         position: { x: 195, y: 390 } },
    // Tier 3 — deeper connectors
    { id: 'b8',    label: 'Robert Duvall',       position: { x:  70, y: 460 } },
    { id: 'b9',    label: 'George Lucas',        position: { x: 195, y: 480 } },
    { id: 'b10',   label: 'Brian De Palma',      position: { x: 320, y: 460 } },
    { id: 'b11',   label: 'Martin Sheen',        position: { x: 120, y: 540 } },
    { id: 'b12',   label: 'Dennis Hopper',       position: { x: 290, y: 545 } },
    // Orphans — no connections, distractors
    { id: 'o1',    label: 'Citizen Kane',        position: { x:  55, y: 570 } },
    { id: 'o2',    label: 'Lawrence of Arabia',  position: { x: 335, y: 230 } },
    // End
    { id: 'end',   label: 'Apocalypse Now',      position: { x: 195, y: 640 } },
  ],
  connections: {
    start: ['b1', 'b2', 'b3'],
    b1:    ['start', 'b4', 'b5'],
    b2:    ['start', 'b5', 'b7'],      // b2→b7→end = optimal shortcut
    b3:    ['start', 'b6'],
    b4:    ['b1', 'b8'],
    b5:    ['b1', 'b2', 'b9'],
    b6:    ['b3', 'b10'],
    b7:    ['b2', 'b9', 'b11', 'end'], // b7 connects to end
    b8:    ['b4', 'b11'],
    b9:    ['b5', 'b7'],
    b10:   ['b6', 'b12'],
    b11:   ['b7', 'b8', 'end'],
    b12:   ['b10', 'end'],
    o1:    [],
    o2:    [],
    end:   ['b7', 'b11', 'b12'],
  } as Record<string, string[]>,
  optimal_path: ['start', 'b2', 'b7', 'end'], // 3 hops
}

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { puzzle: livePuzzle, loading } = usePuzzle(categoryId)
  const { elapsed, start, stop } = useTimer()
  const [started, setStarted] = useState(false)

  const puzzle = livePuzzle ?? (!loading ? MOCK_PUZZLE : null)

  useEffect(() => {
    if (puzzle && !started) {
      start()
      setStarted(true)
    }
  }, [puzzle])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#7c3aed" size="large" /></View>
  }

  if (!puzzle) {
    return <View style={styles.center}><Text style={styles.error}>No puzzle available</Text></View>
  }

  function handlePathComplete(path: string[]) {
    const timeMs = stop()
    const score = computeScore({
      optimalHops: puzzle!.optimal_path.length - 1,
      playerHops: path.length - 1,
      timeMs,
    })

    if (puzzle!.id !== 'mock-puzzle') {
      submitRun({ puzzleId: puzzle!.id, userId: 'anon', path, timeMs, score })
    }

    router.replace(`/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}`)
  }

  const timerColor = elapsed < 60000 ? '#fff' : elapsed < 180000 ? '#eab308' : '#f97316'
  const minutes = Math.floor(elapsed / 60000)
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RabbitHole</Text>
        <Text style={[styles.timer, { color: timerColor }]}>{minutes}:{seconds}</Text>
      </View>
      <Text style={styles.prompt}>{puzzle.start_concept} → {puzzle.end_concept}</Text>
      <PuzzleCanvas
        bubbles={puzzle.bubbles}
        connections={puzzle.connections}
        startId={puzzle.bubbles[0]?.id}
        endId={puzzle.bubbles[puzzle.bubbles.length - 1]?.id}
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

import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'
import { usePuzzle } from '../../hooks/usePuzzle'
import { useTimer } from '../../hooks/useTimer'
import { computeScore } from '../../lib/scoring'
import { submitRun } from '../../lib/api'
import { separateBubbles } from '../../lib/bubbleLayout'

const { width: SW, height: SH } = Dimensions.get('window')
const CANVAS_HEIGHT = SH - 130

const MOCK_PUZZLE = {
  id: 'mock-puzzle',
  category_id: 'mock',
  date: '',
  start_concept: 'The Godfather',
  end_concept: 'Apocalypse Now',
  narrative: null,
  bubbles: [
    { id: 'start', label: 'The Godfather',     position: { x: SW/2,      y: 80  } },
    { id: 'b1',    label: 'Marlon Brando',      position: { x: SW*0.20,   y: 190 } },
    { id: 'b2',    label: 'Francis Coppola',    position: { x: SW*0.50,   y: 195 } },
    { id: 'b3',    label: 'Al Pacino',          position: { x: SW*0.80,   y: 190 } },
    { id: 'b4',    label: 'The Conversation',   position: { x: SW*0.15,   y: 310 } },
    { id: 'b5',    label: 'Godfather II',        position: { x: SW*0.42,   y: 305 } },
    { id: 'b6',    label: 'Scarface',            position: { x: SW*0.75,   y: 310 } },
    { id: 'b7',    label: 'Vietnam War',         position: { x: SW*0.50,   y: 390 } },
    { id: 'b8',    label: 'Robert Duvall',       position: { x: SW*0.18,   y: 450 } },
    { id: 'b9',    label: 'George Lucas',        position: { x: SW*0.50,   y: 470 } },
    { id: 'b10',   label: 'Brian De Palma',      position: { x: SW*0.82,   y: 450 } },
    { id: 'b11',   label: 'Martin Sheen',        position: { x: SW*0.30,   y: 545 } },
    { id: 'b12',   label: 'Dennis Hopper',       position: { x: SW*0.70,   y: 545 } },
    { id: 'o1',    label: 'Citizen Kane',        position: { x: SW*0.15,   y: 570 } },
    { id: 'o2',    label: 'Lawrence of Arabia',  position: { x: SW*0.85,   y: 240 } },
    { id: 'end',   label: 'Apocalypse Now',      position: { x: SW/2,      y: 640 } },
  ],
  connections: {
    start: ['b1', 'b2', 'b3'],
    b1:    ['start', 'b4', 'b5'],
    b2:    ['start', 'b5', 'b7'],
    b3:    ['start', 'b6'],
    b4:    ['b1', 'b8'],
    b5:    ['b1', 'b2', 'b9'],
    b6:    ['b3', 'b10'],
    b7:    ['b2', 'b9', 'b11', 'end'],
    b8:    ['b4', 'b11'],
    b9:    ['b5', 'b7'],
    b10:   ['b6', 'b12'],
    b11:   ['b7', 'b8', 'end'],
    b12:   ['b10', 'end'],
    o1:    [],
    o2:    [],
    end:   ['b7', 'b11', 'b12'],
  } as Record<string, string[]>,
  optimal_path: ['start', 'b2', 'b7', 'end'],
}

export default function PuzzleScreen() {
  const { id: categoryId } = useLocalSearchParams<{ id: string }>()
  const { puzzle: livePuzzle, loading } = usePuzzle(categoryId)
  const { elapsed, start, stop } = useTimer()
  const [started, setStarted] = useState(false)
  const [currentHops, setCurrentHops] = useState(0)

  const puzzle = livePuzzle ?? (!loading ? MOCK_PUZZLE : null)
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
    if (puzzle!.id !== 'mock-puzzle') {
      submitRun({ puzzleId: puzzle!.id, userId: 'anon', path, timeMs, score })
    }
    router.replace(`/results/${puzzle!.id}?score=${score}&timeMs=${timeMs}&hops=${hops}&optimalHops=${optimalHops}`)
  }

  function handlePathChange(path: string[]) {
    setCurrentHops(Math.max(0, path.length - 1))
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
        onPathChange={handlePathChange}
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

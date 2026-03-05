import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { PuzzleCanvas } from '../../components/PuzzleCanvas'

const MOCK_BUBBLES = [
  { id: 'start', label: 'The Godfather', position: { x: 195, y: 120 } },
  { id: 'b1', label: 'Francis Coppola', position: { x: 100, y: 280 } },
  { id: 'b2', label: 'Marlon Brando', position: { x: 290, y: 260 } },
  { id: 'b3', label: 'Al Pacino', position: { x: 80, y: 420 } },
  { id: 'b4', label: 'Vietnam War', position: { x: 280, y: 430 } },
  { id: 'orphan', label: 'Citizen Kane', position: { x: 170, y: 360 } },
  { id: 'end', label: 'Apocalypse Now', position: { x: 195, y: 570 } },
]

const MOCK_CONNECTIONS: Record<string, string[]> = {
  start: ['b1', 'b2'],
  b1: ['start', 'b3', 'end'],
  b2: ['start', 'b4'],
  b3: ['b1', 'end'],
  b4: ['b2', 'end'],
  orphan: [],
  end: ['b1', 'b3', 'b4'],
}

export default function PuzzleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RabbitHole</Text>
        <Text style={styles.category}>{id}</Text>
      </View>
      <PuzzleCanvas
        bubbles={MOCK_BUBBLES}
        connections={MOCK_CONNECTIONS}
        startId="start"
        endId="end"
        onPathComplete={(path) => console.log('Path complete:', path)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  title: { color: '#7c3aed', fontSize: 24, fontWeight: '800' },
  category: { color: '#888', fontSize: 14, marginTop: 2 },
})

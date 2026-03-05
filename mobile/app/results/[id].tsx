import React from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

export default function ResultsScreen() {
  const { id: puzzleId, score, timeMs } = useLocalSearchParams<{
    id: string
    score: string
    timeMs: string
  }>()

  const totalMs = parseInt(timeMs ?? '0')
  const minutes = Math.floor(totalMs / 60000)
  const seconds = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0')
  const scoreNum = parseInt(score ?? '0')

  const grade =
    scoreNum >= 900 ? 'Perfect' :
    scoreNum >= 700 ? 'Great' :
    scoreNum >= 500 ? 'Good' : 'Keep trying'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RabbitHole</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.grade}>{grade}</Text>
        <Text style={styles.scoreValue}>{scoreNum}</Text>
        <Text style={styles.scoreLabel}>points</Text>
        <View style={styles.divider} />
        <Text style={styles.timeValue}>{minutes}:{seconds}</Text>
        <Text style={styles.timeLabel}>time</Text>
      </View>

      <Pressable style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>Back to Today</Text>
      </Pressable>

      <Pressable style={styles.buttonSecondary} onPress={() => router.replace('/leaderboard')}>
        <Text style={styles.buttonSecondaryText}>See Leaderboard</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, alignItems: 'center' },
  title: { color: '#7c3aed', fontSize: 32, fontWeight: '800', marginBottom: 40 },
  scoreCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  grade: { color: '#7c3aed', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  scoreValue: { color: '#fff', fontSize: 80, fontWeight: '800', lineHeight: 88 },
  scoreLabel: { color: '#555', fontSize: 14, marginBottom: 20 },
  divider: { width: 40, height: 1, backgroundColor: '#2a2a3e', marginBottom: 20 },
  timeValue: { color: '#7c3aed', fontSize: 28, fontWeight: '700' },
  timeLabel: { color: '#555', fontSize: 14, marginTop: 4 },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: '#555', fontSize: 15 },
})

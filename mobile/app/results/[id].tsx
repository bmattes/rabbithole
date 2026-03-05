import React from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

function PathDisplay({ labels, color }: { labels: string[]; color: string }) {
  return (
    <View style={pathStyles.row}>
      {labels.map((label, i) => (
        <View key={i} style={pathStyles.stepRow}>
          <View style={[pathStyles.dot, { backgroundColor: color }]} />
          <Text style={pathStyles.label}>{label}</Text>
          {i < labels.length - 1 && <Text style={pathStyles.arrow}>↓</Text>}
        </View>
      ))}
    </View>
  )
}

const pathStyles = StyleSheet.create({
  row: { alignItems: 'flex-start', width: '100%' },
  stepRow: { alignItems: 'center', marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  arrow: { color: '#444', fontSize: 12, marginTop: 2, marginBottom: 2 },
})

export default function ResultsScreen() {
  const { id: puzzleId, score, timeMs, hops, optimalHops, playerPath, optimalPath } =
    useLocalSearchParams<{
      id: string
      score: string
      timeMs: string
      hops: string
      optimalHops: string
      playerPath: string
      optimalPath: string
    }>()

  const totalMs = parseInt(timeMs ?? '0')
  const minutes = Math.floor(totalMs / 60000)
  const seconds = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0')
  const scoreNum = parseInt(score ?? '0')
  const hopsNum = parseInt(hops ?? '0')
  const optimalHopsNum = parseInt(optimalHops ?? '0')

  const playerLabels = playerPath ? decodeURIComponent(playerPath).split('|') : []
  const optimalLabels = optimalPath ? decodeURIComponent(optimalPath).split('|') : []

  const isOptimal = hopsNum <= optimalHopsNum
  const grade = scoreNum >= 900 ? 'Perfect' : scoreNum >= 700 ? 'Great' : scoreNum >= 500 ? 'Good' : 'Keep trying'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RabbitHole</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.grade}>{grade}</Text>
        <Text style={styles.scoreValue}>{scoreNum}</Text>
        <Text style={styles.scoreLabel}>points</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{minutes}:{seconds}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: isOptimal ? '#7c3aed' : '#eab308' }]}>
              {hopsNum} hop{hopsNum !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.statLabel}>your path</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{optimalHopsNum} hop{optimalHopsNum !== 1 ? 's' : ''}</Text>
            <Text style={styles.statLabel}>optimal</Text>
          </View>
        </View>
      </View>

      {/* Path comparison */}
      <View style={styles.pathsCard}>
        <View style={styles.pathCol}>
          <Text style={styles.pathTitle}>Your Path</Text>
          <PathDisplay labels={playerLabels} color={isOptimal ? '#7c3aed' : '#eab308'} />
        </View>
        {!isOptimal && (
          <>
            <View style={styles.pathDivider} />
            <View style={styles.pathCol}>
              <Text style={styles.pathTitle}>Optimal Path</Text>
              <PathDisplay labels={optimalLabels} color="#7c3aed" />
            </View>
          </>
        )}
      </View>

      {/* AI narrative placeholder */}
      <View style={styles.narrativeCard}>
        <Text style={styles.narrativeTitle}>The RabbitHole</Text>
        <Text style={styles.narrativePlaceholder}>AI narrative coming soon...</Text>
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
  content: { padding: 24, paddingTop: 72, alignItems: 'center' },
  title: { color: '#7c3aed', fontSize: 32, fontWeight: '800', marginBottom: 24 },
  scoreCard: {
    backgroundColor: '#1e1e2e', borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  grade: { color: '#7c3aed', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  scoreValue: { color: '#fff', fontSize: 72, fontWeight: '800', lineHeight: 80 },
  scoreLabel: { color: '#555', fontSize: 14, marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { alignItems: 'center', paddingHorizontal: 16 },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#555', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#2a2a3e' },
  pathsCard: {
    backgroundColor: '#1e1e2e', borderRadius: 20, padding: 20,
    width: '100%', marginBottom: 16, flexDirection: 'row',
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  pathCol: { flex: 1 },
  pathTitle: { color: '#555', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  pathDivider: { width: 1, backgroundColor: '#2a2a3e', marginHorizontal: 16 },
  narrativeCard: {
    backgroundColor: '#1e1e2e', borderRadius: 20, padding: 20,
    width: '100%', marginBottom: 32,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  narrativeTitle: { color: '#7c3aed', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  narrativePlaceholder: { color: '#444', fontSize: 14, fontStyle: 'italic' },
  button: {
    backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16,
    width: '100%', alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: '#555', fontSize: 15 },
})

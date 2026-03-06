import React from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'

function BoldTermsText({ text, terms, style }: { text: string; terms: string[]; style: object }) {
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)
  const seenIndices = new Set<number>()

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const termIndex = terms.findIndex(t => t.toLowerCase() === part.toLowerCase())
        if (termIndex === -1) return <React.Fragment key={i}>{part}</React.Fragment>
        const isFirst = !seenIndices.has(termIndex)
        if (isFirst) seenIndices.add(termIndex)
        return (
          <Text key={i} style={styles.narrativeBold}>
            {part}{isFirst ? <Text style={styles.narrativeNum}> ({termIndex + 1})</Text> : null}
          </Text>
        )
      })}
    </Text>
  )
}

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
  const { id: puzzleId, score, timeMs, hops, optimalHops, playerPath, optimalPath, narrative } =
    useLocalSearchParams<{
      id: string
      score: string
      timeMs: string
      hops: string
      optimalHops: string
      playerPath: string
      optimalPath: string
      narrative: string
    }>()

  const totalMs = parseInt(timeMs ?? '0')
  const minutes = Math.floor(totalMs / 60000)
  const seconds = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0')
  const scoreNum = parseInt(score ?? '0')
  const hopsNum = parseInt(hops ?? '0')
  const optimalHopsNum = parseInt(optimalHops ?? '0')

  const playerLabels = playerPath ? decodeURIComponent(playerPath).split('|') : []
  const optimalLabels = optimalPath ? decodeURIComponent(optimalPath).split('|') : []

  const beatOptimal = hopsNum < optimalHopsNum
  const samePathAsOptimal = playerLabels.join('|') === optimalLabels.join('|')
  const grade = beatOptimal ? 'Genius' : samePathAsOptimal ? 'Perfect' : scoreNum >= 700 ? 'Great' : scoreNum >= 500 ? 'Good' : 'Keep trying'

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
            <Text style={[styles.statValue, { color: beatOptimal ? '#22c55e' : samePathAsOptimal ? '#7c3aed' : '#eab308' }]}>
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
        {samePathAsOptimal && (
          <View style={styles.optimalBanner}>
            <Text style={styles.optimalBannerText}>⚡ You found the optimal path</Text>
          </View>
        )}
        <View style={styles.pathCol}>
          <Text style={styles.pathTitle}>{samePathAsOptimal ? 'Your Path = Optimal Path' : 'Your Path'}</Text>
          <PathDisplay labels={playerLabels} color={beatOptimal ? '#22c55e' : samePathAsOptimal ? '#7c3aed' : '#eab308'} />
        </View>
        {!samePathAsOptimal && (
          <>
            <View style={styles.pathDivider} />
            <View style={styles.pathCol}>
              <Text style={styles.pathTitle}>Optimal Path</Text>
              <PathDisplay labels={optimalLabels} color="#7c3aed" />
            </View>
          </>
        )}
      </View>

      {/* AI narrative */}
      <View style={styles.narrativeCard}>
        <Text style={styles.narrativeTitle}>The RabbitHole</Text>
        <Text style={styles.narrativeSubtitle}>The optimal path through the rabbit hole</Text>
        {narrative ? (
          <BoldTermsText
            text={decodeURIComponent(narrative)}
            terms={optimalLabels}
            style={styles.narrativeText}
          />
        ) : (
          <Text style={styles.narrativePlaceholder}>No narrative available for this puzzle.</Text>
        )}
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
  optimalBanner: { backgroundColor: '#1a0f2e', borderRadius: 10, padding: 10, marginBottom: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7c3aed' },
  optimalBannerText: { color: '#7c3aed', fontSize: 13, fontWeight: '700' },
  pathDivider: { width: 1, backgroundColor: '#2a2a3e', marginHorizontal: 16 },
  narrativeCard: {
    backgroundColor: '#1e1e2e', borderRadius: 20, padding: 20,
    width: '100%', marginBottom: 32,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  narrativeTitle: { color: '#7c3aed', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  narrativeSubtitle: { color: '#444', fontSize: 11, marginBottom: 10 },
  narrativeText: { color: '#ccc', fontSize: 15, lineHeight: 22 },
  narrativeBold: { color: '#fff', fontWeight: '700' },
  narrativeNum: { color: '#7c3aed', fontWeight: '400', fontSize: 12 },
  narrativePlaceholder: { color: '#444', fontSize: 14, fontStyle: 'italic' },
  button: {
    backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16,
    width: '100%', alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonSecondary: { paddingVertical: 12 },
  buttonSecondaryText: { color: '#555', fontSize: 15 },
})

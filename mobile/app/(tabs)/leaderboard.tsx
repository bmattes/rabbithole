import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { getLeaderboardToday } from '../../lib/api'

export default function LeaderboardScreen() {
  const { userId } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboardToday()
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      {loading ? (
        <ActivityIndicator color="#7c3aed" />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No entries yet today. Be first!</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item, index }) => (
            <View style={[styles.row, item.user_id === userId && styles.myRow]}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.score}>{item.score}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 80, paddingHorizontal: 20 },
  title: { color: '#7c3aed', fontSize: 28, fontWeight: '800', marginBottom: 32 },
  empty: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  myRow: { backgroundColor: '#1e1e2e', borderRadius: 10, paddingHorizontal: 12, marginHorizontal: -12 },
  rank: { color: '#555', width: 36, fontSize: 14 },
  name: { flex: 1, color: '#fff', fontSize: 16 },
  score: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
})

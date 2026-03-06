import React, { useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { getCategories, getLeaderboardForCategory } from '../../lib/api'

const CATEGORY_EMOJIS: Record<string, string> = {
  movies: '🎬',
  sport: '🏆',
  music: '🎵',
  science: '🔬',
  history: '📜',
}

interface Category {
  id: string
  name: string
  wikidata_domain: string
}

export default function LeaderboardScreen() {
  const { userId } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    getCategories().then(data => {
      const cats = data as Category[]
      setCategories(cats)
      if (cats.length > 0) setSelectedId(cats[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId || fetchedRef.current === selectedId) return
    fetchedRef.current = selectedId
    setLoading(true)
    setEntries([])
    getLeaderboardForCategory(selectedId)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [selectedId])

  const selectedCat = categories.find(c => c.id === selectedId)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {categories.map(cat => {
          const active = cat.id === selectedId
          return (
            <Pressable
              key={cat.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                if (cat.id !== selectedId) {
                  fetchedRef.current = null
                  setSelectedId(cat.id)
                }
              }}
            >
              <Text style={styles.tabEmoji}>{CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{cat.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No entries yet.</Text>
          <Text style={styles.emptySub}>Play today's {selectedCat?.name} puzzle to be first!</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item, index }) => {
            const isMe = item.user_id === userId
            const rankColor = index === 0 ? '#facc15' : index === 1 ? '#94a3b8' : index === 2 ? '#c97c3a' : '#555'
            return (
              <View style={[styles.row, isMe && styles.myRow]}>
                <Text style={[styles.rank, { color: rankColor }]}>#{index + 1}</Text>
                <Text style={[styles.name, isMe && styles.myName]}>{item.display_name}{isMe ? ' (you)' : ''}</Text>
                <View style={styles.scoreCol}>
                  <Text style={styles.score}>{item.score}</Text>
                  <Text style={styles.time}>{Math.round(item.time_ms / 1000)}s</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 80 },
  title: { color: '#7c3aed', fontSize: 28, fontWeight: '800', marginBottom: 20, paddingHorizontal: 20 },
  tabsContainer: { flexGrow: 0, marginBottom: 20 },
  tabsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1e1e2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 6,
  },
  tabActive: { backgroundColor: '#3b1f6e', borderColor: '#7c3aed' },
  tabEmoji: { fontSize: 14 },
  tabLabel: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: '#fff' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#555', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  myRow: { backgroundColor: '#1e1e2e' },
  rank: { width: 36, fontSize: 14, fontWeight: '700' },
  name: { flex: 1, color: '#fff', fontSize: 15 },
  myName: { color: '#a78bfa', fontWeight: '700' },
  scoreCol: { alignItems: 'flex-end' },
  score: { color: '#7c3aed', fontSize: 16, fontWeight: '700' },
  time: { color: '#555', fontSize: 11, marginTop: 1 },
})

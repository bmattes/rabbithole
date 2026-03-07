import { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { getCategories } from '../../lib/api'
import { CATEGORY_EMOJIS } from '../../lib/categoryEmojis'

const CATEGORY_HINTS: Record<string, string> = {
  movies: 'connected by directors, cast & studios',
  sport: 'connected by teams, cities & coaches',
  music: 'connected by performers, covers & influences',
  science: 'connected by institutions & fields',
  history: 'connected by parties & offices held',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#eab308',
  hard: '#ef4444',
}

interface Category {
  id: string
  name: string
  wikidata_domain: string
  difficulty?: string | null
  completed?: boolean
}

export default function TodayScreen() {
  const { session, loading, signInAnonymously, userId } = useAuth()
  const progression = useProgression(userId)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const categories = useMemo(() => {
    const unlocked = progression.unlockedCategories
    if (unlocked.length > 0) return allCategories.filter(c => unlocked.includes(c.id))
    return allCategories.slice(0, 2)
  }, [allCategories, progression.unlockedCategories])

  useEffect(() => {
    if (!loading && !session) {
      signInAnonymously()
    }
  }, [loading, session])

  const loadCategories = useCallback(() => {
    if (loading) return
    setCategoriesLoading(true)
    getCategories(userId).then(data => {
      setAllCategories(data as Category[])
      setCategoriesLoading(false)
    })
  }, [userId, loading])

  useEffect(() => { loadCategories() }, [loadCategories])

  // Re-fetch completion state every time this tab comes into focus
  useFocusEffect(useCallback(() => { loadCategories() }, [loadCategories]))

  if (loading || categoriesLoading || progression.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>RabbitHole</Text>
      <Text style={styles.subtitle}>Today's Puzzles</Text>

      {categories.map(cat => {
        const done = !!cat.completed
        return (
          <Pressable
            key={cat.id}
            style={[styles.card, done && styles.cardDone]}
            onPress={() => { if (!done) router.push(`/puzzle/${cat.id}`) }}
          >
            <Text style={styles.cardEmoji}>{CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}</Text>
            <View style={styles.cardText}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>{cat.name}</Text>
                {!done && cat.difficulty && (
                  <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLORS[cat.difficulty] + '22', borderColor: DIFFICULTY_COLORS[cat.difficulty] + '66' }]}>
                    <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[cat.difficulty] }]}>{cat.difficulty}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardHint}>
                {done ? 'Completed today' : (CATEGORY_HINTS[cat.wikidata_domain] ?? '')}
              </Text>
              <Text style={styles.diffAvailable}>
                {progression.unlockedDifficulties.join(' · ')}
              </Text>
            </View>
            {done
              ? <Text style={styles.cardCheck}>✓</Text>
              : <Text style={styles.cardArrow}>→</Text>
            }
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#7c3aed', fontSize: 36, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 16, marginBottom: 40 },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  cardEmoji: { fontSize: 24, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  diffBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardTitleDone: { color: '#555' },
  cardHint: { color: '#888', fontSize: 12, marginTop: 3 },
  diffAvailable: { color: '#555', fontSize: 11, marginTop: 2 },
  cardArrow: { color: '#7c3aed', fontSize: 20, marginLeft: 8 },
  cardDone: { borderColor: '#1a2e1a', backgroundColor: '#111811' },
  cardCheck: { color: '#22c55e', fontSize: 20, fontWeight: '700', marginLeft: 8 },
})

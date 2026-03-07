import { useEffect, useState, useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { getCategories } from '../../lib/api'
import { CATEGORY_EMOJIS } from '../../lib/categoryEmojis'
import { colors } from '../../lib/theme'

const CATEGORY_HINTS: Record<string, string> = {
  movies: 'connected by directors, cast & studios',
  sport: 'connected by teams, cities & coaches',
  music: 'connected by performers, covers & influences',
  science: 'connected by institutions & fields',
  history: 'connected by parties & offices held',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#d97706',
  hard: '#dc2626',
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
    if (!userId) { setCategoriesLoading(false); return }
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.accent, fontSize: 36, fontWeight: '800', marginBottom: 4, letterSpacing: -1 },
  subtitle: { color: colors.textTertiary, fontSize: 15, marginBottom: 40, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardDone: { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
  cardEmoji: { fontSize: 24, marginRight: 14 },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  cardTitleDone: { color: colors.textTertiary },
  diffBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardHint: { color: colors.textTertiary, fontSize: 12, marginTop: 3 },
  diffAvailable: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  cardArrow: { color: colors.accent, fontSize: 20, marginLeft: 8 },
  cardCheck: { color: colors.success, fontSize: 20, fontWeight: '700', marginLeft: 8 },
})

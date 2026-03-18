import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { useProgression } from '../../hooks/useProgression'
import { getCategories } from '../../lib/api'
import { CATEGORY_EMOJIS } from '../../lib/categoryEmojis'
import { colors } from '../../lib/theme'

type DiffHints = { easy: string; medium: string; hard: string }

const CATEGORY_HINTS: Record<string, DiffHints | string> = {
  movies: {
    easy:   'connected by shared cast',
    medium: 'connected by cast & directors',
    hard:   'connected by cast, directors & studios',
  },
  sport: {
    easy:   'connected by teams they played for',
    medium: 'connected by teams & cities',
    hard:   'connected by teams, cities & coaches',
  },
  music: {
    easy:   'connected by songs & performers',
    medium: 'connected by performers & record labels',
    hard:   'connected by performers, labels & influences',
  },
  science: {
    easy:   'connected by shared institutions',
    medium: 'connected by institutions & fields of work',
    hard:   'connected by institutions & fields of work',
  },
  history: {
    easy:   'connected by political parties',
    medium: 'connected by parties & offices held',
    hard:   'connected by parties & offices held',
  },
  videogames: {
    easy:   'connected by game series',
    medium: 'connected by series & developers',
    hard:   'connected by series, developers & publishers',
  },
  art: {
    easy:   'connected by painters & artworks',
    medium: 'connected by painters & art movements',
    hard:   'connected by painters, movements & institutions',
  },
  literature: {
    easy:   'connected by novels, authors & literary movements',
    medium: 'connected by authors & literary movements',
    hard:   'connected by authors & literary movements',
  },
  geography: {
    easy:   'connected by capitals, countries & continents',
    medium: 'connected by countries & continents',
    hard:   'connected by countries & continents',
  },
  royals: {
    easy:   'connected by countries & monarchs',
    medium: 'connected by monarchs & dynasties',
    hard:   'connected by monarchs & dynasties',
  },
  tennis: {
    easy:   'connected by nationality',
    medium: 'connected by nationality & teams',
    hard:   'connected by nationality & teams',
  },
  soccer: {
    easy:   'connected by clubs',
    medium: 'connected by clubs & leagues',
    hard:   'connected by clubs & leagues',
  },
  tv: {
    easy:   'connected by shared cast',
    medium: 'connected by cast & creators',
    hard:   'connected by cast & creators',
  },
  philosophy: {
    easy:   'connected by schools of thought',
    medium: 'connected by schools of thought',
    hard:   'connected by schools of thought & influences',
  },
  military: {
    easy:   'connected by country & nationality',
    medium: 'connected by nationality & conflicts',
    hard:   'connected by nationality & conflicts',
  },
  mythology: {
    easy:   'connected by mythology systems',
    medium: 'connected by mythology systems & pantheons',
    hard:   'connected by pantheons, family & legend',
  },
  space: {
    easy:   'connected by space agencies',
    medium: 'connected by space agencies & nationality',
    hard:   'connected by space agencies & nationality',
  },
  food: {
    easy:   'connected by country of origin',
    medium: 'connected by origin & food categories',
    hard:   'connected by origin & food categories',
  },
  comics: {
    easy:   'connected by publisher',
    medium: 'connected by publisher & teams',
    hard:   'connected by publisher, teams & creators',
  },
  mb_rock:          'connected by bands & collaborations',
  mb_hiphop:        'connected by crews, labels & features',
  mb_pop:           'connected by labels & collaborations',
  mb_rnb:           'connected by labels & influences',
  mb_country:       'connected by labels & bands',
  basketball: {
    easy:   'connected by basketball teams',
    medium: 'connected by NBA teams & leagues',
    hard:   'connected by NBA teams, leagues & divisions',
  },
  americanfootball: {
    easy:   'connected by NFL teams',
    medium: 'connected by teams & leagues',
    hard:   'connected by teams & leagues',
  },
}

function getCategoryHint(domain: string, difficulty?: string | null): string {
  const hint = CATEGORY_HINTS[domain]
  if (!hint) return ''
  if (typeof hint === 'string') return hint
  return hint[(difficulty as keyof DiffHints) ?? 'easy'] ?? hint.easy
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
  const { loading, userId } = useAuth()
  const progression = useProgression(userId)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy')

  // Keep selectedDifficulty valid when unlocks change
  useEffect(() => {
    const unlocked = progression.unlockedDifficulties
    if (!unlocked.includes(selectedDifficulty)) {
      setSelectedDifficulty(unlocked[unlocked.length - 1] ?? 'easy')
    }
  }, [progression.unlockedDifficulties])

  const categories = useMemo(() => {
    const unlocked = progression.unlockedCategories
    const slots = progression.categorySlots
    return allCategories.filter(c => unlocked.includes(c.id)).slice(0, slots)
  }, [allCategories, progression.unlockedCategories, progression.categorySlots])

  const loadCategories = useCallback((showSpinner = true) => {
    if (loading || progression.loading) return
    if (!userId) { setCategoriesLoading(false); return }
    if (showSpinner) setCategoriesLoading(true)
    getCategories(userId, selectedDifficulty).then(data => {
      setAllCategories(data as Category[])
      setCategoriesLoading(false)
    })
  }, [userId, loading, progression.loading, selectedDifficulty])

  const isFirstLoad = useRef(true)
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      loadCategories(true)
    } else {
      loadCategories(false)
    }
  }, [loadCategories])

  // Re-fetch completion state every time this tab comes into focus
  useFocusEffect(useCallback(() => { loadCategories(false) }, [loadCategories]))

  if (loading || categoriesLoading || progression.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" />
      </View>
    )
  }

  const allDone = categories.length > 0 && categories.every(c => c.completed)

  const unlockedDiffs = progression.unlockedDifficulties

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Today's Puzzles</Text>

      <View style={styles.diffTabs}>
        {(['easy', 'medium', 'hard'] as const).map(d => {
          const unlocked = unlockedDiffs.includes(d)
          const active = selectedDifficulty === d
          return (
            <Pressable
              key={d}
              disabled={!unlocked}
              style={[
                styles.diffTab,
                active && { backgroundColor: DIFFICULTY_COLORS[d], borderColor: DIFFICULTY_COLORS[d] },
                !unlocked && styles.diffTabLocked,
              ]}
              onPress={() => setSelectedDifficulty(d)}
            >
              <Text style={[styles.diffTabText, active && styles.diffTabTextActive, !unlocked && styles.diffTabTextLocked]}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
              {!unlocked && <Text style={styles.diffTabLockIcon}>🔒</Text>}
            </Pressable>
          )
        })}
      </View>

      {categories.map(cat => {
        const done = !!cat.completed
        return (
          <Pressable
            key={cat.id}
            style={[styles.card, done && styles.cardDone]}
            onPress={() => { if (!done) router.push(`/puzzle/${cat.id}?categoryName=${encodeURIComponent(cat.name)}&difficulty=${selectedDifficulty}`) }}
          >
            <Text style={styles.cardEmoji}>{CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}</Text>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>{cat.name}</Text>
              <Text style={styles.cardHint}>
                {done ? 'Completed today' : getCategoryHint(cat.wikidata_domain, selectedDifficulty)}
              </Text>
            </View>
            {done
              ? <Text style={styles.cardCheck}>✓</Text>
              : <Text style={styles.cardArrow}>→</Text>
            }
          </Pressable>
        )
      })}

      {allDone && (
        <View style={styles.allDoneCard}>
          <Text style={styles.allDoneEmoji}>🐇</Text>
          <Text style={styles.allDoneTitle}>You're all done!</Text>
          <Text style={styles.allDoneSub}>New puzzles drop tomorrow. Come back then.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.accent, fontSize: 28, fontWeight: '800', marginBottom: 20 },
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
  diffTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  diffTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  diffTabText: { color: colors.textTertiary, fontSize: 13, fontWeight: '700' },
  diffTabTextActive: { color: '#fff' },
  diffTabLocked: { opacity: 0.4 },
  diffTabTextLocked: { color: colors.textTertiary },
  diffTabLockIcon: { fontSize: 10, marginTop: 2 },
  cardArrow: { color: colors.accent, fontSize: 20, marginLeft: 8 },
  cardCheck: { color: colors.success, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  allDoneCard: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  allDoneEmoji: { fontSize: 40, marginBottom: 12 },
  allDoneTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  allDoneSub: { color: colors.textTertiary, fontSize: 13, textAlign: 'center' },
})

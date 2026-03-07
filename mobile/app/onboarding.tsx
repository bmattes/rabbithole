import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { getCategories, saveUnlockedCategory } from '../lib/api'
import { CATEGORY_EMOJIS } from '../lib/categoryEmojis'
import { colors } from '../lib/theme'
import { useAuth } from '../hooks/useAuth'

const PICK_COUNT = 4

interface Category {
  id: string
  name: string
  wikidata_domain: string
}

export default function OnboardingScreen() {
  const { userId } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    getCategories(userId).then(data => {
      setCategories(data as Category[])
      setLoading(false)
    })
  }, [userId])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < PICK_COUNT) {
        next.add(id)
      }
      return next
    })
  }

  async function confirm() {
    if (!userId || selected.size < PICK_COUNT) return
    setSaving(true)
    await Promise.all(Array.from(selected).map(id => saveUnlockedCategory(userId, id)))
    router.replace('/(tabs)')
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const remaining = PICK_COUNT - selected.size

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pick your topics</Text>
        <Text style={styles.subtitle}>
          {remaining > 0
            ? `Choose ${remaining} more to start`
            : 'Ready to go!'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {categories.map(cat => {
          const isSelected = selected.has(cat.id)
          const isDisabled = !isSelected && selected.size >= PICK_COUNT
          return (
            <Pressable
              key={cat.id}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                isDisabled && styles.chipDisabled,
              ]}
              onPress={() => toggle(cat.id)}
            >
              <Text style={styles.chipEmoji}>
                {CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}
              </Text>
              <Text style={[styles.chipName, isSelected && styles.chipNameSelected]}>
                {cat.name}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, selected.size < PICK_COUNT && styles.buttonDisabled]}
          onPress={confirm}
          disabled={selected.size < PICK_COUNT || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Let's go →</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 6, fontWeight: '500' },
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '12',
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipEmoji: { fontSize: 16 },
  chipName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  chipNameSelected: { color: colors.accent },
  checkmark: { fontSize: 12, color: colors.accent, fontWeight: '800' },
  footer: { padding: 24, paddingBottom: 40 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})

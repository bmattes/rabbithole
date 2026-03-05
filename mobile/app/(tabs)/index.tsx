import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'

const CATEGORIES = [
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'basketball', label: 'Basketball', emoji: '🏀' },
]

export default function TodayScreen() {
  const { session, loading, signInAnonymously } = useAuth()

  useEffect(() => {
    if (!loading && !session) {
      signInAnonymously()
    }
  }, [loading, session])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c3aed" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RabbitHole</Text>
      <Text style={styles.subtitle}>Today's Puzzles</Text>

      {CATEGORIES.map(cat => (
        <Pressable
          key={cat.id}
          style={styles.card}
          onPress={() => router.push(`/puzzle/${cat.id}`)}
        >
          <Text style={styles.cardEmoji}>{cat.emoji}</Text>
          <Text style={styles.cardTitle}>{cat.label}</Text>
          <Text style={styles.cardArrow}>→</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 80, paddingHorizontal: 24 },
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
  cardTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600' },
  cardArrow: { color: '#7c3aed', fontSize: 20 },
})

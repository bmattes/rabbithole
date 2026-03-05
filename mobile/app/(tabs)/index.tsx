import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'

export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RabbitHole</Text>
      <Text style={styles.subtitle}>Today's Puzzles</Text>

      <Pressable style={styles.card} onPress={() => router.push('/puzzle/Movies')}>
        <Text style={styles.cardTitle}>Movies</Text>
        <Text style={styles.cardArrow}>→</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 80, paddingHorizontal: 24 },
  title: { color: '#7c3aed', fontSize: 36, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 16, marginBottom: 40 },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardArrow: { color: '#7c3aed', fontSize: 20 },
})

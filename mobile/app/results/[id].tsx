import { useLocalSearchParams } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Results {id}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 18 },
})

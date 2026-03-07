import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { CATEGORY_EMOJIS } from '../lib/categoryEmojis'

interface CategoryOption {
  id: string
  name: string
  wikidata_domain: string
}

interface Props {
  visible: boolean
  availableCategories: CategoryOption[]
  onSelect: (categoryId: string) => void
}

export function CategoryUnlockModal({ visible, availableCategories, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>New Category Unlocked!</Text>
          <Text style={styles.subtitle}>Choose which category to add</Text>
          {availableCategories.map(cat => (
            <Pressable key={cat.id} style={styles.option} onPress={() => onSelect(cat.id)}>
              <Text style={styles.emoji}>{CATEGORY_EMOJIS[cat.wikidata_domain] ?? '🐇'}</Text>
              <Text style={styles.name}>{cat.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#16162a',
    borderRadius: 12,
    marginBottom: 10,
  },
  emoji: { fontSize: 24 },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
})

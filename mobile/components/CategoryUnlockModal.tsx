import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { CATEGORY_EMOJIS } from '../lib/categoryEmojis'
import { colors } from '../lib/theme'

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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.bgCardAlt,
    borderRadius: 12,
    marginBottom: 10,
  },
  emoji: { fontSize: 24 },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
})

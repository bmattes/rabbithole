import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'

interface Props {
  visible: boolean
  onClose: () => void
  onSubscribe: (plan: 'monthly' | 'yearly') => void
}

export function SubscribeModal({ visible, onClose, onSubscribe }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>RabbitHole+</Text>
          <Text style={styles.subtitle}>Unlock the full archive</Text>

          <View style={styles.features}>
            <Text style={styles.feature}>✓  30+ days of puzzles in every category</Text>
            <Text style={styles.feature}>✓  Profile badge on the leaderboard</Text>
            <Text style={styles.feature}>✓  No ads, ever</Text>
          </View>

          <Pressable style={styles.monthlyBtn} onPress={() => onSubscribe('monthly')}>
            <Text style={styles.monthlyText}>$2.99 / month</Text>
          </Pressable>

          <Pressable style={styles.yearlyBtn} onPress={() => onSubscribe('yearly')}>
            <Text style={styles.yearlyText}>$19.99 / year  ·  save 44%</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1e1e2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  title: {
    color: '#7c3aed',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  features: {
    marginBottom: 28,
    gap: 10,
  },
  feature: {
    color: '#ccc',
    fontSize: 15,
  },
  monthlyBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  monthlyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  yearlyBtn: {
    borderColor: '#7c3aed',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  yearlyText: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '600',
  },
  dismiss: {
    alignItems: 'center',
  },
  dismissText: {
    color: '#555',
    fontSize: 14,
  },
})

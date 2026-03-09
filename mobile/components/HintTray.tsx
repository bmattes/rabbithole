import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { colors } from '../lib/theme'

export type HintType = 'connection' | 'shuffle' | 'flash' | 'bridge'

interface HintTrayProps {
  hintsRemaining: number
  activeHint: HintType | null
  onUseHint: (type: HintType) => void
  connectionAvailable: boolean  // false if no edgeLabels on this puzzle (disables Connection button)
}

const HINTS: Array<{ type: HintType; label: string; icon: string }> = [
  { type: 'connection', label: 'Connection', icon: '🔗' },
  { type: 'shuffle',    label: 'Shuffle',    icon: '🔀' },
  { type: 'flash',      label: 'Flash',      icon: '⚡' },
  { type: 'bridge',     label: 'Bridge',     icon: '🌉' },
]

export function HintTray({ hintsRemaining, activeHint, onUseHint, connectionAvailable }: HintTrayProps) {
  const depleted = hintsRemaining === 0
  const scaleRefs = useRef<Record<HintType, Animated.Value>>({
    connection: new Animated.Value(1),
    shuffle: new Animated.Value(1),
    flash: new Animated.Value(1),
    bridge: new Animated.Value(1),
  }).current

  function handlePress(type: HintType) {
    // Bounce the button immediately as feedback, then call onUseHint
    Animated.sequence([
      Animated.spring(scaleRefs[type], { toValue: 1.25, useNativeDriver: true, damping: 4, stiffness: 400 }),
      Animated.spring(scaleRefs[type], { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start()
    onUseHint(type)
  }

  return (
    <View style={styles.tray}>
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>Hints</Text>
        <View style={styles.dots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, i < hintsRemaining ? styles.dotActive : styles.dotUsed]} />
          ))}
        </View>
      </View>
      <View style={styles.buttons}>
        {HINTS.map(h => {
          const isActive = activeHint === h.type
          const disabled = depleted
            || (activeHint !== null && !isActive)
            || (h.type === 'connection' && !connectionAvailable)
          return (
            <Animated.View key={h.type} style={{ flex: 1, transform: [{ scale: scaleRefs[h.type] }] }}>
              <Pressable
                style={[styles.btn, isActive && styles.btnActive, disabled && styles.btnDisabled]}
                onPress={() => !disabled && handlePress(h.type)}
                disabled={disabled}
              >
                <Text style={styles.btnIcon}>{h.icon}</Text>
                <Text style={[styles.btnLabel, disabled && styles.btnLabelDisabled]}>{h.label}</Text>
              </Pressable>
            </Animated.View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tray: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  countLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: colors.accent },
  dotUsed: { backgroundColor: colors.border },
  buttons: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  btn: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  btnDisabled: { opacity: 0.35 },
  btnIcon: { fontSize: 18, marginBottom: 2 },
  btnLabel: { color: colors.textPrimary, fontSize: 10, fontWeight: '600' },
  btnLabelDisabled: { color: colors.textTertiary },
})

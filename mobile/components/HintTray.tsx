import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../lib/theme'

export type HintType = 'connection' | 'shuffle' | 'flash' | 'bridge'

interface HintTrayProps {
  remainingByType: Record<HintType, number>
  activeHint: HintType | null
  onUseHint: (type: HintType) => void
  connectionAvailable: boolean  // false if no edgeLabels on this puzzle (disables Connection button)
}

const HINTS: Array<{ type: HintType; label: string; icon: string }> = [
  { type: 'connection', label: 'Connection', icon: '🔗' },
  { type: 'shuffle',    label: 'Shuffle',    icon: '🔀' },
  { type: 'flash',      label: 'Flash',      icon: '⚡' },
  { type: 'bridge',     label: 'Reveal',     icon: '🌉' },
]

export function HintTray({ remainingByType, activeHint, onUseHint, connectionAvailable }: HintTrayProps) {
  const { bottom } = useSafeAreaInsets()
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
    <View style={[styles.tray, { paddingBottom: Math.max(bottom, 10) }]}>
      <View style={styles.buttons}>
        {HINTS.map(h => {
          const isActive = activeHint === h.type
          const remaining = remainingByType[h.type]
          const depleted = remaining === 0
          const disabled = depleted
            || (activeHint !== null && !isActive)
            || (h.type === 'connection' && !connectionAvailable)
          return (
            <Animated.View key={h.type} style={{ flex: 1, height: 52, transform: [{ scale: scaleRefs[h.type] }] }}>
              <Pressable
                style={[styles.btn, isActive && styles.btnActive, disabled && styles.btnDisabled]}
                onPress={() => !disabled && handlePress(h.type)}
                disabled={disabled}
              >
                <Text style={styles.btnIcon}>{h.icon}</Text>
                <Text style={[styles.btnLabel, disabled && styles.btnLabelDisabled]}>{h.label}</Text>
                <View style={styles.dots}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={[styles.dot, i < remaining ? styles.dotActive : styles.dotUsed]} />
                  ))}
                </View>
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
    paddingTop: 10,
  },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotActive: { backgroundColor: colors.accent },
  dotUsed: { backgroundColor: colors.border },
  buttons: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  btnDisabled: { opacity: 0.35 },
  btnIcon: { fontSize: 16, marginBottom: 1 },
  btnLabel: { color: colors.textPrimary, fontSize: 10, fontWeight: '600' },
  btnLabelDisabled: { color: colors.textTertiary },
})

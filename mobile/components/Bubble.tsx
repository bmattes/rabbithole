import React, { useEffect, useRef } from 'react'
import { Text, StyleSheet, Animated } from 'react-native'
import { colors } from '../lib/theme'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken'

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
  index?: number
  pulse?: boolean
}

// Hit target size — used for layout and touch detection
export const BUBBLE_W = 140
export const BUBBLE_H = 60
export const BUBBLE_RADIUS = BUBBLE_H / 2
export const PILL_MAX_W = 220

const PILL_COLORS: Record<'start' | 'end', string> = {
  start: '#16a34a',
  end: '#dc2626',
}

const TEXT_COLORS: Record<BubbleState, string> = {
  idle: colors.textPrimary,
  active: colors.accent,
  start: '#fff',
  end: '#fff',
  broken: '#ef4444',
}

export function Bubble({ label: rawLabel, state, position, index = 0, pulse }: BubbleProps) {
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  const translateY = useRef(new Animated.Value(40)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const prevPulse = useRef(false)

  useEffect(() => {
    const delay = index * 50
    const t = setTimeout(() => {
      Animated.parallel?.([
        Animated.spring(translateY, { toValue: 0, damping: 14, useNativeDriver: true }),
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      ])?.start()
    }, delay)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (pulse && !prevPulse.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 8, useNativeDriver: true }),
      ]).start()
    }
    prevPulse.current = !!pulse
  }, [pulse])

  const isPill = state === 'start' || state === 'end'
  const displayW = isPill ? PILL_MAX_W : BUBBLE_W + 40

  return (
    <Animated.View
      testID="bubble-container"
      style={[
        styles.container,
        isPill ? [styles.pill, { backgroundColor: PILL_COLORS[state] }] : styles.textNode,
        {
          width: displayW,
          left: position.x - displayW / 2,
          top: position.y - BUBBLE_H / 2,
        },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <Text
        style={[
          isPill ? styles.pillLabel : styles.textLabel,
          { color: TEXT_COLORS[state] },
          state === 'active' && styles.textActive,
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    minHeight: BUBBLE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: BUBBLE_H / 2,
    paddingVertical: 10,
  },
  textNode: {
    // No background — just floating text
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  textLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  textActive: {
    fontWeight: '800',
  },
})

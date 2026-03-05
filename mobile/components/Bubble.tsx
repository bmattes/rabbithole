import React, { useEffect, useRef } from 'react'
import { Text, StyleSheet, Animated } from 'react-native'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken'

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
  index?: number
  pulse?: boolean
}

export const BUBBLE_RADIUS = 44

const STATE_COLORS: Record<BubbleState, string> = {
  idle: '#1e1e2e',
  active: '#7c3aed',
  start: '#16a34a',
  end: '#dc2626',
  broken: '#ef4444',
}

export function Bubble({ label, state, position, index = 0, pulse }: BubbleProps) {
  const translateY = useRef(new Animated.Value(60)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const prevPulse = useRef(false)

  // Entry animation
  useEffect(() => {
    const delay = index * 60
    const t = setTimeout(() => {
      Animated.parallel?.([
        Animated.spring(translateY, { toValue: 0, damping: 14, useNativeDriver: true }),
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      ])?.start()
    }, delay)
    return () => clearTimeout(t)
  }, [])

  // Pulse on commit
  useEffect(() => {
    if (pulse && !prevPulse.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 8, useNativeDriver: true }),
      ]).start()
    }
    prevPulse.current = !!pulse
  }, [pulse])

  return (
    <Animated.View
      testID="bubble-container"
      style={[
        styles.bubble,
        {
          backgroundColor: STATE_COLORS[state],
          left: position.x - BUBBLE_RADIUS,
          top: position.y - BUBBLE_RADIUS,
        },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <Text style={styles.label} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
        {label}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_RADIUS * 2,
    height: BUBBLE_RADIUS * 2,
    borderRadius: BUBBLE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 6,
    lineHeight: 15,
  },
})

import React, { useEffect } from 'react'
import { Text, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken'

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
  index?: number
}

export const BUBBLE_RADIUS = 44

const STATE_COLORS: Record<BubbleState, string> = {
  idle: '#1e1e2e',
  active: '#7c3aed',
  start: '#16a34a',
  end: '#dc2626',
  broken: '#ef4444',
}

export function Bubble({ label, state, position, index = 0 }: BubbleProps) {
  const translateY = useSharedValue(60)
  const opacity = useSharedValue(0)

  useEffect(() => {
    const delay = index * 60
    setTimeout(() => {
      translateY.value = withSpring(0, { damping: 14 })
      opacity.value = withSpring(1)
    }, delay)
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

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
        animatedStyle,
      ]}
    >
      <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit>
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
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
})

import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

interface RippleEffectProps {
  center: { x: number; y: number }
  onComplete?: () => void
}

export function RippleEffect({ center, onComplete }: RippleEffectProps) {
  const scale = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 4, duration: 600, useNativeDriver: true }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onComplete?.()
    })
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          left: center.x - 40,
          top: center.y - 40,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
  },
})

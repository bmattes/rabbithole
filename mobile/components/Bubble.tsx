import React, { useEffect, useRef } from 'react'
import { Text, StyleSheet, Animated } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import { colors } from '../lib/theme'

export type BubbleState = 'idle' | 'active' | 'start' | 'end' | 'broken' | 'bridge' | 'flash'

interface BubbleProps {
  label: string
  state: BubbleState
  position: { x: number; y: number }
  index?: number
  pulse?: boolean
  hovering?: boolean
  bubbleScale?: number
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
  bridge: '#f59e0b',
  flash: colors.textPrimary,
}

const RING_PAD = 4
const AnimatedRect = Animated.createAnimatedComponent(Rect)

export function Bubble({ label: rawLabel, state, position, index = 0, pulse, hovering, bubbleScale = 1 }: BubbleProps) {
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  const translateY = useRef(new Animated.Value(40)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const prevPulse = useRef(false)
  const dwellProgress = useRef(new Animated.Value(0)).current
  const prevHovering = useRef(false)

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

  useEffect(() => {
    if (hovering && !prevHovering.current) {
      dwellProgress.setValue(0)
      Animated.timing(dwellProgress, { toValue: 1, duration: 300, useNativeDriver: false }).start()
    } else if (!hovering && prevHovering.current) {
      dwellProgress.setValue(0)
    }
    prevHovering.current = !!hovering
  }, [hovering])

  const isPill = state === 'start' || state === 'end'
  const displayW = (isPill ? PILL_MAX_W : BUBBLE_W + 40) * bubbleScale
  const displayH = BUBBLE_H * bubbleScale
  const fontSize = Math.round((isPill ? 14 : 15) * bubbleScale)
  const borderRadius = displayH / 2
  const RING_W = displayW + RING_PAD * 2
  const RING_H = displayH + RING_PAD * 2
  const RING_RX = displayH / 2 + RING_PAD
  const RING_PERIMETER = 2 * (RING_W - 2 * RING_RX) + 2 * (RING_H - 2 * RING_RX) + 2 * Math.PI * RING_RX

  const strokeDashoffset = dwellProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_PERIMETER, 0],
  })

  return (
    <Animated.View
      testID="bubble-container"
      style={[
        styles.container,
        isPill ? [styles.pill, { backgroundColor: PILL_COLORS[state as 'start' | 'end'] }] : styles.textNode,
        state === 'idle' && styles.textNodeIdle,
        state === 'active' && styles.textNodeActive,
        state === 'bridge' && styles.textNodeBridge,
        state === 'flash' && styles.textNodeFlash,
        isPill && { borderRadius },
        !isPill && { borderRadius, minHeight: displayH },
        {
          width: displayW,
          left: position.x - displayW / 2,
          top: position.y - displayH / 2,
        },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <Text
        style={[
          isPill ? styles.pillLabel : styles.textLabel,
          { color: TEXT_COLORS[state], fontSize },
          state === 'active' && styles.textActive,
        ]}
      >
        {label}
      </Text>
      {hovering && !isPill && (
        <Svg
          width={RING_W}
          height={RING_H}
          style={[styles.dwellRing, { top: -RING_PAD - 1.5, marginLeft: -RING_W / 2 }]}
          pointerEvents="none"
        >
          <AnimatedRect
            x={1.5}
            y={1.5}
            width={RING_W - 3}
            height={RING_H - 3}
            rx={RING_RX}
            ry={RING_RX}
            stroke={colors.accent}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${RING_PERIMETER} ${RING_PERIMETER}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
      )}
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
  textNode: {},
  textNodeIdle: {
    borderRadius: BUBBLE_H / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  textNodeActive: {
    borderRadius: BUBBLE_H / 2,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  textNodeBridge: {
    borderRadius: BUBBLE_H / 2,
    borderWidth: 3,
    borderColor: '#f59e0b',
    backgroundColor: 'transparent',
  },
  textNodeFlash: {
    borderRadius: BUBBLE_H / 2,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  dwellRing: {
    position: 'absolute',
    left: '50%',
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

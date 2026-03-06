import React, { useCallback, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Bubble, BUBBLE_W, BUBBLE_H, BubbleState } from './Bubble'
import { ConnectionLine } from './ConnectionLine'
import { RippleEffect } from './RippleEffect'

export interface BubbleData {
  id: string
  label: string
  position: { x: number; y: number }
}

interface PuzzleCanvasProps {
  bubbles: BubbleData[]
  connections: Record<string, string[]>
  startId: string
  endId: string
  minHops: number
  onPathComplete: (path: string[]) => void
  onPathChange?: (path: string[]) => void
  onCanvasLayout?: (height: number) => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const DWELL_MS = 300

function hitTest(point: { x: number; y: number }, bubble: BubbleData): boolean {
  return (
    Math.abs(point.x - bubble.position.x) <= BUBBLE_W / 2 &&
    Math.abs(point.y - bubble.position.y) <= BUBBLE_H / 2
  )
}

export function PuzzleCanvas({
  bubbles,
  connections,
  startId,
  endId,
  minHops,
  onPathComplete,
  onPathChange,
  onCanvasLayout,
}: PuzzleCanvasProps) {
  const [activePath, setActivePath] = useState<string[]>([])
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveringId, setHoveringId] = useState<string | null>(null)
  const [lastConnectedId, setLastConnectedId] = useState<string | null>(null)
  const [rippleCenter, setRippleCenter] = useState<{ x: number; y: number } | null>(null)

  const activePathRef = useRef<string[]>([])
  const isTracingRef = useRef(false)
  const onPathCompleteRef = useRef(onPathComplete)
  const onPathChangeRef = useRef(onPathChange)
  const bubblesRef = useRef(bubbles)
  const startIdRef = useRef(startId)
  const endIdRef = useRef(endId)
  const connectionsRef = useRef(connections)
  const minHopsRef = useRef(minHops)
  onPathCompleteRef.current = onPathComplete
  onPathChangeRef.current = onPathChange
  bubblesRef.current = bubbles
  startIdRef.current = startId
  endIdRef.current = endId
  connectionsRef.current = connections
  minHopsRef.current = minHops

  const dwellBubbleRef = useRef<string | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Canvas origin in screen coordinates, set on layout
  const canvasOriginRef = useRef({ x: 0, y: 0 })
  const canvasViewRef = useRef<View>(null)

  const getBubble = useCallback(
    (id: string) => bubblesRef.current.find((b) => b.id === id),
    []
  )

  function toCanvas(pageX: number, pageY: number) {
    return {
      x: pageX - canvasOriginRef.current.x,
      y: pageY - canvasOriginRef.current.y,
    }
  }

  function clearDwell() {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    dwellBubbleRef.current = null
    setHoveringId(null)
  }

  const connectBubbleRef = useRef((bubble: BubbleData) => {
    const currentPath = activePathRef.current
    const existingIndex = currentPath.indexOf(bubble.id)

    if (existingIndex !== -1) {
      activePathRef.current = currentPath.slice(0, existingIndex + 1)
      setActivePath(activePathRef.current)
      onPathChangeRef.current?.(activePathRef.current)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } else {
      // Block landing on end node until minimum hops are reached
      if (bubble.id === endIdRef.current && currentPath.length - 1 < minHopsRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }
      const newPath = [...currentPath, bubble.id]
      activePathRef.current = newPath
      setActivePath(newPath)
      onPathChangeRef.current?.(newPath)
      setLastConnectedId(bubble.id)
      if (bubble.id === endIdRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
    }
    setHoveringId(null)
  })

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent
        const { x, y } = toCanvas(pageX, pageY)
        const currentPath = activePathRef.current

        if (currentPath.length > 0) {
          const checkpoint = getBubble(currentPath[currentPath.length - 1])
          if (checkpoint && hitTest({ x, y }, checkpoint)) {
            isTracingRef.current = true
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          } else {
            activePathRef.current = []
            setActivePath([])
            onPathChangeRef.current?.([])
            setLastConnectedId(null)
            isTracingRef.current = false
          }
          return
        }

        const start = getBubble(startIdRef.current)
        if (!start || !hitTest({ x, y }, start)) return
        isTracingRef.current = true
        activePathRef.current = [startIdRef.current]
        setActivePath([startIdRef.current])
        onPathChangeRef.current?.([startIdRef.current])
        setLastConnectedId(startIdRef.current)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      },
      onPanResponderMove: (evt) => {
        if (!isTracingRef.current) return
        const { pageX, pageY } = evt.nativeEvent
        const { x, y } = toCanvas(pageX, pageY)
        setFingerPos({ x, y })

        const currentPath = activePathRef.current
        const lastId = currentPath[currentPath.length - 1]

        let overBubble: BubbleData | null = null
        for (const bubble of bubblesRef.current) {
          if (hitTest({ x, y }, bubble) && bubble.id !== lastId) {
            overBubble = bubble
            break
          }
        }

        if (!overBubble) {
          clearDwell()
          return
        }

        if (overBubble.id === dwellBubbleRef.current) return

        clearDwell()
        dwellBubbleRef.current = overBubble.id
        setHoveringId(overBubble.id)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

        const capturedBubble = overBubble
        dwellTimerRef.current = setTimeout(() => {
          if (isTracingRef.current && dwellBubbleRef.current === capturedBubble.id) {
            connectBubbleRef.current(capturedBubble)
            dwellBubbleRef.current = null
          }
        }, DWELL_MS)
      },
      onPanResponderRelease: () => {
        clearDwell()
        setFingerPos(null)
        isTracingRef.current = false

        const path = activePathRef.current
        if (path[path.length - 1] === endIdRef.current) {
          const endBubble = bubblesRef.current.find(b => b.id === endIdRef.current)
          if (endBubble) setRippleCenter(endBubble.position)
          onPathCompleteRef.current(path)
        }
      },
      onPanResponderTerminate: () => {
        clearDwell()
        setFingerPos(null)
        isTracingRef.current = false
      },
    })
  ).current

  function getBubbleState(id: string): BubbleState {
    if (id === startId) return 'start'
    if (id === endId) return 'end'
    if (activePath.includes(id)) return 'active'
    if (id === hoveringId) return 'active'
    return 'idle'
  }

  const lastBubble = activePath.length > 0 ? getBubble(activePath[activePath.length - 1]) : null

  return (
    <View
      ref={canvasViewRef}
      style={styles.canvas}
      onLayout={e => {
        onCanvasLayout?.(e.nativeEvent.layout.height)
        canvasViewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
          canvasOriginRef.current = { x: pageX, y: pageY }
        })
      }}
      {...panResponder.panHandlers}
    >
      {activePath.slice(0, -1).map((id, i) => {
        const from = getBubble(id)
        const to = getBubble(activePath[i + 1])
        if (!from || !to) return null
        return (
          <ConnectionLine
            key={`${id}-${activePath[i + 1]}`}
            from={from.position}
            to={to.position}
            active
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        )
      })}

      {isTracingRef.current && lastBubble && fingerPos && (
        <ConnectionLine
          from={lastBubble.position}
          to={fingerPos}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
        />
      )}

      {bubbles.map((bubble, i) => (
        <Bubble
          key={bubble.id}
          label={bubble.label}
          state={getBubbleState(bubble.id)}
          position={bubble.position}
          index={i}
          pulse={bubble.id === lastConnectedId}
        />
      ))}

      {rippleCenter && (
        <RippleEffect
          center={rippleCenter}
          onComplete={() => setRippleCenter(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#0a0a0a' },
})

import React, { useCallback, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Bubble, BUBBLE_RADIUS, BubbleState } from './Bubble'
import { ConnectionLine } from './ConnectionLine'

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
  onPathComplete: (path: string[]) => void
  onPathChange?: (path: string[]) => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const DWELL_MS = 300

function hitTest(point: { x: number; y: number }, bubble: BubbleData): boolean {
  const dx = point.x - bubble.position.x
  const dy = point.y - bubble.position.y
  return Math.sqrt(dx * dx + dy * dy) <= BUBBLE_RADIUS
}

export function PuzzleCanvas({
  bubbles,
  connections,
  startId,
  endId,
  onPathComplete,
  onPathChange,
}: PuzzleCanvasProps) {
  const [activePath, setActivePath] = useState<string[]>([])
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveringId, setHoveringId] = useState<string | null>(null)
  const [lastConnectedId, setLastConnectedId] = useState<string | null>(null)

  const activePathRef = useRef<string[]>([])
  const isTracingRef = useRef(false)
  const onPathCompleteRef = useRef(onPathComplete)
  const onPathChangeRef = useRef(onPathChange)
  onPathCompleteRef.current = onPathComplete
  onPathChangeRef.current = onPathChange

  const dwellBubbleRef = useRef<string | null>(null)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Canvas origin in screen coordinates, set on layout
  const canvasOriginRef = useRef({ x: 0, y: 0 })
  const canvasViewRef = useRef<View>(null)

  const getBubble = useCallback(
    (id: string) => bubbles.find((b) => b.id === id),
    [bubbles]
  )

  function toCanvas(pageX: number, pageY: number) {
    return {
      x: pageX - canvasOriginRef.current.x,
      y: pageY - canvasOriginRef.current.y,
    }
  }

  function updatePath(newPath: string[]) {
    activePathRef.current = newPath
    setActivePath(newPath)
    onPathChangeRef.current?.(newPath)
  }

  function clearDwell() {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    dwellBubbleRef.current = null
    setHoveringId(null)
  }

  function connectBubble(bubble: BubbleData) {
    const currentPath = activePathRef.current
    const existingIndex = currentPath.indexOf(bubble.id)

    if (existingIndex !== -1) {
      updatePath(currentPath.slice(0, existingIndex + 1))
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } else {
      const newPath = [...currentPath, bubble.id]
      updatePath(newPath)
      setLastConnectedId(bubble.id)
      if (bubble.id === endId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
    }
    setHoveringId(null)
  }

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
            updatePath([])
            setLastConnectedId(null)
            isTracingRef.current = false
          }
          return
        }

        const start = getBubble(startId)
        if (!start || !hitTest({ x, y }, start)) return
        isTracingRef.current = true
        updatePath([startId])
        setLastConnectedId(startId)
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
        for (const bubble of bubbles) {
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
            connectBubble(capturedBubble)
            dwellBubbleRef.current = null
          }
        }, DWELL_MS)
      },
      onPanResponderRelease: () => {
        clearDwell()
        setFingerPos(null)
        isTracingRef.current = false

        const path = activePathRef.current
        if (path[path.length - 1] === endId) {
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
      onLayout={() => {
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
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#0a0a0a' },
})

import React, { useCallback, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
  const activePathRef = useRef<string[]>([])
  const isTracingRef = useRef(false)
  const onPathCompleteRef = useRef(onPathComplete)
  const onPathChangeRef = useRef(onPathChange)
  onPathCompleteRef.current = onPathComplete
  onPathChangeRef.current = onPathChange

  const getBubble = useCallback(
    (id: string) => bubbles.find((b) => b.id === id),
    [bubbles]
  )

  function updatePath(newPath: string[]) {
    activePathRef.current = newPath
    setActivePath(newPath)
    onPathChangeRef.current?.(newPath)
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(({ x, y }) => {
      const currentPath = activePathRef.current

      // If we have a checkpoint, resume must start from that last bubble
      if (currentPath.length > 0) {
        const checkpoint = getBubble(currentPath[currentPath.length - 1])
        if (checkpoint && hitTest({ x, y }, checkpoint)) {
          isTracingRef.current = true
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          return
        }
        // Pressed somewhere else — reset and require starting over from start
        updatePath([])
        isTracingRef.current = false
        return
      }

      // No checkpoint yet — must start on the start bubble
      const start = getBubble(startId)
      if (!start || !hitTest({ x, y }, start)) return
      isTracingRef.current = true
      updatePath([startId])
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    })
    .onUpdate(({ x, y }) => {
      if (!isTracingRef.current) return
      setFingerPos({ x, y })

      const currentPath = activePathRef.current
      const lastId = currentPath[currentPath.length - 1]

      for (const bubble of bubbles) {
        if (!hitTest({ x, y }, bubble)) continue
        if (bubble.id === lastId) continue

        const existingIndex = currentPath.indexOf(bubble.id)
        if (existingIndex !== -1) {
          // Backtrack to earlier bubble
          updatePath(currentPath.slice(0, existingIndex + 1))
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          return
        }

        // New bubble
        updatePath([...currentPath, bubble.id])
        if (bubble.id === endId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
        return
      }
    })
    .onEnd(() => {
      setFingerPos(null)
      isTracingRef.current = false

      const path = activePathRef.current
      if (path[path.length - 1] === endId) {
        // Completed — navigate to results
        onPathCompleteRef.current(path)
      }
      // Otherwise: keep path as-is so user can resume from checkpoint
    })

  function getBubbleState(id: string): BubbleState {
    if (id === startId) return 'start'
    if (id === endId) return 'end'
    if (activePath.includes(id)) return 'active'
    return 'idle'
  }

  const lastBubble = activePath.length > 0 ? getBubble(activePath[activePath.length - 1]) : null

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.canvas}>
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
          />
        ))}
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#0a0a0a' },
})

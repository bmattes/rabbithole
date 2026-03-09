import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Dimensions, PanResponder, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Bubble, BUBBLE_W, BUBBLE_H, BubbleState } from './Bubble'
import { ConnectionLine } from './ConnectionLine'
import { RippleEffect } from './RippleEffect'
import { colors } from '../lib/theme'

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
  edgeLabels?: Record<string, string>
  connectionModeActive?: boolean
  onConnectionModeUsed?: () => void
  bridgeNodeIds?: Set<string>
  flashPaths?: string[][] | null
  onFlashComplete?: () => void
  bubbleScale?: number
  onBacktrack?: () => void
  onReset?: () => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const DWELL_MS = 300

const PILL_W = 120
const PILL_H = 28

function bestPillPos(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bubbles: BubbleData[]
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  // Perpendicular offset direction (rotate the line 90°)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const px = -dy / len  // perpendicular unit vector
  const py = dx / len
  const OFFSETS = [0, 40, -40, 70, -70]
  let bestPos = { x: mx, y: my }
  let bestMinDist = -1
  for (const offset of OFFSETS) {
    const cx = mx + px * offset
    const cy = my + py * offset
    // Min distance from this candidate to any bubble center
    const minDist = bubbles.reduce((min, b) => {
      const d = Math.sqrt((cx - b.position.x) ** 2 + (cy - b.position.y) ** 2)
      return Math.min(min, d)
    }, Infinity)
    if (minDist > bestMinDist) {
      bestMinDist = minDist
      bestPos = { x: cx, y: cy }
    }
  }
  return bestPos
}

function hitTest(point: { x: number; y: number }, bubble: BubbleData, scale = 1): boolean {
  return (
    Math.abs(point.x - bubble.position.x) <= (BUBBLE_W + 40) * scale / 2 &&
    Math.abs(point.y - bubble.position.y) <= BUBBLE_H * scale / 2
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
  edgeLabels,
  connectionModeActive,
  onConnectionModeUsed,
  bridgeNodeIds,
  flashPaths,
  onFlashComplete,
  bubbleScale = 1,
  onBacktrack,
  onReset,
}: PuzzleCanvasProps) {
  const [activePath, setActivePath] = useState<string[]>([])
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveringId, setHoveringId] = useState<string | null>(null)
  const [lastConnectedId, setLastConnectedId] = useState<string | null>(null)
  const [rippleCenter, setRippleCenter] = useState<{ x: number; y: number } | null>(null)
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const [hintLabel, setHintLabel] = useState<string | null>(null)
  const [hintPos, setHintPos] = useState<{ x: number; y: number } | null>(null)
  const [hintNodeIds, setHintNodeIds] = useState<[string, string] | null>(null)
  const pillPersistRef = useRef(false)
  const [flashActivePath, setFlashActivePath] = useState<string[]>([])

  // Translate offsets for shuffle animation — each starts at {x:0,y:0} (no offset).
  // On shuffle, we snap each offset to -(delta) so the bubble appears at its old
  // position, then spring back to {x:0,y:0} so it glides to the new position.
  // Uses useNativeDriver:true since we only animate transform (translateX/Y).
  const shuffleOffsets = useMemo(() => {
    const map = new Map<string, Animated.ValueXY>()
    for (const b of bubbles) {
      map.set(b.id, new Animated.ValueXY({ x: 0, y: 0 }))
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles.map(b => b.id).join(',')])

  const prevBubblePositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = []
    for (const b of bubbles) {
      const offset = shuffleOffsets.get(b.id)
      if (!offset) continue
      const prev = prevBubblePositions.current.get(b.id)
      if (prev && (prev.x !== b.position.x || prev.y !== b.position.y)) {
        // Snap to negative delta so bubble visually stays at old position
        offset.setValue({ x: prev.x - b.position.x, y: prev.y - b.position.y })
        animations.push(
          Animated.spring(offset, {
            toValue: { x: 0, y: 0 },
            damping: 14,
            stiffness: 120,
            useNativeDriver: true,
          })
        )
      }
      prevBubblePositions.current.set(b.id, b.position)
    }
    if (animations.length > 0) Animated.parallel(animations).start()
  }, [bubbles])

  const activePathRef = useRef<string[]>([])
  const isTracingRef = useRef(false)
  const onPathCompleteRef = useRef(onPathComplete)
  const onPathChangeRef = useRef(onPathChange)
  const onBacktrackRef = useRef(onBacktrack)
  const onResetRef = useRef(onReset)
  const bubblesRef = useRef(bubbles)
  const startIdRef = useRef(startId)
  const endIdRef = useRef(endId)
  const connectionsRef = useRef(connections)
  const minHopsRef = useRef(minHops)
  onPathCompleteRef.current = onPathComplete
  onPathChangeRef.current = onPathChange
  onBacktrackRef.current = onBacktrack
  onResetRef.current = onReset
  bubblesRef.current = bubbles
  startIdRef.current = startId
  endIdRef.current = endId
  connectionsRef.current = connections
  minHopsRef.current = minHops

  const edgeLabelsRef = useRef(edgeLabels)
  edgeLabelsRef.current = edgeLabels

  const connectionModeActiveRef = useRef(connectionModeActive ?? false)
  connectionModeActiveRef.current = connectionModeActive ?? false
  const onConnectionModeUsedRef = useRef(onConnectionModeUsed)
  onConnectionModeUsedRef.current = onConnectionModeUsed
  const onFlashCompleteRef = useRef(onFlashComplete)
  onFlashCompleteRef.current = onFlashComplete
  const bubbleScaleRef = useRef(bubbleScale)
  bubbleScaleRef.current = bubbleScale

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

  useEffect(() => {
    if (!hintNodeIds || !hintLabel) return
    const from = getBubble(hintNodeIds[0])
    const to = getBubble(hintNodeIds[1])
    if (from && to) {
      setHintPos(bestPillPos(from.position, to.position, bubbles))
    }
  }, [bubbles])

  useEffect(() => {
    if (!flashPaths || flashPaths.length === 0) {
      setFlashActivePath([])
      return
    }
    let cancelled = false
    async function runFlash() {
      for (const path of flashPaths!) {
        if (cancelled) return
        setFlashActivePath(path)
        await new Promise(r => setTimeout(r, 400))
        if (cancelled) return
        setFlashActivePath([])
        await new Promise(r => setTimeout(r, 150))
      }
      if (!cancelled) onFlashCompleteRef.current?.()
    }
    runFlash()
    return () => { cancelled = true; setFlashActivePath([]) }
  }, [flashPaths])

  const connectBubbleRef = useRef((bubble: BubbleData) => {
    const currentPath = activePathRef.current
    const existingIndex = currentPath.indexOf(bubble.id)

    if (existingIndex !== -1) {
      const trimmed = currentPath.slice(0, existingIndex + 1)
      activePathRef.current = trimmed
      setActivePath(trimmed)
      onPathChangeRef.current?.(trimmed)
      // Remove settled state for bubbles trimmed off the path
      setSettledIds(prev => {
        const next = new Set(prev)
        currentPath.slice(existingIndex + 1).forEach(id => next.delete(id))
        return next
      })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onBacktrackRef.current?.()
    } else {
      // Block landing on end node until minimum hops are reached
      // currentPath includes start; adding end makes total hops = currentPath.length
      // so we need currentPath.length >= minHops before allowing end
      if (bubble.id === endIdRef.current && currentPath.length < minHopsRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        return
      }
      const newPath = [...currentPath, bubble.id]
      activePathRef.current = newPath
      setActivePath(newPath)
      onPathChangeRef.current?.(newPath)
      setLastConnectedId(bubble.id)
      // Settle the outline after the line has drawn (~150ms)
      const connectedId = bubble.id
      setTimeout(() => {
        setSettledIds(prev => new Set(prev).add(connectedId))
      }, 150)
      if (bubble.id === endIdRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }
      if (connectionModeActiveRef.current) {
        pillPersistRef.current = true
        onConnectionModeUsedRef.current?.()
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
        pillPersistRef.current = false
        setHintLabel(null)
        setHintPos(null)
        const { pageX, pageY } = evt.nativeEvent
        const { x, y } = toCanvas(pageX, pageY)
        const currentPath = activePathRef.current

        if (currentPath.length > 0) {
          const checkpoint = getBubble(currentPath[currentPath.length - 1])
          if (checkpoint && hitTest({ x, y }, checkpoint, bubbleScaleRef.current)) {
            isTracingRef.current = true
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          } else {
            const hadPath = activePathRef.current.length > 1
            activePathRef.current = []
            setActivePath([])
            onPathChangeRef.current?.([])
            setLastConnectedId(null)
            setSettledIds(new Set())
            isTracingRef.current = false
            if (hadPath) onResetRef.current?.()
          }
          return
        }

        const start = getBubble(startIdRef.current)
        if (!start || !hitTest({ x, y }, start, bubbleScaleRef.current)) return
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
          if (hitTest({ x, y }, bubble, bubbleScaleRef.current) && bubble.id !== lastId) {
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

        // Hint pill only shows when Connection mode is active
        const tipId = activePathRef.current[activePathRef.current.length - 1]
        if (tipId && connectionModeActiveRef.current) {
          const labels = edgeLabelsRef.current
          const label = labels?.[`${tipId}|${overBubble.id}`] ?? labels?.[`${overBubble.id}|${tipId}`] ?? null
          const tipBubbleData = bubblesRef.current.find(b => b.id === tipId)
          if (label && tipBubbleData) {
            setHintLabel(label)
            setHintPos(bestPillPos(tipBubbleData.position, overBubble.position, bubblesRef.current))
            setHintNodeIds([tipId, overBubble.id])
          } else {
            setHintLabel(null)
            setHintPos(null)
          }
        } else {
          setHintLabel(null)
          setHintPos(null)
        }

        // In Connection mode, block dwell on nodes not connected to current tip
        const lastIdForCheck = activePathRef.current[activePathRef.current.length - 1]
        const isValidNeighbor = !connectionModeActiveRef.current
          || (connectionsRef.current[lastIdForCheck] ?? []).includes(overBubble.id)
          || activePathRef.current.includes(overBubble.id) // allow backtracking
        if (!isValidNeighbor) return

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
        if (!pillPersistRef.current) {
          setHintLabel(null)
          setHintPos(null)
        }
        isTracingRef.current = false

        const path = activePathRef.current
        if (path[path.length - 1] === endIdRef.current) {
          const endBubble = bubblesRef.current.find(b => b.id === endIdRef.current)
          if (endBubble) setRippleCenter(endBubble.position)
          // Freeze on completed path for 600ms so player can admire it, then navigate
          setTimeout(() => {
            onPathCompleteRef.current(path)
          }, 600)
        }
      },
      onPanResponderTerminate: () => {
        clearDwell()
        setFingerPos(null)
        if (!pillPersistRef.current) {
          setHintLabel(null)
          setHintPos(null)
        }
        isTracingRef.current = false
      },
    })
  ).current

  function getBubbleState(id: string): BubbleState {
    if (id === startId) return 'start'
    if (id === endId) return 'end'
    if (bridgeNodeIds?.has(id)) return 'bridge'
    if (flashActivePath.length > 0 && flashActivePath.includes(id)) return 'flash'
    if (activePath.includes(id) && settledIds.has(id)) return 'active'
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

      {bubbles.map((bubble, i) => {
        const offset = shuffleOffsets.get(bubble.id)
        return (
          <Animated.View
            key={bubble.id}
            style={offset ? { transform: offset.getTranslateTransform() } : undefined}
          >
            <Bubble
              label={bubble.label}
              state={getBubbleState(bubble.id)}
              position={bubble.position}
              index={i}
              pulse={bubble.id === lastConnectedId}
              hovering={bubble.id === hoveringId}
              bubbleScale={bubbleScale}
            />
          </Animated.View>
        )
      })}

      {flashActivePath.length > 1 && flashActivePath.slice(0, -1).map((id, i) => {
        const from = getBubble(id)
        const to = getBubble(flashActivePath[i + 1])
        if (!from || !to) return null
        return (
          <ConnectionLine
            key={`flash-${id}-${flashActivePath[i + 1]}`}
            from={from.position}
            to={to.position}
            active
            flash
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        )
      })}

      {hintLabel && hintPos && (
        <View
          pointerEvents="none"
          style={[
            hintStyles.pill,
            {
              position: 'absolute',
              left: hintPos.x,
              top: hintPos.y,
              transform: [{ translateX: -60 }, { translateY: -14 }],
            },
          ]}
        >
          <Text style={hintStyles.text}>{hintLabel}</Text>
        </View>
      )}

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
  canvas: { flex: 1, backgroundColor: colors.bg },
})

const hintStyles = StyleSheet.create({
  pill: {
    width: 120,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
})

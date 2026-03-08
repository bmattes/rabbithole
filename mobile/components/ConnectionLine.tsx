import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { StyleSheet, View } from 'react-native'
import { BUBBLE_H, BUBBLE_W, PILL_MAX_W } from './Bubble'

interface Point {
  x: number
  y: number
}

interface ConnectionLineProps {
  from: Point
  to: Point
  active?: boolean
  broken?: boolean
  width: number
  height: number
}

const PILL_HALF_W = (BUBBLE_W + 40) / 2  // half-width of idle/active bubble
const PILL_HALF_H = BUBBLE_H / 2          // half-height (also end-cap radius)
const GAP = 4                             // extra gap so line doesn't touch border

// Compute how far to step from `origin` toward `toward` to reach the pill edge
function edgeOffset(origin: Point, toward: Point): number {
  const dx = toward.x - origin.x
  const dy = toward.y - origin.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return 0
  const nx = Math.abs(dx / dist)
  const ny = Math.abs(dy / dist)
  // Ellipse approximation: axis-aligned ellipse with radii PILL_HALF_W, PILL_HALF_H
  // r = 1 / sqrt((nx/rw)^2 + (ny/rh)^2)
  const rw = PILL_HALF_W
  const rh = PILL_HALF_H
  const r = 1 / Math.sqrt((nx / rw) ** 2 + (ny / rh) ** 2)
  return r + GAP
}

function nudge(origin: Point, toward: Point): Point {
  const dx = toward.x - origin.x
  const dy = toward.y - origin.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return origin
  const amount = edgeOffset(origin, toward)
  return { x: origin.x + (dx / dist) * amount, y: origin.y + (dy / dist) * amount }
}

function cubicBezierPath(from: Point, to: Point): string {
  const cx1 = from.x
  const cy1 = from.y + (to.y - from.y) * 0.4
  const cx2 = to.x
  const cy2 = to.y - (to.y - from.y) * 0.4
  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`
}

export function ConnectionLine({ from, to, active, broken, width, height }: ConnectionLineProps) {
  const color = broken ? '#ef4444' : active ? '#7c3aed' : 'rgba(0,0,0,0.15)'
  const dashed = broken ? '8,4' : !active ? '5,5' : undefined
  const f = nudge(from, to)
  const t = nudge(to, from)
  const d = cubicBezierPath(f, t)
  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        {active && (
          <>
            {/* Glow layer — wide blurred stroke behind */}
            <Path
              d={d}
              stroke="#7c3aed"
              strokeWidth={10}
              fill="none"
              opacity={0.25}
              strokeLinecap="round"
            />
            {/* Core line */}
            <Path
              d={d}
              stroke="#7c3aed"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
        {!active && (
          <Path
            d={d}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray={dashed}
          />
        )}
      </Svg>
    </View>
  )
}

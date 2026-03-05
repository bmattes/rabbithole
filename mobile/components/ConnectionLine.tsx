import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { StyleSheet, View } from 'react-native'

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

function cubicBezierPath(from: Point, to: Point): string {
  const cx1 = from.x
  const cy1 = from.y + (to.y - from.y) * 0.4
  const cx2 = to.x
  const cy2 = to.y - (to.y - from.y) * 0.4
  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`
}

export function ConnectionLine({ from, to, active, broken, width, height }: ConnectionLineProps) {
  const color = broken ? '#ef4444' : active ? '#7c3aed' : 'rgba(255,255,255,0.3)'
  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path
          d={cubicBezierPath(from, to)}
          stroke={color}
          strokeWidth={broken ? 3 : 2}
          fill="none"
          strokeDasharray={broken ? '8,4' : undefined}
        />
      </Svg>
    </View>
  )
}

import { BUBBLE_W, BUBBLE_H } from '../components/Bubble'

const BASE_BUBBLE_W = BUBBLE_W + 40  // matches displayW for idle/active bubbles in Bubble.tsx
const MIN_GAP = 16

interface Point { x: number; y: number }

// Seeded pseudo-random so layout is stable across re-renders for the same puzzle
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/**
 * Randomly scatters middle bubbles within the canvas, then runs
 * axis-aligned force-separation to resolve overlaps — giving an
 * organic feel while guaranteeing everything fits on screen.
 */
// Safe zone reserved at top and bottom for start/end nodes (scaled at call site)

export function separateBubbles(
  positions: Point[],
  canvasWidth: number,
  canvasHeight: number,
  fixedIndices: Set<number> = new Set(),
  iterations = 200,
  seed?: number,
  bubbleScale = 1
): Point[] {
  const bw = BASE_BUBBLE_W * bubbleScale
  const bh = BUBBLE_H * bubbleScale
  const MIN_DIST_X = bw + MIN_GAP
  const MIN_DIST_Y = bh + MIN_GAP
  const n = positions.length
  const padX = bw / 2 + 10
  const PILL_PAD = 10  // paddingVertical on pill nodes — grows downward from top anchor
  const padY = bh / 2 + 8
  const padYBottom = bh / 2 + PILL_PAD + 8
  // Intermediates are restricted to the band between the two anchor zones
  const anchorReserve = bh + 24
  const midYMin = padY + anchorReserve
  const midYMax = canvasHeight - padYBottom - anchorReserve
  const rand = seededRandom(seed ?? (n * 1000 + Math.round(canvasWidth)))
  const pts: Point[] = positions.map((p, i) => {
    if (fixedIndices.has(i)) {
      if (i === 0) return { x: canvasWidth / 2, y: padY }
      if (i === n - 1) return { x: canvasWidth / 2, y: canvasHeight - padYBottom }
      return { ...p }
    }
    // Scatter intermediates only within the safe middle band
    return {
      x: padX + rand() * (canvasWidth - padX * 2),
      y: midYMin + rand() * Math.max(midYMax - midYMin, 0),
    }
  })

  // Iterative axis-aligned separation
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[j].x - pts[i].x
        const dy = pts[j].y - pts[i].y
        const overlapX = MIN_DIST_X - Math.abs(dx)
        const overlapY = MIN_DIST_Y - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          let pushX = 0, pushY = 0
          if (overlapX < overlapY) {
            pushX = (overlapX / 2 + 1) * Math.sign(dx || 1)
          } else {
            pushY = (overlapY / 2 + 1) * Math.sign(dy || 1)
          }
          if (!fixedIndices.has(i)) { pts[i].x -= pushX; pts[i].y -= pushY }
          if (!fixedIndices.has(j)) { pts[j].x += pushX; pts[j].y += pushY }
          moved = true
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (fixedIndices.has(i)) continue
      pts[i].x = Math.max(padX, Math.min(canvasWidth - padX, pts[i].x))
      // Clamp intermediates to the safe middle band
      pts[i].y = Math.max(midYMin, Math.min(midYMax, pts[i].y))
    }
    if (!moved) break
  }

  return pts
}

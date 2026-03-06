import { BUBBLE_W, BUBBLE_H } from '../components/Bubble'

const MIN_GAP = 16
const MIN_DIST_X = BUBBLE_W + MIN_GAP
const MIN_DIST_Y = BUBBLE_H + MIN_GAP

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
export function separateBubbles(
  positions: Point[],
  canvasWidth: number,
  canvasHeight: number,
  fixedIndices: Set<number> = new Set(),
  iterations = 200
): Point[] {
  const n = positions.length
  const padX = BUBBLE_W / 2 + 10
  const padY = BUBBLE_H / 2 + 10
  const rand = seededRandom(n * 1000 + Math.round(canvasWidth))

  const pts: Point[] = positions.map((p, i) => {
    if (fixedIndices.has(i)) {
      // Fixed indices keep their relative vertical position but centre horizontally
      if (i === 0) return { x: canvasWidth / 2, y: padY }
      if (i === n - 1) return { x: canvasWidth / 2, y: canvasHeight - padY }
      return { ...p }
    }
    // Random scatter across the full canvas area
    return {
      x: padX + rand() * (canvasWidth - padX * 2),
      y: padY + rand() * (canvasHeight - padY * 2),
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
      pts[i].y = Math.max(padY, Math.min(canvasHeight - padY, pts[i].y))
    }
    if (!moved) break
  }

  return pts
}

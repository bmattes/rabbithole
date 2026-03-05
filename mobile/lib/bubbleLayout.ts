import { BUBBLE_RADIUS } from '../components/Bubble'

const DIAMETER = BUBBLE_RADIUS * 2
const MIN_GAP = 12 // minimum space between bubble edges
const MIN_DIST = DIAMETER + MIN_GAP

interface Point { x: number; y: number }

/**
 * Runs a simple force-separation pass to eliminate overlap.
 * Iterates until no two bubbles are closer than MIN_DIST, or max iterations reached.
 */
export function separateBubbles(
  positions: Point[],
  canvasWidth: number,
  canvasHeight: number,
  fixedIndices: Set<number> = new Set(),
  iterations = 100
): Point[] {
  const pts = positions.map(p => ({ ...p }))
  const padding = BUBBLE_RADIUS + 8

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x
        const dy = pts[j].y - pts[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MIN_DIST && dist > 0) {
          const overlap = (MIN_DIST - dist) / 2
          const nx = dx / dist
          const ny = dy / dist
          if (!fixedIndices.has(i)) {
            pts[i].x -= nx * overlap
            pts[i].y -= ny * overlap
          }
          if (!fixedIndices.has(j)) {
            pts[j].x += nx * overlap
            pts[j].y += ny * overlap
          }
          moved = true
        }
      }
    }
    // Clamp to canvas bounds
    for (let i = 0; i < pts.length; i++) {
      if (fixedIndices.has(i)) continue
      pts[i].x = Math.max(padding, Math.min(canvasWidth - padding, pts[i].x))
      pts[i].y = Math.max(padding, Math.min(canvasHeight - padding, pts[i].y))
    }
    if (!moved) break
  }
  return pts
}

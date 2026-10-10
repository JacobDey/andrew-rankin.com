// games/plates/bench/grade.ts — wedge densities, grades and the clue readability rule (GDD §5.6).
import { SIM_W, SIM_H, PLATE_W, PLATE_H, WEDGE, type PlateChem, type WedgeReading, type Grade, type Hotspot } from '../contracts'
import { densityL } from './chem'

function regionMean(a: Float32Array, x0: number, y0: number, x1: number, y1: number): number {
  const cx0 = Math.floor((x0 * SIM_W) / PLATE_W), cx1 = Math.max(cx0 + 1, Math.floor((x1 * SIM_W) / PLATE_W))
  const cy0 = Math.floor((y0 * SIM_H) / PLATE_H), cy1 = Math.max(cy0 + 1, Math.floor((y1 * SIM_H) / PLATE_H))
  let s = 0, n = 0
  for (let j = cy0; j < Math.min(SIM_H, cy1); j++) for (let i = cx0; i < Math.min(SIM_W, cx1); i++) { s += a[j * SIM_W + i]; n++ }
  return n ? s / n : 0
}

export function readWedge(c: PlateChem): WedgeReading {
  const density: number[] = []
  let visible = 0, blocked = 0
  for (let n = 1; n <= WEDGE.steps; n++) {
    const x0 = WEDGE.x0 + (n - 1) * (WEDGE.size + WEDGE.gap)
    const P = regionMean(c.P, x0, WEDGE.y, x0 + WEDGE.size, WEDGE.y + WEDGE.size)
    const F = regionMean(c.F, x0, WEDGE.y, x0 + WEDGE.size, WEDGE.y + WEDGE.size)
    const D = densityL(P, F, -(n - 1))
    density.push(Math.round(D * 1000) / 1000)
    if (D >= 0.12) visible++
    if (D >= 0.92) blocked++
  }
  const fog = regionMean(c.F, 880, 462, 1000, 500)
  const grade: Grade = gradeOf(visible, blocked, fog)     // the grade the plate would get if fixed now
  return { density, visible, blocked, fog: Math.round(fog * 1000) / 1000, grade }
}

export function gradeOf(visible: number, blocked: number, fog: number): Grade {
  if (fog >= 0.35) return 'fogged'
  if (blocked >= 2) return 'dense'
  if (visible <= 6) return 'thin'
  if (visible === 8 && blocked === 0) return 'brilliant'
  return 'good'
}

/** Clue readability rule: shadow needs all 8 steps visible; highlight needs none blocked; mid survives unless fogged. */
export function readable(w: WedgeReading, h: Hotspot): boolean {
  if (w.fog >= 0.35) return false
  if (h.zone === 'shadow') return w.visible >= 8
  if (h.zone === 'highlight') return w.blocked === 0
  return true
}

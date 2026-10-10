// Enlarger helpers: easel illuminance and an "auto print" that picks the
// contrast grade and time a printer would choose from a negative. Useful for
// contact sheets, thumbnails and NPC printers.

import { type Bands, lightBands } from './bands.ts'
import { logHAtDensity } from './curve.ts'
import { type PaperModel, VC_FILTER_TABLE, VC_ISO_R_TARGET, printCurve, vcGradeFilter } from './paper.ts'

const GRADED_ISO_R = [160, 130, 110, 90, 70, 50]

/**
 * Easel illuminance (lux, through clear film base) for an enlarger:
 *   E = K / (N² (1 + M)²)
 * K is calibrated so a 35 mm negative enlarged to 8x10 (M ≈ 7) at f/8 gives
 * ~1.5 lux from a 75 W opal bulb: the classic 10-20 s grade-2 print.
 * `lamp` scales K (condenser heads are ~2x brighter than diffusers).
 */
export function enlargerLux(fNumber = 8, magnification = 7, lamp = 1): number {
  const K = 6144
  return (K * lamp) / (fNumber * fNumber * (1 + magnification) * (1 + magnification))
}

function percentile(a: ArrayLike<number>, q: number): number {
  const s = Float32Array.from(a as ArrayLike<number>).sort()
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]
}

/** VC grade (fractional, -1 = 00) whose ISO R matches a target range. */
export function vcGradeForRange(isoR: number): number {
  const t = VC_FILTER_TABLE
  const r = VC_ISO_R_TARGET
  if (isoR >= r[0]) return t[0].grade
  for (let i = 1; i < r.length; i++) {
    if (isoR >= r[i]) {
      const f = (r[i - 1] - isoR) / (r[i - 1] - r[i])
      return t[i - 1].grade + (t[i].grade - t[i - 1].grade) * f
    }
  }
  return 5
}

export interface AutoPrint {
  grade: number
  seconds: number
  filter: Bands | undefined
  /** Density range of the negative between the chosen percentiles. */
  negRange: number
}

/**
 * Choose grade and time like a printer: the paper's exposure range should
 * match the negative's density range (dense highlight percentile to thin
 * shadow percentile), and the time puts the densest highlight just above paper
 * white (net 0.06).
 */
export function autoPrint(model: PaperModel, negDensities: ArrayLike<number>, lux: number, opts: { hi?: number; lo?: number; margin?: number; highlightNet?: number; light?: Bands } = {}): AutoPrint {
  const dHi = percentile(negDensities, opts.hi ?? 0.995)
  const dLo = percentile(negDensities, opts.lo ?? 0.01)
  // Printers give the paper a little more range than the negative so both ends keep detail.
  const negRange = Math.max(0.2, (dHi - dLo) * (opts.margin ?? 1.1))
  let grade: number
  let filter: Bands | undefined
  if (model.soft) {
    grade = vcGradeForRange(100 * negRange)
    filter = vcGradeFilter(grade)
  } else {
    // Graded paper: recommend the nearest box (the caller swaps paper; the time below is for this model).
    let best = 0
    for (let g = 0; g < GRADED_ISO_R.length; g++) if (Math.abs(GRADED_ISO_R[g] - 100 * negRange) < Math.abs(GRADED_ISO_R[best] - 100 * negRange)) best = g
    grade = best
    filter = undefined
  }
  const light = opts.light ?? lightBands('enlarger', 1)
  const f = printCurve(model, filter, light)
  const xHi = logHAtDensity(f, opts.highlightNet ?? 0.06)
  const seconds = Math.pow(10, xHi) / (lux * Math.pow(10, -dHi))
  return { grade, seconds, filter, negRange }
}

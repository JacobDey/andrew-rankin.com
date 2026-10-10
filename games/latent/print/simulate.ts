// Headless printing (simulatePrint), the legibility metric (GDD §5.8) and the recipe solver behind
// __game.solve() and the 'solution' recipe.
import { clamp } from '@shared/core'
import type { DetailSpec, FactId, FrameImage, Grade, Negative, PrintOps } from '../core/types'
import { CELL_MM, PH, PW, devDensity, displayL, egFor, exposeOps, intensity, negToPaper, phiStar, projectT, type Projection } from './optics'

export const MIN_CONTRAST = 0.08

export function projectionOf(ops: PrintOps): Projection {
  return { M: ops.M, cx: ops.cx, cy: ops.cy, flip: ops.flip, focus: ops.focus ?? phiStar(ops.M) }
}

/** Full print: T_proj → exposure → development for ops.devSeconds (wet, still tray). Returns D. */
export function simulatePrint(neg: Negative, ops: PrintOps, T?: Float32Array): Float32Array {
  const t = T ?? projectT(neg, projectionOf(ops), new Float32Array(PW * PH))
  const E = exposeOps(t, ops, new Float32Array(PW * PH))
  const D = new Float32Array(PW * PH)
  for (let i = 0; i < D.length; i++) D[i] = devDensity(E[i], ops.grade, ops.devSeconds)
  return D
}

export interface LegResult { fact: FactId; rho: number; contrast: number; coverage: number; pass: boolean; why: string }

interface Samples { idx: Float32Array; valid: Uint8Array; delta: Float32Array; off: Float32Array; n: number }

function bilin(a: Float32Array, w: number, h: number, x: number, y: number): number {
  const xx = clamp(x, 0, w - 1.001), yy = clamp(y, 0, h - 1.001)
  const xi = xx | 0, yi = yy | 0, fx = xx - xi, fy = yy - yi, i = yi * w + xi
  return (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + w] * (1 - fx) + a[i + w + 1] * fx) * fy
}

/** Sample points across the bbox: paper cell positions, ground-truth Δ and the detail-off luminance. */
function samplePoints(img: FrameImage, d: DetailSpec, p: Projection): Samples {
  const [bx, by, bw, bh] = d.bbox
  const nx = 112, ny = Math.max(8, Math.round((112 * bh * 24) / (bw * 36)))
  const n = nx * ny
  const idx = new Float32Array(n * 2), valid = new Uint8Array(n), delta = new Float32Array(n), off = new Float32Array(n)
  const dm = img.deltas[d.id]
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    const u = bx + ((i + 0.5) / nx) * bw, v = by + ((j + 0.5) / ny) * bh
    const [pi, pj] = negToPaper(p, u * 36, v * 24)
    idx[2 * k] = pi; idx[2 * k + 1] = pj
    valid[k] = pi >= 0 && pi <= PW - 1 && pj >= 0 && pj <= PH - 1 ? 1 : 0
    if (dm) {
      const sx = ((i + 0.5) / nx) * dm.w - 0.5, sy = ((j + 0.5) / ny) * dm.h - 0.5
      delta[k] = bilin(dm.d, dm.w, dm.h, sx, sy)
      off[k] = Math.log2(Math.max(1e-4, bilin(dm.off, dm.w, dm.h, sx, sy)))
    }
  }
  return { idx, valid, delta, off, n }
}

/** Residuals of y after least squares on [1, o, o²]. */
function residualise(y: Float64Array, o: Float64Array): Float64Array {
  const n = y.length
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0], b = [0, 0, 0]
  for (let k = 0; k < n; k++) {
    const x = [1, o[k], o[k] * o[k]]
    for (let r = 0; r < 3; r++) { b[r] += x[r] * y[k]; for (let c = 0; c < 3; c++) A[r * 3 + c] += x[r] * x[c] }
  }
  for (let r = 0; r < 3; r++) A[r * 3 + r] += 1e-6 * (1 + A[r * 3 + r])
  // solve 3×3 by Cramer's rule
  const det = (m: number[]) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])
  const D0 = det(A)
  const beta = [0, 0, 0]
  if (Math.abs(D0) > 1e-12) for (let c = 0; c < 3; c++) { const m = A.slice(); for (let r = 0; r < 3; r++) m[r * 3 + c] = b[r]; beta[c] = det(m) / D0 }
  else beta[0] = b[0] / Math.max(1, A[0])
  const out = new Float64Array(n)
  for (let k = 0; k < n; k++) out[k] = y[k] - (beta[0] + beta[1] * o[k] + beta[2] * o[k] * o[k])
  return out
}

/**
 * ρ = partial correlation of the print signal with Δ, controlling for the scene without the detail
 * (so unrelated structure inside the bbox does not swamp the detail); contrast = the display-luminance
 * shift the full-strength detail causes in the print (regression coefficient of P on Δ/max|Δ|).
 */
function score(P: Float64Array, s: Samples): { rho: number; contrast: number; coverage: number } {
  let n = 0, maxA = 0
  for (let k = 0; k < s.n; k++) if (s.valid[k]) { n++; maxA = Math.max(maxA, Math.abs(s.delta[k])) }
  const coverage = n / s.n
  if (n < 8 || maxA <= 1e-9) return { rho: 0, contrast: 0, coverage }
  // typical detail amplitude: median |Δ| over the points where the detail is clearly present
  const amps: number[] = []
  for (let k = 0; k < s.n; k++) if (s.valid[k] && Math.abs(s.delta[k]) > 0.2 * maxA) amps.push(Math.abs(s.delta[k]))
  amps.sort((a, b) => a - b)
  const amp = Math.max(1e-9, amps[amps.length >> 1] ?? maxA)
  const p = new Float64Array(n), dl = new Float64Array(n), o = new Float64Array(n)
  for (let k = 0, m = 0; k < s.n; k++) if (s.valid[k]) { p[m] = P[k]; dl[m] = s.delta[k] / amp; o[m] = s.off[k]; m++ }
  const rp = residualise(p, o), rd = residualise(dl, o)
  let sxy = 0, sxx = 0, syy = 0
  for (let k = 0; k < n; k++) { sxy += rp[k] * rd[k]; sxx += rp[k] * rp[k]; syy += rd[k] * rd[k] }
  const rho = sxx > 0 && syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : 0
  const contrast = syy > 1e-12 ? Math.abs(sxy / syy) : 0
  return { rho, contrast, coverage }
}

/** Display luminance of the print at each sample point (bilinear over a 1-cell box blur of D). */
function printSignal(D: Float32Array, s: Samples): Float64Array {
  const P = new Float64Array(s.n)
  for (let k = 0; k < s.n; k++) if (s.valid[k]) {
    P[k] = displayL(bilin(D, PW, PH, s.idx[2 * k], s.idx[2 * k + 1]))
  }
  return P
}

export function evaluateDetail(img: FrameImage, d: DetailSpec, ops: PrintOps, D: Float32Array, fogged = false): LegResult {
  const p = projectionOf(ops)
  const s = samplePoints(img, d, p)
  const { rho, contrast, coverage } = score(printSignal(D, s), s)
  let why = ''
  if (fogged) why = 'fogged'
  else if (coverage < 0.9) why = 'coverage'
  else if (ops.M < d.mMin) why = 'magnification'
  else if (d.pattern.includes('MIRRORED') && !ops.flip) why = 'flip'
  else if (rho < d.rho) why = 'rho'
  else if (contrast < MIN_CONTRAST) why = 'contrast'
  return { fact: d.id, rho, contrast, coverage, pass: why === '', why }
}

export function evaluateLegibility(img: FrameImage, details: DetailSpec[], ops: PrintOps, D: Float32Array, fogged = false): LegResult[] {
  return details.filter((d) => !d.noCheck).map((d) => evaluateDetail(img, d, ops, D, fogged))
}

export function naiveOps(): PrintOps {
  return { M: 4, cx: 18, cy: 12, flip: false, grade: 2, seconds: 8, devSeconds: 60 }
}

/** A skilled printer's recipe for one detail: crop on it, enlarge, flip if needed, then try grades and exposures. */
export function solveDetail(neg: Negative, img: FrameImage, d: DetailSpec): { ops: PrintOps; result: LegResult } {
  const [, , bw, bh] = d.bbox
  const Mfit = Math.min((PW * CELL_MM * 0.92) / (bw * 36), (PH * CELL_MM * 0.92) / (bh * 24))
  const cands = [...new Set([Math.max(d.mMin + 1, 7), Math.max(d.mMin + 4, 10), Mfit * 0.95].map((m) => Math.round(Math.max(d.mMin + 0.25, 2, Math.min(16, Mfit * 0.95, m)) * 4) / 4))]
  let best: { ops: PrintOps; result: LegResult; sc: number } | null = null
  for (const M of cands) {
    const r = solveAt(neg, img, d, M)
    if (!best || r.sc > best.sc) best = r
  }
  return { ops: best!.ops, result: best!.result }
}

function solveAt(neg: Negative, img: FrameImage, d: DetailSpec, M: number): { ops: PrintOps; result: LegResult; sc: number } {
  const [bx, by, bw, bh] = d.bbox
  const base: PrintOps = { M, cx: (bx + bw / 2) * 36, cy: (by + bh / 2) * 24, flip: d.pattern.includes('MIRRORED'), grade: 2, seconds: 8, devSeconds: 90, ...(d.solution ?? {}) }
  const p = projectionOf(base)
  const T = projectT(neg, p, new Float32Array(PW * PH))
  const s = samplePoints(img, d, p)
  const ts: number[] = []
  for (let k = 0; k < s.n; k++) if (s.valid[k]) ts.push(bilin(T, PW, PH, s.idx[2 * k], s.idx[2 * k + 1]))
  ts.sort((a, b) => a - b)
  const Tm = Math.max(1e-5, ts[ts.length >> 1] ?? 0.1)
  const I = intensity(M)
  let best: { ops: PrintOps; result: LegResult; sc: number } | null = null
  const grades: Grade[] = [2, 3, 4, 5, 1, 0]
  const mults = [1, 0.7, 1.4, 0.5, 2, 0.35, 2.8, 4]
  for (const g of grades) for (const m of mults) {
    const seconds = clamp((egFor(g) / (I * Tm)) * m, 0.5, 240)
    const ops: PrintOps = { ...base, grade: g, seconds }
    const P = new Float64Array(s.n)
    for (let k = 0; k < s.n; k++) if (s.valid[k]) {
      P[k] = displayL(devDensity(seconds * I * bilin(T, PW, PH, s.idx[2 * k], s.idx[2 * k + 1]), g, ops.devSeconds))
    }
    const sc0 = score(P, s)
    const result: LegResult = { fact: d.id, ...sc0, pass: false, why: '' }
    result.pass = sc0.coverage >= 0.9 && ops.M >= d.mMin && (!d.pattern.includes('MIRRORED') || ops.flip) && sc0.rho >= d.rho && sc0.contrast >= MIN_CONTRAST
    const sc = (result.pass ? 10 : 0) + Math.min(sc0.rho, 1) + sc0.contrast * 2 - (seconds > 90 ? 0.5 : 0)
    if (!best || sc > best.sc) best = { ops, result, sc }
  }
  return best!
}

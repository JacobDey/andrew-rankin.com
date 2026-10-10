// Varrow Pan 400: exposure, development and the negative (GDD §5.3), as pure functions.
import { hash2, clamp } from '@shared/core'
import type { Crescent, DevResult, FrameImage, Negative, RollMeta, Spot } from '../core/types'

export const T_NOM = 480 // game seconds (8:00)
export const NEG_W = 36
export const NEG_H = 24

/** Development factor from poured-out time and agitation. */
export function devFactor(tDevGameS: number, inversionsPerMin: number): { a: number; r: number } {
  const n = inversionsPerMin
  const a = 0.85 + 0.15 * Math.min(1, n / 2) + 0.05 * clamp((n - 4) / 4, 0, 1)
  return { a, r: (tDevGameS * a) / T_NOM }
}

export function makeDev(o: { tDev: number; inversionsPerMin: number; rapped: boolean; bubbles?: Spot[]; kinks?: Crescent[] }): DevResult {
  const { a, r } = devFactor(o.tDev, o.inversionsPerMin)
  return { tDev: o.tDev, inversionsPerMin: o.inversionsPerMin, rapped: o.rapped, r, agit: a, bubbles: o.bubbles ?? [], kinks: o.kinks ?? [] }
}

export interface Curve { lH0: number; gamma: number; fog: number; r: number }
export function curveFor(rRaw: number, ageFog: number): Curve {
  const r = clamp(rRaw, 0.5, 2.0)
  return { r, lH0: -2.0 - 0.9 * Math.log2(r), gamma: 0.62 * Math.pow(r, 0.45), fog: 0.10 + 0.25 * Math.max(0, r - 1.3) ** 2 + ageFog }
}

const TAU = 0.12
/** Image density (no base/fog/grain) for a camera exposure H. */
export function dImg(H: number, c: Curve): number {
  const lH = Math.log10(Math.max(H, 1e-5))
  const u = lH - c.lH0
  const x = u / TAU
  const soft = x > 30 ? x : Math.log1p(Math.exp(x))
  const d = c.gamma * TAU * soft
  return 2.4 * Math.tanh(d / 2.4)
}

/** Two-octave value noise in negative mm, zero mean, ~unit variance. */
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
  const v = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  return (v - 0.5) * 3.4
}

function bilinear(L: Float32Array, w: number, h: number, px: number, py: number): number {
  const x = clamp(px, 0, w - 1.001), y = clamp(py, 0, h - 1.001)
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi
  const i = yi * w + xi
  return (L[i] * (1 - fx) + L[i + 1] * fx) * (1 - fy) + (L[i + w] * (1 - fx) + L[i + w + 1] * fx) * fy
}

/** Scene luminance at a frame point (u, v ∈ 0..1), sampling the mip for the footprint and insets. */
export function sampleL(img: FrameImage, u: number, v: number, footprintMm: number): number {
  const pxMm = NEG_W / img.w
  if (footprintMm < pxMm * 1.2) {
    for (const ins of img.insets) {
      const [bx, by, bw, bh] = ins.bbox
      if (u >= bx && u <= bx + bw && v >= by && v <= by + bh) {
        const ipx = (bw * NEG_W) / ins.w
        if (footprintMm < pxMm) {
          void ipx
          return bilinear(ins.L, ins.w, ins.h, ((u - bx) / bw) * ins.w - 0.5, ((v - by) / bh) * ins.h - 0.5)
        }
      }
    }
  }
  const lvl = clamp(Math.floor(Math.log2(Math.max(1e-6, footprintMm / pxMm))), 0, img.mips.length - 1)
  const m = img.mips[lvl]
  return bilinear(m.L, m.w, m.h, u * m.w - 0.5, v * m.h - 0.5)
}

/** Kink crescent density at a frame point: an arc of radius 2 mm over 140°, 0.4 mm wide, +0.9. */
function crescentD(xMm: number, yMm: number, k: Crescent): number {
  const cx = k.x * NEG_W, cy = k.y * NEG_H
  const dx = xMm - cx, dy = yMm - cy
  const r = Math.sqrt(dx * dx + dy * dy)
  if (r > 2.6 || r < 1.4) return 0
  const ang = Math.atan2(dy, dx) - (k.rot * Math.PI) / 180
  const a = Math.atan2(Math.sin(ang), Math.cos(ang))
  if (Math.abs(a) > (70 * Math.PI) / 180) return 0
  const dr = Math.abs(r - 2)
  const edge = clamp((0.3 - dr) / 0.1, 0, 1)
  return 0.9 * edge
}

export function createNegative(img: FrameImage, dev: DevResult, roll: RollMeta, ev: number): Negative {
  const c = curveFor(dev.r, roll.ageFog)
  const expo = Math.pow(2, ev)
  const frame = img.ref.frame
  const kinks = dev.kinks.filter((k) => k.frame === frame)
  const bubbles = dev.bubbles.filter((b) => b.frame === frame)
  const g = dev.r <= 1.2 ? 0.045 : dev.r >= 1.5 ? 0.06 : 0.045 + (0.015 * (dev.r - 1.2)) / 0.3
  const sigK = 0.03 * (1 + 0.8 * Math.max(0, dev.r - 1))
  const seed = (roll.id * 131 + frame * 7) | 0
  const streaks = dev.inversionsPerMin < 1
  return {
    ref: img.ref, widthMm: 36, heightMm: 24,
    density(xMm: number, yMm: number, f: number): number {
      const u = xMm / NEG_W, v = yMm / NEG_H
      const L = sampleL(img, u, v, f)
      let di = dImg(L * expo, c)
      for (const b of bubbles) { const dx = xMm - b.x * NEG_W, dy = yMm - b.y * NEG_H; if (dx * dx + dy * dy < b.r * b.r) di = 0 }
      if (streaks && v > 0.02) { const above = sampleL(img, u, Math.max(0, v - 0.06), 0.5); if (dImg(above * expo, c) > 1.2) di -= 0.08 }
      let D = 0.08 + c.fog + di
      const sd = sigK * Math.sqrt(Math.max(0.01, D))
      const n = 0.65 * vnoise(xMm / g, yMm / g, seed) + 0.35 * vnoise(xMm / (2 * g), yMm / (2 * g), seed + 17)
      D += (sd * n) / Math.max(1, f / g)
      for (const k of kinks) D += crescentD(xMm, yMm, k)
      return D
    },
  }
}

/** Kink-safe position for a crescent on a frame: outside every detail bbox by at least 0.05. */
export function kinkSafe(rng: () => number, bboxes: [number, number, number, number][]): { x: number; y: number } {
  for (let i = 0; i < 40; i++) {
    const x = 0.08 + rng() * 0.84, y = 0.1 + rng() * 0.8
    if (bboxes.every(([bx, by, bw, bh]) => x < bx - 0.05 - 0.06 || x > bx + bw + 0.05 + 0.06 || y < by - 0.05 - 0.09 || y > by + bh + 0.05 + 0.09)) return { x, y }
  }
  return { x: 0.06, y: 0.9 }
}

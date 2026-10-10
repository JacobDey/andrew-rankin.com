// Fast numeric kernels for the per-pixel loops: an interpolated 10^-x table, a
// soft-min correction table, and
// log-spaced lookup tables indexed straight from the IEEE-754 bits of the
// argument (no Math.log in the hot loop). Everything here uses only + - * and
// integer ops on doubles/floats, so results are identical on every engine.

import { type Curve, curveDensityH } from './curve.ts'
import { type Reciprocity, reciprocityEfficiency } from './kinetics.ts'

const F32 = new Float32Array(1)
const I32 = new Int32Array(F32.buffer)

const LN10 = Math.LN10

/**
 * A table of f(x) sampled log-uniformly (2^`mBits` points per octave) between
 * 2^eLo and 2^eHi, read with linear interpolation. Index and fraction come
 * from the float32 bit pattern of x, so a lookup is a handful of integer ops.
 * Below the range the first entry is returned, above it the last.
 */
export class LogLut {
  readonly tbl: Float64Array
  private readonly bLo: number
  private readonly bHi: number
  private readonly shift: number
  private readonly mask: number
  private readonly inv: number
  private readonly last: number

  constructor(f: (x: number) => number, eLo: number, eHi: number, mBits = 8) {
    this.shift = 23 - mBits
    this.mask = (1 << this.shift) - 1
    this.inv = 1 / (1 << this.shift)
    this.bLo = (127 + eLo) << 23
    this.bHi = (127 + eHi) << 23
    const n = ((this.bHi - this.bLo) >> this.shift) + 1
    this.last = n - 1
    this.tbl = new Float64Array(n + 1)
    const F = new Float32Array(1)
    const I = new Int32Array(F.buffer)
    for (let k = 0; k <= n; k++) {
      I[0] = this.bLo + (k << this.shift)
      this.tbl[k] = f(F[0])
    }
  }

  at(x: number): number {
    F32[0] = x
    const b = I32[0] - this.bLo
    if (b <= 0) return this.tbl[0]
    const k = b >> this.shift
    if (k >= this.last) return this.tbl[this.last]
    const a = this.tbl[k]
    return a + (this.tbl[k + 1] - a) * ((b & this.mask) * this.inv)
  }
}

/** Linear-domain table on [0, hi] with `n` cells and linear interpolation; clamps to the last cell. */
export class LinLut {
  readonly tbl: Float64Array
  readonly scale: number
  private readonly top: number
  constructor(f: (x: number) => number, hi: number, n: number) {
    this.tbl = new Float64Array(n + 2)
    for (let i = 0; i <= n + 1; i++) this.tbl[i] = f((i * hi) / n)
    this.scale = n / hi
    this.top = n
  }
  /** x >= 0 assumed. */
  at(x: number): number {
    const t = x * this.scale
    if (t >= this.top) return this.tbl[this.top]
    const k = t | 0
    const a = this.tbl[k]
    return a + (this.tbl[k + 1] - a) * (t - k)
  }
}

/** 10^-d for d >= 0 (d up to 16), relative error ~1e-5. */
export const POW10NEG = new LinLut((d) => Math.pow(10, -d), 16, 16 * 256)

/** log1p(exp(-u)) for u >= 0: the correction in softmin(a, b, s) = min - s * corr(|a - b| / s). */
export const SOFT_CORR = new LinLut((u) => Math.log1p(Math.exp(-u)), 20, 20 * 128)

/** Soft minimum with softness s; same function as `softmin` in curve.ts, table-driven. */
export function softminFast(a: number, b: number, s: number): number {
  const d = a < b ? b - a : a - b
  return (a < b ? a : b) - s * SOFT_CORR.at(d / s)
}

export { LN10 }

// ---------------------------------------------------------------------------
// Cached tables for curves and reciprocity (keyed by their parameters)
// ---------------------------------------------------------------------------

const curveCache = new Map<string, LogLut>()
/** Net density vs linear exposure H (H <= 0 gives the toe value). */
export function curveLut(c: Curve): LogLut {
  const key = `${c.gamma},${c.logH0},${c.toe},${c.dmax},${c.shoulder},${c.solarize ?? 0},${c.solarizeAt ?? 0}`
  let t = curveCache.get(key)
  if (!t) {
    t = new LogLut((H) => curveDensityH(c, H), -60, 40, 8)
    if (curveCache.size > 64) curveCache.clear()
    curveCache.set(key, t)
  }
  return t
}

const recipCache = new Map<string, LogLut>()
/** Reciprocity efficiency η(I) vs effective intensity I (lux). */
export function recipLut(r: Reciprocity): LogLut {
  const key = `${r.iLow},${r.pLow},${r.iHigh},${r.pHigh}`
  let t = recipCache.get(key)
  if (!t) {
    t = new LogLut((I) => reciprocityEfficiency(r, I), -70, 40, 6)
    if (recipCache.size > 64) recipCache.clear()
    recipCache.set(key, t)
  }
  return t
}

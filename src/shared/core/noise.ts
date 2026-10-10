// Seeded, deterministic noise. Everything is built on hash2i lattice hashes (no Math.random).

import { hash2i } from './rng'

const INV32 = 1 / 4294967296
const lat1 = (i: number, seed: number): number => hash2i(i, 0x51ed270b, seed) * INV32 * 2 - 1
const lat2 = (ix: number, iy: number, seed: number): number => hash2i(ix, iy, seed) * INV32 * 2 - 1
const quintic = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)
const cubic = (t: number): number => t * t * (3 - 2 * t)

/** 1D value noise in [-1, 1], C1 (cubic fade). */
export function valueNoise1(t: number, seed = 0): number {
  const i = Math.floor(t)
  const f = t - i
  const u = cubic(f)
  const a = lat1(i, seed)
  const b = lat1(i + 1, seed)
  return a + (b - a) * u
}

/** 2D value noise in [-1, 1], quintic fade (C2). */
export function valueNoise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const u = quintic(fx)
  const v = quintic(fy)
  const a = lat2(ix, iy, seed)
  const b = lat2(ix + 1, iy, seed)
  const c = lat2(ix, iy + 1, seed)
  const d = lat2(ix + 1, iy + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// 16 unit gradients (22.5-degree steps) so there is no axis bias.
const GX = new Float64Array(16)
const GY = new Float64Array(16)
for (let i = 0; i < 16; i++) {
  GX[i] = Math.cos((i * Math.PI) / 8)
  GY[i] = Math.sin((i * Math.PI) / 8)
}
function grad(ix: number, iy: number, seed: number, dx: number, dy: number): number {
  const g = hash2i(ix, iy, seed) & 15
  return (GX[g] as number) * dx + (GY[g] as number) * dy
}

/** Perlin-style gradient noise in about [-1, 1] (scaled by sqrt(2), clamped). */
export function gradientNoise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const u = quintic(fx)
  const v = quintic(fy)
  const a = grad(ix, iy, seed, fx, fy)
  const b = grad(ix + 1, iy, seed, fx - 1, fy)
  const c = grad(ix, iy + 1, seed, fx, fy - 1)
  const d = grad(ix + 1, iy + 1, seed, fx - 1, fy - 1)
  const n = (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41421356
  return n < -1 ? -1 : n > 1 ? 1 : n
}

export interface FbmOptions {
  octaves?: number // 4
  gain?: number // 0.5
  lacunarity?: number // 2.03
  seed?: number
  basis?: 'value' | 'gradient'
}

/** 1D fractal sum of value noise, normalised to about [-1, 1]. */
export function fbm1(t: number, o: FbmOptions = {}): number {
  const oct = o.octaves ?? 4
  const gain = o.gain ?? 0.5
  const lac = o.lacunarity ?? 2.03
  const seed = o.seed ?? 0
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise1(t * freq + i * 17.31, seed + i * 101)
    norm += amp
    amp *= gain
    freq *= lac
  }
  return norm > 0 ? sum / norm : 0
}

/** 2D fractal sum, normalised to about [-1, 1]. */
export function fbm2(x: number, y: number, o: FbmOptions = {}): number {
  const oct = o.octaves ?? 4
  const gain = o.gain ?? 0.5
  const lac = o.lacunarity ?? 2.03
  const seed = o.seed ?? 0
  const gradient = o.basis === 'gradient'
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    const px = x * freq + i * 31.7
    const py = y * freq + i * 17.3
    const n = gradient ? gradientNoise2(px, py, seed + i * 101) : valueNoise2(px, py, seed + i * 101)
    sum += amp * n
    norm += amp
    amp *= gain
    freq *= lac
  }
  return norm > 0 ? sum / norm : 0
}

/** Ridged multifractal in [0, 1]: sharp creases where the basis crosses zero. */
export function ridged2(x: number, y: number, o: FbmOptions = {}): number {
  const oct = o.octaves ?? 4
  const gain = o.gain ?? 0.5
  const lac = o.lacunarity ?? 2.03
  const seed = o.seed ?? 0
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    const n = gradientNoise2(x * freq + i * 31.7, y * freq + i * 17.3, seed + i * 101)
    const r = 1 - Math.abs(n)
    sum += amp * r * r
    norm += amp
    amp *= gain
    freq *= lac
  }
  return norm > 0 ? sum / norm : 0
}

export interface WorleyHit {
  f1: number // distance to the nearest feature point (cell units)
  f2: number // distance to the second nearest
  id: number // uint32 hash of the nearest cell
  cx: number // nearest feature point (world, cell units)
  cy: number
}

/** Cellular noise. Pass `out` to avoid allocating in hot loops. */
export function worley2(x: number, y: number, o: { jitter?: number; seed?: number } = {}, out?: WorleyHit): WorleyHit {
  const jitter = o.jitter ?? 0.9
  const seed = o.seed ?? 0
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let f1 = Infinity
  let f2 = Infinity
  let id = 0
  let bx = 0
  let by = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i
      const cy = iy + j
      const h = hash2i(cx, cy, seed)
      const ox = 0.5 + ((h & 0xffff) / 65536 - 0.5) * jitter
      const oy = 0.5 + (((h >>> 16) & 0xffff) / 65536 - 0.5) * jitter
      const px = cx + ox
      const py = cy + oy
      const dx = px - x
      const dy = py - y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < f1) {
        f2 = f1
        f1 = d
        id = h
        bx = px
        by = py
      } else if (d < f2) {
        f2 = d
      }
    }
  }
  const r = out ?? { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 }
  r.f1 = f1
  r.f2 = f2
  r.id = id
  r.cx = bx
  r.cy = by
  return r
}

/**
 * Band-limited unit-RMS sum of sines between loHz and hiHz, for tremor and shake.
 * Frequencies and phases come from `seed` (log-spaced with jitter). t is in seconds.
 */
export function bandNoise(t: number, loHz: number, hiHz: number, seed: number, partials = 6): number {
  const lo = Math.max(1e-4, loHz)
  const hi = Math.max(lo, hiHz)
  const ratio = hi / lo
  let sum = 0
  for (let i = 0; i < partials; i++) {
    const u = partials === 1 ? 0.5 : (i + 0.5 + (hash2i(i, 11, seed) * INV32 - 0.5) * 0.8) / partials
    const f = lo * Math.pow(ratio, Math.min(1, Math.max(0, u)))
    const ph = hash2i(i, 29, seed) * INV32 * Math.PI * 2
    sum += Math.sin(2 * Math.PI * f * t + ph)
  }
  return sum * Math.sqrt(2 / partials) // each sine has RMS 1/sqrt(2); this makes the sum unit-RMS
}

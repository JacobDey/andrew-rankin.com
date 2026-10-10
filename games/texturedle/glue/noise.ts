// Small deterministic noise kit for the local surface fallback (glue only).
// Allocation-free, seeded. The real game uses @shared/surface once it lands.

export function hash2i(ix: number, iy: number, seed = 0): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
export function hash2(ix: number, iy: number, seed = 0): number {
  return hash2i(ix, iy, seed) / 4294967296
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Gradient noise in about [-1, 1]. */
export function gnoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const g = (i: number, j: number, dx: number, dy: number) => {
    const h = hash2i(ix + i, iy + j, seed) & 7
    const a = (h * Math.PI) / 4
    return Math.cos(a) * dx + Math.sin(a) * dy
  }
  const u = fade(fx)
  const v = fade(fy)
  const n00 = g(0, 0, fx, fy)
  const n10 = g(1, 0, fx - 1, fy)
  const n01 = g(0, 1, fx, fy - 1)
  const n11 = g(1, 1, fx - 1, fy - 1)
  const a = n00 + (n10 - n00) * u
  const b = n01 + (n11 - n01) * u
  return (a + (b - a) * v) * 1.41
}

/** Value noise in [-1, 1]. */
export function vnoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const u = fade(x - ix)
  const v = fade(y - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

export function fbm(x: number, y: number, seed: number, oct = 4, gain = 0.5, lac = 2.03): number {
  let s = 0
  let amp = 0.5
  let f = 1
  let norm = 0
  for (let o = 0; o < oct; o++) {
    s += amp * gnoise(x * f, y * f, seed + o * 101)
    norm += amp
    amp *= gain
    f *= lac
  }
  return s / norm
}

export function ridged(x: number, y: number, seed: number, oct = 4): number {
  let s = 0
  let amp = 0.5
  let f = 1
  let norm = 0
  for (let o = 0; o < oct; o++) {
    const n = 1 - Math.abs(gnoise(x * f, y * f, seed + o * 131))
    s += amp * n * n
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return s / norm
}

export interface WorleyHit { f1: number; f2: number; id: number; cx: number; cy: number }
export const worleyHit = (): WorleyHit => ({ f1: 0, f2: 0, id: 0, cx: 0, cy: 0 })

/** Worley (cellular) noise in cell units. */
export function worley(x: number, y: number, seed: number, out: WorleyHit, jitter = 0.9): WorleyHit {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let f1 = 9
  let f2 = 9
  let id = 0
  let cx = 0
  let cy = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const h = hash2i(ix + i, iy + j, seed)
      const px = ix + i + 0.5 + (((h & 0xffff) / 65535) - 0.5) * jitter
      const py = iy + j + 0.5 + ((((h >>> 16) & 0xffff) / 65535) - 0.5) * jitter
      const d = Math.hypot(px - x, py - y)
      if (d < f1) {
        f2 = f1
        f1 = d
        id = hash2(ix + i, iy + j, seed + 7)
        cx = px
        cy = py
      } else if (d < f2) f2 = d
    }
  }
  out.f1 = f1
  out.f2 = f2
  out.id = id
  out.cx = cx
  out.cy = cy
  return out
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
export function linToSrgb(c: number): number {
  c = c < 0 ? 0 : c > 1 ? 1 : c
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}
export function hexLin(s: string): [number, number, number] {
  const n = parseInt(s.replace('#', ''), 16)
  return [srgbToLin(((n >> 16) & 255) / 255), srgbToLin(((n >> 8) & 255) / 255), srgbToLin((n & 255) / 255)]
}

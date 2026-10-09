// Small, allocation-free 2D noise kit for procedural macro materials.
// Everything is a pure function of (x, y, seed) so materials can be baked at any
// resolution over any field of view and stay consistent (a pit at 5:1 is the
// same pit at 2:1).

/** Integer hash of a 2D lattice point, returns [0, 1). */
export function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Second independent hash channel (for jitter y, radii, etc.). */
export function hash2b(ix: number, iy: number, seed: number): number {
  return hash2(ix, iy, seed + 0x5bd1e995)
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

// 16 unit gradients (avoids per-sample cos/sin)
const GRAD = new Float64Array(32)
for (let k = 0; k < 16; k++) {
  const a = (k / 16) * Math.PI * 2 + 0.1963
  GRAD[k * 2] = Math.cos(a)
  GRAD[k * 2 + 1] = Math.sin(a)
}

/** Gradient (Perlin-style) noise, roughly in [-1, 1]. Hot path: hashes inlined. */
export function gnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = Math.imul(ix | 0, 0x27d4eb2d)
  const sx1 = Math.imul((ix + 1) | 0, 0x27d4eb2d)
  const sy = Math.imul(iy | 0, 0x165667b1)
  const sy1 = Math.imul((iy + 1) | 0, 0x165667b1)
  const ss = Math.imul(seed | 0, 0x9e3779b1)
  const k00 = gidx(sx ^ sy ^ ss)
  const k10 = gidx(sx1 ^ sy ^ ss)
  const k01 = gidx(sx ^ sy1 ^ ss)
  const k11 = gidx(sx1 ^ sy1 ^ ss)
  const n00 = GRAD[k00] * fx + GRAD[k00 + 1] * fy
  const n10 = GRAD[k10] * (fx - 1) + GRAD[k10 + 1] * fy
  const n01 = GRAD[k01] * fx + GRAD[k01 + 1] * (fy - 1)
  const n11 = GRAD[k11] * (fx - 1) + GRAD[k11 + 1] * (fy - 1)
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = n00 + (n10 - n00) * u
  const b = n01 + (n11 - n01) * u
  return (a + (b - a) * v) * 1.41421356
}

/** finalise a pre-mixed lattice hash into a gradient-table index (0, 2, ... 30) */
function gidx(h: number): number {
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return ((h >>> 28) & 15) << 1
}

/** Value noise in [0, 1], cheaper than gradient noise, slightly blobbier. */
export function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const u = fade(x - ix)
  const v = fade(y - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  const ab = a + (b - a) * u
  const cd = c + (d - c) * u
  return ab + (cd - ab) * v
}

/** Fractal sum of gradient noise, roughly in [-1, 1]. Rotates each octave to hide lattice. */
export function fbm(x: number, y: number, seed: number, octaves: number, gain = 0.5, lacunarity = 2.03): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let px = x
  let py = y
  for (let o = 0; o < octaves; o++) {
    sum += amp * gnoise(px, py, seed + o * 1013)
    norm += amp
    amp *= gain
    // rotate ~37 degrees and scale
    const nx = (px * 0.8 - py * 0.6) * lacunarity
    const ny = (px * 0.6 + py * 0.8) * lacunarity
    px = nx + 17.13
    py = ny - 9.71
  }
  return sum / norm
}

/** Ridged fbm in [0, 1]: sharp crests, good for crusty scale. */
export function ridged(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 0.5
  let px = x
  let py = y
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(gnoise(px, py, seed + o * 7919))
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    const nx = (px * 0.8 - py * 0.6) * 2.01
    const ny = (px * 0.6 + py * 0.8) * 2.01
    px = nx + 3.7
    py = ny + 11.1
  }
  return sum / norm
}

/** Result slot for worley(); reuse one per call site to avoid allocation. */
export interface WorleyHit {
  f1: number
  f2: number
  /** jittered feature point of the nearest cell, in input units */
  cx: number
  cy: number
  /** hash of the nearest cell in [0, 1) */
  id: number
}

export function worleyHit(): WorleyHit {
  return { f1: 0, f2: 0, cx: 0, cy: 0, id: 0 }
}

/** Cellular noise: F1/F2 distances (in cell units) and nearest-cell info. */
export function worley(x: number, y: number, seed: number, out: WorleyHit, jitter = 0.9): WorleyHit {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let f1 = 1e9
  let f2 = 1e9
  let cx = 0
  let cy = 0
  let id = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = ix + i
      const gy = iy + j
      const h = hash2(gx, gy, seed)
      const px = gx + 0.5 + (h - 0.5) * jitter
      const py = gy + 0.5 + (hash2b(gx, gy, seed) - 0.5) * jitter
      const dx = px - x
      const dy = py - y
      const d = dx * dx + dy * dy
      if (d < f1) {
        f2 = f1
        f1 = d
        cx = px
        cy = py
        id = h
      } else if (d < f2) f2 = d
    }
  }
  out.f1 = Math.sqrt(f1)
  out.f2 = Math.sqrt(f2)
  out.cx = cx
  out.cy = cy
  out.id = id
  return out
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Deterministic PRNG (mulberry32) for placing discrete features (scratches, etc.). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

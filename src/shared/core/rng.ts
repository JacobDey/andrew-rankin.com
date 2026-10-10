// Seeded randomness. The reference implementations (mulberry32, hashString, hash2i) are
// binding (architecture.md §4.1) so every game gets identical sequences. No Math.random here.

export type Rng = () => number // uniform [0, 1)

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Integer lattice hash, uint32. */
export function hash2i(ix: number, iy: number, seed = 0): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** hash2i / 2^32, in [0, 1). */
export function hash2(ix: number, iy: number, seed = 0): number {
  return hash2i(ix, iy, seed) / 4294967296
}

/** 3D lattice hash in [0, 1). */
export function hash3(ix: number, iy: number, iz: number, seed = 0): number {
  let h =
    (Math.imul(ix | 0, 0x27d4eb2d) ^
      Math.imul(iy | 0, 0x165667b1) ^
      Math.imul(iz | 0, 0x1b873593) ^
      Math.imul(seed | 0, 0x9e3779b9)) >>>
    0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** An independent named stream from one seed: mulberry32((seed ^ hashString(stream)) >>> 0). */
export function rngStream(seed: number, stream: string): Rng {
  return mulberry32((seed ^ hashString(stream)) >>> 0)
}

export function randRange(r: Rng, a: number, b: number): number {
  return a + (b - a) * r()
}

/** Integer in [a, bExclusive). */
export function randInt(r: Rng, a: number, bExclusive: number): number {
  return a + Math.floor(r() * (bExclusive - a))
}

/** N(0,1) by Box-Muller (consumes two uniforms per call so the stream stays predictable). */
export function gauss(r: Rng): number {
  const u = 1 - r() // (0, 1]
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)] as T
}

/** In place, Fisher-Yates. */
export function shuffle<T>(r: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = arr[i] as T
    arr[i] = arr[j] as T
    arr[j] = t
  }
  return arr
}

/**
 * Threshold maps for 1-bit dithering.
 *
 * Every map is a tileable square of rank values normalised to (0, 1):
 *   value = (rank + 0.5) / N        (N = size * size)
 * so `tone > value` gives exactly `tone * N` white pixels per tile.
 *
 * - bluenoise: void-and-cluster (Ulichney 1993), seeded and deterministic, cached
 *              in memory and in localStorage (it is ~40-80 ms for 64x64 in V8).
 * - bayer:     classic recursive ordered dither (8x8 by default, tiled).
 * - cluster:   45-degree clustered-dot "halftone" screen (newsprint / photostat look).
 *
 * Pure TS, no DOM required (localStorage use is guarded).
 */

export type PatternName = 'bluenoise' | 'bayer' | 'cluster'

/** Small, fast, seeded PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BlueNoiseOptions {
  /** Power of two, 32..256. 64 is plenty for a 1-bit look; 128 if you see tiling. */
  size?: number
  /** Gaussian energy sigma in pixels. Ulichney's 1.5; 1.9 gives slightly smoother voids. */
  sigma?: number
  seed?: number
  /** Fraction of pixels in the initial binary pattern (Ulichney uses ~10%). */
  initialDensity?: number
}

/**
 * Void-and-cluster blue noise. Returns ranks normalised to (0,1) as a Float32Array
 * of length size*size, row-major (index = y * size + x).
 *
 * Cost: each insert/remove updates a windowed toroidal Gaussian (R = 4.5 sigma) and
 * refreshes the per-row extrema of the rows it touched; each search scans `size` row
 * extrema. About O(N * W * size): ~40 ms cold for 64x64 and ~0.25 s for 128x128 in
 * V8 (Node 22), so 128 is fine at load time but not mid-frame.
 */
export function generateBlueNoise(opts: BlueNoiseOptions = {}): Float32Array {
  const size = opts.size ?? 64
  const sigma = opts.sigma ?? 1.9
  const seed = opts.seed ?? 1
  const density = opts.initialDensity ?? 0.1
  if (size & (size - 1)) throw new Error('blue noise size must be a power of two')
  const N = size * size
  const mask = size - 1

  // The Gaussian is negligible beyond ~4.5 sigma (< 4e-5), so each insert/remove only
  // touches a (2R+1)^2 toroidal window instead of all N energies.
  const R = Math.min((size >> 1) - 1, Math.ceil(4.5 * sigma))
  const W = 2 * R + 1
  const win = new Float64Array(W * W)
  const inv2s2 = 1 / (2 * sigma * sigma)
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) win[(dy + R) * W + dx + R] = Math.exp(-(dx * dx + dy * dy) * inv2s2)

  const energy = new Float64Array(N)
  const bits = new Uint8Array(N)
  const shift = Math.log2(size)

  // Per-row extrema (max energy among 1s, min among 0s) so the argmax/argmin searches
  // scan `size` rows instead of N pixels; a splat only refreshes the W rows it touched.
  // Row-major order with strict comparisons keeps the result identical to a flat scan.
  const rowMax = new Float64Array(size)
  const rowMaxI = new Int32Array(size)
  const rowMin = new Float64Array(size)
  const rowMinI = new Int32Array(size)
  const refreshRow = (y: number) => {
    let mx = -Infinity, mxi = -1, mn = Infinity, mni = -1
    const base = y * size
    for (let i = base; i < base + size; i++) {
      const e = energy[i]
      if (bits[i]) { if (e > mx) { mx = e; mxi = i } } else if (e < mn) { mn = e; mni = i }
    }
    rowMax[y] = mx; rowMaxI[y] = mxi; rowMin[y] = mn; rowMinI[y] = mni
  }
  const refreshAll = () => { for (let y = 0; y < size; y++) refreshRow(y) }

  /** Flip bit idx to v and update energies + row caches. */
  const set = (idx: number, v: 0 | 1) => {
    bits[idx] = v
    const sign = v ? 1 : -1
    const px = idx & mask
    const py = idx >> shift
    for (let dy = -R; dy <= R; dy++) {
      const y = (py + dy) & mask
      const row = y * size
      const wrow = (dy + R) * W + R
      for (let dx = -R; dx <= R; dx++) energy[row + ((px + dx) & mask)] += sign * win[wrow + dx]
      refreshRow(y)
    }
  }
  /** Tightest cluster: the 1 with the highest energy. */
  const tightest = () => {
    let best = -1
    let bestE = -Infinity
    for (let y = 0; y < size; y++) if (rowMax[y] > bestE) { bestE = rowMax[y]; best = rowMaxI[y] }
    return best
  }
  /** Largest void: the 0 with the lowest energy. (Phase III's "tightest cluster of
   *  zeros" is the same pixel, because E_zeros = const - E_ones.) */
  const largestVoid = () => {
    let best = -1
    let bestE = Infinity
    for (let y = 0; y < size; y++) if (rowMin[y] < bestE) { bestE = rowMin[y]; best = rowMinI[y] }
    return best
  }
  refreshAll()

  // Phase 0: random initial pattern, then relax it into an even distribution.
  const rand = mulberry32(seed)
  const ones = Math.max(1, Math.floor(N * density))
  let placed = 0
  while (placed < ones) {
    const i = Math.floor(rand() * N)
    if (!bits[i]) { set(i, 1); placed++ }
  }
  for (let guard = 0; guard < N * 4; guard++) {
    const c = tightest()
    set(c, 0)
    const v = largestVoid()
    if (v === c) { set(c, 1); break }
    set(v, 1)
  }
  const proto = bits.slice()
  const protoEnergy = energy.slice()

  const rank = new Int32Array(N).fill(-1)
  // Phase 1: peel the prototype's clusters, ranking downwards.
  for (let r = ones - 1; r >= 0; r--) {
    const c = tightest()
    set(c, 0)
    rank[c] = r
  }
  // Phase 2+3: from the prototype, fill voids upwards until every pixel is ranked.
  bits.set(proto)
  energy.set(protoEnergy)
  refreshAll()
  for (let r = ones; r < N; r++) {
    const v = largestVoid()
    set(v, 1)
    rank[v] = r
  }

  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) out[i] = (rank[i] + 0.5) / N
  return out
}

/** Recursive Bayer matrix, n = 2^k. Normalised thresholds, row-major. */
export function bayerMatrix(n = 8): Float32Array {
  let m = [0]
  let s = 1
  while (s < n) {
    const next = new Array<number>(4 * s * s)
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = 4 * m[y * s + x]
        const w = 2 * s
        next[y * w + x] = v
        next[y * w + x + s] = v + 2
        next[(y + s) * w + x] = v + 3
        next[(y + s) * w + x + s] = v + 1
      }
    }
    m = next
    s *= 2
  }
  const N = n * n
  return Float32Array.from(m, (r) => (r + 0.5) / N)
}

/**
 * 45-degree clustered-dot screen in an 8x8 tile (two dots per tile, ~32 tone levels).
 * Dots grow from the centre of each cell; at 50% they touch in a checkerboard.
 */
export function clusterMatrix(n = 8): Float32Array {
  const N = n * n
  const vals: { i: number; v: number }[] = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = ((x + 0.5) / n) * 2 * Math.PI
      const w = ((y + 0.5) / n) * 2 * Math.PI
      // Spot function of a 45-degree screen; a small ramp breaks ties deterministically.
      const v = Math.cos(u + w) + Math.cos(u - w) + 1e-4 * ((x * 7 + y * 13) % N)
      vals.push({ i: y * n + x, v })
    }
  }
  // Lowest rank turns white first: rank the spot peaks first so low tones are small
  // white dots on ink, mid tones a checkerboard, high tones small ink dots on white.
  vals.sort((a, b) => b.v - a.v)
  const out = new Float32Array(N)
  vals.forEach((e, r) => { out[e.i] = (r + 0.5) / N })
  return out
}

/** Tile an n x n matrix up to size x size. */
export function tile(matrix: Float32Array, n: number, size: number): Float32Array {
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = matrix[(y % n) * n + (x % n)]
  return out
}

/** Quantise normalised thresholds to bytes; the shader recovers (b + 0.5) / 256. */
export function toBytes(values: Float32Array): Uint8Array {
  const out = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) out[i] = Math.min(255, Math.floor(values[i] * 256))
  return out
}

const memo = new Map<string, Uint8Array>()
export const thresholdMapTimings: Record<string, number> = {}

function storageGet(key: string): Uint8Array | null {
  try {
    const s = globalThis.localStorage?.getItem(key)
    if (!s) return null
    const bin = atob(s)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}
function storageSet(key: string, bytes: Uint8Array) {
  try {
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
    globalThis.localStorage?.setItem(key, btoa(s))
  } catch {
    /* private mode or quota: the memory cache still works */
  }
}

/**
 * Get a byte threshold map (size x size) for a pattern. Cached in memory; blue noise
 * also in localStorage (key `ar1b:bn:v2:<size>:<seed>`), so the generator runs once
 * per device. Pass `persist: false` to skip storage (tests, timing).
 */
export function getThresholdMap(pattern: PatternName, size = 64, seed = 1, persist = true): Uint8Array {
  const key = `${pattern}:${size}:${seed}`
  const hit = memo.get(key)
  if (hit) return hit
  let bytes: Uint8Array | null = null
  const t0 = performance.now()
  if (pattern === 'bluenoise') {
    const skey = `ar1b:bn:v2:${size}:${seed}`
    bytes = persist ? storageGet(skey) : null
    if (!bytes || bytes.length !== size * size) {
      bytes = toBytes(generateBlueNoise({ size, seed }))
      if (persist) storageSet(skey, bytes)
      thresholdMapTimings[key] = performance.now() - t0
    } else {
      thresholdMapTimings[key + ':cached'] = performance.now() - t0
    }
  } else if (pattern === 'bayer') {
    bytes = toBytes(tile(bayerMatrix(8), 8, size))
  } else {
    bytes = toBytes(tile(clusterMatrix(8), 8, size))
  }
  memo.set(key, bytes)
  return bytes
}

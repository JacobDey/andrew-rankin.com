// games/plates/render/dither.ts — Bayer 8×8 and a seeded void-and-cluster blue-noise tile.
// Ported from spikes/dither-1bit/core/noise.ts. (@shared/dither's generateBlueNoise replaces this
// once that module's barrel lands; the API here is deliberately the same shape.)
import * as THREE from 'three'

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
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
export function rngFor(seed: string): () => number { return mulberry32(hashString(seed)) }

const blueCache = new Map<string, Float32Array>()
/** Void-and-cluster blue noise, ranks normalised to (0,1), row-major. ~0.25 s at 128. */
export function generateBlueNoise(o: { size?: number; seed?: number; sigma?: number } = {}): Float32Array {
  const size = o.size ?? 128, sigma = o.sigma ?? 1.5, seed = o.seed ?? 1
  const key = `${size}:${seed}:${sigma}`
  const hit = blueCache.get(key)
  if (hit) return hit
  const N = size * size, mask = size - 1, shift = Math.log2(size)
  const R = Math.min((size >> 1) - 1, Math.ceil(4.5 * sigma)), W = 2 * R + 1
  const win = new Float64Array(W * W), inv = 1 / (2 * sigma * sigma)
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) win[(dy + R) * W + dx + R] = Math.exp(-(dx * dx + dy * dy) * inv)
  const energy = new Float64Array(N), bits = new Uint8Array(N)
  const rowMax = new Float64Array(size), rowMaxI = new Int32Array(size), rowMin = new Float64Array(size), rowMinI = new Int32Array(size)
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
  const set = (idx: number, v: 0 | 1) => {
    bits[idx] = v
    const sgn = v ? 1 : -1, px = idx & mask, py = idx >> shift
    for (let dy = -R; dy <= R; dy++) {
      const y = (py + dy) & mask, row = y * size, wrow = (dy + R) * W + R
      for (let dx = -R; dx <= R; dx++) energy[row + ((px + dx) & mask)] += sgn * win[wrow + dx]
      refreshRow(y)
    }
  }
  const tightest = () => { let b = -1, e = -Infinity; for (let y = 0; y < size; y++) if (rowMax[y] > e) { e = rowMax[y]; b = rowMaxI[y] } return b }
  const largestVoid = () => { let b = -1, e = Infinity; for (let y = 0; y < size; y++) if (rowMin[y] < e) { e = rowMin[y]; b = rowMinI[y] } return b }
  refreshAll()
  const rand = mulberry32(seed)
  const ones = Math.max(1, Math.floor(N * 0.1))
  let placed = 0
  while (placed < ones) { const i = Math.floor(rand() * N); if (!bits[i]) { set(i, 1); placed++ } }
  for (let g = 0; g < N * 4; g++) {
    const c = tightest(); set(c, 0)
    const v = largestVoid()
    if (v === c) { set(c, 1); break }
    set(v, 1)
  }
  const proto = bits.slice(), protoE = energy.slice()
  const rank = new Int32Array(N).fill(-1)
  for (let r = ones - 1; r >= 0; r--) { const c = tightest(); set(c, 0); rank[c] = r }
  bits.set(proto); energy.set(protoE); refreshAll()
  for (let r = ones; r < N; r++) { const v = largestVoid(); set(v, 1); rank[v] = r }
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) out[i] = (rank[i] + 0.5) / N
  blueCache.set(key, out)
  return out
}

/** The 128² tile as bytes (what the GPU samples: r = byte/255). */
let blueBytes: Uint8Array | null = null
export function blueNoiseBytes(): Uint8Array {
  if (blueBytes) return blueBytes
  const f = generateBlueNoise({ size: 128, seed: 7, sigma: 1.5 })
  const u = new Uint8Array(f.length)
  for (let i = 0; i < f.length; i++) u[i] = Math.min(255, Math.max(0, Math.round(f[i] * 255)))
  blueBytes = u
  return u
}
/** CPU twin of grainT() in PLATE_GLSL: threshold for plate texel (px, py) with a per-plate offset. */
export function grainT(bytes: Uint8Array, px: number, py: number, sx: number, sy: number): number {
  const x = ((px + sx) % 128 + 128) % 128, y = ((py + sy) % 128 + 128) % 128
  return (bytes[(y | 0) * 128 + (x | 0)] / 255) * 0.98 + 0.01
}

export function blueNoiseTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(blueNoiseBytes(), 128, 128, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export const BAYER8: Float32Array = (() => {
  let m = [0], s = 1
  while (s < 8) {
    const n = new Array<number>(4 * s * s), w = 2 * s
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = 4 * m[y * s + x]
      n[y * w + x] = v; n[y * w + x + s] = v + 2; n[(y + s) * w + x] = v + 3; n[(y + s) * w + x + s] = v + 1
    }
    m = n; s = w
  }
  return Float32Array.from(m, (v) => (v + 0.5) / 64)
})()
export function bayer8(x: number, y: number): number { return BAYER8[(y & 7) * 8 + (x & 7)] }

export const BAYER_GLSL = /* glsl */ `
float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(floor(p), 8.0));
  int x = q.x, y = q.y;
  int v = 0;
  int xy = x ^ y;
  v |= ((xy >> 0) & 1) << 5; v |= ((x >> 0) & 1) << 4;
  v |= ((xy >> 1) & 1) << 3; v |= ((x >> 1) & 1) << 2;
  v |= ((xy >> 2) & 1) << 1; v |= ((x >> 2) & 1) << 0;
  return (float(v) + 0.5) / 64.0;
}
`

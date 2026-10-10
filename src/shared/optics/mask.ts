// Pupil masks: iris polygons, Waterhouse cards, pinholes (lensbench.md §5.3, §6.1).
import type { StopSpec } from './types'

export const MASK_SIZE = 64
export const CARD_SIZE = 32

function b64ToBytes(s: string): Uint8Array {
  try {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = norm.length % 4 ? norm + '='.repeat(4 - (norm.length % 4)) : norm
    const bin = atob(pad)
    const u = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
    return u
  } catch {
    return new Uint8Array(0)
  }
}
function bytesToB64(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a 32×32 1-bit card (row-major, top row first, MSB first) into 0/1 bytes. */
export function decodeCard(card: string | undefined): Uint8Array | null {
  if (!card) return null
  const b = b64ToBytes(card)
  if (b.length < (CARD_SIZE * CARD_SIZE) / 8) return null
  const out = new Uint8Array(CARD_SIZE * CARD_SIZE)
  for (let i = 0; i < out.length; i++) out[i] = (b[i >> 3] >> (7 - (i & 7))) & 1
  return out
}
export function encodeCard(bits: ArrayLike<number>): string {
  const b = new Uint8Array((CARD_SIZE * CARD_SIZE) / 8)
  for (let i = 0; i < CARD_SIZE * CARD_SIZE; i++) if (bits[i]) b[i >> 3] |= 1 << (7 - (i & 7))
  return bytesToB64(b)
}

/** A heart, for presets and the `setAperture('heart')` test hook. */
export function heartCard(): string {
  const bits = new Uint8Array(CARD_SIZE * CARD_SIZE)
  for (let y = 0; y < CARD_SIZE; y++)
    for (let x = 0; x < CARD_SIZE; x++) {
      const u = ((x + 0.5) / CARD_SIZE) * 2 - 1
      const v = 1 - ((y + 0.5) / CARD_SIZE) * 2
      const X = u * 1.25, Y = v * 1.25 + 0.25
      const f = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y
      if (f <= 0 && u * u + v * v <= 1) bits[y * CARD_SIZE + x] = 1
    }
  return encodeCard(bits)
}

/** Rasterize the stop into a size² mask in the unit circle (1 = open). */
export function rasterizePupil(s: StopSpec, size = MASK_SIZE): Uint8Array {
  const out = new Uint8Array(size * size)
  const card = s.kind === 'card' ? decodeCard(s.card) : null
  const n = s.kind === 'iris' ? s.blades : 0
  const round = Math.max(0, Math.min(1, s.roundness))
  const apo = n > 0 ? Math.cos(Math.PI / n) : 1
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1
      const v = 1 - ((y + 0.5) / size) * 2
      const r = Math.hypot(u, v)
      if (r > 1) continue
      let open = true
      if (card) {
        const cx = Math.min(CARD_SIZE - 1, Math.floor(((u + 1) / 2) * CARD_SIZE))
        const cy = Math.min(CARD_SIZE - 1, Math.floor(((1 - v) / 2) * CARD_SIZE))
        open = card[cy * CARD_SIZE + cx] > 0
      } else if (n > 0 && round < 1) {
        // regular polygon with vertices on the unit circle, first vertex at the top
        const a = Math.atan2(u, v)
        const seg = (2 * Math.PI) / n
        const local = ((a % seg) + seg) % seg - seg / 2
        const rPoly = apo / Math.cos(local)
        const rLim = rPoly + (1 - rPoly) * round
        open = r <= rLim
      }
      if (open) out[y * size + x] = 1
    }
  return out
}

/** Open fraction of the full unit circle. */
export function maskFraction(mask: Uint8Array, size = MASK_SIZE): number {
  let open = 0, circ = 0
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1, v = 1 - ((y + 0.5) / size) * 2
      if (u * u + v * v <= 1) { circ++; if (mask[y * size + x]) open++ }
    }
  return circ ? open / circ : 0
}

/** n stratified points (x, y pairs in −1..1, y up) uniformly over the open mask. Deterministic per seed. */
export function samplePupil(mask: Uint8Array, size: number, n: number, seed: number): Float32Array {
  const out = new Float32Array(n * 2)
  // R2 low-discrepancy sequence with a seeded offset, rejection against the mask
  const g = 1.32471795724474602596
  const a1 = 1 / g, a2 = 1 / (g * g)
  let s = (seed >>> 0) || 1
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const ox = rnd(), oy = rnd()
  let k = 0
  let i = 0
  const maxTries = n * 400 + 1000
  while (k < n && i < maxTries) {
    const u = ((ox + a1 * (i + 1)) % 1) * 2 - 1
    const v = ((oy + a2 * (i + 1)) % 1) * 2 - 1
    i++
    if (u * u + v * v > 1) continue
    const ix = Math.min(size - 1, Math.floor(((u + 1) / 2) * size))
    const iy = Math.min(size - 1, Math.floor(((1 - v) / 2) * size))
    if (!mask[iy * size + ix]) continue
    out[k * 2] = u; out[k * 2 + 1] = v
    k++
  }
  for (; k < n; k++) { out[k * 2] = 0; out[k * 2 + 1] = 0 }
  return out
}

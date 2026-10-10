// Contact fields (texturedle.md section 5.2): D_r(p) = max over |q - p| < r of [H(q) + sqrt(r^2 - |q - p|^2)] - r.
// A probe of radius r resting at p sits on D_r(p): pits narrower than the probe are bridged, peaks become domes.
// Plus the snag map and the grid helpers the baker and the runtime share. Typed arrays only (worker-safe).
import type { ContactField, ProbeKind } from './types'

export const PROBES: Record<ProbeKind, { radiusMm: number }> = {
  marble: { radiusMm: 1.5 },
  burlap: { radiusMm: 0.45 },
  lens: { radiusMm: 0.08 },
}

/** Field resolution for a probe: cell = r / 6, resolution clamped to 64..256 (section 5.2). */
export function contactRes(sizeMm: number, radiusMm: number): number {
  return Math.max(64, Math.min(256, Math.round(sizeMm / (radiusMm / 6))))
}

/** Max-pool (or, when upsampling, nearest-sample) a square grid to dstRes. */
export function maxPoolSquare(src: Float32Array, res: number, dstRes: number): Float32Array {
  if (dstRes === res) return src
  const out = new Float32Array(dstRes * dstRes)
  if (dstRes > res) {
    for (let j = 0; j < dstRes; j++) {
      const sj = Math.min(res - 1, Math.floor(((j + 0.5) * res) / dstRes))
      for (let i = 0; i < dstRes; i++) out[j * dstRes + i] = src[sj * res + Math.min(res - 1, Math.floor(((i + 0.5) * res) / dstRes))]
    }
    return out
  }
  for (let j = 0; j < dstRes; j++) {
    const j0 = Math.floor((j * res) / dstRes)
    const j1 = Math.max(j0 + 1, Math.floor(((j + 1) * res) / dstRes))
    for (let i = 0; i < dstRes; i++) {
      const i0 = Math.floor((i * res) / dstRes)
      const i1 = Math.max(i0 + 1, Math.floor(((i + 1) * res) / dstRes))
      let m = -Infinity
      for (let y = j0; y < j1; y++) for (let x = i0; x < i1; x++) { const v = src[y * res + x]; if (v > m) m = v }
      out[j * dstRes + i] = m
    }
  }
  return out
}

/** Average-pool (or nearest-upsample) a square grid. */
export function avgPoolSquare(src: Float32Array, res: number, dstRes: number): Float32Array {
  if (dstRes === res) return src
  const out = new Float32Array(dstRes * dstRes)
  if (dstRes > res) return maxPoolSquare(src, res, dstRes)
  for (let j = 0; j < dstRes; j++) {
    const j0 = Math.floor((j * res) / dstRes)
    const j1 = Math.max(j0 + 1, Math.floor(((j + 1) * res) / dstRes))
    for (let i = 0; i < dstRes; i++) {
      const i0 = Math.floor((i * res) / dstRes)
      const i1 = Math.max(i0 + 1, Math.floor(((i + 1) * res) / dstRes))
      let s = 0
      for (let y = j0; y < j1; y++) for (let x = i0; x < i1; x++) s += src[y * res + x]
      out[j * dstRes + i] = s / ((j1 - j0) * (i1 - i0))
    }
  }
  return out
}

interface Disc { di: Int32Array; dj: Int32Array; w: Float32Array; n: number; ri: number }
const discCache = new Map<string, Disc>()
function disc(rCells: number): Disc {
  const key = rCells.toFixed(4)
  const hit = discCache.get(key)
  if (hit) return hit
  const ri = Math.max(0, Math.ceil(rCells))
  const offs: { di: number; dj: number; w: number }[] = []
  for (let dj = -ri; dj <= ri; dj++) {
    for (let di = -ri; di <= ri; di++) {
      const d2 = di * di + dj * dj
      if (d2 > rCells * rCells) continue
      offs.push({ di, dj, w: Math.sqrt(Math.max(0, rCells * rCells - d2)) - rCells }) // in cell units
    }
  }
  offs.sort((a, b) => b.w - a.w)
  const n = offs.length
  const d: Disc = { di: new Int32Array(n), dj: new Int32Array(n), w: new Float32Array(n), n, ri }
  offs.forEach((o, k) => { d.di[k] = o.di; d.dj[k] = o.dj; d.w[k] = o.w })
  discCache.set(key, d)
  if (discCache.size > 24) discCache.delete(discCache.keys().next().value as string)
  return d
}

/**
 * Dilate a (pooled) height grid for a probe of radius `radiusMm`. `src` is res x res over `sizeMm`.
 * Optionally restricted to the cell rectangle [i0, i1) x [j0, j1) (the runtime's dirty-rect refresh);
 * `out` must then be the existing field. Edges clamp.
 */
export function dilate(
  src: Float32Array,
  res: number,
  sizeMm: number,
  radiusMm: number,
  out: Float32Array = new Float32Array(res * res),
  rect?: { i0: number; j0: number; i1: number; j1: number },
): Float32Array {
  const cellMm = sizeMm / res
  const rCells = radiusMm / cellMm
  const d = disc(rCells)
  const wMm = new Float32Array(d.n)
  for (let k = 0; k < d.n; k++) wMm[k] = d.w[k] * cellMm
  let hmax = -Infinity
  for (let i = 0; i < src.length; i++) if (src[i] > hmax) hmax = src[i]
  const { di, dj, ri, n } = d
  const i0 = rect?.i0 ?? 0
  const i1 = rect?.i1 ?? res
  const j0 = rect?.j0 ?? 0
  const j1 = rect?.j1 ?? res
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      let best = -Infinity
      const interior = i >= ri && i < res - ri && j >= ri && j < res - ri
      for (let k = 0; k < n; k++) {
        const w = wMm[k]
        if (hmax + w <= best) break // sorted by weight: nothing later can win
        let ii = i + di[k]
        let jj = j + dj[k]
        if (!interior) {
          ii = ii < 0 ? 0 : ii >= res ? res - 1 : ii
          jj = jj < 0 ? 0 : jj >= res ? res - 1 : jj
        }
        const v = src[jj * res + ii] + w
        if (v > best) best = v
      }
      out[j * res + i] = best
    }
  }
  return out
}

/** Build a ContactField for a full-resolution height grid. */
export function buildContact(height: Float32Array, res: number, sizeMm: number, radiusMm: number): ContactField {
  const cres = contactRes(sizeMm, radiusMm)
  const pooled = maxPoolSquare(height, res, cres)
  return { res: cres, cellMm: sizeMm / cres, radiusMm, data: dilate(pooled, cres, sizeMm, radiusMm) }
}

/** Separable box blur on a square grid (running sums), `passes` times (3 ~ Gaussian). Clamped edges. */
export function boxBlur(src: Float32Array, res: number, radiusCells: number, passes = 2): Float32Array {
  const r = Math.max(0, Math.round(radiusCells))
  if (r === 0) return src.slice()
  let a = src.slice()
  let b = new Float32Array(src.length)
  const inv = 1 / (2 * r + 1)
  for (let p = 0; p < passes; p++) {
    // horizontal a -> b
    for (let j = 0; j < res; j++) {
      const row = j * res
      let s = 0
      for (let k = -r; k <= r; k++) s += a[row + Math.min(res - 1, Math.max(0, k))]
      for (let i = 0; i < res; i++) {
        b[row + i] = s * inv
        s += a[row + Math.min(res - 1, i + r + 1)] - a[row + Math.max(0, i - r)]
      }
    }
    // vertical b -> a
    for (let i = 0; i < res; i++) {
      let s = 0
      for (let k = -r; k <= r; k++) s += b[Math.min(res - 1, Math.max(0, k)) * res + i]
      for (let j = 0; j < res; j++) {
        a[j * res + i] = s * inv
        s += b[Math.min(res - 1, j + r + 1) * res + i] - b[Math.max(0, j - r) * res + i]
      }
    }
  }
  return a
}

/**
 * Snag map (section 5.2): S = hardness * clamp((-lap(H_sigma) - k0) / k1, 0, 1), H_sigma = H smoothed by 0.1 mm,
 * k0 = 3 / mm, k1 = 8 / mm; max-pooled to the burlap field resolution so a single sharp peak survives.
 */
export function snagMap(height: Float32Array, hardness: Float32Array, res: number, sizeMm: number, outRes: number): Float32Array {
  const texel = sizeMm / res
  const sm = boxBlur(height, res, Math.max(1, Math.round(0.07 / texel)), 2)
  const full = new Float32Array(res * res)
  const inv = 1 / (texel * texel)
  for (let j = 1; j < res - 1; j++) {
    for (let i = 1; i < res - 1; i++) {
      const k = j * res + i
      const lap = (sm[k - 1] + sm[k + 1] + sm[k - res] + sm[k + res] - 4 * sm[k]) * inv
      const s = (-lap - 3) / 8
      full[k] = (s < 0 ? 0 : s > 1 ? 1 : s) * hardness[k]
    }
  }
  return maxPoolSquare(full, res, outRes)
}

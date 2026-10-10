// Small helpers shared by the sheets: half-resolution plumbing and the
// measurements (mean, border, mottling) that score cards need.

/** 2x2 box downsample of a w*h field into an sw*sh buffer (sw = ceil(w/2)). */
export function box2(src: ArrayLike<number>, w: number, h: number, sw: number, sh: number, dst: Float32Array): void {
  for (let y = 0; y < sh; y++) {
    const y0 = y * 2
    const y1 = Math.min(h - 1, y0 + 1)
    for (let x = 0; x < sw; x++) {
      const x0 = x * 2
      const x1 = Math.min(w - 1, x0 + 1)
      dst[y * sw + x] = 0.25 * (src[y0 * w + x0] + src[y0 * w + x1] + src[y1 * w + x0] + src[y1 * w + x1])
    }
  }
}

export interface SheetMetrics {
  meanD: number
  dmax: number
  borderD: number
  evenness: number
}

/**
 * Density measurements over a sw*sh grid from a per-pixel observed-density
 * function. Samples at most ~4k pixels for the mean, ~1k along the 4% border,
 * and ~144 small blocks for mottling (mean local standard deviation).
 */
export function sheetMetrics(obs: (j: number) => number, sw: number, sh: number): SheetMetrics {
  const n = sw * sh
  const step = Math.max(1, Math.floor(n / 4096))
  let sd = 0
  let mx = 0
  let cnt = 0
  for (let j = 0; j < n; j += step) {
    const d = obs(j)
    sd += d
    if (d > mx) mx = d
    cnt++
  }
  const bx = Math.max(1, Math.round(sw * 0.04))
  const by = Math.max(1, Math.round(sh * 0.04))
  const bstep = Math.max(1, Math.floor((sw * by * 2 + sh * bx * 2) / 1024))
  let bsum = 0
  let bcnt = 0
  for (let y = 0; y < sh; y++) {
    if (y < by || y >= sh - by) {
      for (let x = 0; x < sw; x += bstep) {
        bsum += obs(y * sw + x)
        bcnt++
      }
    } else {
      for (let x = 0; x < bx; x += bstep) {
        bsum += obs(y * sw + x)
        bcnt++
      }
      for (let x = sw - bx; x < sw; x += bstep) {
        bsum += obs(y * sw + x)
        bcnt++
      }
    }
  }
  const bs = Math.max(3, Math.round(Math.min(sw, sh) / 24))
  const gx = Math.max(1, Math.floor(sw / bs))
  const gy = Math.max(1, Math.floor(sh / bs))
  const estride = Math.max(1, Math.floor((gx * gy) / 144))
  let esum = 0
  let ecnt = 0
  for (let b = 0; b < gx * gy; b += estride) {
    const x0 = (b % gx) * bs
    const y0 = Math.floor(b / gx) * bs
    let s1 = 0
    let s2 = 0
    let k = 0
    for (let yy = y0; yy < Math.min(sh, y0 + bs); yy += 2) {
      for (let xx = x0; xx < Math.min(sw, x0 + bs); xx += 2) {
        const d = obs(yy * sw + xx)
        s1 += d
        s2 += d * d
        k++
      }
    }
    if (k > 1) {
      const mean = s1 / k
      esum += Math.sqrt(Math.max(0, s2 / k - mean * mean))
      ecnt++
    }
  }
  return { meanD: sd / cnt, dmax: mx, borderD: bcnt ? bsum / bcnt : sd / cnt, evenness: ecnt ? esum / ecnt : 0 }
}

/** Bilinear upsample of a half-resolution RGB(+wet) buffer to RGBA8 with a linear-light gain per channel. */
export function upsample2ToRGBA8(
  lin: Float32Array, sw: number, sh: number, w: number, h: number, out: Uint8ClampedArray, gain: readonly [number, number, number],
  toByte: (x: number) => number, alpha: (a: number) => number,
): void {
  const cols = new Int32Array(w)
  const colF = new Float32Array(w)
  for (let x = 0; x < w; x++) {
    let u = x * 0.5 - 0.25
    if (u < 0) u = 0
    if (u > sw - 1) u = sw - 1
    const x0 = u | 0
    cols[x] = x0
    colF[x] = u - x0
  }
  const g0 = gain[0]
  const g1 = gain[1]
  const g2 = gain[2]
  for (let y = 0; y < h; y++) {
    let v = y * 0.5 - 0.25
    if (v < 0) v = 0
    if (v > sh - 1) v = sh - 1
    const y0 = v | 0
    const y1 = y0 + 1 < sh ? y0 + 1 : y0
    const fy = v - y0
    const r0 = y0 * sw
    const r1 = y1 * sw
    let o = y * w * 4
    for (let x = 0; x < w; x++, o += 4) {
      const x0 = cols[x]
      const x1 = x0 + 1 < sw ? x0 + 1 : x0
      const fx = colF[x]
      const a = 4 * (r0 + x0)
      const b = 4 * (r0 + x1)
      const c = 4 * (r1 + x0)
      const d = 4 * (r1 + x1)
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy
      out[o] = toByte((lin[a] * w00 + lin[b] * w10 + lin[c] * w01 + lin[d] * w11) * g0)
      out[o + 1] = toByte((lin[a + 1] * w00 + lin[b + 1] * w10 + lin[c + 1] * w01 + lin[d + 1] * w11) * g1)
      out[o + 2] = toByte((lin[a + 2] * w00 + lin[b + 2] * w10 + lin[c + 2] * w01 + lin[d + 2] * w11) * g2)
      out[o + 3] = alpha(lin[a + 3] * w00 + lin[b + 3] * w10 + lin[c + 3] * w01 + lin[d + 3] * w11)
    }
  }
}

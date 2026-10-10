// Film and paper primitives for the camera games (Lens Bench §5.10 and Sunny 16
// §5.10 to §5.12 compose these with their own constants), plus the latent-image
// paper preset. All pure functions on numbers and typed arrays.

import { type RGB, linearToSrgb } from './color.ts'

// ---------------------------------------------------------------------------
// Negative curve: logistic in log exposure
// ---------------------------------------------------------------------------

/** Negative film characteristic curve; x = log10(H / H_mid). */
export interface NegCurve {
  gamma: number
  dMin: number
  dMax: number
  x0: number
}

/** D(x) = dMin + ΔD / (1 + exp(-4 γ (x - x0) / ΔD)). */
export function logisticDensity(x: number, c: NegCurve): number {
  const dD = c.dMax - c.dMin
  return c.dMin + dD / (1 + Math.exp((-4 * c.gamma * (x - c.x0)) / dD))
}

/**
 * x0 such that D(0) = dMin + aboveBase (middle grey lands 0.65 above base, the
 * Lens Bench and Sunny 16 convention). For Pan 400 (γ .65, 0.22..2.4) it is 0.718.
 */
export function x0ForMidGrey(gamma: number, dMin: number, dMax: number, aboveBase = 0.65): number {
  const dD = dMax - dMin
  return (dD / (4 * gamma)) * Math.log(dD / aboveBase - 1)
}

/** Development rate versus temperature: base^(T - 20), 1.1 per degree. */
export function devRateTemp(tempC: number, base = 1.1): number {
  return Math.pow(base, tempC - 20)
}

/** Development amount in nominal minutes: minutes · rate(T) · (0.85 + 0.15 agitation). */
export function devAmount(minutes: number, tempC: number, agitation01: number): number {
  const a = agitation01 < 0 ? 0 : agitation01 > 1 ? 1 : agitation01
  return minutes * devRateTemp(tempC) * (0.85 + 0.15 * a)
}

/**
 * Selwyn granularity: σ_D = G · mul · sqrt(max(D - Dmin, 0.03)) / pixelPitchµm,
 * G in micrometres. Pan 400 (G .72) on 35 mm at 1600 px (22.5 µm pitch) gives
 * about 0.032 at one density unit above base.
 */
export function selwynSigma(G: number, dAboveBase: number, pixelPitchUm: number, mul = 1): number {
  return (G * mul * Math.sqrt(Math.max(dAboveBase, 0.03))) / pixelPitchUm
}

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

function hash32(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647) + 1274126177) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = Math.imul(h ^ (h >>> 16), 2246822519)
  h ^= h >>> 15
  return h >>> 0
}

/** Approximately normal, zero mean, unit variance, one hash per call (Irwin-Hall of three 10-bit uniforms). */
function gaussAt(x: number, y: number, seed: number): number {
  const h = hash32(x, y, seed)
  return (((h & 1023) + ((h >>> 10) & 1023) + ((h >>> 20) & 1023)) / 1023 - 1.5) * 2
}

/** Value noise on a lattice of spacing `s` pixels (smooth interpolation), unit-ish variance. */
function valueNoise(out: Float32Array, w: number, h: number, s: number, seed: number, weight: number): void {
  const gw = Math.ceil(w / s) + 2
  const gh = Math.ceil(h / s) + 2
  const g = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) g[y * gw + x] = gaussAt(x, y, seed)
  const inv = 1 / s
  for (let y = 0; y < h; y++) {
    const fy = y * inv
    const y0 = fy | 0
    let ty = fy - y0
    ty = ty * ty * (3 - 2 * ty)
    for (let x = 0; x < w; x++) {
      const fx = x * inv
      const x0 = fx | 0
      let tx = fx - x0
      tx = tx * tx * (3 - 2 * tx)
      const a = g[y0 * gw + x0]
      const b = g[y0 * gw + x0 + 1]
      const c = g[(y0 + 1) * gw + x0]
      const d = g[(y0 + 1) * gw + x0 + 1]
      out[y * w + x] += weight * (a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty)
    }
  }
}

/**
 * Zero-mean, unit-variance clumped grain noise, anchored to pixel coordinates
 * (it never swims). `clumpPx` 1 is white noise softened by a 3x3 box (0.75 / 0.25);
 * larger values use smooth value noise at that spacing. Two octaves add the
 * same noise at twice the spacing (weights 0.8 / 0.6), the "1 px + 2 px" look.
 */
export function grainField(w: number, h: number, seed: number, o: { clumpPx?: number; octaves?: 1 | 2 } = {}): Float32Array {
  const clump = Math.max(1, o.clumpPx ?? 1)
  const n = w * h
  const out = new Float32Array(n)
  if (clump <= 1) {
    const white = new Float32Array(n)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) white[y * w + x] = gaussAt(x, y, seed)
    for (let y = 0; y < h; y++) {
      const ya = y > 0 ? y - 1 : y
      const yb = y < h - 1 ? y + 1 : y
      for (let x = 0; x < w; x++) {
        const xa = x > 0 ? x - 1 : x
        const xb = x < w - 1 ? x + 1 : x
        let s = 0
        for (const yy of [ya, y, yb]) s += white[yy * w + xa] + white[yy * w + x] + white[yy * w + xb]
        out[y * w + x] = 0.8 * (0.75 * white[y * w + x] + 0.25 * (s / 9))
      }
    }
  } else valueNoise(out, w, h, clump, seed, 0.8)
  if ((o.octaves ?? 1) === 2) valueNoise(out, w, h, clump <= 1 ? 2 : clump * 2, seed + 7, 0.6)
  // Renormalise to exactly zero mean and unit variance.
  let m = 0
  for (let i = 0; i < n; i++) m += out[i]
  m /= n
  let v = 0
  for (let i = 0; i < n; i++) {
    const d = out[i] - m
    v += d * d
  }
  const k = v > 0 ? 1 / Math.sqrt(v / n) : 1
  for (let i = 0; i < n; i++) out[i] = (out[i] - m) * k
  return out
}

// ---------------------------------------------------------------------------
// Development artefacts (in place, on density arrays)
// ---------------------------------------------------------------------------

/**
 * Bromide drag: working along `axis`, a streak memory b(i) = b(i-1) e^(-1/L) +
 * 0.08 max(0, D(i-1) - threshold) darkens nothing and lightens what follows:
 * D(i) -= strength · b(i). `strength` is already the GDD's (0.5 - a) · 0.6 or
 * 0.12 · (1 - cueRatio) · ...; `lengthPx` is the e-folding length. 'y' walks down
 * each column (a tank stands upright), 'x' along each row.
 */
export function bromideDrag(D: Float32Array, w: number, h: number, o: { strength: number; lengthPx: number; threshold: number; axis: 'x' | 'y' }): void {
  if (!(o.strength > 0)) return
  const keep = Math.exp(-1 / Math.max(1e-6, o.lengthPx))
  const thr = o.threshold
  if (o.axis === 'y') {
    for (let x = 0; x < w; x++) {
      let b = 0
      let prev = D[x]
      for (let y = 1; y < h; y++) {
        const i = y * w + x
        const ex = prev - thr
        b = b * keep + (ex > 0 ? 0.08 * ex : 0)
        prev = D[i]
        D[i] = prev - o.strength * b
        if (D[i] < 0) D[i] = 0
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      let b = 0
      let prev = D[y * w]
      for (let x = 1; x < w; x++) {
        const i = y * w + x
        const ex = prev - thr
        b = b * keep + (ex > 0 ? 0.08 * ex : 0)
        prev = D[i]
        D[i] = prev - o.strength * b
        if (D[i] < 0) D[i] = 0
      }
    }
  }
}

/** Running-sum box blur of a strided channel, in place, three passes approximating a Gaussian. */
function gaussBlur(a: Float32Array, w: number, h: number, sigma: number, tmp: Float32Array): void {
  // Three box passes of width L give sigma = sqrt((L^2 - 1) / 12 * 3).
  const L = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1)))
  const r = L >> 1
  if (r < 1) return
  const pass = (src: Float32Array, dst: Float32Array, len: number, stride: number, lines: number, lineStride: number) => {
    const inv = 1 / (2 * r + 1)
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride
      let s = 0
      for (let k = -r; k <= r; k++) s += src[base + Math.min(len - 1, Math.max(0, k)) * stride]
      for (let i = 0; i < len; i++) {
        dst[base + i * stride] = s * inv
        const add = Math.min(len - 1, i + r + 1)
        const sub = Math.max(0, i - r)
        s += src[base + add * stride] - src[base + sub * stride]
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    pass(a, tmp, w, 1, h, w)
    pass(tmp, a, h, w, w, 1)
  }
}

/**
 * Halation: light that passed the emulsion and bounced off the base re-exposes
 * it as a glow around bright areas. H += gain · blur_σ(max(H - threshold, 0)) · tint.
 * `H` is exposure (any linear unit), interleaved with `channels` values per pixel
 * (4 = RGBA, alpha untouched). Lens Bench: gain .12, threshold 8·H_ref, σ = 18 px · W/1600.
 */
export function halation(H: Float32Array, w: number, h: number, channels: 1 | 3 | 4, o: { threshold: number; sigmaPx: number; gain: number; tint?: RGB }): void {
  const n = w * h
  const chans = channels === 1 ? 1 : 3
  const a = new Float32Array(n)
  const tmp = new Float32Array(n)
  for (let c = 0; c < chans; c++) {
    let any = false
    for (let i = 0; i < n; i++) {
      const ex = H[i * channels + c] - o.threshold
      a[i] = ex > 0 ? ex : 0
      if (ex > 0) any = true
    }
    if (!any) continue
    gaussBlur(a, w, h, o.sigmaPx, tmp)
    const k = o.gain * (o.tint ? o.tint[c] : 1)
    for (let i = 0; i < n; i++) H[i * channels + c] += k * a[i]
  }
}

// ---------------------------------------------------------------------------
// Paper: logistic curve and the two graded presets
// ---------------------------------------------------------------------------

/** Paper characteristic curve; xp = log10 of paper exposure in the game's own units. */
export interface PaperCurve {
  gamma: number
  dMin: number
  dMax: number
  xMid: number
}

/** D(xp) = dMin + ΔD / (1 + exp(-4 γ (xp - xMid) / ΔD)). */
export function paperDensity(xp: number, p: PaperCurve): number {
  const dD = p.dMax - p.dMin
  return p.dMin + dD / (1 + Math.exp((-4 * p.gamma * (xp - p.xMid)) / dD))
}

const STUDIO_GG = [2.4, 3.2, 4.0, 5.0, 6.0, 7.2]
const LATENT_KAPPA = [2.6, 3.3, 4.2, 5.3, 6.7, 8.5]
const LATENT_EG = [1, 1, 1, 1, 1.25, 1.6]

/**
 * Graded paper curves from the game docs.
 *  'studio' (sunny16 §5.12): D = 0.05 + 2.05 / (1 + exp(-g (xp - xMid))), g = 2.4..7.2,
 *     xMid = -0.75 + 0.656 / g; xp = log10(t / t_ref) - D_neg + log10(G_size).
 *  'latent' (latent §5.6): D = 2.0 / (1 + exp(-κ log10(E / Eg))), κ = 2.6..8.5,
 *     Eg = 0.9 · {1,1,1,1,1.25,1.6}; xp = log10 E.
 */
export function gradedPaperCurve(grade: 0 | 1 | 2 | 3 | 4 | 5, preset: 'studio' | 'latent'): PaperCurve {
  const g = Math.max(0, Math.min(5, Math.round(grade)))
  if (preset === 'studio') {
    const k = STUDIO_GG[g]
    return { gamma: (k * 2.05) / 4, dMin: 0.05, dMax: 2.1, xMid: -0.75 + 0.656 / k }
  }
  const k = LATENT_KAPPA[g]
  return { gamma: (k * 2.0) / 4, dMin: 0, dMax: 2.0, xMid: Math.log10(0.9 * LATENT_EG[g]) }
}

/**
 * Lookup table for fast print rendering: index i is the density
 * dMin + (dMax - dMin) · i / (steps - 1); entries are sRGB8 R,G,B of
 * baseRGB · 10^-D (baseRGB in linear light, e.g. paper white 0.96, 0.95, 0.92).
 */
export function densityLUT(baseRGB: RGB, dMin: number, dMax: number, steps = 1024): Uint8Array {
  const out = new Uint8Array(steps * 3)
  for (let i = 0; i < steps; i++) {
    const D = dMin + ((dMax - dMin) * i) / Math.max(1, steps - 1)
    const T = Math.pow(10, -D)
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(linearToSrgb(baseRGB[c] * T) * 255)
  }
  return out
}

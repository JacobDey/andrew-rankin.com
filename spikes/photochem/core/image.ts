// Image sources and photo prep, all pure functions on typed arrays (no DOM):
// procedural test scenes, RGBA -> linear RGB/luminance, resampling, and the
// digital-negative desk (grayscale mix -> invert -> flip -> curve -> density).

import { srgbToLinear } from './color.ts'
import { hash01 } from './kinetics.ts'

export interface LinearImage {
  w: number
  h: number
  /** Linear RGB reflectance/radiance, 3 floats per pixel. */
  rgb: Float32Array
}

/** RGBA8 sRGB (e.g. ImageData.data) -> linear RGB image. */
export function fromRGBA8(data: ArrayLike<number>, w: number, h: number): LinearImage {
  const rgb = new Float32Array(w * h * 3)
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255)
  for (let i = 0; i < w * h; i++) {
    rgb[3 * i] = lut[data[4 * i]]
    rgb[3 * i + 1] = lut[data[4 * i + 1]]
    rgb[3 * i + 2] = lut[data[4 * i + 2]]
  }
  return { w, h, rgb }
}

/** Box-filtered resample to (w, h), cropping to fill (centre crop). */
export function resample(src: LinearImage, w: number, h: number): LinearImage {
  const out = new Float32Array(w * h * 3)
  const sa = src.w / src.h
  const da = w / h
  let cw = src.w
  let ch = src.h
  if (sa > da) cw = src.h * da
  else ch = src.w / da
  const ox = (src.w - cw) / 2
  const oy = (src.h - ch) / 2
  const sx = cw / w
  const sy = ch / h
  for (let y = 0; y < h; y++) {
    const y0 = oy + y * sy
    const y1 = y0 + sy
    for (let x = 0; x < w; x++) {
      const x0 = ox + x * sx
      const x1 = x0 + sx
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = Math.floor(y0); yy < Math.max(Math.floor(y0) + 1, Math.ceil(y1)); yy++) {
        for (let xx = Math.floor(x0); xx < Math.max(Math.floor(x0) + 1, Math.ceil(x1)); xx++) {
          const cx = Math.min(src.w - 1, Math.max(0, xx))
          const cy = Math.min(src.h - 1, Math.max(0, yy))
          const k = 3 * (cy * src.w + cx)
          r += src.rgb[k]
          g += src.rgb[k + 1]
          b += src.rgb[k + 2]
          n++
        }
      }
      const o = 3 * (y * w + x)
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
    }
  }
  return { w, h, rgb: out }
}

/** Luminance with a channel mixer (default Rec. 709). */
export function luminanceOf(img: LinearImage, mix: [number, number, number] = [0.2126, 0.7152, 0.0722]): Float32Array {
  const n = img.w * img.h
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = mix[0] * img.rgb[3 * i] + mix[1] * img.rgb[3 * i + 1] + mix[2] * img.rgb[3 * i + 2]
  return out
}

// ---------------------------------------------------------------------------
// Digital negative desk
// ---------------------------------------------------------------------------

export type NegCurve = 'linear' | 'silver' | 'cyanotype'

export interface DigitalNegOpts {
  /** Flip horizontally so the ink side faces the emulsion in contact. */
  flip?: boolean
  /** Density of clear film + ink at "white" input (the thinnest neg area). */
  dmin?: number
  /** Density range of the negative (cyanotype wants ~1.8, silver contact ~1.1). */
  range?: number
  /** Tone curve preset that pre-compensates the print process. */
  curve?: NegCurve
  /** Stretch the image's own tonal range (0.5th..99.5th percentile of L*) to the full negative. */
  autoLevels?: boolean
}

/** Curve exponents: how much the mid-tones are thinned (cyanotype self-masks, so it needs a strongly bowed negative). */
const CURVE_EXP: Record<NegCurve, number> = { linear: 1, silver: 1.15, cyanotype: 1.8 }

/**
 * Turn a positive luminance image into a printable negative (density per
 * pixel). Highlights in the positive become dense, shadows thin. The curve
 * presets lift the shadows (cyanotype) or are gentle (silver) so a straight
 * print looks right, the way a calibrated digital negative does.
 */
export function digitalNegative(lum: Float32Array, w: number, h: number, opts: DigitalNegOpts = {}): Float32Array {
  const dmin = opts.dmin ?? 0.08
  const range = opts.range ?? (opts.curve === 'cyanotype' ? 1.8 : 1.15)
  const curve = opts.curve ?? 'silver'
  const ex = CURVE_EXP[curve]
  const out = new Float32Array(w * h)
  // Perceptual position of each tone (cube root ~ L*), optionally auto-levelled.
  const Ls = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) Ls[i] = Math.cbrt(Math.max(0, Math.min(1, lum[i])))
  let lo = 0
  let hi = 1
  if (opts.autoLevels ?? true) {
    const sorted = Float32Array.from(Ls).sort()
    lo = sorted[Math.floor(0.005 * (sorted.length - 1))]
    hi = sorted[Math.floor(0.995 * (sorted.length - 1))]
    if (hi - lo < 0.05) {
      lo = 0
      hi = 1
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = opts.flip ? w - 1 - x : x
      const L = Math.max(0, Math.min(1, (Ls[y * w + sx] - lo) / (hi - lo)))
      out[y * w + x] = dmin + range * Math.pow(L, ex)
    }
  }
  return out
}

/** Densities -> transmissions (10^-D). */
export function transmission(dens: Float32Array): Float32Array {
  const out = new Float32Array(dens.length)
  for (let i = 0; i < dens.length; i++) out[i] = Math.pow(10, -dens[i])
  return out
}

/** A calibration step wedge: `steps` bands of `inc` density, left to right. */
export function stepWedge(w: number, h: number, steps = 21, inc = 0.15, dmin = 0.05): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = dmin + inc * Math.floor((x / w) * steps)
  return out
}

// ---------------------------------------------------------------------------
// Procedural scenes (linear RGB reflectance under daylight)
// ---------------------------------------------------------------------------

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash01(xi, yi, seed)
  const b = hash01(xi + 1, yi, seed)
  const c = hash01(xi, yi + 1, seed)
  const d = hash01(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x: number, y: number, seed: number, oct = 4): number {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, seed + i * 17)
    f *= 2
    a *= 0.5
  }
  return s / (1 - Math.pow(0.5, oct))
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Seven-segment-ish digits for the mailbox number. */
const SEG: Record<string, string> = { '1': 'bc', '6': 'acdefg' }
function digitMask(ch: string, u: number, v: number): number {
  // u,v in [0,1] inside the digit cell
  const segs = SEG[ch] ?? ''
  const th = 0.16
  if (ch === '1') return u > 0.45 && u < 0.45 + th ? 1 : 0
  const on = (s: string) => segs.includes(s)
  let m = 0
  if (on('a') && v < th && u > 0.1 && u < 0.9) m = 1
  if (on('g') && Math.abs(v - 0.5) < th / 2 && u > 0.1 && u < 0.9) m = 1
  if (on('d') && v > 1 - th && u > 0.1 && u < 0.9) m = 1
  if (on('f') && u < th && v < 0.5) m = 1
  if (on('e') && u < th && v > 0.5) m = 1
  if (on('b') && u > 1 - th && v < 0.5) m = 1
  if (on('c') && u > 1 - th && v > 0.5) m = 1
  return m
}

/**
 * The rusty mailbox at the end of the drive (a nod to Texturedle and to the
 * "16" in the studio concept): sky, tree line, grass, a cedar post, a
 * round-topped steel box gone to rust, a red flag (black on ortho film), and a
 * white painted 16.
 */
export function mailboxScene(w: number, h: number, seed = 3): LinearImage {
  const rgb = new Float32Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      let r: number
      let g: number
      let b: number
      // Sky
      const sk = v / 0.55
      r = 0.32 + 0.38 * sk
      g = 0.45 + 0.33 * sk
      b = 0.78 + 0.12 * sk
      const cloud = smooth(0.55, 0.8, fbm(u * 5, v * 9, seed + 1) + 0.25 * (0.5 - v))
      r += (0.92 - r) * cloud * 0.9
      g += (0.92 - g) * cloud * 0.9
      b += (0.95 - b) * cloud * 0.9
      // Tree line
      const tl = 0.5 + 0.06 * fbm(u * 14, 1, seed + 2) - 0.04 * Math.sin(u * 7)
      if (v > tl) {
        const t = fbm(u * 40, v * 40, seed + 3)
        r = 0.035 + 0.04 * t
        g = 0.07 + 0.06 * t
        b = 0.03 + 0.02 * t
      }
      // Grass
      if (v > 0.62) {
        const gn = fbm(u * 60, v * 18, seed + 4)
        const shade = 0.6 + 0.6 * (v - 0.62)
        r = (0.09 + 0.08 * gn) * shade
        g = (0.24 + 0.18 * gn) * shade
        b = (0.04 + 0.04 * gn) * shade
        // Gravel drive
        const drive = Math.abs(u - (0.2 + (v - 0.62) * 0.9)) < 0.05 + (v - 0.62) * 0.35
        if (drive) {
          const gv = hash01(x, y, seed + 9)
          r = g = b = 0.18 + 0.2 * gv
          r *= 1.05
        }
      }
      // Shadow of the post and box, cast down-right across the grass (sun high on the left).
      {
        const t = (u - 0.555) / 0.32
        if (t > 0 && t < 1 && v > 0.8) {
          const centre = 0.858 + 0.03 * t
          const half = 0.005 + 0.022 * smooth(0.45, 0.62, t) * (1 - smooth(0.92, 1, t))
          const dv = Math.abs(v - centre)
          const sh = 1 - smooth(half * 0.6, half * 1.25 + 0.004, dv)
          const k = 1 - 0.55 * sh * (1 - 0.4 * t)
          r *= k
          g *= k
          b *= k + 0.05 * sh
        }
      }
      // Cedar post
      if (u > 0.535 && u < 0.585 && v > 0.48 && v < 0.86) {
        const grain = fbm(u * 200, v * 8, seed + 5)
        const side = u > 0.565 ? 0.6 : 1
        r = (0.22 + 0.1 * grain) * side
        g = (0.13 + 0.06 * grain) * side
        b = (0.07 + 0.03 * grain) * side
      }
      // Mailbox body: rectangle with a round top, in profile.
      const bx0 = 0.34
      const bx1 = 0.78
      const by1 = 0.5
      const rad = 0.09
      const byTop = by1 - 0.2
      const inX = u > bx0 && u < bx1
      const archY = byTop + rad - Math.sqrt(Math.max(0, rad * rad - Math.pow(((u - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2)) * rad, 2)))
      if (inX && v > archY && v < by1) {
        const rust = fbm(u * 26, v * 26, seed + 6)
        const pit = fbm(u * 90, v * 90, seed + 7)
        const paint = smooth(0.58, 0.66, fbm(u * 8, v * 8, seed + 8)) // flakes of old grey paint left
        const light = 1.15 - 1.4 * (v - archY) / (by1 - archY) * 0.5
        r = (0.28 + 0.22 * rust - 0.1 * pit) * light
        g = (0.09 + 0.06 * rust - 0.04 * pit) * light
        b = (0.03 + 0.02 * rust) * light
        r += (0.42 - r) * paint
        g += (0.42 - g) * paint
        b += (0.4 - b) * paint
        // Door seam and hinge
        if (Math.abs(u - (bx0 + 0.012)) < 0.004) {
          r *= 0.4
          g *= 0.4
          b *= 0.4
        }
        // "16"
        const du = (u - 0.5) / 0.045
        const dv = (v - 0.36) / 0.09
        if (dv > 0 && dv < 1) {
          const cell = Math.floor(du)
          if (cell === 0 || cell === 1) {
            const m = digitMask(cell === 0 ? '1' : '6', du - cell, dv)
            if (m) {
              r = 0.78
              g = 0.77
              b = 0.72
            }
          }
        }
      }
      // Red flag (up)
      if (u > 0.715 && u < 0.73 && v > 0.22 && v < 0.42) {
        r = 0.55
        g = 0.025
        b = 0.02
      }
      if (u > 0.715 && u < 0.77 && v > 0.22 && v < 0.26) {
        r = 0.6
        g = 0.03
        b = 0.02
      }
      const o = 3 * (y * w + x)
      rgb[o] = r
      rgb[o + 1] = g
      rgb[o + 2] = b
    }
  }
  return { w, h, rgb }
}

/** A fern frond as a photogram mask: transmission 0 where the leaf lies, 1 elsewhere. */
export function fernMask(w: number, h: number, seed = 5): Float32Array {
  const out = new Float32Array(w * h).fill(1)
  const cx = 0.5
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const t = (v - 0.06) / 0.9 // 0 tip .. 1 base
      if (t < 0 || t > 1) continue
      const bend = 0.06 * Math.sin(t * 2.4)
      const sx = u - cx - bend
      // Stem
      let leaf = Math.abs(sx) < 0.006 + 0.004 * t ? 1 : 0
      // Pinnae: alternate leaflets, length grows toward the middle.
      const len = 0.33 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.02
      const nP = 22
      const k = t * nP
      const kk = Math.floor(k)
      const side = kk % 2 === 0 ? 1 : -1
      const along = (sx * side) / len
      if (along > 0 && along < 1) {
        const centre = (kk + 0.5) / nP + 0.012 * along
        const width = (0.5 / nP) * (1 - along * 0.85)
        const lobes = 0.6 + 0.4 * Math.abs(Math.sin(along * 14 + kk))
        if (Math.abs(t - centre - along * 0.035) < width * lobes) leaf = 1
      }
      if (leaf) out[y * w + x] = 0.02 + 0.03 * hash01(x, y, seed)
    }
  }
  return out
}

/**
 * A hake-brush coating mask: full coat inside a ragged rectangle, streaky
 * bristle marks along the stroke direction, pooled edges, and dry-brush
 * fingers past the image area. The streaks survive into the final blue.
 */
export function brushCoatMask(w: number, h: number, seed = 11, inset = 0.07): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const edgeJ = 0.025 * (fbm(v * 9, 0, seed) - 0.5) + 0.02 * (fbm(v * 40, 3, seed + 1) - 0.5)
      const edgeK = 0.02 * (fbm(u * 7, 5, seed + 2) - 0.5)
      const inU = smooth(inset + edgeJ - 0.02, inset + edgeJ + 0.01, u) * smooth(1 - inset - edgeJ + 0.02, 1 - inset - edgeJ - 0.01, u)
      const inV = smooth(inset + edgeK - 0.015, inset + edgeK + 0.01, v) * smooth(1 - inset + edgeK + 0.015, 1 - inset + edgeK - 0.01, v)
      let a = inU * inV
      // Bristle streaks (horizontal strokes)
      const bristle = 0.85 + 0.25 * (fbm(u * 3, v * 140, seed + 3) - 0.5) + 0.1 * (hash01(0, Math.floor(v * h * 0.7), seed + 4) - 0.5)
      // Dry-brush fingers past the left and right edges
      const finger = fbm(u * 2, v * 60, seed + 5)
      const past = (1 - inU) * inV * smooth(0.55, 0.75, finger) * smooth(0, inset, Math.min(u, 1 - u)) * 0.9
      // Pooled edge: a slightly heavier band just inside the boundary
      const pool = 0.25 * inU * inV * (1 - smooth(0.0, 0.04, Math.min(u - inset, 1 - inset - u, v - inset, 1 - inset - v) + 0.02))
      a = a * bristle + past + pool
      out[y * w + x] = Math.max(0, a)
    }
  }
  return out
}

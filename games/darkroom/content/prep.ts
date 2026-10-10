// Photo prep: digital negatives (darkroom.md §5.9).
import type { Negative, PrepPipeline, PrepSettings } from '../types'

export const PREP_W = 256
export const PREP_H = 320

export const CURVE_PRESETS: Record<string, number[]> = {
  Linear: [0, 0.25, 0.5, 0.75, 1],
  'Silver contact': [0, 0.2, 0.48, 0.78, 1],
  Cyanotype: [0, 0.34, 0.62, 0.84, 1],
}
export const defaultPrep = (): PrepSettings => ({ channel: 'lum', invert: true, flip: true, curve: CURVE_PRESETS.Linear.slice(), uvTint: false })

/** Fritsch–Carlson monotone cubic through 5 handles at x = 0, .25, .5, .75, 1. */
export function monotoneCurve(ys: number[]): (x: number) => number {
  const n = ys.length
  const xs = ys.map((_, i) => i / (n - 1))
  const d: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m.push(d[0])
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  return (x: number) => {
    const xc = Math.max(0, Math.min(1, x))
    const i = Math.min(n - 2, Math.floor(xc * (n - 1)))
    const h = xs[i + 1] - xs[i]
    const t = (xc - xs[i]) / h
    const t2 = t * t, t3 = t2 * t
    return Math.max(0, Math.min(1, (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]))
  }
}

/** Centre-crop any image to 4:5 portrait and resample to PREP_W×PREP_H. */
export function cropTo45(src: CanvasImageSource, sw: number, sh: number): ImageData {
  const cv = document.createElement('canvas')
  cv.width = PREP_W; cv.height = PREP_H
  const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  const aspect = PREP_W / PREP_H
  let cw = sw, ch = sh
  if (sw / sh > aspect) cw = sh * aspect; else ch = sw / aspect
  c.imageSmoothingQuality = 'high'
  c.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, PREP_W, PREP_H)
  return c.getImageData(0, 0, PREP_W, PREP_H)
}

const lut22 = new Float32Array(256)
for (let i = 0; i < 256; i++) lut22[i] = Math.pow(i / 255, 2.2)

export const prep: PrepPipeline = {
  run(src, s, out) {
    const W = src.width, H = src.height, n = W * H
    const lum = out?.lum ?? new Float32Array(n)
    const T = out?.T ?? new Float32Array(n)
    const curve = monotoneCurve(s.curve)
    const curveLut = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) curveLut[i] = curve(i / 1023)
    const range = s.uvTint ? 2.0 : 1.6
    const d = src.data
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = s.flip ? W - 1 - x : x
      const o = (y * W + sx) * 4
      let gch: number
      if (s.channel === 'r') gch = d[o] / 255
      else if (s.channel === 'g') gch = d[o + 1] / 255
      else if (s.channel === 'b') gch = d[o + 2] / 255
      else gch = Math.pow(0.2126 * lut22[d[o]] + 0.7152 * lut22[d[o + 1]] + 0.0722 * lut22[d[o + 2]], 1 / 2.2)
      const i = y * W + x
      lum[i] = gch
      const t = curveLut[Math.round((s.invert ? 1 - gch : gch) * 1023)]
      T[i] = Math.pow(10, -(0.05 + range * (1 - t)))
    }
    return { lum, T, W, H }
  },
  toNegative(id, name, src, s, format): Negative {
    const r = prep.run(src, s)
    return { id, name, W: r.W, H: r.H, T: r.T, format, source: 'import', prep: { ...s, curve: s.curve.slice() } }
  },
}

/** A transparency's look on the light table (sRGB bytes): ink is dark where T is low. */
export function renderTransparency(T: Float32Array, W: number, H: number, out: ImageData): void {
  const d = out.data
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(255 * Math.pow(Math.max(0, Math.min(1, T[i] / 0.9)), 1 / 2.2))
    d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = Math.min(255, v + 4); d[i * 4 + 3] = 255
  }
}

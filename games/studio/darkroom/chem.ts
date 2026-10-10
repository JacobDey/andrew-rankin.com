// Chem bridge (studio.md §5.10–5.12; architecture §5.6): composes @shared/photochem primitives with Sunny 16's
// constants. Negative development over Float32Arrays, the paper curve, prints and contact sheets.
import { logisticDensity, devRateTemp, grainField, bromideDrag, paperDensity, gradedPaperCurve } from '@shared/photochem'
import { decodeLog2, pngToBytes } from '@shared/photo'
import type { ChemBridge, DevParams, StockId } from '../core/contracts'
import { STOCKS } from '../camera/spec'

export const CHEM_RATE = 20 // chemistry seconds per real second
export const T_REF = 8 // s, enlarger reference time

const PAPER_BASE: [number, number, number] = [0.96, 0.95, 0.92]
const COLOUR_GAMMA = [0.6, 0.62, 0.65]

export const chem: ChemBridge = {
  negDensity(x, stock, rho, ch) {
    const fog = 0.05 * Math.max(0, rho - 1)
    const g = STOCKS[stock].color ? COLOUR_GAMMA[ch] : 0.65
    const gamma = g * Math.sqrt(Math.max(0.05, rho))
    const x0 = 0.875 - 0.36 * Math.log2(Math.max(0.05, rho))
    return logisticDensity(x, { gamma, dMin: 0.15 + fog, dMax: 2.4, x0 })
  },
  reciprocity(t, stock) {
    const p = STOCKS[stock].color ? 1.2 : 1.31
    return t <= 1 ? t : Math.pow(t, 1 / p)
  },
  grainSigma(stock, D, rho) {
    return STOCKS[stock].grain * Math.sqrt(Math.max(0.05, rho)) * Math.sqrt(Math.max(0, D) + 0.05)
  },
  paperDensity(xp, grade) {
    return paperDensity(xp, gradedPaperCurve(Math.max(0, Math.min(5, Math.round(grade))) as 0 | 1 | 2 | 3 | 4 | 5, 'studio'))
  },
  devRate: (tempC) => devRateTemp(tempC, 1.1),
}

export interface Negative {
  frameId: string
  w: number
  h: number
  channels: 1 | 3
  /** density per channel, row-major (top row first) */
  D: Float32Array
  stock: StockId
  params: DevParams
}

/** Develops one latent frame (LogH8 PNG) into negative density (§5.11). */
export async function developFrame(frameId: string, png: Blob, w: number, h: number, channels: 1 | 3, stock: StockId, params: DevParams, seed: number): Promise<Negative> {
  const { bytes } = await pngToBytes(png, channels)
  const X = decodeLog2(bytes, w, h, { channels, minStops: -10, maxStops: 6.6 })
  const n = w * h
  const D = new Float32Array(n * channels)
  const rho = params.rho
  for (let i = 0; i < n * channels; i++) {
    const x = Math.log10(Math.max(1e-6, X[i]))
    D[i] = chem.negDensity(x, stock, rho, (i % channels) as 0 | 1 | 2)
  }
  // bromide drag when agitation was poor (cueRatio < 0.5): density deficits streak along the tank axis
  if (params.cueRatio < 0.5) {
    for (let c = 0; c < channels; c++) {
      const plane = new Float32Array(n)
      for (let i = 0; i < n; i++) plane[i] = D[i * channels + c]
      bromideDrag(plane, w, h, { strength: 0.12 * (1 - params.cueRatio), lengthPx: Math.max(8, Math.round(40 * (w / 768))), threshold: 1.0, axis: 'y' })
      for (let i = 0; i < n; i++) D[i * channels + c] = plane[i]
    }
  }
  // surge marks: +0.15 density in a 4 % band at both frame edges
  if (params.surge > 0) {
    const band = Math.max(2, Math.round(h * 0.04))
    for (let y = 0; y < h; y++) {
      if (y >= band && y < h - band) continue
      for (let x = 0; x < w; x++) for (let c = 0; c < channels; c++) D[(y * w + x) * channels + c] += 0.15
    }
  }
  // grain: clumped 2-octave noise in density space
  const gfield = grainField(w, h, seed >>> 0, { clumpPx: 1, octaves: 2 })
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels; c++) {
      const k = i * channels + c
      D[k] += chem.grainSigma(stock, D[k], rho) * gfield[i] * (channels === 3 ? 0.8 + 0.2 * c : 1)
    }
  }
  return { frameId, w, h, channels, D, stock, params }
}

/** Negative as seen on the light box: transmission 10^−D (colour on an orange base). RGBA8. */
export function negativeImage(neg: Negative, out?: Uint8ClampedArray, pink = 0): Uint8ClampedArray {
  const n = neg.w * neg.h
  const o = out ?? new Uint8ClampedArray(n * 4)
  const base = neg.channels === 3 ? [0.85, 0.55, 0.35] : [1, 1, 1]
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const d = neg.D[i * neg.channels + Math.min(c, neg.channels - 1)]
      let T = Math.pow(10, -d) * base[c]
      if (pink > 0) T = T * (1 - 0.35 * pink) + [0.91, 0.63, 0.75][c] * 0.35 * pink * T
      o[i * 4 + c] = lin2srgb8(T)
    }
    o[i * 4 + 3] = 255
  }
  return o
}

export interface PrintTarget {
  w: number
  h: number
  channels: 1 | 3
  /** final paper density per channel */
  Dp: Float32Array
}

/** Paper exposure through the negative: x_p = log10(t/t_ref) − D_neg + log10(G_size). */
export function exposePaper(neg: Negative, lampS: number, grade: number, sizeGain = 1, fogD = 0): PrintTarget {
  const n = neg.w * neg.h
  const Dp = new Float32Array(n * neg.channels)
  const k = Math.log10(Math.max(0.01, lampS) / T_REF) + Math.log10(sizeGain)
  for (let i = 0; i < n * neg.channels; i++) Dp[i] = Math.min(2.1, chem.paperDensity(k - neg.D[i], grade) + fogD)
  return { w: neg.w, h: neg.h, channels: neg.channels, Dp }
}

/** The median negative density mapped to zone V gives the auto-suggested lamp time (the pencil mark). */
export function suggestLamp(neg: Negative, sizeGain = 1): number {
  const step = Math.max(1, Math.floor(neg.D.length / 4000))
  const vals: number[] = []
  for (let i = 0; i < neg.D.length; i += step * neg.channels) vals.push(neg.D[i])
  vals.sort((a, b) => a - b)
  const med = vals[vals.length >> 1] ?? 0.75
  // middle-grey negative (0.75) at t_ref lands at print density 0.75 on every grade
  const t = T_REF * Math.pow(10, med - 0.75) / sizeGain
  return Math.max(1, Math.min(120, Math.round(t * 2) / 2))
}

/** Renders the print at development progress u (0..1 of each pixel's final density). RGBA8. */
export function renderPrint(p: PrintTarget, progress: (x: number, y: number) => number, out?: Uint8ClampedArray, wet = 0): Uint8ClampedArray {
  const n = p.w * p.h
  const o = out ?? new Uint8ClampedArray(n * 4)
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x
      const u = progress(x, y)
      for (let c = 0; c < 3; c++) {
        const D = 0.05 + (p.Dp[i * p.channels + Math.min(c, p.channels - 1)] - 0.05) * u
        o[i * 4 + c] = lin2srgb8(PAPER_BASE[c] * Math.pow(10, -D) * (1 - wet * 0.04))
      }
      o[i * 4 + 3] = 255
    }
  }
  return o
}

/** Mean reflectance and the fraction of bright pixels (for printPixels). */
export function printStats(img: Uint8ClampedArray): { mean: number; brightFrac: number } {
  let s = 0
  let b = 0
  const n = img.length / 4
  for (let i = 0; i < n; i++) {
    const v = (img[i * 4] + img[i * 4 + 1] + img[i * 4 + 2]) / (3 * 255)
    s += v
    if (v > 0.6) b++
  }
  return { mean: s / n, brightFrac: b / n }
}

const LUT = new Uint8ClampedArray(4096)
for (let i = 0; i < 4096; i++) {
  const v = i / 4095
  LUT[i] = Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255)
}
export function lin2srgb8(v: number): number {
  const i = v <= 0 ? 0 : v >= 1 ? 4095 : (v * 4095) | 0
  return LUT[i]
}

// Film, development and print (lensbench.md §5.10). Pure: no DOM except ImageData.
import { mulberry32 } from '@shared/core'
import { STOCKS, H0 } from '../core/catalog'
import type { DevParams, DevelopedFrame, LatentImage, StockId } from '../core/types'

export function normalDev(stock: StockId): number { return STOCKS[stock].normalMin }

/** Development amount E (minutes at 20 °C, full agitation equivalent). */
export function devAmount(dev: DevParams): number {
  if (dev.developer === 'lab') return 1
  const rate = Math.pow(1.1, dev.tempC - 20) * (dev.developer === 'coffee' ? 0.75 : 1)
  return dev.minutes * rate * (0.85 + 0.15 * Math.max(0, Math.min(1, dev.agitation)))
}

export interface DevResult { gammaEff: number; speedStops: number; fog: number; ratio: number }
export function devEffect(stock: StockId, dev: DevParams): DevResult {
  const s = STOCKS[stock]
  const EN = s.normalMin
  const E = dev.developer === 'lab' ? EN * Math.pow(2, (dev.pushStops ?? 0) * 0.5) : devAmount(dev)
  const g = (e: number) => 1 - Math.exp(-e / (0.8 * EN))
  const ratio = Math.max(0.05, E / EN)
  return { gammaEff: s.gamma * g(E) / g(EN) * (dev.developer === 'coffee' ? 0.95 : 1), speedStops: 0.6 * Math.log2(ratio), fog: 0.04 * Math.max(0, ratio - 1), ratio }
}

export function decodeH(byte: number): number { return H0 * Math.pow(2, byte / 12.75 - 10) }
export function encodeH(H: number): number { return Math.max(0, Math.min(255, Math.round((Math.log2(Math.max(1e-30, H) / H0) + 10) * 12.75))) }

const PAPER_G = 1.7, DP0 = 0.06, DP1 = 2.05
const xStar = -Math.log((DP1 - DP0) / (0.745 - DP0) - 1) / (4 * PAPER_G / (DP1 - DP0))
function paperD(xp: number): number { return DP0 + (DP1 - DP0) / (1 + Math.exp((-4 * PAPER_G * xp) / (DP1 - DP0))) }
const toSrgb8 = (x: number) => {
  const c = Math.max(0, Math.min(1, x))
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
}

/** Density of the negative for each pixel (1 channel mono or 3 channels colour). */
export function developFrame(l: LatentImage, stock: StockId, dev: DevParams, seed: number): DevelopedFrame {
  const s = STOCKS[stock]
  const { w, h } = l
  const n = w * h
  const ch = s.colour ? 3 : 1
  const eff = devEffect(stock, dev)
  const dMin = s.dMin + eff.fog
  const dD = s.dMax - s.dMin
  const x0 = (dD / (4 * s.gamma)) * Math.log(dD / 0.65 - 1)
  const Seff = s.iso * Math.pow(2, eff.speedStops)
  const k4 = (4 * eff.gammaEff) / dD
  const D = new Float32Array(n * ch)
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = decodeH(i)
  const wsum = s.w[0] + s.w[1] + s.w[2] || 1
  for (let i = 0; i < n; i++) {
    const r = lut[l.data[i * 3]], g = lut[l.data[i * 3 + 1]], b = lut[l.data[i * 3 + 2]]
    if (ch === 1) {
      const H = (s.w[0] * r + s.w[1] * g + s.w[2] * b) / wsum
      const x = Math.log10(Math.max(1e-12, (H * Seff) / 9.82))
      D[i] = dMin + dD / (1 + Math.exp(-k4 * (x - x0)))
    } else {
      const Hs = [r, g, b]
      for (let c = 0; c < 3; c++) {
        const x = Math.log10(Math.max(1e-12, (Hs[c] * Seff) / 9.82))
        D[i * 3 + c] = dMin + dD / (1 + Math.exp(-k4 * (x - x0)))
      }
    }
  }
  // bromide drag (poor agitation), down each column
  const a = dev.agitation
  if (dev.developer !== 'lab' && a < 0.5) {
    for (let c = 0; c < ch; c++)
      for (let x = 0; x < w; x++) {
        let bb = 0
        for (let y = 1; y < h; y++) {
          const prev = D[((y - 1) * w + x) * ch + c]
          bb = bb * Math.exp(-1 / 40) + 0.08 * Math.max(0, prev - 1.2)
          D[(y * w + x) * ch + c] -= (0.5 - a) * 0.6 * bb
        }
      }
  }
  // grain (Selwyn): σ_D = G·mul·√max(D − Dmin, 0.03) / a_px, clumped white noise
  const apx = (l.formatMm[0] * 1000) / w
  const grainMul = dev.developer === 'coffee' ? 1.15 : 1
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  const white = new Float32Array(n)
  for (let i = 0; i < n; i++) white[i] = (rnd() + rnd() + rnd() - 1.5) * 2 // ≈ unit variance
  const box = new Float32Array(n)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += white[yy * w + xx]; cnt++ }
      }
      box[y * w + x] = (sum / cnt) * 3
    }
  const norm = 1 / Math.sqrt(0.75 * 0.75 + 0.25 * 0.25)
  for (let i = 0; i < n; i++) {
    const nz = (0.75 * white[i] + 0.25 * box[i]) * norm
    for (let c = 0; c < ch; c++) {
      const d = D[i * ch + c]
      const sig = (s.G * grainMul * Math.sqrt(Math.max(d - dMin, 0.03))) / apx
      D[i * ch + c] = d + sig * nz * (c === 0 ? 1 : c === 1 ? 0.85 : 0.7)
    }
  }
  // print: grade-2 contact, k keyed so a normally developed mid-grey prints at 18 %
  const neg = new ImageData(w, h)
  const pos = new ImageData(w, h)
  const kMid = xStar + s.dMin + 0.65
  const base = s.colour ? [0.25, 0.65, 0.95] : [0, 0, 0]
  const stain = dev.developer === 'coffee' ? [0.95, 0.88, 0.78] : [1, 1, 1]
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const d = ch === 1 ? D[i] : D[i * 3 + c]
      const dn = ch === 1 ? d : d + base[c] * 0 // colour: the orange mask is shown on the negative only
      // negative on the light box (transmission), with the colour mask
      const T = Math.pow(10, -(dn + (s.colour ? base[c] - 0.25 : 0)))
      neg.data[i * 4 + c] = toSrgb8(T * 0.95 * stain[c])
      const xp = kMid - d
      const R = Math.pow(10, -paperD(xp))
      pos.data[i * 4 + c] = toSrgb8(R / 0.9)
    }
    neg.data[i * 4 + 3] = 255
    pos.data[i * 4 + 3] = 255
  }
  return { w, h, negative: neg, positive: pos }
}

/** Median exposure (EV relative to H_ref) of the latent, for frame meta and grading. */
export function latentEV(l: LatentImage, stock: StockId, u0 = 0, v0 = 0, u1 = 1, v1 = 1): number {
  const s = STOCKS[stock]
  const vals: number[] = []
  const x0 = Math.floor(u0 * l.w), x1 = Math.max(x0 + 1, Math.floor(u1 * l.w))
  const y0 = Math.floor(v0 * l.h), y1 = Math.max(y0 + 1, Math.floor(v1 * l.h))
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)))
  const wsum = s.w[0] + s.w[1] + s.w[2] || 1
  for (let y = y0; y < y1; y += step)
    for (let x = x0; x < x1; x += step) {
      const i = (y * l.w + x) * 3
      const H = s.colour ? (decodeH(l.data[i]) + decodeH(l.data[i + 1]) + decodeH(l.data[i + 2])) / 3
        : (s.w[0] * decodeH(l.data[i]) + s.w[1] * decodeH(l.data[i + 1]) + s.w[2] * decodeH(l.data[i + 2])) / wsum
      vals.push(Math.log2(H / (9.82 / s.iso)))
    }
  vals.sort((a, b) => a - b)
  return vals.length ? vals[vals.length >> 1] : -10
}

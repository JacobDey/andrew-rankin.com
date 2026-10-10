// Enlarger optics, exposure and graded paper (GDD §5.5–5.6). Pure functions over a 320 × 256 paper grid.
import { clamp, smoothstep } from '@shared/core'
import { gradedPaperCurve, paperDensity } from '@shared/photochem'
import type { Grade, Negative, PrintOps } from '../core/types'

export const PW = 320
export const PH = 256
export const CELL_MM = 0.794
export const PAPER_W_MM = PW * CELL_MM
export const PAPER_H_MM = PH * CELL_MM
export const D_MAX = 2.0
const EG = [1, 1, 1, 1, 1.25, 1.6]
export const egFor = (g: Grade): number => 0.9 * EG[g]
export const I0 = 1.0

export function phiStar(M: number): number { return 0.15 + (0.7 * (Math.log(M) - Math.log(2))) / (Math.log(16) - Math.log(2)) }
export function intensity(M: number): number { return I0 * ((1 + 4) / (1 + M)) ** 2 }

export interface Projection { M: number; cx: number; cy: number; flip: boolean; focus: number }

/** Paper cell → negative mm (positive orientation). */
export function paperToNeg(p: Projection, i: number, j: number): [number, number] {
  const px = (i + 0.5 - PW / 2) * CELL_MM, py = (j + 0.5 - PH / 2) * CELL_MM
  return [p.cx + (p.flip ? -px : px) / p.M, p.cy + py / p.M]
}
/** Negative mm → paper cell coordinates (continuous). */
export function negToPaper(p: Projection, nx: number, ny: number): [number, number] {
  const px = (nx - p.cx) * p.M * (p.flip ? -1 : 1), py = (ny - p.cy) * p.M
  return [px / CELL_MM + PW / 2 - 0.5, py / CELL_MM + PH / 2 - 0.5]
}

/** Projected transmittance T_proj (incl. the carrier mask and the gate tooth), then the focus blur. */
export function projectT(neg: Negative, p: Projection, out: Float32Array, step = 1): Float32Array {
  const f = CELL_MM / p.M
  const tooth = 0.93 * 36
  for (let j = 0; j < PH; j += step) for (let i = 0; i < PW; i += step) {
    const [nx, ny] = paperToNeg(p, i, j)
    let T = 0
    if (nx >= 0 && nx <= 36 && ny >= 0 && ny <= 24) T = Math.pow(10, -neg.density(nx, ny, f))
    else if (ny < 0 && ny > -0.8 && Math.abs(nx - tooth) < 0.6) T = 0.6
    for (let b = 0; b < step; b++) for (let a = 0; a < step; a++) { const ii = i + a, jj = j + b; if (ii < PW && jj < PH) out[jj * PW + ii] = T }
  }
  const rb = 18 * Math.abs(p.focus - phiStar(p.M)) * (p.M / 4)
  if (rb > 0.6) gaussInPlace(out, PW, PH, rb / 2)
  return out
}

function gaussInPlace(a: Float32Array, w: number, h: number, sigma: number): void {
  const r = Math.max(1, Math.round(sigma * 0.95))
  const tmp = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { // horizontal
      let acc = 0; const row = y * w
      for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)]
      for (let x = 0; x < w; x++) { tmp[row + x] = acc / (2 * r + 1); acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)] }
    }
    for (let x = 0; x < w; x++) { // vertical
      let acc = 0
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x]
      for (let y = 0; y < h; y++) { a[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x] }
    }
  }
}

/** Dodge (wand) shadow S at a paper point: 1 = fully shaded. Positions in paper mm from the centre. */
export function wandShadow(xMm: number, yMm: number, tx: number, ty: number, rTool: number, z: number): number {
  const zz = clamp(z, 0.05, 0.6)
  const R = rTool / (1 - zz), w = (6.25 * zz) / (1 - zz)
  const d = Math.hypot(xMm - tx, yMm - ty)
  return smoothstep(R + w / 2, R - w / 2, d)
}
/** Burn card: transmits only through the hole (1 = light passes). */
export function cardHole(xMm: number, yMm: number, tx: number, ty: number, rHole: number, z: number): number {
  return wandShadow(xMm, yMm, tx, ty, rHole, z)
}

export function cellMm(i: number, j: number): [number, number] { return [(i + 0.5 - PW / 2) * CELL_MM, (j + 0.5 - PH / 2) * CELL_MM] }

/** Static exposure for a recipe: base seconds with dodges, plus burns through a card. */
export function exposeOps(T: Float32Array, ops: PrintOps, E: Float32Array): Float32Array {
  const I = intensity(ops.M)
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    const k = j * PW + i
    const [x, y] = cellMm(i, j)
    let held = 0
    for (const d of ops.dodge ?? []) held += d.frac * wandShadow(x, y, d.x, d.y, d.r, d.z)
    let e = ops.seconds * I * T[k] * Math.max(0, 1 - held)
    for (const b of ops.burn ?? []) e += b.extraSeconds * I * T[k] * cardHole(x, y, b.x, b.y, b.r, b.z)
    E[k] = e
  }
  return E
}

const curves = new Map<number, ReturnType<typeof gradedPaperCurve>>()
export function paperCurve(g: Grade): ReturnType<typeof gradedPaperCurve> {
  let c = curves.get(g)
  if (!c) curves.set(g, (c = gradedPaperCurve(g, 'latent')))
  return c
}
/** Latent target density D* for an exposure. */
export function dStar(E: number, g: Grade): number { return paperDensity(Math.log10(Math.max(E, 1e-6)), paperCurve(g)) }
export function tInduction(E: number, g: Grade): number { return clamp(6 * Math.pow(egFor(g) / Math.max(E, 1e-4), 0.8), 2, 50) }
export const K_DEV = 0.08
/** Density after tDev seconds of development. */
export function devDensity(E: number, g: Grade, tDev: number): number {
  return dStar(E, g) * (1 - Math.exp(-K_DEV * Math.max(0, tDev - tInduction(E, g))))
}
/** Print density → reflectance → display luminance (GDD §5.6). */
export function reflect(D: number): number { return Math.pow(10, -D) }
export function displayL(D: number): number { return Math.pow(Math.max(0, (Math.pow(10, -D) - 0.01) / 0.99), 1 / 2.2) }

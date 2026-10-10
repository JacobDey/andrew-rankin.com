// Glass catalogue and Cauchy dispersion (lensbench.md §5.1), element geometry (§5.2).
import type { Ch, ElementSpec, GlassId } from './types'

export interface GlassInfo {
  id: GlassId
  name: string
  code: string
  nd: number
  vd: number
  rho: number // g/cm³
  tint: string // sRGB hex for drawing
}

export const GLASSES: Record<GlassId, GlassInfo> = {
  crown: { id: 'crown', name: 'Crown', code: '517642', nd: 1.5168, vd: 64.2, rho: 2.51, tint: '#dfeee9' },
  lightFlint: { id: 'lightFlint', name: 'Light Flint', code: '581409', nd: 1.5814, vd: 40.9, rho: 3.22, tint: '#d3d6d8' },
  flint: { id: 'flint', name: 'Flint', code: '620364', nd: 1.62, vd: 36.4, rho: 3.58, tint: '#ece3c0' },
  denseFlint: { id: 'denseFlint', name: 'Dense Flint', code: '805254', nd: 1.8052, vd: 25.4, rho: 5.18, tint: '#efd98a' },
  lanthanumCrown: { id: 'lanthanumCrown', name: 'Lanthanum Crown', code: '713538', nd: 1.713, vd: 53.8, rho: 3.8, tint: '#e3d2bf' },
  fluorite: { id: 'fluorite', name: 'Fluorite-type', code: '434950', nd: 1.4339, vd: 95.0, rho: 3.18, tint: '#e6dcf6' },
}
export const GLASS_IDS: readonly GlassId[] = ['crown', 'lightFlint', 'flint', 'denseFlint', 'lanthanumCrown', 'fluorite']

/** Fraunhofer wavelengths in µm, indexed by Ch (0 = C red, 1 = d yellow, 2 = F blue). */
export const LAMBDA_UM: readonly [number, number, number] = [0.6563, 0.5876, 0.4861]
export const LAMBDA_D_MM = 0.00055

const cauchyCache = new Map<GlassId, { A: number; B: number }>()
export function cauchy(g: GlassId): { A: number; B: number } {
  let c = cauchyCache.get(g)
  if (!c) {
    const gl = GLASSES[g] ?? GLASSES.crown
    const lc = LAMBDA_UM[0], ld = LAMBDA_UM[1], lf = LAMBDA_UM[2]
    const B = (gl.nd - 1) / (gl.vd * (1 / (lf * lf) - 1 / (lc * lc)))
    const A = gl.nd - B / (ld * ld)
    c = { A, B }
    cauchyCache.set(g, c)
  }
  return c
}

export function indexAt(g: GlassId, lambdaUm: number): number {
  const { A, B } = cauchy(g)
  const l = Math.max(0.3, Math.min(1.2, lambdaUm || 0.5876))
  return A + B / (l * l)
}
export function indexCh(g: GlassId, ch: Ch): number {
  return indexAt(g, LAMBDA_UM[ch])
}

/** Sag of a sphere of curvature c at radius r (mm). Clamped so it never NaNs. */
export function sag(c: number, r: number): number {
  const x = c * c * r * r
  if (x >= 1) return Math.sign(c) / Math.max(Math.abs(c), 1e-9)
  return (c * r * r) / (1 + Math.sqrt(1 - x))
}

/** Auto thickness (the player never sets it): t = max(1.2, sag(c1, D/2) − sag(c2, D/2) + 0.8) mm. */
export function autoThickness(e: ElementSpec): number {
  const r = e.diameter / 2
  return Math.max(1.2, sag(e.c1, r) - sag(e.c2, r) + 0.8)
}

/** Lens volume in mm³ (integrated over rings: thickness(r) = t − sag1(r) + sag2(r)). */
export function elementVolume(e: ElementSpec): number {
  const R = e.diameter / 2
  const n = 24
  let v = 0
  for (let i = 0; i < n; i++) {
    const r = ((i + 0.5) / n) * R
    const th = Math.max(0, e.t - sag(e.c1, r) + sag(e.c2, r))
    v += th * 2 * Math.PI * r * (R / n)
  }
  return v
}

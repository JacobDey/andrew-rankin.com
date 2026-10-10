// Imaging helpers (lensbench.md §5.5, architecture §4.8): one source of truth for renderers and grading.
import type { Ch, LensProfile } from './types'
import { LAMBDA_D_MM } from './glass'

const fin = (x: number, d = 0) => (Number.isFinite(x) ? x : d)

/** Focus distance (m) for a lens extension (mm): f(f+ext)/ext / 1000; ext 0 → Infinity. */
export function focusDistanceM(eflMm: number, extMm: number): number {
  if (!(extMm > 1e-9)) return Infinity
  return (eflMm * (eflMm + extMm)) / extMm / 1000
}
/** Extension (mm) to focus at sM metres: f²/(s − f). */
export function extForDistance(eflMm: number, sM: number): number {
  if (!Number.isFinite(sM) || sM <= 0) return 0
  const s = sM * 1000
  if (s <= eflMm * 1.0001) return eflMm * 1000
  return (eflMm * eflMm) / (s - eflMm)
}
export function magnification(eflMm: number, extMm: number): number {
  return Math.max(0, extMm) / Math.max(1e-6, eflMm)
}
export function workingN(N: number, m: number, pupilMag = 1): number {
  return N * (1 + m / Math.max(0.05, pupilMag))
}

/** Image distance (mm) of an object at sM metres. */
function vOf(f: number, sM: number): number {
  if (!Number.isFinite(sM)) return f
  const s = sM * 1000
  if (s <= f * 1.0001) return f * 1e4
  return (f * s) / (s - f)
}

/**
 * Signed circle of confusion (mm) on film for an object at sM metres, at field radius fieldR01
 * (0..1 of the half-diagonal), channel ch. Positive = focused behind the film.
 */
export function cocMm(p: LensProfile, extMm: number, sM: number, fieldR01: number, ch: Ch): number {
  const f = p.efl
  if (p.pinhole) return p.pinholeBlurMm
  const v = vOf(f, sM)
  const vf = f + Math.max(0, extMm)
  const h = Math.max(0, Math.min(1, fieldR01)) * Math.hypot(p.format.w, p.format.h) / 2
  const dvp = -0.5 * p.petzval * h * h
  const c = (f / p.fNumber) * (v + dvp + p.longCA[ch] - vf) / v
  return fin(c)
}
export function cocPx(cocMmValue: number, formatWmm: number, imageWpx: number): number {
  return (Math.abs(cocMmValue) * imageWpx) / Math.max(1e-6, formatWmm)
}
export function acceptableCocMm(format: { w: number; h: number }): number {
  return Math.hypot(format.w, format.h) / 1500
}
export function hyperfocalM(eflMm: number, N: number, c0Mm: number): number {
  return ((eflMm * eflMm) / (N * c0Mm) + eflMm) / 1000
}
export function airyMm(Nw: number, lambdaMm = LAMBDA_D_MM): number {
  return 2.44 * lambdaMm * Nw
}
export function fovDeg(formatSideMm: number, eflMm: number, extMm: number): number {
  return (2 * Math.atan(formatSideMm / 2 / Math.max(1e-3, eflMm + Math.max(0, extMm))) * 180) / Math.PI
}
/** Film illuminance (lux) from luminance L (cd/m²): (π/4) τ L cos⁴ V / Nw². */
export function filmIlluminanceLux(L: number, Nw: number, tau: number, cos4: number, vignette: number): number {
  return ((Math.PI / 4) * tau * L * cos4 * vignette) / Math.max(1e-6, Nw * Nw)
}
/** Alias named in lensbench.md §11.2. */
export const filmIlluminance = filmIlluminanceLux

/** Optimal pinhole: 1.9√(λf) (Lens Bench, Rayleigh) or √(2.44λf) (Sunny 16, Airy). */
export function pinholeOptimum(eflMm: number, rule: 'rayleigh' | 'airy', lambdaMm = LAMBDA_D_MM): { dMm: number; N: number } {
  const d = rule === 'rayleigh' ? 1.9 * Math.sqrt(lambdaMm * eflMm) : Math.sqrt(2.44 * lambdaMm * eflMm)
  return { dMm: d, N: eflMm / d }
}
export function pinholeBlurMm(dMm: number, eflMm: number, rule: 'rayleigh' | 'airy', lambdaMm = LAMBDA_D_MM): number {
  if (rule === 'rayleigh') return Math.sqrt(dMm * dMm + Math.pow((3.61 * lambdaMm * eflMm) / dMm, 2))
  return Math.sqrt(dMm * dMm + Math.pow((2.44 * lambdaMm * eflMm) / dMm, 2))
}

/** Vignetting factor V at field radius (0..1), linearly interpolated from the 16-sample table. */
export function vignetteAt(p: LensProfile, r01: number): number {
  const x = Math.max(0, Math.min(1, r01)) * 15
  const i = Math.min(14, Math.floor(x))
  const t = x - i
  return p.vignette[i] * (1 - t) + p.vignette[i + 1] * t
}

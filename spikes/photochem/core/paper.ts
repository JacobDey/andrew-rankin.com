// Silver gelatin printing paper: emulsions, curves, contrast filters, paper
// constants. Pure data + pure functions; the per-pixel process lives in
// silver.ts.
//
// Variable-contrast (VC) paper is modelled the way it is made: two emulsion
// components in one layer. The *hard* component is blue-sensitive and steep;
// the *soft* component is green-sensitised and gentle. Densities add and then
// saturate (there is only so much silver). A yellow filter (cuts blue) leaves
// only the soft component: grade 00. A magenta filter (cuts green) leaves
// mostly the hard component: grade 5. Split-grade printing therefore needs no
// special code: two exposures through two filters are just two contributions
// to H_hard and H_soft.
//
// Graded paper is one blue-sensitive emulsion with a fixed gamma per grade.

import { type Bands, type Spectral, actinic, dichroicFilter, lightBands, makeSpectral, SENSITIVITY } from './bands.ts'
import { type RGB, hexToLinear } from './color.ts'
import { type Curve, curveDensityH, isoPaperSpeed, isoRange, logHAtDensity, softmin } from './curve.ts'
import { type Reciprocity, reciprocityFromTimes } from './kinetics.ts'

export type PaperBase = 'rc' | 'fb'
export type PaperSurface = 'glossy' | 'pearl' | 'matte'
export type PaperTone = 'neutral' | 'warm' | 'cool'

export interface PaperSpec {
  id: string
  name: string
  kind: 'vc' | 'graded'
  /** Graded paper only: 0 (soft) .. 5 (hard). */
  grade?: number
  base: PaperBase
  surface: PaperSurface
  tone: PaperTone
}

export interface Emulsion {
  spectral: Spectral
  /** Intrinsic density curve (before the surface reflection floor), reflection units. */
  curve: Curve
  recip: Reciprocity
}

export interface PaperModel {
  spec: PaperSpec
  /** VC: the hard (blue) component. Graded: the only emulsion. */
  hard: Emulsion
  /** VC: the soft (green) component. Graded: null. */
  soft: Emulsion | null
  /** Intrinsic silver density cap. */
  dmaxInt: number
  /** Softness of the combined silver cap. */
  capSoft: number
  /** First-surface reflectance floor: dry and wet (a water film is glossy). */
  surfaceDry: number
  surfaceWet: number
  /** Paper-base white, linear RGB (includes base density ≈ 0.05). */
  white: RGB
  /** Image-silver channel density multipliers (tone). */
  imageTint: RGB
  /** Emulsion fog developed with the image (net density). */
  fog: number
  /** Dry-down: fractional midtone density gain when the print dries. */
  drydown: number
  /** Development kinetics: dp/dt = R * rate * (seed(F) + p)(1 - p). */
  devRate: number
  seedLo: number
  seedHi: number
  /** Time constant of fixing in fresh rapid fixer at 20 °C (s). Clearing ≈ 3.9 tau. */
  fixTau: number
  /** Residual-thiosulfate wash time constant, running water 20 °C (s); with hypo-clear. */
  washTau: number
  washTauHCA: number
  /** Thiosulfate the base soaks up in the fixer (relative; FB fibres hold far more). */
  fixAbsorb: number
  /** Silver coating weight, g/m² (for developer and fixer exhaustion). */
  silverGm2: number
}

// ---------------------------------------------------------------------------
// Emulsion constants (tuned by calibrate.ts, see NOTES.md)
// ---------------------------------------------------------------------------

/** Intrinsic Dmax of the silver layer (reflection units). The surface floor limits what you see. */
export const DMAX_INT = 2.9

/** Surface reflectance floor -> visible Dmax = -log10(floor). */
export const SURFACE_FLOOR: Record<PaperSurface, number> = {
  glossy: Math.pow(10, -2.2),
  pearl: Math.pow(10, -2.05),
  matte: Math.pow(10, -1.62),
}
const WET_FLOOR = Math.pow(10, -2.3)

/** Component curves for VC paper (log H in reference lux·s of 2856 K light). */
export const VC_SOFT_CURVE: Curve = { gamma: 1.32, logH0: -0.34, toe: 0.2, dmax: DMAX_INT, shoulder: 0.22 }
export const VC_HARD_CURVE: Curve = { gamma: 4.3, logH0: 0.22, toe: 0.04, dmax: DMAX_INT, shoulder: 0.06 }
const VC_CAP_SOFT = 0.12

/** Graded paper: gamma per grade (index 0..5) and ISO P speed per grade. Tuned for ISO R 160/130/110/90/70/50. */
export const GRADED_GAMMA = [1.496, 1.841, 2.176, 2.659, 3.419, 4.787]
export const GRADED_ISO_P = [250, 250, 200, 200, 125, 100]
const GRADED_TOE = 0.16
const GRADED_SHOULDER = 0.16

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const TONE_TINT: Record<PaperTone, RGB> = {
  neutral: [0.99, 1.0, 1.01],
  warm: [0.88, 1.0, 1.12],
  cool: [1.03, 1.0, 0.95],
}

function whiteFor(base: PaperBase, tone: PaperTone): RGB {
  if (base === 'fb') return hexToLinear(tone === 'cool' ? '#F3F2EE' : tone === 'warm' ? '#F1EBDC' : '#F3F0E8')
  return hexToLinear(tone === 'warm' ? '#F4F1E8' : '#F5F5F2')
}

/** Reference 'normal' exposure per component for reciprocity thresholds. */
function recipFor(c: Curve): Reciprocity {
  const H06 = Math.pow(10, logHAtDensity(c, 0.6))
  return reciprocityFromTimes(H06, 30, 0.15)
}

export function makePaper(spec: PaperSpec): PaperModel {
  const fb = spec.base === 'fb'
  const common = {
    spec,
    dmaxInt: DMAX_INT,
    capSoft: VC_CAP_SOFT,
    surfaceDry: SURFACE_FLOOR[spec.surface],
    surfaceWet: WET_FLOOR,
    white: whiteFor(spec.base, spec.tone),
    imageTint: TONE_TINT[spec.tone],
    fog: 0.012,
    drydown: fb ? 0.12 : 0.07,
    devRate: fb ? 0.05 : 0.1,
    seedLo: 0.012,
    seedHi: 0.03,
    fixTau: fb ? 30 : 9,
    washTau: fb ? 720 : 30,
    washTauHCA: fb ? 200 : 25,
    fixAbsorb: fb ? 1 : 0.15,
    silverGm2: fb ? 1.8 : 1.2,
  }
  if (spec.kind === 'vc') {
    const soft = { ...VC_SOFT_CURVE }
    const hard = { ...VC_HARD_CURVE }
    if (spec.tone === 'warm') {
      // Warm-tone emulsions are chloride-rich: a little slower and softer.
      soft.logH0 += 0.1
      hard.logH0 += 0.1
    }
    return {
      ...common,
      hard: { spectral: makeSpectral(SENSITIVITY.vcHard), curve: hard, recip: recipFor(hard) },
      soft: { spectral: makeSpectral(SENSITIVITY.vcSoft), curve: soft, recip: recipFor(soft) },
    }
  }
  const g = Math.max(0, Math.min(5, spec.grade ?? 2))
  const gi = Math.floor(g)
  const gf = g - gi
  const lerp = (arr: number[]) => arr[gi] + (arr[Math.min(5, gi + 1)] - arr[gi]) * gf
  const gamma = lerp(GRADED_GAMMA)
  const isoP = lerp(GRADED_ISO_P)
  const curve: Curve = { gamma, logH0: 0, toe: GRADED_TOE, dmax: DMAX_INT, shoulder: GRADED_SHOULDER }
  // Place the curve so that observed net D = 0.6 at H = 1000 / ISO P.
  const target = Math.log10(1000 / isoP)
  const probe = logHAtDensity((x) => observedNet(common.surfaceDry, curveDensityH(curve, Math.pow(10, x))), 0.6)
  curve.logH0 += target - probe
  return { ...common, hard: { spectral: makeSpectral(SENSITIVITY.paperGraded), curve, recip: recipFor(curve) }, soft: null }
}

// ---------------------------------------------------------------------------
// Density combination and observation
// ---------------------------------------------------------------------------

/** Combined intrinsic silver density from the two components (already scaled by development). */
export function combineSilver(model: PaperModel, dSum: number): number {
  return softmin(dSum, model.dmaxInt, model.capSoft)
}

/** Fully developed intrinsic density for component exposures (no fog). */
export function silverDensity(model: PaperModel, Hhard: number, Hsoft: number): number {
  let d = curveDensityH(model.hard.curve, Hhard)
  if (model.soft) d += curveDensityH(model.soft.curve, Hsoft)
  return combineSilver(model, d)
}

/**
 * Observed net reflection density for a neutral intrinsic density, given the
 * surface floor: -log10((1 - s) 10^-D + s). This is what a densitometer reads
 * above paper white.
 */
export function observedNet(surface: number, dInt: number): number {
  return -Math.log10((1 - surface) * Math.pow(10, -dInt) + surface)
}

// ---------------------------------------------------------------------------
// Contrast filters (VC)
// ---------------------------------------------------------------------------

/** Ilford-style filter grades and their nominal ISO R targets. */
export const VC_GRADES = [-1, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const
export const VC_ISO_R_TARGET = [180, 160, 145, 130, 120, 110, 100, 90, 80, 70, 60, 50]

/**
 * Dichroic Y/M settings (CC units) per grade, solved by calibrate.ts so the
 * model hits the ISO R targets with constant exposure for 00..3½ and double
 * exposure for 4..5 (the Ilford Multigrade convention).
 */
export const VC_FILTER_TABLE: { grade: number; y: number; m: number }[] = [
  { grade: -1, y: 152.1, m: 10.9 }, // R 180, ISO P 500
  { grade: 0, y: 110.1, m: 12.3 }, // R 160, ISO P 500
  { grade: 0.5, y: 85.0, m: 13.5 }, // R 145, ISO P 500
  { grade: 1, y: 62.4, m: 15.0 }, // R 130, ISO P 500
  { grade: 1.5, y: 48.0, m: 16.4 }, // R 120, ISO P 500
  { grade: 2, y: 34.1, m: 18.2 }, // R 110, ISO P 500
  { grade: 2.5, y: 20.4, m: 20.7 }, // R 100, ISO P 500
  { grade: 3, y: 13.9, m: 30.9 }, // R 90, ISO P 500
  { grade: 3.5, y: 10.7, m: 45.6 }, // R 80, ISO P 500
  { grade: 4, y: 37.7, m: 92.4 }, // R 70, ISO P 250
  { grade: 4.5, y: 35.2, m: 114.4 }, // R 60, ISO P 250
  { grade: 5, y: 33.3, m: 147.4 }, // R 50, ISO P 250
]

export function gradeLabel(g: number): string {
  return g < 0 ? '00' : g % 1 ? `${Math.floor(g)}½` : String(g)
}

/** Filter transmission for a (fractional) VC grade; interpolates the table. */
export function vcGradeFilter(grade: number): Bands {
  const t = VC_FILTER_TABLE
  if (grade <= t[0].grade) return dichroicFilter(t[0].y, t[0].m)
  for (let i = 1; i < t.length; i++) {
    if (grade <= t[i].grade) {
      const f = (grade - t[i - 1].grade) / (t[i].grade - t[i - 1].grade)
      return dichroicFilter(t[i - 1].y + (t[i].y - t[i - 1].y) * f, t[i - 1].m + (t[i].m - t[i - 1].m) * f)
    }
  }
  const last = t[t.length - 1]
  return dichroicFilter(last.y, last.m)
}

/**
 * Per-lux sensitivities of the two components to a light through a filter:
 * the effective intensity each component sees per lux of the *unfiltered* light.
 */
export function componentGains(model: PaperModel, light: Bands, filter?: Bands): { hard: number; soft: number } {
  return {
    hard: actinic(model.hard.spectral, light, filter),
    soft: model.soft ? actinic(model.soft.spectral, light, filter) : 0,
  }
}

/**
 * Observed (dry) net density vs log10 of *unfiltered* easel exposure (lux·s
 * of `light`) for a filter. Fully developed, no fog. This is the curve the
 * plots show and the ISO numbers are measured on.
 */
export function printCurve(model: PaperModel, filter?: Bands, light: Bands = lightBands('enlarger', 1)): (x: number) => number {
  const g = componentGains(model, light, filter)
  return (x: number) => {
    const H = Math.pow(10, x)
    return observedNet(model.surfaceDry, silverDensity(model, H * g.hard, H * g.soft))
  }
}

export interface PaperMetrics {
  isoR: number
  isoP: number
  /** log10 unfiltered lux·s for net D = 0.6 */
  logH06: number
  dmax: number
}

export function paperMetrics(model: PaperModel, filter?: Bands, light?: Bands): PaperMetrics {
  const f = printCurve(model, filter, light)
  const dmax = f(8)
  return { isoR: isoRange(f, dmax), isoP: isoPaperSpeed(f), logH06: logHAtDensity(f, 0.6), dmax }
}

// ---------------------------------------------------------------------------
// Presets (invented brand from the design docs: Nightjar Photographic)
// ---------------------------------------------------------------------------

export const PAPERS = {
  vcPearl: { id: 'vcPearl', name: 'Nightjar Vari-Grade RC Pearl', kind: 'vc', base: 'rc', surface: 'pearl', tone: 'neutral' },
  vcGlossy: { id: 'vcGlossy', name: 'Nightjar Vari-Grade RC Glossy', kind: 'vc', base: 'rc', surface: 'glossy', tone: 'neutral' },
  vcMatte: { id: 'vcMatte', name: 'Nightjar Vari-Grade RC Matte', kind: 'vc', base: 'rc', surface: 'matte', tone: 'neutral' },
  vcFiber: { id: 'vcFiber', name: 'Nightjar Vari-Grade FB Glossy', kind: 'vc', base: 'fb', surface: 'glossy', tone: 'neutral' },
  warmFiber: { id: 'warmFiber', name: 'Nightjar Warmtone FB', kind: 'vc', base: 'fb', surface: 'pearl', tone: 'warm' },
  bromide: { id: 'bromide', name: 'Nightjar Bromide (graded) RC Glossy', kind: 'graded', grade: 2, base: 'rc', surface: 'glossy', tone: 'cool' },
} satisfies Record<string, PaperSpec>

export type PaperId = keyof typeof PAPERS

export function paper(id: PaperId, grade?: number): PaperModel {
  const spec: PaperSpec = { ...PAPERS[id] }
  if (grade !== undefined) spec.grade = grade
  return makePaper(spec)
}

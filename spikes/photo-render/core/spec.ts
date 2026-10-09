// Camera specification, defaults and the closed-form optics/exposure math.
// Pure TS: no three.js, no DOM. Units are written into every name or comment.
//
// Photometric calibration (shared by every game that uses the photo renderer):
//   * Scene radiance is in cd/m^2 (nits). three.js physical light units line up with this:
//     DirectionalLight.intensity = illuminance in lux, PointLight/SpotLight = candela,
//     HemisphereLight = horizontal illuminance in lux, MeshBasicMaterial colour = cd/m^2.
//     A Lambertian albedo rho under E lux therefore renders as rho*E/pi cd/m^2.
//   * Reflected-light meter: EV100 = log2(L * 100 / K) with K = 12.5.
//     A sunlit 18% grey card (E ~ 70 klx -> L ~ 4000 cd/m^2) reads EV100 ~ 15: sunny-16 holds.
//   * Film-plane exposure (on axis): H = (pi/4) * T * L * t / Nw^2   [lux*s]
//     with T = lens transmittance and Nw = working f-number (bellows factor included).
//   * The latent image is stored in "X" units: X = H / Hm, Hm = q*K/S (ISO 2720, q = 0.65).
//     X = 1 is the exposure a meter-following photographer gives a mid-grey (18%) subject
//     (on axis it reads ~1.09, i.e. +0.12 EV, because q bakes in a little falloff).
//     Multiply X by meta.exposure.hPerUnit to get lux*s for a chemistry model.

export type ShutterType = 'leaf' | 'focal-plane'
/** Direction the slit travels across the upright final print. */
export type CurtainDirection = 'up' | 'down' | 'left' | 'right'

export interface FilmFormat {
  name?: string
  /** gate width, mm */
  width: number
  /** gate height, mm */
  height: number
}

/** Arbitrary drawn aperture (Waterhouse stop). size x size, row-major, top row first, > 0.5 = open. */
export interface ApertureMask {
  size: number
  data: ArrayLike<number>
}

export interface ApertureShape {
  /** 0 (or < 3) = perfectly round iris */
  blades: number
  /** degrees */
  rotation: number
  /** 0 = straight blades (polygon) .. 1 = fully rounded (circle) */
  curvature: number
  mask?: ApertureMask | null
}

export interface LensCharacter {
  /** lens transmittance (0..1); uncoated triplet ~0.80, modern multicoated ~0.92 */
  transmittance: number
  /** mechanical vignetting strength 0..1 (barrel rim clips the pupil off-axis -> cat's-eye bokeh) */
  vignetting: number
  /** weight of the natural cos^4 falloff, 0..1 (1 = physical; retrofocus designs are lower) */
  naturalVignetting: number
  /** Brown-Conrady radial distortion, r normalised to the half-diagonal. k1 < 0 barrel, > 0 pincushion */
  distortionK1: number
  distortionK2: number
  /** lateral colour: red image scale minus blue image scale (e.g. 0.004 = 0.4%) */
  lateralCA: number
  /** longitudinal colour: red focus minus blue focus, in dioptres (1/m) */
  longitudinalCA: number
  /** focus-surface curvature: extra focus error at the frame corner, dioptres (Petzval) */
  fieldCurvature: number
  /** astigmatism 0..1: splits field curvature tangential vs sagittal -> swirly bokeh */
  astigmatism: number
  /** veiling glare: fraction of all image light scattered uniformly (0.003 multicoated .. 0.04 uncoated) */
  veilingGlare: number
  /** internal-reflection ghost strength (0 = none, 1 = uncoated multi-element) */
  ghosts: number
  /** spherical-aberration/scatter halo: fraction of energy in a wide PSF when wide open */
  glow: number
  /** diffraction: Airy softening + blade star spikes on bright points */
  diffraction: boolean
  /** star-spike strength multiplier (1 = nominal) */
  starStrength: number
}

export interface FilmCharacter {
  /** grain clump size in micrometres (fine 100-speed ~ 6, 400-speed ~ 12, 3200 ~ 25) */
  grainSize: number
  /** multiplier on the ISO-derived Selwyn granularity (1 = nominal, 0 = grainless) */
  granularity: number
  /** colour (three dye layers with partly independent grain) or monochrome */
  color: boolean
  /** Schwarzschild exponent for t > 1 s (0.85 typical; 1 = no reciprocity failure) */
  reciprocityP: number
}

export interface CameraSpec {
  format: FilmFormat
  /** mm */
  focalLength: number
  /** marked f-number N */
  fNumber: number
  /** widest f-number of the lens (sets leaf-blade and barrel-rim radius) */
  maxAperture: number
  /** metres from the lens; Infinity allowed */
  focusDistance: number
  /** marked shutter time, seconds */
  shutter: number
  iso: number
  shutterType: ShutterType
  /** focal-plane: time for the slit to cross the gate, seconds (cloth ~0.012-0.018, metal ~0.0036, phone rolling ~0.03) */
  curtainTravel: number
  curtainDirection: CurtainDirection
  /** leaf: blade opening ramp, seconds (~0.001-0.002) */
  leafRamp: number
  aperture: ApertureShape
  lens: LensCharacter
  film: FilmCharacter
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | T[K] : T[K] }

// ---------------------------------------------------------------- constants

/** reflected-light meter calibration constant, cd*s/m^2 (ISO 2720) */
export const METER_K = 12.5
/** ISO 2720 q: on-film exposure H = q * L * t / N^2 */
export const EXPOSURE_Q = 0.65
/** wavelengths used for diffraction, mm */
export const LAMBDA_MM: readonly [number, number, number] = [610e-6, 550e-6, 465e-6]

export const FORMATS: Record<string, FilmFormat> = {
  phone: { name: 'Phone 1/1.3" (9.8x7.4)', width: 9.8, height: 7.4 },
  '1in': { name: '1-inch (13.2x8.8)', width: 13.2, height: 8.8 },
  m43: { name: 'Four Thirds (17.3x13)', width: 17.3, height: 13 },
  apsc: { name: 'APS-C (23.6x15.6)', width: 23.6, height: 15.6 },
  '35mm': { name: '35 mm (36x24)', width: 36, height: 24 },
  '645': { name: '6x4.5 (56x41.5)', width: 56, height: 41.5 },
  '6x6': { name: '6x6 (56x56)', width: 56, height: 56 },
  '6x7': { name: '6x7 (69.5x56)', width: 69.5, height: 56 },
  '4x5': { name: '4x5 in (121x97)', width: 121, height: 97 },
  '8x10': { name: '8x10 in (246x196)', width: 246, height: 196 },
}

export function defaultSpec(): CameraSpec {
  return {
    format: { ...FORMATS['35mm'] },
    focalLength: 50,
    fNumber: 8,
    maxAperture: 2,
    focusDistance: 6,
    shutter: 1 / 250,
    iso: 100,
    shutterType: 'focal-plane',
    curtainTravel: 0.012,
    curtainDirection: 'up',
    leafRamp: 0.0015,
    aperture: { blades: 6, rotation: 0, curvature: 0.25, mask: null },
    lens: {
      transmittance: 0.9,
      vignetting: 0.35,
      naturalVignetting: 1,
      distortionK1: 0,
      distortionK2: 0,
      lateralCA: 0.0015,
      longitudinalCA: 0,
      fieldCurvature: 0,
      astigmatism: 0,
      veilingGlare: 0.006,
      ghosts: 0.25,
      glow: 0.02,
      diffraction: true,
      starStrength: 1,
    },
    film: { grainSize: 9, granularity: 1, color: true, reciprocityP: 0.85 },
  }
}

/** Deep-merge a partial spec over the defaults (or over `base`). Arrays/typed arrays/masks are replaced, not merged. */
export function resolveSpec(partial: DeepPartial<CameraSpec> = {}, base: CameraSpec = defaultSpec()): CameraSpec {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a }
    for (const k of Object.keys(b)) {
      const v = b[k]
      if (v === undefined) continue
      const av = a[k]
      if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && !Array.isArray(v) && av && typeof av === 'object' && k !== 'mask') {
        out[k] = merge(av as Record<string, unknown>, v as Record<string, unknown>)
      } else out[k] = v
    }
    return out
  }
  const s = merge(base as unknown as Record<string, unknown>, partial as Record<string, unknown>) as unknown as CameraSpec
  // sanitise
  s.focalLength = clamp(s.focalLength, 1, 5000)
  s.maxAperture = Math.max(0.5, s.maxAperture)
  s.fNumber = Math.max(s.maxAperture, s.fNumber)
  s.shutter = clamp(s.shutter, 1 / 64000, 3600)
  s.iso = clamp(s.iso, 1, 409600)
  s.curtainTravel = Math.max(0, s.curtainTravel)
  s.leafRamp = Math.max(0, s.leafRamp)
  const minFocus = (2.05 * s.focalLength) / 1000 // 1:1 macro is s = 2f; closer cannot form a real image
  if (!(s.focusDistance > minFocus)) s.focusDistance = minFocus
  s.lens.distortionK1 = clamp(s.lens.distortionK1, -0.45, 0.45)
  s.lens.distortionK2 = clamp(s.lens.distortionK2, -0.3, 0.3)
  s.lens.astigmatism = clamp(s.lens.astigmatism, 0, 0.95)
  s.lens.vignetting = clamp(s.lens.vignetting, 0, 1.5)
  return s
}

// ---------------------------------------------------------------- optics

export interface Optics {
  /** lens-to-film distance, mm (focus breathing / bellows extension) */
  imageDistance: number
  /** lateral magnification v/s (0 at infinity) */
  magnification: number
  /** N * v / f: the f-number the film actually sees (bellows factor) */
  workingFNumber: number
  /** stops lost to bellows extension */
  bellowsStops: number
  /** entrance-pupil diameter f/N, mm */
  apertureDiameter: number
  /** widest pupil radius f/(2 Nmin), mm (leaf blades + barrel rim) */
  maxApertureRadius: number
  /** tan of half field of view at the focused distance */
  tanHalfW: number
  tanHalfH: number
  /** full field of view, degrees */
  fovH: number
  fovV: number
  fovD: number
  /** half-diagonal of the gate, mm */
  halfDiag: number
  /** circle of confusion for this format (diag / 1500), mm */
  coc: number
  /** metres */
  hyperfocal: number
  dofNear: number
  dofFar: number
  /** camera exposure value log2(N^2/t) */
  ev: number
  /** scene EV100 this setting is "correct" for (ev - log2(ISO/100)) */
  ev100: number
  /** Airy-disc radius 1.22 * lambda * Nw at 550 nm, micrometres */
  airyRadiusUm: number
}

export function computeOptics(s: CameraSpec): Optics {
  const f = s.focalLength
  const invS = Number.isFinite(s.focusDistance) ? 1 / (s.focusDistance * 1000) : 0 // 1/mm
  const v = 1 / (1 / f - invS)
  const m = v / f - 1 // = f/(s-f)
  const Nw = s.fNumber * (v / f)
  const halfW = s.format.width / 2
  const halfH = s.format.height / 2
  const halfDiag = Math.hypot(halfW, halfH)
  const tanHalfW = halfW / v
  const tanHalfH = halfH / v
  const deg = 180 / Math.PI
  const coc = (2 * halfDiag) / 1500
  const Hmm = (f * f) / (s.fNumber * coc) + f
  const sMm = Number.isFinite(s.focusDistance) ? s.focusDistance * 1000 : Infinity
  let near: number
  let far: number
  if (!Number.isFinite(sMm)) {
    near = Hmm
    far = Infinity
  } else {
    near = (sMm * (Hmm - f)) / (Hmm + sMm - 2 * f)
    far = sMm < Hmm ? (sMm * (Hmm - f)) / (Hmm - sMm) : Infinity
  }
  const ev = Math.log2((s.fNumber * s.fNumber) / s.shutter)
  return {
    imageDistance: v,
    magnification: m,
    workingFNumber: Nw,
    bellowsStops: 2 * Math.log2(v / f),
    apertureDiameter: f / s.fNumber,
    maxApertureRadius: f / (2 * s.maxAperture),
    tanHalfW,
    tanHalfH,
    fovH: 2 * Math.atan(tanHalfW) * deg,
    fovV: 2 * Math.atan(tanHalfH) * deg,
    fovD: 2 * Math.atan(halfDiag / v) * deg,
    halfDiag,
    coc,
    hyperfocal: Hmm / 1000,
    dofNear: near / 1000,
    dofFar: far / 1000,
    ev,
    ev100: ev - Math.log2(s.iso / 100),
    airyRadiusUm: 1.22 * 0.55 * Nw,
  }
}

/** Diameter of the blur circle on film (mm) for a point at `distance` m, thin lens. */
export function blurCircleMm(s: CameraSpec, distance: number): number {
  const f = s.focalLength
  const A = f / s.fNumber
  const sMm = Number.isFinite(s.focusDistance) ? s.focusDistance * 1000 : Infinity
  const dMm = Number.isFinite(distance) ? distance * 1000 : Infinity
  const v = 1 / (1 / f - (Number.isFinite(sMm) ? 1 / sMm : 0))
  // c = A * |1/d - 1/s| * v   (exact for the thin lens, as an image-plane diameter)
  const invD = Number.isFinite(dMm) ? 1 / dMm : 0
  const invS = Number.isFinite(sMm) ? 1 / sMm : 0
  return A * Math.abs(invD - invS) * v
}

// ---------------------------------------------------------------- exposure

/** Scene EV at ISO 100 for a reflected reading of luminance L (cd/m^2). */
export function luminanceToEV100(L: number): number {
  return Math.log2((Math.max(L, 1e-9) * 100) / METER_K)
}
export function ev100ToLuminance(ev100: number): number {
  return (Math.pow(2, ev100) * METER_K) / 100
}

/** lux*s per latent X unit for this ISO (Hm = q*K/S). */
export function hPerUnit(iso: number): number {
  return (EXPOSURE_Q * METER_K) / iso
}

/** Schwarzschild reciprocity factor applied to exposure: t^(p-1) for t > 1 s. */
export function reciprocityFactor(t: number, p: number): number {
  return t > 1 ? Math.pow(t, p - 1) : 1
}

/**
 * Latent X per cd/m^2 for an exposure that lasted `effectiveTime` seconds (on axis, before cos^4).
 * X = (pi/4) T L t S / (q K Nw^2)
 */
export function xPerNit(s: CameraSpec, o: Optics, effectiveTime: number): number {
  const rec = reciprocityFactor(effectiveTime, s.film.reciprocityP)
  return ((Math.PI / 4) * s.lens.transmittance * effectiveTime * rec * s.iso) / (EXPOSURE_Q * METER_K * o.workingFNumber * o.workingFNumber)
}

/** Shutter time a reflected meter recommends for luminance L at this aperture and ISO. */
export function meteredShutter(s: CameraSpec, L: number): number {
  return (s.fNumber * s.fNumber * METER_K) / (Math.max(L, 1e-9) * s.iso)
}

// ---------------------------------------------------------------- distortion

/** forward radial distortion: undistorted r -> distorted r (both normalised to the half-diagonal) */
export function distortR(ru: number, k1: number, k2: number): number {
  const r2 = ru * ru
  return ru * (1 + k1 * r2 + k2 * r2 * r2)
}
/** inverse radial distortion by Newton iteration */
export function undistortR(rd: number, k1: number, k2: number): number {
  let ru = rd
  for (let i = 0; i < 8; i++) {
    const r2 = ru * ru
    const f = ru * (1 + k1 * r2 + k2 * r2 * r2) - rd
    const fp = 1 + 3 * k1 * r2 + 5 * k2 * r2 * r2
    if (Math.abs(fp) < 1e-6) break
    ru -= f / fp
  }
  return ru
}

// ---------------------------------------------------------------- formatting

const NICE_DENOMS = [8000, 6400, 5000, 4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 640, 500, 400, 320, 250, 200, 160, 125, 100, 80, 60, 50, 40, 30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3]
export function formatShutter(t: number): string {
  if (t >= 0.4) {
    const r = t >= 10 ? Math.round(t) : Math.round(t * 10) / 10
    return `${r}"`
  }
  const d = 1 / t
  let best = NICE_DENOMS[0]
  for (const n of NICE_DENOMS) if (Math.abs(Math.log(n / d)) < Math.abs(Math.log(best / d))) best = n
  return Math.abs(Math.log(best / d)) < 0.05 ? `1/${best}` : `1/${Math.round(d)}`
}
export function formatFNumber(n: number): string {
  return 'f/' + (n < 10 ? (Math.round(n * 10) / 10).toString() : Math.round(n).toString())
}
export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '∞'
  if (m < 1) return `${Math.round(m * 100)} cm`
  if (m < 10) return `${m.toFixed(2)} m`
  if (m < 1000) return `${m.toFixed(1)} m`
  return `${(m / 1000).toFixed(1)} km`
}

export function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x
}

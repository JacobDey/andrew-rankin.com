// Stand-in development: latent X -> negative density (H&D logistic) -> print through a paper curve -> sRGB.
// Pure TS. The real darkroom/chemistry model (spikes/photochem) should consume the latent directly
// (H = X * meta.exposure.hPerUnit lux*s); this module exists so the camera games can show a positive
// without the full chemistry, and so the spike can verify exposure end to end.

export interface FilmCurve {
  name: string
  color: boolean
  /** contrast index of the negative (slope of D vs log10 H in the straight line) */
  gamma: number
  dMin: number
  dMax: number
  /** log10 X at the logistic midpoint (speed point placement) */
  x0: number
}

export interface PaperCurve {
  gamma: number
  dMin: number
  dMax: number
}

export const NEGATIVE_COLOR: FilmCurve = { name: 'Lanternlight 160 (colour neg)', color: true, gamma: 0.62, dMin: 0.15, dMax: 2.4, x0: 0.688 }
export const NEGATIVE_BW: FilmCurve = { name: 'Halcyon 100 (pan B&W)', color: false, gamma: 0.65, dMin: 0.15, dMax: 2.4, x0: 0.688 }
export const PAPER_GRADE2: PaperCurve = { gamma: 1.75, dMin: 0.07, dMax: 2.05 }
export const PAPER_RA4: PaperCurve = { gamma: 2.1, dMin: 0.08, dMax: 2.3 }

/** panchromatic B&W response (more red than photopic luminance) */
export const PAN_WEIGHTS: readonly [number, number, number] = [0.3, 0.59, 0.11]

export function negativeDensity(X: number, f: FilmCurve): number {
  const x = Math.log10(Math.max(X, 1e-9))
  const span = f.dMax - f.dMin
  return f.dMin + span / (1 + Math.exp((-4 * f.gamma * (x - f.x0)) / span))
}

function paperDensity(logE: number, p: PaperCurve, e0: number): number {
  const span = p.dMax - p.dMin
  return p.dMin + span / (1 + Math.exp((-4 * p.gamma * (logE - e0)) / span))
}

export type DevelopMode = 'positive' | 'negative' | 'zones'

export interface DevelopOptions {
  film?: FilmCurve
  paper?: PaperCurve
  /** print exposure correction in stops (+ = darker print). 0 = calibrated so X = 1 prints as 18% grey */
  printStops?: number
  /** force monochrome (pan weights) even for colour latents */
  mono?: boolean
  mode?: DevelopMode
  out?: Uint8ClampedArray
}

const LUT_N = 4096
/** log2 X range covered by print LUTs */
export const LUT_LO = -14
export const LUT_HI = 14

/** Build a 12-bit LUT: log2 X -> 8-bit sRGB print value. */
export function buildPrintLUT(film: FilmCurve, paper: PaperCurve, printStops = 0): Uint8Array {
  // calibrate paper so X = 1 (metered grey) prints at 18% reflectance (density 0.745)
  const dNegGrey = negativeDensity(1, film)
  // solve paperDensity(logE_grey) = 0.745 for e0 with logE_grey = -dNegGrey (print exposure 0)
  const span = paper.dMax - paper.dMin
  const target = -Math.log10(0.18)
  const frac = (target - paper.dMin) / span
  const e0 = -dNegGrey + (Math.log(1 / frac - 1) * span) / (4 * paper.gamma) // logistic inverse
  const shift = printStops * Math.log10(2)
  const lut = new Uint8Array(LUT_N)
  for (let i = 0; i < LUT_N; i++) {
    const l2 = LUT_LO + ((LUT_HI - LUT_LO) * i) / (LUT_N - 1)
    const D = negativeDensity(Math.pow(2, l2), film)
    const Dp = paperDensity(-D + shift, paper, e0)
    lut[i] = Math.round(srgbEncode(Math.pow(10, -Dp)) * 255)
  }
  return lut
}

function lutIndex(X: number): number {
  const l2 = Math.log2(Math.max(X, 1e-12))
  const t = (l2 - LUT_LO) / (LUT_HI - LUT_LO)
  return Math.max(0, Math.min(LUT_N - 1, Math.round(t * (LUT_N - 1))))
}

export function srgbEncode(c: number): number {
  c = c <= 0 ? 0 : c >= 1 ? 1 : c
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** zone colours: one per stop from -6 to +7 around metered grey */
const ZONES: [number, number, number][] = [
  [8, 8, 40], [20, 20, 110], [30, 60, 190], [40, 120, 220], [40, 170, 170], [60, 190, 90], [130, 130, 130],
  [170, 210, 60], [230, 220, 50], [250, 170, 40], [245, 110, 40], [230, 50, 50], [255, 120, 200], [255, 255, 255],
]

/**
 * Develop a latent (RGBA float, X units, top row first) into RGBA8 sRGB pixels for a canvas.
 * ~6 ns/px with the LUT (a 1.5 MP frame takes ~15-30 ms in JS).
 */
export function develop(latent: Float32Array, width: number, height: number, o: DevelopOptions = {}): Uint8ClampedArray {
  const film = o.film ?? NEGATIVE_COLOR
  const paper = o.paper ?? (film.color ? PAPER_RA4 : PAPER_GRADE2)
  const mode = o.mode ?? 'positive'
  const mono = o.mono || !film.color
  const n = width * height
  const out = o.out && o.out.length === n * 4 ? o.out : new Uint8ClampedArray(n * 4)
  if (mode === 'zones') {
    for (let i = 0; i < n; i++) {
      const k = i * 4
      const y = 0.2126 * latent[k] + 0.7152 * latent[k + 1] + 0.0722 * latent[k + 2]
      const z = Math.max(0, Math.min(ZONES.length - 1, Math.floor(Math.log2(Math.max(y, 1e-9)) + 6.5)))
      const c = ZONES[z]
      out[k] = c[0]
      out[k + 1] = c[1]
      out[k + 2] = c[2]
      out[k + 3] = 255
    }
    return out
  }
  if (mode === 'negative') {
    // orange-masked colour negative or grey B&W negative, viewed on a light box
    for (let i = 0; i < n; i++) {
      const k = i * 4
      if (mono) {
        const y = PAN_WEIGHTS[0] * latent[k] + PAN_WEIGHTS[1] * latent[k + 1] + PAN_WEIGHTS[2] * latent[k + 2]
        const v = Math.round(srgbEncode(Math.pow(10, -negativeDensity(y, film))) * 255)
        out[k] = out[k + 1] = out[k + 2] = v
      } else {
        out[k] = Math.round(srgbEncode(0.95 * Math.pow(10, -negativeDensity(latent[k], film))) * 255)
        out[k + 1] = Math.round(srgbEncode(0.55 * Math.pow(10, -negativeDensity(latent[k + 1], film))) * 255)
        out[k + 2] = Math.round(srgbEncode(0.3 * Math.pow(10, -negativeDensity(latent[k + 2], film))) * 255)
      }
      out[k + 3] = 255
    }
    return out
  }
  const lut = buildPrintLUT(film, paper, o.printStops ?? 0)
  for (let i = 0; i < n; i++) {
    const k = i * 4
    if (mono) {
      const y = PAN_WEIGHTS[0] * latent[k] + PAN_WEIGHTS[1] * latent[k + 1] + PAN_WEIGHTS[2] * latent[k + 2]
      out[k] = out[k + 1] = out[k + 2] = lut[lutIndex(y)]
    } else {
      out[k] = lut[lutIndex(latent[k])]
      out[k + 1] = lut[lutIndex(latent[k + 1])]
      out[k + 2] = lut[lutIndex(latent[k + 2])]
    }
    out[k + 3] = 255
  }
  return out
}

// Five-band spectral model: one model for every light and every emulsion.
//
// Fog is not a special case. It is exposure you didn't intend. A light is a
// vector of band irradiances (W/m² per band), an emulsion is a vector of
// relative sensitivities per band, and the actinic ("effective") intensity is
// their dot product, normalised so that 1 lux of the emulsion's reference light
// gives 1 effective lux. Effective exposure H is therefore in "reference
// lux-seconds", the unit paper and film data sheets use (ISO 6846 uses a
// 2856 K tungsten source for paper; ISO 6 uses daylight for film).
//
// Bands (centre wavelength):  UV 365 · Blue 450 · Green 540 · Amber 590 · Red 650
// Amber sits on the sodium D line on purpose: a sodium safelight is one band.

export type Bands = [number, number, number, number, number]

export const UV = 0
export const BLUE = 1
export const GREEN = 2
export const AMBER = 3
export const RED = 4
export const BAND_NAMES = ['UV', 'Blue', 'Green', 'Amber', 'Red'] as const
export const BAND_NM: Bands = [365, 450, 540, 590, 650]

/** CIE 1924 photopic luminous efficiency V(λ) at the band centres. */
export const V_LAMBDA: Bands = [0.00002, 0.038, 0.954, 0.757, 0.107]
const KM = 683 // lm/W

/** Illuminance (lux) of a band-irradiance vector. */
export function luxOf(e: Bands): number {
  let s = 0
  for (let i = 0; i < 5; i++) s += V_LAMBDA[i] * e[i]
  return KM * s
}

/** Planck spectral shape at the band centres, normalised so the max band is 1. */
export function blackbody(kelvin: number): Bands {
  const c2 = 1.4388e-2 // m·K
  const out = BAND_NM.map((nm) => {
    const l = nm * 1e-9
    return 1 / (Math.pow(l, 5) * (Math.exp(c2 / (l * kelvin)) - 1))
  }) as Bands
  const m = Math.max(...out)
  return out.map((v) => v / m) as Bands
}

export function scaleBands(b: Bands, k: number): Bands {
  return [b[0] * k, b[1] * k, b[2] * k, b[3] * k, b[4] * k]
}

export function mulBands(a: Bands, b: Bands): Bands {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3], a[4] * b[4]]
}

export function addBands(a: Bands, b: Bands): Bands {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]]
}

export function dotBands(a: Bands, b: Bands): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4]
}

// ---------------------------------------------------------------------------
// Light sources
// ---------------------------------------------------------------------------

export interface LightSource {
  id: string
  name: string
  /** Relative spectral power per band (W/m² per band, arbitrary scale). */
  shape: Bands
  /** How the source is specified by default: illuminance or UV irradiance. */
  unit: 'lux' | 'uvW'
  /** Default level in `unit` (lux at the bench, or W/m² of UVA at the print). */
  level: number
  /** Display colour (sRGB hex) for UI swatches and safelight tinting. */
  hex: string
  note: string
}

const withUV = (b: Bands, uv: number): Bands => [uv, b[1], b[2], b[3], b[4]]
const bb2856 = blackbody(2856)
const bb3200 = blackbody(3200)
const bb5500 = blackbody(5500)

export const LIGHTS = {
  /** ISO 6846 paper reference: CIE illuminant A (2856 K), glass-filtered UV. */
  tungstenA: { id: 'tungstenA', name: 'Tungsten 2856 K (ISO paper reference)', shape: withUV(bb2856, bb2856[0] * 0.5), unit: 'lux', level: 100, hex: '#FFC58A', note: 'Reference for paper speed (ISO 6846).' },
  enlarger: { id: 'enlarger', name: 'Enlarger halogen 3200 K', shape: withUV(bb3200, bb3200[0] * 0.25), unit: 'lux', level: 1.5, hex: '#FFD9A8', note: 'Easel illuminance at f/8, 8x10 from 35 mm, through clear film base is a few lux.' },
  room: { id: 'room', name: 'Room fluorescent', shape: [0.03, 1.0, 1.0, 0.8, 0.6], unit: 'lux', level: 400, hex: '#F4F7FF', note: 'About 400 lux at the bench. Instant doom for unfixed paper.' },
  roomLED: { id: 'roomLED', name: 'Room LED 4000 K', shape: [0.002, 0.85, 0.75, 0.8, 0.55], unit: 'lux', level: 300, hex: '#FFF4E6', note: 'Blue pump spike, almost no UV.' },
  safelightAmber: { id: 'safelightAmber', name: 'Safelight, amber (OC type)', shape: [0, 0, 0.00003, 1.0, 0.3], unit: 'lux', level: 2.5, hex: '#FF9A3C', note: '15 W bulb behind an amber filter at 1.2 m. Safe for graded paper, a few minutes for VC.' },
  safelightRed: { id: 'safelightRed', name: 'Safelight, red (1A type)', shape: [0, 0, 0.000001, 0.01, 1.0], unit: 'lux', level: 1.2, hex: '#E0301E', note: 'Dimmer to the eye, far safer for paper. Ortho film is also fine.' },
  safelightSodium: { id: 'safelightSodium', name: 'Sodium vapour safelight', shape: [0, 0, 0.000002, 1.0, 0.004], unit: 'lux', level: 5, hex: '#FFB13B', note: 'Nearly monochromatic 589 nm: bright to the eye, tiny actinic dose.' },
  safelightGreen: { id: 'safelightGreen', name: 'Dark green (panchro inspection)', shape: [0, 0.0004, 1.0, 0.002, 0.0001], unit: 'lux', level: 0.05, hex: '#3E7A3A', note: 'For a few seconds of development-by-inspection on panchromatic film.' },
  rubyLantern: { id: 'rubyLantern', name: 'Ruby lantern (oil flame)', shape: [0, 0.000001, 0.00002, 0.04, 1.0], unit: 'lux', level: 0.4, hex: '#B0201A', note: '1870s darkroom. Safe for blue-sensitive plates.' },
  dialLamp: { id: 'dialLamp', name: 'Radio dial lamp (tape peeled)', shape: withUV(bb2856, bb2856[0] * 0.5), unit: 'lux', level: 0.0004, hex: '#FFC58A', note: 'A tiny tungsten bulb across the room. Fogs paper left nearby, very slowly.' },
  uvBox: { id: 'uvBox', name: 'UV box (365 nm BL tubes)', shape: [1.0, 0.06, 0.004, 0.001, 0.001], unit: 'uvW', level: 40, hex: '#8E6BFF', note: 'About 4 mW/cm² of UVA at the glass.' },
  sun: { id: 'sun', name: 'Sun, clear summer noon', shape: withUV(bb5500, 0.54), unit: 'lux', level: 100000, hex: '#FFF8EC', note: '100 klux with about 45 W/m² UVA.' },
} satisfies Record<string, LightSource>

export type LightId = keyof typeof LIGHTS

/**
 * Band irradiance for a light at a given level (in its unit). With no level,
 * the preset's default is used.
 */
export function lightBands(src: LightSource | LightId, level?: number): Bands {
  const s: LightSource = typeof src === 'string' ? LIGHTS[src] : src
  const lv = level ?? s.level
  if (s.unit === 'uvW') return scaleBands(s.shape, lv / s.shape[UV])
  return scaleBands(s.shape, lv / luxOf(s.shape))
}

/**
 * Sun or skylight with clouds. `cloud` is the visible-light transmission
 * (1 = clear, 0.3 = overcast). UV is attenuated less than visible light under
 * cloud (diffuse sky is UV-rich), modelled as cloud^0.6, which is why you can
 * still print a cyanotype, slowly, on a grey day.
 */
export function sunBands(cloud = 1, elevationFactor = 1): Bands {
  const b = lightBands('sun')
  const v = cloud * elevationFactor
  const u = Math.pow(Math.max(cloud, 0), 0.6) * Math.pow(elevationFactor, 1.4)
  return [b[0] * u, b[1] * v, b[2] * v, b[3] * v, b[4] * v]
}

// ---------------------------------------------------------------------------
// Emulsion spectral sensitivities (relative, per W/m² per band)
// ---------------------------------------------------------------------------

export const SENSITIVITY = {
  /** Graded bromide/chlorobromide paper: blue-sensitive only. */
  paperGraded: [0.9, 1.0, 0.015, 0.00003, 1e-7] as Bands,
  /** VC paper, high-contrast component: blue-sensitive. */
  vcHard: [0.9, 1.0, 0.02, 0.00003, 1e-7] as Bands,
  /** VC paper, low-contrast component: green-sensitised, with an amber tail. */
  vcSoft: [0.6, 0.35, 1.0, 0.00026, 2e-7] as Bands,
  /** Panchromatic film. */
  filmPan: [0.5, 1.0, 0.9, 0.85, 0.65] as Bands,
  /** Orthochromatic film: red-blind. */
  filmOrtho: [0.5, 1.0, 0.95, 0.25, 0.0003] as Bands,
  /** Blue-sensitive plates and paper negatives (pre-1880s look). */
  filmBlue: [0.9, 1.0, 0.012, 0.0002, 1e-7] as Bands,
  /** Cyanotype: ferric citrate absorbs UV and deep violet only. */
  cyanotype: [1.0, 0.03, 0, 0, 0] as Bands,
} as const

/**
 * An emulsion's spectral response, normalised against its reference light so
 * that 1 lux of the reference gives 1 effective lux.
 */
export interface Spectral {
  sens: Bands
  /** Multiply the raw dot product by this to get effective lux. */
  norm: number
}

export function makeSpectral(sens: Bands, reference: LightSource | LightId = 'tungstenA'): Spectral {
  const ref = lightBands(reference, 1) // 1 lux of reference
  return { sens, norm: 1 / dotBands(sens, ref) }
}

/** Effective intensity (reference lux) of a light on an emulsion, through an optional filter. */
export function actinic(sp: Spectral, light: Bands, filter?: Bands): number {
  let s = 0
  for (let i = 0; i < 5; i++) s += sp.sens[i] * light[i] * (filter ? filter[i] : 1)
  return s * sp.norm
}

// ---------------------------------------------------------------------------
// Filters (band transmissions)
// ---------------------------------------------------------------------------

/**
 * Dichroic colour-head filtration in CC units (Kodak/Durst style, CC/100 =
 * density). Yellow cuts UV + blue, magenta cuts green (and a little amber),
 * cyan cuts red. Dichroic filters have almost no side absorption.
 */
export function dichroicFilter(yellow: number, magenta: number, cyan = 0): Bands {
  const y = yellow / 100
  const m = magenta / 100
  const c = cyan / 100
  const d: Bands = [1.15 * y + 0.01, y + 0.01, m + 0.02 * y + 0.01, 0.3 * m + 0.01 * y + 0.01, c + 0.01]
  return d.map((x) => Math.pow(10, -x)) as Bands
}

export const OPEN: Bands = [1, 1, 1, 1, 1]

/** Camera filters by name (transmission per band). */
export const CAMERA_FILTERS = {
  none: OPEN,
  yellow8: [0.02, 0.3, 0.9, 0.95, 0.95] as Bands,
  orange21: [0.01, 0.05, 0.55, 0.92, 0.95] as Bands,
  red25: [0.005, 0.005, 0.02, 0.45, 0.92] as Bands,
  green11: [0.02, 0.4, 0.85, 0.35, 0.12] as Bands,
  uvBlock: [0.01, 0.95, 0.96, 0.96, 0.96] as Bands,
} as const

// ---------------------------------------------------------------------------
// RGB scenes -> bands
// ---------------------------------------------------------------------------

/**
 * Linear sRGB (scene colour, scaled so luminance = illuminance in lux) to
 * band irradiance. A coarse but honest spectral upsampling: amber sits between
 * green and red, UV follows blue (daylight-lit surfaces). Good enough to make
 * ortho film render red as black and a red filter darken a blue sky.
 */
export function rgbToBands(rgb: readonly [number, number, number]): Bands {
  const [r, g, b] = rgb
  const n = RGB_NORM
  return [0.45 * b * n[0], b * n[1], g * n[2], (0.5 * r + 0.5 * g) * n[3], r * n[4]]
}
const RGB_NORM: Bands = (() => {
  // Neutral white (1,1,1) maps onto 1 lux of daylight.
  const d = lightBands('sun', 1)
  const raw: Bands = [0.45, 1, 1, 1, 1]
  return d.map((v, i) => v / raw[i]) as Bands
})()

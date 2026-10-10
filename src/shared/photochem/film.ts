// Negative film (and glass plates, and paper negatives): spectral exposure,
// ISO speed, development time/temperature/push/pull, fixing, washing, latent
// image ageing, grain, and what the negative looks like on a light box.
//
// Development follows the same law as paper with a much smaller
// autocatalytic term, so it is close to Sheppard–Nietz first-order kinetics:
//   D_net(H, t) = p(t) * curve(H) + chemical fog,  p(t) ≈ 1 - exp(-k t)
// Gamma therefore rises with time and saturates at gammaInf. Pushing gives a
// little real shadow speed and a lot of contrast, which is the honest truth.

import { type Bands, type LightSource, type Spectral, CAMERA_FILTERS, actinic, lightBands, makeSpectral, rgbToBands, SENSITIVITY } from './bands.ts'
import { type DeveloperBath, type FixerBath, type SilverBath, type WashBath, consumeDeveloper, developerRates, fixerRates, washTauFactor } from './baths.ts'
import { type RGB, hexToLinear, linToByte } from './color.ts'
import { type Curve, curveDensity, curveDensityH, isoFilmSpeed, logHAtDensity } from './curve.ts'
import { type Reciprocity, devStep, devTimeBetween, hashGauss, reciprocityEfficiency, reciprocityFromTimes } from './kinetics.ts'

export interface FilmStockSpec {
  id: string
  name: string
  /** Box speed (ISO arithmetic). */
  iso: number
  sensitivity: keyof typeof SENSITIVITY
  /** Gamma approached at very long development. */
  gammaInf: number
  /** Toe and shoulder softness, density units. */
  toe: number
  shoulder: number
  /** Net Dmax of the emulsion. */
  dmax: number
  /** Base + fog (gross density of clear film after normal processing). */
  baseFog: number
  /** Normal development time (minutes) in MQ-borax stock at 20 °C, intermittent agitation. */
  devMinutes: number
  /** Autocatalytic share of the development law (0 = pure first order). */
  autocat: number
  /** Diffuse RMS granularity x1000 at D = 1, 48 µm aperture (fine 7, fast 17). */
  grain: number
  /** Reciprocity failure starts at tc seconds with Schwarzschild deficit p. */
  recipTc: number
  recipP: number
  /** Gross-overexposure reversal (density lost per decade). */
  solarize: number
  /** Anti-halation dye colour that washes out (sRGB hex) or null. */
  dye: string | null
  /** Base tint (sRGB hex) seen on a light box. */
  base: string
  /** Latent-image half-life at 20 °C, years. */
  latentHalfLifeY: number
}

export const FILM_STOCKS = {
  nj100: {
    id: 'nj100', name: 'Nightjar 100', iso: 100, sensitivity: 'filmPan', gammaInf: 1.4, toe: 0.32, shoulder: 0.5, dmax: 2.6,
    baseFog: 0.24, devMinutes: 7, autocat: 0.15, grain: 9, recipTc: 1, recipP: 0.22, solarize: 0, dye: '#C9A4C8', base: '#E8E6E0', latentHalfLifeY: 40,
  },
  nj400: {
    id: 'nj400', name: 'Nightjar 400', iso: 400, sensitivity: 'filmPan', gammaInf: 1.3, toe: 0.28, shoulder: 0.6, dmax: 2.4,
    baseFog: 0.28, devMinutes: 5.9, autocat: 0.15, grain: 17, recipTc: 1, recipP: 0.27, solarize: 0, dye: '#D7A7C6', base: '#E6E3DA', latentHalfLifeY: 30,
  },
  ortho25: {
    id: 'ortho25', name: 'Nightjar Ortho 25', iso: 25, sensitivity: 'filmOrtho', gammaInf: 1.5, toe: 0.22, shoulder: 0.4, dmax: 2.8,
    baseFog: 0.18, devMinutes: 5, autocat: 0.2, grain: 7, recipTc: 2, recipP: 0.2, solarize: 0, dye: '#B8C8E8', base: '#ECECE6', latentHalfLifeY: 50,
  },
  varrow400: {
    id: 'varrow400', name: 'Varrow Pan 400', iso: 400, sensitivity: 'filmPan', gammaInf: 1.3, toe: 0.3, shoulder: 0.6, dmax: 2.4,
    baseFog: 0.3, devMinutes: 8, autocat: 0.15, grain: 18, recipTc: 1, recipP: 0.28, solarize: 0, dye: '#D2A6C8', base: '#E4E1D6', latentHalfLifeY: 30,
  },
  dryPlate: {
    id: 'dryPlate', name: 'Gelatin dry plate (1880s)', iso: 8, sensitivity: 'filmBlue', gammaInf: 1.7, toe: 0.4, shoulder: 0.5, dmax: 3.0,
    baseFog: 0.1, devMinutes: 3.2, autocat: 0.35, grain: 12, recipTc: 4, recipP: 0.18, solarize: 0.9, dye: null, base: '#E9ECE6', latentHalfLifeY: 15,
  },
} satisfies Record<string, FilmStockSpec>

export type FilmStockId = keyof typeof FILM_STOCKS

export interface FilmModel {
  spec: FilmStockSpec
  spectral: Spectral
  curve: Curve
  recip: Reciprocity
  /** Development progress reached at normal development (ISO contrast index condition). */
  pNormal: number
  /** Rate constant so that normal development in the reference developer reaches pNormal. */
  k: number
  /** Speed-point exposure Hm = 0.8 / ISO (lux·s). */
  Hm: number
  /** Linear-RGB weights: effective lux per unit of film-plane linear RGB (lux-scaled), per filter. */
  rgbWeights: (filter?: Bands) => RGB
}

const DAYLIGHT: LightSource = { id: 'daylight', name: 'Daylight', shape: lightBands('sun', 1), unit: 'lux', level: 1, hex: '#FFFFFF', note: '' }

/**
 * Build a film model: place the curve so the ISO 6 speed point lands on
 * 0.8/ISO at the development that meets the ISO contrast condition (ΔD 0.80
 * over 1.3 log H), then set the rate constant so the stock's normal time in
 * the reference developer reaches exactly that development.
 */
export function makeFilm(specOrId: FilmStockSpec | FilmStockId): FilmModel {
  const spec: FilmStockSpec = typeof specOrId === 'string' ? FILM_STOCKS[specOrId] : specOrId
  const curve: Curve = { gamma: spec.gammaInf, logH0: 0, toe: spec.toe, dmax: spec.dmax, shoulder: spec.shoulder }
  if (spec.solarize) {
    curve.solarize = spec.solarize
  }
  const Hm = 0.8 / spec.iso
  const logHm = Math.log10(Hm)
  // For a trial p, shift the curve so p * curve(logHm) = 0.1; return ΔD over 1.3 log H.
  const place = (p: number) => {
    const xAt = logHAtDensity({ ...curve, logH0: 0 }, 0.1 / p)
    const shift = logHm - xAt
    return { shift, dD: p * curveDensity({ ...curve, logH0: shift }, logHm + 1.3) - 0.1 }
  }
  let lo = 0.2
  let hi = 1
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi)
    if (place(mid).dD < 0.8) lo = mid
    else hi = mid
  }
  const pNormal = Math.min(0.98, 0.5 * (lo + hi))
  curve.logH0 = place(pNormal).shift
  if (spec.solarize) curve.solarizeAt = curve.logH0 + (spec.dmax / spec.gammaInf) + 1.2
  const a = 1
  const b = spec.autocat
  const k = devTimeBetween(0, pNormal, 1, a, b) / (spec.devMinutes * 60)
  const spectral = makeSpectral(SENSITIVITY[spec.sensitivity], DAYLIGHT)
  const recip = reciprocityFromTimes(Hm * 10, spec.recipTc, spec.recipP, 1e-4, 0.3)
  const rgbWeights = (filter?: Bands): RGB => {
    const w = [0, 1, 2].map((ch) => {
      const rgb: RGB = [0, 0, 0]
      rgb[ch] = 1
      return actinic(spectral, rgbToBands(rgb), filter)
    })
    return w as RGB
  }
  return { spec, spectral, curve, recip, pNormal, k, Hm, rgbWeights }
}


/** Fully developed net density at normal development for exposure H. */
export function filmDensityNormal(m: FilmModel, H: number): number {
  return m.pNormal * curveDensityH(m.curve, H)
}

/**
 * Development progress for t seconds in a developer with relative film rate
 * `rate` (developerRates(b).film x agitation factor).
 */
export function filmProgress(m: FilmModel, rate: number, seconds: number): number {
  return devStep(0, m.k * rate, 1, m.spec.autocat, seconds)
}

/** Agitation factor for tank development: 0 stand, 0.5 intermittent (reference), 1 continuous. */
export function agitationFactor(agitation: number): number {
  return 0.8 + 0.4 * Math.max(0, Math.min(1, agitation))
}

/**
 * Time (minutes) to develop for a given push (+) or pull (-) in stops, so a
 * mid-grey metered at EI = ISO x 2^stops lands at the same density as at box
 * speed with normal development. Reports the honest shadow speed, too.
 */
export function pushPull(m: FilmModel, stops: number, bath?: DeveloperBath, agitation = 0.5, anchorStops = 6): { minutes: number; gamma: number; shadowEI: number; possible: boolean } {
  const rate = (bath ? developerRates(bath).film : 1) * agitationFactor(agitation)
  // Anchor: a tone `anchorStops` above the speed point (≈ zone VII for 6) should print where it would have.
  const Hmid = m.Hm * Math.pow(2, anchorStops)
  const target = m.pNormal * curveDensityH(m.curve, Hmid)
  const Hpushed = Hmid / Math.pow(2, stops)
  const dInf = curveDensityH(m.curve, Hpushed)
  const pNeed = target / dInf
  const possible = pNeed < 0.985
  const pUse = Math.min(0.985, pNeed)
  const seconds = devTimeBetween(0, pUse, m.k * rate, 1, m.spec.autocat)
  const f = (x: number) => pUse * curveDensity(m.curve, x)
  const sp = isoFilmSpeed(f)
  return { minutes: seconds / 60, gamma: pUse * m.curve.gamma, shadowEI: sp.speed, possible }
}

// ---------------------------------------------------------------------------
// Per-pixel frame
// ---------------------------------------------------------------------------

export const FILM_FIELDS = ['H', 'p', 'cf', 'x', 'r', 'dye', 'stain', 'c'] as const
export type FilmField = (typeof FILM_FIELDS)[number]

export interface FilmProcessOpts {
  /** 0 stand .. 0.5 intermittent .. 1 continuous. */
  agitation?: number
  /** Per-pixel liquid contact (a half-filled tank, a bubble). */
  contact?: ArrayLike<number> | null
}

export class FilmFrame {
  readonly model: FilmModel
  readonly w: number
  readonly h: number
  readonly n: number
  readonly f: Record<FilmField, Float32Array>
  /** Uniform fog exposure from age, radiation and heat (effective lux·s). */
  fogH = 0
  /** Latent-image retention multiplier from ageing. */
  latentKeep = 1
  /** Film format width in mm (35 mm frame = 36). Sets grain scale. */
  formatMM: number
  lastDevRate = 0
  readonly times: Record<string, number> = {}

  constructor(model: FilmModel | FilmStockId, w: number, h: number, formatMM = 36) {
    this.model = typeof model === 'string' ? makeFilm(model) : model
    this.w = w
    this.h = h
    this.n = w * h
    this.formatMM = formatMM
    const f = {} as Record<FilmField, Float32Array>
    for (const k of FILM_FIELDS) f[k] = new Float32Array(this.n)
    f.x.fill(1)
    f.dye.fill(this.model.spec.dye ? 1 : 0)
    this.f = f
  }

  /**
   * Camera exposure from a linear-RGB film-plane image (3 floats per pixel,
   * scaled so luminance is illuminance in lux) for `seconds`, through an
   * optional camera filter. Reciprocity per pixel.
   */
  exposeRGB(rgb: ArrayLike<number>, seconds: number, filter?: Bands): void {
    const wts = this.model.rgbWeights(filter)
    this.exposures++
    const { H, x } = this.f
    const rc = this.model.recip
    for (let i = 0; i < this.n; i++) {
      const I = wts[0] * rgb[3 * i] + wts[1] * rgb[3 * i + 1] + wts[2] * rgb[3 * i + 2]
      if (I > 0) H[i] += I * reciprocityEfficiency(rc, I) * seconds * x[i]
    }
  }

  /** Expose to a light (fog, light leak, safelight) with an optional per-pixel mask. */
  expose(light: Bands, seconds: number, opts: { mask?: ArrayLike<number> | null; filter?: Bands } = {}): void {
    const I0 = actinic(this.model.spectral, light, opts.filter)
    this.exposures++
    const { H, x } = this.f
    const rc = this.model.recip
    const mask = opts.mask ?? null
    for (let i = 0; i < this.n; i++) {
      const I = I0 * (mask ? mask[i] : 1)
      if (I > 0) H[i] += I * reciprocityEfficiency(rc, I) * seconds * x[i]
    }
  }

  /**
   * Age an undeveloped (latent) frame: the latent image regresses (half-life
   * doubles per 10 °C colder) while background radiation and heat build
   * uniform fog. Radiation fog in speed-point units grows with ISO, which is
   * why fast film goes off first.
   */
  ageLatent(years: number, tempC = 20): void {
    const s = this.model.spec
    const half = s.latentHalfLifeY * Math.pow(2, (20 - tempC) / 10)
    this.latentKeep *= Math.pow(0.5, years / half)
    const radiation = 0.02 * (s.iso / 100) * years
    const thermal = 0.01 * (s.iso / 100) * years * Math.pow(2, (tempC - 20) / 10)
    this.fogH += this.model.Hm * (radiation + thermal)
  }

  process(bath: SilverBath, dt: number, opts: FilmProcessOpts = {}): void {
    if (dt <= 0) return
    this.times[bath.kind] = (this.times[bath.kind] ?? 0) + dt
    const { p, cf, x, r, dye, stain, c } = this.f
    const contact = opts.contact ?? null
    const m = this.model
    if (bath.kind === 'developer') {
      const rates = developerRates(bath)
      const R = rates.film * agitationFactor(opts.agitation ?? 0.5) * m.k
      this.lastDevRate = R
      const stainF = DEV_STAIN[bath.formula] ?? 0
      const dinf = this.dInf()
      let dsum = 0
      for (let i = 0; i < this.n; i++) {
        const cc = contact ? contact[i] : 1
        c[i] = cc
        if (cc <= 0) continue
        const p0 = p[i]
        const p1 = devStep(p0, R * cc, 1, m.spec.autocat, dt)
        p[i] = p1
        cf[i] += rates.fog * 0.6 * cc * dt
        const dD = (p1 - p0) * dinf[i]
        dsum += dD
        if (stainF) stain[i] += stainF * dD
        dye[i] *= Math.exp((-dt * cc) / 90)
      }
      // ~ 7 g/m² of halide on fast film, half of it developable at full density.
      consumeDeveloper(bath, (dsum / this.n / m.spec.dmax) * 3.5 * this.areaM2())
      return
    }
    if (bath.kind === 'fixer') {
      const rr = fixerRates(bath as FixerBath)
      const k = rr.rate / 10
      let removed = 0
      for (let i = 0; i < this.n; i++) {
        const cc = contact ? contact[i] : 1
        if (cc <= 0) continue
        const x0 = x[i]
        x[i] = x0 * Math.exp(-k * cc * dt)
        removed += x0 - x[i]
        r[i] += (1 - r[i]) * (1 - Math.exp(-dt / 15))
        dye[i] *= Math.exp((-dt * cc) / 60)
        c[i] *= Math.exp(-dt / 3)
      }
      ;(bath as FixerBath).silverG += (removed / this.n) * 6 * this.areaM2()
      return
    }
    if (bath.kind === 'wash') {
      const tau = 60 * washTauFactor(bath as WashBath)
      for (let i = 0; i < this.n; i++) {
        r[i] *= Math.exp(-dt / tau)
        dye[i] *= Math.exp(-dt / 45)
        c[i] *= Math.exp(-dt / 3)
      }
      return
    }
    if (bath.kind === 'stop' || bath.kind === 'air' || bath.kind === 'hca') {
      const tauC = bath.kind === 'stop' ? 3 : 20
      for (let i = 0; i < this.n; i++) {
        const c0 = c[i]
        if (c0 <= 1e-4) continue
        const c1 = c0 * Math.exp(-dt / tauC)
        const cm = (c0 * tauC * (1 - Math.exp(-dt / tauC))) / dt
        p[i] = devStep(p[i], this.lastDevRate * cm, 1, m.spec.autocat, dt)
        c[i] = c1
      }
    }
  }

  private areaM2(): number {
    return (this.formatMM / 1000) * ((this.formatMM * this.h) / this.w / 1000)
  }

  private dinfCache: Float32Array | null = null
  private dinfKey = ''
  /** Counts exposure calls (invalidates the D-infinity cache). */
  private exposures = 0

  /** Cached fully developed net density per pixel (H does not change during development). */
  dInf(): Float32Array {
    const key = this.latentKeep + ':' + this.fogH + ':' + this.exposures
    if (this.dinfCache && this.dinfKey === key) return this.dinfCache
    const d = this.dinfCache ?? new Float32Array(this.n)
    for (let i = 0; i < this.n; i++) d[i] = curveDensityH(this.model.curve, this.H(i))
    this.dinfCache = d
    this.dinfKey = key
    return d
  }

  /** Effective exposure at i including ageing fog and latent regression. */
  H(i: number): number {
    return this.f.H[i] * this.latentKeep + this.fogH
  }

  /** Gross transmission density at pixel i (base + fog + image + stain), no grain. */
  density(i: number): number {
    return this.model.spec.baseFog + this.f.p[i] * this.dInf()[i] + this.f.cf[i] + this.f.stain[i] * 0.3
  }

  /**
   * Gross densities for every pixel, with film-space grain: RMS granularity
   * σ(D) = grain/1000 · sqrt(D_net) · (48 µm / pixel size) · (p / pNormal)^0.7.
   * Two octaves of deterministic noise anchored to pixel coordinates, so grain
   * never swims and enlarging scales it like a real enlarger.
   */
  densities(out = new Float32Array(this.n), grain = true, seed = 1): Float32Array {
    const m = this.model
    const pixelUm = (this.formatMM * 1000) / this.w
    const sigma0 = grain ? (m.spec.grain / 1000) * (48 / pixelUm) : 0
    for (let i = 0; i < this.n; i++) {
      const D = this.density(i)
      if (sigma0 > 0) {
        const net = Math.max(0.02, D - m.spec.baseFog)
        const pf = Math.pow(Math.max(0.05, this.f.p[i] / m.pNormal), 0.7)
        const xx = i % this.w
        const yy = (i / this.w) | 0
        const g = 0.8 * hashGauss(xx, yy, seed) + 0.6 * hashGauss(xx >> 1, yy >> 1, seed + 7)
        out[i] = Math.max(0, D + sigma0 * Math.sqrt(net) * pf * g)
      } else out[i] = D
    }
    return out
  }

  /**
   * Light-box rendering: transmission 10^-D tinted by base, remaining
   * anti-halation dye (pink until washed), pyro/coffee stain, and the milky
   * cream haze of unfixed halide.
   */
  render(out: Uint8ClampedArray, opts: { grain?: boolean; seed?: number; lightbox?: RGB } = {}): void {
    const dens = this.densities(undefined, opts.grain ?? true, opts.seed ?? 1)
    const s = this.model.spec
    const base = hexToLinear(s.base)
    const dyeC = s.dye ? hexToLinear(s.dye) : ([1, 1, 1] as RGB)
    const lb = opts.lightbox ?? [1, 0.98, 0.94]
    const { dye, x, stain } = this.f
    for (let i = 0; i < this.n; i++) {
      const T = Math.pow(10, -(dens[i] - s.baseFog))
      const dy = dye[i]
      const milky = x[i]
      const st = stain[i]
      const o = i * 4
      for (let k = 0; k < 3; k++) {
        const stainT = Math.pow(10, -st * STAIN_RGB[k])
        let v = T * base[k] * (1 - dy * (1 - dyeC[k]) * 0.8) * stainT
        v = v * (1 - 0.55 * milky) + 0.3 * milky * [0.92, 0.88, 0.76][k]
        out[o + k] = linToByte(v * lb[k])
      }
      out[o + 3] = 255
    }
  }

  /**
   * Per-pixel enlarger transmission for printing: 10^-(base + Q (D - base))
   * where Q is the Callier factor (1.0 diffusion head, ~1.3 condenser).
   */
  printMask(out = new Float32Array(this.n), callierQ = 1, grain = true, seed = 1): Float32Array {
    const d = this.densities(out, grain, seed)
    const b = this.model.spec.baseFog
    for (let i = 0; i < this.n; i++) d[i] = Math.pow(10, -(b + callierQ * (d[i] - b)))
    return d
  }
}

const DEV_STAIN: Partial<Record<string, number>> = { pyro: 0.35, caffenol: 0.08 }
const STAIN_RGB: RGB = [0.08, 0.2, 0.6]

/** Convenience: camera filters re-exported for film users. */
export const FILTERS = CAMERA_FILTERS

// Classic cyanotype (Herschel 1842): Part A ferric ammonium citrate 25% w/v,
// Part B potassium ferricyanide 10% w/v, mixed 1:1.
//
// Stoichiometry is the whole model. Per unit of standard coat:
//   Fe(III) citrate      fe3 = 2.2   (25 g FAC at ~15% Fe ≈ 0.067 mol per 100 mL)
//   ferricyanide         fcy = 1.0   (10 g / 329 g/mol ≈ 0.030 mol per 100 mL)
//
// UV photoreduces Fe(III) citrate to Fe(II). Fe(II) meets ferricyanide and
// precipitates insoluble Prussian blue right there, which is why the image
// "prints out" while you watch. The classic recipe is ferricyanide-limited:
// once ~45% of the iron is reduced, ferricyanide runs out and the *excess*
// Fe(II) reduces Prussian blue to Prussian white (Everitt's salt). That is the
// grey-olive "bronzing" of deep shadows, and in the wash some of that reduced
// pigment dissolves before it re-oxidises: the solarisation-like reversal of
// an overexposed cyanotype. Nothing here is special-cased; it falls out of
// the two reactions:
//
//   UV:     d fe2 = Φ I f_abs(fe3) dt                     (photon-limited, self-masking)
//   fast:   fe2 + fcy -> pb                               (Prussian blue, insoluble)
//   fast:   fe2 + pb  -> pw                               (Prussian white: bronze, partly soluble)
//
// Wet chemistry afterwards is a bath with a pH, an oxidiser and a tannin level:
//   wash:   soluble fe3, fcy, fe2 leave (yellow plumes), tau ≈ 50 s
//   oxid.:  pb deepens (ox -> 1) in hours in air, instantly with H2O2
//   pw:     re-oxidises to pb; a fraction dissolves away (less with peroxide/acid)
//   alkali: pb -> Fe(OH)3 (bleach, washing soda), rate ∝ (pH - 7.5)^3
//   tannin: Fe(OH)3 + tannin -> iron tannate (brown); alkali darkens it (black);
//           tannin on remaining pb shifts it toward aubergine; tea stains the paper
//
// Reciprocity: photoreduction of ferric citrate is a one-photon process, so
// cyanotype obeys reciprocity (no failure term). Clouds just slow it down.

import { type Bands, SENSITIVITY } from './bands.ts'
import { type RGB, hexToLinear, linToByte } from './color.ts'
import { clamp01 } from './kinetics.ts'
import { POW10NEG } from './fast.ts'
import { box2, sheetMetrics, upsample2ToRGBA8 } from './grid.ts'
import { packFields, unpackFields } from './snapshot.ts'

export const CYANO_FIELDS = [
  'fe3', // ferric citrate (yellow-green sensitizer)
  'fcy', // ferricyanide (yellow)
  'fe2', // free ferrous iron (colourless, transient)
  'pb', // Prussian blue
  'ox', // oxidation completeness of pb 0..1 (slate -> deep blue)
  'pw', // Prussian white (reduced pb; bronzing)
  'wet', // coating moisture 0..1
  'feoh', // ferric hydroxide from alkaline bleaching (pale straw)
  'tan', // iron tannate (brown)
  'blk', // alkaline darkening of iron tannate 0..1 (brown -> black)
  'pbt', // tannin association with pb 0..1 (aubergine)
  'tea', // tannin soaked into the paper (beige base stain)
  'ystain', // yellow ferric stain in highlights (non-acid wash)
  'dose', // integrated UV dose (W·s/m²), for the logbook and peeking
] as const
export type CyanoField = (typeof CYANO_FIELDS)[number]

/** One standard coat: about 2 mL of mixed sensitizer per 8x10 (≈ 40 mL/m²). */
export const COAT = { fe3: 2.2, fcy: 1.0 }

// UV absorbance (base 10) per unit of each species: the sensitizer screens itself
// and the Prussian blue already formed screens what lies below (long tonal scale).
const A_FE3 = 0.35
const A_FCY = 0.1
const A_PB = 0.25
const A_PW = 0.15
/** Quantum-yield constant, tuned so 40 W/m² UVA solidly prints a clear area in ~12 min. */
export const PHI = 4.6e-5

// Colorants: linear-RGB channel densities per unit amount.
const C_FE3: RGB = [0.03, 0.025, 0.2]
const C_FCY: RGB = [0.02, 0.05, 0.28]
const C_PB_FRESH: RGB = [1.3, 0.95, 0.66] // slate grey-blue, as printed out
const C_PB_DEEP: RGB = [2.6, 1.5, 0.95] // Prussian blue, #003153-ish at full strength on rag
const C_PB_AUB: RGB = [1.75, 1.95, 1.3] // tannin-shifted aubergine
const C_PW: RGB = [0.55, 0.62, 0.82] // bronze / grey-olive
const C_FEOH: RGB = [0.05, 0.12, 0.35] // pale straw
const C_TAN_BROWN: RGB = [0.95, 1.15, 1.45]
const C_TAN_BLACK: RGB = [1.65, 1.62, 1.55]
const C_TEA: RGB = [0.03, 0.07, 0.17]
const C_YSTAIN: RGB = [0.02, 0.06, 0.25]

export interface CyanoBath {
  kind: 'cyanoBath'
  name: string
  pH: number
  /** Hydrogen peroxide strength: 1 = a capful of 3% per litre. */
  h2o2: number
  /** Tannin: 1 = strong black tea. */
  tannin: number
  /** 0 still tray .. 1 running water. */
  flow: number
  tempC: number
}

export const CYANO_BATHS = {
  water: { kind: 'cyanoBath', name: 'Running water', pH: 7, h2o2: 0, tannin: 0, flow: 1, tempC: 20 },
  hardTap: { kind: 'cyanoBath', name: 'Hard tap water', pH: 8.2, h2o2: 0, tannin: 0, flow: 1, tempC: 20 },
  vinegar: { kind: 'cyanoBath', name: 'Water + a splash of vinegar', pH: 3.6, h2o2: 0, tannin: 0, flow: 0.4, tempC: 20 },
  citric: { kind: 'cyanoBath', name: 'Citric acid 1%', pH: 3, h2o2: 0, tannin: 0, flow: 0.4, tempC: 20 },
  peroxide: { kind: 'cyanoBath', name: 'Hydrogen peroxide (capful 3%/L)', pH: 6.5, h2o2: 1, tannin: 0, flow: 0.3, tempC: 20 },
  soda: { kind: 'cyanoBath', name: 'Washing soda 1%', pH: 11, h2o2: 0, tannin: 0, flow: 0.2, tempC: 20 },
  tea: { kind: 'cyanoBath', name: 'Strong black tea', pH: 5, h2o2: 0, tannin: 1, flow: 0.2, tempC: 30 },
  coffee: { kind: 'cyanoBath', name: 'Instant coffee', pH: 5.2, h2o2: 0, tannin: 0.55, flow: 0.2, tempC: 30 },
} satisfies Record<string, CyanoBath>

export type CyanoBathId = keyof typeof CYANO_BATHS

/** UV-equivalent irradiance (W/m²) of a band-irradiance light on the sensitizer. */
export function cyanoActinic(light: Bands): number {
  const s = SENSITIVITY.cyanotype
  return s[0] * light[0] + s[1] * light[1] + s[2] * light[2] + s[3] * light[3] + s[4] * light[4]
}

export interface CyanoOpts {
  /** 0.5 runs the chemistry fields at half resolution and upsamples in render(). */
  simScale?: 1 | 0.5
}

export interface CyanoProcessOpts {
  /** Per-pixel liquid contact 0..1 from the tray simulation (output or simulation resolution). */
  contact?: ArrayLike<number> | null
  /** Per-pixel local hydrogen-peroxide strength (same scale as CyanoBath.h2o2), added to the bath's own. Lets a peroxide drop spread from the tray's scalar field. */
  h2o2?: ArrayLike<number> | null
}

export interface CyanoStats {
  sensitizer: number
  blue: number
  bronze: number
  oxidised: number
  tannate: number
  /** Mean visual density relative to a perfect white (whole sheet, sampled). */
  meanD: number
  dmax: number
  /** Mean density in the outer 4% border (uncoated margin). */
  borderD: number
  /** Fraction of the sheet carrying sensitizer or image. */
  coverage: number
  /** Mean local standard deviation of density (streaks and mottling). */
  evenness: number
}

/**
 * Darkroom §5.8 beaker rules: mixing Part A (ferric ammonium citrate) and Part B
 * (potassium ferricyanide) in any proportion. `speed` and `dmax` are the per-paper
 * scalars; `beakerHex` is the liquid colour (A #9DB83A to B #E09A2C, passing through
 * the GDD's pond-water olive #C2BE48 at 1:1).
 */
export function mixSensitizer(mlA: number, mlB: number): { ratio: number; ratioAB: number; speed: number; dmax: number; beakerHex: string } {
  const a = Math.max(0, mlA)
  const b = Math.max(0, mlB)
  const ratio = a + b > 0 ? a / (a + b) : 0.5
  const speed = 0.6 + 0.8 * ratio
  const dmax = Math.min(1, Math.max(0.3, 1 - 2.5 * Math.abs(ratio - 0.5)))
  const A = [0x9d, 0xb8, 0x3a]
  const M = [0xc2, 0xbe, 0x48]
  const B = [0xe0, 0x9a, 0x2c]
  const t = 1 - ratio
  const [p, q, u] = t < 0.5 ? [A, M, t * 2] : [M, B, (t - 0.5) * 2]
  const hx = (k: number) => Math.round(p[k] + (q[k] - p[k]) * u).toString(16).padStart(2, '0')
  const ratioAB = b > 0 ? a / b : a > 0 ? 1e6 : 1
  return { ratio, ratioAB, speed, dmax, beakerHex: '#' + hx(0) + hx(1) + hx(2) }
}

/**
 * Water blended toward the peroxide bath by a local concentration 0..1 (for example
 * read from the tray's peroxide scalar field). At 0 it is running water, at 1 the
 * capful-per-litre bath of CYANO_BATHS.peroxide. The rates in CyanoSheet.process are
 * additive in `h2o2`, so any blend is smooth.
 */
export function peroxideBath(local: number): CyanoBath {
  const c = local < 0 ? 0 : local
  const k = c > 1 ? 1 : c
  const w = CYANO_BATHS.water
  const p = CYANO_BATHS.peroxide
  return {
    kind: 'cyanoBath', name: 'Water + peroxide', pH: w.pH + (p.pH - w.pH) * k, h2o2: c, tannin: 0, flow: w.flow + (p.flow - w.flow) * k, tempC: 20,
  }
}

export interface CoatOpts {
  /** Part A : Part B volume ratio (1 = classic 1:1). */
  ratioAB?: number
  /** Hours since A and B were mixed: the working solution slowly fogs (pre-formed blue). */
  sensitizerAgeH?: number
}

export class CyanoSheet {
  /** Output (render) resolution. */
  readonly w: number
  readonly h: number
  /** Simulation resolution (= w x h unless simScale is 0.5). Fields in `f` have sw*sh entries. */
  readonly sw: number
  readonly sh: number
  readonly n: number
  readonly simScale: 1 | 0.5
  readonly f: Record<CyanoField, Float32Array>
  /** Paper white (rag, linear RGB) and first-surface floor (matte). */
  white: RGB = hexToLinear('#F3EFE4')
  surface = Math.pow(10, -1.9)
  readonly times: Record<string, number> = {}
  /** Bumped by every call that changes the sheet. */
  version = 0

  private fitA: Float32Array | null = null
  private fitB: Float32Array | null = null
  private lin: Float32Array

  constructor(w: number, h: number, opts: CyanoOpts = {}) {
    this.w = w
    this.h = h
    this.simScale = opts.simScale === 0.5 ? 0.5 : 1
    this.sw = this.simScale === 1 ? w : Math.max(1, Math.ceil(w / 2))
    this.sh = this.simScale === 1 ? h : Math.max(1, Math.ceil(h / 2))
    this.n = this.sw * this.sh
    const f = {} as Record<CyanoField, Float32Array>
    for (const k of CYANO_FIELDS) f[k] = new Float32Array(this.n)
    this.f = f
    this.lin = new Float32Array(this.n * 4)
  }

  private fit(src: ArrayLike<number> | null | undefined, slot: 0 | 1): ArrayLike<number> | null {
    if (!src) return null
    if (this.simScale === 1 || src.length === this.n) return src
    const buf = slot === 0 ? (this.fitA ??= new Float32Array(this.n)) : (this.fitB ??= new Float32Array(this.n))
    box2(src, this.w, this.h, this.sw, this.sh, buf)
    return buf
  }

  private simIndex(i: number): number {
    if (this.simScale === 1) return i
    return (((i / this.w) | 0) >> 1) * this.sw + ((i % this.w) >> 1)
  }

  /**
   * Brush or rod on sensitizer. `amount` is in standard coats (scalar, or per
   * pixel to carry brush streaks and pooled edges). Coats add up.
   */
  coat(amount: number | ArrayLike<number>, opts: CoatOpts = {}): void {
    const ab = opts.ratioAB ?? 1
    const kA = (2 * ab) / (1 + ab)
    const kB = 2 / (1 + ab)
    const pre = Math.min(0.3, 0.012 * (opts.sensitizerAgeH ?? 0))
    const { fe3, fcy, pb, wet, ox } = this.f
    const arr = typeof amount === 'number' ? null : this.fit(amount, 0)
    this.version++
    for (let i = 0; i < this.n; i++) {
      const a = arr ? arr[i] : (amount as number)
      if (!(a > 0)) continue
      fe3[i] += COAT.fe3 * kA * a * (1 - pre)
      fcy[i] += COAT.fcy * kB * a * (1 - pre)
      pb[i] += COAT.fcy * kB * a * pre * 0.5
      if (ox[i] < 0.3) ox[i] = 0.3
      const wv = wet[i] + a
      wet[i] = wv < 1.5 ? wv : 1.5
    }
  }

  /** Drying in the dark: ~20 min in still air at 50% RH; a hair dryer is ~6x faster. */
  dry(dt: number, airflow = 0, rh = 50): void {
    const tau = (1200 * Math.max(0.2, rh / 50)) / (1 + 6 * airflow)
    const k = Math.exp(-dt / tau)
    const { wet } = this.f
    this.version++
    for (let i = 0; i < this.n; i++) wet[i] *= k
  }

  /**
   * UV exposure for `seconds` under a light (band irradiance), with an optional
   * per-pixel transmission mask (the negative, a fern, a hand). Sub-steps
   * internally so one call can cover minutes of sun.
   */
  expose(light: Bands, seconds: number, opts: { mask?: ArrayLike<number> | null } = {}): void {
    const I0 = cyanoActinic(light)
    if (!(I0 > 0) || seconds <= 0) return
    const sub = Math.max(1, Math.ceil((PHI * I0 * seconds) / 0.02))
    const dt = seconds / sub
    const { fe3, fcy, fe2, pb, pw, wet, dose } = this.f
    const mask = this.fit(opts.mask, 0)
    const T10 = POW10NEG.tbl
    const T10s = POW10NEG.scale
    const T10top = T10.length - 2
    const n = this.n
    this.version++
    for (let i = 0; i < n; i++) {
      const I = mask ? I0 * mask[i] : I0
      if (!(I > 0)) continue
      let a3 = fe3[i]
      dose[i] += I * seconds
      if (a3 <= 1e-6) continue
      // Damp coating: muddy, weak blues (Fe(II) migrates and re-oxidises).
      const wv = wet[i]
      const eff = PHI * I * (1 - 0.5 * (wv < 0 ? 0 : wv > 1 ? 1 : wv))
      const effDt = eff * dt
      let ac = fcy[i]
      let a2 = fe2[i]
      let ab = pb[i]
      let aw = pw[i]
      for (let s = 0; s < sub; s++) {
        if (a3 <= 1e-6) break
        const Af = A_FE3 * a3
        const At = Af + A_FCY * ac + A_PB * ab + A_PW * aw
        const q = At * T10s
        let tr: number
        if (q >= T10top) tr = T10[T10top]
        else {
          const k = q | 0
          tr = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
        }
        let d = effDt * (1 - tr) * (Af / At)
        if (d > a3) d = a3
        a3 -= d
        a2 += d
        // Fast reactions: blue first, then over-reduction to Prussian white.
        const r1 = a2 < ac ? a2 : ac
        ab += r1
        ac -= r1
        a2 -= r1
        if (a2 > 0 && ab > 0) {
          const r2 = a2 < ab ? a2 : ab
          ab -= r2
          aw += r2
          a2 -= r2
        }
      }
      fe3[i] = a3
      fcy[i] = ac
      fe2[i] = a2
      pb[i] = ab
      pw[i] = aw
    }
  }

  /** Wet processing in a bath for dt seconds. Returns the sensitizer washed out (for yellow plumes). */
  process(bath: CyanoBath, dt: number, opts: CyanoProcessOpts = {}): { yellowOut: number } {
    if (dt <= 0) return { yellowOut: 0 }
    this.times[bath.name] = (this.times[bath.name] ?? 0) + dt
    this.version++
    const { fe3, fcy, fe2, pb, ox, pw, wet, feoh, tan, blk, pbt, tea, ystain } = this.f
    const contact = this.fit(opts.contact, 0)
    const hfield = this.fit(opts.h2o2, 1)
    const washTau = 50 / (0.35 + 0.65 * clamp01(bath.flow)) / Math.pow(1.5, (bath.tempC - 20) / 10)
    // Rates are additive in peroxide strength so a local concentration blends smoothly with plain water.
    // Oxidation of Prussian blue toward its deepest form (peroxide: tau 0.5 s per unit strength).
    const oxRate0 = 1 / (bath.pH < 4 ? 240 : bath.pH < 5.5 ? 1800 : 7200)
    // Prussian white: re-oxidise (and partly dissolve) in water; fast with peroxide.
    const pwRate0 = 1 / (bath.pH < 5 ? 60 : 90)
    const pwLoss0 = bath.pH < 5 ? 0.25 : 0.35
    const alk = Math.max(0, bath.pH - 7.5)
    const bleachK = 0.0008 * alk * alk * alk
    const hydrolysis = 0.00025 * Math.max(0, (bath.pH - 5.5) / 1.5)
    const blkK = 0.02 * Math.max(0, bath.pH - 8)
    const tannin = bath.tannin
    const n = this.n
    let out = 0
    // Per-(contact, peroxide) exponentials, recomputed only when either changes.
    let lastCc = -1
    let lastH = -1
    let kw = 0
    let kpw = 0
    let kox = 0
    let kb = 0
    let ktea = 0
    let kpbt = 0
    let kblk = 0
    let hyd = 0
    let e = 0
    let pwLoss = 0
    for (let i = 0; i < n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      const hl = hfield ? hfield[i] : 0
      if (cc !== lastCc || hl !== lastH) {
        lastCc = cc
        lastH = hl
        e = dt * cc
        const hh = bath.h2o2 + hl
        kw = Math.exp(-e / washTau)
        kpw = 1 - Math.exp(-e * (pwRate0 + hh / 0.6))
        kox = 1 - Math.exp(-e * (oxRate0 + hh / 0.5))
        kb = bleachK > 0 ? 1 - Math.exp(-bleachK * e) : 0
        ktea = tannin > 0 ? 1 - Math.exp(-e / 90) : 0
        kpbt = tannin > 0 ? 1 - Math.exp(-e / 300) : 0
        kblk = blkK > 0 ? 1 - Math.exp(-blkK * e) : 0
        hyd = hydrolysis * e
        const mix = hh > 1 ? 1 : hh
        pwLoss = pwLoss0 + (0.1 - pwLoss0) * mix
      }
      // Soluble salts leave (yellow plumes); a non-acid wash leaves a little ferric stain.
      const f3 = fe3[i]
      const fc = fcy[i]
      const lost3 = f3 * (1 - kw)
      out += lost3 + fc * (1 - kw)
      ystain[i] += hyd * f3
      fe3[i] = f3 - lost3
      fcy[i] = fc * kw
      fe2[i] *= kw
      // Prussian white -> blue (or away).
      const pwv = pw[i]
      if (pwv > 0) {
        const dpw = pwv * kpw
        pw[i] = pwv - dpw
        pb[i] += dpw * (1 - pwLoss)
      }
      // Deepen.
      ox[i] += (1 - ox[i]) * kox
      // Alkali bleaches blue to ferric hydroxide.
      if (kb > 0) {
        const db = pb[i] * kb
        pb[i] -= db
        feoh[i] += db * 0.9
      }
      // Tannin: soaks into the paper, binds ferric hydroxide, tints remaining blue.
      if (tannin > 0) {
        tea[i] += (tannin - tea[i]) * ktea
        pbt[i] += (0.85 * tannin - pbt[i]) * kpbt
      }
      if (tea[i] > 0 && feoh[i] > 0) {
        const dt2 = feoh[i] * (1 - Math.exp(-0.02 * tea[i] * e))
        feoh[i] -= dt2
        tan[i] += dt2
      }
      if (kblk > 0 && tan[i] > 0) blk[i] += (1 - blk[i]) * kblk
      // Wet paper does not dry in the bath; ageing does the slow part later.
      wet[i] = 1
    }
    return { yellowOut: out / n }
  }

  /**
   * Out of the bath. Hanging to dry lets Prussian blue finish oxidising over
   * about a day (the "blue deepens overnight" effect). Light on a finished
   * print slowly reduces blue to white; darkness regenerates it.
   */
  rest(hours: number, opts: { luxHours?: number; airflow?: number } = {}): void {
    const dtS = hours * 3600
    this.dry(dtS, opts.airflow ?? 0)
    const { pb, ox, pw } = this.f
    const kOx = 1 - Math.exp(-hours / 8)
    const fadeK = 1 - Math.exp(-(opts.luxHours ?? 0) / 4e6) // ~ a few weeks of a sunny window
    const regenK = 1 - Math.exp(-hours / 24)
    for (let i = 0; i < this.n; i++) {
      ox[i] += (1 - ox[i]) * kOx
      if (fadeK > 0) {
        const d = pb[i] * fadeK * 0.5
        pb[i] -= d
        pw[i] += d
      } else if (pw[i] > 0) {
        // Dark regeneration: reduced pigment in a dry print re-oxidises in place.
        const d = pw[i] * regenK
        pw[i] -= d
        pb[i] += d
      }
    }
  }

  /** Decades on alkaline-buffered board: a slow bleach toward pale yellow. */
  ageYears(years: number, buffered = true): void {
    const k = 1 - Math.exp(-years * (buffered ? 0.006 : 0.0008))
    const { pb, feoh } = this.f
    this.version++
    for (let i = 0; i < this.n; i++) {
      const d = pb[i] * k
      pb[i] -= d
      feoh[i] += d * 0.9
    }
  }

  /** Channel densities at output pixel i. */
  densities(i: number, out: RGB = [0, 0, 0]): RGB {
    const j = this.simIndex(i)
    const f = this.f
    const fe3 = f.fe3[j]
    const fcy = f.fcy[j]
    const pb = f.pb[j]
    const ox = f.ox[j]
    const pbt = f.pbt[j]
    const pw = f.pw[j]
    const feoh = f.feoh[j]
    const tan = f.tan[j]
    const blk = f.blk[j]
    const tea = f.tea[j]
    const ys = f.ystain[j]
    for (let k = 0; k < 3; k++) {
      let pbc = C_PB_FRESH[k] + (C_PB_DEEP[k] - C_PB_FRESH[k]) * ox
      pbc += (C_PB_AUB[k] - pbc) * pbt
      const tanc = C_TAN_BROWN[k] + (C_TAN_BLACK[k] - C_TAN_BROWN[k]) * blk
      out[k] = fe3 * C_FE3[k] + fcy * C_FCY[k] + pb * pbc + pw * C_PW[k] + feoh * C_FEOH[k] + tan * tanc + tea * C_TEA[k] + ys * C_YSTAIN[k]
    }
    return out
  }

  /**
   * Linear reflectance of simulated pixels j0..j1-1 (wet paper is darker and
   * glossier), written as r,g,b,wet to buf at `stride` floats per pixel.
   */
  private shadeRange(j0: number, j1: number, buf: Float32Array, stride: number): void {
    const { fe3, fcy, pb, ox, pbt, pw, feoh, tan, blk, tea, ystain, wet } = this.f
    const T10 = POW10NEG.tbl
    const T10s = POW10NEG.scale
    const T10top = T10.length - 2
    const wh0 = this.white[0]
    const wh1 = this.white[1]
    const wh2 = this.white[2]
    const surf = this.surface
    const F0 = C_PB_FRESH[0]
    const F1 = C_PB_FRESH[1]
    const F2 = C_PB_FRESH[2]
    const D0 = C_PB_DEEP[0] - F0
    const D1 = C_PB_DEEP[1] - F1
    const D2 = C_PB_DEEP[2] - F2
    let o = 0
    for (let j = j0; j < j1; j++, o += stride) {
      const oxv = ox[j]
      const pbtv = pbt[j]
      const blkv = blk[j]
      let pbc0 = F0 + D0 * oxv
      let pbc1 = F1 + D1 * oxv
      let pbc2 = F2 + D2 * oxv
      if (pbtv > 0) {
        pbc0 += (C_PB_AUB[0] - pbc0) * pbtv
        pbc1 += (C_PB_AUB[1] - pbc1) * pbtv
        pbc2 += (C_PB_AUB[2] - pbc2) * pbtv
      }
      const a = fe3[j]
      const b = fcy[j]
      const c = pb[j]
      const d = pw[j]
      const e = feoh[j]
      const t = tan[j]
      const tt = tea[j]
      const ys = ystain[j]
      const tb0 = C_TAN_BROWN[0] + (C_TAN_BLACK[0] - C_TAN_BROWN[0]) * blkv
      const tb1 = C_TAN_BROWN[1] + (C_TAN_BLACK[1] - C_TAN_BROWN[1]) * blkv
      const tb2 = C_TAN_BROWN[2] + (C_TAN_BLACK[2] - C_TAN_BROWN[2]) * blkv
      const d0 = a * C_FE3[0] + b * C_FCY[0] + c * pbc0 + d * C_PW[0] + e * C_FEOH[0] + t * tb0 + tt * C_TEA[0] + ys * C_YSTAIN[0]
      const d1 = a * C_FE3[1] + b * C_FCY[1] + c * pbc1 + d * C_PW[1] + e * C_FEOH[1] + t * tb1 + tt * C_TEA[1] + ys * C_YSTAIN[1]
      const d2 = a * C_FE3[2] + b * C_FCY[2] + c * pbc2 + d * C_PW[2] + e * C_FEOH[2] + t * tb2 + tt * C_TEA[2] + ys * C_YSTAIN[2]
      const wr = wet[j]
      const wv = wr < 0 ? 0 : wr > 1 ? 1 : wr
      const s = surf * (1 - 0.6 * wv)
      const k1 = (1 - s) * (1 - 0.12 * wv)
      let q = d0 * T10s
      let r: number
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o] = k1 * wh0 * r + s
      q = d1 * T10s
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o + 1] = k1 * wh1 * r + s
      q = d2 * T10s
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o + 2] = k1 * wh2 * r + s
      buf[o + 3] = wv
    }
  }

  /** Linear reflectance at output pixel i (wet paper is darker and glossier). */
  reflectance(i: number, out: RGB = [0, 0, 0]): RGB {
    const j = this.simIndex(i)
    this.shadeRange(j, j + 1, this.lin, 4)
    out[0] = this.lin[0]
    out[1] = this.lin[1]
    out[2] = this.lin[2]
    return out
  }

  /**
   * Render to RGBA8 (sRGB, w*h*4). Alpha is the wetness (0 dry .. 255 soaked) for
   * gloss; pass `{ opaque: true }` for 255 (putImageData).
   */
  render(out: Uint8ClampedArray, illum: RGB = [1, 1, 1], opts: { opaque?: boolean } = {}): void {
    const lin = this.lin
    const n = this.n
    this.shadeRange(0, n, lin, 4)
    const opaque = !!opts.opaque
    if (this.simScale === 1) {
      for (let j = 0; j < n; j++) {
        const o = 4 * j
        out[o] = linToByte(lin[o] * illum[0])
        out[o + 1] = linToByte(lin[o + 1] * illum[1])
        out[o + 2] = linToByte(lin[o + 2] * illum[2])
        out[o + 3] = opaque ? 255 : (lin[o + 3] * 255 + 0.5) | 0
      }
      return
    }
    upsample2ToRGBA8(lin, this.sw, this.sh, this.w, this.h, out, illum, linToByte, opaque ? () => 255 : (a) => (a * 255 + 0.5) | 0)
  }

  /** Visual (luminance) density at output pixel i relative to a perfect white. */
  visualDensity(i: number): number {
    return this.visualAt(this.simIndex(i))
  }

  private visualAt(j: number): number {
    this.shadeRange(j, j + 1, this.lin, 4)
    const t = this.lin
    return -Math.log10(Math.max(1e-6, 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]))
  }

  stats(): CyanoStats {
    const f = this.f
    let s = 0
    let b = 0
    let w = 0
    let o = 0
    let t = 0
    let cov = 0
    const step = Math.max(1, Math.floor(this.n / 4096))
    let cnt = 0
    for (let i = 0; i < this.n; i += step) {
      s += f.fe3[i] + f.fcy[i]
      b += f.pb[i]
      w += f.pw[i]
      o += f.ox[i]
      t += f.tan[i]
      if (f.fe3[i] + f.fcy[i] + f.pb[i] + f.pw[i] + f.feoh[i] + f.tan[i] > 0.05) cov++
      cnt++
    }
    const met = sheetMetrics((j) => this.visualAt(j), this.sw, this.sh)
    return {
      sensitizer: s / cnt, blue: b / cnt, bronze: w / cnt, oxidised: o / cnt, tannate: t / cnt,
      meanD: met.meanD, dmax: met.dmax, borderD: met.borderD, coverage: cov / cnt, evenness: met.evenness,
    }
  }

  /** Binary save state (see snapshot.ts): JSON header + uint16-quantised fields. ~2.3 MB at 320x256. */
  toBytes(): Uint8Array {
    return packFields(
      { kind: 'cyanotype', v: 1, w: this.w, h: this.h, simScale: this.simScale, white: this.white, surface: this.surface, times: this.times },
      this.f, CYANO_FIELDS,
    )
  }

  static fromBytes(bytes: Uint8Array): CyanoSheet {
    const { header: h, fields } = unpackFields(bytes)
    const s = new CyanoSheet(h.w as number, h.h as number, { simScale: (h.simScale as 1 | 0.5 | undefined) ?? 1 })
    s.white = h.white as RGB
    s.surface = h.surface as number
    Object.assign(s.times, h.times)
    for (const [k, a] of Object.entries(fields)) s.f[k as CyanoField].set(a)
    return s
  }
}

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

export interface CoatOpts {
  /** Part A : Part B volume ratio (1 = classic 1:1). */
  ratioAB?: number
  /** Hours since A and B were mixed: the working solution slowly fogs (pre-formed blue). */
  sensitizerAgeH?: number
}

export class CyanoSheet {
  readonly w: number
  readonly h: number
  readonly n: number
  readonly f: Record<CyanoField, Float32Array>
  /** Paper white (rag, linear RGB) and first-surface floor (matte). */
  white: RGB = hexToLinear('#F3EFE4')
  surface = Math.pow(10, -1.9)
  readonly times: Record<string, number> = {}

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.n = w * h
    const f = {} as Record<CyanoField, Float32Array>
    for (const k of CYANO_FIELDS) f[k] = new Float32Array(this.n)
    this.f = f
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
    for (let i = 0; i < this.n; i++) {
      const a = typeof amount === 'number' ? amount : amount[i]
      if (!(a > 0)) continue
      fe3[i] += COAT.fe3 * kA * a * (1 - pre)
      fcy[i] += COAT.fcy * kB * a * (1 - pre)
      pb[i] += COAT.fcy * kB * a * pre * 0.5
      ox[i] = Math.max(ox[i], 0.3)
      wet[i] = Math.min(1.5, wet[i] + a)
    }
  }

  /** Drying in the dark: ~20 min in still air at 50% RH; a hair dryer is ~6x faster. */
  dry(dt: number, airflow = 0, rh = 50): void {
    const tau = (1200 * Math.max(0.2, rh / 50)) / (1 + 6 * airflow)
    const k = Math.exp(-dt / tau)
    const { wet } = this.f
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
    const mask = opts.mask ?? null
    for (let i = 0; i < this.n; i++) {
      const I = I0 * (mask ? mask[i] : 1)
      if (!(I > 0)) continue
      // Damp coating: muddy, weak blues (Fe(II) migrates and re-oxidises).
      const eff = PHI * I * (1 - 0.5 * clamp01(wet[i]))
      let a3 = fe3[i]
      let ac = fcy[i]
      let a2 = fe2[i]
      let ab = pb[i]
      let aw = pw[i]
      for (let s = 0; s < sub; s++) {
        if (a3 <= 1e-6) break
        const Af = A_FE3 * a3
        const At = Af + A_FCY * ac + A_PB * ab + A_PW * aw
        const absorbed = 1 - Math.pow(10, -At)
        let d = eff * dt * absorbed * (Af / At)
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
      dose[i] += I * seconds
    }
  }

  /** Wet processing in a bath for dt seconds. Returns the sensitizer washed out (for yellow plumes). */
  process(bath: CyanoBath, dt: number, opts: { contact?: ArrayLike<number> | null } = {}): { yellowOut: number } {
    if (dt <= 0) return { yellowOut: 0 }
    this.times[bath.name] = (this.times[bath.name] ?? 0) + dt
    const { fe3, fcy, fe2, pb, ox, pw, wet, feoh, tan, blk, pbt, tea, ystain } = this.f
    const contact = opts.contact ?? null
    const washTau = 50 / (0.35 + 0.65 * clamp01(bath.flow)) / Math.pow(1.5, (bath.tempC - 20) / 10)
    // Oxidation of Prussian blue toward its deepest form.
    const oxTau = bath.h2o2 > 0 ? 0.5 / bath.h2o2 : bath.pH < 4 ? 240 : bath.pH < 5.5 ? 1800 : 7200
    // Prussian white: re-oxidise (and partly dissolve) in water; fast with peroxide.
    const pwTau = bath.h2o2 > 0 ? 0.6 / bath.h2o2 : bath.pH < 5 ? 60 : 90
    const pwLoss = bath.h2o2 > 0 ? 0.1 : bath.pH < 5 ? 0.25 : 0.35
    const alk = Math.max(0, bath.pH - 7.5)
    const bleachK = 0.0008 * alk * alk * alk
    const hydrolysis = 0.00025 * Math.max(0, (bath.pH - 5.5) / 1.5)
    const blkK = 0.02 * Math.max(0, bath.pH - 8)
    let out = 0
    for (let i = 0; i < this.n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      const e = dt * cc
      // Soluble salts leave (yellow plumes); a non-acid wash leaves a little ferric stain.
      const kw = Math.exp(-e / washTau)
      const lost3 = fe3[i] * (1 - kw)
      out += lost3 + fcy[i] * (1 - kw)
      ystain[i] += hydrolysis * fe3[i] * e
      fe3[i] -= lost3
      fcy[i] *= kw
      fe2[i] *= kw
      // Prussian white -> blue (or away).
      const dpw = pw[i] * (1 - Math.exp(-e / pwTau))
      pw[i] -= dpw
      pb[i] += dpw * (1 - pwLoss)
      // Deepen.
      ox[i] += (1 - ox[i]) * (1 - Math.exp(-e / oxTau))
      // Alkali bleaches blue to ferric hydroxide.
      if (bleachK > 0) {
        const db = pb[i] * (1 - Math.exp(-bleachK * e))
        pb[i] -= db
        feoh[i] += db * 0.9
      }
      // Tannin: soaks into the paper, binds ferric hydroxide, tints remaining blue.
      if (bath.tannin > 0) {
        tea[i] += (bath.tannin - tea[i]) * (1 - Math.exp(-e / 90))
        pbt[i] += (0.85 * bath.tannin - pbt[i]) * (1 - Math.exp(-e / 300))
      }
      if (tea[i] > 0 && feoh[i] > 0) {
        const dt2 = feoh[i] * (1 - Math.exp(-0.02 * tea[i] * e))
        feoh[i] -= dt2
        tan[i] += dt2
      }
      if (blkK > 0 && tan[i] > 0) blk[i] += (1 - blk[i]) * (1 - Math.exp(-blkK * e))
      // Wet paper does not dry in the bath; ageing does the slow part later.
      wet[i] = 1
    }
    return { yellowOut: out / this.n }
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
    for (let i = 0; i < this.n; i++) {
      const d = pb[i] * k
      pb[i] -= d
      feoh[i] += d * 0.9
    }
  }

  /** Channel densities at pixel i. */
  densities(i: number, out: RGB = [0, 0, 0]): RGB {
    const f = this.f
    const fe3 = f.fe3[i]
    const fcy = f.fcy[i]
    const pb = f.pb[i]
    const ox = f.ox[i]
    const pbt = f.pbt[i]
    const pw = f.pw[i]
    const feoh = f.feoh[i]
    const tan = f.tan[i]
    const blk = f.blk[i]
    const tea = f.tea[i]
    const ys = f.ystain[i]
    for (let k = 0; k < 3; k++) {
      let pbc = C_PB_FRESH[k] + (C_PB_DEEP[k] - C_PB_FRESH[k]) * ox
      pbc += (C_PB_AUB[k] - pbc) * pbt
      const tanc = C_TAN_BROWN[k] + (C_TAN_BLACK[k] - C_TAN_BROWN[k]) * blk
      out[k] = fe3 * C_FE3[k] + fcy * C_FCY[k] + pb * pbc + pw * C_PW[k] + feoh * C_FEOH[k] + tan * tanc + tea * C_TEA[k] + ys * C_YSTAIN[k]
    }
    return out
  }

  /** Linear reflectance at pixel i (wet paper is darker and glossier). */
  reflectance(i: number, out: RGB = [0, 0, 0]): RGB {
    const d = this.densities(i, out)
    const wet = clamp01(this.f.wet[i])
    const s = this.surface * (1 - 0.6 * wet)
    const wetDark = 1 - 0.12 * wet
    for (let k = 0; k < 3; k++) out[k] = (1 - s) * this.white[k] * wetDark * Math.pow(10, -d[k]) + s
    return out
  }

  render(out: Uint8ClampedArray, illum: RGB = [1, 1, 1]): void {
    const px: RGB = [0, 0, 0]
    for (let i = 0; i < this.n; i++) {
      this.reflectance(i, px)
      const o = i * 4
      out[o] = linToByte(px[0] * illum[0])
      out[o + 1] = linToByte(px[1] * illum[1])
      out[o + 2] = linToByte(px[2] * illum[2])
      out[o + 3] = 255
    }
  }

  /** Visual (luminance) density at pixel i relative to a perfect white. */
  visualDensity(i: number): number {
    const c = this.reflectance(i)
    return -Math.log10(Math.max(1e-6, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]))
  }

  stats(): { sensitizer: number; blue: number; bronze: number; oxidised: number; tannate: number } {
    const f = this.f
    let s = 0
    let b = 0
    let w = 0
    let o = 0
    let t = 0
    for (let i = 0; i < this.n; i++) {
      s += f.fe3[i] + f.fcy[i]
      b += f.pb[i]
      w += f.pw[i]
      o += f.ox[i]
      t += f.tan[i]
    }
    const n = this.n
    return { sensitizer: s / n, blue: b / n, bronze: w / n, oxidised: o / n, tannate: t / n }
  }

  /** Binary save state (see snapshot.ts): JSON header + uint16-quantised fields. ~2.3 MB at 320x256. */
  toBytes(): Uint8Array {
    return packFields({ kind: 'cyanotype', v: 1, w: this.w, h: this.h, white: this.white, surface: this.surface, times: this.times }, this.f, CYANO_FIELDS)
  }

  static fromBytes(bytes: Uint8Array): CyanoSheet {
    const { header: h, fields } = unpackFields(bytes)
    const s = new CyanoSheet(h.w as number, h.h as number)
    s.white = h.white as RGB
    s.surface = h.surface as number
    Object.assign(s.times, h.times)
    for (const [k, a] of Object.entries(fields)) s.f[k as CyanoField].set(a)
    return s
  }
}

// Per-pixel silver gelatin print: exposure, development, stop, fix, wash,
// toning, drying, ageing, and colour. CPU reference implementation with
// struct-of-arrays Float32 fields; every per-pixel update is a pure function
// of that pixel's fields plus a handful of bath-level scalars, so each loop
// body ports to a fragment shader one-to-one (see glsl.ts and NOTES.md for
// the texture packing).
//
// The heart of it:
//
//   latent:  H_k += η_k(I_k) I_k dt x                     per component k (hard, soft)
//   target:  D∞   = curve_hard(H_hard) + curve_soft(H_soft)   (uncapped sum)
//   develop: dp/dt = R c (seed(D∞) + p)(1 - p)           exact step, see kinetics.devStep
//   density: D    = softmin(p D∞ + p2 D2∞, Dmax_int dcap) + fog p + chemical fog - reduction
//   colour:  refl = (1 - s) white 10^(-D tint) + s       surface floor s sets visible Dmax
//
// Light that arrives after development has started goes to a second latent
// image (H2) screened by the silver already there. That one rule gives the
// Sabattier effect (partial tone reversal) for free.

import { type Bands, actinic, rgbToBands } from './bands.ts'
import {
  type AirBath, type DeveloperBath, type FixerBath, type HypoClearBath, type SilverBath, type StopBath, type TonerBath, type WashBath,
  consumeDeveloper, developerRates, fixerRates, stopTau, washTauFactor,
} from './baths.ts'
import { type RGB, linToByte } from './color.ts'
import { curveDensityH, softmin } from './curve.ts'
import { devStep, reciprocityEfficiency } from './kinetics.ts'
import { type PaperModel, type PaperSpec, componentGains, makePaper } from './paper.ts'
import { packFields, unpackFields } from './snapshot.ts'

export const SILVER_FIELDS = [
  'Hh', 'Hs', // latent exposure per component (effective lux·s), before development started
  'H2h', 'H2s', // latent exposure that arrived after development started (Sabattier)
  'd1', 'd2', // cached fully-developed silver density targets (uncapped component sums)
  'p1', 'p2', // development progress 0..1 for each latent image
  'c', // developer activity inside the emulsion 0..1 (boundary layer)
  'tau', // accumulated development, in reference-developer seconds (drives fog induction)
  'cf', // chemical fog density
  'dcap', // Dmax factor experienced during development (cold or tired developer)
  'warm', // image warmth from exhausted developer 0..1
  'x', // unfixed silver halide fraction 1 -> 0
  'po', // print-out density (light on unfixed halide)
  'r', // residual thiosulfate (0 clean .. ~1 straight out of the fixer)
  'ag', // retained silver-thiosulfate complexes (exhausted fixer)
  'wet', // 0 dry .. 1 soaked
  'se', 'bl', 'sf', // toning: selenium, bleached, sulfided fractions
  'red', // density removed by reducers or over-fixing
  'stain', // yellow stain density from ageing
  'fade', // image loss fraction from ageing
] as const
export type SilverField = (typeof SILVER_FIELDS)[number]

export interface ExposeOpts {
  /** Filter in the light path (VC grade, colour head). */
  filter?: Bands
  /** Per-pixel transmission 0..1: the negative (10^-D), a dodging hand, a coin. */
  mask?: ArrayLike<number> | null
}

export interface ProcessOpts {
  /** Per-pixel liquid contact 0..1 from the tray simulation. Omitted = full contact. */
  contact?: ArrayLike<number> | null
  /** Rocking: 0 still tray .. 1 continuous agitation. */
  agitation?: number
  /** Lateral diffusion of developer activity (bromide drag, Mackie lines). One blur pass per step. */
  diffuse?: boolean
}

/** What a process step changed, for sound cues, dye plumes and the logbook. */
export interface StepReport {
  silverG: number
  halideRemovedG: number
  meanDev: number
}

// Constants (see NOTES.md for rationale)
const SCREEN_K = 0.55 // light passes the silver once: transmission density ≈ 0.55 x reflection density
const DESENS_K = 1.0 // bromide/oxidation-product desensitisation of halide next to developed silver
const PO_K = 4e-7 // print-out density per effective lux·s on unfixed halide (~5 min of room light -> lilac)
const DEPLETE = 0.5 // local developer depletion per unit of density developed
const C_AIR_TAU = 25 // developer in a lifted print keeps working, decaying over ~25 s
const FOG_INDUCTION = 25 // reference seconds before chemical fog starts
const CARRY_L_PER_M2 = 0.08 // liquid carried between trays
const LN10 = Math.LN10
const MAX_STEP = 0.5 // s, internal sub-step for big jumps while development is live

const STAIN_HYPO = 0.02 // stain density per year per unit residual thiosulfate (20 °C, 50% RH)
const STAIN_AG = 0.05 // ... per unit retained silver complex
const PO_DISPLAY = 3e-4 // efficiency of weak display light at printing-out, relative to PO_K

export interface AgeEnv {
  tempC?: number
  rh?: number
  displayLux?: number
  hoursPerDay?: number
}

/** Arrhenius-like 2x per 10 °C, linear in relative humidity. */
function ageFactor(env: AgeEnv): number {
  return Math.pow(2, ((env.tempC ?? 20) - 20) / 10) * Math.max(0.1, (env.rh ?? 50) / 50)
}

const WARM_TINT: RGB = [0.84, 1.0, 1.2]
const SELENIUM_TINT: RGB = [1.0, 1.09, 0.96]
const SEPIA_TINT: RGB = [0.62, 0.92, 1.35]
const PRINTOUT_TINT: RGB = [0.78, 1.0, 0.86]
const STAIN_TINT: RGB = [0.03, 0.12, 0.55]
const HALIDE_TINT: RGB = [0.0, 0.004, 0.02]

export class SilverSheet {
  readonly model: PaperModel
  readonly w: number
  readonly h: number
  readonly n: number
  /** Physical sheet area (m²); 8x10 inch by default. Scales chemistry consumption. */
  readonly areaM2: number
  readonly f: Record<SilverField, Float32Array>

  /** Seconds the sheet has spent in each kind of bath (logbook). */
  readonly times: Record<string, number> = {}
  /** Development rate of the last developer, for development that continues in stop/air. */
  lastDevRate = 0
  hcaTreated = false
  fixSeconds = 0
  private dirty1 = false
  private dirty2 = false
  private lastBath: SilverBath['kind'] | 'none' = 'none'
  private scratch: Float32Array

  constructor(model: PaperModel | PaperSpec, w: number, h: number, areaM2 = 0.0516) {
    this.model = 'hard' in model ? model : makePaper(model)
    this.w = w
    this.h = h
    this.n = w * h
    this.areaM2 = areaM2
    const f = {} as Record<SilverField, Float32Array>
    for (const k of SILVER_FIELDS) f[k] = new Float32Array(this.n)
    f.x.fill(1)
    f.dcap.fill(1)
    this.f = f
    this.scratch = new Float32Array(this.n)
  }

  // -------------------------------------------------------------------------
  // Light
  // -------------------------------------------------------------------------

  /**
   * Expose to a light for `seconds` at constant intensity. Call once per frame
   * with that frame's light state (enlarger, safelight, room light, dodging
   * mask): reciprocity is evaluated per pixel from the instantaneous intensity.
   */
  expose(light: Bands, seconds: number, opts: ExposeOpts = {}): void {
    if (seconds <= 0) return
    const g = componentGains(this.model, light, opts.filter)
    const mask = opts.mask ?? null
    if (this.devStarted && this.dirty1) this.recompute()
    for (let i = 0; i < this.n; i++) {
      const T = mask ? mask[i] : 1
      if (T > 0) this.deposit(i, g.hard * T, g.soft * T, seconds)
    }
  }

  /**
   * Camera-style exposure from a linear-RGB image (3 floats per pixel, scaled
   * so luminance = illuminance in lux): a paper negative in a pinhole camera,
   * or a photogram lit by coloured light.
   */
  exposeRGB(rgb: ArrayLike<number>, seconds: number, filter?: Bands): void {
    if (seconds <= 0) return
    const m = this.model
    const unit: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    const wh = unit.map((u) => actinic(m.hard.spectral, rgbToBands(u), filter))
    const ws = unit.map((u) => (m.soft ? actinic(m.soft.spectral, rgbToBands(u), filter) : 0))
    if (this.devStarted && this.dirty1) this.recompute()
    for (let i = 0; i < this.n; i++) {
      const r = rgb[3 * i]
      const g = rgb[3 * i + 1]
      const b = rgb[3 * i + 2]
      this.deposit(i, wh[0] * r + wh[1] * g + wh[2] * b, ws[0] * r + ws[1] * g + ws[2] * b, seconds)
    }
  }

  /** Add one pixel's exposure (effective intensities per component) with reciprocity. */
  private deposit(i: number, Ih: number, Is: number, seconds: number): void {
    const f = this.f
    const sens = f.x[i]
    if (sens < 1e-5 || !(Ih + Is > 0)) return
    const m = this.model
    const dh = Ih > 0 ? Ih * reciprocityEfficiency(m.hard.recip, Ih) * seconds * sens : 0
    const ds = m.soft && Is > 0 ? Is * reciprocityEfficiency(m.soft.recip, Is) * seconds * sens : 0
    if (f.p1[i] > 0.01 || f.c[i] > 0.02) {
      // Development has begun: new light makes a second latent image. Existing silver screens it
      // optically, its development products desensitise the halide around it, and the grains already
      // developed are no longer halide at all. Together: the Sabattier effect.
      const dNow = f.p1[i] * Math.min(f.d1[i], m.dmaxInt) + f.p2[i] * Math.min(f.d2[i], m.dmaxInt)
      const screen = Math.pow(10, -(SCREEN_K + DESENS_K) * dNow) * Math.max(0, 1 - dNow / m.dmaxInt)
      f.H2h[i] += dh * screen
      f.H2s[i] += ds * screen
      this.dirty2 = true
    } else {
      f.Hh[i] += dh
      f.Hs[i] += ds
      this.dirty1 = true
    }
    f.po[i] += PO_K * (Ih + Is) * seconds * sens
  }

  /** True once the sheet has seen developer. */
  devStarted = false

  /** Recompute cached developed-density targets after exposure changes. */
  recompute(): void {
    const m = this.model
    const { Hh, Hs, H2h, H2s, d1, d2 } = this.f
    const ch = m.hard.curve
    const cs = m.soft?.curve
    if (this.dirty1) {
      for (let i = 0; i < this.n; i++) d1[i] = curveDensityH(ch, Hh[i]) + (cs ? curveDensityH(cs, Hs[i]) : 0)
      this.dirty1 = false
    }
    if (this.dirty2) {
      for (let i = 0; i < this.n; i++) d2[i] = H2h[i] > 0 || H2s[i] > 0 ? curveDensityH(ch, H2h[i]) + (cs ? curveDensityH(cs, H2s[i]) : 0) : 0
      this.dirty2 = false
    }
  }

  // -------------------------------------------------------------------------
  // Processing
  // -------------------------------------------------------------------------

  /**
   * Account for moving the sheet into a bath: carry-over of the previous
   * liquid (developer into stop or fixer weakens it). Call once on entry.
   */
  enter(bath: SilverBath): void {
    const carried = CARRY_L_PER_M2 * this.areaM2
    if (this.lastBath === 'developer') {
      if (bath.kind === 'stop') bath.carriedDevL += carried
      else if (bath.kind === 'fixer') bath.carriedDevL += carried
    } else if (this.lastBath === 'fixer' && bath.kind === 'developer') {
      bath.fixerMLPerL += (carried * 1000) / Math.max(1e-6, bath.volumeL)
    }
    if (bath.kind !== 'air') this.lastBath = bath.kind
  }

  /** Advance the sheet by dt seconds in a bath. */
  process(bath: SilverBath, dt: number, opts: ProcessOpts = {}): StepReport {
    if (dt <= 0) return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
    if (this.dirty1 || this.dirty2) this.recompute()
    // While developer is live in the emulsion, big jumps are sub-stepped so a 30 s
    // jump matches 1800 frames at 60 Hz (depletion and exchange couple to the
    // development rate). Once it has died away, the rest is one exact step.
    const rep: StepReport = { silverG: 0, halideRemovedG: 0, meanDev: 0 }
    let remaining = dt
    while (remaining > 1e-9) {
      const live = bath.kind === 'developer' || this.cMax > 1e-3
      const step = live ? Math.min(MAX_STEP, remaining) : remaining
      const r = this.dispatch(bath, step, opts)
      rep.silverG += r.silverG
      rep.halideRemovedG += r.halideRemovedG
      rep.meanDev = r.meanDev
      remaining -= step
    }
    return rep
  }

  /** Largest developer activity left in the emulsion (drives sub-stepping). */
  private cMax = 0

  private dispatch(bath: SilverBath, dt: number, opts: ProcessOpts): StepReport {
    this.times[bath.kind] = (this.times[bath.kind] ?? 0) + dt
    switch (bath.kind) {
      case 'developer':
        return this.develop(bath, dt, opts)
      case 'stop':
        return this.stopStep(bath, dt, opts)
      case 'fixer':
        return this.fixStep(bath, dt, opts)
      case 'wash':
        return this.washStep(bath, dt, opts)
      case 'hca':
        return this.hcaStep(bath, dt, opts)
      case 'toner':
        return this.tonerStep(bath, dt, opts)
      case 'air':
        return this.airStep(bath, dt)
    }
  }

  private develop(bath: DeveloperBath, dt: number, opts: ProcessOpts): StepReport {
    const m = this.model
    const rates = developerRates(bath)
    const R = rates.paper * m.devRate
    this.lastDevRate = R
    this.devStarted = true
    const { d1, d2, p1, p2, c, tau, cf, dcap, warm, wet } = this.f
    const contact = opts.contact ?? null
    const agit = Math.max(0, Math.min(1, opts.agitation ?? 0.6))
    const tauEx = 1 / (0.15 + agit) // boundary-layer exchange: still ~6.7 s, rocking ~1 s
    const dmaxInt = m.dmaxInt
    const seedLo = m.seedLo
    const seedSpan = m.seedHi - m.seedLo
    const fogDt = rates.fog * dt
    const refRate = Math.max(1e-9, m.devRate)
    let silver = 0
    let devSum = 0
    let cMax = 0
    for (let i = 0; i < this.n; i++) {
      const cc = contact ? contact[i] : 1
      const c0 = c[i]
      // Exchange with the bath where liquid touches; slow decay where it doesn't.
      const target = cc
      const tauI = cc > 0 ? tauEx / Math.max(0.05, cc) : C_AIR_TAU
      const e = Math.exp(-dt / tauI)
      let c1 = target + (c0 - target) * e
      // Exact time-average of the exponential approach (frame-rate independent).
      const cm = target + (c0 - target) * (tauI / dt) * (1 - e)
      const rate = R * cm
      const D1 = d1[i]
      const F = D1 < dmaxInt ? D1 / dmaxInt : 1
      const a = seedLo + seedSpan * F
      const p0 = p1[i]
      const pn = devStep(p0, rate, a, 1, dt)
      const dp = pn - p0
      p1[i] = pn
      let dD = dp * (D1 < dmaxInt ? D1 : dmaxInt)
      const D2 = d2[i]
      if (D2 > 0) {
        const q0 = p2[i]
        const F2 = D2 < dmaxInt ? D2 / dmaxInt : 1
        const qn = devStep(q0, rate, seedLo + seedSpan * F2, 1, dt)
        p2[i] = qn
        dD += (qn - q0) * (D2 < dmaxInt ? D2 : dmaxInt)
      }
      silver += dD
      c1 -= DEPLETE * dD
      c1 = c1 > 0 ? c1 : 0
      c[i] = c1
      if (c1 > cMax) cMax = c1
      const t0 = tau[i]
      const t1 = t0 + (rate / refRate) * dt
      tau[i] = t1
      if (t1 > FOG_INDUCTION) cf[i] += fogDt * cm
      if (dp > 0) {
        const wgt = dp / (pn + 1e-6)
        dcap[i] += (rates.dmaxFactor - dcap[i]) * wgt
        warm[i] += (rates.warmth - warm[i]) * wgt
      }
      wet[i] = 1
      devSum += pn
    }
    if (opts.diffuse) this.blurField(c)
    this.cMax = cMax
    const grams = (silver / dmaxInt) * m.silverGm2 * (this.areaM2 / this.n)
    consumeDeveloper(bath, grams)
    return { silverG: grams, halideRemovedG: 0, meanDev: devSum / this.n }
  }

  /** Development that continues on the developer carried in the emulsion while c decays with tau. */
  private carryOn(dt: number, tauC: number, contact: ArrayLike<number> | null): void {
    const R = this.lastDevRate
    const { d1, d2, p1, p2, c, wet } = this.f
    const m = this.model
    const k = Math.exp(-dt / tauC)
    let cMax = 0
    for (let i = 0; i < this.n; i++) {
      const c0 = c[i]
      if (c0 <= 1e-4) {
        c[i] = 0
        continue
      }
      const cc = contact ? contact[i] : 1
      const kk = cc > 0 ? Math.pow(k, cc) * Math.exp((-dt * (1 - cc)) / C_AIR_TAU) : Math.exp(-dt / C_AIR_TAU)
      const c1 = c0 * kk
      const cm = kk < 1 ? (c0 - c1) / -Math.log(kk) : c0 // exact mean of an exponential decay
      c[i] = c1
      if (c1 > cMax) cMax = c1
      if (R <= 0) continue
      const D1 = d1[i]
      const F = D1 < m.dmaxInt ? D1 / m.dmaxInt : 1
      p1[i] = devStep(p1[i], R * cm, m.seedLo + (m.seedHi - m.seedLo) * F, 1, dt)
      if (d2[i] > 0) p2[i] = devStep(p2[i], R * cm, m.seedLo, 1, dt)
      if (cc > 0) wet[i] = 1
    }
    this.cMax = cMax
  }

  private stopStep(bath: StopBath, dt: number, opts: ProcessOpts): StepReport {
    this.carryOn(dt, stopTau(bath), opts.contact ?? null)
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private fixStep(bath: FixerBath, dt: number, opts: ProcessOpts): StepReport {
    const m = this.model
    const rr = fixerRates(bath)
    // Without a stop bath, alkaline developer keeps working for a few seconds in the fixer.
    this.carryOn(dt, 4, opts.contact ?? null)
    const k = rr.rate / m.fixTau
    const clearTime = (3.9 * m.fixTau) / Math.max(1e-6, rr.rate)
    this.fixSeconds += dt
    const etch = this.fixSeconds > 4 * clearTime ? rr.etch * dt : 0
    const rTau = m.spec.base === 'fb' ? 40 : 10
    const { x, r, ag, wet, red, d1, p1 } = this.f
    const contact = opts.contact ?? null
    let removed = 0
    for (let i = 0; i < this.n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      const x0 = x[i]
      const x1 = x0 * Math.exp(-k * cc * dt)
      x[i] = x1
      const developed = Math.min(1, (p1[i] * Math.min(d1[i], m.dmaxInt)) / m.dmaxInt)
      const fixed = (x0 - x1) * (1 - developed)
      removed += fixed
      r[i] += (m.fixAbsorb - r[i]) * (1 - Math.exp((-dt * cc) / rTau))
      ag[i] += rr.retention * fixed * 0.6
      if (etch > 0) red[i] += etch * cc
      wet[i] = 1
    }
    const grams = removed * m.silverGm2 * (this.areaM2 / this.n)
    bath.silverG += grams
    return { silverG: 0, halideRemovedG: grams, meanDev: 0 }
  }

  private washStep(bath: WashBath, dt: number, opts: ProcessOpts): StepReport {
    const m = this.model
    this.carryOn(dt, 3, opts.contact ?? null)
    const tau = (this.hcaTreated ? m.washTauHCA : m.washTau) * washTauFactor(bath)
    const { r, ag, wet } = this.f
    const contact = opts.contact ?? null
    const kr = Math.exp(-dt / tau)
    const ka = Math.exp(-dt / (tau * 25))
    for (let i = 0; i < this.n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      r[i] *= cc >= 1 ? kr : Math.pow(kr, cc)
      ag[i] *= cc >= 1 ? ka : Math.pow(ka, cc)
      wet[i] = 1
    }
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private hcaTime = 0
  private hcaStep(_bath: HypoClearBath, dt: number, opts: ProcessOpts): StepReport {
    this.carryOn(dt, 3, opts.contact ?? null)
    this.hcaTime += dt
    if (this.hcaTime >= 60) this.hcaTreated = true
    const { r, wet } = this.f
    const k = Math.exp(-dt / 240)
    for (let i = 0; i < this.n; i++) {
      r[i] *= k
      wet[i] = 1
    }
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private tonerStep(bath: TonerBath, dt: number, opts: ProcessOpts): StepReport {
    const s = Math.max(0, bath.strength)
    const { se, bl, sf, red, wet, x } = this.f
    const contact = opts.contact ?? null
    for (let i = 0; i < this.n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      const e = dt * cc * s
      switch (bath.toner) {
        case 'selenium':
          // KRST 1+9: visibly cooler in ~2 min, done by ~5. Unfixed halide stains instead.
          se[i] += (1 - se[i]) * (1 - Math.exp(-e / 150))
          if (x[i] > 0.1) red[i] -= 0.0004 * e
          break
        case 'bleach': {
          const silver = 1 - bl[i] - sf[i]
          const k = silver * (1 - Math.exp(-e / 25))
          bl[i] += k
          break
        }
        case 'sulfide': {
          const k = bl[i] * (1 - Math.exp(-e / 15))
          bl[i] -= k
          sf[i] += k
          break
        }
        case 'farmer':
          // Ferricyanide + hypo: subtractive "cutting" reducer, ~0.25 density per minute.
          red[i] += 0.004 * e
          break
      }
      wet[i] = 1
    }
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private airStep(bath: AirBath, dt: number): StepReport {
    this.carryOn(dt, C_AIR_TAU, null)
    const m = this.model
    const tauDry = (m.spec.base === 'fb' ? 1800 : 600) / (1 + 5 * bath.airflow)
    const k = Math.exp(-dt / tauDry)
    const { wet } = this.f
    for (let i = 0; i < this.n; i++) wet[i] *= k
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  /** Separable [1 2 1]/4 blur of one field in place (cheap lateral diffusion). */
  private blurField(a: Float32Array): void {
    const { w, h } = this
    const t = this.scratch
    for (let y = 0; y < h; y++) {
      const o = y * w
      for (let x = 0; x < w; x++) {
        const l = a[o + (x > 0 ? x - 1 : x)]
        const r = a[o + (x < w - 1 ? x + 1 : x)]
        t[o + x] = 0.25 * l + 0.5 * a[o + x] + 0.25 * r
      }
    }
    for (let y = 0; y < h; y++) {
      const up = (y > 0 ? y - 1 : y) * w
      const dn = (y < h - 1 ? y + 1 : y) * w
      const o = y * w
      for (let x = 0; x < w; x++) a[o + x] = 0.25 * t[up + x] + 0.5 * t[o + x] + 0.25 * t[dn + x]
    }
  }

  // -------------------------------------------------------------------------
  // Ageing ("years", for the joke and for the logbook)
  // -------------------------------------------------------------------------

  /**
   * Fast-forward the finished print. Residual thiosulfate sulfides the image
   * silver (yellowing, fading highlights); retained silver complexes from
   * tired fixer turn into a yellow-brown stain; unfixed halide prints out
   * under display light. Rates follow an Arrhenius-like 2x per 10 °C and
   * scale with relative humidity.
   */
  age(years: number, env: AgeEnv = {}): void {
    const k = years * ageFactor(env)
    const luxS = (env.displayLux ?? 150) * (env.hoursPerDay ?? 8) * 365 * years * 3600
    const { r, ag, stain, fade, x, po } = this.f
    for (let i = 0; i < this.n; i++) {
      stain[i] += STAIN_HYPO * r[i] * k + STAIN_AG * ag[i] * k
      fade[i] = 1 - (1 - fade[i]) * Math.exp(-0.015 * r[i] * k)
      // Unfixed halide prints out (lilac, then grey-brown) under display light. Weak, diffuse
      // light is far less efficient than a direct exposure (≈ a year of 150 lux -> ~0.2).
      po[i] += PO_K * PO_DISPLAY * luxS * x[i]
    }
  }

  /** Years until a just-visible yellowing (stain 0.05) from residual hypo and retained silver. */
  yearsToYellow(env: AgeEnv = {}): number {
    const s = this.stats()
    const rate = (STAIN_HYPO * s.residualHypo + STAIN_AG * s.retainedSilver) * ageFactor(env)
    return rate > 0 ? 0.05 / rate : Infinity
  }

  /**
   * The first visible discolouration and its cause, for the logbook joke:
   * "this print will start to yellow in about 17 years".
   */
  yearsToDiscolour(env: AgeEnv = {}): { years: number; cause: 'residual hypo' | 'tired fixer' | 'unfixed halide' | 'nothing' } {
    const s = this.stats()
    const f = ageFactor(env)
    const hypo = STAIN_HYPO * s.residualHypo * f
    const agR = STAIN_AG * s.retainedSilver * f
    const poRate = PO_K * PO_DISPLAY * (env.displayLux ?? 150) * (env.hoursPerDay ?? 8) * 365 * 3600 * s.halideLeft
    const yStain = hypo + agR > 0 ? 0.05 / (hypo + agR) : Infinity
    const yPo = poRate > 0 ? 0.05 / poRate : Infinity
    if (!Number.isFinite(yStain) && !Number.isFinite(yPo)) return { years: Infinity, cause: 'nothing' }
    if (s.halideLeft > 0.02 && yPo < yStain) return { years: yPo, cause: 'unfixed halide' }
    return { years: yStain, cause: agR > hypo ? 'tired fixer' : 'residual hypo' }
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  /** Intrinsic silver density at pixel i (before surface floor and tint). */
  silverDensity(i: number): number {
    if (this.dirty1 || this.dirty2) this.recompute()
    const m = this.model
    const f = this.f
    let D = softmin(f.p1[i] * f.d1[i] + f.p2[i] * f.d2[i], m.dmaxInt * f.dcap[i], m.capSoft) + m.fog * f.p1[i] + f.cf[i]
    D -= f.red[i]
    if (D < 0) D = 0
    D *= 1 - f.fade[i]
    const wet = f.wet[i]
    if (wet < 1) {
      const u = Math.min(1, D / m.dmaxInt)
      D *= 1 + m.drydown * (1 - wet) * 4 * u * (1 - u)
    }
    return D
  }

  /** Linear-RGB reflectance of pixel i under white light. */
  reflectance(i: number, out: RGB = [0, 0, 0]): RGB {
    const m = this.model
    const f = this.f
    const D = this.silverDensity(i)
    const wet = f.wet[i]
    const s = m.surfaceWet * wet + m.surfaceDry * (1 - wet)
    const bl = f.bl[i]
    const sf = f.sf[i]
    const se = f.se[i]
    const wm = f.warm[i]
    const silver = D * Math.max(0, 1 - bl - sf) * (1 + 0.1 * se)
    const po = 1.2 * (1 - Math.exp(-f.po[i] / 1.2))
    const st = f.stain[i]
    const xh = f.x[i]
    const it = m.imageTint
    const w = m.white
    // Per-channel tint: paper tone -> exhausted-developer warmth -> selenium.
    let t0 = it[0] + (WARM_TINT[0] - it[0]) * wm
    let t1 = it[1] + (WARM_TINT[1] - it[1]) * wm
    let t2 = it[2] + (WARM_TINT[2] - it[2]) * wm
    if (se > 0) {
      t0 += (SELENIUM_TINT[0] - t0) * se
      t1 += (SELENIUM_TINT[1] - t1) * se
      t2 += (SELENIUM_TINT[2] - t2) * se
    }
    let d0 = silver * t0 + po * PRINTOUT_TINT[0] + st * STAIN_TINT[0] + xh * HALIDE_TINT[0]
    let d1 = silver * t1 + po * PRINTOUT_TINT[1] + st * STAIN_TINT[1] + xh * HALIDE_TINT[1]
    let d2 = silver * t2 + po * PRINTOUT_TINT[2] + st * STAIN_TINT[2] + xh * HALIDE_TINT[2]
    if (sf > 0 || bl > 0) {
      const sulf = D * sf * 0.92
      const blch = D * bl * 0.05
      d0 += sulf * SEPIA_TINT[0] + blch * STAIN_TINT[0]
      d1 += sulf * SEPIA_TINT[1] + blch * STAIN_TINT[1]
      d2 += sulf * SEPIA_TINT[2] + blch * STAIN_TINT[2]
    }
    const k = 1 - s
    out[0] = k * w[0] * Math.exp(-LN10 * d0) + s
    out[1] = k * w[1] * Math.exp(-LN10 * d1) + s
    out[2] = k * w[2] * Math.exp(-LN10 * d2) + s
    return out
  }

  /**
   * Render to RGBA8 (sRGB). `illum` multiplies the reflectance in linear light
   * (safelight colour x level, or [1,1,1] for daylight viewing).
   */
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

  /** Observed (neutral, luminance-weighted) reflection density at pixel i, relative to a perfect white. */
  observedDensity(i: number): number {
    const c = this.reflectance(i)
    return -Math.log10(Math.max(1e-6, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]))
  }

  stats(): {
    meanDensity: number
    maxDensity: number
    meanProgress: number
    halideLeft: number
    residualHypo: number
    retainedSilver: number
    fog: number
    wet: number
  } {
    const f = this.f
    let sd = 0
    let mx = 0
    let sp = 0
    let sx = 0
    let sr = 0
    let sa = 0
    let sfg = 0
    let sw = 0
    const step = Math.max(1, Math.floor(this.n / 4096))
    let cnt = 0
    for (let i = 0; i < this.n; i += step) {
      const d = this.observedDensity(i)
      sd += d
      if (d > mx) mx = d
      sp += f.p1[i]
      sx += f.x[i]
      sr += f.r[i]
      sa += f.ag[i]
      sfg += f.cf[i] + f.po[i]
      sw += f.wet[i]
      cnt++
    }
    return {
      meanDensity: sd / cnt, maxDensity: mx, meanProgress: sp / cnt, halideLeft: sx / cnt,
      residualHypo: sr / cnt, retainedSilver: sa / cnt, fog: sfg / cnt, wet: sw / cnt,
    }
  }

  // -------------------------------------------------------------------------
  // Save states
  // -------------------------------------------------------------------------

  /**
   * Binary save state (see snapshot.ts): JSON header + uint16-quantised fields,
   * all-zero fields skipped, derived d1/d2 recomputed on load. ~1.8 MB at
   * 320x256 (0.8 MB gzipped).
   */
  toBytes(): Uint8Array {
    const header = {
      kind: 'silver', v: 1, w: this.w, h: this.h, areaM2: this.areaM2, spec: this.model.spec,
      lastDevRate: this.lastDevRate, devStarted: this.devStarted, cMax: this.cMax, hcaTreated: this.hcaTreated,
      fixSeconds: this.fixSeconds, times: this.times, lastBath: this.lastBath,
    }
    return packFields(header, this.f, SILVER_FIELDS.filter((k) => k !== 'd1' && k !== 'd2'))
  }

  static fromBytes(bytes: Uint8Array): SilverSheet {
    const { header: h, fields } = unpackFields(bytes)
    const s = new SilverSheet(h.spec as PaperSpec, h.w as number, h.h as number, h.areaM2 as number)
    s.lastDevRate = h.lastDevRate as number
    s.devStarted = !!h.devStarted
    s.cMax = (h.cMax as number | undefined) ?? 1
    s.hcaTreated = !!h.hcaTreated
    s.fixSeconds = h.fixSeconds as number
    s.lastBath = h.lastBath as SilverSheet['lastBath']
    Object.assign(s.times, h.times)
    for (const [k, a] of Object.entries(fields)) s.f[k as SilverField].set(a)
    s.dirty1 = true
    s.dirty2 = true
    s.recompute()
    return s
  }
}

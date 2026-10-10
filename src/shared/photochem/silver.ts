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
//
// Performance notes (this is the optimised port of the spike): curves and
// reciprocity are read from log-spaced tables, exp/10^x/softmin are table or
// polynomial driven, per-pixel exponentials of the bath coupling are cached
// while the contact value does not change, and `simScale: 0.5` runs all fields
// at half resolution with a bilinear upsample in render().

import { type Bands, actinic, rgbToBands } from './bands.ts'
import {
  type AirBath, type DeveloperBath, type FixerBath, type HypoClearBath, type SilverBath, type StopBath, type TonerBath, type WashBath,
  consumeDeveloper, developerRates, fixerRates, stopTau, washTauFactor,
} from './baths.ts'
import { type RGB, LUT_N, SRGB_LUT, linToByte } from './color.ts'
import { LN10, LinLut, POW10NEG, SOFT_CORR, curveLut, recipLut } from './fast.ts'
import { type PaperModel, type PaperSpec, componentGains, makePaper } from './paper.ts'
import { box2, sheetMetrics, upsample2ToRGBA8 } from './grid.ts'
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
  /** Per-pixel transmission 0..1: the negative (10^-D), a dodging hand, a coin. Output (w*h) or simulation resolution. */
  mask?: ArrayLike<number> | null
}

export interface ProcessOpts {
  /** Per-pixel liquid contact 0..1 from the tray simulation. Omitted = full contact. Output (w*h) or simulation resolution. */
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

export interface SilverStats {
  /** Mean observed (neutral) reflection density relative to a perfect white, whole sheet. */
  meanD: number
  /** Largest observed density (sampled). */
  dmax: number
  /** Mean observed density in the outer 4% border (paper white + fog + safelight fog). */
  borderD: number
  /** Fraction of the sheet the developer has touched. */
  coverage: number
  /** Mottling: mean local standard deviation of observed density (0 = perfectly even). */
  evenness: number
  /** 1 - mean unfixed halide. */
  fixedFraction: number
  /** Mean wetness 0..1. */
  wetMean: number
  // --- spike-compatible detail ---
  meanDensity: number
  maxDensity: number
  meanProgress: number
  halideLeft: number
  residualHypo: number
  retainedSilver: number
  fog: number
  wet: number
}

// Constants (see NOTES.md for rationale)
const SCREEN_K = 0.55 // light passes the silver once: transmission density ≈ 0.55 x reflection density
const DESENS_K = 1.0 // bromide/oxidation-product desensitisation of halide next to developed silver
const PO_K = 4e-7 // print-out density per effective lux·s on unfixed halide (~5 min of room light -> lilac)
const DEPLETE = 0.5 // local developer depletion per unit of density developed
const C_AIR_TAU = 25 // developer in a lifted print keeps working, decaying over ~25 s
const FOG_INDUCTION = 25 // reference seconds before chemical fog starts
const CARRY_L_PER_M2 = 0.08 // liquid carried between trays
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
/** Print-out density from accumulated print-out exposure: 1.2 (1 - exp(-x / 1.2)). */
const PRINTOUT_CURVE = new LinLut((x) => 1.2 * (1 - Math.exp(-x / 1.2)), 24, 24 * 128)

export interface SilverOpts {
  /** Physical sheet area (m²); 8x10 inch by default. Scales chemistry consumption. */
  areaM2?: number
  /** 0.5 runs the chemistry fields at half resolution and upsamples in render(). */
  simScale?: 1 | 0.5
}

export class SilverSheet {
  readonly model: PaperModel
  /** Output (render) resolution. */
  readonly w: number
  readonly h: number
  /** Simulation resolution (= w x h unless simScale is 0.5). Fields in `f` have sw*sh entries. */
  readonly sw: number
  readonly sh: number
  /** Number of simulated pixels (sw * sh). */
  readonly n: number
  readonly simScale: 1 | 0.5
  /** Physical sheet area (m²); 8x10 inch by default. Scales chemistry consumption. */
  readonly areaM2: number
  readonly f: Record<SilverField, Float32Array>

  /** Seconds the sheet has spent in each kind of bath (logbook). */
  readonly times: Record<string, number> = {}
  /** Development rate of the last developer, for development that continues in stop/air. */
  lastDevRate = 0
  hcaTreated = false
  fixSeconds = 0
  /** True once the sheet has seen developer. */
  devStarted = false
  /** Bumped by every call that changes the sheet; lets a game skip render() when nothing happened. */
  version = 0

  private dirty1 = false
  private dirty2 = false
  private toned = false
  private aged = false
  private lastBath: SilverBath['kind'] | 'none' = 'none'
  private scratch: Float32Array
  /** Largest developer activity left in the emulsion (drives sub-stepping). */
  private cMax = 0
  private devTinted = false
  private hasSecond = false
  private hcaTime = 0
  private fitA: Float32Array | null = null
  private fitB: Float32Array | null = null
  private lin: Float32Array

  constructor(model: PaperModel | PaperSpec, w: number, h: number, opts: number | SilverOpts = {}) {
    const o: SilverOpts = typeof opts === 'number' ? { areaM2: opts } : opts
    this.model = 'hard' in model ? model : makePaper(model)
    this.w = w
    this.h = h
    this.simScale = o.simScale === 0.5 ? 0.5 : 1
    this.sw = this.simScale === 1 ? w : Math.max(1, Math.ceil(w / 2))
    this.sh = this.simScale === 1 ? h : Math.max(1, Math.ceil(h / 2))
    this.n = this.sw * this.sh
    this.areaM2 = o.areaM2 ?? 0.0516
    const f = {} as Record<SilverField, Float32Array>
    for (const k of SILVER_FIELDS) f[k] = new Float32Array(this.n)
    f.x.fill(1)
    f.dcap.fill(1)
    this.f = f
    this.scratch = new Float32Array(this.n)
    this.lin = new Float32Array(this.n * 4)
  }

  // -------------------------------------------------------------------------
  // Field plumbing (output resolution <-> simulation resolution)
  // -------------------------------------------------------------------------

  /** A per-pixel input at sim resolution: passed through if already that size, else box-downsampled. */
  private fit(src: ArrayLike<number> | null | undefined, slot: 0 | 1): ArrayLike<number> | null {
    if (!src) return null
    if (this.simScale === 1 || src.length === this.n) return src
    const buf = slot === 0 ? (this.fitA ??= new Float32Array(this.n)) : (this.fitB ??= new Float32Array(this.n))
    box2(src, this.w, this.h, this.sw, this.sh, buf)
    return buf
  }

  /** Output pixel index -> simulation pixel index. */
  private simIndex(i: number): number {
    if (this.simScale === 1) return i
    const x = i % this.w
    const y = (i / this.w) | 0
    return (y >> 1) * this.sw + (x >> 1)
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
    const mask = this.fit(opts.mask, 0)
    if (this.devStarted && this.dirty1) this.recompute()
    this.version++
    const gh = g.hard
    const gs = g.soft
    const m = this.model
    const etaH = recipLut(m.hard.recip)
    const etaS = m.soft ? recipLut(m.soft.recip) : null
    // Without a mask the intensity is the same everywhere: evaluate reciprocity once.
    const uh = gh > 0 ? gh * etaH.at(gh) * seconds : 0
    const us = etaS && gs > 0 ? gs * etaS.at(gs) * seconds : 0
    const { Hh, Hs, H2h, H2s, x, p1, p2, c, d1, d2, po } = this.f
    const dmaxInt = m.dmaxInt
    const kScreen = -LN10 * (SCREEN_K + DESENS_K)
    const n = this.n
    let d1Dirty = false
    let d2Dirty = false
    for (let i = 0; i < n; i++) {
      const sens = x[i]
      if (sens < 1e-5) continue
      let dh: number
      let ds: number
      let Isum: number
      if (mask) {
        const T = mask[i]
        if (!(T > 0)) continue
        const Ih = gh * T
        const Is = gs * T
        Isum = Ih + Is
        if (!(Isum > 0)) continue
        dh = Ih > 0 ? Ih * etaH.at(Ih) * seconds * sens : 0
        ds = etaS && Is > 0 ? Is * etaS.at(Is) * seconds * sens : 0
      } else {
        Isum = gh + gs
        if (!(Isum > 0)) continue
        dh = uh * sens
        ds = us * sens
      }
      if (p1[i] > 0.01 || c[i] > 0.02) {
        // Development has begun: new light makes a second latent image. Existing silver screens it
        // optically, its development products desensitise the halide around it, and the grains already
        // developed are no longer halide at all. Together: the Sabattier effect.
        const D1 = d1[i]
        const D2 = d2[i]
        const dNow = p1[i] * (D1 < dmaxInt ? D1 : dmaxInt) + p2[i] * (D2 < dmaxInt ? D2 : dmaxInt)
        const left = 1 - dNow / dmaxInt
        const screen = dNow > 0 ? Math.exp(kScreen * dNow) * (left > 0 ? left : 0) : 1
        H2h[i] += dh * screen
        H2s[i] += ds * screen
        d2Dirty = true
      } else {
        Hh[i] += dh
        Hs[i] += ds
        d1Dirty = true
      }
      po[i] += PO_K * Isum * seconds * sens
    }
    if (d1Dirty) this.dirty1 = true
    if (d2Dirty) {
      this.dirty2 = true
      this.hasSecond = true
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
    this.version++
    const etaH = recipLut(m.hard.recip)
    const etaS = m.soft ? recipLut(m.soft.recip) : null
    const { Hh, Hs, H2h, H2s, x, p1, p2, c, d1, d2, po } = this.f
    const full = this.simScale === 0.5 && rgb.length === 3 * this.w * this.h
    const { w, h, sw } = this
    for (let i = 0; i < this.n; i++) {
      const sens = x[i]
      if (sens < 1e-5) continue
      let r: number
      let g: number
      let b: number
      if (full) {
        const sx = i % sw
        const sy = (i / sw) | 0
        const x0 = sx * 2
        const x1 = Math.min(w - 1, x0 + 1)
        const y0 = sy * 2
        const y1 = Math.min(h - 1, y0 + 1)
        const a = 3 * (y0 * w + x0)
        const bb = 3 * (y0 * w + x1)
        const cc = 3 * (y1 * w + x0)
        const dd = 3 * (y1 * w + x1)
        r = 0.25 * (rgb[a] + rgb[bb] + rgb[cc] + rgb[dd])
        g = 0.25 * (rgb[a + 1] + rgb[bb + 1] + rgb[cc + 1] + rgb[dd + 1])
        b = 0.25 * (rgb[a + 2] + rgb[bb + 2] + rgb[cc + 2] + rgb[dd + 2])
      } else {
        r = rgb[3 * i]
        g = rgb[3 * i + 1]
        b = rgb[3 * i + 2]
      }
      const Ih = wh[0] * r + wh[1] * g + wh[2] * b
      const Is = ws[0] * r + ws[1] * g + ws[2] * b
      if (!(Ih + Is > 0)) continue
      const dh = Ih > 0 ? Ih * etaH.at(Ih) * seconds * sens : 0
      const ds = etaS && Is > 0 ? Is * etaS.at(Is) * seconds * sens : 0
      if (p1[i] > 0.01 || c[i] > 0.02) {
        const dNow = p1[i] * Math.min(d1[i], m.dmaxInt) + p2[i] * Math.min(d2[i], m.dmaxInt)
        const screen = Math.exp(-LN10 * (SCREEN_K + DESENS_K) * dNow) * Math.max(0, 1 - dNow / m.dmaxInt)
        H2h[i] += dh * screen
        H2s[i] += ds * screen
        this.dirty2 = true
        this.hasSecond = true
      } else {
        Hh[i] += dh
        Hs[i] += ds
        this.dirty1 = true
      }
      po[i] += PO_K * (Ih + Is) * seconds * sens
    }
  }

  /** Recompute cached developed-density targets after exposure changes. */
  recompute(): void {
    const m = this.model
    const { Hh, Hs, H2h, H2s, d1, d2 } = this.f
    const lh = curveLut(m.hard.curve)
    const ls = m.soft ? curveLut(m.soft.curve) : null
    const n = this.n
    if (this.dirty1) {
      if (ls) for (let i = 0; i < n; i++) d1[i] = lh.at(Hh[i]) + ls.at(Hs[i])
      else for (let i = 0; i < n; i++) d1[i] = lh.at(Hh[i])
      this.dirty1 = false
    }
    if (this.dirty2) {
      for (let i = 0; i < n; i++) {
        const a = H2h[i]
        const b = H2s[i]
        d2[i] = a > 0 || b > 0 ? lh.at(a) + (ls ? ls.at(b) : 0) : 0
      }
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
    this.version++
    // While developer is live in the emulsion, big jumps are sub-stepped so a 30 s
    // jump matches 1800 frames at 60 Hz (depletion and exchange couple to the
    // development rate). Once it has died away, the rest is one exact step.
    const rep: StepReport = { silverG: 0, halideRemovedG: 0, meanDev: 0 }
    const contact = this.fit(opts.contact, 1)
    const o: ProcessOpts = contact === opts.contact ? opts : { contact, agitation: opts.agitation, diffuse: opts.diffuse }
    let remaining = dt
    while (remaining > 1e-9) {
      const live = bath.kind === 'developer' || this.cMax > 1e-3
      const step = live ? Math.min(MAX_STEP, remaining) : remaining
      const r = this.dispatch(bath, step, o)
      rep.silverG += r.silverG
      rep.halideRemovedG += r.halideRemovedG
      rep.meanDev = r.meanDev
      remaining -= step
    }
    return rep
  }

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
    const tauEx = 1 / (0.1 + agit) // boundary-layer exchange: still 10 s, rocking ~0.9 s (a still tray is ~30% slower to finish)
    const dmaxInt = m.dmaxInt
    const invDmax = 1 / dmaxInt
    const seedLo = m.seedLo
    const seedSpan = m.seedHi - m.seedLo
    const fogDt = rates.fog * dt
    const rPaper = rates.paper // R / refRate: reference-developer seconds per second at full activity
    const dmaxF = rates.dmaxFactor
    const warmth = rates.warmth
    // A fresh developer (dmaxFactor 1, no warmth) leaves dcap = 1 and warm = 0 untouched.
    if (dmaxF !== 1 || warmth !== 0) this.devTinted = true
    const nonTrivial = this.devTinted
    const n = this.n
    let silver = 0
    let devSum = 0
    let cMax = 0
    // Bath-coupling constants for the current contact value (cached while it does not change).
    let lastCc = -1
    let e = 0
    let ratio = 0
    for (let i = 0; i < n; i++) {
      const cc = contact ? contact[i] : 1
      const c0 = c[i]
      if (cc <= 0 && c0 <= 1e-5) {
        c[i] = 0
        continue
      }
      if (cc !== lastCc) {
        lastCc = cc
        // Exchange with the bath where liquid touches; slow decay where it doesn't.
        const tauI = cc > 0 ? tauEx / (cc > 0.05 ? cc : 0.05) : C_AIR_TAU
        e = Math.exp(-dt / tauI)
        ratio = (tauI / dt) * (1 - e) // exact time-average of the exponential approach (frame-rate independent)
      }
      const dc = c0 - cc
      let c1 = cc + dc * e
      const cm = cc + dc * ratio
      const rate = R * cm
      const D1 = d1[i]
      const F = D1 < dmaxInt ? D1 * invDmax : 1
      const p0 = p1[i]
      // Exact autocatalytic step (kinetics.devStep inlined; b = 1).
      let pn = p0
      if (p0 >= 1) pn = 1
      else {
        const a = seedLo + seedSpan * F
        const k = (a + 1) * rate * dt
        if (k > 60) pn = 1
        else if (k > 0) {
          const A = (a + p0) * (k < 0.35 ? 1 + k * (1 + k * (0.5 + k * (1 / 6 + k * (1 / 24 + k * (1 / 120 + k * (1 / 720)))))) : Math.exp(k))
          const B = 1 - p0
          pn = (A - a * B) / (A + B)
          if (pn > 1) pn = 1
          else if (pn < p0) pn = p0
        }
      }
      const dp = pn - p0
      p1[i] = pn
      let dD = dp * (D1 < dmaxInt ? D1 : dmaxInt)
      const D2 = d2[i]
      if (D2 > 0) {
        const q0 = p2[i]
        const F2 = D2 < dmaxInt ? D2 * invDmax : 1
        let qn = q0
        if (q0 >= 1) qn = 1
        else {
          const a2 = seedLo + seedSpan * F2
          const k2 = (a2 + 1) * rate * dt
          if (k2 > 60) qn = 1
          else if (k2 > 0) {
            const A2 = (a2 + q0) * Math.exp(k2)
            const B2 = 1 - q0
            qn = (A2 - a2 * B2) / (A2 + B2)
            if (qn > 1) qn = 1
            else if (qn < q0) qn = q0
          }
        }
        p2[i] = qn
        dD += (qn - q0) * (D2 < dmaxInt ? D2 : dmaxInt)
      }
      silver += dD
      c1 -= DEPLETE * dD
      c1 = c1 > 0 ? c1 : 0
      c[i] = c1
      if (c1 > cMax) cMax = c1
      const t1 = tau[i] + rPaper * cm * dt
      tau[i] = t1
      if (t1 > FOG_INDUCTION) cf[i] += fogDt * cm
      if (dp > 0 && nonTrivial) {
        const wgt = dp / (pn + 1e-6)
        dcap[i] += (dmaxF - dcap[i]) * wgt
        warm[i] += (warmth - warm[i]) * wgt
      }
      if (contact && cc > 0) wet[i] = 1
      devSum += pn
    }
    if (!contact) wet.fill(1) // everything touched the liquid
    if (opts.diffuse) this.blurField(c)
    this.cMax = cMax
    const grams = (silver * invDmax) * m.silverGm2 * (this.areaM2 / n)
    consumeDeveloper(bath, grams)
    return { silverG: grams, halideRemovedG: 0, meanDev: devSum / n }
  }

  /** Development that continues on the developer carried in the emulsion while c decays with tau. */
  private carryOn(dt: number, tauC: number, contact: ArrayLike<number> | null): void {
    const R = this.lastDevRate
    const { d1, d2, p1, p2, c, wet } = this.f
    const m = this.model
    const invDmax = 1 / m.dmaxInt
    const seedLo = m.seedLo
    const seedSpan = m.seedHi - m.seedLo
    const n = this.n
    // log k, so k^cc = exp(cc * lnK)
    const lnK = -dt / tauC
    const lnAir = -dt / C_AIR_TAU
    let cMax = 0
    let lastCc = -1
    let kk = 0
    let lnkk = 0
    for (let i = 0; i < n; i++) {
      const c0 = c[i]
      if (c0 <= 1e-4) {
        c[i] = 0
        continue
      }
      const cc = contact ? contact[i] : 1
      if (cc !== lastCc) {
        lastCc = cc
        lnkk = cc > 0 ? lnK * cc + lnAir * (1 - cc) : lnAir
        kk = Math.exp(lnkk)
      }
      const c1 = c0 * kk
      const cm = kk < 1 ? (c0 - c1) / -lnkk : c0 // exact mean of an exponential decay
      c[i] = c1
      if (c1 > cMax) cMax = c1
      if (R <= 0) continue
      const D1 = d1[i]
      const F = D1 < m.dmaxInt ? D1 * invDmax : 1
      const rate = R * cm
      // devStep inlined (b = 1)
      const p0 = p1[i]
      if (p0 < 1) {
        const a = seedLo + seedSpan * F
        const k = (a + 1) * rate * dt
        if (k > 60) p1[i] = 1
        else if (k > 0) {
          const A = (a + p0) * (k < 0.35 ? 1 + k * (1 + k * (0.5 + k * (1 / 6 + k * (1 / 24 + k * (1 / 120 + k * (1 / 720)))))) : Math.exp(k))
          const B = 1 - p0
          let pn = (A - a * B) / (A + B)
          if (pn > 1) pn = 1
          else if (pn < p0) pn = p0
          p1[i] = pn
        }
      }
      if (d2[i] > 0) {
        const q0 = p2[i]
        if (q0 < 1) {
          const k = (seedLo + 1) * rate * dt
          if (k > 60) p2[i] = 1
          else if (k > 0) {
            const A = (seedLo + q0) * Math.exp(k)
            const B = 1 - q0
            let qn = (A - seedLo * B) / (A + B)
            if (qn > 1) qn = 1
            else if (qn < q0) qn = q0
            p2[i] = qn
          }
        }
      }
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
    const invDmax = 1 / m.dmaxInt
    const dmaxInt = m.dmaxInt
    const fixAbsorb = m.fixAbsorb
    const retention = rr.retention
    const n = this.n
    let removed = 0
    let lastCc = -1
    let kx = 1
    let kr = 0
    for (let i = 0; i < n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      if (cc !== lastCc) {
        lastCc = cc
        kx = Math.exp(-k * cc * dt)
        kr = 1 - Math.exp((-dt * cc) / rTau)
      }
      const x0 = x[i]
      const x1 = x0 * kx
      x[i] = x1
      const D1 = d1[i]
      const developed = Math.min(1, (p1[i] * (D1 < dmaxInt ? D1 : dmaxInt)) * invDmax)
      const fixed = (x0 - x1) * (1 - developed)
      removed += fixed
      r[i] += (fixAbsorb - r[i]) * kr
      ag[i] += retention * fixed * 0.6
      if (etch > 0) red[i] += etch * cc
      wet[i] = 1
    }
    const grams = removed * m.silverGm2 * (this.areaM2 / n)
    bath.silverG += grams
    return { silverG: 0, halideRemovedG: grams, meanDev: 0 }
  }

  private washStep(bath: WashBath, dt: number, opts: ProcessOpts): StepReport {
    const m = this.model
    this.carryOn(dt, 3, opts.contact ?? null)
    const tau = (this.hcaTreated ? m.washTauHCA : m.washTau) * washTauFactor(bath)
    const { r, ag, wet } = this.f
    const contact = opts.contact ?? null
    const lnKr = -dt / tau
    const lnKa = -dt / (tau * 25)
    const n = this.n
    let lastCc = -1
    let kr = 1
    let ka = 1
    for (let i = 0; i < n; i++) {
      const cc = contact ? contact[i] : 1
      if (cc <= 0) continue
      if (cc !== lastCc) {
        lastCc = cc
        const q = cc >= 1 ? 1 : cc
        kr = Math.exp(lnKr * q)
        ka = Math.exp(lnKa * q)
      }
      r[i] *= kr
      ag[i] *= ka
      wet[i] = 1
    }
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private hcaStep(_bath: HypoClearBath, dt: number, opts: ProcessOpts): StepReport {
    this.carryOn(dt, 3, opts.contact ?? null)
    this.hcaTime += dt
    if (this.hcaTime >= 60) this.hcaTreated = true
    const { r, wet } = this.f
    const k = Math.exp(-dt / 240)
    const n = this.n
    for (let i = 0; i < n; i++) {
      r[i] *= k
      wet[i] = 1
    }
    return { silverG: 0, halideRemovedG: 0, meanDev: 0 }
  }

  private tonerStep(bath: TonerBath, dt: number, opts: ProcessOpts): StepReport {
    const s = Math.max(0, bath.strength)
    const { se, bl, sf, red, wet, x } = this.f
    const contact = opts.contact ?? null
    this.toned = true
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
    const w = this.sw
    const h = this.sh
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
    this.aged = true
    this.version++
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

  /** Intrinsic silver density at output pixel i (before surface floor and tint). */
  silverDensity(i: number): number {
    if (this.dirty1 || this.dirty2) this.recompute()
    return this.silverDensityAt(this.simIndex(i))
  }

  private silverDensityAt(j: number): number {
    const m = this.model
    const f = this.f
    const a = f.p1[j] * f.d1[j] + (this.hasSecond ? f.p2[j] * f.d2[j] : 0)
    const cap = this.devTinted ? m.dmaxInt * f.dcap[j] : m.dmaxInt
    const d = a < cap ? cap - a : a - cap
    let D = (a < cap ? a : cap) - m.capSoft * SOFT_CORR.at(d / m.capSoft) + m.fog * f.p1[j] + f.cf[j] - f.red[j]
    if (D < 0) D = 0
    if (this.aged) D *= 1 - f.fade[j]
    const wet = f.wet[j]
    if (wet < 1) {
      const u = Math.min(1, D / m.dmaxInt)
      D *= 1 + m.drydown * (1 - wet) * 4 * u * (1 - u)
    }
    return D
  }

  /**
   * Linear-RGB reflectance of simulated pixels j0..j1-1 under white light,
   * written as r,g,b (+ wetness in the 4th slot) to buf at `stride` floats per
   * pixel. This is the one place colour is computed; everything is hoisted and
   * table-driven because it is the hottest loop in the module.
   */
  private shadeRange(j0: number, j1: number, buf: Float32Array, stride: number): void {
    const m = this.model
    const f = this.f
    const { p1, d1, p2, d2, dcap, cf, red, fade, wet, warm, po, x, stain, se, bl, sf } = f
    const dmaxInt = m.dmaxInt
    const invDmax = 1 / dmaxInt
    const capSoft = m.capSoft
    const invCap = 1 / capSoft
    const fogK = m.fog
    const drydown = m.drydown
    const sDry = m.surfaceDry
    const sWet = m.surfaceWet
    const w0 = m.white[0]
    const w1 = m.white[1]
    const w2 = m.white[2]
    const it0 = m.imageTint[0]
    const it1 = m.imageTint[1]
    const it2 = m.imageTint[2]
    const aged = this.aged
    const toned = this.toned
    const useSecond = this.hasSecond
    const tinted = this.devTinted
    const T10 = POW10NEG.tbl
    const T10s = POW10NEG.scale
    const T10top = T10.length - 2
    const SC = SOFT_CORR.tbl
    const SCs = SOFT_CORR.scale
    const SCtop = SC.length - 2
    const PO = PRINTOUT_CURVE.tbl
    const POs = PRINTOUT_CURVE.scale
    const POtop = PO.length - 2
    let o = 0
    for (let j = j0; j < j1; j++, o += stride) {
      const p1v = p1[j]
      const a = useSecond ? p1v * d1[j] + p2[j] * d2[j] : p1v * d1[j]
      const cap = tinted ? dmaxInt * dcap[j] : dmaxInt
      const dd = a < cap ? cap - a : a - cap
      const tc = dd * invCap * SCs
      let corr: number
      if (tc >= SCtop) corr = SC[SCtop]
      else {
        const k = tc | 0
        corr = SC[k] + (SC[k + 1] - SC[k]) * (tc - k)
      }
      let D = (a < cap ? a : cap) - capSoft * corr + fogK * p1v + cf[j] - red[j]
      if (D < 0) D = 0
      if (aged) D *= 1 - fade[j]
      const wv = wet[j]
      if (wv < 1) {
        let u = D * invDmax
        if (u > 1) u = 1
        D *= 1 + drydown * (1 - wv) * 4 * u * (1 - u)
      }
      const s = sWet * wv + sDry * (1 - wv)
      const wm = tinted ? warm[j] : 0
      let t0 = it0
      let t1 = it1
      let t2 = it2
      if (wm > 0) {
        t0 += (WARM_TINT[0] - t0) * wm
        t1 += (WARM_TINT[1] - t1) * wm
        t2 += (WARM_TINT[2] - t2) * wm
      }
      let silver = D
      let sulf = 0
      let blch = 0
      if (toned) {
        const blv = bl[j]
        const sfv = sf[j]
        const sev = se[j]
        silver = D * Math.max(0, 1 - blv - sfv) * (1 + 0.1 * sev)
        if (sev > 0) {
          t0 += (SELENIUM_TINT[0] - t0) * sev
          t1 += (SELENIUM_TINT[1] - t1) * sev
          t2 += (SELENIUM_TINT[2] - t2) * sev
        }
        sulf = D * sfv * 0.92
        blch = D * blv * 0.05
      }
      const pov = po[j]
      let pr = 0
      if (pov > 0) {
        const tp = pov * POs
        if (tp >= POtop) pr = PO[POtop]
        else {
          const k = tp | 0
          pr = PO[k] + (PO[k + 1] - PO[k]) * (tp - k)
        }
      }
      const st = aged ? stain[j] : 0
      const xh = x[j]
      let d0 = silver * t0 + pr * PRINTOUT_TINT[0] + st * STAIN_TINT[0] + xh * HALIDE_TINT[0]
      let d1v = silver * t1 + pr * PRINTOUT_TINT[1] + st * STAIN_TINT[1] + xh * HALIDE_TINT[1]
      let d2v = silver * t2 + pr * PRINTOUT_TINT[2] + st * STAIN_TINT[2] + xh * HALIDE_TINT[2]
      if (sulf > 0 || blch > 0) {
        d0 += sulf * SEPIA_TINT[0] + blch * STAIN_TINT[0]
        d1v += sulf * SEPIA_TINT[1] + blch * STAIN_TINT[1]
        d2v += sulf * SEPIA_TINT[2] + blch * STAIN_TINT[2]
      }
      const k1 = 1 - s
      let q = d0 * T10s
      let r: number
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o] = k1 * w0 * r + s
      q = d1v * T10s
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o + 1] = k1 * w1 * r + s
      q = d2v * T10s
      if (q >= T10top) r = T10[T10top]
      else {
        const k = q | 0
        r = T10[k] + (T10[k + 1] - T10[k]) * (q - k)
      }
      buf[o + 2] = k1 * w2 * r + s
    }
  }

  /** Linear-RGB reflectance of output pixel i under white light. */
  reflectance(i: number, out: RGB = [0, 0, 0]): RGB {
    if (this.dirty1 || this.dirty2) this.recompute()
    const t = this.lin
    const j = this.simIndex(i)
    this.shadeRange(j, j + 1, t, 4)
    out[0] = t[0]
    out[1] = t[1]
    out[2] = t[2]
    return out
  }

  /**
   * Render to RGBA8 (sRGB, w*h*4). `illum` multiplies the reflectance in linear
   * light (safelight colour x level, or [1,1,1] for daylight viewing). Alpha is
   * the wetness (0 dry .. 255 soaked) so the paper shader can drive gloss from
   * it; pass `{ opaque: true }` to get 255 instead (for putImageData).
   */
  render(out: Uint8ClampedArray, illum: RGB = [1, 1, 1], opts: { opaque?: boolean } = {}): void {
    if (this.dirty1 || this.dirty2) this.recompute()
    const lin = this.lin
    const wetF = this.f.wet
    const n = this.n
    this.shadeRange(0, n, lin, 4)
    const i0 = illum[0]
    const i1 = illum[1]
    const i2 = illum[2]
    const opaque = !!opts.opaque
    if (this.simScale === 1) {
      const lut = SRGB_LUT
      const top = LUT_N
      for (let j = 0, o = 0; j < n; j++, o += 4) {
        const r = lin[o] * i0
        const g = lin[o + 1] * i1
        const b = lin[o + 2] * i2
        out[o] = r >= 1 ? 255 : r > 0 ? lut[(r * top + 0.5) | 0] : 0
        out[o + 1] = g >= 1 ? 255 : g > 0 ? lut[(g * top + 0.5) | 0] : 0
        out[o + 2] = b >= 1 ? 255 : b > 0 ? lut[(b * top + 0.5) | 0] : 0
        out[o + 3] = opaque ? 255 : (wetF[j] * 255 + 0.5) | 0
      }
      return
    }
    // Half-resolution simulation: bilinear upsample in linear light.
    const { w, h, sw, sh } = this
    for (let j = 0; j < n; j++) lin[4 * j + 3] = wetF[j]
    upsample2ToRGBA8(lin, sw, sh, w, h, out, illum, linToByte, opaque ? () => 255 : (a) => (a * 255 + 0.5) | 0)
  }

  /** Observed (neutral, luminance-weighted) reflection density at output pixel i, relative to a perfect white. */
  observedDensity(i: number): number {
    if (this.dirty1 || this.dirty2) this.recompute()
    return this.observedAt(this.simIndex(i))
  }

  private observedAt(j: number): number {
    const t = this.lin
    this.shadeRange(j, j + 1, t, 4)
    return -Math.log10(Math.max(1e-6, 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]))
  }

  /** Measurements for score cards and HUDs. Samples at most ~4k pixels, so it is cheap to call every frame. */
  stats(): SilverStats {
    if (this.dirty1 || this.dirty2) this.recompute()
    const f = this.f
    const { sw, sh, n } = this
    let sp = 0
    let sx = 0
    let sr = 0
    let sa = 0
    let sfg = 0
    let sw_ = 0
    let touched = 0
    const step = Math.max(1, Math.floor(n / 4096))
    let cnt = 0
    for (let j = 0; j < n; j += step) {
      sp += f.p1[j]
      sx += f.x[j]
      sr += f.r[j]
      sa += f.ag[j]
      sfg += f.cf[j] + f.po[j]
      sw_ += f.wet[j]
      if (f.tau[j] > 0.25) touched++
      cnt++
    }
    const met = sheetMetrics((j) => this.observedAt(j), sw, sh)
    return {
      meanD: met.meanD, dmax: met.dmax, borderD: met.borderD, coverage: touched / cnt, evenness: met.evenness,
      fixedFraction: 1 - sx / cnt, wetMean: sw_ / cnt,
      meanDensity: met.meanD, maxDensity: met.dmax, meanProgress: sp / cnt, halideLeft: sx / cnt,
      residualHypo: sr / cnt, retainedSilver: sa / cnt, fog: sfg / cnt, wet: sw_ / cnt,
    }
  }

  // -------------------------------------------------------------------------
  // Save states
  // -------------------------------------------------------------------------

  /**
   * Binary save state (see snapshot.ts): JSON header + uint16-quantised fields,
   * all-zero fields skipped, derived d1/d2 recomputed on load. ~1.8 MB at
   * 320x256 (0.8 MB gzipped); a quarter of that at simScale 0.5.
   */
  toBytes(): Uint8Array {
    const header = {
      kind: 'silver', v: 1, w: this.w, h: this.h, areaM2: this.areaM2, simScale: this.simScale, spec: this.model.spec,
      lastDevRate: this.lastDevRate, devStarted: this.devStarted, cMax: this.cMax, hcaTreated: this.hcaTreated,
      hcaTime: this.hcaTime, fixSeconds: this.fixSeconds, times: this.times, lastBath: this.lastBath, toned: this.toned, aged: this.aged,
    }
    return packFields(header, this.f, SILVER_FIELDS.filter((k) => k !== 'd1' && k !== 'd2'))
  }

  static fromBytes(bytes: Uint8Array): SilverSheet {
    const { header: h, fields } = unpackFields(bytes)
    const s = new SilverSheet(h.spec as PaperSpec, h.w as number, h.h as number, {
      areaM2: h.areaM2 as number, simScale: (h.simScale as 1 | 0.5 | undefined) ?? 1,
    })
    s.lastDevRate = h.lastDevRate as number
    s.devStarted = !!h.devStarted
    s.cMax = (h.cMax as number | undefined) ?? 1
    s.hcaTreated = !!h.hcaTreated
    s.hcaTime = (h.hcaTime as number | undefined) ?? (s.hcaTreated ? 60 : 0)
    s.fixSeconds = h.fixSeconds as number
    s.lastBath = h.lastBath as SilverSheet['lastBath']
    // Older saves have no flags: assume the optional paths are live if their fields were stored.
    s.toned = h.toned !== undefined ? !!h.toned : 'se' in fields || 'bl' in fields || 'sf' in fields
    s.aged = h.aged !== undefined ? !!h.aged : 'stain' in fields || 'fade' in fields
    Object.assign(s.times, h.times)
    for (const [k, a] of Object.entries(fields)) s.f[k as SilverField].set(a)
    s.devTinted = true
    s.hasSecond = true
    s.dirty1 = true
    s.dirty2 = true
    s.recompute()
    return s
  }
}

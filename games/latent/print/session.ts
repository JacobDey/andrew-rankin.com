// The live printing session: enlarger state, the sheet on the easel, exposure with dodge/burn and the
// test strip, the three trays (shared shallow-water fluid) with development, stop, fix and fog (GDD §5.5–5.8).
import { TrayFluid } from '@shared/fluid'
import { clamp } from '@shared/core'
import type { DetailSpec, EnlargerState, FactId, FrameImage, FrameRef, Grade, Negative, PrintOps, PrintRecord } from '../core/types'
import { CELL_MM, D_MAX, PH, PW, cardHole, devDensity, dStar, egFor, intensity, phiStar, projectT, tInduction, wandShadow } from './optics'
import { evaluateDetail, evaluateLegibility, type LegResult } from './simulate'

export type TrayId = 'dev' | 'stop' | 'fix'
export interface Sheet {
  id: string; ref: FrameRef | null; tutorial: boolean
  E: Float32Array; D: Float32Array; tDev: Float32Array; Dst: Float32Array; tInd: Float32Array
  where: 'easel' | TrayId; F: number; act: number; fogged: boolean; exposed: number; devTime: number
  x: number; y: number; vx: number; vy: number
  ops: PrintOps; dodge: boolean; burn: boolean; legible: LegResult[] | null; evaluated: boolean
}

export interface Tray { id: TrayId; fluid: TrayFluid; tiltX: number; tiltY: number; vX: number; vY: number; targetX: number; targetY: number; energy: number }

const TRAY_W = 0.32, TRAY_H = 0.24
export function makeTray(id: TrayId): Tray {
  const fluid = new TrayFluid({ nx: 32, ny: 24, dx: 0.01, depth: 0.012, lip: 0.03, damping: 0.6 })
  return { id, fluid, tiltX: 0, tiltY: 0, vX: 0, vY: 0, targetX: 0, targetY: 0, energy: 0 }
}

export class PrintSession {
  enl: EnlargerState = { ref: null, M: 4, cx: 18, cy: 12, focus: phiStar(4), flip: false, grade: 2, timer: 8, redFilter: true, lampOn: false, tool: 'wand', toolZ: 0.3 }
  neg: Negative | null = null
  img: FrameImage | null = null
  details: DetailSpec[] = []
  T = new Float32Array(PW * PH)
  Tdirty = true
  Tlow = false
  sheet: Sheet | null = null
  trays: Record<TrayId, Tray> = { dev: makeTray('dev'), stop: makeTray('stop'), fix: makeTray('fix') }
  /** Timer state: seconds left (timed exposure), or manual. */
  exposing: { left: number; strip: number; stripT: number; manual: boolean } | null = null
  tool: { x: number; y: number; on: boolean } = { x: 0, y: 0, on: false }
  private idN = 0
  rhoHint = 0
  private rhoAcc = 0

  setNegative(ref: FrameRef, neg: Negative, img: FrameImage, details: DetailSpec[]): void {
    this.enl.ref = ref; this.neg = neg; this.img = img; this.details = details
    this.Tdirty = true
  }
  /** Recompute T_proj if anything changed (half resolution while dragging). */
  refreshT(low = false): void {
    if (!this.neg || (!this.Tdirty && !(this.Tlow && !low))) return
    projectT(this.neg, { M: this.enl.M, cx: this.enl.cx, cy: this.enl.cy, flip: this.enl.flip, focus: this.enl.focus }, this.T, low ? 2 : 1)
    this.Tdirty = false; this.Tlow = low
  }
  set(p: Partial<EnlargerState>): void {
    const before = JSON.stringify([this.enl.M, this.enl.cx, this.enl.cy, this.enl.flip, this.enl.focus])
    Object.assign(this.enl, p)
    this.enl.M = clamp(this.enl.M, 2, 16)
    const halfW = (PW * CELL_MM) / 2 / this.enl.M, halfH = (PH * CELL_MM) / 2 / this.enl.M
    this.enl.cx = clamp(this.enl.cx, -halfW + 2, 36 + halfW - 2)
    this.enl.cy = clamp(this.enl.cy, -halfH + 2, 24 + halfH - 2)
    this.enl.focus = clamp(this.enl.focus, 0, 1)
    this.enl.timer = clamp(Math.round(this.enl.timer), 1, 60)
    if (JSON.stringify([this.enl.M, this.enl.cx, this.enl.cy, this.enl.flip, this.enl.focus]) !== before) this.Tdirty = true
  }

  newSheet(tutorial = false): Sheet {
    const n = PW * PH
    const s: Sheet = {
      id: `s${Date.now().toString(36)}${this.idN++}`, ref: this.enl.ref, tutorial,
      E: new Float32Array(n), D: new Float32Array(n), tDev: new Float32Array(n), Dst: new Float32Array(n), tInd: new Float32Array(n),
      where: 'easel', F: 0, act: 1, fogged: false, exposed: 0, devTime: 0, x: 0, y: 0, vx: 0, vy: 0,
      ops: { M: this.enl.M, cx: this.enl.cx, cy: this.enl.cy, flip: this.enl.flip, focus: this.enl.focus, grade: this.enl.grade, seconds: 0, devSeconds: 0, dodge: [], burn: [] },
      dodge: false, burn: false, legible: null, evaluated: false,
    }
    this.sheet = s
    return s
  }

  /** Exposure step: the lamp is on with the filter out. tool in paper mm from the centre. */
  exposeStep(dt: number): void {
    const s = this.sheet
    if (!s || s.where !== 'easel' || !this.neg) return
    this.refreshT()
    const I = intensity(this.enl.M)
    const strip = this.exposing?.strip ?? 0
    const stripFrac = strip > 0 ? Math.min(1, (Math.floor((this.exposing!.stripT) / this.enl.timer) + 1) / 5) : 1
    const tl = this.tool
    const useTool = tl.on && !strip
    const wand = this.enl.tool !== 'card'
    const R = wand ? 12 : 10
    for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
      if (strip && i / PW > stripFrac) continue
      const k = j * PW + i
      let f = 1
      if (useTool) {
        const x = (i + 0.5 - PW / 2) * CELL_MM, y = (j + 0.5 - PH / 2) * CELL_MM
        f = wand ? 1 - wandShadow(x, y, tl.x, tl.y, R, this.enl.toolZ) : cardHole(x, y, tl.x, tl.y, R, this.enl.toolZ)
      }
      s.E[k] += I * this.T[k] * f * dt
    }
    s.exposed += dt
    if (useTool) { if (wand) s.dodge = true; else s.burn = true }
    s.ops = { ...s.ops, M: this.enl.M, cx: this.enl.cx, cy: this.enl.cy, flip: this.enl.flip, focus: this.enl.focus, grade: this.enl.grade, seconds: s.exposed }
    s.ref = this.enl.ref
  }

  /** Instant exposure of a recipe onto the current sheet (tests, tutorial). */
  exposeOps(ops: { seconds: number; dodge?: PrintOps['dodge']; burn?: PrintOps['burn'] }): void {
    const s = this.sheet ?? this.newSheet()
    if (!this.neg) return
    this.refreshT()
    const I = intensity(this.enl.M)
    for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
      const k = j * PW + i
      const x = (i + 0.5 - PW / 2) * CELL_MM, y = (j + 0.5 - PH / 2) * CELL_MM
      let held = 0
      for (const d of ops.dodge ?? []) held += d.frac * wandShadow(x, y, d.x, d.y, d.r, d.z)
      let e = ops.seconds * I * this.T[k] * Math.max(0, 1 - held)
      for (const b of ops.burn ?? []) e += b.extraSeconds * I * this.T[k] * cardHole(x, y, b.x, b.y, b.r, b.z)
      s.E[k] += e
    }
    s.exposed += ops.seconds
    s.ops = { ...s.ops, M: this.enl.M, cx: this.enl.cx, cy: this.enl.cy, flip: this.enl.flip, focus: this.enl.focus, grade: this.enl.grade, seconds: s.exposed, dodge: ops.dodge ?? [], burn: ops.burn ?? [] }
    s.ref = this.enl.ref
  }

  /** Move the sheet into a tray (precomputes D* and induction when it enters the developer). */
  moveTo(t: TrayId): void {
    const s = this.sheet
    if (!s) return
    if (t === 'dev' && s.where === 'easel') {
      const g = s.ops.grade
      for (let k = 0; k < s.E.length; k++) { s.Dst[k] = dStar(s.E[k], g); s.tInd[k] = tInduction(s.E[k], g) }
    }
    s.where = t
    s.x = 0; s.y = 0
    this.trays[t].fluid.impulse(0, 0.02, 0.05, 0.002)
    this.trays[t].fluid.wake()
  }

  /** Tray physics + chemistry for dt seconds. white = white light on. */
  step(dt: number, white: boolean): { slap: number; energy: number; legibleNow: LegResult[] | null } {
    let slap = 0, energy = 0
    let legibleNow: LegResult[] | null = null
    const s = this.sheet
    for (const tr of Object.values(this.trays)) {
      const active = s && s.where === tr.id
      // tilt follows the target on a critically damped spring (ω = 8 rad/s)
      const w0 = 8
      tr.vX += (w0 * w0 * (tr.targetX - tr.tiltX) - 2 * w0 * tr.vX) * dt
      tr.vY += (w0 * w0 * (tr.targetY - tr.tiltY) - 2 * w0 * tr.vY) * dt
      tr.tiltX += tr.vX * dt; tr.tiltY += tr.vY * dt
      if (!active && tr.fluid.sleeping && Math.abs(tr.tiltX) < 1e-4 && Math.abs(tr.tiltY) < 1e-4) continue
      tr.fluid.setTilt(Math.tan(tr.tiltX), Math.tan(tr.tiltY))
      const rep = tr.fluid.step(dt)
      tr.energy = rep.kinetic
      if (active) { energy = rep.kinetic; for (const sl of rep.slaps) slap = Math.max(slap, sl.e) }
    }
    if (!s) return { slap, energy, legibleNow }
    // fog: white light while the paper is out of the safe and not yet fixed
    if (white && s.F < 1) {
      if (s.where === 'easel') { const add = 40 * egFor(s.ops.grade) * dt; for (let k = 0; k < s.E.length; k++) s.E[k] += add }
      else { const f = 1 - Math.exp(-3 * (1 - s.F) * dt); for (let k = 0; k < s.D.length; k++) s.D[k] += (D_MAX - s.D[k]) * f }
      s.fogged = true
    }
    if (s.where === 'easel') return { slap, energy, legibleNow }
    const tr = this.trays[s.where]
    const fl = tr.fluid
    // the sheet drifts with the liquid, clamped to the walls
    const u = { x: 0, y: 0 }
    fl.velocityAt(s.x, s.y, u)
    s.vx += 0.6 * (u.x - s.vx) * dt; s.vy += 0.6 * (u.y - s.vy) * dt
    s.x = clamp(s.x + s.vx * dt, -(TRAY_W - 0.254) / 2, (TRAY_W - 0.254) / 2)
    s.y = clamp(s.y + s.vy * dt, -(TRAY_H - 0.203) / 2, (TRAY_H - 0.203) / 2)
    if (s.where === 'dev') {
      s.devTime += dt
      s.ops.devSeconds = s.devTime
      // per-cell wetness and agitation from the fluid grid (32 × 24 cells of 1 cm)
      const nx = fl.nx, ny = fl.ny
      const wet = new Float32Array(nx * ny), agit = new Float32Array(nx * ny)
      for (let k = 0; k < nx * ny; k++) {
        wet[k] = fl.h[k] > 0.0005 ? 1 : 0
        const sp = Math.hypot(fl.ux[k], fl.uy[k])
        agit[k] = 1 + 0.6 * Math.min(sp / 0.08, 1)
      }
      const g = s.ops.grade
      const k0 = 0.08
      for (let j = 0; j < PH; j++) {
        const ty = s.y + (j + 0.5 - PH / 2) * CELL_MM * 0.001
        const cj = clamp(Math.floor((ty + TRAY_H / 2) / 0.01), 0, ny - 1)
        for (let i = 0; i < PW; i++) {
          const tx = s.x + (i + 0.5 - PW / 2) * CELL_MM * 0.001
          const ci = clamp(Math.floor((tx + TRAY_W / 2) / 0.01), 0, nx - 1)
          const c = cj * nx + ci
          const k = j * PW + i
          s.tDev[k] += wet[c] * agit[c] * s.act * dt
          const d = s.Dst[k] * (1 - Math.exp(-k0 * Math.max(0, s.tDev[k] - s.tInd[k])))
          if (d > s.D[k]) s.D[k] = d
        }
      }
      void g
      // the rising cluster: ρ of the frame's top detail every 0.5 s
      this.rhoAcc += dt
      if (this.rhoAcc > 0.5 && this.img && this.details.length && s.ref && this.enl.ref && s.ref.roll === this.enl.ref.roll && s.ref.frame === this.enl.ref.frame) {
        this.rhoAcc = 0
        const d = this.details[0]
        const r = evaluateDetail(this.img, d, s.ops, s.D)
        this.rhoHint = clamp(r.rho / d.rho, 0, 1) * (r.contrast > 0.04 ? 1 : 0.5)
      }
    } else if (s.where === 'stop') {
      s.act *= Math.exp(-dt / 0.4)
    } else if (s.where === 'fix') {
      s.act = 0
      const was = s.F
      s.F = Math.min(1, s.F + dt / 8)
      if (was < 1 && s.F >= 1 && !s.evaluated) { s.evaluated = true; legibleNow = this.evaluate() }
    }
    return { slap, energy, legibleNow }
  }

  evaluate(): LegResult[] {
    const s = this.sheet
    if (!s) return []
    if (!this.img || !s.ref || !this.enl.ref || s.ref.roll !== this.img.ref.roll || s.ref.frame !== this.img.ref.frame) { s.legible = []; return [] }
    s.legible = evaluateLegibility(this.img, this.details, s.ops, s.D, s.fogged)
    return s.legible
  }

  /** Deterministic development for tests: devSeconds in a still tray (or rocked: agitation 1.4). */
  developInstant(seconds: number, rock: boolean): void {
    const s = this.sheet
    if (!s) return
    if (s.where === 'easel') this.moveTo('dev')
    const A = rock ? 1.4 : 1
    for (let k = 0; k < s.D.length; k++) {
      s.tDev[k] += seconds * A * s.act
      s.D[k] = Math.max(s.D[k], s.Dst[k] * (1 - Math.exp(-0.08 * Math.max(0, s.tDev[k] - s.tInd[k]))))
    }
    s.devTime += seconds
    s.ops.devSeconds = s.devTime
  }
  stopInstant(): void { const s = this.sheet; if (s) { s.where = 'stop'; s.act = 0 } }
  fixInstant(): LegResult[] { const s = this.sheet; if (!s) return []; s.where = 'fix'; s.act = 0; s.F = 1; s.evaluated = true; return this.evaluate() }

  /** Turn the fixed sheet into a print record (the caller stores it and hangs it). */
  record(clock: number): PrintRecord | null {
    const s = this.sheet
    if (!s || s.F < 1 || !s.ref) return null
    const legible = (s.legible ?? []).filter((l) => l.pass).map((l) => ({ fact: l.fact as FactId, rho: Math.round(l.rho * 100) / 100 }))
    return { id: s.id, ref: s.ref, ops: { ...s.ops, devSeconds: Math.round(s.devTime) }, legible, fixed: true, fogged: s.fogged, at: Date.now(), clock }
  }
}

export function gradeOf(n: number): Grade { return clamp(Math.round(n), 0, 5) as Grade }
export { devDensity, PW, PH }

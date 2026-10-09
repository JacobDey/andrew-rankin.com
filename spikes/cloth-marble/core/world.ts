// ProbeWorld: the Texturedle bench. Owns the surface fields, plate tilt, the
// marble and the cloths, and steps them together at a fixed substep rate so
// results are deterministic for a given input sequence. No DOM, no three.js.

import type { HeightField, HeightSample } from './heightfield'
import { heightSample } from './heightfield'
import type { ProbeSurface } from './surface'
import { Tilt } from './tilt'
import type { TiltParams } from './tilt'
import { Marble } from './marble'
import type { MarbleParams, Support, SupportFn, Bounds } from './marble'
import { Cloth, ClothLayer } from './cloth'
import type { ClothParams, ClothEnv } from './cloth'
import type { ProbeEvent } from './events'

export interface WorldOptions {
  /** effective gravity, mm/s^2 (real g slowed to "macro time": 185) */
  gravity: number
  /** physics substep rate, Hz */
  hz: number
  /** max substeps per frame (spiral-of-death guard) */
  maxSubsteps: number
  tilt: Partial<TiltParams>
}

export const WORLD_DEFAULTS: WorldOptions = {
  gravity: 185,
  hz: 240,
  maxSubsteps: 8,
  tilt: {},
}

/** Per-cloth rolling feel for a marble resting on it. */
export interface ClothSurfaceFeel {
  crr: number
  rest: number
  mu: number
}

export interface WorldPerf {
  /** ms spent in the last frame */
  marble: number
  cloth: Record<string, number>
  total: number
  substeps: number
}

export class ProbeWorld {
  readonly surface: ProbeSurface
  readonly opt: WorldOptions
  readonly tilt: Tilt
  marble: Marble
  marbleOn = true
  private marbleField: HeightField
  readonly cloths: Cloth[] = []
  private clothEnv = new Map<string, ClothEnv>()
  /** per-cloth height grids so sheets can lie on each other */
  private layers = new Map<string, ClothLayer>()
  private clothFeel = new Map<string, ClothSurfaceFeel>()
  /** events since last drain */
  events: ProbeEvent[] = []
  time = 0
  /** plate-space gravity */
  readonly g: [number, number, number] = [0, 0, -185]
  private acc = 0
  paused = false
  perf: WorldPerf = { marble: 0, cloth: {}, total: 0, substeps: 0 }
  private hs: HeightSample = heightSample()
  private bb = [0, 0, 0, 0, 0]
  /** per-frame cloth bounding boxes (padded), used by the marble support query */
  private clothBB = new Map<string, number[]>()

  constructor(surface: ProbeSurface, marble: Partial<MarbleParams> = {}, opt: Partial<WorldOptions> = {}) {
    this.surface = surface
    this.opt = { ...WORLD_DEFAULTS, ...opt }
    this.tilt = new Tilt(this.opt.tilt)
    this.marble = new Marble(marble)
    this.marbleField = surface.contact(this.marble.p.radius)
    this.g[2] = -this.opt.gravity
    this.marble.place(0, 0, this.support, 0)
  }

  /** Swap marble type (glass / steel...), keeping its position. */
  setMarble(p: Partial<MarbleParams>): void {
    const { x, y } = this.marble
    this.marble.setParams(p)
    this.marbleField = this.surface.contact(this.marble.p.radius)
    this.marble.place(x, y, this.support, 0.5)
  }

  setBounds(b: Bounds | null): void {
    this.marble.bounds = b
  }

  addCloth(id: string, p: Partial<ClothParams>, feel: ClothSurfaceFeel = { crr: 0.06, rest: 0.15, mu: 0.4 }): Cloth {
    this.removeCloth(id)
    const c = new Cloth(id, p)
    this.cloths.push(c)
    this.clothEnv.set(id, {
      field: this.surface.contact(c.p.probeRadius),
      mu: this.surface.mu,
      snag: this.surface.snag,
      g: this.g,
      spheres: [],
      presses: [],
      layers: [],
    })
    this.layers.set(id, new ClothLayer(this.surface.size))
    this.clothFeel.set(id, feel)
    return c
  }

  removeCloth(id: string): void {
    const i = this.cloths.findIndex((c) => c.id === id)
    if (i >= 0) this.cloths.splice(i, 1)
    this.clothEnv.delete(id)
    this.clothBB.delete(id)
    this.layers.delete(id)
    this.clothFeel.delete(id)
  }

  cloth(id: string): Cloth | undefined {
    return this.cloths.find((c) => c.id === id)
  }

  /** Contact field a cloth collides with (for rendering its conform). */
  clothField(id: string): HeightField | undefined {
    return this.clothEnv.get(id)?.field
  }

  /** Where the marble centre rests at (x, y): max of bare surface and any cloth on it. */
  readonly support: SupportFn = (x: number, y: number, r: number, out: Support): Support => {
    const s = this.marbleField.sampleCubic(x, y, this.hs)
    const il = 1 / Math.sqrt(s.gx * s.gx + s.gy * s.gy + 1)
    out.h = s.h + r
    out.nx = -s.gx * il
    out.ny = -s.gy * il
    out.nz = il
    out.vx = out.vy = out.vz = 0
    const S = this.surface
    out.rest = S.rest.sample(x, y)
    out.crr = S.crr.sample(x, y)
    out.mu = 0
    out.grain = S.grain.sample(x, y)
    out.tag = 0
    out.on = ''
    for (const c of this.cloths) {
      const R = r + c.p.thickness
      const b = this.clothBB.get(c.id) ?? c.bounds(this.bb)
      if (x < b[0] - R || x > b[2] + R || y < b[1] - R || y > b[3] + R) continue
      if (b[4] + R < out.h) continue
      const X = c.x
      const R2 = R * R
      let best = -1
      let bh = out.h
      for (let k = 0; k < c.count; k++) {
        const dx = X[k * 3] - x
        const dy = X[k * 3 + 1] - y
        const d2 = dx * dx + dy * dy
        if (d2 >= R2) continue
        const hc = X[k * 3 + 2] + Math.sqrt(R2 - d2)
        if (hc > bh) {
          bh = hc
          best = k
        }
      }
      if (best >= 0) {
        const k3 = best * 3
        out.h = bh
        out.nx = (x - X[k3]) / R
        out.ny = (y - X[k3 + 1]) / R
        out.nz = (bh - X[k3 + 2]) / R
        out.vx = c.v[k3]
        out.vy = c.v[k3 + 1]
        out.vz = c.v[k3 + 2]
        const f = this.clothFeel.get(c.id)!
        out.rest = f.rest
        out.crr = f.crr
        out.mu = f.mu
        out.grain = c.p.thickness * 0.05
        out.on = c.id
      }
    }
    return out
  }

  /** Advance by real frame time; runs whole fixed substeps, carries the remainder. */
  update(frameDt: number): number {
    if (this.paused) return 0
    const h = 1 / this.opt.hz
    this.acc = Math.min(this.acc + frameDt, h * this.opt.maxSubsteps)
    const n = Math.floor(this.acc / h + 1e-9)
    this.acc -= n * h
    if (n > 0) this.stepSubsteps(n)
    return n
  }

  /** Deterministic: exactly `frames` frames of round(hz/60) substeps. */
  advance(frames: number, fps = 60): void {
    const n = Math.max(1, Math.round(this.opt.hz / fps))
    for (let f = 0; f < frames; f++) this.stepSubsteps(n)
  }

  stepSubsteps(n: number): void {
    const t0 = performance.now()
    const h = 1 / this.opt.hz
    const m = this.marble
    const clothMs: Record<string, number> = {}
    // per-frame cloth environments: marble as collider/press where relevant
    for (const c of this.cloths) {
      const env = this.clothEnv.get(c.id)!
      env.spheres.length = 0
      env.presses.length = 0
      const b = c.bounds(this.clothBB.get(c.id) ?? [0, 0, 0, 0, 0])
      // pad: the sheet moves during the frame (<1 mm at sane drag speeds)
      b[0] -= 1
      b[1] -= 1
      b[2] += 1
      b[3] += 1
      b[4] += 0.5
      this.clothBB.set(c.id, b)
      // rebuild this sheet's height grid when it moved (others may lie on it)
      if (!c.asleep || c.grabbed >= 0) this.layers.get(c.id)!.build(c)
      if (this.marbleOn) {
        const R = m.p.radius + c.p.thickness + 1
        const near = m.x > b[0] - R && m.x < b[2] + R && m.y > b[1] - R && m.y < b[3] + R && m.z - m.p.radius < b[4] + 1
        const moving = Math.hypot(m.vx, m.vy, m.vz) > 0.3 || m.held || !c.asleep
        if (near && moving) {
          env.spheres.push(m.x, m.y, m.z, m.p.radius)
          if (m.on === c.id && m.grounded) env.presses.push(m.x, m.y, 0.02 * m.p.radius / 4, m.p.radius * 0.35)
        }
      }
      clothMs[c.id] = 0
    }
    // layering: each sheet may rest on any other sheet whose box overlaps it
    for (const c of this.cloths) {
      const env = this.clothEnv.get(c.id)!
      env.layers.length = 0
      const a = this.clothBB.get(c.id)!
      for (const o of this.cloths) {
        if (o === c) continue
        const b = this.clothBB.get(o.id)!
        if (a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue
        env.layers.push(this.layers.get(o.id)!)
        // a sheet moving on/under a sleeping one wakes it (not merely being awake)
        if (c.asleep && (o.grabbed >= 0 || (!o.asleep && o.lastMove > 2e-4))) c.wake()
      }
      const tc = performance.now()
      c.beginFrame(env)
      clothMs[c.id] += performance.now() - tc
    }
    let tm = 0
    for (let s = 0; s < n; s++) {
      this.tilt.step(h)
      this.tilt.gravity(this.opt.gravity, this.g)
      if (this.marbleOn) {
        const ta = performance.now()
        m.step(h, this.g, this.support, this.events, this.time)
        tm += performance.now() - ta
        // keep the cloth collider in sync with the marble within the frame
        for (const c of this.cloths) {
          const sp = this.clothEnv.get(c.id)!.spheres
          if (sp.length) {
            sp[0] = m.x
            sp[1] = m.y
            sp[2] = m.z
          }
        }
      }
      for (const c of this.cloths) {
        const tc = performance.now()
        c.substep(h, s, n, this.clothEnv.get(c.id)!, this.events, this.time)
        clothMs[c.id] += performance.now() - tc
      }
      this.time += h
    }
    for (const c of this.cloths) {
      const tc = performance.now()
      c.endFrame(this.clothEnv.get(c.id)!, this.events, this.time)
      clothMs[c.id] += performance.now() - tc
    }
    this.perf = { marble: tm, cloth: clothMs, total: performance.now() - t0, substeps: n }
  }

  /** Take and clear pending events. */
  drainEvents(): ProbeEvent[] {
    const e = this.events
    this.events = []
    return e
  }

  /** Drop the marble at (x, y) from `lift` mm above its support. */
  dropMarble(x: number, y: number, lift = 6): void {
    this.marble.place(x, y, this.support, lift)
  }

  throwMarble(x: number, y: number, vx: number, vy: number): void {
    this.marble.place(x, y, this.support, 0.01)
    this.marble.release(vx, vy)
  }

  /** Compact state for tests / HUD. */
  state() {
    return {
      t: +this.time.toFixed(3),
      tilt: { ax: this.tilt.ax, ay: this.tilt.ay, deg: [+(this.tilt.ax * 57.2958).toFixed(2), +(this.tilt.ay * 57.2958).toFixed(2)] },
      g: this.g.map((v) => +v.toFixed(2)),
      marble: this.marble.state(),
      cloths: this.cloths.map((c) => c.summary()),
      perf: this.perf,
    }
  }
}

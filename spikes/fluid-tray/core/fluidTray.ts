/**
 * FluidTray: a developing tray you can rock, pour into and tip out, with a sheet of paper developing
 * wherever the liquid touches it. Composes ShallowWater (liquid), TrayRig (tray body), PaperChem (sheet)
 * plus splash droplets and a pour stream. Fixed-timestep and seeded, so it replays from a snapshot.
 *
 * Pure TypeScript, no DOM. Frame: x along the long side, y away from the viewer, z up, origin at the
 * front-left inside corner of the floor. Units: metres, seconds; the public pour/volume API uses mL.
 */
import { ShallowWater } from './shallowWater.ts'
import { TrayRig, type TrayRigOptions } from './trayRig.ts'
import { PaperChem, type Kinetics } from './paperChem.ts'
import { Rng } from './rng.ts'

export type Corner = 'x0y0' | 'x1y0' | 'x0y1' | 'x1y1'

export interface FluidTrayOptions {
  /** Inside floor size (m). Default 11x14-inch-ish tray: 0.36 x 0.27. */
  trayW?: number
  trayH?: number
  /** Fluid grid columns; rows follow the aspect. Default 128 (-> 96 rows). */
  nx?: number
  advect?: boolean
  /** Fixed physics step (s). Default 1/240. */
  fixedDt?: number
  /** Cap on fixed steps per update() call (prevents a death spiral; the sim slows instead). */
  maxStepsPerUpdate?: number
  /** Chemistry tick rate (Hz). Default 30. */
  chemHz?: number
  rimHeight?: number
  spoutLip?: number
  spoutCorner?: Corner
  /** Sheet placement/size (m) and resolution. Default 10x8 in, centred, 240x192 texels. */
  paper?: { x?: number; y?: number; w?: number; h?: number; resX?: number; resY?: number }
  kinetics?: Partial<Kinetics>
  rig?: TrayRigOptions
  seed?: number
  maxDroplets?: number
}

export interface PourState {
  /** Rate (m^3/s); 0 = not pouring. */
  rate: number
  /** Landing point in tray coords (m). May be outside the tray (then it spills). */
  x: number
  y: number
  /** Tracer value of what is poured (1 = fresh developer). */
  fresh: number
  /** If > 0, a metered pour: stop after this many m^3. */
  remaining: number
  /** Seconds since the pour started (for the glug wobble). */
  t: number
}

export interface TrayEvents {
  /** Bench impacts (edge speed m/s). */
  clunks: number[]
  /** Wall slaps: energy proxy and where (tray coords). Use for slosh/lap sounds. */
  slaps: { x: number; y: number; e: number }[]
  /** Droplets that landed back in the liquid this frame. */
  drips: number
}

export interface TrayStats {
  time: number
  volumeML: number
  pouredML: number
  drainedML: number
  spilledML: number
  coverage: number
  density: number
  developer: number
  freshness: number
  devTime: number
  bubbles: number
  droplets: number
  maxDepthMM: number
  substeps: number
  tiltDeg: [number, number]
  kinetic: number
}

export interface TraySnapshot {
  time: number
  h: Float32Array
  u: Float32Array
  v: Float32Array
  s: Float32Array
  agit: Float32Array
  paper: { c: Float32Array; n: Float32Array; p: Float32Array; wet: Float32Array; D: Float32Array; cov: Float32Array; devTime: number; bubbles: { x: number; y: number; r: number; age: number }[] }
  /** Derived fields some consumers read between ticks, and wall-slap edge detection state. */
  derived: { speed: Float32Array; uc: Float32Array; vc: Float32Array; lastSlap: Float32Array; slapAcc: number }
  rig: number[]
  pour: PourState
  drops: Float32Array
  dropCount: number
  counters: [number, number, number]
  rng: number
  acc: [number, number]
}

const DROP_STRIDE = 7 // x y z vx vy vz vol

export class FluidTray {
  readonly fluid: ShallowWater
  readonly rig: TrayRig
  readonly paper: PaperChem
  readonly rng: Rng
  readonly trayW: number
  readonly trayH: number
  readonly rimHeight: number
  readonly spoutCorner: Corner
  readonly fixedDt: number
  maxStepsPerUpdate: number
  chemHz: number

  time = 0
  pourState: PourState = { rate: 0, x: 0, y: 0, fresh: 1, remaining: 0, t: 0 }
  /** Droplets in tray frame: [x,y,z,vx,vy,vz,vol] * count. */
  readonly drops: Float32Array
  dropCount = 0
  readonly maxDroplets: number

  pouredM3 = 0
  drainedM3 = 0
  spilledM3 = 0
  /** Fixed steps executed by the last update(). */
  lastSteps = 0

  events: TrayEvents = { clunks: [], slaps: [], drips: 0 }

  private acc = 0
  private chemAcc = 0
  private slapAcc = 0
  private lastSlap: Float32Array

  constructor(o: FluidTrayOptions = {}) {
    this.trayW = o.trayW ?? 0.36
    this.trayH = o.trayH ?? 0.27
    const nx = o.nx ?? 128
    const dx = this.trayW / nx
    const ny = Math.max(2, Math.round(this.trayH / dx))
    this.rimHeight = o.rimHeight ?? 0.045
    this.fluid = new ShallowWater({ nx, ny, dx, advect: o.advect ?? true, rimHeight: this.rimHeight })
    this.spoutCorner = o.spoutCorner ?? 'x1y0'
    this.fluid.setSpout(this.spoutCorner, o.spoutLip ?? 0.024, 0.04)
    this.rig = new TrayRig({ length: this.trayW, ...o.rig })
    const pw = o.paper?.w ?? 0.254
    const ph = o.paper?.h ?? 0.203
    this.paper = new PaperChem(
      {
        x: o.paper?.x ?? (this.trayW - pw) / 2,
        y: o.paper?.y ?? (this.trayH - ph) / 2,
        w: pw,
        h: ph,
        resX: o.paper?.resX ?? 240,
        resY: o.paper?.resY ?? 192,
      },
      o.kinetics,
    )
    this.rng = new Rng(o.seed ?? 7)
    this.fixedDt = o.fixedDt ?? 1 / 240
    this.maxStepsPerUpdate = o.maxStepsPerUpdate ?? 10
    this.chemHz = o.chemHz ?? 30
    this.maxDroplets = o.maxDroplets ?? 384
    this.drops = new Float32Array(this.maxDroplets * DROP_STRIDE)
    this.lastSlap = new Float32Array(2 * (nx + ny))
    this.paper.reset()
  }

  // ------------------------------------------------------------------ controls

  /** Hold the tray tilted (radians). +x lowers the right side, +y lowers the far side. */
  tilt(x: number, y: number): void {
    this.rig.hold(x, y)
  }

  /** Let go of the tray; it drops back onto the bench. */
  release(): void {
    this.rig.release()
  }

  /** Shove the tray (m/s). */
  jolt(vx: number, vy: number): void {
    this.rig.jolt(vx, vy)
  }

  /** Start/adjust/stop a continuous pour: rate in mL/s at tray coords (m). rate 0 stops. */
  setPour(rateMLs: number, x: number, y: number, fresh = 1): void {
    const p = this.pourState
    if (rateMLs > 0 && p.rate === 0) p.t = 0
    p.rate = rateMLs * 1e-6
    p.x = x
    p.y = y
    p.fresh = fresh
    if (rateMLs <= 0) p.remaining = 0
  }

  /** Pour a metered amount (mL) at `rate` mL/s. Defaults to the back-left quarter of the tray. */
  pour(amountML: number, opts: { x?: number; y?: number; rate?: number; fresh?: number } = {}): void {
    const x = opts.x ?? this.trayW * 0.25
    const y = opts.y ?? this.trayH * 0.7
    this.setPour(opts.rate ?? 160, x, y, opts.fresh ?? 1)
    this.pourState.remaining = amountML * 1e-6
  }

  /** Finger in the liquid: a radial push (and optional drag direction, m/s) at tray coords. */
  poke(x: number, y: number, strength = 1, dvx = 0, dvy = 0): void {
    this.fluid.addImpulse(x, y, 0.018, 0.25 * strength, dvx, dvy)
  }

  /** Reset the liquid to `ml` millilitres. layout 'flat', or 'left' (a dam-break block in the left third). */
  fill(ml: number, layout: 'flat' | 'left' = 'flat', fresh = 1): void {
    const vol = ml * 1e-6
    if (layout === 'left') this.fluid.fillBlock(vol, 0, this.trayW * 0.34, fresh)
    else this.fluid.fillFlat(vol, fresh)
    this.dropCount = 0
  }

  /** New sheet, same latent. */
  resetPaper(): void {
    this.paper.reset()
  }

  // ------------------------------------------------------------------ outputs

  /** Per-texel coverage 0..1 (paper.resX * paper.resY, row 0 = front edge). */
  get coverageMap(): Float32Array {
    return this.paper.cov
  }

  /** Per-texel developed density 0..1 (same layout). */
  get developmentMap(): Float32Array {
    return this.paper.D
  }

  get volumeML(): number {
    return this.fluid.volume() * 1e6
  }

  stats(): TrayStats {
    const f = this.fluid
    let hMax = 0
    let mass = 0
    let fresh = 0
    for (let c = 0; c < f.h.length; c++) {
      const h = f.h[c]
      if (h > hMax) hMax = h
      mass += h
      fresh += h * f.s[c]
    }
    const sum = this.paper.summary()
    return {
      time: this.time,
      volumeML: this.volumeML,
      pouredML: this.pouredM3 * 1e6,
      drainedML: this.drainedM3 * 1e6,
      spilledML: this.spilledM3 * 1e6,
      coverage: sum.coverage,
      density: sum.density,
      developer: sum.developer,
      freshness: mass > 0 ? fresh / mass : 0,
      devTime: this.paper.devTime,
      bubbles: this.paper.bubbles.length,
      droplets: this.dropCount,
      maxDepthMM: hMax * 1000,
      substeps: f.lastSplit,
      tiltDeg: [(this.rig.ax * 180) / Math.PI, (this.rig.ay * 180) / Math.PI],
      kinetic: f.kineticEnergy(),
    }
  }

  // ------------------------------------------------------------------ simulation

  /**
   * Advance by a real frame time. Runs whole fixed steps (at most maxStepsPerUpdate; if the device can't
   * keep up the sim runs in slow motion rather than spiralling). Clears and refills `events`.
   */
  update(frameDt: number): void {
    this.events = { clunks: [], slaps: [], drips: 0 }
    this.acc += Math.min(frameDt, 0.25)
    let n = 0
    while (this.acc >= this.fixedDt && n < this.maxStepsPerUpdate) {
      this.fixedStep(this.fixedDt)
      this.acc -= this.fixedDt
      n++
    }
    if (n === this.maxStepsPerUpdate) this.acc = 0
    this.lastSteps = n
  }

  /** Advance exactly `seconds` (rounded to fixed steps), ignoring the per-update cap. For tests. */
  advance(seconds: number): void {
    this.events = { clunks: [], slaps: [], drips: 0 }
    const n = Math.round(seconds / this.fixedDt)
    for (let k = 0; k < n; k++) this.fixedStep(this.fixedDt)
    this.lastSteps = n
  }

  private fixedStep(dt: number): void {
    const f = this.fluid
    this.rig.step(dt)
    for (const c of this.rig.takeClunks()) this.events.clunks.push(c.speed)
    const g = this.rig.gravity()
    f.gx = g.gx
    f.gy = g.gy
    f.gz = g.gz
    this.stepPour(dt)
    f.step(dt)
    this.drainedM3 += f.outSpout
    this.spilledM3 += f.outRim
    f.outSpout = 0
    f.outRim = 0
    this.stepDroplets(dt)
    this.slapAcc += dt
    if (this.slapAcc >= 1 / 60) {
      this.detectSlaps()
      this.slapAcc = 0
    }
    this.chemAcc += dt
    if (this.chemAcc >= 1 / this.chemHz) {
      f.computeDerived(this.chemAcc)
      f.diffuseTracer(this.chemAcc)
      this.paper.step(this.chemAcc, f, this.rng)
      this.chemAcc = 0
    }
    this.time += dt
  }

  private stepPour(dt: number): void {
    const p = this.pourState
    if (p.rate <= 0) return
    p.t += dt
    // a jug glugs: ~4 Hz wobble in the flow
    const glug = 1 + 0.35 * Math.sin(p.t * 2 * Math.PI * 4.2) * Math.min(1, p.t * 2)
    let vol = p.rate * glug * dt
    if (p.remaining > 0) {
      if (vol >= p.remaining) {
        vol = p.remaining
        p.remaining = 0
        p.rate = 0
      } else p.remaining -= vol
    }
    this.pouredM3 += vol
    const f = this.fluid
    const inside = p.x > 0 && p.x < this.trayW && p.y > 0 && p.y < this.trayH
    if (!inside) {
      this.spilledM3 += vol
      return
    }
    const rate = p.rate
    f.addVolume(p.x, p.y, 0.007, vol, p.fresh)
    // the falling stream pushes liquid outward from where it lands
    const strength = Math.min(3, rate / 1.5e-4)
    f.addImpulse(p.x, p.y, 0.022, 1.6 * strength * dt * glug)
    // splash a few droplets up off the impact
    if (this.rng.next() < 30 * dt * strength) {
      const a = this.rng.range(0, Math.PI * 2)
      const sp = this.rng.range(0.15, 0.45)
      this.spawnDrop(p.x, p.y, f.sampleH(p.x, p.y) + 0.002, Math.cos(a) * sp, Math.sin(a) * sp, this.rng.range(0.4, 0.9), 0)
    }
    // pouring onto barely-wet paper traps air
    if (this.paper.contains(p.x, p.y) && f.sampleH(p.x, p.y) < 0.002 && this.rng.next() < 8 * dt) {
      const a = this.rng.range(0, Math.PI * 2)
      const r = this.rng.range(0.004, 0.02)
      this.paper.addBubble(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, this.rng.range(0.0015, 0.004))
    }
  }

  private spawnDrop(x: number, y: number, z: number, vx: number, vy: number, vz: number, vol: number): void {
    if (this.dropCount >= this.maxDroplets) return
    const q = this.dropCount * DROP_STRIDE
    const d = this.drops
    d[q] = x
    d[q + 1] = y
    d[q + 2] = z
    d[q + 3] = vx
    d[q + 4] = vy
    d[q + 5] = vz
    d[q + 6] = vol
    this.dropCount++
  }

  private stepDroplets(dt: number): void {
    const f = this.fluid
    const d = this.drops
    const gx = f.gx
    const gy = f.gy
    const gz = f.gz
    const W = this.trayW
    const H = this.trayH
    let i = 0
    while (i < this.dropCount) {
      const q = i * DROP_STRIDE
      d[q + 3] += gx * dt
      d[q + 4] += gy * dt
      d[q + 5] -= gz * dt
      d[q] += d[q + 3] * dt
      d[q + 1] += d[q + 4] * dt
      d[q + 2] += d[q + 5] * dt
      const x = d[q]
      const y = d[q + 1]
      const z = d[q + 2]
      let remove = false
      const inside = x > 0 && x < W && y > 0 && y < H
      if (inside) {
        const hh = f.sampleH(x, y)
        if (z <= hh && d[q + 5] < 0) {
          if (d[q + 6] > 0) f.addVolume(x, y, f.dx, d[q + 6], f.sampleCell(f.s, x, y))
          f.addImpulse(x, y, 0.008, 0.05)
          this.events.drips++
          remove = true
        }
      } else if (z < this.rimHeight) {
        if (z > -0.02 && (x <= 0 || x >= W || y <= 0 || y >= H) && Math.abs(x - W / 2) < W / 2 + 0.01 && Math.abs(y - H / 2) < H / 2 + 0.01) {
          // hit the inside of a wall: bounce back in
          if (x <= 0) { d[q] = 1e-4; d[q + 3] = Math.abs(d[q + 3]) * 0.3 }
          if (x >= W) { d[q] = W - 1e-4; d[q + 3] = -Math.abs(d[q + 3]) * 0.3 }
          if (y <= 0) { d[q + 1] = 1e-4; d[q + 4] = Math.abs(d[q + 4]) * 0.3 }
          if (y >= H) { d[q + 1] = H - 1e-4; d[q + 4] = -Math.abs(d[q + 4]) * 0.3 }
        } else if (z < -0.06) {
          this.spilledM3 += d[q + 6]
          remove = true
        }
      }
      if (remove) {
        this.dropCount--
        if (i !== this.dropCount) d.copyWithin(q, this.dropCount * DROP_STRIDE, this.dropCount * DROP_STRIDE + DROP_STRIDE)
      } else i++
    }
  }

  /** Waves slapping the walls: emit droplets and slap events. Runs at ~60 Hz. */
  private detectSlaps(): void {
    const f = this.fluid
    const { nx, ny, dx, h } = f
    const nxu = nx + 1
    const E0 = 7e-4
    const slaps = this.events.slaps
    const ls = this.lastSlap
    let budget = 24
    const consider = (idx: number, c: number, uin: number, x: number, y: number, nxn: number, nyn: number) => {
      const e = uin > 0 ? h[c] * uin * uin : 0
      const prev = ls[idx]
      ls[idx] = e
      if (e < E0 || e <= prev) return
      slaps.push({ x, y, e })
      const expected = ((e - E0) / E0) * 0.5
      let k = Math.floor(expected + this.rng.next())
      while (k-- > 0 && budget-- > 0) {
        const vol = f.takeVolume(x, y, 6e-9)
        const up = uin * this.rng.range(0.9, 1.9)
        const tang = this.rng.range(-0.12, 0.12)
        this.spawnDrop(
          x + nxn * 0.002,
          y + nyn * 0.002,
          h[c] + 0.001,
          nxn * uin * this.rng.range(0.1, 0.4) + (nyn !== 0 ? tang : 0),
          nyn * uin * this.rng.range(0.1, 0.4) + (nxn !== 0 ? tang : 0),
          up,
          vol,
        )
      }
    }
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * dx
      consider(j, j * nx, -f.u[j * nxu + 1], 0.5 * dx, y, 1, 0)
      consider(ny + j, j * nx + nx - 1, f.u[j * nxu + nx - 1], (nx - 0.5) * dx, y, -1, 0)
    }
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * dx
      consider(2 * ny + i, i, -f.v[nx + i], x, 0.5 * dx, 0, 1)
      consider(2 * ny + nx + i, (ny - 1) * nx + i, f.v[(ny - 1) * nx + i], x, (ny - 0.5) * dx, 0, -1)
    }
  }

  // ------------------------------------------------------------------ save states

  /** Deep copy of everything needed to resume exactly (typed arrays; structured-clone / IndexedDB friendly). */
  snapshot(): TraySnapshot {
    const f = this.fluid
    const pp = this.paper
    return {
      time: this.time,
      h: f.h.slice(),
      u: f.u.slice(),
      v: f.v.slice(),
      s: f.s.slice(),
      agit: f.agitation.slice(),
      paper: {
        c: pp.c.slice(),
        n: pp.n.slice(),
        p: pp.p.slice(),
        wet: pp.wet.slice(),
        D: pp.D.slice(),
        cov: pp.cov.slice(),
        devTime: pp.devTime,
        bubbles: pp.bubbles.map((b) => ({ ...b })),
      },
      derived: { speed: f.speed.slice(), uc: f.uc.slice(), vc: f.vc.slice(), lastSlap: this.lastSlap.slice(), slapAcc: this.slapAcc },
      rig: this.rig.snapshot(),
      pour: { ...this.pourState },
      drops: this.drops.slice(0, this.dropCount * DROP_STRIDE),
      dropCount: this.dropCount,
      counters: [this.pouredM3, this.drainedM3, this.spilledM3],
      rng: this.rng.state,
      acc: [this.acc, this.chemAcc],
    }
  }

  restore(s: TraySnapshot): void {
    const f = this.fluid
    f.h.set(s.h)
    f.u.set(s.u)
    f.v.set(s.v)
    f.s.set(s.s)
    f.agitation.set(s.agit)
    const pp = this.paper
    pp.c.set(s.paper.c)
    pp.n.set(s.paper.n)
    pp.p.set(s.paper.p)
    pp.wet.set(s.paper.wet)
    pp.D.set(s.paper.D)
    pp.cov.set(s.paper.cov)
    pp.devTime = s.paper.devTime
    f.speed.set(s.derived.speed)
    f.uc.set(s.derived.uc)
    f.vc.set(s.derived.vc)
    this.lastSlap.set(s.derived.lastSlap)
    this.slapAcc = s.derived.slapAcc
    pp.bubbles = s.paper.bubbles.map((b) => ({ ...b }))
    pp.pack()
    this.rig.restore(s.rig)
    this.pourState = { ...s.pour }
    this.drops.set(s.drops)
    this.dropCount = s.dropCount
    ;[this.pouredM3, this.drainedM3, this.spilledM3] = s.counters
    this.rng.state = s.rng
    ;[this.acc, this.chemAcc] = s.acc
    this.time = s.time
  }
}

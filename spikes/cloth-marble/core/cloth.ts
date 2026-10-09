// Cloth: an N x N XPBD particle sheet that drapes onto a contact field, with
// Coulomb friction (static/kinetic, Mueller-style PBD friction), palm pressure
// under the dragging finger, long-range tethers from the grab point (no rubber
// stretching when you drag a corner), sphere colliders (the marble), and
// snagging on sharp peaks (coarse weave only). Renderer-independent.
//
// Per substep:  predict -> press -> [distance constraints, tethers, pins,
//               collisions] x iterations -> friction -> velocities.

import type { HeightField, HeightSample, ScalarField } from './heightfield'
import { heightSample } from './heightfield'
import type { ProbeEvent } from './events'

export interface ClothParams {
  /** particles per side */
  n: number
  /** rest edge length, mm */
  size: number
  /** mm; the sheet's mid-surface stays this far above the contact field */
  thickness: number
  /** XPBD compliance (inverse stiffness) for edges / shear diagonals / bend (skip-one) links */
  stretchCompliance: number
  shearCompliance: number
  bendCompliance: number
  /** solver iterations per substep */
  iterations: number
  /** velocity damping per second (0..~5) */
  damping: number
  /** cloth's own friction coefficient (multiplied by the material's mu field) */
  muCloth: number
  /** static / kinetic ratio */
  staticRatio: number
  /** contact-field probe radius (mm): fine filament vs coarse yarn */
  probeRadius: number
  /** fingertip contact patch (mm): particles within this rest distance of the grab move with the finger */
  fingerRadius: number
  /** palm pressure around the fingertip: press depth (mm), gaussian sigma (mm) */
  press: number
  pressSigma: number
  /** friction coefficient against another cloth lying underneath */
  muLayer: number
  /** tether slack (fraction of rest geodesic) while grabbed */
  tetherSlack: number
  /**
   * min distance from the finger as a fraction of rest geodesic: pushing
   * transmits through the sheet once it is compressed this far, so the far side
   * slides instead of crumpling forever (low = more wrinkles ahead of the finger)
   */
  compressLimit: number
  /** coarse weave catches on sharp peaks */
  snags: boolean
  /** snag field value needed to catch */
  snagMin: number
  /** pull (in grid spacings) a snag of strength 1 withstands before tearing free */
  snagHold: number
  /** catches per mm slid over a full-strength peak */
  snagRate: number
  /** max simultaneous snags */
  snagMax: number
  /** areal density g/mm^2 (silk ~6e-5, burlap ~3e-4) */
  density: number
}

export const FINE_CLOTH: ClothParams = {
  n: 64,
  size: 16,
  thickness: 0.05,
  stretchCompliance: 0,
  shearCompliance: 1e-7,
  bendCompliance: 2e-5,
  iterations: 2,
  damping: 1.5,
  muCloth: 0.27,
  staticRatio: 1.2,
  probeRadius: 0.08,
  fingerRadius: 1.0,
  press: 0.02,
  pressSigma: 1.4,
  muLayer: 0.45,
  tetherSlack: 0.02,
  compressLimit: 0.85,
  snags: false,
  snagMin: 1,
  snagHold: 0,
  snagRate: 0,
  snagMax: 0,
  density: 6e-5,
}

export const ROUGH_CLOTH: ClothParams = {
  n: 24,
  size: 16,
  thickness: 0.35,
  stretchCompliance: 0,
  shearCompliance: 0,
  bendCompliance: 3e-6,
  iterations: 3,
  damping: 2.5,
  muCloth: 0.42,
  staticRatio: 1.45,
  probeRadius: 0.6,
  fingerRadius: 1.4,
  press: 0.04,
  pressSigma: 2.0,
  muLayer: 0.7,
  tetherSlack: 0.03,
  compressLimit: 0.9,
  snags: true,
  snagMin: 0.45,
  snagHold: 0.9,
  snagRate: 0.8,
  snagMax: 3,
  density: 3e-4,
}

/** Environment a cloth step needs. */
export interface ClothEnv {
  /** contact field for this cloth's probe radius (D_r) */
  field: HeightField
  /** friction multiplier field */
  mu: ScalarField
  /** snag strength field (0..1) */
  snag: ScalarField
  /** material tag field for events */
  tag?: ScalarField
  /** gravity in plate space, mm/s^2 */
  g: readonly number[]
  /** spheres to keep out of: [x, y, z, r] flattened */
  spheres: number[]
  /** extra press points: [x, y, depth, sigma] flattened (e.g. marble weight) */
  presses: number[]
  /** other cloths' height grids this sheet can lie on top of */
  layers: ClothLayer[]
}

/**
 * A coarse max-height grid of a cloth's particles over the plate, so another
 * cloth can lie on top of it (cheap cloth-cloth layering, not self-collision).
 */
export class ClothLayer {
  readonly g: number
  readonly x0: number
  readonly size: number
  readonly grid: Float32Array
  /** thickness of the cloth this grid describes */
  thick = 0
  constructor(size: number, g = 192) {
    this.g = g
    this.size = size
    this.x0 = -size / 2
    this.grid = new Float32Array(g * g).fill(-1e3)
  }
  /** Rebuild from particles: splat max height into cells within ~1 particle spacing. */
  build(c: Cloth): void {
    const { g, x0, size, grid } = this
    grid.fill(-1e3)
    this.thick = c.p.thickness
    const cell = size / g
    const r = Math.max(1, Math.ceil((c.spacing * 0.75) / cell))
    const X = c.x
    for (let k = 0; k < c.count; k++) {
      const z = X[k * 3 + 2]
      const ci = Math.floor((X[k * 3] - x0) / cell)
      const cj = Math.floor((X[k * 3 + 1] - x0) / cell)
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= g) continue
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || i >= g) continue
          const q = j * g + i
          if (z > grid[q]) grid[q] = z
        }
      }
    }
  }
  /** Height of the cloth top at (x, y), or -1e3 where there is none. */
  sample(x: number, y: number): number {
    const cell = this.size / this.g
    const i = Math.floor((x - this.x0) / cell)
    const j = Math.floor((y - this.x0) / cell)
    if (i < 0 || j < 0 || i >= this.g || j >= this.g) return -1e3
    return this.grid[j * this.g + i]
  }
}

export interface ClothStats {
  /** particles touching the field */
  contacts: number
  /** contacting particles in static friction */
  stuck: number
  /** sum of slipped tangential distance this frame (mm) */
  slip: number
  /** stick->slip transitions this frame */
  slipEvents: number
  /** active snags */
  snags: number
  /** mean speed of free particles mm/s */
  speed: number
  /** sleeping (skipped) */
  asleep: boolean
}

export class Cloth {
  readonly id: string
  p: ClothParams
  readonly n: number
  readonly count: number
  /** positions (x, y, z) mm */
  readonly x: Float64Array
  /** substep start positions */
  readonly x0: Float64Array
  /** velocities mm/s */
  readonly v: Float64Array
  /** inverse mass (0 = kinematic) */
  readonly w: Float64Array
  /** accumulated normal correction this substep (penetration) */
  readonly pen: Float64Array
  /** contact normal (x, y) slope at last collision: gx, gy */
  readonly cg: Float64Array
  /** 1 if in static friction */
  readonly stuck: Uint8Array
  /** 1 if last contact was on another cloth */
  readonly onLayer: Uint8Array
  /** smoothed contact pressure proxy, for rendering (rubbing / frottage) */
  readonly contact: Float32Array
  /** snag pins */
  readonly pinned: Uint8Array
  readonly pin: Float64Array
  readonly pinS: Float64Array
  readonly cooldown: Float64Array
  /** rest (u, v) of each particle in mm, for tethers */
  readonly rest: Float64Array
  // constraints
  private ca: Int32Array
  private cb: Int32Array
  private cr: Float32Array
  private cc: Float64Array
  private cl: Float32Array
  private ca2: Float32Array
  // grab: fingertip patch (kinematic) around the grabbed particle
  grabbed = -1
  private grabSet: number[] = []
  private grabOff: number[] = []
  private gtx = 0
  private gty = 0
  private gpx = 0
  private gpy = 0
  private tether: Float64Array
  // sleep
  private still = 0
  asleep = false
  /** frames since wake */
  stats: ClothStats = { contacts: 0, stuck: 0, slip: 0, slipEvents: 0, snags: 0, speed: 0, asleep: false }
  private seed = 1234567
  private pinCount = 0
  private hs: HeightSample = heightSample()
  /** world-space normals (filled by computeNormals) */
  readonly normals: Float32Array

  constructor(id: string, p: Partial<ClothParams> = {}) {
    this.id = id
    this.p = { ...FINE_CLOTH, ...p }
    const n = this.p.n
    this.n = n
    const N = n * n
    this.count = N
    this.x = new Float64Array(N * 3)
    this.x0 = new Float64Array(N * 3)
    this.v = new Float64Array(N * 3)
    this.w = new Float64Array(N).fill(1)
    this.pen = new Float64Array(N)
    this.cg = new Float64Array(N * 2)
    this.stuck = new Uint8Array(N)
    this.onLayer = new Uint8Array(N)
    this.contact = new Float32Array(N)
    this.pinned = new Uint8Array(N)
    this.pin = new Float64Array(N * 3)
    this.pinS = new Float64Array(N)
    this.cooldown = new Float64Array(N)
    this.rest = new Float64Array(N * 2)
    this.tether = new Float64Array(N)
    this.normals = new Float32Array(N * 3)
    const s = this.spacing
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        this.rest[(j * n + i) * 2] = i * s
        this.rest[(j * n + i) * 2 + 1] = j * s
      }
    // constraints: structural, shear, bend (skip-one)
    const A: number[] = []
    const B: number[] = []
    const C: number[] = []
    const add = (a: number, b: number, compliance: number) => {
      A.push(a)
      B.push(b)
      C.push(compliance)
    }
    const id_ = (i: number, j: number) => j * n + i
    const { stretchCompliance: cs, shearCompliance: csh, bendCompliance: cb } = this.p
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        if (i + 1 < n) add(id_(i, j), id_(i + 1, j), cs)
        if (j + 1 < n) add(id_(i, j), id_(i, j + 1), cs)
      }
    for (let j = 0; j + 1 < n; j++)
      for (let i = 0; i + 1 < n; i++) {
        add(id_(i, j), id_(i + 1, j + 1), csh)
        add(id_(i + 1, j), id_(i, j + 1), csh)
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        if (i + 2 < n) add(id_(i, j), id_(i + 2, j), cb)
        if (j + 2 < n) add(id_(i, j), id_(i, j + 2), cb)
      }
    this.ca = Int32Array.from(A)
    this.cb = Int32Array.from(B)
    this.cc = Float64Array.from(C)
    this.cr = new Float32Array(A.length)
    this.cl = new Float32Array(A.length)
    this.ca2 = new Float32Array(A.length)
    for (let k = 0; k < A.length; k++) {
      const a = A[k]
      const b = B[k]
      this.cr[k] = Math.hypot(this.rest[a * 2] - this.rest[b * 2], this.rest[a * 2 + 1] - this.rest[b * 2 + 1])
    }
  }

  get spacing(): number {
    return this.p.size / (this.p.n - 1)
  }

  get constraintCount(): number {
    return this.ca.length
  }

  /** Lay the sheet flat, centred at (cx, cy), rotated by angle, `lift` mm above the field. */
  place(cx: number, cy: number, field: HeightField, angle = 0, lift = 0.6): void {
    const n = this.n
    const s = this.spacing
    const half = this.p.size / 2
    const c = Math.cos(angle)
    const sn = Math.sin(angle)
    // flat sheet at the max field height under its footprint + lift
    let top = -Infinity
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const u = i * s - half
        const v = j * s - half
        top = Math.max(top, field.sample(cx + u * c - v * sn, cy + u * sn + v * c))
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        const u = i * s - half
        const v = j * s - half
        this.x[k * 3] = cx + u * c - v * sn
        this.x[k * 3 + 1] = cy + u * sn + v * c
        this.x[k * 3 + 2] = top + this.p.thickness + lift
      }
    this.version++
    this.v.fill(0)
    this.stuck.fill(0)
    this.pinned.fill(0)
    this.pinCount = 0
    this.cooldown.fill(0)
    this.contact.fill(0)
    this.w.fill(1)
    this.grabbed = -1
    this.grabSet = []
    this.grabOff = []
    this.wake()
  }

  /** Bounding box of the particles (x0, y0, x1, y1, zmax). */
  bounds(out: number[] = [0, 0, 0, 0, 0]): number[] {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let z1 = -Infinity
    const X = this.x
    for (let k = 0; k < this.count; k++) {
      const x = X[k * 3]
      const y = X[k * 3 + 1]
      const z = X[k * 3 + 2]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (z > z1) z1 = z
    }
    out[0] = x0
    out[1] = y0
    out[2] = x1
    out[3] = y1
    out[4] = z1
    return out
  }

  /** Nearest particle to (x, y) within maxDist (mm), or -1. */
  pick(x: number, y: number, maxDist: number): number {
    let best = -1
    let bd = maxDist * maxDist
    const X = this.x
    for (let k = 0; k < this.count; k++) {
      const dx = X[k * 3] - x
      const dy = X[k * 3 + 1] - y
      const d = dx * dx + dy * dy
      if (d < bd) {
        bd = d
        best = k
      }
    }
    return best
  }

  /** Is (x, y) over the sheet? Uses the grid cells (works when folded too). */
  covers(x: number, y: number): boolean {
    return this.pick(x, y, this.spacing * 1.6) >= 0
  }

  /**
   * Grab particle k: it and every particle within fingerRadius (rest distance)
   * become a kinematic fingertip patch that follows moveGrab() targets.
   */
  grab(k: number): void {
    if (k < 0) return
    if (this.grabbed >= 0) this.releaseGrab()
    this.grabbed = k
    this.gpx = this.gtx = this.x[k * 3]
    this.gpy = this.gty = this.x[k * 3 + 1]
    this.grabSet = []
    this.grabOff = []
    const fr = this.p.fingerRadius
    for (let i = 0; i < this.count; i++) {
      const d = Math.hypot(this.rest[i * 2] - this.rest[k * 2], this.rest[i * 2 + 1] - this.rest[k * 2 + 1])
      if (d > fr && i !== k) continue
      this.grabSet.push(i)
      this.grabOff.push(this.x[i * 3] - this.gpx, this.x[i * 3 + 1] - this.gpy)
      this.w[i] = 0
      this.pinned[i] = 0
    }
    // long-range attachment rest distances from the grabbed particle (flat geodesic)
    const ru = this.rest[k * 2]
    const rv = this.rest[k * 2 + 1]
    for (let i = 0; i < this.count; i++) this.tether[i] = Math.hypot(this.rest[i * 2] - ru, this.rest[i * 2 + 1] - rv)
    this.wake()
  }

  moveGrab(x: number, y: number): void {
    this.gtx = x
    this.gty = y
    this.wake()
  }

  releaseGrab(): void {
    for (const i of this.grabSet) this.w[i] = 1
    this.grabSet = []
    this.grabOff = []
    this.grabbed = -1
  }

  wake(): void {
    this.asleep = false
    this.still = 0
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return (this.seed >>> 0) / 4294967296
  }

  /** largest particle displacement in the last substep of the last frame (mm) */
  lastMove = 0
  /** bumps whenever particle state changes (renderers re-upload when it differs) */
  version = 0
  // per-frame accumulators
  private fMaxMove = 0
  private fSpeed = 0
  private fContacts = 0
  private fStuck = 0
  private fActive = false

  /**
   * Advance one frame of `substeps` x dt (convenience wrapper around
   * beginFrame / substep / endFrame). Returns false if asleep.
   */
  step(dt: number, substeps: number, env: ClothEnv, events: ProbeEvent[], t: number): boolean {
    if (!this.beginFrame(env)) return false
    for (let s = 0; s < substeps; s++) this.substep(dt, s, substeps, env, events, t + s * dt)
    this.endFrame(env, events, t + substeps * dt)
    return true
  }

  /** Start a frame. Returns false (and skips the frame) when asleep. */
  beginFrame(env: ClothEnv): boolean {
    const st = this.stats
    st.slip = 0
    st.slipEvents = 0
    this.fMaxMove = 0
    this.fSpeed = 0
    this.fContacts = 0
    this.fStuck = 0
    if (this.asleep && this.grabbed < 0 && env.spheres.length === 0 && env.presses.length === 0) {
      st.asleep = true
      this.fActive = false
      return false
    }
    st.asleep = false
    this.asleep = false
    this.fActive = true
    return true
  }

  /** One substep. `s`/`substeps` place the grab target along this frame's pointer motion. */
  substep(dt: number, s: number, substeps: number, env: ClothEnv, events: ProbeEvent[], t: number): void {
    if (!this.fActive) return
    const st = this.stats
    const N = this.count
    const X = this.x
    const X0 = this.x0
    const V = this.v
    const W = this.w
    const P = this.p
    const g = env.g
    const field = env.field
    const thick = P.thickness
    const damp = Math.max(0, 1 - P.damping * dt)

    // --- predict --------------------------------------------------------------
    for (let k = 0; k < N; k++) {
      const i3 = k * 3
      X0[i3] = X[i3]
      X0[i3 + 1] = X[i3 + 1]
      X0[i3 + 2] = X[i3 + 2]
      this.pen[k] = 0
      if (W[k] === 0) continue
      V[i3] = V[i3] * damp + g[0] * dt
      V[i3 + 1] = V[i3 + 1] * damp + g[1] * dt
      V[i3 + 2] = V[i3 + 2] * damp + g[2] * dt
      X[i3] += V[i3] * dt
      X[i3 + 1] += V[i3 + 1] * dt
      X[i3 + 2] += V[i3 + 2] * dt
    }
    // --- kinematic grab: interpolate the target across this frame's substeps ---
    const gk = this.grabbed
    if (gk >= 0) {
      const f = (s + 1) / substeps
      const tx = this.gpx + (this.gtx - this.gpx) * f
      const ty = this.gpy + (this.gty - this.gpy) * f
      const G = this.grabSet
      const O = this.grabOff
      for (let q = 0; q < G.length; q++) {
        const i3 = G[q] * 3
        const px = tx + O[q * 2]
        const py = ty + O[q * 2 + 1]
        X[i3] = px
        X[i3 + 1] = py
        X[i3 + 2] = this.supportZ(px, py, X[i3 + 2], env) + thick
      }
      // palm pressure around the fingertip (pressing the sheet into the surface)
      this.pressAround(tx, ty, P.press, P.pressSigma + P.fingerRadius)
    }
    for (let q = 0; q + 3 < env.presses.length; q += 4) this.pressAround(env.presses[q], env.presses[q + 1], env.presses[q + 2], env.presses[q + 3])

    // --- solve ---------------------------------------------------------------
    const iters = P.iterations
    for (let it = 0; it < iters; it++) {
      this.solveDistances(dt, it === 0)
      if (gk >= 0) this.solveTethers(gk)
      if (P.snags) this.solvePins(events, t)
      this.collideSpheres(env.spheres)
      this.collideField(field, thick, env.layers)
    }

    // --- friction + velocities ------------------------------------------------
    const last = s === substeps - 1
    for (let k = 0; k < N; k++) {
      const i3 = k * 3
      if (W[k] === 0) {
        V[i3] = (X[i3] - X0[i3]) / dt
        V[i3 + 1] = (X[i3 + 1] - X0[i3 + 1]) / dt
        V[i3 + 2] = (X[i3 + 2] - X0[i3 + 2]) / dt
        continue
      }
      if (this.pinned[k]) {
        // snagged: held by the peak (the pin fights the collision a little;
        // don't let that turn into velocity)
        V[i3] = V[i3 + 1] = V[i3 + 2] = 0
        if (last) this.fContacts++
        continue
      }
      const pen = this.pen[k]
      if (pen > 0) {
        // tangential displacement this substep
        const gx = this.cg[k * 2]
        const gy = this.cg[k * 2 + 1]
        const il = 1 / Math.sqrt(gx * gx + gy * gy + 1)
        const nx = -gx * il
        const ny = -gy * il
        const nz = il
        let dx = X[i3] - X0[i3]
        let dy = X[i3 + 1] - X0[i3 + 1]
        let dz = X[i3 + 2] - X0[i3 + 2]
        const dn = dx * nx + dy * ny + dz * nz
        dx -= dn * nx
        dy -= dn * ny
        dz -= dn * nz
        const dt2 = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const xm = X[i3]
        const ym = X[i3 + 1]
        const muK = this.onLayer[k] ? P.muLayer : P.muCloth * env.mu.sample(xm, ym)
        const muS = muK * P.staticRatio
        if (dt2 < muS * pen) {
          X[i3] -= dx
          X[i3 + 1] -= dy
          X[i3 + 2] -= dz
          this.stuck[k] = 1
        } else {
          const f = Math.min(1, (muK * pen) / dt2)
          X[i3] -= dx * f
          X[i3 + 1] -= dy * f
          X[i3 + 2] -= dz * f
          const slid = dt2 * (1 - f)
          st.slip += slid
          if (this.stuck[k]) {
            st.slipEvents++
            this.stuck[k] = 0
          }
          // snag: sliding over a sharp, hard peak
          if (P.snags && !this.pinned[k] && this.cooldown[k] <= 0) {
            const S = env.snag.sample(xm, ym)
            if (S > P.snagMin && !this.onLayer[k] && this.pinCount < P.snagMax && this.rand() < (S - P.snagMin) * slid * P.snagRate) {
              this.pinCount++
              this.pinned[k] = 1
              this.pinS[k] = S
              this.pin[i3] = X[i3]
              this.pin[i3 + 1] = X[i3 + 1]
              this.pin[i3 + 2] = X[i3 + 2]
              events.push({ type: 'snag', source: this.id, x: xm, y: ym, strength: S, t, tag: env.tag?.sample(xm, ym) })
            }
          }
        }
        if (last) {
          this.fContacts++
          if (this.stuck[k]) this.fStuck++
        }
        this.contact[k] = Math.min(1, this.contact[k] * 0.98 + pen * 4)
      } else {
        this.stuck[k] = 0
        this.contact[k] *= 0.97
      }
      if (this.cooldown[k] > 0) this.cooldown[k] -= dt
      const vx = (X[i3] - X0[i3]) / dt
      const vy = (X[i3 + 1] - X0[i3 + 1]) / dt
      let vz = (X[i3 + 2] - X0[i3 + 2]) / dt
      // a sheet below us is only re-gridded once per frame, so its push arrives
      // in one substep: don't let that catch-up become launch velocity
      if (pen > 0 && this.onLayer[k] && vz > 15) vz = 15
      V[i3] = vx
      V[i3 + 1] = vy
      V[i3 + 2] = vz
      if (last) {
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz)
        this.fSpeed += sp
        if (sp * dt > this.fMaxMove) this.fMaxMove = sp * dt
      }
    }
  }

  /** Finish a frame: stats, aggregated slip event, sleep check. */
  endFrame(env: ClothEnv, events: ProbeEvent[], t: number): void {
    if (!this.fActive) return
    this.version++
    const st = this.stats
    const X = this.x
    this.gpx = this.gtx
    this.gpy = this.gty
    if (st.slipEvents > 0 && st.slip > 0.002) {
      // report the frame's slip as one event at the grab point / centroid
      const k = this.grabbed >= 0 ? this.grabbed : this.count >> 1
      events.push({ type: 'slip', source: this.id, x: X[k * 3], y: X[k * 3 + 1], strength: st.slip, t })
    }
    let pins = 0
    for (let k = 0; k < this.count; k++) pins += this.pinned[k]
    st.contacts = this.fContacts
    st.stuck = this.fStuck
    st.snags = pins
    this.pinCount = pins
    st.speed = this.fSpeed / this.count
    this.lastMove = this.fMaxMove
    // sleep when nothing moves and nobody holds us
    if (this.grabbed < 0 && this.fMaxMove < 2e-5 && env.spheres.length === 0 && env.presses.length === 0) {
      if (++this.still > 30) this.asleep = true
    } else this.still = 0
  }

  private pressAround(cx: number, cy: number, depth: number, sigma: number): void {
    if (depth <= 0) return
    const X = this.x
    const inv = 1 / (2 * sigma * sigma)
    const r2 = 9 * sigma * sigma
    for (let k = 0; k < this.count; k++) {
      if (this.w[k] === 0) continue
      const dx = X[k * 3] - cx
      const dy = X[k * 3 + 1] - cy
      const d2 = dx * dx + dy * dy
      if (d2 > r2) continue
      X[k * 3 + 2] -= depth * Math.exp(-d2 * inv)
    }
  }

  private alphaDt = -1
  private solveDistances(dt: number, first: boolean): void {
    const X = this.x
    const W = this.w
    const ca = this.ca
    const cb = this.cb
    const cr = this.cr
    const cl = this.cl
    const M = ca.length
    // XPBD: alpha~ = compliance / dt^2, cached per dt
    if (this.alphaDt !== dt) {
      const idt2 = 1 / (dt * dt)
      for (let c = 0; c < M; c++) this.ca2[c] = this.cc[c] * idt2
      this.alphaDt = dt
    }
    const al = this.ca2
    if (first) cl.fill(0)
    for (let c = 0; c < M; c++) {
      const a = ca[c]
      const b = cb[c]
      const wa = W[a]
      const wb = W[b]
      const alpha = al[c]
      const ws = wa + wb + alpha
      if (ws === 0) continue
      const a3 = a * 3
      const b3 = b * 3
      const dx = X[b3] - X[a3]
      const dy = X[b3 + 1] - X[a3 + 1]
      const dz = X[b3 + 2] - X[a3 + 2]
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (len < 1e-9) continue
      const dl = (cr[c] - len - alpha * cl[c]) / ws
      cl[c] += dl
      const s = dl / len
      const sa = wa * s
      const sb = wb * s
      X[a3] -= sa * dx
      X[a3 + 1] -= sa * dy
      X[a3 + 2] -= sa * dz
      X[b3] += sb * dx
      X[b3 + 1] += sb * dy
      X[b3 + 2] += sb * dz
    }
  }

  /**
   * Long-range attachments from the finger: nobody gets farther than their rest
   * geodesic (+slack), nor closer than compressLimit x rest (in the plane), so a
   * push slides the far side of the sheet after some wrinkling.
   */
  private solveTethers(gk: number): void {
    const X = this.x
    const gx = X[gk * 3]
    const gy = X[gk * 3 + 1]
    const gz = X[gk * 3 + 2]
    const T = this.tether
    const hi = 1 + this.p.tetherSlack
    const lo = this.p.compressLimit
    for (let k = 0; k < this.count; k++) {
      if (this.w[k] === 0) continue
      const k3 = k * 3
      const dx = X[k3] - gx
      const dy = X[k3 + 1] - gy
      const dz = X[k3 + 2] - gz
      const d2 = dx * dx + dy * dy + dz * dz
      const L = T[k] * hi
      if (d2 > L * L) {
        const d = Math.sqrt(d2)
        const s = (d - L) / d
        X[k3] -= dx * s
        X[k3 + 1] -= dy * s
        X[k3 + 2] -= dz * s
        continue
      }
      const Lmin = T[k] * lo
      const p2 = dx * dx + dy * dy
      if (p2 < Lmin * Lmin && p2 > 1e-12) {
        // push outward in the plane only (wrinkles may still rise)
        const dp = Math.sqrt(p2)
        const s = (Lmin - dp) / dp
        X[k3] += dx * s
        X[k3 + 1] += dy * s
      }
    }
  }

  private solvePins(events: ProbeEvent[], t: number): void {
    const X = this.x
    const P = this.p
    for (let k = 0; k < this.count; k++) {
      if (!this.pinned[k]) continue
      const k3 = k * 3
      const dx = X[k3] - this.pin[k3]
      const dy = X[k3 + 1] - this.pin[k3 + 1]
      const dz = X[k3 + 2] - this.pin[k3 + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d > P.snagHold * this.pinS[k] * this.spacing) {
        this.pinned[k] = 0
        this.pinCount--
        this.cooldown[k] = 0.3
        events.push({ type: 'snagRelease', source: this.id, x: this.pin[k3], y: this.pin[k3 + 1], strength: d, t })
        continue
      }
      X[k3] = this.pin[k3]
      X[k3 + 1] = this.pin[k3 + 1]
      X[k3 + 2] = this.pin[k3 + 2]
    }
  }

  private collideSpheres(sph: number[]): void {
    if (sph.length === 0) return
    const X = this.x
    const t = this.p.thickness
    for (let q = 0; q + 3 < sph.length; q += 4) {
      const cx = sph[q]
      const cy = sph[q + 1]
      const cz = sph[q + 2]
      const R = sph[q + 3] + t
      const R2 = R * R
      for (let k = 0; k < this.count; k++) {
        if (this.w[k] === 0) continue
        const k3 = k * 3
        const dx = X[k3] - cx
        const dy = X[k3 + 1] - cy
        if (dx * dx + dy * dy > R2) continue
        const dz = X[k3 + 2] - cz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= R2) continue
        const d = Math.sqrt(d2) || 1e-6
        const s = (R - d) / d
        X[k3] += dx * s
        X[k3 + 1] += dy * s
        X[k3 + 2] += dz * s
      }
    }
  }

  /** Top of whatever is under (x, y) for a particle at height z: field or a cloth below. */
  private supportZ(x: number, y: number, z: number, env: ClothEnv): number {
    let h = env.field.sample(x, y)
    for (const L of env.layers) {
      const hl = L.sample(x, y)
      if (hl > -100 && z > hl - 0.5 * L.thick && hl > h) h = hl
    }
    return h
  }

  private collideField(field: HeightField, thick: number, layers: ClothLayer[]): void {
    const X = this.x
    const hs = this.hs
    const nl = layers.length
    for (let k = 0; k < this.count; k++) {
      const k3 = k * 3
      field.sampleGrad(X[k3], X[k3 + 1], hs)
      let zmin = hs.h + thick
      let gx = hs.gx
      let gy = hs.gy
      let onLayer = 0
      const z = X[k3 + 2]
      for (let q = 0; q < nl; q++) {
        const L = layers[q]
        const hl = L.sample(X[k3], X[k3 + 1])
        // only if we are on top of that sheet here (it is below us)
        if (hl > -100 && z > hl - 0.5 * L.thick && hl + thick > zmin) {
          zmin = hl + thick
          gx = gy = 0
          onLayer = 1
        }
      }
      if (z >= zmin) continue
      const d = zmin - z
      this.pen[k] += d
      this.cg[k * 2] = gx
      this.cg[k * 2 + 1] = gy
      this.onLayer[k] = onLayer
      if (this.w[k] === 0) continue
      // linearised projection along the field gradient: C = z - h(x,y) - t
      const s = d / (1 + gx * gx + gy * gy)
      X[k3] -= s * gx
      X[k3 + 1] -= s * gy
      X[k3 + 2] += s
    }
  }

  /** Per-particle normals (central differences on the grid) into this.normals. */
  computeNormals(): Float32Array {
    const n = this.n
    const X = this.x
    const out = this.normals
    for (let j = 0; j < n; j++) {
      const jm = j > 0 ? j - 1 : j
      const jp = j < n - 1 ? j + 1 : j
      for (let i = 0; i < n; i++) {
        const im = i > 0 ? i - 1 : i
        const ip = i < n - 1 ? i + 1 : i
        const a = (j * n + ip) * 3
        const b = (j * n + im) * 3
        const c = (jp * n + i) * 3
        const d = (jm * n + i) * 3
        const ux = X[a] - X[b]
        const uy = X[a + 1] - X[b + 1]
        const uz = X[a + 2] - X[b + 2]
        const vx = X[c] - X[d]
        const vy = X[c + 1] - X[d + 1]
        const vz = X[c + 2] - X[d + 2]
        let nx = uy * vz - uz * vy
        let ny = uz * vx - ux * vz
        let nz = ux * vy - uy * vx
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
        nx /= l
        ny /= l
        nz /= l
        const k = (j * n + i) * 3
        out[k] = nx
        out[k + 1] = ny
        out[k + 2] = nz
      }
    }
    return out
  }

  /** Pack positions + contact into RGBA float32 (for a sim texture). */
  packPositions(out: Float32Array): Float32Array {
    for (let k = 0; k < this.count; k++) {
      out[k * 4] = this.x[k * 3]
      out[k * 4 + 1] = this.x[k * 3 + 1]
      out[k * 4 + 2] = this.x[k * 3 + 2]
      out[k * 4 + 3] = this.contact[k]
    }
    return out
  }

  /** Pack normals + stuck flag into RGBA float32. */
  packNormals(out: Float32Array): Float32Array {
    const nrm = this.computeNormals()
    for (let k = 0; k < this.count; k++) {
      out[k * 4] = nrm[k * 3]
      out[k * 4 + 1] = nrm[k * 3 + 1]
      out[k * 4 + 2] = nrm[k * 3 + 2]
      out[k * 4 + 3] = this.pinned[k] ? 2 : this.stuck[k]
    }
    return out
  }

  /** Mean contact height under the sheet etc. for tests. */
  summary() {
    const b = this.bounds()
    let cz = 0
    for (let k = 0; k < this.count; k++) cz += this.x[k * 3 + 2]
    return {
      id: this.id,
      n: this.n,
      cx: (b[0] + b[2]) / 2,
      cy: (b[1] + b[3]) / 2,
      bbox: b.slice(0, 4).map((v) => +v.toFixed(2)),
      meanZ: +(cz / this.count).toFixed(3),
      grabbed: this.grabbed,
      ...this.stats,
    }
  }
}

/**
 * TrayFluid: the facade Darkroom, Plates and Latent code against (architecture section 4.6).
 *
 * A thin, deterministic wrapper over the spike's staggered-grid `ShallowWater` solver:
 *  - tray-local frame (origin at the tray centre, +x right, +y toward the viewer, metres);
 *  - tilt as tangents, tray acceleration as a fictitious force, extra floor (a glass plate);
 *  - fixed internal substeps (default 1/240 s, at most 8 per call: an overrun slows the sim, never spirals);
 *  - cell-centred velocity arrays, spill / wall-impact / slap reports, sleep, snapshots.
 *
 * Pure TypeScript, no DOM, no three. Float32 state; no randomness (snapshot/restore replays bit-exactly).
 */
import { ShallowWater } from './shallowWater'

const G = 9.81
const RHO = 1000

export interface TrayFluidOptions {
  nx: number
  ny: number
  /** Cell size (m); interior = nx*dx by ny*dx. */
  dx: number
  /** Rest depth (m): the free surface sits this high above the base floor after refill(). */
  depth: number
  /** Rim height above the base floor (m); liquid above it spills. */
  lip: number
  /** Linear damping 1/s (ring-down). Default 0.8. */
  damping?: number
  /** Nonlinear momentum advection. Default true (pass false on the low tier). */
  advect?: boolean
  /** Internal substep (s). Default 1/240. */
  substepDt?: number
  /** Substeps per step() call. Default 8. */
  maxSubsteps?: number
  /** Extra floor height (m) at tray-local (x, y), e.g. a 2 mm glass plate. */
  floor?: ((x: number, y: number) => number) | null
}

export interface FluidStepReport {
  /** Liquid that left over the rim during this step (m^3). */
  spill: number
  /** Sum over wall cells of rho * h * u_n^2 * dx for velocity toward the wall (J proxy). */
  wallImpact: number
  /** Kinetic energy of the liquid (J). */
  kinetic: number
  substeps: number
  /** Waves that just struck a wall: where (tray-local) and a wallImpact-scale energy. */
  slaps: { x: number; y: number; e: number }[]
}

export interface FluidSnapshot {
  v: 1
  nx: number
  ny: number
  h: Float32Array
  ux: Float32Array
  uy: Float32Array
  tilt: [number, number]
  /** Everything else needed to replay bit-exactly (additive; absent in hand-made snapshots). */
  ext?: {
    u: Float32Array
    v: Float32Array
    s: Float32Array
    acc: number
    accel: [number, number]
    quiet: number
    sleeping: boolean
    spilled: number
    ke: number
    lastSlap: Float32Array
    bed: Float32Array | null
  }
}

export class TrayFluid {
  readonly nx: number
  readonly ny: number
  readonly dx: number
  readonly width: number
  readonly height: number
  /** Depth above the local floor per cell, index j*nx + i. */
  readonly h: Float32Array
  /** Cell-centred velocity (m/s), refreshed at the end of every step(). */
  readonly ux: Float32Array
  readonly uy: Float32Array
  sleeping = false

  /** The rest depth and lip this tray was made with. */
  readonly depth: number
  readonly lip: number
  /** Total volume that has left over the rim since construction (m^3). */
  spilled = 0

  private readonly sw: ShallowWater
  private bed: Float32Array | null = null
  private floorFn: ((x: number, y: number) => number) | null = null
  private tanX = 0
  private tanY = 0
  private accX = 0
  private accY = 0
  private readonly substepDt: number
  private readonly maxSubsteps: number
  private acc = 0
  private quiet = 0
  private ke = 0
  private readonly lastSlap: Float32Array
  private readonly slapE0: number

  constructor(o: TrayFluidOptions) {
    this.nx = o.nx
    this.ny = o.ny
    this.dx = o.dx
    this.width = o.nx * o.dx
    this.height = o.ny * o.dx
    this.depth = o.depth
    this.lip = o.lip
    this.substepDt = o.substepDt ?? 1 / 240
    this.maxSubsteps = Math.max(1, o.maxSubsteps ?? 8)
    this.sw = new ShallowWater({
      nx: o.nx,
      ny: o.ny,
      dx: o.dx,
      advect: o.advect ?? true,
      rimHeight: o.lip,
      linearDamping: o.damping ?? 0.8,
    })
    this.sw.trackTracer = false
    this.h = this.sw.h
    this.ux = this.sw.uc
    this.uy = this.sw.vc
    this.lastSlap = new Float32Array(2 * (o.nx + o.ny))
    this.slapE0 = RHO * o.dx * 7e-4
    this.applyGravity()
    if (o.floor) this.setFloor(o.floor)
    this.refill(o.depth)
  }

  // ------------------------------------------------------------------ inputs

  /** Tilt as tangents. +tanX lowers the +x side (liquid runs to +x); +tanY lowers the +y side (toward the viewer). */
  setTilt(tanX: number, tanY: number): void {
    if (tanX === this.tanX && tanY === this.tanY) return
    this.tanX = tanX
    this.tanY = tanY
    this.applyGravity()
    this.wake()
  }

  /** Tray lateral acceleration (m/s^2). Liquid feels the opposite push (fictitious head term). */
  setAccel(ax: number, ay: number): void {
    if (ax === this.accX && ay === this.accY) return
    this.accX = ax
    this.accY = ay
    this.applyGravity()
    if (ax !== 0 || ay !== 0) this.wake()
  }

  /** Extra floor height (m) as a function of tray-local position, or null for a flat floor. The free surface is kept
   *  where the new floor is below it; volume is conserved (a plate displaces liquid, raising the level a little). */
  setFloor(fn: ((x: number, y: number) => number) | null): void {
    const { nx, ny, dx } = this
    const v0 = this.volume()
    const old = this.bed
    let bed: Float32Array | null = null
    if (fn) {
      bed = new Float32Array(nx * ny)
      for (let j = 0; j < ny; j++) {
        const y = (j + 0.5) * dx - this.height / 2
        for (let i = 0; i < nx; i++) bed[j * nx + i] = fn((i + 0.5) * dx - this.width / 2, y)
      }
    }
    const h = this.h
    for (let c = 0; c < h.length; c++) {
      const eta = h[c] + (old ? old[c] : 0)
      const nh = eta - (bed ? bed[c] : 0)
      h[c] = nh > 0 ? nh : 0
    }
    this.bed = bed
    this.sw.bed = bed
    this.floorFn = fn
    this.restoreVolume(v0)
    this.wake()
  }

  /** The current floor function (null when flat). */
  getFloor(): ((x: number, y: number) => number) | null {
    return this.floorFn
  }

  /** Volume-conserving Gaussian bump (dunk, drip): dh is the peak (m); the same volume is taken evenly from the wet cells. */
  impulse(x: number, y: number, radius: number, dh: number): void {
    const { nx, ny, dx, h } = this
    const r = Math.max(radius, dx)
    const cx = x + this.width / 2
    const cy = y + this.height / 2
    const i0 = Math.max(0, Math.floor((cx - 3 * r) / dx))
    const i1 = Math.min(nx - 1, Math.ceil((cx + 3 * r) / dx))
    const j0 = Math.max(0, Math.floor((cy - 3 * r) / dx))
    const j1 = Math.min(ny - 1, Math.ceil((cy + 3 * r) / dx))
    let added = 0
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const ddx = (i + 0.5) * dx - cx
        const ddy = (j + 0.5) * dx - cy
        const c = j * nx + i
        const d = dh * Math.exp(-(ddx * ddx + ddy * ddy) / (r * r))
        const nh = h[c] + d
        const applied = nh < 0 ? -h[c] : d
        h[c] += applied
        added += applied
      }
    }
    this.takeEvenly(added * dx * dx)
    this.wake()
  }

  /** Volume-conserving ring ripple (tap the liquid). strength 1 = a 1 mm centre displacement (capped at half the local depth). */
  poke(x: number, y: number, strength: number): void {
    const { nx, ny, dx, h } = this
    const sigma = Math.max(2 * dx, 0.006)
    const cx = x + this.width / 2
    const cy = y + this.height / 2
    const R = 3 * sigma
    const i0 = Math.max(0, Math.floor((cx - R) / dx))
    const i1 = Math.min(nx - 1, Math.ceil((cx + R) / dx))
    const j0 = Math.max(0, Math.floor((cy - R) / dx))
    const j1 = Math.min(ny - 1, Math.ceil((cy + R) / dx))
    // Laplacian-of-Gaussian profile (1 - q) exp(-q), q = (d/sigma)^2: integrates to zero over the plane.
    const centre = Math.min(strength * 1e-3, 0.5 * this.depthAt(x, y))
    if (centre <= 0) return
    let net = 0
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const ddx = (i + 0.5) * dx - cx
        const ddy = (j + 0.5) * dx - cy
        const q = (ddx * ddx + ddy * ddy) / (sigma * sigma)
        const c = j * nx + i
        const d = centre * (1 - q) * Math.exp(-q)
        const nh = Math.max(0, h[c] + d)
        net += nh - h[c]
        h[c] = nh
      }
    }
    // The truncated window is not exactly zero-mean, and dry cells clip: even the residual out.
    if (net > 0) this.takeEvenly(net * dx * dx)
    else if (net < 0) this.addEvenly(-net * dx * dx)
    this.wake()
  }

  /** Pour: add m3 as a Gaussian footprint of the given radius (m). Spills over the lip when it overflows. */
  addVolume(x: number, y: number, radius: number, m3: number): void {
    if (m3 <= 0) return
    this.sw.addVolume(x + this.width / 2, y + this.height / 2, radius, m3, 1)
    this.wake()
  }

  /** Remove up to m3 around (x, y) (droplets leaving the surface). Returns the volume taken. */
  takeVolume(x: number, y: number, m3: number): number {
    const { nx, ny, dx, h } = this
    const ci = Math.min(nx - 1, Math.max(0, Math.floor((x + this.width / 2) / dx)))
    const cj = Math.min(ny - 1, Math.max(0, Math.floor((y + this.height / 2) / dx)))
    let left = m3
    for (let ring = 0; ring <= 2 && left > 0; ring++) {
      for (let j = Math.max(0, cj - ring); j <= Math.min(ny - 1, cj + ring) && left > 0; j++) {
        for (let i = Math.max(0, ci - ring); i <= Math.min(nx - 1, ci + ring) && left > 0; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue
          const c = j * nx + i
          const avail = Math.max(0, h[c] - 2e-4) * dx * dx
          const t = Math.min(avail, left)
          h[c] -= t / (dx * dx)
          left -= t
        }
      }
    }
    this.wake()
    return m3 - left
  }

  /** Flat free surface at `depth` (default: the constructor's) above the base floor; velocities zeroed. */
  refill(depth: number = this.depth): void {
    const bed = this.bed
    const h = this.h
    for (let c = 0; c < h.length; c++) {
      const d = depth - (bed ? bed[c] : 0)
      h[c] = d > 0 ? d : 0
    }
    this.sw.u.fill(0)
    this.sw.v.fill(0)
    this.ux.fill(0)
    this.uy.fill(0)
    this.acc = 0
    this.lastSlap.fill(0)
    this.ke = 0
    this.wake()
  }

  wake(): void {
    this.sleeping = false
    this.quiet = 0
  }

  // ------------------------------------------------------------------ step

  /** Advance by a frame dt (s): fixed internal substeps, at most maxSubsteps per call. */
  step(dt: number): FluidStepReport {
    const report: FluidStepReport = { spill: 0, wallImpact: 0, kinetic: this.ke, substeps: 0, slaps: [] }
    if (!(dt > 0)) return report
    if (this.sleeping) return report
    const sub = this.substepDt
    this.acc += dt
    let n = Math.floor(this.acc / sub + 1e-6)
    if (n > this.maxSubsteps) {
      n = this.maxSubsteps
      this.acc = 0
    } else {
      this.acc -= n * sub
      if (this.acc < 0) this.acc = 0
    }
    for (let k = 0; k < n; k++) this.sw.step(sub)
    report.substeps = n
    const out = this.sw.outRim + this.sw.outSpout
    this.sw.outRim = 0
    this.sw.outSpout = 0
    report.spill = out
    this.spilled += out
    if (n > 0) this.refreshVelocity()
    report.wallImpact = this.scanWalls(report.slaps)
    this.ke = this.kinetic()
    report.kinetic = this.ke
    if (this.ke < 1e-6) {
      this.quiet += dt
      if (this.quiet >= 1) {
        this.sleeping = true
        this.sw.u.fill(0)
        this.sw.v.fill(0)
        this.ux.fill(0)
        this.uy.fill(0)
        this.ke = 0
        report.kinetic = 0
      }
    } else this.quiet = 0
    return report
  }

  // ------------------------------------------------------------------ queries (tray-local metres)

  depthAt(x: number, y: number): number {
    return this.sw.sampleCell(this.h, x + this.width / 2, y + this.height / 2)
  }

  velocityAt(x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.sw.sampleCell(this.ux, x + this.width / 2, y + this.height / 2)
    out.y = this.sw.sampleCell(this.uy, x + this.width / 2, y + this.height / 2)
    return out
  }

  speedAt(x: number, y: number): number {
    const a = this.sw.sampleCell(this.ux, x + this.width / 2, y + this.height / 2)
    const b = this.sw.sampleCell(this.uy, x + this.width / 2, y + this.height / 2)
    return Math.sqrt(a * a + b * b)
  }

  /** Free surface height (h + floor) above the base floor, bilinear: for rendering. */
  surfaceAt(x: number, y: number): number {
    const sx = x + this.width / 2
    const sy = y + this.height / 2
    const d = this.sw.sampleCell(this.h, sx, sy)
    return this.bed ? d + this.sw.sampleCell(this.bed, sx, sy) : d
  }

  /** Floor height (m) at a point (0 on a flat floor), bilinear. */
  floorAt(x: number, y: number): number {
    return this.bed ? this.sw.sampleCell(this.bed, x + this.width / 2, y + this.height / 2) : 0
  }

  /** Total liquid volume (m^3). */
  volume(): number {
    return this.sw.volume()
  }

  /** Kinetic energy (J), rho = 1000. */
  kinetic(): number {
    const { h, ux, uy } = this
    let e = 0
    for (let c = 0; c < h.length; c++) e += h[c] * (ux[c] * ux[c] + uy[c] * uy[c])
    return 0.5 * RHO * e * this.dx * this.dx
  }

  /** Staggered-grid solver, for adapters that need the spike-level API (cell fields, weirs). */
  get solver(): ShallowWater {
    return this.sw
  }

  // ------------------------------------------------------------------ snapshots

  snapshot(): FluidSnapshot {
    return {
      v: 1,
      nx: this.nx,
      ny: this.ny,
      h: this.h.slice(),
      ux: this.ux.slice(),
      uy: this.uy.slice(),
      tilt: [this.tanX, this.tanY],
      ext: {
        u: this.sw.u.slice(),
        v: this.sw.v.slice(),
        s: this.sw.s.slice(),
        acc: this.acc,
        accel: [this.accX, this.accY],
        quiet: this.quiet,
        sleeping: this.sleeping,
        spilled: this.spilled,
        ke: this.ke,
        lastSlap: this.lastSlap.slice(),
        bed: this.bed ? this.bed.slice() : null,
      },
    }
  }

  restore(s: FluidSnapshot): void {
    if (s.nx !== this.nx || s.ny !== this.ny) throw new Error('TrayFluid.restore: grid size mismatch')
    this.h.set(s.h)
    this.ux.set(s.ux)
    this.uy.set(s.uy)
    this.tanX = s.tilt[0]
    this.tanY = s.tilt[1]
    const e = s.ext
    if (e) {
      this.sw.u.set(e.u)
      this.sw.v.set(e.v)
      this.sw.s.set(e.s)
      this.acc = e.acc
      this.accX = e.accel[0]
      this.accY = e.accel[1]
      this.quiet = e.quiet
      this.sleeping = e.sleeping
      this.spilled = e.spilled
      this.ke = e.ke
      this.lastSlap.set(e.lastSlap)
      if (e.bed) {
        if (!this.bed) this.bed = new Float32Array(this.nx * this.ny)
        this.bed.set(e.bed)
        this.sw.bed = this.bed
      } else {
        this.bed = null
        this.sw.bed = null
      }
    } else {
      this.rebuildFaceVelocities()
      this.acc = 0
      this.quiet = 0
      this.sleeping = false
    }
    this.applyGravity()
  }

  // ------------------------------------------------------------------ internals

  private applyGravity(): void {
    const n = Math.sqrt(1 + this.tanX * this.tanX + this.tanY * this.tanY)
    this.sw.gz = G / n
    this.sw.gx = (G * this.tanX) / n - this.accX
    this.sw.gy = (G * this.tanY) / n - this.accY
  }

  /** Cell-centred velocity from the face velocities. */
  private refreshVelocity(): void {
    const { nx, ny, ux, uy, h } = this
    const u = this.sw.u
    const v = this.sw.v
    const nxu = nx + 1
    const eps = this.sw.dryEps
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        if (h[c] <= eps) {
          ux[c] = 0
          uy[c] = 0
        } else {
          ux[c] = 0.5 * (u[j * nxu + i] + u[j * nxu + i + 1])
          uy[c] = 0.5 * (v[c] + v[c + nx])
        }
      }
    }
  }

  /** Approximate face velocities from cell-centred ones (for snapshots without `ext`). */
  private rebuildFaceVelocities(): void {
    const { nx, ny, ux, uy } = this
    const u = this.sw.u
    const v = this.sw.v
    const nxu = nx + 1
    for (let j = 0; j < ny; j++) {
      for (let i = 1; i < nx; i++) u[j * nxu + i] = 0.5 * (ux[j * nx + i - 1] + ux[j * nx + i])
      u[j * nxu] = 0
      u[j * nxu + nx] = 0
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = 0.5 * (uy[(j - 1) * nx + i] + uy[j * nx + i])
    for (let i = 0; i < nx; i++) { v[i] = 0; v[ny * nx + i] = 0 }
  }

  /** Wall impact sum and edge-detected slaps (one event per wall at most). */
  private scanWalls(slaps: { x: number; y: number; e: number }[]): number {
    const { nx, ny, dx, h, ux, uy, lastSlap: ls } = this
    const k = RHO * dx
    const E0 = this.slapE0
    const halfW = this.width / 2
    const halfH = this.height / 2
    let total = 0
    // wall 0: left, 1: right, 2: front/bottom (j = 0), 3: back/top (j = ny - 1)
    const sum = [0, 0, 0, 0]
    const sx = [0, 0, 0, 0]
    const sy = [0, 0, 0, 0]
    const consider = (idx: number, wall: number, c: number, uin: number, x: number, y: number): void => {
      const e = uin > 0 ? k * h[c] * uin * uin : 0
      total += e
      const prev = ls[idx]
      ls[idx] = e
      if (e >= E0 && e > prev * 1.2) {
        sum[wall] += e
        sx[wall] += e * x
        sy[wall] += e * y
      }
    }
    for (let j = 0; j < ny; j++) {
      const y = (j + 0.5) * dx - halfH
      consider(j, 0, j * nx, -ux[j * nx], -halfW + 0.5 * dx, y)
      consider(ny + j, 1, j * nx + nx - 1, ux[j * nx + nx - 1], halfW - 0.5 * dx, y)
    }
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * dx - halfW
      consider(2 * ny + i, 2, i, -uy[i], x, -halfH + 0.5 * dx)
      consider(2 * ny + nx + i, 3, (ny - 1) * nx + i, uy[(ny - 1) * nx + i], x, halfH - 0.5 * dx)
    }
    for (let w = 0; w < 4; w++) if (sum[w] > 0) slaps.push({ x: sx[w] / sum[w], y: sy[w] / sum[w], e: sum[w] })
    return total
  }

  /** Remove `vol` (m^3) evenly from wet cells (never below zero); iterates a few times for clipped cells. */
  private takeEvenly(vol: number): void {
    const { h, dx } = this
    let left = vol / (dx * dx)
    for (let pass = 0; pass < 4 && left > 1e-12; pass++) {
      let n = 0
      for (let c = 0; c < h.length; c++) if (h[c] > 1e-6) n++
      if (!n) return
      const per = left / n
      let removed = 0
      for (let c = 0; c < h.length; c++) {
        if (h[c] <= 1e-6) continue
        const t = h[c] < per ? h[c] : per
        h[c] -= t
        removed += t
      }
      left -= removed
    }
  }

  /** Add `vol` (m^3) evenly over wet cells. */
  private addEvenly(vol: number): void {
    const { h, dx } = this
    let n = 0
    for (let c = 0; c < h.length; c++) if (h[c] > 1e-6) n++
    if (!n) return
    const per = vol / (dx * dx) / n
    for (let c = 0; c < h.length; c++) if (h[c] > 1e-6) h[c] += per
  }

  /** After a floor change: put back the volume the clipping or displacement changed, over the wet cells. */
  private restoreVolume(target: number): void {
    const diff = target - this.volume()
    if (diff > 0) this.addEvenly(diff)
    else if (diff < 0) this.takeEvenly(-diff)
  }
}

/** Fundamental (mode 1) slosh frequency of a closed tank in the shallow-water limit: mode * sqrt(g h) / (2 L), in Hz. */
export function sloshFrequency(lengthM: number, depthM: number, mode = 1): number {
  return (mode * Math.sqrt(G * depthM)) / (2 * lengthM)
}

/** Perceptual 0..1 loudness for a wall slap of energy e (the `e` of FluidStepReport.slaps, J proxy). */
export function wallSlapToGain(e: number): number {
  if (!(e > 0)) return 0
  return 1 - Math.exp(-e / 0.03)
}

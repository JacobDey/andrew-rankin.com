/**
 * Shallow-water heightfield on a staggered (MAC) grid, in the TRAY frame.
 *
 *   h  depth at cell centres                       nx * ny        index j*nx + i
 *   u  x-velocity on vertical faces                (nx+1) * ny    index j*(nx+1) + i   (face left of cell i)
 *   v  y-velocity on horizontal faces              nx * (ny+1)    index j*nx + i       (face below cell j)
 *   s  passive tracer concentration 0..1 (developer freshness) carried by the same mass fluxes
 *
 * Each substep (forward-backward):
 *   1. momentum, one fused pass per face: semi-Lagrangian advection (only where the water is deep, never
 *      across a wet/dry front) + eddy viscosity + gravity/pressure gradient + linear and thin-film drag
 *   2. continuity: upwind mass fluxes with a per-cell outflow limiter (depth never negative, mass exact),
 *      weir outflow over the rim / spout, tracer carried by the same fluxes
 *   3. wave breaking: relax any free-surface slope steeper than maxSlope (conservative)
 * step(dt) splits dt so (|u| + sqrt(g h)) dt/dx stays under cfl (0.7).
 *
 * Gravity is supplied already rotated into the tray frame (gx, gy tangential, gz normal), so tilting the
 * tray is just a change of (gx, gy, gz); the bed is flat in tray space.
 *
 * Pure TypeScript, no DOM. Units: metres, seconds.
 */

export interface ShallowWaterOptions {
  nx: number
  ny: number
  /** Cell size (m). Tray floor is nx*dx by ny*dx. */
  dx: number
  /** Semi-Lagrangian momentum advection. Off = linearised SWE (cheaper, less "bore" character). */
  advect?: boolean
  /** Faces next to cells shallower than this (m) skip advection (keeps fronts clean). Default 1.5 mm. */
  advectMinDepth?: number
  /**
   * Velocity diffusion (m^2/s). The C-grid forward-backward scheme never dissipates the checkerboard mode
   * that bores and wet/dry switching inject; 1e-4 removes it within ~1 s while the slosh modes barely notice.
   * (A biharmonic smoothing of h was tried as well: combined with this it goes unstable. Don't.)
   */
  eddyViscosity?: number
  /** Steepest free-surface slope before the wave "breaks" (dimensionless). 0 disables. Default 0.8. */
  maxSlope?: number
  /** Linear drag (1/s). Sets how long a slosh rings. */
  linearDamping?: number
  /** Kinematic viscosity (m^2/s) for thin-film drag 3*nu/h^2. Makes films cling, deep water slosh. */
  viscosity?: number
  /** Depth (m) below which a cell is dry. */
  dryEps?: number
  /** Rim height (m) along every wall; liquid above it leaves over the rim (spill). */
  rimHeight?: number
  /** Weir discharge coefficient (q = C * sqrt(g) * head^1.5 per metre of lip). */
  weirCoeff?: number
  /** Max Courant number on (|u| + c) used to split a step into sub-substeps. Default 0.7. */
  cfl?: number
}

/** Which kind of boundary edge an outflow went over. */
export const EDGE_RIM = 0
export const EDGE_SPOUT = 1

export class ShallowWater {
  readonly nx: number
  readonly ny: number
  readonly dx: number
  readonly width: number
  readonly height: number

  h: Float32Array
  u: Float32Array
  v: Float32Array
  s: Float32Array
  /** Cell-centred |velocity| (m/s), refreshed by computeDerived(). */
  readonly speed: Float32Array
  /** Cell-centred velocity components (m/s), refreshed by computeDerived(). */
  readonly uc: Float32Array
  readonly vc: Float32Array
  /** Low-passed agitation proxy (m/s): fast attack, slow release. Drives developer exchange at the paper. */
  readonly agitation: Float32Array

  /** Lip height (m) per boundary edge: left/right walls have ny edges, bottom/top walls nx edges. */
  readonly lipL: Float32Array
  readonly lipR: Float32Array
  readonly lipB: Float32Array
  readonly lipT: Float32Array
  /** Edge kind per boundary edge (EDGE_RIM or EDGE_SPOUT). */
  readonly kindL: Uint8Array
  readonly kindR: Uint8Array
  readonly kindB: Uint8Array
  readonly kindT: Uint8Array
  /** Outflow rate per boundary edge from the last substep (m^3/s); read for stream visuals. */
  readonly outL: Float32Array
  readonly outR: Float32Array
  readonly outB: Float32Array
  readonly outT: Float32Array

  /** Tangential gravity in tray frame (m/s^2): positive gx pushes liquid toward +x. */
  gx = 0
  gy = 0
  /** Normal gravity magnitude (m/s^2, > 0). */
  gz = 9.81

  advect: boolean
  advectMinDepth: number
  eddyViscosity: number
  maxSlope: number
  linearDamping: number
  viscosity: number
  dryEps: number
  weirCoeff: number
  cfl: number

  /** Volumes (m^3) that left the tray, accumulated until the caller reads and zeroes them. */
  outRim = 0
  outSpout = 0
  /** Number of sub-substeps the last step() needed for CFL. */
  lastSplit = 1

  private u2: Float32Array
  private v2: Float32Array
  private fu: Float32Array
  private fv: Float32Array
  private sc: Float32Array
  private s2: Float32Array
  private wq: Float32Array
  private lim: Int32Array

  constructor(o: ShallowWaterOptions) {
    const { nx, ny, dx } = o
    this.nx = nx
    this.ny = ny
    this.dx = dx
    this.width = nx * dx
    this.height = ny * dx
    const n = nx * ny
    this.h = new Float32Array(n)
    this.s = new Float32Array(n).fill(1)
    this.u = new Float32Array((nx + 1) * ny)
    this.v = new Float32Array(nx * (ny + 1))
    this.u2 = new Float32Array((nx + 1) * ny)
    this.v2 = new Float32Array(nx * (ny + 1))
    this.fu = new Float32Array((nx + 1) * ny)
    this.fv = new Float32Array(nx * (ny + 1))
    this.sc = new Float32Array(n)
    this.s2 = new Float32Array(n)
    this.wq = new Float32Array(n)
    this.lim = new Int32Array(n)
    this.speed = new Float32Array(n)
    this.uc = new Float32Array(n)
    this.vc = new Float32Array(n)
    this.agitation = new Float32Array(n)
    const rim = o.rimHeight ?? 0.045
    this.lipL = new Float32Array(ny).fill(rim)
    this.lipR = new Float32Array(ny).fill(rim)
    this.lipB = new Float32Array(nx).fill(rim)
    this.lipT = new Float32Array(nx).fill(rim)
    this.kindL = new Uint8Array(ny)
    this.kindR = new Uint8Array(ny)
    this.kindB = new Uint8Array(nx)
    this.kindT = new Uint8Array(nx)
    this.outL = new Float32Array(ny)
    this.outR = new Float32Array(ny)
    this.outB = new Float32Array(nx)
    this.outT = new Float32Array(nx)
    this.advect = o.advect ?? true
    this.advectMinDepth = o.advectMinDepth ?? 0.0015
    this.eddyViscosity = o.eddyViscosity ?? 1e-4
    this.maxSlope = o.maxSlope ?? 0.8
    this.linearDamping = o.linearDamping ?? 0.4
    this.viscosity = o.viscosity ?? 1.5e-6
    this.dryEps = o.dryEps ?? 1e-5
    this.weirCoeff = o.weirCoeff ?? 0.55
    this.cfl = o.cfl ?? 0.7
  }

  /**
   * Cut a spout (a lower lip) into a corner. `corner` names the tray-frame corner:
   * 'x0y0' = (0,0) front-left, 'x1y0' = front-right, 'x0y1' = back-left, 'x1y1' = back-right.
   * `length` metres of wall on each side of the corner get the lower lip.
   */
  setSpout(corner: 'x0y0' | 'x1y0' | 'x0y1' | 'x1y1', lip: number, length = 0.03): void {
    const { nx, ny, dx } = this
    const k = Math.max(1, Math.round(length / dx))
    const right = corner[1] === '1'
    const top = corner[3] === '1'
    for (let t = 0; t < k; t++) {
      // walls along x (bottom/top), near the chosen x end
      const i = right ? nx - 1 - t : t
      const j = top ? ny - 1 - t : t
      if (top) { this.lipT[i] = lip; this.kindT[i] = EDGE_SPOUT } else { this.lipB[i] = lip; this.kindB[i] = EDGE_SPOUT }
      if (right) { this.lipR[j] = lip; this.kindR[j] = EDGE_SPOUT } else { this.lipL[j] = lip; this.kindL[j] = EDGE_SPOUT }
    }
  }

  /** Total liquid volume (m^3). */
  volume(): number {
    let sum = 0
    const h = this.h
    for (let c = 0; c < h.length; c++) sum += h[c]
    return sum * this.dx * this.dx
  }

  /** Bilinear depth at tray coords (m). */
  sampleH(x: number, y: number): number {
    return this.sampleCell(this.h, x, y)
  }

  /** Bilinear sample of any cell-centred field at tray coords (m). */
  sampleCell(f: Float32Array, x: number, y: number): number {
    const { nx, ny, dx } = this
    let gx = x / dx - 0.5
    let gy = y / dx - 0.5
    gx = gx < 0 ? 0 : gx > nx - 1 ? nx - 1 : gx
    gy = gy < 0 ? 0 : gy > ny - 1 ? ny - 1 : gy
    let i0 = Math.floor(gx)
    let j0 = Math.floor(gy)
    if (i0 > nx - 2) i0 = nx - 2
    if (j0 > ny - 2) j0 = ny - 2
    const fx = gx - i0
    const fy = gy - j0
    const c = j0 * nx + i0
    const a = f[c] + (f[c + 1] - f[c]) * fx
    const b = f[c + nx] + (f[c + nx + 1] - f[c + nx]) * fx
    return a + (b - a) * fy
  }

  /** Fill flat with a given volume (m^3) and tracer value. Zeroes velocities. */
  fillFlat(volume: number, tracer = 1): void {
    const depth = volume / (this.width * this.height)
    this.h.fill(depth)
    this.s.fill(tracer)
    this.u.fill(0)
    this.v.fill(0)
    this.agitation.fill(0)
  }

  /** Put `volume` (m^3) as a block in x in [x0, x1] (dam break). */
  fillBlock(volume: number, x0: number, x1: number, tracer = 1): void {
    const { nx, ny, dx } = this
    this.h.fill(0)
    this.u.fill(0)
    this.v.fill(0)
    this.s.fill(tracer)
    this.agitation.fill(0)
    let cells = 0
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * dx
      if (x >= x0 && x <= x1) cells++
    }
    if (!cells) return
    const depth = volume / (cells * ny * dx * dx)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * dx
        if (x >= x0 && x <= x1) this.h[j * nx + i] = depth
      }
  }

  /**
   * Add `volume` m^3 of liquid with tracer value `tracer`, spread with a Gaussian footprint of
   * radius `r` around (x, y). Mixes tracer by mass.
   */
  addVolume(x: number, y: number, r: number, volume: number, tracer = 1): void {
    const { nx, ny, dx, h, s } = this
    const rr = Math.max(r, dx)
    const i0 = Math.max(0, Math.floor((x - 2 * rr) / dx))
    const i1 = Math.min(nx - 1, Math.ceil((x + 2 * rr) / dx))
    const j0 = Math.max(0, Math.floor((y - 2 * rr) / dx))
    const j1 = Math.min(ny - 1, Math.ceil((y + 2 * rr) / dx))
    let wsum = 0
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const ddx = (i + 0.5) * dx - x
        const ddy = (j + 0.5) * dx - y
        wsum += Math.exp(-(ddx * ddx + ddy * ddy) / (rr * rr))
      }
    if (wsum <= 0) return
    const k = volume / (wsum * dx * dx)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const ddx = (i + 0.5) * dx - x
        const ddy = (j + 0.5) * dx - y
        const dh = k * Math.exp(-(ddx * ddx + ddy * ddy) / (rr * rr))
        const c = j * nx + i
        const hn = h[c] + dh
        s[c] = hn > 1e-9 ? (h[c] * s[c] + dh * tracer) / hn : tracer
        h[c] = hn
      }
  }

  /**
   * Add a velocity change to faces within radius r of (x, y): radial (outward, m/s) plus a directional
   * part (dvx, dvy in m/s). Weighted by a smooth falloff. Used for pour impact, finger pokes and stirring.
   */
  addImpulse(x: number, y: number, r: number, radial: number, dvx = 0, dvy = 0): void {
    const { nx, ny, dx, u, v } = this
    const r2 = r * r
    const nxu = nx + 1
    const i0 = Math.max(1, Math.floor((x - r) / dx))
    const i1 = Math.min(nx - 1, Math.ceil((x + r) / dx))
    const j0 = Math.max(0, Math.floor((y - r) / dx - 0.5))
    const j1 = Math.min(ny - 1, Math.ceil((y + r) / dx))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const fx = i * dx - x
        const fy = (j + 0.5) * dx - y
        const d2 = fx * fx + fy * fy
        if (d2 >= r2) continue
        const w = 1 - d2 / r2
        const d = Math.sqrt(d2) + 1e-6
        u[j * nxu + i] += w * w * (radial * (fx / d) + dvx)
      }
    const ii0 = Math.max(0, Math.floor((x - r) / dx - 0.5))
    const ii1 = Math.min(nx - 1, Math.ceil((x + r) / dx))
    const jj0 = Math.max(1, Math.floor((y - r) / dx))
    const jj1 = Math.min(ny - 1, Math.ceil((y + r) / dx))
    for (let j = jj0; j <= jj1; j++)
      for (let i = ii0; i <= ii1; i++) {
        const fx = (i + 0.5) * dx - x
        const fy = j * dx - y
        const d2 = fx * fx + fy * fy
        if (d2 >= r2) continue
        const w = 1 - d2 / r2
        const d = Math.sqrt(d2) + 1e-6
        v[j * nx + i] += w * w * (radial * (fy / d) + dvy)
      }
  }

  /** Remove up to `volume` m^3 from around (x, y) (droplets leaving the surface). Returns the volume taken. */
  takeVolume(x: number, y: number, volume: number): number {
    const { nx, ny, dx, h } = this
    const i = Math.min(nx - 1, Math.max(0, Math.floor(x / dx)))
    const j = Math.min(ny - 1, Math.max(0, Math.floor(y / dx)))
    const c = j * nx + i
    const avail = Math.max(0, h[c] - 2e-4) * dx * dx
    const t = Math.min(avail, volume)
    h[c] -= t / (dx * dx)
    return t
  }

  /** Advance by dt seconds, splitting into equal sub-substeps if the CFL condition needs it. */
  step(dt: number): void {
    const { nx, ny, h, u, v } = this
    let hMax = 0
    for (let c = 0; c < h.length; c++) if (h[c] > hMax) hMax = h[c]
    // only faces where momentum is advected count: fast films at a front are handled by the limiter/clamp
    const hd = this.advectMinDepth
    let uMax = 0
    for (let j = 0; j < ny; j++)
      for (let i = 1; i < nx; i++) {
        const k = j * (nx + 1) + i
        const a = u[k] < 0 ? -u[k] : u[k]
        if (a > uMax && h[j * nx + i - 1] >= hd && h[j * nx + i] >= hd) uMax = a
      }
    for (let k = nx; k < nx * ny; k++) {
      const a = v[k] < 0 ? -v[k] : v[k]
      if (a > uMax && h[k - nx] >= hd && h[k] >= hd) uMax = a
    }
    // The forward-backward gravity-wave update alone is stable for c*dt/dx < 1/sqrt(2), but coupled with the
    // semi-Lagrangian momentum step it needs the full characteristic speed (|u| + c) below ~0.6: at 0.6 on c
    // alone, a strong rock periodically grows a 1 mm checkerboard in the deep end. Measured, not guessed.
    // Without advection the linear scheme only needs c (and |u|*dt < dx for the upwind fluxes).
    const c = Math.sqrt(Math.max(this.gz, 0.5) * hMax)
    const need = this.advect
      ? (dt * (c + uMax)) / (this.cfl * this.dx)
      : Math.max((dt * c) / (this.cfl * this.dx), (dt * uMax) / (0.9 * this.dx))
    const n = Math.min(16, Math.max(1, Math.ceil(need)))
    this.lastSplit = n
    const sub = dt / n
    for (let k = 0; k < n; k++) this.substep(sub)
  }

  private substep(dt: number): void {
    this.momentum(dt)
    this.continuity(dt)
    if (this.maxSlope > 0) this.breakSteep()
  }

  /**
   * Wave breaking, cheaply: wherever the free surface between two cells is steeper than maxSlope, move a
   * fraction of the excess from the high cell to the low one (mass- and tracer-conservative). Real bores
   * break into a turbulent roller; without this, a first-order scheme rings at the jump and the rendered
   * normals turn the ringing into zebra stripes.
   */
  private breakSteep(): void {
    const { nx, ny, dx, h, s } = this
    const lim = this.maxSlope * dx
    const k = 0.2
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        if (i < nx - 1) this.relax(h, s, c, c + 1, lim, k)
        if (j < ny - 1) this.relax(h, s, c, c + nx, lim, k)
      }
    }
  }

  private relax(h: Float32Array, s: Float32Array, a: number, b: number, lim: number, k: number): void {
    const d = h[a] - h[b]
    if (d > lim) {
      const m = k * (d - lim)
      const hb = h[b] + m
      s[b] = (h[b] * s[b] + m * s[a]) / hb
      h[b] = hb
      h[a] -= m
    } else if (-d > lim) {
      const m = k * (-d - lim)
      const ha = h[a] + m
      s[a] = (h[a] * s[a] + m * s[b]) / ha
      h[a] = ha
      h[b] -= m
    }
  }

  /**
   * Momentum, one fused pass per face: semi-Lagrangian advection (skipped near fronts), eddy viscosity,
   * then gravity + pressure gradient + drag, written to the back buffer and swapped.
   */
  private momentum(dt: number): void {
    const { nx, ny, dx, h, u, v, u2, v2, dryEps: eps } = this
    const hAdv = this.advectMinDepth
    const adv = this.advect
    let kv = (this.eddyViscosity * dt) / (dx * dx)
    if (kv > 0.2) kv = 0.2
    const nxu = nx + 1
    const kdt = dt / dx
    const gzdx = (this.gz * dt) / dx
    const gxdt = this.gx * dt
    const gydt = this.gy * dt
    const lin = this.linearDamping
    const nu3 = 3 * this.viscosity
    const vmax = (0.9 * dx) / dt
    const hFilm = 2e-4
    // ---- u faces (x-velocity between cells i-1 and i)
    for (let j = 0; j < ny; j++) {
      const row = j * nxu
      u2[row] = 0
      u2[row + nx] = 0
      for (let i = 1; i < nx; i++) {
        const k = row + i
        const c = j * nx + i
        const hl = h[c - 1]
        const hr = h[c]
        if (hl <= eps && hr <= eps) { u2[k] = 0; continue }
        const uk = u[k]
        let w = uk
        // near a wet/dry front the backtrace would drag pool velocities across the shoreline (and film
        // velocities into the pool), so advect only where both cells and the departure cell are deep
        if (adv && hl >= hAdv && hr >= hAdv) {
          const vb = j * nx + i
          const vv = 0.25 * (v[vb - 1] + v[vb] + v[vb + nx - 1] + v[vb + nx])
          let x = i - uk * kdt
          let y = j - vv * kdt
          x = x < 0 ? 0 : x > nx ? nx : x
          y = y < 0 ? 0 : y > ny - 1 ? ny - 1 : y
          if (h[((y + 0.5) | 0) * nx + (x >= nx ? nx - 1 : x | 0)] >= hAdv) {
            let x0 = x | 0
            let y0 = y | 0
            if (x0 > nx - 1) x0 = nx - 1
            if (y0 > ny - 2) y0 = ny - 2
            const fx = x - x0
            const fy = y - y0
            const b = y0 * nxu + x0
            const a0 = u[b] + (u[b + 1] - u[b]) * fx
            const a1 = u[b + nxu] + (u[b + nxu + 1] - u[b + nxu]) * fx
            w = a0 + (a1 - a0) * fy
          }
        }
        w += kv * ((i > 1 ? u[k - 1] : 0) + (i < nx - 1 ? u[k + 1] : 0) + (j > 0 ? u[k - nxu] : uk) + (j < ny - 1 ? u[k + nxu] : uk) - 4 * uk)
        let un = w + gxdt - gzdx * (hr - hl)
        if ((un > 0 ? hl : hr) <= eps) { u2[k] = 0; continue }
        let hm = 0.5 * (hl + hr)
        if (hm < hFilm) hm = hFilm
        un /= 1 + dt * (lin + nu3 / (hm * hm))
        u2[k] = un > vmax ? vmax : un < -vmax ? -vmax : un
      }
    }
    // ---- v faces (y-velocity between cells j-1 and j)
    for (let i = 0; i < nx; i++) { v2[i] = 0; v2[ny * nx + i] = 0 }
    for (let j = 1; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        const hb = h[k - nx]
        const ht = h[k]
        if (hb <= eps && ht <= eps) { v2[k] = 0; continue }
        const vk = v[k]
        let w = vk
        if (adv && hb >= hAdv && ht >= hAdv) {
          const ub = (j - 1) * nxu + i
          const uu = 0.25 * (u[ub] + u[ub + 1] + u[ub + nxu] + u[ub + nxu + 1])
          let x = i - uu * kdt
          let y = j - vk * kdt
          x = x < 0 ? 0 : x > nx - 1 ? nx - 1 : x
          y = y < 0 ? 0 : y > ny ? ny : y
          if (h[(y >= ny ? ny - 1 : y | 0) * nx + ((x + 0.5) | 0)] >= hAdv) {
            let x0 = x | 0
            let y0 = y | 0
            if (x0 > nx - 2) x0 = nx - 2
            if (y0 > ny - 1) y0 = ny - 1
            const fx = x - x0
            const fy = y - y0
            const b = y0 * nx + x0
            const a0 = v[b] + (v[b + 1] - v[b]) * fx
            const a1 = v[b + nx] + (v[b + nx + 1] - v[b + nx]) * fx
            w = a0 + (a1 - a0) * fy
          }
        }
        w += kv * ((i > 0 ? v[k - 1] : vk) + (i < nx - 1 ? v[k + 1] : vk) + (j > 1 ? v[k - nx] : 0) + (j < ny - 1 ? v[k + nx] : 0) - 4 * vk)
        let vn = w + gydt - gzdx * (ht - hb)
        if ((vn > 0 ? hb : ht) <= eps) { v2[k] = 0; continue }
        let hm = 0.5 * (hb + ht)
        if (hm < hFilm) hm = hFilm
        vn /= 1 + dt * (lin + nu3 / (hm * hm))
        v2[k] = vn > vmax ? vmax : vn < -vmax ? -vmax : vn
      }
    }
    this.u = u2
    this.u2 = u
    this.v = v2
    this.v2 = v
  }

  private continuity(dt: number): void {
    const { nx, ny, dx, h, u, v, s, fu, fv, sc, s2, wq } = this
    const nxu = nx + 1
    const kdx = dt / dx
    // 1) upwind mass fluxes (m^2/s)
    for (let j = 0; j < ny; j++) {
      const row = j * nxu
      fu[row] = 0
      fu[row + nx] = 0
      for (let i = 1; i < nx; i++) {
        const k = row + i
        const uu = u[k]
        fu[k] = uu * (uu > 0 ? h[j * nx + i - 1] : h[j * nx + i])
      }
    }
    for (let i = 0; i < nx; i++) { fv[i] = 0; fv[ny * nx + i] = 0 }
    for (let j = 1; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        const vv = v[k]
        fv[k] = vv * (vv > 0 ? h[k - nx] : h[k])
      }
    // 2) weir outflow at boundary cells (m^2/s per cell, summed over its boundary edges)
    const C = this.weirCoeff * Math.sqrt(Math.max(this.gz, 0))
    const { lipL, lipR, lipB, lipT, outL, outR, outB, outT } = this
    for (let j = 0; j < ny; j++) {
      const a = h[j * nx] - lipL[j]
      const b = h[j * nx + nx - 1] - lipR[j]
      outL[j] = a > 0 ? C * a * Math.sqrt(a) : 0
      outR[j] = b > 0 ? C * b * Math.sqrt(b) : 0
    }
    for (let i = 0; i < nx; i++) {
      const a = h[i] - lipB[i]
      const b = h[(ny - 1) * nx + i] - lipT[i]
      outB[i] = a > 0 ? C * a * Math.sqrt(a) : 0
      outT[i] = b > 0 ? C * b * Math.sqrt(b) : 0
    }
    // gather per boundary cell
    for (let j = 0; j < ny; j++) { wq[j * nx] = this.outL[j]; wq[j * nx + nx - 1] = this.outR[j] }
    for (let i = 0; i < nx; i++) { wq[i] += this.outB[i]; wq[(ny - 1) * nx + i] += this.outT[i] }
    // (wq is only ever nonzero on the boundary ring, and the ring is zeroed again after use below.)
    // 3) outflow limiter: scale every outgoing flux of a cell so it cannot drain below zero.
    //    Only cells at drying fronts ever get limited, so record them and fix just their faces.
    const lim = this.lim
    let nLim = 0
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const k = j * nxu + i
        const fr = fu[k + 1]
        const fl = fu[k]
        const ft = fv[c + nx]
        const fb = fv[c]
        const out = (fr > 0 ? fr : 0) - (fl < 0 ? fl : 0) + (ft > 0 ? ft : 0) - (fb < 0 ? fb : 0) + wq[c]
        const outDepth = out * kdx
        if (outDepth > h[c]) {
          sc[c] = outDepth > 0 ? h[c] / outDepth : 0
          lim[nLim++] = c
        } else sc[c] = 1
      }
    }
    for (let q = 0; q < nLim; q++) {
      const c = lim[q]
      const j = (c / nx) | 0
      const i = c - j * nx
      const k = j * nxu + i
      const g = sc[c]
      // each face is outgoing for exactly one cell (its upwind cell), so it is scaled at most once
      if (fu[k + 1] > 0) { fu[k + 1] *= g; u[k + 1] *= g }
      if (fu[k] < 0) { fu[k] *= g; u[k] *= g }
      if (fv[c + nx] > 0) { fv[c + nx] *= g; v[c + nx] *= g }
      if (fv[c] < 0) { fv[c] *= g; v[c] *= g }
    }
    // 4) apply: depth and tracer mass
    let rimOut = 0
    let spoutOut = 0
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const k = j * nxu + i
        const fl = fu[k]
        const fr = fu[k + 1]
        const fb = fv[c]
        const ft = fv[c + nx]
        const sci = s[c]
        // tracer flux = mass flux * upwind concentration
        // (boundary faces carry zero flux, so the neighbour index is only read when it exists)
        const tl = fl > 0 ? fl * s[c - 1] : fl * sci
        const tr = fr < 0 ? fr * s[c + 1] : fr * sci
        const tb = fb > 0 ? fb * s[c - nx] : fb * sci
        const tt = ft < 0 ? ft * s[c + nx] : ft * sci
        const w = wq[c] * sc[c]
        const h0 = h[c]
        const hn = h0 + kdx * (fl - fr + fb - ft - w)
        const m = h0 * sci + kdx * (tl - tr + tb - tt - w * sci)
        h[c] = hn > 0 ? hn : 0
        let sn = hn > 1e-7 ? m / hn : sci
        sn = sn < 0 ? 0 : sn > 1 ? 1 : sn
        s2[c] = sn
        if (w > 0) {
          // split this cell's weir loss between rim and spout edges by their share
          const share = this.spoutShare(i, j)
          const vol = w * dt * dx
          spoutOut += vol * share
          rimOut += vol * (1 - share)
        }
      }
    }
    this.outRim += rimOut
    this.outSpout += spoutOut
    // scale edge outflow readouts by the limiter so visuals match what actually left
    for (let j = 0; j < ny; j++) {
      this.outL[j] *= sc[j * nx] * dx
      this.outR[j] *= sc[j * nx + nx - 1] * dx
      wq[j * nx] = 0
      wq[j * nx + nx - 1] = 0
    }
    for (let i = 0; i < nx; i++) {
      this.outB[i] *= sc[i] * dx
      this.outT[i] *= sc[(ny - 1) * nx + i] * dx
      wq[i] = 0
      wq[(ny - 1) * nx + i] = 0
    }
    this.s = s2
    this.s2 = s
  }

  /** Fraction of a boundary cell's weir outflow that goes over spout edges. */
  private spoutShare(i: number, j: number): number {
    const { nx, ny } = this
    let tot = 0
    let sp = 0
    if (i === 0) { tot += this.outL[j]; if (this.kindL[j] === EDGE_SPOUT) sp += this.outL[j] }
    if (i === nx - 1) { tot += this.outR[j]; if (this.kindR[j] === EDGE_SPOUT) sp += this.outR[j] }
    if (j === 0) { tot += this.outB[i]; if (this.kindB[i] === EDGE_SPOUT) sp += this.outB[i] }
    if (j === ny - 1) { tot += this.outT[i]; if (this.kindT[i] === EDGE_SPOUT) sp += this.outT[i] }
    return tot > 0 ? sp / tot : 0
  }

  /**
   * Refresh cell-centred velocity, speed and the low-passed agitation field.
   * Call once per chemistry/render tick, not per substep. `dt` is the time since the last call.
   */
  computeDerived(dt: number): void {
    const { nx, ny, u, v, h, uc, vc, speed, agitation, dryEps: eps } = this
    const nxu = nx + 1
    const release = Math.exp(-dt / 0.6)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        if (h[c] <= eps) { uc[c] = 0; vc[c] = 0; speed[c] = 0; agitation[c] *= release; continue }
        const a = 0.5 * (u[j * nxu + i] + u[j * nxu + i + 1])
        const b = 0.5 * (v[c] + v[c + nx])
        uc[c] = a
        vc[c] = b
        const sp = Math.sqrt(a * a + b * b)
        speed[c] = sp
        const g = agitation[c] * release
        agitation[c] = sp > g ? sp : g
      }
    }
  }

  /**
   * Turbulent mixing of the tracer: explicit diffusion with coefficient D0 + D1*|u|*dx (m^2/s).
   * Cheap, call at the chemistry rate.
   */
  diffuseTracer(dt: number, d0 = 2e-6, d1 = 0.25): void {
    const { nx, ny, dx, h, s, s2, speed, dryEps: eps } = this
    const inv = dt / (dx * dx)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const sc0 = s[c]
        if (h[c] <= eps) { s2[c] = sc0; continue }
        let k = (d0 + d1 * speed[c] * dx) * inv
        if (k > 0.2) k = 0.2
        let lap = 0
        let nn = 0
        if (i > 0 && h[c - 1] > eps) { lap += s[c - 1]; nn++ }
        if (i < nx - 1 && h[c + 1] > eps) { lap += s[c + 1]; nn++ }
        if (j > 0 && h[c - nx] > eps) { lap += s[c - nx]; nn++ }
        if (j < ny - 1 && h[c + nx] > eps) { lap += s[c + nx]; nn++ }
        s2[c] = sc0 + k * (lap - nn * sc0)
      }
    }
    this.s = s2
    this.s2 = s
  }

  /** Kinetic energy (J per kg/m^3, i.e. m^5/s^2 * density omitted): sum of 0.5*h*|u|^2*dx^2. Use for audio. */
  kineticEnergy(): number {
    const { h, speed } = this
    let e = 0
    for (let c = 0; c < h.length; c++) e += h[c] * speed[c] * speed[c]
    return 0.5 * e * this.dx * this.dx
  }
}

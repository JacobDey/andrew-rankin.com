/**
 * A sheet of exposed paper lying on the tray floor, with per-texel development driven by the liquid.
 *
 * Per texel:
 *   S    latent "sensitivity" 0..1 (the H&D-shaped exposure response; 1 = will go full black)
 *   cov  coverage 0..1: is liquid deep enough here right now (and no bubble)?
 *   wet  how wet the emulsion is (rises fast under liquid, dries over ~minutes)
 *   c    developer concentration AT the emulsion (boundary layer), 0..1
 *   n    development nuclei (autocatalysis -> induction period, shadows first)
 *   p    development progress 0..1
 *   D    visible density = p * S   (0..1, multiply by Dmax for optical density)
 *
 *   dc/dt = (m0*mottle(x,y) + m1*sqrt(agitation)) * cov * (c_bulk - c)  -  kc * S * dp/dt   (boundary layer)
 *   dn/dt = k1 * c * act * S
 *   dp/dt = k2 * c * act * (n + n0) * (1 - p)                                   (autocatalytic)
 *   act   = max(cov, film * wet)          (a wet but uncovered sheet keeps developing off its own film)
 *
 * Development by-products are deposited back into the liquid tracer (bulk freshness) so exhausted
 * developer flows downstream of dense areas: bromide drag, emergent.
 *
 * Air bubbles sit on the sheet, block contact, drift with the flow and pop under agitation.
 *
 * Pure TypeScript, no DOM. Sampling assumes an axis-aligned sheet (translation only).
 */
import type { ShallowWater } from './shallowWater'
import type { Rng } from './rng'

export interface PaperOptions {
  /** Placement (m, tray frame) of the sheet's lower-left corner and its size. */
  x: number
  y: number
  w: number
  h: number
  resX: number
  resY: number
}

export interface Kinetics {
  k1: number
  k2: number
  n0: number
  /** Consumption of boundary-layer developer per unit density. */
  kc: number
  /**
   * Still-bath exchange (1/s) and agitation exchange m1*sqrt(|u|) (1/s per sqrt(m/s)). The square root is
   * laminar boundary-layer mass transfer: any decent flow nearly saturates the exchange, so a rocked tray
   * develops evenly and only still or starved regions lag.
   */
  m0: number
  m1: number
  /** Spatial variation of the still-bath exchange (convection cells): 0 = uniform, 0.5 = +-50%. */
  mottle: number
  /** Fraction of full rate a wet, uncovered sheet keeps developing at (film). */
  film: number
  /** Bulk exhaustion: metres of liquid column fully exhausted per unit density developed. */
  spentYield: number
  /** Coverage ramp (m): below h0 no contact, above h1 full contact. */
  h0: number
  h1: number
  /** Drying time constant (s). */
  dryTau: number
  /** Global speed multiplier. */
  timeScale: number
  /** Bubbles: trapped per m^2 of dry paper swept by a fast front; pop rates. */
  bubbleTrap: number
  bubblePopBase: number
  bubblePopAgit: number
  maxBubbles: number
}

export const DEFAULT_KINETICS: Kinetics = {
  k1: 0.02,
  k2: 0.45,
  n0: 0.02,
  kc: 3,
  m0: 0.12,
  m1: 9,
  mottle: 0.45,
  film: 0.3,
  spentYield: 2e-3,
  h0: 0.0006,
  h1: 0.0014,
  dryTau: 90,
  timeScale: 1,
  bubbleTrap: 160,
  bubblePopBase: 0.02,
  bubblePopAgit: 4,
  maxBubbles: 48,
}

export interface Bubble {
  /** Tray-frame position (m) and radius (m). */
  x: number
  y: number
  r: number
  age: number
}

export class PaperChem {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly resX: number
  readonly resY: number
  readonly kin: Kinetics

  readonly S: Float32Array
  readonly cov: Float32Array
  readonly wet: Float32Array
  readonly c: Float32Array
  readonly n: Float32Array
  readonly p: Float32Array
  /** Visible density 0..1 (p*S). This is the developmentMap. */
  readonly D: Float32Array
  /** Packed RGBA8 for GPU upload: R density, G wetness, B coverage, A boundary-layer developer. */
  readonly rgba: Uint8Array
  /** Bubble mask 0..255 (255 = fully blocked). */
  readonly mask: Uint8Array
  bubbles: Bubble[] = []
  /** Seconds this sheet has spent with any liquid on it. */
  devTime = 0
  /** True whenever rgba changed since the consumer last cleared it. */
  dirty = true

  // separable bilinear sampling tables into the fluid grid
  private ix0: Int32Array
  private fxw: Float32Array
  private jy0: Int32Array
  private fyw: Float32Array
  private cellX: Int32Array
  private cellY: Int32Array
  private deposit: Float32Array
  /** Per-texel multiplier on the still-bath exchange: convection cells -> mottling when you don't rock. */
  readonly still: Float32Array
  private fluidNx = 0
  private fluidNy = 0

  constructor(o: PaperOptions, kin: Partial<Kinetics> = {}) {
    this.x = o.x
    this.y = o.y
    this.w = o.w
    this.h = o.h
    this.resX = o.resX
    this.resY = o.resY
    this.kin = { ...DEFAULT_KINETICS, ...kin }
    const n = o.resX * o.resY
    this.S = new Float32Array(n)
    this.cov = new Float32Array(n)
    this.wet = new Float32Array(n)
    this.c = new Float32Array(n)
    this.n = new Float32Array(n)
    this.p = new Float32Array(n)
    this.D = new Float32Array(n)
    this.rgba = new Uint8Array(n * 4)
    this.mask = new Uint8Array(n)
    this.ix0 = new Int32Array(o.resX)
    this.fxw = new Float32Array(o.resX)
    this.jy0 = new Int32Array(o.resY)
    this.fyw = new Float32Array(o.resY)
    this.cellX = new Int32Array(o.resX)
    this.cellY = new Int32Array(o.resY)
    this.deposit = new Float32Array(0)
    this.still = new Float32Array(n)
    this.buildMottle(1234)
  }

  /** Smooth value-noise field (two octaves, cells ~2 cm and ~7 mm) around 1 +- kin.mottle. */
  buildMottle(seed: number): void {
    const { resX, resY } = this
    const amp = this.kin.mottle
    const lattice = (cells: number, salt: number) => {
      const gx = Math.ceil(this.w / cells) + 2
      const gy = Math.ceil(this.h / cells) + 2
      const g = new Float32Array(gx * gy)
      let st = (seed * 2654435761 + salt) >>> 0
      for (let k = 0; k < g.length; k++) {
        st = (Math.imul(st ^ (st >>> 15), 2246822519) + 0x9e3779b9) >>> 0
        g[k] = (st / 4294967296) * 2 - 1
      }
      return { g, gx, cells }
    }
    const octs = [lattice(0.02, 17), lattice(0.007, 91)]
    for (let tj = 0; tj < resY; tj++) {
      const y = ((tj + 0.5) / resY) * this.h
      for (let ti = 0; ti < resX; ti++) {
        const x = ((ti + 0.5) / resX) * this.w
        let v = 0
        let wsum = 0
        let wt = 1
        for (const o of octs) {
          const fx = x / o.cells
          const fy = y / o.cells
          const i0 = Math.floor(fx)
          const j0 = Math.floor(fy)
          let ax = fx - i0
          let ay = fy - j0
          ax = ax * ax * (3 - 2 * ax)
          ay = ay * ay * (3 - 2 * ay)
          const a = o.g[j0 * o.gx + i0]
          const b = o.g[j0 * o.gx + i0 + 1]
          const c = o.g[(j0 + 1) * o.gx + i0]
          const d = o.g[(j0 + 1) * o.gx + i0 + 1]
          v += wt * (a + (b - a) * ax + (c + (d - c) * ax - (a + (b - a) * ax)) * ay)
          wsum += wt
          wt *= 0.5
        }
        this.still[tj * resX + ti] = Math.max(0.05, 1 + amp * (v / wsum))
      }
    }
  }

  /** Set the latent image: S in 0..1, length resX*resY, row 0 = front edge (tray y = this.y). */
  setLatent(S: Float32Array): void {
    this.S.set(S.subarray(0, this.S.length))
  }

  /** Back to a dry, undeveloped sheet (latent kept). */
  reset(): void {
    this.cov.fill(0)
    this.wet.fill(0)
    this.c.fill(0)
    this.n.fill(0)
    this.p.fill(0)
    this.D.fill(0)
    this.mask.fill(0)
    this.bubbles = []
    this.devTime = 0
    this.pack()
  }

  private buildTables(f: ShallowWater): void {
    const { nx, ny, dx } = f
    this.fluidNx = nx
    this.fluidNy = ny
    for (let t = 0; t < this.resX; t++) {
      const x = this.x + ((t + 0.5) / this.resX) * this.w
      let g = x / dx - 0.5
      g = g < 0 ? 0 : g > nx - 1 ? nx - 1 : g
      let i0 = Math.floor(g)
      if (i0 > nx - 2) i0 = nx - 2
      this.ix0[t] = i0
      this.fxw[t] = g - i0
      this.cellX[t] = Math.min(nx - 1, Math.max(0, Math.floor(x / dx)))
    }
    for (let t = 0; t < this.resY; t++) {
      const y = this.y + ((t + 0.5) / this.resY) * this.h
      let g = y / dx - 0.5
      g = g < 0 ? 0 : g > ny - 1 ? ny - 1 : g
      let j0 = Math.floor(g)
      if (j0 > ny - 2) j0 = ny - 2
      this.jy0[t] = j0
      this.fyw[t] = g - j0
      this.cellY[t] = Math.min(ny - 1, Math.max(0, Math.floor(y / dx)))
    }
    this.deposit = new Float32Array(nx * ny)
  }

  /** Is (x, y) in tray coords on the sheet? */
  contains(x: number, y: number): boolean {
    return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h
  }

  /** Trap a bubble at (x, y) (tray coords). */
  addBubble(x: number, y: number, r: number): void {
    if (this.bubbles.length >= this.kin.maxBubbles || !this.contains(x, y)) return
    this.bubbles.push({ x, y, r, age: 0 })
  }

  /**
   * Advance the chemistry by dt using the liquid's current state. Call at 15-30 Hz; call
   * fluid.computeDerived() first so agitation is fresh.
   */
  step(dt: number, fluid: ShallowWater, rng: Rng): void {
    if (fluid.nx !== this.fluidNx || fluid.ny !== this.fluidNy) this.buildTables(fluid)
    const K = this.kin
    const ts = K.timeScale
    const dts = dt * ts
    this.updateBubbles(dt, fluid, rng)
    this.rasterBubbles()

    const { resX, resY, S, cov, wet, c, n, p, D, mask, ix0, fxw, jy0, fyw, cellX, cellY, deposit, still } = this
    const nx = fluid.nx
    const H = fluid.h
    const AG = fluid.agitation
    const SB = fluid.s
    const inv = 1 / (K.h1 - K.h0)
    const wetIn = Math.min(1, 6 * dt)
    const dry = dt / K.dryTau
    const m0 = K.m0
    const m1 = K.m1
    const k1 = K.k1
    const k2 = K.k2
    const n0 = K.n0
    const kc = K.kc
    const film = K.film
    // bubble trapping: probability per texel that flips dry->covered under a fast front
    const texelArea = (this.w / resX) * (this.h / resY)
    const trapP = K.bubbleTrap * texelArea
    let anyContact = false
    let trapX = -1
    let trapY = -1
    let trapN = 0
    for (let tj = 0; tj < resY; tj++) {
      const j0 = jy0[tj]
      const fy = fyw[tj]
      const gy = 1 - fy
      const rowC = cellY[tj] * nx
      for (let ti = 0; ti < resX; ti++) {
        const t = tj * resX + ti
        const i0 = ix0[ti]
        const fx = fxw[ti]
        const gx = 1 - fx
        const a = j0 * nx + i0
        const b = a + nx
        const w00 = gx * gy
        const w10 = fx * gy
        const w01 = gx * fy
        const w11 = fx * fy
        const hh = H[a] * w00 + H[a + 1] * w10 + H[b] * w01 + H[b + 1] * w11
        let cv = (hh - K.h0) * inv
        cv = cv <= 0 ? 0 : cv >= 1 ? 1 : cv * cv * (3 - 2 * cv)
        const mk = mask[t]
        if (mk) cv *= 1 - mk * (1 / 255)
        const prev = cov[t]
        cov[t] = cv
        let ww = wet[t]
        if (cv > 0) ww += (1 - ww) * wetIn * cv
        else ww -= ww * dry
        wet[t] = ww
        const act = cv > film * ww ? cv : film * ww
        if (act <= 0) { continue }
        anyContact = true
        const ag = AG[a] * w00 + AG[a + 1] * w10 + AG[b] * w01 + AG[b + 1] * w11
        let cc = c[t]
        if (cv > 0) {
          const cb = SB[a] * w00 + SB[a + 1] * w10 + SB[b] * w01 + SB[b + 1] * w11
          let ex = (m0 * still[t] + m1 * Math.sqrt(ag)) * cv * dts
          if (ex > 1) ex = 1
          cc += ex * (cb - cc)
          // a fast front sweeping dry paper can trap air
          if (prev < 0.5 && cv >= 0.5 && ag > 0.1 && rng.next() < trapP * (ag / 0.2)) {
            trapN++
            trapX = ti
            trapY = tj
          }
        }
        const s = S[t]
        const rate = cc * act * dts
        const nn = n[t] + k1 * rate * s
        n[t] = nn
        const pp = p[t]
        const dp = k2 * rate * (nn + n0) * (1 - pp)
        let pn = pp + dp
        if (pn > 1) pn = 1
        p[t] = pn
        cc -= kc * s * dp
        c[t] = cc > 0 ? cc : 0
        D[t] = pn * s
        if (cv > 0) deposit[rowC + cellX[ti]] += s * dp * cv
      }
    }
    if (anyContact) this.devTime += dt
    if (trapN > 0 && trapX >= 0) {
      const x = this.x + ((trapX + 0.5) / resX) * this.w
      const y = this.y + ((trapY + 0.5) / resY) * this.h
      this.addBubble(x, y, rng.range(0.0012, 0.0035))
    }
    // by-products into the bulk liquid (exhausts the tracer where development happens)
    const cellArea = fluid.dx * fluid.dx
    const kb = (K.spentYield * texelArea) / cellArea
    const Hs = fluid.h
    const Ss = fluid.s
    for (let k = 0; k < deposit.length; k++) {
      const d = deposit[k]
      if (d === 0) continue
      deposit[k] = 0
      const hh = Hs[k] > 1e-4 ? Hs[k] : 1e-4
      const sn = Ss[k] - (kb * d) / hh
      Ss[k] = sn > 0 ? sn : 0
    }
    this.pack()
  }

  private updateBubbles(dt: number, f: ShallowWater, rng: Rng): void {
    const K = this.kin
    const keep: Bubble[] = []
    for (const b of this.bubbles) {
      b.age += dt
      const hh = f.sampleH(b.x, b.y)
      if (hh < b.r * 0.6) continue // uncovered: the bubble is gone
      const ag = f.sampleCell(f.agitation, b.x, b.y)
      const pop = K.bubblePopBase + K.bubblePopAgit * Math.max(0, ag - 0.04)
      if (rng.next() < pop * dt) continue
      const ux = f.sampleCell(f.uc, b.x, b.y)
      const uy = f.sampleCell(f.vc, b.x, b.y)
      const sp = Math.hypot(ux, uy)
      if (sp > 0.05) {
        // stick-slip drift along the flow
        b.x += ux * 0.3 * dt
        b.y += uy * 0.3 * dt
      }
      if (!this.contains(b.x, b.y)) continue
      keep.push(b)
    }
    this.bubbles = keep
  }

  private rasterBubbles(): void {
    const { mask, resX, resY } = this
    mask.fill(0)
    const sx = resX / this.w
    const sy = resY / this.h
    for (const b of this.bubbles) {
      const cx = (b.x - this.x) * sx - 0.5
      const cy = (b.y - this.y) * sy - 0.5
      const rx = b.r * sx
      const ry = b.r * sy
      const i0 = Math.max(0, Math.floor(cx - rx))
      const i1 = Math.min(resX - 1, Math.ceil(cx + rx))
      const j0 = Math.max(0, Math.floor(cy - ry))
      const j1 = Math.min(resY - 1, Math.ceil(cy + ry))
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const ddx = (i - cx) / rx
          const ddy = (j - cy) / ry
          const d = Math.sqrt(ddx * ddx + ddy * ddy)
          if (d >= 1) continue
          const m = d < 0.75 ? 255 : Math.round(255 * (1 - (d - 0.75) / 0.25))
          const t = j * resX + i
          if (m > mask[t]) mask[t] = m
        }
    }
  }

  /** Repack rgba from the fields (call after editing fields by hand). */
  pack(): void {
    const { rgba, D, wet, cov, c } = this
    for (let t = 0, q = 0; t < D.length; t++, q += 4) {
      rgba[q] = D[t] * 255
      rgba[q + 1] = wet[t] * 255
      rgba[q + 2] = cov[t] * 255
      rgba[q + 3] = (c[t] > 1 ? 1 : c[t]) * 255
    }
    this.dirty = true
  }

  /** Mean coverage, mean density and evenness over the sheet. */
  summary(): { coverage: number; density: number; wet: number; developer: number } {
    let cv = 0
    let d = 0
    let w = 0
    let cc = 0
    const n = this.D.length
    for (let t = 0; t < n; t++) {
      cv += this.cov[t]
      d += this.D[t]
      w += this.wet[t]
      cc += this.c[t]
    }
    return { coverage: cv / n, density: d / n, wet: w / n, developer: cc / n }
  }
}

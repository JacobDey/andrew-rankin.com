// Tray liquid: virtual-pipes shallow water (darkroom.md §5.2), TrayBody spring
// (§5.3) and ScalarField (dye, peroxide). Implements the @shared/fluid facade
// (architecture §4.6) locally, because the shared module had not landed when
// Darkroom was built. Same names and signatures, so the import can be swapped.

const G = 9.81
const RHO = 1000

export interface TrayFluidOptions {
  nx: number; ny: number; dx: number; depth: number; lip: number
  damping?: number; advect?: boolean; substepDt?: number; maxSubsteps?: number
  floor?: ((x: number, y: number) => number) | null
}
export interface FluidStepReport { spill: number; wallImpact: number; kinetic: number; substeps: number; slaps: { x: number; y: number; e: number }[] }
export interface FluidSnapshot { v: 1; nx: number; ny: number; h: Float32Array; ux: Float32Array; uy: Float32Array; tilt: [number, number] }

export class TrayFluid {
  readonly nx: number; readonly ny: number; readonly dx: number; readonly width: number; readonly height: number
  readonly h: Float32Array; readonly ux: Float32Array; readonly uy: Float32Array
  sleeping = false
  private fR: Float32Array; private fL: Float32Array; private fU: Float32Array; private fD: Float32Array
  private cx: Float32Array; private cy: Float32Array
  private floorH: Float32Array
  private tanX = 0; private tanY = 0; private ax = 0; private ay = 0
  private lip: number; private damping: number; private sdt: number; private maxSub: number; private rest: number
  private acc = 0
  private still = 0
  private lastKE = 0

  constructor(o: TrayFluidOptions) {
    this.nx = o.nx; this.ny = o.ny; this.dx = o.dx
    this.width = o.nx * o.dx; this.height = o.ny * o.dx
    const n = o.nx * o.ny
    this.h = new Float32Array(n).fill(o.depth)
    this.ux = new Float32Array(n); this.uy = new Float32Array(n)
    this.fR = new Float32Array(n); this.fL = new Float32Array(n); this.fU = new Float32Array(n); this.fD = new Float32Array(n)
    this.cx = new Float32Array(o.nx); this.cy = new Float32Array(o.ny)
    for (let i = 0; i < o.nx; i++) this.cx[i] = (i + 0.5) * o.dx - this.width / 2
    for (let j = 0; j < o.ny; j++) this.cy[j] = (j + 0.5) * o.dx - this.height / 2
    this.floorH = new Float32Array(n)
    this.lip = o.lip; this.damping = o.damping ?? 0.8; this.sdt = o.substepDt ?? 1 / 240; this.maxSub = o.maxSubsteps ?? 8
    this.rest = o.depth
    this.setFloor(o.floor ?? null)
  }

  setTilt(tanX: number, tanY: number): void {
    if (Math.abs(tanX - this.tanX) > 1e-6 || Math.abs(tanY - this.tanY) > 1e-6) this.wake()
    this.tanX = tanX; this.tanY = tanY
  }
  get tilt(): [number, number] { return [this.tanX, this.tanY] }
  setAccel(ax: number, ay: number): void {
    if (Math.abs(ax) + Math.abs(ay) > 1e-3) this.wake()
    this.ax = ax; this.ay = ay
  }
  setFloor(fn: ((x: number, y: number) => number) | null): void {
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) this.floorH[j * this.nx + i] = fn ? fn(this.cx[i], this.cy[j]) : 0
    this.wake()
  }
  wake(): void { this.sleeping = false; this.still = 0 }

  step(dt: number): FluidStepReport {
    const rep: FluidStepReport = { spill: 0, wallImpact: 0, kinetic: this.lastKE, substeps: 0, slaps: [] }
    if (this.sleeping) return rep
    this.acc += dt
    let n = 0
    while (this.acc >= this.sdt && n < this.maxSub) {
      rep.spill += this.substep(this.sdt)
      this.acc -= this.sdt
      n++
    }
    if (n >= this.maxSub) this.acc = 0 // overrun: slow down, never spiral
    rep.substeps = n
    // diagnostics
    const nx = this.nx, ny = this.ny, h = this.h, ux = this.ux, uy = this.uy, dx2 = this.dx * this.dx
    let ke = 0
    for (let i = 0; i < h.length; i++) ke += 0.5 * RHO * h[i] * (ux[i] * ux[i] + uy[i] * uy[i]) * dx2
    let wi = 0
    let best = 0, bx = 0, by = 0
    for (let j = 0; j < ny; j++) {
      const a = j * nx, b = j * nx + nx - 1
      const ea = ux[a] < 0 ? RHO * h[a] * ux[a] * ux[a] * this.dx : 0
      const eb = ux[b] > 0 ? RHO * h[b] * ux[b] * ux[b] * this.dx : 0
      wi += ea + eb
      if (ea > best) { best = ea; bx = this.cx[0]; by = this.cy[j] }
      if (eb > best) { best = eb; bx = this.cx[nx - 1]; by = this.cy[j] }
    }
    for (let i = 0; i < nx; i++) {
      const a = i, b = (ny - 1) * nx + i
      const ea = uy[a] < 0 ? RHO * h[a] * uy[a] * uy[a] * this.dx : 0
      const eb = uy[b] > 0 ? RHO * h[b] * uy[b] * uy[b] * this.dx : 0
      wi += ea + eb
      if (ea > best) { best = ea; bx = this.cx[i]; by = this.cy[0] }
      if (eb > best) { best = eb; bx = this.cx[i]; by = this.cy[ny - 1] }
    }
    if (best > 1e-5) rep.slaps.push({ x: bx, y: by, e: best })
    rep.kinetic = ke
    rep.wallImpact = wi
    this.lastKE = ke
    if (ke < 1e-6 && Math.abs(this.ax) + Math.abs(this.ay) < 1e-3) {
      this.still += dt
      if (this.still > 1) { this.sleeping = true; this.ux.fill(0); this.uy.fill(0); this.fR.fill(0); this.fL.fill(0); this.fU.fill(0); this.fD.fill(0) }
    } else this.still = 0
    return rep
  }

  private substep(dt: number): number {
    const nx = this.nx, ny = this.ny, dx = this.dx, h = this.h
    const fR = this.fR, fL = this.fL, fU = this.fU, fD = this.fD
    const sx = -this.tanX + this.ax / G
    const sy = -this.tanY + this.ay / G
    const cx = this.cx, cy = this.cy, fl = this.floorH
    const A = dt * G * dx
    const decay = Math.exp(-this.damping * dt)
    const dx2 = dx * dx
    // fluxes
    for (let j = 0; j < ny; j++) {
      const yj = cy[j] * sy
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const hc = h[c]
        const Hc = hc + fl[c] + cx[i] * sx + yj
        let r = 0, l = 0, u = 0, d = 0
        if (i < nx - 1) r = Math.max(0, fR[c] * decay + A * (Hc - (h[c + 1] + fl[c + 1] + cx[i + 1] * sx + yj)))
        if (i > 0) l = Math.max(0, fL[c] * decay + A * (Hc - (h[c - 1] + fl[c - 1] + cx[i - 1] * sx + yj)))
        if (j > 0) u = Math.max(0, fU[c] * decay + A * (Hc - (h[c - nx] + fl[c - nx] + cx[i] * sx + cy[j - 1] * sy)))
        if (j < ny - 1) d = Math.max(0, fD[c] * decay + A * (Hc - (h[c + nx] + fl[c + nx] + cx[i] * sx + cy[j + 1] * sy)))
        const out = (r + l + u + d) * dt
        if (out > hc * dx2 && out > 0) {
          const K = (hc * dx2) / out
          r *= K; l *= K; u *= K; d *= K
        }
        fR[c] = r; fL[c] = l; fU[c] = u; fD[c] = d
      }
    }
    // depth + velocity
    const ux = this.ux, uy = this.uy
    let spill = 0
    const k = dt / dx2
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const inR = i > 0 ? fR[c - 1] : 0 // from left neighbour moving right
        const inL = i < nx - 1 ? fL[c + 1] : 0
        const inD = j > 0 ? fD[c - nx] : 0
        const inU = j < ny - 1 ? fU[c + nx] : 0
        const h0 = h[c]
        let h1 = h0 + k * (inR + inL + inD + inU - fR[c] - fL[c] - fU[c] - fD[c])
        if (h1 < 0) h1 = 0
        // spill at the walls
        if ((i === 0 || j === 0 || i === nx - 1 || j === ny - 1) && h1 > this.lip) {
          const loss = (h1 - this.lip) * 4 * dt
          h1 -= loss
          spill += loss * dx2
        }
        h[c] = h1
        const hm = Math.max(0.5 * (h0 + h1), 1e-4)
        let vx = (0.5 * (inR - fL[c] + fR[c] - inL)) / (dx * hm)
        let vy = (0.5 * (inD - fU[c] + fD[c] - inU)) / (dx * hm)
        if (vx > 1) vx = 1; else if (vx < -1) vx = -1
        if (vy > 1) vy = 1; else if (vy < -1) vy = -1
        if (h1 < 2e-4) { vx = 0; vy = 0 }
        ux[c] = vx; uy[c] = vy
      }
    }
    return spill
  }

  private cellAt(x: number, y: number): [number, number, number, number] {
    const fx = (x + this.width / 2) / this.dx - 0.5
    const fy = (y + this.height / 2) / this.dx - 0.5
    const i0 = Math.max(0, Math.min(this.nx - 2, Math.floor(fx)))
    const j0 = Math.max(0, Math.min(this.ny - 2, Math.floor(fy)))
    const tx = Math.max(0, Math.min(1, fx - i0))
    const ty = Math.max(0, Math.min(1, fy - j0))
    return [i0, j0, tx, ty]
  }
  private bilerp(a: Float32Array, x: number, y: number): number {
    const [i, j, tx, ty] = this.cellAt(x, y)
    const c = j * this.nx + i
    const a0 = a[c] + (a[c + 1] - a[c]) * tx
    const a1 = a[c + this.nx] + (a[c + this.nx + 1] - a[c + this.nx]) * tx
    return a0 + (a1 - a0) * ty
  }

  impulse(x: number, y: number, radius: number, dh: number): void {
    const n = this.h.length
    const bump = new Float32Array(n)
    let tot = 0, hs = 0
    const r2 = 2 * radius * radius
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const c = j * this.nx + i
      const dxx = this.cx[i] - x, dyy = this.cy[j] - y
      const b = dh * Math.exp(-(dxx * dxx + dyy * dyy) / r2)
      bump[c] = b; tot += b; hs += this.h[c]
    }
    if (hs <= 0) return
    for (let c = 0; c < n; c++) this.h[c] = Math.max(0, this.h[c] + bump[c] - (tot * this.h[c]) / hs)
    this.wake()
  }
  poke(x: number, y: number, strength: number): void {
    // ring ripple: a depression in the centre and a raised ring, zero net volume
    this.impulse(x, y, 0.025, 0.0012 * strength)
    this.impulse(x, y, 0.009, -0.0016 * strength)
  }
  addVolume(x: number, y: number, radius: number, m3: number): void {
    const r2 = 2 * radius * radius
    const w = new Float32Array(this.h.length)
    let s = 0
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const dxx = this.cx[i] - x, dyy = this.cy[j] - y
      const v = Math.exp(-(dxx * dxx + dyy * dyy) / r2)
      w[j * this.nx + i] = v; s += v
    }
    const dx2 = this.dx * this.dx
    for (let c = 0; c < w.length; c++) this.h[c] += (m3 * w[c]) / s / dx2
    this.wake()
  }
  takeVolume(_x: number, _y: number, m3: number): number {
    const v = this.volume()
    const take = Math.min(v, m3)
    if (v <= 0) return 0
    const k = 1 - take / v
    for (let c = 0; c < this.h.length; c++) this.h[c] *= k
    this.wake()
    return take
  }
  depthAt(x: number, y: number): number { return this.bilerp(this.h, x, y) }
  velocityAt(x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.bilerp(this.ux, x, y); out.y = this.bilerp(this.uy, x, y); return out
  }
  speedAt(x: number, y: number): number { const vx = this.bilerp(this.ux, x, y), vy = this.bilerp(this.uy, x, y); return Math.hypot(vx, vy) }
  surfaceAt(x: number, y: number): number { return this.depthAt(x, y) - (x * this.tanX + y * this.tanY) }
  volume(): number { let s = 0; for (let c = 0; c < this.h.length; c++) s += this.h[c]; return s * this.dx * this.dx }
  kinetic(): number { return this.lastKE }
  refill(depth?: number): void {
    const d = depth ?? this.rest
    this.h.fill(d); this.ux.fill(0); this.uy.fill(0); this.fR.fill(0); this.fL.fill(0); this.fU.fill(0); this.fD.fill(0)
    this.wake()
  }
  /** Settle to the hydrostatic shape for the current tilt (no waves), keeping the volume. */
  settle(): void {
    const vol = this.volume()
    const dx2 = this.dx * this.dx
    let lo = -0.1, hi = 0.2
    const surf = (s: number) => {
      let v = 0
      for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
        const b = -(this.cx[i] * this.tanX + this.cy[j] * this.tanY) + this.floorH[j * this.nx + i]
        v += Math.max(0, s - b)
      }
      return v * dx2
    }
    for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (surf(m) > vol) hi = m; else lo = m }
    const s = (lo + hi) / 2
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const c = j * this.nx + i
      const b = -(this.cx[i] * this.tanX + this.cy[j] * this.tanY) + this.floorH[c]
      this.h[c] = Math.max(0, s - b)
    }
    this.ux.fill(0); this.uy.fill(0); this.fR.fill(0); this.fL.fill(0); this.fU.fill(0); this.fD.fill(0)
  }
  snapshot(): FluidSnapshot {
    return { v: 1, nx: this.nx, ny: this.ny, h: this.h.slice(), ux: this.ux.slice(), uy: this.uy.slice(), tilt: [this.tanX, this.tanY] }
  }
  restore(s: FluidSnapshot): void {
    if (s.nx !== this.nx || s.ny !== this.ny) return
    this.h.set(s.h); this.ux.set(s.ux); this.uy.set(s.uy)
    this.tanX = s.tilt[0]; this.tanY = s.tilt[1]
    this.fR.fill(0); this.fL.fill(0); this.fU.fill(0); this.fD.fill(0)
    this.wake()
  }
}

export interface TrayBodyOptions { k?: number; c?: number; kt?: number; ct?: number; maxTiltRad?: number; maxOffset?: number }
export class TrayBody {
  tiltX = 0; tiltY = 0; offX = 0; offY = 0
  private vX = 0; private vY = 0; private voX = 0; private voY = 0
  private tX = 0; private tY = 0; private toX = 0; private toY = 0
  private held = false
  private rock = false
  private rockT = 0
  private rockO = { ampX: (6 * Math.PI) / 180, ampY: (2.5 * Math.PI) / 180, fx: 0.48, fy: 0.64, phase: 1.1 }
  private landArmed = false
  restX = 0; restY = 0
  private k: number; private c: number; private kt: number; private ct: number; private maxT: number; private maxO: number
  constructor(o: TrayBodyOptions = {}) {
    this.k = o.k ?? 140; this.c = o.c ?? 9; this.kt = o.kt ?? 220; this.ct = o.ct ?? 18
    this.maxT = o.maxTiltRad ?? (10 * Math.PI) / 180; this.maxO = o.maxOffset ?? 0.02
  }
  get isHeld(): boolean { return this.held }
  get isRocking(): boolean { return this.rock }
  hold(tiltX: number, tiltY: number, offX = 0, offY = 0): void {
    const m = this.maxT
    this.tX = Math.max(-m, Math.min(m, tiltX)); this.tY = Math.max(-m, Math.min(m, tiltY))
    this.toX = Math.max(-this.maxO, Math.min(this.maxO, offX)); this.toY = Math.max(-this.maxO, Math.min(this.maxO, offY))
    this.held = true
    this.landArmed = false
  }
  release(): void {
    if (this.held) this.landArmed = true
    this.held = false
    this.toX = 0; this.toY = 0
  }
  autoRock(on: boolean, o?: Partial<{ ampX: number; ampY: number; fx: number; fy: number; phase: number }>): void {
    this.rock = on
    if (o) Object.assign(this.rockO, o)
    if (!on) this.landArmed = true
  }
  step(dt: number): { ax: number; ay: number; landed: number } {
    if (!this.held) {
      if (this.rock) {
        this.rockT += dt
        const r = this.rockO
        this.tX = this.restX + r.ampX * Math.sin(2 * Math.PI * r.fx * this.rockT)
        this.tY = this.restY + r.ampY * Math.sin(2 * Math.PI * r.fy * this.rockT + r.phase)
      } else { this.tX = this.restX; this.tY = this.restY }
    }
    const nSub = Math.max(1, Math.ceil(dt / (1 / 240)))
    const h = dt / nSub
    let ax = 0, ay = 0
    let landed = 0
    const prevX = this.tiltX - this.restX, prevY = this.tiltY - this.restY
    for (let s = 0; s < nSub; s++) {
      const aX = this.k * (this.tX - this.tiltX) - this.c * this.vX
      const aY = this.k * (this.tY - this.tiltY) - this.c * this.vY
      this.vX += aX * h; this.vY += aY * h
      this.tiltX += this.vX * h; this.tiltY += this.vY * h
      ax = this.kt * (this.toX - this.offX) - this.ct * this.voX
      ay = this.kt * (this.toY - this.offY) - this.ct * this.voY
      this.voX += ax * h; this.voY += ay * h
      this.offX += this.voX * h; this.offY += this.voY * h
    }
    if (this.landArmed && !this.rock) {
      const curX = this.tiltX - this.restX, curY = this.tiltY - this.restY
      const crossed = (prevX * curX < 0) || (prevY * curY < 0) || (Math.abs(curX) + Math.abs(curY) < 0.002)
      if (crossed) {
        landed = Math.hypot(this.vX * 0.18, this.vY * 0.135)
        this.landArmed = false
      }
    }
    return { ax, ay, landed }
  }
  angularSpeed(): number { return Math.hypot(this.vX, this.vY) }
}

export class ScalarField {
  readonly data: Float32Array
  private tmp: Float32Array
  private f: TrayFluid
  constructor(f: TrayFluid) {
    this.f = f
    this.data = new Float32Array(f.nx * f.ny)
    this.tmp = new Float32Array(f.nx * f.ny)
  }
  add(x: number, y: number, r: number, amount: number): void {
    const f = this.f
    const r2 = 2 * r * r
    for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
      const dx = (i + 0.5) * f.dx - f.width / 2 - x, dy = (j + 0.5) * f.dx - f.height / 2 - y
      this.data[j * f.nx + i] += amount * Math.exp(-(dx * dx + dy * dy) / r2)
    }
  }
  step(dt: number, diffusion: number, decay: number): void {
    const f = this.f, nx = f.nx, ny = f.ny, d = this.data, t = this.tmp
    // semi-Lagrangian advection
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i
      let px = i - (f.ux[c] * dt) / f.dx
      let py = j - (f.uy[c] * dt) / f.dx
      px = Math.max(0, Math.min(nx - 1.001, px)); py = Math.max(0, Math.min(ny - 1.001, py))
      const i0 = Math.floor(px), j0 = Math.floor(py), tx = px - i0, ty = py - j0
      const c0 = j0 * nx + i0
      const a0 = d[c0] + (d[c0 + 1] - d[c0]) * tx
      const a1 = d[c0 + nx] + (d[c0 + nx + 1] - d[c0 + nx]) * tx
      t[c] = a0 + (a1 - a0) * ty
    }
    // one Jacobi diffusion step + decay
    const a = Math.min(0.24, (diffusion * dt) / (f.dx * f.dx))
    const k = Math.exp(-decay * dt)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i
      const l = t[i > 0 ? c - 1 : c], r = t[i < nx - 1 ? c + 1 : c], u = t[j > 0 ? c - nx : c], dd = t[j < ny - 1 ? c + nx : c]
      d[c] = (t[c] + a * (l + r + u + dd - 4 * t[c])) * k
    }
  }
  sample(x: number, y: number): number {
    const f = this.f
    const fx = (x + f.width / 2) / f.dx - 0.5, fy = (y + f.height / 2) / f.dx - 0.5
    const i0 = Math.max(0, Math.min(f.nx - 2, Math.floor(fx))), j0 = Math.max(0, Math.min(f.ny - 2, Math.floor(fy)))
    const tx = Math.max(0, Math.min(1, fx - i0)), ty = Math.max(0, Math.min(1, fy - j0))
    const c = j0 * f.nx + i0, d = this.data
    const a0 = d[c] + (d[c + 1] - d[c]) * tx
    const a1 = d[c + f.nx] + (d[c + f.nx + 1] - d[c + f.nx]) * tx
    return a0 + (a1 - a0) * ty
  }
  clear(): void { this.data.fill(0) }
}

export function sloshFrequency(lengthM: number, depthM: number, mode = 1): number {
  return (mode * Math.sqrt(G * depthM)) / (2 * lengthM)
}
export function wallSlapToGain(e: number): number { return Math.min(1, Math.sqrt(e / 0.02)) }

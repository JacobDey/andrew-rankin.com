import type { TrayFluid } from './trayFluid'

/**
 * A passive scalar on the fluid's grid: dye, peroxide, tea, bromide (darkroom.md section 5.2).
 * Semi-Lagrangian advection by the cell-centred velocity, one Jacobi diffusion step that stays inside the wet area,
 * exponential decay. Values are whatever the caller means (concentration); nothing is clamped.
 */
export class ScalarField {
  readonly data: Float32Array
  private readonly tmp: Float32Array
  private readonly f: TrayFluid

  constructor(f: TrayFluid) {
    this.f = f
    this.data = new Float32Array(f.nx * f.ny)
    this.tmp = new Float32Array(f.nx * f.ny)
  }

  /** Add a Gaussian blob: `amount` is the increment at the centre, r the 1/e radius (m). Tray-local coordinates. */
  add(x: number, y: number, r: number, amount: number): void {
    const { nx, ny, dx, width, height } = this.f
    const rr = Math.max(r, dx)
    const cx = x + width / 2
    const cy = y + height / 2
    const i0 = Math.max(0, Math.floor((cx - 3 * rr) / dx))
    const i1 = Math.min(nx - 1, Math.ceil((cx + 3 * rr) / dx))
    const j0 = Math.max(0, Math.floor((cy - 3 * rr) / dx))
    const j1 = Math.min(ny - 1, Math.ceil((cy + 3 * rr) / dx))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const ddx = (i + 0.5) * dx - cx
        const ddy = (j + 0.5) * dx - cy
        this.data[j * nx + i] += amount * Math.exp(-(ddx * ddx + ddy * ddy) / (rr * rr))
      }
    }
  }

  /** dt: seconds (the frame dt); diffusion: m^2/s; decay: 1/s. */
  step(dt: number, diffusion: number, decay: number): void {
    const f = this.f
    const { nx, ny, dx, h, ux, uy } = f
    const d = this.data
    const t = this.tmp
    const eps = 1e-5
    const k = dt / dx
    // 1) advection (wet cells only; dry cells keep their value)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        if (h[c] <= eps) { t[c] = d[c]; continue }
        let x = i - ux[c] * k
        let y = j - uy[c] * k
        x = x < 0 ? 0 : x > nx - 1 ? nx - 1 : x
        y = y < 0 ? 0 : y > ny - 1 ? ny - 1 : y
        let x0 = x | 0
        let y0 = y | 0
        if (x0 > nx - 2) x0 = nx - 2
        if (y0 > ny - 2) y0 = ny - 2
        if (x0 < 0) x0 = 0
        if (y0 < 0) y0 = 0
        const fx = x - x0
        const fy = y - y0
        const b = y0 * nx + x0
        const a0 = d[b] + (d[b + 1] - d[b]) * fx
        const a1 = d[b + nx] + (d[b + nx + 1] - d[b + nx]) * fx
        t[c] = a0 + (a1 - a0) * fy
      }
    }
    // Semi-Lagrangian advection is not conservative: put back the total (clamped, so a real flux out of the
    // domain can never be invented).
    let before = 0
    let after = 0
    for (let c = 0; c < d.length; c++) { before += d[c]; after += t[c] }
    if (after > 1e-12 && before > 1e-12) {
      const g = Math.min(1.25, Math.max(0.8, before / after))
      if (g !== 1) for (let c = 0; c < t.length; c++) t[c] *= g
    }
    // 2) one Jacobi diffusion step over wet neighbours, 3) decay
    const kd = Math.min(0.2, (diffusion * dt) / (dx * dx))
    const dec = Math.exp(-decay * dt)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i
        const v = t[c]
        if (h[c] <= eps) { d[c] = v * dec; continue }
        let lap = 0
        let cnt = 0
        if (i > 0 && h[c - 1] > eps) { lap += t[c - 1]; cnt++ }
        if (i < nx - 1 && h[c + 1] > eps) { lap += t[c + 1]; cnt++ }
        if (j > 0 && h[c - nx] > eps) { lap += t[c - nx]; cnt++ }
        if (j < ny - 1 && h[c + nx] > eps) { lap += t[c + nx]; cnt++ }
        d[c] = (v + kd * (lap - cnt * v)) * dec
      }
    }
  }

  sample(x: number, y: number): number {
    const { nx, ny, dx, width, height } = this.f
    let gx = (x + width / 2) / dx - 0.5
    let gy = (y + height / 2) / dx - 0.5
    gx = gx < 0 ? 0 : gx > nx - 1 ? nx - 1 : gx
    gy = gy < 0 ? 0 : gy > ny - 1 ? ny - 1 : gy
    let i0 = Math.floor(gx)
    let j0 = Math.floor(gy)
    if (i0 > nx - 2) i0 = nx - 2
    if (j0 > ny - 2) j0 = ny - 2
    const fx = gx - i0
    const fy = gy - j0
    const c = j0 * nx + i0
    const d = this.data
    const a = d[c] + (d[c + 1] - d[c]) * fx
    const b = d[c + nx] + (d[c + nx + 1] - d[c + nx]) * fx
    return a + (b - a) * fy
  }

  clear(): void {
    this.data.fill(0)
  }
}

// games/plates/bench/fluid.ts — virtual-pipes heightfield (GDD §5.4). 60×48 cells of 5 mm.
// (@shared/fluid's TrayFluid is the cross-game facade; plates keeps the GDD's pipe model locally
// because its chemistry samples the exact per-cell fluxes. Same units: metres, seconds.)
import * as THREE from 'three'

const G = 9.81

export class PipeFluid {
  readonly nx: number; readonly nz: number; readonly cell: number
  readonly width: number; readonly depthZ: number
  readonly d: Float32Array; readonly b: Float32Array; readonly plateFloor: Float32Array
  readonly fE: Float32Array; readonly fW: Float32Array; readonly fN: Float32Array; readonly fS: Float32Array
  readonly ux: Float32Array; readonly uz: Float32Array
  readonly depthTex: THREE.DataTexture
  private half: Uint16Array
  tanX = 0; tanZ = 0; ax = 0; az = 0
  sleeping = false
  private lambda = 0.995
  rest: number
  constructor(nx = 60, nz = 48, cell = 0.005, rest = 0.008) {
    this.nx = nx; this.nz = nz; this.cell = cell; this.rest = rest
    this.width = nx * cell; this.depthZ = nz * cell
    const n = nx * nz
    this.d = new Float32Array(n).fill(rest); this.b = new Float32Array(n); this.plateFloor = new Float32Array(n)
    this.fE = new Float32Array(n); this.fW = new Float32Array(n); this.fN = new Float32Array(n); this.fS = new Float32Array(n)
    this.ux = new Float32Array(n); this.uz = new Float32Array(n)
    this.half = new Uint16Array(n)
    this.depthTex = new THREE.DataTexture(this.half, nx, nz, THREE.RedFormat, THREE.HalfFloatType)
    this.depthTex.magFilter = THREE.LinearFilter; this.depthTex.minFilter = THREE.LinearFilter
    this.depthTex.wrapS = THREE.ClampToEdgeWrapping; this.depthTex.wrapT = THREE.ClampToEdgeWrapping
    this.uploadDepth()
  }
  /** Extra floor (m) under a footprint, e.g. the 2 mm plate. Volume is conserved by lowering depth there. */
  setPlate(on: boolean, halfW: number, halfZ: number, thick = 0.002): void {
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = (i + 0.5) * this.cell - this.width / 2, z = (j + 0.5) * this.cell - this.depthZ / 2
      const k = j * this.nx + i
      const nf = on && Math.abs(x) < halfW && Math.abs(z) < halfZ ? thick : 0
      const delta = nf - this.plateFloor[k]
      if (delta !== 0) { this.plateFloor[k] = nf; this.d[k] = Math.max(0, this.d[k] - delta) }
    }
    this.wake()
  }
  setTilt(tanX: number, tanZ: number): void { if (tanX !== this.tanX || tanZ !== this.tanZ) { this.tanX = tanX; this.tanZ = tanZ; this.wake() } }
  setAccel(ax: number, az: number): void { this.ax = ax; this.az = az; if (ax || az) this.wake() }
  wake(): void { this.sleeping = false }
  /** Volume-conserving ripple: remove a Gaussian bump, return it as a ring. */
  poke(x: number, z: number, depthM: number, sigma: number): void {
    const ringR = sigma * 2.5
    let removed = 0
    const w: number[] = []
    let ringW = 0
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const cx = (i + 0.5) * this.cell - this.width / 2, cz = (j + 0.5) * this.cell - this.depthZ / 2
      const r = Math.hypot(cx - x, cz - z), k = j * this.nx + i
      const g = Math.exp(-(r * r) / (2 * sigma * sigma))
      const take = Math.min(this.d[k], depthM * g)
      this.d[k] -= take; removed += take
      const rw = Math.exp(-((r - ringR) * (r - ringR)) / (2 * sigma * sigma * 0.5))
      w.push(rw); ringW += rw
    }
    if (ringW > 0) for (let k = 0; k < w.length; k++) this.d[k] += (removed * w[k]) / ringW
    this.wake()
  }
  step(dt: number, substeps: number): void {
    if (this.sleeping) return
    // keep every substep under ~4.2 ms (CFL ≈ 18 ms); a long frame (hurry, timeScale) takes more
    // substeps up to a cap, beyond which the liquid runs slow rather than unstable
    substeps = Math.max(substeps, Math.min(48, Math.ceil(dt / (1 / 240))))
    dt = Math.min(dt, substeps / 240)
    const h = dt / substeps
    for (let s = 0; s < substeps; s++) this.substep(h)
    if (this.kinetic() < 1e-9 && !this.ax && !this.az && Math.abs(this.tanX) < 1e-4 && Math.abs(this.tanZ) < 1e-4) this.sleeping = true
  }
  private substep(dt: number): void {
    const { nx, nz, d, b, fE, fW, fN, fS, cell: l } = this
    const A = l * l, gx = this.ax / G, gz = this.az / G, k = (dt * G * A) / l, lam = this.lambda
    // floor + head
    const H = this.tmpH ?? (this.tmpH = new Float32Array(nx * nz))
    for (let j = 0; j < nz; j++) {
      const z = (j + 0.5) * l - this.depthZ / 2
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * l - this.width / 2, idx = j * nx + i
        b[idx] = x * this.tanX + z * this.tanZ + this.plateFloor[idx]
        H[idx] = b[idx] + d[idx] + x * gx + z * gz
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const idx = j * nx + i, Hi = H[idx]
      let e = i < nx - 1 ? Math.max(0, lam * fE[idx] + k * (Hi - H[idx + 1])) : 0
      let w = i > 0 ? Math.max(0, lam * fW[idx] + k * (Hi - H[idx - 1])) : 0
      let n = j > 0 ? Math.max(0, lam * fN[idx] + k * (Hi - H[idx - nx])) : 0
      let s = j < nz - 1 ? Math.max(0, lam * fS[idx] + k * (Hi - H[idx + nx])) : 0
      const sum = (e + w + n + s) * dt
      if (sum > 0) {
        const K = Math.min(1, (d[idx] * A) / sum)
        e *= K; w *= K; n *= K; s *= K
      }
      fE[idx] = e; fW[idx] = w; fN[idx] = n; fS[idx] = s
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const idx = j * nx + i
      const inE = i < nx - 1 ? fW[idx + 1] : 0, inW = i > 0 ? fE[idx - 1] : 0
      const inN = j > 0 ? fS[idx - nx] : 0, inS = j < nz - 1 ? fN[idx + nx] : 0
      const out = fE[idx] + fW[idx] + fN[idx] + fS[idx]
      const dOld = d[idx]
      const nd = dOld + (dt * (inE + inW + inN + inS - out)) / A
      d[idx] = nd > 0 && nd < 0.05 ? nd : nd >= 0.05 ? 0.05 : 0
      const dm = Math.max(0.0005, 0.5 * (dOld + d[idx]))
      this.ux[idx] = ((inW - fW[idx] + fE[idx] - inE) / 2) / (l * dm)
      this.uz[idx] = ((inN - fN[idx] + fS[idx] - inS) / 2) / (l * dm)
    }
  }
  private tmpH: Float32Array | null = null
  private sample(arr: Float32Array, x: number, z: number): number {
    const fx = (x + this.width / 2) / this.cell - 0.5, fz = (z + this.depthZ / 2) / this.cell - 0.5
    const i0 = Math.max(0, Math.min(this.nx - 2, Math.floor(fx))), j0 = Math.max(0, Math.min(this.nz - 2, Math.floor(fz)))
    const tx = Math.max(0, Math.min(1, fx - i0)), tz = Math.max(0, Math.min(1, fz - j0))
    const k = j0 * this.nx + i0
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - tz) + (arr[k + this.nx] * (1 - tx) + arr[k + this.nx + 1] * tx) * tz
  }
  depthAt(x: number, z: number): number { return this.sample(this.d, x, z) }
  velAt(x: number, z: number, out: { x: number; z: number }): void { out.x = this.sample(this.ux, x, z); out.z = this.sample(this.uz, x, z) }
  kinetic(): number {
    let e = 0
    for (let k = 0; k < this.d.length; k++) e += this.d[k] * (this.ux[k] * this.ux[k] + this.uz[k] * this.uz[k])
    return e * this.cell * this.cell * 1000 * 0.5
  }
  volume(): number { let v = 0; for (let k = 0; k < this.d.length; k++) v += this.d[k]; return v * this.cell * this.cell }
  uploadDepth(): void {
    for (let k = 0; k < this.d.length; k++) this.half[k] = THREE.DataUtils.toHalfFloat(this.d[k] * 1000)
    this.depthTex.needsUpdate = true
  }
  snapshot(): Float32Array { return this.d.slice() }
  restoreDepth(d: Float32Array): void { this.d.set(d); this.fE.fill(0); this.fW.fill(0); this.fN.fill(0); this.fS.fill(0); this.wake() }
  reset(): void { this.d.fill(this.rest); for (let k = 0; k < this.d.length; k++) this.d[k] = Math.max(0, this.rest - this.plateFloor[k]); this.fE.fill(0); this.fW.fill(0); this.fN.fill(0); this.fS.fill(0); this.ux.fill(0); this.uz.fill(0); this.wake() }
}

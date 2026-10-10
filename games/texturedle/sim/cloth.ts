// XPBD cloth swatch (texturedle.md §5.5). Simulated in swatch units (side = 1),
// so stiffness is the same at every ratio; contact queries convert to mm with
// x_mm = x_u · L_s. Fingertip patch + two-sided tethers from the grab point
// (spikes/cloth-marble NOTES gotcha 2), Müller PBD friction, stick-slip,
// burlap snags, Archard wear and residue pickup accumulated per frame.

import type { HeightField } from './heightfield'
import type { ClothKind, RGB } from '../contracts'
import type { Rng } from './rng'

export interface ClothSpec {
  kind: ClothKind
  thicknessMm: number
  muCloth: number
  pressMm: number
  archardK: number // µm per 0.3 frame-widths slid at p = 1
  kPick: number
  shear: number // compliance
  bend: number
  snags: boolean
}

export const LENS: ClothSpec = { kind: 'lens', thicknessMm: 0.05, muCloth: 0.25, pressMm: 0.03, archardK: 0.5, kPick: 0.5, shear: 1e-4, bend: 5e-4, snags: false }
export const BURLAP: ClothSpec = { kind: 'burlap', thicknessMm: 0.4, muCloth: 0.7, pressMm: 0.12, archardK: 20, kPick: 0.15, shear: 1e-6, bend: 2e-6, snags: true }

/** What the cloth needs from the bench each frame. */
export interface ClothEnv {
  Ls: number // swatch side, mm
  frameW: number // frame width, mm
  field: HeightField // contact field D_r (mm) for this cloth's yarn radius
  mu: (xmm: number, ymm: number) => number // μ_k of the top layer
  hardness: (xmm: number, ymm: number) => number
  residue: (xmm: number, ymm: number) => { rgb: RGB; rate: number } | null
  loose: (xmm: number, ymm: number) => number // µm
  snag: (xmm: number, ymm: number) => number
  sphere: [number, number, number, number] | null // marble x, y, z, r (mm)
  looseRgb?: RGB
  rng: Rng
}

export interface ClothFrameOut {
  slipCount: number
  slipPower: number
  snags: Array<{ t: 'snag' | 'snagRelease'; x: number; y: number; s: number }>
  contacts: number
  muSum: number
  // contact centroid and mean velocity (mm, mm/s wall)
  cx: number; cy: number; vx: number; vy: number; load: number
  // grab travel while in contact (mm)
  travel: number
}

export class Cloth {
  readonly spec: ClothSpec
  readonly n: number
  readonly N: number
  readonly a: number // rest spacing (su)
  x: Float64Array
  xp: Float64Array
  v: Float64Array
  w: Float32Array
  private ca: Int32Array
  private cb: Int32Array
  private cr: Float64Array
  private cc: Float64Array
  private cl: Float64Array
  private uv: Float32Array
  private still = 0
  asleep = true
  where: 'tray' | 'held' | 'plate' = 'tray'
  flipped = false
  // grab
  grabbed = -1
  private patch: number[] = []
  private patchOff: number[] = []
  private tether: Float64Array
  private gpx = 0
  private gpy = 0
  private gtx = 0
  private gty = 0
  pressScale = 1
  // contact state
  private pen: Float64Array
  private staticRun: Uint8Array
  pinned: Uint8Array
  private pin: Float64Array
  private pinS: Float32Array
  private cool: Float32Array
  // per-frame wear and residue
  wear: Float32Array // µm this frame (per particle), already hardness-scaled
  wearAny = false
  polish: Float32Array
  residueA: Float32Array // 0..1
  residueRgb: Float32Array // linear rgb
  residue: Uint8ClampedArray // n² RGBA (sRGB-ish) for render
  rubbing: Uint8ClampedArray
  fibres: Float32Array
  fibreCount = 0
  version = 0
  // running stats
  wipedMm = 0
  muEff = 0
  muN = 0

  constructor(spec: ClothSpec, n: number) {
    this.spec = spec
    this.n = n
    this.N = n * n
    this.a = 1 / (n - 1)
    const N = this.N
    this.x = new Float64Array(N * 3)
    this.xp = new Float64Array(N * 3)
    this.v = new Float64Array(N * 3)
    this.w = new Float32Array(N).fill(1)
    this.uv = new Float32Array(N * 2)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i
      this.uv[k * 2] = i * this.a
      this.uv[k * 2 + 1] = j * this.a
    }
    const A: number[] = [], B: number[] = [], R: number[] = [], C: number[] = []
    const add = (i0: number, j0: number, i1: number, j1: number, c: number) => {
      if (i1 < 0 || j1 < 0 || i1 >= n || j1 >= n) return
      A.push(j0 * n + i0)
      B.push(j1 * n + i1)
      R.push(Math.hypot(i1 - i0, j1 - j0) * this.a)
      C.push(c)
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      add(i, j, i + 1, j, 0)
      add(i, j, i, j + 1, 0)
      add(i, j, i + 1, j + 1, spec.shear)
      add(i, j, i - 1, j + 1, spec.shear)
      add(i, j, i + 2, j, spec.bend)
      add(i, j, i, j + 2, spec.bend)
    }
    this.ca = Int32Array.from(A)
    this.cb = Int32Array.from(B)
    this.cr = Float64Array.from(R)
    this.cc = Float64Array.from(C)
    this.cl = new Float64Array(A.length)
    this.tether = new Float64Array(N)
    this.pen = new Float64Array(N)
    this.staticRun = new Uint8Array(N)
    this.pinned = new Uint8Array(N)
    this.pin = new Float64Array(N * 3)
    this.pinS = new Float32Array(N)
    this.cool = new Float32Array(N)
    this.wear = new Float32Array(N)
    this.polish = new Float32Array(N)
    this.residueA = new Float32Array(N)
    this.residueRgb = new Float32Array(N * 3)
    this.residue = new Uint8ClampedArray(N * 4)
    this.rubbing = new Uint8ClampedArray(N * 4)
    this.fibres = new Float32Array(32 * 4)
  }

  /** Lay flat, centred at (cx, cy) mm, conformed to the field. */
  place(cxMm: number, cyMm: number, env: ClothEnv, angle = 0): void {
    const n = this.n
    const c = Math.cos(angle), s = Math.sin(angle)
    const L = env.Ls
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i
      const u = i * this.a - 0.5, v = j * this.a - 0.5
      const xu = cxMm / L + u * c - v * s
      const yu = cyMm / L + u * s + v * c
      this.x[k * 3] = xu
      this.x[k * 3 + 1] = yu
      this.x[k * 3 + 2] = (env.field.sample(xu * L, yu * L) + this.spec.thicknessMm) / L + 0.002
      this.v[k * 3] = this.v[k * 3 + 1] = this.v[k * 3 + 2] = 0
    }
    this.pinned.fill(0)
    this.where = 'plate'
    this.asleep = false
    this.still = 0
    this.version++
  }

  centroid(out: [number, number]): [number, number] {
    let sx = 0, sy = 0
    for (let k = 0; k < this.N; k++) { sx += this.x[k * 3]; sy += this.x[k * 3 + 1] }
    out[0] = sx / this.N
    out[1] = sy / this.N
    return out
  }

  /** Nearest particle to (x, y) su within maxDist, or −1. */
  pick(xu: number, yu: number, maxDist: number): number {
    let best = -1
    let bd = maxDist * maxDist
    for (let k = 0; k < this.N; k++) {
      const d = (this.x[k * 3] - xu) ** 2 + (this.x[k * 3 + 1] - yu) ** 2
      if (d < bd) { bd = d; best = k }
    }
    return best
  }

  /** Is (x, y) su inside the swatch outline (roughly)? */
  covers(xu: number, yu: number): boolean {
    return this.pick(xu, yu, this.a * 1.6) >= 0
  }

  grab(k: number): void {
    this.grabbed = k
    this.where = 'held'
    this.asleep = false
    const gx = this.x[k * 3], gy = this.x[k * 3 + 1]
    this.gpx = this.gtx = gx
    this.gpy = this.gty = gy
    this.patch = []
    this.patchOff = []
    const ru = this.uv[k * 2], rv = this.uv[k * 2 + 1]
    const fr = Math.max(this.a * 1.05, 0.11)
    for (let q = 0; q < this.N; q++) {
      const d = Math.hypot(this.uv[q * 2] - ru, this.uv[q * 2 + 1] - rv)
      this.tether[q] = d
      if (d <= fr) {
        this.patch.push(q)
        this.patchOff.push(this.x[q * 3] - gx, this.x[q * 3 + 1] - gy)
        this.w[q] = 0
        this.pinned[q] = 0
      }
    }
  }

  moveGrab(xu: number, yu: number): void {
    this.gtx = xu
    this.gty = yu
  }

  release(): void {
    for (const q of this.patch) this.w[q] = 1
    this.patch = []
    this.patchOff = []
    this.grabbed = -1
    if (this.where === 'held') this.where = 'plate'
  }

  stow(): void {
    this.release()
    this.where = 'tray'
    this.asleep = true
    this.pinned.fill(0)
  }

  step(dt: number, sub: number, env: ClothEnv, out: ClothFrameOut): void {
    out.slipCount = 0; out.slipPower = 0; out.snags.length = 0; out.contacts = 0; out.muSum = 0
    out.cx = 0; out.cy = 0; out.vx = 0; out.vy = 0; out.load = 0; out.travel = 0
    this.wearAny = false
    if (this.where === 'tray') return
    if (this.asleep && this.grabbed < 0 && !env.sphere) return
    this.asleep = false
    const N = this.N
    const X = this.x, XP = this.xp, V = this.v, W = this.w
    const L = env.Ls
    const sp = this.spec
    const h = dt / sub
    const thick = sp.thicknessMm / L
    const press = (sp.pressMm * this.pressScale) / L
    const sigma = 0.25
    const fieldScale = 1 / L
    let maxMove = 0
    const travelX = this.gtx - this.gpx, travelY = this.gty - this.gpy
    const frameW = env.frameW
    this.wear.fill(0)
    this.polish.fill(0)
    let ccx = 0, ccy = 0, cvx = 0, cvy = 0, cn = 0
    for (let s = 0; s < sub; s++) {
      // predict
      for (let k = 0; k < N; k++) {
        const i3 = k * 3
        XP[i3] = X[i3]; XP[i3 + 1] = X[i3 + 1]; XP[i3 + 2] = X[i3 + 2]
        this.pen[k] = 0
        if (W[k] === 0) continue
        const damp = Math.exp(-4 * h)
        V[i3] *= damp; V[i3 + 1] *= damp; V[i3 + 2] = V[i3 + 2] * damp - 2 * h
        X[i3] += V[i3] * h; X[i3 + 1] += V[i3 + 1] * h; X[i3 + 2] += V[i3 + 2] * h
      }
      // kinematic fingertip patch
      let tx = 0, ty = 0
      if (this.grabbed >= 0) {
        const f = (s + 1) / sub
        tx = this.gpx + (this.gtx - this.gpx) * f
        ty = this.gpy + (this.gty - this.gpy) * f
        for (let q = 0; q < this.patch.length; q++) {
          const k = this.patch[q]
          const px = tx + this.patchOff[q * 2], py = ty + this.patchOff[q * 2 + 1]
          X[k * 3] = px
          X[k * 3 + 1] = py
          X[k * 3 + 2] = env.field.sample(px * L, py * L) * fieldScale + thick - press
        }
        // palm pressure around the fingertip
        const inv = 1 / (2 * sigma * sigma)
        for (let k = 0; k < N; k++) {
          if (W[k] === 0) continue
          const dx = X[k * 3] - tx, dy = X[k * 3 + 1] - ty
          const d2 = dx * dx + dy * dy
          if (d2 > 9 * sigma * sigma) continue
          X[k * 3 + 2] -= press * Math.exp(-d2 * inv) * 0.5
        }
      }
      // distance constraints (XPBD, one iteration)
      const ih2 = 1 / (h * h)
      if (s === 0) this.cl.fill(0)
      const ca = this.ca, cb = this.cb, cr = this.cr, cc = this.cc, cl = this.cl
      for (let c = 0; c < ca.length; c++) {
        const a = ca[c], b = cb[c]
        const wa = W[a], wb = W[b]
        const alpha = cc[c] * ih2
        const ws = wa + wb + alpha
        if (ws === 0) continue
        const a3 = a * 3, b3 = b * 3
        const dx = X[b3] - X[a3], dy = X[b3 + 1] - X[a3 + 1], dz = X[b3 + 2] - X[a3 + 2]
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (len < 1e-9) continue
        const dl = (cr[c] - len - alpha * cl[c]) / ws
        cl[c] += dl
        const q = dl / len
        X[a3] -= wa * q * dx; X[a3 + 1] -= wa * q * dy; X[a3 + 2] -= wa * q * dz
        X[b3] += wb * q * dx; X[b3 + 1] += wb * q * dy; X[b3 + 2] += wb * q * dz
      }
      // tethers from the finger
      if (this.grabbed >= 0) {
        const g = this.grabbed
        const gx = X[g * 3], gy = X[g * 3 + 1], gz = X[g * 3 + 2]
        for (let k = 0; k < N; k++) {
          if (W[k] === 0) continue
          const k3 = k * 3
          const dx = X[k3] - gx, dy = X[k3 + 1] - gy, dz = X[k3 + 2] - gz
          const d2 = dx * dx + dy * dy + dz * dz
          const Lm = this.tether[k] * 1.02
          if (d2 > Lm * Lm) {
            const d = Math.sqrt(d2)
            const q = (d - Lm) / d
            X[k3] -= dx * q; X[k3 + 1] -= dy * q; X[k3 + 2] -= dz * q
            continue
          }
          const Lmin = this.tether[k] * 0.85
          const p2 = dx * dx + dy * dy
          if (p2 < Lmin * Lmin && p2 > 1e-12) {
            const dp = Math.sqrt(p2)
            const q = (Lmin - dp) / dp
            X[k3] += dx * q; X[k3 + 1] += dy * q
          }
        }
      }
      // snag pins
      if (sp.snags) {
        for (let k = 0; k < N; k++) {
          if (!this.pinned[k]) continue
          const k3 = k * 3
          const d = Math.hypot(X[k3] - this.pin[k3], X[k3 + 1] - this.pin[k3 + 1], X[k3 + 2] - this.pin[k3 + 2])
          if (d > 0.02 + 0.08 * this.pinS[k] || W[k] === 0) {
            this.pinned[k] = 0
            this.cool[k] = 0.3
            out.snags.push({ t: 'snagRelease', x: this.pin[k3] * L, y: this.pin[k3 + 1] * L, s: this.pinS[k] })
            this.addFibre(this.pin[k3] * L, this.pin[k3 + 1] * L, env)
            continue
          }
          X[k3] = this.pin[k3]; X[k3 + 1] = this.pin[k3 + 1]; X[k3 + 2] = this.pin[k3 + 2]
        }
      }
      // marble sphere
      if (env.sphere) {
        const [mx, my, mz, mr] = env.sphere
        const cx = mx / L, cy = my / L, cz = mz / L, R = mr / L + thick
        for (let k = 0; k < N; k++) {
          if (W[k] === 0) continue
          const k3 = k * 3
          const dx = X[k3] - cx, dy = X[k3 + 1] - cy
          if (dx * dx + dy * dy > R * R) continue
          const dz = X[k3 + 2] - cz
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 >= R * R) continue
          const d = Math.sqrt(d2) || 1e-6
          const q = (R - d) / d
          X[k3] += dx * q; X[k3 + 1] += dy * q; X[k3 + 2] += dz * q
        }
      }
      // field collision (vertical projection onto D + t)
      for (let k = 0; k < N; k++) {
        const k3 = k * 3
        const zmin = env.field.sample(X[k3] * L, X[k3 + 1] * L) * fieldScale + thick
        const d = zmin - X[k3 + 2]
        if (d > 0) {
          this.pen[k] = d
          if (W[k] !== 0) X[k3 + 2] = zmin
        }
      }
      // friction, stick-slip, wear, residue, velocities
      const last = s === sub - 1
      for (let k = 0; k < N; k++) {
        const k3 = k * 3
        const pen = this.pen[k]
        if (pen > 0 && !this.pinned[k]) {
          let dx = X[k3] - XP[k3], dy = X[k3 + 1] - XP[k3 + 1]
          const dtan = Math.sqrt(dx * dx + dy * dy)
          const xm = X[k3] * L, ym = X[k3 + 1] * L
          const muL = env.mu(xm, ym)
          const muK = Math.sqrt(sp.muCloth * muL)
          const muS = muK * 1.25
          let slid = dtan
          if (W[k] !== 0) {
            if (dtan < muS * pen) {
              X[k3] -= dx; X[k3 + 1] -= dy
              slid = 0
              if (this.staticRun[k] < 250) this.staticRun[k]++
            } else {
              const f = Math.min(1, (muK * pen) / dtan)
              X[k3] -= dx * f; X[k3 + 1] -= dy * f
              slid = dtan * (1 - f)
              if (this.staticRun[k] >= 3) {
                out.slipCount++
                out.slipPower += muK * pen * slid * L * 1000
              }
              this.staticRun[k] = 0
            }
          }
          if (slid > 0) {
            dx = X[k3] - XP[k3]; dy = X[k3 + 1] - XP[k3 + 1]
            const slidMm = slid * L
            // palm weight: 1 in the fingertip patch, gaussian around it
            let p = 0.04
            if (this.grabbed >= 0) {
              const ddx = X[k3] - tx, ddy = X[k3 + 1] - ty
              p = Math.max(p, Math.exp(-(ddx * ddx + ddy * ddy) / (2 * sigma * sigma)))
              if (W[k] === 0) p = 1
            }
            p *= this.pressScale
            const frac = slidMm / (0.3 * frameW)
            const hard = Math.max(0.05, env.hardness(xm, ym))
            this.wear[k] += (sp.archardK * p * frac) / hard
            this.polish[k] += p * frac
            this.wearAny = true
            // residue pickup
            const src = env.residue(xm, ym)
            const lu = Math.min(1, env.loose(xm, ym) / 25)
            const amt = (src ? src.rate : 0) + lu
            if (amt > 0) {
              const ra = this.residueA[k]
              const dr = sp.kPick * amt * frac * 6 * (1 - ra)
              if (dr > 0) {
                const rgb = lu > (src ? src.rate : 0) && env.looseRgb ? env.looseRgb : src ? src.rgb : null
                const wNew = dr / (ra + dr)
                if (rgb) {
                  this.residueRgb[k3] += (rgb[0] - this.residueRgb[k3]) * wNew
                  this.residueRgb[k3 + 1] += (rgb[1] - this.residueRgb[k3 + 1]) * wNew
                  this.residueRgb[k3 + 2] += (rgb[2] - this.residueRgb[k3 + 2]) * wNew
                }
                this.residueA[k] = Math.min(1, ra + dr)
              }
            }
            // snags: sliding over sharp hard peaks
            if (sp.snags && W[k] !== 0 && this.cool[k] <= 0) {
              const S = env.snag(xm, ym)
              let pins = 0
              for (let q = 0; q < N; q++) pins += this.pinned[q]
              if (S > 0.3 && pins < 3 && env.rng() < (S - 0.3) * slidMm * 6) {
                this.pinned[k] = 1
                this.pinS[k] = S
                this.pin[k3] = X[k3]; this.pin[k3 + 1] = X[k3 + 1]; this.pin[k3 + 2] = X[k3 + 2]
                out.snags.push({ t: 'snag', x: xm, y: ym, s: S })
              }
            }
          }
          if (last) {
            out.contacts++
            out.muSum += muK
            ccx += X[k3]; ccy += X[k3 + 1]
            cvx += (X[k3] - XP[k3]) / h; cvy += (X[k3 + 1] - XP[k3 + 1]) / h
            cn++
          }
        } else if (pen <= 0) this.staticRun[k] = 0
        if (this.cool[k] > 0) this.cool[k] -= h
        if (this.pinned[k]) { V[k3] = V[k3 + 1] = V[k3 + 2] = 0; continue }
        V[k3] = (X[k3] - XP[k3]) / h
        V[k3 + 1] = (X[k3 + 1] - XP[k3 + 1]) / h
        let vz = (X[k3 + 2] - XP[k3 + 2]) / h
        if (vz > 2) vz = 2
        V[k3 + 2] = vz
        // clamp per-substep displacement to half a spacing (tunnelling on deep relief)
        const mv = Math.hypot(X[k3] - XP[k3], X[k3 + 1] - XP[k3 + 1], X[k3 + 2] - XP[k3 + 2])
        if (mv > maxMove) maxMove = mv
      }
    }
    this.gpx = this.gtx
    this.gpy = this.gty
    if (cn > 0) {
      out.cx = (ccx / cn) * L; out.cy = (ccy / cn) * L
      out.vx = (cvx / cn) * L; out.vy = (cvy / cn) * L
      out.load = Math.min(1, cn / (N * 0.5)) * this.pressScale
      if (this.grabbed >= 0) out.travel = Math.hypot(travelX, travelY) * L
    }
    if (out.contacts > 0) { this.muEff += out.muSum / out.contacts; this.muN++ }
    this.wipedMm += out.travel
    // render residue (sRGB-ish bytes)
    for (let k = 0; k < N; k++) {
      const a = this.residueA[k]
      this.residue[k * 4] = Math.round(Math.pow(Math.max(0, this.residueRgb[k * 3]), 1 / 2.2) * 255)
      this.residue[k * 4 + 1] = Math.round(Math.pow(Math.max(0, this.residueRgb[k * 3 + 1]), 1 / 2.2) * 255)
      this.residue[k * 4 + 2] = Math.round(Math.pow(Math.max(0, this.residueRgb[k * 3 + 2]), 1 / 2.2) * 255)
      this.residue[k * 4 + 3] = Math.round(a * 255)
    }
    this.version++
    if (this.grabbed < 0 && maxMove < 2e-5 && !env.sphere) {
      if (++this.still > 30) this.asleep = true
    } else this.still = 0
  }

  private addFibre(x: number, y: number, env: ClothEnv): void {
    const i = this.fibreCount % 32
    this.fibres[i * 4] = x
    this.fibres[i * 4 + 1] = y
    this.fibres[i * 4 + 2] = env.rng() * Math.PI
    this.fibres[i * 4 + 3] = 0.15 + env.rng() * 0.3
    this.fibreCount++
  }

  /** Mean residue alpha and colour over the particles that carry any. */
  residueSummary(out: { rgb: RGB; alpha: number }): { rgb: RGB; alpha: number } {
    let a = 0, r = 0, g = 0, b = 0, n = 0, wsum = 0
    for (let k = 0; k < this.N; k++) {
      const ra = this.residueA[k]
      if (ra < 0.02) continue
      // weight by alpha²: the colour of the stained part, not a wash of everything touched
      const cr = this.residueRgb[k * 3], cg = this.residueRgb[k * 3 + 1], cb = this.residueRgb[k * 3 + 2]
      const chroma = Math.max(cr, cg, cb) - Math.min(cr, cg, cb)
      const w = ra * ra * (0.03 + chroma)
      a += ra; r += this.residueRgb[k * 3] * w; g += this.residueRgb[k * 3 + 1] * w; b += this.residueRgb[k * 3 + 2] * w; wsum += w
      n++
    }
    if (n === 0 || a === 0) { out.alpha = 0; return out }
    out.rgb[0] = r / wsum; out.rgb[1] = g / wsum; out.rgb[2] = b / wsum
    // coverage-weighted: a whole-cloth mean, emphasising the stained part
    out.alpha = Math.min(1, (a / n) * Math.min(1, n / (this.N * 0.15)))
    return out
  }
}

// Marble: a solid sphere rolling, bouncing and rattling on a contact field.
// Fixed-step semi-implicit Euler (call step() at 240 Hz or faster).
//
//   grounded:  a = (g.n) n + 5/7 (g - (g.n) n) - c_rr |g.n| v_rel_hat
//   airborne:  a = g
//   collide:   centre z >= support(x, y); v_n < -threshold -> bounce with e,
//              else remove v_n (and emit a 'tick' if it was a noticeable kink)
//
// The support function is supplied by the world, so the same marble rolls on
// the bare heightfield (D_r + r) or on a cloth lying on it.

import type { ProbeEvent } from './events'

export interface MarbleParams {
  /** mm */
  radius: number
  /** g/mm^3 (glass 0.0025, steel 0.0079) */
  density: number
  /** multiplier on the surface's restitution */
  restitution: number
  /** multiplier on the surface's rolling resistance */
  rollResist: number
  /** normal speed (mm/s) above which contact bounces instead of sticking */
  bounceSpeed: number
  /** normal speed (mm/s) above which a non-bouncing kink emits a 'tick' */
  tickSpeed: number
  /** gap (mm) below which the marble counts as touching */
  groundGap: number
  /** hover height above the support while held (mm) */
  hover: number
  /** cap on release (throw) speed, mm/s */
  maxThrow: number
  /** linear air drag (1/s) */
  airDrag: number
  /** restitution against the frame edge */
  wallRestitution: number
}

export const GLASS_MARBLE: MarbleParams = {
  radius: 4,
  density: 0.0025,
  restitution: 1,
  rollResist: 1,
  bounceSpeed: 8,
  tickSpeed: 2.5,
  groundGap: 0.02,
  hover: 6,
  maxThrow: 150,
  airDrag: 0.05,
  wallRestitution: 0.45,
}

export const STEEL_BB: MarbleParams = {
  ...GLASS_MARBLE,
  radius: 1.5,
  density: 0.0079,
  restitution: 1.15,
  rollResist: 0.8,
  hover: 4,
}

/** What the marble's centre rests on at (x, y). Filled by a SupportFn. */
export interface Support {
  /** height of the marble CENTRE when touching (mm) */
  h: number
  nx: number
  ny: number
  nz: number
  /** velocity of the supporting material (a moving cloth), mm/s */
  vx: number
  vy: number
  vz: number
  /** restitution of the support */
  rest: number
  /** rolling-resistance coefficient of the support */
  crr: number
  /** how strongly a moving support drags the marble along (friction coeff) */
  mu: number
  /** material tag (e.g. rust weight) for events/audio */
  tag: number
  /** micro-roughness under the contact (mm), drives roll noise */
  grain: number
  /** '' for the bare surface, else the id of the cloth it rests on */
  on: string
}

export function support(): Support {
  return { h: 0, nx: 0, ny: 0, nz: 1, vx: 0, vy: 0, vz: 0, rest: 0.5, crr: 0.01, mu: 0, tag: 0, grain: 0, on: '' }
}

export type SupportFn = (x: number, y: number, r: number, out: Support) => Support

export interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

export class Marble {
  p: MarbleParams
  x = 0
  y = 0
  z = 10
  vx = 0
  vy = 0
  vz = 0
  /** orientation quaternion (x, y, z, w), for rendering the swirl */
  q: [number, number, number, number] = [0, 0, 0, 1]
  wx = 0
  wy = 0
  wz = 0
  /** touching the support this step */
  grounded = false
  held = false
  /** held target */
  hx = 0
  hy = 0
  /** contact info for audio: speed relative to support (mm/s) and grain under it */
  rollSpeed = 0
  grain = 0
  tag = 0
  on = ''
  /** frame-edge walls for the centre (optional) */
  bounds: Bounds | null = null
  /** totals for stats */
  bounces = 0
  ticks = 0
  private s = support()
  private prevSupVx = 0
  private prevSupVy = 0

  constructor(p: Partial<MarbleParams> = {}) {
    this.p = { ...GLASS_MARBLE, ...p }
  }

  get mass(): number {
    return this.p.density * (4 / 3) * Math.PI * this.p.radius ** 3
  }

  setParams(p: Partial<MarbleParams>): void {
    this.p = { ...this.p, ...p }
  }

  /** Place at rest (or with velocity). z defaults to resting on the support. */
  place(x: number, y: number, sup: SupportFn, lift = 0, vx = 0, vy = 0): void {
    sup(x, y, this.p.radius, this.s)
    this.x = x
    this.y = y
    this.z = this.s.h + lift
    this.vx = vx
    this.vy = vy
    this.vz = 0
    this.held = false
    this.grounded = lift <= this.p.groundGap
  }

  grab(x: number, y: number): void {
    this.held = true
    this.hx = x
    this.hy = y
  }

  moveTo(x: number, y: number): void {
    this.hx = x
    this.hy = y
  }

  /** Let go with a throw velocity (mm/s), capped at maxThrow. */
  release(vx = 0, vy = 0): void {
    const sp = Math.hypot(vx, vy)
    const cap = this.p.maxThrow
    const k = sp > cap ? cap / sp : 1
    this.vx = vx * k
    this.vy = vy * k
    this.vz = 0
    this.held = false
    this.grounded = false
  }

  step(dt: number, g: readonly number[], sup: SupportFn, events: ProbeEvent[], t: number): void {
    const r = this.p.radius
    const S = this.s
    if (this.held) {
      sup(this.hx, this.hy, r, S)
      const tz = S.h + this.p.hover
      const a = 1 - Math.exp(-dt * 22)
      const nx = this.x + (this.hx - this.x) * a
      const ny = this.y + (this.hy - this.y) * a
      const nz = this.z + (tz - this.z) * a
      this.vx = (nx - this.x) / dt
      this.vy = (ny - this.y) / dt
      this.vz = (nz - this.z) / dt
      this.x = nx
      this.y = ny
      this.z = nz
      this.grounded = false
      this.rollSpeed = 0
      this.spin(dt, 0, 0, 0)
      return
    }

    sup(this.x, this.y, r, S)
    const gap = this.z - S.h
    this.grounded = this.grounded ? gap < this.p.groundGap : gap < this.p.groundGap * 0.5
    let ax = g[0]
    let ay = g[1]
    let az = g[2]
    if (this.grounded) {
      const nx = S.nx
      const ny = S.ny
      const nz = S.nz
      const gn = g[0] * nx + g[1] * ny + g[2] * nz
      // tangential gravity at 5/7 (solid sphere rolling without slip), normal part intact
      const gtx = g[0] - gn * nx
      const gty = g[1] - gn * ny
      const gtz = g[2] - gn * nz
      ax = gn * nx + (5 / 7) * gtx
      ay = gn * ny + (5 / 7) * gty
      az = gn * nz + (5 / 7) * gtz
      // velocity relative to the support, tangential part
      let rvx = this.vx - S.vx
      let rvy = this.vy - S.vy
      let rvz = this.vz - S.vz
      const rvn = rvx * nx + rvy * ny + rvz * nz
      rvx -= rvn * nx
      rvy -= rvn * ny
      rvz -= rvn * nz
      const sp = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz)
      // a moving support (cloth) drags the ball: sudden support velocity changes
      // transfer 2/7 instantly when rolling (limited by friction), rest via resistance
      if (S.on) {
        const dvx = S.vx - this.prevSupVx
        const dvy = S.vy - this.prevSupVy
        const dv = Math.hypot(dvx, dvy)
        const lim = S.mu * Math.abs(gn) * dt * 4
        const k = dv > 0 ? Math.min(2 / 7, lim / dv) : 0
        this.vx += dvx * k
        this.vy += dvy * k
      }
      this.prevSupVx = S.vx
      this.prevSupVy = S.vy
      if (sp > 1e-6) {
        let decel = S.crr * this.p.rollResist * Math.abs(gn)
        if (decel * dt > sp) decel = sp / dt
        ax -= (decel * rvx) / sp
        ay -= (decel * rvy) / sp
        az -= (decel * rvz) / sp
      }
      this.rollSpeed = sp
      this.grain = S.grain
      this.tag = S.tag
      this.on = S.on
    } else {
      this.rollSpeed = 0
      this.prevSupVx = S.vx
      this.prevSupVy = S.vy
    }

    const drag = 1 - this.p.airDrag * dt
    this.vx = (this.vx + ax * dt) * drag
    this.vy = (this.vy + ay * dt) * drag
    this.vz = (this.vz + az * dt) * drag
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.z += this.vz * dt

    // frame edges
    const B = this.bounds
    if (B) {
      const e = this.p.wallRestitution
      if (this.x < B.x0 && this.vx < 0) {
        this.x = B.x0
        if (-this.vx > 6) events.push({ type: 'wall', source: 'marble', x: this.x, y: this.y, strength: -this.vx, t })
        this.vx = -this.vx * e
      } else if (this.x > B.x1 && this.vx > 0) {
        this.x = B.x1
        if (this.vx > 6) events.push({ type: 'wall', source: 'marble', x: this.x, y: this.y, strength: this.vx, t })
        this.vx = -this.vx * e
      }
      if (this.y < B.y0 && this.vy < 0) {
        this.y = B.y0
        if (-this.vy > 6) events.push({ type: 'wall', source: 'marble', x: this.x, y: this.y, strength: -this.vy, t })
        this.vy = -this.vy * e
      } else if (this.y > B.y1 && this.vy > 0) {
        this.y = B.y1
        if (this.vy > 6) events.push({ type: 'wall', source: 'marble', x: this.x, y: this.y, strength: this.vy, t })
        this.vy = -this.vy * e
      }
    }

    // collide with the support
    sup(this.x, this.y, r, S)
    if (this.z < S.h) {
      const nx = S.nx
      const ny = S.ny
      const nz = S.nz
      const vn = (this.vx - S.vx) * nx + (this.vy - S.vy) * ny + (this.vz - S.vz) * nz
      if (vn < -this.p.bounceSpeed) {
        const e = Math.min(0.95, S.rest * this.p.restitution)
        this.vx -= (1 + e) * vn * nx
        this.vy -= (1 + e) * vn * ny
        this.vz -= (1 + e) * vn * nz
        this.grounded = false
        this.bounces++
        events.push({ type: 'impact', source: 'marble', x: this.x, y: this.y, strength: -vn, t, tag: S.tag })
      } else if (vn < 0) {
        this.vx -= vn * nx
        this.vy -= vn * ny
        this.vz -= vn * nz
        this.grounded = true
        if (-vn > this.p.tickSpeed) {
          this.ticks++
          events.push({ type: 'tick', source: 'marble', x: this.x, y: this.y, strength: -vn, t, tag: S.tag })
        }
      } else this.grounded = true
      this.z = S.h
    }

    // visible spin: rolling => w = n x v / r
    if (this.grounded) {
      const rvx = this.vx - S.vx
      const rvy = this.vy - S.vy
      const rvz = this.vz - S.vz
      this.wx = (S.ny * rvz - S.nz * rvy) / r
      this.wy = (S.nz * rvx - S.nx * rvz) / r
      this.wz = (S.nx * rvy - S.ny * rvx) / r
    }
    this.spin(dt, this.wx, this.wy, this.wz)
  }

  private spin(dt: number, wx: number, wy: number, wz: number): void {
    const q = this.q
    const hx = 0.5 * dt * wx
    const hy = 0.5 * dt * wy
    const hz = 0.5 * dt * wz
    // q' = q + 0.5 dt (w, 0) * q
    const x = q[0] + (hx * q[3] + hy * q[2] - hz * q[1])
    const y = q[1] + (hy * q[3] + hz * q[0] - hx * q[2])
    const z = q[2] + (hz * q[3] + hx * q[1] - hy * q[0])
    const w = q[3] - (hx * q[0] + hy * q[1] + hz * q[2])
    const l = 1 / Math.sqrt(x * x + y * y + z * z + w * w)
    q[0] = x * l
    q[1] = y * l
    q[2] = z * l
    q[3] = w * l
  }

  state() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      vx: this.vx,
      vy: this.vy,
      vz: this.vz,
      grounded: this.grounded,
      held: this.held,
      speed: Math.hypot(this.vx, this.vy, this.vz),
      rollSpeed: this.rollSpeed,
      on: this.on,
      bounces: this.bounces,
      ticks: this.ticks,
    }
  }
}

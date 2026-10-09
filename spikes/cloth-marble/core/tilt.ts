// Plate tilt: a clamped target driven by input, followed by a damped spring
// (theta'' = k (target - theta) - c theta'), plus plate-space gravity.
//
// Convention: tilt (ax, ay) in radians means the plate slopes DOWN toward +x by
// ax and toward +y by ay. The plate rotation is R = Ry(ax) * Rx(-ay); in three.js
// that is object.rotation.set(-ay, ax, 0, 'YXZ'). Gravity in plate space is
// R^T (0, 0, -g).

export interface TiltParams {
  /** max |tilt| per axis, radians (5 degrees) */
  limit: number
  /** spring stiffness (1/s^2) */
  k: number
  /** damping (1/s) */
  c: number
  /** spring back to level when input is released */
  springBack: boolean
}

export const TILT_DEFAULTS: TiltParams = {
  limit: (5 * Math.PI) / 180,
  k: 120,
  c: 15.3,
  springBack: true,
}

export class Tilt {
  p: TiltParams
  ax = 0
  ay = 0
  vx = 0
  vy = 0
  /** angular acceleration magnitude last step (rad/s^2), for nudge detection */
  accel = 0
  tx = 0
  ty = 0
  held = false

  constructor(p: Partial<TiltParams> = {}) {
    this.p = { ...TILT_DEFAULTS, ...p }
  }

  /** Set the target tilt (radians); clamped to +-limit. */
  setTarget(ax: number, ay: number, held = true): void {
    const L = this.p.limit
    this.tx = Math.max(-L, Math.min(L, ax))
    this.ty = Math.max(-L, Math.min(L, ay))
    this.held = held
  }

  release(): void {
    this.held = false
    if (this.p.springBack) {
      this.tx = 0
      this.ty = 0
    }
  }

  /** Snap (tests/save states). */
  snap(ax: number, ay: number): void {
    this.setTarget(ax, ay, this.held)
    this.ax = this.tx
    this.ay = this.ty
    this.vx = this.vy = 0
  }

  step(dt: number): void {
    const { k, c } = this.p
    const accX = k * (this.tx - this.ax) - c * this.vx
    const accY = k * (this.ty - this.ay) - c * this.vy
    this.vx += accX * dt
    this.vy += accY * dt
    this.ax += this.vx * dt
    this.ay += this.vy * dt
    this.accel = Math.hypot(accX, accY)
  }

  /** Gravity in plate space for world gravity (0, 0, -g). */
  gravity(g: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    // R = Ry(ax) Rx(-ay); R^T (0,0,-g) = -g * (third row of R)
    // Ry(a) = [[ca,0,sa],[0,1,0],[-sa,0,ca]], Rx(b) = [[1,0,0],[0,cb,-sb],[0,sb,cb]], b = -ay
    const ca = Math.cos(this.ax)
    const sa = Math.sin(this.ax)
    const cb = Math.cos(-this.ay)
    const sb = Math.sin(-this.ay)
    // row 3 of Ry*Rx = [-sa, ca*sb, ca*cb]
    out[0] = -g * -sa
    out[1] = -g * (ca * sb)
    out[2] = -g * (ca * cb)
    return out
  }
}

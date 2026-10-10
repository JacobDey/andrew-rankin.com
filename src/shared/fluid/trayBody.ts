/**
 * TrayBody: the tray as a spring-damper you hold, release and auto-rock (darkroom.md section 5.3).
 *
 *   theta'' = k (theta_target - theta) - c theta'          k = 140 1/s^2, c = 9 1/s     (zeta ~ 0.38: one bounce)
 *   o''     = kt (o_target - o) - ct o'                    kt = 220, ct = 18, |o| <= 0.02 m
 *
 * `step()` returns the tray's lateral acceleration (o'') for TrayFluid.setAccel, and `landed` > 0 (the impact speed of
 * the tray's edge, m/s) on the first return through rest after a release.
 */

export interface TrayBodyOptions {
  /** Tilt spring (1/s^2), default 140. */
  k?: number
  /** Tilt damping (1/s), default 9. */
  c?: number
  /** Translation spring (1/s^2), default 220. */
  kt?: number
  /** Translation damping (1/s), default 18. */
  ct?: number
  /** Tilt limit (rad), default 10 degrees. */
  maxTiltRad?: number
  /** Offset limit (m), default 0.02. */
  maxOffset?: number
}

export interface AutoRockOptions {
  /** Default 6 degrees (rad). */
  ampX?: number
  /** Default 2.5 degrees (rad). */
  ampY?: number
  /** Hz, default 0.48. */
  fx?: number
  /** Hz, default 0.64. */
  fy?: number
  /** Added to both phases (rad), default 0. */
  phase?: number
}

const DEG = Math.PI / 180
/** Half the tray length (m): turns angular speed into the speed of the tray's edge for `landed`. */
const HALF_LENGTH = 0.2
const SUB = 1 / 240

export class TrayBody {
  tiltX = 0
  tiltY = 0
  offX = 0
  offY = 0

  private wx = 0
  private wy = 0
  private vx = 0
  private vy = 0
  private held = false
  private tX = 0
  private tY = 0
  private oX = 0
  private oY = 0
  private rocking = false
  private rockT = 0
  private rock: Required<AutoRockOptions> = { ampX: 6 * DEG, ampY: 2.5 * DEG, fx: 0.48, fy: 0.64, phase: 0 }
  private armed = false
  private readonly k: number
  private readonly c: number
  private readonly kt: number
  private readonly ct: number
  private readonly maxTilt: number
  private readonly maxOff: number

  constructor(o: TrayBodyOptions = {}) {
    this.k = o.k ?? 140
    this.c = o.c ?? 9
    this.kt = o.kt ?? 220
    this.ct = o.ct ?? 18
    this.maxTilt = o.maxTiltRad ?? 10 * DEG
    this.maxOff = o.maxOffset ?? 0.02
  }

  /** Hold the tray at a target tilt (rad) and offset (m). Call every frame while the hand is down. */
  hold(tiltX: number, tiltY: number, offX = 0, offY = 0): void {
    const m = Math.hypot(tiltX, tiltY)
    const s = m > this.maxTilt ? this.maxTilt / m : 1
    this.tX = tiltX * s
    this.tY = tiltY * s
    const om = Math.hypot(offX, offY)
    const os = om > this.maxOff ? this.maxOff / om : 1
    this.oX = offX * os
    this.oY = offY * os
    this.held = true
    this.armed = false
  }

  /** Let go: the targets return to zero; the first return through rest reports `landed`. */
  release(): void {
    if (!this.held) return
    this.held = false
    this.tX = 0
    this.tY = 0
    this.oX = 0
    this.oY = 0
    this.armed = Math.hypot(this.tiltX, this.tiltY) > 0.005
  }

  /** Slow periodic rocking (wins over rest, loses to hold). The clock restarts when it is switched on. */
  autoRock(on: boolean, o: AutoRockOptions = {}): void {
    if (on) {
      this.rock = { ...this.rock, ...o }
      if (!this.rocking) this.rockT = 0
    }
    this.rocking = on
  }

  get isRocking(): boolean {
    return this.rocking
  }
  get isHeld(): boolean {
    return this.held
  }

  step(dt: number): { ax: number; ay: number; landed: number } {
    let ax = 0
    let ay = 0
    let landed = 0
    const n = Math.max(1, Math.ceil(dt / SUB - 1e-9))
    const h = dt / n
    for (let q = 0; q < n; q++) {
      let tx = this.tX
      let ty = this.tY
      if (!this.held && this.rocking) {
        const r = this.rock
        tx = r.ampX * Math.sin(2 * Math.PI * r.fx * this.rockT + r.phase)
        ty = r.ampY * Math.sin(2 * Math.PI * r.fy * this.rockT + 1.1 + r.phase)
      }
      if (this.rocking) this.rockT += h
      const px = this.tiltX
      const py = this.tiltY
      this.wx += (this.k * (tx - this.tiltX) - this.c * this.wx) * h
      this.wy += (this.k * (ty - this.tiltY) - this.c * this.wy) * h
      this.tiltX += this.wx * h
      this.tiltY += this.wy * h
      const m = Math.hypot(this.tiltX, this.tiltY)
      if (m > this.maxTilt) {
        const s = this.maxTilt / m
        this.tiltX *= s
        this.tiltY *= s
      }
      // lateral offset
      ax = this.kt * (this.oX - this.offX) - this.ct * this.vx
      ay = this.kt * (this.oY - this.offY) - this.ct * this.vy
      this.vx += ax * h
      this.vy += ay * h
      this.offX += this.vx * h
      this.offY += this.vy * h
      const om = Math.hypot(this.offX, this.offY)
      if (om > this.maxOff) {
        const s = this.maxOff / om
        this.offX *= s
        this.offY *= s
      }
      // first return through rest after a release
      if (this.armed && px * this.tiltX + py * this.tiltY <= 0 && Math.hypot(px, py) > 1e-6) {
        landed = Math.max(landed, Math.hypot(this.wx, this.wy) * HALF_LENGTH)
        this.armed = false
      }
    }
    return { ax, ay, landed }
  }
}

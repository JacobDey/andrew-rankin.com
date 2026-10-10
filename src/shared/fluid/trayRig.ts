/**
 * The tray as a rigid body you lift by an edge and let drop.
 *
 * Tilt is a 2-vector (ax, ay) in radians. Positive ax lowers the +x side (liquid runs toward +x), positive ay
 * lowers the +y side (far side). While HELD, a spring-damper pulls the tilt toward the hand's target, so the
 * tray has weight and lag. When RELEASED, the lifted edge falls under a constant gravity torque and hits the
 * bench (tilt = 0) with a small restitution bounce, which is what makes the "drop it and watch it slosh" move.
 *
 * The tray can also slide a little on the bench (jolt). Its translational acceleration is fed back to the
 * liquid as a fictitious force.
 *
 * Pure TypeScript, no DOM.
 */

export interface TrayRigOptions {
  /** Hard tilt limit (rad). */
  maxTilt?: number
  /** Held spring stiffness (1/s^2) and damping (1/s). */
  holdStiffness?: number
  holdDamping?: number
  /** Angular acceleration (rad/s^2) of a released, lifted tray falling back to the bench. */
  fallAccel?: number
  /** Bounce restitution on hitting the bench. */
  restitution?: number
  /** Slide spring (1/s^2) and damping (1/s) for jolts. */
  slideStiffness?: number
  slideDamping?: number
  /** Tray length used to convert angular impact speed to edge speed (m), for clunk volume. */
  length?: number
}

export interface TrayGravity {
  gx: number
  gy: number
  gz: number
}

export interface Clunk {
  /** Edge speed at impact (m/s). */
  speed: number
}

export class TrayRig {
  ax = 0
  ay = 0
  wx = 0
  wy = 0
  /** Slide offset (m) and velocity (m/s) in tray x/y. */
  px = 0
  py = 0
  vx = 0
  vy = 0
  /** Last translational acceleration (m/s^2). */
  accX = 0
  accY = 0

  held = false
  targetX = 0
  targetY = 0

  maxTilt: number
  holdStiffness: number
  holdDamping: number
  fallAccel: number
  restitution: number
  slideStiffness: number
  slideDamping: number
  length: number

  /** Impacts with the bench since last drain (call takeClunks()). */
  private clunks: Clunk[] = []

  constructor(o: TrayRigOptions = {}) {
    this.maxTilt = o.maxTilt ?? 0.6
    this.holdStiffness = o.holdStiffness ?? 220
    this.holdDamping = o.holdDamping ?? 24
    this.fallAccel = o.fallAccel ?? 26
    this.restitution = o.restitution ?? 0.28
    this.slideStiffness = o.slideStiffness ?? 380
    this.slideDamping = o.slideDamping ?? 16
    this.length = o.length ?? 0.36
  }

  /** Hold the tray at a target tilt (rad). Call every frame while dragging. */
  hold(x: number, y: number): void {
    const m = Math.hypot(x, y)
    const k = m > this.maxTilt ? this.maxTilt / m : 1
    this.targetX = x * k
    this.targetY = y * k
    this.held = true
  }

  /** Let go: the lifted edge falls back onto the bench. */
  release(): void {
    this.held = false
  }

  /** Set tilt directly (e.g. device-orientation mode). Zeroes angular velocity. */
  setTilt(x: number, y: number): void {
    this.ax = x
    this.ay = y
    this.wx = 0
    this.wy = 0
  }

  /** Shove the tray along the bench: adds slide velocity (m/s). */
  jolt(vx: number, vy: number): void {
    this.vx += vx
    this.vy += vy
  }

  takeClunks(): Clunk[] {
    const c = this.clunks
    this.clunks = []
    return c
  }

  step(dt: number): void {
    if (this.held) {
      const ax = this.holdStiffness * (this.targetX - this.ax) - this.holdDamping * this.wx
      const ay = this.holdStiffness * (this.targetY - this.ay) - this.holdDamping * this.wy
      this.wx += ax * dt
      this.wy += ay * dt
      this.ax += this.wx * dt
      this.ay += this.wy * dt
    } else {
      const r = Math.hypot(this.ax, this.ay)
      if (r > 1e-7 || Math.hypot(this.wx, this.wy) > 1e-6) {
        const ox = this.ax
        const oy = this.ay
        if (r > 1e-7) {
          // constant gravity torque toward flat, plus a little air/hinge damping
          this.wx += (-this.fallAccel * (this.ax / r) - 1.5 * this.wx) * dt
          this.wy += (-this.fallAccel * (this.ay / r) - 1.5 * this.wy) * dt
        }
        this.ax += this.wx * dt
        this.ay += this.wy * dt
        // crossed (or reached) flat while moving toward it -> hit the bench
        const dot = ox * this.ax + oy * this.ay
        const inward = ox * this.wx + oy * this.wy < 0
        if (r > 1e-7 && inward && (dot <= 0 || Math.hypot(this.ax, this.ay) < 1e-5)) {
          const w = Math.hypot(this.wx, this.wy)
          this.clunks.push({ speed: w * this.length * 0.5 })
          this.ax = 0
          this.ay = 0
          if (w * this.restitution < 0.08) {
            this.wx = 0
            this.wy = 0
          } else {
            this.wx *= -this.restitution
            this.wy *= -this.restitution
          }
        }
      }
    }
    // hard limit
    const r = Math.hypot(this.ax, this.ay)
    if (r > this.maxTilt) {
      this.ax *= this.maxTilt / r
      this.ay *= this.maxTilt / r
      const rad = (this.wx * this.ax + this.wy * this.ay) / (this.maxTilt || 1)
      if (rad > 0) {
        this.wx -= (rad * this.ax) / this.maxTilt
        this.wy -= (rad * this.ay) / this.maxTilt
      }
    }
    // slide spring
    const sx = -this.slideStiffness * this.px - this.slideDamping * this.vx
    const sy = -this.slideStiffness * this.py - this.slideDamping * this.vy
    this.vx += sx * dt
    this.vy += sy * dt
    this.px += this.vx * dt
    this.py += this.vy * dt
    this.accX = sx
    this.accY = sy
  }

  /**
   * Effective gravity in the tray frame, including the fictitious force from sliding.
   * g_tray = R^T (0,0,-g) with R = Rx(-ay) * Ry(ax)  ->  (g sin ax cos ay, g sin ay, -g cos ax cos ay).
   * Returned gz is the positive normal magnitude.
   */
  gravity(g = 9.81): TrayGravity {
    const sx = Math.sin(this.ax)
    const cx = Math.cos(this.ax)
    const sy = Math.sin(this.ay)
    const cy = Math.cos(this.ay)
    return {
      gx: g * sx * cy - this.accX,
      gy: g * sy - this.accY,
      gz: g * cx * cy,
    }
  }

  snapshot(): number[] {
    return [this.ax, this.ay, this.wx, this.wy, this.px, this.py, this.vx, this.vy, this.held ? 1 : 0, this.targetX, this.targetY]
  }

  restore(a: number[]): void {
    ;[this.ax, this.ay, this.wx, this.wy, this.px, this.py, this.vx, this.vy] = a
    this.held = a[8] === 1
    this.targetX = a[9]
    this.targetY = a[10]
  }
}

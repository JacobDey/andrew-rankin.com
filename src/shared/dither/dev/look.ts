import * as THREE from 'three'

/**
 * Station camera (plates-toy.md: fixed station views, dolly between them, look around
 * from each). Drag / touch-drag looks around with 1:1 finger tracking and inertia;
 * keys 1-4 and arrows work too.
 *
 * (The sphere-dither anchor is handled by core/anchor.ts AnchorTracker, not here.)
 */
export interface Station {
  name: string
  pos: [number, number, number]
  target: [number, number, number]
  fov: number
}

export const STATIONS: Station[] = [
  { name: 'Cabin', pos: [0.55, 1.52, 1.35], target: [-0.35, 1.0, -1.4], fov: 62 },
  { name: 'Tray', pos: [-1.02, 1.36, -0.42], target: [-1.43, 0.9, -0.61], fov: 50 },
  { name: 'Camera', pos: [-0.3, 1.42, -1.75], target: [0.42, 1.2, -0.7], fov: 52 },
  { name: 'Plates', pos: [0.55, 1.32, -1.25], target: [1.3, 1.0, -2.25], fov: 50 },
  { name: 'Loupe', pos: [-1.395, 1.17, -0.6], target: [-1.44, 0.9, -0.6], fov: 50 },
]

const baseAngles = (s: Station) => {
  const d = new THREE.Vector3(s.target[0] - s.pos[0], s.target[1] - s.pos[1], s.target[2] - s.pos[2]).normalize()
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class LookRig {
  readonly camera: THREE.PerspectiveCamera
  station = 0
  /** Look offsets from the station base (radians). */
  yaw = 0
  pitch = 0
  roll = 0
  private vyaw = 0
  private vpitch = 0
  private vroll = 0
  private dragging = false
  private lastX = 0
  private lastY = 0
  private lastT = 0
  private move: { t: number; dur: number; fromPos: THREE.Vector3; fromYaw: number; fromPitch: number; fromFov: number; fromOffYaw: number; fromOffPitch: number } | null = null
  private base = { yaw: 0, pitch: 0 }
  private pos = new THREE.Vector3()
  private fov = 60
  private euler = new THREE.Euler(0, 0, 0, 'YXZ')
  limits = { yaw: 0.65, pitch: 0.42 }
  /** Viewport aspect; in portrait the vertical FOV widens to keep ~55% of the landscape
   *  horizontal coverage (capped at 80 deg). */
  aspect = 1.6
  onChange: (() => void) | null = null

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera
    this.setStation(0, true)
    dom.style.touchAction = 'none'
    dom.addEventListener('pointerdown', (e) => {
      this.dragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.lastT = performance.now()
      this.vyaw = this.vpitch = 0
      dom.setPointerCapture(e.pointerId)
    })
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging) return
      const k = THREE.MathUtils.degToRad(this.camera.fov) / Math.max(1, dom.clientHeight)
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      const now = performance.now()
      const dt = Math.max(1, now - this.lastT) / 1000
      this.yaw += dx * k
      this.pitch += dy * k
      this.vyaw = (dx * k) / dt
      this.vpitch = (dy * k) / dt
      this.lastX = e.clientX
      this.lastY = e.clientY
      this.lastT = now
      this.clamp()
    })
    const end = (e: PointerEvent) => {
      this.dragging = false
      if (performance.now() - this.lastT > 80) this.vyaw = this.vpitch = 0
      try { dom.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    }
    dom.addEventListener('pointerup', end)
    dom.addEventListener('pointercancel', end)
  }

  get moving(): boolean { return this.move !== null }

  setStation(i: number, instant = false): void {
    const s = STATIONS[((i % STATIONS.length) + STATIONS.length) % STATIONS.length]
    const target = baseAngles(s)
    if (instant) {
      this.station = STATIONS.indexOf(s)
      this.base = target
      this.pos.set(...s.pos)
      this.fov = s.fov
      this.yaw = this.pitch = 0
      this.move = null
      this.apply()
      return
    }
    this.move = {
      t: 0,
      dur: 0.7,
      fromPos: this.pos.clone(),
      fromYaw: this.base.yaw,
      fromPitch: this.base.pitch,
      fromFov: this.fov,
      fromOffYaw: this.yaw,
      fromOffPitch: this.pitch,
    }
    this.station = STATIONS.indexOf(s)
  }

  /** Storm hit: roll impulse (rad/s). */
  kick(rollVel: number): void { this.vroll += rollVel }

  update(dt: number): void {
    if (this.move) {
      const m = this.move
      m.t = Math.min(1, m.t + dt / m.dur)
      const k = ease(m.t)
      const s = STATIONS[this.station]
      const to = baseAngles(s)
      let dyaw = to.yaw - m.fromYaw
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw))
      this.base = { yaw: m.fromYaw + dyaw * k, pitch: m.fromPitch + (to.pitch - m.fromPitch) * k }
      this.pos.lerpVectors(m.fromPos, new THREE.Vector3(...s.pos), k)
      this.fov = m.fromFov + (s.fov - m.fromFov) * k
      this.yaw = m.fromOffYaw * (1 - k)
      this.pitch = m.fromOffPitch * (1 - k)
      if (m.t >= 1) { this.move = null; this.base = to }
    } else if (!this.dragging) {
      const f = Math.exp(-6 * dt)
      this.yaw += this.vyaw * dt
      this.pitch += this.vpitch * dt
      this.vyaw *= f
      this.vpitch *= f
      this.clamp()
    }
    // Damped roll spring (storm).
    this.vroll += (-30 * this.roll - 2.2 * this.vroll) * dt
    this.roll += this.vroll * dt
    this.apply()
  }

  /** Set look offsets directly (degrees). */
  look(yawDeg: number, pitchDeg: number): void {
    this.yaw = THREE.MathUtils.degToRad(yawDeg)
    this.pitch = THREE.MathUtils.degToRad(pitchDeg)
    this.vyaw = this.vpitch = 0
    this.apply()
  }

  /** Free walk on the floor plane relative to the current heading (m). */
  walk(forward: number, strafe: number): void {
    const yaw = this.base.yaw + this.yaw
    this.pos.x += -Math.sin(yaw) * forward + Math.cos(yaw) * strafe
    this.pos.z += -Math.cos(yaw) * forward - Math.sin(yaw) * strafe
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -1.6, 1.6)
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -2.6, 1.6)
    this.apply()
  }

  apply(): void {
    this.camera.position.copy(this.pos)
    this.euler.set(this.base.pitch + this.pitch, this.base.yaw + this.yaw, this.roll, 'YXZ')
    this.camera.quaternion.setFromEuler(this.euler)
    const fov = this.effectiveFov()
    if (this.camera.fov !== fov) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    this.camera.updateMatrixWorld()
    this.onChange?.()
  }

  effectiveFov(): number {
    if (this.aspect >= 1) return this.fov
    const t = Math.tan(THREE.MathUtils.degToRad(this.fov) / 2)
    const h = 2 * Math.atan(1.6 * t)
    const v = 2 * Math.atan(Math.tan((0.55 * h) / 2) / this.aspect)
    return Math.min(80, Math.max(this.fov, THREE.MathUtils.radToDeg(v)))
  }

  private clamp(): void {
    this.yaw = THREE.MathUtils.clamp(this.yaw, -this.limits.yaw, this.limits.yaw)
    this.pitch = THREE.MathUtils.clamp(this.pitch, -this.limits.pitch, this.limits.pitch)
  }
}

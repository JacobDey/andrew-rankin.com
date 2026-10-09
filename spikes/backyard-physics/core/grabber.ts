/**
 * Grabber: raycast pick-up, carry and throw for any PhysicsWorld body.
 *
 * Two drive modes, switchable at runtime:
 *  - 'spring' (default): a capped, mass-aware spring-damper applied as an impulse at the grab
 *    point every fixed step. Uses the body's effective-mass matrix at that point, so a domino
 *    grabbed by its corner tracks as well as a ball grabbed at its centre, and the force cap
 *    (base + lift * m * g) makes heavy things lag and droop. Optional orientation spring
 *    ("hold pose") keeps a camera prop level and facing where you look.
 *  - 'joint': a kinematic hand body tied to the prop with Rapier's built-in spring joint.
 *    Fewer lines, solved inside the constraint solver, but no force cap and no hold pose.
 *
 * Input-agnostic: feed it rays (origin + direction) from a mouse, a touch or the screen centre.
 */
import type { ImpulseJoint, RigidBody } from '@dimforge/rapier3d-compat'
import { Quaternion, Vector3 } from 'three'
import { Layer, type BodyBinding, type PhysicsWorld } from './physics-world'

export type GrabMode = 'spring' | 'joint'

export interface GrabberOptions {
  mode?: GrabMode
  /** Linear spring stiffness k in s^-2 (acceleration per metre of error). Default 400. */
  stiffness?: number
  /** Damping ratio zeta; c = 2 * zeta * sqrt(k). Default 0.75. */
  dampingRatio?: number
  /** Force cap = maxForceBase + liftFactor * m * g. Defaults 25 N and 2. */
  maxForceBase?: number
  liftFactor?: number
  /** Furthest grab, metres from the ray origin. Default 4.5. */
  reach?: number
  /** Clamp for the hold distance while carrying. Defaults 0.5 .. 4. */
  minHold?: number
  maxHold?: number
  /** Release speed cap (m/s). Default 12. */
  throwSpeedCap?: number
  /** Angular damping applied while held (restored on release). Default 3. */
  heldAngularDamping?: number
  /** Extra filter on what can be grabbed. */
  canGrab?: (b: BodyBinding) => boolean
  /**
   * Collision layers the held prop stops touching while held (default Layer.PLAYER), so a
   * camera held at the eye isn't shoved around by the player's own capsule.
   */
  heldIgnores?: number
}

export interface HoldPose {
  /** World orientation the prop should turn towards; mutate it every frame. */
  orientation: Quaternion
  /** Angular stiffness (s^-2) and damping (s^-1). Defaults 120 and 18. */
  stiffness?: number
  damping?: number
}

export interface HeldState {
  binding: BodyBinding
  /** Grab point in the body's local frame. */
  localAnchor: Vector3
  /** Distance from the ray origin to the hand. */
  distance: number
  /** Where the hand is, world space. */
  target: Vector3
  /** Mass at grab time (kg). */
  mass: number
  /** True when the force cap clipped the last step: the prop is "too heavy" right now. */
  straining: boolean
  pose: HoldPose | null
}

const G = 9.81
const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()
const _q = new Quaternion()
const _q2 = new Quaternion()

export class Grabber {
  mode: GrabMode
  readonly opts: Required<Omit<GrabberOptions, 'canGrab' | 'mode'>> & { canGrab?: (b: BodyBinding) => boolean }
  private savedGroups: number[] = []
  held: HeldState | null = null

  private pw: PhysicsWorld
  private unhook: () => void
  private rayOrigin = new Vector3()
  private rayDir = new Vector3(0, 0, -1)
  private handVel = new Vector3()
  private lastTarget = new Vector3()
  private hasLastTarget = false
  private savedAngDamping = 0
  private handBody: RigidBody | null = null
  private joint: ImpulseJoint | null = null
  /** Optional absolute hand position (overrides ray * distance), e.g. a camera held at the hip. */
  private handOverride: Vector3 | null = null

  constructor(pw: PhysicsWorld, opts: GrabberOptions = {}) {
    this.pw = pw
    this.mode = opts.mode ?? 'spring'
    this.opts = {
      stiffness: opts.stiffness ?? 400,
      dampingRatio: opts.dampingRatio ?? 0.75,
      maxForceBase: opts.maxForceBase ?? 25,
      liftFactor: opts.liftFactor ?? 2,
      reach: opts.reach ?? 4.5,
      minHold: opts.minHold ?? 0.5,
      maxHold: opts.maxHold ?? 4,
      throwSpeedCap: opts.throwSpeedCap ?? 12,
      heldAngularDamping: opts.heldAngularDamping ?? 3,
      heldIgnores: opts.heldIgnores ?? Layer.PLAYER,
      canGrab: opts.canGrab,
    }
    this.unhook = pw.onBeforeStep((dt) => this.fixedStep(dt), 'grabber')
    pw.onRestore((next) => {
      // The old World is gone: forget (don't remove) the joint-mode hand, then clean up any
      // copy of it the snapshot may have captured.
      const hbHandle = this.handBody?.handle
      this.joint = null
      this.handBody = null
      this.held = null
      this.handOverride = null
      if (hbHandle !== undefined) {
        const hb = next.getRigidBody(hbHandle)
        if (hb) next.removeRigidBody(hb)
      }
    })
  }

  get heldBody(): RigidBody | null {
    return this.held ? this.held.binding.body : null
  }

  /** Is there something grabbable along this ray? (for hover cursors) */
  probe(origin: Vector3, dir: Vector3, excludeBody?: RigidBody | null): BodyBinding | null {
    const hit = this.pw.raycast(origin, dir, this.opts.reach, { excludeBody })
    if (!hit || !hit.binding) return null
    return this.isGrabbable(hit.binding) ? hit.binding : null
  }

  isGrabbable(b: BodyBinding): boolean {
    if (!b.grabbable || !b.body.isDynamic()) return false
    return this.opts.canGrab ? this.opts.canGrab(b) : true
  }

  /** Raycast and grab whatever grabbable thing is hit. Returns it, or null. */
  grab(origin: Vector3, dir: Vector3, excludeBody?: RigidBody | null): BodyBinding | null {
    const hit = this.pw.raycast(origin, dir, this.opts.reach, { excludeBody })
    if (!hit || !hit.binding || !this.isGrabbable(hit.binding)) return null
    this.rayOrigin.copy(origin)
    this.rayDir.copy(dir).normalize()
    this.grabBinding(hit.binding, hit.point, hit.distance)
    return hit.binding
  }

  /**
   * Grab a specific binding at a world point (or at its centre of mass when omitted),
   * holding it `distance` metres along the current ray.
   */
  grabBinding(b: BodyBinding, worldPoint?: Vector3, distance?: number, pose?: HoldPose | null): void {
    if (this.held) this.release(false)
    const body = b.body
    body.wakeUp()
    const t = body.translation()
    const r = body.rotation()
    _q.set(r.x, r.y, r.z, r.w).invert()
    let local: Vector3
    if (worldPoint) {
      local = worldPoint.clone().sub(_a.set(t.x, t.y, t.z)).applyQuaternion(_q)
    } else {
      const com = body.localCom()
      local = new Vector3(com.x, com.y, com.z)
    }
    const d = distance ?? (worldPoint ? worldPoint.distanceTo(this.rayOrigin) : 1.5)
    const target = worldPoint ? worldPoint.clone() : new Vector3(t.x, t.y, t.z)
    this.held = {
      binding: b,
      localAnchor: local,
      distance: Math.min(Math.max(d, this.opts.minHold), this.opts.maxHold),
      target,
      mass: body.mass(),
      straining: false,
      pose: pose ?? null,
    }
    this.handVel.set(0, 0, 0)
    this.lastTarget.copy(target)
    this.hasLastTarget = true
    this.savedAngDamping = body.angularDamping()
    body.setAngularDamping(this.opts.heldAngularDamping)
    this.savedGroups.length = 0
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i)
      const g = c.collisionGroups()
      this.savedGroups.push(g)
      // Keep membership (+HELD), drop the ignored layers from the filter.
      const mem = ((g >>> 16) | Layer.HELD) & 0xffff
      const filt = g & 0xffff & ~this.opts.heldIgnores
      c.setCollisionGroups(((mem << 16) | filt) >>> 0)
    }
    if (this.mode === 'joint') this.createJoint()
  }

  /** Update the pointer ray every frame (call before PhysicsWorld.update). */
  aim(origin: Vector3, dir: Vector3, frameDt: number): void {
    this.rayOrigin.copy(origin)
    this.rayDir.copy(dir).normalize()
    const h = this.held
    if (!h) return
    if (this.handOverride) h.target.copy(this.handOverride)
    else h.target.copy(origin).addScaledVector(this.rayDir, h.distance)
    // Keep the hand above the lawn so props don't get shoved through the ground.
    if (h.target.y < 0.05) h.target.y = 0.05
    if (this.hasLastTarget && frameDt > 0) {
      _a.copy(h.target).sub(this.lastTarget).divideScalar(frameDt)
      // Smooth: pointer events are bursty, especially on touch.
      this.handVel.lerp(_a, Math.min(1, frameDt * 20))
    }
    this.lastTarget.copy(h.target)
    this.hasLastTarget = true
  }

  /** Pin the hand to an absolute point instead of the ray (null to go back to the ray). */
  setHandOverride(p: Vector3 | null): void {
    this.handOverride = p ? p.clone() : null
  }

  setHoldDistance(d: number): void {
    if (this.held) this.held.distance = Math.min(Math.max(d, this.opts.minHold), this.opts.maxHold)
  }

  nudgeHoldDistance(dd: number): void {
    if (this.held) this.setHoldDistance(this.held.distance + dd)
  }

  setPose(pose: HoldPose | null): void {
    if (this.held) this.held.pose = pose
  }

  /** Let go. With `fling` (default) the prop keeps its velocity, capped at throwSpeedCap. */
  release(fling = true): BodyBinding | null {
    const h = this.held
    if (!h) return null
    this.destroyJoint()
    const body = h.binding.body
    if (body.isValid()) {
      body.setAngularDamping(this.savedAngDamping)
      for (let i = 0; i < body.numColliders() && i < this.savedGroups.length; i++) body.collider(i).setCollisionGroups(this.savedGroups[i])
      const v = body.linvel()
      _a.set(v.x, v.y, v.z)
      if (!fling) _a.multiplyScalar(0.25)
      const s = _a.length()
      if (s > this.opts.throwSpeedCap) _a.multiplyScalar(this.opts.throwSpeedCap / s)
      body.setLinvel({ x: _a.x, y: _a.y, z: _a.z }, true)
      const w = body.angvel()
      // Spin inherits half the twist (studio-toy grab model).
      body.setAngvel({ x: w.x * 0.5, y: w.y * 0.5, z: w.z * 0.5 }, true)
    }
    this.held = null
    this.hasLastTarget = false
    this.handOverride = null
    return h.binding
  }

  /** Release and launch along `dir` at `speed` m/s (adds the hand's own motion). */
  throw(dir: Vector3, speed: number): BodyBinding | null {
    const h = this.held
    if (!h) return null
    const body = h.binding.body
    this.release(false)
    _a.copy(dir).normalize().multiplyScalar(Math.min(speed, this.opts.throwSpeedCap)).add(this.handVel)
    body.setLinvel({ x: _a.x, y: _a.y, z: _a.z }, true)
    return h.binding
  }

  dispose(): void {
    this.release(false)
    this.unhook()
  }

  // ------------------------------------------------------------------ internals

  private fixedStep(dt: number): void {
    const h = this.held
    if (!h) return
    const body = h.binding.body
    if (!body.isValid()) {
      this.held = null
      return
    }
    if (this.mode === 'joint') {
      if (!this.joint) this.createJoint()
      this.handBody?.setNextKinematicTranslation({ x: h.target.x, y: h.target.y, z: h.target.z })
      return
    }
    if (this.joint) this.destroyJoint()
    this.springStep(h, body, dt)
    if (h.pose) this.poseStep(h.pose, body, dt)
  }

  private springStep(h: HeldState, body: RigidBody, dt: number): void {
    const k = this.opts.stiffness
    const c = 2 * this.opts.dampingRatio * Math.sqrt(k)
    const t = body.translation()
    const r = body.rotation()
    _q.set(r.x, r.y, r.z, r.w)
    // World anchor and lever arm from the centre of mass.
    const anchor = _a.copy(h.localAnchor).applyQuaternion(_q).add(_b.set(t.x, t.y, t.z))
    const com = body.worldCom()
    const rx = anchor.x - com.x
    const ry = anchor.y - com.y
    const rz = anchor.z - com.z
    const va = body.velocityAtPoint({ x: anchor.x, y: anchor.y, z: anchor.z })
    // Desired change in anchor velocity this step.
    const dvx = (k * (h.target.x - anchor.x) + c * (this.handVel.x - va.x)) * dt
    const dvy = (k * (h.target.y - anchor.y) + c * (this.handVel.y - va.y)) * dt
    const dvz = (k * (h.target.z - anchor.z) + c * (this.handVel.z - va.z)) * dt
    // Point effective-mass matrix K = I/m - [r]x Iinv [r]x  (symmetric 3x3).
    const im = body.invMass()
    const Ii = body.effectiveWorldInvInertia()
    const a11 = Ii.m11, a12 = Ii.m12, a13 = Ii.m13, a22 = Ii.m22, a23 = Ii.m23, a33 = Ii.m33
    // M = Iinv * [r]x ; [r]x = [[0,-rz,ry],[rz,0,-rx],[-ry,rx,0]]
    const m12 = -a11 * rz + a13 * rx, m13 = a11 * ry - a12 * rx
    const m21 = a22 * rz - a23 * ry, m22 = -a12 * rz + a23 * rx, m23 = a12 * ry - a22 * rx
    const m31 = a23 * rz - a33 * ry, m32 = -a13 * rz + a33 * rx, m33 = a13 * ry - a23 * rx
    // [r]x * M
    const k11 = im - (-rz * m21 + ry * m31)
    const k12 = -(-rz * m22 + ry * m32)
    const k13 = -(-rz * m23 + ry * m33)
    const k22 = im - (rz * m12 - rx * m32)
    const k23 = -(rz * m13 - rx * m33)
    const k33 = im - (-ry * m13 + rx * m23)
    // Solve K j = dv (Cramer, K symmetric).
    const c11 = k22 * k33 - k23 * k23
    const c12 = k13 * k23 - k12 * k33
    const c13 = k12 * k23 - k13 * k22
    const det = k11 * c11 + k12 * c12 + k13 * c13
    let jx: number, jy: number, jz: number
    if (Math.abs(det) < 1e-12) {
      const m = h.mass
      jx = dvx * m; jy = dvy * m; jz = dvz * m
    } else {
      const c22 = k11 * k33 - k13 * k13
      const c23 = k12 * k13 - k11 * k23
      const c33 = k11 * k22 - k12 * k12
      const inv = 1 / det
      jx = (c11 * dvx + c12 * dvy + c13 * dvz) * inv
      jy = (c12 * dvx + c22 * dvy + c23 * dvz) * inv
      jz = (c13 * dvx + c23 * dvy + c33 * dvz) * inv
    }
    // Cap: heavy things lag and droop, you feel the mass.
    const maxJ = (this.opts.maxForceBase + this.opts.liftFactor * h.mass * G) * dt
    const jl = Math.hypot(jx, jy, jz)
    h.straining = jl > maxJ
    if (h.straining) {
      const s = maxJ / jl
      jx *= s; jy *= s; jz *= s
    }
    body.applyImpulseAtPoint({ x: jx, y: jy, z: jz }, { x: anchor.x, y: anchor.y, z: anchor.z }, true)
  }

  private poseStep(pose: HoldPose, body: RigidBody, dt: number): void {
    const kr = pose.stiffness ?? 120
    const cr = pose.damping ?? 18
    const r = body.rotation()
    _q.set(r.x, r.y, r.z, r.w)
    // Error rotation that takes the body to the target: q_err = q_target * q^-1.
    _q2.copy(pose.orientation).multiply(_q.invert())
    if (_q2.w < 0) _q2.set(-_q2.x, -_q2.y, -_q2.z, -_q2.w)
    const s = Math.sqrt(Math.max(0, 1 - _q2.w * _q2.w))
    const angle = 2 * Math.acos(Math.min(1, _q2.w))
    if (s > 1e-6) _c.set(_q2.x / s, _q2.y / s, _q2.z / s).multiplyScalar(angle)
    else _c.set(0, 0, 0)
    const w = body.angvel()
    const dwx = (kr * _c.x - cr * w.x) * dt
    const dwy = (kr * _c.y - cr * w.y) * dt
    const dwz = (kr * _c.z - cr * w.z) * dt
    const I = body.effectiveAngularInertia()
    body.applyTorqueImpulse(
      {
        x: I.m11 * dwx + I.m12 * dwy + I.m13 * dwz,
        y: I.m12 * dwx + I.m22 * dwy + I.m23 * dwz,
        z: I.m13 * dwx + I.m23 * dwy + I.m33 * dwz,
      },
      true,
    )
  }

  private createJoint(): void {
    const h = this.held
    if (!h) return
    const R = this.pw.R
    const w = this.pw.world
    this.handBody = w.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(h.target.x, h.target.y, h.target.z),
    )
    const k = this.opts.stiffness * h.mass
    const c = 2 * this.opts.dampingRatio * Math.sqrt(this.opts.stiffness) * h.mass
    const data = R.JointData.spring(0, k, c, { x: 0, y: 0, z: 0 }, {
      x: h.localAnchor.x,
      y: h.localAnchor.y,
      z: h.localAnchor.z,
    })
    this.joint = w.createImpulseJoint(data, this.handBody, h.binding.body, true)
  }

  private destroyJoint(): void {
    const w = this.pw.world
    if (this.joint) {
      if (this.joint.isValid()) w.removeImpulseJoint(this.joint, true)
      this.joint = null
    }
    if (this.handBody) {
      if (this.handBody.isValid()) w.removeRigidBody(this.handBody)
      this.handBody = null
    }
  }
}

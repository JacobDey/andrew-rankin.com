/**
 * Player: a Rapier kinematic character controller (walk mode) plus an orbit rig (overview mode)
 * that drive a three.js PerspectiveCamera. Movement runs inside the fixed step, the camera
 * position is interpolated, and look (yaw/pitch) is applied per frame for zero-latency aim.
 */
import type { Collider, KinematicCharacterController, RigidBody } from '@dimforge/rapier3d-compat'
import { Euler, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { FrameInput } from './input'
import { Layer, groups, type PhysicsWorld } from './physics-world'

export type CameraMode = 'walk' | 'orbit'

export interface PlayerOptions {
  radius?: number
  /** Total standing height in metres (capsule + offsets). Default 1.75. */
  height?: number
  /** Eye height above the feet. Default 1.6. */
  eyeHeight?: number
  walkSpeed?: number
  runSpeed?: number
  jumpSpeed?: number
  /** Mass used when the controller shoves dynamic props. Default 70 kg. */
  mass?: number
  /** Called to decide whether a collider blocks the player (return false to walk through). */
  ignore?: (c: Collider) => boolean
}

const _v = new Vector3()
const _e = new Euler(0, 0, 0, 'YXZ')

export class Player {
  mode: CameraMode = 'walk'
  yaw = 0
  pitch = 0
  readonly opts: Required<Omit<PlayerOptions, 'ignore'>> & { ignore?: (c: Collider) => boolean }
  body!: RigidBody
  collider!: Collider
  controller!: KinematicCharacterController
  grounded = false
  /** Orbit rig state. */
  orbit = { target: new Vector3(0, 0.8, 0), distance: 16, yaw: 0.6, pitch: 0.55 }

  private pw: PhysicsWorld
  private vy = 0
  private wish = new Vector3()
  private wantJump = false
  private running = false
  private p0 = new Vector3()
  private p1 = new Vector3()
  private bodyHandle = -1
  private colliderHandle = -1

  constructor(pw: PhysicsWorld, spawn: Vector3, yaw = 0, opts: PlayerOptions = {}) {
    this.pw = pw
    this.opts = {
      radius: opts.radius ?? 0.3,
      height: opts.height ?? 1.75,
      eyeHeight: opts.eyeHeight ?? 1.6,
      walkSpeed: opts.walkSpeed ?? 2.6,
      runSpeed: opts.runSpeed ?? 5.2,
      jumpSpeed: opts.jumpSpeed ?? 4.4,
      mass: opts.mass ?? 70,
      ignore: opts.ignore,
    }
    this.yaw = yaw
    this.create(spawn)
    pw.onBeforeStep((dt) => this.fixedStep(dt), 'player')
    pw.onRestore((next) => {
      // Bodies survive a snapshot; the controller object doesn't.
      this.body = next.getRigidBody(this.bodyHandle)
      this.collider = next.getCollider(this.colliderHandle)
      this.controller = this.makeController()
    })
    pw.registerState('player', {
      save: () => ({ vy: this.vy, grounded: this.grounded, p: this.p1.toArray() }),
      load: (v) => {
        const st = v as { vy: number; grounded: boolean; p: [number, number, number] }
        this.vy = st.vy
        this.grounded = st.grounded
        this.p1.fromArray(st.p)
        this.p0.copy(this.p1)
      },
    })
  }

  private create(spawn: Vector3): void {
    const R = this.pw.R
    const o = this.opts
    const halfH = Math.max(0.05, (o.height - 2 * o.radius) / 2)
    const centreY = spawn.y + o.radius + halfH
    this.body = this.pw.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, centreY, spawn.z),
    )
    this.collider = this.pw.world.createCollider(
      R.ColliderDesc.capsule(halfH, o.radius)
        .setCollisionGroups(groups(Layer.PLAYER, Layer.ALL & ~Layer.ROPE))
        .setFriction(0),
      this.body,
    )
    this.bodyHandle = this.body.handle
    this.colliderHandle = this.collider.handle
    this.controller = this.makeController()
    this.p0.set(spawn.x, centreY, spawn.z)
    this.p1.copy(this.p0)
  }

  private makeController(): KinematicCharacterController {
    const c = this.pw.world.createCharacterController(0.02)
    c.setUp({ x: 0, y: 1, z: 0 })
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((35 * Math.PI) / 180)
    c.enableAutostep(0.22, 0.15, false)
    c.enableSnapToGround(0.25)
    c.setSlideEnabled(true)
    c.setApplyImpulsesToDynamicBodies(true)
    c.setCharacterMass(this.opts.mass)
    return c
  }

  /** Per-frame input. Look applies immediately; movement is consumed by the next fixed steps. */
  applyInput(inp: FrameInput): void {
    if (this.mode === 'walk') {
      this.yaw -= inp.lookYaw
      this.pitch = clamp(this.pitch - inp.lookPitch, -1.45, 1.45)
    } else {
      this.orbit.yaw -= inp.lookYaw
      this.orbit.pitch = clamp(this.orbit.pitch + inp.lookPitch, 0.05, 1.45)
    }
    // Wish direction in world space from yaw (walk) or orbit yaw (orbit pans the target).
    const yaw = this.mode === 'walk' ? this.yaw : this.orbit.yaw
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    this.wish.set(fx * inp.moveZ + rx * inp.moveX, 0, fz * inp.moveZ + rz * inp.moveX)
    this.running = inp.run
    if (inp.jump) this.wantJump = true
    if (this.mode === 'orbit') {
      // Pan the orbit target with WASD / joystick, scaled by distance.
      const s = 0.016 * (6 + this.orbit.distance * 0.5)
      this.orbit.target.addScaledVector(this.wish, s * (inp.run ? 2 : 1))
      this.wish.set(0, 0, 0)
    }
  }

  zoom(delta: number): void {
    this.orbit.distance = clamp(this.orbit.distance * Math.exp(-delta * 0.6), 2.5, 40)
  }

  setMode(m: CameraMode): void {
    if (m === this.mode) return
    if (m === 'orbit') {
      // Start the orbit looking at where we were looking.
      const t = this.body.translation()
      this.orbit.target.set(t.x, 0.8, t.z)
      this.orbit.yaw = this.yaw
      this.orbit.pitch = 0.6
      this.orbit.distance = 9
    }
    this.mode = m
  }

  teleport(x: number, y: number, z: number, yaw?: number, pitch?: number): void {
    const o = this.opts
    const halfH = Math.max(0.05, (o.height - 2 * o.radius) / 2)
    const cy = y + o.radius + halfH
    this.body.setTranslation({ x, y: cy, z }, true)
    this.body.setNextKinematicTranslation({ x, y: cy, z })
    this.p0.set(x, cy, z)
    this.p1.copy(this.p0)
    this.vy = 0
    if (yaw !== undefined) this.yaw = yaw
    if (pitch !== undefined) this.pitch = pitch
  }

  /** Feet position (interpolated). */
  feet(out: Vector3, alpha = this.pw.alpha): Vector3 {
    const o = this.opts
    const halfH = Math.max(0.05, (o.height - 2 * o.radius) / 2)
    return out.lerpVectors(this.p0, this.p1, alpha).setY(out.y - halfH - o.radius)
  }

  /** Write camera pose. Returns the camera for chaining. */
  applyToCamera(cam: PerspectiveCamera, alpha = this.pw.alpha): PerspectiveCamera {
    if (this.mode === 'walk') {
      this.feet(cam.position, alpha)
      cam.position.y += this.opts.eyeHeight
      _e.set(this.pitch, this.yaw, 0, 'YXZ')
      cam.quaternion.setFromEuler(_e)
    } else {
      const o = this.orbit
      const cp = Math.cos(o.pitch)
      cam.position.set(
        o.target.x + Math.sin(o.yaw) * cp * o.distance,
        o.target.y + Math.sin(o.pitch) * o.distance,
        o.target.z + Math.cos(o.yaw) * cp * o.distance,
      )
      cam.lookAt(o.target)
    }
    return cam
  }

  /** View quaternion (walk mode), handy for props held "in hand". */
  viewQuaternion(out: Quaternion): Quaternion {
    _e.set(this.pitch, this.yaw, 0, 'YXZ')
    return out.setFromEuler(_e)
  }

  private fixedStep(dt: number): void {
    this.p0.copy(this.p1)
    const g = this.pw.world.gravity.y
    if (this.mode !== 'walk') {
      this.wish.set(0, 0, 0)
    }
    if (this.grounded) {
      this.vy = Math.max(this.vy, -1)
      if (this.wantJump) {
        this.vy = this.opts.jumpSpeed
        this.grounded = false
      }
    }
    // Idle and standing: skip the shape casts (saves ~0.1-0.8 ms per step).
    if (this.grounded && !this.wantJump && this.wish.lengthSq() === 0 && this.vy <= 0) {
      this.vy = 0
      return
    }
    this.wantJump = false
    this.vy += g * dt
    const speed = this.running ? this.opts.runSpeed : this.opts.walkSpeed
    _v.copy(this.wish).multiplyScalar(speed * dt)
    _v.y = this.vy * dt
    const ignore = this.opts.ignore
    this.controller.computeColliderMovement(
      this.collider,
      { x: _v.x, y: _v.y, z: _v.z },
      undefined,
      groups(Layer.PLAYER, Layer.ALL & ~Layer.ROPE),
      ignore ? (c) => !ignore(c) : undefined,
    )
    const m = this.controller.computedMovement()
    this.grounded = this.controller.computedGrounded()
    if (this.grounded && this.vy < 0) this.vy = 0
    const t = this.body.translation()
    const nx = t.x + m.x
    const ny = t.y + m.y
    const nz = t.z + m.z
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz })
    this.p1.set(nx, ny, nz)
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

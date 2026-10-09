/**
 * PhysicsWorld: a thin, reusable wrapper around a Rapier 3D world for three.js scenes.
 *
 *  - Lazy-loads @dimforge/rapier3d-compat (wasm inlined as base64, so no bundler plugin is
 *    needed; Vite dev and `vite build` both work out of the box). Call `PhysicsWorld.create()`.
 *  - Fixed timestep (60 Hz default) with an accumulator, a sub-step cap (no spiral of death)
 *    and render interpolation between the last two physics states.
 *  - A binding registry that maps Rapier bodies to three.js Object3Ds, plus tags/userData,
 *    so raycasts return "the gnome", not "collider 17".
 *  - Hooks before/after every fixed step (grabbers, character controllers, wind, cloth...).
 *  - Snapshot/restore (Rapier's own serializer) that re-resolves all bindings, for replays.
 *
 * No DOM access. three.js is used only for the math types and the Object3D it drives.
 */
import type {
  Collider,
  ColliderDesc,
  RigidBody,
  RigidBodyDesc,
  World,
} from '@dimforge/rapier3d-compat'
import { Object3D, Quaternion, Vector3 } from 'three'

export type Rapier = typeof import('@dimforge/rapier3d-compat')

let rapierPromise: Promise<Rapier> | null = null

/** Loads and initialises Rapier once per page. Safe to call many times. */
export function loadRapier(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (m) => {
      // The compat build exposes the namespace both as named exports and as `default`.
      const R = ((m as unknown as { default?: Rapier }).default ?? m) as Rapier
      await R.init()
      return R
    })
  }
  return rapierPromise
}

/**
 * Collision layers. Rapier packs membership in the high 16 bits and the filter in the low 16.
 * Keep this list short and shared between games so props can move between scenes.
 */
export const Layer = {
  STATIC: 1 << 0, // ground, fence, house, tree trunk
  PROP: 1 << 1, // dynamic props you can grab
  PLAYER: 1 << 2, // the character capsule
  ROPE: 1 << 3, // rope links (don't collide with each other or with the tree)
  HELD: 1 << 4, // reserved: the currently held prop (if you want it to ignore the player)
  TRIGGER: 1 << 5, // sensors
  ALL: 0xffff,
} as const

export function groups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff)
}

export interface PhysicsWorldOptions {
  /** Gravity in m/s^2 (default [0, -9.81, 0]). */
  gravity?: [number, number, number]
  /** Fixed simulation rate in Hz (default 60). */
  hz?: number
  /** Max fixed steps per rendered frame before we drop time (default 4; use 2 on phones). */
  maxSubSteps?: number
  /** Rapier solver iterations (default 4). Ropes and stacks like more; phones like fewer. */
  solverIterations?: number
}

export interface BindOptions {
  /** Free-form name, e.g. 'ball', 'domino', 'gnome'. */
  tag?: string
  /** Can the Grabber pick it up? (default: true for dynamic bodies) */
  grabbable?: boolean
  /** Arbitrary payload for game code. */
  data?: Record<string, unknown>
}

/** One Rapier body driving one three.js object, with two physics states for interpolation. */
export interface BodyBinding {
  readonly id: number
  body: RigidBody
  /** Rapier handle; stable across snapshot/restore. */
  handle: number
  object: Object3D | null
  tag: string
  grabbable: boolean
  data: Record<string, unknown>
  /** Previous and current physics poses (world space). */
  p0: Vector3
  q0: Quaternion
  p1: Vector3
  q1: Quaternion
  /** True once we have collapsed p0 onto p1 for a sleeping body. */
  settled: boolean
}

export interface RayHit {
  body: RigidBody
  collider: Collider
  binding: BodyBinding | null
  point: Vector3
  normal: Vector3
  distance: number
}

export interface RaycastOptions {
  /** Bodies to ignore (e.g. the player, the held prop). */
  excludeBody?: RigidBody | null
  /** Interaction groups filter (see `groups()`). */
  groups?: number
  /** Extra predicate on colliders. Return false to skip. */
  predicate?: (c: Collider) => boolean
  /** Treat shapes as solid (a ray starting inside hits at t=0). Default true. */
  solid?: boolean
}

export interface PhysicsStats {
  steps: number
  simTime: number
  bodies: number
  dynamic: number
  awake: number
  colliders: number
  impulseJoints: number
  multibodyJoints: number
  /** Exponential moving average of world.step() wall time, ms. */
  stepMs: number
  /** Same, including the before/after hooks (grabber, cloth, player...). */
  stepTotalMs: number
  /** Steps executed during the last update(). */
  lastSubSteps: number
  /** Simulated seconds dropped because maxSubSteps was hit (accumulated). */
  droppedTime: number
}

type StepHook = (dt: number) => void
interface TimedHook {
  fn: StepHook
  label: string
  ms: number
}

export interface StateProvider {
  save(): unknown
  load(v: unknown): void
}

export interface WorldSnapshot {
  data: Uint8Array
  simTime: number
  steps: number
  extras: Record<string, unknown>
}

const _v = new Vector3()

export class PhysicsWorld {
  readonly R: Rapier
  world: World
  readonly dt: number
  readonly hz: number
  maxSubSteps: number

  /** Interpolation factor applied by the last update() (0..1). */
  alpha = 0
  /** Simulated seconds since creation. */
  simTime = 0
  steps = 0
  paused = false
  /** Slow motion / fast forward. The step size never changes, only how many steps run. */
  timeScale = 1

  private accumulator = 0
  private bindings: BodyBinding[] = []
  private byHandle = new Map<number, BodyBinding>()
  private nextId = 1
  private before: TimedHook[] = []
  private after: TimedHook[] = []
  private stepMsEma = 0
  private stepTotalMsEma = 0
  private lastSubSteps = 0
  private droppedTime = 0

  private constructor(R: Rapier, opts: PhysicsWorldOptions) {
    this.R = R
    const g = opts.gravity ?? [0, -9.81, 0]
    this.world = new R.World({ x: g[0], y: g[1], z: g[2] })
    this.hz = opts.hz ?? 60
    this.dt = 1 / this.hz
    this.world.timestep = this.dt
    this.world.numSolverIterations = opts.solverIterations ?? 4
    this.maxSubSteps = opts.maxSubSteps ?? 4
  }

  static async create(opts: PhysicsWorldOptions = {}): Promise<PhysicsWorld> {
    const R = await loadRapier()
    return new PhysicsWorld(R, opts)
  }

  // ---------------------------------------------------------------- creation helpers

  /**
   * Creates a body with its colliders and (optionally) binds it to a three.js object.
   * The object's current world pose is NOT read; the body desc decides the pose.
   */
  add(
    desc: RigidBodyDesc,
    colliders: ColliderDesc[],
    object?: Object3D | null,
    opts: BindOptions = {},
  ): BodyBinding {
    const body = this.world.createRigidBody(desc)
    for (const c of colliders) this.world.createCollider(c, body)
    return this.bind(body, object ?? null, opts)
  }

  /** Static geometry with no visual binding (ground, walls). Returns the body. */
  addStatic(colliders: ColliderDesc[], x = 0, y = 0, z = 0, q?: Quaternion): RigidBody {
    const d = this.R.RigidBodyDesc.fixed().setTranslation(x, y, z)
    if (q) d.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    const body = this.world.createRigidBody(d)
    for (const c of colliders) this.world.createCollider(c, body)
    return body
  }

  bind(body: RigidBody, object: Object3D | null, opts: BindOptions = {}): BodyBinding {
    const t = body.translation()
    const r = body.rotation()
    const b: BodyBinding = {
      id: this.nextId++,
      body,
      handle: body.handle,
      object,
      tag: opts.tag ?? '',
      grabbable: opts.grabbable ?? body.isDynamic(),
      data: opts.data ?? {},
      p0: new Vector3(t.x, t.y, t.z),
      q0: new Quaternion(r.x, r.y, r.z, r.w),
      p1: new Vector3(t.x, t.y, t.z),
      q1: new Quaternion(r.x, r.y, r.z, r.w),
      settled: false,
    }
    this.bindings.push(b)
    this.byHandle.set(body.handle, b)
    if (object) {
      object.position.copy(b.p1)
      object.quaternion.copy(b.q1)
      object.matrixAutoUpdate = true
    }
    return b
  }

  unbind(b: BodyBinding, removeBody = true): void {
    const i = this.bindings.indexOf(b)
    if (i >= 0) this.bindings.splice(i, 1)
    this.byHandle.delete(b.handle)
    if (removeBody) this.world.removeRigidBody(b.body)
  }

  /** Call after you move a body by hand (setTranslation) so it doesn't interpolate across the jump. */
  teleported(b: BodyBinding): void {
    const t = b.body.translation()
    const r = b.body.rotation()
    b.p0.set(t.x, t.y, t.z)
    b.p1.copy(b.p0)
    b.q0.set(r.x, r.y, r.z, r.w)
    b.q1.copy(b.q0)
    b.settled = false
  }

  bindingOf(body: RigidBody | null | undefined): BodyBinding | null {
    if (!body) return null
    return this.byHandle.get(body.handle) ?? null
  }

  findByTag(tag: string): BodyBinding[] {
    return this.bindings.filter((b) => b.tag === tag)
  }

  allBindings(): readonly BodyBinding[] {
    return this.bindings
  }

  /** Run `fn(dt)` before every fixed step. `label` shows up in hookTimings(). */
  onBeforeStep(fn: StepHook, label = 'before'): () => void {
    const h = { fn, label, ms: 0 }
    this.before.push(h)
    return () => {
      const i = this.before.indexOf(h)
      if (i >= 0) this.before.splice(i, 1)
    }
  }

  onAfterStep(fn: StepHook, label = 'after'): () => void {
    const h = { fn, label, ms: 0 }
    this.after.push(h)
    return () => {
      const i = this.after.indexOf(h)
      if (i >= 0) this.after.splice(i, 1)
    }
  }

  /** EMA milliseconds per fixed step for each labelled hook. */
  hookTimings(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const h of [...this.before, ...this.after]) out[h.label] = +((out[h.label] ?? 0) + h.ms).toFixed(3)
    return out
  }

  // ---------------------------------------------------------------- stepping

  /**
   * Advance by a real frame delta (seconds). Runs 0..maxSubSteps fixed steps, then writes
   * interpolated poses into every bound Object3D. Returns the number of steps taken.
   */
  update(frameDt: number): number {
    if (this.paused) {
      this.syncVisuals(this.alpha)
      return 0
    }
    // Clamp huge gaps (tab switch, breakpoint) so we don't try to catch up a minute.
    const d = Math.min(Math.max(frameDt, 0), 0.25) * this.timeScale
    this.accumulator += d
    let n = 0
    while (this.accumulator >= this.dt && n < this.maxSubSteps) {
      this.stepOnce()
      this.accumulator -= this.dt
      n++
    }
    if (n === this.maxSubSteps && this.accumulator >= this.dt) {
      // Running slower than real time: drop the backlog instead of spiralling.
      this.droppedTime += this.accumulator - (this.accumulator % this.dt)
      this.accumulator %= this.dt
    }
    this.lastSubSteps = n
    this.alpha = this.accumulator / this.dt
    this.syncVisuals(this.alpha)
    return n
  }

  /** One fixed step, with hooks. Does not touch the accumulator or the visuals. */
  stepOnce(): void {
    const tStart = performance.now()
    const bs = this.bindings
    // Shift current -> previous for everything that may move this step.
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]
      if (b.body.isFixed()) continue
      b.p0.copy(b.p1)
      b.q0.copy(b.q1)
    }
    for (let i = 0; i < this.before.length; i++) this.runHook(this.before[i])
    const t0 = performance.now()
    this.world.step()
    const t1 = performance.now()
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]
      const body = b.body
      if (body.isFixed()) continue
      if (body.isSleeping()) {
        if (!b.settled) {
          b.p0.copy(b.p1)
          b.q0.copy(b.q1)
          b.settled = true
        }
        continue
      }
      b.settled = false
      const t = body.translation()
      const r = body.rotation()
      b.p1.set(t.x, t.y, t.z)
      b.q1.set(r.x, r.y, r.z, r.w)
    }
    for (let i = 0; i < this.after.length; i++) this.runHook(this.after[i])
    this.simTime += this.dt
    this.steps++
    const t2 = performance.now()
    const k = 0.05
    this.stepMsEma += (t1 - t0 - this.stepMsEma) * k
    this.stepTotalMsEma += (t2 - tStart - this.stepTotalMsEma) * k
  }

  private runHook(h: TimedHook): void {
    const a = performance.now()
    h.fn(this.dt)
    h.ms += (performance.now() - a - h.ms) * 0.05
  }

  /**
   * Rapier's internal profiler over n steps (mutates the sim). Returns mean ms per phase.
   */
  profile(n = 120): Record<string, number> {
    const w = this.world
    w.profilerEnabled = true
    const acc: Record<string, number> = {}
    const keys = ['timingStep', 'timingCollisionDetection', 'timingBroadPhase', 'timingNarrowPhase', 'timingSolver', 'timingVelocityAssembly', 'timingVelocityResolution', 'timingCcd', 'timingIslandConstruction', 'timingUserChanges'] as const
    let wall = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      this.stepOnce()
      wall += performance.now() - a
      for (const k of keys) acc[k] = (acc[k] ?? 0) + (this.world[k] as () => number).call(this.world)
    }
    this.world.profilerEnabled = false
    const out: Record<string, number> = { wallPerStep: +(wall / n).toFixed(3) }
    for (const k of keys) out[k.replace('timing', '')] = +(acc[k] / n).toFixed(3)
    return { ...out, ...this.hookTimings() }
  }

  /** Write interpolated poses into the bound objects. alpha=1 shows the newest state. */
  syncVisuals(alpha = this.alpha): void {
    const bs = this.bindings
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]
      const o = b.object
      if (!o) continue
      if (b.settled || alpha >= 1) {
        o.position.copy(b.p1)
        o.quaternion.copy(b.q1)
      } else {
        o.position.lerpVectors(b.p0, b.p1, alpha)
        o.quaternion.slerpQuaternions(b.q0, b.q1, alpha)
      }
    }
  }

  /** Interpolated world pose of a binding (for cameras that ride on bodies, held props, etc.). */
  interpolatedPose(b: BodyBinding, outP: Vector3, outQ?: Quaternion, alpha = this.alpha): void {
    outP.lerpVectors(b.p0, b.p1, alpha)
    if (outQ) outQ.slerpQuaternions(b.q0, b.q1, alpha)
  }

  // ---------------------------------------------------------------- queries

  raycast(origin: Vector3, dir: Vector3, maxDist: number, opts: RaycastOptions = {}): RayHit | null {
    const R = this.R
    _v.copy(dir).normalize()
    const ray = new R.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: _v.x, y: _v.y, z: _v.z })
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxDist,
      opts.solid ?? true,
      undefined,
      opts.groups,
      undefined,
      opts.excludeBody ?? undefined,
      opts.predicate,
    )
    if (!hit) return null
    const collider = hit.collider
    const body = collider.parent()
    if (!body) return null
    const d = hit.timeOfImpact
    return {
      body,
      collider,
      binding: this.bindingOf(body),
      point: new Vector3(origin.x + _v.x * d, origin.y + _v.y * d, origin.z + _v.z * d),
      normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: d,
    }
  }

  // ---------------------------------------------------------------- snapshot / replay

  /**
   * Serialises the whole world (bodies, colliders, joints, sleep state) plus every registered
   * non-Rapier state (cloth, particles, wind clock...). Rapier alone is not enough for a replay:
   * anything that applies forces from outside the world must round-trip too.
   */
  snapshot(): WorldSnapshot {
    const extras: Record<string, unknown> = {}
    for (const [k, p] of this.stateProviders) extras[k] = p.save()
    return { data: this.world.takeSnapshot(), simTime: this.simTime, steps: this.steps, extras }
  }

  /** Register external simulation state that must be saved/restored with the world. */
  registerState(key: string, provider: StateProvider): void {
    this.stateProviders.set(key, provider)
  }

  /**
   * Replaces the world with a snapshot taken from THIS PhysicsWorld. Handles are stable, so
   * every binding is re-pointed at the new body objects. Character controllers and other
   * objects that captured the old World must be re-created by their owners (see onRestore).
   */
  restore(snap: WorldSnapshot): void {
    const R = this.R
    const next = R.World.restoreSnapshot(snap.data)
    const old = this.world
    this.world = next
    this.world.timestep = this.dt
    this.world.numSolverIterations = old.numSolverIterations
    for (const b of this.bindings) {
      b.body = next.getRigidBody(b.handle)
      this.teleported(b)
    }
    this.simTime = snap.simTime
    this.steps = snap.steps
    this.accumulator = 0
    for (const fn of this.restoreHooks) fn(next, old)
    for (const [k, p] of this.stateProviders) if (k in snap.extras) p.load(snap.extras[k])
    old.free()
  }

  private restoreHooks: ((next: World, old: World) => void)[] = []
  private stateProviders = new Map<string, StateProvider>()
  onRestore(fn: (next: World, old: World) => void): void {
    this.restoreHooks.push(fn)
  }

  /** Cheap determinism fingerprint of all bound dynamic bodies. */
  hash(): string {
    let h = 2166136261 >>> 0
    const f = new Float32Array(1)
    const u = new Uint32Array(f.buffer)
    for (const b of this.bindings) {
      if (b.body.isFixed()) continue
      const t = b.body.translation()
      const r = b.body.rotation()
      for (const x of [t.x, t.y, t.z, r.x, r.y, r.z, r.w]) {
        f[0] = x
        h ^= u[0]
        h = Math.imul(h, 16777619) >>> 0
      }
    }
    return h.toString(16).padStart(8, '0')
  }

  stats(): PhysicsStats {
    let dynamic = 0
    let awake = 0
    this.world.forEachRigidBody((b) => {
      if (b.isDynamic()) {
        dynamic++
        if (!b.isSleeping()) awake++
      }
    })
    return {
      steps: this.steps,
      simTime: this.simTime,
      bodies: this.world.bodies.len(),
      dynamic,
      awake,
      colliders: this.world.colliders.len(),
      impulseJoints: this.world.impulseJoints.len(),
      multibodyJoints: this.world.multibodyJoints.len(),
      stepMs: this.stepMsEma,
      stepTotalMs: this.stepTotalMsEma,
      lastSubSteps: this.lastSubSteps,
      droppedTime: this.droppedTime,
    }
  }

  dispose(): void {
    this.bindings.length = 0
    this.byHandle.clear()
    this.before.length = 0
    this.after.length = 0
    this.world.free()
  }
}

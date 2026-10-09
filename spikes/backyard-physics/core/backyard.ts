/**
 * createBackyard(): the whole sunny backyard as one reusable scene module.
 *
 * Builds the environment (lawn, fence, house + garage, patio, maple, sky, sun) and the physics
 * toys (tire swing, domino run, tumble tower, ball, wheelbarrow, sprinkler, laundry line,
 * gnome, mailbox, picnic table, box camera), registers its fixed-step work with the
 * PhysicsWorld, and exposes a small API for time of day, per-frame updates and lookups.
 *
 * Host responsibilities: create the renderer (tone mapping, shadow map type from Quality),
 * camera and PhysicsWorld; call `update()` each frame after `pw.update()`.
 */
import {
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Scene,
  Vector3,
  type InstancedMesh,
  type IUniform,
} from 'three'
import type { ClothSphere } from './cloth'
import {
  PATIO,
  YARD,
  WetnessMap,
  createBackdrop,
  createFence,
  createGrass,
  createGround,
  createHouse,
  createMaple,
  createNightSky,
  createPatio,
  createSky,
  windUniforms,
  type SkyRig,
} from './env'
import type { InstancedBodies } from './instanced'
import { mergePropChildren, mergeStatic } from './merge-static'
import type { BodyBinding, PhysicsWorld } from './physics-world'
import { createDominoRun, createTumbleTower, sleepAll } from './props/blocks'
import { createGnome } from './props/gnome'
import { createLaundryLine, type Laundry } from './props/laundry'
import { createBall, createBoxCamera, createMailbox, createPicnicTable, createSprinklerProp, type CameraProp, type Mailbox, type SprinklerProp } from './props/misc'
import { createTireSwing, type TireSwing } from './props/swing'
import { createWheelbarrow, type Wheelbarrow } from './props/wheelbarrow'
import type { Quality } from './quality'
import { Sprinkler } from './sprinkler'
import { sunState, type SunState } from './sun'
import { laundryTexture } from './textures'
import { WindField } from './wind'

export interface BackyardOptions {
  quality: Quality
  /** Cloth solver for the laundry. Default 'verlet'. */
  cloth?: 'verlet' | 'rapier'
  /** Rope joints for the tire swing. Default 'impulse' (+ rope-joint cap). */
  swingJoints?: 'multibody' | 'impulse'
  /** Clock time to start at (hours, local daylight time). Default 16. */
  timeOfDay?: number
  /** Merge static meshes per material (default true). */
  mergeStatic?: boolean
  /** Skip groups of props (for lighter scenes in other games). */
  without?: Partial<Record<'swing' | 'dominoes' | 'tower' | 'laundry' | 'sprinkler' | 'wheelbarrow' | 'gnome' | 'mailbox' | 'table' | 'camera' | 'ball' | 'grass' | 'backdrop', boolean>>
}

export interface BackyardProps {
  ball?: BodyBinding
  swing?: TireSwing
  dominoes: BodyBinding[]
  tower: BodyBinding[]
  wheelbarrow?: Wheelbarrow
  gnome?: BodyBinding
  sprinkler?: SprinklerProp
  table?: BodyBinding
  mailbox?: Mailbox
  camera?: CameraProp
  laundry?: Laundry
}

export interface Backyard {
  group: Group
  sun: DirectionalLight
  hemi: HemisphereLight
  porch: PointLight
  sky: SkyRig
  wind: WindField
  wet: WetnessMap
  sprinkler: Sprinkler | null
  props: BackyardProps
  /** Spheres that push the laundry; add your own (e.g. the player's chest, body = null). */
  clothSpheres: ClothSphere[]
  spawn: { position: Vector3; yaw: number }
  /** Clock time, hours (local daylight time; solar = clock - 0.9). */
  readonly timeOfDay: number
  readonly sunState: SunState
  setTimeOfDay(clockHours: number): void
  /** Sprinkler water 0..1. */
  water: number
  /** Per-frame visuals. Call after pw.update(). */
  update(frameDt: number): void
  /** Call on resize so droplet sizes stay physical. */
  resize(heightPx: number, fovDeg: number): void
  /** Counts for HUD/debug. */
  info(): Record<string, number | string>
  dispose(): void
}

const DST_OFFSET = 0.9

export function createBackyard(pw: PhysicsWorld, scene: Scene, opts: BackyardOptions): Backyard {
  const q = opts.quality
  const skip = opts.without ?? {}
  const group = new Group()
  group.name = 'backyard'
  scene.add(group)

  const wind = new WindField({ heading: 0.9, speed: 2.4, gustiness: 1.1 })
  const wu: Record<string, IUniform> = windUniforms(wind)
  const wet = new WetnessMap(YARD)

  // ---------------------------------------------------------------- environment
  const sky = createSky(group, q.skyShader, q.clouds)
  createGround(pw, group, wet)
  createPatio(pw, group)
  createFence(pw, group)
  const house = createHouse(pw, group)
  const tree = createMaple(pw, group, new Vector3(5, 0, -1.2), q.leaves, wu)
  if (!skip.backdrop) createBackdrop(group)
  const treeBase = new Vector3(5, 0, -1.2)
  let grass: InstancedMesh | null = null
  if (!skip.grass) {
    grass = createGrass(group, q.grassTufts, wu, (x, z) => {
      if (x > PATIO.minX - 0.05 && x < PATIO.maxX + 0.05 && z < PATIO.maxZ + 0.05) return true
      if (Math.hypot(x - treeBase.x, z - treeBase.z) < 0.55) return true
      return false
    })
  }

  // ---------------------------------------------------------------- lights
  const sun = new DirectionalLight(0xffffff, 3)
  sun.castShadow = q.shadowMapSize > 0
  if (sun.castShadow) {
    sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize)
    const c = sun.shadow.camera
    c.left = -17
    c.right = 17
    c.top = 17
    c.bottom = -17
    c.near = 1
    c.far = 90
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.025
    sun.shadow.radius = 3
  }
  sun.target.position.set(0, 0, 0.5)
  group.add(sun, sun.target)
  const hemi = new HemisphereLight(0xbcd6f0, 0x5c7a35, 0.9)
  group.add(hemi)
  const porch = new PointLight(0xffc27a, 0, 9, 1.6)
  porch.position.copy(house.porchLightPos)
  group.add(porch)
  const porchLamp = group.getObjectByName('porch-lamp') as Mesh | undefined
  scene.fog = new FogExp2(0xcfe3f2, 0.0065)

  // ---------------------------------------------------------------- props
  const props: BackyardProps = { dominoes: [], tower: [] }
  const clothSpheres: ClothSphere[] = []

  if (!skip.swing) {
    props.swing = createTireSwing(pw, group, {
      anchor: tree.swingAnchor,
      anchorBody: tree.body,
      ropeLength: 2.15,
      links: 8,
      joints: opts.swingJoints ?? 'impulse',
    })
  }
  if (!skip.dominoes) {
    const y = PATIO.top
    props.dominoes = createDominoRun(pw, group, {
      path: [
        new Vector3(-8.5, y, -5.0),
        new Vector3(-7.3, y, -5.3),
        new Vector3(-6.4, y, -6.4),
        new Vector3(-5.2, y, -7.1),
        new Vector3(-4.1, y, -6.7),
        new Vector3(-3.5, y, -5.6),
      ],
      max: 40,
    })
  }
  if (!skip.tower) props.tower = createTumbleTower(pw, group, { base: new Vector3(-2.75, PATIO.top, -7.55), layers: 12, yaw: 0.3 })
  if (!skip.ball) props.ball = createBall(pw, group, new Vector3(-0.3, 0.3, 2.2))
  if (!skip.wheelbarrow) props.wheelbarrow = createWheelbarrow(pw, group, new Vector3(-9.6, 0.005, -2.4), 0.7)
  if (!skip.gnome) props.gnome = createGnome(pw, group, new Vector3(8.4, 0.002, 6.6), -2.5)
  if (!skip.table) props.table = createPicnicTable(pw, group, new Vector3(-0.6, 0.002, -2.4), 0.12)
  if (!skip.camera) props.camera = createBoxCamera(pw, group, new Vector3(-0.9, 0.85, -2.45), 0.5)
  if (!skip.mailbox) props.mailbox = createMailbox(pw, group, new Vector3(10.7, 0, 8.7), Math.PI + 0.5)
  let sprinkler: Sprinkler | null = null
  if (!skip.sprinkler) {
    props.sprinkler = createSprinklerProp(pw, group, new Vector3(1.6, 0.003, 4.6), 0.35)
    sprinkler = new Sprinkler({
      capacity: q.sprinklerDroplets,
      onLand: (x, z) => wet.deposit(x, z, 0.02),
    })
    group.add(sprinkler.points)
  }
  if (!skip.laundry) {
    const [nx, ny] = q.clothGrid
    props.laundry = createLaundryLine(pw, group, {
      a: new Vector3(-10.2, 0, 3.4),
      b: new Vector3(-3.6, 0, 3.4),
      backend: opts.cloth ?? 'verlet',
      iterations: q.clothIterations,
      every: q.clothEvery,
      items: [
        { at: 0.07, width: 2.2, height: 1.45, map: laundryTexture('sheet'), grid: [nx, ny], mass: 0.55, pegs: 4 },
        { at: 0.47, width: 1.0, height: 0.72, map: laundryTexture('towel'), grid: [Math.max(6, Math.round(nx * 0.5)), Math.max(5, Math.round(ny * 0.55))], mass: 0.35, pegs: 2 },
        { at: 0.67, width: 1.3, height: 0.95, map: laundryTexture('sheet'), grid: [Math.max(7, Math.round(nx * 0.6)), Math.max(6, Math.round(ny * 0.65))], mass: 0.25, pegs: 3 },
      ],
    })
  }
  // Things that push the laundry.
  const sphereFor = (b: BodyBinding | undefined, r: number, dy = 0) => {
    if (!b) return
    const s: ClothSphere = { center: new Vector3(), radius: r, body: b.body }
    ;(s as ClothSphere & { _b: BodyBinding; _dy: number })._b = b
    ;(s as ClothSphere & { _b: BodyBinding; _dy: number })._dy = dy
    clothSpheres.push(s)
  }
  sphereFor(props.ball, 0.11)
  sphereFor(props.swing?.tire, 0.3)
  sphereFor(props.gnome, 0.16, 0.25)

  // ---------------------------------------------------------------- fixed step work
  const nozzle = new Matrix4()
  const tmp = new Vector3()
  let water = 1
  const offs: (() => void)[] = []
  offs.push(pw.onBeforeStep((dt) => {
    wind.update(dt)
    // Sphere centres from the current physics state.
    for (const s of clothSpheres) {
      const ext = s as ClothSphere & { _b?: BodyBinding; _dy?: number }
      if (ext._b) {
        const t = ext._b.body.translation()
        s.center.set(t.x, t.y + (ext._dy ?? 0), t.z)
        s.body = ext._b.body
      }
    }
  }, 'wind'))
  if (props.laundry) {
    const l = props.laundry
    offs.push(pw.onBeforeStep((dt) => l.step(dt, wind, clothSpheres), 'laundry'))
    offs.push(pw.onAfterStep(() => l.afterStep(), 'laundry-readback'))
  }
  if (sprinkler && props.sprinkler) {
    const sp = sprinkler
    const b = props.sprinkler.binding
    offs.push(pw.onBeforeStep((dt) => {
      nozzle.compose(b.p1, b.q1, tmp.set(1, 1, 1))
      sp.step(dt, nozzle, wind, water)
    }, 'sprinkler'))
  }
  if (props.swing) {
    // Wind on the tyre: quadratic drag on ~0.25 m^2 (only when awake or gusting hard,
    // so a calm swing can fall asleep).
    // Look the body up every step: RigidBody objects die with World.restoreSnapshot();
    // bindings are re-pointed, so hold bindings (or handles), never bodies.
    const tire = props.swing.tire
    offs.push(pw.onBeforeStep((dt) => {
      const tb = tire.body
      const t = tb.translation()
      if (tb.isSleeping() && wind.gust(t.x, t.z) < 1.6) return
      wind.sample(t.x, t.y, t.z, tmp)
      const v = tb.linvel()
      const rx = tmp.x - v.x, rz = tmp.z - v.z
      const k = 0.5 * 1.2 * 1.0 * 0.25 * dt
      tb.applyImpulse({ x: k * rx * Math.abs(rx), y: 0, z: k * rz * Math.abs(rz) }, true)
    }, 'swing-wind'))
  }
  // Evaporation follows the sun.
  offs.push(pw.onBeforeStep((dt) => wet.dry(dt, 0.004 + 0.035 * state.intensity), 'wetness'))
  // Everything outside Rapier that feeds forces back in must round-trip with snapshots.
  pw.registerState('backyard', {
    save: () => ({
      wind: wind.time,
      cloth: props.laundry?.cloths.map((c) => c.saveState()) ?? [],
      sprinkler: sprinkler?.saveState() ?? null,
      water,
    }),
    load: (v) => {
      const st = v as { wind: number; cloth: unknown[]; sprinkler: unknown; water: number }
      wind.time = st.wind
      props.laundry?.cloths.forEach((c, i) => c.loadState(st.cloth[i]))
      if (sprinkler && st.sprinkler) sprinkler.loadState(st.sprinkler)
      water = st.water
    },
  })

  const stars = createNightSky(group, q.name === 'low' ? 600 : 1800)

  // ---------------------------------------------------------------- time of day
  let clock = opts.timeOfDay ?? 16
  let state = sunState(clock - DST_OFFSET)
  const fogColor = new Color()
  const applySun = () => {
    state = sunState(clock - DST_OFFSET)
    const s = state
    sun.position.copy(sun.target.position).addScaledVector(s.dir, 45)
    sun.color.copy(s.color)
    sun.intensity = 3.2 * s.intensity
    sun.visible = s.intensity > 0.002
    sun.castShadow = q.shadowMapSize > 0 && s.intensity > 0.01
    const day = s.skyIntensity
    hemi.intensity = 0.25 + 0.85 * day
    hemi.color.setRGB(0.55 + 0.2 * day, 0.62 + 0.22 * day, 0.85 + 0.1 * day)
    hemi.groundColor.setRGB(0.22 * day + 0.03, 0.3 * day + 0.03, 0.14 * day + 0.04)
    sky.setSun(s.dir, s.elevation, clock * 60)
    fogColor.copy(sky.horizonColor)
    ;(scene.fog as FogExp2).color.copy(fogColor)
    const night = 1 - Math.min(1, Math.max(0, (s.elevation + 0.05) / 0.12))
    porch.intensity = night * 6
    if (porchLamp) (porchLamp.material as MeshStandardMaterial).emissive.setRGB(night * 1.0, night * 0.8, night * 0.45)
    if (sprinkler) {
      const k = 0.06 + s.intensity
      sprinkler.setSun(s.dir, s.color.r * k, s.color.g * k, s.color.b * k, 0.08 + 0.92 * day)
    }
    stars.setNight(night)
  }
  applySun()

  // Bake static meshes into one mesh per material (draw calls ~420 -> ~120).
  const bound = pw.allBindings().map((b) => b.object).filter((o): o is Object3D => !!o)
  const mergeStats = opts.mergeStatic === false ? null : mergeStatic(group, new Set(bound))
  if (opts.mergeStatic !== false) for (const o of bound) mergePropChildren(o)

  // One step now: builds the query BVH (raycasts return nothing before the first step) and
  // creates contact manifolds, then the stacks go to sleep until something touches them.
  pw.stepOnce()
  sleepAll(props.dominoes)
  sleepAll(props.tower)

  // ---------------------------------------------------------------- per frame
  const instanced: InstancedBodies[] = (group.userData.instanced as InstancedBodies[] | undefined) ?? []
  let wetTimer = 0
  const api: Backyard = {
    group,
    sun,
    hemi,
    porch,
    sky,
    wind,
    wet,
    sprinkler,
    props,
    clothSpheres,
    spawn: { position: new Vector3(1.2, 0, 8.4), yaw: 0.22 },
    get timeOfDay() {
      return clock
    },
    get sunState() {
      return state
    },
    get water() {
      return water
    },
    set water(v: number) {
      water = Math.max(0, Math.min(1, v))
    },
    setTimeOfDay(h: number) {
      clock = h
      applySun()
    },
    update(frameDt: number) {
      const alpha = pw.alpha
      wu.uWindTime.value = wind.time + alpha * pw.dt
      if (props.sprinkler && sprinkler) props.sprinkler.tube.rotation.x = sprinkler.armAngle
      props.laundry?.render(alpha)
      for (const i of instanced) i.sync()
      wetTimer += frameDt
      if (wetTimer > 0.2) {
        wetTimer = 0
        wet.flush()
      }
    },
    resize(h: number, fov: number) {
      sprinkler?.setViewScale(h, fov)
    },
    info() {
      return {
        droplets: sprinkler ? sprinkler.live : 0,
        grass: grass ? grass.count : 0,
        leaves: tree.leaves.count,
        cloth: props.laundry ? props.laundry.backend : 'none',
        clothParticles: props.laundry ? props.laundry.cloths.reduce((a, c) => a + c.nx * c.ny, 0) : 0,
        swingStretch: props.swing ? +props.swing.stretch().toFixed(4) : 0,
        wind: +wind.gust(0, 0).toFixed(2),
        mergedMeshes: mergeStats ? `${mergeStats.before}->${mergeStats.after}` : 'off',
      }
    },
    dispose() {
      for (const off of offs) off()
      props.laundry?.dispose()
      sprinkler?.dispose()
      scene.remove(group)
    },
  }
  return api
}

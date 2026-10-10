// The yard room (studio.md §4.4): orbit camera, toys, creatures, the sun handle (drag and fling), the time
// chip, poke/grab/throw, the mailbox, and the PhotoSubject registry.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import type { GestureEvent } from '@shared/core'
import type { Engine, PickEvent } from '../core/engine'
import { LAYER_EYE, DAY_OF_YEAR, LAT } from '../core/engine'
import type { PhysBody, Physics } from '../core/physics'
import type { PhotoSubject, SubjectRegistry } from '../core/contracts'
import type { Grab } from '../core/grab'
import type { RoomModule, OrbitView } from '../core/rooms'
import type { Hud } from '../hud/hud'
import { addGlow, type Glow } from '../core/glow'
import { createEnvironment, type Environment } from './environment'
import { createWind, type Wind } from './wind'
import { createSwing, createSprinkler, createLantern, createWhirligig, createChimes, createProps, type Swing, type Sprinkler, type Lantern, type Whirligig, type Props } from './toys'
import { createDot, createSparrows, type Dot, type Sparrows } from './creatures'
import { box, mat } from '../house/architecture'
import { TEX } from '../core/textures'
import { sunPosition } from '@shared/sun'

export interface YardModule extends RoomModule {
  subjects: SubjectRegistry
  env: Environment
  wind: Wind
  swing: Swing
  sprinkler: Sprinkler
  lantern: Lantern
  whirligig: Whirligig
  props: Props
  dot: Dot
  sparrows: Sparrows
  mailbox: { root: THREE.Group; flag: THREE.Object3D; door: THREE.Object3D; setFlag(up: boolean): void; flagUp: boolean; glow: Glow }
  stumpCan: THREE.Group
  stumpGlow: Glow
  sunHandle: THREE.Sprite
  /** set by others */
  tripodPos: THREE.Vector3
  onMailbox: (() => void) | null
  onStumpCan: (() => void) | null
  onDoor: ((to: 'hall' | 'workshop') => void) | null
  doorGlow: Glow
  sunFling: number
  setView(name: 'yard-wide' | 'yard-rainbow' | 'yard-lantern'): void
  byName(name: string): PhysBody | undefined
  bodies: PhysBody[]
}

const D2R = Math.PI / 180

export function createYard(e: Engine, ph: Physics, grab: Grab, hud: Hud, house: { backDoor: THREE.Object3D; sideDoor: THREE.Object3D }): YardModule {
  const env = createEnvironment(e, ph)
  const wind = createWind(e.seed)
  const swing = createSwing(e, ph)
  const sprinkler = createSprinkler(e, ph, wind)
  const lantern = createLantern(e)
  const whirligig = createWhirligig(e, wind)
  createChimes(e, wind)
  const props = createProps(e, ph)
  const dot = createDot(e, ph, () => props.ball)
  const tripodPos = new THREE.Vector3(1.5, 0, 4)
  const sparrows = createSparrows(e, env.feeder, env.fencePerches, env.canopy, () => dot.root.position, () => tripodPos)

  // ---------------------------------------------------------------- mailbox (rusty, "16")
  const mbRoot = new THREE.Group()
  mbRoot.name = 'mailbox'
  mbRoot.position.set(12, 1.05, 15.2)
  const rust = mat(0xffffff, { map: TEX.rust(), rough: 0.7, metal: 0.3 })
  const mbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.46, 16, 1, false, 0, Math.PI), rust)
  mbBody.rotation.z = Math.PI / 2
  mbBody.rotation.y = Math.PI / 2
  mbBody.position.y = 0.08
  const mbBase = box(0.26, 0.16, 0.46, rust, 0, 0.0, 0, mbRoot)
  mbRoot.add(mbBody)
  void mbBase
  const door = new THREE.Group()
  door.position.set(0, -0.08, -0.235)
  const doorMesh = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16, 0, Math.PI), rust)
  doorMesh.position.y = 0.16
  const doorLow = box(0.26, 0.16, 0.01, rust, 0, 0.08, 0, door)
  void doorLow
  door.add(doorMesh)
  doorMesh.rotation.y = Math.PI
  mbRoot.add(door)
  const flag = new THREE.Group()
  flag.position.set(0.14, 0.0, 0.05)
  const flagArm = box(0.01, 0.22, 0.03, mat(0xc0362c, { rough: 0.5 }), 0, 0.11, 0, flag)
  box(0.01, 0.07, 0.09, mat(0xc0362c, { rough: 0.5 }), 0, 0.19, -0.05, flag)
  void flagArm
  mbRoot.add(flag)
  mbRoot.traverse((o) => (o.castShadow = true))
  e.scene.add(mbRoot)
  let flagUp = false
  const setFlag = (up: boolean) => {
    flagUp = up
    flag.rotation.x = up ? 0 : -Math.PI / 2
  }
  setFlag(false)
  const mailboxGlow = addGlow(mbRoot, 0.015)

  // ---------------------------------------------------------------- the oatmeal can on the stump
  const stumpCan = new THREE.Group()
  stumpCan.name = 'stump-can'
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 20), mat(0xffffff, { map: TEX.oats(), rough: 0.8 }))
  can.rotation.z = Math.PI / 2
  can.castShadow = true
  stumpCan.add(can)
  const flap = box(0.005, 0.05, 0.05, mat(0x151413), 0.092, 0, 0, stumpCan)
  void flap
  stumpCan.position.set(1, 0.52, 3)
  stumpCan.rotation.y = -Math.PI / 2 // pinhole faces north, toward the yard
  e.scene.add(stumpCan)
  const stumpGlow = addGlow(stumpCan, 0.012)

  // ---------------------------------------------------------------- the sun handle (eye-only)
  const ringCanvas = document.createElement('canvas')
  ringCanvas.width = ringCanvas.height = 128
  const g = ringCanvas.getContext('2d')!
  g.strokeStyle = 'rgba(255,240,200,0.9)'
  g.lineWidth = 6
  g.beginPath()
  g.arc(64, 64, 52, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = 'rgba(255,230,170,0.22)'
  g.beginPath()
  g.arc(64, 64, 46, 0, Math.PI * 2)
  g.fill()
  const ringTex = new THREE.CanvasTexture(ringCanvas)
  const sunHandle = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, depthWrite: false }))
  ;(sunHandle.material as THREE.SpriteMaterial).toneMapped = false
  sunHandle.layers.set(LAYER_EYE)
  sunHandle.renderOrder = 50
  sunHandle.name = 'sun-handle'
  e.scene.add(sunHandle)
  const handleDir = (h: number, out: THREE.Vector3) => {
    const sp = sunPosition(DAY_OF_YEAR, LAT, h, { clockOffsetH: 1 })
    const el = Math.max(3, sp.elevDeg) * D2R
    const az = sp.azDeg * D2R
    return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
  }
  const hd = new THREE.Vector3()
  const hourForRay = (dir: THREE.Vector3): number => {
    let best = e.day.hours
    let bd = -2
    for (let h = 4.5; h <= 23.5; h += 0.1) {
      const d = handleDir(h, hd).dot(dir)
      if (d > bd) {
        bd = d
        best = h
      }
    }
    for (let h = best - 0.1; h <= best + 0.1; h += 0.005) {
      const d = handleDir(h, hd).dot(dir)
      if (d > bd) {
        bd = d
        best = h
      }
    }
    return Math.max(4.5, Math.min(23.5, best))
  }
  let sunDrag = false
  let sunFling = 0
  let lastDragH = 0
  let lastDragT = 0
  const sunPick = e.addPickable({
    object: sunHandle,
    room: 'any',
    on: (pe) => {
      if (pe.kind === 'dragStart') {
        sunDrag = true
        sunFling = 0
        lastDragH = e.day.hours
        lastDragT = performance.now()
        return true
      }
      if (pe.kind === 'drag' && sunDrag) {
        const h = hourForRay(pe.ray.direction)
        const now = performance.now()
        const dt = Math.max(1, now - lastDragT) / 1000
        sunFling = sunFling * 0.5 + (0.5 * (h - lastDragH)) / dt
        lastDragH = h
        lastDragT = now
        e.day.set(h, 'drag')
        return true
      }
      if (pe.kind === 'dragEnd') {
        sunDrag = false
        if (Math.abs(sunFling) < 0.2) sunFling = 0
        sunFling = Math.max(-4, Math.min(4, sunFling))
        return true
      }
      return pe.kind === 'tap' || pe.kind === 'down'
    },
  })
  void sunPick
  e.onFrame((dt) => {
    // fling decays: ω' = −1.8 ω (game-hours/s)
    if (!sunDrag && sunFling !== 0) {
      e.day.set(e.day.hours + sunFling * dt, 'drag')
      sunFling *= Math.exp(-1.8 * dt)
      if (Math.abs(sunFling) < 0.02 || e.day.hours <= 4.5 || e.day.hours >= 23.5) sunFling = 0
    }
    handleDir(e.day.hours, hd)
    sunHandle.position.copy(e.eye.position).addScaledVector(hd, 60)
    const s = 60 * Math.tan(2.6 * D2R)
    sunHandle.scale.set(s, s, 1)
    const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 1000 * Math.PI * 0.5)
    ;(sunHandle.material as THREE.SpriteMaterial).opacity = pulse
    sunHandle.visible = e.room === 'yard' || e.room === 'overview'
    hud.setTime(e.day.hours)
  })
  hud.onScrub((h) => e.day.set(h, 'scrub'))

  // ---------------------------------------------------------------- subjects
  const subjects = new Map<string, PhotoSubject>()
  const registry: SubjectRegistry = {
    all: () => [...subjects.values()],
    get: (id) => subjects.get(id),
    add: (s) => subjects.set(s.id, s),
  }
  for (const s of [swing.subject, sprinkler.subject, lantern.subject, whirligig.subject, dot.subject, sparrows.subject, ...props.subjects]) registry.add(s)
  registry.add({
    id: 'mailbox', tag: 'mailbox', dynamic: false, radius: 0.28,
    center: (out) => out.set(12, 1.1, 15.2),
    sample: () => ({ flag: flagUp ? 1 : 0 }),
  })

  // ---------------------------------------------------------------- interactions
  const bodies: PhysBody[] = [props.ball, props.bucket, props.can, swing.body]
  const bodyPickable = (pb: PhysBody) =>
    e.addPickable({
      object: pb.mesh,
      room: 'yard',
      on: (pe: PickEvent) => {
        if (pe.kind === 'tap') {
          grab.poke(pb, pe.point, pe.ray.direction)
          return true
        }
        if (pe.kind === 'dragStart') {
          grab.start(pb, pe.point, pe.ray)
          if (pb === props.ball) ballThrown = false
          return true
        }
        if (pe.kind === 'drag') {
          grab.move(pe.ray)
          return true
        }
        if (pe.kind === 'dragEnd') {
          grab.end(true)
          if (pb === props.ball) ballThrown = true
          return true
        }
        return false
      },
    })
  for (const pb of bodies) bodyPickable(pb)
  const addBody = (pb: PhysBody) => {
    bodies.push(pb)
    bodyPickable(pb)
  }
  // sprinkler + spigot
  e.addPickable({ object: sprinkler.root, room: 'yard', on: (pe) => pe.kind === 'tap' && (sprinkler.set(!sprinkler.on), Audio.play('ui.switch', {}), true) })
  const spigot = e.scene.getObjectByName('spigot')
  if (spigot) e.addPickable({ object: spigot, room: 'yard', on: (pe) => pe.kind === 'tap' && (sprinkler.set(!sprinkler.on), Audio.play('ui.switch', {}), true) })
  // Dot
  e.addPickable({ object: dot.root, room: 'yard', on: (pe) => pe.kind === 'tap' && (dot.sit(3), true) })
  // lantern: tap pushes, drag carries, release sets velocity
  const lanternPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6)
  const lp = new THREE.Vector3()
  let lanternDrag = false
  let lastL = { x: 0, y: 0, t: 0 }
  e.addPickable({
    object: lantern.ball,
    room: 'yard',
    on: (pe) => {
      if (pe.kind === 'tap') {
        const d = pe.ray.direction
        lantern.push(d.z * 0.6, d.x * 0.6)
        return true
      }
      if (pe.kind === 'dragStart') {
        lanternDrag = true
        return true
      }
      if (pe.kind === 'drag' && lanternDrag) {
        if (pe.ray.intersectPlane(lanternPlane, lp)) {
          const x = THREE.MathUtils.clamp(lp.z - 12, -0.6, 0.6)
          const y = THREE.MathUtils.clamp(lp.x - 6, -0.6, 0.6)
          const now = e.sim.t
          const dt = Math.max(1 / 120, now - lastL.t)
          lantern.set(x, y, (x - lastL.x) / dt * 0.5, (y - lastL.y) / dt * 0.5)
          lastL = { x, y, t: now }
        }
        return true
      }
      if (pe.kind === 'dragEnd') {
        lanternDrag = false
        return true
      }
      return false
    },
  })
  const knot = e.scene.getObjectByName('lantern-knot')!
  let knotY0 = 0
  e.addPickable({
    object: knot,
    room: 'yard',
    on: (pe) => {
      if (pe.kind === 'dragStart') {
        knotY0 = lantern.knot
        return true
      }
      if (pe.kind === 'drag') {
        knotY0 = THREE.MathUtils.clamp(knotY0 + pe.dy * 0.003, 0.15, 0.9)
        lantern.setKnot(knotY0)
        return true
      }
      return pe.kind === 'dragEnd'
    },
  })
  e.addPickable({ object: whirligig.root, room: 'yard', on: (pe) => pe.kind === 'tap' && (whirligig.poke(), true) })
  e.addPickable({ object: mbRoot, room: 'yard', on: (pe) => pe.kind === 'tap' && (api.onMailbox?.(), true) })
  e.addPickable({ object: stumpCan, room: 'yard', on: (pe) => pe.kind === 'tap' && (api.onStumpCan?.(), true) })
  const doorGlow = addGlow(house.backDoor, 0.02)
  e.addPickable({ object: house.backDoor, room: 'yard', on: (pe) => pe.kind === 'tap' && (Audio.play('studio.screen-door', {}), api.onDoor?.('hall'), true) })
  e.addPickable({ object: house.sideDoor, room: 'yard', on: (pe) => pe.kind === 'tap' && (api.onDoor?.('workshop'), true) })

  // ball landing → Dot fetches
  let ballThrown = false
  let ballFlying = false
  e.sim.add({
    step() {
      const b = props.ball.body
      if (b.isKinematic()) return
      const t = b.translation()
      const v = b.linvel()
      if (ballThrown && t.y > 0.35 && Math.hypot(v.x, v.y, v.z) > 2) ballFlying = true
      if (ballFlying && t.y < 0.14 && Math.abs(v.y) < 3) {
        ballFlying = false
        ballThrown = false
        const p = new THREE.Vector3(t.x, t.y, t.z)
        e.bus.emit('ball:landed', { pos: p })
        dot.fetch(p)
        Audio.play('studio.bark', {})
      }
    },
  }, 30)

  // ambience
  let cicadas: ReturnType<typeof Audio.loop> | null = null
  let crickets: ReturnType<typeof Audio.loop> | null = null
  let windLoop: ReturnType<typeof Audio.loop> | null = null
  const startBeds = () => {
    if (cicadas) return
    cicadas = Audio.loop('studio.cicadas', { level: 0 })
    crickets = Audio.loop('studio.crickets', { tempF: 68 })
    windLoop = Audio.loop('studio.wind', { w: 2 })
  }
  e.onFrame(() => {
    if (!cicadas) return
    const el = e.sun().elevDeg
    const outside = e.room === 'yard' || e.room === 'overview'
    const k = outside ? 1 : e.room === 'darkroom' ? 0.15 : 0.45
    cicadas.set('level', THREE.MathUtils.smoothstep(el, 5, 40) * 0.8 * k)
    crickets?.volume((1 - THREE.MathUtils.smoothstep(el, -6, 2)) * k, 0.3)
    windLoop?.set('w', wind.speed(0, 8, e.sim.t))
    windLoop?.volume(k * 0.8, 0.3)
  })
  window.addEventListener('pointerdown', startBeds, { once: true })
  window.addEventListener('keydown', startBeds, { once: true })

  const view: OrbitView = { kind: 'orbit', target: new THREE.Vector3(0, 1, 8.5), yaw: 132 * D2R, pitch: 17 * D2R, radius: 15, rMin: 4, rMax: 24, pMin: 6 * D2R, pMax: 75 * D2R, fov: 55 }

  // gestures nobody picked: wheel while holding = carry distance
  const onPointer = (ge: GestureEvent): boolean | void => {
    if (grab.held && ge.kind === 'wheel') {
      grab.nudge(-ge.deltaY * 0.004)
      return true
    }
    return
  }

  const api: YardModule = {
    id: 'yard',
    view,
    subjects: registry,
    env, wind, swing, sprinkler, lantern, whirligig, props, dot, sparrows,
    mailbox: {
      root: mbRoot, flag, door, setFlag,
      get flagUp() {
        return flagUp
      },
      glow: mailboxGlow,
    },
    stumpCan, stumpGlow,
    sunHandle,
    tripodPos,
    onMailbox: null,
    onStumpCan: null,
    onDoor: null,
    doorGlow,
    get sunFling() {
      return sunFling
    },
    bodies,
    byName: (n) => bodies.find((b) => b.name === n) ?? props.extra.find((b) => b.name === n),
    ambientLux: () => null,
    enter() {
      hud.setRoom('yard')
    },
    exit() {
      grab.end(false)
    },
    update(dt) {
      env.update(e.sim.t, wind.speed(-7, 10, e.sim.t))
      void dt
    },
    onPointer,
    setView(name) {
      if (name === 'yard-wide') {
        Object.assign(view, { target: new THREE.Vector3(0, 1, 8.5), yaw: 132 * D2R, pitch: 17 * D2R, radius: 15, pMin: 6 * D2R })
      } else if (name === 'yard-lantern') {
        Object.assign(view, { target: new THREE.Vector3(6, 1.8, 12), yaw: 205 * D2R, pitch: 12 * D2R, radius: 6.5, pMin: 6 * D2R })
      } else {
        const s = e.sun()
        const antiAz = Math.atan2(-s.dir.x, -s.dir.z)
        const az = antiAz - 42 * D2R
        const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az))
        const base = new THREE.Vector3(3, 0, 7)
        const eye = base.clone().addScaledVector(dir, -7).setY(1.6)
        const pitch = 2 * D2R
        const target = eye.clone().addScaledVector(dir, 7)
        target.y = eye.y - 7 * Math.sin(pitch)
        Object.assign(view, { target, yaw: Math.atan2(-dir.x, -dir.z), pitch: -pitch, radius: 7, pMin: -10 * D2R })
        // pitch is negative: looking slightly upward from below the target line
        view.pitch = Math.asin((eye.y - target.y) / 7)
      }
    },
  }
  ;(api as unknown as { addBody: (pb: PhysBody) => void }).addBody = addBody
  return api
}

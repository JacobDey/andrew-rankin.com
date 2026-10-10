// Creatures (studio.md §5.5): Dot the terrier (kinematic: lap, sniff, fetch, jump, sit) and five sparrows
// (perch, hop, flee on noise, return). No mesh deformation: poses come from rigid parts only.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import type { Engine } from '../core/engine'
import type { PhysBody, Physics } from '../core/physics'
import type { PhotoSubject } from '../core/contracts'
import { mat } from '../house/architecture'

export interface Dot {
  root: THREE.Group
  body: PhysBody
  subject: PhotoSubject
  sit(seconds?: number): void
  fetch(target: THREE.Vector3): void
  state(): string
  pathPolyline: THREE.Vector3[]
  airborne: boolean
  setHome(p: THREE.Vector3): void
}
export interface Sparrows { flee(reason: string): void; flying(): number; subject: PhotoSubject; roots: THREE.Group[]; update(dt: number): void }

const LAP: [number, number][] = [[-2, 3], [6, 2.5], [10, 7], [8, 13], [1, 14.5], [-6, 13.5], [-9, 7], [-5, 3.5]]

function buildDot(): { root: THREE.Group; legs: THREE.Group[]; tail: THREE.Group; head: THREE.Group } {
  const coat = mat(0xb9a07a, { rough: 0.95 })
  const saddle = mat(0x3a2e25, { rough: 0.95 })
  const dark = mat(0x1a1512, { rough: 0.6 })
  const root = new THREE.Group()
  root.name = 'dot'
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.32, 4, 10), coat)
  body.rotation.z = Math.PI / 2
  body.rotation.y = Math.PI / 2
  body.position.set(0, 0.33, 0)
  root.add(body)
  const sad = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.2, 4, 8, 1), saddle)
  sad.rotation.x = Math.PI / 2
  sad.position.set(0, 0.37, -0.03)
  sad.scale.set(1.04, 1, 0.85)
  root.add(sad)
  const head = new THREE.Group()
  head.position.set(0, 0.45, 0.26)
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.16), coat)
  head.add(skull)
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), coat)
  muzzle.position.set(0, -0.03, 0.11)
  head.add(muzzle)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), dark)
  nose.position.set(0, -0.01, 0.165)
  head.add(nose)
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.02), saddle)
    ear.position.set(s * 0.06, 0.07, 0.02)
    ear.rotation.set(0.6, 0, s * 0.5)
    head.add(ear)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), dark)
    eye.position.set(s * 0.04, 0.02, 0.08)
    head.add(eye)
  }
  root.add(head)
  const legs: THREE.Group[] = []
  for (const [x, z] of [[-0.08, 0.15], [0.08, 0.15], [-0.08, -0.17], [0.08, -0.17]]) {
    const hip = new THREE.Group()
    hip.position.set(x, 0.3, z)
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.05), coat)
    up.position.y = -0.075
    hip.add(up)
    const knee = new THREE.Group()
    knee.position.y = -0.15
    const low = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), coat)
    low.position.y = -0.075
    knee.add(low)
    hip.add(knee)
    root.add(hip)
    legs.push(hip)
  }
  const tail = new THREE.Group()
  tail.position.set(0, 0.42, -0.27)
  const tm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), saddle)
  tm.position.y = 0.07
  tail.add(tm)
  tail.rotation.x = -0.5
  root.add(tail)
  root.traverse((o) => {
    o.castShadow = true
    o.receiveShadow = true
  })
  return { root, legs, tail, head }
}

export function createDot(e: Engine, ph: Physics, getBall: () => PhysBody): Dot {
  const R = ph.R
  const { root, legs, tail, head } = buildDot()
  e.scene.add(root)
  const curve = new THREE.CatmullRomCurve3(LAP.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
  const lapLen = curve.getLength()
  const pathPolyline = curve.getSpacedPoints(64)
  const rng = e.rng('dot')
  const body = ph.add(root, R.RigidBodyDesc.kinematicPositionBased().setTranslation(-2, 0, 3), [R.ColliderDesc.capsule(0.18, 0.16).setTranslation(0, 0.33, 0).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })], { material: 'cloth', name: 'dot', radius: 0.35 })
  type Mode = 'lap' | 'sniff' | 'sit' | 'fetch' | 'carry' | 'jump'
  let mode: Mode = 'lap'
  let s = 0 // arc length along the lap
  let timer = 0
  let sniffAt = -1
  let lapCount = 0
  let speed = 0
  let gait = 0
  const pos = new THREE.Vector3(-2, 0, 3)
  let heading = 0
  let airborne = false
  let jumpT = 0
  let jumpV = new THREE.Vector3()
  let jumpY0 = 0
  let carryingBall = false
  const home = new THREE.Vector3(1.5, 0, 4)
  const target = new THREE.Vector3()
  let resumeMode: Mode = 'lap'
  let panting: ReturnType<typeof Audio.loop> | null = null

  const planLap = () => {
    lapCount++
    sniffAt = rng() < 0.25 ? rng() * lapLen : -1
  }
  planLap()
  const tmp = new THREE.Vector3()
  const moveToward = (tgt: THREE.Vector3, v: number, dt: number): number => {
    tmp.copy(tgt).sub(pos)
    tmp.y = 0
    const d = tmp.length()
    if (d > 1e-4) {
      const stepLen = Math.min(d, v * dt)
      pos.addScaledVector(tmp.normalize(), stepLen)
      const h = Math.atan2(tmp.x, tmp.z)
      heading += wrap(h - heading) * Math.min(1, dt * 10)
      speed = v
    } else speed = 0
    return d
  }
  const ballPos = new THREE.Vector3()

  e.sim.add({
    step(dt) {
      const ball = getBall()
      const bt = ball.body.translation()
      ballPos.set(bt.x, bt.y, bt.z)
      // jump for an airborne ball close by
      if (mode !== 'jump' && mode !== 'sit' && !carryingBall && bt.y > 0.3 && bt.y < 1.2 && ballPos.distanceTo(pos.clone().setY(bt.y)) < 1.2 && ball.body.linvel().y !== 0) {
        resumeMode = mode === 'fetch' ? 'fetch' : 'lap'
        mode = 'jump'
        jumpT = 0
        jumpY0 = pos.y
        jumpV.set(Math.sin(heading) * 2.5, 2.45, Math.cos(heading) * 2.5)
        airborne = true
      }
      switch (mode) {
        case 'lap': {
          s = (s + 3.5 * dt) % lapLen
          if (sniffAt >= 0 && Math.abs(s - sniffAt) < 3.5 * dt * 1.5) {
            mode = 'sniff'
            timer = 2 + rng() * 2
            sniffAt = -1
          }
          if (s < 3.5 * dt) planLap()
          curve.getPointAt(s / lapLen, target)
          moveToward(target, 3.8, dt)
          break
        }
        case 'sniff':
        case 'sit': {
          speed = 0
          timer -= dt
          if (timer <= 0) mode = carryingBall ? 'carry' : 'lap'
          break
        }
        case 'fetch': {
          const d = moveToward(ballPos, 6, dt)
          if (d < 0.35 && bt.y < 0.4) {
            carryingBall = true
            ball.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true)
            mode = 'carry'
            Audio.play('studio.bark', {})
            panting = Audio.loop('studio.pant', { level: 0.6 })
          }
          break
        }
        case 'carry': {
          const d = moveToward(home, 4, dt)
          if (d < 0.5) {
            carryingBall = false
            ball.body.setBodyType(R.RigidBodyType.Dynamic, true)
            ball.body.setLinvel({ x: Math.sin(heading) * 0.6, y: 0.5, z: Math.cos(heading) * 0.6 }, true)
            panting?.stop(0.4)
            panting = null
            mode = 'lap'
            // rejoin the lap at the nearest point
            let best = 0
            let bd = 1e9
            for (let i = 0; i < 64; i++) {
              const dd = pathPolyline[i].distanceTo(pos)
              if (dd < bd) {
                bd = dd
                best = i
              }
            }
            s = (best / 64) * lapLen
          }
          break
        }
        case 'jump': {
          jumpT += dt
          pos.x += jumpV.x * dt
          pos.z += jumpV.z * dt
          pos.y = jumpY0 + jumpV.y * jumpT - 0.5 * 9.81 * jumpT * jumpT
          if (jumpT >= 0.5) {
            pos.y = 0
            airborne = false
            mode = resumeMode
          }
          break
        }
      }
      if (mode !== 'jump') pos.y = 0
      gait += (speed / 0.55) * dt * Math.PI * 2
      body.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z })
      const q = new THREE.Quaternion().setFromAxisAngle(UP, heading)
      body.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      if (carryingBall) {
        const mouth = new THREE.Vector3(0, 0.38, 0.42).applyQuaternion(q).add(pos)
        ball.body.setNextKinematicTranslation({ x: mouth.x, y: mouth.y, z: mouth.z })
      }
    },
  }, 20)
  const UP = new THREE.Vector3(0, 1, 0)
  e.sim.onPose(() => {
    const sitting = mode === 'sit' || mode === 'sniff'
    const amp = Math.min(1, speed / 3.5) * 0.7
    for (let i = 0; i < 4; i++) {
      const ph2 = gait + (i === 0 || i === 3 ? 0 : Math.PI)
      legs[i].rotation.x = sitting && i >= 2 ? -1.2 : Math.sin(ph2) * amp
      ;(legs[i].children[1] as THREE.Object3D).rotation.x = sitting && i >= 2 ? 1.6 : Math.max(0, -Math.sin(ph2)) * amp
    }
    root.children[0].position.y = sitting ? 0.27 : 0.33
    tail.rotation.z = Math.sin(e.sim.t * (sitting ? 9 : 14)) * 0.5
    head.rotation.x = mode === 'sniff' ? 0.6 : 0
  })

  const subject: PhotoSubject = {
    id: 'dot', tag: 'dot', dynamic: true, radius: 0.35,
    colliderHandle: body.body.collider(0).handle,
    center: (out) => out.copy(root.position).add(new THREE.Vector3(0, 0.33, 0)),
    sample: () => ({ airborne, sitting: mode === 'sit', speed }),
    extra(cam, W, H, phase): Record<string, number> {
      if (phase !== 'mid') return {}
      const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      let inside = 0
      const v = new THREE.Vector3()
      for (const p of pathPolyline) {
        v.set(p.x, 0.3, p.z).applyMatrix4(m)
        if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z > -1 && v.z < 1) inside++
      }
      void W
      void H
      return { pathCoverage: inside / pathPolyline.length }
    },
  }
  return {
    root, body, subject, pathPolyline,
    get airborne() {
      return airborne
    },
    sit(seconds = 3) {
      if (mode === 'jump') return
      mode = 'sit'
      timer = seconds
      Audio.play('studio.bark', {})
    },
    fetch(t) {
      if (carryingBall || mode === 'jump') return
      if (t.x < -12 || t.x > 14 || t.z < -8 || t.z > 16) return
      mode = 'fetch'
    },
    state: () => mode,
    setHome(p) {
      home.copy(p).setY(0)
    },
  }
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

// -------------------------------------------------------------------------------- sparrows
export function createSparrows(e: Engine, feeder: THREE.Vector3, perches: THREE.Vector3[], canopy: THREE.Vector3[], dotPos: () => THREE.Vector3, tripodPos: () => THREE.Vector3): Sparrows {
  const rng = e.rng('sparrows')
  const brown = mat(0x7a5a3c, { rough: 0.9 })
  const cream = mat(0xcdb898, { rough: 0.9 })
  type Bird = { root: THREE.Group; wings: THREE.Mesh[]; state: 'perch' | 'hop' | 'flee' | 'away' | 'return'; pos: THREE.Vector3; home: THREE.Vector3; target: THREE.Vector3; timer: number; flap: number; hopT: number; hopFrom: THREE.Vector3 }
  const birds: Bird[] = []
  const homes = [feeder.clone().add(new THREE.Vector3(0.15, 0.03, 0.1)), feeder.clone().add(new THREE.Vector3(-0.15, 0.03, -0.12)), perches[0], perches[1], perches[2]]
  for (let i = 0; i < 5; i++) {
    const root = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brown)
    body.scale.set(0.8, 0.8, 1.3)
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), cream)
    belly.position.set(0, -0.012, 0.005)
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), brown)
    headM.position.set(0, 0.03, 0.045)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 4), mat(0x3a2e25))
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.028, 0.075)
    const tailM = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.05), brown)
    tailM.position.set(0, 0.01, -0.065)
    tailM.rotation.x = -0.3
    root.add(body, belly, headM, beak, tailM)
    const wings: THREE.Mesh[] = []
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.05), brown)
      w.geometry.translate((s * 0.07) / 2, 0, 0)
      w.position.set(s * 0.025, 0.012, 0)
      root.add(w)
      wings.push(w)
    }
    root.traverse((o) => (o.castShadow = true))
    e.scene.add(root)
    const home = homes[i].clone()
    birds.push({ root, wings, state: i >= 3 ? 'hop' : 'perch', pos: home.clone(), home, target: home.clone(), timer: rng() * 2, flap: 0, hopT: 0, hopFrom: home.clone() })
  }
  let lastFlee = -10
  const flee = (_reason: string) => {
    if (e.sim.t - lastFlee < 1) return
    let any = false
    for (const b of birds) {
      if (b.state === 'flee' || b.state === 'away') continue
      b.state = 'flee'
      b.target.copy(canopy[Math.floor(rng() * canopy.length)] ?? new THREE.Vector3(-7, 6, 10))
      any = true
    }
    if (any) {
      lastFlee = e.sim.t
      Audio.play('studio.sparrows', { n: 4 })
      Audio.play('studio.flutter', {})
    }
  }
  e.bus.on('noise', (n) => {
    const d = n.pos.distanceTo(feeder)
    const k = n.loudness / Math.max(0.25, d * d)
    if (n.kind === 'shutter') {
      if (k > 0.02) flee('shutter')
    } else if (n.loudness > 0.3 && d < 1.5) flee('impact')
  })
  const tmp = new THREE.Vector3()
  e.sim.add({
    step(dt) {
      const dp = dotPos()
      if (dp.distanceTo(tmp.copy(feeder).setY(0)) < 1.2) flee('dot') // deviation: 2.5 m in the GDD, but the lap passes 0.2 m from the feeder
      if (tripodPos().distanceTo(tmp.copy(feeder).setY(0)) < 2.5) flee('tripod')
      for (const b of birds) {
        switch (b.state) {
          case 'perch':
          case 'hop': {
            b.timer -= dt
            if (b.hopT > 0) {
              b.hopT = Math.max(0, b.hopT - dt * 4)
              const u = 1 - b.hopT
              b.pos.lerpVectors(b.hopFrom, b.target, u)
              b.pos.y += Math.sin(u * Math.PI) * 0.06
            } else if (b.timer <= 0) {
              b.timer = 0.6 + rng() * 2.4
              if (b.state === 'hop') {
                b.hopFrom.copy(b.pos)
                const a = rng() * Math.PI * 2
                const r = rng() * 3
                b.target.set(feeder.x + Math.cos(a) * r, 0.02, feeder.z + Math.sin(a) * r)
                b.hopT = 1
                b.root.rotation.y = Math.atan2(b.target.x - b.pos.x, b.target.z - b.pos.z)
              } else b.root.rotation.y += (rng() - 0.5) * 1.5
            }
            break
          }
          case 'flee':
          case 'return': {
            tmp.copy(b.target).sub(b.pos)
            const d = tmp.length()
            const v = 7
            if (d < v * dt) {
              b.pos.copy(b.target)
              if (b.state === 'flee') {
                b.state = 'away'
                b.timer = 20 + rng() * 20
              } else {
                b.state = b.home.y > 0.5 ? 'perch' : 'hop'
                b.timer = 1
              }
            } else {
              b.pos.addScaledVector(tmp.normalize(), v * dt)
              b.root.rotation.y = Math.atan2(tmp.x, tmp.z)
            }
            b.flap += dt * 18 * Math.PI * 2
            break
          }
          case 'away': {
            b.timer -= dt
            if (b.timer <= 0) {
              b.state = 'return'
              b.target.copy(b.home)
            }
            break
          }
        }
      }
    },
  }, 21)
  e.sim.onPose(() => {
    for (const b of birds) {
      b.root.position.copy(b.pos)
      b.root.visible = b.state !== 'away'
      const flying = b.state === 'flee' || b.state === 'return'
      const a = flying ? Math.sin(b.flap) * 0.9 : 0.05
      b.wings[0].rotation.z = a
      b.wings[1].rotation.z = -a
    }
  })
  const subject: PhotoSubject = {
    id: 'sparrows', tag: 'sparrows', dynamic: true, radius: 0.5,
    center: (out) => {
      out.set(0, 0, 0)
      let n = 0
      for (const b of birds) if (b.state !== 'away') {
        out.add(b.pos)
        n++
      }
      return n ? out.multiplyScalar(1 / n) : out.copy(feeder)
    },
    sample: () => ({ flying: birds.filter((b) => b.state === 'flee' || b.state === 'return').length }),
  }
  return {
    flee, subject,
    roots: birds.map((b) => b.root),
    flying: () => birds.filter((b) => b.state === 'flee' || b.state === 'return').length,
    update() {},
  }
}

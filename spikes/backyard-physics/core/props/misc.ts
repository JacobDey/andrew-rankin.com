/**
 * Smaller yard props: the throwing ball, the sprinkler sled, the picnic table, the rusty
 * mailbox (hinged door + flag) and a box camera you can carry and shoot with.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { RevoluteImpulseJoint } from '@dimforge/rapier3d-compat'
import type { ColliderDesc } from '@dimforge/rapier3d-compat'
import { Layer, groups, type BodyBinding, type PhysicsWorld } from '../physics-world'
import { ballTexture, numberPlateTexture } from '../textures'

const PG = () => groups(Layer.PROP, Layer.ALL)

export function createBall(pw: PhysicsWorld, parent: Group, pos: Vector3, radius = 0.11): BodyBinding {
  const R = pw.R
  const m = new Mesh(new SphereGeometry(radius, 28, 18), new MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }))
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return pw.add(
    R.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setCcdEnabled(true)
      .setLinearDamping(0.05)
      // No rolling resistance in Rapier: angular damping stands in for the lawn.
      .setAngularDamping(0.9),
    [R.ColliderDesc.ball(radius).setMass(0.4).setRestitution(0.72).setFriction(0.9).setCollisionGroups(PG())],
    m,
    { tag: 'ball' },
  )
}

export interface SprinklerProp {
  binding: BodyBinding
  group: Group
  /** The rocking tube (rotate about local X by the sprinkler's armAngle). */
  tube: Group
}

export function createSprinklerProp(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0): SprinklerProp {
  const R = pw.R
  const g = new Group()
  const yellow = new MeshStandardMaterial({ color: 0xe8b425, roughness: 0.45 })
  const grey = new MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.35, metalness: 0.6 })
  const green = new MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.5 })
  const sled = new Mesh(new BoxGeometry(0.44, 0.025, 0.15), green)
  sled.position.y = 0.0125
  const gear = new Mesh(new BoxGeometry(0.08, 0.07, 0.09), yellow)
  gear.position.set(-0.23, 0.05, 0)
  const tube = new Group()
  tube.userData.animated = true // rocks with the sprinkler arm: keep it separate
  tube.position.y = 0.055
  const pipe = new Mesh(new CylinderGeometry(0.013, 0.013, 0.36, 10), grey)
  pipe.rotation.z = Math.PI / 2
  tube.add(pipe)
  for (let i = 0; i < 9; i++) {
    const nz = new Mesh(new CylinderGeometry(0.004, 0.004, 0.012, 5), grey)
    nz.position.set(-0.16 + i * 0.04, 0.014, 0)
    tube.add(nz)
  }
  const arc = new Mesh(new BoxGeometry(0.012, 0.05, 0.02), grey)
  arc.position.set(0.19, 0.03, 0)
  for (const m of [sled, gear, pipe, arc]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  g.add(sled, gear, tube, arc)
  parent.add(g)
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const binding = pw.add(
    R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    [
      R.ColliderDesc.cuboid(0.22, 0.0125, 0.075).setTranslation(0, 0.0125, 0).setMass(0.6).setFriction(0.9).setCollisionGroups(PG()),
      R.ColliderDesc.cuboid(0.04, 0.035, 0.045).setTranslation(-0.23, 0.05, 0).setMass(0.3).setCollisionGroups(PG()),
      R.ColliderDesc.capsule(0.17, 0.014).setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }).setTranslation(0, 0.055, 0).setMass(0.1).setCollisionGroups(PG()),
    ],
    g,
    { tag: 'sprinkler' },
  )
  return { binding, group: g, tube }
}

export function createPicnicTable(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0): BodyBinding {
  const R = pw.R
  const g = new Group()
  const wood = new MeshStandardMaterial({ color: 0x9a7650, roughness: 0.85 })
  const cols: ColliderDesc[] = []
  const plank = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0, collide = true) => {
    const m = new Mesh(new BoxGeometry(w, h, d), wood)
    m.position.set(x, y, z)
    m.rotation.z = rz
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    if (collide) {
      cols.push(
        R.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
          .setTranslation(x, y, z)
          .setRotation({ x: 0, y: 0, z: Math.sin(rz / 2), w: Math.cos(rz / 2) })
          .setDensity(520)
          .setFriction(0.7)
          .setCollisionGroups(PG()),
      )
    }
  }
  // Table top: 5 planks
  for (let i = 0; i < 5; i++) plank(1.8, 0.045, 0.14, 0, 0.745, -0.3 + i * 0.15, 0, false)
  cols.push(R.ColliderDesc.cuboid(0.9, 0.0225, 0.37).setTranslation(0, 0.745, 0).setDensity(520).setFriction(0.7).setCollisionGroups(PG()))
  // Benches
  for (const z of [-0.62, 0.62]) {
    plank(1.8, 0.04, 0.12, 0, 0.44, z - 0.065, 0, false)
    plank(1.8, 0.04, 0.12, 0, 0.44, z + 0.065, 0, false)
    cols.push(R.ColliderDesc.cuboid(0.9, 0.02, 0.125).setTranslation(0, 0.44, z).setDensity(520).setFriction(0.7).setCollisionGroups(PG()))
  }
  // A-frame legs (drawn as slanted posts at each end) and the bench cross-beams.
  for (const x of [-0.7, 0.7]) {
    for (const s of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.08, 0.9, 0.05), wood)
      leg.position.set(x, 0.42, s * 0.3)
      leg.rotation.x = s * 0.62
      leg.castShadow = true
      g.add(leg)
      const lq = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), s * 0.62)
      cols.push(
        R.ColliderDesc.cuboid(0.04, 0.45, 0.025)
          .setTranslation(x, 0.42, s * 0.3)
          .setRotation({ x: lq.x, y: lq.y, z: lq.z, w: lq.w })
          .setDensity(520)
          .setFriction(0.8)
          .setCollisionGroups(PG()),
      )
    }
    const beam = new Mesh(new BoxGeometry(0.06, 0.06, 1.5), wood)
    beam.position.set(x, 0.38, 0)
    beam.castShadow = true
    g.add(beam)
  }
  parent.add(g)
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  return pw.add(
    R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setAngularDamping(0.3),
    cols,
    g,
    { tag: 'table' },
  )
}

function rustTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = '#7d8a8f'
  x.fillRect(0, 0, 256, 128)
  let s = 77
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 260; i++) {
    const big = r() < 0.15
    x.fillStyle = r() < 0.5 ? `rgba(193,101,47,${0.4 + r() * 0.5})` : `rgba(122,51,36,${0.4 + r() * 0.5})`
    x.beginPath()
    x.ellipse(r() * 256, r() * 128, (big ? 10 : 2) + r() * 8, (big ? 6 : 1) + r() * 5, r() * 3, 0, Math.PI * 2)
    x.fill()
  }
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(90,40,25,${0.3 + r() * 0.3})`
    x.fillRect(r() * 256, r() * 128, 1 + r() * 2, 8 + r() * 30)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export interface Mailbox {
  door: BodyBinding
  flag: BodyBinding
}

/** The rusty mailbox on a post (static), with a hinged door and a flag you can raise. */
export function createMailbox(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0): Mailbox {
  const R = pw.R
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const rust = new MeshStandardMaterial({ map: rustTexture(), roughness: 0.75, metalness: 0.35 })
  const postMat = new MeshStandardMaterial({ color: 0x5e4a36, roughness: 0.9 })
  const g = new Group()
  g.position.copy(pos)
  g.quaternion.copy(q)
  const post = new Mesh(new BoxGeometry(0.09, 1.05, 0.09), postMat)
  post.position.y = 0.525
  post.castShadow = true
  g.add(post)
  // Box: half-cylinder roof on a box body (local +Z = door end).
  const body = new Mesh(new BoxGeometry(0.17, 0.12, 0.46), rust)
  body.position.set(0, 1.11, 0)
  const roof = new Mesh(new CylinderGeometry(0.085, 0.085, 0.46, 16, 1, false, -Math.PI / 2, Math.PI), rust)
  roof.rotation.x = Math.PI / 2
  roof.position.set(0, 1.17, 0)
  for (const m of [body, roof]) {
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  const plate = new Mesh(new BoxGeometry(0.002, 0.05, 0.1), new MeshStandardMaterial({ map: numberPlateTexture('16'), roughness: 0.6 }))
  plate.position.set(0.087, 1.1, 0.05)
  g.add(plate)
  parent.add(g)
  const fixed = pw.addStatic(
    [
      R.ColliderDesc.cuboid(0.045, 0.525, 0.045).setTranslation(0, 0.525, 0).setCollisionGroups(groups(Layer.STATIC, Layer.ALL)),
      R.ColliderDesc.cuboid(0.085, 0.1, 0.23).setTranslation(0, 1.13, 0).setCollisionGroups(groups(Layer.STATIC, Layer.ALL)),
    ],
    pos.x, pos.y, pos.z, q,
  )
  const toWorld = (v: Vector3) => v.clone().applyQuaternion(q).add(pos)

  // Door: hinged along its bottom edge (local X axis), at the +Z end.
  const doorG = new Group()
  const doorM = new Mesh(new BoxGeometry(0.17, 0.2, 0.012), rust)
  doorM.position.y = 0.1
  doorM.castShadow = true
  const handle = new Mesh(new BoxGeometry(0.03, 0.015, 0.02), new MeshStandardMaterial({ color: 0x3b3b3b, metalness: 0.6, roughness: 0.4 }))
  handle.position.set(0, 0.17, 0.012)
  doorG.add(doorM, handle)
  parent.add(doorG)
  const hingeLocal = new Vector3(0, 1.05, 0.236)
  const hw = toWorld(hingeLocal)
  const door = pw.add(
    R.RigidBodyDesc.dynamic().setTranslation(hw.x, hw.y, hw.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setAngularDamping(1.5),
    [R.ColliderDesc.cuboid(0.085, 0.1, 0.006).setTranslation(0, 0.1, 0).setMass(0.3).setCollisionGroups(PG())],
    doorG,
    { tag: 'mailbox-door' },
  )
  const dj = pw.world.createImpulseJoint(
    R.JointData.revolute({ x: hingeLocal.x, y: hingeLocal.y, z: hingeLocal.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    fixed,
    door.body,
    true,
  ) as RevoluteImpulseJoint
  dj.setLimits(0, 1.65)
  // Spring-loaded: pull it open, let go, it claps shut.
  dj.configureMotorPosition(0, 0.6, 0.05)
  dj.setContactsEnabled(false)

  // Flag: pivots about local X on the side of the box. Down = horizontal, up = vertical.
  const flagG = new Group()
  const red = new MeshStandardMaterial({ color: 0xc9302c, roughness: 0.5, metalness: 0.2 })
  const arm = new Mesh(new BoxGeometry(0.01, 0.018, 0.2), red)
  arm.position.z = -0.1
  const vane = new Mesh(new BoxGeometry(0.01, 0.07, 0.06), red)
  vane.position.set(0, 0.03, -0.19)
  arm.castShadow = vane.castShadow = true
  flagG.add(arm, vane)
  parent.add(flagG)
  const pivotLocal = new Vector3(-0.095, 1.12, 0.12)
  const pw_ = toWorld(pivotLocal)
  const flag = pw.add(
    R.RigidBodyDesc.dynamic().setTranslation(pw_.x, pw_.y, pw_.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setAngularDamping(2),
    [R.ColliderDesc.cuboid(0.005, 0.03, 0.12).setTranslation(0, 0.015, -0.12).setMass(0.08).setCollisionGroups(PG())],
    flagG,
    { tag: 'mailbox-flag' },
  )
  const fj = pw.world.createImpulseJoint(
    R.JointData.revolute({ x: pivotLocal.x, y: pivotLocal.y, z: pivotLocal.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    fixed,
    flag.body,
    true,
  ) as RevoluteImpulseJoint
  // 0 = flag down (horizontal), 1.62 rad = just past vertical, so a raised flag stays up.
  fj.setLimits(0, 1.62)
  fj.setContactsEnabled(false)
  return { door, flag }
}

export interface CameraProp {
  binding: BodyBinding
  /** Lens position/orientation in the body frame: looks down local -Z. */
  lensOffset: Vector3
}

/** A 1950s box camera: leatherette body, brass lens, a little viewfinder. 0.35 kg. */
export function createBoxCamera(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0): CameraProp {
  const R = pw.R
  const g = new Group()
  const leather = new MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.7 })
  const brass = new MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.3, metalness: 0.9 })
  const glass = new MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.2 })
  const body = new Mesh(new BoxGeometry(0.13, 0.1, 0.09), leather)
  const lens = new Mesh(new CylinderGeometry(0.026, 0.028, 0.03, 20), brass)
  lens.rotation.x = Math.PI / 2
  lens.position.z = -0.06
  const lensGlass = new Mesh(new CylinderGeometry(0.02, 0.02, 0.002, 20), glass)
  lensGlass.rotation.x = Math.PI / 2
  lensGlass.position.z = -0.0755
  const finder = new Mesh(new BoxGeometry(0.035, 0.025, 0.05), leather)
  finder.position.set(0.035, 0.0625, -0.01)
  const button = new Mesh(new CylinderGeometry(0.006, 0.006, 0.01, 8), brass)
  button.position.set(-0.04, 0.055, -0.02)
  const strap = new Mesh(new BoxGeometry(0.135, 0.008, 0.02), new MeshStandardMaterial({ color: 0x5a2a1b, roughness: 0.8 }))
  strap.position.y = 0.053
  for (const m of [body, lens, finder, button, strap]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  g.add(body, lens, lensGlass, finder, button, strap)
  parent.add(g)
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const binding = pw.add(
    R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    [
      R.ColliderDesc.cuboid(0.065, 0.05, 0.045).setMass(0.3).setFriction(0.7).setCollisionGroups(PG()),
      R.ColliderDesc.cylinder(0.015, 0.027)
        .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
        .setTranslation(0, 0, -0.06)
        .setMass(0.05)
        .setCollisionGroups(PG()),
    ],
    g,
    { tag: 'camera' },
  )
  return { binding, lensOffset: new Vector3(0, 0, -0.077) }
}

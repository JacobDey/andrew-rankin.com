/**
 * Tire swing: a rope of capsule links on spherical joints hanging from a fixed anchor, with a
 * tyre made of a ring of balls. Impulse joints plus a rope-joint length cap by default;
 * multibody (reduced-coordinate) joints are kept as an option (see TireSwingOptions.joints).
 */
import type { RigidBody } from '@dimforge/rapier3d-compat'
import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
  CylinderGeometry,
  Quaternion,
} from 'three'
import { Layer, groups, type BodyBinding, type PhysicsWorld } from '../physics-world'

export interface TireSwingOptions {
  /** World point under the branch where the rope is tied. */
  anchor: Vector3
  /** A fixed body (the tree) the rope hangs from. */
  anchorBody: RigidBody
  ropeLength?: number
  links?: number
  /** Tyre centre-line radius and tube radius (outer radius = sum). */
  ringRadius?: number
  tubeRadius?: number
  tireMass?: number
  /**
   * 'impulse' (default): impulse joints + a rope-joint length cap. Cheap, and impulses (grabber,
   * wind, throws) work. 'multibody': reduced coordinates, zero stretch, but links IGNORE
   * applyImpulse/setLinvel (only addForce moves them) and it costs ~5x more while swinging.
   */
  joints?: 'multibody' | 'impulse'
}

export interface TireSwing {
  tire: BodyBinding
  links: BodyBinding[]
  /** Push the tyre (impulse in N*s, world). */
  push(ix: number, iy: number, iz: number): void
  /** Rope stretch: distance from anchor to tyre top minus rope length (m). ~0 is good. */
  stretch(): number
}

export function createTireSwing(pw: PhysicsWorld, parent: Group, o: TireSwingOptions): TireSwing {
  const R = pw.R
  const L = o.ropeLength ?? 2.1
  const n = o.links ?? 8
  const ringR = o.ringRadius ?? 0.23
  const tubeR = o.tubeRadius ?? 0.11
  const tireMass = o.tireMass ?? 7
  const useMultibody = (o.joints ?? 'impulse') === 'multibody'
  const seg = L / n
  const ropeR = 0.018
  const anchor = o.anchor
  const at = o.anchorBody.translation()
  const ar = o.anchorBody.rotation()
  // Anchor in the tree body's local frame (tree is fixed; assume identity rotation if not).
  const anchorLocal = new Vector3(anchor.x - at.x, anchor.y - at.y, anchor.z - at.z)
  if (ar.w < 0.9999) console.warn('tire swing: anchor body is rotated; anchor may be off')

  const ropeMat = new MeshStandardMaterial({ color: 0xa88e62, roughness: 0.95 })
  const linkGeo = new CapsuleGeometry(ropeR, seg - ropeR * 2 + 0.01, 3, 6)
  const links: BodyBinding[] = []
  const ropeGroups = groups(Layer.ROPE, Layer.PROP)
  let prev: RigidBody = o.anchorBody
  let prevAnchor = { x: anchorLocal.x, y: anchorLocal.y, z: anchorLocal.z }
  const joint = (a: RigidBody, b: RigidBody, a1: { x: number; y: number; z: number }, a2: { x: number; y: number; z: number }) => {
    const data = R.JointData.spherical(a1, a2)
    if (useMultibody) {
      const j = pw.world.createMultibodyJoint(data, a, b, true)
      j.setContactsEnabled(false)
    } else {
      const j = pw.world.createImpulseJoint(data, a, b, true)
      j.setContactsEnabled(false)
    }
  }
  for (let i = 0; i < n; i++) {
    const cy = anchor.y - (i + 0.5) * seg
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(anchor.x, cy, anchor.z)
      .setLinearDamping(0.05)
      .setAngularDamping(0.4)
      .setCanSleep(true)
    if (!useMultibody) desc.setAdditionalSolverIterations(4)
    const mesh = new Mesh(linkGeo, ropeMat)
    mesh.castShadow = true
    parent.add(mesh)
    const b = pw.add(
      desc,
      [R.ColliderDesc.capsule(Math.max(0.001, seg / 2 - ropeR), ropeR).setMass(0.12).setCollisionGroups(ropeGroups)],
      mesh,
      { tag: 'rope', data: { index: i } },
    )
    joint(prev, b.body, prevAnchor, { x: 0, y: seg / 2, z: 0 })
    prev = b.body
    prevAnchor = { x: 0, y: -seg / 2, z: 0 }
    links.push(b)
  }

  // Tyre: vertical ring in the XY plane (hole faces +/-Z), rope tied over the top of the tread.
  const outer = ringR + tubeR
  const tireY = anchor.y - L - outer
  const tireGroup = new Group()
  const rubber = new MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.8 })
  const tyre = new Mesh(new TorusGeometry(ringR, tubeR, 14, 32), rubber)
  tyre.castShadow = true
  tyre.receiveShadow = true
  tireGroup.add(tyre)
  // Tread blocks hint
  const tread = new Mesh(new TorusGeometry(ringR + tubeR * 0.92, 0.012, 4, 48), new MeshStandardMaterial({ color: 0x2a2826, roughness: 1 }))
  tireGroup.add(tread)
  // Knot wrapping the top of the tyre
  const knot = new Mesh(new CylinderGeometry(tubeR * 1.15, tubeR * 1.15, 0.05, 10), ropeMat)
  knot.position.set(0, ringR, 0)
  knot.rotation.x = Math.PI / 2
  tireGroup.add(knot)
  parent.add(tireGroup)
  const balls = 12
  const tireCols = []
  for (let i = 0; i < balls; i++) {
    const a = (i / balls) * Math.PI * 2
    tireCols.push(
      R.ColliderDesc.ball(tubeR)
        .setTranslation(Math.cos(a) * ringR, Math.sin(a) * ringR, 0)
        .setMass(tireMass / balls)
        .setFriction(0.9)
        .setRestitution(0.25)
        .setCollisionGroups(groups(Layer.PROP, Layer.ALL)),
    )
  }
  const tdesc = R.RigidBodyDesc.dynamic()
    .setTranslation(anchor.x, tireY, anchor.z)
    .setLinearDamping(0.04)
    .setAngularDamping(0.3)
  if (!useMultibody) tdesc.setAdditionalSolverIterations(4)
  const tire = pw.add(tdesc, tireCols, tireGroup, { tag: 'tire' })
  joint(prev, tire.body, prevAnchor, { x: 0, y: outer - 0.02, z: 0 })
  if (!useMultibody) {
    // Impulse-joint chains stretch under a heavy end mass (7 kg tyre on 70 g links: ~11 cm at
    // a hard push). A rope joint straight from the branch to the tyre caps the length exactly.
    const rj = pw.world.createImpulseJoint(
      R.JointData.rope(L * 1.002, { x: anchorLocal.x, y: anchorLocal.y, z: anchorLocal.z }, { x: 0, y: outer - 0.02, z: 0 }),
      o.anchorBody,
      tire.body,
      true,
    )
    rj.setContactsEnabled(false)
  }

  return {
    tire,
    links,
    push(ix, iy, iz) {
      tire.body.applyImpulse({ x: ix, y: iy, z: iz }, true)
    },
    stretch() {
      const t = tire.body.translation()
      const r = tire.body.rotation()
      // top of tyre in world
      const top = new Vector3(0, outer - 0.02, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w))
      top.add(new Vector3(t.x, t.y, t.z))
      // Path length through the links
      let len = 0
      let last = anchor.clone()
      for (const l of links) {
        const lt = l.body.translation()
        const p = new Vector3(lt.x, lt.y, lt.z)
        len += p.distanceTo(last)
        last = p
      }
      len += last.distanceTo(top)
      return len - L
    },
  }
}

/**
 * Wheelbarrow: a compound frame (tray, handles, legs) plus a wheel on a revolute joint.
 * Grab a handle and lift: the legs leave the lawn and it rolls on the wheel.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three'
import type { ColliderDesc } from '@dimforge/rapier3d-compat'
import { Layer, groups, type BodyBinding, type PhysicsWorld } from '../physics-world'

export interface Wheelbarrow {
  frame: BodyBinding
  wheel: BodyBinding
}

export function createWheelbarrow(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0): Wheelbarrow {
  const R = pw.R
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const paint = new MeshStandardMaterial({ color: 0x2f6b4a, roughness: 0.55, metalness: 0.35 })
  const inside = new MeshStandardMaterial({ color: 0x5c5a52, roughness: 0.9, metalness: 0.2 })
  const wood = new MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 })
  const steel = new MeshStandardMaterial({ color: 0x77736c, roughness: 0.5, metalness: 0.7 })
  const PG = groups(Layer.PROP, Layer.ALL)

  // Local frame: +Z towards the wheel (front), handles towards -Z, origin on the ground.
  const frame = new Group()
  const cols: ColliderDesc[] = []
  const box = (
    hx: number, hy: number, hz: number,
    x: number, y: number, z: number,
    mat: MeshStandardMaterial,
    rotX = 0, rotZ = 0,
    collide = true,
    density = 600,
  ) => {
    const m = new Mesh(new BoxGeometry(hx * 2, hy * 2, hz * 2), mat)
    m.position.set(x, y, z)
    m.rotation.set(rotX, 0, rotZ)
    m.castShadow = true
    m.receiveShadow = true
    frame.add(m)
    if (collide) {
      const rq = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rotX).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotZ))
      cols.push(
        R.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(x, y, z)
          .setRotation({ x: rq.x, y: rq.y, z: rq.z, w: rq.w })
          .setDensity(density)
          .setFriction(0.7)
          .setCollisionGroups(PG),
      )
    }
  }
  const trayY = 0.46
  // Tray: floor + four flared walls (steel, ~1.2 mm sheet would be too thin to simulate: 2 cm walls).
  box(0.27, 0.012, 0.36, 0, trayY, 0.02, inside, 0, 0, true, 480)
  box(0.012, 0.15, 0.4, -0.31, trayY + 0.14, 0.02, paint, 0, 0.28, true, 480)
  box(0.012, 0.15, 0.4, 0.31, trayY + 0.14, 0.02, paint, 0, -0.28, true, 480)
  box(0.32, 0.15, 0.012, 0, trayY + 0.15, 0.43, paint, 0.45, 0, true, 480)
  box(0.3, 0.13, 0.012, 0, trayY + 0.13, -0.36, paint, -0.2, 0, true, 480)
  // Handles (wood), sloping up to the grips.
  box(0.022, 0.022, 0.62, -0.25, trayY - 0.04, -0.28, wood, 0.12, 0, true, 700)
  box(0.022, 0.022, 0.62, 0.25, trayY - 0.04, -0.28, wood, 0.12, 0, true, 700)
  // Grips
  box(0.03, 0.03, 0.09, -0.25, trayY + 0.05, -0.86, wood, 0.12, 0, false)
  box(0.03, 0.03, 0.09, 0.25, trayY + 0.05, -0.86, wood, 0.12, 0, false)
  // Legs (steel), resting on the lawn.
  box(0.016, 0.21, 0.016, -0.22, 0.21, -0.36, steel, 0, 0, true, 3000)
  box(0.016, 0.21, 0.016, 0.22, 0.21, -0.36, steel, 0, 0, true, 3000)
  box(0.03, 0.012, 0.06, -0.22, 0.012, -0.36, steel, 0, 0, true, 2000)
  box(0.03, 0.012, 0.06, 0.22, 0.012, -0.36, steel, 0, 0, true, 2000)
  // Wheel fork arms
  box(0.012, 0.02, 0.2, -0.07, 0.31, 0.5, steel, 0.5, 0, false)
  box(0.012, 0.02, 0.2, 0.07, 0.31, 0.5, steel, 0.5, 0, false)
  parent.add(frame)

  const wheelLocal = new Vector3(0, 0.2, 0.62)
  const frameBody = pw.add(
    R.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setAngularDamping(0.2),
    cols,
    frame,
    { tag: 'wheelbarrow' },
  )

  // Wheel: cylinder collider with its axis along local X.
  const wheel = new Group()
  const tyre = new Mesh(new TorusGeometry(0.16, 0.045, 10, 28), new MeshStandardMaterial({ color: 0x222120, roughness: 0.9 }))
  tyre.rotation.y = Math.PI / 2
  tyre.castShadow = true
  const hub = new Mesh(new CylinderGeometry(0.12, 0.12, 0.06, 18), new MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.5, metalness: 0.3 }))
  hub.rotation.z = Math.PI / 2
  hub.castShadow = true
  wheel.add(tyre, hub)
  parent.add(wheel)
  const wq = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
  const wp = wheelLocal.clone().applyQuaternion(q).add(pos)
  const wheelBody = pw.add(
    R.RigidBodyDesc.dynamic()
      .setTranslation(wp.x, wp.y, wp.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setAngularDamping(0.3),
    [
      R.ColliderDesc.cylinder(0.045, 0.205)
        .setRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w })
        .setMass(2.5)
        .setFriction(1.0)
        .setCollisionGroups(PG),
    ],
    wheel,
    { tag: 'wheel' },
  )
  const j = pw.world.createImpulseJoint(
    R.JointData.revolute({ x: wheelLocal.x, y: wheelLocal.y, z: wheelLocal.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    frameBody.body,
    wheelBody.body,
    true,
  )
  j.setContactsEnabled(false)
  return { frame: frameBody, wheel: wheelBody }
}

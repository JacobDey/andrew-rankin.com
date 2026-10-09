/**
 * Garden gnome: cast-resin, bottom-heavy, topples with a satisfying thunk. Compound collider
 * (body cylinder + head ball + hat cone), visual built from primitives.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { Layer, groups, type BodyBinding, type PhysicsWorld } from '../physics-world'

export function createGnome(pw: PhysicsWorld, parent: Group, pos: Vector3, yaw = 0, scale = 1): BodyBinding {
  const R = pw.R
  const s = scale
  const g = new Group()
  const glaze = (color: number, rough = 0.45) => new MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 })
  const add = (m: Mesh, x: number, y: number, z: number) => {
    m.position.set(x * s, y * s, z * s)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  // Base plinth
  add(new Mesh(new CylinderGeometry(0.13 * s, 0.14 * s, 0.035 * s, 20), glaze(0x6b6d5a, 0.8)), 0, 0.0175, 0)
  // Boots
  const boot = glaze(0x2b2420, 0.6)
  add(new Mesh(new SphereGeometry(0.05 * s, 12, 8), boot), -0.045, 0.05, 0.04).scale.set(1, 0.6, 1.5)
  add(new Mesh(new SphereGeometry(0.05 * s, 12, 8), boot), 0.045, 0.05, 0.04).scale.set(1, 0.6, 1.5)
  // Trousers + coat
  add(new Mesh(new CylinderGeometry(0.085 * s, 0.1 * s, 0.1 * s, 16), glaze(0x3a4f7a)), 0, 0.1, 0)
  add(new Mesh(new CylinderGeometry(0.075 * s, 0.115 * s, 0.2 * s, 18), glaze(0x2f7d4f)), 0, 0.23, 0)
  // Belt + buckle
  const belt = add(new Mesh(new TorusGeometry(0.098 * s, 0.012 * s, 6, 24), glaze(0x4a3221, 0.7)), 0, 0.19, 0)
  belt.rotation.x = Math.PI / 2
  add(new Mesh(new CylinderGeometry(0.018 * s, 0.018 * s, 0.01 * s, 4), glaze(0xd8b24a, 0.3)), 0, 0.19, 0.105).rotation.x = Math.PI / 2
  // Arms
  const arm = glaze(0x2f7d4f)
  const la = add(new Mesh(new CylinderGeometry(0.025 * s, 0.03 * s, 0.14 * s, 10), arm), -0.1, 0.26, 0.02)
  la.rotation.z = -0.5
  la.rotation.x = -0.4
  const ra = add(new Mesh(new CylinderGeometry(0.025 * s, 0.03 * s, 0.14 * s, 10), arm), 0.1, 0.26, 0.02)
  ra.rotation.z = 0.5
  ra.rotation.x = -0.4
  // Head, cheeks, nose, eyes
  const skin = glaze(0xf0c3a0, 0.5)
  add(new Mesh(new SphereGeometry(0.07 * s, 18, 14), skin), 0, 0.38, 0)
  add(new Mesh(new SphereGeometry(0.022 * s, 10, 8), glaze(0xe8907a, 0.4)), 0, 0.375, 0.07)
  add(new Mesh(new SphereGeometry(0.008 * s, 6, 6), glaze(0x111111, 0.2)), -0.025, 0.4, 0.06)
  add(new Mesh(new SphereGeometry(0.008 * s, 6, 6), glaze(0x111111, 0.2)), 0.025, 0.4, 0.06)
  // Beard
  const beard = add(new Mesh(new ConeGeometry(0.07 * s, 0.16 * s, 16, 1, true), glaze(0xf3efe6, 0.7)), 0, 0.29, 0.045)
  beard.rotation.x = Math.PI + 0.25
  // Hat
  const hat = add(new Mesh(new ConeGeometry(0.08 * s, 0.24 * s, 20), glaze(0xc9302c, 0.4)), 0, 0.53, -0.01)
  hat.rotation.x = -0.18
  add(new Mesh(new TorusGeometry(0.072 * s, 0.012 * s, 6, 20), glaze(0xc9302c, 0.4)), 0, 0.43, 0).rotation.x = Math.PI / 2
  parent.add(g)

  const PG = groups(Layer.PROP, Layer.ALL)
  return pw.add(
    R.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setAngularDamping(0.15),
    [
      // Heavy resin base: most of the 3 kg sits low.
      R.ColliderDesc.cylinder(0.09 * s, 0.13 * s).setTranslation(0, 0.09 * s, 0).setMass(2.2).setFriction(0.8).setRestitution(0.1).setCollisionGroups(PG),
      R.ColliderDesc.cylinder(0.07 * s, 0.09 * s).setTranslation(0, 0.25 * s, 0).setMass(0.5).setFriction(0.6).setCollisionGroups(PG),
      R.ColliderDesc.ball(0.075 * s).setTranslation(0, 0.38 * s, 0).setMass(0.25).setFriction(0.6).setCollisionGroups(PG),
      R.ColliderDesc.cone(0.12 * s, 0.075 * s).setTranslation(0, 0.53 * s, 0).setMass(0.05).setFriction(0.6).setCollisionGroups(PG),
    ],
    g,
    { tag: 'gnome' },
  )
}

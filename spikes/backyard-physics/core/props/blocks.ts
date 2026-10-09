/**
 * Domino runs and a giant tumble tower (Jenga-style), drawn with InstancedBodies.
 * Call `sleepAll()` on the result after the first world step: an untouched run then costs
 * nothing until the first domino tips. (Don't use RigidBodyDesc.setSleeping(true): bodies
 * created asleep have no contact manifolds when first woken and sink centimetres into the
 * floor before the solver catches them, which topples a domino run on its own.)
 */
import { BoxGeometry, CanvasTexture, CatmullRomCurve3, Color, Group, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { InstancedBodies } from '../instanced'
import { Layer, groups, type BodyBinding, type PhysicsWorld } from '../physics-world'

export interface DominoOptions {
  /** Path on the ground (y = surface height). */
  path: Vector3[]
  /** Thickness (along the path), height, width in metres. */
  size?: [number, number, number]
  spacing?: number
  max?: number
  density?: number
}

function pipTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = '#151515'
  x.fillRect(0, 0, 64, 128)
  x.fillStyle = '#efe9da'
  x.fillRect(6, 62, 52, 3)
  const pip = (px: number, py: number) => {
    x.beginPath()
    x.arc(px, py, 5.5, 0, Math.PI * 2)
    x.fill()
  }
  // 3 over 5
  pip(16, 16); pip(32, 32); pip(48, 48)
  pip(16, 80); pip(48, 80); pip(32, 96); pip(16, 112); pip(48, 112)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function createDominoRun(pw: PhysicsWorld, parent: Group, o: DominoOptions): BodyBinding[] {
  const R = pw.R
  const [t, h, w] = o.size ?? [0.035, 0.28, 0.14]
  const spacing = o.spacing ?? 0.17
  const curve = new CatmullRomCurve3(o.path, false, 'centripetal')
  const len = curve.getLength()
  const count = Math.min(o.max ?? 60, Math.floor(len / spacing) + 1)
  const face = new MeshStandardMaterial({ map: pipTexture(), roughness: 0.35 })
  const side = new MeshStandardMaterial({ color: 0x151515, roughness: 0.4 })
  // Box faces: +x, -x, +y, -y, +z, -z ; pips on the big faces (+/-z).
  const inst = new InstancedBodies(new BoxGeometry(w, h, t), [side, side, side, side, face, face], count)
  parent.add(inst.mesh)
  const out: BodyBinding[] = []
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const u = i / Math.max(1, count - 1)
    const p = curve.getPointAt(u)
    const tan = curve.getTangentAt(u).setY(0).normalize()
    // Local +Z (thin axis) along the path tangent.
    const yaw = Math.atan2(tan.x, tan.z)
    q.setFromAxisAngle(up, yaw)
    const proxy = inst.add()
    const b = pw.add(
      R.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y + h / 2 + 0.0005, p.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      [
        R.ColliderDesc.cuboid(w / 2, h / 2, t / 2)
          .setDensity(o.density ?? 700)
          .setFriction(0.45)
          .setRestitution(0.05)
          .setCollisionGroups(groups(Layer.PROP, Layer.ALL)),
      ],
      proxy,
      { tag: 'domino', data: { index: i } },
    )
    out.push(b)
  }
  inst.sync()
  ;(parent.userData.instanced ??= []).push(inst)
  return out
}

export interface TowerOptions {
  base: Vector3
  layers?: number
  /** Block length, height, width. Giant-garden-game size by default. */
  block?: [number, number, number]
  yaw?: number
}

export function createTumbleTower(pw: PhysicsWorld, parent: Group, o: TowerOptions): BodyBinding[] {
  const R = pw.R
  const layers = o.layers ?? 12
  const [L, H, W] = o.block ?? [0.25, 0.05, 0.083]
  const gap = 0.0015
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  const inst = new InstancedBodies(new BoxGeometry(L, H, W), mat, layers * 3)
  parent.add(inst.mesh)
  const out: BodyBinding[] = []
  const baseYaw = o.yaw ?? 0
  const up = new Vector3(0, 1, 0)
  const q = new Quaternion()
  const c = new Color()
  let seed = 99
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < layers; k++) {
    const yaw = baseYaw + (k % 2 === 0 ? 0 : Math.PI / 2)
    q.setFromAxisAngle(up, yaw)
    for (let i = -1; i <= 1; i++) {
      // Offset across the block width, in the layer's local Z.
      const off = new Vector3(0, 0, i * (W + gap)).applyQuaternion(q)
      const x = o.base.x + off.x
      const z = o.base.z + off.z
      const y = o.base.y + H / 2 + k * H + 0.0005
      c.setHSL(0.09 + rnd() * 0.03, 0.45 + rnd() * 0.15, 0.62 + rnd() * 0.12)
      const proxy = inst.add(c)
      const b = pw.add(
        R.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
        [
          R.ColliderDesc.cuboid(L / 2, H / 2, W / 2)
            .setDensity(450)
            .setFriction(0.55)
            .setRestitution(0.02)
            .setCollisionGroups(groups(Layer.PROP, Layer.ALL)),
        ],
        proxy,
        { tag: 'block', data: { layer: k, slot: i } },
      )
      out.push(b)
    }
  }
  inst.sync()
  ;(parent.userData.instanced ??= []).push(inst)
  return out
}

/** Put bodies to sleep (after at least one world step, so their contacts exist). */
export function sleepAll(bs: readonly BodyBinding[]): void {
  for (const b of bs) b.body.sleep()
}

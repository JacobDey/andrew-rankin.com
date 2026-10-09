/**
 * Laundry line: two T-posts, a sagging line, and pegged cloths (VerletCloth by default,
 * RapierSoftCloth optional). Spheres from the world (the ball, the tyre, the player's chest)
 * push the cloth; the ball gets pushed back.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three'
import { RapierSoftCloth, VerletCloth, type ClothSim, type ClothSphere } from '../cloth'
import { Layer, groups, type PhysicsWorld } from '../physics-world'
import type { WindField } from '../wind'

export interface LaundryItem {
  /** Start along the line (0..1) and width/height in metres. */
  at: number
  width: number
  height: number
  map: Texture
  /** Particle grid. */
  grid: [number, number]
  mass: number
  /** Number of pegs across the top edge. */
  pegs: number
}

export interface LaundryOptions {
  a: Vector3 // post A foot
  b: Vector3 // post B foot
  height?: number
  sag?: number
  items: LaundryItem[]
  backend?: 'verlet' | 'rapier'
  iterations?: number
  /** Step the cloth every N fixed steps (verlet only). 2 halves the cost on phones. */
  every?: number
}

export interface Laundry {
  cloths: ClothSim[]
  backend: 'verlet' | 'rapier'
  /** Fixed-step update: wind + collisions. */
  step(dt: number, wind: WindField, spheres: ClothSphere[]): void
  /** For the rapier backend: pull particles after world.step. */
  afterStep(): void
  render(alpha: number): void
  /** Point on the line at parameter t (0..1). */
  linePoint(t: number, out: Vector3): Vector3
  dispose(): void
}

export function createLaundryLine(pw: PhysicsWorld, parent: Group, o: LaundryOptions): Laundry {
  const R = pw.R
  const H = o.height ?? 1.95
  const sag = o.sag ?? 0.12
  const wood = new MeshStandardMaterial({ color: 0x8c8676, roughness: 0.85, metalness: 0.1 })
  const SG = groups(Layer.STATIC, Layer.ALL)
  // T-posts (galvanised pipe look)
  for (const p of [o.a, o.b]) {
    const post = new Mesh(new CylinderGeometry(0.035, 0.04, H + 0.15, 10), wood)
    post.position.set(p.x, (H + 0.15) / 2, p.z)
    post.castShadow = true
    parent.add(post)
    const bar = new Mesh(new BoxGeometry(0.05, 0.05, 0.7), wood)
    bar.position.set(p.x, H + 0.1, p.z)
    bar.castShadow = true
    parent.add(bar)
    pw.addStatic([R.ColliderDesc.cylinder((H + 0.15) / 2, 0.04).setCollisionGroups(SG)], p.x, (H + 0.15) / 2, p.z)
  }
  const ya = o.a.y + H
  const yb = o.b.y + H
  const linePoint = (t: number, out: Vector3) => {
    out.set(o.a.x + (o.b.x - o.a.x) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t), o.a.z + (o.b.z - o.a.z) * t)
    return out
  }
  const pts: Vector3[] = []
  for (let i = 0; i <= 24; i++) pts.push(linePoint(i / 24, new Vector3()))
  const line = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 48, 0.004, 4), new MeshStandardMaterial({ color: 0xdedad0, roughness: 0.6 }))
  line.castShadow = true
  parent.add(line)

  const dir = new Vector3().subVectors(o.b, o.a).setY(0).normalize()
  const down = new Vector3(0, -1, 0)
  const lineLen = new Vector3().subVectors(o.b, o.a).setY(0).length()
  const backend = o.backend ?? 'verlet'
  const cloths: ClothSim[] = []
  const pegMat = new MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.7 })
  const pegGeo = new BoxGeometry(0.018, 0.075, 0.03)
  for (const it of o.items) {
    const [nx, ny] = it.grid
    const t0 = it.at
    const origin = linePoint(t0, new Vector3())
    origin.y -= 0.01
    // Peg indices along the top row.
    const pegIdx: number[] = []
    for (let k = 0; k < it.pegs; k++) {
      const i = Math.round((k / Math.max(1, it.pegs - 1)) * (nx - 1))
      pegIdx.push(i)
    }
    let cloth: ClothSim
    const clothOpts = {
      width: it.width, height: it.height, nx, ny, mass: it.mass, iterations: o.iterations ?? 6,
      damping: 0.35, drag: 1.25, bend: 0.06, thickness: 0.03, groundY: 0,
    }
    if (backend === 'rapier') {
      cloth = new RapierSoftCloth(pw, origin, dir, down, clothOpts, pegIdx)
    } else {
      cloth = new VerletCloth(origin, dir, down, clothOpts)
    }
    // Pin pegs onto the sagging line.
    for (const i of pegIdx) {
      const t = t0 + (i / (nx - 1)) * (it.width / lineLen)
      const p = linePoint(t, new Vector3())
      p.y -= 0.01
      cloth.pin(cloth.index(i, 0), p)
      const peg = new Mesh(pegGeo, pegMat)
      peg.position.copy(p).setY(p.y + 0.012)
      peg.lookAt(peg.position.clone().add(new Vector3(-dir.z, 0, dir.x)))
      peg.castShadow = true
      parent.add(peg)
    }
    const mat = new MeshStandardMaterial({ map: it.map, side: DoubleSide, roughness: 0.92, metalness: 0 })
    const mesh = new Mesh(cloth.geometry, mat)
    mesh.userData.noMerge = true // dynamic geometry
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    parent.add(mesh)
    cloths.push(cloth)
  }

  const every = backend === 'rapier' ? 1 : Math.max(1, o.every ?? 1)
  let tick = 0
  let phase = 0
  return {
    cloths,
    backend,
    step(dt, wind, spheres) {
      phase = tick % every
      tick++
      if (phase !== 0) return
      for (const c of cloths) c.step(dt * every, wind, spheres)
    },
    afterStep() {
      if (backend !== 'rapier') return
      for (const c of cloths) (c as RapierSoftCloth).readBack()
    },
    render(alpha) {
      // With every > 1 the cloth state spans `every` physics steps: stretch alpha over them.
      const a = every === 1 ? alpha : (phase + alpha) / every
      for (const c of cloths) c.updateGeometry(a)
    },
    linePoint,
    dispose() {
      for (const c of cloths) c.dispose()
    },
  }
}

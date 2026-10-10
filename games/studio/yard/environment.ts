// Yard environment: lawn, maple, picket fence, A-frame, stump, feeder, picnic table, mailbox post, neighbours.
// Static colliders for everything props can hit (studio.md §6.1).
import * as THREE from 'three'
import type { Engine } from '../core/engine'
import type { Physics } from '../core/physics'
import { TEX } from '../core/textures'
import { box, mat } from '../house/architecture'
import { valueNoise1 } from '@shared/core'

export interface Environment {
  root: THREE.Group
  south: THREE.Mesh
  maple: THREE.Group
  canopy: THREE.Vector3[]
  feeder: THREE.Vector3
  fencePerches: THREE.Vector3[]
  stump: THREE.Vector3
  mailboxPost: THREE.Vector3
  groundY(x: number, z: number): number
  update(t: number, wind: number): void
}

export function createEnvironment(e: Engine, ph: Physics): Environment {
  const root = new THREE.Group()
  root.name = 'yard-env'
  e.scene.add(root)
  const R = ph.R
  const rng = e.rng('env')

  // lawn (x −12…14, z −8…16) with mown stripes baked in the texture tint per band
  const lawnTex = TEX.lawn()
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: lawnTex, roughness: 0.95 })
  lawnMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 1.0 + 0.06 * (mod(floor(vWp.x / 1.2), 2.0) * 2.0 - 1.0);')
  }
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(26, 24), lawnMat)
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(1, -0.005, 4)
  lawn.receiveShadow = true
  lawn.name = 'lawn'
  root.add(lawn)
  // the world beyond the fence
  // the diorama is cut through the earth at z = −8 (the front of the house); south of that cut a second ground
  // plane is shown only outside the overview, so the yard never looks off a cliff
  const farMat = new THREE.MeshStandardMaterial({ color: 0x4f6e33, roughness: 1 })
  const far = new THREE.Mesh(new THREE.PlaneGeometry(320, 168), farMat)
  far.rotation.x = -Math.PI / 2
  far.position.set(1, -0.03, 76)
  far.receiveShadow = true
  root.add(far)
  const south = new THREE.Mesh(new THREE.PlaneGeometry(320, 152), farMat)
  south.rotation.x = -Math.PI / 2
  south.position.set(1, -0.03, -84)
  south.name = 'south-ground'
  root.add(south)
  const strata = new THREE.MeshStandardMaterial({ color: 0xffffff, map: TEX.soil(), roughness: 1 })
  for (const [x0, x1] of [[-60, -12], [14, 60]]) box(x1 - x0, 3.2, 0.3, strata, (x0 + x1) / 2, -1.62, -7.85, root, false)
  ph.fixed([R.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(1, -0.5, 4).setFriction(0.9).setRestitution(0.2)])

  // picket fence 1.2 m: north z = 16, east x = 14, west x = −12 (z 0…16)
  const pickets: THREE.Matrix4[] = []
  const addRun = (x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) => {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.floor(L / 0.15)
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const x = x0 + (x1 - x0) * u
      const z = z0 + (z1 - z0) * u
      if (gap && ((x1 !== x0 && x > gap[0] && x < gap[1]) || (z1 !== z0 && z > gap[0] && z < gap[1]))) continue
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.6, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(x1 - x0, z1 - z0), (rng() - 0.5) * 0.03)), new THREE.Vector3(1, 1, 1))
      pickets.push(m)
    }
  }
  addRun(-12, 16, 14, 16, [11.2, 12.8])
  addRun(14, -8, 14, 16)
  addRun(-12, 0.2, -12, 16)
  const picketGeo = new THREE.BoxGeometry(0.08, 1.2, 0.02)
  const pos = picketGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.5) pos.setY(i, pos.getY(i) + (Math.abs(pos.getX(i)) < 0.01 ? 0.06 : 0))
  const picketMat = mat(0xf2ede2, { rough: 0.8 })
  const fence = new THREE.InstancedMesh(picketGeo, picketMat, pickets.length)
  pickets.forEach((m, i) => fence.setMatrixAt(i, m))
  fence.castShadow = true
  fence.receiveShadow = true
  root.add(fence)
  // rails
  box(26, 0.06, 0.04, picketMat, 1, 0.35, 15.97, root)
  box(26, 0.06, 0.04, picketMat, 1, 0.95, 15.97, root)
  box(0.04, 0.06, 24, picketMat, 13.97, 0.35, 4, root)
  box(0.04, 0.06, 24, picketMat, 13.97, 0.95, 4, root)
  box(0.04, 0.06, 15.8, picketMat, -11.97, 0.35, 8.1, root)
  box(0.04, 0.06, 15.8, picketMat, -11.97, 0.95, 8.1, root)
  ph.fixed([R.ColliderDesc.cuboid(13, 0.6, 0.05).setTranslation(1, 0.6, 16)])
  ph.fixed([R.ColliderDesc.cuboid(0.05, 0.6, 12).setTranslation(14, 0.6, 4)])
  ph.fixed([R.ColliderDesc.cuboid(0.05, 0.6, 8).setTranslation(-12, 0.6, 8)])
  const fencePerches = [new THREE.Vector3(9.5, 1.22, 15.95), new THREE.Vector3(10.4, 1.22, 15.95), new THREE.Vector3(13.95, 1.22, 7), new THREE.Vector3(13.95, 1.22, 8.2)]

  // maple at (−7, 0, 10) with the swing limb
  const maple = new THREE.Group()
  maple.position.set(-7, 0, 10)
  const bark = mat(0x5a4a3c, { rough: 1 })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 4.2, 10), bark)
  trunk.position.y = 2.1
  trunk.castShadow = true
  trunk.receiveShadow = true
  maple.add(trunk)
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 3.6, 8), bark)
  limb.position.set(1.4, 3.15, 0)
  limb.rotation.z = Math.PI / 2 - 0.18
  limb.castShadow = true
  maple.add(limb)
  const leafMats = [mat(0x3f6b2a, { rough: 0.9 }), mat(0x4f7d33, { rough: 0.9 }), mat(0x355a24, { rough: 0.9 })]
  const canopy: THREE.Vector3[] = []
  const blobs: THREE.Mesh[] = []
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2
    const r = 0.6 + rng() * 2.4
    const geo = new THREE.IcosahedronGeometry(1.1 + rng() * 0.9, 1)
    const b = new THREE.Mesh(geo, leafMats[i % 3])
    b.position.set(Math.cos(a) * r + 0.4, 4.4 + rng() * 2.2, Math.sin(a) * r)
    b.scale.set(1, 0.75 + rng() * 0.3, 1)
    b.castShadow = true
    b.receiveShadow = true
    ;(geo as THREE.BufferGeometry).computeVertexNormals()
    maple.add(b)
    blobs.push(b)
    if (i % 3 === 0) canopy.push(b.position.clone().add(maple.position).add(new THREE.Vector3(0, -0.6, 0)))
  }
  root.add(maple)
  ph.fixed([R.ColliderDesc.cylinder(2.1, 0.3).setTranslation(0, 2.1, 0)], [-7, 0, 10])

  // stump with the pinhole can at (1, 0, 3)
  const stump = new THREE.Vector3(1, 0, 3)
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 12), bark)
  st.position.set(1, 0.225, 3)
  st.castShadow = true
  st.receiveShadow = true
  root.add(st)
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mat(0xc8a97e, { map: TEX.wood('ash') }))
  ring.rotation.x = -Math.PI / 2
  ring.position.set(1, 0.452, 3)
  root.add(ring)
  ph.fixed([R.ColliderDesc.cylinder(0.225, 0.35).setTranslation(1, 0.225, 3)])

  // A-frame (old swing set) at x 5–7, z 12, crossbar 3.6 m
  const steel = mat(0x8a3a2c, { rough: 0.6, metal: 0.3 })
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.9, 6)
  for (const x of [4.6, 7.4])
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, steel)
      leg.position.set(x, 1.8, 12 + s * 0.55)
      leg.rotation.x = s * 0.3
      leg.castShadow = true
      root.add(leg)
    }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.0, 8), steel)
  bar.rotation.z = Math.PI / 2
  bar.position.set(6, 3.6, 12)
  bar.castShadow = true
  root.add(bar)
  for (const x of [4.6, 7.4]) ph.fixed([R.ColliderDesc.cuboid(0.05, 1.8, 0.6).setTranslation(x, 1.8, 12)])
  // chalk X under the lantern
  const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 1 }))
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const c = chalk.clone()
    c.rotation.set(-Math.PI / 2, 0, r)
    c.position.set(6, 0.004, 12)
    root.add(c)
  }

  // bird feeder at (8.5, 1.6, 5)
  const feeder = new THREE.Vector3(8.5, 1.6, 5)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mat(0x3a3a38, { metal: 0.5, rough: 0.5 }))
  pole.position.set(8.5, 0.8, 5)
  pole.castShadow = true
  root.add(pole)
  box(0.5, 0.04, 0.5, mat(0x8a6a48, { map: TEX.wood('bench') }), 8.5, 1.6, 5, root)
  const hut = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.25, 4), mat(0x7e1f1a))
  hut.position.set(8.5, 1.92, 5)
  hut.rotation.y = Math.PI / 4
  hut.castShadow = true
  root.add(hut)
  ph.fixed([R.ColliderDesc.cylinder(0.8, 0.04).setTranslation(8.5, 0.8, 5)])

  // picnic table at (−1, 0, 12)
  const tw = mat(0x9a7450, { map: TEX.wood('bench') })
  box(1.9, 0.06, 0.8, tw, -1, 0.75, 12, root)
  for (const s of [-1, 1]) {
    box(1.9, 0.05, 0.28, tw, -1, 0.45, 12 + s * 0.65, root)
    box(0.08, 0.75, 0.08, tw, -1 + s * 0.8, 0.37, 12.3, root)
    box(0.08, 0.75, 0.08, tw, -1 + s * 0.8, 0.37, 11.7, root)
  }
  ph.fixed([R.ColliderDesc.cuboid(0.95, 0.03, 0.4).setTranslation(-1, 0.75, 12)])
  ph.fixed([R.ColliderDesc.cuboid(0.95, 0.03, 0.14).setTranslation(-1, 0.45, 12.65)])
  ph.fixed([R.ColliderDesc.cuboid(0.95, 0.03, 0.14).setTranslation(-1, 0.45, 11.35)])

  // mailbox post at (12, 0, 15.2) (the box itself lives in house/mailbox.ts)
  const mailboxPost = new THREE.Vector3(12, 0, 15.2)
  box(0.1, 1.05, 0.1, mat(0x6b5a48, { map: TEX.wood('bench') }), 12, 0.52, 15.2, root)
  ph.fixed([R.ColliderDesc.cuboid(0.05, 0.55, 0.05).setTranslation(12, 0.55, 15.2)])

  // neighbours: rooftops and tree silhouettes beyond the fence
  const nb = mat(0x6d6a72, { rough: 1 })
  const nbRoof = mat(0x5a4440, { rough: 1 })
  for (let i = 0; i < 6; i++) {
    const x = -20 + i * 9 + rng() * 3
    const z = 26 + rng() * 6
    const w = 6 + rng() * 3
    box(w, 3.2, 6, nb, x, 1.6, z, root, false)
    const rf = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 2.2, 4), nbRoof)
    rf.position.set(x, 4.3, z)
    rf.rotation.y = Math.PI / 4
    root.add(rf)
  }
  const treeMat = mat(0x2e4a26, { rough: 1 })
  for (let i = 0; i < 14; i++) {
    const a = rng()
    const x = -30 + a * 62
    const z = 20 + rng() * 14
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.4 + rng(), 5 + rng() * 4, 7), treeMat)
    t.position.set(x, 2.6, z)
    root.add(t)
  }
  // a side hedge east of the house
  box(0.6, 1.0, 7.5, mat(0x3c5e2a, { rough: 1 }), 13.3, 0.5, -4.2, root)

  const t0 = new THREE.Vector3()
  return {
    root,
    south,
    maple,
    canopy,
    feeder,
    fencePerches,
    stump,
    mailboxPost,
    groundY: () => 0,
    update(t, wind) {
      // maple sway ∝ wind
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i]
        const s = 0.012 * wind * valueNoise1(t * 0.7 + i * 3.1, 5)
        b.rotation.z = s
        b.rotation.x = s * 0.6
      }
      void t0
    },
  }
}

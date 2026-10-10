// The house (studio.md §6.1): garage workshop (west), kitchen and hall (centre), the basement darkroom under
// the kitchen in a soil section, the cutaway front, and the roof that lifts off in the overview.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import type { Engine } from '../core/engine'
import { LAYER_EYE } from '../core/engine'
import type { Physics } from '../core/physics'
import { TEX } from '../core/textures'

export interface House {
  root: THREE.Group
  roof: THREE.Group
  setRoofLifted(on: boolean, instant?: boolean): void
  basementGlow: THREE.Mesh
  /** anchors for overview tags */
  anchors: Record<'yard' | 'workshop' | 'hall' | 'darkroom', THREE.Vector3>
  backDoor: THREE.Object3D
  basementDoor: THREE.Object3D
  garageDoor: THREE.Object3D
  sideDoor: THREE.Object3D
}

const WALL_H = 2.7
const T = 0.14

export function mat(color: number, o: { map?: THREE.Texture; rough?: number; metal?: number; emissive?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, map: o.map ?? null, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.emissive ?? 0 })
}

export function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z)
  mesh.castShadow = shadows
  mesh.receiveShadow = true
  parent?.add(mesh)
  return mesh
}

/** A wall at constant z (axis 'x') or constant x (axis 'z') from u0 to u1 with openings [ua, ub, ya, yb]. */
function wall(parent: THREE.Object3D, axis: 'x' | 'z', c: number, u0: number, u1: number, y0: number, h: number, m: THREE.Material, holes: [number, number, number, number][] = []): void {
  const put = (ua: number, ub: number, ya: number, yb: number) => {
    const w = ub - ua
    const u = (ua + ub) / 2
    const y = (ya + yb) / 2
    if (axis === 'x') box(w, yb - ya, T, m, u, y, c, parent)
    else box(T, yb - ya, w, m, c, y, u, parent)
  }
  let cur = u0
  const sorted = [...holes].sort((a, b) => a[0] - b[0])
  for (const hl of sorted) {
    if (hl[0] > cur) put(cur, hl[0], y0, y0 + h)
    if (hl[2] > y0) put(hl[0], hl[1], y0, hl[2])
    if (hl[3] < y0 + h) put(hl[0], hl[1], hl[3], y0 + h)
    cur = hl[1]
  }
  if (cur < u1) put(cur, u1, y0, y0 + h)
}
const wallX = (p: THREE.Object3D, z: number, x0: number, x1: number, y0: number, h: number, m: THREE.Material, holes: [number, number, number, number][] = []) => wall(p, 'x', z, x0, x1, y0, h, m, holes)
const wallZ = (p: THREE.Object3D, x: number, z0: number, z1: number, y0: number, h: number, m: THREE.Material, holes: [number, number, number, number][] = []) => wall(p, 'z', x, z0, z1, y0, h, m, holes)

export function createHouse(e: Engine, ph: Physics): House {
  const root = new THREE.Group()
  root.name = 'house'
  e.scene.add(root)
  const R = ph.R

  const clap = mat(0xffffff, { map: TEX.clapboard() })
  const inner = mat(0xe8e0cf, { rough: 0.95 })
  const innerGarage = mat(0xcfc6b3, { rough: 0.95 })
  const trim = mat(0xf4efe4)

  // floors
  box(6, 0.1, 8, mat(0xb0aaa0, { map: TEX.slab() }), -9, -0.05, -4, root).castShadow = false
  const kitchenFloor = box(8, 0.25, 8, mat(0xffffff, { map: TEX.linoleum() }), -2, -0.125, -4, root)
  kitchenFloor.castShadow = false

  // back wall (north, z = 0): garage window, back door; outside clapboard
  wallX(root, 0, -12, 2, 0, WALL_H, clap, [
    [-9.8, -8.2, 1.0, 2.0], // garage north window
    [-1.45, -0.55, 0, 2.1], // back door
    [0.4, 1.4, 1.0, 1.9], // kitchen window
  ])
  // west, east walls and the partition
  wallZ(root, -12, -8, 0, 0, WALL_H, clap)
  wallZ(root, 2, -8, 0, 0, WALL_H, clap, [[-5.2, -4.3, 0, 2.1]]) // side door to the side lawn? (kitchen east door)
  wallZ(root, -6, -8, 0, 0, WALL_H, innerGarage, [[-2.4, -1.5, 0, 2.1]]) // garage ↔ kitchen
  // garage side door to the yard (north wall already has the window; side door on the west wall near the yard)
  // interior skins (slightly inside) for warmth
  box(5.7, WALL_H, 0.02, innerGarage, -9, WALL_H / 2, -0.08, root, false)
  // window panes (eye sees through; thin glass)
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe3f2, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0 })
  box(1.6, 1.0, 0.02, glass, -9, 1.5, 0, root, false)
  box(1.0, 0.9, 0.02, glass, 0.9, 1.45, 0, root, false)
  // trims
  box(1.75, 0.08, 0.2, trim, -9, 0.96, 0.05, root)
  box(1.1, 0.08, 0.2, trim, 0.9, 0.96, 0.05, root)

  // back door + screen door (a frame) – clickable to go to the yard / hall
  const backDoor = new THREE.Group()
  backDoor.name = 'back-door'
  const doorMat = mat(0x2c7547, { rough: 0.6 })
  box(0.86, 2.06, 0.05, doorMat, 0, 1.03, 0, backDoor)
  box(0.08, 0.08, 0.06, mat(0xb08d3c, { metal: 0.8, rough: 0.35 }), 0.32, 1.0, 0.05, backDoor)
  backDoor.position.set(-1, 0, 0.03)
  root.add(backDoor)
  // porch step
  box(1.6, 0.18, 0.7, mat(0x9a948a, { map: TEX.slab() }), -1, 0.09, 0.4, root)

  // patio slab (x −6…0, z 0…2.5)
  box(6, 0.06, 2.5, mat(0xa49d92, { map: TEX.slab() }), -3, 0.03, 1.25, root).castShadow = false

  // garage door (big, on the south side would be cut; we put a roll door on the west) and the side door to the yard
  const sideDoor = new THREE.Group()
  sideDoor.name = 'side-door'
  box(0.84, 2.0, 0.05, mat(0x6b4a2e, { map: TEX.wood('bench') }), 0, 1.0, 0, sideDoor)
  sideDoor.position.set(-6.9, 0, 0.03)
  root.add(sideDoor)
  const garageDoor = sideDoor

  // basement door inside the kitchen (east part of the back wall interior, leads down)
  const basementDoor = new THREE.Group()
  basementDoor.name = 'basement-door'
  box(0.84, 2.0, 0.05, mat(0x7e1f1a, { rough: 0.7 }), 0, 1.0, 0, basementDoor)
  box(0.5, 0.12, 0.01, mat(0xece0b8), 0, 1.55, 0.03, basementDoor)
  basementDoor.rotation.y = -Math.PI / 2
  basementDoor.position.set(1.92, 0, -4.75)
  root.add(basementDoor)

  // ------------------------------------------------------------- basement and soil section
  const soilMat = mat(0xffffff, { map: TEX.soil(), rough: 1 })
  const soilTop = -0.26
  const yb = -3.2
  const soil = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    box(x1 - x0, y1 - y0, z1 - z0, soilMat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, root, false)
  soil(-12, -5, yb, soilTop + 0.15, -8, 0)
  soil(0, 14, yb, soilTop + 0.15, -8, 16)
  soil(-12, -5, yb, soilTop + 0.15, 0, 16)
  soil(-5, 0, yb, soilTop + 0.15, 0, 16)
  soil(-5, 0, yb, -2.6, -8, -3)
  soil(-5, 0, -2.6, soilTop, -3, 0)
  // darkroom walls (painted dark) inside the cavity
  const dw = mat(0x3a3330, { rough: 1 })
  box(5, 2.35, 0.05, dw, -2.5, -1.43, -3.03, root, false)
  box(0.05, 2.35, 5, dw, -4.97, -1.43, -5.5, root, false)
  box(0.05, 2.35, 5, dw, -0.03, -1.43, -5.5, root, false)
  box(5, 0.05, 5, mat(0x4a4440, { rough: 1 }), -2.5, -2.6, -5.5, root, false)
  // the basement glow card (eye-only; reads as a red-lit room in the overview)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3a1c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  glowMat.toneMapped = true
  const basementGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.3), glowMat)
  basementGlow.position.set(-2.5, -1.45, -7.9)
  basementGlow.rotation.y = Math.PI
  basementGlow.layers.set(LAYER_EYE)
  basementGlow.raycast = () => {}
  root.add(basementGlow)

  // ------------------------------------------------------------- roof
  const roof = new THREE.Group()
  roof.name = 'roof'
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3b36, roughness: 0.9, transparent: true, opacity: 1 })
  const ridge = WALL_H + 1.8
  const span = 4.3
  const slope = Math.hypot(span, ridge - WALL_H)
  const ang = Math.atan2(ridge - WALL_H, span)
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.12, slope + 0.2), roofMat)
    p.position.set(-5, (WALL_H + ridge) / 2, -4 + (s * span) / 2)
    p.rotation.x = s * ang
    p.castShadow = true
    p.receiveShadow = true
    roof.add(p)
  }
  // gables
  const gable = new THREE.Shape([new THREE.Vector2(-4.15, 0), new THREE.Vector2(4.15, 0), new THREE.Vector2(0, ridge - WALL_H)])
  for (const x of [-12, 2]) {
    const g = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshStandardMaterial({ color: 0xede6d6, side: THREE.DoubleSide, transparent: true, opacity: 1 }))
    g.position.set(x, WALL_H, -4)
    g.rotation.y = Math.PI / 2
    g.castShadow = true
    roof.add(g)
  }
  // chimney
  const ch = box(0.6, 1.6, 0.6, new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.9, transparent: true, opacity: 1 }), -2.2, ridge - 0.1, -2.6, roof)
  ch.castShadow = true
  root.add(roof)

  let roofU = 0
  let roofTarget = 0
  e.onFrame((dt) => {
    if (roofU === roofTarget) return
    const k = dt / 0.4
    roofU = roofTarget > roofU ? Math.min(roofTarget, roofU + k) : Math.max(roofTarget, roofU - k)
    applyRoof()
  })
  const applyRoof = () => {
    roof.position.y = 3 * roofU
    roof.visible = roofU < 0.999
    roof.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && 'opacity' in m) m.opacity = 1 - roofU
    })
  }

  // ------------------------------------------------------------- colliders (walls, floors) for props
  ph.fixed([R.ColliderDesc.cuboid(7, 0.1, 4).setTranslation(-5, -0.1, -4)])
  ph.fixed([R.ColliderDesc.cuboid(7, T / 2, 0.08).setTranslation(-5, WALL_H / 2, 0)])
  ph.fixed([R.ColliderDesc.cuboid(3, 0.03, 1.25).setTranslation(-3, 0.03, 1.25)])

  return {
    root,
    roof,
    basementGlow,
    setRoofLifted(on, instant) {
      roofTarget = on ? 1 : 0
      if (instant || !e.quality.transitions || e.reducedMotion) {
        roofU = roofTarget
        applyRoof()
      } else if (on) Audio.play('ui.thunk', {})
    },
    anchors: {
      yard: new THREE.Vector3(2, 1.5, 9),
      workshop: new THREE.Vector3(-9, 3.2, -4),
      hall: new THREE.Vector3(-2, 3.2, -4),
      darkroom: new THREE.Vector3(-2.5, -1.2, -7.5),
    },
    backDoor,
    basementDoor,
    garageDoor,
    sideDoor,
  }
}

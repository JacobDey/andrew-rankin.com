import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { DevelopingPrintMaterial } from '../developingPrint'
import type { SurfaceDitherUniforms } from '../OneBitPass'
import { applyLineId } from '../lineId'

/**
 * A period ship's cabin fitted out as a darkroom, all primitives:
 * plank floor / tumblehome hull walls / deck beams, a porthole letting in a moonbeam,
 * a bench with three trays (a print developing in the first), bottle shelf (one ribbed
 * poison bottle, a cobalt bottle, a red safelight), a hanging lantern (point light,
 * shadows, swinging), a half-plate field camera on a tripod, a plate rack with glass
 * negatives, a negative on an easel against the porthole, and a drying line.
 *
 * Static parts are merged per material (one draw call per material) — the pattern the
 * games should copy for phones.
 */

export interface Cabin {
  scene: THREE.Scene
  lantern: {
    pivot: THREE.Group
    light: THREE.PointLight
    flame: THREE.Mesh
    /** Pendulum state, radians and rad/s, about X and Z. */
    swing: { ax: number; az: number; vx: number; vz: number }
  }
  moon: THREE.SpotLight
  hemi: THREE.HemisphereLight
  print: THREE.Mesh<THREE.PlaneGeometry, DevelopingPrintMaterial>
  printMaterial: DevelopingPrintMaterial
  negatives: DevelopingPrintMaterial[]
  dryingLine: THREE.Group
  easelPlate: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  tripodCamera: THREE.Group
  setPhoto(tex: THREE.Texture, negTex: THREE.Texture): void
  setShadows(on: boolean, mapSize?: number): void
  drawCalls(): number
}

const lambert = (hex: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...extra })

class Merger {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private s = new THREE.Vector3(1, 1, 1)
  private p = new THREE.Vector3()
  /** Line ID for the next pieces: null = a fresh ID per piece (every part gets seams). */
  private groupId: number | null = null
  private nextId = 1

  /** Start a multi-part object that shares one line ID (no seams between its parts). */
  begin(): void { this.groupId = this.nextId++ }
  end(): void { this.groupId = null }

  private push(g: THREE.BufferGeometry, mat: THREE.Material): void {
    const id = this.groupId ?? this.nextId++
    const n = (g.attributes.position as THREE.BufferAttribute).count
    g.setAttribute('lineId', new THREE.BufferAttribute(new Float32Array(n).fill(((id - 1) % 63) + 1), 1))
    const list = this.buckets.get(mat) ?? []
    list.push(g)
    this.buckets.set(mat, list)
  }

  add(geom: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3Like, rot: THREE.Vector3Like = { x: 0, y: 0, z: 0 }): void {
    this.e.set(rot.x, rot.y, rot.z)
    this.q.setFromEuler(this.e)
    this.p.set(pos.x, pos.y, pos.z)
    this.m.compose(this.p, this.q, this.s)
    this.push(geom.clone().applyMatrix4(this.m), mat)
  }
  addMatrix(geom: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4): void {
    this.push(geom.clone().applyMatrix4(m), mat)
  }
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), mat, { x, y, z }, { x: rx, y: ry, z: rz })
  }
  cyl(mat: THREE.Material, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, { x, y, z }, { x: rx, y: ry, z: rz })
  }
  build(parent: THREE.Object3D, cast = true, receive = true): number {
    let n = 0
    for (const [mat, list] of this.buckets) {
      const geoms = list.map((g) => (g.index ? g.toNonIndexed() : g))
      for (const g of geoms) {
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'lineId'].includes(name)) g.deleteAttribute(name)
      }
      const merged = mergeGeometries(geoms, false)
      if (!merged) throw new Error('merge failed')
      if (!patched.has(mat)) { applyLineId(mat, { attribute: 'lineId' }); patched.add(mat) }
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = cast
      mesh.receiveShadow = receive
      mesh.matrixAutoUpdate = false
      parent.add(mesh)
      n++
      for (const g of list) g.dispose()
    }
    this.buckets.clear()
    return n
  }
}

const patched = new WeakSet<THREE.Material>()

function lathe(points: [number, number][], seg = 14): THREE.LatheGeometry {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg)
}

/** Ribbed poison bottle: vertical ribs pushed out on alternate radial segments. */
function ribbedBottle(): THREE.BufferGeometry {
  const g = lathe([[0, 0], [0.038, 0], [0.04, 0.005], [0.04, 0.12], [0.03, 0.15], [0.013, 0.17], [0.013, 0.2], [0.016, 0.205], [0, 0.205]], 24)
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = Math.hypot(v.x, v.z)
    if (v.y > 0.006 && v.y < 0.125 && r > 0.03) {
      const a = Math.atan2(v.z, v.x)
      const rib = 1 + 0.12 * Math.max(0, Math.cos(a * 12))
      v.x *= rib
      v.z *= rib
      pos.setXYZ(i, v.x, v.y, v.z)
    }
  }
  g.computeVertexNormals()
  return g
}

export function buildCabin(photo: THREE.Texture, negative: THREE.Texture, grain: SurfaceDitherUniforms | null): Cabin {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')

  const mat = {
    floor: lambert('#8a6a4a'),
    floor2: lambert('#7a5c40'),
    wall: lambert('#9a7b58'),
    wall2: lambert('#8b6d4c'),
    rib: lambert('#5e4630'),
    beam: lambert('#4f3a27'),
    deck: lambert('#6b5038'),
    bench: lambert('#a88a64'),
    darkWood: lambert('#3e2e20'),
    brass: lambert('#b8964a'),
    iron: lambert('#2b2a28'),
    tray: lambert('#d9d4c8'),
    trayDark: lambert('#2a2826'),
    liquid: lambert('#0c0d0e'),
    glass: lambert('#c9d0cf'),
    bottleBrown: lambert('#5a3a1c'),
    bottleGreen: lambert('#3f5a3a'),
    cobalt: lambert('#1f3f9a'),
    stoneware: lambert('#cfc6b2'),
    red: lambert('#a8251c'),
    cloth: lambert('#1a1816'),
    rope: lambert('#b39d76'),
    paper: lambert('#efe9dc'),
    leather: lambert('#3a2618'),
    porthole: new THREE.MeshBasicMaterial({ color: '#dfe6ea' }),
    flame: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
  }

  const statics = new THREE.Group()
  statics.name = 'statics'
  scene.add(statics)
  const M = new Merger()

  // ---- room shell ------------------------------------------------------------
  const X0 = -1.8, X1 = 1.8, Z0 = -2.8, Z1 = 1.8
  const depth = Z1 - Z0
  // Floor planks along z with gaps.
  // Planks abut (no gaps): seams would draw an outline per plank and drown the room.
  for (let i = 0, x = X0; x < X1 - 0.01; i++, x += 0.165) {
    M.box(i % 3 === 1 ? mat.floor2 : mat.floor, 0.165, 0.04, depth, x + 0.0825, -0.02, (Z0 + Z1) / 2)
  }
  // Tumblehome hull walls: planks along z on a plane leaning inward.
  const lean = 0.1
  for (let side = -1; side <= 1; side += 2) {
    // Planks abut and a hull skin sits behind them: sub-pixel gaps onto the void
    // would flicker as dashed silhouette lines.
    for (let i = 0; i < 14; i++) {
      const s = 0.0725 + i * 0.145
      const x = side * (1.8 - Math.sin(lean) * s)
      const y = Math.cos(lean) * s
      M.box(i % 2 ? mat.wall2 : mat.wall, 0.035, 0.145, depth, x, y, (Z0 + Z1) / 2, 0, 0, side * lean)
    }
    M.box(mat.rib, 0.03, 2.1, depth + 0.2, side * (1.84 - Math.sin(lean) * 1.0), Math.cos(lean) * 1.0, (Z0 + Z1) / 2, 0, 0, side * lean)
    // Ribs (frames).
    for (let z = Z0 + 0.45; z < Z1; z += 0.75) {
      const s = 1.0
      M.box(mat.rib, 0.07, 2.02, 0.09, side * (1.8 - 0.05 - Math.sin(lean) * s), Math.cos(lean) * s, z, 0, 0, side * lean)
    }
  }
  // Back and front walls: vertical planks.
  for (let x = X0; x < X1 - 0.01; x += 0.15) {
    M.box(mat.wall, 0.15, 2.0, 0.035, x + 0.075, 1.0, Z0)
    const doorway = x + 0.075 > -0.45 && x + 0.075 < 0.35
    M.box(doorway ? mat.darkWood : mat.wall2, 0.15, 2.0, 0.035, x + 0.075, 1.0, Z1)
  }
  M.box(mat.rib, 3.8, 2.2, 0.03, 0, 1.05, Z0 - 0.04)
  M.box(mat.rib, 3.8, 2.2, 0.03, 0, 1.05, Z1 + 0.04)
  // Door frame + handle on the front wall.
  M.box(mat.rib, 0.08, 1.9, 0.06, -0.48, 0.95, Z1 - 0.03)
  M.box(mat.rib, 0.08, 1.9, 0.06, 0.38, 0.95, Z1 - 0.03)
  M.box(mat.rib, 0.94, 0.08, 0.06, -0.05, 1.9, Z1 - 0.03)
  M.cyl(mat.brass, 0.02, 0.02, 0.05, 10, 0.24, 1.0, Z1 - 0.05, Math.PI / 2)
  // Deck beams + deck.
  for (let z = Z0 + 0.25; z < Z1; z += 0.5) M.box(mat.beam, 3.5, 0.11, 0.1, 0, 1.945, z)
  M.box(mat.deck, 3.6, 0.04, depth, 0, 2.02, (Z0 + Z1) / 2)
  // Carlin beam along the centreline.
  M.box(mat.beam, 0.1, 0.06, depth, 0.0, 1.87, (Z0 + Z1) / 2)

  // ---- porthole --------------------------------------------------------------
  const portPos = new THREE.Vector3(0.62, 1.42, Z0 + 0.03)
  M.add(new THREE.TorusGeometry(0.17, 0.032, 8, 28), mat.brass, portPos)
  M.add(new THREE.TorusGeometry(0.12, 0.012, 6, 24), mat.brass, { x: portPos.x, y: portPos.y, z: portPos.z + 0.02 })
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    M.box(mat.iron, 0.03, 0.05, 0.04, portPos.x + Math.cos(a) * 0.215, portPos.y + Math.sin(a) * 0.215, portPos.z + 0.01, 0, 0, a)
  }
  const portGlass = new THREE.Mesh(new THREE.CircleGeometry(0.14, 28), mat.porthole)
  portGlass.position.copy(portPos).add(new THREE.Vector3(0, 0, -0.005))
  scene.add(portGlass)

  // ---- bench + shelf ---------------------------------------------------------
  const BX0 = -1.72, BX1 = -1.15, BZ0 = -2.3, BZ1 = -0.2, BY = 0.88
  const bcx = (BX0 + BX1) / 2, bcz = (BZ0 + BZ1) / 2
  M.box(mat.bench, BX1 - BX0, 0.05, BZ1 - BZ0, bcx, BY - 0.025, bcz)
  M.box(mat.darkWood, 0.03, 0.12, BZ1 - BZ0, BX1 - 0.015, BY - 0.11, bcz)
  for (const lz of [BZ0 + 0.05, BZ1 - 0.05]) for (const lx of [BX0 + 0.05, BX1 - 0.05]) M.box(mat.darkWood, 0.06, BY - 0.05, 0.06, lx, (BY - 0.05) / 2, lz)
  M.box(mat.bench, BX1 - BX0 - 0.08, 0.03, BZ1 - BZ0 - 0.1, bcx, 0.22, bcz)
  // Lower shelf contents: a crate and a carboy.
  M.box(mat.darkWood, 0.3, 0.22, 0.4, bcx, 0.345, -1.9)
  M.add(lathe([[0, 0], [0.12, 0], [0.14, 0.05], [0.14, 0.2], [0.06, 0.3], [0.035, 0.33], [0.035, 0.37], [0, 0.37]], 16), mat.glass, { x: bcx, y: 0.235, z: -1.2 })
  // Wall shelf (follows the lean) with brackets.
  const SY = 1.42
  const sx0 = -1.8 + Math.sin(lean) * SY + 0.02
  M.box(mat.bench, 0.22, 0.03, 1.8, sx0 + 0.11, SY, -1.3)
  for (const z of [-2.1, -1.3, -0.5]) M.box(mat.darkWood, 0.18, 0.14, 0.025, sx0 + 0.09, SY - 0.085, z, 0, 0, 0)
  // Shelf bottles.
  const bottles: [THREE.BufferGeometry, THREE.Material, number][] = [
    [lathe([[0, 0], [0.04, 0], [0.04, 0.16], [0.015, 0.2], [0.015, 0.24], [0, 0.24]]), mat.bottleBrown, -2.05],
    [lathe([[0, 0], [0.05, 0], [0.05, 0.12], [0.02, 0.15], [0.02, 0.18], [0, 0.18]]), mat.stoneware, -1.85],
    [ribbedBottle(), mat.bottleGreen, -1.66],
    [lathe([[0, 0], [0.035, 0], [0.035, 0.2], [0.012, 0.24], [0.012, 0.27], [0, 0.27]]), mat.cobalt, -1.48],
    [lathe([[0, 0], [0.06, 0], [0.06, 0.09], [0.045, 0.1], [0.045, 0.12], [0, 0.12]]), mat.stoneware, -1.27],
    [lathe([[0, 0], [0.04, 0], [0.04, 0.14], [0.016, 0.19], [0.016, 0.22], [0, 0.22]]), mat.bottleBrown, -1.08],
  ]
  for (const [g, m, z] of bottles) M.add(g, m, { x: sx0 + 0.11, y: SY + 0.015, z })
  // Unlit ruby safelight on the shelf end: red glass front in a tin box.
  M.box(mat.iron, 0.14, 0.18, 0.14, sx0 + 0.1, SY + 0.105, -0.62)
  M.box(mat.red, 0.01, 0.12, 0.1, sx0 + 0.175, SY + 0.105, -0.62)
  M.cyl(mat.iron, 0.02, 0.03, 0.05, 8, sx0 + 0.1, SY + 0.22, -0.62)

  // Trays: developer (print), stop, fix.
  const trayX = -1.43
  const trayZ = [-0.6, -1.07, -1.54]
  const TW = 0.29, TL = 0.37, TH = 0.045, TT = 0.012
  trayZ.forEach((tz, i) => {
    M.begin()
    const m = i === 0 ? mat.tray : i === 1 ? mat.trayDark : mat.tray
    M.box(m, TW, 0.008, TL, trayX, BY + 0.004, tz)
    M.box(m, TT, TH, TL, trayX - TW / 2 + TT / 2, BY + TH / 2, tz)
    M.box(m, TT, TH, TL, trayX + TW / 2 - TT / 2, BY + TH / 2, tz)
    M.box(m, TW, TH, TT, trayX, BY + TH / 2, tz - TL / 2 + TT / 2)
    M.box(m, TW, TH, TT, trayX, BY + TH / 2, tz + TL / 2 - TT / 2)
    // Pouring lip.
    M.box(m, 0.05, 0.006, 0.03, trayX + TW / 2 - 0.03, BY + TH + 0.003, tz - TL / 2 + 0.01, 0, 0, 0)
    M.end()
    if (i > 0) M.box(mat.liquid, TW - 2 * TT, 0.002, TL - 2 * TT, trayX, BY + 0.03, tz)
  })
  // Graduate (measuring cone) and a thermometer next to the trays.
  M.add(lathe([[0, 0], [0.045, 0], [0.045, 0.008], [0.02, 0.012], [0.03, 0.16], [0.034, 0.165], [0, 0.165]], 14), mat.glass, { x: -1.3, y: BY, z: -1.95 })
  M.cyl(mat.glass, 0.004, 0.004, 0.24, 6, trayX + 0.21, BY + 0.005, -0.84, Math.PI / 2, 0.3, 0)
  M.cyl(mat.red, 0.007, 0.007, 0.02, 6, trayX + 0.175, BY + 0.007, -0.725, Math.PI / 2, 0.3, 0)
  // Pocket watch, face up.
  M.cyl(mat.brass, 0.028, 0.028, 0.01, 18, -1.27, BY + 0.005, -0.32)
  M.cyl(mat.paper, 0.022, 0.022, 0.012, 18, -1.27, BY + 0.006, -0.32)
  M.add(new THREE.TorusGeometry(0.01, 0.003, 4, 10), mat.brass, { x: -1.27, y: BY + 0.008, z: -0.355 }, { x: Math.PI / 2, y: 0, z: 0 })

  // ---- tripod + field camera -------------------------------------------------
  const tripod = new THREE.Group()
  tripod.position.set(0.42, 0, -0.7)
  tripod.rotation.y = Math.PI * 0.27
  scene.add(tripod)
  const T = new Merger()
  const headY = 1.12
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3
    const foot = new THREE.Vector3(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42)
    const head = new THREE.Vector3(Math.cos(a) * 0.05, headY - 0.03, Math.sin(a) * 0.05)
    const mid = foot.clone().add(head).multiplyScalar(0.5)
    const len = foot.distanceTo(head)
    const dir = head.clone().sub(foot).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const m4 = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1))
    T.addMatrix(new THREE.BoxGeometry(0.03, len, 0.02), mat.bench, m4)
    // Brass clamp at 60% and a spike foot.
    const c = foot.clone().lerp(head, 0.58)
    T.addMatrix(new THREE.BoxGeometry(0.04, 0.03, 0.03), mat.brass, new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)))
    T.addMatrix(new THREE.ConeGeometry(0.012, 0.05, 6), mat.iron, new THREE.Matrix4().compose(foot.clone().setY(0.022), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), new THREE.Vector3(1, 1, 1)))
  }
  T.cyl(mat.darkWood, 0.085, 0.085, 0.03, 18, 0, headY, 0)
  // Baseboard + rail.
  T.box(mat.darkWood, 0.2, 0.02, 0.42, 0, headY + 0.025, 0.02)
  T.box(mat.brass, 0.02, 0.012, 0.4, -0.06, headY + 0.041, 0.02)
  T.box(mat.brass, 0.02, 0.012, 0.4, 0.06, headY + 0.041, 0.02)
  // Rear standard with ground-glass frame.
  T.box(mat.bench, 0.24, 0.26, 0.035, 0, headY + 0.17, 0.17)
  T.box(mat.glass, 0.18, 0.2, 0.004, 0, headY + 0.17, 0.19)
  // Bellows: alternating square frusta read as pleats.
  for (let i = 0; i < 7; i++) {
    const t0 = i / 7
    const z = 0.15 - t0 * 0.24
    const s = 0.21 - t0 * 0.08 + (i % 2 ? 0.0 : 0.012)
    T.add(new THREE.CylinderGeometry(s * 0.6, s * 0.66, 0.034, 4, 1, true), mat.cloth, { x: 0, y: headY + 0.16, z }, { x: Math.PI / 2, y: Math.PI / 4, z: 0 })
  }
  // Front standard, lens board, lens.
  T.box(mat.bench, 0.17, 0.2, 0.025, 0, headY + 0.15, -0.11)
  T.box(mat.darkWood, 0.13, 0.13, 0.012, 0, headY + 0.15, -0.125)
  T.cyl(mat.brass, 0.042, 0.046, 0.07, 18, 0, headY + 0.15, -0.165, Math.PI / 2)
  T.cyl(mat.brass, 0.05, 0.05, 0.01, 18, 0, headY + 0.15, -0.135, Math.PI / 2)
  T.cyl(mat.leather, 0.047, 0.047, 0.03, 18, 0, headY + 0.15, -0.21, Math.PI / 2)
  T.build(tripod)
  // Focusing cloth draped over the back (not merged: it gets a rumpled plane).
  const clothGeo = new THREE.PlaneGeometry(0.42, 0.36, 10, 8)
  {
    const p = clothGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      p.setZ(i, 0.025 * Math.sin(x * 26 + y * 7) + (y < 0 ? -0.8 * y * y : 0))
    }
    clothGeo.computeVertexNormals()
  }
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshLambertMaterial({ color: '#141210', side: THREE.DoubleSide, flatShading: true }))
  cloth.position.set(0.0, headY + 0.18, 0.24)
  cloth.rotation.set(-0.35, 0, 0)
  cloth.castShadow = cloth.receiveShadow = true
  tripod.add(cloth)

  // ---- plate cabinet + rack + easel ------------------------------------------
  const CX = 1.45, CZ = -1.9
  M.box(mat.darkWood, 0.48, 0.82, 0.8, CX, 0.41, CZ)
  M.box(mat.bench, 0.52, 0.03, 0.84, CX, 0.835, CZ)
  for (const dz of [-0.2, 0.2]) {
    M.box(mat.bench, 0.01, 0.34, 0.36, CX - 0.245, 0.43, CZ + dz)
    M.cyl(mat.brass, 0.012, 0.012, 0.02, 8, CX - 0.255, 0.45, CZ + dz - 0.12 * Math.sign(dz), 0, 0, Math.PI / 2)
  }
  // Rack: base board + dowels; plates lean in it.
  M.box(mat.bench, 0.2, 0.025, 0.62, CX - 0.02, 0.862, CZ)
  for (let i = 0; i < 8; i++) M.cyl(mat.darkWood, 0.006, 0.006, 0.1, 6, CX - 0.08, 0.92, CZ - 0.27 + i * 0.077)
  const negatives: DevelopingPrintMaterial[] = []
  const plateGlass = mat.glass
  const plateGroup = new THREE.Group()
  scene.add(plateGroup)
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group()
    g.position.set(CX - 0.02, 0.875, CZ - 0.235 + i * 0.077)
    g.rotation.set(0, -Math.PI / 2, 0)
    g.rotateX(-0.12 - 0.03 * (i % 2))
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.124, 0.003), plateGlass)
    glass.position.y = 0.062
    glass.castShadow = glass.receiveShadow = true
    const nm = new DevelopingPrintMaterial({ image: negative, negative: false, develop: 0.7 + 0.12 * i, paper: '#c8ccc8' })
    negatives.push(nm)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.112), nm)
    face.position.set(0, 0.062, 0.0018)
    face.receiveShadow = true
    g.add(glass, face)
    plateGroup.add(g)
  }
  // A candle on the cabinet so the rack reads (no shadows: cheap).
  M.cyl(mat.paper, 0.012, 0.013, 0.09, 8, CX + 0.08, 0.895, CZ + 0.3)
  M.cyl(mat.brass, 0.035, 0.03, 0.012, 12, CX + 0.08, 0.856, CZ + 0.3)
  const candleFlame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), mat.flame)
  candleFlame.scale.set(1, 2, 1)
  candleFlame.position.set(CX + 0.08, 0.955, CZ + 0.3)
  scene.add(candleFlame)
  const candle = new THREE.PointLight('#ffd49a', 0.9, 0, 2)
  candle.position.set(CX + 0.08, 0.97, CZ + 0.3)
  scene.add(candle)
  // Easel on a side table against the porthole holding a big negative, back-lit.
  M.box(mat.darkWood, 0.5, 0.04, 0.32, 0.62, 0.92, Z0 + 0.22)
  for (const lx of [0.4, 0.84]) M.box(mat.darkWood, 0.04, 0.9, 0.04, lx, 0.45, Z0 + 0.22)
  M.box(mat.darkWood, 0.03, 0.42, 0.03, 0.62, 1.15, Z0 + 0.26, -0.25, 0, 0)
  M.box(mat.darkWood, 0.34, 0.02, 0.05, 0.62, 0.955, Z0 + 0.31)
  const easelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), new THREE.MeshBasicMaterial({ map: negative, color: '#d8dee0' }))
  easelPlate.position.set(0.62, 1.09, Z0 + 0.3)
  easelPlate.rotation.x = -0.25
  scene.add(easelPlate)

  // ---- furniture -------------------------------------------------------------
  // Stool.
  M.cyl(mat.bench, 0.17, 0.17, 0.04, 16, -0.75, 0.6, -1.55)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    M.cyl(mat.darkWood, 0.016, 0.02, 0.6, 6, -0.75 + Math.cos(a) * 0.11, 0.3, -1.55 + Math.sin(a) * 0.11, Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15)
  }
  // Sea chest with iron bands, rope coil, bucket.
  M.box(mat.darkWood, 0.8, 0.42, 0.46, 1.2, 0.21, 0.95, 0, -0.1, 0)
  M.box(mat.bench, 0.82, 0.08, 0.48, 1.2, 0.46, 0.95, 0, -0.1, 0)
  for (const dx of [-0.25, 0.25]) M.box(mat.iron, 0.04, 0.51, 0.47, 1.2 + dx * Math.cos(0.1), 0.255, 0.95 + dx * Math.sin(0.1), 0, -0.1, 0)
  for (let k = 0; k < 4; k++) M.add(new THREE.TorusGeometry(0.2 - k * 0.012, 0.022, 6, 24), mat.rope, { x: 1.15, y: 0.022 + k * 0.04, z: 0.15 }, { x: Math.PI / 2, y: 0, z: 0 })
  M.add(lathe([[0, 0], [0.13, 0], [0.15, 0.28], [0.145, 0.28], [0.125, 0.012], [0, 0.012]], 16), mat.darkWood, { x: -1.0, y: 0, z: -2.45 })
  M.add(new THREE.TorusGeometry(0.15, 0.008, 4, 20), mat.iron, { x: -1.0, y: 0.2, z: -2.45 }, { x: Math.PI / 2, y: 0, z: 0 })

  const staticCalls = M.build(statics)

  // ---- drying line (dynamic: sways) -----------------------------------------
  const dryingLine = new THREE.Group()
  dryingLine.position.set(0, 1.78, -2.25)
  scene.add(dryingLine)
  const lineMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 3.2, 4), mat.rope)
  lineMesh.rotation.z = Math.PI / 2
  dryingLine.add(lineMesh)
  const printsOnLine: THREE.Mesh[] = []
  ;[-1.0, -0.62, 0.0].forEach((x, i) => {
    const pm = new DevelopingPrintMaterial({ image: photo, develop: 0.85 + i * 0.2 })
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), pm)
    p.position.set(x, -0.1, 0)
    p.rotation.y = 0.15 * (i - 1)
    p.castShadow = p.receiveShadow = true
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.016), mat.darkWood)
    peg.position.set(x, -0.005, 0)
    dryingLine.add(p, peg)
    printsOnLine.push(p)
  })

  // ---- the developing print --------------------------------------------------
  const printMaterial = new DevelopingPrintMaterial({
    image: photo,
    develop: 0,
    grain: grain ? { uniforms: grain, cells: [480, 360], maxFootprint: 1.0, seed: 3 } : null,
  })
  applyLineId(printMaterial, { id: 60 })
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), printMaterial)
  print.rotation.set(-Math.PI / 2, 0, 0)
  print.rotateZ(Math.PI / 2)
  print.position.set(trayX, BY + 0.013, trayZ[0])
  print.receiveShadow = true
  scene.add(print)
  // Developer: a thin, nearly clear film over the print.
  const devLiquid = new THREE.Mesh(
    new THREE.PlaneGeometry(TL - 2 * TT, TW - 2 * TT),
    new THREE.MeshLambertMaterial({
      color: '#1a1a1a', transparent: true, opacity: 0.12, depthWrite: false,
      // Blend colour only; keep the destination alpha (it carries line IDs / grain flag).
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }),
  )
  devLiquid.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
  devLiquid.position.set(trayX, BY + 0.03, trayZ[0])
  scene.add(devLiquid)

  // ---- lantern ---------------------------------------------------------------
  const pivot = new THREE.Group()
  pivot.position.set(-0.98, 1.89, -1.0)
  scene.add(pivot)
  const chainLen = 0.26
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, chainLen, 4), mat.iron)
  chain.position.y = -chainLen / 2
  pivot.add(chain)
  const body = new THREE.Group()
  body.position.y = -chainLen
  pivot.add(body)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 4, 12, Math.PI), mat.iron)
  handle.position.y = -0.01
  handle.rotation.z = Math.PI
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.06, 12), mat.iron)
  cap.position.y = -0.065
  const capRing = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 12), mat.brass)
  capRing.position.y = -0.1
  const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 12), mat.flame)
  flame.position.y = -0.165
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.05, 12), mat.brass)
  base.position.y = -0.25
  const fount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.04, 12), mat.iron)
  fount.position.y = -0.29
  body.add(handle, cap, capRing, flame, base, fount)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.15, 4), mat.iron)
    rod.position.set(Math.cos(a) * 0.066, -0.17, Math.sin(a) * 0.066)
    // No rod shadows: from a point source a 4 mm rod throws a 5 cm wedge (a real
    // flame is ~2 cm wide and would wash it out).
    body.add(rod)
  }
  cap.castShadow = true
  const light = new THREE.PointLight('#ffd9a0', 24, 0, 2)
  light.position.y = -0.165
  light.castShadow = true
  light.shadow.mapSize.set(512, 512)
  light.shadow.camera.near = 0.03
  light.shadow.camera.far = 8
  light.shadow.bias = -0.002
  light.shadow.normalBias = 0.01
  body.add(light)

  // ---- moonbeam through the porthole + ambient ------------------------------
  const moon = new THREE.SpotLight('#c9dcff', 30, 0, 0.32, 0.35, 2)
  moon.position.copy(portPos).add(new THREE.Vector3(0, 0, 0.05))
  moon.target.position.set(0.05, 0, -1.25)
  moon.castShadow = true
  moon.shadow.mapSize.set(512, 512)
  moon.shadow.camera.near = 0.05
  moon.shadow.bias = -0.0015
  scene.add(moon, moon.target)
  const hemi = new THREE.HemisphereLight('#c8c2b8', '#3a2c20', 0.4)
  scene.add(hemi)

  const cabin: Cabin = {
    scene,
    lantern: { pivot, light, flame, swing: { ax: 0, az: 0, vx: 0, vz: 0 } },
    moon,
    hemi,
    print,
    printMaterial,
    negatives,
    dryingLine,
    easelPlate,
    tripodCamera: tripod,
    setPhoto(tex, negTex) {
      printMaterial.setImage(tex)
      for (const p of printsOnLine) (p.material as DevelopingPrintMaterial).setImage(tex)
      for (const n of negatives) n.setImage(negTex)
      easelPlate.material.map = negTex
      easelPlate.material.needsUpdate = true
    },
    setShadows(on, mapSize = 512) {
      for (const l of [light, moon]) {
        l.castShadow = on
        if (l.shadow.mapSize.x !== mapSize) {
          l.shadow.mapSize.set(mapSize, mapSize)
          l.shadow.map?.dispose()
          l.shadow.map = null
        }
      }
    },
    drawCalls() {
      let n = 0
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++ })
      return n
    },
  }
  void staticCalls
  return cabin
}

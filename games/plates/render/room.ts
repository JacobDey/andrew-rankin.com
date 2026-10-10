// games/plates/render/room.ts — the 1888 darkroom (the old coal store), built from ROOM (GDD §6.8).
// Present-day greys: whitewash 0.8, wood 0.45, enamel 0.9, brass 0.5, glass 0.6, cloth 0.1.
import * as THREE from 'three'
import { ROOM, type BenchAnchors } from '../contracts'
import { roomMat, labelTexture } from './materials'

export interface Room {
  group: THREE.Group
  anchors: BenchAnchors
  book: THREE.Object3D
  tableTop: THREE.Mesh
  setTableGlow(on: number): void
  covered: THREE.Object3D
}

export function buildRoom(): Room {
  const g = new THREE.Group(); g.name = 'room'
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, o: { cast?: boolean; recv?: boolean; kind?: string } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true
    if (o.kind) m.userData = { kind: o.kind }
    g.add(m); return m
  }
  const [x0, x1] = ROOM.x, [z0, z1] = ROOM.z
  const W = x1 - x0, D = z1 - z0
  // floor
  add(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), roomMat(0.32), 0, 0, (z0 + z1) / 2, { cast: false })
  // curved back wall (convex into the room, following the tower)
  const back = new THREE.PlaneGeometry(W, 2.6, 24, 1)
  const pa = back.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, ROOM.backWallSagitta * (1 - (x / (W / 2)) ** 2)) }
  back.computeVertexNormals()
  add(back, roomMat(0.8), 0, 1.3, z0 - 0.02, { cast: false })
  // side walls
  add(new THREE.PlaneGeometry(D, 2.6).rotateY(Math.PI / 2), roomMat(0.7), x0, 1.3, (z0 + z1) / 2, { cast: false })
  add(new THREE.PlaneGeometry(D, 2.6).rotateY(-Math.PI / 2), roomMat(0.7), x1, 1.3, (z0 + z1) / 2, { cast: false })
  // vault: a barrel along x, peak 2.5
  const chord = D, sag = 0.55, r = (chord * chord / 4 + sag * sag) / (2 * sag)
  const th = 2 * Math.asin(chord / 2 / r)
  const vault = new THREE.CylinderGeometry(r, r, W, 24, 1, true, -th / 2, th)
  vault.rotateZ(Math.PI / 2)
  const vm = add(vault, roomMat(0.6, { side: THREE.BackSide }), 0, ROOM.vaultPeak - r, (z0 + z1) / 2, { cast: false })
  vm.rotation.x = 0
  // door (closed, planked) at x = 2.0
  add(new THREE.BoxGeometry(0.05, ROOM.door.h, ROOM.door.w), roomMat(0.3), x1 - 0.03, ROOM.door.h / 2, ROOM.door.z)
  add(new THREE.BoxGeometry(0.06, 0.04, 0.12), roomMat(0.5), x1 - 0.07, 1.0, ROOM.door.z - 0.3)
  // bench
  const bx = ROOM.bench.x, bz = ROOM.bench.z
  const benchW = bx[1] - bx[0], benchD = bz[1] - bz[0]
  const benchTop = add(new THREE.BoxGeometry(benchW, 0.05, benchD), roomMat(0.45), (bx[0] + bx[1]) / 2, ROOM.benchTop - 0.025, (bz[0] + bz[1]) / 2, { kind: 'bench' })
  for (const lx of [bx[0] + 0.06, bx[1] - 0.06, 0]) add(new THREE.BoxGeometry(0.06, ROOM.benchTop - 0.05, 0.06), roomMat(0.35), lx, (ROOM.benchTop - 0.05) / 2, bz[1] - 0.06)
  add(new THREE.BoxGeometry(benchW, 0.12, 0.02), roomMat(0.3), (bx[0] + bx[1]) / 2, ROOM.benchTop - 0.11, bz[1] - 0.01)
  // shelf with 7 bottles (PYRO, BROMIDE, HYPO, FARMER'S + 3 unlabelled)
  const sh = ROOM.shelf
  add(new THREE.BoxGeometry(sh.x[1] - sh.x[0], 0.03, sh.depth), roomMat(0.45), (sh.x[0] + sh.x[1]) / 2, sh.y, z0 + sh.depth / 2 + 0.02)
  const names = ['PYRO', 'BROMIDE', 'HYPO', "FARMER'S", '', '', '']
  names.forEach((n, i) => {
    const bxp = sh.x[0] + 0.1 + i * 0.15, h = 0.2 + (i % 3) * 0.03
    const map = n ? labelTexture(128, 64, (x) => { x.fillStyle = '#222'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#fff'; x.fillRect(14, 14, 100, 36); x.fillStyle = '#000'; x.font = 'bold 15px Georgia, serif'; x.textAlign = 'center'; x.fillText(n, 64, 38) }) : undefined
    add(new THREE.CylinderGeometry(0.04, 0.045, h, 12), roomMat(n ? 0.25 : 0.15, { map }), bxp, sh.y + 0.015 + h / 2, z0 + 0.14)
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8), roomMat(0.1), bxp, sh.y + 0.015 + h + 0.025, z0 + 0.14)
  })
  // light table (canary opal top), velvet folded beside it, loupe
  const tableTopMat = roomMat(0.85, { emissive: 0.12 })
  add(new THREE.BoxGeometry(ROOM.tableTop[0] + 0.04, 0.03, ROOM.tableTop[1] + 0.04), roomMat(0.3), ROOM.table[0], ROOM.table[1] + 0.015, ROOM.table[2])
  const tableTop = add(new THREE.BoxGeometry(ROOM.tableTop[0], 0.006, ROOM.tableTop[1]), tableTopMat, ROOM.table[0], ROOM.table[1] + 0.033, ROOM.table[2], { kind: 'table' })
  add(new THREE.BoxGeometry(0.12, 0.03, 0.2), roomMat(0.08), ROOM.table[0] - 0.3, ROOM.table[1] + 0.015, ROOM.table[2] + 0.05)
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16), roomMat(0.5), ROOM.table[0] + 0.28, ROOM.table[1] + 0.02, ROOM.table[2] + 0.1)
  // the Return book on the bench
  const bookTex = labelTexture(128, 160, (x) => { x.fillStyle = '#555'; x.fillRect(0, 0, 128, 160); x.fillStyle = '#ddd'; x.font = 'bold 20px Georgia, serif'; x.textAlign = 'center'; x.fillText('RETURN', 64, 70); x.font = '15px Georgia, serif'; x.fillText('B.S.L.', 64, 100) })
  const book = add(new THREE.BoxGeometry(0.2, 0.03, 0.26), [roomMat(0.2), roomMat(0.2), roomMat(0.6, { map: bookTex }), roomMat(0.2), roomMat(0.2), roomMat(0.2)] as unknown as THREE.Material, ROOM.book[0], ROOM.book[1] + 0.015, ROOM.book[2], { kind: 'book' })
  book.rotation.y = 0.25
  book.userData = { kind: 'book' }
  // drying-line cord
  const lf = new THREE.Vector3(...ROOM.line.from), lt = new THREE.Vector3(...ROOM.line.to)
  const cord = add(new THREE.CylinderGeometry(0.004, 0.004, lf.distanceTo(lt), 6).rotateZ(Math.PI / 2), roomMat(0.5), (lf.x + lt.x) / 2, lf.y, lf.z, { cast: false })
  void cord
  // coal bin
  add(new THREE.BoxGeometry(0.5, 0.45, 0.4), roomMat(0.12), ROOM.coalBin[0], 0.225, ROOM.coalBin[2])
  // Ottilie's covered stereo camera on its tripod
  const cam = new THREE.Group(); cam.position.set(ROOM.camera1887[0], 0, ROOM.camera1887[2])
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6), roomMat(0.4)); leg.position.set(Math.cos(a) * 0.18, 0.6, Math.sin(a) * 0.18); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); cam.add(leg) }
  const covered = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.32), roomMat(0.12)); covered.position.y = 1.32; covered.castShadow = true; cam.add(covered)
  const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 4, 1, true), roomMat(0.1, { side: THREE.DoubleSide })); cloth.position.y = 1.12; cloth.rotation.y = Math.PI / 4; cam.add(cloth)
  g.add(cam)
  // iron hook for the lamp
  add(new THREE.CylinderGeometry(0.008, 0.008, 2.5 - ROOM.lampHook[1], 6), roomMat(0.2), ROOM.lampHook[0], (2.5 + ROOM.lampHook[1]) / 2, ROOM.lampHook[2], { cast: false })

  // anchors (positioned at their ROOM points, y = bench top)
  const mk = (name: string, p: readonly number[] | null) => { const o = new THREE.Group(); o.name = name; if (p) o.position.set(p[0], p[1], p[2]); g.add(o); return o }
  const anchors: BenchAnchors = { tin: mk('anchor:tin', ROOM.tin), trays: mk('anchor:trays', null), rack: mk('anchor:rack', ROOM.rack), table: mk('anchor:table', ROOM.table), bench: benchTop }
  return {
    group: g, anchors, book, tableTop: tableTop as THREE.Mesh, covered,
    setTableGlow(on: number) { tableTopMat.emissive.setScalar(0.12 + 0.5 * on) },
  }
}

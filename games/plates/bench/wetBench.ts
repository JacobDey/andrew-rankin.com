// games/plates/bench/wetBench.ts — createWetBench(ctx, anchors): the three trays (pipe fluid + tilt),
// the plates (chemistry + GPU copies), the tin with its bundles, the rack and the tongs (GDD §5.3–5.6).
import * as THREE from 'three'
import {
  ROOM, PLATE_IDS, SIM_W, SIM_H, PLATE_W, PLATE_H, type Ctx, type BenchAnchors, type WetBench, type PlateId, type Where, type Bath,
  type PlateChem, type PlateGPU, type WedgeReading, type WetSnapshot, type BenchPointer, type Grade,
} from '../contracts'
import { PLATE_GLSL, plateUniforms } from '../render/plateGLSL'
import { BAYER_GLSL } from '../render/dither'
import { roomMat, labelTexture, newMatId } from '../render/materials'
import { PipeFluid } from './fluid'
import { newChem, stepChem, chemTexture, uploadChem, maxH, PLATE_SIZE_M } from './chem'
import { readWedge } from './grade'
import { developRegion } from '../content/develop'
import { hashString } from '../render/dither'
import type { PlatesLibrary } from '../content/library'

const BATHS: Bath[] = ['dev', 'water', 'hypo']
const TRAY_W = ROOM.trayInterior[0], TRAY_D = ROOM.trayInterior[1]
const D2R = Math.PI / 180
const BUNDLE_OF: Record<PlateId, 1 | 2 | 3 | 4> = { p00: 1, p01: 1, p02: 1, p03: 1, p04: 2, p05: 2, p06: 2, p07: 2, p08: 3, p09: 3, p10: 3, p11: 3, p12: 3, p13: 4 }
export const bundleOf = (id: PlateId) => BUNDLE_OF[id]
export const BUNDLE_PLATES = (n: number) => PLATE_IDS.filter((id) => BUNDLE_OF[id] === n)

interface Tray {
  bath: Bath; group: THREE.Group; body: THREE.Group; fluid: PipeFluid; mat: THREE.ShaderMaterial; interior: THREE.Mesh
  tilt: { x: number; z: number; vx: number; vz: number; tx: number; tz: number }
  accelT: number; plate: PlateId | null; frame: number; liquid: number
}
interface PlateEnt {
  id: PlateId; where: Where; chem: PlateChem; gpu: PlateGPU; chemData: Uint16Array; hasE: boolean
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial; dirty: boolean; fixedSeen: boolean; seed: [number, number]
}

export interface PlatesBench extends WetBench {
  setFocus(b: Bath | null): void
  unlock(n: 1 | 2 | 3 | 4): void
  readonly unlocked: ReadonlySet<number>
  readonly opened: ReadonlySet<number>
  held(): PlateId | null
  setLum(l: number): void
  onRequestInspect: ((id: PlateId) => void) | null
  onWarn: ((text: string, at: THREE.Vector3) => void) | null
  trayFluid(b: Bath): PipeFluid
  tableWhite(): boolean
  rocking(): boolean
  meshes(): THREE.Object3D[]
  thumb(id: PlateId, w: number, h: number, mode: 'neg' | 'pos', pal?: { ink: [number, number, number]; light: [number, number, number] }): ImageData
}

const PLATE_FRAG = /* glsl */ `
${PLATE_GLSL}
${BAYER_GLSL}
uniform float uMatId; uniform float uLum; uniform float uHasE;
varying vec2 vUv;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 fw = fwidth(uv * PLATE_SIZE);
  float tpp = max(fw.x, fw.y);
  float silver = uHasE > 0.5 ? plateSilver(uv, tpp) : step(grainT(uv, tpp, vec2(0.0)), 1.0 - exp(-uK * texture(uChem, uv).r * texture(uChem, uv).b));
  float milk = plateMilk(uv, tpp);
  float b = bayer8(gl_FragCoord.xy);
  float bit = silver > 0.5 ? 0.0 : (milk > 0.5 ? 1.0 : step(b, uLum * 0.75));
  gl_FragColor = vec4(bit, 1.0, uMatId, 1.0);
}`
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const TRAY_FRAG = /* glsl */ `
${PLATE_GLSL}
${BAYER_GLSL}
uniform float uMatId; uniform float uLum; uniform float uHasE; uniform float uHasPlate;
uniform sampler2D uDepth; uniform vec2 uTray; uniform vec2 uPlate; uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = vec2((vUv.x - 0.5) * uTray.x, (0.5 - vUv.y) * uTray.y);
  vec2 duv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 e = vec2(1.0 / 60.0, 1.0 / 48.0);
  float d = texture(uDepth, duv).r;
  float gx = texture(uDepth, duv + vec2(e.x, 0.0)).r - texture(uDepth, duv - vec2(e.x, 0.0)).r;
  float gz = texture(uDepth, duv + vec2(0.0, e.y)).r - texture(uDepth, duv - vec2(0.0, e.y)).r;
  vec2 grad = vec2(gx, gz) / 10.0;                  // mm per mm
  vec2 q = p + grad * d * 0.0011;                    // refraction offset (m)
  vec2 puv = q / uPlate + 0.5;
  float b = bayer8(gl_FragCoord.xy);
  float lum = uLum * (0.95 - 0.02 * d);
  float bit = step(b, lum);
  bool inPlate = uHasPlate > 0.5 && puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0;
  if (inPlate) {
    vec2 fw = fwidth(puv * PLATE_SIZE);
    float tpp = max(fw.x, fw.y);
    float silver = uHasE > 0.5 ? plateSilver(puv, tpp) : 0.0;
    float milk = plateMilk(puv, tpp);
    bit = silver > 0.5 ? 0.0 : (milk > 0.5 ? 1.0 : step(b, lum * 0.85));
    if (puv.x < 0.006 || puv.x > 0.994 || puv.y < 0.012 || puv.y > 0.988) bit = 0.0;
  }
  // glints off the moving surface: scattered light pixels where the slope catches the lamp
  vec3 n = normalize(vec3(-grad.x * 3.0, 1.0, -grad.y * 3.0));
  vec3 L = normalize(vec3(0.7, 1.0, -0.15));
  vec3 V = normalize(vec3(0.0, 1.0, 0.7));
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0);
  float sparkle = hash(floor(gl_FragCoord.xy) + floor(uTime * 12.0));
  if (!inPlate && d < 0.3) bit = step(b, lum * 0.7);
  if (d > 0.3 && spec * (0.6 + 0.8 * sparkle) > 0.55 + 0.4 * b) bit = 1.0;
  gl_FragColor = vec4(bit, 1.0, uMatId, 1.0);
}`

export function createWetBench(ctx: Ctx, anchors: BenchAnchors): PlatesBench {
  const lib = ctx.lib as PlatesLibrary
  const group = new THREE.Group()
  group.name = 'wetBench'
  let lum = 0.6
  let time = 0
  let focus: Bath | null = null
  const unlocked = new Set<number>(), opened = new Set<number>()
  let heldId: PlateId | null = null
  const heldPos = new THREE.Vector3(), heldVel = new THREE.Vector3(), heldTarget = new THREE.Vector3()
  let heldRoll = 0, heldPitch = 0
  let autoPattern: 'corners' | 'lr' | 'still' | null = null, autoT = 0
  const blankE = new THREE.DataTexture(new Uint8Array(16), 4, 4, THREE.RedFormat, THREE.UnsignedByteType)
  blankE.needsUpdate = true

  // ---------------------------------------------------------------- trays
  const trays = new Map<Bath, Tray>()
  const labels: Record<Bath, string> = { dev: 'DEVELOPER', water: 'WATER', hypo: 'HYPO' }
  for (const bath of BATHS) {
    const pos = ROOM.trays[bath]
    const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); g.name = `tray:${bath}`
    const body = new THREE.Group(); g.add(body)
    const enamel = roomMat(0.9)
    const wallH = 0.03, t = 0.008
    const mk = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), enamel); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; body.add(m); return m }
    mk(TRAY_W + 2 * t, 0.006, TRAY_D + 2 * t, 0, 0.003, 0)
    mk(TRAY_W + 2 * t, wallH, t, 0, wallH / 2, -TRAY_D / 2 - t / 2)
    mk(TRAY_W + 2 * t, wallH, t, 0, wallH / 2, TRAY_D / 2 + t / 2)
    mk(t, wallH, TRAY_D, -TRAY_W / 2 - t / 2, wallH / 2, 0)
    mk(t, wallH, TRAY_D, TRAY_W / 2 + t / 2, wallH / 2, 0)
    // rim label (front)
    const lt = labelTexture(256, 32, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#000'; x.font = 'bold 22px Georgia, serif'; x.textAlign = 'center'; x.fillText(labels[bath], 128, 24) })
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W * 0.8, 0.022), roomMat(1.0, { map: lt }))
    lab.position.set(0, wallH * 0.5, TRAY_D / 2 + t + 0.0012); body.add(lab)
    const fluid = new PipeFluid(60, 48, 0.005, 0.008)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...plateUniforms({ E: blankE, chem: chemTexture().tex, seed: new THREE.Vector2() }, ctx.noise),
        uMatId: { value: newMatId() / 255 }, uLum: { value: 0.6 }, uHasE: { value: 0 }, uHasPlate: { value: 0 },
        uDepth: { value: fluid.depthTex }, uTray: { value: new THREE.Vector2(TRAY_W, TRAY_D) }, uPlate: { value: new THREE.Vector2(PLATE_SIZE_M[0], PLATE_SIZE_M[1]) }, uTime: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: TRAY_FRAG,
    })
    const interior = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W, TRAY_D), mat)
    interior.rotation.x = -Math.PI / 2; interior.position.y = 0.0065; interior.receiveShadow = false
    interior.userData = { kind: 'tray', bath }
    body.add(interior)
    anchors.trays.add(g)
    trays.set(bath, { bath, group: g, body, fluid, mat, interior, tilt: { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0 }, accelT: 0, plate: null, frame: 0, liquid: 1 })
  }
  const trayOf = (b: Bath) => trays.get(b) as Tray

  // ---------------------------------------------------------------- tin + bundles
  const tin = new THREE.Group(); tin.position.set(ROOM.tin[0] - anchors.tin.position.x, 0, ROOM.tin[2] - anchors.tin.position.z)
  const tinMat = roomMat(0.35)
  const tinBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.2), tinMat); tinBox.position.y = 0.05; tinBox.castShadow = true
  tinBox.userData = { kind: 'tin' }
  tin.add(tinBox)
  const lidTex = labelTexture(256, 128, (x) => { x.fillStyle = '#888'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.font = 'italic 17px Georgia, serif'; x.fillText('O.F.: PLATES 1–12 & TRIAL.', 10, 50); x.fillText('DO NOT OPEN IN DAYLIGHT.', 10, 80) })
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.2), roomMat(0.6, { map: lidTex }))
  lid.position.set(0, 0.1, -0.1); lid.rotation.x = -1.9; lid.geometry.translate(0, 0, 0.1); lid.userData = { kind: 'tin' }
  tin.add(lid)
  const bundleMeshes: THREE.Mesh[] = []
  for (let n = 1; n <= 3; n++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.17), roomMat(0.05))
    m.position.set(-0.085 + (n - 1) * 0.085, 0.07, 0); m.userData = { kind: 'tin', bundle: n }
    tin.add(m); bundleMeshes.push(m)
  }
  anchors.tin.add(tin)

  // ---------------------------------------------------------------- rack
  const rack = new THREE.Group()
  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.12), roomMat(0.45)); rackBase.position.y = 0.015; rackBase.userData = { kind: 'rack' }
  rack.add(rackBase)
  let gradeLabels: (Grade | null)[] = PLATE_IDS.map(() => null)
  const rackCanvas = document.createElement('canvas'); rackCanvas.width = 512; rackCanvas.height = 48
  const rackTex = new THREE.CanvasTexture(rackCanvas); rackTex.colorSpace = THREE.NoColorSpace
  const drawRackLabels = () => {
    const x = rackCanvas.getContext('2d'); if (!x) return
    x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, 512, 48)
    x.fillStyle = '#fff'; x.font = 'italic 13px Georgia, serif'; x.textAlign = 'center'
    for (let i = 0; i < 14; i++) {
      const cx = 18 + i * 34.6
      x.fillText(i === 0 ? 'T' : String(i), cx, 16)
      const g = gradeLabels[i]
      if (g) { x.save(); x.translate(cx, 34); x.rotate(-0.5); x.font = 'italic 11px Georgia, serif'; x.fillText(g.slice(0, 5), 0, 0); x.restore() }
    }
    rackTex.needsUpdate = true
  }
  drawRackLabels()
  const rackFront = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.032), roomMat(1.0, { map: rackTex })); rackFront.position.set(0, 0.016, 0.0605); rackFront.userData = { kind: 'rack' }
  rack.add(rackFront)
  anchors.rack.add(rack)
  const rackSlotPos = (i: number) => new THREE.Vector3(ROOM.rack[0] - 0.155 + i * 0.0238, ROOM.rack[1] + 0.06, ROOM.rack[2])

  // ---------------------------------------------------------------- plates
  const plates = new Map<PlateId, PlateEnt>()
  const plateGeo = new THREE.PlaneGeometry(PLATE_SIZE_M[0], PLATE_SIZE_M[1]); plateGeo.rotateX(-Math.PI / 2)
  const edgeGeo = new THREE.BoxGeometry(PLATE_SIZE_M[0] + 0.002, 0.003, PLATE_SIZE_M[1] + 0.002)
  const edgeMat = roomMat(0.15)
  for (const id of PLATE_IDS) {
    const chem = newChem(id)
    const ct = chemTexture()
    uploadChem(chem, ct.data, ct.tex)
    const h = hashString(id)
    const seed: [number, number] = [h % 128, (h >>> 8) % 128]
    const gpu: PlateGPU = { E: blankE, chem: ct.tex, seed: new THREE.Vector2(seed[0], seed[1]) }
    const mat = new THREE.ShaderMaterial({ uniforms: { ...plateUniforms(gpu, ctx.noise), uMatId: { value: newMatId() / 255 }, uLum: { value: 0.6 }, uHasE: { value: 0 } }, vertexShader: VERT, fragmentShader: PLATE_FRAG })
    const mesh = new THREE.Mesh(plateGeo, mat)
    mesh.position.y = 0.0016
    const edge = new THREE.Mesh(edgeGeo, edgeMat); edge.position.y = -0.0002; edge.castShadow = true
    const holder = new THREE.Group(); holder.add(edge); holder.add(mesh)
    holder.visible = false
    holder.userData = { kind: 'plate', id }
    mesh.userData = { kind: 'plate', id }
    group.add(holder)
    plates.set(id, { id, where: { kind: 'tin' }, chem, gpu, chemData: ct.data, hasE: false, mesh: holder as unknown as THREE.Mesh, mat, dirty: false, fixedSeen: false, seed })
  }
  const ent = (id: PlateId) => plates.get(id) as PlateEnt

  function ensureExposure(id: PlateId): void {
    const p = ent(id)
    if (p.hasE) return
    void lib.expose(id, ctx.renderer, ctx.settings.quality).then((e) => {
      const tex = new THREE.DataTexture(e.L, PLATE_W, PLATE_H, THREE.RedFormat, THREE.UnsignedByteType)
      tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter
      tex.needsUpdate = true
      p.gpu.E = tex; p.hasE = true
      p.mat.uniforms.uE.value = tex; p.mat.uniforms.uHasE.value = 1
      for (const t of trays.values()) if (t.plate === id) { t.mat.uniforms.uE.value = tex; t.mat.uniforms.uHasE.value = 1 }
    })
  }

  function setWhere(id: PlateId, w: Where, emit = true): void {
    const p = ent(id)
    // leave the old tray
    if (p.where.kind === 'tray') { const t = trayOf(p.where.bath); if (t.plate === id) { t.plate = null; t.mat.uniforms.uHasPlate.value = 0; t.fluid.setPlate(false, PLATE_SIZE_M[0] / 2, PLATE_SIZE_M[1] / 2) } }
    if (p.where.kind === 'hand' && heldId === id) heldId = null
    p.where = w
    const holder = p.mesh as unknown as THREE.Group
    holder.visible = w.kind !== 'tin' && w.kind !== 'tray' && w.kind !== 'camera'
    holder.rotation.set(0, 0, 0)
    if (w.kind === 'tray') {
      const t = trayOf(w.bath)
      if (t.plate && t.plate !== id) setWhere(t.plate, { kind: 'bench' })
      t.plate = id
      t.mat.uniforms.uE.value = p.gpu.E; t.mat.uniforms.uChem.value = p.gpu.chem; t.mat.uniforms.uNoiseSeed.value = p.gpu.seed
      t.mat.uniforms.uHasE.value = p.hasE ? 1 : 0; t.mat.uniforms.uHasPlate.value = 1
      t.fluid.setPlate(true, PLATE_SIZE_M[0] / 2, PLATE_SIZE_M[1] / 2)
      t.fluid.poke(0, 0, 0.0015, 0.02)
      ctx.bus.emit({ t: 'sfx', name: 'plop' })
    } else if (w.kind === 'bench') {
      const i = PLATE_IDS.indexOf(id)
      holder.position.set(-1.0 + (i % 5) * 0.2, ROOM.benchTop + 0.002, -0.7 - Math.floor(i / 5) * 0.0)
      holder.position.x = -0.95 + (i % 4) * 0.19
    } else if (w.kind === 'rack') {
      const s = rackSlotPos(w.slot); holder.position.copy(s); holder.rotation.set(Math.PI / 2 - 0.15, 0, 0)
    } else if (w.kind === 'table') {
      holder.position.set(ROOM.table[0], ROOM.table[1] + 0.035, ROOM.table[2])
      for (const q of plates.values()) if (q.id !== id && q.where.kind === 'table') setWhere(q.id, { kind: 'rack', slot: PLATE_IDS.indexOf(q.id) })
    } else if (w.kind === 'hand') {
      heldId = id
    }
    if (w.kind !== 'tin') ensureExposure(id)
    if (emit) ctx.bus.emit({ t: 'plateMoved', id, to: w })
  }

  function nextInTin(): PlateId | null {
    for (const id of PLATE_IDS) if (opened.has(BUNDLE_OF[id]) && ent(id).where.kind === 'tin') return id
    return null
  }
  function nextBath(id: PlateId): Where {
    const p = ent(id), w = p.where
    if (w.kind === 'tray') return w.bath === 'dev' ? { kind: 'tray', bath: 'water' } : w.bath === 'water' ? { kind: 'tray', bath: 'hypo' } : { kind: 'rack', slot: PLATE_IDS.indexOf(id) }
    if (w.kind === 'rack') return { kind: 'table' }
    if (p.chem.fixed) return { kind: 'rack', slot: PLATE_IDS.indexOf(id) }
    return p.chem.cDev > 0.5 || p.chem.P[0] > 0.5 ? { kind: 'tray', bath: 'water' } : { kind: 'tray', bath: 'dev' }
  }
  function drop(id: PlateId, w: Where): void {
    const p = ent(id)
    if (w.kind === 'tray' && w.bath === 'dev' && p.chem.fixed) { bench.onWarn?.('Fixed glass will not develop again.', trayOf('dev').group.position); w = { kind: 'bench' } }
    setWhere(id, w)
    ctx.bus.emit({ t: 'sfx', name: w.kind === 'tray' ? 'snap' : 'glass' })
    if (w.kind === 'table') {
      if (!p.chem.fixed) bench.onWarn?.('Canary fogs glass that is not fixed.', new THREE.Vector3(...ROOM.table))
      bench.onRequestInspect?.(id)
    }
  }
  function dropTargetAt(x: number, z: number): Where {
    for (const b of BATHS) { const tp = ROOM.trays[b]; if (Math.abs(x - tp[0]) < TRAY_W / 2 + 0.03 && Math.abs(z - tp[2]) < TRAY_D / 2 + 0.05) return { kind: 'tray', bath: b } }
    if (Math.abs(x - ROOM.rack[0]) < 0.2 && Math.abs(z - ROOM.rack[2]) < 0.18) return { kind: 'rack', slot: heldId ? PLATE_IDS.indexOf(heldId) : 0 }
    if (Math.abs(x - ROOM.table[0]) < 0.26 && Math.abs(z - ROOM.table[2]) < 0.22) return { kind: 'table' }
    return { kind: 'bench' }
  }

  // ---------------------------------------------------------------- pointer
  const ray = new THREE.Raycaster()
  let drag: { kind: 'rock'; bath: Bath; x0: number; y0: number } | { kind: 'lift'; id: PlateId; x0: number; y0: number } | null = null
  let movedWhileHeld = false
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(ROOM.benchTop + 0.12))
  const hitPlane = new THREE.Vector3()
  function pick(p: BenchPointer): { kind: string; bath?: Bath; id?: PlateId; point: THREE.Vector3 } | null {
    ray.ray.copy(p.ray)
    const objs: THREE.Object3D[] = [tin, rack]
    for (const t of trays.values()) objs.push(t.interior)
    for (const q of plates.values()) if ((q.mesh as unknown as THREE.Group).visible && q.where.kind !== 'hand') objs.push(q.mesh)
    const hits = ray.intersectObjects(objs, true)
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      while (o && !o.userData.kind) o = o.parent
      if (!o) continue
      const u = o.userData as { kind: string; bath?: Bath; id?: PlateId }
      return { kind: u.kind, bath: u.bath, id: u.id, point: h.point }
    }
    return null
  }
  function trayLocal(b: Bath, pt: THREE.Vector3): [number, number] {
    const t = trayOf(b); const v = t.body.worldToLocal(pt.clone()); return [v.x, v.z]
  }

  function pointer(p: BenchPointer): boolean {
    if (heldId) {
      if (p.kind === 'move' || p.kind === 'down') {
        if (p.ray.intersectPlane(plane, hitPlane)) heldTarget.copy(hitPlane)
        if (p.kind === 'move' && p.touches > 0) movedWhileHeld = true
        return true
      }
      if (p.kind === 'tap' || p.kind === 'dbl' || (p.kind === 'up' && movedWhileHeld)) {
        movedWhileHeld = false
        if (p.ray.intersectPlane(plane, hitPlane)) heldTarget.copy(hitPlane)
        const id = heldId
        drop(id, dropTargetAt(heldTarget.x, heldTarget.z))
        return true
      }
      if (p.kind === 'up') return true
      return false
    }
    if (p.kind === 'down') {
      const h = pick(p)
      if (!h) return false
      if (h.kind === 'tray' && h.bath) {
        const t = trayOf(h.bath)
        const [lx, lz] = trayLocal(h.bath, h.point)
        const onPlate = t.plate && Math.abs(lx) < PLATE_SIZE_M[0] / 2 && Math.abs(lz) < PLATE_SIZE_M[1] / 2
        if (onPlate && t.plate && focus !== h.bath) { drag = { kind: 'lift', id: t.plate, x0: p.x, y0: p.y }; return true }
        if (focus === h.bath) { drag = onPlate && t.plate ? { kind: 'lift', id: t.plate, x0: p.x, y0: p.y } : { kind: 'rock', bath: h.bath, x0: p.x, y0: p.y }; autoPattern = null; return true }
        return false
      }
      if (h.kind === 'plate' && h.id) { drag = { kind: 'lift', id: h.id, x0: p.x, y0: p.y }; return true }
      return h.kind === 'tin' || h.kind === 'rack'
    }
    if (p.kind === 'move' && drag) {
      const dx = p.x - drag.x0, dy = p.y - drag.y0
      if (drag.kind === 'lift') {
        if (-dy > 30 || (Math.hypot(dx, dy) > 30 && ent(drag.id).where.kind !== 'tray')) { const id = drag.id; drag = null; liftToHand(id); movedWhileHeld = true; if (p.ray.intersectPlane(plane, hitPlane)) heldTarget.copy(hitPlane) }
        else if (Math.hypot(dx, dy) > 12 && focus && ent(drag.id).where.kind === 'tray') { drag = { kind: 'rock', bath: focus, x0: drag.x0, y0: drag.y0 } }
        return true
      }
      const t = trayOf(drag.bath)
      const k = 0.05 * D2R * (window.innerHeight > 0 ? 900 / Math.max(500, window.innerHeight) : 1)
      t.tilt.tx = Math.max(-9 * D2R, Math.min(9 * D2R, -dx * k))
      t.tilt.tz = Math.max(-9 * D2R, Math.min(9 * D2R, -dy * k))
      return true
    }
    if (p.kind === 'up' || p.kind === 'cancel') {
      if (drag && drag.kind === 'rock') { const t = trayOf(drag.bath); t.tilt.tx = 0; t.tilt.tz = 0 }
      const had = !!drag
      drag = null
      return had
    }
    if (p.kind === 'tap') {
      const h = pick(p)
      if (!h) return false
      if (h.kind === 'tin') { tapTin(); return true }
      if (h.kind === 'tray' && h.bath) {
        const t = trayOf(h.bath)
        if (focus === h.bath) { const [lx, lz] = trayLocal(h.bath, h.point); t.fluid.poke(lx, lz, 0.0015, 0.006); ctx.bus.emit({ t: 'sfx', name: 'drip' }); return true }
        return false
      }
      if (h.kind === 'plate' && h.id) {
        const q = ent(h.id)
        if (q.where.kind === 'rack' || q.where.kind === 'table') { bench.onRequestInspect?.(h.id); return true }
        liftToHand(h.id); return true
      }
      if (h.kind === 'rack') {
        const pt = h.point, slot = Math.round((pt.x - (ROOM.rack[0] - 0.155)) / 0.0238)
        const id = PLATE_IDS[Math.max(0, Math.min(13, slot))]
        if (ent(id).where.kind === 'rack') bench.onRequestInspect?.(id)
        return true
      }
      return false
    }
    if (p.kind === 'dbl') {
      const h = pick(p)
      const id = h?.id ?? (h?.bath ? trayOf(h.bath).plate : null)
      if (id) { drop(id, nextBath(id)); return true }
      return false
    }
    if (p.kind === 'long') {
      const h = pick(p)
      if (h?.kind === 'tray' && h.bath && focus === h.bath) { autoPattern = autoPattern ? null : 'corners'; autoT = 0; return true }
      return false
    }
    return false
  }
  function liftToHand(id: PlateId): void {
    const q = ent(id)
    const holder = q.mesh as unknown as THREE.Group
    const from = q.where.kind === 'tray' ? new THREE.Vector3(...ROOM.trays[q.where.bath]) : q.where.kind === 'tin' ? new THREE.Vector3(...ROOM.tin) : holder.position.clone()
    setWhere(id, { kind: 'hand' })
    heldPos.copy(from).setY(ROOM.benchTop + 0.08); heldTarget.copy(heldPos).setY(ROOM.benchTop + 0.12); heldVel.set(0, 0, 0)
    holder.position.copy(heldPos)
    ctx.bus.emit({ t: 'sfx', name: 'glass' })
  }
  function tapTin(): void {
    for (const n of [1, 2, 3, 4] as const) if (unlocked.has(n) && !opened.has(n)) { void bench.openBundle(n); return }
    const id = nextInTin()
    if (id) liftToHand(id)
  }

  // ---------------------------------------------------------------- update
  const corners: [number, number][] = [[6, 6], [-6, 6], [-6, -6], [6, -6]]
  function update(dt: number): void {
    time += dt
    // auto-rock driver
    if (autoPattern && focus) {
      autoT += dt
      const t = trayOf(focus)
      if (autoPattern === 'corners') { const c = corners[Math.floor(autoT / 0.55) % 4]; t.tilt.tx = c[0] * D2R; t.tilt.tz = c[1] * D2R }
      else if (autoPattern === 'lr') { const s = Math.floor(autoT / 0.55) % 2 ? 1 : -1; t.tilt.tx = 6 * s * D2R; t.tilt.tz = 0 }
      else { t.tilt.tx = 0; t.tilt.tz = 0 }
    }
    for (const t of trays.values()) {
      // tilt spring-damper (k 120, c 12)
      const tl = t.tilt, k = 120, c = 12
      const sub = Math.max(1, Math.ceil(dt / (1 / 120)))
      const h = dt / sub
      for (let s = 0; s < sub; s++) {
        const prevX = tl.x, prevZ = tl.z
        tl.vx += (k * (tl.tx - tl.x) - c * tl.vx) * h; tl.vz += (k * (tl.tz - tl.z) - c * tl.vz) * h
        tl.x = Math.max(-9 * D2R, Math.min(9 * D2R, tl.x + tl.vx * h)); tl.z = Math.max(-9 * D2R, Math.min(9 * D2R, tl.z + tl.vz * h))
        if (tl.tx === 0 && tl.tz === 0 && ((prevX > 0) !== (tl.x > 0) || (prevZ > 0) !== (tl.z > 0)) && Math.hypot(tl.vx, tl.vz) > 0.2) {
          ctx.bus.emit({ t: 'sfx', name: 'clack', gain: Math.min(1, Math.hypot(tl.vx, tl.vz) / 1.5) })
          t.fluid.setAccel(tl.vx * 0.6, tl.vz * 0.6); t.accelT = 0.06
        }
      }
      t.body.rotation.z = tl.x; t.body.rotation.x = -tl.z
      t.fluid.setTilt(Math.tan(tl.x), Math.tan(tl.z))
      if (t.accelT > 0) { t.accelT -= dt; if (t.accelT <= 0) t.fluid.setAccel(0, 0) }
      // rate: focused or developing tray full rate, others ¼
      const full = focus === t.bath || (t.plate !== null && t.bath === 'dev') || t.plate !== null
      t.frame++
      if (full) t.fluid.step(dt, 4)
      else if (t.frame % 4 === 0) t.fluid.step(dt * 4, 4)
      if (!t.fluid.sleeping || t.frame % 30 === 0) t.fluid.uploadDepth()
      t.mat.uniforms.uLum.value = lum; t.mat.uniforms.uTime.value = time
    }
    // chemistry
    for (const p of plates.values()) {
      if (p.where.kind === 'tin' || p.where.kind === 'camera') continue
      const bath = p.where.kind === 'tray' ? p.where.bath : null
      const fluid = bath ? trayOf(bath).fluid : null
      const wasFixed = p.chem.fixed
      if (stepChem(p.chem, bath, fluid, dt, ctx.light, p.where.kind === 'table')) p.dirty = true
      if (!wasFixed && p.chem.fixed) {
        const w = readWedge(p.chem)
        gradeLabels[PLATE_IDS.indexOf(p.id)] = w.grade; drawRackLabels()
        ctx.bus.emit({ t: 'sfx', name: 'tink' })
        ctx.bus.emit({ t: 'plateFixed', id: p.id, grade: w.grade })
      }
      if (p.dirty) { uploadChem(p.chem, p.chemData, p.gpu.chem as THREE.DataTexture); p.dirty = false }
      p.mat.uniforms.uLum.value = lum
    }
    // tongs: carry spring x'' = 400(x* − x) − 28x'
    if (heldId) {
      const holder = ent(heldId).mesh as unknown as THREE.Group
      const sub = Math.max(1, Math.ceil(dt / (1 / 240)))
      const rdt = Math.min(dt, 1 / 20) / sub
      for (let s = 0; s < sub; s++) {
        heldVel.x += (400 * (heldTarget.x - heldPos.x) - 28 * heldVel.x) * rdt
        heldVel.y += (400 * (heldTarget.y - heldPos.y) - 28 * heldVel.y) * rdt
        heldVel.z += (400 * (heldTarget.z - heldPos.z) - 28 * heldVel.z) * rdt
        heldPos.addScaledVector(heldVel, rdt)
      }
      const roll = Math.max(-25 * D2R, Math.min(25 * D2R, -heldVel.x * 0.15 * 10)), pitch = Math.max(-25 * D2R, Math.min(25 * D2R, heldVel.z * 0.15 * 10))
      const a = 1 - Math.exp(-dt / 0.08)
      heldRoll += (roll - heldRoll) * a; heldPitch += (pitch - heldPitch) * a
      holder.position.copy(heldPos); holder.rotation.set(heldPitch, 0, heldRoll)
    }
    // bundles in the tin: opened ones vanish (their plates are "in the tin" until taken)
    bundleMeshes.forEach((m, i) => { m.visible = !opened.has(i + 1) || BUNDLE_PLATES(i + 1).some((id) => ent(id).where.kind === 'tin') ; (m.material as THREE.MeshLambertMaterial).color.setScalar(opened.has(i + 1) ? 0.55 : 0.05) })
  }

  // ---------------------------------------------------------------- API
  const bench: PlatesBench = {
    group,
    onRequestInspect: null, onWarn: null,
    get unlocked() { return unlocked }, get opened() { return opened },
    update,
    pointer,
    place(id, where) { setWhere(id, where) },
    where(id) { return ent(id).where },
    async openBundle(n) {
      unlocked.add(n)
      if (opened.has(n)) return
      opened.add(n)
      ctx.bus.emit({ t: 'sfx', name: 'unwrap' })
      ctx.bus.emit({ t: 'bundle', n })
      for (const id of BUNDLE_PLATES(n)) ensureExposure(id)
      await Promise.all(BUNDLE_PLATES(n).map((id) => lib.expose(id, ctx.renderer, ctx.settings.quality)))
    },
    chem(id) { return ent(id).chem },
    gpu(id) { const p = ent(id); return p.hasE ? p.gpu : null },
    setChem(id, patch) {
      const c = ent(id).chem
      if (patch.P !== undefined) c.P.fill(patch.P)
      if (patch.H !== undefined) { c.H.fill(patch.H); if (patch.H < 0.02) { if (!c.fixed) { c.fixed = true; const w = readWedge(c); gradeLabels[PLATE_IDS.indexOf(id)] = w.grade; drawRackLabels(); ctx.bus.emit({ t: 'plateFixed', id, grade: w.grade }) } } else c.fixed = false }
      if (patch.F !== undefined) c.F.fill(patch.F)
      if (patch.P !== undefined && c.fixed) { gradeLabels[PLATE_IDS.indexOf(id)] = readWedge(c).grade; drawRackLabels() }
      ent(id).dirty = true
      uploadChem(c, ent(id).chemData, ent(id).gpu.chem as THREE.DataTexture)
    },
    wedge(id): WedgeReading { return readWedge(ent(id).chem) },
    impulse(ax, az, seconds) { for (const t of trays.values()) { t.fluid.setAccel(ax, az); t.accelT = seconds } },
    rock(pattern) { autoPattern = pattern; autoT = 0; if (!pattern && focus) { const t = trayOf(focus); t.tilt.tx = 0; t.tilt.tz = 0 } },
    focusTarget(b) { return trayOf(b).group },
    slosh() { let e = 0; for (const t of trays.values()) e = Math.max(e, t.fluid.kinetic()); return Math.min(1, Math.sqrt(e / 2e-5)) },
    thumb(id, w, h, mode, pal?: { ink: [number, number, number]; light: [number, number, number] }) {
      const p = ent(id), e = lib.cached(id)
      const ink = pal?.ink ?? [26, 18, 6], light = pal?.light ?? [242, 182, 84]
      if (!e) { const img = new ImageData(w, h); for (let k = 0; k < w * h; k++) { img.data[k * 4] = ink[0]; img.data[k * 4 + 1] = ink[1]; img.data[k * 4 + 2] = ink[2]; img.data[k * 4 + 3] = 255 } return img }
      return developRegion(e.L, { P: p.chem.P, F: p.chem.F, H: p.chem.fixed ? undefined : p.chem.H }, p.seed, 0, 0, PLATE_W, PLATE_H, w, h, mode, ink, light)
    },
    snapshot(): WetSnapshot {
      const where: WetSnapshot['where'] = {}, chem: WetSnapshot['chem'] = {}
      for (const p of plates.values()) {
        if (p.where.kind === 'tin') continue
        where[p.id] = p.where.kind === 'hand' ? { kind: 'bench' } : p.where
        const n = SIM_W * SIM_H, P = new Uint16Array(n), H = new Uint8Array(n), F = new Uint8Array(n), B = new Uint8Array(n)
        for (let k = 0; k < n; k++) { P[k] = Math.min(65535, Math.round(p.chem.P[k] * 100)); H[k] = Math.round(p.chem.H[k] * 255); F[k] = Math.min(255, Math.round(p.chem.F[k] * 255)); B[k] = Math.min(255, Math.round(p.chem.B[k] * 255)) }
        chem[p.id] = { P, H, F, B, cDev: p.chem.cDev, fixed: p.chem.fixed }
      }
      return { v: 1, where, chem, liquid: { dev: 1, water: 1, hypo: 1 } }
    },
    restore(s: WetSnapshot) {
      if (heldId) setWhere(heldId, { kind: 'bench' }, false)
      for (const p of plates.values()) {
        const c = s.chem[p.id], w = s.where[p.id]
        if (!c || !w) { setWhere(p.id, { kind: 'tin' }, false); const fresh = newChem(p.id); p.chem.P.set(fresh.P); p.chem.H.set(fresh.H); p.chem.F.set(fresh.F); p.chem.B.fill(0); p.chem.cDev = 0; p.chem.fixed = false }
        else {
          for (let k = 0; k < c.P.length; k++) { p.chem.P[k] = c.P[k] / 100; p.chem.H[k] = c.H[k] / 255; p.chem.F[k] = c.F[k] / 255; p.chem.B[k] = c.B[k] / 255 }
          p.chem.cDev = c.cDev; p.chem.fixed = c.fixed
          setWhere(p.id, w, false)
        }
        gradeLabels[PLATE_IDS.indexOf(p.id)] = p.chem.fixed ? readWedge(p.chem).grade : null
        uploadChem(p.chem, p.chemData, p.gpu.chem as THREE.DataTexture)
      }
      drawRackLabels()
      for (const t of trays.values()) t.fluid.reset()
    },
    // extras
    setFocus(b) { focus = b; if (!b) autoPattern = null },
    unlock(n) { unlocked.add(n) },
    held() { return heldId },
    setLum(l) { lum = l },
    trayFluid(b) { return trayOf(b).fluid },
    tableWhite() { return false },
    rocking() { return !!autoPattern || (drag?.kind === 'rock') },
    meshes() { return [tin, rack, ...[...trays.values()].map((t) => t.group)] },
  }
  void maxH
  gradeLabels = gradeLabels.slice()
  return bench
}

// Lantern Street (lensbench.md §5.6, §5.11, §6.5, §6.6). Every moving thing is a pure function of
// world time t. Radiance is in kcd/m² (lights fed as lux/1000; emitters as luminance in kcd/m²).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { hash2 } from '@shared/core'
import { lensbenchSun } from '@shared/sun'
import type { QualityTier, StandpointId, TargetId } from '../../core/types'
import { bladeNumberCanvas, chartCanvas, cobbleTexture, facadeTexture, signCanvas, slabTexture, streetText, tex, type StreetText } from './textures'

export interface Emitter { x: number; y: number; z: number; cd: [number, number, number]; kind: 'bulb' | 'lamp' | 'bike' | 'tail' }
export interface TargetDef {
  id: TargetId; at(t: number, out: THREE.Vector3): THREE.Vector3
  velocity(t: number, out: THREE.Vector3): THREE.Vector3; sizeM: number; glyphM?: number
  answer?(textSeed: number): string
}
export interface World {
  scene: THREE.Scene; standpoints: Record<StandpointId, { pos: [number, number, number]; yawDeg: number; pitchDeg: number }>
  targets: Record<TargetId, TargetDef>
  setTimeOfDay(h: number): void; setTextSeed(s: number): void; setIR(on: boolean): void
  setEmitterMeshes(on: boolean): void
  update(t: number): void
  emitters(t: number, out: Emitter[]): number
  sun(): { dir: THREE.Vector3; elevDeg: number; normalLux: number; skyLux: number; color: [number, number, number] }
  windmillOmega(t: number): number; clampWalk(p: THREE.Vector3): void
  /** extras */
  readonly timeOfDay: number
  readonly lightsOn: boolean
  text(): StreetText
  wind(t: number): number
  dispose(): void
}

const TAU = Math.PI * 2
export const wind = (t: number) => 0.55 + 0.25 * Math.sin((TAU * t) / 37 + 1) + 0.2 * Math.sin((TAU * t) / 11.3 + 2.7)
export const windmillAngle = (t: number) =>
  20.5 * t - 30 * (0.25 * (37 / TAU) * Math.cos((TAU * t) / 37 + 1) + 0.2 * (11.3 / TAU) * Math.cos((TAU * t) / 11.3 + 2.7))
export const courierX = (t: number) => -60 + 6 * ((((t + 7) % 40) + 40) % 40)

const STANDPOINTS: World['standpoints'] = {
  window: { pos: [-24, 6.0, 6.3], yawDeg: -74.6, pitchDeg: -12 },
  shopStep: { pos: [-24, 1.6, 5.4], yawDeg: -84, pitchDeg: 2 },
  bakery: { pos: [-11, 1.6, -3.5], yawDeg: 0, pitchDeg: -3 },
  fountain: { pos: [-6, 1.6, 2], yawDeg: -71.6, pitchDeg: 0 },
  across: { pos: [-24, 1.6, -5.5], yawDeg: 180, pitchDeg: 6 },
  farEnd: { pos: [40, 1.6, 0], yawDeg: -90, pitchDeg: 3 },
  chart: { pos: [32, 1.6, 0], yawDeg: 0, pitchDeg: 5 },
}

function lambert(hex: number | THREE.Color, o: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...o })
}

export async function createWorld(q: QualityTier): Promise<World> {
  const scene = new THREE.Scene()
  const disposables: { dispose(): void }[] = []
  const texSize = q === 'desktop' ? 512 : q === 'phone' ? 256 : 256
  const shadowSize = q === 'desktop' ? 2048 : q === 'phone' ? 1024 : 512
  let textSeed = 1
  let txt = streetText(textSeed)

  // ---------------------------------------------------------------- lights and sky
  const sunLight = new THREE.DirectionalLight(0xffffff, 1)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(shadowSize, shadowSize)
  const sc = sunLight.shadow.camera
  sc.left = -60; sc.right = 60; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260
  sunLight.shadow.bias = -0.0006
  sunLight.shadow.normalBias = 0.04
  scene.add(sunLight, sunLight.target)
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x5a4a3a, 1)
  scene.add(hemi)
  const lampLights: THREE.PointLight[] = []
  const LAMPS: [number, number][] = [[-30, -5.6], [-10, 5.6], [10, -5.6], [30, 5.6]]
  for (const [x, z] of LAMPS) {
    const l = new THREE.PointLight(0xffa860, 0, 0, 2)
    l.position.set(x, 4.3, z)
    scene.add(l)
    lampLights.push(l)
  }
  const bikeLight = new THREE.PointLight(0xfff0d0, 0, 0, 2)
  scene.add(bikeLight)

  const skyUni = {
    uHor: { value: new THREE.Vector3(1, 1, 1) }, uZen: { value: new THREE.Vector3(0.5, 0.6, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3(1, 1, 1) },
    uAur: { value: 1 }, uDisc: { value: 60000 },
  }
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUni, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = (modelMatrix*vec4(position,0.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uHor, uZen, uSunDir, uSunCol; uniform float uAur, uDisc; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float e = max(d.y, 0.0);
        vec3 sky = mix(uHor, uZen, pow(e, 0.45));
        float g = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
        sky += uSunCol * uAur * exp(-g / 0.08);
        sky += uSunCol * uDisc * (1.0 - smoothstep(0.0040, 0.0048, g));
        if (d.y < 0.0) sky = uHor * mix(0.6, 0.15, clamp(-d.y * 3.0, 0.0, 1.0));
        gl_FragColor = vec4(sky, 1.0); }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -10
  scene.add(sky)

  // ---------------------------------------------------------------- ground
  const cobT = tex(cobbleTexture(texSize), true, true)
  cobT.repeat.set(200 / 3, 60 / 3)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), lambert(0xffffff, { map: cobT, flatShading: false }))
  ground.rotation.x = -Math.PI / 2
  ground.position.x = 20
  ground.receiveShadow = true
  scene.add(ground)
  const slabT = tex(slabTexture(texSize / 2), true, true)
  const paveMat = lambert(0xffffff, { map: slabT, flatShading: false })
  const pavGeos: THREE.BufferGeometry[] = []
  const addPave = (x0: number, x1: number, z0: number, z1: number) => {
    const g = new THREE.BoxGeometry(x1 - x0, 0.14, z1 - z0)
    g.translate((x0 + x1) / 2, 0.07, (z0 + z1) / 2)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 2, uv.getY(i) * (z1 - z0) / 2)
    pavGeos.push(g)
  }
  addPave(-46, -8, -7, -5); addPave(8, 46, -7, -5); addPave(-46, -8, 5, 7); addPave(8, 46, 5, 7)
  addPave(-8, 8, -10, -8); addPave(-8, 8, 8, 10)
  const pave = new THREE.Mesh(mergeGeometries(pavGeos), paveMat)
  pave.receiveShadow = true
  scene.add(pave)

  // ---------------------------------------------------------------- facades
  const facadeMats: THREE.MeshLambertMaterial[] = []
  const roofGeos: THREE.BufferGeometry[] = []
  const r0 = (i: number) => hash2(i, 17, 5)
  interface Bldg { x0: number; x1: number; h: number; north: boolean; front: number }
  const bldgs: Bldg[] = []
  for (const north of [true, false]) {
    let x = -46
    let i = north ? 0 : 100
    while (x < 46) {
      let w = 6 + Math.floor(r0(i) * 5)
      if (x < -8 && x + w > -8) w = -8 - x
      if (x >= -8 && x < 8) w = Math.min(w, 8 - x)
      if (w < 2) w = 2
      const inSquare = x >= -8 && x < 8
      let h = 7 + Math.floor(r0(i + 50) * 7)
      if (!north && x <= -24 && x + w > -24) h = 7.6 // Quist: two storeys
      if (!north && x <= 20 && x + w > 20) h = 12.6 // windmill roof
      bldgs.push({ x0: x, x1: x + w, h, north, front: north ? (inSquare ? -10 : -7) : inSquare ? 10 : 7 })
      x += w
      i++
    }
  }
  bldgs.forEach((b, i) => {
    const w = b.x1 - b.x0, depth = 8
    const ft = facadeTexture(1000 + i * 7, w, b.h, texSize)
    const colT = tex(ft.col)
    const winT = tex(ft.win)
    colT.repeat.set(1, 1)
    const front = lambert(0xffffff, { map: colT, emissive: 0xffc070, emissiveMap: winT, emissiveIntensity: 0, flatShading: false })
    const side = lambert(ft.brick ? 0x8a4a36 : 0xb9a48a)
    facadeMats.push(front)
    const mats = b.north ? [side, side, side, side, front, side] : [side, side, side, side, side, front]
    const g = new THREE.BoxGeometry(w, b.h, depth)
    const m = new THREE.Mesh(g, mats)
    m.position.set((b.x0 + b.x1) / 2, b.h / 2, b.front + (b.north ? -depth / 2 : depth / 2))
    m.castShadow = true; m.receiveShadow = true
    scene.add(m)
    disposables.push(g, side, colT, winT)
    // roof wedge
    const rg = new THREE.CylinderGeometry(0.01, depth / 2 * 1.02, w, 3, 1)
    rg.rotateZ(Math.PI / 2)
    rg.rotateX(b.north ? 0 : Math.PI)
    rg.scale(1, 0.5 + r0(i + 9) * 0.5, 1)
    rg.translate((b.x0 + b.x1) / 2, b.h + 0.6, b.front + (b.north ? -depth / 2 : depth / 2))
    roofGeos.push(rg)
  })
  const roofs = new THREE.Mesh(mergeGeometries(roofGeos), lambert(0x4a3a36))
  roofs.castShadow = true
  scene.add(roofs)

  // ---------------------------------------------------------------- signs and text
  const textMeshes: { mesh: THREE.Mesh; draw: () => HTMLCanvasElement }[] = []
  const addSign = (draw: () => HTMLCanvasElement, w: number, h: number, pos: [number, number, number], rotY: number, emissive = 0) => {
    const c = draw()
    const t = tex(c)
    const mat = lambert(0xffffff, { map: t, flatShading: false, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? t : null, emissiveIntensity: 0 })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.position.set(...pos)
    m.rotation.y = rotY
    m.receiveShadow = true
    scene.add(m)
    textMeshes.push({ mesh: m, draw })
    return m
  }
  // Quist shop sign (south, facing north = rotY π)
  addSign(() => signCanvas('QUIST · CAMERA REPAIR · CUSTOM OPTICS', { w: 1024, h: 128, bg: '#1d1712', fg: '#e2c27a', font: 'bold 66px "Arial Narrow", "Roboto Condensed", sans-serif', border: '#b8893a' }), 4.6, 0.58, [-24, 3.35, 6.97], Math.PI)
  // Bakery: transom year (glyph 0.11 m), awning
  addSign(() => signCanvas(`EST. ${txt.bakeryYear}`, { w: 256, h: 64, bg: '#2b1e14', fg: '#f3e6c8', font: 'bold 40px Georgia, serif', border: '#c9a46a' }), 0.9, 0.22, [-12, 3.1, -6.97], 0)
  addSign(() => signCanvas('BAKERY No. 9', { w: 512, h: 96, bg: '#f1e6d2', fg: '#5a1f16', font: 'bold 64px Georgia, serif' }), 3.2, 0.5, [-12, 4.0, -6.96], 0)
  const awnC = document.createElement('canvas')
  awnC.width = 128; awnC.height = 8
  const awnG = awnC.getContext('2d')
  if (awnG) for (let k = 0; k < 8; k++) { awnG.fillStyle = k % 2 ? '#f2ead8' : '#2f5a46'; awnG.fillRect(k * 16, 0, 16, 8) }
  const awn = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 1.4), lambert(0xffffff, { map: tex(awnC) }))
  awn.position.set(-12, 2.75, -6.35); awn.rotation.x = 0.35; awn.castShadow = true
  scene.add(awn)
  // chalkboard A-frame (glyph 0.06 m)
  const cbSign = addSign(() => signCanvas(txt.chalkboard, { w: 256, h: 192, bg: '#1e2420', fg: '#f4f1ea', font: 'bold 44px "Segoe Print", "Bradley Hand", cursive', border: '#6b4a2e' }), 0.5, 0.38, [-11.2, 0.55, -5.35], 0)
  cbSign.rotation.x = -0.18
  // chart wall (Lyric cinema)
  addSign(() => chartCanvas(q === 'desktop' ? 1024 : 512, txt.marquee), 4, 3, [32, 2.5, -6.97], 0)
  // clock plaque on the tower's west face
  addSign(() => signCanvas(txt.clockPlaque, { w: 1024, h: 96, bg: '#3a2c1c', fg: '#e8c98a', font: 'bold 60px "Arial Narrow", sans-serif', border: '#b8893a' }), 5.2, 0.42, [77.95, 3.0, 0], -Math.PI / 2)

  // ---------------------------------------------------------------- props
  const dark = lambert(0x1a1a1c)
  const white = lambert(0xe8e4dc)
  const brass = lambert(0xb8893a)
  // Clock tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 24, 4), lambert(0x9a8a74))
  tower.position.set(80, 12, 0); tower.castShadow = true; tower.receiveShadow = true
  scene.add(tower)
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 4), lambert(0x3d4a44))
  spire.position.set(80, 26.5, 0); spire.rotation.y = Math.PI / 4
  scene.add(spire)
  const clockHands: THREE.Group[] = []
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), lambert(0xf0e8d8, { flatShading: false }))
    face.add(disc)
    for (let h = 0; h < 12; h++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.25), dark)
      const a = (h / 12) * TAU
      tick.position.set(Math.sin(a) * 1.25, Math.cos(a) * 1.25, 0.01); tick.rotation.z = -a
      face.add(tick)
    }
    const hands = new THREE.Group()
    const hr = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.8), dark); hr.position.y = 0.4; hr.name = 'h'
    const mn = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.2), dark); mn.position.y = 0.6; mn.name = 'm'
    const hg = new THREE.Group(); hg.add(hr); const mg = new THREE.Group(); mg.add(mn)
    hands.add(hg, mg); hands.position.z = 0.02
    face.add(hands)
    clockHands.push(hands)
    const a = (k * Math.PI) / 2
    face.position.set(80 + Math.sin(a) * 2.02, 18, Math.cos(a) * 2.02)
    face.rotation.y = a
    scene.add(face)
  }

  // Fountain
  const stone = lambert(0xb7ad9c)
  const fGeos: THREE.BufferGeometry[] = []
  const addCyl = (rt: number, rb: number, h: number, y: number, seg = 24) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y, 0); fGeos.push(g) }
  addCyl(2.2, 2.3, 0.5, 0.25); addCyl(0.25, 0.35, 1.2, 1.0, 12); addCyl(1.1, 0.6, 0.25, 1.3); addCyl(0.12, 0.18, 0.7, 1.75, 10); addCyl(0.5, 0.3, 0.18, 2.1)
  const fountain = new THREE.Mesh(mergeGeometries(fGeos), stone)
  fountain.castShadow = true; fountain.receiveShadow = true
  scene.add(fountain)
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.05, 32), lambert(0x34505a, { flatShading: false }))
  water.rotation.x = -Math.PI / 2; water.position.y = 0.42
  scene.add(water)
  const NDROP = 400
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), lambert(0xd9e6ee, { flatShading: false }), NDROP)
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  drops.frustumCulled = false
  scene.add(drops)

  // Windmill on the south roof, hub (20, 15, 9), facing the street
  const mill = new THREE.Group()
  mill.position.set(20, 15, 8.6)
  const millRot = new THREE.Group()
  mill.add(millRot)
  const bladeMat = lambert(0xe6dccb)
  for (let b = 0; b < 6; b++) {
    const arm = new THREE.Group()
    arm.rotation.z = (b / 6) * TAU
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.2, 0.04), bladeMat)
    blade.position.y = 1.2; blade.rotation.y = 0.25
    blade.castShadow = true
    arm.add(blade)
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), lambert(0xffffff, { map: tex(bladeNumberCanvas(b + 1)), flatShading: false }))
    num.position.set(0, 1.4, -0.06); num.rotation.y = Math.PI
    arm.add(num)
    millRot.add(arm)
  }
  const hubM = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12), dark)
  hubM.rotation.x = Math.PI / 2
  millRot.add(hubM)
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), dark)
  mast.position.set(0, -1.3, 0.4)
  mill.add(mast)
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 1.6), dark)
  vane.position.set(0, 0.2, 1.4)
  mill.add(vane)
  scene.add(mill)

  // Street lamps
  const lampHeads: THREE.Mesh[] = []
  const lampGlassMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  for (const [x, z] of LAMPS) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.4, 8), dark)
    post.position.set(x, 2.2, z); post.castShadow = true
    scene.add(post)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 4), dark)
    cap.position.set(x, 4.72, z); cap.rotation.y = Math.PI / 4
    scene.add(cap)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), lampGlassMat)
    head.position.set(x, 4.45, z)
    scene.add(head)
    lampHeads.push(head)
  }

  // String lights: 4 zigzag catenaries over the square
  const NB = 40
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), bulbMat, NB)
  bulbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  bulbs.frustumCulled = false
  scene.add(bulbs)
  const bulbBase: THREE.Vector3[] = []
  const wirePts: THREE.Vector3[] = []
  const XS = [-20, -10, 0, 10, 20]
  for (let s = 0; s < 4; s++) {
    const za = s % 2 ? 6.6 : -6.6, zb = -za
    const a = new THREE.Vector3(XS[s], 6, za), b = new THREE.Vector3(XS[s + 1], 6, zb)
    for (let k = 0; k <= 20; k++) {
      const u = k / 20
      const p = a.clone().lerp(b, u); p.y -= 0.6 * 4 * u * (1 - u)
      wirePts.push(p)
      if (k % 2 === 1) bulbBase.push(p.clone().add(new THREE.Vector3(0, -0.05, 0)))
    }
  }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x111111 }))
  scene.add(wire)

  // Railings (south edge x −8…+30, z +6)
  const NP = Math.floor(38 / 1.2) + 1
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), dark, NP)
  const tmpM = new THREE.Matrix4()
  for (let i = 0; i < NP; i++) { tmpM.makeTranslation(-8 + i * 1.2, 0.5 + 0.14, 6); posts.setMatrixAt(i, tmpM) }
  posts.castShadow = true
  scene.add(posts)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(38, 0.05, 0.06), white)
  rail.position.set(11, 1.14, 6); rail.castShadow = true
  scene.add(rail)

  // Pillar postbox
  const pbMat = lambert(new THREE.Color(0.55, 0.04, 0.03))
  const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 1.5, 16), pbMat)
  pb.position.set(-4, 0.75 + 0.14, -5.8); pb.castShadow = true
  scene.add(pb)
  const pbCap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, TAU, 0, Math.PI / 2), pbMat)
  pbCap.position.set(-4, 1.64, -5.8)
  scene.add(pbCap)
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.02), dark)
  slot.position.set(-4, 1.35, -5.54)
  scene.add(slot)

  // Tree (6, 0, 6)
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 3, 8), lambert(0x4a3524))
  trunk.position.y = 1.5; trunk.castShadow = true
  tree.add(trunk)
  const leaf = lambert(new THREE.Color(0.08, 0.16, 0.05))
  for (const [x, y, z, r] of [[0, 3.6, 0, 1.6], [0.8, 4.4, 0.3, 1.1], [-0.7, 4.2, -0.4, 1.2]] as const) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf)
    s.position.set(x, y, z); s.castShadow = true
    tree.add(s)
  }
  tree.position.set(6, 0, 6)
  scene.add(tree)

  // Bench + reader at (3, 0, −5.2)
  const benchMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.45), lambert(0x6b4a2e))
  benchMesh.position.set(3, 0.5, -5.3); benchMesh.castShadow = true
  scene.add(benchMesh)
  const skinMat = lambert(0xc99a7a)
  const makePerson = (coat: number) => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 4, 8), lambert(coat))
    body.position.y = 1.15; body.castShadow = true
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), skinMat)
    head.position.y = 1.62; head.castShadow = true
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.1, 10), dark)
    hat.position.y = 1.74
    g.add(body, head, hat)
    const limbs: THREE.Group[] = []
    for (const [x, y, len, w] of [[-0.1, 0.8, 0.8, 0.07], [0.1, 0.8, 0.8, 0.07], [-0.24, 1.42, 0.62, 0.05], [0.24, 1.42, 0.62, 0.05]] as const) {
      const pivot = new THREE.Group()
      pivot.position.set(x, y, 0)
      const limb = new THREE.Mesh(new THREE.BoxGeometry(w * 2, len, w * 2), lambert(y < 1 ? 0x2a2a30 : coat))
      limb.position.y = -len / 2; limb.castShadow = true
      pivot.add(limb)
      g.add(pivot)
      limbs.push(pivot)
    }
    return { g, limbs }
  }
  const w1 = makePerson(0x6a3b2c), w2 = makePerson(0x2f4a5a), reader = makePerson(0x56604a)
  scene.add(w1.g, w2.g, reader.g)
  reader.g.position.set(3, -0.38, -5.2)
  reader.limbs[0].rotation.x = -1.5; reader.limbs[1].rotation.x = -1.5
  reader.limbs[2].rotation.x = -0.9; reader.limbs[3].rotation.x = -0.9
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.2), white)
  book.position.set(3, 1.0, -4.95); book.rotation.x = -0.6
  scene.add(book)
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.19), white)
  page.position.set(3, 1.02, -4.95)
  scene.add(page)

  // Cat on the bakery sill (−10.2, 1.15, −6.6)
  const cat = new THREE.Group()
  const fur = lambert(0xc8873e)
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), fur); catBody.scale.set(1.6, 1, 1); catBody.position.set(0, 0.14, 0)
  const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), fur); catHead.position.set(0.2, 0.3, 0.06)
  const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), fur); ear1.position.set(0.17, 0.4, 0.1)
  const ear2 = ear1.clone(); ear2.position.set(0.25, 0.4, 0.04)
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xe0a020, emissive: 0x302000, emissiveIntensity: 0 })
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat); eye1.position.set(0.24, 0.32, 0.14)
  const eye2 = eye1.clone(); eye2.position.set(0.29, 0.32, 0.1)
  const tail = new THREE.Group(); tail.position.set(-0.24, 0.12, 0)
  let seg: THREE.Object3D = tail
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Group(); s.position.y = k ? 0.06 : 0
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 6), fur); m.position.y = 0.035
    s.add(m); seg.add(s); seg = s
  }
  cat.add(catBody, catHead, ear1, ear2, eye1, eye2, tail)
  cat.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  cat.position.set(-10.2, 1.15, -6.6)
  cat.rotation.y = -Math.PI / 2 + 0.3
  scene.add(cat)
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.35), white)
  sill.position.set(-10.2, 1.11, -6.82)
  scene.add(sill)

  // Courier Pip: bicycle + rider along z = +2.6
  const courier = new THREE.Group()
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.025, 6, 20)
  const wheels: THREE.Group[] = []
  for (const x of [-0.52, 0.52]) {
    const wg = new THREE.Group(); wg.position.set(x, 0.36, 0)
    wg.add(new THREE.Mesh(wheelGeo, dark))
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.66, 0.012), white); sp.rotation.z = (k / 4) * Math.PI; wg.add(sp) }
    courier.add(wg); wheels.push(wg)
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.04), lambert(0x2a5a8a)); frame.position.set(0, 0.62, 0); frame.rotation.z = 0.1
  const rider = makePerson(0x8a5a2a)
  rider.g.position.set(-0.1, -0.15, 0)
  rider.g.rotation.z = -0.25
  rider.limbs[2].rotation.z = -0.9; rider.limbs[3].rotation.z = -0.9
  courier.add(frame, rider.g)
  const plate = addSign(() => signCanvas(txt.courierPlate, { w: 256, h: 96, bg: '#f2e9c9', fg: '#141414', font: 'bold 64px "Arial Narrow", sans-serif', border: '#141414' }), 0.26, 0.1, [0, 0, 0], -Math.PI / 2)
  scene.remove(plate); plate.position.set(-0.9, 0.75, 0); courier.add(plate)
  const bikeLampMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const tailLampMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const bikeLamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bikeLampMat); bikeLamp.position.set(0.72, 0.85, 0)
  const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), tailLampMat); tailLamp.position.set(-0.86, 0.85, 0)
  courier.add(bikeLamp, tailLamp)
  courier.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  scene.add(courier)

  // Bakery steam puffs
  const NSTEAM = 24
  const steam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }), NSTEAM)
  steam.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  steam.frustumCulled = false
  scene.add(steam)

  // ---------------------------------------------------------------- state
  let tod = 17.5
  let lightsOn = false
  const sunDir = new THREE.Vector3(0, 1, 0)
  let sunState = { dir: sunDir, elevDeg: 30, normalLux: 0, skyLux: 0, color: [1, 1, 1] as [number, number, number] }
  const applyTime = (h: number) => {
    tod = h
    const s = lensbenchSun(h)
    sunDir.set(s.dir[0], s.dir[1], -s.dir[2]).normalize() // shared +z north → street −z north
    const kl = s.normalLux / 1000
    sunLight.color.setRGB(s.sunRGB[0], s.sunRGB[1], s.sunRGB[2])
    sunLight.intensity = kl
    sunLight.position.copy(sunDir).multiplyScalar(120).add(new THREE.Vector3(10, 0, 0))
    sunLight.target.position.set(10, 0, 0)
    // night floor for the sky (twilight fades to 0.0005 kcd/m²)
    const night = Math.max(0, Math.min(1, (-s.elevDeg - 4) / 10))
    const nf = 1 - night * 0.94
    const Lh = s.skyHorizonKcd * nf, Lz = s.skyZenithKcd * nf
    skyUni.uHor.value.set(s.horizonRGB[0] * Lh, s.horizonRGB[1] * Lh, s.horizonRGB[2] * Lh)
    skyUni.uZen.value.set(0.45 * Lz, 0.6 * Lz, 1.0 * Lz)
    skyUni.uSunDir.value.copy(sunDir)
    const sNorm = Math.max(0.0005, Lh / 8)
    skyUni.uSunCol.value.set(s.sunRGB[0], s.sunRGB[1], s.sunRGB[2])
    skyUni.uAur.value = s.elevDeg > -2 ? 40 * sNorm : 0
    skyUni.uDisc.value = s.elevDeg > -0.3 ? Math.min(60000, kl * 300) : 0
    // ambient: E_sky ≈ π·mean(L)
    const meanL = (Lh * 2 + Lz) / 3
    const eSky = Math.PI * meanL
    hemi.intensity = eSky
    hemi.color.setRGB(0.55 + 0.45 * (1 - s.horizonRGB[2]), 0.7, 1.0)
    hemi.groundColor.setRGB(0.42, 0.36, 0.3)
    lightsOn = s.elevDeg < 4
    const lampOn = lightsOn ? 1 : 0
    for (const l of lampLights) l.intensity = 0.15 * lampOn
    bikeLight.intensity = 0.02 * lampOn
    lampGlassMat.color.setRGB(4.8 * lampOn, 3.2 * lampOn, 1.7 * lampOn)
    bulbMat.color.setRGB(1.06 * lampOn, 0.76 * lampOn, 0.45 * lampOn)
    bikeLampMat.color.setRGB(4 * lampOn, 3.8 * lampOn, 3.2 * lampOn)
    tailLampMat.color.setRGB(0.7 * lampOn, 0.02 * lampOn, 0.01 * lampOn)
    for (const m of facadeMats) m.emissiveIntensity = lightsOn ? 0.05 : 0
    eyeMat.emissiveIntensity = 0
    sunState = { dir: sunDir, elevDeg: s.elevDeg, normalLux: s.normalLux, skyLux: eSky * 1000, color: s.sunRGB }
  }
  applyTime(tod)

  const setTextSeed = (s: number) => {
    textSeed = s >>> 0
    txt = streetText(textSeed)
    for (const tm of textMeshes) {
      const mat = tm.mesh.material as THREE.MeshLambertMaterial
      const old = mat.map
      mat.map = tex(tm.draw())
      if (mat.emissiveMap === old) mat.emissiveMap = mat.map
      old?.dispose()
      mat.needsUpdate = true
    }
  }

  // ---------------------------------------------------------------- motion
  const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3()
  const jetDirs = [0, 1, 2, 3].map((j) => new THREE.Vector3(Math.cos((j / 4) * TAU + 0.4), 0, Math.sin((j / 4) * TAU + 0.4)))
  const w1Pos = (t: number, out: THREE.Vector3) => {
    const per = (2 * Math.PI * Math.sqrt((36 + 16) / 2)) / 1.3
    const a = (t / per) * TAU
    return out.set(6 * Math.cos(a), 0, 4 * Math.sin(a))
  }
  const w2Pos = (t: number, out: THREE.Vector3) => {
    const L = 60, s = ((t * 1.4) % (2 * L) + 2 * L) % (2 * L)
    return out.set(s < L ? -30 + s : 30 - (s - L), 0, -6.1)
  }
  const bladeNearestTop = (t: number) => {
    const phi = windmillAngle(t)
    let best = 0, bd = 9
    for (let b = 0; b < 6; b++) {
      const a = (((phi + (b / 6) * TAU) % TAU) + TAU) % TAU
      const d = Math.min(a, TAU - a)
      if (d < bd) { bd = d; best = b }
    }
    return { b: best, a: phi + (best / 6) * TAU }
  }
  const update = (t: number) => {
    const W = wind(t)
    millRot.rotation.z = windmillAngle(t)
    // courier
    const cx = courierX(t)
    courier.position.set(cx, 0.14, 2.6)
    rider.g.position.y = -0.15 + 0.03 * Math.sin((TAU * cx) / 1.9)
    for (const w of wheels) w.rotation.z = -cx / 0.34
    rider.limbs[0].rotation.z = Math.sin(cx / 0.34) * 0.6; rider.limbs[1].rotation.z = -Math.sin(cx / 0.34) * 0.6
    bikeLight.position.set(cx + 1.2, 0.9, 2.6)
    // walkers
    const sw = Math.sin(TAU * 1.8 * t)
    w1Pos(t, tmpP); w1.g.position.copy(tmpP)
    w1Pos(t + 0.05, tmpS); w1.g.rotation.y = Math.atan2(tmpS.x - tmpP.x, tmpS.z - tmpP.z) - Math.PI / 2
    w2Pos(t, tmpP); w2.g.position.copy(tmpP)
    w2Pos(t + 0.05, tmpS); w2.g.rotation.y = tmpS.x >= tmpP.x ? 0 : Math.PI
    for (const p of [w1, w2]) {
      p.limbs[0].rotation.x = 0.5 * sw; p.limbs[1].rotation.x = -0.5 * sw
      p.limbs[2].rotation.x = -0.4 * sw; p.limbs[3].rotation.x = 0.4 * sw
    }
    page.rotation.y = ((t % 23) / 23 > 0.95 ? ((t % 23) - 21.85) / 1.15 : 0) * Math.PI
    // cat
    const tailA = 0.5 * Math.sin((TAU * t) / 2.3) + 0.2 * Math.sin((TAU * t) / 0.9)
    let s: THREE.Object3D | undefined = tail.children[0]
    tail.rotation.z = 0.6 + tailA * 0.4
    for (let k = 0; s && k < 6; k++) { s.rotation.z = tailA * 0.15; s.rotation.x = tailA * 0.1; s = s.children.find((c) => c.type === 'Group') }
    const blink = (t % 4.7) < 0.15
    eye1.scale.y = eye2.scale.y = blink ? 0.15 : 1
    // fountain droplets
    for (let i = 0; i < NDROP; i++) {
      const T = 1.2
      const ph = hash2(i, 3, 11) * T
      const a = (((t - ph) % T) + T) % T
      const j = i & 3
      const v = 3.2 * (0.9 + 0.2 * hash2(i, 7, 13))
      const el = (70 * Math.PI) / 180
      const d = jetDirs[j]
      const vx = d.x * v * Math.cos(el) * 0.35, vz = d.z * v * Math.cos(el) * 0.35, vy = v * Math.sin(el)
      const y = 2.2 + vy * a - 4.905 * a * a
      tmpP.set(d.x * 0.4 + vx * a, y, d.z * 0.4 + vz * a)
      const hidden = y < 0.45
      tmpS.setScalar(hidden ? 0 : 1)
      tmpM.compose(tmpP, tmpQ.identity(), tmpS)
      drops.setMatrixAt(i, tmpM)
    }
    drops.instanceMatrix.needsUpdate = true
    // string lights sway
    for (let i = 0; i < NB; i++) {
      const b = bulbBase[i]
      tmpP.copy(b); tmpP.z += 0.05 * W * Math.sin((TAU * t) / 3.1 + 0.3 * i); tmpP.x += 0.03 * W * Math.sin((TAU * t) / 3.1 + 0.3 * i)
      tmpM.makeTranslation(tmpP.x, tmpP.y, tmpP.z)
      bulbs.setMatrixAt(i, tmpM)
    }
    bulbs.instanceMatrix.needsUpdate = true
    tree.rotation.z = 0.01 * W * Math.sin((TAU * t) / 3.1)
    // steam
    for (let i = 0; i < NSTEAM; i++) {
      const life = 3
      const a = (((t / life + i / NSTEAM) % 1) + 1) % 1
      tmpP.set(-13.4 + 0.2 * Math.sin(i * 1.7 + t), 3.0 + a * 1.2, -6.4 + 0.15 * Math.cos(i * 2.3))
      tmpS.setScalar(0.4 + a * 1.5)
      tmpM.compose(tmpP, tmpQ.identity(), tmpS)
      steam.setMatrixAt(i, tmpM)
    }
    steam.instanceMatrix.needsUpdate = true
    // clock hands read the time of day
    const hh = tod % 12, mm = (tod % 1) * 60
    for (const h of clockHands) {
      h.children[0].rotation.z = -(hh / 12) * TAU
      h.children[1].rotation.z = -(mm / 60) * TAU
    }
  }

  // ---------------------------------------------------------------- targets
  const v3 = (x: number, y: number, z: number) => (_t: number, out: THREE.Vector3) => out.set(x, y, z)
  const fdVel = (at: (t: number, o: THREE.Vector3) => THREE.Vector3) => {
    const a = new THREE.Vector3(), b = new THREE.Vector3()
    return (t: number, out: THREE.Vector3) => { at(t - 0.005, a); at(t + 0.005, b); return out.copy(b).sub(a).multiplyScalar(100) }
  }
  const T = (id: TargetId, at: (t: number, o: THREE.Vector3) => THREE.Vector3, sizeM: number, glyphM?: number, answer?: (s: number) => string): TargetDef =>
    ({ id, at, velocity: fdVel(at), sizeM, glyphM, answer })
  const targets: Record<TargetId, TargetDef> = {
    bakeryYear: T('bakeryYear', v3(-12, 3.1, -6.95), 0.9, 0.11, (s) => streetText(s).bakeryYear),
    chalkboard: T('chalkboard', v3(-11.2, 0.55, -5.4), 0.5, 0.06, (s) => streetText(s).chalkboard),
    catEye: T('catEye', v3(-10.2 + 0.0, 1.47, -6.4), 0.06),
    catWall: T('catWall', v3(-10.2, 1.4, -9.0), 1),
    fountain: T('fountain', v3(0, 1.5, 0), 4.4),
    reader: T('reader', v3(3, 1.1, -5.1), 0.9),
    walker1: T('walker1', (t, o) => w1Pos(t, o).setY(1.2), 1.7),
    walker2: T('walker2', (t, o) => w2Pos(t, o).setY(1.2), 1.7),
    lamp2: T('lamp2', v3(-10, 4.45, 5.6), 0.2),
    railing: T('railing', v3(11, 0.9, 6), 1),
    chart: T('chart', v3(32, 2.5, -6.95), 4),
    clockPlaque: T('clockPlaque', v3(77.95, 3.0, 0), 5.2, 0.18, (s) => streetText(s).clockPlaque),
    courier: T('courier', (t, o) => o.set(courierX(t), 1.1, 2.6), 1.8),
    courierPlate: T('courierPlate', (t, o) => o.set(courierX(t) - 0.9, 0.89, 2.6), 0.26, 0.07, (s) => streetText(s).courierPlate),
    windmill: T('windmill', v3(20, 15, 8.6), 4.6),
    bladeNumber: T('bladeNumber', (t, o) => { const { a } = bladeNearestTop(t); return o.set(20 - Math.sin(a) * 1.4, 15 + Math.cos(a) * 1.4, 8.54) }, 0.4, 0.4, () => ''),
    postbox: T('postbox', v3(-4, 0.9, -5.8), 1.6),
    tree: T('tree', v3(6, 3.2, 6), 4),
    shopSign: T('shopSign', v3(-24, 3.35, 6.97), 4.6, 0.16, () => 'QUIST'),
    facadeBehindCourier: T('facadeBehindCourier', (t, o) => o.set(courierX(t), 2.5, 7), 3),
  }
  targets.bladeNumber.answer = () => ''

  const world: World = {
    scene, standpoints: STANDPOINTS, targets,
    setTimeOfDay(h: number) { if (Math.abs(h - tod) > 1e-9) applyTime(h) },
    setTextSeed,
    setIR() { /* SHOULD: IR albedo */ },
    setEmitterMeshes(on: boolean) { bulbs.visible = on; for (const h of lampHeads) h.visible = on },
    update,
    emitters(t: number, out: Emitter[]): number {
      if (!lightsOn) return 0
      let n = 0
      const W = wind(t)
      for (let i = 0; i < NB; i++) {
        const b = bulbBase[i]
        out[n++] = { x: b.x + 0.03 * W * Math.sin((TAU * t) / 3.1 + 0.3 * i), y: b.y, z: b.z + 0.05 * W * Math.sin((TAU * t) / 3.1 + 0.3 * i), cd: [3, 2.16, 1.26], kind: 'bulb' }
      }
      for (const [x, z] of LAMPS) out[n++] = { x, y: 4.45, z, cd: [150, 99, 54], kind: 'lamp' }
      const cx = courierX(t)
      out[n++] = { x: cx + 0.72, y: 0.99, z: 2.6, cd: [20, 19, 16], kind: 'bike' }
      out[n++] = { x: cx - 0.86, y: 0.99, z: 2.6, cd: [2, 0.06, 0.03], kind: 'tail' }
      return n
    },
    sun: () => sunState,
    windmillOmega: (t: number) => 4 + 30 * wind(t),
    clampWalk(p: THREE.Vector3) {
      p.x = Math.max(-44, Math.min(44, p.x))
      const zl = Math.abs(p.x) < 7.6 ? 9.6 : 6.6
      p.z = Math.max(-zl, Math.min(zl, p.z))
      if (Math.hypot(p.x, p.z) < 2.6) { const a = Math.atan2(p.z, p.x); p.x = Math.cos(a) * 2.6; p.z = Math.sin(a) * 2.6 }
    },
    get timeOfDay() { return tod },
    get lightsOn() { return lightsOn },
    text: () => txt,
    wind,
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
      })
      for (const d of disposables) d.dispose()
    },
  }
  setTextSeed(textSeed)
  update(0)
  return world
}

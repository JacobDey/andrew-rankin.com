// The 3D bench (darkroom.md §6.1, §7.1, §11.5): procedural room, trays with
// heightfield liquid, paper, enlarger beam, light regimes, dark adaptation and
// the amber post pass.
import * as THREE from 'three'
import { FLUID } from '../constants'
import {
  BENCH, CAMERA, ENLARGER, IRON, LINE, lineSlotX, PREP, SAFELIGHT_POS, SHEET_M, SINK, STATIONS, stationById, TRAY_INTERIOR, TRAYS, WINDOW,
} from '../layout'
import type { Paper, Pick, StationId, TrayId, View, WorldRead } from '../types'
import { corkTexture, glowTexture, kraftTexture, laminateTexture, stencilLabel, tapeLabel, wallTexture, windowSkyTexture } from './textures'

export interface ViewOptions { tier: 'high' | 'medium' | 'low' | 'test'; reducedMotion: boolean; poster?: boolean }

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`
const POST_FS = `
uniform sampler2D tScene; uniform float uAmber; uniform float uRoom; uniform float uTime; uniform float uGrain; uniform float uVig; uniform float uLift;
varying vec2 vUv;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 ramp(float x){
  vec3 c0 = lin(vec3(0.043,0.027,0.020)); vec3 c1 = lin(vec3(0.227,0.110,0.039)); vec3 c2 = lin(vec3(0.722,0.353,0.118));
  vec3 c3 = lin(vec3(1.0,0.604,0.235)); vec3 c4 = lin(vec3(1.0,0.878,0.722));
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.6) return mix(c1, c2, (x - 0.25) / 0.35);
  if (x < 0.85) return mix(c2, c3, (x - 0.6) / 0.25);
  return mix(c3, c4, clamp((x - 0.85) / 0.15, 0.0, 1.0));
}
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  float L = dot(c, vec3(0.6, 0.35, 0.05));
  vec3 a = ramp(pow(clamp(L, 0.0, 1.0), 1.0 / 2.2));
  c = mix(c, a, uAmber);
  c *= mix(vec3(1.0), vec3(0.97, 1.0, 0.96), uRoom);
  c += uLift * vec3(0.004, 0.0035, 0.003);
  float r = length((vUv - 0.5) * vec2(1.25, 1.0));
  c *= 1.0 - uVig * smoothstep(0.35, 0.95, r);
  float n = hash(gl_FragCoord.xy + floor(uTime * 24.0) * vec2(17.0, 31.0)) - 0.5;
  c *= 1.0 + n * uGrain;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
  #include <colorspace_fragment>
}`

interface TrayView { group: THREE.Group; liquid: THREE.Mesh; geo: THREE.BufferGeometry; color: THREE.BufferAttribute; tint: THREE.Color; opacity: number; proxy: THREE.Mesh }
interface PaperView { mesh: THREE.Mesh; tex: THREE.DataTexture; mat: THREE.MeshPhongMaterial; ver: number; back: THREE.MeshLambertMaterial; W: number; H: number }

export function createView(canvas: HTMLCanvasElement, _world: WorldRead, o: ViewOptions): View & { dispose(): void; renderer: THREE.WebGLRenderer; setPrepTexture(c: HTMLCanvasElement | null): void } {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: o.tier === 'high', powerPreference: 'high-performance', alpha: false })
  const dprCap = o.tier === 'high' ? 2 : o.tier === 'medium' ? 1.5 : 1
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0x000000, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA.landscape.fov, 1, 0.05, 30)
  const rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, type: THREE.UnsignedByteType })
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: rt.texture }, uAmber: { value: 0 }, uRoom: { value: 0 }, uTime: { value: 0 }, uGrain: { value: o.tier === 'low' ? 0 : 0.05 }, uVig: { value: 0.25 }, uLift: { value: 0 } },
  })
  const postScene = new THREE.Scene()
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const tri = new THREE.BufferGeometry()
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  postScene.add(new THREE.Mesh(tri, postMat))

  // ---------------------------------------------------------------- materials
  const lam = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra })
  const pickables: THREE.Object3D[] = []
  const anchors = new Map<string, THREE.Vector3>()
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    parent.add(m)
    return m
  }
  const cyl = (rt0: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 20, parent: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt0, rb, h, seg), mat)
    m.position.set(x, y, z)
    parent.add(m)
    return m
  }
  const proxy = (w: number, h: number, d: number, x: number, y: number, z: number, data: Partial<Pick> & { kind: Pick['kind'] }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }))
    m.position.set(x, y, z)
    m.userData.pick = data
    scene.add(m)
    pickables.push(m)
    return m
  }
  const label = (t: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rx = -Math.PI / 2, parent: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, transparent: true }))
    m.position.set(x, y, z); m.rotation.x = rx
    parent.add(m)
    return m
  }

  // ---------------------------------------------------------------- room
  const benchW = BENCH.x1 - BENCH.x0
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(benchW, 0.04, BENCH.depth), lam(0xffffff, { map: laminateTexture() }))
  benchTop.position.set((BENCH.x0 + BENCH.x1) / 2, -0.02, BENCH.depth / 2)
  scene.add(benchTop)
  box(benchW, 0.7, 0.02, lam(0x2a2420), (BENCH.x0 + BENCH.x1) / 2, -0.39, BENCH.depth - 0.01)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(benchW + 1, 2.2), lam(0xffffff, { map: wallTexture() }))
  wall.position.set((BENCH.x0 + BENCH.x1) / 2, 0.9, 0)
  scene.add(wall)
  box(benchW, 0.08, 0.04, lam(0x3a332d), (BENCH.x0 + BENCH.x1) / 2, 0.04, 0.02) // backsplash
  // corkboard (prep)
  label(corkTexture(), 0.7, 0.45, 0.5, 0.72, 0.012, 0)
  // window (window station)
  const winW = WINDOW.opening.x1 - WINDOW.opening.x0, winH = WINDOW.opening.y1 - WINDOW.opening.y0
  label(windowSkyTexture(), winW, winH, (WINDOW.opening.x0 + WINDOW.opening.x1) / 2, (WINDOW.opening.y0 + WINDOW.opening.y1) / 2, 0.01, 0)
  const blind = box(winW, winH * 0.7, 0.005, lam(0xd8cdb4), (WINDOW.opening.x0 + WINDOW.opening.x1) / 2, WINDOW.opening.y1 - winH * 0.35, 0.02)
  blind.material = lam(0xc9bea4)
  // clothesline
  const line = cyl(0.002, 0.002, LINE.x1 - LINE.x0, lam(0xcfc6b5), (LINE.x0 + LINE.x1) / 2, LINE.y, LINE.z, 6)
  line.rotation.z = Math.PI / 2
  proxy(LINE.x1 - LINE.x0, 0.2, 0.06, (LINE.x0 + LINE.x1) / 2, LINE.y - 0.09, LINE.z + 0.02, { kind: 'line' })
  anchors.set('line', new THREE.Vector3(3.1, LINE.y, LINE.z))
  for (let s = 0; s < LINE.slots; s++) { const pin = box(0.012, 0.05, 0.012, lam(0xb89b6a), lineSlotX(s), LINE.y - 0.01, LINE.z + 0.006); pin.rotation.z = 0.05 }

  // ---------------------------------------------------------------- prep
  const lightTableMat = new THREE.MeshBasicMaterial({ color: 0xf4efe4 })
  const lightTable = box(PREP.table.w, 0.03, PREP.table.d, lightTableMat, PREP.table.x, 0.015, PREP.table.z)
  proxy(PREP.table.w, 0.06, PREP.table.d, PREP.table.x, 0.03, PREP.table.z, { kind: 'object', name: 'lightTable' })
  const prepPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.203, 0.254), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  prepPlane.rotation.x = -Math.PI / 2; prepPlane.position.set(PREP.table.x, 0.032, PREP.table.z); prepPlane.visible = false
  scene.add(prepPlane)
  box(0.28, 0.14, 0.2, lam(0x2b2b2e), PREP.printer.x, 0.07, PREP.printer.z)
  box(0.22, 0.01, 0.06, lam(0x111111), PREP.printer.x, 0.145, PREP.printer.z + 0.05)
  anchors.set('printer', new THREE.Vector3(PREP.printer.x, 0.16, PREP.printer.z))
  box(0.22, 0.08, 0.14, lam(0x6b4f35), PREP.shoebox.x, 0.04, PREP.shoebox.z)
  label(kraftTexture('O.'), 0.2, 0.12, PREP.shoebox.x, 0.081, PREP.shoebox.z)
  anchors.set('prep', new THREE.Vector3(PREP.table.x, 0.05, PREP.table.z))

  // ---------------------------------------------------------------- enlarger
  const dark = lam(0x1f1d1c), metal = lam(0x6c6a66), black = lam(0x0d0c0c)
  box(ENLARGER.base.w, 0.02, ENLARGER.base.d, lam(0x3c3a37), ENLARGER.base.x, 0.01, ENLARGER.base.z)
  const ex0 = ENLARGER.easel.x, ez0 = ENLARGER.easel.z
  box(SHEET_M.w + 0.04, 0.008, SHEET_M.h + 0.04, lam(0xbfb8a8), ex0, 0.024, ez0)
  for (const [w, d, x, z] of [[SHEET_M.w + 0.06, 0.02, ex0, ez0 - SHEET_M.h / 2 - 0.01], [SHEET_M.w + 0.06, 0.02, ex0, ez0 + SHEET_M.h / 2 + 0.01], [0.02, SHEET_M.h + 0.06, ex0 - SHEET_M.w / 2 - 0.01, ez0], [0.02, SHEET_M.h + 0.06, ex0 + SHEET_M.w / 2 + 0.01, ez0]] as const) box(w, 0.012, d, metal, x, 0.034, z)
  proxy(SHEET_M.w + 0.06, 0.05, SHEET_M.h + 0.06, ex0, 0.03, ez0, { kind: 'easel' })
  anchors.set('easel', new THREE.Vector3(ex0, 0.03, ez0))
  box(0.05, 0.95, 0.05, metal, ENLARGER.column.x, 0.475, ENLARGER.column.z)
  for (let i = 0; i < 18; i++) box(0.012, 0.006, 0.01, black, ENLARGER.column.x + 0.03, 0.1 + i * 0.045, ENLARGER.column.z)
  box(0.04, 0.04, 0.3, dark, ex0, ENLARGER.headY + 0.25, ENLARGER.column.z + 0.15)
  const head = new THREE.Group()
  head.position.set(ex0, ENLARGER.headY, ez0)
  scene.add(head)
  const headMats: THREE.MeshLambertMaterial[] = []
  const hm = (c: number) => { const m = lam(c, { transparent: true }); headMats.push(m); return m }
  box(0.2, 0.16, 0.22, hm(0x2a2826), 0, 0.25, 0, head)
  for (let i = 0; i < 4; i++) box(0.21, 0.008, 0.005, hm(0x111111), 0, 0.2 + i * 0.03, 0.112, head)
  box(0.12, 0.03, 0.12, hm(0x3a3836), 0, 0.15, 0, head)
  for (let i = 0; i < 5; i++) box(0.1 - i * 0.004, 0.014, 0.1 - i * 0.004, hm(i % 2 ? 0x151313 : 0x272523), 0, 0.125 - i * 0.014, 0, head)
  cyl(0.026, 0.026, 0.05, hm(0x0e0e0e), 0, 0.035, 0, 20, head)
  anchors.set('enlargerHead', new THREE.Vector3(ex0, ENLARGER.headY + 0.25, ez0))
  proxy(0.22, 0.3, 0.24, ex0, ENLARGER.headY + 0.18, ez0, { kind: 'object', name: 'enlargerHead' })
  // beam
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.16, ENLARGER.headY - 0.03, 24, 1, true), beamMat)
  beam.position.set(ex0, (ENLARGER.headY + 0.03) / 2, ez0)
  beam.scale.set(1, 1, 1.25)
  scene.add(beam)
  // paper box, envelope, tin
  box(0.30, 0.05, 0.24, lam(0x161616), ENLARGER.paperBox.x, 0.025, ENLARGER.paperBox.z)
  label(stencilLabel(['NIGHTJAR', 'VARI-GRADE RC PEARL', 'OPEN ONLY IN DARKROOM']), 0.28, 0.14, ENLARGER.paperBox.x, 0.051, ENLARGER.paperBox.z)
  proxy(0.3, 0.08, 0.24, ENLARGER.paperBox.x, 0.04, ENLARGER.paperBox.z, { kind: 'object', name: 'paperBox' })
  anchors.set('paperBox', new THREE.Vector3(ENLARGER.paperBox.x, 0.06, ENLARGER.paperBox.z))
  box(0.24, 0.012, 0.17, lam(0xffffff, { map: kraftTexture('ALREADY EXPOSED') }), ENLARGER.envelope.x, 0.006, ENLARGER.envelope.z)
  proxy(0.24, 0.04, 0.17, ENLARGER.envelope.x, 0.02, ENLARGER.envelope.z, { kind: 'object', name: 'envelope' })
  anchors.set('envelope', new THREE.Vector3(ENLARGER.envelope.x, 0.02, ENLARGER.envelope.z))
  cyl(0.06, 0.06, 0.05, lam(0x7a6a4a), ENLARGER.tin.x, 0.025, ENLARGER.tin.z, 24)
  anchors.set('tin', new THREE.Vector3(ENLARGER.tin.x, 0.05, ENLARGER.tin.z))

  // ---------------------------------------------------------------- trays
  const trayViews = new Map<TrayId, TrayView>()
  const liquidTint: Record<string, [number, number]> = { dev: [0xe9d9a0, 0.3], stop: [0xe8c547, 0.34], fix: [0xdfe6e8, 0.18], wash: [0xdde8ee, 0.16] }
  for (const t of TRAYS) {
    const g = new THREE.Group()
    g.position.set(t.x, 0, t.z)
    scene.add(g)
    const m = lam(t.color)
    const wallH = TRAY_INTERIOR.lip + 0.005
    box(t.outerW, 0.006, t.outerD, m, 0, 0.003, 0, g)
    const thk = (t.outerW - TRAY_INTERIOR.w) / 2
    box(t.outerW, wallH, thk, m, 0, wallH / 2, -t.outerD / 2 + thk / 2, g)
    box(t.outerW, wallH, thk, m, 0, wallH / 2, t.outerD / 2 - thk / 2, g)
    box(thk, wallH, t.outerD, m, -t.outerW / 2 + thk / 2, wallH / 2, 0, g)
    box(thk, wallH, t.outerD, m, t.outerW / 2 - thk / 2, wallH / 2, 0, g)
    for (let r = -1; r <= 1; r++) box(TRAY_INTERIOR.w * 0.9, 0.002, 0.006, lam(t.color - 0x101010), 0, 0.007, r * 0.07, g)
    const lbl = label(tapeLabel(t.label), 0.1, 0.028, -0.1, wallH * 0.6, t.outerD / 2 + 0.001, 0, g)
    lbl.rotation.z = 0.04
    const nx = FLUID.nx, ny = FLUID.ny
    const geo = new THREE.PlaneGeometry(TRAY_INTERIOR.w - TRAY_INTERIOR.w / nx, TRAY_INTERIOR.d - TRAY_INTERIOR.d / ny, nx - 1, ny - 1)
    geo.rotateX(-Math.PI / 2)
    const col = new THREE.BufferAttribute(new Float32Array(nx * ny * 4), 4)
    geo.setAttribute('color', col)
    const [tint, op] = liquidTint[t.id] ?? [0xffffff, 0.3]
    const liqMat = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, transparent: true, shininess: 180, specular: 0xffffff, depthWrite: false })
    const liquid = new THREE.Mesh(geo, liqMat)
    liquid.renderOrder = 2
    g.add(liquid)
    const px = proxy(t.outerW + 0.04, 0.08, t.outerD + 0.04, t.x, 0.03, t.z, { kind: 'tray', tray: t.id })
    trayViews.set(t.id, { group: g, liquid, geo, color: col, tint: new THREE.Color(tint), opacity: op, proxy: px })
    anchors.set('tray:' + t.id, new THREE.Vector3(t.x, 0.05, t.z))
    anchors.set('trayRim:' + t.id, new THREE.Vector3(t.x, 0.06, t.z + t.outerD / 2))
  }
  // sink
  box(SINK.basin.x1 - SINK.basin.x0, 0.004, 0.6, lam(0x8a8d90), (SINK.basin.x0 + SINK.basin.x1) / 2, 0.001, 0.36)
  cyl(0.012, 0.012, 0.3, metal, SINK.tap.x, 0.15, SINK.tap.z)
  const spout = cyl(0.01, 0.01, 0.12, metal, SINK.tap.x, 0.3, SINK.tap.z + 0.06)
  spout.rotation.x = Math.PI / 2
  proxy(0.1, 0.35, 0.18, SINK.tap.x, 0.18, SINK.tap.z + 0.04, { kind: 'object', name: 'tap' })
  anchors.set('tap', new THREE.Vector3(SINK.tap.x, 0.33, SINK.tap.z + 0.06))
  const tapStream = cyl(0.004, 0.004, 0.26, new THREE.MeshPhongMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.5, shininess: 120 }), SINK.tap.x, 0.17, SINK.tap.z + 0.12, 8)
  tapStream.visible = false
  cyl(0.03, 0.035, 0.12, lam(0x3a1e0c), SINK.peroxide.x, 0.06, SINK.peroxide.z)
  cyl(0.008, 0.012, 0.05, lam(0x111111), SINK.peroxide.x, 0.145, SINK.peroxide.z)
  proxy(0.08, 0.2, 0.08, SINK.peroxide.x, 0.08, SINK.peroxide.z, { kind: 'object', name: 'peroxide' })
  anchors.set('peroxide', new THREE.Vector3(SINK.peroxide.x, 0.18, SINK.peroxide.z))

  // ---------------------------------------------------------------- iron
  const amber = new THREE.MeshPhongMaterial({ color: 0x5a2a0a, shininess: 80, transparent: true, opacity: 0.92 })
  for (const [k, p] of [['A', IRON.bottleA], ['B', IRON.bottleB]] as const) {
    cyl(0.035, 0.035, 0.16, amber, p.x, 0.08, p.z)
    cyl(0.015, 0.02, 0.03, amber, p.x, 0.175, p.z)
    const l = label(tapeLabel(k === 'A' ? 'A · FAC 25%' : 'B · FERRI 10%', 256, 64, 0), 0.07, 0.03, p.x, 0.08, p.z + 0.036, 0)
    l.rotation.y = 0
    proxy(0.08, 0.2, 0.08, p.x, 0.1, p.z, { kind: 'object', name: 'bottle' + k })
    anchors.set('bottle' + k, new THREE.Vector3(p.x, 0.2, p.z))
  }
  cyl(0.032, 0.03, 0.09, new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, shininess: 140, depthWrite: false }), IRON.beaker.x, 0.045, IRON.beaker.z)
  const beakerLiquidMat = lam(0xc2be48)
  const beakerLiquid = cyl(0.029, 0.028, 1, beakerLiquidMat, IRON.beaker.x, 0, IRON.beaker.z)
  proxy(0.08, 0.12, 0.08, IRON.beaker.x, 0.05, IRON.beaker.z, { kind: 'object', name: 'beaker' })
  anchors.set('beaker', new THREE.Vector3(IRON.beaker.x, 0.1, IRON.beaker.z))
  box(0.26, 0.004, 0.3, lam(0x4a4136), IRON.coat.x, 0.002, IRON.coat.z)
  anchors.set('coat', new THREE.Vector3(IRON.coat.x, 0.01, IRON.coat.z))
  box(0.22, 0.03, 0.16, lam(0xe9e3d3), IRON.rag.x, 0.015, IRON.rag.z)
  proxy(0.22, 0.05, 0.16, IRON.rag.x, 0.02, IRON.rag.z, { kind: 'object', name: 'rag' })
  anchors.set('rag', new THREE.Vector3(IRON.rag.x, 0.04, IRON.rag.z))
  box(0.07, 0.02, 0.03, lam(0x8a6a3a), IRON.brushRest.x, 0.01, IRON.brushRest.z)
  box(0.06, 0.012, 0.02, lam(0xd9c8a0), IRON.brushRest.x, 0.026, IRON.brushRest.z + 0.022)
  const dryer = new THREE.Group()
  dryer.position.set(IRON.dryer.x, 0.04, IRON.dryer.z)
  cyl(0.035, 0.035, 0.14, lam(0x5c8a8a), 0, 0, 0, 16, dryer).rotation.z = Math.PI / 2
  box(0.03, 0.1, 0.03, lam(0x2b3b3b), 0.03, -0.03, 0, dryer)
  scene.add(dryer)
  anchors.set('dryer', new THREE.Vector3(IRON.dryer.x, 0.08, IRON.dryer.z))
  // contact frame (moves between the iron station and the UV box)
  const frame = new THREE.Group()
  const wood = lam(0x8a5a32)
  box(IRON.frame.w, 0.015, 0.02, wood, 0, 0.0075, -IRON.frame.d / 2, frame)
  box(IRON.frame.w, 0.015, 0.02, wood, 0, 0.0075, IRON.frame.d / 2, frame)
  box(0.02, 0.015, IRON.frame.d, wood, -IRON.frame.w / 2, 0.0075, 0, frame)
  box(0.02, 0.015, IRON.frame.d, wood, IRON.frame.w / 2, 0.0075, 0, frame)
  const glass = box(IRON.frame.w - 0.02, 0.003, IRON.frame.d - 0.02, new THREE.MeshPhongMaterial({ color: 0xcfe6e0, transparent: true, opacity: 0.16, shininess: 200, depthWrite: false }), 0, 0.017, 0, frame)
  glass.renderOrder = 3
  const transparency = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_M.w, SHEET_M.h), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }))
  transparency.rotation.x = -Math.PI / 2; transparency.position.y = 0.0145; transparency.visible = false
  frame.add(transparency)
  scene.add(frame)
  proxy(IRON.frame.w, 0.05, IRON.frame.d, IRON.frame.x, 0.02, IRON.frame.z, { kind: 'object', name: 'frame' })
  anchors.set('frame', new THREE.Vector3(IRON.frame.x, 0.03, IRON.frame.z))
  // UV box
  const ub = WINDOW.uvbox
  box(ub.w, 0.1, ub.d, lam(0x6a6a6e), ub.x, 0.05, ub.z)
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0x2a1650 })
  for (let i = 0; i < 6; i++) { const tb = cyl(0.008, 0.008, ub.w - 0.06, tubeMat, ub.x, 0.102, ub.z - ub.d / 2 + 0.04 + i * 0.05, 8); tb.rotation.z = Math.PI / 2 }
  const lid = new THREE.Group()
  lid.position.set(ub.x, 0.1, ub.z - ub.d / 2)
  box(ub.w + 0.01, 0.03, ub.d + 0.01, lam(0x55555a), 0, 0.015, ub.d / 2, lid)
  label(tapeLabel('UV · WAIT FOR BRONZE', 384, 64, 0.02), 0.2, 0.034, 0, 0.0305, ub.d / 2, -Math.PI / 2, lid)
  scene.add(lid)
  proxy(ub.w, 0.16, ub.d, ub.x, 0.08, ub.z, { kind: 'object', name: 'uvbox' })
  anchors.set('uvbox', new THREE.Vector3(ub.x, 0.14, ub.z))

  // ---------------------------------------------------------------- safelight
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x1a0d05 })
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), bulbMat)
  bulb.position.set(...SAFELIGHT_POS)
  scene.add(bulb)
  cyl(0.004, 0.004, 0.6, black, SAFELIGHT_POS[0], SAFELIGHT_POS[1] + 0.33, SAFELIGHT_POS[2])
  const glowTex = glowTexture()
  const mkGlow = (color: number, size: number, pos: THREE.Vector3) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }))
    s.scale.set(size, size, 1); s.position.copy(pos); scene.add(s)
    return s
  }
  const safeGlow = mkGlow(0xff8a2c, 0.5, new THREE.Vector3(...SAFELIGHT_POS))
  const uvGlow = mkGlow(0x7a3bff, 0.7, new THREE.Vector3(ub.x, 0.14, ub.z))
  const lensGlow = mkGlow(0xdfe8ff, 0.12, new THREE.Vector3(ex0, ENLARGER.headY + 0.01, ez0))
  anchors.set('safelight', new THREE.Vector3(...SAFELIGHT_POS))
  // fluorescent tubes (ceiling fixtures, seen as strips at the top of the wall)
  const tubeOff = new THREE.MeshBasicMaterial({ color: 0x24221f })
  const tubes: THREE.Mesh[] = []
  for (let x = 0.8; x < 7.6; x += 2.2) { const t = cyl(0.015, 0.015, 1.2, tubeOff, x, 1.62, 0.25, 8); t.rotation.z = Math.PI / 2; tubes.push(t) }

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xe8eeff, 0x40372e, 0)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xf4f7ff, 0)
  sun.position.set(3, 3, 3)
  scene.add(sun)
  const safe = new THREE.PointLight(0xff8a2c, 0, 0, 1.25)
  safe.position.set(...SAFELIGHT_POS)
  scene.add(safe)
  const spot = new THREE.SpotLight(0xe8eeff, 0, 1.2, 0.42, 0.35, 1)
  spot.position.set(ex0, ENLARGER.headY, ez0)
  spot.target.position.set(ex0, 0, ez0)
  scene.add(spot); scene.add(spot.target)
  const uvLight = new THREE.PointLight(0x7a40ff, 0, 1.2, 1.5)
  uvLight.position.set(ub.x, 0.25, ub.z + 0.1)
  scene.add(uvLight)
  const amb = new THREE.AmbientLight(0x8890a0, 0)
  scene.add(amb)
  const tableLight = new THREE.PointLight(0xfff4e4, 0, 0.8, 1.5)
  tableLight.position.set(PREP.table.x, 0.25, PREP.table.z + 0.1)
  scene.add(tableLight)

  // ---------------------------------------------------------------- papers
  const paperViews = new Map<string, PaperView>()
  const paperGeo = new THREE.PlaneGeometry(SHEET_M.w, SHEET_M.h, 6, 6)
  paperGeo.rotateX(-Math.PI / 2)
  function paperView(p: Paper): PaperView {
    let v = paperViews.get(p.id)
    if (v && (v.W !== p.W || v.H !== p.H)) { scene.remove(v.mesh); v.tex.dispose(); v.mat.dispose(); paperViews.delete(p.id); v = undefined }
    if (v) return v
    const tex = new THREE.DataTexture(p.albedo, p.W, p.H, THREE.RGBAFormat, THREE.UnsignedByteType)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter
    tex.repeat.set(1, -1); tex.offset.set(0, 1); tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 30, specular: 0x222222 })
    const back = new THREE.MeshLambertMaterial({ color: p.kind === 'cyano' ? 0xe9e2d0 : 0xf2efe8 })
    const mesh = new THREE.Mesh(paperGeo, mat)
    mesh.userData.pick = { kind: 'paper', id: p.id }
    mesh.renderOrder = 1
    scene.add(mesh)
    pickables.push(mesh)
    v = { mesh, tex, mat, ver: -1, back, W: p.W, H: p.H }
    paperViews.set(p.id, v)
    return v
  }
  // props (photogram objects) as simple dark shapes
  const propMeshes = new Map<string, THREE.Mesh>()
  for (const pr of _world.props) {
    const pm = _world.negatives.props.find((q) => q.id === pr.id)
    if (!pm) continue
    const c = document.createElement('canvas'); c.width = pm.W; c.height = pm.H
    const g = c.getContext('2d') as CanvasRenderingContext2D
    const id = g.createImageData(pm.W, pm.H)
    for (let i = 0; i < pm.W * pm.H; i++) { const a = 1 - pm.T[i]; id.data[i * 4] = pr.id === 'fern' ? 60 : pr.id === 'key' ? 150 : 230; id.data[i * 4 + 1] = pr.id === 'fern' ? 90 : pr.id === 'key' ? 120 : 225; id.data[i * 4 + 2] = pr.id === 'fern' ? 40 : pr.id === 'key' ? 60 : 215; id.data[i * 4 + 3] = Math.round(255 * a) }
    g.putImageData(id, 0, 0)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pm.sizeM, pm.sizeM), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.1, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.userData.pick = { kind: 'object', name: 'prop:' + pr.id }
    m.renderOrder = 4
    scene.add(m)
    pickables.push(m)
    propMeshes.set(pr.id, m)
  }

  // ---------------------------------------------------------------- camera
  let focus: StationId = 'trays'
  let focusTarget = stationById('trays').fx
  let fx = focusTarget, fv = 0
  let poster = !!o.poster
  let cssW = 1, cssH = 1
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  function preset() {
    const aspect = cssW / Math.max(1, cssH)
    if (aspect < 0.8) return CAMERA.portrait
    return focus === 'enlarger' ? CAMERA.enlarger : CAMERA.landscape
  }
  function placeCamera() {
    const pr = preset()
    camera.fov = pr.fov
    camera.position.set(fx, pr.y, pr.z)
    camera.lookAt(fx, pr.ty, pr.tz)
    camera.updateProjectionMatrix()
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height)
    renderer.setSize(cssW, cssH, false)
    const pr = renderer.getPixelRatio()
    rt.setSize(Math.round(cssW * pr), Math.round(cssH * pr))
    camera.aspect = cssW / cssH
    placeCamera()
  }

  // ---------------------------------------------------------------- per frame
  let t = 0
  let lastLight = 0
  let shownRoom = 0
  let lastRoomChange = -1
  let flicker = 0
  const tmpColor = new THREE.Color()
  const view = {
    renderer,
    renderMs: 0,
    get focus() { return focus },
    get focusX() { return fx },
    frame(dt: number, w: WorldRead) {
      const t0 = performance.now()
      t += dt
      // camera spring (critically damped)
      const om = o.reducedMotion ? 30 : CAMERA.omega
      const a = om * om * (focusTarget - fx) - 2 * om * fv
      fv += a * dt; fx += fv * dt
      if (Math.abs(focusTarget - fx) < 1e-4 && Math.abs(fv) < 1e-4) { fx = focusTarget; fv = 0 }
      placeCamera()

      // photosensitivity: the visible room light changes at most every 350 ms, with a 2-flicker start
      const roomWant = w.lights.room > 0 ? 1 : 0
      if (roomWant !== lastLight && t - lastRoomChange > 0.35) {
        lastLight = roomWant
        lastRoomChange = t
        flicker = roomWant && !o.reducedMotion ? 0.24 : 0
      }
      if (flicker > 0) {
        flicker -= dt
        const ph = 0.24 - flicker
        shownRoom = ph < 0.06 ? 0.4 : ph < 0.14 ? 0.05 : ph < 0.2 ? 0.4 : 1
      } else shownRoom += ((lastLight ? 1 : 0) - shownRoom) * Math.min(1, dt / 0.08)

      const X = w.exposureX
      const room = shownRoom
      hemi.intensity = 0.9 * room * X
      sun.intensity = 1.7 * room * X
      safe.intensity = w.lights.safe > 0 ? 0.2 * X : 0
      const enlOn = w.lights.enlarger > 0
      spot.intensity = enlOn ? 2.6 * X : 0
      beamMat.opacity = enlOn ? Math.min(0.16, 0.012 * X) * (1 - room) : 0
      lensGlow.material.opacity = enlOn ? 0.6 : 0
      const uvOn = w.iron.uvOn
      uvLight.intensity = uvOn ? 0.6 * X : 0
      uvGlow.material.opacity = uvOn ? 0.5 : 0
      tubeMat.color.set(uvOn ? 0x9a6bff : 0x2a1650)
      amb.intensity = 0.0012 * X
      tableLight.intensity = 0.05 * X
      lightTableMat.color.setRGB(0.95 * Math.min(1, 0.06 * X + room), 0.93 * Math.min(1, 0.06 * X + room), 0.88 * Math.min(1, 0.06 * X + room))
      bulbMat.color.set(w.lights.safe > 0 ? 0xff9a3c : 0x1a0d05)
      safeGlow.material.opacity = w.lights.safe > 0 ? 0.85 : 0
      for (const tb of tubes) (tb.material as THREE.MeshBasicMaterial).color.setScalar(room > 0.5 ? 1 : 0.12)
      // the head fades while a dodge tool hovers the easel
      const fade = w.occluder ? 0.25 : 1
      for (const m of headMats) m.opacity += (fade - m.opacity) * Math.min(1, dt * 8)
      // tap stream
      tapStream.visible = w.iron.tap
      // beaker level and colour
      const vol = w.iron.beakerA + w.iron.beakerB
      const lvl = Math.min(0.085, vol * 0.0016)
      beakerLiquid.visible = vol > 0.05
      beakerLiquid.scale.y = Math.max(0.0005, lvl)
      beakerLiquid.position.y = lvl / 2 + 0.002
      if (vol > 0) { const r = w.iron.beakerA / vol; beakerLiquidMat.color.set(0x9db83a).lerp(tmpColor.set(0xe09a2c), 1 - r) }
      // frame + lid + dryer
      if (w.iron.frameIn === 'uvbox') frame.position.set(ub.x, 0.1, ub.z)
      else frame.position.set(IRON.frame.x, 0, IRON.frame.z)
      lid.rotation.x = w.iron.uvLid ? 0 : -1.25
      const neg = w.iron.frameNegative ? w.negatives.getNegative(w.iron.frameNegative) : undefined
      transparency.visible = !!neg
      if (neg && transparency.userData.neg !== neg.id) {
        transparency.userData.neg = neg.id
        const c = document.createElement('canvas'); c.width = neg.W; c.height = neg.H
        const g = c.getContext('2d') as CanvasRenderingContext2D
        const img = g.createImageData(neg.W, neg.H)
        for (let i = 0; i < neg.W * neg.H; i++) { const v = Math.min(1, neg.T[i] / 0.9); img.data[i * 4] = 20; img.data[i * 4 + 1] = 18; img.data[i * 4 + 2] = 22; img.data[i * 4 + 3] = Math.round(255 * (1 - v)) }
        g.putImageData(img, 0, 0)
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace
        const mm = transparency.material as THREE.MeshBasicMaterial
        mm.map?.dispose(); mm.map = tx; mm.needsUpdate = true
      }
      dryer.position.set(w.iron.dryer ? w.iron.dryerAt.x : IRON.dryer.x, w.iron.dryer ? 0.1 : 0.04, w.iron.dryer ? w.iron.dryerAt.z + 0.08 : IRON.dryer.z)

      // trays
      const motionK = o.reducedMotion ? 0.5 : 1
      for (const [id, tv] of trayViews) {
        const ts = w.trays[id]
        if (!ts) continue
        tv.group.rotation.z = -ts.body.tiltX
        tv.group.rotation.x = ts.body.tiltY
        tv.group.position.x = (TRAYS.find((q) => q.id === id)?.x ?? 0) + ts.body.offX
        tv.group.position.z = (TRAYS.find((q) => q.id === id)?.z ?? 0) + ts.body.offY
        const f = ts.fluid
        const pos = tv.geo.getAttribute('position') as THREE.BufferAttribute
        const col = tv.color
        const n = f.nx * f.ny
        const h0 = FLUID.depth
        const dye = ts.dye?.data, per = ts.perox?.data
        for (let i = 0; i < n; i++) {
          const h = f.h[i]
          const disp = h0 * 0 + (h - h0) * motionK + h0
          pos.setY(i, 0.006 + Math.max(0, disp))
          const alpha = Math.min(1, Math.max(0, (h - 0.0002) / 0.0015))
          let r = tv.tint.r, g = tv.tint.g, b = tv.tint.b
          let op = tv.opacity
          if (dye && per) {
            const d = Math.min(1, dye[i] * 3), pp = Math.min(1, per[i])
            r = r * (1 - d) + 0.79 * d; g = g * (1 - d) + 0.76 * d; b = b * (1 - d) + 0.29 * d
            op = Math.min(0.75, op + d * 0.5)
            if (pp > 0.02) { r = r * (1 - pp) + 0.1 * pp; g = g * (1 - pp) + 0.3 * pp; b = b * (1 - pp) + 0.55 * pp; op = Math.max(op, 0.3 * pp) }
          }
          col.setXYZW(i, r, g, b, op * alpha)
        }
        pos.needsUpdate = true
        col.needsUpdate = true
        tv.geo.computeVertexNormals()
      }

      // papers
      const seen = new Set<string>()
      for (const p of w.papers) {
        seen.add(p.id)
        const v = paperView(p)
        if (v.ver !== p.albedoVer) { v.tex.needsUpdate = true; v.ver = p.albedoVer }
        v.mesh.material = p.faceUp ? v.mat : v.back
        const wet = p.silver ? Math.min(1, p.place.at === 'tray' ? 1 : 0.4) : 0.2
        v.mat.shininess = 20 + 120 * wet
        v.mat.specular.setScalar(0.05 + 0.3 * wet)
        const m = v.mesh
        m.rotation.set(0, 0, 0)
        m.scale.set(1, 1, 1)
        const pl = p.place
        if (pl.at === 'tray') {
          const tv = trayViews.get(pl.tray)
          if (tv && m.parent !== tv.group) tv.group.add(m)
          m.position.set(p.body.x, p.body.sunk ? 0.0086 : 0.0092, p.body.y)
          m.rotation.y = p.body.rot
        } else {
          if (m.parent !== scene) scene.add(m)
          if (pl.at === 'line') {
            const sway = o.reducedMotion ? 0 : 0.03 * Math.sin(t * 1.3 + (pl.slot ?? 0)) * Math.exp(-Math.max(0, w.time - (p.hungAt ?? 0)) * 0.1)
            m.position.set(lineSlotX(pl.slot), LINE.y - (SHEET_M.h * LINE.scale) / 2 - 0.012, LINE.z + 0.012)
            m.rotation.set(Math.PI / 2 + sway, 0, 0)
            m.scale.setScalar(LINE.scale)
          } else if (pl.at === 'easel') m.position.set(ex0, 0.0295, ez0)
          else if (pl.at === 'bench') m.position.set(pl.x, 0.0015, pl.z)
          else if (pl.at === 'coat') m.position.set(IRON.coat.x, 0.0045, IRON.coat.z)
          else if (pl.at === 'frame' || pl.at === 'uvbox') m.position.set(frame.position.x, frame.position.y + 0.012, frame.position.z)
          else if (pl.at === 'carried') { m.position.set(w.carryPos.x, 0.09, w.carryPos.z); m.rotation.set(0.12, 0, 0.03) }
          else m.position.set(ENLARGER.paperBox.x, 0.06, ENLARGER.paperBox.z)
        }
      }
      for (const [id, v] of paperViews) if (!seen.has(id)) {
        v.mesh.parent?.remove(v.mesh); v.tex.dispose(); v.mat.dispose(); v.back.dispose(); paperViews.delete(id)
        const k = pickables.indexOf(v.mesh); if (k >= 0) pickables.splice(k, 1)
      }
      for (const pr of w.props) {
        const m = propMeshes.get(pr.id)
        if (!m) continue
        if (pr.on === 'tin') m.position.set(ENLARGER.tin.x + (w.props.indexOf(pr) - 1) * 0.025, 0.052 + w.props.indexOf(pr) * 0.002, ENLARGER.tin.z)
        else if (pr.on === 'frame') m.position.set(frame.position.x + (pr.x - IRON.frame.x), frame.position.y + 0.02, frame.position.z + (pr.z - IRON.frame.z))
        else m.position.set(pr.x, 0.033, pr.z)
        m.scale.setScalar(pr.on === 'tin' ? 0.35 : 1)
        m.rotation.z = pr.rot
      }

      // post
      const Lsum = room + 0.06 * (enlOn ? 1 : 0) + (uvOn ? 0.01 : 0) + 0.03 * (w.lights.safe > 0 ? 1 : 0)
      const safeShare = w.lights.safe > 0 ? 0.03 / Math.max(1e-4, Lsum) : 0
      postMat.uniforms.uAmber.value = Math.sqrt(safeShare) * 0.85
      postMat.uniforms.uRoom.value = room
      postMat.uniforms.uTime.value = t
      postMat.uniforms.uLift.value = 0
      renderer.setRenderTarget(rt)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(postScene, postCam)
      view.renderMs = performance.now() - t0
    },
    resize,
    pick(cx: number, cy: number): Pick | null {
      const r = canvas.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(pickables, false)
      // priority: paper > object/easel > tray > line
      const rank = (k: string) => (k === 'paper' ? 0 : k === 'object' || k === 'easel' ? 1 : k === 'tray' ? 2 : 3)
      let best: { d: number; data: Pick } | null = null
      for (const h of hits) {
        const data = h.object.userData.pick as Pick | undefined
        if (!data) continue
        if (data.kind === 'paper' && !h.object.visible) continue
        const cand = { d: h.distance, data: { ...data, point: { x: h.point.x, y: h.point.y, z: h.point.z } } }
        if (!best || rank(cand.data.kind) < rank(best.data.kind) || (rank(cand.data.kind) === rank(best.data.kind) && cand.d < best.d)) best = cand
      }
      if (best) return best.data
      const bp = view.benchPoint(cx, cy)
      return bp ? { kind: 'bench', point: { x: bp.x, y: 0, z: bp.z } } : null
    },
    benchPoint(cx: number, cy: number, y = 0) {
      const r = canvas.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const ro = raycaster.ray.origin, rd = raycaster.ray.direction
      if (Math.abs(rd.y) < 1e-6) return null
      const k = (y - ro.y) / rd.y
      if (k < 0) return null
      return { x: ro.x + rd.x * k, z: ro.z + rd.z * k }
    },
    project(anchor: string | [number, number, number]) {
      const v = typeof anchor === 'string' ? anchors.get(anchor)?.clone() : new THREE.Vector3(...anchor)
      if (!v) return { x: 0, y: 0, visible: false }
      v.project(camera)
      const visible = v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.1 && v.y < 1.1
      return { x: ((v.x + 1) / 2) * cssW, y: ((1 - v.y) / 2) * cssH, visible }
    },
    setFocus(station: StationId, sub?: number) {
      focus = station
      const st = stationById(station)
      const portrait = cssW / Math.max(1, cssH) < 0.8
      focusTarget = portrait && st.subs && sub != null ? st.subs[Math.max(0, Math.min(st.subs.length - 1, sub))] : st.fx
      if (portrait && st.subs && sub == null) focusTarget = st.subs[0] ?? st.fx
    },
    panBy(dxPx: number) {
      const k = 2.2 / Math.max(300, cssW)
      focusTarget = Math.max(STATIONS[0].fx, Math.min(STATIONS[STATIONS.length - 1].fx, focusTarget - dxPx * k))
      fx = focusTarget
    },
    snap() { fx = focusTarget; fv = 0; placeCamera() },
    settle() {
      // snap to the nearest station after a pan
      let best = STATIONS[0]
      for (const s of STATIONS) if (Math.abs(s.fx - fx) < Math.abs(best.fx - fx)) best = s
      focus = best.id
      focusTarget = best.fx
    },
    async thumbnail(): Promise<Blob> {
      view.frame(0, _world)
      const c = document.createElement('canvas')
      c.width = 256; c.height = 160
      const g = c.getContext('2d') as CanvasRenderingContext2D
      g.drawImage(canvas, 0, 0, 256, 160)
      return new Promise<Blob>((res) => c.toBlob((b) => res(b ?? new Blob()), 'image/jpeg', 0.8))
    },
    setPoster(on: boolean) { poster = on; void poster },
    setPrepTexture(c: HTMLCanvasElement | null) {
      if (!c) { prepPlane.visible = false; return }
      const m = prepPlane.material as THREE.MeshBasicMaterial
      if (!m.map || (m.map as THREE.CanvasTexture).image !== c) { m.map?.dispose(); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; m.map = tx; m.needsUpdate = true }
      else m.map.needsUpdate = true
      prepPlane.visible = true
    },
    dispose() { renderer.dispose(); rt.dispose() },
  }
  void lightTable
  resize()
  return view
}

// Demo page for the cloth-marble spike: a macro specimen plate (rusty mailbox
// metal), a glass marble, a silk lens cloth and a burlap swatch. Everything
// physical lives in ./core (no DOM / three.js); this file is rendering, input,
// HUD, sound and the window.__spike test hooks.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { bakeAsync } from './core/bake'
import { probeSurface } from './core/surface'
import type { SurfaceBake } from './core/surface'
import { ProbeWorld } from './core/world'
import { GLASS_MARBLE, STEEL_BB } from './core/marble'
import { FINE_CLOTH, ROUGH_CLOTH } from './core/cloth'
import type { Cloth } from './core/cloth'
import type { ProbeEvent } from './core/events'
import { makeSurfaceTextures, makeSurfaceMesh, makeLightingUniforms } from './render/surface'
import { ClothView, Occluder, SILK_LOOK, BURLAP_LOOK } from './render/cloth'
import { MarbleView } from './render/marble'
import type { MarbleKind } from './render/marble'
import { ProbeAudio } from './audio'

// ---------------------------------------------------------------------------
// quality knobs
// ---------------------------------------------------------------------------
const params = new URLSearchParams(location.search)
const coarse = matchMedia('(pointer: coarse)').matches
const autoLow = coarse || Math.min(screen.width, screen.height) < 700
const QUALITY = params.get('q') === 'low' ? 'low' : params.get('q') === 'high' ? 'high' : autoLow ? 'low' : 'high'
const PRESETS = {
  high: { res: 1024, seg: 384, shadow: 20, fineN: 64, fineIt: 1, roughN: 24, roughIt: 2, subdiv: 4, dpr: 2, occ: 512, fineField: 512, marble: 'glass' as MarbleKind },
  low: { res: 512, seg: 192, shadow: 10, fineN: 40, fineIt: 1, roughN: 18, roughIt: 2, subdiv: 3, dpr: 1.5, occ: 256, fineField: 256, marble: 'steel' as MarbleKind },
}
const Q = { ...PRESETS[QUALITY] }
if (params.get('marble') === 'glass' || params.get('marble') === 'steel') Q.marble = params.get('marble') as MarbleKind
// per-knob overrides for profiling: ?res=512&seg=256&shadow=12&fineN=48&roughN=20&subdiv=2&dpr=1&occ=256
for (const k of ['res', 'seg', 'shadow', 'fineN', 'fineIt', 'roughN', 'roughIt', 'subdiv', 'dpr', 'occ', 'fineField'] as const) {
  const v = params.get(k)
  if (v != null && !Number.isNaN(Number(v))) Q[k] = Number(v)
}
const SIZE = 48 // plate extent, mm
const FORM_R = Number(params.get('R') ?? 180) // arch radius (design doc: 120 mm)
const SEED = Number(params.get('seed') ?? 1)
const FOV = 20
const HEADLESS = navigator.webdriver && !params.has('live')

// world-fixed lighting (Z up): raking key from the upper left, softbox up-right
const KEY_AZ = (135 * Math.PI) / 180
const KEY_EL = (17 * Math.PI) / 180
const L_WORLD = new THREE.Vector3(Math.cos(KEY_EL) * Math.cos(KEY_AZ), Math.cos(KEY_EL) * Math.sin(KEY_AZ), Math.sin(KEY_EL))
const BOX_WORLD = new THREE.Vector3(0.35, 0.45, 1).normalize()

const $ = (id: string) => document.getElementById(id)!
const hud = $('hud')
const readout = $('readout')
const bar = $('bar')
const loading = $('loading')
const hint = $('hint')

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
let resolveReady!: () => void
const ready = new Promise<void>((r) => (resolveReady = r))

const t0 = performance.now()
const bakePromise = bakeAsync(
  'rusty-mailbox',
  {
    res: Q.res,
    size: SIZE,
    seed: SEED,
    physRes: 256,
    probes: [
      { r: GLASS_MARBLE.radius, res: 128 },
      { r: STEEL_BB.radius, res: 192 },
      { r: ROUGH_CLOTH.probeRadius, res: 256 },
      { r: FINE_CLOTH.probeRadius, res: Q.fineField },
    ],
  },
  { formRadius: FORM_R },
  params.has('inline'),
)

bakePromise.then(start).catch((e) => {
  loading.textContent = 'Bake failed: ' + String(e)
  console.error(e)
})

function start(bake: SurfaceBake) {
  const bakeWall = performance.now() - t0
  const surface = probeSurface(bake)

  // ---- physics world --------------------------------------------------------
  const marbleP = Q.marble === 'glass' ? GLASS_MARBLE : STEEL_BB
  const world = new ProbeWorld(surface, marbleP)

  // ---- three.js -------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr))
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // the glass marble's transmission pass re-renders the (expensive) plate:
  // half resolution is plenty for a refracted, defocused view through a ball
  renderer.transmissionResolutionScale = 0.5
  document.body.prepend(renderer.domElement)
  const canvas = renderer.domElement

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0d0d0f')
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentRotation.set(Math.PI / 2, 0, 0) // RoomEnvironment is Y-up; we are Z-up
  scene.environmentIntensity = 0.55

  const rig = new THREE.Group()
  scene.add(rig)
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 10, 800)
  rig.add(camera)
  const plate = new THREE.Group()
  scene.add(plate)

  const key = new THREE.DirectionalLight(0xfff1e4, 8.5)
  key.position.copy(L_WORLD).multiplyScalar(100)
  scene.add(key, key.target)
  const hemi = new THREE.HemisphereLight(0x1c1f24, 0x080706, 1.2)
  hemi.position.set(0, 0, 1)
  scene.add(hemi)

  const lighting = makeLightingUniforms(SIZE)
  const tex = makeSurfaceTextures(bake)
  lighting.uHeight.value = tex.height
  const surfaceMesh = makeSurfaceMesh(tex, SIZE, lighting, { segments: Q.seg, shadowSteps: Q.shadow })
  plate.add(surfaceMesh)

  const occluder = new Occluder(renderer, SIZE, Q.occ)
  lighting.uOcc.value = occluder.target.texture
  lighting.uOccOn.value = occluder.ok ? 1 : 0

  const marbleView = new MarbleView()
  marbleView.setKind(Q.marble, world.marble.p.radius)
  plate.add(marbleView.group)
  lighting.uGlass.value = Q.marble === 'glass' ? 1 : 0

  // ---- cloths ---------------------------------------------------------------
  let debug = false
  const views = new Map<string, ClothView>()
  const homes = new Map<string, { x: number; y: number; a: number }>()
  let clothSize = 16
  function makeCloth(id: 'fine' | 'rough') {
    const old = views.get(id)
    if (old) {
      plate.remove(old.mesh)
      occluder.scene.remove(old.occMesh)
      old.dispose()
    }
    const p =
      id === 'fine'
        ? { ...FINE_CLOTH, n: Q.fineN, iterations: Q.fineIt, size: clothSize }
        : { ...ROUGH_CLOTH, n: Q.roughN, iterations: Q.roughIt, size: clothSize }
    const feel = id === 'fine' ? { crr: 0.05, rest: 0.2, mu: 0.35 } : { crr: 0.11, rest: 0.1, mu: 0.6 }
    const c = world.addCloth(id, p, feel)
    const h = homes.get(id)!
    c.place(h.x, h.y, world.clothField(id)!, h.a, 0.5)
    const v = new ClothView(c, world.clothField(id)!, lighting, id === 'fine' ? SILK_LOOK : BURLAP_LOOK, Q.subdiv, Q.shadow)
    plate.add(v.mesh)
    occluder.scene.add(v.occMesh)
    views.set(id, v)
    v.setDebug(debug)
    return c
  }

  // ---- layout: fit the camera to the plate, walls at the visible frame --------
  const view = { halfW: 20, halfH: 12 }
  function layout(first = false) {
    const w = innerWidth
    const h = innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    const maxHalf = SIZE / 2 - 3
    let halfH: number
    if (camera.aspect >= 1) halfH = maxHalf / camera.aspect
    else halfH = maxHalf
    halfH = Math.max(halfH, 9)
    const halfW = halfH * camera.aspect
    view.halfW = halfW
    view.halfH = halfH
    const dist = halfH / Math.tan((FOV * Math.PI) / 360)
    camera.position.set(0, 0, dist)
    camera.near = dist * 0.5
    camera.far = dist * 2
    camera.updateProjectionMatrix()
    // walls where the marble's silhouette meets the frame edge (it sits ~2r
    // above the plate, so perspective makes it look a little bigger/further out)
    const r = world.marble.p.radius
    const k = 1 - (2 * r) / dist
    world.setBounds({ x0: -halfW * k + r, y0: -halfH * k + r, x1: halfW * k - r, y1: halfH * k - r })
    if (first) {
      clothSize = Math.min(16, Math.min(halfW, halfH) * 1.25)
      if (camera.aspect >= 1) {
        homes.set('fine', { x: -halfW * 0.42, y: -halfH * 0.18, a: 0.18 })
        homes.set('rough', { x: halfW * 0.45, y: halfH * 0.12, a: -0.12 })
      } else {
        homes.set('fine', { x: -halfW * 0.12, y: -halfH * 0.48, a: 0.12 })
        homes.set('rough', { x: halfW * 0.1, y: halfH * 0.48, a: -0.1 })
      }
    }
  }
  layout(true)
  addEventListener('resize', () => layout())
  makeCloth('fine')
  makeCloth('rough')
  // first drop lands on bare plate between the swatches
  const home = camera.aspect >= 1 ? { x: 2, y: -view.halfH * 0.55 } : { x: -view.halfW * 0.45, y: 0 }
  world.dropMarble(home.x, home.y, 6)

  // ---- input ----------------------------------------------------------------
  const audio = new ProbeAudio()
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const inv = new THREE.Matrix4()
  const ro = new THREE.Vector3()
  const rd = new THREE.Vector3()
  /** pointer -> plate-space point on the surface */
  function pick(cx: number, cy: number): { x: number; y: number; z: number } {
    const rect = canvas.getBoundingClientRect()
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    inv.copy(plate.matrixWorld).invert()
    ro.copy(ray.ray.origin).applyMatrix4(inv)
    rd.copy(ray.ray.direction).transformDirection(inv)
    let t = (0 - ro.z) / rd.z
    for (let i = 0; i < 4; i++) {
      const h = surface.height.sample(ro.x + rd.x * t, ro.y + rd.y * t)
      t = (h - ro.z) / rd.z
    }
    return { x: ro.x + rd.x * t, y: ro.y + rd.y * t, z: ro.z + rd.z * t }
  }
  /** plate-space point -> client px (for tests) */
  const tmpV = new THREE.Vector3()
  function toScreen(x: number, y: number) {
    tmpV.set(x, y, surface.height.sample(x, y)).applyMatrix4(plate.matrixWorld).project(camera)
    const rect = canvas.getBoundingClientRect()
    return [Math.round(rect.left + ((tmpV.x + 1) / 2) * rect.width), Math.round(rect.top + ((1 - tmpV.y) / 2) * rect.height)]
  }

  type Drag =
    | { kind: 'marble'; hist: { t: number; x: number; y: number }[] }
    | { kind: 'cloth'; cloth: Cloth; ox: number; oy: number }
    | { kind: 'tilt'; sx: number; sy: number; ax0: number; ay0: number }
  const drags = new Map<number, Drag>()
  let lastThrow = { vx: 0, vy: 0, samples: 0 }
  const DEG = Math.PI / 180
  const PX_PER_DEG = 30
  let lockTilt = false
  const lim = SIZE / 2 - 1

  function topClothAt(x: number, y: number, slop: number): { cloth: Cloth; k: number } | null {
    let best: { cloth: Cloth; k: number } | null = null
    let bz = -Infinity
    for (const c of world.cloths) {
      const k = c.pick(x, y, Math.max(c.spacing * 1.5, slop))
      if (k < 0) continue
      const z = c.x[k * 3 + 2]
      if (z > bz) {
        bz = z
        best = { cloth: c, k }
      }
    }
    return best
  }

  canvas.addEventListener('pointerdown', (e) => {
    audio.start()
    hint.style.opacity = '0'
    canvas.setPointerCapture(e.pointerId)
    const p = pick(e.clientX, e.clientY)
    const touch = e.pointerType === 'touch'
    const m = world.marble
    const busy = (k: string) => [...drags.values()].some((d) => d.kind === k)
    // marble first (it sits on top), then the top-most cloth, else tilt
    if (!busy('marble') && Math.hypot(p.x - m.x, p.y - m.y) < m.p.radius * 1.15 + (touch ? 2.5 : 0.5)) {
      m.grab(p.x, p.y)
      drags.set(e.pointerId, { kind: 'marble', hist: [{ t: performance.now(), x: p.x, y: p.y }] })
      return
    }
    const hit = topClothAt(p.x, p.y, touch ? 2.5 : 1)
    if (hit && hit.cloth.grabbed < 0) {
      hit.cloth.grab(hit.k)
      drags.set(e.pointerId, { kind: 'cloth', cloth: hit.cloth, ox: hit.cloth.x[hit.k * 3] - p.x, oy: hit.cloth.x[hit.k * 3 + 1] - p.y })
      return
    }
    if (!busy('tilt')) drags.set(e.pointerId, { kind: 'tilt', sx: e.clientX, sy: e.clientY, ax0: world.tilt.tx, ay0: world.tilt.ty })
  })
  canvas.addEventListener('pointermove', (e) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    if (d.kind === 'tilt') {
      world.tilt.setTarget(d.ax0 + ((e.clientX - d.sx) / PX_PER_DEG) * DEG, d.ay0 - ((e.clientY - d.sy) / PX_PER_DEG) * DEG)
      return
    }
    const p = pick(e.clientX, e.clientY)
    if (d.kind === 'marble') {
      world.marble.moveTo(clamp(p.x, -lim, lim), clamp(p.y, -lim, lim))
      d.hist.push({ t: performance.now(), x: p.x, y: p.y })
      if (d.hist.length > 12) d.hist.shift()
    } else {
      d.cloth.moveGrab(clamp(p.x + d.ox, -lim, lim), clamp(p.y + d.oy, -lim, lim))
    }
  })
  const end = (e: PointerEvent) => {
    const d = drags.get(e.pointerId)
    if (!d) return
    drags.delete(e.pointerId)
    if (d.kind === 'tilt') {
      if (!lockTilt) world.tilt.release()
    } else if (d.kind === 'marble') {
      // throw velocity over the last ~100 ms of samples (needs a recent move;
      // pointermove is rAF-coalesced, so take at least the previous sample)
      const now = performance.now()
      const H = d.hist
      let vx = 0
      let vy = 0
      let used = 0
      const b = H[H.length - 1]
      if (H.length >= 2 && now - b.t < 120) {
        let i = H.length - 2
        while (i > 0 && b.t - H[i - 1].t <= 100) i--
        const a = H[i]
        const dt = Math.max(0.016, (b.t - a.t) / 1000)
        vx = (b.x - a.x) / dt
        vy = (b.y - a.y) / dt
        used = H.length - i
      }
      world.marble.release(vx, vy)
      lastThrow = { vx, vy, samples: used }
    } else d.cloth.releaseGrab()
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  // keyboard tilt (arrows / WASD), springs back unless locked
  const keys = new Set<string>()
  addEventListener('keydown', (e) => {
    if (e.repeat) return
    keys.add(e.code)
    if (e.code === 'Space') dropMarble()
    else if (e.code === 'KeyG') toggleMarble()
    else if (e.code === 'KeyL') toggleLock()
    else if (e.code === 'KeyD') toggleDebug()
    else if (e.code === 'KeyM') toggleSound()
    else if (e.code === 'KeyH') hud.classList.toggle('hidden')
    else if (e.code === 'KeyR') resetAll()
    audio.start()
  })
  addEventListener('keyup', (e) => keys.delete(e.code))
  let keyTilt = false
  function keyboardTilt() {
    const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
    const y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0)
    if (x || y) {
      world.tilt.setTarget(x * 5 * DEG, y * 5 * DEG)
      keyTilt = true
    } else if (keyTilt) {
      keyTilt = false
      if (!lockTilt) world.tilt.release()
    }
  }

  // gyro (opt-in): 5:1 reduction, low-passed, calibrated to the first reading
  let gyroOn = false
  let g0: { b: number; g: number } | null = null
  let gx = 0
  let gy = 0
  function onOrient(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return
    if (!g0) g0 = { b: e.beta, g: e.gamma }
    const a = 0.15
    gx += a * ((e.gamma - g0.g) / 5 - gx)
    gy += a * (-(e.beta - g0.b) / 5 - gy)
    world.tilt.setTarget(gx * DEG, gy * DEG)
  }
  async function toggleGyro(btn: HTMLButtonElement) {
    if (gyroOn) {
      removeEventListener('deviceorientation', onOrient)
      gyroOn = false
      world.tilt.release()
    } else {
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (DOE.requestPermission) {
        try {
          if ((await DOE.requestPermission()) !== 'granted') return
        } catch {
          return
        }
      }
      g0 = null
      addEventListener('deviceorientation', onOrient)
      gyroOn = true
    }
    btn.classList.toggle('on', gyroOn)
  }

  // ---- toolbar ---------------------------------------------------------------
  const btns: Record<string, HTMLButtonElement> = {}
  const button = (id: string, label: string, fn: (b: HTMLButtonElement) => void) => {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', () => {
      audio.start()
      fn(b)
    })
    bar.appendChild(b)
    btns[id] = b
    return b
  }
  function dropMarble() {
    world.marbleOn = true
    world.dropMarble(home.x, home.y, 6)
  }
  function toggleMarble() {
    const kind: MarbleKind = marbleView.kind === 'glass' ? 'steel' : 'glass'
    world.setMarble(kind === 'glass' ? GLASS_MARBLE : STEEL_BB)
    marbleView.setKind(kind, world.marble.p.radius)
    lighting.uGlass.value = kind === 'glass' ? 1 : 0
    btns.kind.textContent = kind === 'glass' ? 'Glass' : 'Steel BB'
    layout()
  }
  function toggleLock() {
    lockTilt = !lockTilt
    world.tilt.p.springBack = !lockTilt
    if (!lockTilt) world.tilt.release()
    btns.lock.classList.toggle('on', lockTilt)
  }
  function toggleDebug() {
    debug = !debug
    for (const v of views.values()) v.setDebug(debug)
    btns.debug.classList.toggle('on', debug)
  }
  function toggleSound() {
    audio.enabled = !audio.enabled
    btns.sound.classList.toggle('on', audio.enabled)
  }
  function resetAll() {
    world.tilt.snap(0, 0)
    makeCloth('fine')
    makeCloth('rough')
    dropMarble()
  }
  button('drop', 'Drop marble', dropMarble)
  button('kind', Q.marble === 'glass' ? 'Glass' : 'Steel BB', toggleMarble)
  button('silk', 'Silk', () => makeCloth('fine'))
  button('burlap', 'Burlap', () => makeCloth('rough'))
  button('lock', 'Lock tilt', toggleLock)
  if (coarse && 'DeviceOrientationEvent' in window) button('gyro', 'Gyro', (b) => void toggleGyro(b))
  button('sound', 'Sound', toggleSound).classList.add('on')
  button('debug', 'Friction', toggleDebug)
  button('hud', 'HUD', (b) => {
    hud.classList.toggle('hidden')
    b.classList.toggle('on', !hud.classList.contains('hidden'))
  }).classList.toggle('on', !coarse)
  if (coarse) hud.classList.add('hidden')
  button('q', QUALITY === 'high' ? 'HQ' : 'LQ', () => {
    params.set('q', QUALITY === 'high' ? 'low' : 'high')
    location.search = params.toString()
  })

  // ---- GPU timer (real hardware only; SwiftShader lacks it) ------------------
  const gl = renderer.getContext() as WebGL2RenderingContext
  const timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null
  const queries: WebGLQuery[] = []
  let gpuMs = NaN
  function gpuBegin(): WebGLQuery | null {
    if (!timerExt) return null
    const q = gl.createQuery()
    if (!q) return null
    gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q)
    return q
  }
  function gpuEnd(q: WebGLQuery | null) {
    if (!q || !timerExt) return
    gl.endQuery(timerExt.TIME_ELAPSED_EXT)
    queries.push(q)
    while (queries.length) {
      const head = queries[0]
      if (!gl.getQueryParameter(head, gl.QUERY_RESULT_AVAILABLE)) break
      queries.shift()
      if (!gl.getParameter(timerExt.GPU_DISJOINT_EXT)) gpuMs = gpuMs !== gpuMs ? gl.getQueryParameter(head, gl.QUERY_RESULT) / 1e6 : gpuMs * 0.9 + (gl.getQueryParameter(head, gl.QUERY_RESULT) / 1e6) * 0.1
      gl.deleteQuery(head)
    }
  }

  // ---- per-frame sync ----------------------------------------------------------
  const qInv = new THREE.Quaternion()
  const camWorld = new THREE.Vector3()
  const FOLLOW = 0.7 // camera follows this much of the plate tilt (parallax + lighting change)
  function syncScene() {
    const { ax, ay } = world.tilt
    plate.rotation.set(-ay, ax, 0, 'YXZ')
    rig.rotation.set(-ay * FOLLOW, ax * FOLLOW, 0, 'YXZ')
    scene.updateMatrixWorld()
    qInv.copy(plate.quaternion).invert()
    lighting.uL.value.copy(L_WORLD).applyQuaternion(qInv)
    lighting.uBox.value.copy(BOX_WORLD).applyQuaternion(qInv)
    camera.getWorldPosition(camWorld)
    lighting.uCam.value.copy(plate.worldToLocal(camWorld))
    const m = world.marble
    marbleView.update(m, world.marbleOn)
    lighting.uMarble.value.set(m.x, m.y, m.z, world.marbleOn ? m.p.radius : 0)
    for (const v of views.values()) v.update()
  }
  let anyClothMoved = true
  const clothSeen = new Map<string, number>()
  function render() {
    syncScene()
    if (occluder.ok && anyClothMoved) occluder.render(renderer)
    const q = gpuBegin()
    renderer.render(scene, camera)
    gpuEnd(q)
  }

  // ---- loop -------------------------------------------------------------------
  const stats = { fps: 0, frameMs: 0, physMs: 0, renderMs: 0, frames: 0 }
  const counts: Record<string, number> = {}
  const recentEvents: string[] = []
  let last = performance.now()
  let hudT = 0
  function onEvents(evs: ProbeEvent[]) {
    audio.events(evs)
    for (const e of evs) {
      counts[e.type] = (counts[e.type] ?? 0) + 1
      if (e.type !== 'slip') {
        recentEvents.unshift(`${e.type}(${e.source}) ${e.strength.toFixed(1)}`)
        if (recentEvents.length > 4) recentEvents.pop()
      }
    }
  }
  function frame(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    keyboardTilt()
    const tp = performance.now()
    world.update(dt)
    const physMs = performance.now() - tp
    onEvents(world.drainEvents())
    const fine = world.cloth('fine')
    const rough = world.cloth('rough')
    const m = world.marble
    audio.update({ speed: m.rollSpeed, grain: m.grain, grounded: m.grounded, onCloth: !!m.on }, fine?.stats.slip ?? 0, rough?.stats.slip ?? 0)
    anyClothMoved = world.cloths.some((c) => c.version !== clothSeen.get(c.id)) || stats.frames < 3
    for (const c of world.cloths) clothSeen.set(c.id, c.version)
    const tr = performance.now()
    render()
    const renderMs = performance.now() - tr
    // smoothed stats
    const k = 0.1
    stats.frameMs = stats.frameMs * (1 - k) + dt * 1000 * k
    stats.physMs = stats.physMs * (1 - k) + physMs * k
    stats.renderMs = stats.renderMs * (1 - k) + renderMs * k
    stats.fps = 1000 / Math.max(1, stats.frameMs)
    stats.frames++
    hudT += dt
    if (hudT > 0.25) {
      hudT = 0
      drawHud()
    }
    if (stats.frames === 2) {
      loading.classList.add('gone')
      document.body.dataset.ready = '1'
      resolveReady()
      // automation (headless SwiftShader renders ~1 fps): settle the scene
      // (2.5 s of sim), then stop the loop so screenshots are instant; tests
      // drive time with __spike.step(n). Add ?live to keep the loop running.
      if (HEADLESS) {
        paused = true
        world.paused = true
        world.advance(150)
        onEvents(world.drainEvents())
        anyClothMoved = true
        render()
        drawHud()
      }
    }
    if (!paused) requestAnimationFrame(frame)
  }
  let paused = false

  function drawHud() {
    const s = world.state()
    const m = s.marble
    const f = world.cloth('fine')?.stats
    const r = world.cloth('rough')?.stats
    const P = world.perf
    const info = renderer.info.render
    hud.innerHTML =
      `<b>CLOTH · MARBLE</b> <span class="dim">probe spike · ${QUALITY.toUpperCase()} · ${Q.res}² · bake ${bakeWall.toFixed(0)} ms</span>\n` +
      (paused
        ? `paused (test hooks drive time)  cpu-render ${stats.renderMs.toFixed(1)} ms
`
        : `${stats.fps.toFixed(0)} fps  frame ${stats.frameMs.toFixed(1)} ms  cpu-render ${stats.renderMs.toFixed(1)} ms  gpu ${gpuMs === gpuMs ? gpuMs.toFixed(2) + ' ms' : 'n/a'}
`) +
      `physics ${stats.physMs.toFixed(2)} ms  (marble ${P.marble.toFixed(2)} · silk ${(P.cloth.fine ?? 0).toFixed(2)} · burlap ${(P.cloth.rough ?? 0).toFixed(2)})  ${P.substeps}×${(1000 / world.opt.hz).toFixed(2)} ms\n` +
      `draws ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k\n` +
      `<span class="dim">marble</span> ${m.held ? 'held' : m.grounded ? 'rolling' : 'airborne'}${m.on ? ' on ' + m.on : ''}  v ${m.speed.toFixed(1)} mm/s  bounces ${m.bounces}  ticks ${m.ticks}\n` +
      `<span class="dim">silk</span>   ${f ? `${f.asleep ? 'asleep' : 'awake'}  contact ${f.contacts}  stuck ${f.stuck}  slip ${f.slip.toFixed(2)} mm` : '-'}\n` +
      `<span class="dim">burlap</span> ${r ? `${r.asleep ? 'asleep' : 'awake'}  contact ${r.contacts}  stuck ${r.stuck}  snags ${r.snags} (${counts.snag ?? 0} total)` : '-'}\n` +
      `<span class="dim">${recentEvents.join(' · ')}</span>`
    readout.innerHTML = `<span class="mag">5:1</span> · f/8 (eff f/48)<br>tilt ${s.tilt.deg[0].toFixed(1)}° ${s.tilt.deg[1].toFixed(1)}°${lockTilt ? ' (locked)' : ''}`
  }

  requestAnimationFrame(frame)

  // ---- test hooks -----------------------------------------------------------------
  const spike = {
    ready,
    quality: QUALITY,
    preset: Q,
    world,
    bakeMs: { wall: bakeWall, ...bake.ms },
    /** stop the rAF loop; use step() to advance deterministically */
    pause() {
      paused = true
      world.paused = true
    },
    resume() {
      if (!paused) return
      paused = false
      world.paused = false
      last = performance.now()
      requestAnimationFrame(frame)
    },
    /** advance N physics frames (1/60 s each) and render once */
    step(n = 1) {
      this.pause()
      for (let i = 0; i < n; i++) {
        world.advance(1)
        onEvents(world.drainEvents())
      }
      anyClothMoved = true
      render()
      drawHud()
      return world.state()
    },
    setTilt(axDeg: number, ayDeg: number, hold = true) {
      world.tilt.p.springBack = !hold
      world.tilt.setTarget(axDeg * DEG, ayDeg * DEG, hold)
    },
    dropMarble(x = 0, y = 0, h = 6) {
      world.marbleOn = true
      world.dropMarble(x, y, h)
    },
    throwMarble(x: number, y: number, vx: number, vy: number) {
      world.marbleOn = true
      world.throwMarble(x, y, vx, vy)
    },
    hideMarble() {
      world.marbleOn = false
    },
    placeCloth(id: 'fine' | 'rough', x: number, y: number, angle = 0) {
      const c = world.cloth(id)
      if (c) c.place(x, y, world.clothField(id)!, angle, 0.5)
    },
    /** scripted drag (plate mm): grab nearest particle to path[0], follow the polyline over `frames` frames */
    dragCloth(id: 'fine' | 'rough', path: [number, number][], frames = 60, release = true) {
      const c = world.cloth(id)
      if (!c) return null
      const k = c.pick(path[0][0], path[0][1], 50)
      c.grab(k)
      const ox = c.x[k * 3] - path[0][0]
      const oy = c.x[k * 3 + 1] - path[0][1]
      const segs = path.length - 1
      for (let f = 1; f <= frames; f++) {
        const u = (f / frames) * segs
        const i = Math.min(segs - 1, Math.floor(u))
        const t = u - i
        c.moveGrab(path[i][0] + (path[i + 1][0] - path[i][0]) * t + ox, path[i][1] + (path[i + 1][1] - path[i][1]) * t + oy)
        world.advance(1)
        onEvents(world.drainEvents())
      }
      if (release) c.releaseGrab()
      anyClothMoved = true
      render()
      return c.summary()
    },
    state() {
      return { ...world.state(), quality: QUALITY, stats, gpuMs, counts, lastThrow, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } }
    },
    toScreen,
    pick: (cx: number, cy: number) => pick(cx, cy),
    view: () => ({ ...view }),
    debug: (on: boolean) => {
      if (on !== debug) toggleDebug()
    },
    /** live shader uniforms of a cloth view (look-dev from the console) */
    clothUniforms: (id: string) => views.get(id)?.uniforms,
    lighting,
    shadowDebug: (on: boolean) => {
      ;(surfaceMesh.material as THREE.ShaderMaterial).uniforms.uDebug.value = on ? 1 : 0
    },
    /** physics-only benchmark: drags both cloths while the marble rolls; ms per 60 Hz frame */
    bench(frames = 120, renders = 10) {
      const wasPaused = paused
      this.pause()
      const fine = world.cloth('fine')!
      const rough = world.cloth('rough')!
      const acc = { total: 0, marble: 0, fine: 0, rough: 0 }
      fine.grab(fine.pick(fine.x[0], fine.x[1], 50))
      rough.grab(rough.pick(rough.x[0], rough.x[1], 50))
      world.throwMarble(0, 0, 60, 25)
      const fx = fine.x[0]
      const fy = fine.x[1]
      const rx = rough.x[0]
      const ry = rough.x[1]
      for (let f = 0; f < frames; f++) {
        const a = (f / frames) * Math.PI * 2
        fine.moveGrab(fx + Math.sin(a) * 6, fy + (1 - Math.cos(a)) * 3)
        rough.moveGrab(rx - Math.sin(a) * 5, ry - (1 - Math.cos(a)) * 3)
        world.advance(1)
        world.drainEvents()
        acc.total += world.perf.total
        acc.marble += world.perf.marble
        acc.fine += world.perf.cloth.fine ?? 0
        acc.rough += world.perf.cloth.rough ?? 0
      }
      fine.releaseGrab()
      rough.releaseGrab()
      // render cost (CPU submit; in headless this includes SwiftShader raster)
      const tr = performance.now()
      const R = Math.max(1, renders)
      for (let i = 0; i < R; i++) {
        anyClothMoved = true
        render()
      }
      gl.finish()
      const renderMs = (performance.now() - tr) / R
      if (!wasPaused) this.resume()
      const per = (v: number) => +(v / frames).toFixed(3)
      return {
        frames,
        physicsMsPerFrame: { total: per(acc.total), marble: per(acc.marble), fine: per(acc.fine), rough: per(acc.rough) },
        renderMsPerFrame: +renderMs.toFixed(2),
        fineN: fine.n,
        roughN: rough.n,
        fineConstraints: fine.constraintCount,
        roughConstraints: rough.constraintCount,
      }
    },
  }
  ;(window as unknown as { __spike: typeof spike }).__spike = spike
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

// expose readiness even before the bake finishes (tests can await it)
;(window as unknown as { __spikeReady: Promise<void> }).__spikeReady = ready

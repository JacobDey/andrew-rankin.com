// Engine: renderer, scene, eye camera, clocks (SimClock + DayClock), sun/sky/lights, bus, picking registry,
// the frame loop and eye adaptation (studio.md §5.1, §5.2, §7.1, §11.4).
import * as THREE from 'three'
import { createBus, rngStream, prefersReducedMotion, type Bus } from '@shared/core'
import { createRenderer } from '@shared/core/gfx'
import { sunPosition, moonPosition, daylightStudio, kelvinToRgb } from '@shared/sun'
import type { DayClock, Events, Quality, QualityName, RoomId, SimClock, Steppable, SunState } from './contracts'
import { createSky, type Sky } from './sky'

export const QUALITIES: Record<QualityName, Quality> = {
  high: { name: 'high', dprMax: 2, shadow: 2048, captureLong: 768, samples: 24, samplesFP: 32, drops: 1024, physicsHz: 120, previewLong: 640, bloom: true, transitions: true },
  low: { name: 'low', dprMax: 1.5, shadow: 1024, captureLong: 512, samples: 12, samplesFP: 16, drops: 512, physicsHz: 60, previewLong: 384, bloom: false, transitions: true },
  test: { name: 'test', dprMax: 1, shadow: 512, captureLong: 384, samples: 4, samplesFP: 8, drops: 512, physicsHz: 60, previewLong: 256, bloom: false, transitions: false },
}

export const DAY_OF_YEAR = 241
export const LAT = 41.5
export const LAYER_WORLD = 0
export const LAYER_EYE = 1
export const LAYER_SELF = 2

export interface Pickable {
  object: THREE.Object3D
  room: RoomId | 'any'
  /** pointer events; return true when consumed */
  on(e: PickEvent): boolean | void
  hover?: boolean
  label?: string
}
export interface PickEvent {
  kind: 'tap' | 'dragStart' | 'drag' | 'dragEnd' | 'hold' | 'down' | 'up' | 'doubleTap'
  point: THREE.Vector3
  ray: THREE.Ray
  dx: number
  dy: number
  x: number
  y: number
  vx: number
  vy: number
  pointerType: string
}

type Hook = { fn: (dt: number, t: number) => void; order: number }

export interface Engine {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  eye: THREE.PerspectiveCamera
  quality: Quality
  sim: SimClock & { onPose(fn: (t: number) => void): () => void; hz: number; stepCount: number }
  day: DayClock
  sun(): SunState
  bus: Bus<Events>
  rng(stream: string): () => number
  seed: number
  stage: HTMLElement
  canvas: HTMLCanvasElement
  sky: Sky
  sunLight: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  moonLight: THREE.DirectionalLight
  /** visual update hooks (every rendered frame), real dt */
  onFrame(fn: (dt: number) => void, order?: number): () => void
  /** rendering override: when set, it renders the frame instead of the eye pass */
  renderOverride: (() => void) | null
  pickables: Pickable[]
  addPickable(p: Pickable): () => void
  /** room ambient for eye adaptation (lux); null = outdoor horizontal illuminance */
  ambientLux: number | null
  exposure: number
  exposureTarget(): number
  snapExposure(): void
  room: RoomId
  paused: boolean
  frameTimeMs: number
  fps: number
  /** advance the world deterministically (fixed steps) and render once */
  step(ms: number): void
  render(): void
  reducedMotion: boolean
  timeScale: number
  /** interior sky-light factor (0 underground, ~0.04 indoors, 1 outdoors) */
  hemiScale: number
  dispose(): void
}

export function createEngine(stage: HTMLElement, qualityName: QualityName, seed: number): Engine {
  const quality = { ...QUALITIES[qualityName] }
  const canvas = document.createElement('canvas')
  canvas.className = 'st-canvas'
  stage.appendChild(canvas)
  const renderer = createRenderer(canvas, { tier: qualityName === 'high' ? 'high' : qualityName === 'low' ? 'low' : 'test', antialias: qualityName === 'high', dprCap: quality.dprMax, preserveDrawingBuffer: qualityName === 'test' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = qualityName === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const eye = new THREE.PerspectiveCamera(50, 1, 0.05, 900)
  eye.layers.enable(LAYER_EYE)
  eye.layers.enable(LAYER_SELF)

  const resize = () => {
    const w = Math.max(1, stage.clientWidth)
    const h = Math.max(1, stage.clientHeight)
    renderer.setSize(w, h, false)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    eye.aspect = w / h
    eye.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(() => resize())
  ro.observe(stage)

  // ---------------------------------------------------------------- clocks
  const steppables: { s: Steppable; order: number }[] = []
  const poseFns = new Set<(t: number) => void>()
  const h = 1 / quality.physicsHz
  let acc = 0
  const sim = {
    t: 0,
    paused: false,
    hz: quality.physicsHz,
    stepCount: 0,
    add(s: Steppable, order: number) {
      const e = { s, order }
      steppables.push(e)
      steppables.sort((a, b) => a.order - b.order)
      return () => {
        const i = steppables.indexOf(e)
        if (i >= 0) steppables.splice(i, 1)
      }
    },
    advance(dt: number) {
      if (!(dt > 0)) return
      acc += dt
      let guard = 0
      while (acc >= h - 1e-9 && guard < 100000) {
        acc -= h
        const t0 = sim.stepT
        for (const e of steppables) e.s.step(h, t0)
        sim.stepT += h
        sim.stepCount++
        guard++
      }
      sim.t += dt
      // day clock time-lapse (rate in game-seconds per sim-second)
      if (day.rate !== 0) day.set(day.hours + (dt * day.rate) / 3600, 'timelapse')
      for (const fn of poseFns) fn(sim.t)
    },
    onPose(fn: (t: number) => void) {
      poseFns.add(fn)
      return () => poseFns.delete(fn)
    },
    stepT: 0,
    /** fraction of the way to the next fixed step (for mesh interpolation) */
    get alpha() {
      return acc / h
    },
  }

  const dayCbs = new Set<(h: number) => void>()
  const day: DayClock = {
    hours: 16 + 40 / 60,
    rate: 0,
    set(hh: number, _source) {
      const v = Math.max(4.5, Math.min(23.5, hh))
      if (Math.abs(v - day.hours) < 1e-9) return
      day.hours = v
      sunDirty = true
      for (const cb of dayCbs) cb(v)
    },
    onChange(cb) {
      dayCbs.add(cb)
      return () => dayCbs.delete(cb)
    },
  }

  // ---------------------------------------------------------------- sun, sky, lights
  let sunDirty = true
  const sunState: SunState = {
    elevDeg: 0, azDeg: 0, dir: new THREE.Vector3(0, 1, 0), sunLux: 0, skyLux: 0,
    moonDir: new THREE.Vector3(0, 1, 0), moonLux: 0, horizLux: 0, kelvin: 5000,
  }
  const sunLight = new THREE.DirectionalLight(0xffffff, 1)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(quality.shadow, quality.shadow)
  const sc = sunLight.shadow.camera
  sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 90
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.03
  sunLight.target.position.set(1, 0, 4)
  scene.add(sunLight, sunLight.target)
  const hemi = new THREE.HemisphereLight(0xbcd3f0, 0x5a7a3a, 1)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0)
  moonLight.target.position.set(1, 0, 4)
  scene.add(moonLight, moonLight.target)
  const sky = createSky(seed)
  scene.add(sky.mesh)

  const tmpC = new THREE.Color()
  function updateSun(): void {
    if (!sunDirty) return
    sunDirty = false
    const sp = sunPosition(DAY_OF_YEAR, LAT, day.hours, { clockOffsetH: 1 })
    const mp = moonPosition(sp)
    const dl = daylightStudio(sp, mp)
    sunState.elevDeg = sp.elevDeg
    sunState.azDeg = sp.azDeg
    sunState.dir.set(sp.dir[0], sp.dir[1], sp.dir[2])
    sunState.moonDir.set(mp.dir[0], mp.dir[1], mp.dir[2])
    sunState.sunLux = dl.sunLux
    sunState.skyLux = dl.skyLux
    sunState.moonLux = dl.moonLux
    sunState.horizLux = dl.horizLux
    sunState.kelvin = dl.kelvin
    // lights in kilolux (§11.4)
    const rgb = kelvinToRgb(dl.kelvin)
    sunLight.color.setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace)
    sunLight.intensity = dl.sunLux / 1000
    sunLight.position.copy(sunState.dir).multiplyScalar(45).add(sunLight.target.position)
    sunLight.visible = dl.sunLux > 1
    // sky: horizontal illuminance from a (roughly) uniform sky = intensity for a Lambert card
    const warm = THREE.MathUtils.smoothstep(sp.elevDeg, -4, 25)
    tmpC.setRGB(0.55 + 0.2 * (1 - warm), 0.68, 0.95, THREE.LinearSRGBColorSpace)
    hemi.color.copy(tmpC)
    hemi.groundColor.setRGB(0.17, 0.24, 0.1, THREE.LinearSRGBColorSpace)
    hemi.intensity = dl.skyLux / 1000
    // moon (reflected sunlight at 4100 K)
    const mrgb = kelvinToRgb(4100)
    moonLight.color.setRGB(mrgb[0], mrgb[1], mrgb[2], THREE.LinearSRGBColorSpace)
    moonLight.intensity = dl.moonLux / 1000
    moonLight.position.copy(sunState.moonDir).multiplyScalar(45).add(moonLight.target.position)
    sky.update(sunState, rgb)
    bus.emit('sun', sunState)
  }

  // ---------------------------------------------------------------- bus, picking
  const bus = createBus<Events>()
  const pickables: Pickable[] = []
  const frameHooks: Hook[] = []

  const engine: Engine = {
    renderer, scene, eye, quality,
    sim: sim as unknown as Engine['sim'],
    day,
    sun() {
      updateSun()
      return sunState
    },
    bus,
    rng: (stream: string) => rngStream(seed, stream),
    seed,
    stage,
    canvas,
    sky,
    sunLight,
    hemi,
    moonLight,
    onFrame(fn, order = 0) {
      const e = { fn: (dt: number) => fn(dt), order }
      frameHooks.push(e)
      frameHooks.sort((a, b) => a.order - b.order)
      return () => {
        const i = frameHooks.indexOf(e)
        if (i >= 0) frameHooks.splice(i, 1)
      }
    },
    renderOverride: null,
    pickables,
    addPickable(p) {
      pickables.push(p)
      return () => {
        const i = pickables.indexOf(p)
        if (i >= 0) pickables.splice(i, 1)
      }
    },
    ambientLux: null,
    exposure: 1,
    exposureTarget() {
      const lux = engine.ambientLux ?? sunState.horizLux
      const klx = Math.max(1e-7, lux / 1000)
      return Math.min(2000 * 1000, Math.max(1 / 20, Math.PI / klx)) * 0.9
    },
    snapExposure() {
      updateSun()
      engine.exposure = engine.exposureTarget()
    },
    room: 'overview',
    paused: false,
    frameTimeMs: 16,
    fps: 60,
    step(ms: number) {
      const dt = ms / 1000
      const n = Math.max(1, Math.ceil(dt / (1 / 60)))
      for (let i = 0; i < n; i++) sim.advance(dt / n)
      for (const hk of frameHooks) hk.fn(dt, sim.t)
      engine.snapExposure()
      engine.render()
    },
    render() {
      updateSun()
      hemi.intensity = (sunState.skyLux / 1000) * engine.hemiScale
      renderer.toneMappingExposure = engine.exposure
      if (engine.renderOverride) engine.renderOverride()
      else {
        renderer.setRenderTarget(null)
        renderer.setViewport(0, 0, stage.clientWidth, stage.clientHeight)
        renderer.render(scene, eye)
      }
    },
    reducedMotion: prefersReducedMotion(),
    timeScale: 1,
    hemiScale: 1,
    dispose() {
      ro.disconnect()
      renderer.dispose()
    },
  }
  ;(engine.sim as unknown as { pose: () => void }).pose = () => {
    for (const fn of poseFns) fn(sim.t)
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now()
  let fpsAcc = 0
  let fpsN = 0
  const loop = (now: number) => {
    requestAnimationFrame(loop)
    let dt = (now - last) / 1000
    last = now
    if (dt > 0.1) dt = 0.1
    if (dt <= 0) return
    engine.frameTimeMs = engine.frameTimeMs * 0.9 + dt * 100
    fpsAcc += dt
    fpsN++
    if (fpsAcc > 0.5) {
      engine.fps = fpsN / fpsAcc
      fpsAcc = 0
      fpsN = 0
    }
    if (document.hidden) return
    if (!engine.paused && !sim.paused) sim.advance(dt * engine.timeScale)
    for (const hk of frameHooks) hk.fn(dt, sim.t)
    // eye adaptation: τ = 4 s going dark, 0.25 s going bright (§7.1)
    const target = engine.exposureTarget()
    const tau = target > engine.exposure ? 4 : 0.25
    engine.exposure = Math.exp(Math.log(engine.exposure) + (Math.log(target) - Math.log(engine.exposure)) * (1 - Math.exp(-dt / tau)))
    engine.render()
  }
  requestAnimationFrame(loop)
  document.addEventListener('visibilitychange', () => {
    last = performance.now()
  })
  updateSun()
  engine.snapExposure()
  return engine
}

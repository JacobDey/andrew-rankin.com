// The camera in the yard (studio.md §4.5, §5.7–5.10, §5.13): tripod, finder (3 bezels, dials, focus strip,
// meter, advance lever, cable release, self-timer, hold breath), handheld shake, shutters, capture through
// @shared/photo (fast path and live path, time-lapse, tilt), LogH8 latents, double exposure and ShotRecord.
import * as THREE from 'three'
import { Audio, haptic } from '@shared/audio'
import { bandNoise, valueNoise1, onGameKey, trackKeys, type GestureEvent } from '@shared/core'
import { PhotoRenderer, FinderPreview, computeOptics, blurCircleMm, encodeLog2, decodeLog2, bytesToPNG, pngToBytes, type PhotoSpec, type CameraPose, type Exposure } from '@shared/photo'
import type { Engine } from '../core/engine'
import { LAYER_SELF } from '../core/engine'
import type { Physics } from '../core/physics'
import type { Input } from '../core/input'
import type { CameraBuild, CameraSettings, CameraSpec, Roll, ShotRecord, StockId, SubjectMeasure, PhotoSubject } from '../core/contracts'
import type { Studio } from '../core/boot'
import { deriveSpec, photoSpec, defaultSettings, clampFocus, fmtShutter, fmtN, STOCKS, actualTime, nearFocusM } from './spec'
import { mat, box } from '../house/architecture'

export interface LatentRecord { frameId: string; rollId: string; index: number; w: number; h: number; channels: 1 | 3; png: Blob; record: ShotRecord }

export interface CameraApi {
  spec(): CameraSpec
  build(): CameraBuild
  setBuild(b: CameraBuild): CameraSpec
  settings: CameraSettings
  set(s: Partial<CameraSettings>): void
  handheld: boolean
  setHandheld(on: boolean): void
  finderOn: boolean
  finder(on: boolean): void
  placeTripod(pos: [number, number], yawDeg: number, pitchDeg: number, height?: number): void
  aim(target: [number, number, number]): void
  shoot(o?: { bulbSeconds?: number; noWind?: boolean; interactiveT?: number }): Promise<ShotRecord | null>
  wind(): void
  unload(): string | null
  loadFilm(stock?: StockId): void
  roll(): Roll | null
  framesLeft(): number | null
  busy: boolean
  tripod: THREE.Group
  photo: PhotoRenderer
  lastRecord: ShotRecord | null
  onShot: ((r: ShotRecord) => void) | null
}

const D2R = Math.PI / 180
const MEASURE_LONG = 768

export function installCamera(e: Engine, ph: Physics, st: Studio, input: Input): CameraApi {
  const { store, hud, yard } = st
  const house = store.house
  const photo = new PhotoRenderer(e.renderer)
  const preview = new FinderPreview(e.renderer, { longEdge: e.quality.previewLong, taps: e.quality.name === 'test' ? 8 : 12, maxCocPx: 12 })
  let build: CameraBuild = house.builds[house.activeBuild] ?? house.builds[0]
  let spec = deriveSpec(build)
  const settings: CameraSettings = { ...defaultSettings(spec) }
  let handheld = false
  let busy = false
  let lastRecord: ShotRecord | null = null

  // ---------------------------------------------------------------- tripod (layer 2: never in photos)
  const tripod = new THREE.Group()
  tripod.name = 'tripod'
  const ash = mat(0xc8a97e, { rough: 0.7 })
  const brass = mat(0xb08d3c, { metal: 0.8, rough: 0.35 })
  const legs: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 1, 6), ash)
    legs.push(leg)
    tripod.add(leg)
  }
  const head = new THREE.Group()
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), brass)
  column.position.y = -0.1
  head.add(column)
  const camBody = new THREE.Group()
  head.add(camBody)
  tripod.add(head)
  tripod.traverse((o) => {
    o.layers.set(LAYER_SELF)
    o.castShadow = false
  })
  e.scene.add(tripod)
  const tp = house.tripod
  const tripodState = { pos: new THREE.Vector3(tp.pos[0], 0, tp.pos[2]), yaw: tp.yaw * D2R, pitch: tp.pitch * D2R, height: tp.height }
  const handAim = { yaw: 0, pitch: -4 * D2R }
  const layoutTripod = () => {
    tripod.position.copy(tripodState.pos)
    const h = tripodState.height
    head.position.set(0, h, 0)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + tripodState.yaw
      const foot = new THREE.Vector3(Math.sin(a) * 0.38 * Math.max(0.5, h), 0, Math.cos(a) * 0.38 * Math.max(0.5, h))
      const top = new THREE.Vector3(0, h - 0.18, 0)
      const mid = foot.clone().add(top).multiplyScalar(0.5)
      const d = top.clone().sub(foot)
      legs[i].position.copy(mid)
      legs[i].scale.set(1, d.length(), 1)
      legs[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    }
    camBody.rotation.set(0, 0, 0)
    head.rotation.set(0, 0, 0)
    head.rotation.order = 'YXZ'
    head.rotation.y = tripodState.yaw
    camBody.rotation.x = -tripodState.pitch
    yard.tripodPos.copy(tripodState.pos)
  }
  const rebuildCamMesh = () => {
    camBody.clear()
    const b = build.body
    let m: THREE.Object3D
    if (b === 'oatcan') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 16), mat(0xc8402f, { rough: 0.8 }))
      m.rotation.x = Math.PI / 2
    } else if (b === 'box') {
      m = new THREE.Group()
      box(0.11, 0.12, 0.14, mat(0x1c1b1a, { rough: 0.6 }), 0, 0, 0, m)
      const lensM = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.03, 12), brass)
      lensM.rotation.x = Math.PI / 2
      lensM.position.z = 0.085
      m.add(lensM)
    } else {
      m = new THREE.Group()
      box(0.16, 0.16, 0.03, mat(0x5a2a1b), 0, 0, -0.1, m)
      box(0.12, 0.12, 0.03, mat(0x5a2a1b), 0, 0, 0.08, m)
      box(0.1, 0.1, 0.16, mat(0x7e1f1a, { rough: 0.9 }), 0, 0, -0.01, m)
    }
    m.position.y = 0.07
    camBody.add(m)
    camBody.traverse((o) => o.layers.set(LAYER_SELF))
  }
  rebuildCamMesh()
  layoutTripod()
  // drag the tripod on the lawn; hold / double-tap the lawn to send it there
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const gp = new THREE.Vector3()
  e.addPickable({
    object: tripod,
    room: 'yard',
    on: (pe) => {
      if (pe.kind === 'dragStart') return true
      if (pe.kind === 'drag') {
        if (pe.ray.intersectPlane(ground, gp)) {
          tripodState.pos.set(THREE.MathUtils.clamp(gp.x, -11.5, 13.5), 0, THREE.MathUtils.clamp(gp.z, 0.4, 15.5))
          layoutTripod()
        }
        return true
      }
      if (pe.kind === 'dragEnd') {
        saveTripod()
        return true
      }
      if (pe.kind === 'tap') {
        finder(true)
        return true
      }
      return false
    },
  })
  const prevFallback = input.fallback
  input.fallback = (ge, ray) => {
    if (e.room === 'yard' && !finderOn && (ge.kind === 'doubleTap' || ge.kind === 'hold')) {
      if (ray.intersectPlane(ground, gp) && gp.z > 0.3 && gp.z < 15.6 && gp.x > -11.6 && gp.x < 13.6) {
        hopTripod(gp.x, gp.z)
        return true
      }
    }
    return prevFallback ? prevFallback(ge, ray) : undefined
  }
  let hop: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null
  const hopTripod = (x: number, z: number) => {
    hop = { from: tripodState.pos.clone(), to: new THREE.Vector3(x, 0, z), t: 0 }
  }
  e.onFrame((dt) => {
    if (!hop) return
    hop.t = Math.min(1, hop.t + dt / 0.4)
    tripodState.pos.lerpVectors(hop.from, hop.to, hop.t)
    tripod.position.y = Math.sin(hop.t * Math.PI) * 0.15
    layoutTripod()
    if (hop.t >= 1) {
      hop = null
      saveTripod()
    }
  })
  const saveTripod = () => {
    store.saveHouse({ tripod: { pos: [tripodState.pos.x, 0, tripodState.pos.z], yaw: tripodState.yaw / D2R, pitch: tripodState.pitch / D2R, height: tripodState.height } })
  }

  // ---------------------------------------------------------------- pose + shake (§5.8)
  const finderCam = new THREE.PerspectiveCamera(40, 1, 0.05, 900)
  finderCam.layers.set(0)
  const breath = { until: 0, gasp: 0 }
  const jolts: { t0: number; d: number }[] = []
  const shakeAt = (t: number, out: { yaw: number; pitch: number }) => {
    if (!handheld) {
      const w = yard.wind.speed(tripodState.pos.x, tripodState.pos.z, t)
      out.yaw = 0.002 * D2R * w * Math.sin(t * 2.1)
      out.pitch = 0.002 * D2R * w * Math.sin(t * 1.7 + 1)
      return out
    }
    const s = THREE.MathUtils.clamp(Math.sqrt(0.6 / spec.massKg), 0.5, 2)
    let At = 0.02 * s
    let Ab = 0.1
    const Ad = 0.4 * s
    const now = e.sim.t
    if (now < breath.until) {
      At *= 0.4
      Ab *= 0.4
    } else if (now < breath.gasp) At *= 1.6
    const ax = (k: number) => {
      let v = At * bandNoise(t, 8, 12, e.seed + k, 6) + Ad * valueNoise1(t * 0.6, e.seed + 10 + k) + Ab * Math.sin(2 * Math.PI * 0.25 * t + k * 1.3)
      for (const j of jolts) {
        const tt = t - j.t0
        if (tt < 0 || tt > 1.2) continue
        const w = 2 * Math.PI * 6
        const z = 0.6
        const wd = w * Math.sqrt(1 - z * z)
        v += (j.d * Math.exp(-z * w * tt) * Math.sin(wd * tt)) / 0.6
      }
      return v * D2R
    }
    out.yaw = ax(0)
    out.pitch = ax(1)
    return out
  }
  const basePose = (out: THREE.Object3D) => {
    if (handheld) {
      const side = new THREE.Vector3(Math.cos(handAim.yaw), 0, -Math.sin(handAim.yaw)).multiplyScalar(-0.45)
      out.position.copy(tripodState.pos).add(side).setY(1.55)
      out.rotation.set(0, 0, 0)
      out.rotation.order = 'YXZ'
      out.rotation.y = handAim.yaw + Math.PI
      out.rotation.x = handAim.pitch
    } else {
      out.position.copy(tripodState.pos).setY(tripodState.height + 0.07)
      out.rotation.order = 'YXZ'
      out.rotation.set(tripodState.pitch, tripodState.yaw + Math.PI, 0)
    }
  }
  const sh = { yaw: 0, pitch: 0 }
  const poseAtTime = (t: number, out: THREE.PerspectiveCamera) => {
    basePose(out)
    shakeAt(t, sh)
    out.rotation.y += sh.yaw
    out.rotation.x += sh.pitch
    out.updateMatrixWorld(true)
    out.matrixWorldInverse.copy(out.matrixWorld).invert()
  }
  const syncFinderCam = () => {
    const ps = photoSpec(spec, settings)
    const op = computeOptics(ps)
    finderCam.fov = op.fovV
    finderCam.aspect = spec.formatMm[0] / spec.formatMm[1]
    finderCam.near = 0.05
    finderCam.updateProjectionMatrix()
    poseAtTime(e.sim.t, finderCam)
    return ps
  }

  // ---------------------------------------------------------------- film
  const newRollId = () => `r${Date.now().toString(36)}${Math.floor(e.rng('roll' + house.prints.length + house.negatives.length)() * 1e4)}`
  let rollCache: Roll | null = null
  const loadFilm = (stock?: StockId) => {
    const s = stock ?? build.stock ?? 'nj100'
    build = { ...build, stock: s }
    spec = deriveSpec(build)
    const r: Roll = { id: newRollId(), stock: s, body: build.body, frames: spec.frames, exposed: [], state: 'loaded', createdAt: Date.now() }
    rollCache = r
    void store.put('roll:' + r.id, r)
    store.saveHouse({ rollInCamera: r.id, frameCursor: 0, wound: true })
    updateCounter()
  }
  const roll = (): Roll | null => (house.rollInCamera && rollCache && rollCache.id === house.rollInCamera ? rollCache : null)
  const framesLeft = () => {
    const r = roll()
    return r ? r.frames - house.frameCursor : null
  }
  const updateCounter = () => {
    const r = roll()
    hud.setFrames(r ? house.frameCursor + (house.wound ? 0 : 1) : null, r ? r.frames : null)
    hud.setPocket(house.pocket.length)
    fUI.counter.textContent = r ? `${Math.min(r.frames, house.frameCursor + 1)}/${r.frames}` : '—'
    fUI.wind.disabled = !r || house.wound
    fUI.unload.disabled = !r
  }
  // restore an in-camera roll
  if (house.rollInCamera) {
    void store.get<Roll>('roll:' + house.rollInCamera).then((r) => {
      if (r) rollCache = r
      updateCounter()
    })
  }

  const wind = () => {
    const r = roll()
    if (!r || house.wound) return
    house.frameCursor = Math.min(r.frames, house.frameCursor + 1)
    house.wound = true
    store.saveHouse()
    Audio.play('studio.wind-on', {})
    updateCounter()
  }
  const unload = (): string | null => {
    const r = roll()
    if (!r) return null
    if (!house.wound) wind()
    r.state = 'unloaded'
    void store.put('roll:' + r.id, r)
    house.pocket.push(r.id)
    store.saveHouse({ rollInCamera: null, frameCursor: 0, wound: true, pocket: house.pocket })
    rollCache = null
    Audio.play('ui.canister', {})
    e.bus.emit('roll:unloaded', { rollId: r.id })
    updateCounter()
    return r.id
  }

  // ---------------------------------------------------------------- measures (§5.13)
  type Acc = { s: PhotoSubject; w: number; inW: number; visW: number; pts: { x: number; y: number; in: boolean; vis: boolean }[]; grid: Float32Array; states: Record<string, number | boolean>[]; rPx: number; dist: number }
  let accs: Acc[] = []
  let sumW = 0
  let measureW = 768
  let measureH = 768
  const ndc = new THREE.Vector3()
  const camPos = new THREE.Vector3()
  const cpos = new THREE.Vector3()
  const dir = new THREE.Vector3()
  let shakeMin = { y: 0, p: 0 }
  let shakeMax = { y: 0, p: 0 }
  const beginMeasure = () => {
    const [fw, fh] = spec.formatMm
    measureW = fw >= fh ? MEASURE_LONG : Math.round((MEASURE_LONG * fw) / fh)
    measureH = fw >= fh ? Math.round((MEASURE_LONG * fh) / fw) : MEASURE_LONG
    accs = yard.subjects.all().map((s) => ({ s, w: 0, inW: 0, visW: 0, pts: [], grid: new Float32Array(48), states: [], rPx: 0, dist: 0 }))
    sumW = 0
    shakeMin = { y: 1e9, p: 1e9 }
    shakeMax = { y: -1e9, p: -1e9 }
  }
  const measureSample = (cam: THREE.PerspectiveCamera, w: number) => {
    sumW += w
    camPos.setFromMatrixPosition(cam.matrixWorld)
    shakeAt(e.sim.t, sh)
    shakeMin = { y: Math.min(shakeMin.y, sh.yaw), p: Math.min(shakeMin.p, sh.pitch) }
    shakeMax = { y: Math.max(shakeMax.y, sh.yaw), p: Math.max(shakeMax.p, sh.pitch) }
    const pm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    const focalPx = measureH / 2 / Math.tan((cam.fov * D2R) / 2)
    for (const a of accs) {
      a.s.center(cpos)
      ndc.copy(cpos).applyMatrix4(pm)
      const x = (ndc.x * 0.5 + 0.5) * measureW
      const y = (1 - (ndc.y * 0.5 + 0.5)) * measureH
      const d = cpos.distanceTo(camPos)
      const rPx = (a.s.radius / Math.max(0.05, d)) * focalPx
      const front = ndc.z > -1 && ndc.z < 1
      const inF = front && x >= -rPx && x <= measureW + rPx && y >= -rPx && y <= measureH + rPx
      // visibility: an unobstructed ray from the camera to the centre
      let vis = true
      if (inF) {
        dir.copy(cpos).sub(camPos).normalize()
        const hit = ph.raycast(camPos, dir, Math.max(0, d - a.s.radius * 0.9))
        if (hit && (a.s.colliderHandle === undefined || hit.colliderHandle !== a.s.colliderHandle)) {
          const b = hit.body
          vis = !!(b && a.s.colliderHandle !== undefined && b.body.collider(0)?.handle === a.s.colliderHandle)
        }
      }
      a.w += w
      if (inF) a.inW += w
      if (inF && vis) {
        a.visW += w
        const gx = Math.max(0, Math.min(7, Math.floor((x / measureW) * 8)))
        const gy = Math.max(0, Math.min(5, Math.floor((y / measureH) * 6)))
        a.grid[gy * 8 + gx] += w
      }
      a.pts.push({ x, y, in: inF, vis })
      a.states.push(a.s.sample())
      a.rPx = rPx
      a.dist = d
    }
  }
  const extras = new Map<string, Record<string, number>>()
  const callExtra = (cam: THREE.PerspectiveCamera, phase: 'start' | 'mid' | 'end') => {
    for (const a of accs) {
      if (!a.s.extra) continue
      const r = a.s.extra(cam, measureW, measureH, phase)
      if (phase === 'end' || Object.keys(r).length) extras.set(a.s.id, { ...(extras.get(a.s.id) ?? {}), ...r })
    }
  }
  const finishMeasure = (ps: PhotoSpec, t: number): { subjects: SubjectMeasure[]; shakePx: number } => {
    const pitchMm = spec.formatMm[0] / measureW
    const fPx = spec.f / pitchMm
    const shakeRad = Math.hypot(shakeMax.y - shakeMin.y, shakeMax.p - shakeMin.p)
    const shakePx = Number.isFinite(shakeRad) ? shakeRad * fPx : 0
    const subjects: SubjectMeasure[] = []
    for (const a of accs) {
      const inPts = a.pts.filter((p) => p.in)
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
      for (const p of inPts) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      }
      let pathPx = 0
      for (let i = 1; i < a.pts.length; i++) {
        const p = a.pts[i]
        const q = a.pts[i - 1]
        if (p.in && q.in && p.vis) pathPx += Math.hypot(p.x - q.x, p.y - q.y)
      }
      const blur = inPts.length ? Math.hypot(maxX - minX, maxY - minY) + shakePx : 0
      const mid = a.pts[a.pts.length >> 1] ?? { x: 0, y: 0 }
      const midState = a.states[a.states.length >> 1] ?? {}
      const stateMin: Record<string, number> = {}
      const stateMax: Record<string, number> = {}
      const anyTrue: Record<string, boolean> = {}
      for (const s of a.states)
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === 'number') {
            stateMin[k] = Math.min(stateMin[k] ?? Infinity, v)
            stateMax[k] = Math.max(stateMax[k] ?? -Infinity, v)
          } else anyTrue[k] = (anyTrue[k] ?? false) || v
        }
      let gridMax = 0
      for (const g of a.grid) gridMax = Math.max(gridMax, g)
      const defocusMm = build.lens === 'pinhole' ? (build.pinholeMm ?? 0.45) : blurCircleMm(ps, a.dist)
      const extra = { ...(extras.get(a.s.id) ?? {}), pathPx, trailPx: pathPx }
      subjects.push({
        id: a.s.id, tag: a.s.tag,
        inFrame: a.w ? a.inW / a.w : 0,
        visible: a.w ? a.visW / a.w : 0,
        blurPx: blur,
        defocusPx: defocusMm / pitchMm,
        coverage: (Math.PI * a.rPx * a.rPx) / (measureW * measureH),
        visibility: sumW ? gridMax / sumW : 0,
        centerPx: [mid.x, mid.y],
        distanceM: a.dist,
        stateMin, stateMax, stateMid: { ...midState, ...stateMidOf(a.states) }, anyTrue, extra,
      })
    }
    void t
    return { subjects, shakePx }
  }
  const stateMidOf = (states: Record<string, number | boolean>[]): Record<string, number> => {
    const out: Record<string, number> = {}
    const keys = new Set<string>()
    for (const s of states) for (const [k, v] of Object.entries(s)) if (typeof v === 'boolean') keys.add(k)
    for (const k of keys) out[k + 'Frac'] = states.filter((s) => s[k] === true).length / Math.max(1, states.length)
    return out
  }

  // ---------------------------------------------------------------- exposure helpers
  const meterEv = (): number => {
    // centre-weighted reflected reading of the scene: horizontal illuminance on an 18 % card
    const s = e.sun()
    const L = (0.18 * s.horizLux) / Math.PI
    return Math.log2(Math.max(1e-6, L) * 100 / 12.5)
  }
  let lastMeter = 12
  const overStops = (t: number, N: number) => {
    const p = STOCKS[build.stock ?? 'nj100'].color ? 1.2 : 1.31
    const tEff = t > 1 ? Math.pow(t, 1 / p) : t
    return lastMeter + Math.log2(spec.iso / 100) - Math.log2((N * N) / Math.max(1e-6, tEff))
  }

  // ---------------------------------------------------------------- capture
  const shutterSound = (t: number) => {
    const k = build.shutter
    if (k === 'leaf') Audio.play('studio.leaf', { t })
    else if (k === 'drop') Audio.play('studio.drop', { h: (build.dropHeightCm ?? 40) / 100 })
    else if (k === 'focalplane') Audio.play('studio.focal', { t })
    else Audio.play('studio.cap', { open: 1 })
    haptic(12)
    camPos.copy(finderCam.position)
    basePose(finderCam)
    e.bus.emit('noise', { pos: finderCam.position.clone(), loudness: spec.loudness, kind: 'shutter' })
  }

  const doCapture = async (tSecIn: number, o: { live: boolean; stab?: boolean; cable?: boolean; realtime?: boolean; bulb?: boolean }): Promise<ShotRecord | null> => {
    let tSec = tSecIn
    const r = roll()
    if (!r) {
      shToast('No film in the camera.')
      return null
    }
    if (house.frameCursor >= r.frames) {
      shToast('Roll finished. Unload it.')
      return null
    }
    busy = true
    const ps = syncFinderCam()
    ps.shutter = Math.max(1 / 8000, tSec)
    lastMeter = meterEv()
    const N = settings.N
    const t0 = e.sim.t
    if (handheld && !o.cable) jolts.push({ t0: t0 - 0.005, d: 0.03 * (o.stab ? 1.5 : 1) })
    if (build.shutter === 'cap' && handheld) jolts.push({ t0, d: 0.02 })
    shutterSound(tSec)
    beginMeasure()
    extras.clear()
    const longEdge = e.quality.captureLong
    const stock = STOCKS[build.stock ?? 'nj100']
    const spectral = (stock.color ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : [stock.spectral, stock.spectral, stock.spectral]) as [[number, number, number], [number, number, number], [number, number, number]]
    const tilt = spec.tiltMaxDeg > 0 && Math.abs(settings.tiltDeg) > 0.01 ? { deg: settings.tiltDeg } : undefined
    const sampleCam = new THREE.PerspectiveCamera()
    sampleCam.copy(finderCam)
    let samples = 0
    const timelapse = tSec > 15 ? tSec / 15 : 1
    const span = tSec > 15 ? 15 : tSec
    let midDone = false
    const advanceTo = (time: number) => {
      const dt = time - e.sim.t
      if (dt > 0) e.sim.advance(dt)
    }
    const measureNow = (tRel: number) => {
      poseAtTime(e.sim.t, sampleCam)
      if (samples === 0) callExtra(sampleCam, 'start')
      if (!midDone && tRel >= span / 2) {
        callExtra(sampleCam, 'mid')
        midDone = true
      }
      measureSample(sampleCam, 1)
      samples++
    }
    let result
    const dayRate0 = e.day.rate
    try {
      if (!o.live) {
        const K = e.quality.samples
        result = await photo.capture({
          scene: e.scene,
          setTime: (time: number) => {
            advanceTo(time)
            measureNow(time - t0)
          },
        }, ps, {
          pose: finderCam,
          poseAt: (tRel: number): CameraPose => {
            poseAtTime(t0 + tRel, sampleCam)
            return { position: sampleCam.position.clone(), quaternion: sampleCam.quaternion.clone() }
          },
          time0: t0, samples: K, longEdge, radianceScale: 1000, spectral, tilt, layers: 1, grain: false, order: 'chronological', sliceMs: Infinity,
          seed: (e.seed * 977 + house.prints.length * 31 + house.frameCursor) >>> 0, shadowEvery: 2,
        })
        // the world simply continues: the shutter time really passed
        advanceTo(t0 + tSec)
      } else if (o.realtime) {
        // live path, driven by real frames: the world keeps running while the shutter is open (Bulb, lens cap,
        // anything over 1/8 s); one sample per 1/30 s of sim time; time-lapse above 15 s
        if (timelapse > 1) e.day.rate = timelapse
        const ex: Exposure = photo.begin({ scene: e.scene }, ps, { pose: finderCam, time0: t0, longEdge, radianceScale: 1000, spectral, tilt, layers: 1, grain: false, expectedSamples: o.bulb ? 120 : Math.max(4, Math.ceil(span * 30)), seed: (e.seed * 977 + house.frameCursor) >>> 0, shadowEvery: 4 })
        liveGhost = ex
        let acc = 1 / 30
        let exposed = 0
        await new Promise<void>((resolve) => {
          liveTick = (dt: number, end: boolean) => {
            const tRel = e.sim.t - t0
            acc += dt
            exposed += dt * timelapse
            if (acc >= 1 / 30 || end) {
              measureNow(tRel)
              ex.addSample({ time: e.sim.t, tRel, pose: { position: sampleCam.position.clone(), quaternion: sampleCam.quaternion.clone() }, weightS: acc * timelapse })
              acc = 0
            }
            ticker.hidden = false
            ticker.textContent = `${exposed.toFixed(1)}s`
            if (end || (!o.bulb && tRel >= span)) {
              liveTick = null
              ticker.hidden = true
              resolve()
            }
          }
        })
        if (o.bulb) tSec = Math.max(1 / 30, exposed)
        liveGhost = null
        result = await ex.finish()
      } else {
        // live path, deterministic (test API): one sample per 1/30 s of sim time (at most 120), time-lapse above 15 s
        const n = Math.max(4, Math.min(120, Math.ceil(span * 30)))
        if (timelapse > 1) e.day.rate = timelapse * 1 // game-seconds per sim-second
        const ex: Exposure = photo.begin({ scene: e.scene }, ps, { pose: finderCam, time0: t0, longEdge, radianceScale: 1000, spectral, tilt, layers: 1, grain: false, expectedSamples: n, seed: (e.seed * 977 + house.frameCursor) >>> 0, shadowEvery: 4 })
        liveGhost = ex
        for (let i = 0; i < n; i++) {
          const tRel = ((i + 0.5) / n) * span
          advanceTo(t0 + tRel)
          measureNow(tRel)
          ex.addSample({ time: e.sim.t, tRel, pose: { position: sampleCam.position.clone(), quaternion: sampleCam.quaternion.clone() }, weightS: tSec / n })
          if (o.cable === undefined && i % 8 === 7) await new Promise((res) => requestAnimationFrame(() => res(null)))
        }
        advanceTo(t0 + span)
        liveGhost = null
        result = await ex.finish()
      }
    } finally {
      e.day.rate = dayRate0
      busy = false
    }
    poseAtTime(e.sim.t, sampleCam)
    if (!midDone) callExtra(sampleCam, 'mid')
    callExtra(sampleCam, 'end')
    if (build.shutter === 'cap') Audio.play('studio.cap', { open: 0 })
    const m = finishMeasure(ps, tSec)
    const frameIndex = house.frameCursor
    const frameId = `${r.id}:${frameIndex}`
    const tags: string[] = []
    const dbl = !house.wound
    if (dbl) tags.push('Forgot to wind.')
    if (handheld && tSec >= 1 / 15 && tSec <= 1 / 4) tags.push(`Handheld at ${fmtShutter(tSec)}.`)
    if (timelapse > 1 && Math.abs(yard.sunFling) > 0) tags.push('The sun was dragged.')
    const dot = m.subjects.find((s) => s.id === 'dot')
    if (dot && dot.visibility > 0.12) tags.push('Dot was here.')
    if (e.sun().elevDeg < -6) tags.push('Moonlight.')
    const record: ShotRecord = {
      id: frameId, rollId: r.id, frame: frameIndex, takenAt: Date.now(), dayHours: e.day.hours, sunElevDeg: e.sun().elevDeg,
      spec: { body: build.body, lens: build.lens, f: spec.f, N, t: tSec, shutter: build.shutter, stock: build.stock ?? 'nj100', iso: spec.iso, formatMm: spec.formatMm },
      focusM: settings.focusM, tiltDeg: settings.tiltDeg, handheld, shakePx: m.shakePx, samples, timelapse,
      exposure: { evScene: lastMeter, overStops: overStops(tSec, N) }, doubleExposures: dbl ? 1 : 0, subjects: m.subjects, tags,
    }
    // LogH8 latent
    const w = result.width
    const h = result.height
    const ch: 1 | 3 = stock.color ? 3 : 1
    if (result.latent) {
      let lat = result.latent
      if (dbl) {
        const prev = await store.get<LatentRecord>('latent:' + frameId)
        if (prev && prev.w === w && prev.h === h) {
          const { bytes } = await pngToBytes(prev.png, prev.channels)
          const X = decodeLog2(bytes, w, h, { channels: prev.channels, minStops: -10, maxStops: 6.6 })
          lat = lat.slice()
          for (let i = 0; i < w * h; i++)
            for (let c = 0; c < 3; c++) lat[i * 4 + c] += X[i * prev.channels + Math.min(c, prev.channels - 1)]
          record.doubleExposures = (prev.record.doubleExposures ?? 0) + 1
          record.subjects = prev.record.subjects.concat(record.subjects)
        }
      }
      const bytes = encodeLog2(lat, w, h, { channels: ch, minStops: -10, maxStops: 6.6, spectral: ch === 1 ? [[1, 0, 0]] : undefined })
      const png = await bytesToPNG(bytes, w, h, ch)
      const rec: LatentRecord = { frameId, rollId: r.id, index: frameIndex, w, h, channels: ch, png, record }
      await store.put('latent:' + frameId, rec)
    }
    if (!r.exposed.includes(frameIndex)) r.exposed.push(frameIndex)
    void store.put('roll:' + r.id, r)
    house.wound = false
    store.saveHouse()
    lastRecord = record
    e.bus.emit('shot', { record })
    api.onShot?.(record)
    updateCounter()
    return record
  }
  let liveGhost: Exposure | null = null
  let liveTick: ((dt: number, end: boolean) => void) | null = null
  e.onFrame((dt) => liveTick?.(dt, false), 20)
  const shToast = (t: string) => st.shell.toast(t)

  // ---------------------------------------------------------------- finder UI
  const fEl = document.createElement('div')
  fEl.className = 'st-finder'
  fEl.hidden = true
  e.stage.appendChild(fEl)
  const bezel = document.createElement('div')
  bezel.className = 'st-bezel'
  fEl.appendChild(bezel)
  const top = document.createElement('div')
  top.className = 'st-ftop'
  fEl.appendChild(top)
  const mkBtn = (label: string, cls = 'st-btn st-btn--dark', parent: HTMLElement = top) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.textContent = label
    parent.appendChild(b)
    return b
  }
  const exitB = mkBtn('✕ Exit')
  exitB.setAttribute('aria-label', 'Exit the finder (Esc)')
  const modeB = mkBtn('Tripod')
  modeB.setAttribute('aria-label', 'Swap handheld and tripod (V)')
  const unloadB = mkBtn('Unload')
  const counter = document.createElement('div')
  counter.className = 'st-counter'
  top.appendChild(counter)
  const windB = mkBtn('Wind ▸')
  windB.setAttribute('aria-label', 'Wind on (R)')
  const fUI = { counter, wind: windB, unload: unloadB }
  const bar = document.createElement('div')
  bar.className = 'st-fbar'
  fEl.appendChild(bar)
  const mkDial = (label: string) => {
    const d = document.createElement('div')
    d.className = 'st-dial'
    const row = document.createElement('div')
    row.className = 'st-dial-row'
    const minus = mkBtn('−', '', row)
    const val = document.createElement('div')
    val.className = 'st-dial-val'
    row.appendChild(val)
    const plus = mkBtn('+', '', row)
    d.appendChild(row)
    const l = document.createElement('span')
    l.textContent = label
    d.appendChild(l)
    bar.appendChild(d)
    return { d, minus, plus, val }
  }
  const apDial = mkDial('aperture')
  const shDial = mkDial('shutter')
  const tiltDial = mkDial('tilt')
  const shutterBtn = document.createElement('button')
  shutterBtn.type = 'button'
  shutterBtn.className = 'st-shutterbtn'
  shutterBtn.setAttribute('aria-label', 'Shutter release (hold Space, let go to fire)')
  fEl.appendChild(shutterBtn)
  const focus = document.createElement('div')
  focus.className = 'st-focus'
  focus.setAttribute('aria-label', 'Focus strip (W/S)')
  const focusMark = document.createElement('div')
  focusMark.className = 'st-focus-mark'
  const focusDof = document.createElement('div')
  focusDof.className = 'st-focus-dof'
  const focusLabel = document.createElement('div')
  focusLabel.className = 'st-focus-label'
  focus.append(focusDof, focusMark, focusLabel)
  fEl.appendChild(focus)
  const meter = document.createElement('div')
  meter.className = 'st-meter'
  const needle = document.createElement('div')
  needle.className = 'st-meter-needle'
  const mid = document.createElement('div')
  mid.className = 'st-meter-mid'
  meter.append(mid, needle)
  fEl.appendChild(meter)
  const ticker = document.createElement('div')
  ticker.className = 'st-ticker'
  ticker.hidden = true
  fEl.appendChild(ticker)

  const apStops = () => {
    if (build.lens === 'pinhole') return [spec.nMin]
    const out: number[] = []
    const lensStops = build.lens === 'portrait120' ? [3.6, 5.6, 8] : null
    if (lensStops) return lensStops
    for (let n = spec.nMin; n <= spec.nMax * 1.01; n *= Math.SQRT2) out.push(Math.round(n * 10) / 10)
    return out
  }
  const speeds = () => (build.shutter === 'cap' ? [15, 8, 4, 2, 1, 0.5] : spec.shutterSpeeds)
  const stepAp = (d: number) => {
    const s = apStops()
    let i = s.findIndex((n) => Math.abs(n - settings.N) < 0.15)
    if (i < 0) i = 0
    i = THREE.MathUtils.clamp(i + d, 0, s.length - 1)
    settings.N = s[i]
    Audio.play('aperture.detent', {})
    refreshUI()
  }
  const stepSh = (d: number) => {
    const s = speeds()
    let i = s.findIndex((t) => Math.abs(t - settings.t) < 1e-6)
    if (i < 0) i = 0
    i = THREE.MathUtils.clamp(i + d, 0, s.length - 1)
    settings.t = s[i]
    Audio.play('ui.tick', {})
    refreshUI()
  }
  const stepTilt = (d: number) => {
    settings.tiltDeg = THREE.MathUtils.clamp(Math.round((settings.tiltDeg + d) * 2) / 2, -spec.tiltMaxDeg, spec.tiltMaxDeg)
    refreshUI()
  }
  apDial.minus.addEventListener('click', () => stepAp(-1))
  apDial.plus.addEventListener('click', () => stepAp(1))
  shDial.minus.addEventListener('click', () => stepSh(-1))
  shDial.plus.addEventListener('click', () => stepSh(1))
  tiltDial.minus.addEventListener('click', () => stepTilt(-1))
  tiltDial.plus.addEventListener('click', () => stepTilt(1))
  exitB.addEventListener('click', () => finder(false))
  modeB.addEventListener('click', () => setHandheld(!handheld))
  windB.addEventListener('click', () => wind())
  unloadB.addEventListener('click', () => {
    const id = unload()
    if (id) shToast('Roll in your pocket.')
  })
  // focus strip: log scale from near focus to ∞
  const focusToU = (m: number) => {
    const near = Math.min(3, nearFocusM(build) === Infinity ? 1 : nearFocusM(build))
    if (!Number.isFinite(m) || m > 200) return 0
    return THREE.MathUtils.clamp(1 - Math.log(m / near) / Math.log(200 / near), 0, 1)
  }
  const uToFocus = (u: number) => {
    const near = Math.min(3, nearFocusM(build) === Infinity ? 1 : nearFocusM(build))
    return near * Math.pow(200 / near, 1 - u)
  }
  let focusDrag = false
  const focusFromY = (clientY: number) => {
    const r = focus.getBoundingClientRect()
    const u = THREE.MathUtils.clamp((clientY - r.top) / r.height, 0, 1)
    settings.focusM = clampFocus(build, uToFocus(u))
    refreshUI()
  }
  focus.addEventListener('pointerdown', (ev) => {
    focusDrag = true
    focus.setPointerCapture(ev.pointerId)
    focusFromY(ev.clientY)
  })
  focus.addEventListener('pointermove', (ev) => focusDrag && focusFromY(ev.clientY))
  focus.addEventListener('pointerup', () => (focusDrag = false))
  // shutter button: hold = meter, release = fire; stab < 80 ms = 1.5× jolt; drag 40 px up = Bulb lock
  let pressAt = 0
  let bulbLive: { start: number } | null = null
  let lockNotch = false
  let pressY = 0
  shutterBtn.addEventListener('pointerdown', (ev) => {
    shutterBtn.setPointerCapture(ev.pointerId)
    pressAt = performance.now()
    pressY = ev.clientY
    shutterBtn.classList.add('st-shutterbtn--held')
    if (isBulbLike()) startBulb()
  })
  shutterBtn.addEventListener('pointermove', (ev) => {
    if (bulbLive && pressY - ev.clientY > 40) {
      lockNotch = true
      shutterBtn.classList.add('st-shutterbtn--lock')
    }
  })
  const release = () => {
    shutterBtn.classList.remove('st-shutterbtn--held')
    const stab = performance.now() - pressAt < 80
    if (bulbLive) {
      if (!lockNotch) void endBulb()
      return
    }
    if (busy) return
    void fire({ stab })
  }
  shutterBtn.addEventListener('pointerup', release)
  shutterBtn.addEventListener('pointercancel', () => shutterBtn.classList.remove('st-shutterbtn--held'))

  const isBulbLike = () => settings.t === 0 || build.shutter === 'cap'
  const startBulb = () => {
    if (busy || bulbLive) return
    bulbLive = { start: performance.now() }
    void fire({ bulb: true })
  }
  const endBulb = async () => {
    if (!bulbLive) return
    bulbLive = null
    lockNotch = false
    shutterBtn.classList.remove('st-shutterbtn--lock')
    liveTick?.(0, true)
  }
  const fire = async (o: { stab?: boolean; bulb?: boolean; cable?: boolean } = {}): Promise<ShotRecord | null> => {
    if (busy) return null
    const bulb = !!o.bulb || settings.t === 0
    const t = bulb ? 0 : actualTime(build.shutter, settings.t)
    const live = bulb || t > 1 / 8
    if (!live) {
      // the finder blacks out while the fast path integrates the interval
      hud.fade.classList.add('st-fade--black')
      await new Promise((res) => requestAnimationFrame(() => res(null)))
    }
    try {
      return await doCapture(t, { live, stab: o.stab, cable: o.cable, realtime: live, bulb })
    } finally {
      hud.fade.classList.remove('st-fade--black')
      bulbLive = null
    }
  }

  // aim by dragging on the image; tap = focus there
  const rc = new THREE.Raycaster()
  input.overlay = (ge: GestureEvent) => {
    if (!finderOn) return
    if (ge.kind === 'drag' && ge.pointers <= 1) {
      const k = (finderCam.fov * D2R) / Math.max(200, e.stage.clientHeight) * (spec.finder === 'ground' ? -1 : 1)
      const kx = spec.finder === 'waist' || spec.finder === 'ground' ? -k : k
      if (handheld) {
        handAim.yaw += ge.dx * kx
        handAim.pitch = THREE.MathUtils.clamp(handAim.pitch + ge.dy * k, -80 * D2R, 80 * D2R)
      } else {
        tripodState.yaw += ge.dx * kx
        tripodState.pitch = THREE.MathUtils.clamp(tripodState.pitch + ge.dy * k, -89 * D2R, 89 * D2R)
        layoutTripod()
      }
      return true
    }
    if (ge.kind === 'dragEnd') {
      saveTripod()
      return true
    }
    if (ge.kind === 'tap') {
      // focus at the raycast distance of the tapped point
      const r = bezel.getBoundingClientRect()
      const s = e.stage.getBoundingClientRect()
      let u = (ge.x + s.left - r.left) / r.width
      let v = (ge.y + s.top - r.top) / r.height
      if (spec.finder === 'waist') u = 1 - u
      if (spec.finder === 'ground') {
        u = 1 - u
        v = 1 - v
      }
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        syncFinderCam()
        rc.setFromCamera(new THREE.Vector2(u * 2 - 1, 1 - v * 2), finderCam)
        rc.layers.set(0)
        const hits = rc.intersectObjects(e.scene.children, true).filter((h) => h.object.name !== 'sky' && h.object.visible)
        if (hits[0]) {
          settings.focusM = clampFocus(build, hits[0].distance)
          Audio.play('focus.ring', {})
          refreshUI()
        }
      }
      return true
    }
    if (ge.kind === 'wheel') {
      settings.focusM = clampFocus(build, settings.focusM * Math.exp(ge.deltaY * 0.002))
      refreshUI()
      return true
    }
    return ge.kind === 'dragStart' || ge.kind === 'down' || ge.kind === 'up' || ge.kind === 'hold'
  }

  let finderOn = false
  const layoutBezel = () => {
    const W = e.stage.clientWidth
    const H = e.stage.clientHeight
    const aspect = spec.formatMm[0] / spec.formatMm[1]
    const small = W < 640
    const padL = small ? 32 : 75
    const padR = small ? 62 : 75
    const availW = W - padL - padR
    const availH = H - (small ? 230 : 150)
    let bw = availW
    let bh = bw / aspect
    if (bh > availH) {
      bh = availH
      bw = bh * aspect
    }
    const x = padL + (availW - bw) / 2
    const y = small ? 64 + (availH - bh) / 2 : (H - bh) / 2 - 10
    Object.assign(bezel.style, { left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${bh}px` })
    bezel.className = 'st-bezel st-bezel--' + spec.finder
    return { x, y, w: bw, h: bh }
  }
  const refreshUI = () => {
    apDial.val.textContent = fmtN(settings.N)
    shDial.val.textContent = build.shutter === 'cap' ? `cap ${fmtShutter(settings.t)}` : fmtShutter(settings.t)
    tiltDial.d.hidden = spec.tiltMaxDeg <= 0
    tiltDial.val.textContent = `${settings.tiltDeg.toFixed(1)}°`
    modeB.textContent = handheld ? 'Handheld' : 'Tripod'
    const u = focusToU(settings.focusM)
    focusMark.style.top = `${u * 100}%`
    focusLabel.style.top = `${u * 100}%`
    focusLabel.textContent = build.lens === 'pinhole' ? 'pinhole' : settings.focusM > 150 ? '∞' : `${settings.focusM.toFixed(settings.focusM < 3 ? 2 : 1)} m`
    // DoF bracket from the real hyperfocal distance
    const c = spec.formatMm[0] > 100 ? 0.1 : spec.formatMm[0] > 50 ? 0.05 : 0.03
    const Hf = (spec.f * spec.f) / (settings.N * c) / 1000 + spec.f / 1000
    const s = settings.focusM
    const near = (s * Hf) / (Hf + s)
    const far = s < Hf ? (s * Hf) / (Hf - s) : Infinity
    const u0 = focusToU(far)
    const u1 = focusToU(near)
    focusDof.style.top = `${u0 * 100}%`
    focusDof.style.height = `${Math.max(1, (u1 - u0) * 100)}%`
    updateCounter()
  }

  const finder = (on: boolean) => {
    if (on === finderOn) return
    if (on && e.room !== 'yard') return
    finderOn = on
    fEl.hidden = !on
    st.rooms.locked = on
    hud.cameraButton.setAttribute('aria-pressed', String(on))
    hud.el.querySelector('.st-pocketwrap')?.toggleAttribute('hidden', on)
    hud.el.classList.toggle('st-hud--finder', on)
    if (on) {
      if (!roll()) loadFilm()
      refreshUI()
      e.renderOverride = renderFinder
      Audio.setMuffle(spec.finder === 'ground' ? 600 : null)
    } else {
      e.renderOverride = null
      Audio.setMuffle(null)
    }
    hud.setCableRelease(!on && !handheld && e.room === 'yard')
  }
  const tmpV4 = new THREE.Vector4()
  const renderFinder = () => {
    const r = e.renderer
    const vp = layoutBezel()
    r.setRenderTarget(null)
    r.setViewport(0, 0, e.stage.clientWidth, e.stage.clientHeight)
    r.setClearColor(0x0b0a09, 1)
    r.clear()
    const ps = syncFinderCam()
    const dim = bulbLive ? 0.15 : 1
    if (spec.finder === 'pins') {
      // no image at all: the eye view past the brass sight pins
      const cam = finderCam.clone()
      cam.aspect = e.stage.clientWidth / e.stage.clientHeight
      cam.fov = Math.max(finderCam.fov, 50)
      cam.updateProjectionMatrix()
      cam.layers.set(0)
      r.setViewport(0, 0, e.stage.clientWidth, e.stage.clientHeight)
      r.toneMappingExposure = e.exposure * dim
      r.render(e.scene, cam)
    } else {
      preview.render(e.scene, finderCam, ps, {
        viewport: { x: vp.x, y: e.stage.clientHeight - vp.y - vp.h, width: vp.w, height: vp.h },
        flipX: spec.finder === 'waist' || (spec.finder === 'ground' && !house.settings.erect),
        flipY: spec.finder === 'ground' && !house.settings.erect,
        radianceScale: 1000,
        layers: 1,
        // @shared/photo FinderPreview divides its display gain by radianceScale (its meter multiplies);
        // compensate here so the preview is exposed like the film (request filed with shared-photo)
        brightness: dim * 1e6,
      })
      lastMeter = preview.meterEV100()
    }
    if (liveGhost) liveGhost.drawGhost(null, { x: vp.x, y: e.stage.clientHeight - vp.y - vp.h, width: vp.w, height: vp.h }, 0.15)
    // meter needle (−2…+2 stops)
    const ov = THREE.MathUtils.clamp(overStops(settings.t === 0 ? 1 : actualTime(build.shutter, settings.t), settings.N), -2, 2)
    needle.style.top = `${50 - ov * 23}%`
    void tmpV4
  }

  // ---------------------------------------------------------------- keys
  const keys = trackKeys()
  onGameKey((ev) => {
    if (ev.code === 'KeyC' && e.room === 'yard') {
      finder(!finderOn)
      return
    }
    if (!finderOn) {
      if (ev.code === 'KeyB' && e.room === 'yard' && !handheld) void fire({ cable: true })
      return
    }
    switch (ev.code) {
      case 'Escape':
        finder(false)
        break
      case 'KeyZ':
        stepAp(1)
        break
      case 'KeyX':
        stepAp(-1)
        break
      case 'Comma':
        stepSh(-1)
        break
      case 'Period':
        stepSh(1)
        break
      case 'KeyW':
        settings.focusM = clampFocus(build, settings.focusM * 1.12)
        refreshUI()
        break
      case 'KeyS':
        settings.focusM = clampFocus(build, settings.focusM / 1.12)
        refreshUI()
        break
      case 'KeyG':
        stepTilt(-0.5)
        break
      case 'KeyH':
        stepTilt(0.5)
        break
      case 'KeyR':
        wind()
        break
      case 'KeyU':
        unload()
        break
      case 'KeyV':
        setHandheld(!handheld)
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        if (e.sim.t > breath.gasp) {
          breath.until = e.sim.t + 4
          breath.gasp = e.sim.t + 7
        }
        break
      case 'Space':
        ev.preventDefault()
        if (!ev.repeat) {
          pressAt = performance.now()
          shutterBtn.classList.add('st-shutterbtn--held')
          if (isBulbLike()) startBulb()
        }
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const dx = ev.code === 'ArrowLeft' ? 1 : ev.code === 'ArrowRight' ? -1 : 0
        const dy = ev.code === 'ArrowUp' ? 1 : ev.code === 'ArrowDown' ? -1 : 0
        if (handheld) {
          handAim.yaw += dx * 0.02
          handAim.pitch += dy * 0.015
        } else {
          tripodState.yaw += dx * 0.02
          tripodState.pitch += dy * 0.015
          layoutTripod()
        }
        ev.preventDefault()
        break
      }
    }
  })
  onGameKey((ev) => {
    if (!finderOn) return
    if (ev.code === 'Space') {
      if (bulbLive && !ev.shiftKey) void endBulb()
      else if (!bulbLive) release()
    }
  }, { up: true })
  void keys

  // camera button + cable release bulb
  hud.cameraButton.addEventListener('click', () => {
    if (e.room !== 'yard') {
      void st.rooms.go('yard').then(() => finder(true))
      return
    }
    finder(!finderOn)
  })
  let bulbDown = 0
  let selfTimer = 0
  hud.bulb.addEventListener('pointerdown', () => {
    bulbDown = performance.now()
    hud.bulb.classList.add('st-bulb--held')
    clearTimeout(selfTimer)
    selfTimer = window.setTimeout(() => {
      // long-press: self-timer, 10 s escapement buzz then fire
      bulbDown = 0
      Audio.play('studio.selftimer', { dur: 10 })
      shToast('Self-timer: ten seconds.')
      window.setTimeout(() => void fire({ cable: true }), 10000)
    }, 600)
  })
  hud.bulb.addEventListener('pointerup', () => {
    hud.bulb.classList.remove('st-bulb--held')
    clearTimeout(selfTimer)
    if (bulbDown) void fire({ cable: true })
    bulbDown = 0
  })
  st.rooms.onChange((to) => {
    hud.setCableRelease(to === 'yard' && !handheld)
    hud.cameraButton.hidden = to !== 'yard' && to !== 'overview'
    if (to !== 'yard') finder(false)
  })

  const setHandheld = (on: boolean) => {
    handheld = on
    tripod.visible = true
    camBody.visible = !on
    hud.setCableRelease(!finderOn && !on && e.room === 'yard')
    refreshUI()
  }
  const setBuild = (b: CameraBuild): CameraSpec => {
    const prevStock = build.stock
    build = { ...b }
    spec = deriveSpec(build)
    const d = defaultSettings(spec)
    settings.N = THREE.MathUtils.clamp(settings.N, spec.nMin, spec.nMax)
    if (build.lens === 'pinhole') settings.N = spec.nMin
    if (!speeds().some((t) => Math.abs(t - settings.t) < 1e-6)) settings.t = d.t
    settings.focusM = clampFocus(build, settings.focusM)
    if (spec.tiltMaxDeg <= 0) settings.tiltDeg = 0
    const idx = house.activeBuild
    house.builds[idx] = build
    store.saveHouse({ builds: house.builds })
    rebuildCamMesh()
    // a different film format means a different roll
    const r = roll()
    if (r && (r.body !== build.body || prevStock !== build.stock)) {
      if (r.exposed.length) unload()
      else {
        rollCache = null
        store.saveHouse({ rollInCamera: null })
      }
    }
    updateCounter()
    return spec
  }

  const api: CameraApi = {
    spec: () => spec,
    build: () => build,
    setBuild,
    settings,
    set(s) {
      Object.assign(settings, s)
      settings.focusM = clampFocus(build, settings.focusM)
      refreshUI()
    },
    get handheld() {
      return handheld
    },
    setHandheld,
    get finderOn() {
      return finderOn
    },
    finder,
    placeTripod(pos, yawDeg, pitchDeg, height) {
      tripodState.pos.set(pos[0], 0, pos[1])
      tripodState.yaw = yawDeg * D2R
      tripodState.pitch = pitchDeg * D2R
      if (height !== undefined) tripodState.height = THREE.MathUtils.clamp(height, 0.3, 1.7)
      handheld = false
      setHandheld(false)
      layoutTripod()
      saveTripod()
    },
    aim(target) {
      basePose(finderCam)
      const p = finderCam.position
      const d = new THREE.Vector3(target[0] - p.x, target[1] - p.y, target[2] - p.z)
      const yaw = Math.atan2(d.x, d.z)
      const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z))
      if (handheld) {
        handAim.yaw = yaw
        handAim.pitch = pitch
      } else {
        tripodState.yaw = yaw
        tripodState.pitch = pitch
        layoutTripod()
        // re-aim from the updated head height
        basePose(finderCam)
      }
    },
    async shoot(o = {}) {
      const t = o.bulbSeconds ?? (settings.t === 0 ? 1 : actualTime(build.shutter, settings.t))
      const rec = await doCapture(t, { live: t > 1 / 8, cable: true })
      if (rec && !o.noWind) {
        /* the test API winds explicitly */
      }
      return rec
    },
    wind,
    unload,
    loadFilm,
    roll,
    framesLeft,
    get busy() {
      return busy
    },
    tripod,
    photo,
    get lastRecord() {
      return lastRecord
    },
    onShot: null,
  }
  hud.cameraButton.hidden = true
  updateCounter()
  return api
}

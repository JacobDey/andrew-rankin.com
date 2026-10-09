import * as THREE from 'three'
import {
  AnchorTracker,
  OneBitPass,
  PALETTES,
  LUMA,
  thresholdMapTimings,
  type DebugView,
  type DitherMode,
  type PaletteName,
  type PatternName,
} from './core/index.ts'
import { captureFrame, legibility, projectRect, swimMismatch } from './core/analysis.ts'
import { buildCabin } from './demo/cabin.ts'
import { coverCanvas, makePhotoCanvas } from './demo/photo.ts'
import { LookRig, STATIONS } from './demo/look.ts'

// ------------------------------------------------------------------ setup
const canvas = document.getElementById('c') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
const coarse = matchMedia('(pointer: coarse)').matches
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.info.autoReset = false

const pass = new OneBitPass(renderer, {
  palette: 'bone',
  pixelScale: 'auto',
  targetLongSide: 640,
  ditherMode: 'sphere',
  pattern: 'bluenoise',
  outline: { enabled: true, color: 'auto' },
  tone: { exposure: 1.6, whitePoint: 6, gamma: 1.4, contrast: 1.5 },
})

function invertCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const g = c.getContext('2d')!
  g.filter = 'invert(1)'
  g.drawImage(src, 0, 0)
  g.filter = 'none'
  return c
}
function canvasTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

let photoTex = canvasTex(makePhotoCanvas())
let negTex = canvasTex(invertCanvas(photoTex.image as HTMLCanvasElement))
const cabin = buildCabin(photoTex, negTex, pass.surface)
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 30)
const rig = new LookRig(camera, canvas)
// Sphere centre policy: 'point' = AnchorTracker (glued under rotation + translation,
// re-anchors with a dissolve every 30 cm / 30 deg); 'camera' = classic, rotation only.
const trackers = { point: new AnchorTracker(), camera: new AnchorTracker({ positional: false, maxAngleDeg: 40 }) }
let anchorPolicy: keyof typeof trackers = 'point'
const tracker = () => trackers[anchorPolicy]
const held = new Set<string>()

const baseLight = cabin.lantern.light.intensity
let flickerAmp = 0.06
let flickerHz = 0
const sim = { t: 0, frozen: false, develop: 0, developing: false, developTarget: 1, lastFrameMs: 0, emaMs: 16 }

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, true)
  pass.syncSize()
  camera.aspect = pass.aspect
  rig.aspect = pass.aspect
  rig.apply()
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

// ------------------------------------------------------------------ quality
type Quality = 'high' | 'mid' | 'low'
let quality: Quality = coarse ? 'mid' : 'high'
/** Re-render shadow maps every N frames (statics never move; only the lantern does). */
let shadowEvery = 1
let frameNo = 0
function setQuality(q: Quality) {
  quality = q
  if (q === 'high') { cabin.setShadows(true, 1024); cabin.moon.castShadow = true; shadowEvery = 1; pass.setPixelScale(currentScale, 640) }
  if (q === 'mid') { cabin.setShadows(true, 256); cabin.moon.castShadow = false; shadowEvery = 2; pass.setPixelScale(currentScale, 640) }
  if (q === 'low') { cabin.setShadows(false); shadowEvery = 1; pass.setPixelScale(currentScale, 480) }
  resize()
  markSeg('quality', q)
}
let currentScale: number | 'auto' = 'auto'

// ------------------------------------------------------------------ simulation
/** 1/f-ish flame flicker from a few incommensurate sines (deterministic in t). */
function flicker(t: number): number {
  return (
    0.5 * Math.sin(t * 4.4 + 1.3) +
    0.27 * Math.sin(t * 11.9 + 0.2) +
    0.15 * Math.sin(t * 27.3 + 2.1) +
    0.08 * Math.sin(t * 57.1 + 4.0)
  ) / 1.0
}

function simulate(dt: number) {
  if (!sim.frozen) sim.t += dt
  rig.update(dt)
  const s = cabin.lantern.swing
  if (!sim.frozen) {
    // 2D pendulum (chain ~0.33 m) with light damping.
    const w2 = 9.81 / 0.33
    s.vx += (-w2 * Math.sin(s.ax) - 0.35 * s.vx) * dt
    s.vz += (-w2 * Math.sin(s.az) - 0.35 * s.vz) * dt
    s.ax += s.vx * dt
    s.az += s.vz * dt
    cabin.lantern.pivot.rotation.set(s.ax, 0, s.az)
    const ft = flickerHz > 0 ? Math.floor(sim.t * flickerHz) / flickerHz : sim.t
    cabin.lantern.light.intensity = baseLight * (1 + flickerAmp * flicker(ft))
    cabin.dryingLine.rotation.x = 0.04 * Math.sin(sim.t * 0.9) + s.ax * 0.3
    if (sim.developing) {
      sim.develop = Math.min(sim.developTarget, sim.develop + dt / 8)
      if (sim.develop >= sim.developTarget) sim.developing = false
      setDevelop(sim.develop, false)
    }
  }
  // Free walk (WASD / arrows with shift).
  const f = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0)
  const st = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0)
  if (f || st) rig.walk(f * 1.1 * dt, st * 1.1 * dt)
  tracker().update(pass, camera)
}

function setDevelop(p: number, stop = true) {
  sim.develop = p
  if (stop) sim.developing = false
  cabin.printMaterial.develop = p
  devSlider.value = String(p)
}

function storm() {
  const s = cabin.lantern.swing
  s.vx += 2.6
  s.vz += -1.1
  rig.kick(0.35)
}

function draw() {
  renderer.info.reset()
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = frameNo++ % shadowEvery === 0
  pass.render(cabin.scene, camera)
}

// ------------------------------------------------------------------ loop
let last = performance.now()
function frame(now: number) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  // Frozen = test mode: only __spike.step() renders, so the harness never races the loop.
  if (sim.frozen) { requestAnimationFrame(frame); return }
  const t0 = performance.now()
  simulate(dt)
  draw()
  sim.lastFrameMs = performance.now() - t0
  if (!document.body.dataset.ready) document.body.dataset.ready = '1'
  sim.emaMs += (sim.lastFrameMs - sim.emaMs) * 0.05
  updateHud()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// ------------------------------------------------------------------ UI
const hud = document.getElementById('hud')!
const out = document.getElementById('out')!
const panel = document.getElementById('panel')!
const toggle = document.getElementById('toggle')!
const devSlider = document.getElementById('devslider') as HTMLInputElement
const paletteSel = document.getElementById('palette') as HTMLSelectElement
let hudTick = 0
function updateHud() {
  if (++hudTick % 15) return
  const tone = pass.getTone()
  hud.textContent =
    `${pass.width}×${pass.height} @${pass.scale}× · ${pass.ditherMode}/${pass.getPattern()} · ` +
    `cpu ${sim.emaMs.toFixed(1)} ms · ${renderer.info.render.calls} calls · ${STATIONS[rig.station].name}` +
    (tone.luma !== LUMA.rec709 ? ' · blue-sens.' : '') +
    (pass.hdr ? '' : ' · LDR')
}

toggle.addEventListener('click', () => {
  panel.hidden = !panel.hidden
  toggle.setAttribute('aria-expanded', String(!panel.hidden))
})
const params = new URLSearchParams(location.search)
if (params.has('clean')) document.body.classList.add('clean')
else if (!coarse && window.innerWidth > 900) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true') }

for (const name of Object.keys(PALETTES) as PaletteName[]) {
  const o = document.createElement('option')
  o.value = name
  o.textContent = name
  paletteSel.append(o)
}
paletteSel.value = 'bone'
paletteSel.addEventListener('change', () => pass.setPalette(paletteSel.value as PaletteName, 3))

function markSeg(key: string, v: string) {
  document.querySelectorAll<HTMLElement>(`.seg[data-key="${key}"] button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v))
}
function setGrain(v: 'surface' | 'global') {
  const g = cabin.printMaterial.grain
  if (g) g.uSdMaxFoot.value = v === 'surface' ? 1.0 : 0.0
  markSeg('grain', v)
}
const handlers: Record<string, (v: string) => void> = {
  mode: (v) => pass.setDitherMode(v as DitherMode),
  pattern: (v) => pass.setPattern(v as PatternName),
  scale: (v) => { currentScale = v === 'auto' ? 'auto' : Number(v); pass.setPixelScale(currentScale); resize() },
  outline: (v) => pass.setOutline(v === 'off' ? { enabled: false } : { enabled: true, color: v as 'auto' | 'ink' }),
  grain: (v) => setGrain(v as 'surface' | 'global'),
  luma: (v) => pass.setTone({ luma: LUMA[v as keyof typeof LUMA] }),
  view: (v) => { pass.debugView = v as DebugView },
  quality: (v) => setQuality(v as Quality),
  seams: (v) => pass.setOutline({ ids: v === 'on' }),
  centre: (v) => { anchorPolicy = v as keyof typeof trackers; tracker().snap(pass, camera) },
}
document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b || !b.dataset.v) return
    const key = seg.dataset.key!
    handlers[key]?.(b.dataset.v)
    markSeg(key, b.dataset.v)
  })
})
document.querySelectorAll<HTMLButtonElement>('.stations button').forEach((b) =>
  b.addEventListener('click', () => goStation(Number(b.dataset.station))),
)
function goStation(i: number, instant = false) {
  rig.setStation(i, instant)
  if (instant) tracker().snap(pass, camera)   // a cut: no dissolve from the old anchor
  document.querySelectorAll<HTMLButtonElement>('.stations button').forEach((b) => b.classList.toggle('on', Number(b.dataset.station) === rig.station))
}
;(document.getElementById('exposure') as HTMLInputElement).addEventListener('input', (e) => pass.setTone({ exposure: Number((e.target as HTMLInputElement).value) }))
;(document.getElementById('contrast') as HTMLInputElement).addEventListener('input', (e) => pass.setTone({ contrast: Number((e.target as HTMLInputElement).value) }))
;(document.getElementById('gamma') as HTMLInputElement).addEventListener('input', (e) => pass.setTone({ gamma: Number((e.target as HTMLInputElement).value) }))
document.getElementById('develop')!.addEventListener('click', () => {
  if (sim.developing) { sim.developing = false; return }
  if (sim.develop >= 0.999) { setDevelop(0); sim.developTarget = 1 } else sim.developTarget = sim.develop < 1 ? 1 : 2
  sim.developing = true
})
devSlider.addEventListener('input', () => setDevelop(Number(devSlider.value)))
document.getElementById('storm')!.addEventListener('click', storm)
document.getElementById('swim')!.addEventListener('click', () => {
  const r = swimTest({ kind: 'rotate', px: 3 })
  const t = swimTest({ kind: 'translate', dist: 0.01 })
  out.textContent =
    'Swim (bits that changed on the same surface point; 0 = glued to world)\n' +
    Object.entries(r).map(([m, v]) => `rotate 3px   ${m.padEnd(7)} ${(v.mismatch * 100).toFixed(1)}%  (n=${v.valid})`).join('\n') + '\n' +
    Object.entries(t).map(([m, v]) => `dolly 1cm    ${m.padEnd(7)} ${(v.mismatch * 100).toFixed(1)}%  (n=${v.valid})`).join('\n')
})

async function importImage(file: File) {
  const bmp = await createImageBitmap(file)
  const c = coverCanvas(bmp, 640, 480)
  photoTex.dispose()
  negTex.dispose()
  photoTex = canvasTex(c)
  negTex = canvasTex(invertCanvas(c))
  cabin.setPhoto(photoTex, negTex)
  setDevelop(0)
  sim.developTarget = 1
  sim.developing = true
}
;(document.getElementById('file') as HTMLInputElement).addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) void importImage(f)
})
canvas.addEventListener('dragover', (e) => e.preventDefault())
canvas.addEventListener('drop', (e) => {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('image/')) void importImage(f)
})

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  if (e.key >= '1' && e.key <= String(STATIONS.length)) goStation(Number(e.key) - 1)
  else if (e.key === 'ArrowLeft') rig.look(THREE.MathUtils.radToDeg(rig.yaw) + 2, THREE.MathUtils.radToDeg(rig.pitch))
  else if (e.key === 'ArrowRight') rig.look(THREE.MathUtils.radToDeg(rig.yaw) - 2, THREE.MathUtils.radToDeg(rig.pitch))
  else if (e.key === 'ArrowUp') rig.look(THREE.MathUtils.radToDeg(rig.yaw), THREE.MathUtils.radToDeg(rig.pitch) + 2)
  else if (e.key === 'ArrowDown') rig.look(THREE.MathUtils.radToDeg(rig.yaw), THREE.MathUtils.radToDeg(rig.pitch) - 2)
  else if (e.key === ' ') { e.preventDefault(); document.getElementById('develop')!.click() }
  else if (e.key === 'q') storm()
  held.add(e.code)
})
window.addEventListener('keyup', (e) => held.delete(e.code))
window.addEventListener('blur', () => held.clear())

setQuality(quality)
setGrain('surface')

// ------------------------------------------------------------------ test hooks
interface SwimOpts { kind?: 'rotate' | 'translate'; px?: number; dist?: number; modes?: DitherMode[]; station?: number; pitchPx?: number }
function swimTest(o: SwimOpts = {}) {
  const kind = o.kind ?? 'rotate'
  const modes = o.modes ?? (['screen', 'sphere', 'world'] as DitherMode[])
  const saved = { mode: pass.ditherMode, frozen: sim.frozen, yaw: rig.yaw, pitch: rig.pitch, station: rig.station }
  sim.frozen = true
  const res: Record<string, { mismatch: number; valid: number }> = {}
  for (const m of modes) {
    pass.setDitherMode(m)
    rig.setStation(o.station ?? saved.station, true)
    rig.look(0, 0)
    tracker().snap(pass, camera)
    draw()
    const A = captureFrame(pass, camera)
    if (kind === 'rotate') {
      const scale = pass.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
      const yaw = Math.atan((o.px ?? 3) / scale)
      const pitch = Math.atan((o.pitchPx ?? 0) / scale)
      rig.look(THREE.MathUtils.radToDeg(yaw), THREE.MathUtils.radToDeg(pitch))
    } else {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(right, o.dist ?? 0.01)
      camera.updateMatrixWorld()
    }
    tracker().update(pass, camera)
    draw()
    const B = captureFrame(pass, camera)
    res[m] = swimMismatch(A, B)
  }
  pass.setDitherMode(saved.mode)
  rig.setStation(saved.station, true)
  rig.look(THREE.MathUtils.radToDeg(saved.yaw), THREE.MathUtils.radToDeg(saved.pitch))
  sim.frozen = saved.frozen
  return res
}

interface WalkOpts { frames?: number; speed?: number; turn?: number; modes?: (DitherMode | 'sphere-camera')[]; station?: number; tol?: number }
/**
 * Continuous motion: walk forward (and optionally turn) for N frames at 60 fps and
 * report the mean consecutive-frame swim per mode. 'sphere' uses the anchor-point
 * tracker; 'sphere-camera' the classic camera-centred sphere.
 */
function walkTest(o: WalkOpts = {}) {
  const frames = o.frames ?? 30
  const step = (o.speed ?? 1.0) / 60
  const turn = THREE.MathUtils.degToRad(o.turn ?? 0) / 60
  const saved = { mode: pass.ditherMode, frozen: sim.frozen, station: rig.station, policy: anchorPolicy }
  sim.frozen = true
  const res: Record<string, { mismatch: number; reanchors: number }> = {}
  for (const m of o.modes ?? (['screen', 'sphere-camera', 'sphere', 'world'] as const)) {
    pass.setDitherMode(m === 'sphere-camera' ? 'sphere' : m)
    anchorPolicy = m === 'sphere-camera' ? 'camera' : 'point'
    rig.setStation(o.station ?? 0, true)
    rig.look(0, 0)
    tracker().snap(pass, camera)
    const before = tracker().count
    draw()
    let prev = captureFrame(pass, camera)
    let sum = 0
    let n = 0
    for (let i = 0; i < frames; i++) {
      rig.yaw += turn
      rig.walk(step, 0)
      tracker().update(pass, camera)
      draw()
      const cur = captureFrame(pass, camera)
      const r = swimMismatch(prev, cur, { tol: o.tol ?? 0.2 })
      if (r.valid > 200) { sum += r.mismatch; n++ }
      prev = cur
    }
    res[m] = { mismatch: n ? sum / n : NaN, reanchors: tracker().count - before }
  }
  anchorPolicy = saved.policy
  pass.setDitherMode(saved.mode)
  rig.setStation(saved.station, true)
  tracker().snap(pass, camera)
  sim.frozen = saved.frozen
  return res
}

/**
 * Static camera, lantern flickering: fraction of pixels whose bit flips between
 * consecutive 60 fps frames ("sparkle"). amp = flicker amplitude (0.06 = ±6%).
 * quantHz > 0 holds the flicker value for 1/quantHz s (a cheaper-looking candle).
 */
function flickerTest(o: { frames?: number; amp?: number; quantHz?: number; station?: number } = {}) {
  const frames = o.frames ?? 30
  const saved = { frozen: sim.frozen, amp: flickerAmp, q: flickerHz, station: rig.station }
  flickerAmp = o.amp ?? 0.06
  flickerHz = o.quantHz ?? 0
  rig.setStation(o.station ?? 0, true)
  tracker().snap(pass, camera)
  sim.frozen = false
  const swing = { ...cabin.lantern.swing }
  Object.assign(cabin.lantern.swing, { ax: 0, az: 0, vx: 0, vz: 0 })
  simulate(1 / 60); draw()
  let prev = pass.readBits().rgba.slice()
  let sum = 0
  for (let i = 0; i < frames; i++) {
    simulate(1 / 60); draw()
    const cur = pass.readBits().rgba
    let d = 0
    for (let j = 0; j < cur.length; j += 4) if ((cur[j] > 127) !== (prev[j] > 127)) d++
    sum += d / (cur.length / 4)
    prev = cur.slice()
  }
  Object.assign(cabin.lantern.swing, swing)
  flickerAmp = saved.amp
  flickerHz = saved.q
  sim.frozen = saved.frozen
  rig.setStation(saved.station, true)
  return { changedPerFrame: sum / frames, amp: o.amp ?? 0.06, quantHz: o.quantHz ?? 0 }
}

interface LegOpts { station?: number; develop?: number; modes?: DitherMode[]; patterns?: PatternName[]; grain?: boolean }
function legibilityTest(o: LegOpts = {}) {
  const saved = { mode: pass.ditherMode, pattern: pass.getPattern(), station: rig.station, frozen: sim.frozen, develop: sim.develop }
  sim.frozen = true
  rig.setStation(o.station ?? 1, true)
  setDevelop(o.develop ?? 1)
  const g = cabin.printMaterial.grain
  const out: Record<string, { r: number; mae: number; pixels: number }> = {}
  const rectOf = () => projectRect(cabin.print, camera, pass.width, pass.height, 3)
  for (const pat of o.patterns ?? (['bluenoise', 'bayer', 'cluster'] as PatternName[])) {
    pass.setPattern(pat)
    for (const m of o.modes ?? (['sphere', 'world', 'screen', 'none'] as DitherMode[])) {
      pass.setDitherMode(m)
      if (g) g.uSdMaxFoot.value = 0
      tracker().snap(pass, camera)
      draw()
      const f = captureFrame(pass, camera)
      out[`${pat}/${m}`] = legibility(f, rectOf(), 2)
    }
    if (g && o.grain !== false) {
      // Surface grain: bits from the grained render, tone from the plain render.
      pass.setDitherMode('sphere')
      g.uSdMaxFoot.value = 0
      draw()
      const plain = captureFrame(pass, camera)
      g.uSdMaxFoot.value = 1
      draw()
      const grained = captureFrame(pass, camera)
      grained.tone = plain.tone
      out[`${pat}/surface-grain`] = legibility(grained, rectOf(), 2)
    }
  }
  pass.setPattern(saved.pattern)
  pass.setDitherMode(saved.mode)
  rig.setStation(saved.station, true)
  setDevelop(saved.develop)
  sim.frozen = saved.frozen
  setGrain(g && g.uSdMaxFoot.value > 0 ? 'surface' : 'surface')
  return out
}

function bench(frames = 30) {
  pass.profile = true
  const acc = { scene: 0, geom: 0, composite: 0, blit: 0, total: 0 }
  const warm = 3
  for (let i = 0; i < frames + warm; i++) {
    simulate(1 / 60)
    draw()
    if (i >= warm) for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += pass.timings[k]
  }
  pass.profile = false
  for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] = +(acc[k] / frames).toFixed(2)
  // Throughput without per-stage stalls: N frames, one sync at the end.
  const px = new Uint8Array(4)
  const gl = renderer.getContext()
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const t0 = performance.now()
  for (let i = 0; i < frames; i++) { simulate(1 / 60); draw() }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const rawMs = +((performance.now() - t0) / frames).toFixed(2)
  // Post chain alone: render the scene once, then time geom+composite+blit only.
  const postOnly = +(timePostOnly(frames)).toFixed(2)
  draw()
  return { ...acc, rawMs, postOnly, internal: `${pass.width}x${pass.height}`, scale: pass.scale, canvas: `${canvas.width}x${canvas.height}`, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality, hdr: pass.hdr }
}

/** Post chain cost with an empty scene (geom + composite + blit, full canvas). */
function timePostOnly(frames: number): number {
  const empty = new THREE.Scene()
  const gl = renderer.getContext()
  const px = new Uint8Array(4)
  pass.render(empty, camera)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  const t0 = performance.now()
  for (let i = 0; i < frames; i++) pass.render(empty, camera)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  return (performance.now() - t0) / frames
}

declare global {
  interface Window { __spike: unknown }
}
const spike = {
  THREE, pass, renderer, camera, cabin, rig, sim,
  freeze(on = true) { sim.frozen = on },
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { simulate(dt); draw() } return spike.state() },
  station(i: number) { goStation(i, true); simulate(0); draw() },
  look(y: number, p: number) { rig.look(y, p); tracker().update(pass, camera); draw() },
  walkTest,
  flickerTest,
  setCentre(v: keyof typeof trackers) { handlers.centre(v); markSeg('centre', v) },
  setDpr(r: number) { renderer.setPixelRatio(r); resize(); draw() },
  set(o: { mode?: DitherMode; pattern?: PatternName; palette?: PaletteName; scale?: number | 'auto'; outline?: 'auto' | 'ink' | 'off'; seams?: 'on' | 'off'; view?: DebugView; luma?: keyof typeof LUMA; grain?: 'surface' | 'global'; quality?: Quality; develop?: number; exposure?: number; gamma?: number; contrast?: number; white?: number }) {
    if (o.mode) { handlers.mode(o.mode); markSeg('mode', o.mode) }
    if (o.pattern) { handlers.pattern(o.pattern); markSeg('pattern', o.pattern) }
    if (o.palette) { pass.setPalette(o.palette); paletteSel.value = o.palette }
    if (o.scale !== undefined) { handlers.scale(String(o.scale)); markSeg('scale', String(o.scale)) }
    if (o.outline) { handlers.outline(o.outline); markSeg('outline', o.outline) }
    if (o.seams) { handlers.seams(o.seams); markSeg('seams', o.seams) }
    if (o.view) { handlers.view(o.view); markSeg('view', o.view) }
    if (o.luma) { handlers.luma(o.luma); markSeg('luma', o.luma) }
    if (o.grain) setGrain(o.grain)
    if (o.quality) setQuality(o.quality)
    if (o.develop !== undefined) setDevelop(o.develop)
    if (o.exposure !== undefined) pass.setTone({ exposure: o.exposure })
    if (o.gamma !== undefined) pass.setTone({ gamma: o.gamma })
    if (o.contrast !== undefined) pass.setTone({ contrast: o.contrast })
    if (o.white !== undefined) pass.setTone({ whitePoint: o.white })
    draw()
  },
  storm,
  develop(p: number) { setDevelop(p); draw() },
  swimTest,
  legibilityTest,
  bench,
  noiseTimings: thresholdMapTimings,
  state() {
    return {
      internal: [pass.width, pass.height], scale: pass.scale, mode: pass.ditherMode, pattern: pass.getPattern(),
      palette: pass.getPalette(), station: STATIONS[rig.station].name, develop: sim.develop, t: sim.t, quality, hdr: pass.hdr,
      calls: renderer.info.render.calls, anchorStretch: +tracker().lastStretch.toFixed(3), reanchors: tracker().count,
    }
  },
}
window.__spike = spike

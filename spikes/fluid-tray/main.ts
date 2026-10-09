/**
 * fluid-tray spike demo: wires FluidTray (core) + TrayView (three.js) to pointer/touch/keyboard, a HUD,
 * debug maps, procedural audio and window.__spike test hooks.
 */
import { FluidTray, type FluidTrayOptions, type TraySnapshot } from './core/fluidTray.ts'
import { TrayView } from './render/trayView.ts'
import { drawTestPrint, latentFromCanvas, latentFromFile } from './demo/testChart.ts'
import { TrayAudio } from './demo/audio.ts'

type Quality = 'high' | 'medium' | 'low'

const QUALITY: Record<Quality, { tray: FluidTrayOptions; dpr: number }> = {
  high: { tray: { nx: 128, advect: true, chemHz: 30, fixedDt: 1 / 120, paper: { resX: 240, resY: 192 } }, dpr: 2 },
  medium: { tray: { nx: 96, advect: true, chemHz: 20, fixedDt: 1 / 120, paper: { resX: 180, resY: 144 } }, dpr: 1.5 },
  low: { tray: { nx: 72, advect: false, chemHz: 20, fixedDt: 1 / 120, paper: { resX: 160, resY: 128 } }, dpr: 1.5 },
}

const DEG = Math.PI / 180
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const stage = $('stage')
const statsEl = $('stats')
const toastEl = $('toast')
const coarse = matchMedia('(pointer: coarse)').matches
let quality: Quality = (new URLSearchParams(location.search).get('q') as Quality) || (coarse ? 'low' : 'high')
if (!QUALITY[quality]) quality = 'high'
;($('sQual') as HTMLSelectElement).value = quality

let tray!: FluidTray
let view!: TrayView
let canvas!: HTMLCanvasElement
let latent: Float32Array | null = null
let latentSource: HTMLCanvasElement | Blob | null = null
let saved: TraySnapshot | null = null
const audio = new TrayAudio()

// perf meters (ms, exponential moving averages)
const perf = { fps: 0, frameMs: 0, simMs: 0, chemMs: 0, chemCalls: 0, renderMs: 0, syncMs: 0 }
let chemAccum = 0

function build(q: Quality, keepLatent = true): void {
  if (view) {
    view.renderer.dispose()
    canvas.remove()
  }
  canvas = document.createElement('canvas')
  stage.appendChild(canvas)
  tray = new FluidTray({ ...QUALITY[q].tray, seed: 7 })
  // time the chemistry separately from the liquid
  const paper = tray.paper
  const step = paper.step.bind(paper)
  paper.step = (dt, f, rng) => {
    const t0 = performance.now()
    step(dt, f, rng)
    chemAccum += performance.now() - t0
    perf.chemCalls++
  }
  view = new TrayView(canvas, tray, { maxDpr: QUALITY[q].dpr })
  if (!keepLatent || !latent || latent.length !== paper.resX * paper.resY) latent = makeLatent(paper.resX, paper.resY)
  paper.setLatent(latent)
  paper.reset()
  tray.fill(520, 'left')
  resize()
  attachInput()
}

function makeLatent(rx: number, ry: number): Float32Array {
  if (latentSource instanceof Blob) {
    // async path re-applies when ready; meanwhile use the chart
    void latentFromFile(latentSource, rx, ry).then((S) => {
      latent = S
      tray.paper.setLatent(S)
    })
  }
  const c = latentSource instanceof HTMLCanvasElement ? latentSource : drawTestPrint(rx * 3, ry * 3)
  latentSource = latentSource ?? c
  return latentFromCanvas(c, rx, ry)
}

function resize(): void {
  const w = stage.clientWidth || window.innerWidth
  const h = stage.clientHeight || window.innerHeight
  view.resize(w, h)
}
window.addEventListener('resize', () => resize())

function toast(msg: string): void {
  toastEl.textContent = msg
  toastEl.classList.add('show')
  clearTimeout((toast as unknown as { t?: number }).t)
  ;(toast as unknown as { t?: number }).t = window.setTimeout(() => toastEl.classList.remove('show'), 2200)
}

// ------------------------------------------------------------------ input

type Mode = 'none' | 'tilt' | 'jug' | 'finger'
let mode: Mode = 'none'
let activeId = -1
let startX = 0
let startY = 0
let lastX = 0
let lastY = 0
let lastT = 0
let fingerMode = false
let rocking = false
let rockT = 0
let tipHeld = false
let pourHeld = false
const keys = new Set<string>()

function ndc(e: { clientX: number; clientY: number }): [number, number] {
  const r = canvas.getBoundingClientRect()
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]
}

/** Drag (px) -> tilt (rad). Linear up to ~8 deg, then a long soft run toward the 34 deg hard limit. */
function dragToTilt(dx: number, dy: number): [number, number] {
  const d = view.screenToTrayDir(dx, dy)
  const len = Math.hypot(d.x, d.y)
  if (len < 1) return [0, 0]
  const m = len / (0.22 * Math.min(canvas.clientWidth, canvas.clientHeight))
  const deg = m < 1 ? 8 * m : 8 + 26 * (1 - Math.exp(-(m - 1) * 1.1))
  return [(d.x / len) * deg * DEG, (d.y / len) * deg * DEG]
}

function attachInput(): void {
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.addEventListener('pointerdown', (e) => {
    audio.start()
    if (activeId !== -1) return
    activeId = e.pointerId
    canvas.setPointerCapture(e.pointerId)
    canvas.classList.add('dragging')
    startX = lastX = e.clientX
    startY = lastY = e.clientY
    lastT = performance.now()
    const [nx, ny] = ndc(e)
    if (view.pickJug(nx, ny)) {
      mode = 'jug'
      const p = view.pickTray(nx, ny) ?? { x: tray.trayW * 0.3, y: tray.trayH * 0.6 }
      tray.setPour(170, clampPour(p.x, 'x'), clampPour(p.y, 'y'))
    } else if (fingerMode || e.button === 2) {
      mode = 'finger'
      const p = view.pickTray(nx, ny)
      if (p) tray.poke(p.x, p.y, 1)
    } else {
      mode = 'tilt'
      rocking = false
      ;($('bRock') as HTMLButtonElement).classList.remove('on')
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return
    const now = performance.now()
    const dt = Math.max(1, now - lastT) / 1000
    const [nx, ny] = ndc(e)
    if (mode === 'tilt') {
      const [ax, ay] = dragToTilt(e.clientX - startX, e.clientY - startY)
      tray.tilt(ax, ay)
    } else if (mode === 'jug') {
      const p = view.pickTray(nx, ny)
      if (p) tray.setPour(170, clampPour(p.x, 'x'), clampPour(p.y, 'y'))
    } else if (mode === 'finger') {
      const p = view.pickTray(nx, ny)
      if (p) {
        const d = view.screenToTrayDir(e.clientX - lastX, e.clientY - lastY)
        const k = 0.0009 / dt
        tray.poke(p.x, p.y, 0.15, clamp(d.x * k, -0.6, 0.6), clamp(d.y * k, -0.6, 0.6))
      }
    }
    lastX = e.clientX
    lastY = e.clientY
    lastT = now
  })
  const end = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return
    activeId = -1
    canvas.classList.remove('dragging')
    if (mode === 'tilt') tray.release()
    if (mode === 'jug') tray.setPour(0, tray.pourState.x, tray.pourState.y)
    mode = 'none'
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
}

function clampPour(v: number, axis: 'x' | 'y'): number {
  const max = axis === 'x' ? tray.trayW : tray.trayH
  return clamp(v, -0.03, max + 0.03)
}
function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

function holdButton(id: string, down: () => void, up: () => void): void {
  const b = $(id)
  b.addEventListener('pointerdown', (e) => {
    audio.start()
    b.setPointerCapture(e.pointerId)
    b.classList.add('on')
    down()
  })
  const off = () => {
    b.classList.remove('on')
    up()
  }
  b.addEventListener('pointerup', off)
  b.addEventListener('pointercancel', off)
}

function spoutTilt(): [number, number] {
  const c = tray.spoutCorner
  const sx = c[1] === '1' ? 1 : -1
  const sy = c[3] === '1' ? 1 : -1
  return [sx * 0.27, sy * 0.27]
}

holdButton('bPour', () => { pourHeld = true; tray.setPour(170, tray.trayW * 0.22, tray.trayH * 0.7) }, () => { pourHeld = false; tray.setPour(0, 0, 0) })
holdButton('bTip', () => { tipHeld = true; rocking = false; $('bRock').classList.remove('on') }, () => { tipHeld = false; tray.release() })
$('bRock').addEventListener('click', () => {
  audio.start()
  rocking = !rocking
  rockT = 0
  $('bRock').classList.toggle('on', rocking)
  if (!rocking) tray.release()
})
$('bNudge').addEventListener('click', () => { audio.start(); tray.jolt(0.35, 0.12) })
$('bFinger').addEventListener('click', () => { fingerMode = !fingerMode; $('bFinger').classList.toggle('on', fingerMode) })
$('bLight').addEventListener('click', () => toggleLight())
$('bSheet').addEventListener('click', () => { tray.resetPaper(); toast('Fresh sheet in the tray.') })
$('bFill').addEventListener('click', () => { tray.fill(520, 'left'); tray.resetPaper(); toast('Tray refilled.') })
$('bSave').addEventListener('click', () => { saved = tray.snapshot(); toast('Saved.') })
$('bLoad').addEventListener('click', () => { if (saved) { tray.restore(saved); toast('Back to the saved moment.') } })
$('bMaps').addEventListener('click', () => { $('maps').classList.toggle('show'); $('bMaps').classList.toggle('on') })
;($('sQual') as HTMLSelectElement).addEventListener('change', (e) => {
  quality = (e.target as HTMLSelectElement).value as Quality
  build(quality)
  toast(`Quality: ${quality}`)
})
;($('fPng') as HTMLInputElement).addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  latentSource = file
  latent = await latentFromFile(file, tray.paper.resX, tray.paper.resY)
  tray.paper.setLatent(latent)
  tray.resetPaper()
  toast('Exposed. Rock the tray.')
})

function toggleLight(): void {
  const room = view.lighting === 'safe'
  view.setLighting(room ? 'room' : 'safe')
  document.body.classList.toggle('room', room)
  $('bLight').classList.toggle('on', room)
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyR') $('bRock').click()
  if (e.code === 'KeyJ') tray.jolt(0.35, 0.1)
  if (e.code === 'KeyL') toggleLight()
  if (e.code === 'KeyM') $('bMaps').click()
  if (e.code === 'KeyF') $('bFinger').click()
  if (e.code === 'KeyP') tray.setPour(170, tray.trayW * 0.22, tray.trayH * 0.7)
  if (e.code === 'KeyD') tipHeld = true
  if (e.code === 'Space') tray.release()
  audio.start()
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.code)
  if (e.code === 'KeyP') tray.setPour(0, 0, 0)
  if (e.code === 'KeyD') { tipHeld = false; tray.release() }
  if (e.code.startsWith('Arrow') && ![...keys].some((k) => k.startsWith('Arrow'))) tray.release()
})

function driveControls(dt: number): void {
  if (tipHeld) {
    const [x, y] = spoutTilt()
    tray.tilt(x, y)
  } else if (rocking && mode !== 'tilt') {
    rockT += dt
    // lift each corner in turn: a slow rotating tilt, the classic darkroom rock. 0.25 Hz stays under both
    // slosh resonances of half a litre in this tray (~0.32 Hz along, ~0.43 Hz across), so it doesn't slop.
    const w = 2 * Math.PI * 0.25
    tray.tilt(4 * DEG * Math.cos(w * rockT), 3 * DEG * Math.sin(w * rockT))
  } else if (mode !== 'tilt') {
    let kx = 0
    let ky = 0
    if (keys.has('ArrowRight')) kx += 1
    if (keys.has('ArrowLeft')) kx -= 1
    if (keys.has('ArrowUp')) ky += 1
    if (keys.has('ArrowDown')) ky -= 1
    if (kx || ky) {
      const d = view.screenToTrayDir(kx, -ky)
      const len = Math.hypot(d.x, d.y) || 1
      tray.tilt((d.x / len) * 7 * DEG, (d.y / len) * 7 * DEG)
    }
  }
  if (pourHeld && tray.pourState.rate === 0) tray.setPour(170, tray.trayW * 0.22, tray.trayH * 0.7)
}

// ------------------------------------------------------------------ maps

const mapCtx = (id: string, w: number, h: number) => {
  const c = $(id) as HTMLCanvasElement
  c.width = w
  c.height = h
  return c.getContext('2d')!
}
let mapTick = 0
function drawMaps(): void {
  if (!$('maps').classList.contains('show')) return
  const p = tray.paper
  const f = tray.fluid
  const cov = mapCtx('mapCov', p.resX, p.resY)
  const dev = mapCtx('mapDev', p.resX, p.resY)
  const fr = mapCtx('mapFresh', f.nx, f.ny)
  const a = cov.createImageData(p.resX, p.resY)
  const b = dev.createImageData(p.resX, p.resY)
  // flip rows so the map reads like the view (front edge at the bottom)
  for (let j = 0; j < p.resY; j++)
    for (let i = 0; i < p.resX; i++) {
      const t = j * p.resX + i
      const q = ((p.resY - 1 - j) * p.resX + i) * 4
      const c = p.cov[t]
      a.data[q] = 30 + 60 * c
      a.data[q + 1] = 40 + 150 * c
      a.data[q + 2] = 50 + 205 * c
      a.data[q + 3] = 255
      const v = 255 * Math.pow(10, -2 * p.D[t])
      b.data[q] = v
      b.data[q + 1] = v * 0.97
      b.data[q + 2] = v * 0.92
      b.data[q + 3] = 255
    }
  cov.putImageData(a, 0, 0)
  dev.putImageData(b, 0, 0)
  const c2 = fr.createImageData(f.nx, f.ny)
  for (let j = 0; j < f.ny; j++)
    for (let i = 0; i < f.nx; i++) {
      const t = j * f.nx + i
      const q = ((f.ny - 1 - j) * f.nx + i) * 4
      const wet = f.h[t] > 2e-4 ? 1 : 0.25
      const s = f.s[t]
      c2.data[q] = (60 + 190 * s) * wet
      c2.data[q + 1] = (40 + 150 * s) * wet
      c2.data[q + 2] = (20 + 60 * s) * wet
      c2.data[q + 3] = 255
    }
  fr.putImageData(c2, 0, 0)
}

// ------------------------------------------------------------------ loop

let paused = false
let last = performance.now()
const ema = (a: number, b: number, k = 0.08) => (a === 0 ? b : a + (b - a) * k)

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (!paused) {
    driveControls(dt)
    chemAccum = 0
    const t0 = performance.now()
    tray.update(dt)
    const t1 = performance.now()
    perf.simMs = ema(perf.simMs, t1 - t0 - chemAccum)
    perf.chemMs = ema(perf.chemMs, chemAccum)
    audio.update(tray, dt)
  }
  const t2 = performance.now()
  view.sync(dt)
  const t3 = performance.now()
  view.render()
  const t4 = performance.now()
  perf.syncMs = ema(perf.syncMs, t3 - t2)
  perf.renderMs = ema(perf.renderMs, t4 - t3)
  perf.frameMs = ema(perf.frameMs, dt * 1000)
  perf.fps = perf.frameMs > 0 ? 1000 / perf.frameMs : 0
  if (mapTick === 1) document.body.dataset.ready = '1' // first frame is on screen (screenshot harness waits for this)
  if (++mapTick % 10 === 0) {
    drawMaps()
    drawStats()
  }
  requestAnimationFrame(frame)
}

function drawStats(): void {
  const s = tray.stats()
  statsEl.textContent =
    `${quality}  ${perf.fps.toFixed(0)} fps\n` +
    `sim ${perf.simMs.toFixed(2)} ms  chem ${perf.chemMs.toFixed(2)} ms\n` +
    `upload ${perf.syncMs.toFixed(2)} ms  draw ${perf.renderMs.toFixed(2)} ms\n` +
    `grid ${tray.fluid.nx}x${tray.fluid.ny}  steps ${tray.lastSteps}x${s.substeps}\n` +
    `liquid ${s.volumeML.toFixed(0)} mL  max ${s.maxDepthMM.toFixed(1)} mm\n` +
    `poured ${s.pouredML.toFixed(0)}  out ${s.drainedML.toFixed(0)}  spilt ${s.spilledML.toFixed(0)}\n` +
    `on paper ${(s.coverage * 100).toFixed(0)}%  dev ${(s.density * 100).toFixed(1)}%\n` +
    `fresh ${(s.freshness * 100).toFixed(0)}%  bubbles ${s.bubbles}  drops ${s.droplets}\n` +
    `tilt ${s.tiltDeg[0].toFixed(1)}, ${s.tiltDeg[1].toFixed(1)} deg  t ${s.time.toFixed(1)} s`
}

// ------------------------------------------------------------------ test hooks

function state() {
  return { ...tray.stats(), quality, fps: perf.fps, simMs: perf.simMs, chemMs: perf.chemMs, renderMs: perf.renderMs, syncMs: perf.syncMs }
}

/** Mean of a paper map in a 3x3 grid of regions (row 0 = front). */
function regions(map: Float32Array): number[][] {
  const p = tray.paper
  const out = [0, 1, 2].map(() => [0, 0, 0])
  const cnt = [0, 1, 2].map(() => [0, 0, 0])
  for (let j = 0; j < p.resY; j++)
    for (let i = 0; i < p.resX; i++) {
      const r = Math.min(2, Math.floor((j / p.resY) * 3))
      const c = Math.min(2, Math.floor((i / p.resX) * 3))
      out[r][c] += map[j * p.resX + i]
      cnt[r][c]++
    }
  return out.map((row, r) => row.map((v, c) => +(v / cnt[r][c]).toFixed(3)))
}

const spike = {
  get tray() { return tray },
  get view() { return view },
  ready: true,
  /** Advance N frames of dt (default 1/60) deterministically, then render once. */
  step(frames = 1, dt = 1 / 60) {
    for (let k = 0; k < frames; k++) {
      driveControls(dt)
      tray.update(dt)
    }
    view.sync(dt)
    view.render()
    return state()
  },
  /** Advance `seconds` exactly (no per-update cap), then render. */
  advance(seconds: number) {
    tray.advance(seconds)
    view.sync(1 / 60)
    view.render()
    return state()
  },
  state,
  pause(on = true) { paused = on },
  tilt(xDeg: number, yDeg: number) { tray.tilt(xDeg * DEG, yDeg * DEG) },
  release() { tray.release() },
  pour(ml: number, x?: number, y?: number) { tray.pour(ml, { x, y }) },
  setPour(rate: number, x: number, y: number) { tray.setPour(rate, x, y) },
  rock(on = true) { rocking = on; rockT = 0 },
  tip(on = true) { tipHeld = on; if (!on) tray.release() },
  jolt(vx = 0.35, vy = 0.1) { tray.jolt(vx, vy) },
  poke(x: number, y: number, s = 1) { tray.poke(x, y, s) },
  light(mode: 'safe' | 'room') { view.setLighting(mode); document.body.classList.toggle('room', mode === 'room') },
  maps(on = true) { $('maps').classList.toggle('show', on); drawMaps() },
  quality(q: Quality) { quality = q; build(q) },
  fill(ml: number, layout: 'flat' | 'left' = 'flat') { tray.fill(ml, layout) },
  newSheet() { tray.resetPaper() },
  snapshot() { return tray.snapshot() },
  restore(s: TraySnapshot) { tray.restore(s) },
  coverage() { return regions(tray.coverageMap) },
  development() { return regions(tray.developmentMap) },
  gravityCheck() {
    view.sync(0)
    const g = tray.rig.gravity()
    return { core: [g.gx, g.gy, -g.gz].map((v) => +v.toFixed(4)), rendered: view.renderedGravity().map((v) => +v.toFixed(4)) }
  },
  /** CPU timing: n frames of update(1/60) (liquid + chemistry), plus sync+render cost. */
  bench(n = 120) {
    const was = paused
    paused = true
    chemAccum = 0
    perf.chemCalls = 0
    const t0 = performance.now()
    for (let k = 0; k < n; k++) tray.update(1 / 60)
    const t1 = performance.now()
    const chem = chemAccum
    const calls = perf.chemCalls
    const t2 = performance.now()
    const m = Math.max(3, Math.round(n / 20))
    for (let k = 0; k < m; k++) view.sync(1 / 60)
    const t3 = performance.now()
    for (let k = 0; k < m; k++) view.render()
    view.renderer.getContext().finish()
    const t4 = performance.now()
    paused = was
    return {
      quality,
      framesSimulated: n,
      liquidMsPerFrame: +((t1 - t0 - chem) / n).toFixed(3),
      chemMsPerCall: +(chem / Math.max(1, calls)).toFixed(3),
      chemMsPerFrame: +(chem / n).toFixed(3),
      syncMsPerFrame: +((t3 - t2) / m).toFixed(3),
      renderMsPerFrame_incl_finish: +((t4 - t3) / m).toFixed(2),
    }
  },
}
;(window as unknown as { __spike: typeof spike }).__spike = spike

// ------------------------------------------------------------------ scripted scenes (?scene=...)
// Deterministic setups for screenshots: the page simulates the sequence synchronously at load, then
// holds (paused) unless &run=1. One page load per picture survives dev-server reloads.

function runFrames(n: number, each?: (k: number) => void): void {
  for (let k = 0; k < n; k++) {
    each?.(k)
    driveControls(1 / 60)
    tray.update(1 / 60)
  }
}

function runScene(name: string): void {
  const flat = (ml: number) => { tray.fill(ml, 'flat'); tray.resetPaper() }
  switch (name) {
    case 'tilt': flat(520); runFrames(30); tray.tilt(6 * DEG, 3 * DEG); runFrames(75); break
    case 'bloom': rocking = true; runFrames(14 * 60); rocking = false; break
    case 'rock30': flat(520); rocking = true; runFrames(30 * 60); rocking = false; tray.release(); runFrames(20); break
    case 'still30': flat(520); runFrames(30 * 60); break
    case 'half': flat(260); rocking = true; runFrames(20 * 60); rocking = false; tray.release(); runFrames(12); break
    case 'pour': flat(300); runFrames(90); tray.setPour(170, 0.1, 0.18); runFrames(50); break
    case 'drain': flat(520); runFrames(30); tipHeld = true; runFrames(80); break
    case 'drop': flat(520); tray.tilt(-8 * DEG, 0); runFrames(70); tray.release(); runFrames(16); break
    case 'room': rocking = true; runFrames(14 * 60); rocking = false; view.setLighting('room'); document.body.classList.add('room'); break
    case 'bubbles': flat(0); tray.setPour(220, 0.17, 0.13); runFrames(70); tray.setPour(0, 0, 0); runFrames(20); break
  }
  if (new URLSearchParams(location.search).get('maps')) spike.maps(true)
}

build(quality, false)
{
  const qs = new URLSearchParams(location.search)
  const scene = qs.get('scene')
  if (scene) {
    runScene(scene)
    paused = qs.get('run') !== '1'
  }
}
requestAnimationFrame((t) => {
  last = t
  frame(t)
})

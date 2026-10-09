// Demo page for the materials spike: a gallery of every recipe (raking-light
// macro tile + a small 3D sphere), and an inspector with live lamp, tilt,
// channel views, region re-bakes when you rack in, and the guess matcher.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  CATALOG, RECIPES, FAMILY_LABEL, HABITAT_LABEL, getGenerator, getMaterialInfo, createMacroViewMaterial,
  applyMapsToStandardMaterial, matchGuess, resolveGuess, lintCatalog,
} from './core/index'
import type { MaterialMaps, ViewMode, MaterialInfo, Region } from './core/index'
import { installSpikeHooks } from './spike-hooks'

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const params = new URLSearchParams(location.search)
const coarse = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600
const pow2 = (n: number) => 2 ** Math.round(Math.log2(Math.max(64, Math.min(4096, n))))
const THUMB = pow2(Number(params.get('thumb') ?? (coarse ? 256 : 512)))
const BAKE_SIZES = coarse ? [256, 512, 1024] : [512, 1024, 2048]
let bakeSize = Number(params.get('bake') ?? (coarse ? 512 : 1024))
const only = params.get('only')?.split(',').filter(Boolean)
if (params.get('big')) document.body.classList.add('big')
const list: MaterialInfo[] = CATALOG.filter((m) => RECIPES[m.id] && (!only || only.includes(m.id)))

// ------------------------------------------------------------------ renderer
const canvas = $<HTMLCanvasElement>('#stage')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(1) // we size the drawing buffer ourselves (device pixels)
renderer.toneMapping = THREE.NeutralToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setClearColor(0x050506, 1)
const gen = getGenerator(renderer)

function ensureBuffer(w: number, h: number) {
  if (canvas.width !== w || canvas.height !== h) renderer.setSize(w, h, false)
}
ensureBuffer(Math.max(THUMB, 512), Math.max(THUMB, 512))

// macro view: a full-screen quad with the macro material
const macroScene = new THREE.Scene()
const macroCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const macroMat = createMacroViewMaterial(null, { shadowSteps: coarse ? 12 : 24 })
macroScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), macroMat))

// 3D preview sphere
const sphereScene = new THREE.Scene()
const pmrem = new THREE.PMREMGenerator(renderer)
sphereScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
sphereScene.environmentIntensity = 0.55
const sphereCam = new THREE.PerspectiveCamera(28, 1, 0.1, 20)
sphereCam.position.set(0, 0, 4.4)
const sphereMat = new THREE.MeshStandardMaterial()
const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), sphereMat)
sphere.rotation.set(0.35, -0.6, 0)
const key = new THREE.DirectionalLight(0xfff1e4, 2.6)
key.position.set(-2.2, 1.6, 1.4)
sphereScene.add(sphere, key)

function renderSphere(x: number, y: number, s: number, maps: MaterialMaps) {
  applyMapsToStandardMaterial(sphereMat, maps, [4, 2])
  renderer.setViewport(x, y, s, s)
  renderer.setScissor(x, y, s, s)
  renderer.setScissorTest(true)
  renderer.setClearColor(0x141519, 1)
  renderer.clear()
  renderer.render(sphereScene, sphereCam)
  renderer.setScissorTest(false)
  renderer.setClearColor(0x050506, 1)
}

function renderMacro(x: number, y: number, w: number, h: number) {
  renderer.setViewport(x, y, w, h)
  renderer.setScissor(x, y, w, h)
  renderer.setScissorTest(true)
  renderer.render(macroScene, macroCam)
  renderer.setScissorTest(false)
}

// ------------------------------------------------------------------ gallery
const grid = $<HTMLElement>('#grid')
const status = $<HTMLElement>('#status')
$<HTMLElement>('#count').textContent = String(list.length)
let seed = Number(params.get('seed') ?? 1) >>> 0
$<HTMLInputElement>('#seed').value = String(seed)

interface Card { el: HTMLButtonElement; tile: HTMLCanvasElement; sphere: HTMLCanvasElement; ms: HTMLElement; info: MaterialInfo }
const cards = new Map<string, Card>()
for (const info of list) {
  const el = document.createElement('button')
  el.className = 'card pending'
  el.dataset.id = info.id
  el.setAttribute('aria-label', `Open ${info.name}`)
  el.innerHTML = `<canvas class="tile" width="${THUMB}" height="${THUMB}"></canvas>
    <canvas class="sphere" width="${coarse ? 96 : 128}" height="${coarse ? 96 : 128}"></canvas>
    <div class="meta"><span class="name"></span>
    <span class="line"><span class="diff"></span><span class="fam"></span></span>
    <span class="line"><span class="mm"></span><span class="ms"></span></span></div>`
  el.querySelector('.name')!.textContent = info.name
  el.querySelector('.diff')!.textContent = '●'.repeat(info.difficulty) + '○'.repeat(5 - info.difficulty)
  el.querySelector('.fam')!.textContent = FAMILY_LABEL[info.family]
  el.querySelector('.mm')!.textContent = `${info.tileMm} mm field`
  el.addEventListener('click', () => openInspector(info.id))
  grid.appendChild(el)
  cards.set(info.id, { el, info, tile: el.querySelector('.tile')!, sphere: el.querySelector('.sphere')!, ms: el.querySelector('.ms')! })
}

export const galleryTimings: Record<string, { compileMs: number; gpuMs: number; totalMs: number }> = {}
let galleryRun = 0
let galleryDone = false

async function buildGallery() {
  const run = ++galleryRun
  galleryDone = false
  document.body.dataset.ready = '0'
  const t0 = performance.now()
  let i = 0
  for (const info of list) {
    if (run !== galleryRun) return
    const card = cards.get(info.id)!
    status.textContent = `Baking ${++i}/${list.length}: ${info.name.toLowerCase()}`
    // yield so the page stays responsive between bakes
    await new Promise((r) => setTimeout(r, 0))
    if (inspecting) await waitForInspectorClose()
    const maps = await gen.generate(info.id, { size: THUMB, seed, readback: true })
    ensureBuffer(Math.max(canvas.width, THUMB), Math.max(canvas.height, THUMB))
    macroMat.setMaps(maps)
    macroMat.setWindow(0, 0, 1)
    macroMat.setTilt(0, 0)
    macroMat.setLight(135, 20)
    macroMat.setMode('lit')
    macroMat.uniforms.uRing.value = 0
    renderMacro(0, 0, THUMB, THUMB)
    card.tile.getContext('2d')!.drawImage(canvas, 0, canvas.height - THUMB, THUMB, THUMB, 0, 0, THUMB, THUMB)
    const S = card.sphere.width
    renderSphere(0, 0, S, maps)
    card.sphere.getContext('2d')!.drawImage(canvas, 0, canvas.height - S, S, S, 0, 0, S, S)
    maps.dispose()
    card.el.classList.remove('pending')
    card.ms.textContent = `${maps.timings.totalMs.toFixed(0)} ms`
    galleryTimings[info.id] = { compileMs: maps.timings.compileMs, gpuMs: maps.timings.gpuMs, totalMs: maps.timings.totalMs }
  }
  const dt = (performance.now() - t0) / 1000
  status.textContent = `${list.length} surfaces in ${dt.toFixed(1)} s`
  galleryDone = true
  document.body.dataset.ready = '1'
}

$<HTMLInputElement>('#seed').addEventListener('change', (e) => {
  seed = Number((e.target as HTMLInputElement).value) >>> 0
  for (const c of cards.values()) c.el.classList.add('pending')
  void buildGallery()
})
$<HTMLInputElement>('#filter').addEventListener('input', (e) => {
  const q = (e.target as HTMLInputElement).value.trim().toLowerCase()
  const hits = q ? new Set(resolveGuess(q, list, 0.5).map((c) => c.id)) : null
  for (const c of cards.values()) {
    const text = (c.info.name + ' ' + c.info.aliases.join(' ')).toLowerCase()
    c.el.classList.toggle('hidden', !!hits && !hits.has(c.info.id) && !text.includes(q))
  }
})

// ------------------------------------------------------------------ inspector
const inspector = $<HTMLElement>('#inspector')
let inspecting: string | null = null
let closeWaiters: (() => void)[] = []
const waitForInspectorClose = () => new Promise<void>((r) => closeWaiters.push(r))

interface View { az: number; el: number; tu: number; tv: number; mode: ViewMode; ring: boolean; zoom: number; cu: number; cv: number }
const view: View = { az: 135, el: 20, tu: 0, tv: 0, mode: 'lit', ring: false, zoom: 1, cu: 0.5, cv: 0.5 }
let baseMaps: MaterialMaps | null = null
let zoomMaps: MaterialMaps | null = null
let bakeToken = 0
let dirty = true
let spin = 0

const MODES: [ViewMode, string][] = [['lit', 'Lit'], ['albedo', 'Albedo'], ['height', 'Height'], ['normal', 'Normal'], ['roughness', 'Rough'], ['ao', 'AO'], ['metalness', 'Metal'], ['curvature', 'Curv'], ['loose', 'Loose']]
const modesEl = $<HTMLElement>('#modes')
for (const [m, label] of MODES) {
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = label
  b.dataset.mode = m
  b.addEventListener('click', () => setMode(m))
  modesEl.appendChild(b)
}
function setMode(m: ViewMode) {
  view.mode = m
  for (const b of modesEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m))
  dirty = true
}
const sizesEl = $<HTMLElement>('#sizes')
for (const s of BAKE_SIZES) {
  const b = document.createElement('button')
  b.textContent = String(s)
  b.dataset.size = String(s)
  b.addEventListener('click', () => { bakeSize = s; markSizes(); if (inspecting) void bakeBase(inspecting) })
  sizesEl.appendChild(b)
}
function markSizes() { for (const b of sizesEl.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.size) === bakeSize)) }
markSizes()

const bindRange = (sel: string, key: 'az' | 'el' | 'tu' | 'tv') => {
  const input = $<HTMLInputElement>(sel)
  input.addEventListener('input', () => { view[key] = Number(input.value); dirty = true })
  return input
}
const azIn = bindRange('#az', 'az'), elIn = bindRange('#el', 'el'), tuIn = bindRange('#tu', 'tu'), tvIn = bindRange('#tv', 'tv')
const ringBtn = $<HTMLButtonElement>('#ring')
ringBtn.addEventListener('click', () => setRing(!view.ring))
function setRing(on: boolean) { view.ring = on; ringBtn.setAttribute('aria-pressed', String(on)); dirty = true }
function syncInputs() { azIn.value = String(view.az); elIn.value = String(view.el); tuIn.value = String(view.tu); tvIn.value = String(view.tv) }

function fillPanel(info: MaterialInfo) {
  $<HTMLElement>('#i-kicker').textContent = `${FAMILY_LABEL[info.family]} · ${HABITAT_LABEL[info.habitat]} · difficulty ${info.difficulty}/5`
  $<HTMLElement>('#i-name').textContent = info.name
  $<HTMLElement>('#i-label').textContent = info.label
  $<HTMLElement>('#i-tiles').innerHTML = ''
  for (const t of [`hardness ${info.hardness}`, `grain ${info.grain}`, `wear ${info.wear}`, `${info.tileMm} mm`, `relief ${info.reliefMm} mm`]) {
    const s = document.createElement('span'); s.textContent = t; $<HTMLElement>('#i-tiles').appendChild(s)
  }
  $<HTMLInputElement>('#guess').value = ''
  $<HTMLElement>('#guess-out').textContent = ''
}
function fillFacts() {
  if (!baseMaps) return
  const m = zoomMaps ?? baseMaps
  const p = m.info.physics
  const rows: [string, string][] = [
    ['bake', `${m.size}² · ${(m.texelMm * 1000).toFixed(1)} µm/px`],
    ['region', `${fmt(m.region.x)}, ${fmt(m.region.y)} · w ${fmt(m.region.w)}`],
    ['compile', `${m.timings.compileMs.toFixed(0)} ms`],
    ['bake time', `${m.timings.gpuMs.toFixed(1)} ms cpu · ${m.timings.totalMs.toFixed(0)} ms total`],
    ['height', m.heightRange ? `${m.heightRange[0].toFixed(3)} … ${m.heightRange[1].toFixed(3)} mm` : '–'],
    ['friction', `μs ${p.muS} · μk ${p.muK}`],
    ['marble', `e ${p.restitution} · c_rr ${p.rolling}`],
    ['residue', p.residue ? `${p.residue} × ${p.residueAmount}` : 'none'],
    ['body', p.body],
    ['aliases', m.info.aliases.slice(0, 6).join(', ')],
  ]
  $<HTMLElement>('#i-facts').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
}
const fmt = (x: number) => (Math.round(x * 1000) / 1000).toString()

async function bakeBase(id: string) {
  const token = ++bakeToken
  const maps = await gen.generate(id, { size: bakeSize, seed, readback: true })
  if (token !== bakeToken || inspecting !== id) { maps.dispose(); return }
  baseMaps?.dispose()
  zoomMaps?.dispose()
  zoomMaps = null
  baseMaps = maps
  fillFacts()
  dirty = true
  scheduleZoomBake()
}

function openInspector(id: string) {
  inspecting = id
  const info = getMaterialInfo(id)
  fillPanel(info)
  Object.assign(view, { zoom: 1, cu: 0.5, cv: 0.5, tu: 0, tv: 0 })
  syncInputs()
  setMode('lit')
  inspector.hidden = false
  history.replaceState(null, '', `?${new URLSearchParams({ ...Object.fromEntries(params), open: id })}`)
  resizeStage()
  void bakeBase(id)
}
function closeInspector() {
  inspecting = null
  inspector.hidden = true
  baseMaps?.dispose(); zoomMaps?.dispose(); baseMaps = zoomMaps = null
  const p = new URLSearchParams(location.search); p.delete('open')
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname)
  const w = closeWaiters; closeWaiters = []; w.forEach((f) => f())
}
$<HTMLButtonElement>('#close').addEventListener('click', closeInspector)

$<HTMLInputElement>('#guess').addEventListener('input', (e) => {
  if (!inspecting) return
  const g = (e.target as HTMLInputElement).value
  const out = $<HTMLElement>('#guess-out')
  if (!g.trim()) { out.textContent = ''; return }
  const r = matchGuess(g, inspecting)
  out.innerHTML = r.correct
    ? `<span class="yes">● Specimen confirmed</span> (matched “${r.matched}”, ${(r.score * 100).toFixed(0)}%)`
    : `<span class="no">○ Not it.</span> ${r.best ? `Reads as ${getMaterialInfo(r.best.id).name.toLowerCase()} (${(r.best.score * 100).toFixed(0)}%)` : 'No match in the drawer.'}`
})

function resizeStage() {
  const r = canvas.getBoundingClientRect()
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 2 : 1.5)
  ensureBuffer(Math.max(THUMB, Math.round(r.width * dpr)), Math.max(THUMB, Math.round(r.height * dpr)))
  dirty = true
}
addEventListener('resize', () => { if (inspecting) resizeStage() })

// -------- zoom window and region re-bakes (dyadic regions => exact on every GPU)
function visibleWindow() {
  const aspect = canvas.width / canvas.height
  const w = view.zoom  // tile-UV width visible across the shorter side
  const sx = aspect >= 1 ? w * aspect : w
  const sy = aspect >= 1 ? w : w / aspect
  return { u0: view.cu - sx / 2, v0: view.cv - sy / 2, sx, sy }
}
let zoomTimer = 0
function scheduleZoomBake() {
  clearTimeout(zoomTimer)
  zoomTimer = window.setTimeout(() => void bakeZoom(), 280)
}
async function bakeZoom() {
  if (!inspecting || !baseMaps) return
  const win = visibleWindow()
  const span = Math.max(win.sx, win.sy)
  if (span >= 0.999) { if (zoomMaps) { zoomMaps.dispose(); zoomMaps = null; dirty = true; fillFacts() } return }
  let w = 2 ** Math.ceil(Math.log2(span))
  const q = w / 8
  let x = Math.floor(win.u0 / q) * q, y = Math.floor(win.v0 / q) * q
  if (x + w < win.u0 + win.sx || y + w < win.v0 + win.sy) w *= 2
  const region: Region = { x, y, w }
  if (zoomMaps && zoomMaps.region.x === x && zoomMaps.region.y === y && zoomMaps.region.w === w && zoomMaps.size === bakeSize) return
  const token = ++bakeToken
  const id = inspecting
  const maps = await gen.generate(id, { size: bakeSize, seed, region, readback: true })
  if (token !== bakeToken || inspecting !== id) { maps.dispose(); return }
  zoomMaps?.dispose()
  zoomMaps = maps
  fillFacts()
  dirty = true
}

// -------- input: drag = lamp, right-drag / two fingers = tilt, wheel / pinch = rack in
const pointers = new Map<number, { x: number; y: number; button: number; shift: boolean }>()
let pinchDist = 0
canvas.addEventListener('contextmenu', (e) => e.preventDefault())
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey })
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y) }
})
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId)
  if (!p) return
  const dx = e.clientX - p.x, dy = e.clientY - p.y
  p.x = e.clientX; p.y = e.clientY
  const rect = canvas.getBoundingClientRect()
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchDist > 0) zoomAbout((a.x + b.x) / 2, (a.y + b.y) / 2, pinchDist / d)
    pinchDist = d
    view.tu = clamp(view.tu + (dx / rect.width) * 10 / pointers.size, -5, 5)
    view.tv = clamp(view.tv - (dy / rect.height) * 10 / pointers.size, -5, 5)
  } else if (p.button === 2 || p.shift) {
    view.tu = clamp(view.tu + (dx / rect.width) * 20, -5, 5)
    view.tv = clamp(view.tv - (dy / rect.height) * 20, -5, 5)
  } else {
    view.az = (view.az - (dx / rect.width) * 360 + 360) % 360
    view.el = clamp(view.el - (dy / rect.height) * 90, 5, 90)
  }
  syncInputs()
  dirty = true
})
const lift = (e: PointerEvent) => { pointers.delete(e.pointerId); pinchDist = 0 }
canvas.addEventListener('pointerup', lift)
canvas.addEventListener('pointercancel', lift)
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAbout(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)) }, { passive: false })
function zoomAbout(cx: number, cy: number, factor: number) {
  const rect = canvas.getBoundingClientRect()
  const before = visibleWindow()
  const fu = (cx - rect.left) / rect.width, fv = 1 - (cy - rect.top) / rect.height
  const pu = before.u0 + fu * before.sx, pv = before.v0 + fv * before.sy
  view.zoom = clamp(view.zoom * factor, 1 / 32, 3)   // > 1 shows several tiles: a tiling check
  const after = visibleWindow()
  view.cu += pu - (after.u0 + fu * after.sx)
  view.cv += pv - (after.v0 + fv * after.sy)
  if (view.zoom >= 1) { view.cu = 0.5 * view.zoom; view.cv = 0.5 * view.zoom }
  dirty = true
  scheduleZoomBake()
}
addEventListener('keydown', (e) => {
  if (!inspecting || (e.target as HTMLElement).tagName === 'INPUT') return
  const n = Number(e.key)
  if (n >= 1 && n <= MODES.length) setMode(MODES[n - 1][0])
  else if (e.key === 'r' || e.key === 'R') setRing(!view.ring)
  else if (e.key === 'Escape') closeInspector()
  else if (e.key.startsWith('Arrow')) {
    if (e.key === 'ArrowLeft') view.tu = clamp(view.tu - 0.5, -5, 5)
    if (e.key === 'ArrowRight') view.tu = clamp(view.tu + 0.5, -5, 5)
    if (e.key === 'ArrowUp') view.tv = clamp(view.tv + 0.5, -5, 5)
    if (e.key === 'ArrowDown') view.tv = clamp(view.tv - 0.5, -5, 5)
    syncInputs(); dirty = true
  }
})
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

// -------- per-frame
const scaleLabel = $<HTMLElement>('#hud-scale'), resLabel = $<HTMLElement>('#hud-res')
const bar = $<HTMLElement>('#scalebar-bar'), barLabel = $<HTMLElement>('#scalebar-label')
let lastT = performance.now()
export const frameStats = { frames: 0, lastMs: 0 }
function drawInspector() {
  if (!baseMaps) return
  const t0 = performance.now()
  const win = visibleWindow()
  const m = zoomMaps && covers(zoomMaps.region, win) ? zoomMaps : baseMaps
  macroMat.setMaps(m)
  macroMat.setMode(view.mode)
  macroMat.setLight(view.az, view.el)
  macroMat.setTilt(view.tu, view.tv)
  macroMat.uniforms.uRing.value = view.ring ? 1 : 0
  // plane UV 0..1 spans the canvas; map it into the maps' UV window
  const ox = (win.u0 - m.region.x) / m.region.w, oy = (win.v0 - m.region.y) / m.region.w
  ;(macroMat.uniforms.uUvOffset.value as THREE.Vector2).set(ox, oy)
  ;(macroMat.uniforms.uUvScale.value as THREE.Vector2).set(win.sx / m.region.w, win.sy / m.region.w)
  renderMacro(0, 0, canvas.width, canvas.height)
  const s = Math.round(Math.min(canvas.width, canvas.height) * (coarse ? 0.3 : 0.24))
  const lightDir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - THREE.MathUtils.degToRad(view.el), THREE.MathUtils.degToRad(view.az - 90))
  key.position.set(-lightDir.z * 3, lightDir.y * 3 + 0.5, 2)
  renderSphere(canvas.width - s - 12, 12, s, baseMaps)
  frameStats.frames++
  frameStats.lastMs = performance.now() - t0
  // HUD
  const fieldMm = win.sx * m.info.tileMm
  const mag = 36 / fieldMm // on a 36 mm wide full-frame sensor
  scaleLabel.textContent = `${mag >= 1 ? `${mag.toFixed(1)}:1` : `1:${(1 / mag).toFixed(1)}`} · field ${fieldMm.toFixed(fieldMm < 10 ? 2 : 1)} mm`
  resLabel.textContent = `${m.size}px bake · ${(m.texelMm * 1000).toFixed(m.texelMm < 0.01 ? 1 : 0)} µm/px${m === zoomMaps ? ' · region' : ''}`
  const rect = canvas.getBoundingClientRect()
  const mmPerCss = fieldMm / rect.width
  const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].find((v) => v / mmPerCss > 60) ?? 500
  bar.style.width = `${nice / mmPerCss}px`
  barLabel.textContent = nice < 1 ? `${nice * 1000} µm` : nice >= 10 ? `${nice / 10} cm` : `${nice} mm`
}
function covers(r: Region, win: { u0: number; v0: number; sx: number; sy: number }) {
  return r.x <= win.u0 + 1e-9 && r.y <= win.v0 + 1e-9 && r.x + r.w >= win.u0 + win.sx - 1e-9 && r.y + r.w >= win.v0 + win.sy - 1e-9
}
// the sphere turns slowly unless ?spin=0 or reduced motion; otherwise we only draw on change
const spinOn = params.get('spin') !== '0' && !matchMedia('(prefers-reduced-motion: reduce)').matches
function loop(t: number) {
  const dt = Math.min(0.05, (t - lastT) / 1000)
  lastT = t
  if (inspecting && baseMaps && (dirty || spinOn)) {
    if (spinOn) { spin += dt * 0.25; sphere.rotation.y = -0.6 + spin }
    drawInspector()
    dirty = false
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// ------------------------------------------------------------------ boot
const lint = lintCatalog(CATALOG)
if (lint.some((l) => l.startsWith('Atlas'))) console.warn('catalog lint', lint)
installSpikeHooks({
  renderer, gen, list, cards: () => galleryTimings, isReady: () => galleryDone,
  open: openInspector, close: closeInspector, view, markDirty: () => { dirty = true; if (inspecting) drawInspector() },
  setZoom: (z: number, cu = 0.5, cv = 0.5) => { view.zoom = clamp(z, 1 / 32, 3); view.cu = cu; view.cv = cv; dirty = true; return bakeZoom() },
  setMode, setRing, frameStats, seed: () => seed, matchGuess, resolveGuess, lint: () => lint,
  current: () => ({ base: baseMaps, zoom: zoomMaps }),
})

if (params.get('open')) openInspector(params.get('open')!)
if (params.get('gallery') !== '0') void buildGallery()
else { status.textContent = 'Gallery off'; galleryDone = true; document.body.dataset.ready = '1' }

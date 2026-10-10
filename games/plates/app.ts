// games/plates/app.ts — createApp(deps): renderer, loop, state machine (title | bench | inspect | book |
// doc | ending), input routing, lamp ↔ light ↔ palette coupling, bundles, pins, saves, onboarding.
import * as THREE from 'three'
import type { Shell } from '@shared/ui'
import { idb, local, type KV } from '@shared/storage'
import {
  ROOM, PLATE_IDS, type Ctx, type BenchAnchors, type WetBench, type PlateLibrary, type LightTable, type ReturnBook, type PlateId, type Station,
  type Bath, type LightState, type LightMode, type PaletteName, type BenchPointer, type WetSnapshot, type InspectOpts,
} from './contracts'
import { createBus } from './world/bus'
import { createSea } from './world/sea'
import { blueNoiseTexture, rngFor } from './render/dither'
import { PaletteSweep, syncCss } from './render/palette'
import { createPostFX } from './render/postfx'
import { buildRoom } from './render/room'
import { createLamp } from './render/lamp'
import { createRig } from './render/camera'
import { createHud } from './ui/hud'
import { createDryingLine } from './ui/dryingLine'
import { createSettings, type SettingsState } from './ui/settings'
import { showTitle } from './ui/title'
import { openDocument, docOpen, closeDocument } from './ui/documents'
import { startSeal, finalCard, type EndingDeps } from './ui/ending'
import { createPins, type Pins } from './save/pins'
import { createAudio, type PlatesAudio } from './audio/sfx'
import { DOCS, WARN, SETTINGS, BOARD_A, BOARD_B, ENDING_C } from './story/text'
import type { PlatesBench } from './bench/wetBench'
import type { PlatesLightTable } from './inspect/lightTable'
import type { PlatesBook } from './ui/book'
import type { PlatesLibrary } from './content/library'
import './style.css'

export type Screen = 'title' | 'bench' | 'inspect' | 'book' | 'doc' | 'ending'
export interface AppDeps {
  stage: HTMLElement
  shell: Shell | null
  createWetBench: (ctx: Ctx, anchors: BenchAnchors) => WetBench
  createPlateLibrary: () => PlateLibrary
  createLightTable: (ctx: Ctx, bench: WetBench) => LightTable
  createReturnBook: (ctx: Ctx, bench: WetBench, table: LightTable, root: HTMLElement) => ReturnBook
  test: boolean
  quality: 'low' | 'full'
  seed: string
  fresh: boolean
  reset: boolean
}
export interface PlatesApp {
  ctx: Ctx; bench: PlatesBench; table: PlatesLightTable; book: PlatesBook; lib: PlatesLibrary; pins: Pins
  readonly screen: Screen; readonly station: Station; readonly tray: Bath | null; readonly palette: PaletteName
  readonly paneRead: boolean; readonly wick: number; readonly bundles: number[]
  root: HTMLElement
  freezeSea(on: boolean): void; wave(strength?: number): void; setTimeScale(k: number): void
  setStation(s: Station): Promise<void>; focusTray(b: Bath | null): Promise<void>
  setLight(m: LightMode): void; setWick(w: number): void
  inspect(id: PlateId | 'pane' | null, o?: InspectOpts): Promise<void>
  liftPane(): void; replacePane(): void; readPane(): Promise<void>
  seal(named: boolean | null): Promise<import('./contracts').ReturnStatus>
  pin(): number; restore(i: number): Promise<void>; resetSave(): Promise<void>
  advance(frames: number, dt?: number): void
  fps(): number; perf(): Record<string, number>
  begin(): void
  renderOnce(): void
}

export async function createApp(deps: AppDeps): Promise<PlatesApp> {
  const { stage, test } = deps
  const root = document.createElement('div'); root.className = 'pl-root'
  stage.appendChild(root)
  let hintMsg = ''
  const hintEl = document.createElement('div'); hintEl.className = 'pl-hint'; hintEl.hidden = true; hintEl.setAttribute('aria-live', 'polite')
  const canvas = document.createElement('canvas'); canvas.className = 'pl-canvas'; canvas.setAttribute('aria-label', 'The darkroom'); canvas.tabIndex = 0
  root.appendChild(canvas)
  root.appendChild(hintEl)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: test })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const dprCap = test ? 1 : deps.quality === 'low' ? 1.5 : 2
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))

  const bus = createBus()
  const light: LightState = { mode: 'ruby', wick: 0.6, windowIn: true, rubyI: 0.36, whiteI: 0, canaryI: 0 }
  const settings = { reducedMotion: test || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce', hurry: false, muted: test, quality: deps.quality }
  const lib = deps.createPlateLibrary() as PlatesLibrary
  const ctx: Ctx = { renderer, bus, light, lib, noise: blueNoiseTexture(), settings, test, timeScale: 1, rng: (s: string) => rngFor(`${deps.seed}:${s}`) }

  // storage
  const fresh = deps.fresh
  let kv: KV | null = null
  try { kv = fresh ? null : idb('plates') } catch (e) { console.debug('[plates] idb', e) }
  const ls = (() => { try { return local('plates') } catch { return null } })()
  if (kv) lib.setCache({ get: (k) => (kv as KV).get<Uint8Array>(k), set: (k, v) => (kv as KV).set(k, v) })

  // world
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0, 0, 0)
  const room = buildRoom()
  scene.add(room.group)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.16))
  const lamp = createLamp(deps.quality === 'low' ? 256 : 512)
  scene.add(lamp.group)
  const rig = createRig()
  const post = createPostFX()
  const sweep = new PaletteSweep('ruby')
  const sea = createSea(bus, ctx.rng('sea'))
  const bench = deps.createWetBench(ctx, room.anchors) as PlatesBench
  scene.add(bench.group)
  const table = deps.createLightTable(ctx, bench) as PlatesLightTable
  const hud = createHud(root)
  const line = createDryingLine(root)
  const book = deps.createReturnBook(ctx, bench, table, root) as PlatesBook
  const pins = createPins(kv)
  let audio: PlatesAudio | null = null
  try { audio = createAudio(bus, (id) => lib.meta(id)) } catch (e) { console.debug('[plates] audio', e) }
  const settingsSheet = createSettings(root, {
    change(k, v) {
      if (k === 'hurry') settings.hurry = v
      if (k === 'reduced') settings.reducedMotion = v
      if (k === 'bone') book.setBone(v)
      if (k === 'sound') { settings.muted = !v; void import('@shared/audio').then((a) => a.sound.setMuted(!v)).catch(() => undefined) }
      saveSettings()
    },
    restart() { void app.resetSave().then(() => location.reload()) },
  })

  // state
  let screen: Screen = test ? 'bench' : 'title'
  let paneRead = false, paneInHand = false, timeScale = 1, wickFound = 0
  let lastPlate: PlateId = 'p00'
  const taught = new Set<string>()
  let activeTime = 0, autoPinT = 0, autosaveT = 0
  const perfMs: Record<string, number> = { room: 0, bench: 0, table: 0, frame: 0 }
  let fpsAcc = 0, fpsN = 0, fpsVal = 0

  const portrait = () => root.clientHeight > root.clientWidth * 1.1
  function setPalette(p: PaletteName, instant = false): void {
    sweep.set(p, instant || settings.reducedMotion && false)
    syncCss(root, p === 'canary' ? 'ruby' : p)
    root.classList.toggle('pl-root--bone', p === 'bone')
    if (p !== sweep.from) bus.emit({ t: 'sfx', name: 'palette' })
  }
  function updateLight(): void {
    const w2 = lamp.wick * lamp.wick
    light.wick = lamp.wick; light.windowIn = lamp.windowIn
    light.mode = lamp.windowIn ? 'ruby' : 'white'
    light.rubyI = lamp.windowIn ? w2 : 0
    light.whiteI = lamp.windowIn ? 0 : w2
    const onTable = PLATE_IDS.find((id) => bench.where(id).kind === 'table')
    light.canaryI = table.isOpen && onTable && !bench.chem(onTable).fixed ? 1 : 0
    room.setTableGlow(table.isOpen ? 1 : 0)
    bench.setLum(Math.min(1, 0.32 + 0.75 * w2 * (lamp.windowIn ? 1 : 1.4)))
  }
  const unfixedOut = () => PLATE_IDS.some((id) => { const w = bench.where(id).kind; return w !== 'tin' && w !== 'camera' && !bench.chem(id).fixed })

  // ---------------------------------------------------------------- pins + saves
  function thumbFor(): ImageData | null {
    const id = PLATE_IDS.find((p) => { const w = bench.where(p); return w.kind === 'tray' && w.bath === 'dev' }) ?? lastPlate
    try { return bench.thumb(id, 40, 30, 'neg', { ink: [22, 5, 5], light: [201, 54, 31] }) } catch { return null }
  }
  const pinRec = () => ({ thumb: thumbFor(), snap: bench.snapshot(), lamp: { windowIn: lamp.windowIn, wick: lamp.wick } })
  function refreshLine(): void { line.set(pins.slots.map((s) => (s ? { index: s.index, auto: s.auto, thumb: s.thumb } : null))) }
  function autopin(): void { const i = pins.autopin(pinRec()); refreshLine(); bus.emit({ t: 'pin', index: i }); line.kick(0.4) }
  async function restorePin(i: number): Promise<void> {
    const r = pins.get(i); if (!r) return
    bench.restore(r.snap as WetSnapshot)
    lamp.setWick(r.lamp.wick); lamp.setWindow(r.lamp.windowIn); setPalette(r.lamp.windowIn ? 'ruby' : 'bone')
    bus.emit({ t: 'restore', index: i })
    sweep.from = 'bone'; sweep.t = 0
  }
  line.onPin = (slot) => { const i = pins.pin(slot, pinRec()); refreshLine(); bus.emit({ t: 'pin', index: i }) }
  line.onRestore = (i) => { void restorePin(i) }
  line.onRemove = (i) => { pins.remove(i); refreshLine() }
  line.onCog = () => settingsSheet.toggle()
  const saveSettings = () => { try { ls?.set('settings', { hurry: settings.hurry, reduced: settings.reducedMotion, bone: root.querySelector('.pl-book--bone') !== null, wick: lamp.wick }) } catch { /* ignore */ } }
  async function saveAll(): Promise<void> {
    if (!kv || test) return
    try {
      await kv.set('kv:bench', { snap: bench.snapshot(), lamp: { windowIn: lamp.windowIn, wick: lamp.wick } })
      await kv.set('kv:return', book.model.serialize())
      await kv.set('kv:progress', { bundles: [...bench.opened], paneRead, taught: [...taught], wick: wickFound, sealed: book.model.status().sealed })
      await kv.set('kv:meta', { v: 1 })
    } catch (e) { console.debug('[plates] save', e) }
  }
  async function loadAll(): Promise<boolean> {
    if (!kv) return false
    try {
      const prog = await kv.get<{ bundles: number[]; paneRead: boolean; taught: string[]; wick: number }>('kv:progress')
      if (!prog) return false
      for (const n of prog.bundles) await bench.openBundle(n as 1 | 2 | 3 | 4)
      paneRead = prog.paneRead; wickFound = prog.wick ?? 0
      for (const t of prog.taught ?? []) taught.add(t)
      const ret = await kv.get('kv:return'); if (ret) book.model.load(ret)
      const b = await kv.get<{ snap: WetSnapshot; lamp: { windowIn: boolean; wick: number } }>('kv:bench')
      if (b?.snap) { bench.restore(b.snap); lamp.setWick(b.lamp.wick); lamp.setWindow(b.lamp.windowIn); if (!b.lamp.windowIn) setPalette('bone', true) }
      for (const id of PLATE_IDS) if (bench.chem(id).fixed) book.onPlateFixed(id)
      await pins.load(); refreshLine()
      return true
    } catch (e) { console.debug('[plates] load', e); return false }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void saveAll() })
  window.addEventListener('pagehide', () => { void saveAll() })

  // ---------------------------------------------------------------- bus wiring
  bus.on('plateMoved', (e) => {
    lastPlate = e.id
    if (e.to.kind === 'tray' && e.to.bath === 'dev') {
      if (!taught.has(`dev:${e.id}`)) { taught.add(`dev:${e.id}`); autopin() }
      if (rig.tray !== 'dev' && !test) void app.focusTray('dev')
    } else if (e.to.kind === 'tray' && rig.tray && rig.tray !== e.to.bath && !test) void app.focusTray(e.to.bath)
  })
  bus.on('plateFixed', (e) => {
    book.onPlateFixed(e.id)
    if (book.newMarks()) hud.setWax(true)
    // bundle gating: when every plate of bundle n is fixed, bundle n+1 unwraps
    for (const n of [1, 2] as const) {
      const ids = PLATE_IDS.filter((id) => lib.meta(id).bundle === n)
      if (bench.opened.has(n) && ids.every((id) => bench.chem(id).fixed) && !bench.opened.has(n + 1)) void bench.openBundle((n + 1) as 2 | 3)
    }
    void saveAll()
  })
  bus.on('stamp', () => { hud.setWax(true); void saveAll() })
  bus.on('wave', (e) => {
    const k = settings.reducedMotion ? 0.25 : 1
    rig.shake(1.5 * e.strength * k)
    bench.impulse(0.4 * e.strength * e.dirX * k, 0.4 * e.strength * e.dirZ * k, 0.12)
    const u = ctx.rng('lamp')()
    lamp.kick((0.15 + 0.15 * u) * e.strength * k * e.dirZ, (0.15 + 0.15 * u) * e.strength * k * e.dirX)
    line.kick(e.strength * k)
  })
  bus.on('fogged', () => bus.emit({ t: 'sfx', name: 'fog' }))
  bench.onWarn = (text, at) => { const v = at.clone().project(rig.camera); hud.pencil(text, (v.x * 0.5 + 0.5) * root.clientWidth, (-v.y * 0.5 + 0.5) * root.clientHeight - 20) }
  bench.onRequestInspect = (id) => {
    if (!bench.chem(id).fixed && bench.where(id).kind !== 'table') { autopin(); bench.place(id, { kind: 'table' }) }
    void app.inspect(id)
  }
  table.onLeave = () => { screen = 'bench'; checkFinal() }
  table.onCite = (id) => { table.close(); screen = 'book'; book.holdForCite(id) }
  table.onPaneRead = () => {
    if (paneRead) return
    paneRead = true
    book.model.markFound()
    bus.emit({ t: 'paneRead' })
    bus.emit({ t: 'wave', strength: 0.8, dirX: 1, dirZ: 0 })
    audio?.chord([...lib.meta('p02').chord, ...lib.meta('p05').chord.slice(0, 1), ...lib.meta('p07').chord.slice(0, 0)].slice(0, 5))
    void saveAll()
  }
  book.onClosed = () => { screen = 'bench'; hud.setWax(book.newMarks()) }
  book.onSeal = () => {
    const accounted = book.model.status().sector
    screen = 'ending'
    startSeal(endingDeps, accounted)
  }
  const endingDeps: EndingDeps = {
    root,
    setPalette: (p) => setPalette(p),
    seal: (named) => { const s = book.model.seal(named); bus.emit({ t: 'sealed', complete: s.sector, named }); void saveAll(); return s },
    releasePlate13: () => { room.covered.visible = false; bench.unlock(4); void bench.openBundle(4) },
    onDone: () => { screen = 'bench'; book.close() },
  }
  let finalShown = false
  function checkFinal(): void {
    if (finalShown || !bench.chem('p13').fixed) return
    finalShown = true
    audio?.chordSequence(PLATE_IDS.map((id) => lib.meta(id).chord), test ? 10 : 2600)
    setPalette('bone')
    finalCard({ root, status: book.model.status(), wick: wickFound, onBack: () => setPalette(lamp.windowIn ? 'ruby' : 'bone'), onSheet: () => { location.search = '?gallery=1' }, onKeep: () => setPalette(lamp.windowIn ? 'ruby' : 'bone') })
  }
  hud.onStation = (s) => { void app.setStation(s) }
  hud.onBackTray = () => { void app.focusTray(null) }
  hud.onTray = (b) => { void app.focusTray(b) }
  hud.onBook = () => openBook()
  function openBook(page?: 'persons' | 'findings' | 'sector' | 'documents'): void { taught.add('booked'); if (table.isOpen) table.close(); screen = 'book'; hud.setWax(false); book.open(page) }

  // ---------------------------------------------------------------- lamp actions
  function pullWindow(): void {
    if (!lamp.windowIn) return
    if (unfixedOut()) { autopin(); hud.pencil(WARN.uncovered, root.clientWidth * 0.72, root.clientHeight * 0.3) }
    lamp.setWindow(false); paneInHand = true
    setPalette('bone')
    updateLight()
    for (const id of PLATE_IDS) { const w = bench.where(id).kind; if (w !== 'tin' && w !== 'camera' && !bench.chem(id).fixed) bus.emit({ t: 'fogged', id, amount: 1 }) }
  }
  function replaceWindow(): void { if (lamp.windowIn) return; if (table.showing === 'pane') table.close(); lamp.setWindow(true); paneInHand = false; setPalette('ruby'); updateLight() }

  // ---------------------------------------------------------------- input
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  interface Ptr { id: number; x0: number; y0: number; t0: number; x: number; y: number; moved: boolean; button: number; longT: number | null; consumed: string | null }
  const ptrs = new Map<number, Ptr>()
  let lastTap = { t: 0, x: 0, y: 0 }
  let lampDrag: { y0: number } | null = null
  let swipe: { x0: number; y0: number } | null = null
  function mk(kind: BenchPointer['kind'], e: { clientX: number; clientY: number; pointerId: number; button: number }, touches: number): BenchPointer {
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, rig.camera)
    return { kind, x, y, ndc: ndc.clone(), ray: raycaster.ray.clone(), id: e.pointerId, button: e.button, touches }
  }
  function route(p: BenchPointer): void {
    if (screen === 'title' || screen === 'ending' || docOpen()) return
    if (book.isOpen) return
    if (table.isOpen) { table.pointer(p); return }
    // lamp: tab (pull), body (bump), wick key
    if (p.kind === 'down' || p.kind === 'tap') {
      raycaster.ray.copy(p.ray)
      const hit = raycaster.intersectObjects(lamp.pickables(), false)[0]
      if (hit) {
        const k = hit.object.userData.kind as string
        if (p.kind === 'down' && k === 'lampTab' && lamp.windowIn) { lampDrag = { y0: p.y }; if (unfixedOut()) hud.pencil(WARN.uncovered, p.x, p.y - 30); return }
        if (p.kind === 'tap') {
          if (k === 'lamp' || k === 'lampTab') { if (!lamp.windowIn && paneInHand) replaceWindow(); else { lamp.bump(); bus.emit({ t: 'sfx', name: 'lampSwing', gain: 0.5 }) } }
          if (k === 'wick') { lamp.setWick(lamp.wick >= 0.95 ? 0.3 : lamp.wick + 0.2); bus.emit({ t: 'sfx', name: 'wick' }); saveSettings() }
          return
        }
      }
      // the light table or the book on the bench
      const objs: THREE.Object3D[] = [room.book, room.tableTop]
      const h2 = raycaster.intersectObjects(objs, false)[0]
      if (h2 && p.kind === 'tap' && !bench.held()) {
        if (h2.object.userData.kind === 'book') { openBook(); return }
        if (h2.object.userData.kind === 'table' && paneInHand) { void app.inspect('pane'); return }
        if (h2.object.userData.kind === 'table') { const on = PLATE_IDS.find((id) => bench.where(id).kind === 'table') ?? [...PLATE_IDS].reverse().find((id) => bench.where(id).kind === 'rack' && bench.chem(id).fixed); if (on) { void app.inspect(on); return } }
      }
    }
    if (lampDrag) {
      if (p.kind === 'move' && lampDrag.y0 - p.y >= 110) { lampDrag = null; pullWindow() }
      if (p.kind === 'up' || p.kind === 'cancel') lampDrag = null
      return
    }
    const t0 = performance.now()
    const used = bench.pointer(p)
    perfMs.bench = performance.now() - t0
    if (used) { if (p.kind === 'move' && bench.rocking()) taught.add('rock'); return }
    // camera: swipe on empty wall moves between stations (or trays when one is focused, portrait)
    if (p.kind === 'down') swipe = { x0: p.x, y0: p.y }
    if (p.kind === 'up' && swipe) {
      const dx = p.x - swipe.x0
      if (Math.abs(dx) > 80) {
        if (rig.tray) { const order: Bath[] = ['dev', 'water', 'hypo']; const i = order.indexOf(rig.tray) + (dx < 0 ? 1 : -1); if (i >= 0 && i < 3) void app.focusTray(order[i]) }
        else { const order: Station[] = ['shelf', 'trays', 'table']; const i = order.indexOf(rig.station) + (dx < 0 ? 1 : -1); if (i >= 0 && i < 3) void app.setStation(order[i]) }
      }
      swipe = null
    }
    if (p.kind === 'tap' && !rig.tray) {
      // tap a tray rim to focus it
      for (const b of ['dev', 'water', 'hypo'] as Bath[]) {
        const hit = raycaster.intersectObject(bench.focusTarget(b), true)[0]
        if (hit) { void app.focusTray(b); return }
      }
    }
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    const q: Ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), x: e.clientX, y: e.clientY, moved: false, button: e.button, longT: null, consumed: null }
    ptrs.set(e.pointerId, q)
    q.longT = window.setTimeout(() => { if (!q.moved) { q.consumed = 'long'; route(mk('long', e, ptrs.size)) } }, 450)
    route(mk('down', e, ptrs.size))
  })
  canvas.addEventListener('pointermove', (e) => {
    const q = ptrs.get(e.pointerId)
    if (q) { q.x = e.clientX; q.y = e.clientY; if (Math.hypot(q.x - q.x0, q.y - q.y0) > 6) { q.moved = true; if (q.longT) { clearTimeout(q.longT); q.longT = null } } }
    const r = canvas.getBoundingClientRect()
    if (e.pointerType === 'mouse') rig.sway(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    route(mk('move', e, q ? ptrs.size : 0))
  })
  const end = (e: PointerEvent, cancel: boolean) => {
    const q = ptrs.get(e.pointerId)
    if (q?.longT) clearTimeout(q.longT)
    ptrs.delete(e.pointerId)
    route(mk(cancel ? 'cancel' : 'up', e, ptrs.size))
    if (!q || cancel || q.consumed) return
    const dt = performance.now() - q.t0
    if (!q.moved && dt < 250) {
      const now = performance.now()
      const dbl = now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 12
      lastTap = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY }
      route(mk(dbl ? 'dbl' : 'tap', e, 0))
    }
  }
  canvas.addEventListener('pointerup', (e) => end(e, false))
  canvas.addEventListener('pointercancel', (e) => end(e, true))
  window.addEventListener('wheel', () => undefined, { passive: true })

  const ignoreKey = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.matches('input, textarea, select, [contenteditable]') || !!t.closest('.ar-shell, dialog[open], .pl-book, .pl-doc-ground')) }
  let lArmed = 0
  window.addEventListener('keydown', (e) => {
    if (ignoreKey(e) || screen === 'title') return
    const k = e.key
    if (table.isOpen) {
      if (k === 'Escape') { table.close(); screen = 'bench'; return }
      if (k === 'v' || k === 'V') table.set({ velvet: table.opts.velvet > 0.5 ? 0 : 1 })
      if (k === 'q' || k === 'Q') table.set({ eye: 'L', wiggle: false })
      if (k === 'w' || k === 'W') table.set({ eye: 'both', wiggle: false })
      if (k === 'e' || k === 'E') table.set({ eye: 'R', wiggle: false })
      if (k === 'x' || k === 'X') table.set({ wiggle: !table.opts.wiggle })
      if (k === 'z' || k === 'Z') (root.querySelector('.pl-table-bar [data-a="loupe"]') as HTMLButtonElement | null)?.click()
      if (k === 'g' || k === 'G') (root.querySelector('.pl-table-bar [data-a="register"]') as HTMLButtonElement | null)?.click()
      return
    }
    if (k === 'Escape') { if (rig.tray) void app.focusTray(null); else if (settingsSheet.open) settingsSheet.toggle(); return }
    if (k === 'r' || k === 'R' || k === 'Tab') { e.preventDefault(); openBook(); return }
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') { const o: Station[] = ['shelf', 'trays', 'table']; void app.setStation(o[Math.max(0, o.indexOf(rig.station) - 1)]) }
    if (k === 'd' || k === 'D' || k === 'ArrowRight') { const o: Station[] = ['shelf', 'trays', 'table']; void app.setStation(o[Math.min(2, o.indexOf(rig.station) + 1)]) }
    if (k === '1') void app.setStation('shelf'); if (k === '2') void app.setStation('trays'); if (k === '3') void app.setStation('table')
    if (k === 'Enter' && !rig.tray && rig.station === 'trays') void app.focusTray('dev')
    if (k === ' ' && rig.tray && !e.repeat) { e.preventDefault(); bench.rock('corners'); taught.add('rock') }
    if (k === 'Shift') settings.hurry = true
    if (k === '[') lamp.setWick(lamp.wick - 0.1); if (k === ']') lamp.setWick(lamp.wick + 0.1)
    if (k === 'l' || k === 'L') { if (!lamp.windowIn) replaceWindow(); else if (performance.now() - lArmed < 2000) pullWindow(); else { lArmed = performance.now(); if (unfixedOut()) hud.pencil(WARN.uncovered, root.clientWidth * 0.7, root.clientHeight * 0.3) } }
    if (k === 'p' || k === 'P') line.onPin?.(pins.slots.findIndex((s, i) => i < 6 && !s))
    if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) { const i = pins.newestAuto(); if (i !== null) void restorePin(i) }
    if (k === ',') settingsSheet.toggle()
    if (k === 'm' || k === 'M') void import('@shared/audio').then((a) => a.sound.setMuted(!a.sound.muted)).catch(() => undefined)
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ' && rig.tray) bench.rock(null)
    if (e.key === 'Shift') settings.hurry = settingsSheet.el.querySelector('[data-k="hurry"]')?.getAttribute('aria-pressed') === 'true'
  })

  // ---------------------------------------------------------------- resize
  function resize(): void {
    const w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight)
    renderer.setSize(w, h, false)
    post.resize(w, h, rig.tray ? 1.5 : 1)
    rig.setAspect(w / h)
    hud.setStation(rig.station, rig.tray, portrait())
    table.layout()
  }
  let resizeT = 0
  new ResizeObserver(() => { clearTimeout(resizeT); resizeT = window.setTimeout(resize, test ? 0 : 120) }).observe(root)
  resize()

  // one next-step line for a first-time player, walking the whole loop (tin, developer, water, hypo, rack, table, Return)
  function guide(): string {
    const st = rig.station, tr = rig.tray
    if (!bench.opened.has(1)) return st === 'shelf' ? 'Tap the tin to open the first bundle.' : 'The tin is on the Shelf. Tap Shelf below.'
    const inBath = (b: Bath) => PLATE_IDS.find((id) => { const w = bench.where(id); return w.kind === 'tray' && w.bath === b }) ?? null
    const dev = inBath('dev'), wat = inBath('water'), hyp = inBath('hypo')
    if (bench.held()) return st === 'trays' || tr ? 'Plate in hand. Tap the left tray (developer) to lay it in.' : 'Plate in hand. Tap Trays below, then tap the left tray.'
    const here = dev ? 'dev' : wat ? 'water' : hyp ? 'hypo' : null
    if (here && tr && tr !== here) return `The plate is in the ${here === 'dev' ? 'developer' : here} tray. Tap ${here.toUpperCase()} below.`
    if (dev) {
      if (!taught.has('rock')) return tr === 'dev' ? 'Drag across the tray to rock the developer. Stop when the eighth square shows.' : 'Tap the left tray to lean over it, then drag to rock it.'
      return 'Keep rocking until the picture and eight squares show. Then double-tap the plate to move it to the water.'
    }
    if (wat) return 'Rinse a moment. Double-tap the plate to move it to the hypo (fixer).'
    if (hyp) return bench.chem(hyp).fixed ? 'Fixed. Double-tap the plate to put it on the rack.' : 'Hold it in the hypo until the milk clears. Fixing is slow; tap the tray to stir.'
    if (PLATE_IDS.some((id) => bench.where(id).kind === 'bench' && !bench.chem(id).fixed)) return 'The plate is loose on the bench. Tap it to pick it up, then tap a tray.'
    const onRack = PLATE_IDS.find((id) => bench.where(id).kind === 'rack')
    if (onRack && !taught.has('viewed')) return st === 'table' ? 'Tap the plate on the rack, or the light table, to look at it closely.' : 'The plate is on the rack. Tap Table below to look at it.'
    if (taught.has('viewed') && !taught.has('booked')) return 'Open the Return (bottom right) to record what you found.'
    if (!PLATE_IDS.some((id) => bench.where(id).kind !== 'tin' && bench.where(id).kind !== 'camera')) return st === 'shelf' ? 'Tap the tin again to take a plate.' : 'More plates are in the tin on the Shelf.'
    return ''
  }
  // ---------------------------------------------------------------- frame
  let last = performance.now()
  function frame(dtReal: number): void {
    const t0 = performance.now()
    const dtc = Math.min(dtReal, 1 / 20)
    ctx.timeScale = timeScale * (settings.hurry ? 3 : 1)
    const dt = dtc * ctx.timeScale
    if (screen !== 'title') { activeTime += dtc; autoPinT += dtc; autosaveT += dtc }
    if (autoPinT > 180 && !test) { autoPinT = 0; autopin() }
    if (autosaveT > 10) { autosaveT = 0; void saveAll() }
    sea.update(dtc)
    lamp.update(dtc, sea.frozen)
    updateLight()
    bench.update(dt)
    rig.update(dtc, settings.reducedMotion)
    sweep.update(dtc)
    line.update(dtc, sea.frozen)
    table.update(dtc)
    audio?.update(dtc, bench.slosh(), lamp.windowIn ? lamp.wick : 0)
    hud.el.hidden = table.isOpen
    // ghost hand: tin until bundle I is opened; tray until the first rock
    if (!test && screen === 'bench') {
      const show = (o: THREE.Object3D | null) => { if (!o) { hud.ghost(0, 0, false); return } const v = o.getWorldPosition(new THREE.Vector3()).project(rig.camera); hud.ghost((v.x * 0.5 + 0.5) * root.clientWidth, (-v.y * 0.5 + 0.5) * root.clientHeight, v.z < 1) }
      if (!bench.opened.has(1)) show(room.anchors.tin)
      else if (rig.tray === 'dev' && !taught.has('rock') && bench.where('p00').kind === 'tray') show(bench.focusTarget('dev'))
      else show(null)
    } else hud.ghost(0, 0, false)
    {
      let msg = ''
      if (!test && screen === 'bench' && !table.isOpen && !book.isOpen) msg = guide()
      hintEl.style.bottom = rig.tray && portrait() ? '126px' : ''
      if (hintMsg !== msg) { hintMsg = msg; hintEl.textContent = msg; hintEl.hidden = !msg }
    }
    // render
    const t1 = performance.now()
    const overlay = (book.isOpen || docOpen()) && !test
    if (table.isOpen) table.render()
    else if (!overlay || frameNo < 2) {
      const [yaw, pitch] = rig.yawPitch()
      const f = (post.internal[1] / 2) / Math.tan((rig.camera.fov * Math.PI) / 360)
      post.render(renderer, scene, rig.camera, { sweep, exposure: sweep.current === 'bone' ? 1.0 : 1.6, camOff: [((yaw * f) % 8 + 8) % 8, ((pitch * f) % 8 + 8) % 8], shake: rig.shakeOffset, dim: 0 })
    }
    perfMs.room = performance.now() - t1
    perfMs.frame = performance.now() - t0
    fpsAcc += dtReal; fpsN++; if (fpsAcc > 1) { fpsVal = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0 }
    frameNo++
  }
  let frameNo = 0
  let running = true
  function loop(): void {
    if (!running) return
    const now = performance.now()
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    frame(test ? 0 : dt)
    requestAnimationFrame(loop)
  }
  document.addEventListener('visibilitychange', () => { last = performance.now() })

  // ---------------------------------------------------------------- boot
  if (deps.reset && kv) { try { await kv.clear(); ls?.clear() } catch { /* ignore */ } }
  const st = ls?.get<{ hurry: boolean; reduced: boolean; bone: boolean; wick: number } | null>('settings', null)
  if (st) { settings.hurry = !!st.hurry; settings.reducedMotion = settings.reducedMotion || !!st.reduced; book.setBone(!!st.bone); if (st.wick) lamp.setWick(st.wick); settingsSheet.sync({ sound: !settings.muted, reduced: settings.reducedMotion, hurry: settings.hurry, bone: !!st.bone }) }
  else settingsSheet.sync({ sound: !settings.muted, reduced: settings.reducedMotion, hurry: false, bone: false })
  if (!kv || test) line.note(test ? null : SETTINGS.noSave)
  const resumed = test ? false : await loadAll()
  bench.unlock(1)
  rig.setStation('trays', true)
  hud.setStation('trays', null, portrait())
  syncCss(root, 'ruby')
  // the TRIAL plate is exposed during the title screen
  await lib.expose('p00', renderer, deps.quality)
  if (test) sea.frozen = true

  const app: PlatesApp = {
    ctx, bench, table, book, lib, pins, root,
    get screen() { return screen }, get station() { return rig.station }, get tray() { return rig.tray }, get palette() { return sweep.current },
    get paneRead() { return paneRead }, get wick() { return wickFound }, get bundles() { return [...bench.opened].sort() },
    freezeSea(on) { sea.frozen = on },
    wave(s) { sea.wave(s) },
    setTimeScale(k) { timeScale = Math.max(1, Math.min(20, k)) },
    async setStation(s) { if (table.isOpen) table.close(); bench.setFocus(null); rig.setStation(s, test); post.resize(Math.max(1, root.clientWidth), Math.max(1, root.clientHeight), 1); hud.setStation(s, null, portrait()); bus.emit({ t: 'station', station: s, tray: null }); if (test) app.renderOnce() },
    async focusTray(b) { bench.setFocus(b); rig.focusTray(b, test); post.resize(Math.max(1, root.clientWidth), Math.max(1, root.clientHeight), b ? 1.5 : 1); hud.setStation(rig.station, b, portrait()); bus.emit({ t: 'station', station: rig.station, tray: b }); if (test) app.renderOnce() },
    setLight(m) { if (m === 'white') pullWindow(); else if (m === 'ruby') replaceWindow(); else lamp.setWick(0.2) },
    setWick(w) { lamp.setWick(w) },
    async inspect(id, o) {
      if (id === null) { table.close(); screen = 'bench'; checkFinal(); return }
      if (id !== 'pane') { const w = bench.where(id).kind; if (w !== 'table' && w !== 'rack') bench.place(id, { kind: 'table' }); await lib.expose(id, renderer, deps.quality) }
      if (book.isOpen) book.close()
      screen = 'inspect'; if (id !== 'pane') taught.add('viewed')
      if (table.showing !== id) table.open(id)
      if (o) table.set(o)
      updateLight()
      if (test) { table.update(0); app.renderOnce() }
    },
    liftPane() { pullWindow() },
    replacePane() { replaceWindow() },
    async readPane() { if (lamp.windowIn) pullWindow(); await app.inspect('pane'); table.update(1.1); if (!paneRead) table.onPaneRead?.(); if (test) app.renderOnce() },
    async seal(named) {
      const s = book.model.seal(named)
      bus.emit({ t: 'sealed', complete: s.sector, named })
      endingDeps.setPalette('bone')
      if (s.ending === 'A' || s.ending === 'B') openDocument(root, { id: 'letter', title: '', voice: 'board', paras: s.ending === 'A' ? BOARD_A : BOARD_B }, () => { screen = 'bench'; setPalette(lamp.windowIn ? 'ruby' : 'bone') })
      else openDocument(root, { id: 'c', title: '', voice: 'board', paras: [ENDING_C] }, () => { screen = 'bench'; setPalette(lamp.windowIn ? 'ruby' : 'bone') })
      screen = 'ending'
      void saveAll()
      return s
    },
    pin() { const i = pins.pin(null, pinRec()); refreshLine(); bus.emit({ t: 'pin', index: i }); return i },
    async restore(i) { await restorePin(i); if (test) app.renderOnce() },
    async resetSave() { await pins.clear(); if (kv) await kv.clear().catch(() => undefined); try { ls?.clear() } catch { /* ignore */ } },
    advance(frames, dt = 1 / 60) { for (let i = 0; i < frames; i++) frame(dt) },
    fps() { return fpsVal },
    perf() { return { ...perfMs } },
    begin() {
      if (screen !== 'title') return
      screen = 'bench'
      if (!bench.opened.has(1)) void app.setStation('shelf')
      void import('@shared/audio').then((a) => { a.Audio.play('plates.fogBell'); a.Audio.play('plates.arrival') }).catch(() => undefined)
      audio?.start()
      if (!resumed && !taught.has('letters')) {
        taught.add('letters')
        screen = 'doc'
        openDocument(root, DOCS[0], () => { screen = 'doc'; openDocument(root, DOCS[1], () => { screen = 'bench' }) })
      }
    },
    renderOnce() { frame(0) },
  }
  if (!test) {
    showTitle(root, () => app.begin())
  } else screen = 'bench'
  requestAnimationFrame(loop)
  if (test) { app.renderOnce(); app.renderOnce() }
  closeDocument()
  void running
  return app
}

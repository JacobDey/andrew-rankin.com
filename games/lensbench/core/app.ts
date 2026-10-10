// App spine (architecture §5.5): router between the four places, store, render queue, onboarding,
// share links and the window.__game test API (lensbench.md §13).
import * as THREE from 'three'
import {
  computeProfile, decodeLens, encodeLens, extForDistance, focusDistanceM, heartCard, loadPreset as opticsPreset,
  lensFromCompact, lensToCompact, PRESET_INFO, saveLens, setFNumber, selftest as opticsSelftest, b64urlDecode, b64urlEncode,
  type LensProfile, type PresetId,
} from '@shared/optics'
import { selftest as sunSelftest } from '@shared/sun'
import { flags, installGameApi, markReady, createLoop, rngStream, prefersReducedMotion } from '@shared/core'
import { writeHubNote } from '@shared/storage'
import type { Shell } from '@shared/ui'
import { BODIES, SHUTTERS, STOCKS, speedsFor } from './catalog'
import type { GLCore } from './gl'
import { createStore, defaultCamera, type Store } from './store'
import type { AppState, BodyId, CameraSpec, DevParams, DevelopedFrame, FilterId, FrameRecord, Place, QualityTier, ShutterId, StandpointId, StockId, TagId, TargetId } from './types'
import type { World } from '../street/world/world'
import { FinderView } from '../street/finder'
import { inertia, omegaRms } from '../street/shake'
import type { PhotoRenderer } from '../photo/photo-renderer'
import { developFrame, latentEV, encodeH, decodeH } from '../film/develop'
import { gradeFrame, TAGS, type GradeResult } from '../shop/grade'
import { sfx } from '../audio/audio'
import type { BenchScreen } from '../bench/bench-screen'
import type { StreetScreen } from '../street/street-screen'
import type { TankScreen } from '../shop/tank-screen'
import type { LightboxScreen } from '../shop/lightbox-screen'

export interface App {
  store: Store
  gl: GLCore
  world: World
  finder: FinderView
  profile(): LensProfile
  setCamera(p: Partial<CameraSpec>): void
  loadPreset(id: PresetId): void
  setAperture(n: number | 'heart'): void
  clampSpeed(): void
  unlocked(key: string): boolean
  toast(text: string): void
  noteOnce(key: string, text: string): void
  markOnboarded(): void
  share(): void
  saveDesign(): void
  renderGroundGlass(dt: number, el: HTMLElement): void
  renderStreet(dt: number, o: { yaw: number; pitch: number; dof: boolean }): void
  inertia(): number
  nextSeed(): number
  onFired(f: FrameRecord): void
  rewind(): void
  developRoll(rollId: string, dev: DevParams, onProgress?: (p: number) => void): Promise<string[]>
  developed(id: string): DevelopedFrame | null
  grade(id: string, tag?: string, answer?: string): GradeResult
  deliver(id: string, tag: TagId, answer: string): GradeResult
  pulseTab(p: Place): void
}

export interface LensBenchDeps {
  stage: HTMLElement
  shell: Shell
  gl: GLCore
  world: World
  createBenchScreen: (root: HTMLElement, app: App) => BenchScreen
  createStreetScreen: (root: HTMLElement, app: App) => StreetScreen
  createTankScreen: (root: HTMLElement, app: App) => TankScreen
  createLightboxScreen: (root: HTMLElement, app: App) => LightboxScreen
  createPhotoRenderer: (gl: GLCore, world: World) => PhotoRenderer
}

const PLACES: Place[] = ['bench', 'street', 'tank', 'lightbox']
const PLACE_LABEL: Record<Place, string> = { bench: 'Bench', street: 'Street', tank: 'Tank', lightbox: 'Lightbox' }
const D2R = Math.PI / 180

export async function startLensBench(deps: LensBenchDeps): Promise<App> {
  const { stage, shell, gl, world } = deps
  const F = flags()
  const test = F.test
  const store = createStore()
  if (!F.fresh) await store.load()
  if (F.seed !== null) store.set({ progress: { ...store.get().progress, textSeed: F.seed } })
  world.setTextSeed(store.get().progress.textSeed)
  if (test) store.set({ frozen: true })

  // ---------------------------------------------------------------- shell DOM
  const top = document.createElement('div')
  top.className = 'lb-top'
  top.innerHTML = `<nav class="lb-tabs" role="tablist" aria-label="Places">${PLACES.map((p, i) => `<button role="tab" class="lb-tab" data-place="${p}"><kbd>${i + 1}</kbd>${PLACE_LABEL[p]}<i class="lb-badge" hidden></i></button>`).join('')}</nav><div class="lb-rollstatus" aria-live="polite"></div>`
  const cork = document.createElement('div')
  cork.className = 'lb-cork'
  const places = document.createElement('div')
  places.className = 'lb-places'
  stage.append(top, cork, places)
  stage.appendChild(gl.canvas)
  const roots: Record<Place, HTMLElement> = { bench: el(), street: el(), tank: el(), lightbox: el() }
  function el() { const d = document.createElement('section'); d.className = 'lb-place'; d.hidden = true; places.appendChild(d); return d }
  const rollStatus = top.querySelector('.lb-rollstatus') as HTMLElement
  const toastBox = document.createElement('div'); toastBox.className = 'lb-qtoast lb-hand'; toastBox.setAttribute('role', 'status'); stage.appendChild(toastBox)

  // ---------------------------------------------------------------- profile cache
  let profKey = ''
  let prof: LensProfile = computeProfile(store.get().camera.lens, fmtOf(store.get().camera.body), 'full')
  function fmtOf(b: BodyId) { const f = BODIES[b].format; return { w: f[0], h: f[1] } }
  function profile(): LensProfile {
    const c = store.get().camera
    const key = JSON.stringify(c.lens) + c.body
    if (key !== profKey) { prof = computeProfile(c.lens, fmtOf(c.body), 'full'); profKey = key }
    return prof
  }

  // ---------------------------------------------------------------- unlocks
  function unlocked(key: string): boolean {
    const pr = store.get().progress
    if (pr.spareKey) return true
    const base = ['preset:pinhole', 'body:tin', 'stock:pan100', 'shutter:cap', 'stop:pinhole']
    if (base.includes(key)) return true
    if (pr.unlocked.includes(key)) return true
    if (key.startsWith('filter:')) return pr.unlocked.includes('filter:nd')
    if (key.startsWith('glass:')) return pr.unlocked.includes(key)
    return false
  }

  // ---------------------------------------------------------------- toasts and notes
  let toastTimer = 0
  function toast(text: string) {
    toastBox.textContent = text
    toastBox.classList.add('on')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toastBox.classList.remove('on'), 3200)
    shell.announce(text)
  }
  const seenNotes = new Set<string>()
  function noteOnce(key: string, text: string) {
    const pr = store.get().progress
    if (seenNotes.has(key) || pr.accidents[`note:${key}`]) return
    seenNotes.add(key)
    store.set({ progress: { ...pr, accidents: { ...pr.accidents, [`note:${key}`]: '1' } } })
    toast(`${text} — Q.`)
  }

  // ---------------------------------------------------------------- camera ops
  function setCamera(p: Partial<CameraSpec>) {
    const s = store.get()
    const camera: CameraSpec = { ...s.camera, ...p }
    const patch: Partial<AppState> = { camera }
    if (p.body && p.body !== s.camera.body) {
      patch.ext = Math.min(s.ext, BODIES[p.body].extMax)
      if (p.body === 'tin' || p.body === 'view') patch.tripod = true
    }
    if (p.stock && p.stock !== s.camera.stock && store.roll()?.frames.length) { store.rewind(); toast('New film: the old roll is rewound for the tank.') }
    store.set(patch)
    if (p.lens) { const pr = profile(); if (!pr.pinhole) store.set({ fNumber: pr.fNumber }) }
    clampSpeed()
  }
  function loadPreset(id: PresetId) {
    const lens = opticsPreset(id)
    const s = store.get()
    const body: BodyId = id === 'pinhole' ? 'tin' : s.camera.body === 'tin' ? (unlocked('body:rangefinder') && (id === 'triplet' || id === 'portrait' || id === 'retrofocus') ? 'rangefinder' : 'box') : s.camera.body
    const shutter: ShutterId = id === 'pinhole' ? 'cap' : body === s.camera.body ? s.camera.shutter : BODIES[body].shutter
    store.set({ camera: { ...s.camera, lens, body, shutter, name: PRESET_INFO[id].name }, ext: 0, fNumber: PRESET_INFO[id].N, tripod: body === 'tin' || body === 'view' ? true : s.tripod })
    profKey = ''
    store.set({ fNumber: profile().fNumber })
    clampSpeed()
  }
  function setAperture(n: number | 'heart') {
    const s = store.get()
    let lens = s.camera.lens
    if (n === 'heart') {
      if (!lens.elements.length) { loadPreset('portrait'); lens = store.get().camera.lens }
      lens = { ...lens, stop: { ...lens.stop, kind: 'card', card: heartCard() } }
      store.set({ camera: { ...store.get().camera, lens } })
      profKey = ''
      store.set({ fNumber: profile().fNumber })
      return
    }
    if (lens.stop.kind === 'card') lens = { ...lens, stop: { ...lens.stop, kind: 'iris', card: undefined } }
    lens = setFNumber(lens, n, fmtOf(s.camera.body))
    store.set({ camera: { ...s.camera, lens }, fNumber: n })
  }
  function clampSpeed() {
    const s = store.get()
    const list = speedsFor(s.camera.shutter)
    if (!list.some((t) => Math.abs(t - s.shutterS) < 1e-9)) {
      const nearest = list.reduce((a, b) => (Math.abs(Math.log((b || 1e-3) / (s.shutterS || 1e-3))) < Math.abs(Math.log((a || 1e-3) / (s.shutterS || 1e-3))) ? b : a), list[0])
      store.set({ shutterS: nearest })
    }
  }

  // ---------------------------------------------------------------- GL views
  const finder = new FinderView(gl, world, gl.quality === 'desktop' ? 512 : gl.quality === 'phone' ? 384 : 256)
  let worldT = store.get().worldT
  const tmpV = new THREE.Vector3()
  function liveWorld() {
    const s = store.get()
    world.setTimeOfDay(s.timeOfDay)
    world.update(worldT)
  }
  function renderGroundGlass(dt: number, el: HTMLElement) {
    if (photoBusy && gl.quality === 'test') return
    gl.attachTo(el); gl.sync()
    liveWorld()
    const p = profile()
    const s = store.get()
    const sp = world.standpoints.window
    finder.setView({ pos: sp.pos, yaw: sp.yawDeg * D2R, pitch: sp.pitchDeg * D2R })
    finder.lens = { profile: p.valid ? p : computeProfile(opticsPreset('pinhole'), fmtOf(s.camera.body)), ext: s.ext, viewN: p.fNumber, formatMm: BODIES[s.camera.body].format, kind: 'groundglass', brightness: Math.max(0.03, Math.min(1, Math.pow(5.6 / p.fNumber, 2))) }
    finder.render(dt)
  }
  function renderStreet(dt: number, o: { yaw: number; pitch: number; dof: boolean }) {
    if (photoBusy && gl.quality === 'test') return
    gl.sync()
    liveWorld()
    const s = store.get()
    const p = profile()
    const b = BODIES[s.camera.body]
    finder.setView({ pos: s.pos, yaw: o.yaw, pitch: o.pitch })
    const kind = b.finder
    const viewN = kind === 'reflex' && !o.dof ? Math.min(p.fNumber, 2.8) : p.fNumber
    const bright = kind === 'reflex' ? Math.min(1, Math.pow(2.8 / Math.max(2.8, viewN), 2) * 1.0 + 0.25) : kind === 'groundglass' ? Math.max(0.05, Math.min(1, Math.pow(5.6 / p.fNumber, 2))) : 1
    finder.lens = { profile: p, ext: s.ext, viewN, formatMm: b.format, kind, brightness: bright }
    finder.render(dt)
  }

  // ---------------------------------------------------------------- photo queue and development
  const photo = deps.createPhotoRenderer(gl, world)
  let photoBusy = false
  let seedCounter = 1
  const seedRng = rngStream(F.seed ?? (Date.now() >>> 0), 'shots')
  const nextSeed = () => (F.test ? 1000 + seedCounter++ : Math.floor(seedRng() * 2 ** 31))
  const renderWaiters = new Map<string, (() => void)[]>()
  async function pumpQueue() {
    if (photoBusy) return
    const roll = store.roll()
    const openId = roll && !store.get().cocked ? roll.frames[roll.frames.length - 1] : null // may still take a multiple exposure
    const next = store.frameList().find((f) => f.status === 'exposed' && f.id !== openId)
    if (!next) return
    photoBusy = true
    try {
      const lat = await photo.render(next)
      const ev = latentEV(lat, next.shots[0].camera.stock)
      store.setLatent(next.id, lat, { exposureEV: ev, accidents: [], w: lat.w, h: lat.h })
      if (next.status === 'exposed') next.status = 'rendered'
    } catch (e) {
      console.warn('[lensbench] render failed', e)
      // a flat mid-grey so the roll still develops
      const b = BODIES[next.shots[0].camera.body]
      const w = 192, h = Math.round((192 * b.format[1]) / b.format[0])
      const data = new Uint8Array(w * h * 3).fill(encodeH(9.82 / STOCKS[next.shots[0].camera.stock].iso))
      store.setLatent(next.id, { w, h, data, formatMm: b.format, ir: false }, { exposureEV: 0, accidents: [], w, h })
    } finally {
      photoBusy = false
      const ws = renderWaiters.get(next.id); renderWaiters.delete(next.id); ws?.forEach((f) => f())
    }
  }
  async function renderAll(ids: string[], onProgress?: (p: number) => void) {
    for (let i = 0; i < ids.length; i++) {
      const f = store.frames.get(ids[i])
      if (!f) continue
      while (f.status === 'exposed') {
        if (!photoBusy) await forceRender(f)
        else await new Promise<void>((r) => { const l = renderWaiters.get(f.id) ?? []; l.push(r); renderWaiters.set(f.id, l); window.setTimeout(r, 2000) })
      }
      onProgress?.((i + 1) / ids.length)
    }
  }
  async function forceRender(f: FrameRecord) {
    photoBusy = true
    try {
      const lat = await photo.render(f)
      store.setLatent(f.id, lat, { exposureEV: latentEV(lat, f.shots[0].camera.stock), accidents: [], w: lat.w, h: lat.h })
    } catch (e) {
      console.warn('[lensbench] render failed', e)
      const b = BODIES[f.shots[0].camera.body]
      const w = 192, h = Math.round((192 * b.format[1]) / b.format[0])
      store.setLatent(f.id, { w, h, data: new Uint8Array(w * h * 3).fill(encodeH(9.82 / STOCKS[f.shots[0].camera.stock].iso)), formatMm: b.format, ir: false }, { exposureEV: 0, accidents: [], w, h })
    } finally { photoBusy = false }
  }
  async function developRoll(rollId: string, dev: DevParams, onProgress?: (p: number) => void): Promise<string[]> {
    const r = store.rolls.get(rollId)
    if (!r) return []
    await renderAll(r.frames, onProgress)
    store.setDeveloped(rollId, dev)
    for (const id of r.frames) store.developed.delete(id)
    return [...r.frames]
  }
  function developed(id: string): DevelopedFrame | null {
    const hit = store.developed.get(id)
    if (hit) return hit
    const f = store.frames.get(id)
    const l = store.latents.get(id)
    if (!f || !l || f.status !== 'developed') return null
    const r = store.rolls.get(f.rollId)
    const d = developFrame(l, f.shots[0].camera.stock, r?.dev ?? { developer: 'mq', minutes: STOCKS[f.shots[0].camera.stock].normalMin, tempC: 20, agitation: 1 }, f.shots[0].seed)
    store.developed.set(id, d)
    return d
  }
  function grade(id: string, tag?: string, answer?: string): GradeResult {
    const f = store.frames.get(id)
    if (!f) return { pass: false, measures: {}, budget: {}, hash: 'none', fix: '' }
    return gradeFrame(f, world, store.latents.get(id) ?? null, tag, answer)
  }
  function deliver(id: string, tag: TagId, answer: string): GradeResult {
    const g = grade(id, tag, answer)
    const pr = store.get().progress
    const cur = pr.tags[tag] ?? { done: false, frameId: null, attempts: 0 }
    const def = TAGS.find((t) => t.id === tag)
    if (g.pass) {
      const unlockedList = [...new Set([...pr.unlocked, ...(def?.unlocks ?? [])])]
      store.set({ progress: { ...pr, unlocked: unlockedList, tags: { ...pr.tags, [tag]: { done: true, frameId: id, attempts: cur.attempts + 1 } } } })
      const done = Object.values(store.get().progress.tags).filter((t) => t?.done).length
      try { writeHubNote('lensbench', `${done} of 5 tags`) } catch { /* ignore */ }
      toast('ACCEPTED. A drawer slides open.')
      renderCork()
    } else {
      store.set({ progress: { ...pr, tags: { ...pr.tags, [tag]: { ...cur, attempts: cur.attempts + 1 } } } })
    }
    return g
  }

  // ---------------------------------------------------------------- router
  const screens = {} as { bench: BenchScreen; street: StreetScreen; tank: TankScreen; lightbox: LightboxScreen }
  let place: Place = 'bench'
  function goto(p: Place) {
    if (p === place && !roots[p].hidden) return
    screens[place]?.exit()
    place = p
    store.set({ place: p })
    for (const b of top.querySelectorAll<HTMLButtonElement>('.lb-tab')) { const on = b.dataset.place === p; b.setAttribute('aria-selected', String(on)); b.classList.toggle('on', on); if (on) b.classList.remove('pulse') }
    cork.hidden = p !== 'bench'
    if (p !== 'bench' && p !== 'street') gl.attachTo(null)
    if (p === 'street' && !store.get().progress.onboarded) markOnboarded()
    if (p === 'street') { const c = store.get().camera; const f = Math.abs(collimateShift(c)); if (f > 0.05) toast(`Q. collimated the lens: ${f.toFixed(1)} mm.`) }
    screens[p].enter()
    sfx.place(p)
    renderStatus()
  }
  function collimateShift(c: CameraSpec): number {
    if (!c.lens.elements.length) return 0
    const p = profile()
    const shift = -(p.p2z + p.efl)
    if (Math.abs(shift) > 0.05 && p.valid) {
      const lens = { ...c.lens, elements: c.lens.elements.map((e) => ({ ...e, z: e.z + shift })), stop: { ...c.lens.stop, z: c.lens.stop.z + shift } }
      store.set({ camera: { ...c, lens } })
    }
    return shift
  }
  function pulseTab(p: Place) { top.querySelector(`[data-place="${p}"]`)?.classList.add('pulse') }
  top.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.lb-tab'); if (b?.dataset.place) { sfx.unlock(); goto(b.dataset.place as Place) } })
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') || e.altKey || e.ctrlKey || e.metaKey) return
    if (place === 'street' && e.code === 'Tab') return
    const i = ['1', '2', '3', '4'].indexOf(e.key)
    if (i >= 0) goto(PLACES[i])
    else if ((e.key === 'm' || e.key === 'M') && place !== 'street') { /* the shell owns sound */ }
  })
  function renderStatus() {
    const s = store.get()
    const roll = store.roll()
    const pending = [...store.rolls.values()].filter((r) => r.state === 'rewound').length
    rollStatus.textContent = `${STOCKS[s.camera.stock].name} · ${roll ? roll.frames.length : 0}/${BODIES[s.camera.body].frames}${pending ? ` · ${pending} to develop` : ''}`
    const tb = top.querySelector('[data-place="tank"] .lb-badge') as HTMLElement
    tb.hidden = !pending; tb.textContent = String(pending)
  }
  function renderCork() {
    const pr = store.get().progress
    cork.innerHTML = TAGS.map((t, i) => {
      const done = !!pr.tags[t.id]?.done
      const avail = pr.spareKey || i === 0 || !!pr.tags[TAGS[i - 1].id]?.done
      return `<button class="lb-tag${done ? ' done' : ''}${avail ? '' : ' later'}" data-tag="${t.id}" title="${t.ask}"><b>${t.id.slice(1)}</b><span>${t.from}</span></button>`
    }).join('')
  }
  cork.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.lb-tag')
    const t = TAGS.find((x) => x.id === b?.dataset.tag)
    if (t) toast(`“${t.ask}” ${store.get().progress.tags[t.id]?.done ? '(done)' : `Hint: ${t.hint}`}`)
  })
  store.on('frames', renderStatus); store.on('rollId', renderStatus); store.on('camera', renderStatus)

  function markOnboarded() {
    const pr = store.get().progress
    if (!pr.onboarded) { store.set({ progress: { ...pr, onboarded: true } }); pulseTab('street') }
  }
  function share() {
    const c = store.get().camera
    const payload = { n: c.name, b: c.body, s: c.shutter, f: c.stock, x: c.filter, l: lensToCompact(c.lens) }
    const url = `${location.origin}${location.pathname}#cam=${b64urlEncode(JSON.stringify(payload))}`
    try { void navigator.clipboard?.writeText(url) } catch { /* ignore */ }
    try { history.replaceState(null, '', url) } catch { /* ignore */ }
    sfx.stamp()
    toast('Link copied. Anyone who opens it gets this camera on their bench.')
  }
  function loadCameraHash(h: string): boolean {
    const m = /cam=([A-Za-z0-9_-]+)/.exec(h)
    if (!m) return false
    const txt = b64urlDecode(m[1])
    if (!txt) return false
    try {
      const o = JSON.parse(txt) as { n?: string; b?: BodyId; s?: ShutterId; f?: StockId; x?: FilterId; l?: unknown }
      const lens = lensFromCompact(o.l)
      if (!lens) return false
      saveDesign(true)
      const cam: CameraSpec = { v: 1, name: String(o.n ?? 'A friend’s camera').slice(0, 40), lens, body: o.b && o.b in BODIES ? o.b : 'box', shutter: o.s && o.s in SHUTTERS ? o.s : 'leaf', stock: o.f && o.f in STOCKS ? o.f : 'pan100', filter: o.x ?? 'none' }
      store.set({ camera: cam, ext: 0 })
      profKey = ''
      store.set({ fNumber: profile().fNumber })
      clampSpeed()
      toast('A friend’s camera is on your bench.')
      return true
    } catch { return false }
  }
  function saveDesign(quiet = false) {
    const c = store.get().camera
    try { saveLens({ name: c.name || 'Untitled', design: c.lens }) } catch { /* ignore */ }
    if (!quiet) { sfx.stamp(); toast(`Saved to Q.’s card file as “${c.name}”.`) }
  }

  const app: App = {
    store, gl, world, finder, profile, setCamera, loadPreset, setAperture, clampSpeed, unlocked, toast, noteOnce, markOnboarded,
    share, saveDesign: () => saveDesign(false), renderGroundGlass, renderStreet,
    inertia: () => inertia(BODIES[store.get().camera.body].massG, store.get().camera.lens, profile()),
    nextSeed,
    onFired(f: FrameRecord) {
      const s = store.get()
      if (s.camera.lens.stop.kind === 'pinhole') noteOnce('pinhole', 'No glass, no lies. Everything is a little soft and nothing is wrong.')
      if (SHUTTERS[s.camera.shutter].travel > 0) noteOnce('fp', 'The curtain is a slit running for a bus. Anything faster than the bus gets bent.')
      if (s.camera.stock === 'ortho25') noteOnce('ortho', 'Blind to red. Load it under the safelight and paint your lips black.')
      const roll = store.roll()
      if (BODIES[s.camera.body].frames === 1 || (roll && roll.frames.length >= roll.capacity)) { toast('Sheet exposed. Rewind and take it to the tank.'); pulseTab('tank') }
      void f
    },
    rewind() {
      const r = store.rewind()
      if (r) { sfx.rewind(); toast(`Rewound: ${r.frames.length} frame${r.frames.length === 1 ? '' : 's'} for the tank.`); pulseTab('tank') }
      renderStatus()
    },
    developRoll, developed, grade, deliver, pulseTab,
  }
  screens.bench = deps.createBenchScreen(roots.bench, app)
  screens.street = deps.createStreetScreen(roots.street, app)
  screens.tank = deps.createTankScreen(roots.tank, app)
  screens.lightbox = deps.createLightboxScreen(roots.lightbox, app)
  for (const p of PLACES) roots[p].hidden = true

  // shell actions
  shell.setActions([
    { id: 'key', label: 'Spare key', icon: 'load', priority: 2, onSelect: () => { const pr = store.get().progress; store.set({ progress: { ...pr, spareKey: !pr.spareKey } }); toast(store.get().progress.spareKey ? 'Q.’s spare key: every drawer is open.' : 'Drawers locked again.'); renderCork(); screens.bench.redraw() } },
    { id: 'reset', label: 'Reset', icon: 'reset', priority: 3, onSelect: () => { void store.reset().then(() => location.reload()) } },
  ])
  shell.onSoundChange((m) => sfx.mute(m))

  // share link at load
  if (location.hash.includes('cam=')) loadCameraHash(location.hash)

  // ---------------------------------------------------------------- loop
  const loop = createLoop({ fixedDt: 1 / 60, autoStart: !test })
  loop.onFrame((dtReal) => {
    const dt = Math.min(0.1, dtReal)
    const s = store.get()
    if (!s.frozen) { worldT += dt; s.worldT = worldT }
    screens[place].update(dt)
    if (!photoBusy) void pumpQueue()
  })
  void prefersReducedMotion

  // ---------------------------------------------------------------- test API
  const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
  const frameNow = () => { const s = store.get(); screens[place].update(1 / 60); void s }
  function aimAt(id: TargetId) {
    const s = store.get()
    world.targets[id].at(worldT, tmpV)
    const dx = tmpV.x - s.pos[0], dy = tmpV.y - s.pos[1], dz = tmpV.z - s.pos[2]
    store.set({ yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) })
  }
  function focusTo(m: number | 'inf' | TargetId) {
    const p = profile()
    const s = store.get()
    let d: number
    if (m === 'inf') d = Infinity
    else if (typeof m === 'number') d = m
    else { world.targets[m].at(worldT, tmpV); d = Math.hypot(tmpV.x - s.pos[0], tmpV.y - s.pos[1], tmpV.z - s.pos[2]) }
    const ext = Number.isFinite(d) ? extForDistance(p.efl, d) : 0
    store.set({ ext: Math.min(BODIES[s.camera.body].extMax, ext) })
  }
  async function fireApi(o: { seed?: number; holdMs?: number; multiple?: boolean; panYawDegPerS?: number } = {}) {
    if (place !== 'street') goto('street')
    const s = store.get()
    if (!s.cocked && !o.multiple) store.advance()
    const shot = screens.street.fire(o)
    const f = shot ? store.frameList().find((x) => x.shots.includes(shot)) : null
    return { id: f?.id ?? '', status: f?.status ?? 'none' }
  }
  async function runRef(tag: string): Promise<{ pass: boolean; report: unknown }> {
    await store.reset()
    world.setTextSeed(store.get().progress.textSeed)
    const pr = store.get().progress
    store.set({ progress: { ...pr, spareKey: true, onboarded: true }, frozen: true })
    worldT = 12; store.get().worldT = 12
    const camera = (preset: PresetId, body: BodyId, stock: StockId, shutter?: ShutterId, filter: FilterId = 'none') => {
      loadPreset(preset)
      setCamera({ body, stock, shutter: shutter ?? BODIES[body].shutter, filter })
      profKey = ''
    }
    let answer = ''
    goto('street')
    if (tag === 'T01') {
      camera('pinhole', 'tin', 'pan100', 'cap')
      store.set({ timeOfDay: 13, shutterS: 0, tripod: true }); screens.street.standpoint('shopStep')
      await fireApi({ seed: 11, holdMs: 6000 })
    } else if (tag === 'T02') {
      camera('meniscus', 'box', 'pan100', 'leaf')
      setAperture(11); store.set({ timeOfDay: 13, shutterS: 1 / 125, tripod: false }); screens.street.standpoint('bakery')
      aimAt('bakeryYear'); focusTo(3.4)
      answer = world.targets.bakeryYear.answer?.(store.get().progress.textSeed) ?? ''
      await fireApi({ seed: 12 })
    } else if (tag === 'T03') {
      camera('portrait', 'rangefinder', 'pan400', 'clothFP')
      setAperture(3.6); store.set({ timeOfDay: 13, shutterS: 1 / 250, tripod: false, pos: [-10.2, 1.5, -4.95], standpoint: 'bakery' })
      aimAt('catEye'); focusTo('catEye')
      await fireApi({ seed: 13 })
    } else if (tag === 'T04') {
      camera('triplet', 'rangefinder', 'pan100', 'clothFP', 'nd64')
      setAperture(22); store.set({ timeOfDay: 17.5, shutterS: 0, tripod: true }); screens.street.standpoint('fountain')
      aimAt('reader'); focusTo('reader')
      await fireApi({ seed: 14, holdMs: 4200 })
    } else if (tag === 'T05') {
      camera('triplet', 'rangefinder', 'pan400', 'clothFP')
      const l = store.get().camera.lens
      store.set({ camera: { ...store.get().camera, lens: { ...l, stop: { ...l.stop, kind: 'iris', blades: 6, roundness: 0 } } } })
      profKey = ''
      setAperture(11); store.set({ timeOfDay: 22, shutterS: 2, tripod: true }); screens.street.standpoint('fountain')
      aimAt('lamp2'); focusTo('lamp2')
      // 2 s isn't on the dial: use B for 2 s
      store.set({ shutterS: 0 })
      await fireApi({ seed: 15, holdMs: 2000 })
    } else return { pass: false, report: 'unknown tag' }
    app.rewind()
    const ids = await screens.tank.develop({ minutes: STOCKS[store.get().camera.stock].normalMin, tempC: 20, agitation: 1 })
    const id = ids[ids.length - 1]
    const g = grade(id, tag, answer)
    return { pass: g.pass, report: { measures: g.measures, budget: g.budget, fix: g.fix, frame: id } }
  }
  async function selftest() {
    const results: { name: string; pass: boolean; got: unknown; want: unknown }[] = []
    for (const c of opticsSelftest()) if (!c.name.includes('≤ 0.5 ms') && !c.name.includes('≤ 5 ms')) results.push(c)
    for (const c of sunSelftest()) results.push(c)
    // sky calibration: grey card facing the sun at 13:00, L = 0.18·E/π (analytic; the renderer is fed lux/1000)
    world.setTimeOfDay(13)
    const sunS = world.sun()
    const E = sunS.normalLux + sunS.skyLux * 0.5
    const L = (0.18 * E) / Math.PI
    results.push({ name: 'grey card at 13:00 ≈ 6.1 kcd/m²', pass: Math.abs(L / 1000 - 6.1) / 6.1 < 0.12, got: +(L / 1000).toFixed(2), want: '6.1 ± 12%' })
    world.setTimeOfDay(store.get().timeOfDay)
    // shake ω_rms: a 600 g body with a 50 mm lens
    const tri = opticsPreset('triplet')
    const I = inertia(600, tri, computeProfile(tri, { w: 36, h: 24 }))
    const w = omegaRms(I, 3)
    results.push({ name: 'handheld ω_rms (600 g + 50 mm) ≈ 0.02 rad/s', pass: w > 0.014 && w < 0.026, got: +w.toFixed(4), want: '0.02 ± 30%' })
    // develop monotonicity: more exposure never gives less density (brighter latent → darker negative)
    const lat = { w: 64, h: 1, data: new Uint8Array(64 * 3), formatMm: [36, 24] as [number, number], ir: false }
    for (let i = 0; i < 64; i++) lat.data[i * 3] = lat.data[i * 3 + 1] = lat.data[i * 3 + 2] = i * 4
    const d = developFrame(lat, 'pan100', { developer: 'mq', minutes: 8, tempC: 20, agitation: 1 }, 1)
    let mono = true
    for (let i = 4; i < 64; i++) if (d.positive.data[i * 4] + 6 < d.positive.data[(i - 4) * 4]) mono = false
    results.push({ name: 'develop monotonic', pass: mono, got: mono, want: true })
    results.push({ name: 'latent codec', pass: Math.abs(Math.log2(decodeH(encodeH(1.234)) / 1.234)) < 0.05, got: encodeH(1.234), want: 'round trip' })
    return { pass: results.every((r) => r.pass), results }
  }

  installGameApi('lensbench', 'lensbench@1', {
    state() {
      const s = store.get()
      const p = profile()
      const roll = store.roll()
      return {
        place, camera: s.camera, profile: { efl: +p.efl.toFixed(3), fNumber: +p.fNumber.toFixed(3), bfd: +p.bfd.toFixed(3), lengthMm: +p.lengthMm.toFixed(2), massG: Math.round(p.massG), valid: p.valid, distortionPct: +p.distortion.edgePct.toFixed(3) },
        ext: s.ext, focusM: focusDistanceM(p.efl, s.ext), shutterS: s.shutterS, timeOfDay: s.timeOfDay, worldT, standpoint: s.standpoint, tripod: s.tripod,
        roll: roll ? { stock: roll.stock, used: roll.frames.length, capacity: roll.capacity } : null,
        frames: store.frames.size, undeveloped: [...store.frames.values()].filter((f) => f.status !== 'developed').length,
        tags: Object.fromEntries(TAGS.map((t) => [t.id, !!s.progress.tags[t.id]?.done])),
        meterEV: finder.meterEV(), persistent: store.persistent,
      }
    },
    async goto(p: Place) { goto(p); await sleep(0) },
    setQuality(q: QualityTier) { toast(`Quality: ${q} (reload to apply)`) },
    skipOnboarding() { markOnboarded(); const pr = store.get().progress; store.set({ progress: { ...pr, unlocked: [...new Set([...pr.unlocked, 'glass:crown', 'preset:meniscus'])] } }); screens.bench.redraw() },
    async resetSave() { await store.reset() },
    audioMute(on: boolean) { sfx.mute(on) },
    loadPreset(id: string) { loadPreset(id as PresetId); screens.bench.redraw() },
    setCamera(patch: Partial<CameraSpec>) { setCamera(patch); profKey = ''; screens.bench.redraw() },
    loadCameraHash(h: string) { loadCameraHash(h); screens.bench.redraw() },
    setAperture(n: number | 'heart') { setAperture(n); screens.bench.redraw() },
    setBlades(n: 0 | 5 | 6 | 8 | 9) { const c = store.get().camera; store.set({ camera: { ...c, lens: { ...c.lens, stop: { ...c.lens.stop, kind: c.lens.stop.kind === 'pinhole' ? 'pinhole' : 'iris', blades: n, roundness: n ? 0 : 1 } } } }); profKey = '' },
    focus(m: number | 'inf' | TargetId) { focusTo(m) },
    setShutter(s: number | 'B') { store.set({ shutterS: s === 'B' ? 0 : s }) },
    setStock(s: StockId) { setCamera({ stock: s }) },
    setFilter(f: FilterId) { setCamera({ filter: f }) },
    setTime(h: number) { store.set({ timeOfDay: h }); finder.settle() },
    setWorldTime(t: number) { worldT = t; store.get().worldT = t },
    freeze(on: boolean) { store.set({ frozen: on }) },
    standpoint(id: StandpointId) { screens.street.standpoint(id) },
    aim(yawDeg: number, pitchDeg: number) { store.set({ yaw: yawDeg * D2R, pitch: pitchDeg * D2R }) },
    aimAt(id: TargetId) { aimAt(id) },
    tripod(on: boolean) { store.set({ tripod: on }) },
    advance() { store.advance() },
    rewind() { app.rewind() },
    fire: fireApi,
    async develop(o?: Partial<DevParams>) { if (place !== 'tank') goto('tank'); return screens.tank.develop(o) },
    frames() { return store.frameList().map((f) => ({ id: f.id, status: f.status, meta: f.meta })) },
    openFrame(id: string) { if (place !== 'lightbox') goto('lightbox'); screens.lightbox.open(id) },
    replay() { /* SHOULD: slit replay */ },
    grade(id: string, tag?: string) { const g = grade(id, tag); return { pass: g.pass, measures: g.measures, budget: g.budget, hash: g.hash } },
    runRef,
    selftest,
    /** Render one live frame synchronously (tests). */
    step(n = 1) { for (let i = 0; i < n; i++) { if (!store.get().frozen) worldT += 1 / 60; frameNow() } },
    meterNow() { return finder.meterNow() },
    async renderQueue() { const ids = store.frameList().filter((f) => f.status === 'exposed').map((f) => f.id); await renderAll(ids); return ids.length },
  })

  // ---------------------------------------------------------------- first frame
  renderCork()
  renderStatus()
  goto(store.get().progress.onboarded ? (store.get().place === 'street' ? 'street' : 'bench') : 'bench')
  if (F.embed === 'poster') {
    // Hero composition for public/posters/lensbench.jpg: golden-hour fountain, no chrome.
    document.documentElement.classList.add('lb-poster')
    const compose = async () => {
      markOnboarded()
      store.set({ timeOfDay: 17.2, shutterS: 0, tripod: false, frozen: true })
      goto('street')
      screens.street.standpoint('fountain')
      aimAt('fountain')
      setAperture(8)
      focusTo(7)
      for (let i = 0; i < 6; i++) { loop.advance(1); screens.street.update(1 / 60); await sleep(80) }
      ;(window as unknown as { __game: { posterReady?: boolean } }).__game.posterReady = true
    }
    ;(window as unknown as { __game: { poster?: () => Promise<void> } }).__game.poster = compose
    void compose()
  }
  if (test) { loop.advance(1) } else loop.start()
  // first real frame: render the active place once, then mark ready
  screens[place].update(1 / 60)
  markReady()
  if (test) {
    // keep drawing at a low rate in test mode so screenshots show live views
    const tick = () => { screens[place].update(1 / 30); if (!photoBusy) void pumpQueue(); window.setTimeout(tick, 120) }
    window.setTimeout(tick, 120)
  }
  return app
}

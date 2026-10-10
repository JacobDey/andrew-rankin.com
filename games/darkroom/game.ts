// Darkroom app: loop, tiers, wiring of World / View / Input / UI / Audio / Save.
import { createContent } from './content/index'
import { createBus } from './events'
import { flags, localStore, reducedMotion, type HelpLite, type Platform } from './glue/platform'
import { createView } from './render/view'
import { createWorld, type WorldX } from './sim/world'
import { SHEET_RES, AUTOSAVE_S } from './constants'
import { STATIONS } from './layout'
import type { StationId } from './types'
import { createHud } from './ui/hud'
import { createInput } from './input/pointer'
import { bindKeys } from './input/keys'
import { createPersist } from './save/persist'
import { wireAudio } from './audio/world'
import { installDebug } from './debug'
import { createNotes } from './ui/notes'
import { createLogbook } from './ui/logbook'

export const HELP: HelpLite = {
  intro: 'Rock the tray and the picture appears only where the liquid touches the paper. Light is the enemy until the print is fixed.',
  controls: [
    { action: 'Change station', mouse: 'Drag empty bench sideways, or click a tab', touch: 'Swipe the bench, or tap a tab', keys: '← → or 1–6' },
    { action: 'Tilt a tray', mouse: 'Drag the tray', touch: 'Drag the tray', keys: 'W A S D' },
    { action: 'Rock a tray', mouse: 'ROCK tab by the tray', touch: 'ROCK tab', keys: 'R' },
    { action: 'Pick up or drop paper', mouse: 'Drag the sheet', touch: 'Drag the sheet', keys: 'Space' },
    { action: 'Dunk paper', mouse: 'Click it in the liquid', touch: 'Tap it', keys: '' },
    { action: 'Flip a sheet', mouse: 'Right-click', touch: 'Double-tap', keys: 'F' },
    { action: 'Room light', mouse: 'Flip the guard, then the switch', touch: 'Tap, tap', keys: 'L' },
    { action: 'Safelight', mouse: 'Pull the chain', touch: 'Tap the chain', keys: 'K' },
    { action: 'Expose', mouse: 'START on the timer', touch: 'START', keys: 'X' },
    { action: 'Dodge', mouse: 'Hover over the easel while exposing', touch: 'Finger on the easel', keys: 'H' },
    { action: 'Hang a print', mouse: 'Drop it on the line', touch: 'Drop it on the line', keys: 'Enter' },
    { action: 'Fast-forward', mouse: 'Hold the clock', touch: 'Hold the clock', keys: 'Hold .' },
    { action: 'Logbook', mouse: 'Logbook', touch: 'Logbook', keys: 'N' },
    { action: 'Pin the bench', mouse: 'Pin', touch: 'Pin', keys: 'Ctrl+S' },
  ],
  tips: [
    'Shadows show first, highlights last. Wait for the highlights.',
    'Stop, then fix for 30 s before the lights go on.',
    'Cyanotype: equal parts A and B, coat, dry, UV until the shadows bronze, then wash.',
    'Drop a PNG anywhere to make your own negative.',
  ],
}

export interface StartDeps { stage: HTMLElement; platform: Platform; bridge: Record<string, () => void> }

export async function startDarkroom(d: StartDeps): Promise<void> {
  const { stage, platform } = d
  const F = flags()
  const seed = F.seed ?? 7
  const tier = F.quality ?? (F.test || navigator.webdriver ? 'test' : matchMedia('(pointer: coarse)').matches ? 'medium' : 'high')
  const [sw, sh] = SHEET_RES[tier]
  const poster = F.embed === 'poster'
  if (F.reset) { try { for (const k of Object.keys(localStorage)) if (k.startsWith('ar:darkroom:') && k !== 'ar:darkroom:hub') localStorage.removeItem(k) } catch { /* ignore */ } }

  const persist = createPersist(platform)
  if (F.reset) await persist.clearAll()
  const firstRun = poster || !localStore.get<boolean>('firstRun', false)
  const content = createContent(seed)
  const bus = createBus()
  const world = createWorld(seed, content, bus, { sheetW: sw, sheetH: sh, lowFluid: false, firstRun: true }) as WorldX

  const canvas = document.createElement('canvas')
  canvas.className = 'dr-canvas'
  canvas.setAttribute('aria-label', 'The darkroom bench')
  stage.appendChild(canvas)
  const view = createView(canvas, world, { tier, reducedMotion: reducedMotion(), poster })
  const ro = new ResizeObserver(() => view.resize())
  ro.observe(stage)

  const notes = createNotes(stage, view, platform, bus)
  const logbook = createLogbook(platform, world, persist, bus)
  let paused = false
  const hud = createHud({ stage, world, view, platform, bus, notes, logbook, persist, firstRun })
  const input = createInput({ canvas, stage, world, view, hud, bus, platform })
  bindKeys({ world, view, hud, input, platform, logbook, persist })
  wireAudio(platform, bus, world)

  // pins + logbook bridge to the shell actions
  d.bridge.save = () => { void persist.pin(world, view).then((slot) => slot && hud.toast('Saved to the drawer.')) }
  d.bridge.load = () => logbook.open()
  d.bridge.import = () => hud.importPicker()
  d.bridge.reset = () => {
    for (const p of world.papers.slice()) if (p.place.at !== 'line') world.papers.splice(world.papers.indexOf(p), 1)
    for (const t of Object.values(world.trays)) world.cmd.refill(t.id)
    hud.toast('Tray emptied.')
  }

  bus.on('discover', (e) => {
    hud.toast(`Notebook: ${e.title}`)
    void persist.saveNotebook(world.discoveries)
    if (e.id === 'first-light' && !localStore.get<boolean>('seenHelpAfterFirst', false) && !F.test && !poster) {
      localStore.set('seenHelpAfterFirst', true)
      setTimeout(() => platform.shell.openHelp(), 1800)
    }
  })
  bus.on('printHung', (e) => {
    const p = world.paper(e.paperId)
    if (p) void persist.savePrint(p)
    const n = world.papers.filter((q) => q.place.at === 'line').length
    platform.writeHubNote(`${n} print${n === 1 ? '' : 's'} on the line`)
    if (!localStore.get<boolean>('firstRun', false)) localStore.set('firstRun', true)
  })

  // restore the bench
  if (!poster && !F.fresh) {
    const nb = await persist.loadNotebook()
    if (nb.length) for (const id of nb) if (!world.discoveries.includes(id)) world.discoveries.push(id)
    if (!firstRun) {
      const ok = await persist.loadPin(world, 'auto')
      if (ok) hud.toast('Back where you left it.')
    }
  }
  world.setParentPin(null)

  // ------------------------------------------------------------- loop
  const FIXED = 1 / 60
  let acc = 0
  let last = performance.now()
  let simMs = 0
  let fps = 60
  let saveT = 0
  const frame = (now: number) => {
    const dtReal = Math.min(0.1, (now - last) / 1000)
    last = now
    fps += (1 / Math.max(1e-3, dtReal) - fps) * 0.05
    if (!paused) {
      acc += dtReal
      let n = 0
      const t0 = performance.now()
      while (acc >= FIXED && n < 4) { world.tick(FIXED); acc -= FIXED; n++ }
      if (n >= 4) acc = 0
      simMs = performance.now() - t0
      saveT += dtReal
      if (saveT > AUTOSAVE_S && !poster) { saveT = 0; void persist.autosave(world) }
    }
    world.refreshAlbedos(2, world.time + now / 1000)
    view.frame(dtReal, world)
    hud.update(dtReal)
    notes.update(world.lights.room <= 0 && world.lights.safe <= 0)
    raf = requestAnimationFrame(frame)
  }
  let raf = requestAnimationFrame(frame)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); if (!poster) void persist.autosave(world) }
    else { last = performance.now(); raf = requestAnimationFrame(frame) }
  })
  addEventListener('pagehide', () => { if (!poster) void persist.autosave(world) })

  const api = installDebug({
    world, view, hud, persist, platform, content, input,
    setPaused: (on) => { paused = on },
    perf: () => ({ fps: Math.round(fps), fluidMs: 0, chemMs: simMs, renderMs: view.renderMs, tier }),
    tier,
  })
  void api
  // the first real frame
  view.frame(0, world)
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  platform.markReady()
  if (firstRun && !poster) notes.firstRun()
  const st = (new URLSearchParams(location.search).get('station') ?? '') as StationId
  if (STATIONS.some((s) => s.id === st)) hud.setStation(st)
}

// window.__game (architecture §3.7 + darkroom.md §13).
import type { Platform } from './glue/platform'
import type { WorldX } from './sim/world'
import { selftest } from './sim/selftest'
import type { DarkroomContent, Grade, LightId, Place, PrepSettings, StationId, TrayId, View } from './types'
import type { Hud } from './ui/hud'
import type { Persist } from './save/persist'
import type { Input } from './input/pointer'
import type { PrepDesk } from './ui/prepdesk'

const DEG = Math.PI / 180

export function installDebug(o: {
  world: WorldX; view: View; hud: Hud; persist: Persist; platform: Platform; content: DarkroomContent; input: Input
  setPaused(on: boolean): void; perf(): { fps: number; fluidMs: number; chemMs: number; renderMs: number; tier: string }; tier: string
}) {
  const { world, view, hud, persist, platform } = o
  const W = world.cmd
  ;(window as unknown as { __drView: View }).__drView = view
  let paused = false

  const step = (seconds: number) => {
    const n = Math.max(1, Math.round(seconds * 60))
    for (let i = 0; i < n; i++) world.tick(1 / 60)
    world.refreshAlbedos(99, world.time + 1e6 + n)
    if (seconds >= 0.25) view.snap()
    view.frame(Math.max(1 / 60, seconds), world)
    hud.update(1 / 60)
  }
  const findTitle = () => world.papers.find((p) => p.title === 'Title sheet') ?? world.papers[world.papers.length - 1]
  const resolve = (id?: string) => (id === 'title' ? findTitle()?.id : id) ?? world.papers[world.papers.length - 1]?.id
  const roomFlash = (s: number) => { W.guard(true); W.setLight('room', 1); step(s); W.setLight('room', 0) }
  const process = (id: string, chain: { tray: TrayId; s: number; rock?: boolean }[]) => {
    for (const c of chain) {
      W.moveTo(id, { at: 'tray', tray: c.tray })
      if (c.rock !== false) W.autoRock(c.tray, true)
      step(c.s)
      W.autoRock(c.tray, false)
    }
  }
  const newSheet = (kind: 'silver' | 'cyano' | 'title' | 'practice', place: Place = { at: 'easel' }): string => {
    const p = world.addPaper(kind === 'cyano' ? 'cyano' : 'silver', place, kind === 'title' ? 'Title sheet' : kind === 'practice' ? 'Practice sheet' : kind === 'cyano' ? 'Rag paper' : 'Sheet')
    if (kind === 'title') world.preExpose(p, 'title')
    if (kind === 'practice') world.preExpose(p, 'mailbox')
    return p.id
  }
  const expose = (e: { seconds: number; grade?: Grade; negative?: string; dodge?: { x: number; z: number; seconds: number }; strip?: boolean }) => {
    let p = world.papers.find((q) => q.place.at === 'easel')
    if (!p) p = world.paper(newSheet('silver', { at: 'easel' }))
    if (e.grade) W.setGrade(e.grade)
    if (e.negative !== undefined) W.loadNegative(e.negative || null)
    W.setTimer(e.seconds)
    W.startExposure(e.strip ? 'strip' : 'normal')
    const total = e.strip ? e.seconds * 5 : e.seconds
    if (e.dodge) {
      W.setOccluder({ tool: 'hand', x: e.dodge.x, z: e.dodge.z, rot: 0, height01: 0.4 })
      step(Math.min(total, e.dodge.seconds))
      W.setOccluder(null)
      step(Math.max(0, total - e.dodge.seconds) + 0.1)
    } else step(total + 0.1)
    return p?.id ?? ''
  }
  const coat = (id: string, c: { ml?: number; tool?: 'brush' | 'rod'; ratio?: number } = {}) => {
    const ml = c.ml ?? 6, r = c.ratio ?? 0.5
    W.pour('A', ml * r); W.pour('B', ml * (1 - r))
    for (let k = 0; k < 5; k++) { W.loadTool(c.tool ?? 'brush'); W.stroke(id, -0.08, 0.1 + k * 0.2, 1.08, 0.12 + k * 0.2, 0.5) }
    world.refreshAlbedos(99, world.time + 1e6)
  }
  const desk = () => (hud as Hud & { prep: PrepDesk }).prep

  const api = {
    mode: () => 'webgl2' as const,
    state: () => ({
      time: world.time, station: hud.station, lights: { ...world.lights }, exposureX: world.exposureX, carried: world.carried,
      papers: world.papers.map((p) => ({ id: p.id, kind: p.kind, title: p.title, place: p.place })), discoveries: world.discoveries.slice(),
      timer: { ...world.timer }, enlarger: { negative: world.enlarger.negative, grade: world.enlarger.grade }, paused, shared: platform.sharedLoaded,
    }),
    async poster() {
      document.documentElement.dataset.embed = 'poster'
      o.setPaused(true); paused = true
      W.setLight('room', 0); W.setLight('safe', 1)
      hud.setStation('trays')
      view.setFocus('trays', 0)
      const t = world.trays.dev
      W.holdTray('dev', 4 * DEG, 0)
      step(6)
      W.releaseTray('dev')
      step(0.35)
      void t
    },
    pause(on: boolean) { paused = on; o.setPaused(on) },
    seed(_n: number) { /* the seed is fixed at boot: reload with ?seed=N */ },
    step,
    station(id: StationId, sub?: number) { hud.setStation(id, sub); step(1) },
    lights(s: Partial<Record<LightId, boolean | number>>) {
      for (const [k, v] of Object.entries(s)) { if (k === 'room' && v) W.guard(true); W.setLight(k as LightId, v as boolean | number) }
    },
    tilt(tray: TrayId, degX: number, degY: number) { W.holdTray(tray, degX * DEG, degY * DEG) },
    release(tray: TrayId) { W.releaseTray(tray) },
    rock(tray: TrayId, on: boolean) { W.autoRock(tray, on) },
    newSheet,
    place(id: string, where: Place) { W.moveTo(resolve(id) ?? id, where) },
    expose,
    async loadPNG(dataUrl: string, prep?: Partial<PrepSettings>): Promise<string> {
      const blob = await (await fetch(dataUrl)).blob()
      const d = desk()
      await d.loadFile(blob, 'test.png')
      if (prep) Object.assign(d.settings, prep)
      d.update(0.016)
      const id = d.output('8x10')
      W.putInFrame(id)
      return id
    },
    coat,
    peroxide(tray: TrayId, x = 0, y = 0) { W.peroxide(tray, x, y) },
    async demo(name: string) {
      if (name === 'title') { W.setLight('safe', 1); W.autoRock('dev', true); step(30); W.autoRock('dev', false); return }
      if (name === 'first-print') {
        const id = findTitle()?.id
        if (!id) return
        W.setLight('safe', 1)
        process(id, [{ tray: 'dev', s: 20 }, { tray: 'stop', s: 10 }, { tray: 'fix', s: 32 }])
        W.guard(true); W.setLight('room', 1)
        process(id, [{ tray: 'wash', s: 20 }])
        W.hang(id)
        hud.setStation('trays')
        step(1)
        return
      }
      if (name === 'fog') {
        W.setLight('room', 0)
        const id = newSheet('practice', { at: 'tray', tray: 'dev' })
        roomFlash(1)
        process(id, [{ tray: 'dev', s: 45 }, { tray: 'stop', s: 5 }, { tray: 'fix', s: 30 }])
        W.hang(id)
        return
      }
      if (name === 'enlarger') {
        W.setLight('room', 0); W.setLight('safe', 1)
        hud.setStation('enlarger')
        const id = newSheet('silver', { at: 'easel' })
        expose({ seconds: 10, grade: '2', negative: 'mailbox', dodge: { x: 1.79, z: 0.40, seconds: 3 } })
        world.paper(id)!.log.dodgeS = 3
        process(id, [{ tray: 'dev', s: 90 }, { tray: 'stop', s: 10 }, { tray: 'fix', s: 32 }])
        hud.setStation('trays')
        step(0.5)
        return
      }
      if (name === 'sabattier') {
        W.setLight('safe', 1)
        const id = newSheet('silver', { at: 'easel' })
        expose({ seconds: 10, grade: '2', negative: 'mailbox' })
        process(id, [{ tray: 'dev', s: 25 }])
        W.moveTo(id, { at: 'tray', tray: 'dev' })
        roomFlash(1 / 30)
        process(id, [{ tray: 'dev', s: 40 }, { tray: 'stop', s: 10 }, { tray: 'fix', s: 32 }])
        return
      }
      if (name === 'photogram') {
        W.setLight('safe', 1)
        hud.setStation('enlarger')
        W.placeProp('fern', 1.72, 0.38, 0.2); W.placeProp('key', 1.8, 0.47, 0.6)
        const id = newSheet('silver', { at: 'easel' })
        expose({ seconds: 6, grade: '2', negative: '' })
        W.placeProp('fern', 1.36, 0.24, 0); W.placeProp('key', 1.36, 0.24, 0)
        process(id, [{ tray: 'dev', s: 60 }, { tray: 'stop', s: 10 }, { tray: 'fix', s: 32 }])
        return
      }
      if (name === 'cyanotype' || name === 'cyanotype-expose') {
        W.guard(true); W.setLight('room', 1)
        hud.setStation('iron')
        const id = newSheet('cyano', { at: 'coat' })
        coat(id)
        W.blow(6.02, 0.44, true); step(20); W.blow(6.02, 0.44, false)
        if (!world.iron.frameNegative) { const n = world.negatives.listNegatives().find((q) => q.format === '8x10'); if (n) W.putInFrame(n.id) }
        W.moveTo(id, { at: 'frame' })
        world.iron.frameIn = 'uvbox'
        hud.setStation('window')
        W.setUVLid(true); step(65); W.setUVLid(false)
        if (name === 'cyanotype-expose') return
      }
      if (name === 'cyanotype' || name === 'cyanotype-wash') {
        const p = world.papers.find((q) => q.kind === 'cyano' && (q.place.at === 'frame' || q.place.at === 'uvbox'))
        if (!p) return
        W.moveTo(p.id, { at: 'tray', tray: 'wash' })
        hud.setStation('sink')
        W.tap(true); W.autoRock('wash', true); step(20); W.autoRock('wash', false); W.tap(false)
        step(1)
        return
      }
      if (name === 'peroxide') {
        const p = world.papers.find((q) => q.kind === 'cyano' && q.place.at === 'tray')
        hud.setStation('sink')
        W.peroxide('wash', p?.body.x ?? 0, p?.body.y ?? 0)
        step(0.05)
        return
      }
    },
    stats(id?: string) { return world.stats(resolve(id)) },
    discoveries: () => world.discoveries.slice(),
    selftest,
    async save(slot: number | 'auto') { if (slot === 'auto') await persist.autosave(world); else await persist.pin(world, view, String(slot)) },
    async load(slot: number | 'auto') { const ok = await persist.loadPin(world, String(slot)); if (ok) hud.toast('Back where you left it.'); step(1 / 60); return ok },
    anchor(name: string) {
      const r = (view as unknown as { renderer: { domElement: HTMLCanvasElement } }).renderer.domElement.getBoundingClientRect()
      if (name === 'chain') { const el = document.querySelector('.dr-chain') as HTMLElement | null; if (el) { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, visible: true } } }
      const p = view.project(name)
      return { x: p.x + r.left, y: p.y + r.top, visible: p.visible }
    },
    perf: o.perf,
    world, view, hud,
  }
  platform.installApi(api as unknown as Record<string, unknown> & { state(): unknown })
  return api
}

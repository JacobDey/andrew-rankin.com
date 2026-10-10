// Wiring: the app, the four stations, the print session and the film process, plus the handful of
// game rules that span stations (hanging, stamps, stages, tape lines, the tutorial print).
import { App } from '../core/app'
import { S, addPrint, advanceClock, autosave, bus, hang as hangPrint, legibleFacts, markDeveloped, setFlag, storePrintD, tape } from '../core/state'
import type { DevResult, FactId, FrameRef } from '../core/types'
import { ROLL7_DEV, TUTORIAL, recipe, rollMeta } from '../data/rolls'
import { UNPROMPTED } from '../data/text'
import { createNegative } from '../film/filmModel'
import { FilmProcess, fmtTime } from '../film/process'
import { createFrameStore, type FrameStore } from '../frames/frameStore'
import { PH, PW, intensity } from '../print/optics'
import { PrintSession } from '../print/session'
import { createDarkroomStation, type DarkroomStation } from '../stations/darkroom'
import { showEnding } from '../stations/ending'
import { createLightTableStation } from '../stations/lightTable'
import { createLineStation } from '../stations/line'
import { createTerminalStation } from '../stations/terminal'

export interface Game {
  app: App; frames: FrameStore; ps: PrintSession; film: FilmProcess
  darkroom: DarkroomStation
  terminal: ReturnType<typeof createTerminalStation>
  lightTable: ReturnType<typeof createLightTableStation>
  line: ReturnType<typeof createLineStation>
  loadCarrier(ref: FrameRef): Promise<void>
  devFor(roll: number): DevResult | null
  hang(): string | null
  close(d: 'FILE' | 'PURGE', keep?: string): ReturnType<typeof showEnding>
  developed(roll: number, dev: DevResult): void
}

export function createGame(stage: HTMLElement): Game {
  const frames = createFrameStore()
  const app = new App(stage, frames)
  const ps = new PrintSession()
  const film = new FilmProcess()
  const seed = S.save.seed
  if (!S.save.rolls[7]) S.save.rolls[7] = { developed: true, dev: ROLL7_DEV, kinks: ROLL7_DEV.kinks }
  if (S.save.shelf) { film.load(S.save.shelf, seed) }

  function devFor(roll: number): DevResult | null { const r = S.save.rolls[roll]; return r?.developed && r.dev ? r.dev : null }

  async function loadCarrier(ref: FrameRef): Promise<void> {
    const dev = devFor(ref.roll)
    const rec = recipe(ref.roll, ref.frame)
    if (!dev || !rec) return
    const img = await frames.get(ref)
    ps.setNegative(ref, createNegative(img, dev, rollMeta(ref.roll), rec.ev), img, rec.details)
    bus.emit('carrier:load', ref)
    darkroom.refresh()
  }

  function developed(roll: number, dev: DevResult): void {
    markDeveloped(roll, dev)
    S.save.shelf = null
    const push = dev.tDev >= 700 ? '+2' : dev.tDev >= 590 ? '+1' : 'OK'
    tape(`ROLL ${roll} DEV ${fmtTime(dev.tDev)}`, push)
    advanceClock(20)
    app.blinkRail('lighttable')
    lightTable.showRoll(roll)
    const n = rollMeta(roll).frames
    frames.prefetch(Array.from({ length: Math.min(12, n) }, (_, i) => ({ roll, frame: i + 1 })))
    autosave()
  }

  function hang(): string | null {
    const rec = ps.record(S.save.clock)
    const s = ps.sheet
    if (!rec || !s) return null
    addPrint(rec)
    void storePrintD(rec.id, s.D.slice())
    hangPrint(rec.id)
    advanceClock(6)
    for (const l of rec.legible) tape(`* LEGIBLE R${rec.ref.roll}/F${rec.ref.frame}`)
    if (rec.ref.roll === TUTORIAL.roll && rec.ref.frame === TUTORIAL.frame) setFlag('A')
    const facts = new Set<FactId>(legibleFacts())
    if (facts.has('HEEL_TANNERY') || facts.has('HEEL_PARTY') || facts.has('HEEL_PLANT')) setFlag('E')
    if (facts.has('KDL_PLANT')) setFlag('F')
    if (facts.has('HEIGHT_MARKS') || facts.has('HEIGHT_MARKS_2')) setFlag('H')
    const printed = S.save.prints
    if (printed.some((p) => p.ref.roll === 3 && p.ref.frame >= 2 && p.ref.frame <= 4) && printed.some((p) => p.ref.roll === 8 && p.ref.frame === 5)) setFlag('I')
    if (facts.has('MINA_1987')) setFlag('J')
    if (!S.save.unprompted.dock && rec.ref.roll === 7 && (rec.ref.frame === 9 || rec.ref.frame === 10) && rec.legible.length) { S.save.unprompted.dock = true; setTimeout(() => app.phone({ text: UNPROMPTED.dock, ring: true }), 1500) }
    const first = !S.save.tutorialDone
    S.save.tutorialDone = true
    ps.sheet = null
    app.sfx('latent.drip')
    app.toast(rec.legible.length ? 'Hung on the line. Stamped LEGIBLE.' : 'Hung on the line.')
    app.blinkRail('line')
    if (first) setTimeout(() => app.blinkRail('terminal'), 900)
    darkroom.refresh()
    autosave()
    return rec.id
  }

  const darkroom = createDarkroomStation(app, ps, film, {
    hang: () => { hang() },
    newPaper: () => {
      if (ps.sheet && ps.sheet.where === 'easel' && ps.sheet.exposed === 0) return
      if (ps.sheet && ps.sheet.where !== 'easel' && ps.sheet.F < 1) { app.toast('Finish the print in the trays first, or double-click it to crumple it.'); return }
      ps.newSheet(); app.sfx('latent.tok')
    },
    onExposeEnd: () => { /* the exposure is part of the sheet's recipe */ },
    developed: () => { /* replaced below */ },
    legible: () => {
      const ok = (ps.sheet?.legible ?? []).filter((l) => l.pass)
      if (ok.length) { app.sfx('latent.stamp'); app.haptic(60); app.stopLoop('latent.cluster') }
      app.sfx('latent.timer-bell')
    },
  })
  // the film process reports through the same hook object
  const hooksDev = () => { const dev = film.phase === 'done' ? lastDev : null; if (dev) developed(film.roll, dev) }
  let lastDev: DevResult | null = null
  const origPourOut = film.pourOut.bind(film)
  film.pourOut = () => { lastDev = origPourOut(); if (lastDev) hooksDev(); return lastDev }

  const terminal = createTerminalStation(app, {
    onClose: (d) => { close(d) },
    developedAny: () => Object.keys(S.save.rolls).some((k) => Number(k) !== 7 && S.save.rolls[Number(k)]?.developed),
    envelopeCount: () => S.save.envelope.length,
  })
  const lightTable = createLightTableStation(app, {
    sendToTank: (roll) => {
      if (film.phase !== 'none' && film.phase !== 'done') return
      S.save.shelf = roll; film.load(roll, seed); autosave()
      app.go('darkroom'); darkroom.setPane(0)
    },
    toCarrier: (ref) => { void loadCarrier(ref).then(() => { app.go('darkroom'); darkroom.setPane(1); app.sfx('latent.clunk') }) },
    shelfBusy: () => film.phase !== 'none' && film.phase !== 'done',
  })
  const line = createLineStation(app)
  for (const st of [terminal, lightTable, darkroom, line]) app.add(st)

  function close(d: 'FILE' | 'PURGE', keep?: string): ReturnType<typeof showEnding> {
    const k = d === 'PURGE' ? keep ?? S.save.line[S.save.line.length - 1] : undefined
    return showEnding(app, d, k)
  }

  // the tutorial print waiting in the easel
  async function setupTutorial(): Promise<void> {
    if (S.save.tutorialDone) { if (!ps.enl.ref) await loadCarrier(TUTORIAL); return }
    await loadCarrier(TUTORIAL)
    ps.set({ M: 5.2, cx: 18, cy: 12, grade: 3, timer: 8, redFilter: true })
    ps.refreshT()
    // meter: put the median of the slate area at mid-grey
    const vals: number[] = []
    for (let j = PH * 0.25; j < PH * 0.75; j += 4) for (let i = PW * 0.25; i < PW * 0.75; i += 4) vals.push(ps.T[Math.floor(j) * PW + Math.floor(i)])
    vals.sort((a, b) => a - b)
    const Tm = Math.max(1e-4, vals[vals.length >> 1])
    ps.newSheet(true)
    ps.exposeOps({ seconds: Math.min(60, (0.9 * 1.3) / (intensity(ps.enl.M) * Tm)) })
    darkroom.refresh()
  }

  const game: Game = { app, frames, ps, film, darkroom, terminal, lightTable, line, loadCarrier, devFor, hang, close, developed }
  void setupTutorial()
  return game
}

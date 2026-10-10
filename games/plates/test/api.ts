// games/plates/test/api.ts — window.__game for plates (GDD §13.2 on top of architecture §3.7).
// Every method is safe at any time; animated ones are async. Time advances through rock()/advance().
import { PLATE_IDS, PLATE_W, PLATE_H, type PlateId, type Bath, type Station, type LightMode, type SoulId, type FateId, type FindingId, type InspectOpts, type Where } from '../contracts'
import type { PlatesApp } from '../app'
import { readable } from '../bench/grade'
import { maxH, meanOf } from '../bench/chem'
import { hex3, PALETTES } from '../render/palette'

export function platesTestApi(app: PlatesApp) {
  const { bench, book, lib } = app
  const steps = (seconds: number) => Math.max(1, Math.round(seconds * 60))
  const toWhere = (id: PlateId, to: Bath | 'table' | 'rack' | 'tin' | 'bench'): Where =>
    to === 'dev' || to === 'water' || to === 'hypo' ? { kind: 'tray', bath: to } : to === 'rack' ? { kind: 'rack', slot: PLATE_IDS.indexOf(id) } : { kind: to }
  const ensureOpen = async (id: PlateId) => { const n = lib.meta(id).bundle; if (!bench.opened.has(n)) await bench.openBundle(n) }
  const api = {
    version: 'plates-1',
    meta: (id: PlateId) => lib.meta(id),
    state() {
      return {
        screen: app.screen, station: app.station, tray: app.tray, palette: app.palette, light: { ...app.ctx.light },
        plates: PLATE_IDS.map((id) => {
          const c = bench.chem(id), w = bench.wedge(id)
          return { id, where: bench.where(id), P: Math.round(meanOf(c.P) * 100) / 100, Hmax: Math.round(maxH(c) * 1000) / 1000, F: Math.round(meanOf(c.F) * 1000) / 1000, fixed: c.fixed, grade: c.fixed ? w.grade : 'unfixed' }
        }),
        bundles: app.bundles, book: book.model.status(), pins: app.pins.slots.filter(Boolean).length, wick: app.wick, paneRead: app.paneRead,
        errors: window.__game?.errors() ?? [],
      }
    },
    freezeSea(on = true) { app.freezeSea(on) },
    wave(strength?: number) { app.wave(strength) },
    setTimeScale(k: number) { app.setTimeScale(k) },
    setStation(s: Station) { return app.setStation(s) },
    focusTray(b: Bath | null) { return app.focusTray(b) },
    setLight(m: LightMode) { app.setLight(m); app.renderOnce() },
    setWick(w: number) { app.setWick(w) },
    async openBundle(n: 1 | 2 | 3 | 4) { await bench.openBundle(n); app.renderOnce() },
    async place(id: PlateId, to: Bath | 'table' | 'rack' | 'tin' | 'bench') { await ensureOpen(id); bench.place(id, toWhere(id, to)); if (to !== 'table') app.renderOnce(); else await app.inspect(id) },
    async rock(seconds: number, pattern: 'corners' | 'lr' | 'still' = 'corners') {
      const b = PLATE_IDS.map((id) => bench.where(id)).find((w) => w.kind === 'tray')
      if (!app.tray && b && b.kind === 'tray') await app.focusTray(b.bath)
      bench.rock(pattern)
      const n = steps(seconds)
      for (let i = 0; i < n; i += 30) { app.advance(Math.min(30, n - i)); await new Promise((r) => setTimeout(r, 0)) }
      bench.rock(null)
      app.renderOnce()
    },
    develop(id: PlateId, P: number) { bench.setChem(id, { P }); app.renderOnce() },
    fix(id: PlateId) { void ensureOpen(id); if (bench.where(id).kind === 'tin') bench.place(id, { kind: 'rack', slot: PLATE_IDS.indexOf(id) }); bench.setChem(id, { H: 0 }); app.renderOnce() },
    fog(id: PlateId, F: number) { bench.setChem(id, { F }); app.renderOnce() },
    wedge: (id: PlateId) => bench.wedge(id),
    readable(id: PlateId, hotspotId: string) { const h = lib.meta(id).hotspots.find((x) => x.id === hotspotId); return !!h && readable(bench.wedge(id), h) },
    async inspect(id: PlateId | 'pane' | null, o?: InspectOpts) { if (id && id !== 'pane') await ensureOpen(id); await app.inspect(id, o) },
    openBook(page?: 'persons' | 'findings' | 'sector' | 'documents') { if (app.table.isOpen) app.table.close(); book.open(page) },
    closeBook() { book.close() },
    answerPerson(fig: number, name: SoulId, fate: FateId, agent?: SoulId) { book.model.reveal(fig); book.model.setPerson(fig, { name, fate, agent: agent ?? null }) },
    answerFinding(f: FindingId, v: 'stands' | 'withdraw', plate: PlateId) { book.model.setFinding(f, v, plate) },
    answerSector(q: 'when' | 'who' | 'why', v: string) { book.model.setSector(q, v) },
    liftPane() { app.liftPane(); app.advance(60) },
    replacePane() { app.replacePane(); app.renderOnce() },
    readPane: () => app.readPane(),
    solveAll() { book.model.solveAll(); if (book.isOpen) book.render() },
    seal: (named: boolean | null) => app.seal(named),
    pin: () => app.pin(),
    restore: (i: number) => app.restore(i),
    resetSave: () => app.resetSave(),
    fps: () => app.fps(),
    perf: () => app.perf(),
    advance(frames = 1, dt?: number) { app.advance(frames, dt) },
    step(frames = 1) { app.advance(frames) },
    /** Fraction of canvas pixels within ΔE of the active palette's ink or light (two-colour check). */
    twoColourCheck(): number {
      if (app.table.isOpen) return app.table.twoColourCheck()
      app.renderOnce()
      const gl = app.ctx.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const pal = PALETTES[app.palette], a = hex3(pal.ink).map((v) => v * 255), b = hex3(pal.light).map((v) => v * 255)
      let ok = 0
      for (let i = 0; i < px.length; i += 4) if (Math.min(Math.hypot(px[i] - a[0], px[i + 1] - a[1], px[i + 2] - a[2]), Math.hypot(px[i] - b[0], px[i + 1] - b[1], px[i + 2] - b[2])) < 8) ok++
      return ok / (w * h)
    },
    plateSize: [PLATE_W, PLATE_H],
    async poster() {
      await ensureOpen('p00')
      bench.place('p00', { kind: 'tray', bath: 'dev' }); bench.setChem('p00', { P: 30 })
      await app.focusTray('dev'); app.advance(30)
    },
  }
  return api
}
export type PlatesTestApi = ReturnType<typeof platesTestApi>

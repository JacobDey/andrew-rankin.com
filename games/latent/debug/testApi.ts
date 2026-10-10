// window.__game for Latent Image (GDD §13, merged onto the base contract of architecture §3.7).
import { installGameApi } from '@shared/core'
import { S, currentStage, clockText, legibleFacts, setFlag, setLights } from '../core/state'
import type { DevResult, EnlargerState, FactId, PrintOps, Settings, StageId, StationId } from '../core/types'
import { DOCS } from '../data/docs'
import { ROLLS, ROLL7_DEV, allDetails, recipe, rollMeta } from '../data/rolls'
import { createNegative, makeDev } from '../film/filmModel'
import { evaluateLegibility, naiveOps, simulatePrint, solveDetail } from '../print/simulate'
import { search } from '../search'
import type { Game } from '../glue/game'

const VOCAB: [string, number][] = [
  ['HOLD', 6], ['KESSANE', 9], ['ODGERS', 1], ['4471', 2], ['KDL', 1], ['417', 1], ['KDL 417', 1], ['LUSK', 4], ['KINK', 1], ['CRESCENT', 1],
  ['FLOOD', 1], ['PLAQUE', 1], ['WICK', 2], ['LANTERN', 0], ['PORT AVEL', 3], ['AVEL', 3], ['DX', 1], ['CHECKERBOARD', 1], ['STAIRWELL', 0], ['HALE', 12],
  ['KESSANE CONTRACT', 2], ['KESSANE PORT', 2], ['BOOT', 1], ['DENTAL', 1], ['HALE DENTAL', 1], ['STATURE', 1], ['FEMUR', 1], ['HOARSE', 1], ['14.06.41', 2],
]
const MUST_FAIL = new Set(['BURIED', 'BLOWN', 'MIRRORED', 'PUSHED'])

export function installTestApi(game: Game): void {
  const { app, ps, terminal } = game
  const normalDev = (): DevResult => makeDev({ tDev: 480, inversionsPerMin: 8, rapped: true })
  const defaultDev = (roll: number): DevResult => roll === 7 ? ROLL7_DEV : roll === 8 || roll === 9 ? makeDev({ tDev: 765, inversionsPerMin: 8, rapped: true }) : normalDev()

  function developRoll(roll: number, o: { minutes?: number; inversionsPerMin?: number; rap?: boolean; kinks?: number } = {}): DevResult {
    if (roll === 7) return ROLL7_DEV
    const kinks = Array.from({ length: o.kinks ?? 0 }, (_, i) => ({ frame: 1 + (i % 12), x: 0.07, y: 0.88, rot: 30 * i }))
    const dev = makeDev({ tDev: (o.minutes ?? 8) * 60, inversionsPerMin: o.inversionsPerMin ?? 8, rapped: o.rap ?? true, kinks })
    game.developed(roll, dev)
    return dev
  }

  async function print(roll: number, frame: number, ops: PrintOps | 'solution' | 'naive' = 'solution'): Promise<{ id: string; legible: FactId[]; rho: Record<string, number> }> {
    if (!game.devFor(roll)) developRoll(roll, roll === 8 || roll === 9 ? { minutes: 12.75 } : {})
    await game.loadCarrier({ roll, frame })
    const rec = recipe(roll, frame)!
    let o: PrintOps
    if (ops === 'naive') o = naiveOps()
    else if (ops === 'solution') {
      const d = rec.details[0]
      if (!d || !ps.neg || !ps.img) o = { ...naiveOps(), M: 5, grade: 3 }
      else o = solveDetail(ps.neg, ps.img, d).ops
    } else o = ops
    ps.set({ M: o.M, cx: o.cx, cy: o.cy, flip: o.flip, focus: o.focus ?? undefined, grade: o.grade })
    if (o.focus === undefined) ps.set({ focus: 0.15 + (0.7 * (Math.log(o.M) - Math.log(2))) / (Math.log(16) - Math.log(2)) })
    ps.newSheet()
    ps.exposeOps({ seconds: o.seconds, dodge: o.dodge, burn: o.burn })
    ps.moveTo('dev')
    ps.developInstant(o.devSeconds, false)
    ps.stopInstant()
    const res = ps.fixInstant()
    const id = game.hang() ?? ''
    const rho: Record<string, number> = {}
    for (const r of res) rho[r.fact] = Math.round(r.rho * 100) / 100
    return { id, legible: res.filter((r) => r.pass).map((r) => r.fact), rho }
  }

  async function solve(): Promise<{ detail: FactId; frame: string; solution: number; naive: number; pass: boolean }[]> {
    const rows: { detail: FactId; frame: string; solution: number; naive: number; pass: boolean }[] = []
    for (const { recipe: r, detail: d } of allDetails()) {
      const img = await game.frames.get({ roll: r.roll, frame: r.frame })
      const neg = createNegative(img, defaultDev(r.roll), rollMeta(r.roll), r.ev)
      const sol = solveDetail(neg, img, d)
      const nNeg = r.roll === 7 ? neg : createNegative(img, normalDev(), rollMeta(r.roll), r.ev)
      const nOps = naiveOps()
      const nv = evaluateLegibility(img, [d], nOps, simulatePrint(nNeg, nOps))[0]
      const mustFail = d.pattern.some((p) => MUST_FAIL.has(p)) || (d.pattern.includes('SMALL') && d.mMin > 4)
      rows.push({ detail: d.id, frame: `R${r.roll}/F${r.frame}`, solution: Math.round(sol.result.rho * 100) / 100, naive: Math.round(nv.rho * 100) / 100, pass: sol.result.pass && (!mustFail || !nv.pass) })
    }
    return rows
  }

  function lint(): string[] {
    const out: string[] = []
    const ids = new Set<string>()
    for (const d of DOCS) { if (ids.has(d.id)) out.push(`duplicate doc ${d.id}`); ids.add(d.id) }
    if (DOCS.length !== 43) out.push(`expected 43 documents, have ${DOCS.length}`)
    for (const [q, n] of VOCAB) { const r = search(q); const c = r.status === 'ok' ? r.count : r.status === 'none' ? 0 : -1; if (c !== n) out.push(`${q}: expected ${n}, got ${c} (${r.status})`) }
    for (const k of ROLL7_DEV.kinks) {
      const rec = recipe(7, k.frame)
      for (const d of rec?.details ?? []) { const [x, y, w, h] = d.bbox; if (k.x > x - 0.03 && k.x < x + w + 0.03 && k.y > y - 0.03 && k.y < y + h + 0.03) out.push(`crescent overlaps ${d.id} on R7/F${k.frame}`) }
    }
    if (ROLLS.length !== 11) out.push('expected 11 rolls')
    return out
  }

  installGameApi('latent', 'latent@1', {
    state: () => ({
      station: S.station, clock: clockText(), lights: S.save.lights !== 'off', lightMode: S.save.lights, stage: currentStage(), flags: { ...S.save.flags },
      rollsDeveloped: Object.keys(S.save.rolls).map(Number).filter((r) => S.save.rolls[r]?.developed), prints: S.save.prints.length,
      legible: legibleFacts(), tape: S.save.tape.length, fps: Math.round(app.fps), lowPower: false, persistent: S.persistent,
      film: game.film.phase, sheet: ps.sheet ? { where: ps.sheet.where, exposed: ps.sheet.exposed, F: ps.sheet.F } : null, enlarger: { ...ps.enl },
    }),
    layout: () => app.active?.layout() ?? {},
    goto: (s: StationId) => app.go(s),
    lights: (on: boolean) => { setLights(on ? 'safe' : 'off'); app.applyPalette(); game.darkroom.refresh() },
    white: (on: boolean) => { setLights(on ? 'white' : 'safe'); app.applyPalette(); game.darkroom.refresh() },
    search: (q: string) => { const r = terminal.search(q); return { count: r.count, shown: r.shown, status: r.status } },
    openDoc: (id: string) => { app.go('terminal'); terminal.openDoc(id) },
    developRoll,
    frameReady: async (roll: number, frame: number) => { await game.frames.get({ roll, frame }) },
    load: (roll: number, frame: number) => game.loadCarrier({ roll, frame }),
    setEnlarger: (p: Partial<EnlargerState>) => { ps.set(p); game.darkroom.refresh() },
    expose: (o: { seconds: number; dodge?: PrintOps['dodge']; burn?: PrintOps['burn'] }) => { if (!ps.sheet || ps.sheet.where !== 'easel') ps.newSheet(); ps.exposeOps(o) },
    develop: (seconds: number, o: { rock?: boolean } = {}) => { ps.developInstant(seconds, !!o.rock); game.darkroom.refresh() },
    stop: () => { ps.stopInstant(); game.darkroom.refresh() },
    fix: () => { const r = ps.fixInstant(); game.darkroom.refresh(); return r.map((x) => ({ fact: x.fact, pass: x.pass, rho: x.rho })) },
    hang: () => game.hang(),
    print,
    envelope: (ids: string[]) => { S.save.envelope = ids.slice(0, 6) },
    close: (d: 'FILE' | 'PURGE', keep?: string) => { const t = game.close(d, keep); return { clippings: t.clippings.map((c) => c.h), fax: t.fax, last: t.last } },
    solve,
    lint,
    seed: (n: number) => { S.save.seed = n },
    skipTo: (stage: StageId) => { const order: StageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']; for (const s of order) { if (s === stage) break; setFlag(s) } },
    setSetting: (k: keyof Settings, v: unknown) => { (S.save.settings as unknown as Record<string, unknown>)[k] = v },
    twoColourCheck: () => app.screen.twoColourCheck(app.palette()),
    advance: (frames = 1, dt = 1 / 60) => { for (let i = 0; i < frames; i++) app.frame(dt) },
  })
}

// SaveV1 store: state, mutations, stage flags, the receipt tape, autosave (GDD §8; keys per architecture §3.8).
import { createBus, flags as urlFlags } from '@shared/core'
import { debouncedSave, idb, local, writeHubNote } from '@shared/storage'
import type { DevResult, Events, FactId, Lights, PrintRecord, SaveV1, Settings, StageId, StationId } from './types'

export const CLOCK_END = 539 // 05:59
export const bus = createBus<Events>()

export function defaultSettings(): Settings {
  return { steadyHands: false, bagLights: false, reducedMotion: false, highContrast: false, textSize: 1, screenshotMode: false }
}

export function freshSave(seed: number): SaveV1 {
  return {
    v: 1, seed, clock: 0, flags: {}, tape: [], docsRead: [], rolls: {}, prints: [], line: [], envelope: [],
    settings: defaultSettings(), stats: { searches: 0, sheets: 0, calls: 0, kinks: 0 }, hints: {},
    tutorialDone: false, lights: 'off', shelf: null, unprompted: { first: false, dock: false, van: false },
  }
}

const store = local('latent')
const prints = idb('latent')
const f = urlFlags()

export const S: { save: SaveV1; station: StationId; persistent: boolean; printD: Map<string, Float32Array> } = {
  save: freshSave(f.seed ?? 1979),
  station: 'darkroom',
  persistent: store.persistent,
  printD: new Map(),
}

export function loadSlot0(): boolean {
  if (f.fresh || f.embed === 'poster') return false
  try {
    const s = store.get<SaveV1 | null>('slot0', null)
    if (s && s.v === 1) {
      S.save = { ...freshSave(s.seed), ...s, settings: { ...defaultSettings(), ...s.settings }, unprompted: Object.assign({ first: false, dock: false, van: false }, s.unprompted) }
      return true
    }
  } catch (e) { console.debug('[latent] load', e) }
  return false
}

const saver = debouncedSave(() => {
  if (f.fresh || f.embed === 'poster') return
  try { store.set('slot0', S.save) } catch (e) { console.debug('[latent] save', e) }
  try {
    const n = S.save.prints.filter((p) => p.fixed).length
    writeHubNote('latent', S.save.ending ? `Closed · ${S.save.ending.disposition}` : n ? `${n} print${n === 1 ? '' : 's'} on the line` : 'In the darkroom')
  } catch { /* ignore */ }
}, 2000)
export function autosave(): void { saver.request() }
export function flushSave(): Promise<void> { return saver.flush() }
export function newGame(): void { S.save = freshSave(S.save.seed); S.printD.clear(); autosave() }

export async function storePrintD(id: string, D: Float32Array): Promise<void> {
  S.printD.set(id, D)
  if (f.fresh || f.embed === 'poster') return
  const q = new Uint8Array(D.length)
  for (let i = 0; i < D.length; i++) q[i] = Math.max(0, Math.min(255, Math.round((D[i] / 2) * 255)))
  try { await prints.set(`print:${id}`, q) } catch (e) { console.debug('[latent] print save', e) }
}
export async function loadPrintD(id: string): Promise<Float32Array | null> {
  const hit = S.printD.get(id)
  if (hit) return hit
  try {
    const q = await prints.get<Uint8Array>(`print:${id}`)
    if (!q) return null
    const D = new Float32Array(q.length)
    for (let i = 0; i < q.length; i++) D[i] = (q[i] / 255) * 2
    S.printD.set(id, D)
    return D
  } catch { return null }
}

// ---- clock and tape ----
export function clockText(m = S.save.clock): string {
  const t = (21 * 60 + Math.min(CLOCK_END, Math.floor(m))) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
export function advanceClock(min: number): void { S.save.clock = Math.min(CLOCK_END, S.save.clock + min) }
export function tape(text: string, count?: string, lower = false): void {
  S.save.tape.push({ clock: S.save.clock, text, count, lower })
  bus.emit('dirty', undefined)
  autosave()
}
export function setFlag(id: StageId): void {
  if (S.save.flags[id]) return
  S.save.flags[id] = true
  autosave()
}
/** First unmet stage (A..K) for hints. */
export function currentStage(): StageId {
  const order: StageId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
  return order.find((s) => !S.save.flags[s]) ?? 'K'
}
export function setLights(l: Lights): void { S.save.lights = l; bus.emit('lights', l); autosave() }

// ---- rolls and prints ----
export function rollDeveloped(roll: number): DevResult | null {
  const r = S.save.rolls[roll]
  return r && r.developed && r.dev ? r.dev : null
}
export function markDeveloped(roll: number, dev: DevResult): void {
  S.save.rolls[roll] = { developed: true, dev, kinks: dev.kinks }
  S.save.stats.kinks += dev.kinks.length
  setFlag('C')
  if ((roll === 8 || roll === 9) && dev.r >= 1.4) setFlag('G')
  bus.emit('roll:developed', { roll, dev })
  autosave()
}
export function addPrint(p: PrintRecord): void {
  S.save.prints.push(p)
  S.save.stats.sheets++
  autosave()
}
export function printById(id: string): PrintRecord | undefined { return S.save.prints.find((p) => p.id === id) }
export function legibleFacts(): FactId[] { return [...new Set(S.save.prints.flatMap((p) => (p.fogged ? [] : p.legible.map((l) => l.fact))))] }
export function hang(id: string): void {
  if (!S.save.line.includes(id)) S.save.line.push(id)
  bus.emit('print:hung', id)
  autosave()
}
export function nextPrintId(): string { return `p${Date.now().toString(36)}${S.save.prints.length}` }
export function toggleEnvelope(id: string): boolean {
  const e = S.save.envelope
  const i = e.indexOf(id)
  if (i >= 0) { e.splice(i, 1); autosave(); return false }
  if (e.length >= 6) return false
  e.push(id); autosave(); return true
}

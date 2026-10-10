// games/plates/save/pins.ts — the drying line's pins (GDD §8): 6 manual + 3 rolling auto pins, each a
// WetSnapshot plus the lamp. A pin rolls back physical darkroom state only, never the Return.
import type { KV } from '@shared/storage'
import type { WetSnapshot } from '../contracts'

export interface PinRecord { index: number; createdAt: number; auto: boolean; thumb: ImageData | null; snap: WetSnapshot; lamp: { windowIn: boolean; wick: number } }
export interface Pins {
  readonly slots: (PinRecord | null)[]
  pin(slot: number | null, rec: Omit<PinRecord, 'index' | 'createdAt' | 'auto'>): number
  autopin(rec: Omit<PinRecord, 'index' | 'createdAt' | 'auto'>): number
  get(i: number): PinRecord | null
  remove(i: number): void
  newestAuto(): number | null
  load(): Promise<void>
  clear(): Promise<void>
}

export function createPins(kv: KV | null): Pins {
  const slots: (PinRecord | null)[] = new Array(9).fill(null)
  const persist = (i: number) => { if (!kv) return; const r = slots[i]; (r ? kv.set(`pin:${i}`, r) : kv.del(`pin:${i}`)).catch((e) => console.debug('[plates] pin save', e)) }
  const pins: Pins = {
    slots,
    pin(slot, rec) {
      let i = slot ?? slots.findIndex((s, k) => k < 6 && !s)
      if (i < 0 || i > 5) i = 5
      slots[i] = { ...rec, index: i, createdAt: Date.now(), auto: false }
      persist(i)
      return i
    },
    autopin(rec) {
      // oldest of the three auto pegs is replaced
      let i = 6, oldest = Infinity
      for (let k = 6; k < 9; k++) { const s = slots[k]; if (!s) { i = k; break } if (s.createdAt < oldest) { oldest = s.createdAt; i = k } }
      slots[i] = { ...rec, index: i, createdAt: Date.now(), auto: true }
      persist(i)
      return i
    },
    get(i) { return slots[i] ?? null },
    remove(i) { slots[i] = null; persist(i) },
    newestAuto() { let best = -1, t = -1; for (let k = 6; k < 9; k++) { const s = slots[k]; if (s && s.createdAt > t) { t = s.createdAt; best = k } } return best < 0 ? null : best },
    async load() {
      if (!kv) return
      for (let i = 0; i < 9; i++) { try { const r = await kv.get<PinRecord>(`pin:${i}`); if (r && r.snap) slots[i] = r } catch (e) { console.debug('[plates] pin load', e) } }
    },
    async clear() { for (let i = 0; i < 9; i++) slots[i] = null; if (kv) await kv.clear('pin:').catch(() => undefined) },
  }
  return pins
}

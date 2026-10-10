// Saved lens designs, shared with Sunny 16's "Q.'s drawer" (architecture §4.8, storage key §3.8).
import type { LensDesign } from './types'
import { decodeLens, encodeLens } from './codec'

export interface SavedLens { name: string; design: LensDesign; patent?: string; savedAt: number }

const KEY = 'ar:lensbench:lenses'
const MAX = 50

function readRaw(): { name: string; lens: string; patent?: string; savedAt: number }[] {
  try {
    const s = globalThis.localStorage?.getItem(KEY)
    if (!s) return []
    const v: unknown = JSON.parse(s)
    if (!Array.isArray(v)) return []
    return v.filter((x): x is { name: string; lens: string; patent?: string; savedAt: number } =>
      !!x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string' && typeof (x as { lens?: unknown }).lens === 'string')
  } catch {
    return []
  }
}

export function listSavedLenses(): SavedLens[] {
  const out: SavedLens[] = []
  for (const r of readRaw()) {
    const design = decodeLens(r.lens)
    if (design) out.push({ name: r.name, design, patent: r.patent, savedAt: Number(r.savedAt) || 0 })
  }
  return out
}

export function saveLens(l: Omit<SavedLens, 'savedAt'>): void {
  try {
    const list = readRaw().filter((r) => r.name !== l.name)
    list.unshift({ name: l.name.slice(0, 40), lens: encodeLens(l.design), patent: l.patent, savedAt: Date.now() })
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* storage unavailable: nothing to do */
  }
}

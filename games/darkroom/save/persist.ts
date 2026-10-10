// Persistence (darkroom.md §8): pins pin:1…pin:6 and pin:auto, prints print:<id>,
// imported images binder:<id>, meta:notebook. Uses @shared/storage idb('darkroom')
// when present (through glue/platform), else a private local database.
import type { Platform } from '../glue/platform'
import type { WorldX } from '../sim/world'
import type { Paper, Snapshot, View } from '../types'

export interface PinMeta { id: string; label: string; savedAt: number; thumb?: Blob; prints: number }
export interface PrintRecord { id: string; no: number; title: string; kind: 'silver' | 'cyano'; savedAt: number; png: Blob; w: number; h: number; log: Paper['log']; line: string }

export function logLine(p: Paper): string {
  const L = p.log
  const parts: string[] = [`No. ${String(L.no || 0).padStart(3, '0')}`]
  if (p.kind === 'silver') {
    const ex = L.exposures.filter((e) => e.source !== 'enlarger' || L.exposures.length === 1)
    if (ex.length) parts.push(ex.map((e) => `Gr ${e.grade ?? '—'} · ${e.seconds.toFixed(e.seconds < 10 ? 1 : 0)} s${e.strip ? ' strip' : ''}`).join(' + '))
    if (L.dodgeS > 0.2) parts.push(`dodge ${L.dodgeS.toFixed(1)} s`)
    if (L.burnS > 0.2) parts.push(`+${L.burnS.toFixed(1)} s burn`)
    parts.push(`Dev ${Math.round(L.dev)} s`, `Stop ${Math.round(L.stop)} s`, `Fix ${Math.round(L.fix)} s`)
    if (L.wash > 1) parts.push(`Wash ${L.wash >= 60 ? (L.wash / 60).toFixed(1) + ' m' : Math.round(L.wash) + ' s'}`)
    parts.push('RC Pearl 8×10')
  } else {
    parts.push(`UV ${Math.round(L.uv)} s`, `Wash ${Math.round(L.wash)} s`)
    if (L.peroxide) parts.push('peroxide')
    parts.push('Rag 8×10')
  }
  if (L.fogged) parts.push('fogged')
  return parts.join(' · ')
}

function albedoPng(p: Paper): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = p.W * 2; c.height = p.H * 2
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const src = document.createElement('canvas')
  src.width = p.W; src.height = p.H
  const sg = src.getContext('2d') as CanvasRenderingContext2D
  const img = sg.createImageData(p.W, p.H)
  img.data.set(p.albedo)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
  sg.putImageData(img, 0, 0)
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b ?? new Blob()), 'image/png'))
}

export function createPersist(platform: Platform) {
  const kv = platform.kv
  let pinCount = 0
  const api = {
    async clearAll() { for (const k of await kv.keys('')) await kv.del(k) },
    async autosave(world: WorldX) {
      try { await kv.set('pin:auto', { meta: { id: 'auto', label: 'Autosave', savedAt: Date.now(), prints: world.papers.length }, snap: world.serialize() }) } catch (e) { console.debug('[darkroom] autosave failed', e) }
    },
    async pin(world: WorldX, view: View, slot?: string): Promise<string | null> {
      let id = slot
      if (!id) {
        const used = new Set((await kv.keys('pin:')).map((k) => k.slice(4)))
        id = ['1', '2', '3', '4', '5', '6'].find((s) => !used.has(s)) ?? String((pinCount++ % 6) + 1)
      }
      let thumb: Blob | undefined
      try { thumb = await view.thumbnail() } catch { thumb = undefined }
      const meta: PinMeta = { id, label: `Pin ${id}`, savedAt: Date.now(), thumb, prints: world.papers.length }
      await kv.set('pin:' + id, { meta, snap: world.serialize() })
      world.setParentPin(id)
      return id
    },
    async loadPin(world: WorldX, id: string): Promise<boolean> {
      const rec = await kv.get<{ meta: PinMeta; snap: Snapshot }>('pin:' + id)
      if (!rec?.snap) return false
      try { world.deserialize(rec.snap); world.setParentPin(id === 'auto' ? null : id); return true } catch (e) { console.debug('[darkroom] pin load failed', e); return false }
    },
    async listPins(): Promise<PinMeta[]> {
      const out: PinMeta[] = []
      for (const k of await kv.keys('pin:')) { const r = await kv.get<{ meta: PinMeta }>(k); if (r?.meta) out.push(r.meta) }
      return out.sort((a, b) => (a.id === 'auto' ? 1 : b.id === 'auto' ? -1 : a.id.localeCompare(b.id)))
    },
    async savePrint(p: Paper) {
      const png = await albedoPng(p)
      const rec: PrintRecord = { id: p.id + ':' + p.log.no, no: p.log.no, title: p.title, kind: p.kind, savedAt: Date.now(), png, w: p.W * 2, h: p.H * 2, log: JSON.parse(JSON.stringify(p.log)), line: logLine(p) }
      await kv.set('print:' + rec.id, rec)
    },
    async listPrints(): Promise<PrintRecord[]> {
      const out: PrintRecord[] = []
      for (const k of await kv.keys('print:')) { const r = await kv.get<PrintRecord>(k); if (r) out.push(r) }
      return out.sort((a, b) => b.savedAt - a.savedAt)
    },
    async saveNotebook(ids: string[]) { await kv.set('meta:notebook', ids.slice()) },
    async loadNotebook(): Promise<string[]> { return (await kv.get<string[]>('meta:notebook')) ?? [] },
    async saveBinder(id: string, blob: Blob, prep: unknown) { await kv.set('binder:' + id, { blob, prep, savedAt: Date.now() }) },
    albedoPng,
  }
  return api
}
export type Persist = ReturnType<typeof createPersist>

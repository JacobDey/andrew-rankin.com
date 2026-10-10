// games/plates/content/library.ts — createPlateLibrary(): PlateLibrary with an in-memory exposure
// cache and an optional persistent cache hook (keys exp:<id>:<CONTENT_VERSION>).
import { CONTENT_VERSION, PLATE_IDS, type PlateId, type PlateLibrary, type PlateMeta, type ExposureMap } from '../contracts'
import type * as THREE from 'three'
import { defOf, metaOf } from './plates'
import { exposePlate } from './expose'

export interface ExposureCache { get(key: string): Promise<Uint8Array | undefined>; set(key: string, v: Uint8Array): Promise<void> }

export interface PlatesLibrary extends PlateLibrary {
  /** Synchronous access to an exposure already generated (null if not yet). */
  cached(id: PlateId): ExposureMap | null
  setCache(c: ExposureCache | null): void
}

export function createPlateLibrary(): PlatesLibrary {
  const mem = new Map<string, ExposureMap>()
  const pending = new Map<string, Promise<ExposureMap>>()
  let store: ExposureCache | null = null
  const key = (id: PlateId, q: string) => `exp:${id}:${CONTENT_VERSION}:${q}`
  const lib: PlatesLibrary = {
    list(): PlateMeta[] { return PLATE_IDS.map((id) => metaOf(id)) },
    meta(id: PlateId): PlateMeta { return metaOf(id) },
    cached(id: PlateId): ExposureMap | null { return mem.get(key(id, 'full')) ?? mem.get(key(id, 'low')) ?? null },
    setCache(c) { store = c },
    expose(id: PlateId, _renderer: THREE.WebGLRenderer, quality: 'low' | 'full'): Promise<ExposureMap> {
      const k = key(id, quality)
      const hit = mem.get(k)
      if (hit) return Promise.resolve(hit)
      const p0 = pending.get(k)
      if (p0) return p0
      const p = (async () => {
        if (store) {
          try { const b = await store.get(k); if (b && b.length) { const e = { id, L: b }; mem.set(k, e); return e } } catch { /* cache miss */ }
        }
        await new Promise((r) => setTimeout(r, 0))
        const e = exposePlate(defOf(id), quality)
        mem.set(k, e)
        if (store) store.set(k, e.L).catch(() => undefined)
        return e
      })()
      pending.set(k, p)
      return p.finally(() => pending.delete(k))
    },
  }
  return lib
}

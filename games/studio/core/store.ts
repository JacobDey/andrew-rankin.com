// Persistence (studio.md §8, architecture §3.8): IndexedDB store `studio` via @shared/storage; keys `house`,
// `roll:<id>`, `latent:<frameId>`, `neg:<frameId>`, `print:<id>`. Writes debounced 500 ms through one queue.
// Fallback: memory + `ar:studio:house` in localStorage (no blobs).
import { idb, local } from '@shared/storage'
import { storageDisabled } from '@shared/core'
import type { HouseState } from './contracts'

export interface Store {
  persistent: boolean
  house: HouseState
  saveHouse(patch?: Partial<HouseState>): void
  put(key: string, value: unknown): Promise<void>
  get<T>(key: string): Promise<T | undefined>
  del(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
  flush(): Promise<void>
  clear(): Promise<void>
}

export const POSTCARD_IDS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']

export function defaultHouse(seed: number): HouseState {
  const postcards: HouseState['postcards'] = {}
  for (const id of POSTCARD_IDS) postcards[id] = { state: id === 'P1' ? 'open' : 'unissued', misses: 0 }
  return {
    v: 1, seed,
    owned: ['oatcan', 'pinhole', 'cap', 'ortho25', 'tripod'],
    builds: [{ v: 1, body: 'oatcan', lens: 'pinhole', shutter: 'cap', stock: 'ortho25', pinholeMm: 0.45, pinholeRagged: 0, accessories: [] }],
    activeBuild: 0,
    rollInCamera: null,
    pocket: [],
    postcards,
    fridge: [null, null, null, null, null, null, null, null],
    tutorial: {},
    dayHours: 16 + 40 / 60,
    tripod: { pos: [1.5, 0, 4], yaw: 0, pitch: -4, height: 1.3 },
    props: {},
    settings: { erect: false, captions: false, steady: false, quality: 'auto' },
    frameCursor: 0,
    wound: true,
    negatives: [],
    prints: [],
  }
}

export async function createStore(seed: number): Promise<Store> {
  const kv = idb('studio')
  const ls = local('studio')
  const disabled = storageDisabled()
  let house = defaultHouse(seed)
  if (!disabled) {
    try {
      const h = await kv.get<HouseState>('house')
      if (h && h.v === 1) house = { ...defaultHouse(seed), ...h }
      else {
        const fb = ls.get<HouseState | null>('house', null)
        if (fb && fb.v === 1) house = { ...defaultHouse(seed), ...fb }
      }
    } catch {
      /* fresh house */
    }
  }
  let timer = 0
  let pending: Promise<void> = Promise.resolve()
  const write = async () => {
    if (disabled) return
    const snapshot = JSON.parse(JSON.stringify(house)) as HouseState
    try {
      await kv.set('house', snapshot)
    } catch {
      /* ignore */
    }
    if (!kv.persistent) ls.set('house', snapshot)
  }
  const store: Store = {
    persistent: kv.persistent && !disabled,
    get house() {
      return house
    },
    set house(h: HouseState) {
      house = h
    },
    saveHouse(patch) {
      if (patch) Object.assign(house, patch)
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        pending = pending.then(write)
      }, 500)
    },
    async put(key, value) {
      if (disabled) {
        mem.set(key, value)
        return
      }
      await kv.set(key, value)
    },
    async get<T>(key: string) {
      if (disabled) return mem.get(key) as T | undefined
      return kv.get<T>(key)
    },
    async del(key) {
      if (disabled) {
        mem.delete(key)
        return
      }
      await kv.del(key)
    },
    async keys(prefix) {
      if (disabled) return [...mem.keys()].filter((k) => k.startsWith(prefix))
      return kv.keys(prefix)
    },
    async flush() {
      clearTimeout(timer)
      pending = pending.then(write)
      await pending
    },
    async clear() {
      clearTimeout(timer)
      if (!disabled) await kv.clear()
      mem.clear()
      try {
        ls.del('house')
      } catch {
        /* */
      }
      house = defaultHouse(seed)
    },
  }
  const mem = new Map<string, unknown>()
  window.addEventListener('pagehide', () => void store.flush())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void store.flush()
  })
  return store
}

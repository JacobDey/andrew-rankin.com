// @shared/storage: IndexedDB + localStorage persistence (architecture.md §3.8, §4.2).
// One IndexedDB database 'andrew-rankin' with one object store per slug; localStorage keys 'ar:<slug>:<key>'.
// Every read and write is wrapped in try/catch; with storage unavailable (private mode, or
// embed=poster / fresh=1) the stores fall back to memory and report persistent: false.

import type { GameSlug } from '../games'
import { storageDisabled, flags } from '../core/flags'

export const DB_NAME = 'andrew-rankin'
export const DB_VERSION = 1
export const STORES = ['hub', 'texturedle', 'darkroom', 'plates', 'latent', 'lensbench', 'studio', 'filmcan'] as const
export type StoreName = (typeof STORES)[number]

// ---------------------------------------------------------------------------------------------
// IndexedDB key-value stores
// ---------------------------------------------------------------------------------------------

export interface KV {
  readonly persistent: boolean
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(prefix?: string): Promise<string[]>
  clear(prefix?: string): Promise<void>
}

let dbPromise: Promise<IDBDatabase | null> | null = null
let dbBroken = false
const kvCache = new Map<StoreName, KV>()
const memoryStores = new Map<StoreName, Map<string, unknown>>()

function memStore(store: StoreName): Map<string, unknown> {
  let m = memoryStores.get(store)
  if (!m) memoryStores.set(store, (m = new Map()))
  return m
}

function clone<T>(v: T): T {
  try {
    return structuredClone(v)
  } catch {
    return v
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (storageDisabled() || dbBroken) return resolve(null)
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        db.onclose = () => {
          dbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => {
        dbBroken = true
        resolve(null)
      }
      req.onblocked = () => {
        /* another tab holds an older version; wait */
      }
    } catch {
      dbBroken = true
      resolve(null)
    }
  })
  return dbPromise
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })
}

function prefixRange(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, prefix + '￿')
}

function createKV(store: StoreName): KV {
  let usingMemory = storageDisabled() || typeof indexedDB === 'undefined'
  const fail = (): void => {
    usingMemory = true
  }
  const mem = memStore(store)

  async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T>): Promise<T | undefined> {
    if (usingMemory) return undefined
    const db = await openDb()
    if (!db) {
      fail()
      return undefined
    }
    try {
      const t = db.transaction(store, mode)
      const done = mode === 'readwrite' ? txDone(t) : null
      done?.catch(() => {}) // observed below; this stops an unhandled-rejection report if fn throws first
      const res = await fn(t.objectStore(store))
      if (done) await done
      return res
    } catch {
      // Quota, a closed connection, a blocked upgrade: degrade to memory rather than throw into game code.
      fail()
      return undefined
    }
  }

  return {
    get persistent() {
      return !usingMemory
    },
    async get<T>(key: string): Promise<T | undefined> {
      if (!usingMemory) {
        const r = await withStore('readonly', (s) => reqP(s.get(key)))
        if (!usingMemory) return r as T | undefined
      }
      return clone(mem.get(key)) as T | undefined
    },
    async set(key, value) {
      if (!usingMemory) {
        await withStore('readwrite', async (s) => {
          s.put(value, key)
        })
        if (!usingMemory) return
      }
      mem.set(key, clone(value))
    },
    async del(key) {
      if (!usingMemory) {
        await withStore('readwrite', async (s) => {
          s.delete(key)
        })
        if (!usingMemory) return
      }
      mem.delete(key)
    },
    async keys(prefix) {
      if (!usingMemory) {
        const r = await withStore('readonly', (s) => reqP(prefix ? s.getAllKeys(prefixRange(prefix)) : s.getAllKeys()))
        if (!usingMemory) return (r ?? []).map(String)
      }
      const out = [...mem.keys()].filter((k) => !prefix || k.startsWith(prefix))
      out.sort()
      return out
    },
    async clear(prefix) {
      if (!usingMemory) {
        await withStore('readwrite', async (s) => {
          if (prefix) s.delete(prefixRange(prefix))
          else s.clear()
        })
        if (!usingMemory) return
      }
      if (!prefix) mem.clear()
      else for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k)
    },
  }
}

/** The key-value store for a slug. Cheap to call repeatedly. */
export function idb(store: StoreName): KV {
  let kv = kvCache.get(store)
  if (!kv) kvCache.set(store, (kv = createKV(store)))
  return kv
}

/** Test hook: drop cached connections and stores so the next call re-opens (used by the storage dev page). */
export function _resetStorageForTests(o: { clearMemory?: boolean; dbBroken?: boolean } = {}): void {
  void dbPromise?.then((db) => db?.close())
  dbPromise = null
  kvCache.clear()
  dbBroken = o.dbBroken ?? false
  if (o.clearMemory) memoryStores.clear()
}

// ---------------------------------------------------------------------------------------------
// localStorage (synchronous, JSON)
// ---------------------------------------------------------------------------------------------

export interface LocalStore {
  readonly persistent: boolean
  get<T>(key: string, dflt: T): T
  set(key: string, value: unknown): void
  del(key: string): void
  keys(): string[]
  clear(): void
}

const lsMemory = new Map<string, string>() // full keys, used when localStorage is unavailable or disabled

function lsAvailable(): Storage | null {
  if (storageDisabled()) return null
  try {
    const s = window.localStorage
    const probe = '__ar_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

const localCache = new Map<string, LocalStore>()

/** JSON under 'ar:<slug>:<key>'. Falls back to memory when localStorage throws or storage is disabled. */
export function local(slug: StoreName): LocalStore {
  let st = localCache.get(slug)
  if (st) return st
  const prefix = `ar:${slug}:`
  let memOnly = false
  const ls = (): Storage | null => {
    if (memOnly) return null
    const s = lsAvailable()
    if (!s) memOnly = true
    return s
  }
  st = {
    get persistent() {
      return ls() !== null
    },
    get<T>(key: string, dflt: T): T {
      try {
        const s = ls()
        const raw = s ? s.getItem(prefix + key) : (lsMemory.get(prefix + key) ?? null)
        if (raw === null) return dflt
        return JSON.parse(raw) as T
      } catch {
        return dflt
      }
    },
    set(key, value) {
      let raw: string
      try {
        raw = JSON.stringify(value)
      } catch {
        return
      }
      if (raw === undefined) return
      const s = ls()
      if (s) {
        try {
          s.setItem(prefix + key, raw)
          return
        } catch {
          /* quota: fall through to memory */
        }
      }
      lsMemory.set(prefix + key, raw)
    },
    del(key) {
      try {
        ls()?.removeItem(prefix + key)
      } catch {
        /* ignore */
      }
      lsMemory.delete(prefix + key)
    },
    keys() {
      const out = new Set<string>()
      try {
        const s = ls()
        if (s) for (let i = 0; i < s.length; i++) {
          const k = s.key(i)
          if (k && k.startsWith(prefix)) out.add(k.slice(prefix.length))
        }
      } catch {
        /* ignore */
      }
      for (const k of lsMemory.keys()) if (k.startsWith(prefix)) out.add(k.slice(prefix.length))
      return [...out].sort()
    },
    clear() {
      for (const k of this.keys()) this.del(k)
    },
  }
  localCache.set(slug, st)
  return st
}

export async function storageStatus(): Promise<{ idb: boolean; local: boolean }> {
  const db = await openDb()
  return { idb: db !== null, local: lsAvailable() !== null }
}

/** Clears ar:<slug>:* (except the hub progress note) and that slug's IndexedDB store. */
export async function resetGame(slug: StoreName): Promise<void> {
  const ls = local(slug)
  for (const k of ls.keys()) if (k !== 'hub') ls.del(k)
  try {
    await idb(slug).clear()
  } catch {
    /* idb() never throws, but be safe */
  }
}

/** Honour ?reset=1: clear this game's saves before boot. Call it first in main.ts. */
export async function applyResetFlag(slug: StoreName): Promise<boolean> {
  if (!flags().reset) return false
  await resetGame(slug)
  return true
}

// ---------------------------------------------------------------------------------------------
// Hub notes (hub.md §8.5)
// ---------------------------------------------------------------------------------------------

/** A short progress note shown on the hub frame (28 characters or fewer; longer is truncated with an ellipsis). */
export function writeHubNote(slug: GameSlug, note: string): void {
  if (storageDisabled()) return
  const n = note.length > 28 ? note.slice(0, 27) + '…' : note
  local(slug).set('hub', { note: n, at: Date.now() })
}

export function readHubNote(slug: GameSlug): { note: string; at: number } | null {
  const v = local(slug).get<{ note?: unknown; at?: unknown } | null>('hub', null)
  if (!v || typeof v.note !== 'string' || typeof v.at !== 'number') return null
  return { note: v.note, at: v.at }
}

// ---------------------------------------------------------------------------------------------
// Save slots
// ---------------------------------------------------------------------------------------------

export interface SlotMeta {
  id: string
  label: string
  savedAt: number
  auto: boolean
  thumb?: Blob
  extra?: Record<string, unknown>
}

export interface SaveSlots<T> {
  list(): Promise<SlotMeta[]>
  save(id: string, data: T, meta?: Partial<Omit<SlotMeta, 'id' | 'savedAt'>>): Promise<SlotMeta>
  autosave(data: T, meta?: Partial<SlotMeta>): Promise<SlotMeta>
  load(id: string): Promise<{ meta: SlotMeta; data: T } | null>
  remove(id: string): Promise<void>
  nextFree(): Promise<string | null>
}

let lastStamp = 0
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return lastStamp
}

interface SlotRecord {
  v: number
  data: unknown
}

/**
 * Manual slots '1'..'n' and a rolling ring of auto slots 'auto:1'..'auto:k'.
 * Keys: `${prefix}:${id}` -> { v, data } and `${prefix}meta:${id}` -> SlotMeta.
 * (So darkroom's 'pin:auto' in architecture §3.8 is `pin:auto:1` here; load('auto') is accepted as 'auto:1'.)
 */
export function createSlots<T>(
  store: StoreName,
  o: { prefix?: string; manual: number; auto: number; version: number; migrate?: (old: unknown, fromVersion: number) => T | null },
): SaveSlots<T> {
  const prefix = o.prefix ?? 'slot'
  const kv = (): KV => idb(store)
  const dataKey = (id: string): string => `${prefix}:${id}`
  const metaKey = (id: string): string => `${prefix}meta:${id}`
  const norm = (id: string): string => (id === 'auto' ? 'auto:1' : id)
  const manualIds = Array.from({ length: o.manual }, (_, i) => String(i + 1))
  const autoIds = Array.from({ length: o.auto }, (_, i) => `auto:${i + 1}`)

  async function readMetas(): Promise<SlotMeta[]> {
    const ks = await kv().keys(`${prefix}meta:`)
    const out: SlotMeta[] = []
    for (const k of ks) {
      const m = await kv().get<SlotMeta>(k)
      if (m && typeof m.id === 'string') out.push(m)
    }
    return out
  }

  async function write(id: string, data: T, auto: boolean, meta: Partial<SlotMeta> | undefined): Promise<SlotMeta> {
    const m: SlotMeta = {
      id,
      label: meta?.label ?? (auto ? 'Autosave' : `Slot ${id}`),
      savedAt: stamp(),
      auto,
    }
    if (meta?.thumb) m.thumb = meta.thumb
    if (meta?.extra) m.extra = meta.extra
    await kv().set(dataKey(id), { v: o.version, data } satisfies SlotRecord)
    await kv().set(metaKey(id), m)
    return m
  }

  return {
    async list() {
      const metas = await readMetas()
      const manual = metas.filter((m) => !m.auto).sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id))
      const autos = metas.filter((m) => m.auto).sort((a, b) => b.savedAt - a.savedAt)
      return [...manual, ...autos]
    },
    async save(id, data, meta) {
      return write(norm(id), data, norm(id).startsWith('auto:'), meta)
    },
    async autosave(data, meta) {
      const autos = (await readMetas()).filter((m) => m.auto)
      const used = new Set(autos.map((m) => m.id))
      let id = autoIds.find((a) => !used.has(a))
      if (!id) {
        const oldest = autos.filter((m) => autoIds.includes(m.id)).sort((a, b) => a.savedAt - b.savedAt)[0]
        id = oldest ? oldest.id : (autoIds[0] ?? 'auto:1')
      }
      return write(id, data, true, meta)
    },
    async load(id) {
      const key = norm(id)
      const rec = await kv().get<SlotRecord>(dataKey(key))
      const meta = await kv().get<SlotMeta>(metaKey(key))
      if (!rec || !meta) return null
      if (rec.v === o.version) return { meta, data: rec.data as T }
      if (!o.migrate) return null
      try {
        const migrated = o.migrate(rec.data, rec.v)
        return migrated === null ? null : { meta, data: migrated }
      } catch {
        return null
      }
    },
    async remove(id) {
      const key = norm(id)
      await kv().del(dataKey(key))
      await kv().del(metaKey(key))
    },
    async nextFree() {
      const used = new Set((await readMetas()).map((m) => m.id))
      return manualIds.find((i) => !used.has(i)) ?? null
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Debounced saving
// ---------------------------------------------------------------------------------------------

/**
 * Debounce a save (with a max wait of 5x so continuous changes still persist). Flushes on
 * visibilitychange -> hidden and pagehide. dispose() cancels without saving.
 */
export function debouncedSave(
  fn: () => void | Promise<void>,
  ms: number,
): { request(): void; flush(): Promise<void>; dispose(): void } {
  let timer = 0
  let firstAt = 0
  let pending = false
  let disposed = false
  const maxWait = ms * 5

  const run = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = 0
    }
    if (!pending) return
    pending = false
    firstAt = 0
    try {
      await fn()
    } catch {
      /* a failed save must never break the game */
    }
  }
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') void run()
  }
  const onPageHide = (): void => {
    void run()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)

  return {
    request() {
      if (disposed) return
      const now = performance.now()
      if (!pending) {
        pending = true
        firstAt = now
      }
      if (timer) clearTimeout(timer)
      const wait = Math.max(0, Math.min(ms, firstAt + maxWait - now))
      timer = window.setTimeout(() => void run(), wait)
    },
    flush: run,
    dispose() {
      disposed = true
      pending = false
      if (timer) clearTimeout(timer)
      timer = 0
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Byte helpers: compression and typed-array packing
// ---------------------------------------------------------------------------------------------

async function pipeThrough(u8: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const src = new Blob([u8 as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  return new Uint8Array(await new Response(src).arrayBuffer())
}

/** gzip via CompressionStream when available, else stored. A 1-byte header says which (1 = gzip, 0 = stored). */
export async function compressBytes(u8: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const z = await pipeThrough(u8, new CompressionStream('gzip'))
      const out = new Uint8Array(z.length + 1)
      out[0] = 1
      out.set(z, 1)
      return out
    } catch {
      /* fall through to stored */
    }
  }
  const out = new Uint8Array(u8.length + 1)
  out[0] = 0
  out.set(u8, 1)
  return out
}

export async function decompressBytes(u8: Uint8Array): Promise<Uint8Array> {
  const body = u8.subarray(1)
  if (u8[0] === 0) return body.slice()
  if (u8[0] === 1) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress that save.')
    return pipeThrough(body, new DecompressionStream('gzip'))
  }
  throw new Error('Unknown compression header.')
}

type TypedCtor =
  | 'Int8Array'
  | 'Uint8Array'
  | 'Uint8ClampedArray'
  | 'Int16Array'
  | 'Uint16Array'
  | 'Int32Array'
  | 'Uint32Array'
  | 'Float32Array'
  | 'Float64Array'
  | 'BigInt64Array'
  | 'BigUint64Array'
  | 'DataView'

const CTORS: Record<TypedCtor, new (b: ArrayBuffer) => ArrayBufferView> = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  DataView,
}

type HeaderField =
  | { t: 'typed'; ctor: TypedCtor; off: number; bytes: number }
  | { t: 'json'; v: unknown }
  | { t: 'num'; v: 'NaN' | 'Infinity' | '-Infinity' | '-0' }

const MAGIC = [0x41, 0x52, 0x50, 0x4b] // 'ARPK'
const align8 = (n: number): number => (n + 7) & ~7

/**
 * One blob: 'ARPK' + u32 header length + JSON header + 8-byte-aligned raw typed-array payloads.
 * Typed arrays round-trip bit-exactly (NaN payloads, -0); numbers, strings, booleans, null and JSON objects
 * are stored in the header (NaN, +/-Infinity and -0 are preserved).
 */
export function packTyped(fields: Record<string, ArrayBufferView | number | string | boolean | null | object>): Uint8Array {
  const header: Record<string, HeaderField> = {}
  const chunks: { off: number; view: Uint8Array }[] = []
  // Offsets are relative to the payload start; the payload start is fixed once the header size is known.
  let cursor = 0
  for (const [name, value] of Object.entries(fields)) {
    if (ArrayBuffer.isView(value)) {
      const ctor = value.constructor.name as TypedCtor
      if (!(ctor in CTORS)) throw new Error(`packTyped: unsupported view type ${ctor} for "${name}"`)
      const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      cursor = align8(cursor)
      header[name] = { t: 'typed', ctor, off: cursor, bytes: view.byteLength }
      chunks.push({ off: cursor, view })
      cursor += view.byteLength
    } else if (typeof value === 'number' && !Number.isFinite(value)) {
      header[name] = { t: 'num', v: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' }
    } else if (typeof value === 'number' && Object.is(value, -0)) {
      header[name] = { t: 'num', v: '-0' }
    } else {
      header[name] = { t: 'json', v: value }
    }
  }
  const headBytes = new TextEncoder().encode(JSON.stringify(header))
  const payloadStart = align8(8 + headBytes.length)
  const out = new Uint8Array(payloadStart + align8(cursor))
  out.set(MAGIC, 0)
  new DataView(out.buffer).setUint32(4, headBytes.length, true)
  out.set(headBytes, 8)
  for (const c of chunks) out.set(c.view, payloadStart + c.off)
  return out
}

export function unpackTyped(u8: Uint8Array): Record<string, unknown> {
  if (u8.length < 8 || MAGIC.some((b, i) => u8[i] !== b)) throw new Error('unpackTyped: not a packed blob')
  const headLen = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true)
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + headLen))) as Record<string, HeaderField>
  const payloadStart = align8(8 + headLen)
  const out: Record<string, unknown> = {}
  for (const [name, f] of Object.entries(header)) {
    if (f.t === 'typed') {
      const bytes = u8.slice(payloadStart + f.off, payloadStart + f.off + f.bytes) // fresh, aligned buffer
      out[name] = new CTORS[f.ctor](bytes.buffer)
    } else if (f.t === 'num') {
      out[name] = f.v === 'NaN' ? NaN : f.v === 'Infinity' ? Infinity : f.v === '-Infinity' ? -Infinity : -0
    } else {
      out[name] = f.v
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Cross-game film can (STRETCH crossovers)
// ---------------------------------------------------------------------------------------------

export interface FilmCanItem {
  id: string
  from: GameSlug
  kind: 'latent' | 'negative' | 'positive'
  createdAt: number
  w: number
  h: number
  png: Blob
  meta: Record<string, unknown>
}

let canSeq = 0
function newId(): string {
  let rnd = ''
  try {
    const a = new Uint32Array(2)
    crypto.getRandomValues(a)
    rnd = a[0]!.toString(36) + a[1]!.toString(36)
  } catch {
    rnd = (canSeq * 2654435761 >>> 0).toString(36)
  }
  return `${Date.now().toString(36)}-${(canSeq++).toString(36)}-${rnd}`
}

export const filmcan = {
  async put(item: Omit<FilmCanItem, 'id' | 'createdAt'>): Promise<string> {
    const id = newId()
    const full: FilmCanItem = { ...item, id, createdAt: Date.now() }
    const { png: _png, ...meta } = full
    void _png
    await idb('filmcan').set(`item:${id}`, full)
    await idb('filmcan').set(`meta:${id}`, meta)
    return id
  },
  /** Newest first, without the image data. */
  async list(): Promise<Omit<FilmCanItem, 'png'>[]> {
    const kv = idb('filmcan')
    const out: Omit<FilmCanItem, 'png'>[] = []
    for (const k of await kv.keys('meta:')) {
      const m = await kv.get<Omit<FilmCanItem, 'png'>>(k)
      if (m) out.push(m)
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  },
  async get(id: string): Promise<FilmCanItem | null> {
    return (await idb('filmcan').get<FilmCanItem>(`item:${id}`)) ?? null
  },
  async remove(id: string): Promise<void> {
    await idb('filmcan').del(`item:${id}`)
    await idb('filmcan').del(`meta:${id}`)
  },
}

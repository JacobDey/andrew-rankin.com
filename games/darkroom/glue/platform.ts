// Platform adapter: uses the shared modules (@shared/core, ui, storage, audio)
// when they exist on disk, and falls back to small local stand-ins when they
// don't (they were being written in parallel when this game was built).
// import.meta.glob resolves at transform time, so a missing module is simply an
// empty map rather than a failed import. Loading is lazy and wrapped in
// try/catch, so a half-finished shared module can't take the page down.

import { localShell, type LocalShellOptions } from './shellFallback'

type Loader = () => Promise<unknown>
const coreMods = import.meta.glob('/src/shared/core/index.ts') as Record<string, Loader>
const uiMods = import.meta.glob('/src/shared/ui/index.ts') as Record<string, Loader>
const storageMods = import.meta.glob('/src/shared/storage/index.ts') as Record<string, Loader>
const audioMods = import.meta.glob('/src/shared/audio/index.ts') as Record<string, Loader>
const soundMods = import.meta.glob('../sounds.ts') as Record<string, Loader>

async function loadFirst(m: Record<string, Loader>): Promise<Record<string, unknown> | null> {
  const k = Object.keys(m)[0]
  if (!k) return null
  try {
    return (await m[k]()) as Record<string, unknown>
  } catch (e) {
    console.debug('[darkroom] shared module failed to load, using local fallback', k, e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Flags (§3.6), parsed locally: same semantics as @shared/core flags()
// ---------------------------------------------------------------------------
export interface Flags {
  test: boolean; seed: number | null; reset: boolean; fresh: boolean; embed: 'poster' | 'preview' | null
  quality: 'high' | 'medium' | 'low' | 'test' | null; force: boolean; debug: string | null; muted: boolean
  get(name: string): string | null
}
let flagsCache: Flags | null = null
export function flags(): Flags {
  if (flagsCache) return flagsCache
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
  const seedS = q.get('seed')
  const embed = q.get('embed')
  const qual = q.get('quality') ?? q.get('q')
  flagsCache = {
    test: q.get('test') === '1',
    seed: seedS != null && seedS !== '' && Number.isFinite(Number(seedS)) ? Number(seedS) : null,
    reset: q.get('reset') === '1',
    fresh: q.get('fresh') === '1',
    embed: embed === 'poster' || embed === 'preview' ? embed : null,
    quality: qual === 'high' || qual === 'medium' || qual === 'low' || qual === 'test' ? qual : null,
    force: q.get('force') === '1',
    debug: q.get('debug'),
    muted: q.get('mute') === '1',
    get: (n: string) => q.get(n),
  }
  return flagsCache
}
export function storageDisabled(): boolean {
  const f = flags()
  return f.embed === 'poster' || f.fresh
}
export function reducedMotion(): boolean {
  if (document.documentElement.getAttribute('data-motion') === 'reduce') return true
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// ---------------------------------------------------------------------------
// Shell (hub.md §9.2 subset)
// ---------------------------------------------------------------------------
export interface ShellActionLite {
  id: string; label: string; icon?: string; kind?: 'default' | 'primary' | 'toggle'; shortcut?: string; priority?: number
  disabled?: boolean; onSelect(): void
}
export interface HelpLite { intro?: string; controls: Array<{ action: string; mouse?: string; touch?: string; keys?: string }>; tips?: string[] }
export interface ShellLite {
  readonly el: HTMLElement | null
  setStatus(t: string | null): void
  announce(t: string): void
  toast(t: string, o?: { kind?: 'info' | 'success' | 'error'; ms?: number }): void
  updateAction(id: string, patch: Partial<ShellActionLite>): void
  openHelp(): void
}

// ---------------------------------------------------------------------------
// Storage (subset of @shared/storage)
// ---------------------------------------------------------------------------
export interface KVLite {
  readonly persistent: boolean
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(prefix?: string): Promise<string[]>
}

class MemoryKV implements KVLite {
  persistent = false
  private m = new Map<string, unknown>()
  async get<T>(k: string) { return this.m.get(k) as T | undefined }
  async set(k: string, v: unknown) { this.m.set(k, v) }
  async del(k: string) { this.m.delete(k) }
  async keys(p = '') { return [...this.m.keys()].filter((k) => k.startsWith(p)) }
}

/** Local fallback DB with its own name, so it can never race the shared `andrew-rankin` v1 upgrade. */
class LocalIDB implements KVLite {
  persistent = true
  private db: Promise<IDBDatabase>
  constructor() {
    this.db = new Promise((res, rej) => {
      const r = indexedDB.open('ar-darkroom-local', 1)
      r.onupgradeneeded = () => { r.result.createObjectStore('kv') }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db
    return new Promise<T>((res, rej) => {
      const t = db.transaction('kv', mode)
      const rq = fn(t.objectStore('kv'))
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => rej(rq.error)
    })
  }
  async get<T>(k: string) { try { return (await this.tx('readonly', (s) => s.get(k))) as T | undefined } catch { return undefined } }
  async set(k: string, v: unknown) { try { await this.tx('readwrite', (s) => s.put(v, k)) } catch (e) { console.debug('[darkroom] idb set failed', e) } }
  async del(k: string) { try { await this.tx('readwrite', (s) => s.delete(k)) } catch { /* ignore */ } }
  async keys(p = '') {
    try { return ((await this.tx('readonly', (s) => s.getAllKeys())) as IDBValidKey[]).map(String).filter((k) => k.startsWith(p)) } catch { return [] }
  }
}

export interface LocalLite { get<T>(key: string, dflt: T): T; set(key: string, v: unknown): void; del(key: string): void }
const memLocal = new Map<string, string>()
export const localStore: LocalLite = {
  get<T>(key: string, dflt: T): T {
    if (storageDisabled()) { const v = memLocal.get(key); return v ? (JSON.parse(v) as T) : dflt }
    try { const v = localStorage.getItem('ar:darkroom:' + key); return v == null ? dflt : (JSON.parse(v) as T) } catch { return dflt }
  },
  set(key: string, v: unknown) {
    if (storageDisabled()) { memLocal.set(key, JSON.stringify(v)); return }
    try { localStorage.setItem('ar:darkroom:' + key, JSON.stringify(v)) } catch { /* private mode */ }
  },
  del(key: string) {
    memLocal.delete(key)
    try { localStorage.removeItem('ar:darkroom:' + key) } catch { /* ignore */ }
  },
}

// ---------------------------------------------------------------------------
// Audio (subset of @shared/audio)
// ---------------------------------------------------------------------------
export interface VoiceLite { stop?(t?: number): void; set?(p: Record<string, number>): void }
export interface AudioLite {
  play(id: string, params?: Record<string, number>): unknown
  loop(id: string, params?: Record<string, number>): VoiceLite | null
  ui(name: string): void
  haptic(ms: number | number[]): void
  readonly real: boolean
}

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------
export interface Platform {
  shell: ShellLite
  kv: KVLite
  audio: AudioLite
  installApi(api: Record<string, unknown> & { state(): unknown }): void
  markReady(): void
  hasWebGL2(): boolean
  showNoWebGL(stage: HTMLElement): void
  showCrash(stage: HTMLElement, e: unknown): void
  writeHubNote(note: string): void
  openDialog: ((o: { edge: string; title: string; body: HTMLElement; actions?: { id: string; label: string; kind?: 'primary' | 'secondary' | 'ghost'; onSelect?: () => void | boolean }[]; wide?: boolean; onClose?: () => void }) => { el: HTMLDialogElement; close(): void }) | null
  shouldIgnoreKey(e: KeyboardEvent): boolean
  sharedLoaded: string[]
}

const errors: string[] = []
let errorsHooked = false
function captureErrorsLocal() {
  if (errorsHooked) return
  errorsHooked = true
  addEventListener('error', (e) => errors.push(String((e as ErrorEvent).message ?? e)))
  addEventListener('unhandledrejection', (e) => errors.push('unhandled: ' + String((e as PromiseRejectionEvent).reason)))
  const ce = console.error.bind(console)
  console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ')); ce(...a) }
}

function localShouldIgnoreKey(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t || !(t instanceof HTMLElement)) return false
  if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .ar-shell, .dr-fshell, dialog[open], [popover]')) return true
  return false
}

function hasWebGL2Local(): boolean {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2') } catch { return false }
}

export async function initPlatform(o: LocalShellOptions): Promise<Platform> {
  const [core, ui, storage, audio, sounds] = await Promise.all([
    loadFirst(coreMods), loadFirst(uiMods), loadFirst(storageMods), loadFirst(audioMods), loadFirst(soundMods),
  ])
  const loaded: string[] = []
  const fn = <T>(m: Record<string, unknown> | null, name: string): T | null => (m && typeof m[name] === 'function' ? (m[name] as T) : null)

  // ---- shell
  let shell: ShellLite | null = null
  const mountShell = fn<(opts: unknown) => ShellLite>(ui, 'mountShell')
  if (mountShell) {
    try { shell = mountShell({ ...o, slug: 'darkroom' }); loaded.push('ui') } catch (e) { console.debug('[darkroom] mountShell failed', e) }
  }
  if (!shell) shell = localShell(o)

  // ---- storage
  let kv: KVLite
  const idbFn = fn<(s: string) => KVLite>(storage, 'idb')
  if (storageDisabled()) kv = new MemoryKV()
  else if (idbFn) { kv = idbFn('darkroom'); loaded.push('storage') }
  else {
    try { kv = typeof indexedDB !== 'undefined' ? new LocalIDB() : new MemoryKV() } catch { kv = new MemoryKV() }
  }
  const hubNote = fn<(slug: string, note: string) => void>(storage, 'writeHubNote')

  // ---- audio
  const A = audio?.Audio as { play?: (id: string, p?: unknown) => unknown; loop?: (id: string, p?: unknown) => VoiceLite | null } | undefined
  const uiSound = fn<(n: string) => void>(audio, 'uiSound')
  const hapticFn = fn<(p: number | number[]) => void>(audio, 'haptic')
  const reg = fn<() => void>(sounds, 'registerSounds')
  if (reg) { try { reg() } catch (e) { console.debug('[darkroom] registerSounds failed', e) } }
  const quiet = flags().test || flags().embed === 'poster'
  const audioLite: AudioLite = {
    real: !!A?.play,
    play(id, p) { if (quiet || !A?.play) return null; try { return A.play(id, p) } catch { return null } },
    loop(id, p) { if (quiet || !A?.loop) return null; try { return A.loop(id, p) ?? null } catch { return null } },
    ui(n) { if (quiet || !uiSound) return; try { uiSound(n) } catch { /* ignore */ } },
    haptic(ms) { if (quiet) return; try { if (hapticFn) hapticFn(ms); else navigator.vibrate?.(ms) } catch { /* ignore */ } },
  }
  if (A?.play) loaded.push('audio')

  // ---- test api
  const installGameApi = fn<(slug: string, v: string, api: unknown) => unknown>(core, 'installGameApi')
  const markReadyFn = fn<() => void>(core, 'markReady')
  if (installGameApi) loaded.push('core')
  else captureErrorsLocal()

  let readyResolve: () => void = () => {}
  const readyP = new Promise<void>((r) => { readyResolve = r })

  const openDialog = fn<Platform['openDialog'] & object>(ui, 'openDialog')
  const shouldIgnore = fn<(e: KeyboardEvent) => boolean>(ui, 'shouldGameIgnoreKey') ?? fn<(e: KeyboardEvent) => boolean>(core, 'shouldGameIgnoreKey')

  const p: Platform = {
    shell,
    kv,
    audio: audioLite,
    sharedLoaded: loaded,
    installApi(api) {
      if (installGameApi) { try { installGameApi('darkroom', 'darkroom@1', api); return } catch (e) { console.debug('[darkroom] installGameApi failed', e) } }
      const g = api as Record<string, unknown>
      g.slug = 'darkroom'
      g.version = 'darkroom@1'
      g.ready = false
      g.whenReady = () => readyP
      g.errors = () => errors.slice()
      ;(window as unknown as { __game: unknown }).__game = g
    },
    markReady() {
      if (markReadyFn) { try { markReadyFn(); return } catch { /* fall through */ } }
      const g = (window as unknown as { __game?: Record<string, unknown> }).__game
      if (g) g.ready = true
      document.body.dataset.ready = '1'
      readyResolve()
      try { if (window.parent !== window) window.parent.postMessage({ type: 'ar:ready' }, '*') } catch { /* ignore */ }
    },
    hasWebGL2: fn<() => boolean>(ui, 'hasWebGL2') ?? hasWebGL2Local,
    showNoWebGL(stage) {
      const f = fn<(s: HTMLElement) => void>(ui, 'showNoWebGL')
      if (f) { f(stage); return }
      stage.innerHTML = '<div class="dr-card"><h2>This darkroom needs WebGL2</h2><p>Your browser or device turned it off. <a href="?force=1">Try anyway</a></p></div>'
    },
    showCrash(stage, e) {
      const f = fn<(s: HTMLElement, e: unknown) => void>(ui, 'showCrashCard')
      if (f) { f(stage, e); return }
      const d = document.createElement('div')
      d.className = 'dr-card'
      d.innerHTML = '<h2>The film jammed</h2><p>Something broke while loading the darkroom. Reload to try again.</p>'
      stage.appendChild(d)
      console.debug(e)
    },
    writeHubNote(note) {
      if (storageDisabled()) return
      if (hubNote) { try { hubNote('darkroom', note); return } catch { /* fall through */ } }
      try { localStorage.setItem('ar:darkroom:hub', JSON.stringify({ note: note.length > 28 ? note.slice(0, 27) + '…' : note, at: Date.now() })) } catch { /* ignore */ }
    },
    openDialog: openDialog ?? null,
    shouldIgnoreKey: shouldIgnore ?? localShouldIgnoreKey,
  }
  return p
}

// URL flags (architecture.md §3.6), parsed once and cached.

export type Tier = 'high' | 'medium' | 'low' | 'test'

export interface UrlFlags {
  readonly test: boolean
  readonly seed: number | null
  readonly reset: boolean
  readonly fresh: boolean
  readonly embed: 'poster' | 'preview' | null
  readonly quality: Tier | null
  readonly force: boolean
  readonly theme: 'light' | 'dark' | null
  readonly debug: string | null
  readonly muted: boolean
  get(name: string): string | null
  has(name: string): boolean
  num(name: string, dflt: number): number
  bool(name: string): boolean
}

const FALSY = new Set(['0', 'false', 'no', 'off'])

function createFlags(search: string): UrlFlags {
  const params = new URLSearchParams(search)
  const get = (name: string): string | null => params.get(name)
  const has = (name: string): boolean => params.has(name)
  const bool = (name: string): boolean => {
    const v = params.get(name)
    return v !== null && !FALSY.has(v.toLowerCase())
  }
  const num = (name: string, dflt: number): number => {
    const v = params.get(name)
    if (v === null || v.trim() === '') return dflt
    const n = Number(v)
    return Number.isFinite(n) ? n : dflt
  }
  const seedRaw = params.get('seed')
  const seedNum = seedRaw === null || seedRaw.trim() === '' ? NaN : Number(seedRaw)
  const embedRaw = params.get('embed')
  const tierOf = (v: string | null): Tier | null => {
    const q = (v ?? '').toLowerCase()
    return q === 'high' || q === 'medium' || q === 'low' || q === 'test' ? q : null
  }
  const themeRaw = params.get('theme')
  return {
    test: bool('test'),
    seed: Number.isFinite(seedNum) ? Math.trunc(seedNum) : null,
    reset: bool('reset'),
    fresh: bool('fresh'),
    embed: embedRaw === 'poster' || embedRaw === 'preview' ? embedRaw : null,
    quality: tierOf(params.get('quality')) ?? tierOf(params.get('q')),
    force: bool('force'),
    theme: themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : null,
    debug: params.get('debug'),
    muted: bool('mute'),
    get,
    has,
    num,
    bool,
  }
}

let cached: UrlFlags | null = null

/** Parsed once from location.search and cached. */
export function flags(): UrlFlags {
  if (!cached) cached = createFlags(typeof location !== 'undefined' ? location.search : '')
  return cached
}

/** Test hook: re-parse from a given query string (and cache it). */
export function _setFlagsForTests(search: string): UrlFlags {
  cached = createFlags(search)
  return cached
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** OS setting OR <html data-motion="reduce"> (art-direction §5). */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.getAttribute('data-motion') === 'reduce') return true
  return typeof matchMedia === 'function' && matchMedia(MOTION_QUERY).matches
}

export function onReducedMotionChange(cb: (on: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {}
  let last = prefersReducedMotion()
  const fire = (): void => {
    const now = prefersReducedMotion()
    if (now !== last) {
      last = now
      cb(now)
    }
  }
  const mq = typeof matchMedia === 'function' ? matchMedia(MOTION_QUERY) : null
  mq?.addEventListener('change', fire)
  const mo = new MutationObserver(fire)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mq?.removeEventListener('change', fire)
    mo.disconnect()
  }
}

/** embed=poster or fresh=1: nothing is read from or written to storage. */
export function storageDisabled(): boolean {
  const f = flags()
  return f.embed === 'poster' || f.fresh
}

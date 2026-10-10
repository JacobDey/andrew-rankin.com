// window.__game base contract (architecture.md §3.7).

export interface GameApiBase {
  readonly slug: string
  readonly version: string
  ready: boolean
  whenReady(): Promise<void>
  state(): unknown
  errors(): string[]
  poster?(): Promise<void>
}

declare global {
  interface Window {
    __game?: GameApiBase & Record<string, unknown>
  }
}

const errorLog: string[] = []
let capturing = false
let isReady = false
let resolveReady: () => void = () => {}
const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve
})
let pendingExtensions: Record<string, unknown>[] = []

function fmt(v: unknown): string {
  if (v instanceof Error) return v.stack ? v.stack.split('\n').slice(0, 3).join(' | ') : `${v.name}: ${v.message}`
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function push(line: string): void {
  if (errorLog.length < 200) errorLog.push(line)
}

/** Idempotent: records uncaught errors, unhandled rejections and console.error lines. */
export function captureErrors(): void {
  if (capturing || typeof window === 'undefined') return
  capturing = true
  window.addEventListener('error', (e) => {
    push(`error: ${e.message}${e.filename ? ` @ ${e.filename}:${e.lineno}` : ''}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    push(`unhandledrejection: ${fmt(e.reason)}`)
  })
  const orig = console.error.bind(console)
  console.error = (...args: unknown[]): void => {
    push(`console.error: ${args.map(fmt).join(' ')}`)
    orig(...args)
  }
}

/** Installs window.__game: the base members merged under the game's own API. */
export function installGameApi<T extends object>(slug: string, version: string, api: T & { state(): unknown }): GameApiBase & T {
  captureErrors()
  const base: GameApiBase = {
    slug,
    version,
    ready: isReady,
    whenReady: () => readyPromise,
    state: () => null,
    errors: () => errorLog.slice(),
  }
  const merged = base as GameApiBase & T
  Object.defineProperties(merged, Object.getOwnPropertyDescriptors(api)) // keeps getters live
  for (const part of pendingExtensions) Object.defineProperties(merged, Object.getOwnPropertyDescriptors(part))
  pendingExtensions = []
  window.__game = merged as unknown as NonNullable<Window['__game']>
  return merged
}

/** Merge more members in later (Sunny 16's registerTestApi). */
export function extendGameApi(part: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  if (window.__game) Object.defineProperties(window.__game, Object.getOwnPropertyDescriptors(part))
  else pendingExtensions.push(part)
}

/** Call after the first real frame: sets ready, resolves whenReady(), flags <body>, tells a parent frame. */
export function markReady(): void {
  if (isReady) return
  isReady = true
  if (typeof window === 'undefined') {
    resolveReady()
    return
  }
  if (window.__game) window.__game.ready = true
  const flag = (): void => {
    document.body.dataset.ready = '1'
  }
  if (document.body) flag()
  else document.addEventListener('DOMContentLoaded', flag, { once: true })
  resolveReady()
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'ar:ready' }, '*')
  } catch {
    /* cross-origin parent: ignore */
  }
  window.dispatchEvent(new CustomEvent('ar:ready'))
}

/** True once markReady() has run (used by the shell to open help after the first frame). */
export function isGameReady(): boolean {
  return isReady
}

/** Resolves when markReady() has run. Same promise as __game.whenReady(). */
export function whenGameReady(): Promise<void> {
  return readyPromise
}

// Keyboard helpers. shouldGameIgnoreKey is the hub.md §9.5 rule, re-exported by @shared/ui.

const IGNORE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .ar-shell, dialog[open], [popover]:popover-open'
const IGNORE_SELECTOR_FALLBACK =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], .ar-shell, dialog[open], [popover]'

let selector = IGNORE_SELECTOR

/**
 * True when the key event belongs to the page chrome rather than the game: the target is an
 * input, textarea, select or [contenteditable], or sits inside .ar-shell, dialog[open] or an open [popover].
 */
export function shouldGameIgnoreKey(e: KeyboardEvent): boolean {
  if (e.isComposing) return true
  const t = e.target
  if (!(t instanceof Element)) return false
  try {
    return t.closest(selector) !== null
  } catch {
    // :popover-open is unsupported in this browser; fall back to any [popover].
    selector = IGNORE_SELECTOR_FALLBACK
    return t.closest(selector) !== null
  }
}

/** Pre-filtered key listener (keydown, or keyup with { up: true }). Returns an unsubscribe function. */
export function onGameKey(
  handler: (e: KeyboardEvent) => void,
  o: { up?: boolean; target?: Window | HTMLElement } = {},
): () => void {
  const target: Window | HTMLElement = o.target ?? window
  const type = o.up ? 'keyup' : 'keydown'
  const fn = (ev: Event): void => {
    const e = ev as KeyboardEvent
    if (shouldGameIgnoreKey(e)) return
    handler(e)
  }
  target.addEventListener(type, fn)
  return () => target.removeEventListener(type, fn)
}

export interface KeyState {
  isDown(code: string): boolean
  readonly down: ReadonlySet<string>
  dispose(): void
}

/** Tracks held keys by KeyboardEvent.code. Cleared on blur and when the page is hidden. */
export function trackKeys(target: Window = window): KeyState {
  const down = new Set<string>()
  const onDown = (ev: Event): void => {
    const e = ev as KeyboardEvent
    if (shouldGameIgnoreKey(e)) return
    down.add(e.code)
  }
  const onUp = (ev: Event): void => {
    down.delete((ev as KeyboardEvent).code)
  }
  const clear = (): void => down.clear()
  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)
  target.addEventListener('blur', clear)
  document.addEventListener('visibilitychange', clear)
  return {
    isDown: (code) => down.has(code),
    down,
    dispose() {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
      target.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', clear)
      down.clear()
    },
  }
}

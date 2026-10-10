// Light/dark theme handling (art-direction §5).
// Default: follow the OS. The Lights toggle sets an explicit theme in localStorage['ar:theme'].

import { flags } from '../core/flags'

export { prefersReducedMotion } from '../core/flags'

export type Theme = 'light' | 'dark'

export const THEME_BOOT_SCRIPT = `(function () {
  var d = document.documentElement, lock = d.getAttribute('data-scheme-lock'), t = null;
  try { t = localStorage.getItem('ar:theme'); } catch (e) {}
  var q = /[?&]theme=(light|dark)\\b/.exec(location.search);   // test/screenshot override, not persisted
  if (q) t = q[1];
  if (lock === 'light' || lock === 'dark') t = lock;
  if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  if (/[?&]motion=reduce\\b/.test(location.search)) d.setAttribute('data-motion', 'reduce');
})();`

const listeners = new Set<(t: Theme) => void>()

/** 'light' or 'dark' as currently applied (an explicit data-theme wins, otherwise the OS preference). */
export function getTheme(): Theme {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'light' || explicit === 'dark') return explicit
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The scheme this page is locked to (data-scheme-lock), or null when the user may choose. */
export function schemeLock(): Theme | null {
  const l = document.documentElement.getAttribute('data-scheme-lock')
  return l === 'light' || l === 'dark' ? l : null
}

function notify(): void {
  const t = getTheme()
  for (const cb of [...listeners]) cb(t)
  window.dispatchEvent(new CustomEvent('ar:themechange', { detail: t }))
}

/** Set an explicit theme; null removes the stored choice and matches the system again. Ignored on a locked page. */
export function setTheme(t: Theme | null): void {
  if (schemeLock()) return
  const d = document.documentElement
  const persist = flags().embed !== 'poster'
  try {
    if (t === null) {
      if (persist) localStorage.removeItem('ar:theme')
    } else if (persist) {
      localStorage.setItem('ar:theme', t)
    }
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  if (t === null) d.removeAttribute('data-theme')
  else d.setAttribute('data-theme', t)
  notify()
}

let mqBound = false
function bindSystemChange(): void {
  if (mqBound || typeof matchMedia !== 'function') return
  mqBound = true
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.hasAttribute('data-theme')) notify()
  })
}

export function onThemeChange(cb: (t: Theme) => void): () => void {
  bindSystemChange()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

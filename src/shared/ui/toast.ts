// Toasts and the shared polite live region (art-direction §7.6).

let live: HTMLElement | null = null
let region: HTMLElement | null = null
let current: { el: HTMLElement; timer: number } | null = null

/** The page's single `aria-live="polite"` region (the shell creates it; this finds or creates it). */
export function liveRegion(): HTMLElement {
  if (live && live.isConnected) return live
  let el = document.querySelector<HTMLElement>('.ar-live')
  if (!el) {
    el = document.createElement('div')
    el.className = 'ar-live visually-hidden'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  live = el
  return el
}

/** Screen-reader announcement (polite). Repeating the same text is re-announced. */
export function announce(text: string): void {
  const el = liveRegion()
  el.textContent = ''
  window.setTimeout(() => {
    el.textContent = text
  }, 30)
}

function dismiss(t: { el: HTMLElement; timer: number }): void {
  window.clearTimeout(t.timer)
  t.el.setAttribute('data-leaving', '')
  const el = t.el
  window.setTimeout(() => el.remove(), 170)
  if (current === t) current = null
}

/**
 * Bottom-centre film-black pill. Only one at a time (a new toast replaces the old one).
 * Lives 2600 ms (errors 5000 ms; click an error to dismiss). Text: 7 words or fewer, no exclamation marks.
 */
export function toast(text: string, o: { kind?: 'info' | 'success' | 'error'; ms?: number } = {}): void {
  if (typeof document === 'undefined') return
  const kind = o.kind ?? 'info'
  if (!region || !region.isConnected) {
    region = document.createElement('div')
    region.className = 'ar-toast-region'
    document.body.appendChild(region)
  }
  if (current) {
    window.clearTimeout(current.timer)
    current.el.remove()
    current = null
  }
  const el = document.createElement('div')
  el.className = 'ar-toast'
  el.dataset.kind = kind
  el.innerHTML = '<div class="ar-film-bg ar-film-bg--top" aria-hidden="true"></div><span class="ar-toast__dot" aria-hidden="true"></span>'
  const span = document.createElement('span')
  span.textContent = text
  el.appendChild(span)
  region.appendChild(el)
  const t = { el, timer: 0 }
  t.timer = window.setTimeout(() => dismiss(t), o.ms ?? (kind === 'error' ? 5000 : 2600))
  current = t
  if (kind === 'error') el.addEventListener('click', () => dismiss(t))
  announce(text)
}

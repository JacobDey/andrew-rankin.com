// The loader (art-direction §7.8): a film-black cover with a strip of perforations winding on.

import { prefersReducedMotion } from '../core/flags'

export interface Loader {
  progress(p: number): void
  label(text: string): void
  /** The cover dissolves away over --ar-dur-develop (the picture "comes up"). Resolves when it is gone. */
  done(): Promise<void>
}

/**
 * Cover `stage` while a game loads. Stays invisible for the first `delayMs` (default 250), so a fast
 * load never flashes a loader. The frame counter maps progress 0..1 onto frames 00..36.
 */
export function showLoader(stage: HTMLElement, o: { label?: string; delayMs?: number } = {}): Loader {
  const el = document.createElement('div')
  el.className = 'ar-loader'
  el.setAttribute('data-hidden', '')
  el.setAttribute('role', 'progressbar')
  el.setAttribute('aria-label', o.label ?? 'Winding on…')
  el.setAttribute('aria-valuemin', '0')
  el.setAttribute('aria-valuemax', '100')
  el.setAttribute('aria-valuenow', '0')
  el.innerHTML = '<div class="ar-loader__strip" aria-hidden="true"></div><div class="ar-loader__label ar-edge"></div><div class="ar-loader__count" aria-hidden="true">▸ 00</div>'
  const labelEl = el.querySelector<HTMLElement>('.ar-loader__label')!
  const countEl = el.querySelector<HTMLElement>('.ar-loader__count')!
  labelEl.textContent = o.label ?? 'Winding on…'
  stage.appendChild(el)

  let finished = false
  let shown = false
  const timer = window.setTimeout(() => {
    if (finished) return
    shown = true
    el.removeAttribute('data-hidden')
  }, o.delayMs ?? 250)

  return {
    progress(p) {
      const q = Math.max(0, Math.min(1, p))
      countEl.textContent = `▸ ${String(Math.round(q * 36)).padStart(2, '0')}`
      el.setAttribute('aria-valuenow', String(Math.round(q * 100)))
    },
    label(text) {
      labelEl.textContent = text
      el.setAttribute('aria-label', text)
    },
    done() {
      if (finished) return Promise.resolve()
      finished = true
      window.clearTimeout(timer)
      if (!shown) {
        el.remove()
        return Promise.resolve()
      }
      return new Promise<void>((resolve) => {
        const end = (): void => {
          el.remove()
          resolve()
        }
        el.setAttribute('data-leaving', '')
        const ms = prefersReducedMotion() ? 160 : 900
        window.setTimeout(end, ms + 40)
      })
    },
  }
}

// games/plates/ui/hud.ts — station buttons, the tray back button and pager, the book icon with its
// red-wax dot, pencil notes near hazards (fade in, out after 3 s), the ghost hand and shimmers.
import type { Station, Bath } from '../contracts'
import { STATIONS } from '../story/text'

export interface Hud {
  el: HTMLElement
  setStation(s: Station, tray: Bath | null, portrait: boolean): void
  setWax(on: boolean): void
  pencil(text: string, x: number, y: number, ms?: number): void
  ghost(x: number, y: number, on: boolean): void
  shimmer(which: 'tin' | 'book' | 'table' | null): void
  onStation: ((s: Station) => void) | null
  onBackTray: (() => void) | null
  onTray: ((b: Bath) => void) | null
  onBook: (() => void) | null
}

export function createHud(root: HTMLElement): Hud {
  const el = document.createElement('div'); el.className = 'pl-hud'
  el.innerHTML = `
    <button type="button" class="pl-back-tray" hidden aria-label="Back from the tray">‹</button>
    <nav class="pl-stations" aria-label="Stations">
      <button type="button" data-s="shelf">${STATIONS.shelf}</button><button type="button" data-s="trays">${STATIONS.trays}</button><button type="button" data-s="table">${STATIONS.table}</button>
    </nav>
    <div class="pl-tray-pager" hidden><button type="button" data-b="dev">DEV</button><button type="button" data-b="water">WATER</button><button type="button" data-b="hypo">HYPO</button></div>
    <button type="button" class="pl-book-btn" aria-label="Open the Return">Return<span class="pl-wax" hidden></span></button>`
  root.appendChild(el)
  const back = el.querySelector('.pl-back-tray') as HTMLButtonElement, pager = el.querySelector('.pl-tray-pager') as HTMLElement
  const wax = el.querySelector('.pl-wax') as HTMLElement, bookBtn = el.querySelector('.pl-book-btn') as HTMLButtonElement
  const ghostEl = document.createElement('div'); ghostEl.className = 'pl-ghost-hand'; ghostEl.hidden = true; root.appendChild(ghostEl)
  const hud: Hud = {
    el, onStation: null, onBackTray: null, onTray: null, onBook: null,
    setStation(s, tray, portrait) {
      el.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === s && !tray)))
      back.hidden = !tray
      pager.hidden = !(tray && portrait)
      pager.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.b === tray)))
    },
    setWax(on) { wax.hidden = !on },
    pencil(text, x, y, ms = 3000) {
      const n = document.createElement('div'); n.className = 'pl-pencil-note'; n.textContent = text
      n.style.left = `${Math.max(90, Math.min(root.clientWidth - 90, x))}px`; n.style.top = `${Math.max(80, y)}px`; n.style.opacity = '0'
      root.appendChild(n)
      requestAnimationFrame(() => { n.style.opacity = '1' })
      setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 500) }, ms)
    },
    ghost(x, y, on) { ghostEl.hidden = !on; ghostEl.style.left = `${x - 20}px`; ghostEl.style.top = `${y - 20}px` },
    shimmer(which) {
      bookBtn.classList.toggle('pl-shimmer', which === 'book')
      el.querySelector('[data-s="table"]')?.classList.toggle('pl-shimmer', which === 'table')
    },
  }
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return
    if (b.dataset.s) hud.onStation?.(b.dataset.s as Station)
    else if (b.dataset.b) hud.onTray?.(b.dataset.b as Bath)
    else if (b === back) hud.onBackTray?.()
    else if (b === bookBtn) hud.onBook?.()
  })
  return hud
}

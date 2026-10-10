// A small film-black tooltip (art-direction §7.7): after 500 ms of mouse hover, or at once on
// keyboard focus. Never on touch. One shared element.

let tip: HTMLElement | null = null
let timer = 0
let owner: HTMLElement | null = null

function ensure(): HTMLElement {
  if (tip && tip.isConnected) return tip
  tip = document.createElement('div')
  tip.className = 'ar-tip'
  tip.setAttribute('role', 'presentation')
  document.body.appendChild(tip)
  return tip
}

function show(el: HTMLElement, text: string, shortcut?: string): void {
  const t = ensure()
  t.textContent = text
  if (shortcut) {
    const k = document.createElement('kbd')
    k.textContent = shortcut
    t.appendChild(k)
  }
  const r = el.getBoundingClientRect()
  t.style.left = '0px'
  t.style.top = '0px'
  const w = t.offsetWidth
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))
  t.style.left = `${x}px`
  t.style.top = `${r.bottom + 8}px`
  t.setAttribute('data-open', '')
  owner = el
}

export function hideTooltip(): void {
  window.clearTimeout(timer)
  tip?.removeAttribute('data-open')
  owner = null
}

/** Attach a tooltip to an element; `get` is called when it is about to show. Returns a disposer. */
export function attachTooltip(el: HTMLElement, get: () => { text: string; shortcut?: string }): () => void {
  const onEnter = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const g = get()
      show(el, g.text, g.shortcut)
    }, 500)
  }
  const onFocus = (): void => {
    if (!el.matches(':focus-visible')) return
    const g = get()
    show(el, g.text, g.shortcut)
  }
  const onHide = (): void => {
    if (owner === el || !owner) hideTooltip()
    else window.clearTimeout(timer)
  }
  el.addEventListener('pointerenter', onEnter)
  el.addEventListener('pointerleave', onHide)
  el.addEventListener('pointerdown', onHide)
  el.addEventListener('focus', onFocus)
  el.addEventListener('blur', onHide)
  return () => {
    el.removeEventListener('pointerenter', onEnter)
    el.removeEventListener('pointerleave', onHide)
    el.removeEventListener('pointerdown', onHide)
    el.removeEventListener('focus', onFocus)
    el.removeEventListener('blur', onHide)
    if (owner === el) hideTooltip()
  }
}

// Tiny DOM helper.
type Props = Record<string, unknown>
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue
    if (k === 'className' || k === 'textContent' || k === 'innerHTML' || k === 'type' || k === 'value' || k === 'title' || k === 'hidden' || k === 'disabled' || k === 'width' || k === 'height' || k === 'accept') (el as unknown as Record<string, unknown>)[k] = v
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    else el.setAttribute(k, String(v))
  }
  for (const c of kids) if (c != null && c !== false) el.append(c)
  return el
}
export function btn(label: string, onClick: () => void, o: { className?: string; aria?: string; title?: string } = {}): HTMLButtonElement {
  const b = h('button', { className: o.className ?? 'dr-btn', type: 'button', textContent: label, title: o.title }) as HTMLButtonElement
  if (o.aria) b.setAttribute('aria-label', o.aria)
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
  return b
}
/** A button that fires repeatedly while held (pointer or keyboard). */
export function holdBtn(label: string, onHold: (dt: number) => void, o: { className?: string; onStart?: () => void; onEnd?: () => void } = {}): HTMLButtonElement {
  const b = h('button', { className: o.className ?? 'dr-btn', type: 'button', textContent: label }) as HTMLButtonElement
  let raf = 0, last = 0, held = false
  const loop = (t: number) => { if (!held) return; onHold(Math.min(0.1, (t - last) / 1000)); last = t; raf = requestAnimationFrame(loop) }
  const start = () => { if (held) return; held = true; last = performance.now(); o.onStart?.(); raf = requestAnimationFrame(loop); b.classList.add('is-held') }
  const stop = () => { if (!held) return; held = false; cancelAnimationFrame(raf); o.onEnd?.(); b.classList.remove('is-held') }
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); start() })
  b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('lostpointercapture', stop)
  b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start() } })
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop() })
  b.addEventListener('blur', stop)
  return b
}

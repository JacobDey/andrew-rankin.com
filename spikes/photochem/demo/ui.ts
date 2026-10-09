// Minimal control builders: labelled sliders, selects, toggles, buttons.
// Native inputs, so mouse, touch and keyboard all work without extra code.

export type Getter<T> = () => T

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v
    else e.setAttribute(k, v)
  }
  for (const k of kids) e.append(k)
  return e
}

export interface SliderSpec {
  label: string
  min: number
  max: number
  step: number
  value: number
  fmt?: (v: number) => string
  /** Map slider position -> value (e.g. logarithmic). */
  map?: (t: number) => number
  unmap?: (v: number) => number
  hint?: string
}

export interface Control<T> {
  get: Getter<T>
  set: (v: T) => void
  root: HTMLElement
}

export function slider(parent: HTMLElement, s: SliderSpec, onChange: () => void): Control<number> {
  const id = 'c' + Math.random().toString(36).slice(2, 8)
  const input = el('input', { type: 'range', id, min: String(s.min), max: String(s.max), step: String(s.step) })
  const out = el('output', { for: id })
  const lab = el('label', { for: id }, s.label)
  const row = el('div', { class: 'ctl' }, el('div', { class: 'ctl-head' }, lab, out), input)
  if (s.hint) row.append(el('div', { class: 'hint' }, s.hint))
  const toVal = (t: number) => (s.map ? s.map(t) : t)
  const toPos = (v: number) => (s.unmap ? s.unmap(v) : v)
  input.value = String(toPos(s.value))
  const show = () => (out.textContent = (s.fmt ?? ((v: number) => String(v)))(toVal(Number(input.value))))
  show()
  input.addEventListener('input', () => {
    show()
    onChange()
  })
  parent.append(row)
  return {
    get: () => toVal(Number(input.value)),
    set: (v) => {
      input.value = String(toPos(v))
      show()
    },
    root: row,
  }
}

export function select<T extends string>(parent: HTMLElement, label: string, options: { value: T; text: string }[], value: T, onChange: () => void): Control<T> {
  const id = 'c' + Math.random().toString(36).slice(2, 8)
  const sel = el('select', { id })
  for (const o of options) sel.append(el('option', { value: o.value }, o.text))
  sel.value = value
  sel.addEventListener('change', onChange)
  const row = el('div', { class: 'ctl' }, el('div', { class: 'ctl-head' }, el('label', { for: id }, label)), sel)
  parent.append(row)
  return { get: () => sel.value as T, set: (v) => (sel.value = v), root: row }
}

export function toggle(parent: HTMLElement, label: string, value: boolean, onChange: () => void): Control<boolean> {
  const id = 'c' + Math.random().toString(36).slice(2, 8)
  const input = el('input', { type: 'checkbox', id })
  input.checked = value
  input.addEventListener('change', onChange)
  const row = el('div', { class: 'ctl ctl-toggle' }, input, el('label', { for: id }, label))
  parent.append(row)
  return { get: () => input.checked, set: (v) => (input.checked = v), root: row }
}

export function button(parent: HTMLElement, text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls }, text)
  b.addEventListener('click', onClick)
  parent.append(b)
  return b
}

export function group(parent: HTMLElement, title: string, open = true): HTMLElement {
  const d = el('details', { class: 'grp' })
  if (open) d.open = true
  d.append(el('summary', {}, title))
  const body = el('div', { class: 'grp-body' })
  d.append(body)
  parent.append(d)
  return body
}

/** Logarithmic slider helpers over [lo, hi]. */
export function logMap(lo: number, hi: number): { map: (t: number) => number; unmap: (v: number) => number } {
  const a = Math.log(lo)
  const b = Math.log(hi)
  return { map: (t) => Math.exp(a + (b - a) * t), unmap: (v) => (Math.log(v) - a) / (b - a) }
}

/** Debounce for expensive recomputes driven by sliders. */
export function debounce(fn: () => void, ms: number): () => void {
  let t = 0
  return () => {
    clearTimeout(t)
    t = window.setTimeout(fn, ms)
  }
}

export function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return '∞'
  if (s < 1) return `${(s * 1000).toFixed(0)} ms`
  if (s < 120) return `${s.toFixed(s < 10 ? 1 : 0)} s`
  if (s < 7200) return `${(s / 60).toFixed(1)} min`
  if (s < 86400 * 3) return `${(s / 3600).toFixed(1)} h`
  if (s < 86400 * 365 * 3) return `${(s / 86400).toFixed(0)} days`
  return `${(s / 86400 / 365).toFixed(0)} years`
}

/** Canvas that shows an RGBA buffer at its native resolution, CSS-scaled. */
export function imageCanvas(w: number, h: number, cls = 'img'): { canvas: HTMLCanvasElement; put: (rgba: Uint8ClampedArray) => void } {
  const canvas = el('canvas', { class: cls })
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  return {
    canvas,
    put: (rgba) => {
      img.data.set(rgba)
      ctx.putImageData(img, 0, 0)
    },
  }
}

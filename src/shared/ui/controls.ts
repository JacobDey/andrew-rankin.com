// Switch, segmented control and range helpers (art-direction §7.2-7.3).

import { uiSound, haptic } from '../audio/core'

/**
 * Style an <input type="range"> as .ar-range: paints the filled part (--fill), optionally shows a mono
 * readout, and fires detents (a tick sound, a haptic and onDetent) when the value lands on one.
 * Returns a disposer.
 */
export function bindRange(
  input: HTMLInputElement,
  o: { format?: (v: number) => string; detents?: readonly number[]; onDetent?: (v: number) => void } = {},
): () => void {
  input.classList.add('ar-range')
  const num = (s: string, d: number): number => {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : d
  }
  let out: HTMLElement | null = null
  if (o.format) {
    const next = input.nextElementSibling
    if (next instanceof HTMLElement && next.classList.contains('ar-range-value')) out = next
    else {
      out = document.createElement('output')
      out.className = 'ar-range-value'
      out.setAttribute('aria-hidden', 'true')
      input.after(out)
    }
  }
  let lastDetent: number | null = null
  const paint = (): void => {
    const min = num(input.min, 0)
    const max = num(input.max, 100)
    const v = num(input.value, min)
    const pct = max > min ? ((v - min) / (max - min)) * 100 : 0
    // keep the fill centred under the thumb (the thumb is 18px wide)
    input.style.setProperty('--fill', `calc(9px + (100% - 18px) * ${(pct / 100).toFixed(4)})`)
    if (out && o.format) out.textContent = o.format(v)
    if (o.detents && o.detents.length) {
      const step = Math.max(num(input.step, 1), 1e-9)
      const hit = o.detents.find((d) => Math.abs(d - v) < step / 2 + 1e-9)
      if (hit !== undefined && hit !== lastDetent) {
        lastDetent = hit
        uiSound('tick')
        haptic(6)
        o.onDetent?.(hit)
      } else if (hit === undefined) lastDetent = null
    }
  }
  if (o.detents && o.detents.length) {
    input.classList.add('ar-range--detent')
    const min = num(input.min, 0)
    const max = num(input.max, 100)
    const layers = o.detents
      .filter((d) => d >= min && d <= max && max > min)
      .map((d) => {
        const f = (d - min) / (max - min)
        return `linear-gradient(var(--ar-line-strong), var(--ar-line-strong)) calc(9px + (100% - 18px) * ${f.toFixed(4)} - 0.5px) calc(50% + 4px) / 1px 6px no-repeat`
      })
    if (layers.length) input.style.background = layers.join(', ')
  }
  input.addEventListener('input', paint)
  input.addEventListener('change', paint)
  paint()
  return () => {
    input.removeEventListener('input', paint)
    input.removeEventListener('change', paint)
    out?.remove()
  }
}

/** A role="switch" button with a 36x20 track. Plays the `switch` sound on change. */
export function createSwitch(o: { label: string; checked: boolean; onChange: (on: boolean) => void }): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'ar-switch'
  b.setAttribute('role', 'switch')
  b.setAttribute('aria-checked', String(o.checked))
  b.innerHTML = '<span class="ar-switch__track" aria-hidden="true"><span class="ar-switch__knob"></span></span>'
  const label = document.createElement('span')
  label.className = 'ar-switch__label'
  label.textContent = o.label
  b.appendChild(label)
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-checked') !== 'true'
    b.setAttribute('aria-checked', String(on))
    uiSound('switch')
    o.onChange(on)
  })
  return b
}

/** A radiogroup of segments (like a film-speed dial). Arrow keys move the selection. */
export function createSegmented<T extends string>(o: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}): HTMLElement & { setValue(v: T): void } {
  const el = document.createElement('div') as unknown as HTMLElement & { setValue(v: T): void }
  el.className = 'ar-seg'
  el.setAttribute('role', 'radiogroup')
  el.setAttribute('aria-label', o.label)
  let value = o.value
  const btns = o.options.map((opt) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'ar-seg__opt'
    b.setAttribute('role', 'radio')
    b.textContent = opt.label
    b.dataset.value = opt.value
    el.appendChild(b)
    return { b, value: opt.value }
  })
  const paint = (): void => {
    for (const { b, value: v } of btns) {
      const on = v === value
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    }
  }
  const select = (v: T, focus: boolean): void => {
    if (v === value) return
    value = v
    paint()
    uiSound('tick')
    if (focus) btns.find((x) => x.value === v)?.b.focus()
    o.onChange(v)
  }
  for (const { b, value: v } of btns) {
    b.addEventListener('click', () => select(v, false))
    b.addEventListener('keydown', (e) => {
      const i = btns.findIndex((x) => x.value === value)
      let n = i
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length
      else return
      e.preventDefault()
      select(btns[n]!.value, true)
    })
  }
  el.setValue = (v: T): void => {
    value = v
    paint()
  }
  paint()
  return el
}

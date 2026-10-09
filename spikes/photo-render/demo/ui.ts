// Tiny DOM control builders for the spike's panel (no framework).

export interface Ctl<T> {
  el: HTMLElement
  get(): T
  set(v: T, emit?: boolean): void
}

function row(label: string): { el: HTMLDivElement; out: HTMLSpanElement; lab: HTMLLabelElement } {
  const el = document.createElement('div')
  el.className = 'ctl'
  const lab = document.createElement('label')
  lab.textContent = label
  const out = document.createElement('span')
  out.className = 'val'
  const head = document.createElement('div')
  head.className = 'ctl-head'
  head.append(lab, out)
  el.append(head)
  return { el, out, lab }
}

/** Discrete slider over a list of values (shutter speeds, f-stops, ISO...). */
export function steps<T>(label: string, values: readonly T[], value: T, fmt: (v: T) => string, onInput: (v: T) => void): Ctl<T> {
  const { el, out } = row(label)
  const input = document.createElement('input')
  input.type = 'range'
  input.min = '0'
  input.max = String(values.length - 1)
  input.step = '1'
  const nearest = (v: T): number => {
    if (typeof v === 'number') {
      let best = 0
      values.forEach((x, i) => {
        if (Math.abs(Math.log(Math.max(1e-9, x as number)) - Math.log(Math.max(1e-9, v))) < Math.abs(Math.log(Math.max(1e-9, values[best] as number)) - Math.log(Math.max(1e-9, v)))) best = i
      })
      return best
    }
    return Math.max(0, values.indexOf(v))
  }
  let cur = values[nearest(value)]
  input.value = String(nearest(value))
  out.textContent = fmt(cur)
  input.addEventListener('input', () => {
    cur = values[Number(input.value)]
    out.textContent = fmt(cur)
    onInput(cur)
  })
  el.append(input)
  return {
    el,
    get: () => cur,
    set: (v, emit = false) => {
      const i = nearest(v)
      input.value = String(i)
      cur = values[i]
      out.textContent = fmt(cur)
      if (emit) onInput(cur)
    },
  }
}

/** Continuous slider; `log` maps the track exponentially (focal length, distances). */
export function slider(label: string, min: number, max: number, value: number, fmt: (v: number) => string, onInput: (v: number) => void, opt: { log?: boolean; step?: number } = {}): Ctl<number> {
  const { el, out } = row(label)
  const input = document.createElement('input')
  input.type = 'range'
  const N = 1000
  input.min = '0'
  input.max = String(N)
  input.step = '1'
  const toPos = (v: number) =>
    opt.log ? (Math.log(v / min) / Math.log(max / min)) * N : ((v - min) / (max - min)) * N
  const fromPos = (p: number) => {
    let v = opt.log ? min * Math.pow(max / min, p / N) : min + ((max - min) * p) / N
    if (opt.step) v = Math.round(v / opt.step) * opt.step
    return v
  }
  let cur = value
  input.value = String(Math.round(toPos(value)))
  out.textContent = fmt(value)
  input.addEventListener('input', () => {
    cur = fromPos(Number(input.value))
    out.textContent = fmt(cur)
    onInput(cur)
  })
  el.append(input)
  return {
    el,
    get: () => cur,
    set: (v, emit = false) => {
      cur = v
      input.value = String(Math.round(toPos(Math.min(max, Math.max(min, v)))))
      out.textContent = fmt(v)
      if (emit) onInput(v)
    },
  }
}

export function select<T extends string>(label: string, options: readonly [T, string][], value: T, onChange: (v: T) => void): Ctl<T> {
  const { el, out } = row(label)
  out.remove()
  const s = document.createElement('select')
  for (const [v, l] of options) {
    const o = document.createElement('option')
    o.value = v
    o.textContent = l
    s.append(o)
  }
  s.value = value
  s.addEventListener('change', () => onChange(s.value as T))
  el.append(s)
  return {
    el,
    get: () => s.value as T,
    set: (v, emit = false) => {
      s.value = v
      if (emit) onChange(v)
    },
  }
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void): Ctl<boolean> {
  const el = document.createElement('label')
  el.className = 'ctl toggle'
  const c = document.createElement('input')
  c.type = 'checkbox'
  c.checked = value
  c.addEventListener('change', () => onChange(c.checked))
  const span = document.createElement('span')
  span.textContent = label
  el.append(c, span)
  return {
    el,
    get: () => c.checked,
    set: (v, emit = false) => {
      c.checked = v
      if (emit) onChange(v)
    },
  }
}

export function group(parent: HTMLElement, title: string, open = false, hint?: string): HTMLElement {
  const d = document.createElement('details')
  d.open = open
  const s = document.createElement('summary')
  s.textContent = title
  d.append(s)
  if (hint) {
    const p = document.createElement('p')
    p.className = 'hint'
    p.textContent = hint
    d.append(p)
  }
  const body = document.createElement('div')
  body.className = 'grp'
  d.append(body)
  parent.append(d)
  return body
}

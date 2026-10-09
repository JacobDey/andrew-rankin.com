// Film tab: the same scene on different stocks, filters, pushes and ages.

import { type FilmStockId, FILM_STOCKS, gradeLabel, makeDeveloper, makeFilm, pushPull } from '../core/index.ts'
import { type FilmParams, type Stage, FILM_DEFAULTS, quickPrint, sceneFor, shootAndDevelop } from './pipelines.ts'
import { button, debounce, el, group, imageCanvas, select, slider, toggle } from './ui.ts'

interface Variant {
  title: string
  note: string
  p: Partial<FilmParams>
}

const VARIANTS: Variant[] = [
  { title: 'Nightjar 400, box speed', note: 'Panchromatic: the red flag is a mid grey.', p: {} },
  { title: 'Ortho 25', note: 'Red-blind: the flag and the rust go dark, the sky goes pale.', p: { stock: 'ortho25' } },
  { title: '400 + red #25 filter', note: 'The blue sky darkens, clouds pop, the flag goes white.', p: { filter: 'red25' } },
  { title: 'Shot at EI 1600, developed normally', note: 'Two stops under: thin, the shadows are gone.', p: { push: 0, ev: -2 } },
  { title: 'Shot at EI 1600, pushed +2', note: 'Mid-tones rescued, shadows still gone, contrast up.', p: { push: 2 } },
  { title: 'Left 24 years in a cold store', note: 'Latent image faded, radiation fog built up.', p: { years: 24, storeC: 4 } },
  { title: 'Gelatin dry plate (blue only)', note: '1880s look: white sky, black foliage.', p: { stock: 'dryPlate' } },
]

export function filmTab(root: HTMLElement, showZoom: (s: Stage) => void): { run: () => number } {
  const layout = el('div', { class: 'layout' })
  const controls = el('div', { class: 'controls' })
  const stage = el('div', { class: 'stage' })
  layout.append(controls, stage)
  root.append(layout)
  const rerun = debounce(() => run(), 150)

  const g = group(controls, 'Tank development')
  const temp = slider(g, { label: 'Temperature', min: 14, max: 30, step: 0.5, value: 20, fmt: (v) => `${v} °C` }, rerun)
  const dil = slider(g, { label: 'MQ-borax dilution', min: 0, max: 3, step: 1, value: 1, fmt: (v) => (v ? `1+${v}` : 'stock') }, rerun)
  const agit = slider(g, { label: 'Agitation', min: 0, max: 1, step: 0.25, value: 0.5, fmt: (v) => (v === 0 ? 'stand' : v < 0.5 ? 'minimal' : v === 0.5 ? '4 inversions/min' : 'continuous') }, rerun)
  const overrideT = slider(g, { label: 'Time override', min: 0, max: 25, step: 0.5, value: 0, fmt: (v) => (v ? `${v} min` : 'from the chart') }, rerun)
  const grain = toggle(g, 'Grain', true, rerun)
  const g2 = group(controls, 'Chart')
  const stock = select<FilmStockId>(g2, 'Stock', (Object.keys(FILM_STOCKS) as FilmStockId[]).map((k) => ({ value: k, text: FILM_STOCKS[k].name })), 'nj400', () => table())
  const chart = el('div', {})
  g2.append(chart)
  const row = el('div', { class: 'row' })
  controls.append(row)
  button(row, 'Develop all', () => run(), 'act primary')
  const perf = el('div', { class: 'perf' })
  controls.append(perf)

  const grid = el('div', { class: 'film-grid' })
  stage.append(grid)

  function table(): void {
    const m = makeFilm(stock.get())
    const b = makeDeveloper('filmMQBorax', { dilution: dil.get(), tempC: temp.get() })
    const rows = [-1, 0, 1, 2, 3].map((st) => {
      const r = pushPull(m, st, b, agit.get())
      return `<tr><td>EI ${Math.round(m.spec.iso * 2 ** st)}</td><td class="num">${r.minutes.toFixed(1)} min</td><td class="num">${r.gamma.toFixed(2)}</td><td class="num">${Math.round(r.shadowEI)}</td></tr>`
    })
    chart.innerHTML = `<table><tr><th>rated</th><th>time</th><th>γ</th><th>true shadow EI</th></tr>${rows.join('')}</table><p class="hint">At ${temp.get()} °C, ${dil.get() ? `1+${dil.get()}` : 'stock'}. "True shadow EI" is the speed the shadows really get: pushing buys contrast, not much speed.</p>`
  }

  function run(): number {
    const t0 = performance.now()
    table()
    grid.replaceChildren()
    const w = 240
    const h = 192
    const scene = sceneFor('mailbox', w, h)
    for (const v of VARIANTS) {
      const fp: FilmParams = { ...FILM_DEFAULTS, tempC: temp.get(), dilution: dil.get(), agitation: agit.get(), grain: grain.get(), devMin: overrideT.get(), ...v.p }
      const neg = shootAndDevelop(scene, fp)
      const pr = quickPrint(neg.densities, w, h)
      const a = imageCanvas(w, h)
      a.put(neg.lightbox)
      const b = imageCanvas(w, h)
      b.put(pr.rgba)
      a.canvas.addEventListener('click', () => showZoom({ label: v.title, note: 'negative', w, h, rgba: neg.lightbox }))
      b.canvas.addEventListener('click', () => showZoom({ label: v.title, note: 'print', w, h, rgba: pr.rgba }))
      const pair = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px' }, a.canvas, b.canvas)
      grid.append(el('figure', {}, pair, el('figcaption', {}, el('strong', {}, v.title), el('div', { class: 'hint' }, `${v.note} ${neg.note}; printed grade ${gradeLabel(Math.round(pr.grade * 2) / 2)}, ${pr.seconds.toFixed(1)} s.`))))
    }
    const ms = performance.now() - t0
    perf.textContent = `${VARIANTS.length} rolls shot, developed and printed in ${ms.toFixed(0)} ms (240 × 192)`
    return ms
  }

  return { run }
}

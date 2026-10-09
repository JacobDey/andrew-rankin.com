// photochem spike: demo page. Everything chemical lives in ./core (pure TS).

import * as core from './core/index.ts'
import { curvesTab } from './demo/curvesTab.ts'
import { cyanoTab } from './demo/cyanoTab.ts'
import { filmTab } from './demo/filmTab.ts'
import { gpuParity } from './demo/gpuParity.ts'
import { type Stage, setPng } from './demo/pipelines.ts'
import { silverTab } from './demo/silverTab.ts'
import { button, el, imageCanvas } from './demo/ui.ts'
import { type Check, runSelfTest } from './selftest.ts'

const app = document.getElementById('app')!
const nav = document.getElementById('tabs')!
const zoom = document.getElementById('zoom')!

function showZoom(s: Stage): void {
  const ic = imageCanvas(s.w, s.h)
  ic.put(s.rgba)
  zoom.replaceChildren(ic.canvas)
  zoom.classList.add('on')
}
zoom.addEventListener('click', () => zoom.classList.remove('on'))
window.addEventListener('keydown', (e) => e.key === 'Escape' && zoom.classList.remove('on'))

const TABS = [
  { id: 'silver', title: 'Silver print' },
  { id: 'cyano', title: 'Cyanotype' },
  { id: 'film', title: 'Film' },
  { id: 'curves', title: 'Curves' },
  { id: 'tests', title: 'Self-test' },
] as const
type TabId = (typeof TABS)[number]['id']

const panes = {} as Record<TabId, HTMLElement>
const buttons = {} as Record<TabId, HTMLButtonElement>
for (const t of TABS) {
  const pane = el('section', { class: 'tab', id: `tab-${t.id}`, role: 'tabpanel' })
  app.append(pane)
  panes[t.id] = pane
  const b = el('button', { role: 'tab', 'aria-selected': 'false', 'aria-controls': `tab-${t.id}` }, t.title)
  b.addEventListener('click', () => show(t.id))
  nav.append(b)
  buttons[t.id] = b
}

// Shared hidden PNG picker (the cyanotype tab reuses the silver tab's importer).
const picker = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none' })
document.body.append(picker)
picker.addEventListener('change', async () => {
  const f = picker.files?.[0]
  if (!f) return
  const bmp = await createImageBitmap(f)
  const sc = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * sc))
  c.height = Math.max(1, Math.round(bmp.height * sc))
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  setPng(core.fromRGBA8(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height))
  cyano.run()
})

const silver = silverTab(panes.silver, showZoom)
const cyano = cyanoTab(panes.cyano, showZoom, () => picker.click())
const film = filmTab(panes.film, showZoom)
const curves = curvesTab(panes.curves)

// ---- tests tab
const testsPane = panes.tests
const testCard = el('div', { class: 'card' }, el('h2', {}, 'Model self-test'))
const gpuCard = el('div', { class: 'card' }, el('h2', {}, 'GPU parity (GLSL port vs CPU reference)'))
const perfCard = el('div', { class: 'card' }, el('h2', {}, 'CPU cost per pixel'))
const testRow = el('div', { class: 'row' })
testsPane.append(testRow, testCard, gpuCard, perfCard)
button(testRow, 'Run self-test', () => renderTests(), 'act primary')
button(testRow, 'GPU parity', () => renderGpu(), 'act')
button(testRow, 'Benchmark', () => renderPerf(), 'act')

function renderTests(): Check[] {
  const t0 = performance.now()
  const res = runSelfTest()
  const ms = performance.now() - t0
  const pass = res.filter((r) => r.pass).length
  testCard.replaceChildren(el('h2', {}, `Model self-test: ${pass}/${res.length} passed (${ms.toFixed(0)} ms)`))
  const tbl = el('table')
  tbl.innerHTML = `<tr><th></th><th>group</th><th>check</th><th>value</th><th>expected</th></tr>` +
    res.map((r) => `<tr><td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'pass' : 'FAIL'}</td><td>${r.group}</td><td>${r.name}</td><td class="num">${r.value}</td><td class="num muted">${r.expect}</td></tr>`).join('')
  testCard.append(tbl)
  return res
}

function renderGpu(): ReturnType<typeof gpuParity> {
  const r = gpuParity()
  gpuCard.replaceChildren(el('h2', {}, `GPU parity: ${r.ok ? 'matches' : 'MISMATCH or unavailable'}`))
  const pre = el('pre', { class: 'log' })
  pre.textContent = JSON.stringify(r, (_k, v) => (typeof v === 'number' ? Number(v.toPrecision(3)) : v), 2)
  gpuCard.append(pre)
  return r
}

export interface PerfResult {
  res: string
  exposeNsPx: number
  developNsPx: number
  renderNsPx: number
  cyanoExposeNsPx: number
  cyanoRenderNsPx: number
}

function perfBench(w = 256, h = 320): PerfResult {
  const n = w * h
  const sheet = new core.SilverSheet(core.paper('vcPearl'), w, h)
  const mask = new Float32Array(n).map((_, i) => 10 ** -(0.3 + 1.5 * ((i % w) / w)))
  const time = (f: () => void, reps: number) => {
    f()
    const t0 = performance.now()
    for (let k = 0; k < reps; k++) f()
    return ((performance.now() - t0) / reps) * 1e6 / n
  }
  const L = core.lightBands('enlarger')
  const filt = core.vcGradeFilter(2)
  const exposeNsPx = time(() => sheet.expose(L, 0.25, { mask, filter: filt }), 4)
  sheet.recompute()
  const dev = core.makeDeveloper()
  const developNsPx = time(() => sheet.process(dev, 0.5), 8)
  const out = new Uint8ClampedArray(n * 4)
  const renderNsPx = time(() => sheet.render(out), 4)
  const cy = new core.CyanoSheet(w, h)
  cy.coat(1)
  cy.dry(3600)
  const uv = core.lightBands('uvBox')
  const cyanoExposeNsPx = time(() => cy.expose(uv, 8, { mask }), 4)
  const cyanoRenderNsPx = time(() => cy.render(out), 4)
  return { res: `${w}x${h}`, exposeNsPx, developNsPx, renderNsPx, cyanoExposeNsPx, cyanoRenderNsPx }
}

function renderPerf(): PerfResult {
  const r = perfBench()
  perfCard.replaceChildren(el('h2', {}, 'CPU cost per pixel (this browser, this machine)'))
  const tbl = el('table')
  const rows: [string, number, string][] = [
    ['expose (per call: 2 components + reciprocity)', r.exposeNsPx, 'once per frame while the enlarger is on'],
    ['develop step (exact kinetics, exchange, fog)', r.developNsPx, 'once per frame in the tray'],
    ['render to sRGB', r.renderNsPx, 'once per displayed frame'],
    ['cyanotype expose (8 s of UV, sub-stepped)', r.cyanoExposeNsPx, 'once per frame in the sun'],
    ['cyanotype render', r.cyanoRenderNsPx, 'once per displayed frame'],
  ]
  tbl.innerHTML = `<tr><th>operation</th><th>ns / pixel</th><th>ms @ 256×320</th><th>ms @ 512×640</th><th>when</th></tr>` +
    rows.map(([k, v, w]) => `<tr><td>${k}</td><td class="num">${v.toFixed(0)}</td><td class="num">${((v * 256 * 320) / 1e6).toFixed(1)}</td><td class="num">${((v * 512 * 640) / 1e6).toFixed(1)}</td><td class="muted">${w}</td></tr>`).join('')
  perfCard.append(tbl)
  return r
}

// ---- tab switching (remember the last tab, guarded)
let current: TabId = 'silver'
const ran = new Set<TabId>()
function show(id: TabId): void {
  current = id
  for (const t of TABS) {
    panes[t.id].classList.toggle('on', t.id === id)
    buttons[t.id].setAttribute('aria-selected', String(t.id === id))
  }
  try {
    localStorage.setItem('photochem.tab', id)
  } catch {
    /* storage blocked */
  }
  if (!ran.has(id)) {
    ran.add(id)
    if (id === 'silver') silver.run()
    else if (id === 'cyano') cyano.run()
    else if (id === 'film') film.run()
    else if (id === 'curves') curves.refresh()
    else if (id === 'tests') renderTests()
  }
}

let initial: TabId = 'silver'
try {
  const saved = localStorage.getItem('photochem.tab') as TabId | null
  if (saved && TABS.some((t) => t.id === saved)) initial = saved
} catch {
  /* storage blocked */
}
const hash = location.hash.replace('#', '') as TabId
if (TABS.some((t) => t.id === hash)) initial = hash
show(initial)

// ---- test hooks for the headless harness
declare global {
  interface Window {
    __spike: unknown
  }
}
window.__spike = {
  ready: true,
  core,
  show,
  tab: () => current,
  silver,
  cyano,
  film,
  curves,
  selfTest: () => {
    const r = runSelfTest()
    return { passed: r.filter((x) => x.pass).length, total: r.length, failed: r.filter((x) => !x.pass).map((x) => `${x.group}: ${x.name} = ${x.value}`) }
  },
  gpuParity: () => renderGpu(),
  perf: (w?: number, h?: number) => perfBench(w, h),
  /** Step the live silver development n simulated seconds; returns ms per step. */
  stepDev: (n: number) => silver.stepLive(n),
  state: () => {
    const s = silver.last()
    return s ? { log: s.log, facts: Object.fromEntries(s.facts), stats: s.sheet.stats(), timings: s.timings } : null
  },
}

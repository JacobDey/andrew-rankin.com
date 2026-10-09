// Cyanotype tab: coat, dry, expose (watch it print out), wash, peroxide, tone.

import { CyanoSheet, brushCoatMask, lightBands, sunBands } from '../core/index.ts'
import { type CyanoParams, type RunResult, type SourceId, type Stage, CYANO_DEFAULTS, cyanoNegative, hasPng, runCyano } from './pipelines.ts'
import { button, debounce, el, group, imageCanvas, select, slider, toggle } from './ui.ts'

export interface CyanoTab {
  run: () => RunResult & { sheet: CyanoSheet }
  live: () => Promise<{ frames: number; msPerFrame: number }>
  params: () => CyanoParams
  set: (p: Partial<CyanoParams>) => void
  save: () => number
  load: () => boolean
}

export function cyanoTab(root: HTMLElement, showZoom: (s: Stage) => void, pickPng: () => void): CyanoTab {
  const layout = el('div', { class: 'layout' })
  const controls = el('div', { class: 'controls' })
  const stage = el('div', { class: 'stage' })
  layout.append(controls, stage)
  root.append(layout)
  const p: CyanoParams = structuredClone(CYANO_DEFAULTS)
  let extraCoat: Float32Array | null = null
  let last: (RunResult & { sheet: CyanoSheet }) | null = null
  const rerun = debounce(() => run(), 120)

  const gSrc = group(controls, 'Picture')
  const source = select<SourceId>(gSrc, 'Source', [
    { value: 'mailbox', text: 'Rusty mailbox (digital negative)' },
    { value: 'fern', text: 'Fern frond (photogram)' },
    { value: 'wedge', text: '21-step wedge' },
    { value: 'png', text: 'Imported PNG (digital negative)' },
  ], p.source, () => {
    if (source.get() === 'png' && !hasPng()) pickPng()
    else rerun()
  })

  const gSens = group(controls, 'Sensitizer and coating')
  const coats = slider(gSens, { label: 'Coats', min: 0.25, max: 2.5, step: 0.25, value: p.coats, fmt: (v) => `${v}` }, rerun)
  const ratio = slider(gSens, { label: 'Part A : Part B', min: 0.5, max: 2, step: 0.1, value: 1, fmt: (v) => `${v.toFixed(1)} : 1` }, rerun)
  const age = slider(gSens, { label: 'Mixed sensitizer age', min: 0, max: 24, step: 0.5, value: p.sensitizerAgeH, fmt: (v) => `${v} h` }, rerun)
  const dry = slider(gSens, { label: 'Drying in the dark', min: 0, max: 60, step: 1, value: p.dryMin, fmt: (v) => `${v} min` }, rerun)
  const dryer = toggle(gSens, 'Hair dryer', false, rerun)
  const brushRow = el('div', { class: 'row' })
  gSens.append(brushRow)
  let painting = false
  let brushOn = false
  const bBrush = button(brushRow, 'Brush on more (paint)', () => {
    brushOn = !brushOn
    bBrush.setAttribute('aria-pressed', String(brushOn))
  }, 'act')
  button(brushRow, 'Clear', () => ((extraCoat = null), run()), 'act')

  const gExp = group(controls, 'Exposure')
  const light = select(gExp, 'Light', [{ value: 'uvBox', text: 'UV box (365 nm tubes)' }, { value: 'sun', text: 'Sun on the windowsill' }], p.light, rerun)
  const uv = slider(gExp, { label: 'UV box irradiance', min: 10, max: 80, step: 1, value: p.uvW, fmt: (v) => `${v} W/m²` }, rerun)
  const cloud = slider(gExp, { label: 'Sky', min: 0.1, max: 1, step: 0.05, value: p.cloud, fmt: (v) => (v > 0.9 ? 'clear' : v > 0.6 ? 'hazy' : v > 0.35 ? 'cloudy' : 'overcast') }, rerun)
  const mins = slider(gExp, { label: 'Exposure', min: 1, max: 60, step: 1, value: p.expMin, fmt: (v) => `${v} min` }, rerun)

  const gWet = group(controls, 'Wet processing')
  const wash = select(gWet, 'Wash in', [{ value: 'water', text: 'Running water' }, { value: 'vinegar', text: 'Water + vinegar' }, { value: 'citric', text: 'Citric acid 1%' }, { value: 'hardTap', text: 'Hard (alkaline) tap water' }], p.washBath, rerun)
  const washM = slider(gWet, { label: 'Wash time', min: 0, max: 20, step: 0.5, value: p.washMin, fmt: (v) => `${v} min` }, rerun)
  const perox = toggle(gWet, 'Hydrogen peroxide dip (the blue pop)', p.peroxide, rerun)

  const gTone = group(controls, 'Toning', false)
  const bleach = slider(gTone, { label: 'Washing soda bleach', min: 0, max: 180, step: 5, value: 0, fmt: (v) => (v ? `${v} s` : 'none') }, rerun)
  const tea = slider(gTone, { label: 'Tea bath', min: 0, max: 60, step: 1, value: 0, fmt: (v) => (v ? `${v} min` : 'none') }, rerun)
  const sodaAfter = slider(gTone, { label: 'Washing soda after tea', min: 0, max: 120, step: 5, value: 0, fmt: (v) => (v ? `${v} s` : 'none') }, rerun)
  const rest = slider(gTone, { label: 'Hang to dry', min: 1, max: 72, step: 1, value: p.restH, fmt: (v) => `${v} h` }, rerun)

  const gView = group(controls, 'Quality', false)
  const res = select<string>(gView, 'Sheet resolution', [{ value: '160', text: '160 × 128 (phone, fast)' }, { value: '320', text: '320 × 256' }, { value: '480', text: '480 × 384' }, { value: '640', text: '640 × 512' }], '320', rerun)

  const actRow = el('div', { class: 'row' })
  controls.append(actRow)
  button(actRow, 'Print', () => run(), 'act primary')
  const bLive = button(actRow, 'Expose live', () => void live(), 'act')
  button(actRow, 'Save state', () => save(), 'act')
  button(actRow, 'Load state', () => load(), 'act')
  const note = el('div', { class: 'hint' })
  controls.append(note)

  const hero = el('div', { class: 'hero' })
  const printWrap = el('div', { class: 'print-wrap' })
  let big = imageCanvas(320, 256, 'big')
  printWrap.append(big.canvas)
  const side = el('div', {})
  const facts = el('div', { class: 'facts' })
  const log = el('div', { class: 'log' })
  const perf = el('div', { class: 'perf' })
  side.append(facts, log, perf)
  hero.append(printWrap, side)
  const strip = el('div', { class: 'strip' })
  stage.append(hero, strip)

  const paintAt = (ev: PointerEvent) => {
    const w = p.width
    const h = Math.round((w * 4) / 5)
    if (!extraCoat || extraCoat.length !== w * h) extraCoat = new Float32Array(w * h)
    const r = big.canvas.getBoundingClientRect()
    const cx = ((ev.clientX - r.left) / r.width) * w
    const cy = ((ev.clientY - r.top) / r.height) * h
    const rad = Math.max(4, w * 0.05)
    for (let y = Math.max(0, Math.floor(cy - rad * 0.6)); y < Math.min(h, Math.ceil(cy + rad * 0.6)); y++) {
      // A flat hake brush: wide, short, with bristle gaps.
      const bristle = 0.6 + 0.4 * Math.abs(Math.sin(y * 2.7))
      for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(w, Math.ceil(cx + rad)); x++) {
        const d = Math.abs(x - cx) / rad
        if (d >= 1) continue
        extraCoat[y * w + x] = Math.min(1.5, extraCoat[y * w + x] + 0.08 * bristle * (1 - d))
      }
    }
    const ctx = big.canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(214, 209, 110, 0.12)'
    ctx.fillRect(cx - rad, cy - rad * 0.6, rad * 2, rad * 1.2)
  }
  const attach = (c: HTMLCanvasElement) => {
    c.addEventListener('pointerdown', (ev) => {
      if (!brushOn) return
      painting = true
      c.setPointerCapture(ev.pointerId)
      paintAt(ev)
      ev.preventDefault()
    })
    c.addEventListener('pointermove', (ev) => painting && paintAt(ev))
    const end = () => {
      if (!painting) return
      painting = false
      run()
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
  }
  attach(big.canvas)

  function readParams(): CyanoParams {
    p.width = Number(res.get())
    p.source = source.get() === 'png' && !hasPng() ? 'mailbox' : source.get()
    p.coats = coats.get()
    p.ratioAB = ratio.get()
    p.sensitizerAgeH = age.get()
    p.dryMin = dry.get()
    p.airflow = dryer.get() ? 1 : 0
    p.light = light.get() as CyanoParams['light']
    p.uvW = uv.get()
    p.cloud = cloud.get()
    p.expMin = mins.get()
    p.washBath = wash.get() as CyanoParams['washBath']
    p.washMin = washM.get()
    p.peroxide = perox.get()
    p.bleachSec = bleach.get()
    p.teaMin = tea.get()
    p.sodaAfterSec = sodaAfter.get()
    p.restH = rest.get()
    return p
  }

  function ensureBig(w: number, h: number): void {
    if (big.canvas.width === w && big.canvas.height === h) return
    const nb = imageCanvas(w, h, 'big')
    big.canvas.replaceWith(nb.canvas)
    big = nb
    attach(big.canvas)
  }

  let n = 0
  function run(): RunResult & { sheet: CyanoSheet } {
    stage.classList.add('busy')
    const params = readParams()
    if (extraCoat && extraCoat.length !== params.width * Math.round((params.width * 4) / 5)) extraCoat = null
    const r = runCyano(params, extraCoat)
    last = r
    const fin = r.stages[r.stages.length - 1]
    ensureBig(fin.w, fin.h)
    big.put(fin.rgba)
    strip.replaceChildren()
    for (const s of r.stages) {
      const ic = imageCanvas(s.w, s.h)
      ic.put(s.rgba)
      ic.canvas.addEventListener('click', () => showZoom(s))
      strip.append(el('figure', {}, ic.canvas, el('figcaption', {}, s.label, el('span', {}, s.note))))
    }
    facts.replaceChildren(el('dl', {}, ...r.facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])))
    log.textContent = `No. ${String(++n).padStart(3, '0')} — ${r.log}`
    perf.textContent = `ms: ${Object.entries(r.timings).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · ')}`
    stage.classList.remove('busy')
    return r
  }

  async function live(): Promise<{ frames: number; msPerFrame: number }> {
    bLive.disabled = true
    const params = readParams()
    const w = params.width
    const h = Math.round((w * 4) / 5)
    ensureBig(w, h)
    const s = new CyanoSheet(w, h)
    const coat = brushCoatMask(w, h)
    for (let i = 0; i < coat.length; i++) coat[i] = coat[i] * params.coats + (extraCoat && extraCoat.length === coat.length ? extraCoat[i] : 0)
    s.coat(coat, { ratioAB: params.ratioAB, sensitizerAgeH: params.sensitizerAgeH })
    s.dry(params.dryMin * 60, params.airflow)
    const mask = cyanoNegative(params, w, h)
    const L = params.light === 'uvBox' ? lightBands('uvBox', params.uvW) : sunBands(params.cloud)
    const out = new Uint8ClampedArray(w * h * 4)
    const frames = 90
    let total = 0
    await new Promise<void>((resolve) => {
      let f = 0
      const tick = () => {
        const t0 = performance.now()
        s.expose(L, (params.expMin * 60) / frames, { mask })
        s.render(out)
        big.put(out)
        total += performance.now() - t0
        f++
        perf.textContent = `live: ${((f / frames) * params.expMin).toFixed(1)} of ${params.expMin} min · ${(total / f).toFixed(1)} ms per frame (expose + render)`
        if (f < frames) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    bLive.disabled = false
    return { frames, msPerFrame: total / frames }
  }

  function save(): number {
    if (!last) run()
    const bytes = last!.sheet.toBytes()
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    try {
      localStorage.setItem('photochem.cyano', btoa(bin))
      note.textContent = `Saved to the drawer (${(bytes.length / 1024).toFixed(0)} kB).`
    } catch {
      note.textContent = `Could not save here (${(bytes.length / 1024).toFixed(0)} kB); storage is blocked or full.`
    }
    return bytes.length
  }
  function load(): boolean {
    try {
      const b64 = localStorage.getItem('photochem.cyano')
      if (!b64) return ((note.textContent = 'Nothing in the drawer yet.'), false)
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const s = CyanoSheet.fromBytes(bytes)
      ensureBig(s.w, s.h)
      const out = new Uint8ClampedArray(s.n * 4)
      s.render(out)
      big.put(out)
      note.textContent = 'Back where you left it.'
      return true
    } catch {
      note.textContent = 'Could not read the drawer.'
      return false
    }
  }

  return {
    run,
    live,
    params: () => readParams(),
    set: (q) => {
      if (q.expMin !== undefined) mins.set(q.expMin)
      if (q.coats !== undefined) coats.set(q.coats)
      if (q.source !== undefined) source.set(q.source)
      if (q.light !== undefined) light.set(q.light)
      if (q.cloud !== undefined) cloud.set(q.cloud)
      if (q.teaMin !== undefined) tea.set(q.teaMin)
      if (q.bleachSec !== undefined) bleach.set(q.bleachSec)
      if (q.sodaAfterSec !== undefined) sodaAfter.set(q.sodaAfterSec)
      if (q.peroxide !== undefined) perox.set(q.peroxide)
      if (q.washBath !== undefined) wash.set(q.washBath)
      if (q.width !== undefined) res.set(String(q.width))
    },
    save,
    load,
  }
}

// Silver print tab: source -> negative -> enlarger -> trays -> years.

import { type CAMERA_FILTERS, type FilmStockId, type LightId, type PaperId, AIR, PAPERS, SilverSheet, fromRGBA8, gradeLabel, makeDeveloper, makeFixer, makeStop, makeWash } from '../core/index.ts'
import { type SilverParams, type SilverRun, type Stage, FILM_DEFAULTS, SAFE_VIEW, SILVER_DEFAULTS, exposeSilver, hasPng, runSilver, setPng } from './pipelines.ts'
import { button, debounce, el, group, imageCanvas, logMap, select, slider, toggle } from './ui.ts'

export interface SilverTab {
  run: () => SilverRun
  live: () => Promise<{ frames: number; msPerFrame: number }>
  params: () => SilverParams
  set: (p: Partial<SilverParams>) => void
  last: () => SilverRun | null
  stepLive: (n: number) => number
  save: () => number
  load: () => boolean
}

export function silverTab(root: HTMLElement, showZoom: (s: Stage) => void): SilverTab {
  const layout = el('div', { class: 'layout' })
  const controls = el('div', { class: 'controls' })
  const stage = el('div', { class: 'stage' })
  layout.append(controls, stage)
  root.append(layout)

  const p: SilverParams = structuredClone(SILVER_DEFAULTS)
  let dodge: Float32Array | null = null
  let last: SilverRun | null = null
  const rerun = debounce(() => run(), 120)

  // ---- controls
  const gSrc = group(controls, 'Picture')
  const source = select(gSrc, 'Source', [
    { value: 'mailbox', text: 'Rusty mailbox (procedural)' },
    { value: 'wedge', text: '21-step wedge' },
    { value: 'png', text: 'Imported PNG' },
  ], p.source as 'mailbox', () => {
    if (source.get() === 'png' && !hasPng()) fileInput.click()
    else rerun()
  })
  const fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' })
  const fileRow = el('div', { class: 'ctl' }, el('div', { class: 'ctl-head' }, el('label', {}, 'Import a picture')), fileInput)
  gSrc.append(fileRow)
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0]
    if (!f) return
    const bmp = await createImageBitmap(f)
    const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * scale))
    c.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = c.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const data = ctx.getImageData(0, 0, c.width, c.height)
    setPng(fromRGBA8(data.data, c.width, c.height))
    source.set('png')
    dodge = null
    run()
  })
  const negative = select(gSrc, 'Negative', [
    { value: 'film', text: 'Camera negative (shot on film)' },
    { value: 'digital', text: 'Digital negative (inkjet)' },
  ], p.negative, rerun)
  const stock = select<FilmStockId>(gSrc, 'Film stock', [
    { value: 'nj400', text: 'Nightjar 400 (pan)' },
    { value: 'nj100', text: 'Nightjar 100 (pan)' },
    { value: 'ortho25', text: 'Nightjar Ortho 25 (red-blind)' },
    { value: 'dryPlate', text: 'Gelatin dry plate (blue only)' },
  ], p.film.stock, rerun)
  const camFilter = select<keyof typeof CAMERA_FILTERS>(gSrc, 'Camera filter', [
    { value: 'none', text: 'None' }, { value: 'yellow8', text: 'Yellow #8' }, { value: 'orange21', text: 'Orange #21' }, { value: 'red25', text: 'Red #25' }, { value: 'green11', text: 'Green #11' },
  ], p.film.filter, rerun)
  const push = slider(gSrc, { label: 'Rated speed', min: -1, max: 3, step: 1, value: 0, fmt: (v) => (v === 0 ? 'box speed' : `${v > 0 ? '+' : ''}${v} stop${Math.abs(v) > 1 ? 's' : ''}`) }, rerun)
  const devForPush = toggle(gSrc, 'Develop for the rated speed (push/pull chart)', true, rerun)

  const gEnl = group(controls, 'Enlarger')
  const paperSel = select<PaperId>(gEnl, 'Paper', Object.values(PAPERS).map((x) => ({ value: x.id as PaperId, text: x.name })), p.paper, rerun)
  const auto = toggle(gEnl, 'Auto grade and time (a printer’s first guess)', p.auto, () => {
    grade.root.style.opacity = auto.get() ? '0.5' : '1'
    secs.root.style.opacity = auto.get() ? '0.5' : '1'
    rerun()
  })
  const grade = slider(gEnl, { label: 'Contrast grade', min: -1, max: 5, step: 0.5, value: p.grade, fmt: gradeLabel }, () => (auto.set(false), rerun()))
  const lm = logMap(1, 120)
  const secs = slider(gEnl, { label: 'Exposure', min: 0, max: 1, step: 0.001, value: p.seconds, ...lm, fmt: (v) => `${v.toFixed(1)} s` }, () => (auto.set(false), rerun()))
  grade.root.style.opacity = '0.5'
  secs.root.style.opacity = '0.5'
  const fstop = select(gEnl, 'Lens', [{ value: '5.6', text: 'f/5.6' }, { value: '8', text: 'f/8' }, { value: '11', text: 'f/11' }, { value: '16', text: 'f/16' }], '8', rerun)
  const brushRow = el('div', { class: 'row' })
  gEnl.append(brushRow)
  let brush: 'off' | 'dodge' | 'burn' = 'off'
  const bDodge = button(brushRow, 'Dodge (paint)', () => setBrush(brush === 'dodge' ? 'off' : 'dodge'), 'act')
  const bBurn = button(brushRow, 'Burn (paint)', () => setBrush(brush === 'burn' ? 'off' : 'burn'), 'act')
  button(brushRow, 'Clear', () => ((dodge = null), run()), 'act')
  gEnl.append(el('div', { class: 'hint' }, 'Paint on the print with a mouse or a finger, then let go: dodging holds light back, burning adds it.'))
  const setBrush = (b: typeof brush) => {
    brush = b
    bDodge.setAttribute('aria-pressed', String(b === 'dodge'))
    bBurn.setAttribute('aria-pressed', String(b === 'burn'))
  }

  const gSafe = group(controls, 'Safelight and accidents', false)
  const safe = select<LightId | 'none'>(gSafe, 'Safelight', [
    { value: 'none', text: 'None (total dark)' }, { value: 'safelightAmber', text: 'Amber (OC)' }, { value: 'safelightRed', text: 'Red (1A)' },
    { value: 'safelightSodium', text: 'Sodium vapour' }, { value: 'safelightGreen', text: 'Dark green (wrong one)' }, { value: 'dialLamp', text: 'Radio dial lamp, tape peeled' }, { value: 'roomLED', text: 'Room light (oops)' },
  ], p.safelight, rerun)
  const safeMin = slider(gSafe, { label: 'Paper out of the box', min: 0, max: 20, step: 0.5, value: p.safelightMin, fmt: (v) => `${v} min` }, rerun)
  const flash = slider(gSafe, { label: 'Sabattier flash', min: 0, max: 8, step: 0.25, value: 0, fmt: (v) => (v ? `${v} lux·s` : 'none') }, rerun)
  const flashAt = slider(gSafe, { label: 'Flash at', min: 10, max: 85, step: 1, value: p.flashAt, fmt: (v) => `${v} s into dev` }, rerun)
  gSafe.append(el('div', { class: 'hint' }, 'A dim bulb mid-development: the developed silver screens it, so highlights darken past the midtones (partial reversal). Development stops rocking after the flash, as you would.'))

  const gDev = group(controls, 'Developer')
  const devF = select(gDev, 'Formula', [{ value: 'paperMQ', text: 'MQ paper developer' }, { value: 'caffenol', text: 'Coffee, washing soda, vitamin C' }], p.devFormula, rerun)
  const devT = slider(gDev, { label: 'Temperature', min: 10, max: 30, step: 0.5, value: p.devTemp, fmt: (v) => `${v} °C` }, rerun)
  const devD = slider(gDev, { label: 'Dilution', min: 4, max: 19, step: 1, value: p.devDilution, fmt: (v) => `1+${v}` }, rerun)
  const devS = slider(gDev, { label: 'Time in the tray', min: 10, max: 240, step: 5, value: p.devSeconds, fmt: (v) => `${v} s` }, rerun)
  const agit = slider(gDev, { label: 'Rocking', min: 0, max: 1, step: 0.05, value: p.agitation, fmt: (v) => (v < 0.05 ? 'still' : v < 0.4 ? 'lazy' : v < 0.8 ? 'steady' : 'continuous') }, rerun)
  const diffuse = toggle(gDev, 'Local exhaustion spreads (bromide drag, Mackie lines; slower)', p.diffuse, rerun)
  const prev = slider(gDev, { label: 'Prints already through this litre', min: 0, max: 60, step: 1, value: 0, fmt: (v) => `${v}` }, rerun)

  const gFix = group(controls, 'Stop, fix, wash', false)
  const stopK = select(gFix, 'Stop', [{ value: 'acetic', text: 'Acetic stop' }, { value: 'water', text: 'Water rinse' }], p.stop, rerun)
  const stopS = slider(gFix, { label: 'Stop time', min: 0, max: 60, step: 5, value: p.stopSeconds, fmt: (v) => `${v} s` }, rerun)
  const fixS = slider(gFix, { label: 'Fix time', min: 0, max: 300, step: 5, value: p.fixSeconds, fmt: (v) => `${v} s` }, rerun)
  const fixL = slider(gFix, { label: 'Silver already in the fixer', min: 0, max: 6, step: 0.1, value: p.fixerLoad, fmt: (v) => `${v.toFixed(1)} g/L` }, rerun)
  const hca = toggle(gFix, 'Hypo clearing agent', p.hca, rerun)
  const washM = slider(gFix, { label: 'Wash', min: 0, max: 60, step: 0.5, value: p.washMin, fmt: (v) => `${v} min` }, rerun)

  const gTone = group(controls, 'Toning and time', false)
  const toner = select(gTone, 'Toner', [{ value: 'none', text: 'None' }, { value: 'selenium', text: 'Selenium 1+9' }, { value: 'sepia', text: 'Sepia (bleach + sulfide)' }], p.toner, rerun)
  const tonerM = slider(gTone, { label: 'Toner time', min: 1, max: 10, step: 0.5, value: p.tonerMin, fmt: (v) => `${v} min` }, rerun)
  const years = slider(gTone, { label: 'Then hang it for', min: 0, max: 100, step: 1, value: 0, fmt: (v) => (v ? `${v} years` : 'no time') }, rerun)

  const gView = group(controls, 'View and quality', false)
  const res = select<string>(gView, 'Sheet resolution', [{ value: '160', text: '160 × 128 (phone, fast)' }, { value: '320', text: '320 × 256' }, { value: '480', text: '480 × 384' }, { value: '640', text: '640 × 512 (desktop)' }], '320', rerun)
  const viewSafe = toggle(gView, 'Show tray stages under the safelight', true, rerun)

  const actRow = el('div', { class: 'row' })
  controls.append(actRow)
  button(actRow, 'Print', () => run(), 'act primary')
  const bLive = button(actRow, 'Develop live', () => void live(), 'act')
  button(actRow, 'Save state', () => save(), 'act')
  button(actRow, 'Load state', () => load(), 'act')
  const saveNote = el('div', { class: 'hint' })
  controls.append(saveNote)

  // ---- stage
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

  // ---- painting (pointer events: mouse, pen and touch)
  let painting = false
  const paintAt = (ev: PointerEvent) => {
    if (!last) return
    const r = big.canvas.getBoundingClientRect()
    const w = last.sheet.w
    const h = last.sheet.h
    if (!dodge || dodge.length !== w * h) dodge = new Float32Array(w * h)
    const cx = ((ev.clientX - r.left) / r.width) * w
    const cy = ((ev.clientY - r.top) / r.height) * h
    const rad = Math.max(4, w * 0.06)
    const sgn = brush === 'dodge' ? -1 : 1
    for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(h, Math.ceil(cy + rad)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(w, Math.ceil(cx + rad)); x++) {
        const d = Math.hypot(x - cx, y - cy) / rad
        if (d >= 1) continue
        const a = 0.12 * (1 - d * d)
        const i = y * w + x
        dodge[i] = Math.max(-1, Math.min(1, dodge[i] + sgn * a))
      }
    }
    // Show the mask on the print while painting.
    const ctx = big.canvas.getContext('2d')!
    ctx.fillStyle = brush === 'dodge' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  const attachPaint = (c: HTMLCanvasElement) => {
    c.addEventListener('pointerdown', (ev) => {
      if (brush === 'off') return
      painting = true
      c.setPointerCapture(ev.pointerId)
      paintAt(ev)
      ev.preventDefault()
    })
    c.addEventListener('pointermove', (ev) => {
      if (painting) paintAt(ev)
    })
    const end = () => {
      if (!painting) return
      painting = false
      run()
    }
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
  }
  attachPaint(big.canvas)

  function readParams(): SilverParams {
    p.width = Number(res.get())
    p.source = source.get() === 'png' && !hasPng() ? 'mailbox' : source.get()
    p.negative = negative.get() as SilverParams['negative']
    // Shot at the rated speed; developed either for it (push/pull chart) or at the box-speed time.
    p.film = devForPush.get()
      ? { ...FILM_DEFAULTS, stock: stock.get(), filter: camFilter.get(), push: push.get() }
      : { ...FILM_DEFAULTS, stock: stock.get(), filter: camFilter.get(), push: 0, ev: -push.get() }
    p.paper = paperSel.get()
    p.auto = auto.get()
    p.grade = grade.get()
    p.seconds = secs.get()
    p.fNumber = Number(fstop.get())
    p.safelight = safe.get()
    p.safelightMin = safeMin.get()
    p.flashLuxS = flash.get()
    p.flashAt = flashAt.get()
    p.devFormula = devF.get() as SilverParams['devFormula']
    p.devTemp = devT.get()
    p.devDilution = devD.get()
    p.devSeconds = devS.get()
    p.agitation = agit.get()
    p.diffuse = diffuse.get()
    p.prevPrints = prev.get()
    p.stop = stopK.get() as SilverParams['stop']
    p.stopSeconds = stopS.get()
    p.fixSeconds = fixS.get()
    p.fixerLoad = fixL.get()
    p.hca = hca.get()
    p.washMin = washM.get()
    p.toner = toner.get() as SilverParams['toner']
    p.tonerMin = tonerM.get()
    p.years = years.get()
    p.viewUnderSafelight = viewSafe.get()
    return p
  }

  function ensureBig(w: number, h: number): void {
    if (big.canvas.width === w && big.canvas.height === h) return
    const nb = imageCanvas(w, h, 'big')
    big.canvas.replaceWith(nb.canvas)
    big = nb
    attachPaint(big.canvas)
  }

  function showStages(stages: Stage[]): void {
    strip.replaceChildren()
    for (const s of stages) {
      const ic = imageCanvas(s.w, s.h)
      ic.put(s.rgba)
      ic.canvas.addEventListener('click', () => showZoom(s))
      strip.append(el('figure', {}, ic.canvas, el('figcaption', {}, s.label, el('span', {}, s.note))))
    }
  }

  function showFacts(r: SilverRun): void {
    facts.replaceChildren(el('dl', {}, ...r.facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])))
    log.textContent = `No. ${String(++printNo).padStart(3, '0')} — ${r.log}`
    const t = r.timings
    perf.textContent = `ms: ${Object.entries(t).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · ')}`
  }
  let printNo = 0

  function run(): SilverRun {
    stage.classList.add('busy')
    const r = runSilver(readParams(), dodge)
    last = r
    const fin = r.stages[r.stages.length - 1]
    ensureBig(fin.w, fin.h)
    big.put(fin.rgba)
    showStages(r.stages)
    showFacts(r)
    if (auto.get()) {
      grade.set(r.grade)
      secs.set(r.seconds)
    }
    stage.classList.remove('busy')
    return r
  }

  // ---- live development: the image comes up in the tray under the safelight
  let liveState: { sheet: SilverSheet; t: number; dev: ReturnType<typeof makeDeveloper>; out: Uint8ClampedArray } | null = null
  function startLive(): void {
    const params = readParams()
    const { sheet } = exposeSilver(params, dodge)
    ensureBig(sheet.w, sheet.h)
    const dev = makeDeveloper(params.devFormula, { tempC: params.devTemp, dilution: params.devDilution })
    sheet.enter(dev)
    liveState = { sheet, t: 0, dev, out: new Uint8ClampedArray(sheet.n * 4) }
  }
  function stepLive(n: number): number {
    if (!liveState) startLive()
    const L = liveState!
    let ms = 0
    for (let k = 0; k < n; k++) {
      const t0 = performance.now()
      L.sheet.process(L.dev, 1, { agitation: p.agitation, diffuse: p.diffuse })
      L.t += 1
      L.sheet.render(L.out, p.viewUnderSafelight ? SAFE_VIEW : [1, 1, 1])
      big.put(L.out)
      ms += performance.now() - t0
    }
    return ms / Math.max(1, n)
  }
  async function live(): Promise<{ frames: number; msPerFrame: number }> {
    bLive.disabled = true
    startLive()
    let frames = 0
    let total = 0
    const params = readParams()
    await new Promise<void>((resolve) => {
      const tick = () => {
        total += stepLive(1)
        frames++
        perf.textContent = `live: ${liveState!.t} s in the tray · ${(total / frames).toFixed(1)} ms per simulated second (develop + render)`
        if (liveState!.t < params.devSeconds) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    // Finish: stop, fix, wash, dry, and show it in daylight.
    const s = liveState!.sheet
    s.process(makeStop(params.stop), params.stopSeconds)
    s.process(makeFixer(), params.fixSeconds)
    s.process(makeWash(), params.washMin * 60)
    s.process({ ...AIR, airflow: 0.3 }, 3600)
    s.render(liveState!.out)
    big.put(liveState!.out)
    const res = { frames, msPerFrame: total / Math.max(1, frames) }
    liveState = null
    bLive.disabled = false
    return res
  }

  // ---- save states (localStorage, guarded)
  function save(): number {
    if (!last) run()
    const bytes = last!.sheet.toBytes()
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    try {
      localStorage.setItem('photochem.silver', btoa(bin))
      saveNote.textContent = `Saved to the drawer (${(bytes.length / 1024).toFixed(0)} kB).`
    } catch {
      saveNote.textContent = `Could not save here (${(bytes.length / 1024).toFixed(0)} kB); storage is blocked or full.`
    }
    return bytes.length
  }
  function load(): boolean {
    try {
      const b64 = localStorage.getItem('photochem.silver')
      if (!b64) {
        saveNote.textContent = 'Nothing in the drawer yet.'
        return false
      }
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const sheet = SilverSheet.fromBytes(bytes)
      ensureBig(sheet.w, sheet.h)
      const out = new Uint8ClampedArray(sheet.n * 4)
      sheet.render(out)
      big.put(out)
      saveNote.textContent = 'Back where you left it.'
      return true
    } catch {
      saveNote.textContent = 'Could not read the drawer.'
      return false
    }
  }

  return {
    run,
    live,
    params: () => readParams(),
    set: (q) => {
      if (q.grade !== undefined) (grade.set(q.grade), auto.set(false))
      if (q.seconds !== undefined) (secs.set(q.seconds), auto.set(false))
      if (q.auto !== undefined) auto.set(q.auto)
      if (q.devTemp !== undefined) devT.set(q.devTemp)
      if (q.devSeconds !== undefined) devS.set(q.devSeconds)
      if (q.flashLuxS !== undefined) flash.set(q.flashLuxS)
      if (q.flashAt !== undefined) flashAt.set(q.flashAt)
      if (q.width !== undefined) res.set(String(q.width))
      if (q.source !== undefined) source.set(q.source as 'mailbox')
      if (q.paper !== undefined) paperSel.set(q.paper)
      if (q.toner !== undefined) toner.set(q.toner)
      if (q.years !== undefined) years.set(q.years)
      if (q.safelight !== undefined) safe.set(q.safelight)
      if (q.safelightMin !== undefined) safeMin.set(q.safelightMin)
      if (q.negative !== undefined) negative.set(q.negative)
      if (q.fixSeconds !== undefined) fixS.set(q.fixSeconds)
      if (q.washMin !== undefined) washM.set(q.washMin)
      if (q.viewUnderSafelight !== undefined) viewSafe.set(q.viewUnderSafelight)
    },
    last: () => last,
    stepLive,
    save,
    load,
  }
}

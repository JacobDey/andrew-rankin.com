// Curves tab: the sensitometry behind the toy, plotted from the live model.

import {
  type FilmStockId, type LightId, type PaperId, BAND_NM, CYANO_BATHS, CyanoSheet, LIGHTS, PAPERS, SENSITIVITY, SilverSheet,
  VC_FILTER_TABLE, curveDensity, developerRates, filmProgress, gradeLabel, lightBands, linearToHex, makeDeveloper, makeFilm,
  observedNet, paper, paperMetrics, printCurve, pushPull, reciprocityCorrectedTime, vcGradeFilter,
} from '../core/index.ts'
import { safeTime } from '../selftest.ts'
import { type Series, barsLog, plot } from './plot.ts'
import { debounce, el, fmtTime, group, select, slider } from './ui.ts'

const GRADE_COLORS = ['#f4e04d', '#f0cf48', '#ecbd46', '#e7aa48', '#e2984d', '#dc8654', '#d5745e', '#cd6469', '#c35675', '#b84b82', '#ab4290', '#9d3c9e']

export function curvesTab(root: HTMLElement): { refresh: () => void } {
  const layout = el('div', { class: 'layout' })
  const controls = el('div', { class: 'controls' })
  const stage = el('div', { class: 'stage' })
  layout.append(controls, stage)
  root.append(layout)
  const plots = el('div', { class: 'plots' })
  stage.append(plots)
  const fig = (caption: string) => {
    const c = el('canvas')
    const f = el('figure', {}, c, el('figcaption', {}, caption))
    plots.append(f)
    return c
  }
  const cVC = fig('Variable-contrast paper through the calibrated dichroic filter table. Grades 00 to 3½ need the same exposure, 4 and 5 need double: the Ilford convention, solved by tools/calibrate.ts.')
  const cGraded = fig('Graded (blue-sensitive) paper, one emulsion per grade. The toe is long, the shoulder is the surface reflection floor.')
  const cDev = fig('A step wedge in the tray. Shadows come up first (≈8–12 s), midtones by 30 s, highlights at 45–60 s, done by 90 s. Cold developer is slow and grey; hot developer fogs.')
  const cSafe = fig('Time for unexposed paper to gain a just-visible 0.04 density. Pre-flashed paper (the coin test) shows fog sooner. Reciprocity failure at these tiny intensities makes safelights safer than a naive dose would suggest.')
  const cFilm = fig('Film development: gamma rises with time and saturates (first-order kinetics). Markers show the push/pull chart: the time that puts a zone VII tone where it belongs.')
  const cFilmHD = fig('Film H&D curves for N-1 … N+2 development. Pushing lifts mid-tones and highlights; the shadows barely move (the honest truth about pushing).')
  const cRecip = fig('Reciprocity: the time you really need when the meter says t. Film fails above ~1 s (Schwarzschild p ≈ 0.27, the classic t^1.3 rule); paper only for long exposures; cyanotype never.')
  const cCyano = fig('Cyanotype: density after wash + peroxide vs UV-box time, for ½, 1 and 2 coats (solid), and while still in the frame (dashed). Past ~20 min the deepest shadows bronze and partly reverse.')
  const cSpec = fig('The five-band spectral model: emulsion sensitivities (solid) and light sources (dashed), each normalised to its peak.')
  const sw = el('div', { class: 'card' }, el('h2', {}, 'Colour checks'))
  stage.append(sw)

  // Controls
  const g1 = group(controls, 'Paper')
  const paperSel = select<PaperId>(g1, 'Paper', Object.values(PAPERS).filter((p) => p.kind === 'vc').map((p) => ({ value: p.id as PaperId, text: p.name })), 'vcGlossy', () => refresh())
  const g2 = group(controls, 'Developer')
  const temp = slider(g2, { label: 'Temperature', min: 10, max: 30, step: 0.5, value: 20, fmt: (v) => `${v} °C` }, debounce(() => refresh(), 80))
  const dil = slider(g2, { label: 'Dilution 1+', min: 4, max: 19, step: 1, value: 9, fmt: (v) => `1+${v}` }, debounce(() => refresh(), 80))
  const g3 = group(controls, 'Film')
  const stock = select<FilmStockId>(g3, 'Stock', [{ value: 'nj400', text: 'Nightjar 400' }, { value: 'nj100', text: 'Nightjar 100' }, { value: 'ortho25', text: 'Nightjar Ortho 25' }, { value: 'dryPlate', text: 'Gelatin dry plate' }], 'nj400', () => refresh())
  const metrics = el('div', { class: 'card' })
  controls.append(metrics)

  function refresh(): void {
    const model = paper(paperSel.get())
    // --- VC curves
    const vc: Series[] = VC_FILTER_TABLE.map((row, i) => {
      const f = printCurve(model, vcGradeFilter(row.grade))
      const pts: [number, number][] = []
      for (let x = -1.2; x <= 2.0; x += 0.02) pts.push([x, f(x)])
      return { label: gradeLabel(row.grade), color: GRADE_COLORS[i], points: pts }
    })
    const fOpen = printCurve(model)
    const open: [number, number][] = []
    for (let x = -1.2; x <= 2.0; x += 0.02) open.push([x, fOpen(x)])
    vc.push({ label: 'no filter', color: '#ffffff', points: open, dash: [4, 4], width: 1.2 })
    plot(cVC, vc, { title: `${model.spec.name}: density vs exposure`, xLabel: 'log₁₀ exposure (lux·s at the easel, unfiltered)', yLabel: 'net reflection density', xRange: [-1.2, 2.0], yRange: [0, 2.3], legend: true })
    // metrics table
    const rows = VC_FILTER_TABLE.map((r) => {
      const m = paperMetrics(model, vcGradeFilter(r.grade))
      return `<tr><td>${gradeLabel(r.grade)}</td><td class="num">${r.y.toFixed(0)}Y ${r.m.toFixed(0)}M</td><td class="num">${m.isoR.toFixed(0)}</td><td class="num">${m.isoP.toFixed(0)}</td></tr>`
    }).join('')
    metrics.innerHTML = `<h2>Filter drawer</h2><table><tr><th>grade</th><th>dichroic</th><th>ISO R</th><th>ISO P</th></tr>${rows}</table><p class="hint">Dmax ${paperMetrics(model).dmax.toFixed(2)} (${model.spec.surface}).</p>`

    // --- graded
    const graded: Series[] = []
    for (let g = 0; g <= 5; g++) {
      const pm = paper('bromide', g)
      const f = printCurve(pm)
      const pts: [number, number][] = []
      for (let x = -1.2; x <= 2.2; x += 0.02) pts.push([x, f(x)])
      graded.push({ label: `grade ${g} · R ${paperMetrics(pm).isoR.toFixed(0)}`, color: GRADE_COLORS[2 * g + 1], points: pts })
    }
    plot(cGraded, graded, { title: 'Nightjar Bromide graded paper', xLabel: 'log₁₀ exposure (lux·s)', yLabel: 'net reflection density', xRange: [-1.2, 2.2], yRange: [0, 2.3], legend: true })

    // --- development wedge
    const n = 6
    const s = new SilverSheet(model, n, 1)
    const mask = new Float32Array(n).map((_, i) => 10 ** -(0.3 + 0.3 * i))
    s.expose(lightBands('enlarger'), 14, { mask, filter: vcGradeFilter(2) })
    const dev = makeDeveloper('paperMQ', { tempC: temp.get(), dilution: dil.get() })
    const base = observedNet(model.surfaceWet, 0)
    const series: Series[] = Array.from({ length: n }, (_, i) => ({ label: `neg D ${(0.3 + 0.3 * i).toFixed(1)}`, color: `hsl(${30 + i * 8}, ${90 - i * 8}%, ${70 - i * 6}%)`, points: [[0, 0]] as [number, number][] }))
    for (let t = 0.5; t <= 180; t += 0.5) {
      s.process(dev, 0.5)
      for (let i = 0; i < n; i++) series[i].points.push([t, s.observedDensity(i) - base - 0.044])
    }
    const r = developerRates(dev)
    plot(cDev, series, { title: `Development at ${temp.get()} °C, 1+${dil.get()} (rate ×${r.paper.toFixed(2)}, Dmax ×${r.dmaxFactor.toFixed(2)})`, xLabel: 'seconds in the developer', yLabel: 'net density (wet)', xRange: [0, 180], yRange: [0, 2.4], legend: true })

    // --- safelights
    const lights: LightId[] = ['safelightRed', 'safelightAmber', 'safelightSodium', 'rubyLantern', 'dialLamp', 'safelightGreen', 'roomLED', 'room']
    const vcm = paper('vcPearl')
    const gm = paper('bromide')
    const rowsS = lights.flatMap((id) => {
      const L = LIGHTS[id]
      const a = safeTime(vcm, id)
      const b = safeTime(vcm, id, 0.03)
      const c = safeTime(gm, id)
      return [
        { label: `${L.name.replace('Safelight, ', '').slice(0, 24)} · VC`, value: a, color: L.hex, text: fmtTime(a) },
        { label: '   pre-flashed VC', value: b, color: L.hex + '99', text: fmtTime(b) },
        { label: '   graded', value: c, color: L.hex + '66', text: fmtTime(c) },
      ]
    })
    barsLog(cSafe, rowsS, 'Safe time to ΔD 0.04 (log scale)', [1e-4, 3.2e7], [
      { v: 1e-3, s: '1 ms' }, { v: 1, s: '1 s' }, { v: 60, s: '1 min' }, { v: 3600, s: '1 h' }, { v: 86400, s: '1 day' }, { v: 3.15e7, s: '1 yr' },
    ], 560, 520)

    // --- film time-gamma
    const fm = makeFilm(stock.get())
    const fs: Series[] = []
    for (const T of [18, 20, 24]) {
      const b = makeDeveloper('filmMQBorax', { dilution: 1, tempC: T })
      const rate = developerRates(b).film
      const pts: [number, number][] = []
      for (let m = 0; m <= 25; m += 0.25) pts.push([m, filmProgress(fm, rate, m * 60) * fm.curve.gamma])
      fs.push({ label: `${T} °C, 1+1`, color: T === 20 ? '#ffd28a' : T < 20 ? '#7fb2ff' : '#ff8a6a', points: pts })
    }
    const b20 = makeDeveloper('filmMQBorax', { dilution: 1 })
    const marks: Series[] = [-1, 0, 1, 2].map((st) => {
      const pp = pushPull(fm, st, b20)
      return { label: `${st > 0 ? '+' : ''}${st}: ${pp.minutes.toFixed(1)} min`, color: '#ffffff', points: [[pp.minutes, 0], [pp.minutes, pp.gamma]] as [number, number][], dash: [2, 3], width: 1 }
    })
    plot(cFilm, [...fs, ...marks], { title: `${fm.spec.name}: gamma vs development time`, xLabel: 'minutes', yLabel: 'gamma (straight-line slope)', xRange: [0, 25], yRange: [0, fm.curve.gamma * 1.05], legend: true })

    // --- film H&D under pushes
    const hd: Series[] = [-1, 0, 1, 2].map((st, i) => {
      const pp = pushPull(fm, st, b20)
      const p = filmProgress(fm, developerRates(b20).film, pp.minutes * 60)
      const pts: [number, number][] = []
      for (let x = -4; x <= 1; x += 0.02) pts.push([x, p * curveDensity(fm.curve, x)])
      return { label: `N${st >= 0 ? '+' : ''}${st} (${pp.minutes.toFixed(1)} min)`, color: ['#7fb2ff', '#ffd28a', '#ff9a3c', '#ff5f4a'][i], points: pts }
    })
    const lm = Math.log10(fm.Hm)
    hd.push({ label: 'speed point Hm', color: '#888', points: [[lm, 0], [lm, 2.4]], dash: [3, 3], width: 1 })
    plot(cFilmHD, hd, { title: `${fm.spec.name}: net density vs log H`, xLabel: 'log₁₀ H (lux·s)', yLabel: 'net density', xRange: [lm - 1, lm + 3.6], yRange: [0, 2.4], legend: true })

    // --- reciprocity
    const rec: Series[] = []
    const ts: number[] = []
    for (let lt = -1; lt <= 2.5; lt += 0.05) ts.push(10 ** lt)
    for (const id of ['nj400', 'nj100', 'dryPlate'] as FilmStockId[]) {
      const m = makeFilm(id)
      rec.push({ label: m.spec.name, color: id === 'nj400' ? '#ffd28a' : id === 'nj100' ? '#ff9a3c' : '#c9a0ff', points: ts.map((t) => [Math.log10(t), Math.log10(reciprocityCorrectedTime(m.recip, t, m.Hm * 10))]) })
    }
    const pm = paper('vcPearl')
    const H06 = 2
    rec.push({ label: 'VC paper', color: '#9ad0ff', points: ts.map((t) => [Math.log10(t), Math.log10(reciprocityCorrectedTime(pm.soft!.recip, t, H06))]) })
    rec.push({ label: 'cyanotype / ideal', color: '#666', points: [[-1, -1], [2.5, 2.5]], dash: [4, 4], width: 1 })
    plot(cRecip, rec, { title: 'Reciprocity failure', xLabel: 'log₁₀ metered time (s)', yLabel: 'log₁₀ time needed (s)', xRange: [-1, 2.5], yRange: [-1, 3.2], legend: true, xFmt: (v) => fmtTime(10 ** v), yFmt: (v) => fmtTime(10 ** v) })

    // --- cyanotype exposure curves
    const cs: Series[] = []
    const coats = [0.5, 1, 2]
    const colors = ['#9cc3e6', '#4f8fd6', '#2a5b9e']
    coats.forEach((ct, ci) => {
      const live: [number, number][] = []
      const fin: [number, number][] = []
      for (let m = 0; m <= 40; m += 1) {
        const s2 = new CyanoSheet(1, 1)
        s2.coat(ct)
        s2.dry(3600)
        s2.expose(lightBands('uvBox'), m * 60)
        live.push([m, s2.visualDensity(0)])
        s2.process(CYANO_BATHS.water, 300)
        s2.process(CYANO_BATHS.peroxide, 5)
        s2.rest(2)
        fin.push([m, s2.visualDensity(0)])
      }
      cs.push({ label: `${ct} coat${ct === 1 ? '' : 's'} final`, color: colors[ci], points: fin })
      cs.push({ label: `${ct} in frame`, color: colors[ci], points: live, dash: [5, 4], width: 1.3 })
    })
    plot(cCyano, cs, { title: 'Cyanotype: visual density vs minutes under a 40 W/m² UV box', xLabel: 'minutes', yLabel: 'visual density', xRange: [0, 40], yRange: [0, 1.8], legend: true })

    // --- spectra
    const em: [string, keyof typeof SENSITIVITY, string][] = [
      ['VC hard', 'vcHard', '#c35675'], ['VC soft', 'vcSoft', '#8fcf7a'], ['graded', 'paperGraded', '#7fb2ff'], ['pan film', 'filmPan', '#ddd'], ['ortho film', 'filmOrtho', '#bbb'], ['cyanotype', 'cyanotype', '#4f8fd6'],
    ]
    const spec: Series[] = em.map(([label, k, color]) => {
      const v = SENSITIVITY[k]
      const mx = Math.max(...v)
      return { label, color, points: BAND_NM.map((nm, i) => [nm, Math.max(1e-7, v[i] / mx)] as [number, number]) }
    })
    for (const id of ['safelightAmber', 'safelightRed', 'enlarger', 'uvBox'] as LightId[]) {
      const v = lightBands(id)
      const mx = Math.max(...v)
      spec.push({ label: LIGHTS[id].name.replace('Safelight, ', '').slice(0, 18), color: LIGHTS[id].hex, points: BAND_NM.map((nm, i) => [nm, Math.max(1e-7, v[i] / mx)] as [number, number]), dash: [5, 4] })
    }
    plot(cSpec, spec, { title: 'Spectral sensitivity and light (relative, log)', xLabel: 'band centre (nm)', yLabel: 'relative (log₁₀)', xRange: [350, 660], yRange: [1e-7, 2], logY: true, legend: true, xTicks: [...BAND_NM], yTicks: [] })

    // --- swatches
    swatches()
  }

  function swatches(): void {
    sw.querySelectorAll('.swatches, p').forEach((n) => n.remove())
    const strip = (title: string, cols: { hex: string; t: string }[]) => {
      sw.append(el('p', { class: 'hint' }, title))
      const d = el('div', { class: 'swatches' })
      for (const c of cols) {
        const b = el('div', {}, c.t)
        b.style.background = c.hex
        d.append(b)
      }
      sw.append(d)
    }
    const cyan: { hex: string; t: string }[] = []
    const stagesC: [string, (s: CyanoSheet) => void][] = [
      ['coat', () => {}],
      ['4 min', (s) => s.expose(lightBands('uvBox'), 240)],
      ['12 min', (s) => s.expose(lightBands('uvBox'), 480)],
      ['30 min', (s) => s.expose(lightBands('uvBox'), 1080)],
      ['wash', (s) => s.process(CYANO_BATHS.water, 300)],
      ['H₂O₂', (s) => s.process(CYANO_BATHS.peroxide, 5)],
    ]
    const s = new CyanoSheet(1, 1)
    s.coat(1)
    s.dry(3600)
    for (const [t, f] of stagesC) {
      f(s)
      cyan.push({ hex: linearToHex(s.reflectance(0)), t })
    }
    strip('Cyanotype, clear area through the process (30 min = overexposed: bronze, then partial reversal):', cyan)
    const ton: { hex: string; t: string }[] = []
    const base = () => {
      const x = new CyanoSheet(1, 1)
      x.coat(1)
      x.dry(3600)
      x.expose(lightBands('uvBox'), 720)
      x.process(CYANO_BATHS.water, 300)
      x.process(CYANO_BATHS.peroxide, 5)
      return x
    }
    const recipes: [string, (x: CyanoSheet) => void][] = [
      ['blue', () => {}],
      ['tea', (x) => x.process(CYANO_BATHS.tea, 1200)],
      ['tea→soda', (x) => (x.process(CYANO_BATHS.tea, 1200), x.process(CYANO_BATHS.soda, 60))],
      ['soda', (x) => x.process(CYANO_BATHS.soda, 90)],
      ['soda→tea', (x) => (x.process(CYANO_BATHS.soda, 90), x.process(CYANO_BATHS.tea, 1200))],
      ['coffee', (x) => (x.process(CYANO_BATHS.soda, 90), x.process(CYANO_BATHS.coffee, 1200))],
    ]
    for (const [t, f] of recipes) {
      const x = base()
      f(x)
      x.process(CYANO_BATHS.water, 120)
      x.rest(2)
      ton.push({ hex: linearToHex(x.reflectance(0)), t })
    }
    strip('Toning the same Dmax patch (bleach in washing soda, tannin from tea or coffee):', ton)
    const silv: { hex: string; t: string }[] = []
    for (const id of ['vcPearl', 'warmFiber'] as PaperId[]) {
      for (const sec of [2, 5, 10, 40]) {
        const sh = new SilverSheet(paper(id), 1, 1)
        sh.expose(lightBands('enlarger'), sec, { filter: vcGradeFilter(2) })
        sh.process(makeDeveloper(), 90)
        sh.process({ kind: 'fixer', formula: 'rapid', strength: 1, tempC: 20, volumeL: 1, silverG: 0, carriedDevL: 0 }, 60)
        sh.process({ kind: 'air', airflow: 1, tempC: 20 }, 3600)
        silv.push({ hex: linearToHex(sh.reflectance(0)), t: `${id === 'vcPearl' ? 'RC' : 'warm'} ${sec}s` })
      }
    }
    strip('Silver: neutral RC vs warm-tone fibre at four exposures (grade 2):', silv)
  }

  return { refresh }
}

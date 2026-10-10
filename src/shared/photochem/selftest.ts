// Self-test and benchmark: numeric checks of the model against the photographic
// facts it claims to reproduce, the unit-free behavioural targets of darkroom.md
// §5.11, the camera-game primitives, and determinism. Pure (no DOM): runs in
// Node (dev/run-selftest.ts) and on the dev page (__game.selftest()).

import {
  type FilmStockId, type LightId, type PaperModel, AIR, CYANO_BATHS, CyanoSheet, FilmFrame, SilverSheet, VC_FILTER_TABLE,
  VC_ISO_R_TARGET, actinic, autoPrint, bromideDrag, curveDensity, curveDensityH, densityLUT, developerRates, devAmount, devRateTemp,
  digitalNegative, enlargerLux, filmProgress, fixerRates, gradeLabel, gradedPaperCurve, grainField, halation, isoFilmSpeed, lightBands,
  logHAtDensity, logisticDensity, luminanceOf, mailboxScene, makeDeveloper, makeFilm, makeFixer, makeStop, makeWash, mixSensitizer,
  observedNet, paper, paperDensity, paperMetrics, peroxideBath, pushPull, reciprocityCorrectedTime, reciprocityEfficiency, selwynSigma,
  silverDensity, sunBands, transmission, vcGradeFilter, x0ForMidGrey,
} from './api.ts'
import { curveLut, recipLut } from './fast.ts'

export interface Check {
  group: string
  name: string
  value: string
  expect: string
  pass: boolean
}

const fmtT = (s: number) => (s < 120 ? `${s.toFixed(1)} s` : s < 7200 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`)

/** Time for unexposed (optionally pre-flashed) paper to gain 0.04 net density under a light. */
export function safeTime(m: PaperModel, id: LightId, preflashNet = 0): number {
  const L = lightBands(id)
  const Ih = actinic(m.hard.spectral, L)
  const Is = m.soft ? actinic(m.soft.spectral, L) : 0
  const eh = reciprocityEfficiency(m.hard.recip, Ih)
  const es = m.soft ? reciprocityEfficiency(m.soft.recip, Is) : 0
  const Le = lightBands('enlarger', 1)
  const gh = actinic(m.hard.spectral, Le)
  const gs = m.soft ? actinic(m.soft.spectral, Le) : 0
  const fPre = (x: number) => observedNet(m.surfaceDry, silverDensity(m, 10 ** x * gh, 10 ** x * gs))
  const xPre = preflashNet > 0 ? logHAtDensity(fPre, preflashNet) : -30
  const base = observedNet(m.surfaceDry, silverDensity(m, 10 ** xPre * gh, 10 ** xPre * gs))
  const f = (lt: number) => observedNet(m.surfaceDry, silverDensity(m, 10 ** xPre * gh + 10 ** lt * Ih * eh, 10 ** xPre * gs + 10 ** lt * Is * es)) - base
  return 10 ** logHAtDensity(f, 0.04, -6, 12)
}

/** The spike's 72 checks (kept intact). */
function spikeChecks(): Check[] {
  const out: Check[] = []
  const add = (group: string, name: string, v: number, lo: number, hi: number, fmt = (x: number) => x.toFixed(2), unit = '') =>
    out.push({ group, name, value: fmt(v) + unit, expect: `${fmt(lo)}..${fmt(hi)}${unit}`, pass: v >= lo && v <= hi })

  // --- Paper sensitometry ---
  const vc = paper('vcGlossy')
  VC_FILTER_TABLE.forEach((row, i) => {
    const r = paperMetrics(vc, vcGradeFilter(row.grade))
    add('VC paper', `grade ${gradeLabel(row.grade)} ISO R`, r.isoR, VC_ISO_R_TARGET[i] - 2, VC_ISO_R_TARGET[i] + 2, (x) => x.toFixed(0))
    const target = row.grade >= 4 ? 250 : 500
    add('VC paper', `grade ${gradeLabel(row.grade)} ISO P`, r.isoP, target * 0.95, target * 1.05, (x) => x.toFixed(0))
  })
  const R_GRADED = [160, 130, 110, 90, 70, 50]
  for (let g = 0; g <= 5; g++) {
    const r = paperMetrics(paper('bromide', g))
    add('Graded paper', `grade ${g} ISO R`, r.isoR, R_GRADED[g] - 3, R_GRADED[g] + 3, (x) => x.toFixed(0))
  }
  add('Paper', 'Dmax glossy RC', paperMetrics(paper('vcGlossy')).dmax, 2.05, 2.25)
  add('Paper', 'Dmax pearl RC', paperMetrics(paper('vcPearl')).dmax, 1.9, 2.1)
  add('Paper', 'Dmax matte RC', paperMetrics(paper('vcMatte')).dmax, 1.5, 1.7)

  // --- Safelights ---
  const pearl = paper('vcPearl')
  add('Safelight', 'VC under amber: time to ΔD 0.04', safeTime(pearl, 'safelightAmber'), 180, 330, fmtT)
  add('Safelight', 'VC pre-flashed under amber', safeTime(pearl, 'safelightAmber', 0.03), 60, 120, fmtT)
  add('Safelight', 'VC under red', safeTime(pearl, 'safelightRed'), 3600, 1e9, fmtT)
  add('Safelight', 'graded under amber', safeTime(paper('bromide'), 'safelightAmber'), 3600, 1e9, fmtT)
  add('Safelight', 'VC under room light', safeTime(pearl, 'room'), 0, 0.05, (x) => x.toFixed(4), ' s')

  // --- Development timing (step wedge) ---
  const wedge = () => {
    const n = 6
    const s = new SilverSheet(pearl, n, 1)
    const mask = new Float32Array(n).map((_, i) => 10 ** -(0.3 + 0.3 * i))
    s.expose(lightBands('enlarger'), 14, { mask, filter: vcGradeFilter(2) })
    return s
  }
  {
    const s = wedge()
    const dev = makeDeveloper('paperMQ')
    const base = observedNet(pearl.surfaceDry, 0) + 0.044
    let tShadow = -1
    let t = 0
    const D = (i: number) => s.observedDensity(i) - base
    while (t < 200) {
      s.process(dev, 0.5)
      t += 0.5
      if (tShadow < 0 && D(0) > 0.1) tShadow = t
      if (t === 45) add('Development', 'highlight (neg 1.5) net D at 45 s', D(4), 0.03, 0.2)
      if (t === 90) {
        const d90 = D(2)
        s.process(dev, 90)
        add('Development', 'midtone at 90 s vs 180 s', d90 / D(2), 0.93, 1.0)
        break
      }
    }
    add('Development', 'shadows first visible (net 0.1)', tShadow, 6, 14, (x) => x.toFixed(1), ' s')
    // Frame-rate independence
    const a = wedge()
    const b = wedge()
    const d1 = makeDeveloper()
    const d2 = makeDeveloper()
    a.process(d1, 30)
    for (let i = 0; i < 1800; i++) b.process(d2, 1 / 60)
    add('Determinism', '1 x 30 s vs 1800 x 1/60 s (max |Δp|)', Math.max(...Array.from(a.f.p1, (v, i) => Math.abs(v - b.f.p1[i]))), 0, 0.002, (x) => x.toExponential(1))
  }
  {
    const cold = makeDeveloper('paperMQ', { tempC: 12 })
    const warm = makeDeveloper('paperMQ', { tempC: 24 })
    add('Developer', 'rate 24 °C / 20 °C', developerRates(warm).paper / developerRates(makeDeveloper()).paper, 1.35, 1.55)
    add('Developer', 'Dmax factor at 12 °C (cold HQ)', developerRates(cold).dmaxFactor, 0.75, 0.9)
    const tired = makeDeveloper('paperMQ', { silverG: 0.7 })
    add('Developer', 'activity after 0.7 g Ag in 1 L', developerRates(tired).activity, 0.05, 0.3)
  }

  // --- Fix & wash ---
  {
    const s = wedge()
    const dev = makeDeveloper()
    s.process(dev, 90)
    const stop = makeStop()
    s.enter(stop)
    s.process(stop, 15)
    const fix = makeFixer()
    s.enter(fix)
    let t = 0
    while (s.stats().halideLeft > 0.02 && t < 600) {
      s.process(fix, 1)
      t++
    }
    add('Fixer', 'RC clearing time, fresh rapid fixer', t, 25, 50, (x) => x.toFixed(0), ' s')
    const loaded = makeFixer('rapid')
    loaded.silverG = 3
    add('Fixer', 'clearing-time ratio at 3 g/L Ag', 1 / fixerRates(loaded).rate, 1.9, 2.1)
    s.process(fix, 30)
    const w = makeWash()
    s.enter(w)
    s.process(w, 240)
    add('Wash', 'RC residual hypo after 4 min', s.stats().residualHypo, 0, 0.01, (x) => x.toExponential(1))
    const fb = new SilverSheet(paper('vcFiber'), 4, 1)
    fb.process(makeFixer(), 180)
    fb.process(makeWash(), 600)
    add('Wash', 'FB residual hypo after 10 min (not enough)', fb.stats().residualHypo, 0.2, 1)
    fb.process(makeWash(), 3000)
    add('Wash', 'FB residual hypo after 60 min', fb.stats().residualHypo, 0, 0.01, (x) => x.toExponential(1))
    s.process(AIR, 3600)
    const bytes = s.toBytes()
    const back = SilverSheet.fromBytes(bytes)
    add('Save state', 'silver round-trip max |ΔD|', Math.max(...Array.from({ length: s.n }, (_, i) => Math.abs(s.observedDensity(i) - back.observedDensity(i)))), 0, 0.002, (x) => x.toExponential(1))
  }

  // --- Sabattier ---
  {
    const s = new SilverSheet(pearl, 9, 1)
    const mask = new Float32Array(9).map((_, i) => 10 ** -(0.3 + 0.2 * i))
    s.expose(lightBands('enlarger'), 14, { mask, filter: vcGradeFilter(2) })
    const dev = makeDeveloper()
    s.process(dev, 60)
    s.expose(lightBands('enlarger', 1), 4)
    s.process(dev, 30, { agitation: 0 })
    add('Sabattier', 'highlight minus midtone after re-exposure (reversal > 0)', s.observedDensity(8) - s.observedDensity(3), 0.05, 2)
  }

  // --- Film ---
  for (const id of ['nj100', 'nj400', 'ortho25'] as FilmStockId[]) {
    const m = makeFilm(id)
    const sp = isoFilmSpeed((x) => m.pNormal * curveDensity(m.curve, x))
    add('Film', `${id} ISO speed point`, sp.speed, m.spec.iso * 0.98, m.spec.iso * 1.02, (x) => x.toFixed(0))
  }
  {
    const m = makeFilm('nj400')
    add('Film', 'reciprocity: metered 8 s needs', reciprocityCorrectedTime(m.recip, 8, m.Hm * 10), 12, 16, (x) => x.toFixed(1), ' s')
    add('Film', 'push +1: extra time', pushPull(m, 1).minutes / m.spec.devMinutes - 1, 0.15, 0.45, (x) => (100 * x).toFixed(0), ' %')
    add('Film', 'push +2: real shadow speed gain (stops)', Math.log2(pushPull(m, 2).shadowEI / 400), 0.1, 0.6)
    const b11 = makeDeveloper('filmMQBorax', { dilution: 1 })
    let t = 0
    while (filmProgress(m, developerRates(b11).film, t) < m.pNormal) t += 1
    add('Film', 'NJ400 in MQ-borax 1+1 at 20 °C', t / 60, 9, 10.2, (x) => x.toFixed(2), ' min')
    const pan = makeFilm('nj400').rgbWeights()
    const ortho = makeFilm('ortho25').rgbWeights()
    add('Film', 'ortho red/green response (red-blind)', ortho[0] / ortho[1], 0, 0.3)
    add('Film', 'pan red/green response', pan[0] / pan[1], 0.5, 1.2)
  }

  // --- Cyanotype ---
  {
    const n = 6
    const mask = new Float32Array(n).map((_, i) => 10 ** -(0.3 * i))
    const make = (minutes: number, light = lightBands('uvBox')) => {
      const s = new CyanoSheet(n, 1)
      s.coat(1)
      s.dry(3600)
      s.expose(light, minutes * 60, { mask })
      return s
    }
    add('Cyanotype', 'UV box 12 min: clear-area blue / max', make(12).f.pb[0], 0.75, 1.0)
    add('Cyanotype', 'UV box 12 min: no bronzing yet', make(12).f.pw[0], 0, 0.05)
    add('Cyanotype', 'UV box 30 min: bronzed', make(30).f.pw[0], 0.2, 1.2)
    const sun = make(12, sunBands(1))
    const cloud = make(12, sunBands(0.3))
    add('Cyanotype', 'overcast / clear sun speed (same 12 min)', cloud.f.pb[0] / sun.f.pb[0], 0.4, 0.8)
    const over = make(45)
    over.process(CYANO_BATHS.water, 300)
    over.rest(2)
    add('Cyanotype', 'overexposed: reversal in deepest shadow', over.visualDensity(1) - over.visualDensity(0), 0.03, 1)
    const w = make(12)
    const before = w.visualDensity(n - 1)
    w.process(CYANO_BATHS.water, 300)
    w.rest(2)
    add('Cyanotype', 'wash clears yellow sensitizer (highlight ΔD)', before - w.visualDensity(n - 1), 0.05, 0.4)
    const px = make(12)
    px.process(CYANO_BATHS.water, 120)
    const ox0 = px.f.ox[0]
    px.process(CYANO_BATHS.peroxide, 3)
    add('Cyanotype', 'peroxide oxidises in 3 s', px.f.ox[0], 0.95, 1, (x) => x.toFixed(3))
    add('Cyanotype', 'oxidation before peroxide', ox0, 0, 0.5, (x) => x.toFixed(3))
    const t1 = make(12)
    t1.process(CYANO_BATHS.water, 300)
    t1.process(CYANO_BATHS.soda, 90)
    t1.process(CYANO_BATHS.tea, 1200)
    t1.rest(2)
    const c1 = t1.reflectance(0)
    add('Cyanotype', 'soda then tea: brown (R/B)', c1[0] / c1[2], 1.3, 5)
    const t2 = make(12)
    t2.process(CYANO_BATHS.water, 300)
    t2.process(CYANO_BATHS.tea, 1200)
    const c2 = t2.reflectance(0)
    add('Cyanotype', 'tea only: aubergine (R/G)', c2[0] / c2[1], 1.0, 3)
    const bytes = t2.toBytes()
    const back = CyanoSheet.fromBytes(bytes)
    add('Save state', 'cyanotype round-trip |ΔD|', Math.abs(back.visualDensity(0) - t2.visualDensity(0)), 0, 1e-3, (x) => x.toExponential(1))
  }
  void reciprocityEfficiency
  return out
}

/** Cheap checksum of a float field (bit-level determinism checks). */
function hashF32(a: Float32Array): number {
  const u = new Uint32Array(a.buffer, a.byteOffset, a.length)
  let h = 2166136261
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0
  return h
}

/** Behavioural targets (darkroom §5.11), optimisation parity, camera primitives, determinism. */
function moreChecks(): Check[] {
  const out: Check[] = []
  const add = (group: string, name: string, v: number, lo: number, hi: number, fmt = (x: number) => x.toFixed(2), unit = '') =>
    out.push({ group, name, value: fmt(v) + unit, expect: `${fmt(lo)}..${fmt(hi)}${unit}`, pass: v >= lo && v <= hi })
  const addB = (group: string, name: string, ok: boolean, value: string, expect: string) => out.push({ group, name, value, expect, pass: ok })
  const pearl = paper('vcPearl')
  const f2 = vcGradeFilter(2)

  // --- darkroom §5.11 behavioural targets ---
  {
    // Agitated fresh developer on a fully exposed patch: visible, half, 95%.
    const s = new SilverSheet(pearl, 4, 4)
    s.expose(lightBands('enlarger'), 14, { filter: f2 })
    const dev = makeDeveloper()
    const base = observedNet(pearl.surfaceDry, 0) + 0.044
    let t = 0
    let tVis = -1
    let t50 = -1
    let t95 = -1
    while (t < 200 && t95 < 0) {
      s.process(dev, 0.5, { agitation: 1 })
      t += 0.5
      if (tVis < 0 && s.observedDensity(0) - base > 0.15) tVis = t
      if (t50 < 0 && s.f.p1[0] > 0.5) t50 = t
      if (s.f.p1[0] > 0.95) t95 = t
    }
    add('Darkroom 5.11', 'full exposure visible (D > 0.15)', tVis, 6, 14, (x) => x.toFixed(1), ' s')
    add('Darkroom 5.11', 'half developed', t50, 25, 45, (x) => x.toFixed(1), ' s')
    add('Darkroom 5.11', '95% developed', t95, 40, 75, (x) => x.toFixed(1), ' s')
    // Still tray vs rocked
    const done = (agit: number) => {
      const q = new SilverSheet(pearl, 4, 4)
      q.expose(lightBands('enlarger'), 14, { filter: f2 })
      const d = makeDeveloper()
      let tt = 0
      while (tt < 400 && q.f.p1[0] < 0.95) {
        q.process(d, 0.5, { agitation: agit })
        tt += 0.5
      }
      return tt
    }
    add('Darkroom 5.11', 'still vs rocked: completion slowdown', done(0) / done(1) - 1, 0.25, 0.4, (x) => (100 * x).toFixed(0), ' %')
    // Mottling: a still tray with uneven liquid contact leaves a measurable density scatter.
    const w = 64
    const h = 64
    const sh = new SilverSheet(pearl, w, h)
    sh.expose(lightBands('enlarger'), 6, { filter: f2 })
    const contact = new Float32Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) contact[y * w + x] = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(x * 0.35) * Math.cos(y * 0.28))
    sh.process(makeDeveloper(), 25, { contact, agitation: 0 })
    add('Darkroom 5.11', 'still tray: density scatter in a flat patch', sh.stats().evenness, 0.01, 1, (x) => x.toFixed(3))
  }
  {
    const a = new SilverSheet(pearl, 16, 16)
    const b = new SilverSheet(pearl, 16, 16)
    a.expose(lightBands('safelightAmber'), 240)
    a.process(makeDeveloper(), 90)
    b.process(makeDeveloper(), 90)
    add('Darkroom 5.11', 'safelight 240 s on white: ΔD', a.observedDensity(5) - b.observedDensity(5), 0.03, 0.06, (x) => x.toFixed(3))
    const r = new SilverSheet(pearl, 16, 16)
    r.expose(lightBands('room'), 1)
    r.process(makeDeveloper(), 90)
    add('Darkroom 5.11', 'room light 1 s, developed: mean D', r.stats().meanD, 1.8, 3, (x) => x.toFixed(2))
  }
  {
    // A procedural mailbox negative at grade 2 under the default enlarger: normal mean D, full blacks, clean border.
    const w = 128
    const h = 160
    const lum = luminanceOf(mailboxScene(w, h))
    const dens = digitalNegative(lum, w, h, { curve: 'silver', range: 1.6, dmin: 0.05, flip: false, autoLevels: false })
    const T = transmission(dens)
    const bx = Math.round(w * 0.06)
    const by = Math.round(h * 0.06)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < bx || x >= w - bx || y < by || y >= h - by) T[y * w + x] = 0
    const lux = enlargerLux()
    const ap = autoPrint(pearl, dens, lux)
    const s = new SilverSheet(pearl, w, h)
    s.expose(lightBands('enlarger', lux), 16, { mask: T, filter: f2 })
    s.process(makeDeveloper(), 90, { agitation: 0.8 })
    const st = s.stats()
    add('Darkroom 5.11', 'mailbox, grade 2, 16 s: mean D', st.meanD, 0.6, 0.9)
    add('Darkroom 5.11', 'mailbox, grade 2, 16 s: Dmax', st.dmax, 1.95, 2.3)
    add('Darkroom 5.11', 'mailbox, grade 2, 16 s: border D', st.borderD, 0, 0.1, (x) => x.toFixed(3))
    add('Darkroom 5.11', 'auto print picks a grade and a sane time', ap.seconds, 3, 60, (x) => x.toFixed(1), ' s')
    add('Darkroom 5.11', 'grade 5 vs 00 exposure range ratio', paperMetrics(paper('vcGlossy'), vcGradeFilter(-1)).isoR / paperMetrics(paper('vcGlossy'), vcGradeFilter(5)).isoR, 2.5, 5)
  }
  {
    const s = new SilverSheet(pearl, 4, 4)
    s.expose(lightBands('enlarger'), 10, { filter: f2 })
    s.process(makeDeveloper(), 90)
    const stop = makeStop()
    s.enter(stop)
    s.process(stop, 10)
    const fix = makeFixer()
    s.enter(fix)
    let t = 0
    while (s.f.x[0] > 0.05 && t < 200) {
      s.process(fix, 1)
      t++
    }
    add('Darkroom 5.11', 'fix: unfixed halide < 0.05', t, 20, 30, (x) => x.toFixed(0), ' s')
  }
  {
    // Sabattier: a dim flash mid-development partially reverses highlights.
    const s = new SilverSheet(pearl, 9, 1)
    const mask = new Float32Array(9).map((_, i) => 10 ** -(0.3 + 0.2 * i))
    s.expose(lightBands('enlarger'), 14, { mask, filter: f2 })
    const dev = makeDeveloper()
    s.process(dev, 60)
    s.expose(lightBands('enlarger', 1), 4)
    s.process(dev, 30, { agitation: 0 })
    add('Darkroom 5.11', 'Sabattier reversal (highlight − light midtone)', s.observedDensity(8) - s.observedDensity(3), 0.1, 2)
  }
  {
    // Cyanotype timing in physical minutes (games compress the clock): bronzing starts after the print is done.
    const at = (m: number) => {
      const s = new CyanoSheet(2, 1)
      s.coat(1)
      s.dry(3600)
      s.expose(lightBands('uvBox'), m * 60)
      return s
    }
    let tBronze = -1
    for (let m = 8; m <= 40 && tBronze < 0; m += 0.5) if (at(m).f.pw[0] > 0.01) tBronze = m
    add('Darkroom 5.11', 'cyanotype bronze onset (UV box)', tBronze, 13, 20, (x) => x.toFixed(1), ' min')
    const p = new CyanoSheet(3, 1)
    p.coat(1)
    p.dry(3600)
    p.expose(lightBands('uvBox'), 12 * 60)
    p.process(CYANO_BATHS.water, 120)
    const field = new Float32Array([1, 0.3, 0])
    p.process(peroxideBath(0), 0.6, { h2o2: field })
    add('Darkroom 5.11', 'peroxide field: ox rises at the drop, not away from it', p.f.ox[0] - p.f.ox[2], 0.3, 1, (x) => x.toFixed(2))
    const q = new CyanoSheet(2, 1)
    q.coat(1)
    q.dry(3600)
    q.expose(lightBands('uvBox'), 12 * 60)
    q.process(CYANO_BATHS.water, 120)
    q.process(peroxideBath(1), 2.5)
    add('Darkroom 5.11', 'peroxide drop: ox above 0.9 within 2.5 s', q.f.ox[0], 0.9, 1, (x) => x.toFixed(3))
  }

  // --- optimisation parity: tables and half resolution versus the exact formulas ---
  {
    let maxErr = 0
    const lut = curveLut(pearl.hard.curve)
    for (let k = 0; k < 4000; k++) {
      const H = Math.pow(10, -6 + (9 * k) / 4000)
      maxErr = Math.max(maxErr, Math.abs(lut.at(H) - curveDensityH(pearl.hard.curve, H)))
    }
    add('Parity', 'curve table vs exact (max |ΔD|)', maxErr, 0, 0.002, (x) => x.toExponential(1))
    let maxR = 0
    const rl = recipLut(pearl.hard.recip)
    for (let k = 0; k < 4000; k++) {
      const I = Math.pow(10, -9 + (13 * k) / 4000)
      maxR = Math.max(maxR, Math.abs(rl.at(I) / reciprocityEfficiency(pearl.hard.recip, I) - 1))
    }
    add('Parity', 'reciprocity table vs exact (max rel)', maxR, 0, 0.003, (x) => x.toExponential(1))
    const half = new SilverSheet(pearl, 64, 80, { simScale: 0.5 })
    const full = new SilverSheet(pearl, 64, 80)
    const mask = new Float32Array(64 * 80).map((_, i) => 10 ** -(0.3 + 1.5 * ((i % 64) / 64)))
    for (const s of [half, full]) {
      s.expose(lightBands('enlarger'), 12, { mask, filter: f2 })
      s.process(makeDeveloper(), 90)
      s.process(makeStop(), 10)
    }
    add('Parity', 'simScale 0.5 vs 1: mean D', half.stats().meanD, full.stats().meanD - 0.03, full.stats().meanD + 0.03)
    const A = new Uint8ClampedArray(64 * 80 * 4)
    const B = new Uint8ClampedArray(64 * 80 * 4)
    half.render(A)
    full.render(B)
    let mae = 0
    for (let i = 0; i < 64 * 80; i++) mae += Math.abs(A[i * 4] - B[i * 4])
    add('Parity', 'simScale 0.5 vs 1: render mean abs error', mae / (64 * 80), 0, 4, (x) => x.toFixed(2), ' /255')
    const back = SilverSheet.fromBytes(half.toBytes())
    addB('Parity', 'simScale 0.5 save/load keeps the scale', back.simScale === 0.5 && back.w === 64 && back.n === half.n, `${back.simScale}`, '0.5')
    const ch = new CyanoSheet(32, 24, { simScale: 0.5 })
    ch.coat(1)
    ch.expose(lightBands('uvBox'), 600)
    const rgba = new Uint8ClampedArray(32 * 24 * 4)
    ch.render(rgba)
    addB('Parity', 'cyanotype half-resolution render fills the output', rgba[(32 * 24 - 1) * 4 + 2] > 0 && ch.n === 16 * 12, `${ch.n} sim px`, '16x12')
  }

  // --- determinism ---
  {
    const run = () => {
      const s = new SilverSheet(pearl, 48, 60)
      const mask = new Float32Array(48 * 60).map((_, i) => 10 ** -(0.3 + 1.2 * ((i % 48) / 48)))
      s.expose(lightBands('enlarger'), 11, { mask, filter: f2 })
      s.expose(lightBands('safelightAmber'), 30)
      const dev = makeDeveloper()
      s.process(dev, 25, { agitation: 0.4 })
      s.expose(lightBands('enlarger', 0.5), 2)
      s.process(dev, 40)
      s.process(makeStop(), 8)
      s.process(makeFixer(), 40)
      return (hashF32(s.f.p1) ^ hashF32(s.f.c) ^ hashF32(s.f.x) ^ hashF32(s.f.Hh) ^ hashF32(s.f.cf)) >>> 0
    }
    const h1 = run()
    const h2 = run()
    addB('Determinism', 'same inputs, same bits (silver)', h1 === h2, h1.toString(16), h2.toString(16))
    const g1 = hashF32(grainField(64, 48, 5, { octaves: 2 }))
    const g2 = hashF32(grainField(64, 48, 5, { octaves: 2 }))
    const g3 = hashF32(grainField(64, 48, 6, { octaves: 2 }))
    addB('Determinism', 'grain field repeats and depends on seed', g1 === g2 && g1 !== g3, g1.toString(16), g3.toString(16))
  }

  // --- camera-game primitives ---
  {
    const c = { gamma: 0.65, dMin: 0.22, dMax: 2.4, x0: x0ForMidGrey(0.65, 0.22, 2.4) }
    add('Camera', 'x0 for Pan 400 (γ .65, 0.22..2.4)', c.x0, 0.7, 0.74, (x) => x.toFixed(3))
    add('Camera', 'mid grey sits 0.65 above base', logisticDensity(0, c) - c.dMin, 0.649, 0.651, (x) => x.toFixed(3))
    add('Camera', 'logistic slope at x0 is γ', (logisticDensity(c.x0 + 0.01, c) - logisticDensity(c.x0 - 0.01, c)) / 0.02, 0.64, 0.66, (x) => x.toFixed(3))
    add('Camera', 'development rate 30 °C vs 20 °C', devRateTemp(30), 2.5, 2.7)
    add('Camera', 'development amount 9.5 min, 25 °C, agitation 1', devAmount(9.5, 25, 1), 15, 15.5)
    add('Camera', 'Selwyn σ, Pan 400 35 mm at 1600 px, ΔD 1', selwynSigma(0.72, 1, 22.5), 0.031, 0.033, (x) => x.toFixed(4))
    const g = grainField(128, 96, 11, { clumpPx: 1, octaves: 2 })
    let m = 0
    let v = 0
    for (const x of g) m += x
    m /= g.length
    for (const x of g) v += (x - m) * (x - m)
    add('Camera', 'grain field mean', m, -1e-3, 1e-3, (x) => x.toExponential(1))
    add('Camera', 'grain field variance', v / g.length, 0.99, 1.01, (x) => x.toFixed(3))
    // Bromide drag lightens the rows below a dense patch.
    const D = new Float32Array(40 * 40).fill(0.5)
    for (let y = 5; y < 12; y++) for (let x = 10; x < 30; x++) D[y * 40 + x] = 2
    bromideDrag(D, 40, 40, { strength: 1, lengthPx: 20, threshold: 1.2, axis: 'y' })
    addB('Camera', 'bromide drag streaks below dense areas only', D[20 * 40 + 20] < 0.5 && Math.abs(D[20 * 40 + 2] - 0.5) < 1e-6 && Math.abs(D[3 * 40 + 20] - 0.5) < 1e-6, D[20 * 40 + 20].toFixed(3), '< 0.5')
    // Halation adds light around a bright spot and leaves the far field alone.
    const H = new Float32Array(48 * 48 * 3).fill(0.1)
    for (let y = 22; y < 26; y++) for (let x = 22; x < 26; x++) for (let k = 0; k < 3; k++) H[(y * 48 + x) * 3 + k] = 20
    halation(H, 48, 48, 3, { threshold: 8, sigmaPx: 4, gain: 0.12, tint: [1, 0.35, 0.2] })
    const near = H[(24 * 48 + 30) * 3]
    addB('Camera', 'halation: red glows more than blue, far field untouched', near > 0.11 && near > H[(24 * 48 + 30) * 3 + 2] && Math.abs(H[3] - 0.1) < 1e-4, near.toFixed(3), '> 0.11')
    const st = gradedPaperCurve(2, 'studio')
    add('Camera', 'studio grade 2: negative D 0.25 prints at', paperDensity(-0.25, st), 1.66, 1.7)
    add('Camera', 'studio grade 2: negative D 1.5 prints at', paperDensity(-1.5, st), 0.09, 0.11, (x) => x.toFixed(3))
    const lt = gradedPaperCurve(3, 'latent')
    add('Camera', 'latent grade 3: mid density at E = Eg', paperDensity(Math.log10(0.9), lt), 0.99, 1.01)
    const lut = densityLUT([0.96, 0.95, 0.92], 0.05, 2.1)
    addB('Camera', 'density LUT runs light to dark', lut[0] > lut[lut.length - 3] && lut.length === 1024 * 3, `${lut[0]}→${lut[lut.length - 3]}`, 'falling')
  }
  {
    const mix = mixSensitizer(10, 10)
    addB('Sensitizer', '1:1 mix: speed 1, Dmax 1, olive', Math.abs(mix.speed - 1) < 1e-9 && mix.dmax === 1 && mix.beakerHex === '#c2be48', mix.beakerHex, '#c2be48')
    add('Sensitizer', 'ferricyanide-starved mix loses Dmax', mixSensitizer(15, 5).dmax, 0.3, 0.65)
    const wp = peroxideBath(1)
    addB('Sensitizer', 'peroxide blend ends are water and peroxide', peroxideBath(0).h2o2 === 0 && wp.h2o2 === 1 && wp.pH === CYANO_BATHS.peroxide.pH, `${wp.h2o2}`, '1')
  }
  return out
}

/** All checks: the spike's 72, the §5.11 behavioural targets, parity, determinism, camera primitives. */
export function selftest(): Check[] {
  return [...spikeChecks(), ...moreChecks()]
}
/** The spike's name for the same thing. */
export const runSelfTest = selftest

/** Minimum of `n` timed runs, in ms (robust against a busy machine). */
function best(f: () => void, n = 12): number {
  f()
  f()
  let b = Infinity
  for (let i = 0; i < n; i++) {
    const t0 = performance.now()
    f()
    const d = performance.now() - t0
    if (d < b) b = d
  }
  return b
}

/** Timings in ms at 256 x 320 (min of several runs). Budgets: process ≤ 2.5, expose ≤ 2, render ≤ 4, cyano process ≤ 2. */
export function bench(): Record<string, number> {
  const w = 256
  const h = 320
  const r: Record<string, number> = {}
  const mask = new Float32Array(w * h).map((_, i) => 10 ** -(0.3 + 1.5 * ((i % w) / w)))
  const out = new Uint8ClampedArray(w * h * 4)
  const f2 = vcGradeFilter(2)
  const enlarger = lightBands('enlarger')
  const amber = lightBands('safelightAmber')
  for (const scale of [1, 0.5] as const) {
    const tag = scale === 1 ? 'silver' : 'silverHalf'
    const s = new SilverSheet(paper('vcPearl'), w, h, { simScale: scale })
    r[`${tag}.expose(mask)`] = best(() => s.expose(enlarger, 0.4, { mask, filter: f2 }))
    r[`${tag}.expose(flat)`] = best(() => s.expose(amber, 0.03))
    r[`${tag}.recompute`] = best(() => {
      s.expose(enlarger, 0.001, { mask, filter: f2 })
      s.recompute()
    })
    const dev = makeDeveloper()
    s.process(dev, 0.5)
    r[`${tag}.process(0.5 s)`] = best(() => s.process(dev, 0.5))
    r[`${tag}.process(1/30 s)`] = best(() => s.process(dev, 1 / 30))
    r[`${tag}.render`] = best(() => s.render(out))
    r[`${tag}.stats`] = best(() => s.stats())
  }
  for (const scale of [1, 0.5] as const) {
    const tag = scale === 1 ? 'cyano' : 'cyanoHalf'
    const c = new CyanoSheet(w, h, { simScale: scale })
    c.coat(1)
    r[`${tag}.expose`] = best(() => c.expose(lightBands('uvBox'), 0.5, { mask }))
    r[`${tag}.process`] = best(() => c.process(CYANO_BATHS.water, 0.5))
    r[`${tag}.render`] = best(() => c.render(out))
  }
  r['grainField(768x512)'] = best(() => grainField(768, 512, 3, { octaves: 2 }), 4)
  const H = new Float32Array(768 * 512 * 3).fill(1)
  H[(256 * 768 + 384) * 3] = 200
  r['halation(768x512x3)'] = best(() => halation(H, 768, 512, 3, { threshold: 8, sigmaPx: 18, gain: 0.12 }), 3)
  const film = new FilmFrame('nj400', 384, 256)
  film.exposeRGB(new Float32Array(384 * 256 * 3).fill(0.4), 0.01)
  r['film.densities(384x256)'] = best(() => film.densities(undefined, true, 1), 4)
  for (const k of Object.keys(r)) r[k] = Math.round(r[k] * 100) / 100
  return r
}

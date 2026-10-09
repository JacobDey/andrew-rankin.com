// Self-test: numeric checks of the model against the photographic facts it
// claims to reproduce. Pure (no DOM): runs in Node (tools/run-selftest.ts)
// and in the demo page (window.__spike.selfTest()).

import {
  type FilmStockId, type LightId, type PaperModel, AIR, CYANO_BATHS, CyanoSheet, LIGHTS, SilverSheet, VC_FILTER_TABLE,
  VC_ISO_R_TARGET, actinic, curveDensity, developerRates, filmProgress, isoFilmSpeed, lightBands, logHAtDensity,
  makeDeveloper, makeFilm, makeFixer, makeStop, makeWash, observedNet, paper, paperMetrics, pushPull,
  reciprocityCorrectedTime, reciprocityEfficiency, silverDensity, sunBands, vcGradeFilter, fixerRates, gradeLabel,
} from './core/index.ts'

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

export function runSelfTest(): Check[] {
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
  void LIGHTS
  void reciprocityEfficiency
  return out
}

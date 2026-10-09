// Full-process pipelines used by the demo tabs and by window.__spike. No DOM:
// each returns rendered RGBA stages, timings and a logbook line.

import {
  type Bands, type FilmStockId, type LightId, type LinearImage, type PaperId, type RGB,
  AIR, CAMERA_FILTERS, CYANO_BATHS, CyanoSheet, FilmFrame, LIGHTS, SilverSheet, autoPrint, brushCoatMask, digitalNegative,
  enlargerLux, fernMask, gradeLabel, lightBands, luminanceOf, mailboxScene, makeDeveloper, makeFilm, makeFixer, makeStop,
  makeToner, makeWash, paper, PAPERS, pushPull, resample, stepWedge, sunBands, transmission, vcGradeFilter,
} from '../core/index.ts'

export interface Stage {
  label: string
  note: string
  w: number
  h: number
  rgba: Uint8ClampedArray
}

export interface RunResult {
  stages: Stage[]
  timings: Record<string, number>
  log: string
  facts: [string, string][]
}

/** How an amber safelight looks to a dark-adapted eye: tint x level for linear reflectance. */
export const SAFE_VIEW: RGB = [0.62, 0.27, 0.035]

const now = () => performance.now()

// ---------------------------------------------------------------------------
// Sources (cached by key)
// ---------------------------------------------------------------------------

export type SourceId = 'mailbox' | 'wedge' | 'fern' | 'png'
const cache = new Map<string, LinearImage>()
let pngImage: LinearImage | null = null

export function setPng(img: LinearImage | null): void {
  pngImage = img
  for (const k of [...cache.keys()]) if (k.startsWith('png')) cache.delete(k)
}

export function hasPng(): boolean {
  return pngImage !== null
}

/** Scene (positive, linear RGB) for a source at w x h. */
export function sceneFor(src: SourceId, w: number, h: number): LinearImage {
  const key = `${src}:${w}x${h}`
  const hit = cache.get(key)
  if (hit) return hit
  let img: LinearImage
  if (src === 'png' && pngImage) img = resample(pngImage, w, h)
  else if (src === 'wedge') {
    const d = stepWedge(w, h, 21, 0.15, 0)
    const rgb = new Float32Array(w * h * 3)
    for (let i = 0; i < w * h; i++) rgb[3 * i] = rgb[3 * i + 1] = rgb[3 * i + 2] = Math.pow(10, -d[i]) * 0.9
    img = { w, h, rgb }
  } else img = mailboxScene(w, h)
  cache.set(key, img)
  return img
}

function rgbaOfScene(img: LinearImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.w * img.h * 4)
  for (let i = 0; i < img.w * img.h; i++) {
    for (let k = 0; k < 3; k++) out[4 * i + k] = Math.round(255 * Math.pow(Math.min(1, img.rgb[3 * i + k]), 1 / 2.2))
    out[4 * i + 3] = 255
  }
  return out
}

function grab(label: string, note: string, w: number, h: number, draw: (out: Uint8ClampedArray) => void): Stage {
  const rgba = new Uint8ClampedArray(w * h * 4)
  draw(rgba)
  return { label, note, w, h, rgba }
}

function densRGBA(dens: Float32Array, w: number, h: number): Uint8ClampedArray {
  // A transparency on a light table.
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(255 * Math.pow(Math.pow(10, -dens[i]), 1 / 2.2))
    out[4 * i] = v
    out[4 * i + 1] = Math.round(v * 0.98)
    out[4 * i + 2] = Math.round(v * 0.95)
    out[4 * i + 3] = 255
  }
  return out
}

// ---------------------------------------------------------------------------
// Camera negative
// ---------------------------------------------------------------------------

export interface FilmParams {
  stock: FilmStockId
  filter: keyof typeof CAMERA_FILTERS
  /** Exposure compensation (stops) relative to the meter. */
  ev: number
  /** Rated speed relative to box (stops): +2 = shot at EI 1600 on 400 film. */
  push: number
  /** Development time override (min); 0 = use the push/pull chart. */
  devMin: number
  tempC: number
  dilution: number
  agitation: number
  /** Years the exposed roll sat undeveloped, and where. */
  years: number
  storeC: number
  grain: boolean
}

export const FILM_DEFAULTS: FilmParams = {
  stock: 'nj400', filter: 'none', ev: 0, push: 0, devMin: 0, tempC: 20, dilution: 1, agitation: 0.5, years: 0, storeC: 4, grain: true,
}

export interface NegResult {
  frame: FilmFrame
  densities: Float32Array
  lightbox: Uint8ClampedArray
  devMinutes: number
  note: string
}

/** Shoot the scene on film, develop it in a tank, return gross densities. */
export function shootAndDevelop(scene: LinearImage, p: FilmParams): NegResult {
  const m = makeFilm(p.stock)
  const { w, h } = scene
  const frame = new FilmFrame(m, w, h, 36)
  // Through-the-lens meter: mid-grey (18%) lands 12.5 x Hm (ISO K = 12.5), corrected for the filter factor.
  const filter = CAMERA_FILTERS[p.filter]
  const wOpen = m.rgbWeights()
  const wFilt = m.rgbWeights(filter)
  const factor = (wOpen[0] + wOpen[1] + wOpen[2]) / Math.max(1e-9, wFilt[0] + wFilt[1] + wFilt[2])
  const t = 1 / 125
  const k = ((12.5 * m.Hm) / 0.18 / t) * Math.pow(2, p.ev - p.push) * factor
  const rgb = new Float32Array(scene.rgb.length)
  for (let i = 0; i < rgb.length; i++) rgb[i] = scene.rgb[i] * k
  frame.exposeRGB(rgb, t, filter)
  if (p.years > 0) frame.ageLatent(p.years, p.storeC)
  const dev = makeDeveloper('filmMQBorax', { dilution: p.dilution, tempC: p.tempC, volumeL: 0.5 })
  const minutes = p.devMin > 0 ? p.devMin : pushPull(m, p.push, dev, p.agitation).minutes
  // Tank: develop with the chosen agitation, stop, fix 2x clearing, wash.
  for (let s = 0; s < minutes * 60; s += 10) frame.process(dev, Math.min(10, minutes * 60 - s), { agitation: p.agitation })
  frame.process(makeStop('water'), 30)
  frame.process(makeFixer(), 300)
  frame.process(makeWash(1), 600)
  const densities = frame.densities(undefined, p.grain, 7)
  const lightbox = new Uint8ClampedArray(w * h * 4)
  frame.render(lightbox, { grain: p.grain, seed: 7 })
  return { frame, densities, lightbox, devMinutes: minutes, note: `${m.spec.name}, EI ${Math.round(m.spec.iso * Math.pow(2, p.push))}, ${minutes.toFixed(1)} min @ ${p.tempC} °C` }
}

// ---------------------------------------------------------------------------
// Silver print
// ---------------------------------------------------------------------------

export interface SilverParams {
  width: number
  source: SourceId
  negative: 'film' | 'digital'
  film: FilmParams
  paper: PaperId
  /** VC grade -1 (00) .. 5, or graded paper grade 0..5. */
  grade: number
  /** Auto grade/time from the negative (the printer's first guess). */
  auto: boolean
  seconds: number
  fNumber: number
  safelight: LightId | 'none'
  safelightMin: number
  /** Sabattier: dim light (lux·s) at a moment during development. */
  flashLuxS: number
  flashAt: number
  devFormula: 'paperMQ' | 'caffenol'
  devTemp: number
  devDilution: number
  devSeconds: number
  agitation: number
  diffuse: boolean
  prevPrints: number
  stop: 'acetic' | 'water'
  stopSeconds: number
  fixSeconds: number
  fixerLoad: number
  hca: boolean
  washMin: number
  toner: 'none' | 'selenium' | 'sepia'
  tonerMin: number
  years: number
  viewUnderSafelight: boolean
}

export const SILVER_DEFAULTS: SilverParams = {
  width: 320, source: 'mailbox', negative: 'film', film: { ...FILM_DEFAULTS }, paper: 'vcPearl', grade: 2, auto: true, seconds: 14, fNumber: 8,
  safelight: 'safelightAmber', safelightMin: 2, flashLuxS: 0, flashAt: 55, devFormula: 'paperMQ', devTemp: 20, devDilution: 9,
  devSeconds: 90, agitation: 0.6, diffuse: false, prevPrints: 0, stop: 'acetic', stopSeconds: 15, fixSeconds: 60, fixerLoad: 0.2,
  hca: false, washMin: 4, toner: 'none', tonerMin: 4, years: 0, viewUnderSafelight: true,
}

export interface SilverRun extends RunResult {
  sheet: SilverSheet
  /** Live development replay: call step() repeatedly; returns false when done. */
  grade: number
  seconds: number
}

/** Builds the exposed (latent) sheet; shared by the full run and the live replay. */
export function exposeSilver(p: SilverParams, dodge: Float32Array | null): { sheet: SilverSheet; stages: Stage[]; timings: Record<string, number>; grade: number; seconds: number; negNote: string } {
  const timings: Record<string, number> = {}
  const stages: Stage[] = []
  const w = p.width
  const h = Math.round((w * 4) / 5)
  let t0 = now()
  const scene = sceneFor(p.source === 'fern' ? 'mailbox' : p.source, w, h)
  timings.scene = now() - t0
  stages.push({ label: 'Scene', note: p.source === 'png' ? 'your PNG' : p.source, w, h, rgba: rgbaOfScene(scene) })
  t0 = now()
  let dens: Float32Array
  let negNote: string
  if (p.negative === 'film') {
    const neg = shootAndDevelop(scene, p.film)
    dens = neg.densities
    negNote = neg.note
    stages.push({ label: 'Negative', note: negNote, w, h, rgba: neg.lightbox })
  } else {
    dens = digitalNegative(luminanceOf(scene), w, h, { curve: 'silver', range: 1.15, dmin: 0.12 })
    negNote = 'digital negative (silver curve)'
    stages.push({ label: 'Negative', note: negNote, w, h, rgba: densRGBA(dens, w, h) })
  }
  timings.negative = now() - t0
  const model = paper(p.paper, PAPERS[p.paper].kind === 'graded' ? Math.max(0, p.grade) : undefined)
  const lux = enlargerLux(p.fNumber)
  let grade = p.grade
  let seconds = p.seconds
  if (p.auto) {
    const ap = autoPrint(model, dens, lux)
    grade = model.soft ? Math.round(ap.grade * 2) / 2 : p.grade
    seconds = Math.round(ap.seconds * 2) / 2
  }
  const filter: Bands | undefined = model.soft ? vcGradeFilter(grade) : undefined
  const mask = transmission(dens)
  if (dodge) for (let i = 0; i < mask.length; i++) mask[i] *= Math.pow(2, 1.5 * dodge[i])
  t0 = now()
  const sheet = new SilverSheet(model, w, h)
  if (p.safelight !== 'none' && p.safelightMin > 0) sheet.expose(lightBands(p.safelight), p.safelightMin * 60)
  sheet.expose(lightBands('enlarger', lux), seconds, { mask, filter })
  timings.expose = now() - t0
  return { sheet, stages, timings, grade, seconds, negNote }
}

export function runSilver(p: SilverParams, dodge: Float32Array | null = null): SilverRun {
  const { sheet, stages, timings, grade, seconds, negNote } = exposeSilver(p, dodge)
  const { w, h } = sheet
  const view: RGB = p.viewUnderSafelight ? SAFE_VIEW : [1, 1, 1]
  stages.push(grab('Latent', 'exposed, nothing to see', w, h, (o) => sheet.render(o, view)))
  const dev = makeDeveloper(p.devFormula, { tempC: p.devTemp, dilution: p.devFormula === 'paperMQ' ? p.devDilution : 0 })
  dev.silverG = p.prevPrints * 0.0516 * 1.2 * 0.3
  let t0 = now()
  let devMs = 0
  let renderMs = 0
  sheet.enter(dev)
  const snapAt = new Set([10, 30])
  let flashed = false
  for (let t = 0; t < p.devSeconds; t++) {
    const tt = now()
    sheet.process(dev, 1, { agitation: flashed ? 0 : p.agitation, diffuse: p.diffuse })
    devMs += now() - tt
    if (!flashed && p.flashLuxS > 0 && t + 1 >= p.flashAt) {
      sheet.expose(lightBands('roomLED', 1), p.flashLuxS)
      flashed = true
    }
    if (snapAt.has(t + 1)) {
      const tr = now()
      stages.push(grab(`Dev ${t + 1} s`, p.viewUnderSafelight ? 'under the safelight' : 'white light', w, h, (o) => sheet.render(o, view)))
      renderMs += now() - tr
    }
  }
  timings.develop = devMs
  timings.render = renderMs
  stages.push(grab(`Dev ${p.devSeconds} s`, p.viewUnderSafelight ? 'pull it now?' : '', w, h, (o) => sheet.render(o, view)))
  t0 = now()
  const stop = makeStop(p.stop)
  sheet.enter(stop)
  sheet.process(stop, p.stopSeconds)
  const fix = makeFixer('rapid')
  fix.silverG = p.fixerLoad
  sheet.enter(fix)
  sheet.process(fix, p.fixSeconds)
  timings.stopFix = now() - t0
  stages.push(grab('Fixed', 'lights on, still wet', w, h, (o) => sheet.render(o)))
  t0 = now()
  if (p.hca) sheet.process({ kind: 'hca', tempC: 20 }, 120)
  const wash = makeWash(1, 20)
  sheet.enter(wash)
  sheet.process(wash, p.washMin * 60)
  if (p.toner !== 'none') {
    if (p.toner === 'selenium') sheet.process(makeToner('selenium'), p.tonerMin * 60)
    else {
      sheet.process(makeToner('bleach'), 90)
      sheet.process(wash, 120)
      sheet.process(makeToner('sulfide'), p.tonerMin * 60)
    }
    sheet.process(wash, 300)
  }
  sheet.process({ ...AIR, airflow: 0.3 }, 3600)
  timings.washDry = now() - t0
  const disc = sheet.yearsToDiscolour()
  stages.push(grab('Dry', p.toner === 'none' ? 'dried down' : `${p.toner} toned`, w, h, (o) => sheet.render(o)))
  if (p.years > 0) {
    sheet.age(p.years)
    stages.push(grab(`${p.years} years`, 'on the wall', w, h, (o) => sheet.render(o)))
  }
  const st = sheet.stats()
  const gl = PAPERS[p.paper].kind === 'graded' ? `Gr ${Math.max(0, p.grade)}` : `Gr ${gradeLabel(grade)}`
  const log = `${PAPERS[p.paper].name} · ${gl} · f/${p.fNumber} · ${seconds} s · Dev ${p.devSeconds} s @ ${p.devTemp}°C${p.devFormula === 'paperMQ' ? ` 1+${p.devDilution}` : ' (coffee)'} · ${p.stop === 'acetic' ? 'Stop' : 'Water'} ${p.stopSeconds} s · Fix ${p.fixSeconds} s · ${p.hca ? 'HCA · ' : ''}Wash ${p.washMin} min`
  const facts: [string, string][] = [
    ['negative', negNote],
    ['grade / time', `${gl}, ${seconds} s at f/${p.fNumber} (${enlargerLux(p.fNumber).toFixed(2)} lux)`],
    ['max density', st.maxDensity.toFixed(2)],
    ['halide left', st.halideLeft < 0.02 ? 'fixed' : `${(st.halideLeft * 100).toFixed(0)}% (will print out)`],
    ['residual hypo', st.residualHypo.toExponential(1)],
    ['will start to discolour in', !Number.isFinite(disc.years) ? 'never' : disc.years > 2000 ? 'a few thousand years' : disc.years < 1 ? `about ${Math.max(1, Math.round(disc.years * 12))} months (${disc.cause})` : `about ${disc.years.toFixed(0)} years (${disc.cause})`],
    ['developer left', `${(100 * Math.max(0, 1 - dev.silverG / 0.9)).toFixed(0)}%`],
  ]
  return { stages, timings, log, facts, sheet, grade, seconds }
}

// ---------------------------------------------------------------------------
// Cyanotype
// ---------------------------------------------------------------------------

export interface CyanoParams {
  width: number
  source: SourceId
  coats: number
  ratioAB: number
  sensitizerAgeH: number
  dryMin: number
  airflow: number
  light: 'uvBox' | 'sun'
  uvW: number
  cloud: number
  expMin: number
  washBath: 'water' | 'vinegar' | 'citric' | 'hardTap'
  washMin: number
  peroxide: boolean
  bleachSec: number
  teaMin: number
  sodaAfterSec: number
  restH: number
}

export const CYANO_DEFAULTS: CyanoParams = {
  width: 320, source: 'mailbox', coats: 1, ratioAB: 1, sensitizerAgeH: 0.5, dryMin: 30, airflow: 0, light: 'uvBox', uvW: 40, cloud: 1,
  expMin: 12, washBath: 'water', washMin: 5, peroxide: true, bleachSec: 0, teaMin: 0, sodaAfterSec: 0, restH: 24,
}

export function cyanoNegative(p: CyanoParams, w: number, h: number): Float32Array {
  if (p.source === 'fern') return fernMask(w, h)
  const scene = sceneFor(p.source, w, h)
  return transmission(digitalNegative(luminanceOf(scene), w, h, { curve: 'cyanotype', range: 1.9, dmin: 0.05 }))
}

export function runCyano(p: CyanoParams, extraCoat: Float32Array | null = null): RunResult & { sheet: CyanoSheet } {
  const timings: Record<string, number> = {}
  const stages: Stage[] = []
  const w = p.width
  const h = Math.round((w * 4) / 5)
  let t0 = now()
  const mask = cyanoNegative(p, w, h)
  timings.negative = now() - t0
  stages.push({ label: p.source === 'fern' ? 'Fern' : 'Negative', note: p.source === 'fern' ? 'photogram' : 'digital negative (cyanotype curve)', w, h, rgba: maskRGBA(mask, w, h) })
  t0 = now()
  const s = new CyanoSheet(w, h)
  const coat = brushCoatMask(w, h)
  for (let i = 0; i < coat.length; i++) coat[i] = coat[i] * p.coats + (extraCoat ? extraCoat[i] : 0)
  s.coat(coat, { ratioAB: p.ratioAB, sensitizerAgeH: p.sensitizerAgeH })
  timings.coat = now() - t0
  stages.push(grab('Coated', 'wet sensitizer, hake brush', w, h, (o) => s.render(o)))
  s.dry(p.dryMin * 60, p.airflow)
  stages.push(grab('Dry', `${p.dryMin} min in the dark`, w, h, (o) => s.render(o)))
  const light = p.light === 'uvBox' ? lightBands('uvBox', p.uvW) : sunBands(p.cloud)
  t0 = now()
  const parts = [1 / 3, 1 / 3, 1 / 3]
  let done = 0
  for (const f of parts) {
    s.expose(light, f * p.expMin * 60, { mask })
    done += f
    stages.push(grab(`${(done * p.expMin).toFixed(0)} min`, done < 0.99 ? 'printing out' : 'peek: shadows bronzing?', w, h, (o) => s.render(o)))
  }
  timings.expose = now() - t0
  t0 = now()
  const wb = CYANO_BATHS[p.washBath]
  let yellow = 0
  for (let t = 0; t < p.washMin * 60; t += 10) yellow += s.process(wb, 10).yellowOut
  stages.push(grab('Washed', `${CYANO_BATHS[p.washBath].name}, ${p.washMin} min`, w, h, (o) => s.render(o)))
  if (p.peroxide) {
    s.process(CYANO_BATHS.peroxide, 5)
    stages.push(grab('+ H₂O₂', 'the blue pop', w, h, (o) => s.render(o)))
  }
  if (p.bleachSec > 0) {
    s.process(CYANO_BATHS.soda, p.bleachSec)
    s.process(CYANO_BATHS.water, 60)
    stages.push(grab('Bleached', `washing soda ${p.bleachSec} s`, w, h, (o) => s.render(o)))
  }
  if (p.teaMin > 0) {
    s.process(CYANO_BATHS.tea, p.teaMin * 60)
    stages.push(grab('Tea', `${p.teaMin} min`, w, h, (o) => s.render(o)))
  }
  if (p.sodaAfterSec > 0) {
    s.process(CYANO_BATHS.soda, p.sodaAfterSec)
    stages.push(grab('+ soda', 'darkens the tannate', w, h, (o) => s.render(o)))
  }
  if (p.bleachSec > 0 || p.teaMin > 0 || p.sodaAfterSec > 0) s.process(CYANO_BATHS.water, 120)
  timings.wet = now() - t0
  s.rest(p.restH)
  stages.push(grab('Dry', `${p.restH} h later`, w, h, (o) => s.render(o)))
  const st = s.stats()
  const toned = p.teaMin > 0 ? ` · ${p.bleachSec > 0 ? `soda ${p.bleachSec}s · ` : ''}tea ${p.teaMin}m${p.sodaAfterSec ? ` · soda ${p.sodaAfterSec}s` : ''}` : ''
  const log = `Cyanotype, Classic A+B ${p.ratioAB === 1 ? '1:1' : `${p.ratioAB}:1`} · Rag 300gsm · ${p.coats} coat${p.coats === 1 ? '' : 's'} · ${p.light === 'uvBox' ? `UV 365nm ${p.uvW} W/m²` : `Sun ×${p.cloud}`} ${p.expMin}m · Wash ${p.washMin}m${p.peroxide ? ' + H₂O₂' : ''}${toned}`
  const facts: [string, string][] = [
    ['UV dose (clear area)', `${((cyanoMaxDose(s) / 1000) | 0)} kJ/m²`],
    ['Prussian blue (mean)', st.blue.toFixed(2)],
    ['bronze left', st.bronze.toFixed(3)],
    ['yellow washed out', yellow.toFixed(2)],
    ['oxidised', `${(st.oxidised * 100).toFixed(0)}%`],
  ]
  return { stages, timings, log, facts, sheet: s }
}

function cyanoMaxDose(s: CyanoSheet): number {
  let m = 0
  for (let i = 0; i < s.n; i++) if (s.f.dose[i] > m) m = s.f.dose[i]
  return m
}

function maskRGBA(mask: Float32Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(255 * Math.pow(mask[i], 1 / 2.2))
    out[4 * i] = v
    out[4 * i + 1] = v
    out[4 * i + 2] = Math.round(v * 0.97)
    out[4 * i + 3] = 255
  }
  return out
}

export { LIGHTS }

// ---------------------------------------------------------------------------
// Quick auto print of a negative (contact sheets, the film tab)
// ---------------------------------------------------------------------------

export function quickPrint(dens: Float32Array, w: number, h: number, paperId: PaperId = 'vcPearl'): { rgba: Uint8ClampedArray; grade: number; seconds: number } {
  const model = paper(paperId)
  const lux = enlargerLux(8)
  const ap = autoPrint(model, dens, lux)
  const sheet = new SilverSheet(model, w, h)
  sheet.expose(lightBands('enlarger', lux), ap.seconds, { mask: transmission(dens), filter: ap.filter })
  sheet.process(makeDeveloper(), 90)
  sheet.process(makeStop(), 10)
  sheet.process(makeFixer(), 60)
  sheet.process(makeWash(), 240)
  sheet.process({ ...AIR, airflow: 1 }, 3600)
  const rgba = new Uint8ClampedArray(w * h * 4)
  sheet.render(rgba)
  return { rgba, grade: ap.grade, seconds: ap.seconds }
}

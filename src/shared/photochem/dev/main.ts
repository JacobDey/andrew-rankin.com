// Dev harness for @shared/photochem (architecture §4.5 acceptance):
//   wedge   a 21-step wedge print developing under a scripted rock, then stop, fix, wash
//   cyano   brush coat, dry, UV through a fern, wash with a yellow plume, a peroxide drop, a night's rest
//   film    a mailbox on Nightjar 400, tank development, and its automatic print
// Everything is deterministic and driven through __game (no real-time loop under ?test=1).

import { installGameApi, markReady, flags } from '@shared/core'
import {
  AIR, CAMERA_FILTERS, CYANO_BATHS, CyanoSheet, FilmFrame, SilverSheet, autoPrint, bench, brushCoatMask, enlargerLux,
  fernMask, lightBands, mailboxScene, makeDeveloper, makeFilm, makeFixer, makeStop, makeWash, paper, peroxideBath, pushPull,
  selftest, stepWedge, transmission, vcGradeFilter,
} from '@shared/photochem'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const out = $<HTMLPreElement>('out')
const SAFE_VIEW: [number, number, number] = [0.62, 0.27, 0.035]

function blit(canvas: HTMLCanvasElement, rgba: Uint8ClampedArray, w: number, h: number): void {
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = ctx.createImageData(w, h)
  img.data.set(rgba)
  // Alpha carries wetness for the paper shader; the canvas wants it opaque.
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
  ctx.putImageData(img, 0, 0)
}

// --- wedge -----------------------------------------------------------------

const W = 256
const H = 320
let wedgeSheet: SilverSheet | null = null
const wedgeDens = stepWedge(W, H, 21, 0.15)
const wedgeMask = transmission(wedgeDens)

/** The scripted rock: a wave front sloshing across the sheet. */
function rockContact(t: number, out: Float32Array): void {
  const edge = 0.5 + 0.62 * Math.sin(t * 2.1)
  for (let x = 0; x < W; x++) {
    const c = Math.min(1, Math.max(0, (edge - x / W) * 7 + 0.5))
    for (let y = 0; y < H; y++) out[y * W + x] = c
  }
}

function wedgeStart(): SilverSheet {
  const s = new SilverSheet(paper('vcPearl'), W, H)
  s.expose(lightBands('safelightAmber'), 120)
  s.expose(lightBands('enlarger', enlargerLux()), 12, { mask: wedgeMask, filter: vcGradeFilter(2) })
  wedgeSheet = s
  return s
}

const wedgeDev = { bath: makeDeveloper(), t: 0 }
function wedgeDevelop(seconds: number, dt = 0.25): void {
  const s = wedgeSheet ?? wedgeStart()
  const contact = new Float32Array(W * H)
  for (let k = 0; k < seconds / dt; k++) {
    rockContact(wedgeDev.t, contact)
    s.process(wedgeDev.bath, dt, { contact, agitation: 0.7 })
    wedgeDev.t += dt
  }
  blit($('wedge'), render(s, SAFE_VIEW), W, H)
}

function render(s: SilverSheet | CyanoSheet, illum: [number, number, number] = [1, 1, 1]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(s.w * s.h * 4)
  s.render(px, illum)
  return px
}

function wedgeAll(): Record<string, number> {
  wedgeSheet = null
  wedgeDev.bath = makeDeveloper()
  wedgeDev.t = 0
  const s = wedgeStart()
  wedgeDevelop(75)
  const stop = makeStop()
  s.enter(stop)
  s.process(stop, 10)
  const fix = makeFixer()
  s.enter(fix)
  s.process(fix, 60)
  const wash = makeWash()
  s.enter(wash)
  s.process(wash, 240)
  s.process({ ...AIR, airflow: 1 }, 3600)
  blit($('wedge'), render(s), W, H)
  const st = s.stats()
  $('wedgeCap').textContent = `wedge: Dmax ${st.dmax.toFixed(2)}, border ${st.borderD.toFixed(3)}, mean ${st.meanD.toFixed(2)}`
  return { meanD: st.meanD, dmax: st.dmax, borderD: st.borderD, coverage: st.coverage }
}

// --- cyanotype -------------------------------------------------------------

let cy: CyanoSheet | null = null

function cyanoAll(): Record<string, number> {
  const s = new CyanoSheet(W, H)
  cy = s
  s.coat(brushCoatMask(W, H))
  s.dry(3600)
  s.expose(lightBands('uvBox'), 12 * 60, { mask: fernMask(W, H) })
  const wash = s.process(CYANO_BATHS.water, 150)
  const drop = new Float32Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drop[y * W + x] = Math.exp(-(((x - 128) / 40) ** 2 + ((y - 170) / 40) ** 2))
  s.process(peroxideBath(0), 2.5, { h2o2: drop })
  s.rest(8)
  blit($('cyano'), render(s), W, H)
  const st = s.stats()
  $('cyanoCap').textContent = `cyanotype: blue ${st.blue.toFixed(2)}, yellow out ${wash.yellowOut.toFixed(3)}, Dmax ${st.dmax.toFixed(2)}`
  return { blue: st.blue, bronze: st.bronze, yellowOut: wash.yellowOut, dmax: st.dmax, meanD: st.meanD }
}

// --- film and print --------------------------------------------------------

function filmAll(): Record<string, number> {
  const w = 384
  const h = 256
  const scene = mailboxScene(w, h)
  const m = makeFilm('nj400')
  const frame = new FilmFrame(m, w, h, 36)
  const t = 1 / 125
  const k = (12.5 * m.Hm) / 0.18 / t
  const rgb = new Float32Array(scene.rgb.length)
  for (let i = 0; i < rgb.length; i++) rgb[i] = scene.rgb[i] * k
  frame.exposeRGB(rgb, t, CAMERA_FILTERS.none)
  const dev = makeDeveloper('filmMQBorax', { dilution: 1, volumeL: 0.5 })
  const minutes = pushPull(m, 0, dev, 0.5).minutes
  for (let s = 0; s < minutes * 60; s += 10) frame.process(dev, Math.min(10, minutes * 60 - s), { agitation: 0.5 })
  frame.process(makeStop('water'), 30)
  frame.process(makeFixer(), 300)
  frame.process(makeWash(1), 600)
  const lb = new Uint8ClampedArray(w * h * 4)
  frame.render(lb, { grain: true, seed: 7 })
  blit($('neg'), lb, w, h)
  const dens = frame.densities(undefined, true, 7)
  const model = paper('vcPearl')
  const lux = enlargerLux(8)
  const ap = autoPrint(model, dens, lux)
  const sheet = new SilverSheet(model, w, h)
  sheet.expose(lightBands('enlarger', lux), ap.seconds, { mask: frame.printMask(undefined, 1, true, 7), filter: ap.filter })
  sheet.process(makeDeveloper(), 90)
  sheet.process(makeStop(), 10)
  sheet.process(makeFixer(), 60)
  sheet.process(makeWash(), 240)
  sheet.process({ ...AIR, airflow: 1 }, 3600)
  blit($('print'), render(sheet), w, h)
  const st = sheet.stats()
  $('negCap').textContent = `Nightjar 400, ${minutes.toFixed(1)} min`
  $('printCap').textContent = `print: grade ${ap.grade.toFixed(1)}, ${ap.seconds.toFixed(1)} s, mean ${st.meanD.toFixed(2)}, Dmax ${st.dmax.toFixed(2)}`
  return { devMinutes: minutes, grade: ap.grade, seconds: ap.seconds, meanD: st.meanD, dmax: st.dmax, borderD: st.borderD }
}

// --- API -------------------------------------------------------------------

const api = {
  /** Run one of the scripted pipelines to its end. */
  demo(name: 'wedge' | 'cyano' | 'film' | 'all'): Record<string, Record<string, number>> {
    const r: Record<string, Record<string, number>> = {}
    if (name === 'wedge' || name === 'all') r.wedge = wedgeAll()
    if (name === 'cyano' || name === 'all') r.cyano = cyanoAll()
    if (name === 'film' || name === 'all') r.film = filmAll()
    return r
  },
  /** Start the wedge print (exposed, in the developer tray) without advancing it. */
  wedgeStart(): void {
    wedgeSheet = null
    wedgeDev.bath = makeDeveloper()
    wedgeDev.t = 0
    wedgeStart()
    wedgeDevelop(0.25)
  },
  /** Advance the wedge print's development by `seconds` under the scripted rock and redraw (safelight view). */
  advance(seconds: number): { t: number; meanD: number; dmax: number } {
    wedgeDevelop(seconds)
    const st = (wedgeSheet ?? wedgeStart()).stats()
    return { t: wedgeDev.t, meanD: st.meanD, dmax: st.dmax }
  },
  selftest(): { total: number; failed: number; checks: ReturnType<typeof selftest> } {
    const checks = selftest()
    const failed = checks.filter((c) => !c.pass)
    out.textContent = `selftest: ${checks.length - failed.length}/${checks.length} pass\n` + failed.map((c) => `FAIL ${c.group} / ${c.name}: ${c.value} (${c.expect})`).join('\n')
    out.className = failed.length ? 'fail' : ''
    return { total: checks.length, failed: failed.length, checks: failed.length ? checks : [] }
  },
  bench(): Record<string, number> {
    const b = bench()
    out.textContent = 'bench (ms at 256x320, min of runs)\n' + Object.entries(b).map(([k, v]) => `${k.padEnd(28)} ${v}`).join('\n')
    return b
  },
  state(): unknown {
    return {
      wedge: wedgeSheet ? { t: wedgeDev.t, ...wedgeSheet.stats() } : null,
      cyano: cy ? cy.stats() : null,
    }
  },
}

const f = flags()
installGameApi('shared:photochem', 'photochem@1', api)
if (f.test) {
  // Deterministic: draw the unexposed state and wait for the driver.
  wedgeStart()
  blit($('wedge'), render(wedgeSheet ?? wedgeStart(), SAFE_VIEW), W, H)
} else {
  api.demo('all')
}
requestAnimationFrame(() => markReady())


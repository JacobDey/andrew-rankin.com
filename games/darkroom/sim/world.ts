// The World: trays, paper, light, enlarger, iron station, detectors.
// Chemistry is @shared/photochem (physical real time); fluid is ./fluid.
import {
  AIR, CYANO_BATHS, CyanoSheet, SilverSheet, lightBands, makeDeveloper, makeFixer, makeStop, makeWash, paper as paperModel, vcGradeFilter,
  type Bands, type CyanoBath, type SilverBath,
} from '@shared/photochem'
import { ADAPT, CHEM_HZ, DYE, FLUID, gradeNumber, IRON_K, LIGHT, PAPER, PEROXIDE, TIME, TIMER, TITLE_WEDGE, TILT } from '../constants'
import type { DarkroomBus } from '../events'
import { ENLARGER, IRON, LINE, lineSlotX, SAFELIGHT_POS, SHEET_M, TRAY_IDS, TRAY_INTERIOR, trayLayout, WINDOW } from '../layout'
import type {
  Commands, DarkroomContent, EnlargerState, Grade, IronState, LightId, Occluder, Paper, Place, PrintLog, PrintStats, PropState, Snapshot,
  TimerState, TrayId, TrayState, World,
} from '../types'
import { ScalarField, TrayBody, TrayFluid } from './fluid'
import { clamp, mulberry32, smoothstep, vnoise } from './rng'

const DEG = Math.PI / 180
/** O.'s reference exposure for pre-exposed sheets (title, envelope): a full-bodied print. */
const PRE_EXPOSE_S = 16

export interface WorldOptions { sheetW: number; sheetH: number; lowFluid?: boolean; firstRun: boolean }

export const NOTEBOOK: { id: string; title: string; hint: string }[] = [
  { id: 'first-light', title: 'First Light', hint: 'Fix a print with real blacks in it.' },
  { id: 'lights-on', title: 'Lights On', hint: 'What happens if you hit the switch too early?' },
  { id: 'safelight-creep', title: 'Safelight Creep', hint: 'Leave paper out under the amber for a long while.' },
  { id: 'test-strip', title: 'Test Strip', hint: 'Five bands, five times. Develop and fix it.' },
  { id: 'dodge', title: 'Dodging', hint: 'Hold back part of the print with your hand.' },
  { id: 'burn', title: 'Burning In', hint: 'Give one area more light through the card.' },
  { id: 'split-grade', title: 'Split Grade', hint: 'Two exposures, two very different filters.' },
  { id: 'sabattier', title: 'Solarized?', hint: 'A flash of light halfway through development.' },
  { id: 'photogram', title: 'Photogram', hint: 'No negative, just things on the paper.' },
  { id: 'iron', title: 'Iron & Sun', hint: 'Wash out a cyanotype with a good blue.' },
  { id: 'bronze', title: 'Bronzing', hint: 'Leave the shadows under UV until they go metallic.' },
  { id: 'peroxide', title: 'Peroxide Pop', hint: 'One drop in the wash tray.' },
  { id: 'own-light', title: 'Your Own Light', hint: 'Print something you brought from home.' },
]

interface PaperExtra {
  safeAcc: number; roomAcc: number; airAcc: number
  safeTotal: number; roomTotal: number; devSeconds: number; fixSeconds: number; washSeconds: number
  lastTray: TrayId | null
  grades: Set<number>
  strip: boolean; dodge: number; burn: number; props: number; noNeg: boolean
  flashMidDev: boolean
  oxStart: number; oxT: number
  lastVersion: number; lastRender: number
  fixedDone: boolean
  meanW: number
  safelightOnly: boolean
  uvSeconds: number
}

export function createWorld(seed: number, content: DarkroomContent, bus: DarkroomBus, opt: WorldOptions): World {
  const rnd = mulberry32(seed)
  const devBath = makeDeveloper('paperMQ')
  const baths: Record<TrayId, SilverBath> = {
    dev: devBath, stop: makeStop(), fix: makeFixer(), wash: makeWash(1), tone: makeWash(0.2),
  }
  const nx = opt.lowFluid ? FLUID.lowNx : FLUID.nx
  const ny = opt.lowFluid ? FLUID.lowNy : FLUID.ny
  const dx = TRAY_INTERIOR.w / nx
  const mkTray = (id: TrayId): TrayState => {
    const fluid = new TrayFluid({ nx, ny, dx, depth: FLUID.depth, lip: FLUID.lip, damping: FLUID.damping, substepDt: FLUID.substepDt, maxSubsteps: FLUID.maxSubsteps })
    return {
      id, fluid, body: new TrayBody(), rocking: false, held: false, restTilt: [0, 0], bulk: 1,
      dye: id === 'wash' ? new ScalarField(fluid) : null, perox: id === 'wash' ? new ScalarField(fluid) : null,
      kinetic: 0, impact: 0, spilled: 0,
    }
  }
  const trays = {} as Record<TrayId, TrayState>
  for (const id of TRAY_IDS) trays[id] = mkTray(id)

  const lights: Record<LightId, number> = { room: 0, safe: 0, enlarger: 0, uv: 0, blind: 0 }
  const timer: TimerState = { seconds: TIMER.default, running: false, remaining: 0, strip: false, band: 0, elapsed: 0, total: 0 }
  const enlarger: EnlargerState = { negative: 'mailbox', grade: '2', focus: false, exposing: false, grades: new Set() }
  const iron: IronState = {
    bottleA: IRON_K.bottleMl, bottleB: IRON_K.bottleMl, beakerA: 0, beakerB: 0, brushLoad: 0, tool: 'brush',
    frameOpen: true, frameIn: 'iron', frameNegative: null, frameProps: [], uvLid: false, uvOn: false, dryer: false, dryerAt: { x: IRON.coat.x, z: IRON.coat.z }, tap: false,
  }
  const props: PropState[] = content.props.map((p, i) => ({ id: p.id, name: p.name, x: ENLARGER.tin.x, z: ENLARGER.tin.z + i * 0.02, rot: 0, on: 'tin' as const }))
  const papers: Paper[] = []
  const extra = new Map<string, PaperExtra>()
  const discoveries: string[] = []
  let printNo = 0
  let paperSeq = 0
  let chemAcc = 0
  let envelopeLeft = 3
  let ff = false
  let guardOpen = false
  let occluder: Occluder | null = null
  let carried: string | null = null
  const carryPos = { x: 3.1, z: 0.5 }
  let carryTarget: Place | null = null
  let exposureX = ADAPT.maxX
  let time = 0
  let parentPin: string | null = null
  const negMaskCache = new Map<string, Float32Array>()

  const W = opt.sheetW, H = opt.sheetH

  // ------------------------------------------------------------------ papers
  function newLog(kind: 'silver' | 'cyano'): PrintLog {
    return { no: 0, paper: kind === 'silver' ? 'Nightjar Vari-Grade RC Pearl 8×10' : 'Rag paper, iron', negative: null, exposures: [], dodgeS: 0, burnS: 0, dev: 0, stop: 0, fix: 0, wash: 0, uv: 0, dry: 0, peroxide: false, fogged: false, parentPin }
  }
  function addPaper(kind: 'silver' | 'cyano', place: Place, title: string): Paper {
    const id = `p${++paperSeq}`
    const p: Paper = {
      id, kind, size: 'sheet', place, faceUp: true,
      body: { x: 0, y: 0, rot: 0, vx: 0, vy: 0, w: 0, sunk: false },
      silver: kind === 'silver' ? new SilverSheet(paperModel('vcPearl'), W, H) : undefined,
      cyano: kind === 'cyano' ? new CyanoSheet(W, H) : undefined,
      ratio: undefined, W, H,
      albedo: new Uint8ClampedArray(W * H * 4), dirty: true, albedoVer: 0, contact: new Float32Array(W * H),
      log: newLog(kind), flags: [], title, idle: 0, fromImport: false,
    }
    papers.push(p)
    extra.set(id, {
      safeAcc: 0, roomAcc: 0, airAcc: 0, safeTotal: 0, roomTotal: 0, devSeconds: 0, fixSeconds: 0, washSeconds: 0, lastTray: null,
      grades: new Set(), strip: false, dodge: 0, burn: 0, props: 0, noNeg: false, flashMidDev: false, oxStart: -1, oxT: 0,
      lastVersion: -1, lastRender: -1, fixedDone: false, meanW: 0, safelightOnly: true, uvSeconds: 0,
    })
    renderAlbedo(p)
    return p
  }
  const ex = (p: Paper) => extra.get(p.id) as PaperExtra
  const byId = (id: string) => papers.find((p) => p.id === id)

  function negMask(negId: string, flipX: boolean): Float32Array | null {
    const n = content.getNegative(negId)
    if (!n) return null
    const key = `${negId}:${flipX ? 1 : 0}:${n.T.length}`
    let m = negMaskCache.get(key)
    if (m) return m
    m = new Float32Array(W * H)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, v = (j + 0.5) / H
      const sx = Math.min(n.W - 1, Math.floor((flipX ? 1 - u : u) * n.W)), sy = Math.min(n.H - 1, Math.floor(v * n.H))
      m[j * W + i] = n.T[sy * n.W + sx]
    }
    negMaskCache.set(key, m)
    return m
  }
  function enlargerBands(lux: number): Bands { return lightBands('enlarger', lux) }

  /** Pre-exposed sheets (title, practice): the reference print, 10 s at grade 2. */
  function preExpose(p: Paper, negId: string) {
    const m = negMask(negId, false)
    p.silver?.expose(enlargerBands(LIGHT.enlargerLux), PRE_EXPOSE_S, { filter: vcGradeFilter(2), mask: m })
    p.log.negative = negId
    p.log.exposures.push({ seconds: PRE_EXPOSE_S, grade: '2', source: 'enlarger' })
    ex(p).safelightOnly = false
  }

  function placePos(p: Paper): { x: number; y: number; z: number } {
    const pl = p.place
    switch (pl.at) {
      case 'tray': { const t = trayLayout(pl.tray); return { x: (t?.x ?? 3) + p.body.x, y: 0.01, z: (t?.z ?? 0.4) + p.body.y } }
      case 'easel': return { x: ENLARGER.easel.x, y: 0.02, z: ENLARGER.easel.z }
      case 'line': return { x: lineSlotX(pl.slot), y: LINE.y - 0.1, z: LINE.z }
      case 'bench': return { x: pl.x, y: 0.005, z: pl.z }
      case 'coat': return { x: IRON.coat.x, y: 0.005, z: IRON.coat.z }
      case 'frame': case 'uvbox': return iron.frameIn === 'uvbox' ? { x: WINDOW.uvbox.x, y: 0.05, z: WINDOW.uvbox.z } : { x: IRON.frame.x, y: 0.02, z: IRON.frame.z }
      case 'carried': return { x: carryPos.x, y: 0.12, z: carryPos.z }
      default: return { x: ENLARGER.paperBox.x, y: 0.05, z: ENLARGER.paperBox.z }
    }
  }

  function renderAlbedo(p: Paper) {
    if (p.silver) p.silver.render(p.albedo)
    else if (p.cyano) p.cyano.render(p.albedo)
    p.dirty = false
    p.albedoVer++
  }

  // ------------------------------------------------------------------ light
  function safelightLux(p: Paper): number {
    const pos = placePos(p)
    const r = Math.hypot(pos.x - SAFELIGHT_POS[0], pos.y - SAFELIGHT_POS[1], pos.z - SAFELIGHT_POS[2])
    return LIGHT.safelightLux * Math.pow(LIGHT.safelightRef / Math.max(0.3, r), 2)
  }
  function sheltered(p: Paper): boolean { return p.place.at === 'box' || p.place.at === 'envelope' || (p.place.at === 'uvbox' && iron.uvLid) || (p.place.at === 'frame' && iron.frameIn === 'uvbox' && iron.uvLid) }

  function occlusionMask(out: Float32Array, o: Occluder): void {
    const hM = 0.05 + 0.25 * o.height01
    const scale = 1 / (1 - hM / 0.45)
    const pen = (0.004 + 0.025 * o.height01) * scale
    const x0 = ENLARGER.easel.x - SHEET_M.w / 2, z0 = ENLARGER.easel.z - SHEET_M.h / 2
    const c = Math.cos(-o.rot), s = Math.sin(-o.rot)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const wx = x0 + ((i + 0.5) / W) * SHEET_M.w, wz = z0 + ((j + 0.5) / H) * SHEET_M.h
      const lx = ((wx - o.x) * c - (wz - o.z) * s) / scale, lz = ((wx - o.x) * s + (wz - o.z) * c) / scale
      let sdf: number
      if (o.tool === 'card') {
        const r = o.hole ?? 0.025
        sdf = r - Math.hypot(lx, lz) // positive inside the hole = light passes
        out[j * W + i] *= smoothstep(-pen / 2, pen / 2, sdf)
        continue
      }
      if (o.tool === 'fist') sdf = Math.hypot(lx / 0.04, lz / 0.04) * 0.04 - 0.04
      else if (o.tool === 'wand') {
        const disc = Math.hypot(lx, lz) - 0.015
        const wire = lz > 0 ? Math.abs(lx) - 0.0006 : 1
        sdf = Math.min(disc, wire)
      } else {
        // open hand: palm ellipse + 4 fingers + thumb (fingers point toward the wall, −z)
        const palm = Math.hypot(lx / 0.045, (lz - 0.03) / 0.05) * 0.045 - 0.045
        let f = palm
        for (let k = 0; k < 4; k++) {
          const a = (k - 1.5) * 12 * DEG
          const bx = -0.027 + k * 0.018, bz = -0.01
          const tx = bx + Math.sin(a) * 0.07, tz = bz - Math.cos(a) * 0.07
          f = Math.min(f, capsule(lx, lz, bx, bz, tx, tz, 0.01))
        }
        f = Math.min(f, capsule(lx, lz, 0.035, 0.04, 0.075, 0.0, 0.011))
        sdf = f
      }
      out[j * W + i] *= smoothstep(-pen / 2, pen / 2, sdf)
    }
  }
  function capsule(px: number, pz: number, ax: number, az: number, bx: number, bz: number, r: number) {
    const pax = px - ax, paz = pz - az, bax = bx - ax, baz = bz - az
    const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1)
    return Math.hypot(pax - bax * h, paz - baz * h) - r
  }

  const maskBuf = new Float32Array(W * H)
  function enlargerExpose(p: Paper, h: number) {
    if (!p.silver) return
    const e = ex(p)
    const g = gradeNumber(enlarger.grade)
    const neg = enlarger.negative ? negMask(enlarger.negative, false) : null
    const focusOnly = !timer.running
    // radial falloff (cos⁴-ish)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W - 0.5, v = (j + 0.5) / H - 0.5
      const rho2 = (u * u + v * v) / 0.41
      const blade = Math.abs(u) > 0.455 || Math.abs(v) > 0.46 ? 0 : 1 // easel blades: a white border
      maskBuf[j * W + i] = (neg ? neg[j * W + i] : 1) * (1 - 0.12 * rho2) * blade
    }
    if (!p.faceUp) maskBuf.fill(0.03)
    if (timer.running && timer.strip) {
      const covered = Math.min(TIMER.stripBands, Math.floor(timer.elapsed / Math.max(0.5, timer.seconds)))
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (i / W < covered / TIMER.stripBands) maskBuf[j * W + i] = 0
      e.strip = true
    }
    if (occluder) {
      occlusionMask(maskBuf, occluder)
      if (occluder.tool === 'card') e.burn += h
      else e.dodge += h
    }
    // props on the easel (photogram)
    const onEasel = props.filter((pr) => pr.on === 'easel')
    if (onEasel.length) { for (const pr of onEasel) applyProp(maskBuf, pr, ENLARGER.easel.x, ENLARGER.easel.z); e.props = Math.max(e.props, onEasel.length) }
    if (!enlarger.negative) e.noNeg = true
    p.silver.expose(enlargerBands(LIGHT.enlargerLux), h, { filter: g === 2 ? undefined : vcGradeFilter(g), mask: maskBuf })
    e.grades.add(g)
    e.safelightOnly = false
    if (!focusOnly) {
      const last = p.log.exposures[p.log.exposures.length - 1]
      if (last && last.source === 'enlarger-live' && last.grade === enlarger.grade) last.seconds += h
      else p.log.exposures.push({ seconds: h, grade: enlarger.grade, strip: timer.strip, source: 'enlarger-live' })
      if (!p.log.negative && enlarger.negative) p.log.negative = enlarger.negative
      if (enlarger.negative && content.getNegative(enlarger.negative)?.source === 'import') p.fromImport = true
    }
    p.dirty = true
  }
  function applyProp(mask: Float32Array, pr: PropState, cx: number, cz: number) {
    const pm = content.props.find((q) => q.id === pr.id)
    if (!pm) return
    const x0 = cx - SHEET_M.w / 2, z0 = cz - SHEET_M.h / 2
    const c = Math.cos(-pr.rot), s = Math.sin(-pr.rot)
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const wx = x0 + ((i + 0.5) / W) * SHEET_M.w, wz = z0 + ((j + 0.5) / H) * SHEET_M.h
      const lx = ((wx - pr.x) * c - (wz - pr.z) * s) / pm.sizeM + 0.5, lz = ((wx - pr.x) * s + (wz - pr.z) * c) / pm.sizeM + 0.5
      if (lx < 0 || lz < 0 || lx >= 1 || lz >= 1) continue
      mask[j * W + i] *= pm.T[Math.floor(lz * pm.H) * pm.W + Math.floor(lx * pm.W)]
    }
  }

  function uvExpose(p: Paper, h: number) {
    const hs = h * TIME.uv
    maskBuf.fill(LIGHT.uvGlass)
    if (iron.frameNegative) {
      const neg = negMask(iron.frameNegative, true) // ink side down: mirrored back
      if (neg) for (let i = 0; i < maskBuf.length; i++) maskBuf[i] *= neg[i]
      if (content.getNegative(iron.frameNegative)?.source === 'import') p.fromImport = true
      p.log.negative = iron.frameNegative
    }
    const inFrame = props.filter((pr) => pr.on === 'frame')
    for (const pr of inFrame) applyProp(maskBuf, { ...pr, x: pr.x - IRON.frame.x + ENLARGER.easel.x, z: pr.z - IRON.frame.z + ENLARGER.easel.z }, ENLARGER.easel.x, ENLARGER.easel.z)
    if (inFrame.length) ex(p).props = Math.max(ex(p).props, inFrame.length)
    if (!iron.frameNegative) ex(p).noNeg = true
    if (!p.faceUp) maskBuf.fill(0.02)
    const uv = lightBands('uvBox', LIGHT.uvW)
    if (p.cyano) p.cyano.expose(uv, hs, { mask: maskBuf })
    else if (p.silver) p.silver.expose(uv, h, { mask: maskBuf })
    ex(p).uvSeconds += hs
    p.log.uv += h
    p.dirty = true
  }

  // ------------------------------------------------------------------ discoveries
  function discover(id: string, line: string) {
    if (discoveries.includes(id)) return
    discoveries.push(id)
    const t = NOTEBOOK.find((n) => n.id === id)
    bus.emit('discover', { id, title: t?.title ?? id, line })
  }

  // ------------------------------------------------------------------ contact
  const vtmp = { x: 0, y: 0 }
  function computeContact(p: Paper, t: TrayState): number {
    const f = t.fluid
    const pw = SHEET_M.w, ph = SHEET_M.h
    const e = ex(p)
    const lift0 = PAPER.curlLift * (1 - e.meanW)
    let sum = 0
    // coarse grid then nearest fill: 40×50 samples
    const gx = 40, gy = 50
    const tmp = contactCoarse
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const u = (i + 0.5) / gx, v = (j + 0.5) / gy
      const x = p.body.x + (u - 0.5) * pw, y = p.body.y + (v - 0.5) * ph
      const edge = Math.max(Math.abs(2 * u - 1), Math.abs(2 * v - 1))
      const ss = smoothstep(0.7, 1.0, edge)
      const lift = lift0 * ss * ss
      const c = smoothstep(PAPER.contactLo, PAPER.contactHi, f.depthAt(x, y) - lift)
      tmp[j * gx + i] = c
      sum += c
    }
    // bilinear upsample to the sheet
    const out = p.contact
    for (let j = 0; j < H; j++) {
      const fy = ((j + 0.5) / H) * gy - 0.5
      const j0 = clamp(Math.floor(fy), 0, gy - 2), ty = clamp(fy - j0, 0, 1)
      for (let i = 0; i < W; i++) {
        const fx = ((i + 0.5) / W) * gx - 0.5
        const i0 = clamp(Math.floor(fx), 0, gx - 2), tx = clamp(fx - i0, 0, 1)
        const a = tmp[j0 * gx + i0], b = tmp[j0 * gx + i0 + 1], c = tmp[(j0 + 1) * gx + i0], d = tmp[(j0 + 1) * gx + i0 + 1]
        out[j * W + i] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty
      }
    }
    return sum / (gx * gy)
  }
  const contactCoarse = new Float32Array(40 * 50)

  // ------------------------------------------------------------------ chemistry tick
  const peroxContact = new Float32Array(W * H)
  const waterContact = new Float32Array(W * H)
  const peroxCoarse = new Float32Array(20 * 25)
  function chemTick(h: number) {
    for (const p of papers) {
      const e = ex(p)
      if (p.place.at === 'carried' && !p.silver && !p.cyano) continue
      const lit = !sheltered(p)
      // uniform lights, batched
      if (lit && lights.room > 0 && !e.fixedDone) {
        e.roomAcc += h * lights.room
        if (e.roomAcc >= 0.1) {
          const s = e.roomAcc
          e.roomAcc = 0
          const k = p.faceUp ? 1 : LIGHT.faceDown
          if (p.silver) {
            const st0 = e.roomTotal
            p.silver.expose(lightBands('room', LIGHT.roomLux * k), s)
            e.roomTotal += s
            e.safelightOnly = false
            if (!p.log.fogged && st0 < 0.01) {
              p.log.fogged = true
              bus.emit('fog', { paperId: p.id })
              if (!p.flags.includes('fog')) p.flags.push('fog')
              discover('lights-on', `You hit the lights at ${fmtT(time)} with paper out.`)
              const st = p.silver.stats()
              if (p.place.at === 'tray' && p.place.tray === 'dev' && st.meanProgress > 0.15 && st.meanProgress < 0.85) e.flashMidDev = true
            }
          } else if (p.cyano) p.cyano.expose(lightBands('room', LIGHT.roomLux * k), s * TIME.uv * 0.2)
          p.dirty = true
        }
      }
      if (lit && lights.safe > 0 && p.silver && !e.fixedDone) {
        e.safeAcc += h
        if (e.safeAcc >= LIGHT.safelightBatchS) {
          const k = p.faceUp ? 1 : LIGHT.faceDown
          p.silver.expose(lightBands('safelightAmber', safelightLux(p) * k), e.safeAcc)
          e.safeTotal += e.safeAcc * safelightLux(p) / LIGHT.safelightLux
          e.safeAcc = 0
          p.dirty = true
        }
      }
      if (p.place.at === 'easel' && (timer.running || enlarger.focus)) enlargerExpose(p, h)
      if ((p.place.at === 'frame' || p.place.at === 'uvbox') && iron.frameIn === 'uvbox' && iron.uvOn) uvExpose(p, h)

      // wet chemistry
      if (p.place.at === 'tray') {
        const tid = p.place.tray
        const t = trays[tid]
        const cov = computeContact(p, t)
        e.meanW += (Math.min(1, cov * 1.3) - e.meanW) * (1 - Math.exp(-h / PAPER.wetTau))
        p.body.sunk = e.meanW > PAPER.sunkW
        const agit = clamp(t.fluid.kinetic() / 0.002, 0, 1)
        if (p.silver) {
          const bath = baths[tid]
          if (e.lastTray !== tid) { p.silver.enter(bath); e.lastTray = tid }
          const scale = tid === 'dev' ? TIME.dev : tid === 'stop' ? TIME.stop : tid === 'fix' ? TIME.fix : TIME.wash
          p.silver.process(bath, h * scale * (ff ? 1 : 1), { contact: p.contact, agitation: agit })
          if (cov > 0.05) {
            if (tid === 'dev') { p.log.dev += h; e.devSeconds += h * cov }
            else if (tid === 'stop') p.log.stop += h
            else if (tid === 'fix') { p.log.fix += h; e.fixSeconds += h * cov }
            else p.log.wash += h
          }
          p.dirty = true
        } else if (p.cyano) {
          e.lastTray = tid
          if (tid === 'wash' && t.perox && t.dye) {
            // split the sheet by local peroxide concentration (a radial blue front)
            let pmax = 0
            const gx = 20, gy = 25
            for (let b = 0; b < gy; b++) for (let a = 0; a < gx; a++) {
              const x = p.body.x + ((a + 0.5) / gx - 0.5) * SHEET_M.w, y = p.body.y + ((b + 0.5) / gy - 0.5) * SHEET_M.h
              const pc = clamp(t.perox.sample(x, y), 0, 1)
              peroxCoarse[b * gx + a] = pc
              if (pc > pmax) pmax = pc
            }
            for (let j = 0; j < H; j++) {
              const b = Math.min(gy - 1, Math.floor((j / H) * gy))
              for (let i = 0; i < W; i++) {
                const k = j * W + i
                const pc = peroxCoarse[b * gx + Math.min(gx - 1, Math.floor((i / W) * gx))]
                const c = p.contact[k]
                peroxContact[k] = c * pc
                waterContact[k] = c * (1 - pc)
              }
            }
            const r1 = p.cyano.process(CYANO_BATHS.water, h * TIME.cyanoWash, { contact: waterContact })
            if (pmax > 0.01) {
              const bath: CyanoBath = { ...CYANO_BATHS.peroxide, h2o2: 1 }
              p.cyano.process(bath, h * TIME.peroxide, { contact: peroxContact })
              p.log.peroxide = true
            }
            if (r1.yellowOut > 0) t.dye.add(p.body.x + (rnd() - 0.5) * 0.15, p.body.y + (rnd() - 0.5) * 0.18, 0.03, r1.yellowOut * 0.04)
            if (pmax > 0.01) {
              // Peroxide Pop: ≥ 30% of the sheet newly oxidised within 5 s of the first drop reaching it
              const ox = (p.cyano.f as unknown as Record<string, Float32Array>).ox
              if (ox) {
                let hi = 0
                for (let i = 0; i < ox.length; i += 3) if (ox[i] > 0.85) hi++
                const frac = hi / Math.ceil(ox.length / 3)
                if (e.oxStart < 0) { e.oxStart = frac; e.oxT = 0 }
                e.oxT += h
                if (frac - e.oxStart >= 0.3 && e.oxT < 5) { discover('peroxide', 'One drop, and it went to midnight.'); bus.emit('bloom', { id: p.id }) }
              }
            }
          } else p.cyano.process(CYANO_BATHS.water, h * TIME.cyanoWash, { contact: p.contact })
          if (cov > 0.05) { p.log.wash += h; e.washSeconds += h * cov }
          p.dirty = true
        }
      } else {
        // air: development carries on, sheets dry (batched at 4 Hz)
        e.airAcc += h
        e.meanW *= Math.exp(-h / PAPER.dryTau)
        if (e.airAcc >= 0.25) {
          const s = e.airAcc
          e.airAcc = 0
          const wet = e.meanW > 0.02 || (p.silver ? p.silver.stats().wet > 0.02 : false)
          if (p.silver) {
            if (wet || !e.fixedDone) {
              const scale = p.place.at === 'line' ? TIME.lineDry : 1
              p.silver.process(AIR, s * scale)
              p.dirty = true
            }
          } else if (p.cyano) {
            const air = iron.dryer && p.place.at === 'coat' ? 1 : 0
            p.cyano.dry(s * TIME.cyanoDry * (p.place.at === 'line' ? 2 : 1), air)
            if (air) p.log.dry += s
            p.dirty = true
          }
        }
      }
      // detectors that need fresh stats (cheap enough at 30 Hz for a handful of sheets)
      if (p.silver && !e.fixedDone && p.place.at === 'tray' && p.place.tray === 'fix') {
        const st = p.silver.stats()
        if (st.halideLeft < 0.05) {
          e.fixedDone = true
          if (st.maxDensity > 1.0) discover('first-light', `Fixed after ${Math.round(p.log.dev)} s in the developer.`)
          if (e.strip && p.log.dev > 20) discover('test-strip', 'Five bands. Pick the one where the blacks just stop getting blacker.')
          if (e.dodge >= 0.5) discover('dodge', `You held back ${e.dodge.toFixed(1)} s with your hand.`)
          if (e.burn >= 1) discover('burn', `Burned in for ${e.burn.toFixed(1)} s.`)
          const gs = [...e.grades]
          if (gs.length >= 2 && Math.max(...gs) - Math.min(...gs) >= 3) discover('split-grade', 'Soft for the highlights, hard for the blacks.')
          if (e.flashMidDev) discover('sabattier', 'You flashed the light halfway through development.')
          if (e.props > 0 && e.noNeg && p.log.dev > 10) discover('photogram', 'No negative. Just shadows.')
          if (e.safelightOnly && e.safeTotal > 180 && st.meanDensity > 0.07) discover('safelight-creep', `${Math.round(e.safeTotal)} s under the amber did that.`)
          if (p.fromImport) discover('own-light', 'Your own picture, in silver.')
        }
      }
      if (p.cyano && p.place.at === 'tray' && p.place.tray === 'wash' && e.washSeconds > 3) {
        const st = p.cyano.stats()
        if (st.blue > 0.3) { discover('iron', 'Iron and sun. Prussian blue.'); if (p.fromImport) discover('own-light', 'Your own picture, in iron.') }
        if (st.bronze > 0.05 || e.uvSeconds > 900) discover('bronze', 'The shadows went metallic before the wash.')
      }
      if (e.safelightOnly && e.safeTotal > 180 && p.silver && p.place.at === 'tray' && p.place.tray === 'dev' && e.devSeconds > 40) {
        discover('safelight-creep', `${Math.round(e.safeTotal)} s under the amber, then developed.`)
      }
    }
  }
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  // ------------------------------------------------------------------ tray paper bodies
  function paperBodies(dt: number) {
    for (const p of papers) {
      if (p.place.at !== 'tray') continue
      const t = trays[p.place.tray]
      const f = t.fluid
      let ux = 0, uy = 0
      for (let k = 0; k < 9; k++) {
        const sx = ((k % 3) - 1) * 0.08, sy = (Math.floor(k / 3) - 1) * 0.1
        f.velocityAt(p.body.x + sx, p.body.y + sy, vtmp)
        ux += vtmp.x; uy += vtmp.y
      }
      ux /= 9; uy /= 9
      const kd = p.body.sunk ? PAPER.kdSunk : PAPER.kdFloat
      p.body.vx += kd * (ux - p.body.vx) * dt
      p.body.vy += kd * (uy - p.body.vy) * dt
      // floor friction + gentle downhill slide on the tray floor
      const fr = Math.exp(-(p.body.sunk ? 4 : 1.5) * dt)
      p.body.vx *= fr; p.body.vy *= fr
      p.body.x += p.body.vx * dt
      p.body.y += p.body.vy * dt
      const mx = (TRAY_INTERIOR.w - SHEET_M.w) / 2 - 0.004, my = (TRAY_INTERIOR.d - SHEET_M.h) / 2 - 0.002
      if (p.body.x > mx) { p.body.x = mx; p.body.vx *= -PAPER.restitution }
      if (p.body.x < -mx) { p.body.x = -mx; p.body.vx *= -PAPER.restitution }
      if (p.body.y > my) { p.body.y = my; p.body.vy *= -PAPER.restitution }
      if (p.body.y < -my) { p.body.y = -my; p.body.vy *= -PAPER.restitution }
    }
  }

  // ------------------------------------------------------------------ timer
  let tickAcc = 0
  function stepTimer(dt: number) {
    if (!timer.running) return
    timer.elapsed += dt
    timer.remaining = Math.max(0, timer.total - timer.elapsed)
    tickAcc += dt
    if (tickAcc >= 1) { tickAcc -= 1; bus.emit('timerTick', { remaining: timer.remaining }) }
    if (timer.strip) timer.band = Math.min(TIMER.stripBands, Math.floor(timer.elapsed / Math.max(0.5, timer.seconds)))
    if (timer.remaining <= 0) {
      timer.running = false
      enlarger.exposing = false
      lights.enlarger = enlarger.focus ? 1 : 0
      bus.emit('timerBell', {})
      bus.emit('exposure', { on: false })
    }
  }

  // ------------------------------------------------------------------ adaptation
  function adapt(dt: number) {
    const Lsum = ADAPT.room * lights.room + ADAPT.enlarger * (lights.enlarger > 0 ? 1 : 0) + (iron.uvOn ? ADAPT.uvClosed : 0) + ADAPT.safe * lights.safe
    const target = Math.min(ADAPT.maxX, Math.pow(Lsum + ADAPT.floor, -0.75))
    const lnX = Math.log(exposureX), lnT = Math.log(target)
    const tau = lnT < lnX ? ADAPT.tauBright : ADAPT.tauDark
    exposureX = Math.exp(lnX + (lnT - lnX) * (1 - Math.exp(-dt / tau)))
  }

  // ------------------------------------------------------------------ commands
  const cmd: Commands = {
    setLight(id, on) {
      const v = typeof on === 'number' ? on : on ? 1 : 0
      if (id === 'room' && v > 0 && !guardOpen) return
      if (lights[id] === v) return
      lights[id] = v
      bus.emit('light', { id, on: v > 0 })
    },
    guard(open) { guardOpen = open; bus.emit('guard', { open }) },
    holdTray(tid, tx, ty, ox = 0, oy = 0) {
      const t = trays[tid]
      if (!t) return
      if (t.restTilt[0] || t.restTilt[1]) { t.restTilt = [0, 0]; t.body.restX = 0; t.body.restY = 0 }
      t.body.hold(tx, ty, ox, oy)
      t.held = true
      t.fluid.wake()
    },
    releaseTray(tid) { const t = trays[tid]; if (!t) return; t.body.release(); t.held = false },
    autoRock(tid, on) {
      const t = trays[tid]; if (!t) return
      if (on && (t.restTilt[0] || t.restTilt[1])) { t.restTilt = [0, 0]; t.body.restX = 0; t.body.restY = 0 }
      t.rocking = on; t.body.autoRock(on); t.fluid.wake()
    },
    poke(tid, x, y, s) { trays[tid]?.fluid.poke(x, y, s) },
    refill(tid) { const t = trays[tid]; if (!t) return; t.fluid.refill(FLUID.depth); t.dye?.clear(); t.perox?.clear(); t.spilled = 0 },
    take(from) {
      if (from === 'envelope') {
        if (envelopeLeft <= 0) return null
        const negs = ['mailbox', 'pear', 'dishrack']
        const neg = negs[(3 - envelopeLeft) % 3]
        envelopeLeft--
        const p = addPaper('silver', { at: 'carried' }, 'Practice sheet')
        preExpose(p, neg)
        carried = p.id
        bus.emit('paperGrab', { id: p.id })
        return p.id
      }
      if (from === 'rag') {
        const p = addPaper('cyano', { at: 'carried' }, 'Rag paper')
        carried = p.id
        bus.emit('paperGrab', { id: p.id })
        return p.id
      }
      const p = addPaper('silver', { at: 'carried' }, from === 'box-strip' ? 'Test strip' : 'Sheet')
      carried = p.id
      bus.emit('paperGrab', { id: p.id })
      return p.id
    },
    pick(id) {
      const p = byId(id)
      if (!p || carried) return false
      if (p.place.at === 'frame' || p.place.at === 'uvbox') { if (iron.frameIn === 'uvbox' && iron.uvLid) return false }
      const pos = placePos(p)
      carryPos.x = pos.x; carryPos.z = pos.z
      p.place = { at: 'carried' }
      carried = id
      bus.emit('paperGrab', { id })
      return true
    },
    carry(x, z) { carryPos.x = x; carryPos.z = z },
    drop() {
      if (!carried) return null
      const p = byId(carried)
      carried = null
      if (!p) return null
      const target = carryTarget ?? placeFor(carryPos.x, carryPos.z, p)
      carryTarget = null
      moveTo(p, target)
      return p.place
    },
    dunk(id) {
      const p = byId(id)
      if (!p || p.place.at !== 'tray') return
      const t = trays[p.place.tray]
      t.fluid.impulse(p.body.x, p.body.y, 0.02, 0.002)
      ex(p).meanW = Math.min(1, ex(p).meanW + PAPER.dunkW)
      bus.emit('dunk', { id })
    },
    flip(id) { const p = byId(id); if (p) { p.faceUp = !p.faceUp; p.dirty = true } },
    hang(id) {
      const p = byId(id)
      if (!p) return
      if (carried === id) carried = null
      moveTo(p, { at: 'line', slot: nextSlot() })
    },
    loadNegative(id) { enlarger.negative = id },
    setGrade(g) { enlarger.grade = g },
    setTimer(s) { timer.seconds = clamp(Math.round(s * 2) / 2, TIMER.min, TIMER.max) },
    startExposure(mode = 'normal') {
      if (timer.running) return
      timer.strip = mode === 'strip'
      timer.running = true
      timer.elapsed = 0
      ;timer.total = timer.strip ? timer.seconds * TIMER.stripBands : timer.seconds
      timer.remaining = timer.total
      timer.band = 0
      tickAcc = 0
      enlarger.exposing = true
      lights.enlarger = 1
      bus.emit('exposure', { on: true })
    },
    stopExposure() {
      if (!timer.running) return
      timer.running = false; enlarger.exposing = false; lights.enlarger = enlarger.focus ? 1 : 0
      bus.emit('exposure', { on: false })
    },
    setFocusLamp(on) { enlarger.focus = on; lights.enlarger = on || timer.running ? 1 : 0 },
    setOccluder(o) { occluder = o },
    setBottleTilt() { /* bottles pour through cmd.pour (hold) */ },
    loadTool(t) {
      iron.tool = t
      const vol = iron.beakerA + iron.beakerB
      if (vol <= 0.05) return
      const take = Math.min(IRON_K.brushMax - iron.brushLoad, vol)
      const ratio = iron.beakerA / vol
      iron.beakerA -= take * ratio; iron.beakerB -= take * (1 - ratio)
      iron.brushLoad += take
      brushRatio = ratio
    },
    stroke(paperId, u0, v0, u1, v1, dt) {
      const p = byId(paperId)
      if (!p || !p.cyano || iron.brushLoad <= 0.01) return
      const len = Math.hypot((u1 - u0) * SHEET_M.w, (v1 - v0) * SHEET_M.h)
      const speed = len / Math.max(1e-3, dt)
      const L = iron.brushLoad
      const dV = Math.min(L, IRON_K.brushMlPerS * dt * Math.sqrt(L / IRON_K.brushMax) * (0.4 + 0.6 * Math.exp(-speed / 0.25)) + len * 0.6 * Math.sqrt(L / IRON_K.brushMax))
      if (dV <= 0) return
      iron.brushLoad -= dV
      // deposit along the swath: brush 6 cm wide (rod 10 cm), bristle streaks, conserved volume
      const amt = coatBuf
      amt.fill(0)
      const R = iron.tool === 'rod' ? 0.05 : 0.03
      const ax0 = u0 * SHEET_M.w, az0 = v0 * SHEET_M.h, ax1 = u1 * SHEET_M.w, az1 = v1 * SHEET_M.h
      const L2 = Math.max(1e-4, len)
      const dxn = (ax1 - ax0) / L2, dzn = (az1 - az0) / L2
      const nxn = -dzn, nzn = dxn
      const steps = Math.max(1, Math.ceil(len / 0.004))
      const sp = len / steps
      const pw = SHEET_M.w / W, ph = SHEET_M.h / H
      let wsum = 0
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = ax0 + (ax1 - ax0) * t, cz = az0 + (az1 - az0) * t
        const i0 = Math.max(0, Math.floor((cx - R) / pw)), i1 = Math.min(W - 1, Math.ceil((cx + R) / pw))
        const j0 = Math.max(0, Math.floor((cz - R) / ph)), j1 = Math.min(H - 1, Math.ceil((cz + R) / ph))
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const ox = (i + 0.5) * pw - cx, oz = (j + 0.5) * ph - cz
          const along = ox * dxn + oz * dzn
          if (Math.abs(along) > Math.max(sp, pw) / 2) continue
          const across = (ox * nxn + oz * nzn) / R
          if (Math.abs(across) > 1) continue
          const bristle = iron.tool === 'rod' ? 1 : 0.55 + 0.7 * vnoise((across + 1) * 12, 0.5, brushSeed)
          const streak = 0.85 + 0.3 * vnoise((cx + cz) * 30, (across + 1) * 3, brushSeed + 3)
          const edge = 1 - Math.pow(Math.abs(across), 6)
          const w = bristle * streak * edge
          amt[j * W + i] += w
          wsum += w
        }
      }
      if (wsum <= 0) return
      const k = ((dV / IRON_K.mlPerCoat) * W * H) / wsum
      for (let i = 0; i < amt.length; i++) amt[i] *= k
      p.cyano.coat(amt, { ratioAB: brushRatio / Math.max(0.01, 1 - brushRatio) })
      p.ratio = brushRatio
      p.dirty = true
      bus.emit('brush', { speed, load: iron.brushLoad / IRON_K.brushMax })
    },
    blow(x, z, on) { iron.dryer = on; iron.dryerAt = { x, z }; bus.emit('dryer', { on }) },
    frame(a) {
      if (a === 'open') iron.frameOpen = true
      else if (a === 'close') iron.frameOpen = false
    },
    putInFrame(item) {
      const neg = content.getNegative(item)
      if (neg) { iron.frameNegative = item; return }
      const pr = props.find((q) => q.id === item)
      if (pr) { pr.on = pr.on === 'frame' ? 'tin' : 'frame'; pr.x = IRON.frame.x + (props.indexOf(pr) - 1) * 0.05; pr.z = IRON.frame.z; return }
      const p = byId(item)
      if (p) { if (carried === item) carried = null; moveTo(p, { at: 'frame' }) }
    },
    setUVLid(closed) {
      iron.uvLid = closed
      const on = closed
      if (iron.uvOn !== on) { iron.uvOn = on; lights.uv = on ? 1 : 0; bus.emit('uv', { on }) }
    },
    setBlind() { /* SHOULD: window + sun */ },
    tap(on) { iron.tap = on; bus.emit('tap', { on }) },
    peroxide(tid, x, y) {
      const t = trays[tid]
      if (!t) return
      t.perox?.add(x, y, PEROXIDE.sigma, PEROXIDE.amount)
      t.fluid.impulse(x, y, 0.01, PEROXIDE.ripple)
      bus.emit('peroxide', { tray: tid })
    },
    placeProp(id, x, z, rot) {
      const pr = props.find((q) => q.id === id)
      if (!pr) return
      pr.x = x; pr.z = z; pr.rot = rot
      const onEasel = Math.abs(x - ENLARGER.easel.x) < 0.15 && Math.abs(z - ENLARGER.easel.z) < 0.17
      const inFrame = Math.abs(x - IRON.frame.x) < 0.16 && Math.abs(z - IRON.frame.z) < 0.18
      pr.on = onEasel ? 'easel' : inFrame ? 'frame' : 'tin'
    },
    fastForward(on) { ff = on },
    moveTo(id, place) { const p = byId(id); if (p) { if (carried === id) carried = null; moveTo(p, place) } },
    pour(b, ml) {
      const have = b === 'A' ? iron.bottleA : iron.bottleB
      const m = Math.min(have, ml)
      if (m <= 0) return
      if (b === 'A') { iron.bottleA -= m; iron.beakerA += m } else { iron.bottleB -= m; iron.beakerB += m }
      bus.emit('pour', { bottle: b, rate: ml })
    },
    emptyBeaker() { iron.beakerA = 0; iron.beakerB = 0; iron.bottleA = IRON_K.bottleMl; iron.bottleB = IRON_K.bottleMl },
  }
  let brushRatio = 0.5
  const brushSeed = 11
  const coatBuf = new Float32Array(W * H)

  function nextSlot(): number {
    const used = new Set(papers.filter((p) => p.place.at === 'line').map((p) => (p.place as { slot: number }).slot))
    for (let s = 0; s < LINE.slots; s++) if (!used.has(s)) return s
    // full: the oldest print goes to the flat file (removed from the bench)
    const oldest = papers.find((p) => p.place.at === 'line')
    if (oldest) { const s = (oldest.place as { slot: number }).slot; papers.splice(papers.indexOf(oldest), 1); return s }
    return 0
  }

  function placeFor(x: number, z: number, p: Paper): Place {
    for (const tid of TRAY_IDS) {
      const t = trayLayout(tid)
      if (t && Math.abs(x - t.x) < t.outerW / 2 + 0.02 && Math.abs(z - t.z) < t.outerD / 2 + 0.03) return { at: 'tray', tray: tid }
    }
    if (Math.abs(x - ENLARGER.easel.x) < 0.16 && Math.abs(z - ENLARGER.easel.z) < 0.2) return { at: 'easel' }
    if (Math.abs(x - IRON.coat.x) < 0.14 && Math.abs(z - IRON.coat.z) < 0.17 && p.kind === 'cyano') return { at: 'coat' }
    if (Math.abs(x - IRON.frame.x) < 0.15 && Math.abs(z - IRON.frame.z) < 0.18) return { at: 'frame' }
    if (Math.abs(x - WINDOW.uvbox.x) < 0.2 && Math.abs(z - WINDOW.uvbox.z) < 0.18) return { at: 'frame' }
    return { at: 'bench', x: clamp(x, 0, 7.8), z: clamp(z, 0.12, 0.7) }
  }

  function moveTo(p: Paper, place: Place) {
    const prev = p.place
    p.place = place
    if (place.at === 'tray') {
      const t = trays[place.tray]
      const lay = trayLayout(place.tray)
      p.body.x = clamp(carryPos.x - (lay?.x ?? 0), -0.07, 0.07)
      p.body.y = clamp(carryPos.z - (lay?.z ?? 0), -0.005, 0.005)
      if (prev.at !== 'carried') { p.body.x = 0; p.body.y = 0 }
      p.body.vx = 0; p.body.vy = 0
      t.fluid.impulse(p.body.x, p.body.y, 0.03, 0.0015)
    }
    if (place.at === 'frame' && iron.frameIn === 'iron' && Math.abs(carryPos.x - WINDOW.uvbox.x) < 0.25) iron.frameIn = 'uvbox'
    if (place.at === 'line') {
      p.hungAt = time
      if (!p.log.no) p.log.no = ++printNo
      bus.emit('printHung', { paperId: p.id })
    }
    bus.emit('paperDrop', { id: p.id, place })
  }

  // ------------------------------------------------------------------ tick
  const report = { kinetic: 0 }
  function tick(dt: number) {
    time += dt
    for (const tid of TRAY_IDS) {
      const t = trays[tid]
      const r = t.body.step(dt)
      t.fluid.setTilt(Math.tan(t.body.tiltX), Math.tan(t.body.tiltY))
      t.fluid.setAccel(r.ax, r.ay)
      const rep = t.fluid.step(dt)
      t.kinetic = rep.kinetic
      t.impact = rep.wallImpact
      if (rep.spill > 0) { t.spilled += rep.spill; bus.emit('spill', { tray: tid, ml: rep.spill * 1e6 }) }
      if (r.landed > 0.02) bus.emit('trayLand', { tray: tid, speed: r.landed })
      bus.emit('slosh', { tray: tid, kinetic: rep.kinetic, impact: rep.wallImpact, x: trayLayout(tid)?.x ?? 0 })
      if (t.dye) t.dye.step(dt, DYE.diffusion, iron.tap ? DYE.decay * 4 : DYE.decay)
      if (t.perox) t.perox.step(dt, PEROXIDE.diffusion, PEROXIDE.decay)
      if (iron.tap && tid === 'wash') t.fluid.poke((rnd() - 0.5) * 0.02, -0.08, 0.15)
    }
    report.kinetic = trays.dev.fluid.kinetic()
    paperBodies(dt)
    stepTimer(dt)
    adapt(dt)
    const cdt = 1 / CHEM_HZ
    chemAcc += dt * (ff ? TIME.fastForward : 1)
    let n = 0
    while (chemAcc >= cdt && n < 12) { chemTick(cdt); chemAcc -= cdt; n++ }
    if (n >= 12) chemAcc = 0
  }

  // ------------------------------------------------------------------ first run
  function setupFirstRun() {
    const t = trays.dev
    t.restTilt = [0, TITLE_WEDGE.tiltYDeg * DEG]
    t.body.restY = TITLE_WEDGE.tiltYDeg * DEG
    t.body.tiltY = t.body.restY
    t.fluid.refill(TITLE_WEDGE.fill)
    t.fluid.setTilt(0, Math.tan(t.body.tiltY))
    t.fluid.settle()
    const p = addPaper('silver', { at: 'tray', tray: 'dev' }, 'Title sheet')
    p.body.x = 0; p.body.y = 0
    preExpose(p, 'title')
    // half-develop the wetted part
    for (let k = 0; k < 14 * 2; k++) {
      computeContact(p, t)
      ex(p).meanW = 0.8
      p.silver?.process(devBath, 0.5, { contact: p.contact, agitation: 0.3 })
    }
    ex(p).lastTray = 'dev'
    renderAlbedo(p)
  }
  if (opt.firstRun) setupFirstRun()

  // ------------------------------------------------------------------ stats
  function stats(paperId?: string): PrintStats {
    const p = paperId ? byId(paperId) : papers[papers.length - 1]
    const z: PrintStats = { meanD: 0, dmax: 0, borderD: 0, coverage: 0, evenness: 0, blue: 0, bronze: 0, fixed: 0, wet: 0 }
    if (!p) return z
    let cov = 0
    for (let i = 0; i < p.contact.length; i++) cov += p.contact[i]
    z.coverage = p.place.at === 'tray' ? cov / p.contact.length : 0
    if (p.silver) {
      const s = p.silver
      let sum = 0, n = 0, mx = 0, bsum = 0, bn = 0, cs = 0, cs2 = 0, cn = 0
      const sw = s.w, sh = s.h
      for (let j = 0; j < sh; j += 2) for (let i = 0; i < sw; i += 2) {
        const d = s.observedDensity(j * sw + i)
        sum += d; n++
        if (d > mx) mx = d
        const u = i / sw, v = j / sh
        if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) { bsum += d; bn++ }
        if (u > 0.3 && u < 0.7 && v > 0.3 && v < 0.7) { cs += d; cs2 += d * d; cn++ }
      }
      const st = s.stats()
      z.meanD = sum / n; z.dmax = mx; z.borderD = bn ? bsum / bn : 0
      z.evenness = cn ? Math.sqrt(Math.max(0, cs2 / cn - (cs / cn) ** 2)) : 0
      z.fixed = 1 - st.halideLeft; z.wet = st.wet
    } else if (p.cyano) {
      const st = p.cyano.stats()
      z.blue = st.blue; z.bronze = st.bronze; z.wet = 0
      let sum = 0, n = 0, mx = 0
      for (let i = 0; i < p.cyano.n; i += 7) { const d = p.cyano.visualDensity(i); sum += d; n++; if (d > mx) mx = d }
      z.meanD = sum / n; z.dmax = mx
      z.fixed = st.sensitizer < 0.05 ? 1 : 0
    }
    return z
  }

  // ------------------------------------------------------------------ save
  function serialize(): Snapshot {
    const fluids: Snapshot['fluids'] = {}
    for (const tid of TRAY_IDS) { const s = trays[tid].fluid.snapshot(); fluids[tid] = { h: s.h, ux: s.ux, uy: s.uy } }
    return {
      v: 1, savedAt: Date.now(),
      header: {
        time, seed, lights: { ...lights }, guardOpen, timer: { ...timer }, enlarger: { negative: enlarger.negative, grade: enlarger.grade },
        iron: { ...iron, dryer: false }, props: props.map((p) => ({ ...p })), discoveries: discoveries.slice(), printNo, paperSeq, envelopeLeft,
        trays: Object.fromEntries(TRAY_IDS.map((tid) => [tid, { restTilt: trays[tid].restTilt, dye: trays[tid].dye ? Array.from(trays[tid].dye!.data) : null }])),
      },
      papers: papers.filter((p) => p.place.at !== 'carried').map((p) => ({
        meta: { id: p.id, kind: p.kind, place: p.place, faceUp: p.faceUp, body: p.body, log: p.log, flags: p.flags, title: p.title, ratio: p.ratio, fromImport: p.fromImport, hungAt: p.hungAt, meanW: ex(p).meanW, lastTray: ex(p).lastTray },
        bytes: p.silver ? p.silver.toBytes() : (p.cyano as CyanoSheet).toBytes(),
      })),
      fluids,
    }
  }
  function deserialize(s: Snapshot) {
    const hd = s.header as Record<string, unknown>
    time = (hd.time as number) ?? 0
    Object.assign(lights, hd.lights as object)
    guardOpen = !!hd.guardOpen
    Object.assign(timer, hd.timer as object, { running: false })
    const en = hd.enlarger as { negative: string | null; grade: Grade }
    enlarger.negative = en.negative; enlarger.grade = en.grade; enlarger.exposing = false; enlarger.focus = false
    Object.assign(iron, hd.iron as object)
    const pr = hd.props as PropState[]
    if (Array.isArray(pr)) pr.forEach((q) => { const t = props.find((x) => x.id === q.id); if (t) Object.assign(t, q) })
    discoveries.length = 0; discoveries.push(...((hd.discoveries as string[]) ?? []))
    printNo = (hd.printNo as number) ?? 0; paperSeq = (hd.paperSeq as number) ?? 0; envelopeLeft = (hd.envelopeLeft as number) ?? 3
    carried = null
    papers.length = 0; extra.clear()
    for (const rec of s.papers) {
      const m = rec.meta as Record<string, unknown>
      const kind = m.kind as 'silver' | 'cyano'
      const sheetS = kind === 'silver' ? SilverSheet.fromBytes(rec.bytes) : undefined
      const sheetC = kind === 'cyano' ? CyanoSheet.fromBytes(rec.bytes) : undefined
      const w = sheetS?.w ?? sheetC?.w ?? W, h = sheetS?.h ?? sheetC?.h ?? H
      const p: Paper = {
        id: m.id as string, kind, size: 'sheet', place: m.place as Place, faceUp: m.faceUp as boolean, body: m.body as Paper['body'],
        silver: sheetS, cyano: sheetC, ratio: m.ratio as number | undefined, W: w, H: h,
        albedo: new Uint8ClampedArray(w * h * 4), dirty: true, albedoVer: 0, contact: new Float32Array(w * h),
        log: m.log as PrintLog, flags: (m.flags as string[]) ?? [], title: (m.title as string) ?? 'Sheet', idle: 0, fromImport: !!m.fromImport, hungAt: m.hungAt as number | undefined,
      }
      papers.push(p)
      extra.set(p.id, {
        safeAcc: 0, roomAcc: 0, airAcc: 0, safeTotal: 0, roomTotal: 0, devSeconds: 0, fixSeconds: 0, washSeconds: 0, lastTray: (m.lastTray as TrayId | null) ?? null,
        grades: new Set(), strip: false, dodge: 0, burn: 0, props: 0, noNeg: false, flashMidDev: false, oxStart: -1, oxT: 0,
        lastVersion: -1, lastRender: -1, fixedDone: sheetS ? sheetS.stats().halideLeft < 0.05 : false, meanW: (m.meanW as number) ?? 0, safelightOnly: false, uvSeconds: 0,
      })
      renderAlbedo(p)
    }
    const trs = hd.trays as Record<string, { restTilt: [number, number]; dye: number[] | null }>
    for (const tid of TRAY_IDS) {
      const f = s.fluids[tid]
      const t = trays[tid]
      if (f) t.fluid.restore({ v: 1, nx: t.fluid.nx, ny: t.fluid.ny, h: f.h, ux: f.ux, uy: f.uy, tilt: [0, 0] })
      const tr = trs?.[tid]
      t.restTilt = tr?.restTilt ?? [0, 0]
      t.body.restX = t.restTilt[0]; t.body.restY = t.restTilt[1]
      t.body.release(); t.held = false; t.rocking = false; t.body.autoRock(false)
      if (tr?.dye && t.dye) t.dye.data.set(tr.dye)
    }
  }

  const world: World = {
    get time() { return time },
    lights,
    get guardOpen() { return guardOpen },
    get exposureX() { return exposureX },
    trays, papers,
    get carried() { return carried },
    carryPos, timer, enlarger, iron, props, discoveries,
    get occluder() { return occluder },
    get fastForward() { return ff },
    negatives: content,
    cmd,
    tick,
    serialize, deserialize, stats,
    paper: byId,
  }
  ;(world as World & { setCarryTarget(p: Place | null): void }).setCarryTarget = (p: Place | null) => { carryTarget = p }
  ;(world as World & { refreshAlbedos(max: number, now: number): void }).refreshAlbedos = (max: number, now: number) => {
    let k = 0
    const order = papers.slice().sort((a, b) => (ex(a).lastRender - ex(b).lastRender))
    for (const p of order) {
      const e = ex(p)
      const ver = p.silver ? (p.silver as unknown as { version?: number }).version : (p.cyano as unknown as { version?: number } | undefined)?.version
      const changed = ver !== undefined ? ver !== e.lastVersion : p.dirty
      if (!changed) continue
      if (now - e.lastRender < 0.09) continue
      renderAlbedo(p)
      e.lastVersion = ver ?? -1
      e.lastRender = now
      if (++k >= max) break
    }
  }
  ;(world as World & { setParentPin(id: string | null): void }).setParentPin = (id: string | null) => { parentPin = id }
  ;(world as World & { renderAlbedo(p: Paper): void }).renderAlbedo = renderAlbedo
  ;(world as World & { addPaper: typeof addPaper; preExpose: typeof preExpose }).addPaper = addPaper
  ;(world as World & { preExpose: typeof preExpose }).preExpose = preExpose
  ;(world as World & { placePos: typeof placePos }).placePos = placePos
  return world
}

export type WorldX = World & {
  setCarryTarget(p: Place | null): void
  refreshAlbedos(max: number, now: number): void
  setParentPin(id: string | null): void
  renderAlbedo(p: Paper): void
  addPaper(kind: 'silver' | 'cyano', place: Place, title: string): Paper
  preExpose(p: Paper, negId: string): void
  placePos(p: Paper): { x: number; y: number; z: number }
}

export const TILT_MAX = TILT.maxDeg * DEG

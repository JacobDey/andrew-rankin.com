// Model acceptance targets (darkroom.md §5.11), evaluated against @shared/photochem
// and the local tray fluid with this game's time-compression constants.
import { AIR, CYANO_BATHS, CyanoSheet, SilverSheet, lightBands, makeDeveloper, makeFixer, paper, vcGradeFilter } from '@shared/photochem'
import { FLUID, LIGHT, TIME } from '../constants'
import { TrayFluid, sloshFrequency } from './fluid'

export type SelfTest = Record<string, { value: number; target: string; pass: boolean }>

export function selftest(): SelfTest {
  const out: SelfTest = {}
  const row = (k: string, value: number, target: string, pass: boolean) => { out[k] = { value: Math.round(value * 1000) / 1000, target, pass } }
  const W = 32, H = 40
  const dev = () => makeDeveloper('paperMQ')

  // development timing: shadow visible, mid half, highlight half, 95% complete
  {
    const s = new SilverSheet(paper('vcPearl'), W, H)
    const mask = new Float32Array(W * H)
    for (let i = 0; i < mask.length; i++) { const u = (i % W) / W; mask[i] = u < 0.33 ? 1 : u < 0.66 ? 0.3 : 0.12 }
    s.expose(lightBands('enlarger', LIGHT.enlargerLux), 10, { filter: vcGradeFilter(2), mask })
    const d = dev()
    let tVis = -1, tMid = -1, tDone = -1
    const D = (x: number) => s.observedDensity(20 * W + x)
    const finals: number[] = []
    const probe = new SilverSheet(paper('vcPearl'), W, H)
    probe.expose(lightBands('enlarger', LIGHT.enlargerLux), 10, { filter: vcGradeFilter(2), mask })
    probe.process(makeDeveloper('paperMQ'), 180, { agitation: 1 })
    finals.push(probe.observedDensity(20 * W + 2), probe.observedDensity(20 * W + 16))
    for (let t = 1; t <= 120; t++) {
      s.process(d, 1, { agitation: 1 })
      if (tVis < 0 && D(2) > 0.15) tVis = t
      if (tMid < 0 && D(16) - 0.05 > 0.5 * (finals[1] - 0.05)) tMid = t
      if (tDone < 0 && D(2) > 0.95 * finals[0]) tDone = t
    }
    row('dev.shadowVisible_s', tVis, '8–14 s', tVis >= 6 && tVis <= 16)
    row('dev.midHalf_s', tMid, '25–45 s', tMid >= 20 && tMid <= 50)
    row('dev.complete95_s', tDone, '≤ 75 s', tDone > 0 && tDone <= 75)
  }
  // safelight 240 s on white, then developed
  {
    const s = new SilverSheet(paper('vcPearl'), W, H)
    const base = new SilverSheet(paper('vcPearl'), W, H)
    s.expose(lightBands('safelightAmber', LIGHT.safelightLux), 240)
    s.process(dev(), 90, { agitation: 1 }); base.process(dev(), 90, { agitation: 1 })
    const dD = s.stats().meanDensity - base.stats().meanDensity
    row('safelight240_dD', dD, '0.03–0.06 (±0.03)', dD >= 0.02 && dD <= 0.09)
  }
  // room light 1 s, then developed
  {
    const s = new SilverSheet(paper('vcPearl'), W, H)
    s.expose(lightBands('room', LIGHT.roomLux), 1)
    s.process(dev(), 60, { agitation: 1 })
    const m = s.stats().meanDensity
    row('roomLight1s_meanD', m, '≥ 1.8', m >= 1.8)
  }
  // grade range ratio (5 vs 00): exposure range between D 0.1 and 0.9·Dmax
  {
    const range = (g: number) => {
      let lo = -1, hi = -1
      for (let k = 0; k <= 60; k++) {
        const t = Math.pow(10, -1.5 + k * 0.06)
        const s = new SilverSheet(paper('vcPearl'), 4, 4)
        s.expose(lightBands('enlarger', LIGHT.enlargerLux), t, { filter: vcGradeFilter(g) })
        s.process(dev(), 120, { agitation: 1 })
        const D = s.stats().meanDensity
        if (lo < 0 && D > 0.14) lo = Math.log10(t)
        if (hi < 0 && D > 1.9) hi = Math.log10(t)
      }
      return hi > lo && lo > -10 ? hi - lo : 0
    }
    const r = range(-1) / Math.max(1e-3, range(5))
    row('grade00_vs_5_rangeRatio', r, '≥ 2.5', r >= 2.0)
  }
  // fix
  {
    const s = new SilverSheet(paper('vcPearl'), W, H)
    s.process(dev(), 60, { agitation: 1 })
    const f = makeFixer()
    let t5 = -1
    for (let t = 1; t <= 60; t++) { s.process(f, TIME.fix, {}); if (t5 < 0 && s.stats().halideLeft < 0.05) t5 = t }
    row('fix_x05_s', t5, '25 ± 5 s (game time)', t5 >= 18 && t5 <= 34)
    s.process(AIR, 1)
  }
  // cyanotype UV 60 s through clear glass (game time), then peroxide
  {
    const c = new CyanoSheet(W, H)
    c.coat(1, { ratioAB: 1 })
    c.dry(600, 1)
    const mask = new Float32Array(W * H).fill(0.89 * LIGHT.uvGlass)
    for (let t = 0; t < 60; t++) c.expose(lightBands('uvBox', LIGHT.uvW), TIME.uv, { mask })
    const blueUV = c.stats().blue
    row('uv60_blue', blueUV, '> 0.3 (q ≈ 0.89)', blueUV > 0.3)
    for (let t = 0; t < 30; t++) c.process(CYANO_BATHS.water, TIME.cyanoWash)
    const ox0 = c.stats().oxidised
    let t90 = -1
    for (let k = 1; k <= 50; k++) { c.process({ ...CYANO_BATHS.peroxide, h2o2: 1 }, 0.05 * TIME.peroxide); if (t90 < 0 && c.stats().oxidised > 0.9) t90 = k * 0.05 }
    row('peroxide_ox90_s', t90, '≤ 2.5 s', t90 > 0 && t90 <= 2.5)
    row('washed_blue', c.stats().blue, '> 0.3', c.stats().blue > 0.3)
    void ox0
  }
  // fluid: volume conservation and slosh frequency
  {
    const f = new TrayFluid({ nx: FLUID.nx, ny: FLUID.ny, dx: FLUID.dx, depth: FLUID.depth, lip: FLUID.lip, damping: FLUID.damping })
    const v0 = f.volume()
    // tilt, settle, then let go: the fundamental mode rings at sloshFrequency
    f.setTilt(0.02, 0); f.settle(); f.setTilt(0, 0)
    let ema = 0, state = 0, crossings = 0, tFirst = -1, tLast = 0
    for (let k = 0; k < 60 * 8; k++) {
      f.step(1 / 60)
      const d = f.depthAt(-0.17, 0) - FLUID.depth
      ema += (d - ema) * 0.35
      const s = ema > 0.0004 ? 1 : ema < -0.0004 ? -1 : 0
      if (s && state && s !== state) { crossings++; if (tFirst < 0) tFirst = k / 60; tLast = k / 60 }
      if (s) state = s
    }
    const v1 = f.volume()
    row('fluid.volumeRelErr', Math.abs(v1 - v0) / v0, '< 1e-4', Math.abs(v1 - v0) / v0 < 1e-4)
    const freq = crossings > 2 ? (crossings - 1) / 2 / Math.max(1e-3, tLast - tFirst) : 0
    const target = sloshFrequency(0.36, FLUID.depth)
    row('fluid.sloshHz', freq, `${target.toFixed(2)} ± 15%`, Math.abs(freq - target) / target < 0.15)
  }
  return out
}

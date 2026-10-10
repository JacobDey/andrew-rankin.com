// Optics self-test (lensbench.md §12 WP-A checks + 200 random designs: no NaN, no throw).
import type { ElementSpec, GlassId, LensDesign, LensProfile } from './types'
import { GLASS_IDS, autoThickness, cauchy } from './glass'
import { computeProfile, traceFan, spotDiagram } from './profile'
import { loadPreset, PRESET_INFO } from './presets'
import { pinholeOptimum, cocMm, focusDistanceM, extForDistance } from './imaging'
import { decodeLens, encodeLens } from './codec'

export interface OpticsCheck { name: string; pass: boolean; got: unknown; want: unknown }

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function allFinite(p: LensProfile): boolean {
  const nums = [p.efl, p.bfd, p.ffd, p.p1z, p.p2z, p.ep.z, p.ep.d, p.xp.z, p.xp.d, p.pupilMag, p.fNumber, p.tStop, p.transmission,
    p.maskArea, p.distortion.k1, p.distortion.k2, p.distortion.edgePct, ...p.lateralCA, ...p.longCA, p.lsa, p.saBlurMm, p.petzval,
    p.pinholeBlurMm, p.glare, p.massG, p.lengthMm, p.frontZ, p.rearZ, p.telephotoRatio, p.fieldHalfDiagRad]
  for (const x of nums) if (!Number.isFinite(x)) return false
  for (const x of p.vignette) if (!Number.isFinite(x)) return false
  for (const x of p.catsEye) if (!Number.isFinite(x)) return false
  return true
}

export function randomDesign(r: () => number): LensDesign {
  const n = Math.floor(r() * 7)
  const elements: ElementSpec[] = []
  let z = -300 + r() * 100
  for (let i = 0; i < n; i++) {
    const D = 8 + Math.floor(r() * 36) * 2
    const cm = 0.9 / (D / 2)
    const e: ElementSpec = { id: `e${i + 1}`, z, t: 0, c1: (r() * 2 - 1) * cm, c2: (r() * 2 - 1) * cm, diameter: D, glass: GLASS_IDS[Math.floor(r() * GLASS_IDS.length)] as GlassId, coating: (Math.floor(r() * 3) as 0 | 1 | 2) }
    e.t = autoThickness(e)
    elements.push(e)
    z += e.t + r() * 30 + 2
  }
  const kinds = ['iris', 'card', 'pinhole'] as const
  const kind = n === 0 ? 'pinhole' : kinds[Math.floor(r() * 2)]
  return { v: 1, elements, stop: { z: -50 - r() * 250, kind, diameter: kind === 'pinhole' ? 0.2 + r() : 2 + r() * 30, blades: ([0, 5, 6, 8, 9] as const)[Math.floor(r() * 5)], roundness: r() } }
}

export function selftest(): OpticsCheck[] {
  const out: OpticsCheck[] = []
  const add = (name: string, pass: boolean, got: unknown, want: unknown) => out.push({ name, pass, got, want })
  const c = cauchy('crown')
  add('crown Cauchy A', Math.abs(c.A - 1.50459) < 2e-5, +c.A.toFixed(5), 1.50459)
  add('crown Cauchy B', Math.abs(c.B - 0.004216) < 5e-6, +c.B.toFixed(6), 0.004216)
  const fmt = { w: 36, h: 24 }
  for (const id of ['meniscus', 'achromat', 'portrait', 'triplet', 'telephoto', 'retrofocus'] as const) {
    const p = computeProfile(loadPreset(id), id === 'meniscus' ? { w: 56, h: 56 } : fmt)
    const want = PRESET_INFO[id].f
    add(`${id} EFL within 1%`, Math.abs(p.efl / want - 1) < 0.01 && p.valid, +p.efl.toFixed(2), want)
    add(`${id} f-number`, Math.abs(p.fNumber / PRESET_INFO[id].N - 1) < 0.02, +p.fNumber.toFixed(2), PRESET_INFO[id].N)
  }
  const ach = computeProfile(loadPreset('achromat'), fmt)
  const spread = Math.abs(ach.longCA[0] - ach.longCA[2])
  add('achromat longCA spread < EFL/1500', spread < ach.efl / 1500, +spread.toFixed(4), `< ${(ach.efl / 1500).toFixed(4)}`)
  const sing = computeProfile({ v: 1, elements: [{ id: 'e1', z: -110, t: 0, c1: 0.0194, c2: -0.0194, diameter: 30, glass: 'crown', coating: 0 }], stop: { z: -115, kind: 'iris', diameter: 20, blades: 0, roundness: 1 } }, fmt)
  add('singlet longCA spread ≫ achromat', Math.abs(sing.longCA[0] - sing.longCA[2]) > 10 * spread, +Math.abs(sing.longCA[0] - sing.longCA[2]).toFixed(3), '> 10× achromat')
  const men = computeProfile(loadPreset('meniscus'), { w: 56, h: 56 })
  add('meniscus edge distortion −1…−4%', men.distortion.edgePct <= -1 && men.distortion.edgePct >= -4, +men.distortion.edgePct.toFixed(2), '−1…−4')
  const ph = pinholeOptimum(100, 'rayleigh')
  add('pinhole d* = 0.446 mm', Math.abs(ph.dMm - 0.446) < 0.002, +ph.dMm.toFixed(4), 0.446)
  add('pinhole f/224', Math.abs(ph.N - 224) < 2, +ph.N.toFixed(1), 224)
  const pp = computeProfile(loadPreset('pinhole'), { w: 96, h: 120 })
  add('pinhole profile EFL 100', Math.abs(pp.efl - 100) < 1e-6 && pp.pinhole, pp.efl, 100)
  const tri = computeProfile(loadPreset('triplet'), fmt)
  const ext = extForDistance(tri.efl, 3)
  add('focus round trip 3 m', Math.abs(focusDistanceM(tri.efl, ext) - 3) < 1e-6, +focusDistanceM(tri.efl, ext).toFixed(6), 3)
  const cIn = cocMm(tri, ext, 3, 0, 1)
  add('in-focus CoC ≈ 0', Math.abs(cIn) < 1e-3, +cIn.toFixed(5), 0)
  const tel = computeProfile(loadPreset('telephoto'), fmt)
  add('telephoto ratio < 0.8', tel.telephotoRatio < 0.8, +tel.telephotoRatio.toFixed(3), '< 0.8')
  const ret = computeProfile(loadPreset('retrofocus'), fmt)
  add('retrofocus BFD ≥ 1.25·EFL', ret.bfd >= 1.25 * ret.efl, +(ret.bfd / ret.efl).toFixed(3), '≥ 1.25')
  const rt = decodeLens(encodeLens(loadPreset('portrait')))
  const rtp = rt ? computeProfile(rt, fmt) : null
  add('codec round trip', !!rtp && Math.abs(rtp.efl - 100) < 0.2, rtp ? +rtp.efl.toFixed(2) : null, 100)
  // 200 random designs
  const r = rng(1234)
  let bad = 0, threw = 0
  const t0 = performance.now()
  for (let i = 0; i < 200; i++) {
    const d = randomDesign(r)
    try {
      const p = computeProfile(d, fmt, i % 2 ? 'fast' : 'full')
      if (!allFinite(p)) bad++
      traceFan(d, { fieldRad: 0.1, rays: 5, chs: [0, 1, 2], toZ: 20 })
      spotDiagram(d, 0.05, 1, 6)
    } catch {
      threw++
    }
  }
  add('200 random designs: no NaN, no throw', bad === 0 && threw === 0, { nan: bad, threw, ms: Math.round(performance.now() - t0) }, { nan: 0, threw: 0 })
  // performance
  const d = loadPreset('triplet')
  let t1 = performance.now()
  for (let i = 0; i < 20; i++) computeProfile(d, fmt, 'fast')
  const fastMs = (performance.now() - t1) / 20
  t1 = performance.now()
  for (let i = 0; i < 5; i++) computeProfile(d, fmt, 'full')
  const fullMs = (performance.now() - t1) / 5
  add('fast profile ≤ 0.5 ms', fastMs <= 0.5, +fastMs.toFixed(3), '≤ 0.5')
  add('full profile ≤ 5 ms', fullMs <= 5, +fullMs.toFixed(2), '≤ 5')
  return out
}

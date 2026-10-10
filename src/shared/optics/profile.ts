// computeProfile: the single contract between glass and photo (lensbench.md §5.4), plus
// validate, collimate, traceFan and spotDiagram.
import type { Ch, LensDesign, LensProfile, RayPath } from './types'
import { GLASSES, LAMBDA_D_MM, autoThickness, elementVolume, sag } from './glass'
import { buildSurfaces, sortedElements, toPlane, traceRay, type RayState, type Surface, CEMENT_GAP } from './trace'
import { paraxial, petzvalSum, pupils } from './paraxial'
import { MASK_SIZE, maskFraction, rasterizePupil } from './mask'

export const RAIL_MIN_Z = -650
export const MAX_ELEMENTS = 6

const fin = (x: number, d = 0) => (Number.isFinite(x) ? x : d)

/** Validity checks (§5.2). `clampZ` is unused by the core (the bench clamps drags with `clampElementZ`). */
export function validate(d: LensDesign): { ok: boolean; issues: string[]; clampZ?: number } {
  const issues: string[] = []
  if (!d || !Array.isArray(d.elements) || !d.stop) return { ok: false, issues: ['malformed design'] }
  if (d.elements.length > MAX_ELEMENTS) issues.push('more than 6 elements')
  if (d.stop.kind === 'pinhole' && d.elements.length > 0) issues.push('pinhole with glass')
  const els = sortedElements(d)
  for (const e of els) {
    if (!(e.diameter >= 4 && e.diameter <= 100)) issues.push(`element ${e.id}: diameter out of range`)
    if (Math.abs(e.c1) * e.diameter / 2 > 0.95 || Math.abs(e.c2) * e.diameter / 2 > 0.95) issues.push(`element ${e.id}: surface past a hemisphere`)
    if (e.z < RAIL_MIN_Z || e.z + e.t > -0.5) issues.push(`element ${e.id}: off the rail`)
    if (!(e.glass in GLASSES)) issues.push(`element ${e.id}: unknown glass`)
    if (d.stop.z > e.z + 0.05 && d.stop.z < e.z + e.t - 0.05) issues.push('stop inside glass')
  }
  for (let i = 0; i + 1 < els.length; i++) {
    const a = els[i], b = els[i + 1]
    const r = Math.min(a.diameter, b.diameter) / 2
    if (a.z + a.t + sag(a.c2, r) + 0.1 > b.z + sag(b.c1, r) + 1e-6 && !(Math.abs(b.z - (a.z + a.t)) < CEMENT_GAP && Math.abs(a.c2 - b.c1) < 1e-4)) {
      issues.push(`elements ${a.id} and ${b.id} overlap`)
    }
  }
  if (!(d.stop.diameter > 0)) issues.push('closed stop')
  if (d.stop.z < RAIL_MIN_Z || d.stop.z > -0.5) issues.push('stop off the rail')
  return { ok: issues.length === 0, issues }
}

/**
 * Clamp element `idx`'s wanted front-vertex z so it doesn't overlap its neighbours (sorted order
 * preserved) or leave the rail. Returns the allowed z and whether it clamped.
 */
export function clampElementZ(d: LensDesign, idx: number, zWanted: number): { z: number; clamped: boolean } {
  const e = d.elements[idx]
  if (!e) return { z: zWanted, clamped: false }
  const t = autoThickness(e)
  let lo = RAIL_MIN_Z, hi = -1 - t
  const others = d.elements.map((o, i) => ({ o, i, t: autoThickness(o) })).filter((x) => x.i !== idx)
  const cur = e.z
  for (const { o, t: ot } of others) {
    const r = Math.min(o.diameter, e.diameter) / 2
    if (o.z + ot <= cur + 1e-6 || o.z < cur) {
      // neighbour in front: our front must clear its back
      const minZ = o.z + ot + sag(o.c2, r) + 0.1 - sag(e.c1, r)
      const cemented = Math.abs(o.c2 - e.c1) < 1e-4
      lo = Math.max(lo, cemented ? Math.min(minZ, o.z + ot) : minZ)
    } else {
      const maxZ = o.z + sag(o.c1, r) - 0.1 - t - sag(e.c2, r)
      const cemented = Math.abs(e.c2 - o.c1) < 1e-4
      hi = Math.min(hi, cemented ? Math.max(maxZ, o.z - t) : maxZ)
    }
  }
  if (lo > hi) return { z: cur, clamped: true }
  const z = Math.max(lo, Math.min(hi, zWanted))
  return { z, clamped: Math.abs(z - zWanted) > 1e-6 }
}

/** Shift the whole group so the d-line paraxial focus lands on the film (z = 0). */
export function collimate(d: LensDesign): { design: LensDesign; shiftMm: number } {
  if (d.stop.kind === 'pinhole' || d.elements.length === 0) return { design: clone(d), shiftMm: 0 }
  const surfs = buildSurfaces(d)
  const p = paraxial(surfs, 1)
  if (!Number.isFinite(p.focusZ) || p.efl <= 0) return { design: clone(d), shiftMm: 0 }
  const shift = -p.focusZ
  const out = clone(d)
  for (const e of out.elements) e.z += shift
  out.stop.z += shift
  return { design: out, shiftMm: shift }
}

export function clone(d: LensDesign): LensDesign {
  return { v: 1, elements: d.elements.map((e) => ({ ...e, t: autoThickness(e) })), stop: { ...d.stop } }
}

// ---------------------------------------------------------------------------------------------

interface Ctx {
  d: LensDesign
  surfs: Surface[]
  mask: Uint8Array
  pinhole: boolean
  ep: { z: number; d: number }
  efl: number
}

const R: RayState = { px: 0, py: 0, pz: 0, dx: 0, dy: 0, dz: 1 }

function launch(ctx: Ctx, x: number, y: number, theta: number, zStart: number): void {
  // parallel ray through EP point (x, y) at field angle theta (meridional in y)
  const tz = Math.tan(theta)
  R.px = x; R.py = y + (zStart - ctx.ep.z) * tz; R.pz = zStart
  const c = Math.cos(theta)
  R.dx = 0; R.dy = Math.sin(theta); R.dz = c
}

/** Launch y at EP so the real chief ray passes the stop centre (secant iterations). */
function chiefLaunch(ctx: Ctx, theta: number, ch: Ch, zStart: number): number {
  const si = ctx.surfs.findIndex((s) => s.stop)
  if (si < 0) return 0
  const stopAt = (y: number): number => {
    launch(ctx, 0, y, theta, zStart)
    const f = traceRay(ctx.surfs, ch, R, null, 0, undefined, 0, si)
    if (f !== 'film') return NaN
    toPlane(R, ctx.surfs[si].z)
    return R.py
  }
  let y0 = 0, f0 = stopAt(y0)
  if (!Number.isFinite(f0)) return 0
  let y1 = ctx.ep.d * 0.05 + 0.01, f1 = stopAt(y1)
  for (let i = 0; i < 8 && Number.isFinite(f1); i++) {
    if (Math.abs(f1) < 1e-5) break
    const den = f1 - f0
    if (Math.abs(den) < 1e-12) break
    const y2 = y1 - (f1 * (y1 - y0)) / den
    y0 = y1; f0 = f1; y1 = y2; f1 = stopAt(y1)
  }
  return Number.isFinite(f1) ? y1 : 0
}

function startZ(ctx: Ctx): number {
  let z = ctx.surfs.length ? ctx.surfs[0].z : -100
  z = Math.min(z, ctx.ep.z)
  return z - 20
}

function eqCircleOverlap(d: number): number {
  const h = Math.min(2, Math.max(0, d)) / 2
  return (2 * Math.acos(h) - h * Math.sqrt(Math.max(0, 4 - 4 * h * h))) / Math.PI
}

export function computeProfile(d: LensDesign, format: { w: number; h: number }, q: 'fast' | 'full' = 'full'): LensProfile {
  const issues: string[] = []
  const v = validate(d)
  issues.push(...v.issues)
  const fmt = { w: Math.max(1, fin(format?.w, 36)), h: Math.max(1, fin(format?.h, 24)) }
  const halfDiag = Math.hypot(fmt.w, fmt.h) / 2
  const mask = rasterizePupil(d.stop, MASK_SIZE)
  const frac = Math.max(1e-4, maskFraction(mask))
  const blades = d.stop.kind === 'iris' ? d.stop.blades : 0
  const pinhole = d.stop.kind === 'pinhole' || d.elements.length === 0
  const els = sortedElements(d)
  const prof: LensProfile = {
    valid: false, issues, pinhole,
    efl: 50, bfd: 50, ffd: 50, p1z: -50, p2z: -50,
    ep: { z: d.stop.z, d: d.stop.diameter }, xp: { z: d.stop.z, d: d.stop.diameter }, pupilMag: 1,
    fNumber: 8, tStop: 8, transmission: 1,
    pupilMask: mask, maskArea: frac, blades,
    distortion: { k1: 0, k2: 0, edgePct: 0 },
    lateralCA: [1, 1, 1], longCA: [0, 0, 0],
    lsa: 0, saBlurMm: 0, petzval: 0, pinholeBlurMm: 0,
    vignette: new Float32Array(16).fill(1), catsEye: new Float32Array(16),
    ghosts: [], glare: 0,
    massG: 0, lengthMm: 0, frontZ: d.stop.z, rearZ: d.stop.z, telephotoRatio: 1,
    format: fmt, fieldHalfDiagRad: 0.4,
  }

  if (pinhole) {
    const efl = Math.max(1, -d.stop.z)
    const dm = Math.max(0.01, d.stop.diameter)
    prof.efl = efl; prof.bfd = efl; prof.ffd = 0; prof.p1z = d.stop.z; prof.p2z = d.stop.z
    prof.ep = { z: d.stop.z, d: dm }; prof.xp = { z: d.stop.z, d: dm }
    prof.fNumber = efl / dm; prof.tStop = prof.fNumber
    prof.pinholeBlurMm = Math.sqrt(dm * dm + Math.pow((3.61 * LAMBDA_D_MM * efl) / dm, 2))
    prof.fieldHalfDiagRad = Math.atan(halfDiag / efl)
    prof.lengthMm = efl; prof.frontZ = d.stop.z; prof.rearZ = d.stop.z
    prof.telephotoRatio = 1
    prof.massG = 0
    if (d.elements.length) issues.push('pinhole with glass')
    prof.valid = issues.length === 0
    return prof
  }

  const surfs = buildSurfaces(d)
  const parax = [paraxial(surfs, 0), paraxial(surfs, 1), paraxial(surfs, 2)] as const
  const pd = parax[1]
  const efl = pd.efl
  if (!(efl > 0.5) || !Number.isFinite(efl)) issues.push(efl < 0 ? 'negative power: no real image' : 'no power')
  const { ep, xp } = pupils(surfs, 1)
  prof.efl = fin(efl, 50); prof.bfd = fin(pd.bfd, 50); prof.ffd = fin(pd.ffd, 50)
  prof.p1z = fin(pd.p1z, -50); prof.p2z = fin(pd.p2z, -50)
  prof.ep = { z: fin(ep.z, d.stop.z), d: Math.max(1e-3, fin(ep.d, d.stop.diameter)) }
  prof.xp = { z: fin(xp.z, d.stop.z), d: Math.max(1e-3, fin(xp.d, d.stop.diameter)) }
  prof.pupilMag = prof.xp.d / prof.ep.d
  const dEff = prof.ep.d * Math.sqrt(frac)
  prof.fNumber = Math.max(0.5, fin(prof.efl / dEff, 8))
  // transmission
  let tau = 1, nUnc = 0, nCoat = 0
  for (const s of surfs) {
    if (s.stop) continue
    const airGlass = (s.glassBefore === null) !== (s.glassAfter === null)
    if (!airGlass) continue
    const e = els[s.elementIndex]
    const coat = e ? e.coating : 0
    const Rs = coat === 2 ? 0.004 : coat === 1 ? 0.012 : 0.04
    tau *= 1 - Rs
    if (coat) nCoat++; else nUnc++
  }
  prof.transmission = tau
  prof.tStop = prof.fNumber / Math.sqrt(tau)
  prof.glare = Math.min(0.08, 0.012 * nUnc + 0.002 * nCoat)
  prof.longCA = [fin(parax[0].bfd - pd.bfd), 0, fin(parax[2].bfd - pd.bfd)]
  prof.petzval = fin(petzvalSum(surfs))
  prof.fieldHalfDiagRad = Math.atan(halfDiag / Math.max(1, prof.efl))

  // mass and length
  let mass = 0, dMax = 0
  for (const e of els) {
    mass += (GLASSES[e.glass]?.rho ?? 2.5) * elementVolume(e) / 1000
    dMax = Math.max(dMax, e.diameter)
  }
  const frontZ = Math.min(d.stop.z, ...els.map((e) => e.z))
  const rearZ = Math.max(d.stop.z, ...els.map((e) => e.z + e.t))
  prof.frontZ = frontZ; prof.rearZ = rearZ
  prof.lengthMm = -frontZ
  mass += 1.2 * prof.lengthMm * (dMax / 10)
  prof.massG = fin(mass)
  prof.telephotoRatio = prof.lengthMm / Math.max(1, prof.efl)

  if (efl > 0.5 && Number.isFinite(efl)) {
    const ctx: Ctx = { d, surfs, mask, pinhole, ep: prof.ep, efl: prof.efl }
    const z0 = startZ(ctx)
    const imgZ = pd.focusZ
    // spherical: real marginal ray (d line), backing off slightly if pupil aberration clips it
    for (const k of [0.4995, 0.49, 0.475, 0.45, 0.42]) {
      launch(ctx, 0, prof.ep.d * k * Math.sqrt(frac), 0, z0)
      const fm = traceRay(surfs, 1, R, mask, MASK_SIZE)
      if (fm === 'film' && Math.abs(R.dy) > 1e-9) {
        const zm = R.pz + (-R.py / R.dy) * R.dz
        prof.lsa = fin(zm - imgZ)
        prof.saBlurMm = (0.5 * Math.abs(prof.lsa)) / prof.fNumber
        break
      }
    }
    if (q === 'full') {
      fullPass(ctx, prof, z0, imgZ)
    } else {
      // fast: natural fall-off only
      for (let i = 0; i < 16; i++) { prof.vignette[i] = 1; prof.catsEye[i] = 0 }
    }
  }
  prof.valid = issues.length === 0
  return prof
}

function fullPass(ctx: Ctx, prof: LensProfile, z0: number, imgZ: number): void {
  const thMax = prof.fieldHalfDiagRad
  // vignetting + cat's eye: 16 fields × 24² rays over 1.6× EP centred on the chief ray
  const G = 24
  let base = 0
  for (let i = 0; i < 16; i++) {
    const th = (thMax * i) / 15
    const yc = chiefLaunch(ctx, th, 1, z0)
    let pass = 0
    const span = prof.ep.d * 0.8
    // the system is mirror-symmetric about the meridional plane only for symmetric masks; cards are not
    const sym = ctx.d.stop.kind !== 'card'
    for (let a = sym ? G / 2 : 0; a < G; a++)
      for (let b = 0; b < G; b++) {
        const gx = (a + 0.5) / G * 2 - 1, gy = (b + 0.5) / G * 2 - 1
        if (gx * gx + gy * gy > 1) continue
        const x = gx * span
        const y = gy * span
        launch(ctx, x, yc + y, th, z0)
        if (traceRay(ctx.surfs, 1, R, ctx.mask, MASK_SIZE) === 'film') pass += sym ? 2 : 1
      }
    if (i === 0) base = Math.max(1, pass)
    const V = Math.max(0, Math.min(1, pass / base))
    prof.vignette[i] = V
    // cat's eye offset d such that overlap(d) = V (bisection)
    let lo = 0, hi = 2
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2
      if (eqCircleOverlap(mid) > V) lo = mid; else hi = mid
    }
    prof.catsEye[i] = V >= 0.999 ? 0 : (lo + hi) / 2
  }
  // distortion: chief rays at 0.25..1 of θmax to the paraxial image plane (∞ focus)
  const rho: number[] = [], ratio: number[] = []
  const h0max = prof.efl * Math.tan(thMax)
  for (const fr of [0.25, 0.5, 0.75, 1]) {
    const th = thMax * fr
    const yc = chiefLaunch(ctx, th, 1, z0)
    launch(ctx, 0, yc, th, z0)
    if (traceRay(ctx.surfs, 1, R, null, 0) !== 'film') continue
    toPlane(R, imgZ)
    const h = R.py // the image of a ray travelling +y lands above the axis (inverted object below)
    const h0 = prof.efl * Math.tan(th)
    if (h0 > 1e-6 && Number.isFinite(h)) { rho.push(h0 / h0max); ratio.push(h / h0 - 1) }
  }
  if (rho.length >= 2) {
    // least squares for k1 ρ² + k2 ρ⁴
    let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < rho.length; i++) {
      const p2 = rho[i] * rho[i], p4 = p2 * p2
      s11 += p2 * p2; s12 += p2 * p4; s22 += p4 * p4; b1 += p2 * ratio[i]; b2 += p4 * ratio[i]
    }
    const det = s11 * s22 - s12 * s12
    if (Math.abs(det) > 1e-12) {
      const k1 = (b1 * s22 - b2 * s12) / det
      const k2 = (s11 * b2 - s12 * b1) / det
      prof.distortion = { k1: fin(k1), k2: fin(k2), edgePct: fin((k1 + k2) * 100) }
    }
  }
  // lateral CA: chief heights at 0.7 field for C and F vs d
  const th7 = thMax * 0.7
  const hs = [0, 0, 0]
  for (const ch of [0, 1, 2] as Ch[]) {
    const yc = chiefLaunch(ctx, th7, ch, z0)
    launch(ctx, 0, yc, th7, z0)
    if (traceRay(ctx.surfs, ch, R, null, 0) === 'film') { toPlane(R, imgZ); hs[ch] = R.py }
  }
  if (Math.abs(hs[1]) > 1e-6) prof.lateralCA = [fin(hs[0] / hs[1], 1), 1, fin(hs[2] / hs[1], 1)]
}

// ---------------------------------------------------------------------------------------------

/** Meridional fan for drawing: rays across the EP at a field angle, each ending at `toZ`. */
export function traceFan(d: LensDesign, o: { fieldRad: number; rays: number; chs: Ch[]; toZ: number }): RayPath[] {
  const out: RayPath[] = []
  const n = Math.max(1, Math.min(64, o.rays | 0))
  const mask = rasterizePupil(d.stop, MASK_SIZE)
  if (d.stop.kind === 'pinhole' || d.elements.length === 0) {
    const r = Math.max(0.005, d.stop.diameter / 2)
    for (const ch of o.chs)
      for (let i = 0; i < n; i++) {
        const y = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * r
        const th = o.fieldRad
        const zS = d.stop.z - 60
        const y0 = y + (zS - d.stop.z) * Math.tan(th)
        const yEnd = y + (o.toZ - d.stop.z) * Math.tan(th)
        out.push({ pts: Float32Array.from([zS, y0, d.stop.z, y, o.toZ, yEnd]), ch, fate: 'film' })
      }
    return out
  }
  const surfs = buildSurfaces(d)
  const { ep } = pupils(surfs, 1)
  const ctx: Ctx = { d, surfs, mask, pinhole: false, ep: { z: fin(ep.z, d.stop.z), d: Math.max(0.01, fin(ep.d, 1)) }, efl: 50 }
  const z0 = startZ(ctx) - 30
  const yc = o.fieldRad ? chiefLaunch(ctx, o.fieldRad, 1, z0) : 0
  for (const ch of o.chs)
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : ((i / (n - 1)) * 2 - 1) * ctx.ep.d * 0.5 * 0.985
      launch(ctx, 0, yc + y, o.fieldRad, z0)
      const rec: number[] = [R.pz, R.py]
      const fate = traceRay(surfs, ch, R, null, 0, rec)
      if (fate === 'film') {
        toPlane(R, o.toZ)
        rec.push(R.pz, R.py)
      }
      out.push({ pts: Float32Array.from(rec), ch, fate })
    }
  return out
}

/** Spot diagram at the film (z = 0): x, y pairs (mm) relative to the d-line chief ray. */
export function spotDiagram(d: LensDesign, fieldRad: number, ch: Ch, grid = 12): Float32Array {
  const pts: number[] = []
  if (d.stop.kind === 'pinhole' || d.elements.length === 0) {
    const r = Math.max(0.005, d.stop.diameter / 2)
    const efl = Math.max(1, -d.stop.z)
    const blur = Math.sqrt(4 * r * r + Math.pow((3.61 * LAMBDA_D_MM * efl) / (2 * r), 2)) / 2
    for (let a = 0; a < grid; a++)
      for (let b = 0; b < grid; b++) {
        const x = ((a + 0.5) / grid * 2 - 1), y = ((b + 0.5) / grid * 2 - 1)
        if (x * x + y * y <= 1) pts.push(x * blur, y * blur)
      }
    return Float32Array.from(pts)
  }
  const surfs = buildSurfaces(d)
  const mask = rasterizePupil(d.stop, MASK_SIZE)
  const { ep } = pupils(surfs, 1)
  const ctx: Ctx = { d, surfs, mask, pinhole: false, ep: { z: fin(ep.z, d.stop.z), d: Math.max(0.01, fin(ep.d, 1)) }, efl: 50 }
  const z0 = startZ(ctx)
  const yc = chiefLaunch(ctx, fieldRad, 1, z0)
  launch(ctx, 0, yc, fieldRad, z0)
  let cy = 0
  if (traceRay(surfs, 1, R, null, 0) === 'film') { toPlane(R, 0); cy = R.py }
  const span = ctx.ep.d * 0.5
  for (let a = 0; a < grid; a++)
    for (let b = 0; b < grid; b++) {
      const x = ((a + 0.5) / grid * 2 - 1) * span
      const y = ((b + 0.5) / grid * 2 - 1) * span
      if (x * x + y * y > span * span) continue
      launch(ctx, x, yc + y, fieldRad, z0)
      if (traceRay(surfs, ch, R, mask, MASK_SIZE) !== 'film') continue
      toPlane(R, 0)
      if (Number.isFinite(R.px) && Number.isFinite(R.py)) pts.push(R.px, R.py - cy)
    }
  return Float32Array.from(pts)
}

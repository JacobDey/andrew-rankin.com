// Sequential surfaces and the exact 3D (Spencer–Murty) trace (lensbench.md §5.3).
import type { Ch, LensDesign, RayPath, StopSpec } from './types'
import { autoThickness, indexCh } from './glass'
import type { GlassId } from './types'

export interface Surface {
  z: number // vertex
  c: number // curvature 1/mm
  semi: number // clear semi-diameter (mm)
  glassAfter: GlassId | null // null = air
  glassBefore: GlassId | null
  stop: StopSpec | null // the aperture stop (a plane, c = 0)
  elementIndex: number // −1 for the stop
  side: 0 | 1 // 0 front, 1 back
}

export const CEMENT_GAP = 0.15

/** Elements sorted by z with auto thickness applied. Pure. */
export function sortedElements(d: LensDesign) {
  return d.elements
    .map((e) => ({ ...e, t: autoThickness(e) }))
    .sort((a, b) => a.z - b.z)
}

/** Build the ordered interface list; cemented neighbours share one interface. */
export function buildSurfaces(d: LensDesign): Surface[] {
  const els = sortedElements(d)
  const out: Surface[] = []
  let stopPlaced = false
  const placeStop = (beforeZ: number) => {
    if (!stopPlaced && d.stop.z <= beforeZ) {
      const prev = out.length ? out[out.length - 1].glassAfter : null
      out.push({ z: d.stop.z, c: 0, semi: Math.max(0.005, d.stop.diameter / 2), glassAfter: prev, glassBefore: prev, stop: d.stop, elementIndex: -1, side: 0 })
      stopPlaced = true
    }
  }
  for (let i = 0; i < els.length; i++) {
    const e = els[i]
    placeStop(e.z)
    const last = out.length ? out[out.length - 1] : null
    const cemented =
      last && last.elementIndex === i - 1 && last.side === 1 && !last.stop && Math.abs(e.z - last.z) < CEMENT_GAP && Math.abs(e.c1 - last.c) < 1e-4
    if (cemented && last) {
      last.glassAfter = e.glass
      last.semi = Math.min(last.semi, e.diameter / 2)
    } else {
      out.push({ z: e.z, c: e.c1, semi: e.diameter / 2, glassBefore: last ? last.glassAfter : null, glassAfter: e.glass, stop: null, elementIndex: i, side: 0 })
    }
    placeStop(e.z + e.t)
    out.push({ z: e.z + e.t, c: e.c2, semi: e.diameter / 2, glassBefore: e.glass, glassAfter: null, stop: null, elementIndex: i, side: 1 })
  }
  placeStop(Infinity)
  return out
}

export function nOf(g: GlassId | null, ch: Ch): number {
  return g ? indexCh(g, ch) : 1
}

/** Pupil-mask lookup for a normalized stop coordinate (u, v in −1..1). */
export function stopPasses(stop: StopSpec, mask: Uint8Array | null, size: number, u: number, v: number): boolean {
  const r2 = u * u + v * v
  if (r2 > 1) return false
  if (stop.kind !== 'card' && (stop.blades === 0 || stop.roundness >= 1)) return true
  if (!mask) return true
  const ix = Math.min(size - 1, Math.max(0, Math.floor(((u + 1) / 2) * size)))
  const iy = Math.min(size - 1, Math.max(0, Math.floor(((1 - v) / 2) * size)))
  return mask[iy * size + ix] > 0
}

export type Fate = 'film' | 'vignetted' | 'tir' | 'miss'

/** Mutable ray state used by the hot loop (no allocation per surface). */
export interface RayState {
  px: number; py: number; pz: number
  dx: number; dy: number; dz: number
}

/**
 * Trace one ray through every surface. Returns the fate and leaves `r` at the last surface hit
 * (or at the blocking surface). `rec` receives (z, y) of every hit if given.
 */
export function traceRay(
  surfs: Surface[], ch: Ch, r: RayState, mask: Uint8Array | null, maskSize: number,
  rec?: number[], from = 0, to = surfs.length,
): Fate {
  for (let i = from; i < to; i++) {
    const s = surfs[i]
    const lx = r.px, ly = r.py, lz = r.pz - s.z
    const c = s.c
    const F = c * (lx * lx + ly * ly + lz * lz) - 2 * lz
    const G = r.dz - c * (lx * r.dx + ly * r.dy + lz * r.dz)
    const disc = G * G - c * F
    if (disc < 0) return 'miss'
    const den = G + Math.sqrt(disc)
    if (Math.abs(den) < 1e-12) return 'miss'
    const t = F / den
    const qx = lx + t * r.dx, qy = ly + t * r.dy, qz = lz + t * r.dz
    r.px = qx; r.py = qy; r.pz = qz + s.z
    if (rec) rec.push(r.pz, r.py)
    if (s.stop) {
      const rr = s.semi
      if (!stopPasses(s.stop, mask, maskSize, qx / rr, qy / rr)) return 'vignetted'
      continue
    }
    if (qx * qx + qy * qy > s.semi * s.semi) return 'vignetted'
    const n1 = nOf(s.glassBefore, ch), n2 = nOf(s.glassAfter, ch)
    if (n1 === n2) continue
    let nx = -c * qx, ny = -c * qy, nz = 1 - c * qz
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl; ny /= nl; nz /= nl
    const mu = n1 / n2
    let cosI = r.dx * nx + r.dy * ny + r.dz * nz
    if (cosI < 0) { nx = -nx; ny = -ny; nz = -nz; cosI = -cosI }
    const k = 1 - mu * mu * (1 - cosI * cosI)
    if (k < 0) return 'tir'
    const g = Math.sqrt(k) - mu * cosI
    let dx = mu * r.dx + g * nx, dy = mu * r.dy + g * ny, dz = mu * r.dz + g * nz
    const dl = Math.hypot(dx, dy, dz) || 1
    dx /= dl; dy /= dl; dz /= dl
    if (dz <= 1e-6) return 'miss'
    r.dx = dx; r.dy = dy; r.dz = dz
  }
  return 'film'
}

/** Propagate a ray state to a plane z. */
export function toPlane(r: RayState, z: number): void {
  if (Math.abs(r.dz) < 1e-9) return
  const t = (z - r.pz) / r.dz
  r.px += t * r.dx; r.py += t * r.dy; r.pz = z
}

export function rayPath(rec: number[], ch: Ch, fate: Fate): RayPath {
  return { pts: Float32Array.from(rec), ch, fate }
}

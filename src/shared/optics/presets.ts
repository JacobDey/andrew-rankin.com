// Q.'s card file (lensbench.md §6.3). Authored as element sequences with air gaps, then
// auto-scaled (every length, including diameters) so the EFL comes out exact, then collimated.
import type { ElementSpec, GlassId, LensDesign, PresetId, StopSpec } from './types'
import { autoThickness } from './glass'
import { buildSurfaces } from './trace'
import { paraxial } from './paraxial'
import { collimate, computeProfile } from './profile'

type Item =
  | { k: 'el'; glass: GlassId; c1: number; c2: number; D: number; gap: number; coating?: 0 | 1 | 2 }
  | { k: 'stop'; gap: number }

interface Authored { items: Item[]; f: number; N: number; name: string; blades?: 0 | 5 | 6 | 8 | 9 }

const ACH = { c1: 0.02233, c2: -0.02233, c3: -0.02233, c4: -0.00122 }

export const PRESET_INFO: Record<PresetId, { name: string; f: number; N: number; note: string }> = {
  pinhole: { name: 'Pinhole tin', f: 100, N: 224, note: 'No glass, no lies.' },
  meniscus: { name: 'Landscape meniscus', f: 100, N: 11, note: '1812-type. Soft wide open, a little barrel.' },
  achromat: { name: 'Achromat doublet', f: 100, N: 5.6, note: 'Crown and flint arguing themselves straight.' },
  portrait: { name: 'Portrait (1840-type)', f: 100, N: 3.6, note: 'Sharp centre, swirling edges.' },
  triplet: { name: 'Triplet (1893-type)', f: 50, N: 3.5, note: 'The sharp all-rounder.' },
  telephoto: { name: 'Telephoto group', f: 250, N: 8, note: 'Long reach, short barrel.' },
  retrofocus: { name: 'Retrofocus wide', f: 24, N: 4, note: 'Wide, and clears the mirror.' },
  doubleGauss: { name: 'Double-Gauss', f: 50, N: 2, note: 'Fast and symmetric.' },
}

const AUTH: Record<Exclude<PresetId, 'pinhole'>, Authored> = {
  meniscus: { name: 'meniscus', f: 100, N: 11, items: [{ k: 'stop', gap: 0 }, { k: 'el', glass: 'crown', c1: -0.03, c2: -0.0493, D: 30, gap: 15 }] },
  achromat: {
    name: 'achromat', f: 100, N: 5.6,
    items: [
      { k: 'stop', gap: 0 },
      { k: 'el', glass: 'crown', c1: ACH.c1, c2: ACH.c2, D: 25, gap: 5 },
      { k: 'el', glass: 'flint', c1: ACH.c3, c2: ACH.c4, D: 25, gap: 0 },
    ],
  },
  portrait: {
    name: 'portrait', f: 100, N: 3.6,
    items: [
      { k: 'el', glass: 'crown', c1: ACH.c1 / 1.5, c2: ACH.c2 / 1.5, D: 34, gap: 0 },
      { k: 'el', glass: 'flint', c1: ACH.c3 / 1.5, c2: ACH.c4 / 1.5, D: 34, gap: 0 },
      { k: 'stop', gap: 45 },
      { k: 'el', glass: 'flint', c1: -0.02, c2: 0.008, D: 28, gap: 5 },
      { k: 'el', glass: 'crown', c1: 0.04, c2: -0.015, D: 28, gap: 1.5 },
    ],
  },
  triplet: {
    name: 'triplet', f: 50, N: 3.5,
    items: [
      { k: 'el', glass: 'lanthanumCrown', c1: 0.045, c2: -0.0025, D: 22, gap: 0 },
      { k: 'el', glass: 'flint', c1: -0.036, c2: 0.04, D: 18, gap: 4 },
      { k: 'stop', gap: 1.5 },
      { k: 'el', glass: 'lanthanumCrown', c1: 0.012, c2: -0.048, D: 20, gap: 2.5 },
    ],
  },
  telephoto: {
    name: 'telephoto', f: 250, N: 8,
    items: [
      { k: 'el', glass: 'crown', c1: ACH.c1 / 1.2, c2: ACH.c2 / 1.2, D: 30, gap: 0 },
      { k: 'el', glass: 'flint', c1: ACH.c3 / 1.2, c2: ACH.c4 / 1.2, D: 30, gap: 0 },
      { k: 'stop', gap: 10 },
      { k: 'el', glass: 'lightFlint', c1: -0.0145, c2: 0.0145, D: 24, gap: 70 },
    ],
  },
  retrofocus: {
    name: 'retrofocus', f: 24, N: 4,
    items: [
      { k: 'el', glass: 'crown', c1: -0.0242, c2: 0.0242, D: 30, gap: 0 },
      { k: 'stop', gap: 30 },
      { k: 'el', glass: 'lanthanumCrown', c1: 0.0234, c2: -0.0234, D: 20, gap: 10 },
    ],
  },
  doubleGauss: {
    name: 'doubleGauss', f: 50, N: 2,
    items: [
      { k: 'el', glass: 'lanthanumCrown', c1: 0.03, c2: 0.005, D: 30, gap: 0 },
      { k: 'el', glass: 'flint', c1: 0.012, c2: 0.04, D: 26, gap: 1 },
      { k: 'stop', gap: 4 },
      { k: 'el', glass: 'flint', c1: -0.04, c2: -0.012, D: 26, gap: 4 },
      { k: 'el', glass: 'lanthanumCrown', c1: -0.005, c2: -0.03, D: 30, gap: 1 },
    ],
  },
}

function build(a: Authored, scale: number): LensDesign {
  const elements: ElementSpec[] = []
  let stop: StopSpec = { z: 0, kind: 'iris', diameter: 10, blades: a.blades ?? 0, roundness: 1 }
  let z = -300 // provisional; collimate moves the group
  let n = 0
  for (const it of a.items) {
    z += it.gap * scale
    if (it.k === 'stop') {
      stop = { ...stop, z }
    } else {
      const e: ElementSpec = {
        id: `e${++n}`, z, t: 0, c1: it.c1 / scale, c2: it.c2 / scale, diameter: Math.round(it.D * scale * 100) / 100,
        glass: it.glass, coating: it.coating ?? 0,
      }
      e.t = autoThickness(e)
      elements.push(e)
      z += e.t
    }
  }
  stop.diameter = Math.max(1, Math.min(...elements.map((e) => e.diameter)) * 0.6)
  return { v: 1, elements, stop }
}

/** Set the stop size so the effective f-number equals N (returns a new design). */
export function setFNumber(d: LensDesign, N: number, format: { w: number; h: number } = { w: 36, h: 24 }): LensDesign {
  const out: LensDesign = { v: 1, elements: d.elements.map((e) => ({ ...e })), stop: { ...d.stop } }
  const NN = Math.max(0.7, Math.min(1024, N))
  if (d.stop.kind === 'pinhole' || d.elements.length === 0) {
    out.stop.diameter = Math.max(0.05, -d.stop.z / NN)
    return out
  }
  const p = computeProfile(d, format, 'fast')
  if (!(p.fNumber > 0) || !Number.isFinite(p.fNumber)) return out
  out.stop.diameter = Math.max(0.05, Math.min(120, d.stop.diameter * (p.fNumber / NN)))
  return out
}

export function loadPreset(id: PresetId): LensDesign {
  if (id === 'pinhole' || !(id in AUTH)) {
    return { v: 1, elements: [], stop: { z: -100, kind: 'pinhole', diameter: 0.45, blades: 0, roundness: 1 } }
  }
  const a = AUTH[id as Exclude<PresetId, 'pinhole'>]
  let scale = 1
  let d = build(a, scale)
  for (let i = 0; i < 6; i++) {
    const p = paraxial(buildSurfaces(d), 1)
    if (!(p.efl > 0)) break
    const s = a.f / p.efl
    if (Math.abs(s - 1) < 1e-4) break
    scale *= s
    d = build(a, scale)
  }
  if (id === 'achromat') d = achromatize(d, 1)
  d = collimate(d).design
  d = setFNumber(d, a.N)
  return d
}

/** Tune element `idx`'s back curvature so |longCA_C − longCA_F| is minimal (golden section). */
function achromatize(d: LensDesign, idx: number): LensDesign {
  const base = d.elements[idx]
  if (!base) return d
  const spread = (c2: number): number => {
    const t: LensDesign = { v: 1, elements: d.elements.map((e, i) => (i === idx ? { ...e, c2 } : { ...e })), stop: { ...d.stop } }
    const s = buildSurfaces(t)
    return Math.abs(paraxial(s, 0).bfd - paraxial(s, 2).bfd)
  }
  let lo = base.c2 - 0.006, hi = base.c2 + 0.006
  const g = 0.6180339887
  for (let i = 0; i < 40; i++) {
    const m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo)
    if (spread(m1) < spread(m2)) hi = m2; else lo = m1
  }
  const c2 = (lo + hi) / 2
  const out: LensDesign = { v: 1, elements: d.elements.map((e, i) => (i === idx ? { ...e, c2 } : { ...e })), stop: { ...d.stop } }
  out.elements[idx].t = autoThickness(out.elements[idx])
  // keep EFL exact after the tweak: rescale lengths about the first vertex
  const p = paraxial(buildSurfaces(out), 1)
  if (p.efl > 0) {
    const s = 100 / p.efl
    const z0 = out.elements[0].z
    for (const e of out.elements) { e.z = z0 + (e.z - z0) * s; e.c1 /= s; e.c2 /= s; e.diameter *= s; e.t = autoThickness(e) }
    out.stop.z = z0 + (out.stop.z - z0) * s
    // re-seat the cemented flint on the crown
    const a = out.elements[0], b = out.elements[1]
    if (a && b) b.z = a.z + a.t
  }
  return out
}

export const PRESET_IDS: readonly PresetId[] = ['pinhole', 'meniscus', 'achromat', 'portrait', 'triplet', 'telephoto', 'retrofocus', 'doubleGauss']

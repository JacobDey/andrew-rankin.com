// Compact lens codec for share links (lensbench.md §8): lengths to 0.01 mm, curvatures to 1e-5.
import type { ElementSpec, GlassId, LensDesign, StopSpec } from './types'
import { GLASS_IDS, autoThickness } from './glass'

const KINDS: StopSpec['kind'][] = ['iris', 'card', 'pinhole']
const r2 = (x: number) => Math.round(x * 100) / 100
const r5 = (x: number) => Math.round(x * 1e5) / 1e5

export function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function b64urlDecode(s: string): string | null {
  try {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = norm.length % 4 ? norm + '='.repeat(4 - (norm.length % 4)) : norm
    const bin = atob(pad)
    const u = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(u)
  } catch {
    return null
  }
}

export function lensToCompact(d: LensDesign): unknown {
  return {
    e: d.elements.map((e) => [r2(e.z), r5(e.c1), r5(e.c2), r2(e.diameter), Math.max(0, GLASS_IDS.indexOf(e.glass)), e.coating]),
    s: [r2(d.stop.z), Math.max(0, KINDS.indexOf(d.stop.kind)), Math.round(d.stop.diameter * 1000) / 1000, d.stop.blades, r2(d.stop.roundness), d.stop.card ?? ''],
  }
}

const num = (x: unknown, dflt: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : dflt)

export function lensFromCompact(o: unknown): LensDesign | null {
  if (!o || typeof o !== 'object') return null
  const rec = o as { e?: unknown; s?: unknown }
  if (!Array.isArray(rec.e) || !Array.isArray(rec.s)) return null
  const elements: ElementSpec[] = []
  rec.e.slice(0, 6).forEach((row: unknown, i: number) => {
    if (!Array.isArray(row)) return
    const g: GlassId = GLASS_IDS[Math.max(0, Math.min(GLASS_IDS.length - 1, num(row[4], 0) | 0))]
    const coat = (Math.max(0, Math.min(2, num(row[5], 0) | 0)) as 0 | 1 | 2)
    const e: ElementSpec = { id: `e${i + 1}`, z: num(row[0], -50), t: 0, c1: num(row[1], 0), c2: num(row[2], 0), diameter: Math.max(4, Math.min(100, num(row[3], 30))), glass: g, coating: coat }
    e.t = autoThickness(e)
    elements.push(e)
  })
  const s = rec.s
  const bl = num(s[3], 0)
  const blades = ([0, 5, 6, 8, 9] as const).includes(bl as 0) ? (bl as 0 | 5 | 6 | 8 | 9) : 0
  const stop: StopSpec = {
    z: num(s[0], -50), kind: KINDS[Math.max(0, Math.min(2, num(s[1], 0) | 0))], diameter: Math.max(0.02, num(s[2], 10)),
    blades, roundness: Math.max(0, Math.min(1, num(s[4], 1))),
  }
  if (typeof s[5] === 'string' && s[5]) stop.card = s[5]
  return { v: 1, elements, stop }
}

export function encodeLens(d: LensDesign): string {
  return b64urlEncode(JSON.stringify(lensToCompact(d)))
}
export function decodeLens(s: string): LensDesign | null {
  const txt = b64urlDecode(s)
  if (!txt) return null
  try {
    return lensFromCompact(JSON.parse(txt))
  } catch {
    return null
  }
}

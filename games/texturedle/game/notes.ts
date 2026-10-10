// Field Notes: bench events + running stats → evidence chips (texturedle.md §5.9).
// Fixed thresholds on recipe parameters, so every player gets the same notes.
// Notes describe, never name. Every audio clue has a chip; residue chips name a colour.

import type { BenchEvent, ProbeStats, RatioSpec, SurfaceRuntime, RGB } from '../contracts'

export type Sense = 'marble' | 'lens' | 'burlap' | 'light' | 'tap'
export interface Chip { id: string; sense: Sense; text: string; family?: string }

// fixed 24-name palette, nearest by ΔE (CIELAB)
const PALETTE: Array<[string, string]> = [
  ['rust orange', '#B5582A'], ['burnt orange', '#CC5500'], ['brick red', '#9C3A2A'], ['pink', '#E8A0A8'], ['cherry red', '#B0202E'],
  ['mustard', '#C9A227'], ['straw', '#DCC98A'], ['cream', '#EFE6CC'], ['chalk white', '#F0EFEA'], ['ash grey', '#B2B0AA'],
  ['slate grey', '#5E6670'], ['soot black', '#1E1C1C'], ['tan', '#C29A6B'], ['mud brown', '#6E5038'], ['chocolate', '#4A2C1C'],
  ['olive', '#6B6B2A'], ['leaf green', '#4E8A3A'], ['moss green', '#5A6B48'], ['teal', '#2A7A78'], ['verdigris', '#4FA08A'],
  ['indigo', '#33407A'], ['navy', '#22304E'], ['violet', '#6E4A8E'], ['silver', '#C4C8CC'],
]
function lab(r: number, g: number, b: number): [number, number, number] {
  // linear sRGB → XYZ (D65) → Lab
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const PAL_LAB = PALETTE.map(([n, h]) => {
  const v = parseInt(h.slice(1), 16)
  return [n, lab(lin(((v >> 16) & 255) / 255), lin(((v >> 8) & 255) / 255), lin((v & 255) / 255))] as const
})
/** Nearest palette name for a linear RGB colour. */
export function colourName(rgb: RGB): string {
  const L = lab(rgb[0], rgb[1], rgb[2])
  let best = PAL_LAB[0][0]
  let bd = Infinity
  for (const [n, p] of PAL_LAB) {
    const d = (L[0] - p[0]) ** 2 + (L[1] - p[1]) ** 2 + (L[2] - p[2]) ** 2
    if (d < bd) { bd = d; best = n }
  }
  return best
}
function albedoName(rt: SurfaceRuntime, x: number, y: number): string {
  const b = rt.bake
  const i = Math.min(b.res - 1, Math.max(0, Math.floor((x + b.sizeMm / 2) / b.mmPerTexel)))
  const j = Math.min(b.res - 1, Math.max(0, Math.floor((y + b.sizeMm / 2) / b.mmPerTexel)))
  const k = j * b.res + i
  const layer = b.topLayer[k]
  if ((b.phys[layer]?.metalness ?? 0) > 0.5) return 'grey metal'
  return colourName([lin(b.albedo[k * 4] / 255), lin(b.albedo[k * 4 + 1] / 255), lin(b.albedo[k * 4 + 2] / 255)])
}

/** Colour name of a layer: sampled where that layer is on top, near (x, y). */
function layerName(rt: SurfaceRuntime, layer: number, x: number, y: number): string {
  const b = rt.bake
  if ((b.phys[layer]?.metalness ?? 0) > 0.5) return 'grey metal'
  const ci = Math.floor((x + b.sizeMm / 2) / b.mmPerTexel), cj = Math.floor((y + b.sizeMm / 2) / b.mmPerTexel)
  // the nearest texel where this layer is on top (and not a thin, blended edge)
  let best = -1, bd = Infinity
  const N = b.res * b.res
  for (let j = 0; j < b.res; j += 2) for (let i = 0; i < b.res; i += 2) {
    const k = j * b.res + i
    if (b.topLayer[k] !== layer || b.layerT[layer * N + k] < 8) continue
    const d = (i - ci) ** 2 + (j - cj) ** 2
    if (d < bd) { bd = d; best = k }
  }
  if (best >= 0) return colourName([lin(b.albedo[best * 4] / 255), lin(b.albedo[best * 4 + 1] / 255), lin(b.albedo[best * 4 + 2] / 255)])
  return albedoName(rt, x, y)
}

const BODY_TEXT: Record<string, (f: number) => string> = {
  'hollow-sheet': (f) => `Hollow metal ring ≈ ${Math.round(f / 10) * 10} Hz`,
  'solid-stone': () => 'Dull stony tick', board: () => 'Woody knock', pane: () => 'Glassy tock', ceramic: () => 'Bright clink',
  tube: (f) => `Ringing tube ≈ ${Math.round(f / 100) * 100} Hz`, 'rubber-ball': () => 'Rubbery boing', fruit: () => 'Soft, wet puk', soft: () => 'Muffled, no ring',
}

export interface NotesContext { lampDeg: number; lampMode: 'rake' | 'ring'; tiltDeg: number; ratio: RatioSpec; frameW: number; frameH: number; burlapAt?: { x: number; y: number } | null }

export interface Notes {
  ingest(events: BenchEvent[], stats: ProbeStats, rt: SurfaceRuntime, ctx: NotesContext): Chip[]
  restore(chips: Chip[]): void
  readonly chips: Chip[]
  probes: { tilt: boolean; marble: boolean; lens: boolean; burlap: boolean }
}

export function createNotes(): Notes {
  const chips: Chip[] = []
  const have = new Set<string>()
  const families = new Set<string>()
  const layerSeq: string[] = []
  const layers: Array<{ layer: number; name: string }> = []
  const layerSeen = new Set<number>()
  let startIdx = -1
  let firstImpact = true
  let lampStart: number | null = null
  let rollT = 0
  let snagWiped = 0
  const probes = { tilt: false, marble: false, lens: false, burlap: false }

  function add(id: string, sense: Sense, text: string, family = id): Chip | null {
    if (families.has(family)) return null
    families.add(family)
    have.add(id)
    const c = { id, sense, text, family }
    chips.push(c)
    return c
  }

  return {
    chips,
    probes,
    restore(saved) {
      chips.length = 0
      have.clear()
      families.clear()
      for (const c of saved) {
        chips.push(c)
        have.add(c.id)
        families.add(c.family ?? c.id)
      }
    },
    ingest(events, stats, rt, ctx) {
      const out: Chip[] = []
      const push = (c: Chip | null) => { if (c) out.push(c) }
      const rec = rt.recipe
      for (const e of events) {
        if (e.t === 'impact') {
          if (e.by === 'marble') probes.marble = true
          if (e.speed >= 60 || e.by === 'tap') {
            const pre = rec.body.preset
            const f0 = rec.body.modes?.[0]?.[0] ?? 212
            push(add(`body.${pre}`, e.by === 'tap' ? 'tap' : 'marble', BODY_TEXT[pre]?.(f0) ?? 'A knock', 'body'))
          }
          if (e.by === 'marble' && e.speed >= 60 && firstImpact) {
            firstImpact = false
            const r = rt.bake.phys[e.layer]?.restitution ?? 0.4
            const k = r >= 0.55 ? 'lively' : r >= 0.25 ? 'some' : 'dead'
            push(add(`bounce.${k}`, 'marble', k === 'lively' ? 'Lively bounce' : k === 'some' ? 'Some bounce' : 'Lands dead', 'bounce'))
          }
        } else if (e.t === 'settled' && e.inPit) {
          push(add('roll.trapped', 'marble', 'Settles in pits'))
        } else if (e.t === 'offEdge' && rt.recipe.orientation === 'ceiling') {
          push(add('ceiling', 'marble', "The marble won't stay on it"))
        } else if (e.t === 'layerRevealed') {
          if (!layerSeen.has(e.layer)) {
            layerSeen.add(e.layer)
            layers.push({ layer: e.layer, name: layerName(rt, e.layer, e.x, e.y) })
          }
          if (e.by !== 'burlap') continue
          probes.burlap = true
          // top to bottom, from the layer the burlap started on, down through what it exposed
          const deeper = layers.filter((l) => startIdx < 0 || l.layer < startIdx).sort((a, b) => b.layer - a.layer).map((l) => l.name)
          const chain = layerSeq.length ? [layerSeq[0], ...deeper] : deeper
          const names = chain.filter((n, i) => i === 0 || n !== chain[i - 1])
          if (names.length >= 2) {
            const text = `Scrubs through: ${names.join(' → ')}`
            const ex = chips.find((c) => c.id === 'burlap.layers')
            if (ex) { if (ex.text !== text) { ex.text = text; out.push(ex) } }
            else push(add('burlap.layers', 'burlap', text))
          }
        } else if (e.t === 'snag') {
          probes.burlap = true
        } else if (e.t === 'avalanche' && stats.avalanche > 0.002 && (ctx.tiltDeg >= 1 || stats.tiltMax >= 1)) {
          push(add('grit.slides', 'light', 'Grit slides when tilted'))
        } else if (e.t === 'slip') {
          if (e.cloth === 'lens') probes.lens = true
          else probes.burlap = true
        }
      }
      // the colour you start scrubbing from
      if (ctx.burlapAt && layerSeq.length === 0) {
        layerSeq.push(albedoName(rt, ctx.burlapAt.x, ctx.burlapAt.y))
        const b = rt.bake
        const i = Math.min(b.res - 1, Math.max(0, Math.floor((ctx.burlapAt.x + b.sizeMm / 2) / b.mmPerTexel)))
        const j = Math.min(b.res - 1, Math.max(0, Math.floor((ctx.burlapAt.y + b.sizeMm / 2) / b.mmPerTexel)))
        startIdx = b.topLayer[j * b.res + i]
      }
      if (stats.wiped.lens > 0.1) probes.lens = true
      if (stats.wiped.burlap > 0.1) probes.burlap = true
      // marble rolling character
      if (probes.marble) {
        rollT += 1 / 60
        if (rollT > 0.6 && stats.rollJitterRms > 0) {
          if (stats.rollJitterRms > 0.25) push(add('roll.rattle', 'marble', 'Rattles over bumps', 'roll.feel'))
          else if (stats.rollJitterRms < 0.05 && stats.maxImpact > 0) push(add('roll.glide', 'marble', 'Glides smoothly', 'roll.feel'))
        }
        const soft = rt.bake.phys.some((p) => p.soft)
        if (soft) push(add('roll.sinks', 'marble', 'Sinks in, then springs back'))
        const crr = Math.max(...rt.bake.phys.map((p) => p.rollResist))
        if (crr > 0.2) push(add('roll.crawl', 'marble', 'Crawls and drags', 'roll.feel'))
      }
      if (stats.levelDrift) {
        const d = stats.levelDrift
        const dir = Math.abs(d.x) >= Math.abs(d.y) ? (d.x > 0 ? 'right' : 'left') : d.y > 0 ? 'up' : 'down'
        push(add('roll.drift', 'marble', `Drifts ${dir} when level: it curves`))
      }
      if (stats.channelFrac >= 0.8) push(add('roll.channel', 'marble', 'Runs along grooves'))
      // lens cloth
      const rl = stats.residue.lens
      if (rl.alpha > 0.15) {
        const kind = ({ powder: 'powdery', grease: 'greasy', wet: 'wet', dye: 'dyed', flake: 'flaky', lint: 'linty' } as Record<string, string>)[rl.kind] ?? 'powdery'
        push(add('lens.residue', 'lens', `Lens cloth comes away ${colourName(rl.rgb)}, ${kind}`))
      }
      if (stats.wiped.lens >= 3 && rl.alpha < 0.03) push(add('lens.clean', 'lens', 'Lens cloth stays clean'))
      if (stats.wiped.lens >= 1) {
        if (stats.slipMuK.lens < 0.25) push(add('lens.glide', 'lens', 'Glides', 'lens.feel'))
        else if (stats.slipMuK.lens > 0.6) push(add('lens.grip', 'lens', 'Grips and squeaks', 'lens.feel'))
      }
      if (stats.polishDrop > 0.1) push(add('lens.polish', 'lens', 'Wiped area turns glossier'))
      // burlap
      if (stats.snags >= 1) push(add('burlap.snag', 'burlap', `Snags on sharp edges ×${stats.snags}`, 'burlap.snags'))
      else if (stats.wiped.burlap >= 3) push(add('burlap.nosnag', 'burlap', 'Never snags', 'burlap.snags'))
      const snagChip = chips.find((c) => c.id === 'burlap.snag')
      if (snagChip && stats.snags > 1 && snagChip.text !== `Snags on sharp edges ×${stats.snags}`) snagChip.text = `Snags on sharp edges ×${stats.snags}`
      void snagWiped
      const rb = stats.residue.burlap
      if (rb.alpha > 0.15) push(add('burlap.sheds', 'burlap', `Sheds ${colourName(rb.rgb)} grit`))
      // periodic textures sing
      if (rec.periodicMm && rec.periodicMm.length) {
        // the bench reports contact speeds through stats only coarsely; any rub across the period counts
        if (stats.wiped.lens > 0.5 || stats.wiped.burlap > 0.5) {
          const p = rec.periodicMm[0]
          push(add('sing', 'lens', `Hums at ≈ ${Math.round(60 / p / 10) * 10} Hz when rubbed across`))
        }
      }
      // light: lamp swept ≥ 20° or tilt ≥ 3°
      if (lampStart === null) lampStart = ctx.lampDeg
      const swept = Math.max(stats.lampSwept, Math.abs(ctx.lampDeg - lampStart))
      if (swept >= 20 || stats.tiltMax >= 3) {
        probes.tilt = true
        // dominant top layer in the frame
        const b = rt.bake
        const count = new Map<number, number>()
        const step = Math.max(1, Math.floor(b.res / 48))
        const fw = ctx.frameW / b.sizeMm, fh = ctx.frameH / b.sizeMm
        let hmin = Infinity, hmax = -Infinity
        for (let j = Math.floor(b.res * (0.5 - fh / 2)); j < b.res * (0.5 + fh / 2); j += step)
          for (let i = Math.floor(b.res * (0.5 - fw / 2)); i < b.res * (0.5 + fw / 2); i += step) {
            const k = j * b.res + i
            count.set(b.topLayer[k], (count.get(b.topLayer[k]) ?? 0) + 1)
          }
        const ar = b.audioRes
        if (ar > 0) for (let k = 0; k < b.audioHeight.length; k += 3) { const v = b.audioHeight[k]; if (v < hmin) hmin = v; if (v > hmax) hmax = v }
        let dom = 0, dn = -1
        for (const [l, n] of count) if (n > dn) { dn = n; dom = l }
        const ph = b.phys[dom]
        const an = rec.aniso?.strength ?? 0
        const sheen = ph.metalness > 0.5 ? (an > 0.3 ? 'Streaked highlight' : 'Metal glints') : ph.roughness < 0.3 ? 'Glossy highlight' : an > 0.5 ? 'Streaked highlight' : 'Dull sheen'
        push(add(`light.sheen`, 'light', sheen))
        const rel = (hmax - hmin) / ctx.frameW
        push(add('light.relief', 'light', rel < 0.02 ? 'Shallow relief' : rel < 0.08 ? 'Deep relief' : 'Very deep relief'))
      }
      if (ctx.lampMode === 'ring' && rec.streakDirDeg !== undefined) push(add('stains.oneway', 'light', 'Stains all run one way'))
      if (ctx.tiltDeg >= 2) probes.tilt = true
      return out
    },
  }
}

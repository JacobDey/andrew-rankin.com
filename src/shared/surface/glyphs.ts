// An original single-stroke engraver font: digits, A-Z and a few symbols. Glyphs live on a 4 x 6 grid
// (y up); each is a list of polylines. Used by the kit's glyph() field (numerals, stencils, edge print).
import type { Field } from './types'

const G: Record<string, string> = {
  '0': '0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1',
  '1': '1,5 2,6 2,0|1,0 3,0',
  '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0',
  '3': '0,5 1,6 3,6 4,5 4,4 3,3 1,3|3,3 4,2 4,1 3,0 1,0 0,1',
  '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3 3,3 4,2 4,1 3,0 1,0 0,1',
  '6': '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3',
  '7': '0,6 4,6 1,0',
  '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  '9': '0,1 1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,4 1,3 4,3',
  A: '0,0 2,6 4,0|1,2 3,2',
  B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0',
  C: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1',
  D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0',
  E: '4,6 0,6 0,0 4,0|0,3 3,3',
  F: '4,6 0,6 0,0|0,3 3,3',
  G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3',
  H: '0,0 0,6|4,0 4,6|0,3 4,3',
  I: '1,6 3,6|2,6 2,0|1,0 3,0',
  J: '4,6 4,1 3,0 1,0 0,1',
  K: '0,0 0,6|4,6 0,3 4,0',
  L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0',
  N: '0,0 0,6 4,0 4,6',
  O: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0',
  P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3',
  Q: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|2,2 4,0',
  R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|2,3 4,0',
  S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1',
  T: '0,6 4,6|2,6 2,0',
  U: '0,6 0,1 1,0 3,0 4,1 4,6',
  V: '0,6 2,0 4,6',
  W: '0,6 1,0 2,3 3,0 4,6',
  X: '0,0 4,6|0,6 4,0',
  Y: '0,6 2,3 4,6|2,3 2,0',
  Z: '0,6 4,6 0,0 4,0',
  '.': '2,0 2,0.3',
  '-': '1,3 3,3',
  '+': '1,3 3,3|2,2 2,4',
  '=': '0,2 4,2|0,4 4,4',
  ':': '2,1 2,1.3|2,4 2,4.3',
  '/': '0,0 4,6',
  ',': '2,0.3 1.6,-1',
  "'": '2,6 2,4.6',
  '?': '0,5 1,6 3,6 4,5 4,4 2,3 2,2|2,0 2,0.3',
  '!': '2,6 2,2|2,0 2,0.3',
}

export const GLYPH_W = 4
export const GLYPH_H = 6
const ADVANCE = 5.6

const parsed = new Map<string, number[][]>()
function strokes(ch: string): number[][] {
  const key = ch.toUpperCase()
  let p = parsed.get(key)
  if (!p) {
    const src = G[key]
    p = src ? src.split('|').map((pl) => pl.split(' ').flatMap((pt) => pt.split(',').map(Number))) : []
    parsed.set(key, p)
  }
  return p
}

export interface TextSegments {
  /** x0, y0, x1, y1 per segment, in mm. */
  seg: Float32Array
  /** Bounding box of the strokes (mm). */
  bbox: [number, number, number, number]
}

/** Segments of `text` with its lower-left at `at`, cap height `size` (mm). */
export function textSegments(text: string, at: [number, number], size: number): TextSegments {
  const s = size / GLYPH_H
  const out: number[] = []
  let ox = at[0]
  for (const ch of text) {
    for (const pl of strokes(ch)) {
      for (let i = 0; i + 3 < pl.length; i += 2) out.push(ox + pl[i] * s, at[1] + pl[i + 1] * s, ox + pl[i + 2] * s, at[1] + pl[i + 3] * s)
      if (pl.length === 4 && pl[0] === pl[2] && pl[1] === pl[3]) out.push(ox + pl[0] * s, at[1] + pl[1] * s, ox + pl[0] * s, at[1] + pl[1] * s)
    }
    ox += ADVANCE * s
  }
  const seg = Float32Array.from(out)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < seg.length; i += 2) {
    x0 = Math.min(x0, seg[i]); x1 = Math.max(x1, seg[i])
    y0 = Math.min(y0, seg[i + 1]); y1 = Math.max(y1, seg[i + 1])
  }
  if (!seg.length) { x0 = y0 = x1 = y1 = 0 }
  return { seg, bbox: [x0, y0, x1, y1] }
}

/** Stroke mask field: 1 inside the stroke core, fading over 35% of the stroke width. */
export function glyphField(text: string, at: [number, number], size: number, stroke: number): Field {
  const { seg, bbox } = textSegments(text, at, size)
  const half = stroke / 2
  const soft = Math.max(1e-4, stroke * 0.35)
  const pad = half + soft
  const n = seg.length / 4
  return (x, y) => {
    if (x < bbox[0] - pad || x > bbox[2] + pad || y < bbox[1] - pad || y > bbox[3] + pad) return 0
    let best = 1e9
    for (let i = 0; i < n; i++) {
      const ax = seg[i * 4], ay = seg[i * 4 + 1], bx = seg[i * 4 + 2], by = seg[i * 4 + 3]
      const vx = bx - ax, vy = by - ay
      const wx = x - ax, wy = y - ay
      const l2 = vx * vx + vy * vy
      let t = l2 > 0 ? (wx * vx + wy * vy) / l2 : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const dx = wx - vx * t, dy = wy - vy * t
      const d = dx * dx + dy * dy
      if (d < best) best = d
    }
    const d = Math.sqrt(best)
    if (d <= half) return 1
    if (d >= half + soft) return 0
    const u = 1 - (d - half) / soft
    return u * u * (3 - 2 * u)
  }
}

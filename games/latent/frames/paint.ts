// Procedural frame painter: every frame of the eleven rolls is painted in Canvas 2D as a log-encoded
// luminance image (user space 300 × 200 = the 36 × 24 mm frame, positive orientation, row 0 = top).
// Luminance targets follow story bible §5. Objects named in a detail's `hide` list are skipped to paint
// the "detail off" image for the legibility ground truth.
import { mulberry32, type Rng } from '@shared/core'
import type { FrameRecipe } from '../core/types'

export const UW = 300
export const UH = 200
const colCache = new Map<number, string>()
// Two encodings: shadows (2^-12 .. 2^0) and highlights (2^-1.5 .. 2^4). Frames are painted once in each
// and merged, so 8-bit canvases keep about 0.02–0.05 EV of precision everywhere.
export const ENCODINGS = [{ lo: -12, span: 12 }, { lo: -1.5, span: 5.5 }]
let ENC_LO = -12
let ENC_SPAN = 12
export function setEncoding(k: number): void { ENC_LO = ENCODINGS[k].lo; ENC_SPAN = ENCODINGS[k].span; colCache.clear() }
/** Linear luminance → 8-bit log code. */
export function encodeL(L: number): number {
  if (L <= 0) return 0
  const v = (Math.log2(L) - ENC_LO) / ENC_SPAN
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}
const DECODES = ENCODINGS.map((e) => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) t[i] = i === 0 ? 0 : Math.pow(2, (i / 255) * e.span + e.lo); return t })
export function decodeL(code: number, k = 0): number { return DECODES[k][code] }

const FONT_CAPS = "'Archivo Variable', 'Archivo', Arial, sans-serif"
const FONT_HAND = "'Caveat Variable', 'Caveat', 'Segoe Print', cursive"
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace"

export function col(L: number): string {
  const c = encodeL(L)
  let s = colCache.get(c)
  if (!s) colCache.set(c, (s = `rgb(${c},${c},${c})`))
  return s
}

class Painter {
  constructor(public g: CanvasRenderingContext2D, public r: Rng, public hidden: Set<string>) {}
  on(name: string): boolean { return !this.hidden.has(name) }
  rect(x: number, y: number, w: number, h: number, L: number): void { this.g.fillStyle = col(L); this.g.fillRect(x, y, w, h) }
  poly(pts: number[], L: number): void {
    const g = this.g
    g.beginPath(); g.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.closePath(); g.fillStyle = col(L); g.fill()
  }
  circle(x: number, y: number, r: number, L: number): void { this.ellipse(x, y, r, r, L) }
  ellipse(x: number, y: number, rx: number, ry: number, L: number, rot = 0): void {
    const g = this.g
    g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); g.fillStyle = col(L); g.fill()
  }
  line(x1: number, y1: number, x2: number, y2: number, w: number, L: number): void {
    const g = this.g
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = w; g.strokeStyle = col(L); g.lineCap = 'round'; g.stroke()
  }
  path(pts: number[], w: number, L: number): void {
    const g = this.g
    g.beginPath(); g.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.lineWidth = w; g.strokeStyle = col(L); g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke()
  }
  vgrad(x: number, y: number, w: number, h: number, L0: number, L1: number): void {
    const gr = this.g.createLinearGradient(0, y, 0, y + h)
    gr.addColorStop(0, col(L0)); gr.addColorStop(1, col(L1))
    this.g.fillStyle = gr; this.g.fillRect(x, y, w, h)
  }
  hgrad(x: number, y: number, w: number, h: number, L0: number, L1: number): void {
    const gr = this.g.createLinearGradient(x, 0, x + w, 0)
    gr.addColorStop(0, col(L0)); gr.addColorStop(1, col(L1))
    this.g.fillStyle = gr; this.g.fillRect(x, y, w, h)
  }
  /** A soft pool of light: L0 at the centre falling to transparent at r. */
  glow(x: number, y: number, r: number, L0: number, sy = 1): void {
    const g = this.g
    g.save(); g.translate(x, y); g.scale(1, sy)
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r)
    const c = encodeL(L0)
    gr.addColorStop(0, `rgba(${c},${c},${c},1)`); gr.addColorStop(0.45, `rgba(${c},${c},${c},0.55)`); gr.addColorStop(1, `rgba(${c},${c},${c},0)`)
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore()
  }
  text(s: string, x: number, y: number, size: number, L: number, o: { font?: 'caps' | 'hand' | 'mono'; align?: CanvasTextAlign; weight?: number; mirror?: boolean; rot?: number; width?: number } = {}): void {
    const g = this.g
    g.save(); g.translate(x, y)
    if (o.rot) g.rotate(o.rot)
    if (o.mirror) g.scale(-1, 1)
    const fam = o.font === 'hand' ? FONT_HAND : o.font === 'mono' ? FONT_MONO : FONT_CAPS
    g.font = `${o.weight ?? (o.font === 'hand' ? 600 : 700)} ${size}px ${fam}`
    g.textAlign = o.align ?? 'left'; g.textBaseline = 'middle'; g.fillStyle = col(L)
    if (o.width) g.fillText(s, 0, 0, o.width); else g.fillText(s, 0, 0)
    g.restore()
  }
  /** Chalk dropout: speckle the slate colour over a text area. */
  speckle(x: number, y: number, w: number, h: number, L: number, n: number, rad = 0.5): void {
    this.g.fillStyle = col(L)
    for (let i = 0; i < n; i++) { const px = x + this.r() * w, py = y + this.r() * h; this.g.fillRect(px, py, rad * (0.5 + this.r()), rad * (0.5 + this.r())) }
  }
  noise(x: number, y: number, w: number, h: number, L: number, n: number, size = 1): void {
    for (let i = 0; i < n; i++) {
      const k = 0.6 + this.r() * 0.8
      this.g.fillStyle = col(L * k)
      this.g.fillRect(x + this.r() * w, y + this.r() * h, size * (0.5 + this.r()), size * (0.5 + this.r()))
    }
  }
  /** A standing figure: feet at (x, yFeet), total height h user units. */
  figure(x: number, yFeet: number, h: number, L: number, o: { coat?: number; hair?: 'bob' | 'short' | 'bald' | 'cap'; face?: number; strap?: number; armUp?: boolean; wide?: number; legs?: boolean } = {}): void {
    const w = h * 0.26 * (o.wide ?? 1)
    const head = h * 0.13
    const hy = yFeet - h + head * 0.55
    // legs
    if (o.legs !== false) { this.rect(x - w * 0.32, yFeet - h * 0.47, w * 0.26, h * 0.47, L * 0.8); this.rect(x + w * 0.06, yFeet - h * 0.47, w * 0.26, h * 0.47, L * 0.8) }
    // coat / torso
    const coatL = o.coat ?? L
    this.poly([x - w * 0.5, yFeet - h * 0.82, x + w * 0.5, yFeet - h * 0.82, x + w * 0.56, yFeet - h * (o.coat !== undefined ? 0.22 : 0.45), x - w * 0.56, yFeet - h * (o.coat !== undefined ? 0.22 : 0.45)], coatL)
    // shoulders
    this.ellipse(x, yFeet - h * 0.8, w * 0.52, h * 0.05, coatL)
    // neck + head
    this.rect(x - w * 0.09, hy + head * 0.4, w * 0.18, head * 0.5, o.face ?? L)
    this.ellipse(x, hy, head * 0.42, head * 0.55, o.face ?? L)
    if (o.hair === 'bob') this.poly([x - head * 0.5, hy + head * 0.35, x - head * 0.48, hy - head * 0.45, x, hy - head * 0.62, x + head * 0.48, hy - head * 0.45, x + head * 0.5, hy + head * 0.35, x + head * 0.3, hy - head * 0.2, x - head * 0.3, hy - head * 0.2], L * 0.5)
    if (o.hair === 'short') this.ellipse(x, hy - head * 0.3, head * 0.44, head * 0.3, L * 0.5)
    if (o.hair === 'cap') { this.ellipse(x, hy - head * 0.35, head * 0.5, head * 0.22, L * 0.6); this.rect(x - head * 0.65, hy - head * 0.3, head * 1.3, head * 0.1, L * 0.6) }
    // arms
    if (o.armUp) this.line(x + w * 0.45, yFeet - h * 0.78, x + w * 0.7, yFeet - h * 1.05, w * 0.16, coatL)
    else { this.line(x - w * 0.5, yFeet - h * 0.78, x - w * 0.58, yFeet - h * 0.42, w * 0.16, coatL); this.line(x + w * 0.5, yFeet - h * 0.78, x + w * 0.58, yFeet - h * 0.42, w * 0.16, coatL) }
    if (o.strap !== undefined) this.path([x - w * 0.35, yFeet - h * 0.8, x + w * 0.05, yFeet - h * 0.55, x + w * 0.38, yFeet - h * 0.8], w * 0.07, o.strap)
  }
  /** A seated figure (front row). */
  seated(x: number, ySeat: number, h: number, L: number, o: { face?: number; crown?: number; hair?: 'bob' | 'short' } = {}): void {
    const w = h * 0.27
    this.rect(x - w * 0.5, ySeat - h * 0.38, w, h * 0.38, L)
    this.rect(x - w * 0.5, ySeat, w * 0.38, h * 0.26, L * 0.8); this.rect(x + w * 0.12, ySeat, w * 0.38, h * 0.26, L * 0.8)
    const hy = ySeat - h * 0.47
    this.ellipse(x, hy, h * 0.06, h * 0.075, o.face ?? L)
    if (o.hair === 'bob') this.ellipse(x, hy - h * 0.035, h * 0.068, h * 0.05, L * 0.5)
    if (o.crown !== undefined) this.poly([x - h * 0.065, hy - h * 0.05, x - h * 0.065, hy - h * 0.12, x - h * 0.03, hy - h * 0.08, x, hy - h * 0.13, x + h * 0.03, hy - h * 0.08, x + h * 0.065, hy - h * 0.12, x + h * 0.065, hy - h * 0.05], o.crown)
  }
  /** Saloon car seen from behind (plate centred at x, y; plate width pw). */
  carRear(x: number, y: number, pw: number, body: number, plate: number, glyph: number, text = 'KDL 417', o: { lamps?: number; plateOn?: boolean } = {}): void {
    const W = pw * 4.2
    this.poly([x - W * 0.5, y + pw * 0.5, x - W * 0.5, y - pw * 0.6, x - W * 0.4, y - pw * 1.1, x + W * 0.4, y - pw * 1.1, x + W * 0.5, y - pw * 0.6, x + W * 0.5, y + pw * 0.5], body)
    this.poly([x - W * 0.32, y - pw * 1.1, x - W * 0.25, y - pw * 1.9, x + W * 0.25, y - pw * 1.9, x + W * 0.32, y - pw * 1.1], body * 1.4)
    this.rect(x - W * 0.5, y + pw * 0.5, W * 0.12, pw * 0.4, body * 0.5); this.rect(x + W * 0.38, y + pw * 0.5, W * 0.12, pw * 0.4, body * 0.5)
    const lamp = o.lamps ?? body * 1.5
    this.rect(x - W * 0.47, y - pw * 0.45, W * 0.1, pw * 0.25, lamp); this.rect(x + W * 0.37, y - pw * 0.45, W * 0.1, pw * 0.25, lamp)
    if (o.plateOn !== false) {
      this.rect(x - pw * 0.5, y - pw * 0.13, pw, pw * 0.26, plate)
      if (this.on('plateText') && this.on('detail')) this.text(text, x, y + pw * 0.01, pw * 0.2, glyph, { align: 'center', width: pw * 0.9 })
    }
  }
}

/** Frame-space helpers for the one-point alley (story §5.5): f from a 27° vertical FOV. */
const F = (UH / 2) / Math.tan((13.5 * Math.PI) / 180)
function proj(x: number, y: number, z: number, cam: number, roll = 0): [number, number] {
  let X = (F * x) / z, Y = (-F * (y - cam)) / z
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nx = X * c - Y * s; Y = X * s + Y * c; X = nx }
  return [UW / 2 + X, UH / 2 + Y]
}

type Paint = (p: Painter, prm: Record<string, unknown>, rec: FrameRecipe) => void

function slate(p: Painter, prm: Record<string, unknown>): void {
  const bg = prm.bg as string
  if (bg === 'brick') { p.rect(0, 0, UW, UH, 0.12); for (let y = 0; y < UH; y += 9) { p.rect(0, y, UW, 1.2, 0.2); const off = (y / 9) % 2 ? 0 : 13; for (let x = off; x < UW; x += 26) p.rect(x, y, 1.2, 9, 0.2) } }
  else if (bg === 'timber') { p.rect(0, 0, UW, UH, 0.03); for (let x = 0; x < UW; x += 22) { p.rect(x, 0, 1.5, UH, 0.008); p.noise(x, 0, 22, UH, 0.05, 40, 2) } }
  else if (bg === 'lighttable') { p.rect(0, 0, UW, UH, 0.02); p.rect(0, 168, UW, 32, 0.9) }
  else if (bg === 'wall') { p.rect(0, 0, UW, UH, 0.3); for (let x = 0; x < UW; x += 18) p.poly([x, 0, x + 9, 14, x + 18, 0], 0.55) }
  else p.rect(0, 0, UW, UH, 0.015)
  // the slate in its frame, held by Ruth's hand at the left
  p.rect(52, 38, 196, 128, 0.12); p.rect(58, 44, 184, 116, 0.04)
  p.noise(58, 44, 184, 116, 0.07, 120, 3)
  const lines = prm.lines as string[]
  const size = lines.length >= 3 ? 30 : 38
  const y0 = 102 - ((lines.length - 1) * size * 1.15) / 2
  lines.forEach((s, i) => p.text(s, 150, y0 + i * size * 1.15, size, 0.55, { align: 'center', width: 170 }))
  if (prm.star) p.poly([215, 70, 219, 81, 231, 81, 221, 88, 225, 99, 215, 92, 205, 99, 209, 88, 199, 81, 211, 81], 0.5)
  p.speckle(62, 50, 176, 104, 0.04, 900, 0.9)
  // hand and the white-taped strap
  p.ellipse(42, 108, 20, 30, 0.3); p.rect(30, 92, 30, 9, 0.32); p.rect(30, 104, 32, 9, 0.32); p.rect(30, 116, 30, 9, 0.32)
  p.path([20, 140, 30, 175, 70, 192, 110, 200], 6, 0.6)
}

function shopfront(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.2)
  for (let y = 0; y < 160; y += 7) p.rect(0, y, UW, 0.8, 0.26)
  p.rect(30, 14, 240, 44, 0.1)
  p.text("HOLLOWAY'S CHANDLERY", 150, 36, 22, 0.75, { align: 'center', width: 228 })
  p.rect(36, 66, 150, 92, 0.06)
  p.text('ROPE · TAR · LAMP OIL · CHARTS', 111, 76, 8, 0.7, { align: 'center', width: 140 })
  p.rect(36, 110, 75, 48, 0.02); p.rect(111, 66, 2, 92, 0.25); p.rect(36, 110, 150, 2, 0.25)
  // crack star in the lower-left pane
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + p.r() * 0.3; p.line(72, 132, 72 + Math.cos(a) * (14 + p.r() * 22), 132 + Math.sin(a) * (10 + p.r() * 16), 0.8, 0.7) }
  p.rect(200, 70, 50, 90, 0.08); p.circle(240, 118, 2, 0.4)
  p.vgrad(0, 160, UW, 40, 0.1, 0.06)
  for (let i = 0; i < 10; i++) p.rect(p.r() * UW, 165 + p.r() * 30, 20 + p.r() * 30, 1.5, 0.2)
}

function interior(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  if (kind === 'counter') {
    p.rect(0, 0, UW, UH, 0.12); p.rect(0, 110, UW, 90, 0.2); p.rect(0, 110, UW, 4, 0.35)
    p.rect(40, 118, 70, 30, 0.05); p.rect(44, 122, 62, 22, 0.02)
    p.ellipse(190, 95, 14, 18, 0.45); p.rect(186, 70, 8, 10, 0.3); p.glow(190, 95, 18, 0.6)
    p.rect(120, 150, 90, 5, 0.6); for (let i = 0; i < 15; i++) p.rect(122 + i * 6, 150, 0.6, 2.5, 0.1)
    p.ellipse(240, 160, 24, 8, 0.09)
  } else if (kind === 'fuse') {
    p.rect(0, 0, UW, UH, 0.10); p.noise(0, 0, UW, 130, 0.05, 300, 4)
    p.rect(110, 30, 80, 70, 0.25); p.rect(116, 36, 68, 58, 0.08)
    for (let i = 0; i < 6; i++) p.rect(122 + i * 10, 44, 6, 20, 0.3)
    p.line(150, 100, 150, 125, 2, 0.06)
    p.vgrad(0, 125, UW, 75, 0.02, 0.008)
    if (p.on('detail')) { // the melted spout of a steel fuel can, in deep shadow
      p.path([132, 160, 142, 156, 150, 162, 160, 158, 166, 165], 5, 0.025)
      p.ellipse(134, 168, 10, 6, 0.025); p.ellipse(160, 172, 7, 4, 0.022)
    }
  } else if (kind === 'dot') {
    p.rect(0, 0, UW, UH, 0.3); p.rect(0, 130, UW, 70, 0.2)
    p.seated(150, 128, 120, 0.2, { face: 0.5, crown: 0.7, hair: 'bob' })
    p.rect(95, 128, 110, 6, 0.4); p.rect(110, 120, 50, 8, 0.75); p.rect(135, 120, 1, 8, 0.3)
    p.ellipse(185, 98, 6, 8, 0.6)
  } else {
    p.rect(0, 0, UW, UH, 0.15); p.rect(120, 30, 100, 110, 0.6); p.rect(168, 30, 4, 110, 0.15); p.rect(120, 84, 100, 3, 0.15)
    p.figure(160, 200, 165, 0.03, { hair: 'short' })
  }
}

function closeup(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  const rule = (x: number, y: number, len: number, L = 0.6) => { p.rect(x, y, len, 7, L); for (let i = 0; i <= 15; i++) { p.rect(x + (i * len) / 15.5, y, 0.6, 3, 0.1); if (i) p.text(String(i), x + (i * len) / 15.5, y + 5, 3.2, 0.1, { align: 'center' }) } }
  if (kind === 'jemmy') { p.rect(0, 0, UW, UH, 0.5); p.rect(150, 0, 150, UH, 0.35); p.poly([148, 70, 160, 78, 152, 92, 162, 100, 150, 112], 0.08); rule(40, 150, 100) }
  else if (kind === 'boot') {
    p.rect(0, 0, UW, UH, 0.7); p.noise(0, 0, UW, UH, 0.66, 500, 2)
    if (p.on('detail')) { p.ellipse(132, 118, 22, 30, 0.45); p.ellipse(132, 158, 15, 12, 0.45); p.line(120, 151, 145, 166, 2.5, 0.7); for (let i = 0; i < 7; i++) p.rect(114, 96 + i * 6, 36, 2, 0.6) }
    rule(200, 40, 80)
  } else if (kind === 'skid') { p.rect(0, 0, UW, UH, 0.25); p.path([60, 200, 110, 120, 170, 60, 240, 20], 12, 0.04); p.path([110, 200, 160, 120, 220, 64, 290, 30], 12, 0.04); rule(30, 30, 90) }
  else if (kind === 'plaque') { p.rect(0, 0, UW, UH, 0.12); p.rect(50, 55, 200, 80, 0.3); p.text('FLOOD LEVEL · MARCH 1961', 150, 85, 15, 0.7, { align: 'center', width: 185 }); p.poly([150, 105, 140, 122, 160, 122], 0.6); p.rect(0, 52, UW, 3, 0.75) }
  else if (kind === 'cake') { p.rect(0, 0, UW, UH, 0.2); p.rect(50, 60, 200, 100, 0.75); p.text('UNIT 78', 150, 95, 28, 0.35, { align: 'center' }); p.rect(125, 115, 50, 28, 0.35); p.circle(150, 129, 8, 0.75) }
  else if (kind === 'hours') { p.rect(0, 0, UW, UH, 0.15); p.rect(60, 50, 180, 120, 0.8); p.text("the hours we don't have", 150, 110, 18, 0.15, { font: 'hand', align: 'center' }); p.ellipse(250, 160, 30, 40, 0.3) }
  else if (kind === 'watchbox') { p.rect(0, 0, UW, UH, 0.3); p.rect(70, 50, 120, 90, 0.1); p.rect(78, 58, 104, 74, 0.6); p.circle(130, 95, 20, 0.15); p.circle(130, 95, 16, 0.75); p.rect(200, 110, 80, 50, 0.8); p.text('14.2.79 — for all the', 240, 125, 7, 0.15, { font: 'hand', align: 'center' }); p.text("hours we don't have. M.", 240, 140, 7, 0.15, { font: 'hand', align: 'center' }) }
  else if (kind === 'caseback') {
    p.rect(0, 0, UW, UH, 0.08); p.circle(150, 100, 60, 0.45); p.circle(150, 100, 54, 0.6)
    p.glow(150, 70, 70, 3.5, 0.5); p.glow(150, 100, 44, 1.6)
    if (p.on('detail')) p.text('M.', 150, 100, 26, 0.9, { font: 'hand', align: 'center' })
  } else if (kind === 'minaFace') { p.rect(0, 0, UW, UH, 0.03); p.hgrad(80, 20, 140, 180, 0.9, 0.05); p.ellipse(150, 100, 52, 70, 0.4); p.ellipse(130, 90, 6, 4, 0.05); p.ellipse(170, 90, 6, 4, 0.05); p.ellipse(150, 135, 9, 7, 0.04); p.poly([95, 60, 100, 20, 150, 10, 200, 20, 205, 60, 190, 40, 110, 40], 0.08) }
  else if (kind === 'carton') {
    p.rect(0, 0, UW, UH, 0.3); p.rect(60, 30, 180, 150, 0.45); p.rect(70, 36, 160, 70, 0.5)
    if (p.on('detail')) p.text('HOLD — R.', 150, 58, 28, 0.04, { font: 'hand', align: 'center' })
    p.line(215, 72, 270, 30, 9, 0.05); p.ellipse(280, 26, 20, 14, 0.4)
  } else { p.rect(0, 0, UW, UH, 0.3); p.rect(80, 60, 120, 90, 0.7); p.text('16.2', 140, 80, 16, 0.1, { font: 'hand', align: 'center' }); p.circle(230, 110, 22, 0.5); p.circle(230, 110, 17, 0.2) }
}

function shadow(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.35); p.noise(0, 0, UW, UH, 0.3, 400, 2)
  p.rect(0, 40, UW, 6, 0.45); p.ellipse(220, 120, 50, 14, 0.6)
  p.poly([110, 200, 140, 200, 150, 60, 158, 30, 146, 22, 136, 30, 126, 60], 0.08)
  p.path([138, 70, 120, 90, 150, 95], 2, 0.08)
}

function fogged(p: Painter, prm: Record<string, unknown>): void {
  const fog = (prm.fog as number) ?? 1
  p.rect(0, 0, UW, UH, 0.3); p.noise(0, 0, UW, UH, 0.25, 200, 3)
  const x0 = UW * (1 - fog)
  p.hgrad(Math.max(0, x0 - 30), 0, 40, UH, 0.3, 8); p.rect(x0 + 10, 0, UW, UH, 8)
}

function yard(p: Painter): void {
  p.rect(0, 0, UW, 70, 0.8)
  p.rect(20, 40, 260, 120, 0.12); for (let y = 40; y < 160; y += 6) p.rect(20, y, 260, 0.7, 0.16)
  for (let i = 0; i < 5; i++) p.rect(36 + i * 52, 60, 22, 30, 0.02)
  p.rect(110, 105, 80, 55, 0.03)
  p.rect(90, 92, 120, 12, 0.08); p.text('BRACK & SONS · TANNERS · EST. 1904', 150, 98, 7, 0.45, { align: 'center', width: 116 }); p.rect(90, 92, 40, 12, 0.02)
  p.vgrad(0, 160, UW, 40, 0.15, 0.08); p.ellipse(70, 180, 40, 6, 0.8); p.ellipse(210, 175, 30, 4, 0.8)
  p.path([300, 165, 250, 190, 220, 200], 12, 0.1)
}

function step(p: Painter): void {
  p.rect(0, 0, UW, 70, 0.04); p.rect(80, 0, 140, 70, 0.02)
  p.rect(0, 70, UW, 130, 0.7)
  for (let i = 0; i < 70; i++) { const x = p.r() * UW, y = 72 + p.r() * 126; p.rect(x, y, 1, 1, 0.75); p.rect(x + 1, y, 3 + p.r() * 3, 0.8, 0.5) }
  const boot = (x: number, y: number, s: number, cut: boolean) => {
    p.ellipse(x, y, 9 * s, 16 * s, 0.5); p.ellipse(x + 1 * s, y + 24 * s, 7 * s, 7 * s, 0.5)
    for (let i = 0; i < 5; i++) p.rect(x - 7 * s, y - 10 * s + i * 5 * s, 14 * s, 1.2 * s, 0.62)
    if (cut) p.line(x - 6 * s, y + 19 * s, x + 7 * s, y + 29 * s, 1.6 * s, 0.7)
  }
  boot(60, 175, 0.9, false); boot(110, 150, 0.9, false); boot(160, 130, 1, false)
  if (p.on('detail')) boot(198, 112, 1.05, true)
}

function alley(p: Painter, prm: Record<string, unknown>, rec: FrameRecipe): void {
  const cam = prm.cam as number
  const night = !!prm.night
  const lampZ = 20
  const illum = (z: number) => (night ? 0.0025 + 0.07 * Math.exp(-(((z - lampZ) / 6) ** 2)) : 0.12 * (0.7 + 0.3 * Math.min(1, 6 / z)))
  const roll = 0
  // sky wedge, far street and ground
  p.rect(0, 0, UW, UH, night ? 0.002 : 0.55)
  const zs = [1.2, 1.6, 2.2, 3, 4, 5.5, 7.5, 10, 14, 19, 26, 40]
  for (let i = 0; i < zs.length - 1; i++) {
    const za = zs[i], zb = zs[i + 1], Lw = illum((za + zb) / 2)
    for (const side of [-1, 1]) {
      const x = side * 1.5
      const a = proj(x, 0, za, cam, roll), b = proj(x, 0, zb, cam, roll), c = proj(x, 7, zb, cam, roll), d = proj(x, 7, za, cam, roll)
      p.poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]], Lw)
    }
    const g1 = proj(-1.5, 0, za, cam), g2 = proj(1.5, 0, za, cam), g3 = proj(1.5, 0, zb, cam), g4 = proj(-1.5, 0, zb, cam)
    p.poly([g1[0], g1[1], g2[0], g2[1], g3[0], g3[1], g4[0], g4[1]], Lw * 0.8)
  }
  // far street at the vanishing point
  const e1 = proj(-1.5, 0, 40, cam), e2 = proj(1.5, 3.2, 40, cam)
  p.rect(e1[0], e2[1], e2[0] - e1[0], e1[1] - e2[1], night ? 0.04 : 0.5)
  // mortar courses (75 mm) and joints
  for (const side of [-1, 1]) {
    for (let y = 0.075; y < 4.5; y += 0.075) {
      for (let i = 0; i < zs.length - 1; i++) {
        const za = zs[i], zb = zs[i + 1]
        const a = proj(side * 1.5, y, za, cam), b = proj(side * 1.5, y, zb, cam)
        p.line(a[0], a[1], b[0], b[1], Math.max(0.15, 0.9 / za), illum((za + zb) / 2) * 1.5)
      }
    }
  }
  // the white flood line, top edge at 1.52 m, 5 cm high, both walls
  if (p.on('floodline')) {
    for (const side of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i], zb = zs[i + 1], Lf = illum((za + zb) / 2) * 6.25
      const a = proj(side * 1.5, 1.52, za, cam), b = proj(side * 1.5, 1.52, zb, cam), c = proj(side * 1.5, 1.47, zb, cam), d = proj(side * 1.5, 1.47, za, cam)
      p.poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]], Lf)
    }
  }
  // plaque on the left wall 4 m out, top at 1.52 m
  const q1 = proj(-1.5, 1.52, 3.85, cam), q2 = proj(-1.5, 1.32, 4.15, cam)
  p.rect(q1[0], q1[1], q2[0] - q1[0], q2[1] - q1[1], illum(4) * 2.5)
  p.text('FLOOD LEVEL · MARCH 1961', (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2, Math.abs(q2[1] - q1[1]) * 0.3, illum(4) * 6, { align: 'center', width: Math.abs(q2[0] - q1[0]) * 0.9 })
  if (prm.van) { // grey van nosed into the left wall 6 m out
    const v1 = proj(-1.4, 2.3, 6, cam), v2 = proj(-0.2, 0, 6.5, cam)
    p.rect(v1[0], v1[1], v2[0] - v1[0], v2[1] - v1[1], 0.3); p.rect(v1[0], v1[1] + (v2[1] - v1[1]) * 0.15, (v2[0] - v1[0]) * 0.8, (v2[1] - v1[1]) * 0.3, 0.1)
  }
  if (prm.car) { const c1 = proj(0.3, 0.7, 10, cam); p.carRear(c1[0], c1[1], 6, 0.004, 0.02, 0.006) }
  if (night) { const l = proj(-1.3, 3.6, lampZ, cam); p.glow(l[0], l[1], 10, 2); p.circle(l[0], l[1], 1.2, 6) }
  if (prm.rain) for (let i = 0; i < 160; i++) { const x = p.r() * UW, y = p.r() * UH; p.line(x, y, x - 1, y + 8, 0.4, 0.03) }
  void rec
}

function van(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.12); for (let y = 0; y < UH; y += 6) p.rect(0, y, UW, 0.7, 0.16)
  p.poly([30, 170, 30, 70, 170, 50, 260, 70, 270, 170], 0.3); p.poly([170, 50, 260, 70, 250, 110, 175, 100], 0.08)
  p.poly([30, 110, 90, 95, 120, 125, 60, 140], 0.22); p.rect(110, 140, 50, 14, 0.75); p.text('VRN 2207', 135, 147, 10, 0.05, { align: 'center' })
  p.circle(60, 135, 10, 0.6); p.line(52, 128, 68, 142, 0.8, 0.1); p.circle(70, 175, 18, 0.03); p.circle(220, 175, 18, 0.03)
  p.rect(0, 170, UW, 30, 0.1)
}

function party(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.35)
  for (let x = 0; x < UW; x += 16) { p.poly([x, 10, x + 8, 24, x + 16, 10], 0.6); p.poly([x + 8, 30, x + 16, 44, x + 24, 30], 0.2) }
  p.rect(0, 150, UW, 50, 0.15)
  // back row: Odell, two officers, Atwell (very tall), three officers, Ruth (far right)
  const back: [number, number, number][] = [[30, 118, 0.12], [62, 116, 0.06], [92, 118, 0.06], [124, 132, 0.04], [158, 118, 0.06], [188, 116, 0.06], [218, 117, 0.06]]
  for (const [x, h, L] of back) p.figure(x, 170, h, L, { face: 0.45, hair: 'short' })
  if (p.on('ruth')) { p.figure(268, 172, 136, 0.05, { face: 0.5, hair: 'short', coat: 0.05, strap: 0.75 }); p.glow(268, 100, 10, 0.06) }
  // front row seated, Dot in the middle in a paper crown
  for (const [x, cr] of [[110, false], [150, true], [190, false], [230, false]] as [number, boolean][]) p.seated(x, 168, 80, 0.12, { face: 0.5, crown: cr ? 0.7 : undefined, hair: cr ? 'bob' : 'short' })
  // Dot's chair, Hale front left with his right boot on its lower rung
  p.rect(128, 168, 44, 4, 0.1); p.rect(128, 168, 3, 32, 0.08); p.rect(169, 168, 3, 32, 0.08)
  p.rect(84, 158, 90, 42, 0.01)
  p.rect(126, 184, 50, 3, 0.05)
  p.figure(70, 200, 150, 0.4, { face: 0.5, hair: 'short', coat: 0.4 })
  p.line(80, 150, 100, 172, 9, 0.05)
  if (p.on('detail')) { p.ellipse(104, 172, 8, 6, 0.03); p.line(99, 167, 109, 177, 1.1, 0.01) }
  else p.ellipse(104, 172, 8, 6, 0.01)
}

function plant(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  if (kind === 'line2') {
    p.rect(0, 0, UW, UH, 0.05); p.rect(0, 30, UW, 16, 0.12)
    p.text('SALLOW VALLEY PHOTOFINISHING · LINE 2 · NO NAKED LIGHTS', 150, 38, 7, 0.6, { align: 'center', width: 280 })
    for (let i = 0; i < 6; i++) { p.rect(20 + i * 46, 110, 40, 60, 0.15); p.rect(20 + i * 46, 104, 40, 6, 0.3) }
    p.rect(10, 70, 280, 3, 0.25)
    p.figure(200, 196, 110, 0.4, { face: 0.6, hair: 'bob', coat: 0.55 })
  } else if (kind === 'lt3') {
    p.rect(0, 0, UW, UH, 0.008)
    p.rect(118, 50, 64, 70, 0.004); p.rect(118, 118, 64, 2, 0.9)
    for (let i = 0; i < 4; i++) p.rect(10 + i * 26, 120 - i * 6, 20, 30 - i * 4, 0.02)
    p.rect(200, 140, 100, 24, 0.7); p.figure(250, 200, 120, 0.05, { face: 0.3, hair: 'bob', coat: 0.2 })
  } else {
    p.rect(0, 0, UW, UH, 1.0)
    p.rect(40, 30, 8, 170, 0.85); p.rect(252, 30, 8, 170, 0.85); p.rect(40, 30, 220, 8, 0.85)
    for (let i = 0; i < 5; i++) p.rect(10, 60 + i * 26, 26, 3, 0.85)
    for (let i = 0; i < 6; i++) p.poly([60 + i * 22, 200, 66 + i * 22, 150 - p.r() * 40, 74 + i * 22, 200], 4 + p.r() * 3)
    if (p.on('detail')) { // a second seat of fire, in the stairwell
      p.rect(100, 30, 100, 130, 0.9)
      for (let i = 0; i < 7; i++) { const x = 110 + i * 12; p.poly([x, 150, x + 5, 60 + p.r() * 50, x + 10, 150], 6 + p.r() * 2) }
      for (let i = 0; i < 5; i++) p.rect(100 + i * 20, 150 - i * 20, 22, 3, 0.6)
    }
  }
}

function diner(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  if (kind === 'mirror') {
    p.rect(0, 0, UW, UH, 0.06); p.rect(0, 150, UW, 50, 0.15); p.rect(0, 146, UW, 5, 0.3)
    p.rect(20, 20, 260, 120, 0.03)
    p.rect(60, 26, 180, 18, 0.2); p.text('THE LANTERN · OPEN ALL NIGHT · PIE 40', 150, 35, 8, 0.6, { align: 'center', mirror: true, width: 170 })
    p.figure(110, 140, 80, 0.05, { face: 0.2, hair: 'cap' }); p.figure(160, 140, 76, 0.07, { face: 0.25, hair: 'bald', wide: 1.4 })
    p.rect(180, 118, 54, 20, 0.04)
    if (p.on('detail')) p.text('G.D.', 201, 128, 9, 0.5, { align: 'center', mirror: true })
  } else {
    p.rect(0, 0, UW, UH, 0.05); p.rect(0, 0, UW, 110, 0.012)
    p.text('THE LANTERN', 150, 40, 28, 0.9, { align: 'center', mirror: true })
    p.rect(0, 130, UW, 70, 0.12); p.rect(100, 128, 160, 6, 0.3)
    p.figure(160, 175, 90, 0.2, { face: 0.5, hair: 'bob', legs: false })
    if (kind === 'booth') { p.rect(190, 132, 30, 18, 0.7); p.path([196, 145, 202, 136, 210, 140, 214, 134], 0.8, 0.15); p.rect(140, 118, 12, 14, 0.4) }
    else p.rect(140, 110, 26, 18, 0.6)
  }
}

function bus(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.008)
  p.rect(110, 30, 80, 14, 0.004); p.text('38 RIVERSIDE', 150, 37, 10, 0.9, { align: 'center' })
  for (let i = 0; i < 5; i++) p.rect(20 + i * 30, 70 + i * 4, 24, 60 - i * 6, 0.003)
  p.rect(160, 40, 140, 90, 0.002); p.glow(260, 70, 40, 0.06)
  p.ellipse(205, 100, 30, 18, 0.004)
  if (p.on('detail')) { p.ellipse(186, 92, 13, 17, 0.03); p.ellipse(181, 88, 2, 1, 0.012); p.ellipse(191, 88, 2, 1, 0.012); p.poly([173, 86, 178, 74, 196, 74, 200, 86, 194, 80, 180, 80], 0.012) }
  p.rect(160, 110, 80, 60, 0.005)
}

function flat(p: Painter, prm: Record<string, unknown>, rec: FrameRecipe): void {
  const kind = prm.kind as string
  if (kind === 'door') {
    const mina = rec.roll === 10
    p.rect(0, 0, UW, UH, 0.45)
    p.rect(40, 0, 18, UH, 0.62); p.rect(58, 0, 74, UH, 0.08); p.rect(132, 0, 46, UH, 0.62)
    p.noise(132, 0, 46, UH, 0.6, 120, 1.5)
    const rY = mina ? 26 : 44, mY = mina ? 80 : 88
    if (p.on('detail')) {
      p.line(138, rY, 176, rY, 1.2, 0.18); p.text('R 5\'11"', 152, rY - 6, 9, 0.18, { align: 'center' }); p.text('1978', 186, rY, 6, 0.2, { align: 'center' })
      p.line(138, mY, 176, mY, 1.2, 0.18); p.text("M 5'3\"", 154, mY - 6, 10, 0.18, { font: 'hand', align: 'center' }); p.text('1978', 186, mY, 6, 0.2, { font: 'hand', align: 'center' })
    }
    if (prm.mina) p.figure(112, 200, 108, 0.5, { face: 0.6, hair: 'bob', coat: 0.7, armUp: true })
    if (prm.hand) { p.poly([300, 40, 210, 36, 184, 28, 182, 34, 206, 42, 300, 52], 0.55) }
  } else if (kind === 'window') {
    p.rect(0, 0, UW, UH, 0.04); p.rect(80, 20, 140, 150, 2.5); p.rect(148, 20, 4, 150, 0.05); p.rect(80, 92, 140, 4, 0.05)
    p.figure(160, 200, 150, 0.03, { hair: 'bob' })
    if (prm.rain) for (let i = 0; i < 80; i++) { const x = 82 + p.r() * 136, y = 22 + p.r() * 146; p.line(x, y, x, y + 3 + p.r() * 6, 0.6, 1.2) }
  } else if (kind === 'ruth') {
    p.rect(0, 0, UW, UH, 0.04); p.glow(250, 70, 90, 0.7); p.rect(0, 150, UW, 50, 0.2)
    p.figure(150, 190, 150, 0.15, { face: 0.5, hair: 'short', coat: 0.12, armUp: true }); p.ellipse(175, 52, 16, 20, 0.6)
  } else if (kind === 'coat') { p.rect(0, 0, UW, UH, 0.4); p.rect(140, 20, 20, 8, 0.1); p.poly([130, 26, 170, 26, 186, 190, 114, 190], 0.04); p.rect(200, 0, 60, UH, 0.55) }
  else if (kind === 'bed') { p.rect(0, 0, UW, UH, 0.3); p.rect(30, 100, 200, 90, 0.6); p.ellipse(70, 105, 30, 12, 0.75); p.ellipse(140, 105, 30, 12, 0.75); p.rect(240, 100, 50, 50, 0.2); p.rect(250, 90, 30, 12, 0.08) }
  else if (kind === 'shelf') { p.rect(0, 0, UW, UH, 0.35); p.rect(20, 110, 260, 6, 0.15); for (let i = 0; i < 7; i++) { p.rect(30 + i * 36, 70, 30, 40, 0.5); p.rect(32 + i * 36, 86, 26, 8, 0.75); p.text('PAN 400 — R.K.', 45 + i * 36, 90, 3, 0.1, { align: 'center', width: 24 }) } }
  else { p.rect(0, 0, UW, UH, 0.35); p.rect(0, 120, UW, 80, 0.25); p.rect(110, 60, 70, 8, 0.1); p.rect(110, 68, 8, 70, 0.1); p.rect(172, 68, 8, 70, 0.1); p.rect(110, 100, 70, 6, 0.1) }
}

function dock(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  if (kind === 'day') {
    p.rect(0, 0, UW, 60, 0.7); p.rect(0, 60, UW, 80, 0.25); p.rect(60, 70, 140, 70, 0.15); for (let y = 72; y < 140; y += 5) p.rect(60, y, 140, 0.8, 0.22)
    p.rect(220, 60, 6, 20, 0.1); p.rect(210, 56, 20, 6, 0.3)
    p.rect(0, 140, UW, 20, 0.45); p.rect(0, 160, UW, 40, 0.3); p.figure(150, 140, 50, 0.4, { face: 0.6, hair: 'bob', armUp: true })
  } else if (kind === 'night') {
    p.rect(0, 0, UW, UH, 0.01)
    p.rect(60, 50, 140, 50, 0.004); p.vgrad(60, 50, 140, 50, 0.3, 0.12); p.rect(60, 100, 140, 40, 0.006)
    p.glow(230, 40, 120, 0.6, 0.8); p.circle(230, 34, 3, 6)
    p.rect(0, 140, UW, 60, 0.04)
    p.rect(206, 106, 22, 30, 0.05); p.rect(210, 102, 8, 5, 0.05)
    if (p.on('detail')) { p.ellipse(132, 154, 6, 11, 0.012); p.ellipse(132, 168, 5, 4, 0.012); p.line(128, 165, 137, 172, 0.9, 0.04) }
  } else {
    p.rect(0, 0, UW, UH, 0.008); p.glow(40, 30, 140, 0.25)
    p.poly([0, 200, 100, 120, 200, 120, 300, 200], 0.012)
    p.carRear(150, 116, 36, 0.01, 0.35, 0.04)
  }
}

function street(p: Painter, prm: Record<string, unknown>): void {
  const kind = prm.kind as string
  const wetRoad = () => { p.rect(0, 150, UW, 50, 0.006); for (let i = 0; i < 30; i++) p.rect(p.r() * UW, 155 + p.r() * 45, 1 + p.r() * 4, 6 + p.r() * 14, 0.03) }
  const sodium = (x: number, y: number, r = 50, L = 0.5) => { p.glow(x, y + r * 0.6, r, L * 0.3, 1.2); p.circle(x, y, 2.5, 4); p.glow(x, y, 8, 1.5) }
  if (kind === 'lantern' || kind === 'envelope') {
    const close = kind === 'envelope'
    p.rect(0, 0, UW, UH, 0.004)
    const [x0, y0, w, h] = close ? [10, 30, 280, 150] : [50, 60, 200, 90]
    p.rect(x0, y0, w, h, 0.04)
    if (!close) { p.rect(70, 30, 160, 20, 0.004); p.text('THE LANTERN · OPEN ALL NIGHT', 150, 40, 10, 1.0, { align: 'center', width: 150 }) }
    const s = close ? 1.9 : 1
    p.figure(x0 + w * 0.32, y0 + h, 70 * s, 0.012, { face: 0.03, hair: 'cap' })
    p.figure(x0 + w * 0.68, y0 + h, 66 * s, 0.015, { face: 0.035, hair: 'bald', wide: 1.4 })
    p.rect(x0, y0 + h * 0.7, w, h * 0.3, 0.02)
    if (close && p.on('detail')) { p.rect(128, 106, 62, 18, 0.045); p.rect(128, 106, 62, 3, 0.03); p.line(190, 115, 220, 110, 6, 0.03) }
    wetRoad()
  } else if (kind === 'haleLamp') {
    p.rect(0, 0, UW, UH, 0.003); sodium(150, 20, 80, 0.4)
    p.figure(150, 200, 170, 0.008, { face: 0.008, hair: 'cap', coat: 0.006 })
    if (p.on('detail')) { p.ellipse(151, 62, 11, 14, 0.03); p.ellipse(147, 58, 1.6, 1, 0.012); p.ellipse(156, 58, 1.6, 1, 0.012); p.rect(146, 68, 10, 1.2, 0.012) }
    p.poly([130, 72, 172, 72, 166, 90, 136, 90], 0.006)
  } else if (kind === 'plate') {
    p.rect(0, 0, UW, UH, 0.003); sodium(80, 20, 70, 0.3)
    p.carRear(150, 128, 48, 0.006, 0.05, 0.01); wetRoad()
  } else if (kind === 'corran' || kind === 'office' || kind === 'leaving') {
    p.rect(0, 0, UW, UH, 0.008); for (let y = 0; y < UH; y += 8) p.rect(0, y, UW, 0.6, 0.012)
    if (kind === 'office') {
      p.rect(70, 30, 160, 110, 0.6)
      p.figure(120, 140, 100, 0.2, { face: 0.4, hair: 'cap' }); p.figure(190, 140, 90, 0.25, { face: 0.45, hair: 'short' })
      p.rect(110, 98, 110, 10, 0.4)
      p.glow(170, 98, 26, 1.3, 0.6)
      p.rect(140, 94, 44, 12, 0.85)
      if (p.on('detail')) { p.text('SALLOW VALLEY — FIRE 16.2.79', 162, 96.6, 2.6, 1.3, { align: 'center', width: 41 }); p.text('— PAID', 165, 102, 8, 2.0, { align: 'center', width: 38, weight: 800 }) }
    } else {
      p.rect(60, 40, 180, 70, 0.08); p.text('CORRAN MUTUAL · INSURANCE · CLAIMS', 150, 75, 12, 0.6, { align: 'center', width: 170 })
      if (kind === 'leaving') p.figure(150, 190, 120, 0.01, { hair: 'cap' })
    }
    wetRoad()
  } else if (kind === 'windscreen') {
    p.rect(0, 0, UW, UH, 0.003)
    p.poly([20, 40, 280, 40, 300, 140, 0, 140], 0.006)
    p.glow(60, 120, 50, 3); p.circle(60, 120, 10, 8); p.glow(240, 120, 50, 3); p.circle(240, 120, 10, 8)
    p.figure(150, 160, 120, 0.004, { face: 0.008, hair: 'cap' })
    if (p.on('detail')) { p.ellipse(150, 82, 15, 19, 0.02); p.ellipse(144, 77, 2.4, 1.4, 0.006); p.ellipse(157, 77, 2.4, 1.4, 0.006); p.rect(143, 91, 14, 1.6, 0.007) }
  } else if (kind === 'river' || kind === 'riverBlur') {
    p.vgrad(0, 0, UW, 100, kind === 'river' ? 0.4 : 0.02, 0.1); p.rect(0, 100, UW, 60, 0.06); p.rect(0, 120, UW, 3, 0.3); p.rect(0, 160, UW, 40, 0.15)
    for (let x = 0; x < UW; x += 20) p.rect(x, 112, 2, 48, 0.25)
    if (kind === 'river') p.figure(170, 122, 60, 0.3, { face: 0.5, hair: 'bob' })
    else { p.glow(250, 70, 60, 3); p.rect(220, 50, 60, 50, 1.5) }
  } else {
    p.rect(0, 0, UW, UH, 0.004); sodium(60 + p.r() * 180, 30, 60, 0.3); wetRoad()
    if (kind === 'haleBack') p.figure(150, 190, 140, 0.01, { hair: 'cap' })
    if (kind === 'tail') p.carRear(150, 140, 30, 0.006, 0.02, 0.006, 'KDL 417', { lamps: 0.6 })
    if (kind === 'puddle') { p.ellipse(150, 170, 80, 16, 0.02); p.text('THE LANTERN', 150, 172, 14, 0.3, { align: 'center', mirror: true }) }
    if (kind === 'rain') for (let i = 0; i < 200; i++) { const x = p.r() * UW, y = p.r() * UH; p.line(x, y, x - 1, y + 9, 0.4, 0.03) }
  }
}

function copystand(p: Painter, prm: Record<string, unknown>, rec: FrameRecipe): void {
  p.rect(0, 0, UW, UH, 0.015)
  const kind = prm.print as string
  if (kind === 'negstrip') {
    p.rect(0, 0, UW, UH, 0.95)
    p.rect(0, 70, UW, 64, 0.03)
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 50
      p.rect(x, 78, 46, 48, 0.6)
      for (let k = 0; k < 4; k++) { p.rect(x + 4 + k * 11, 71, 5, 4, 0.95); p.rect(x + 4 + k * 11, 129, 5, 4, 0.95) }
      if (i === 2) { // Heron #14 in negative: the plate reads KDL 417 tiny, white on black
        p.rect(x, 78, 46, 48, 0.7); p.rect(x + 6, 110, 10, 8, 0.15)
        p.rect(140, 89, 24, 9, 0.6)
        p.rect(144, 92, 18, 6, 0.012)
        if (p.on('detail')) p.text('KDL 417', 153, 95, 2.4, 0.6, { align: 'center', width: 16 })
      }
    }
    return
  }
  // a glossy 5 × 7 print with white borders, lying flat, and the 15 cm rule
  const x0 = 36, y0 = 16, w = 228, h = 156
  p.rect(x0, y0, w, h, 0.8)
  const ix = x0 + 10, iy = y0 + 10, iw = w - 20, ih = h - 20
  const g = p.g
  g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip()
  if (kind === 'envelope') {
    p.rect(ix, iy, iw, ih, 0.7)
    const lines = ['SALLOW VALLEY PHOTOFINISHING', 'ORDER No. 4471', 'NAME: Odgers, C.', '1 × 24 exp · Dev + Print', 'Ready: 16 Feb']
    lines.forEach((s, i) => p.text(s, ix + 12, iy + 20 + i * 24, i === 0 ? 11 : 15, 0.06, { font: i === 0 ? 'caps' : 'hand', width: iw - 20 }))
  } else {
    // night scene: the river, the floodlit tannery wall, the yard lamp
    p.rect(ix, iy, iw, ih, 0.02)
    p.rect(ix, iy + 20, iw, 60, 0.12); for (let y = iy + 22; y < iy + 80; y += 5) p.rect(ix, y, iw, 0.6, 0.15)
    p.circle(ix + iw * 0.62, iy + 26, 3, 0.8); p.glow(ix + iw * 0.62, iy + 40, 50, 0.25)
    p.rect(ix, iy + 110, iw, 26, 0.05)
    if (kind === 'heron9') {
      p.path([ix, iy + 120, ix + iw, iy + 108], 7, 0.015)
      p.ellipse(ix + 100, iy + 85, 16, 22, 0.55); p.ellipse(ix + 92, iy + 64, 8, 7, 0.6); p.line(ix + 85, iy + 64, ix + 70, iy + 68, 2, 0.5)
    } else if (kind === 'heron14') {
      p.path([ix, iy + 128, ix + 80, iy + 122], 4, 0.015); p.ellipse(ix + 36, iy + 112, 6, 9, 0.5)
      // the black saloon side-on under the yard lamp, rear plate toward the camera
      const cx = x0 + 0.62 * w - 30, cy = 2 * 0.46 * 100 - 6
      p.poly([cx - 40, cy + 12, cx - 40, cy - 6, cx - 24, cy - 18, cx + 20, cy - 18, cx + 36, cy - 6, cx + 44, cy + 12], 0.04)
      p.circle(cx - 26, cy + 13, 6, 0.02); p.circle(cx + 26, cy + 13, 6, 0.02)
      // glare hotspot of the copy lamp over the car and plate
      p.glow(UW * 0.62, 92, 34, 0.92, 0.7); p.ellipse(UW * 0.62, 92, 22, 11, 0.92)
      p.rect(UW * 0.62 - 15, 88, 30, 9, 0.95)
      if (p.on('plateText')) p.text('KDL 417', UW * 0.62, 92.6, 6.4, 0.65, { align: 'center', width: 27, weight: 800 })
    } else if (kind === 'heron15') {
      p.ellipse(ix + 20, iy + 14, 22, 5, 0.3)
      p.rect(ix + 92, iy + 46, 90, 90, 0.008)
      if (p.on('detail')) {
        p.figure(180, 150, 64, 0.02, { hair: 'cap', face: 0.02, coat: 0.02 })
        p.rect(160, 122, 11, 13, 0.022); p.rect(190, 122, 11, 13, 0.022)
        p.ellipse(188, 149, 5, 3, 0.02)
      }
    }
  }
  g.restore()
  p.rect(x0, y0 + h + 6, 160, 8, 0.6); for (let i = 0; i <= 15; i++) p.rect(x0 + (i * 160) / 15.5, y0 + h + 6, 0.6, 3, 0.1)
  p.glow(30, 20, 40, 0.06); p.glow(270, 180, 40, 0.06)
  void rec
}

function handover(p: Painter): void {
  p.rect(0, 0, UW, UH, 0.01)
  p.line(40, 170, 260, 40, 14, 0.5); p.line(40, 170, 260, 40, 6, 0.6)
  p.ellipse(120, 130, 28, 18, 0.12, -0.5); p.ellipse(190, 84, 18, 12, 0.1, -0.5)
}

function dark(p: Painter, prm: Record<string, unknown>): void {
  p.rect(0, 0, UW, UH, 0.003)
  if (prm.sliver) { p.poly([270, 0, 300, 0, 300, 30], 0.4); p.glow(296, 4, 20, 1.5) }
}

function unexposed(p: Painter): void { p.rect(0, 0, UW, UH, 0) }

const JAR = ['snowdrops', 'daffodils', 'bluebells', 'roses', 'sweet peas', 'empty', 'one apple', 'red leaves', 'nothing', 'holly', 'nothing', 'snowdrops']
function windowT(p: Painter, prm: Record<string, unknown>, rec: FrameRecipe): void {
  const n = prm.month as number
  const month = (2 + n - 1) % 12 // 0 = Jan; n = 1 is March 1984
  const night = n === 36
  const dx = (p.r() - 0.5) * 6, dy = (p.r() - 0.5) * 4
  const g = p.g
  g.save(); g.translate(dx, dy)
  p.rect(-10, -10, UW + 20, UH + 20, night ? 0.03 : 0.12)
  const out = night ? 0.004 : 0.6 - (0.45 * (n - 1)) / 35
  const wx = 60, wy = 22, ww = 180, wh = 132
  // outside: sea gradient, harbour wall, rooftops (snow Dec–Feb), trees
  g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip()
  p.vgrad(wx, wy, ww, wh, out * 0.9, out * 0.6)
  if (!night) {
    p.rect(wx, wy + 80, ww, 6, out * 0.4)
    for (let i = 0; i < 6; i++) { const rx = wx + i * 32; p.poly([rx, wy + 80, rx + 14, wy + 62 - (i % 2) * 6, rx + 30, wy + 80], out * 0.35); if (month === 11 || month <= 1) p.poly([rx + 6, wy + 72, rx + 14, wy + 63 - (i % 2) * 6, rx + 22, wy + 72], out * 1.3) }
    const leaves = month >= 3 && month <= 9
    p.line(wx + 150, wy + wh, wx + 150, wy + 50, 3, out * 0.25)
    if (leaves) p.circle(wx + 150, wy + 50, 22, out * 0.3)
    else for (let i = 0; i < 6; i++) p.line(wx + 150, wy + 60, wx + 130 + i * 8, wy + 36, 0.8, out * 0.25)
  } else {
    // the night window is a mirror: the room behind, a lamp, a small woman holding a camera
    p.glow(wx + 30, wy + 30, 30, 0.12); p.circle(wx + 30, wy + 30, 4, 0.3)
    if (p.on('detail')) {
      g.save(); g.translate(UW, 0); g.scale(-1, 1)
      p.figure(UW - (wx + 90), wy + wh + 20, 120, 0.03, { face: 0.04, hair: 'bob', coat: 0.03 })
      p.rect(UW - (wx + 90) - 9, wy + 62, 18, 12, 0.012); p.path([UW - (wx + 90) - 12, wy + 58, UW - (wx + 90) - 2, wy + 90, UW - (wx + 90) + 12, wy + 58], 1.4, 0.06)
      p.text('M', UW - (wx + 90) + 30, wy + 40, 1, 0.003)
      g.restore()
    }
  }
  g.restore()
  // frame, sash bar, sill, jar and card
  p.rect(wx - 6, wy - 6, ww + 12, 6, 0.25); p.rect(wx - 6, wy, 6, wh, 0.25); p.rect(wx + ww, wy, 6, wh, 0.25); p.rect(wx, wy + wh / 2 - 2, ww, 4, 0.25); p.rect(wx + ww / 2 - 2, wy, 4, wh, 0.25)
  p.rect(wx - 16, wy + wh, ww + 32, 10, 0.3)
  p.rect(126, wy + wh - 24, 18, 24, night ? 0.06 : 0.2)
  const jar = JAR[month]
  if (jar !== 'empty' && jar !== 'nothing') for (let i = 0; i < 4; i++) p.circle(130 + i * 4, wy + wh - 30 - (i % 2) * 5, 3, jar === 'holly' ? 0.08 : 0.45)
  p.rect(150, wy + wh - 18, 24, 18, night ? 0.1 : 0.7)
  const card = n === 12 ? 'R. — 6' : n === 24 ? 'R. — 7' : n === 36 ? 'R. — 8' : 'R.'
  p.text(card, 162, wy + wh - 9, n % 12 === 0 ? 5.5 : 8, 0.05, { font: 'hand', align: 'center' })
  g.restore()
  void rec
}

const TEMPLATES: Record<string, Paint> = {
  slate, shopfront, interior, closeup, shadow, fogged, yard, step, alley, van, party, plant, diner, bus, flat, dock, street, copystand, handover, dark, unexposed, window: windowT,
}

/** Paint a recipe into a canvas whose transform maps user space (0..300, 0..200) to pixels. */
export function paintFrame(g: CanvasRenderingContext2D, rec: FrameRecipe, hidden: Set<string> = new Set()): void {
  const fn = TEMPLATES[rec.template] ?? fogged
  const p = new Painter(g, mulberry32(rec.seed), hidden)
  fn(p, rec.params, rec)
}

/** Roll 9 F1 and F3 have camera shake; Roll 7 F9 and F11 are rolled (Mina running). */
export function postEffects(rec: FrameRecipe): { shake: number; rollDeg: number; blur: number; motion: number } {
  let shake = 0, rollDeg = 0, blur = 0, motion = 0
  if (rec.roll === 9 && (rec.frame === 1 || rec.frame === 3)) shake = 3
  if (rec.roll === 7 && rec.frame === 9) rollDeg = 6
  if (rec.roll === 7 && rec.frame === 11) { rollDeg = 15; blur = 4 }
  if (rec.roll === 7 && rec.frame === 10) motion = 0.006
  if (rec.roll === 4 && rec.template === 'party') motion = 0
  return { shake, rollDeg, blur, motion }
}

// O.'s negatives (darkroom.md §6.2). Each is drawn as a grayscale positive on a
// seeded Canvas2D, blurred slightly, grained, then converted to transmission
// T = 0.56·10^(−1.05·L).
import { fbm, gauss, mulberry32, type Rng } from '../sim/rng'
import type { Negative } from '../types'

export const NEG_W = 256
export const NEG_H = 320

type Ctx = CanvasRenderingContext2D
const g = (L: number) => { const v = Math.round(Math.max(0, Math.min(1, L)) * 255); return `rgb(${v},${v},${v})` }

function mailbox(c: Ctx, r: Rng, W: number, H: number) {
  const sky = c.createLinearGradient(0, 0, 0, H * 0.55)
  sky.addColorStop(0, g(0.85)); sky.addColorStop(1, g(0.65))
  c.fillStyle = sky; c.fillRect(0, 0, W, H)
  // house wall + doorway (right)
  c.fillStyle = g(0.55); c.fillRect(W * 0.62, H * 0.12, W * 0.38, H * 0.6)
  c.fillStyle = g(0.12); c.fillRect(W * 0.72, H * 0.28, W * 0.2, H * 0.44)
  c.fillStyle = g(0.3); c.fillRect(W * 0.7, H * 0.26, W * 0.24, H * 0.025)
  // ground
  c.fillStyle = g(0.42); c.fillRect(0, H * 0.72, W, H * 0.28)
  // picket fence
  for (let x = -4; x < W * 0.62; x += 18) {
    c.fillStyle = g(0.8)
    c.beginPath(); c.moveTo(x, H * 0.72); c.lineTo(x, H * 0.5); c.lineTo(x + 6, H * 0.47); c.lineTo(x + 12, H * 0.5); c.lineTo(x + 12, H * 0.72); c.fill()
  }
  c.fillStyle = g(0.75); c.fillRect(0, H * 0.54, W * 0.62, 6); c.fillRect(0, H * 0.66, W * 0.62, 6)
  // post + mailbox
  c.fillStyle = g(0.3); c.fillRect(W * 0.3, H * 0.42, 10, H * 0.38)
  c.fillStyle = g(0.35)
  c.beginPath(); c.moveTo(W * 0.18, H * 0.42); c.lineTo(W * 0.18, H * 0.34); c.quadraticCurveTo(W * 0.27, H * 0.26, W * 0.36, H * 0.34); c.lineTo(W * 0.36, H * 0.42); c.closePath(); c.fill()
  for (let i = 0; i < 14; i++) {
    c.fillStyle = r() < 0.5 ? g(0.2) : g(0.5)
    c.globalAlpha = 0.5
    c.beginPath(); c.arc(W * (0.19 + 0.16 * r()), H * (0.33 + 0.08 * r()), 2 + 4 * r(), 0, 7); c.fill()
  }
  c.globalAlpha = 1
  c.fillStyle = g(0.9); c.fillRect(W * 0.36, H * 0.3, 4, H * 0.08); c.fillRect(W * 0.36, H * 0.3, 14, 9)
  c.fillStyle = g(0.15); c.font = 'bold 14px sans-serif'; c.fillText('16', W * 0.24, H * 0.4)
}

function pear(c: Ctx, _r: Rng, W: number, H: number) {
  c.fillStyle = g(0.95); c.fillRect(0, 0, W, H * 0.6)
  c.fillStyle = g(0.2)
  c.fillRect(0, H * 0.28, W, 8); c.fillRect(W * 0.48, 0, 8, H * 0.6); c.fillRect(0, H * 0.58, W, 12)
  c.fillStyle = g(0.45); c.fillRect(0, H * 0.6, W, H * 0.4)
  c.fillStyle = g(0.1); c.beginPath(); c.ellipse(W * 0.6, H * 0.84, W * 0.24, H * 0.05, 0, 0, 7); c.fill()
  const gr = c.createRadialGradient(W * 0.42, H * 0.66, 4, W * 0.5, H * 0.74, W * 0.24)
  gr.addColorStop(0, g(0.92)); gr.addColorStop(0.2, g(0.7)); gr.addColorStop(1, g(0.25))
  c.fillStyle = gr
  c.beginPath(); c.ellipse(W * 0.5, H * 0.76, W * 0.17, H * 0.1, 0, 0, 7); c.fill()
  c.beginPath(); c.ellipse(W * 0.5, H * 0.63, W * 0.1, H * 0.08, 0, 0, 7); c.fill()
  c.strokeStyle = g(0.15); c.lineWidth = 4; c.beginPath(); c.moveTo(W * 0.5, H * 0.56); c.lineTo(W * 0.53, H * 0.5); c.stroke()
}

function dishRack(c: Ctx, r: Rng, W: number, H: number) {
  c.fillStyle = g(0.97); c.fillRect(0, 0, W, H)
  c.fillStyle = g(0.15); c.fillRect(0, H * 0.72, W, H * 0.28)
  for (let i = 0; i < 6; i++) {
    const x = W * (0.14 + i * 0.12)
    c.fillStyle = g(0.95); c.beginPath(); c.ellipse(x, H * 0.5, 14, H * 0.2, 0.08 * (i - 3), 0, 7); c.fill()
    c.fillStyle = g(0.6); c.beginPath(); c.ellipse(x, H * 0.5, 10, H * 0.17, 0.08 * (i - 3), 0, 7); c.fill()
  }
  c.strokeStyle = g(0.25); c.lineWidth = 3
  for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(W * (0.08 + i * 0.12), H * 0.7); c.lineTo(W * (0.08 + i * 0.12), H * 0.38); c.stroke() }
  for (let i = 0; i < 2; i++) { c.fillStyle = g(0.5); c.fillRect(W * (0.25 + i * 0.4), H * 0.6, 26, 30); c.fillStyle = g(0.9); c.fillRect(W * (0.25 + i * 0.4) + 3, H * 0.6, 4, 30) }
  for (let i = 0; i < 30; i++) { c.fillStyle = g(1); c.beginPath(); c.arc(W * r(), H * (0.72 + 0.25 * r()), 1 + r() * 1.5, 0, 7); c.fill() }
}

function cat(c: Ctx, _r: Rng, W: number, H: number) {
  c.fillStyle = g(0.5); c.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += 16) { c.fillStyle = g(0.3); c.fillRect(x, H * 0.45, 8, H * 0.45); c.fillStyle = g(0.55); c.fillRect(x + 8, H * 0.45, 8, H * 0.45) }
  c.fillStyle = g(0.62); c.fillRect(0, H * 0.4, W, H * 0.06)
  c.fillStyle = g(0.08)
  c.beginPath(); c.ellipse(W * 0.5, H * 0.34, W * 0.3, H * 0.09, 0, 0, 7); c.fill()
  c.beginPath(); c.ellipse(W * 0.26, H * 0.3, W * 0.1, H * 0.07, 0, 0, 7); c.fill()
  c.beginPath(); c.moveTo(W * 0.18, H * 0.26); c.lineTo(W * 0.19, H * 0.19); c.lineTo(W * 0.24, H * 0.25); c.fill()
  c.beginPath(); c.moveTo(W * 0.28, H * 0.25); c.lineTo(W * 0.32, H * 0.19); c.lineTo(W * 0.34, H * 0.26); c.fill()
  c.fillStyle = g(0.18); c.beginPath(); c.ellipse(W * 0.26, H * 0.31, W * 0.06, H * 0.04, 0, 0, 7); c.fill()
  c.fillStyle = g(0.7); c.fillRect(W * 0.225, H * 0.295, 5, 3); c.fillRect(W * 0.27, H * 0.295, 5, 3)
}

function busShelter(c: Ctx, r: Rng, W: number, H: number) {
  c.fillStyle = g(0.03); c.fillRect(0, 0, W, H)
  c.fillStyle = g(0.95); c.fillRect(W * 0.3, H * 0.3, W * 0.45, H * 0.4)
  c.fillStyle = g(0.6); c.fillRect(W * 0.28, H * 0.27, W * 0.49, H * 0.04)
  c.fillStyle = g(0.05)
  c.beginPath(); c.ellipse(W * 0.5, H * 0.43, 10, 12, 0, 0, 7); c.fill()
  c.fillRect(W * 0.5 - 13, H * 0.46, 26, H * 0.22)
  c.fillStyle = g(0.3); c.fillRect(0, H * 0.75, W, 3)
  c.strokeStyle = 'rgba(200,200,200,0.5)'; c.lineWidth = 1
  for (let i = 0; i < 90; i++) { const x = W * r(), y = H * r(); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 14); c.stroke() }
}

function fireEscape(c: Ctx, r: Rng, W: number, H: number) {
  const img = c.createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const brick = ((Math.floor(y / 8) % 2) * 8 + x) % 22 < 1.5 || y % 8 < 1 ? 0.25 : 0.4 + 0.2 * (fbm(x / 9, y / 5, 3) - 0.5)
    const v = Math.round(brick * 255); const o = (y * W + x) * 4
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255
  }
  c.putImageData(img, 0, 0)
  c.strokeStyle = g(0.1); c.lineWidth = 7
  c.beginPath(); c.moveTo(0, H * 0.2); for (let i = 0; i < 5; i++) c.lineTo(i % 2 ? 0 : W * 0.7, H * (0.2 + i * 0.18)); c.stroke()
  c.strokeStyle = g(0.2); c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.2, H * 0.1); c.quadraticCurveTo(W * 0.6, H * 0.22, W, H * 0.12); c.stroke()
  for (let i = 0; i < 4; i++) {
    c.fillStyle = g(0.88 + 0.08 * r())
    const x = W * (0.3 + i * 0.16), y = H * (0.15 + 0.02 * i)
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 2); c.lineTo(x + 34, y + 44); c.lineTo(x - 2, y + 42); c.fill()
  }
}

function selfPortrait(c: Ctx, _r: Rng, W: number, H: number) {
  c.fillStyle = g(0.06); c.fillRect(0, 0, W, H)
  c.fillStyle = g(0.14); c.fillRect(W * 0.1, H * 0.08, W * 0.8, H * 0.8)
  c.fillStyle = g(0.03)
  c.beginPath(); c.ellipse(W * 0.5, H * 0.38, W * 0.13, H * 0.11, 0, 0, 7); c.fill()
  c.beginPath(); c.ellipse(W * 0.5, H * 0.78, W * 0.3, H * 0.22, 0, 0, 7); c.fill()
  c.fillStyle = g(0.25); c.fillRect(W * 0.38, H * 0.44, W * 0.24, H * 0.1)
  c.fillStyle = g(0.5); c.beginPath(); c.arc(W * 0.5, H * 0.49, 10, 0, 7); c.fill()
  c.fillStyle = g(0.95); c.beginPath(); c.arc(W * 0.78, H * 0.18, 4, 0, 7); c.fill()
}

function titleSheet(c: Ctx, r: Rng, W: number, H: number) {
  mailbox(c, r, W, H)
  c.fillStyle = g(0.02); c.fillRect(0, H * 0.62, W, H * 0.22)
  c.fillStyle = g(1)
  c.font = '900 52px "Archivo Variable", "Archivo", "Arial Black", Impact, sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.save(); c.translate(W / 2, H * 0.73); c.scale(0.62, 1.15); c.fillText('DARKROOM', 0, 0); c.restore()
}

function testCard(c: Ctx, _r: Rng, W: number, H: number) {
  for (let i = 0; i < 21; i++) { c.fillStyle = g(Math.pow(10, -0.15 * i)); c.fillRect((i * W) / 21, 0, W / 21 + 1, H * 0.5) }
  const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, g(0)); gr.addColorStop(1, g(1))
  c.fillStyle = gr; c.fillRect(0, H * 0.5, W, H * 0.15)
  c.fillStyle = g(1); c.fillRect(0, H * 0.65, W, H * 0.35)
  c.fillStyle = g(0)
  for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI * 2; c.beginPath(); c.moveTo(W / 2, H * 0.83); c.arc(W / 2, H * 0.83, 50, a0, a0 + Math.PI / 24); c.fill() }
}

const RECIPES: { id: string; name: string; draw: (c: Ctx, r: Rng, W: number, H: number) => void; gate?: boolean; hidden?: boolean }[] = [
  { id: 'title', name: 'Title sheet', draw: titleSheet, hidden: true },
  { id: 'mailbox', name: 'Lantern St. mailbox', draw: mailbox },
  { id: 'pear', name: 'Pear on the sill', draw: pear },
  { id: 'dishrack', name: 'Dish rack in the window', draw: dishRack },
  { id: 'cat', name: 'Cat on a radiator', draw: cat },
  { id: 'bus', name: 'Bus shelter at night', draw: busShelter },
  { id: 'fire', name: 'Fire escape, laundry', draw: fireEscape },
  { id: 'self', name: 'Self-portrait in a dark window', draw: selfPortrait, gate: true },
  { id: 'testcard', name: 'Test card', draw: testCard, hidden: true },
]
export const NEGATIVE_LIST = RECIPES.map((r) => ({ id: r.id, name: r.name, gate: !!r.gate, hidden: !!r.hidden }))

/** Positive luminance (0..1) for a recipe, used by the light table, previews and the negative itself. */
export function drawPositive(id: string, seed = 7): Float32Array {
  const rec = RECIPES.find((r) => r.id === id) ?? RECIPES[1]
  const cv = document.createElement('canvas')
  cv.width = NEG_W; cv.height = NEG_H
  const c = cv.getContext('2d', { willReadFrequently: true }) as Ctx
  const r = mulberry32(seed * 7919 + rec.id.length * 131 + rec.id.charCodeAt(0))
  rec.draw(c, r, NEG_W, NEG_H)
  // 0.6 px blur
  const blurred = document.createElement('canvas')
  blurred.width = NEG_W; blurred.height = NEG_H
  const b = blurred.getContext('2d', { willReadFrequently: true }) as Ctx
  b.filter = 'blur(0.6px)'
  b.drawImage(cv, 0, 0)
  const d = b.getImageData(0, 0, NEG_W, NEG_H).data
  const out = new Float32Array(NEG_W * NEG_H)
  const gr = mulberry32(seed + 99)
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(1, d[i * 4] / 255 + 0.015 * gauss(gr)))
  return out
}

export function positiveToT(L: Float32Array): Float32Array {
  const T = new Float32Array(L.length)
  for (let i = 0; i < L.length; i++) T[i] = 0.56 * Math.pow(10, -1.05 * L[i])
  return T
}

export function buildNegative(id: string, seed = 7): Negative {
  const rec = RECIPES.find((r) => r.id === id) ?? RECIPES[1]
  const L = drawPositive(rec.id, seed)
  return { id: rec.id, name: rec.name, W: NEG_W, H: NEG_H, T: positiveToT(L), format: '35mm', source: 'builtin' }
}

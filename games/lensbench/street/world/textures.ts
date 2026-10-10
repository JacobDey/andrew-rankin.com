// Canvas textures and Read It strings for Lantern Street (lensbench.md §6.5). Deterministic per seed.
import * as THREE from 'three'
import { mulberry32, rngStream } from '@shared/core'

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas unavailable')
  return [c, g]
}
export function tex(c: HTMLCanvasElement, srgb = true, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping }
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

const SYL_A = ['KES', 'OLLA', 'VAN', 'MIR', 'TOR', 'BEL', 'HAL', 'QUIL', 'DRA', 'FEN', 'MOR', 'ARV']
const SYL_B = ['TRA', 'MEER', 'TOLL', 'DANE', 'WICK', 'ROSE', 'BURY', 'LOW', 'STEAD', 'VALE', 'HOLM', 'GATE']
const TITLES = ['THE GLASS HOUR', 'NIGHT FERRY', 'A QUIET ROOM', 'LAMPLIGHT', 'THE LONG EXPOSURE', 'NORTH WINDOW', 'SILVER RIVER', 'THE MILLER']

export interface StreetText {
  bakeryYear: string
  chalkboard: string
  clockName: string
  clockYear: string
  clockPlaque: string
  courierPlate: string
  marquee: string
}
export function streetText(seed: number): StreetText {
  const r = rngStream(seed >>> 0, 'readit')
  const yr = () => String(1890 + Math.floor(r() * 71))
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const letter = () => L[Math.floor(r() * L.length)]
  const name = SYL_A[Math.floor(r() * SYL_A.length)] + SYL_B[Math.floor(r() * SYL_B.length)]
  const clockYear = yr()
  return {
    bakeryYear: yr(),
    chalkboard: `RYE ${1 + Math.floor(r() * 9)}.${Math.floor(r() * 10)}0`,
    clockName: name,
    clockYear,
    clockPlaque: `${name} & SONS · ${clockYear}`,
    courierPlate: `${letter()}${letter()}-${10 + Math.floor(r() * 90)}${letter()}`,
    marquee: TITLES[Math.floor(r() * TITLES.length)],
  }
}

/** Facade texture: brick or plaster with a window grid. Returns colour + window-mask canvases. */
export function facadeTexture(seed: number, wM: number, hM: number, size: number): { col: HTMLCanvasElement; win: HTMLCanvasElement; brick: boolean } {
  const r = mulberry32(seed)
  const [c, g] = canvas(size, size)
  const [m, gm] = canvas(size, size)
  gm.fillStyle = '#000'; gm.fillRect(0, 0, size, size)
  const brick = r() < 0.5
  const hue = brick ? 8 + r() * 18 : 28 + r() * 22
  const sat = brick ? 38 + r() * 20 : 18 + r() * 22
  const lit = brick ? 34 + r() * 12 : 62 + r() * 16
  g.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`
  g.fillRect(0, 0, size, size)
  const pxM = size / Math.max(wM, hM)
  const sx = size / wM, sy = size / hM
  if (brick) {
    const bh = Math.max(2, 0.075 * sy), bw = 0.22 * sx
    for (let y = 0, row = 0; y < size; y += bh, row++) {
      for (let x = (row % 2) * -bw / 2; x < size; x += bw) {
        const v = (r() - 0.5) * 10
        g.fillStyle = `hsl(${hue + v * 0.4} ${sat}% ${lit + v}%)`
        g.fillRect(x + 1, y + 1, bw - 1.5, bh - 1.5)
      }
    }
  } else {
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,40,30'},${0.03 + r() * 0.05})`
      const s = 2 + r() * pxM * 0.6
      g.fillRect(r() * size, r() * size, s, s)
    }
  }
  // windows: storeys of 3.2 m, columns every ~2.2 m, skip the ground floor door band
  const storeys = Math.floor((hM - 0.8) / 3.2)
  const cols = Math.max(2, Math.floor(wM / 2.2))
  const ww = 0.9 * sx, wh = 1.5 * sy
  for (let s = 1; s < storeys; s++)
    for (let k = 0; k < cols; k++) {
      const cx = ((k + 0.5) / cols) * size
      const cy = size - (s * 3.2 + 1.5) * sy
      g.fillStyle = '#e8dcc6'
      g.fillRect(cx - ww / 2 - 3, cy - wh / 2 - 4, ww + 6, wh + 8) // lintel/sill
      g.fillStyle = '#1b2026'
      g.fillRect(cx - ww / 2, cy - wh / 2, ww, wh)
      g.fillStyle = 'rgba(160,190,210,0.25)'
      g.fillRect(cx - ww / 2, cy - wh / 2, ww, wh / 2)
      g.strokeStyle = '#d9cfbd'; g.lineWidth = Math.max(1, size / 256)
      g.beginPath(); g.moveTo(cx, cy - wh / 2); g.lineTo(cx, cy + wh / 2); g.moveTo(cx - ww / 2, cy); g.lineTo(cx + ww / 2, cy); g.stroke()
      if (r() < 0.45) { gm.fillStyle = '#fff'; gm.fillRect(cx - ww / 2, cy - wh / 2, ww, wh) }
    }
  // ground floor: door + shop window
  g.fillStyle = '#2a1d16'
  g.fillRect(size * 0.15, size - 2.4 * sy, 1.1 * sx, 2.4 * sy)
  g.fillStyle = '#20262c'
  g.fillRect(size * 0.45, size - 2.3 * sy, Math.min(size * 0.45, 3 * sx), 1.7 * sy)
  if (r() < 0.6) { gm.fillStyle = '#fff'; gm.fillRect(size * 0.45, size - 2.3 * sy, Math.min(size * 0.45, 3 * sx), 1.7 * sy) }
  // cornice
  g.fillStyle = 'rgba(240,230,210,0.6)'
  g.fillRect(0, 0, size, Math.max(3, 0.25 * sy))
  return { col: c, win: m, brick }
}

export function cobbleTexture(size: number): HTMLCanvasElement {
  const r = mulberry32(77)
  const [c, g] = canvas(size, size)
  g.fillStyle = '#5b5550'; g.fillRect(0, 0, size, size)
  const n = 16
  const s = size / n
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = 40 + r() * 30
      g.fillStyle = `rgb(${v + 18},${v + 14},${v + 10})`
      const ox = (y % 2) * s * 0.5
      g.beginPath()
      g.ellipse(x * s + ox + s / 2, y * s + s / 2, s * 0.44, s * 0.4, 0, 0, Math.PI * 2)
      g.fill()
    }
  return c
}

export function slabTexture(size: number): HTMLCanvasElement {
  const r = mulberry32(91)
  const [c, g] = canvas(size, size)
  g.fillStyle = '#8d877d'; g.fillRect(0, 0, size, size)
  const n = 4, s = size / n
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = 125 + r() * 25
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`
      g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2)
    }
  return c
}

/** Text on a sign. Returns a canvas sized to the aspect. */
export function signCanvas(text: string, o: { w: number; h: number; bg: string; fg: string; font: string; border?: string; sub?: string; subFont?: string }): HTMLCanvasElement {
  const [c, g] = canvas(o.w, o.h)
  g.fillStyle = o.bg; g.fillRect(0, 0, o.w, o.h)
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = Math.max(2, o.h * 0.05); g.strokeRect(g.lineWidth, g.lineWidth, o.w - 2 * g.lineWidth, o.h - 2 * g.lineWidth) }
  g.fillStyle = o.fg; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = o.font
  g.fillText(text, o.w / 2, o.sub ? o.h * 0.38 : o.h / 2)
  if (o.sub) { g.font = o.subFont ?? o.font; g.fillText(o.sub, o.w / 2, o.h * 0.74) }
  return c
}

/** The Lyric cinema chart: grid every 0.5 m, Siemens star, three text rows, marquee. 4×3 m. */
export function chartCanvas(size: number, marquee: string): HTMLCanvasElement {
  const W = size, H = Math.round(size * 0.75)
  const [c, g] = canvas(W, H)
  g.fillStyle = '#efeadf'; g.fillRect(0, 0, W, H)
  const px = W / 4
  g.strokeStyle = '#151515'; g.lineWidth = Math.max(1, 0.1 * px * 0.25)
  for (let x = 0; x <= 4.0001; x += 0.5) { g.beginPath(); g.moveTo(x * px, 0); g.lineTo(x * px, H); g.stroke() }
  for (let y = 0; y <= 3.0001; y += 0.5) { g.beginPath(); g.moveTo(0, y * px); g.lineTo(W, y * px); g.stroke() }
  // Siemens star
  const cx = W / 2, cy = H * 0.45, R = 0.9 * px
  g.fillStyle = '#efeadf'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#111'
  for (let i = 0; i < 36; i++) {
    const a0 = (i / 36) * Math.PI * 2, a1 = ((i + 0.5) / 36) * Math.PI * 2
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill()
  }
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'
  const rows = ['LYRIC · PICTURE HOUSE', 'MATINEE DAILY AT TWO', 'SEATS FROM NINEPENCE']
  rows.forEach((t, i) => { g.font = `bold ${Math.round(px * (0.16 - i * 0.03))}px "Arial Narrow", sans-serif`; g.fillText(t, cx, H * (0.8 + i * 0.065)) })
  g.fillStyle = '#7a1a14'; g.fillRect(0, 0, W, px * 0.42)
  g.fillStyle = '#fbe7b0'; g.font = `bold ${Math.round(px * 0.25)}px "Arial Narrow", sans-serif`
  g.fillText(marquee, cx, px * 0.22)
  return c
}

export function bladeNumberCanvas(n: number): HTMLCanvasElement {
  return signCanvas(String(n), { w: 64, h: 64, bg: '#e9e1cf', fg: '#1a1a1a', font: 'bold 52px "Arial Narrow", sans-serif' })
}

// The 1-bit screen: stations draw luminance (Canvas 2D, CSS-px coordinates) into a low-resolution layer
// at viewport / cell; one Bayer+IGN threshold pass maps it to the station's ink/paper pair; crisp text
// and the player's red ink are drawn on top at full resolution (GDD §7.1, §11.4).
import { getThresholdMap, hexToRgb } from '@shared/dither'

export const RED = '#C4202B'
export interface Pal { ink: string; light: string }

const grayCache: string[] = []
for (let i = 0; i <= 255; i++) grayCache.push(`rgb(${i},${i},${i})`)
/** CSS colour for a display luminance 0..1 in the luminance layer. */
export function gray(v: number): string { return grayCache[Math.max(0, Math.min(255, Math.round(v * 255)))] }

export class Screen {
  readonly canvas: HTMLCanvasElement
  readonly g: CanvasRenderingContext2D
  readonly lumCanvas: HTMLCanvasElement
  readonly lum: CanvasRenderingContext2D
  private small: HTMLCanvasElement
  private sg: CanvasRenderingContext2D
  private out: ImageData | null = null
  private tmap: Uint8Array
  cell = 2
  w = 1
  h = 1
  lw = 1
  lh = 1
  flash = 0 // 0..1 white blowout

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'li-canvas'
    parent.append(this.canvas)
    this.g = this.canvas.getContext('2d')!
    this.lumCanvas = document.createElement('canvas')
    this.lum = this.lumCanvas.getContext('2d', { willReadFrequently: true })!
    this.small = document.createElement('canvas')
    this.sg = this.small.getContext('2d')!
    this.tmap = getThresholdMap('bayer-ign', 64)
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, Math.round(w)); this.h = Math.max(1, Math.round(h))
    this.cell = Math.max(2, Math.min(4, Math.round(Math.min(this.w, this.h) / 360)))
    this.lw = Math.ceil(this.w / this.cell); this.lh = Math.ceil(this.h / this.cell)
    this.canvas.width = this.w; this.canvas.height = this.h
    this.lumCanvas.width = this.lw; this.lumCanvas.height = this.lh
    this.small.width = this.lw; this.small.height = this.lh
    this.out = this.sg.createImageData(this.lw, this.lh)
  }

  frame(pal: Pal, drawLum: (g: CanvasRenderingContext2D) => void, drawCrisp: (g: CanvasRenderingContext2D) => void): void {
    const L = this.lum
    L.setTransform(1, 0, 0, 1, 0, 0)
    L.fillStyle = '#000'; L.fillRect(0, 0, this.lw, this.lh)
    L.setTransform(1 / this.cell, 0, 0, 1 / this.cell, 0, 0)
    L.imageSmoothingEnabled = true
    drawLum(L)
    const src = L.getImageData(0, 0, this.lw, this.lh).data
    const out = this.out!
    const d = out.data
    const [ir, ig, ib] = hexToRgb(pal.ink).map((v) => Math.round(v * 255))
    const [lr, lg, lb] = hexToRgb(pal.light).map((v) => Math.round(v * 255))
    const fl = this.flash
    const tm = this.tmap
    for (let y = 0; y < this.lh; y++) {
      const row = (y & 63) << 6
      for (let x = 0; x < this.lw; x++) {
        const q = (y * this.lw + x) << 2
        let v = src[q]
        if (fl > 0) v = v + (255 - v) * fl
        const on = v >= 255 || v > tm[row | (x & 63)]
        d[q] = on ? lr : ir; d[q + 1] = on ? lg : ig; d[q + 2] = on ? lb : ib; d[q + 3] = 255
      }
    }
    this.sg.putImageData(out, 0, 0)
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.imageSmoothingEnabled = false
    g.drawImage(this.small, 0, 0, this.lw * this.cell, this.lh * this.cell)
    drawCrisp(g)
  }

  /** Fraction of canvas pixels within ΔE-ish 6 of ink or light (architecture §8 two-colour check). */
  twoColourCheck(pal: Pal): number {
    const d = this.g.getImageData(0, 0, this.w, this.h).data
    const a = hexToRgb(pal.ink).map((v) => v * 255), b = hexToRgb(pal.light).map((v) => v * 255)
    let ok = 0, n = 0
    for (let i = 0; i < d.length; i += 16) {
      n++
      const da = Math.hypot(d[i] - a[0], d[i + 1] - a[1], d[i + 2] - a[2]), db = Math.hypot(d[i] - b[0], d[i + 1] - b[1], d[i + 2] - b[2])
      if (Math.min(da, db) < 15) ok++
    }
    return ok / Math.max(1, n)
  }
}

/** Float image → grey canvas (for drawing negatives, prints and frames into the luminance layer). */
export function floatToCanvas(vals: Float32Array, w: number, h: number, map: (v: number) => number, c?: HTMLCanvasElement): HTMLCanvasElement {
  const cv = c ?? document.createElement('canvas')
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
  const g = cv.getContext('2d')!
  const img = g.createImageData(w, h)
  const d = img.data
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, Math.round(map(vals[i]) * 255))); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255 }
  g.putImageData(img, 0, 0)
  return cv
}

/** Crisp monospace text helper. */
export function crispText(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, o: { align?: CanvasTextAlign; weight?: number; font?: 'mono' | 'hand' | 'ui'; base?: CanvasTextBaseline; max?: number } = {}): void {
  const fam = o.font === 'hand' ? "'Caveat Variable', 'Caveat', cursive" : o.font === 'ui' ? "'Archivo Variable', Arial, sans-serif" : "'IBM Plex Mono', ui-monospace, monospace"
  g.font = `${o.weight ?? 500} ${size}px ${fam}`
  g.textAlign = o.align ?? 'left'; g.textBaseline = o.base ?? 'alphabetic'; g.fillStyle = color
  if (o.max) g.fillText(s, x, y, o.max); else g.fillText(s, x, y)
}

/** Wrap text to a width (monospace aware) — returns lines. */
export function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word
      if (g.measureText(t).width > width && line) { out.push(line); line = word } else line = t
    }
    out.push(line)
  }
  return out
}

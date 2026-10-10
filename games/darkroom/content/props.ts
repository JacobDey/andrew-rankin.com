// Photogram props (darkroom.md §6.3): 2D transmission masks, 0 = opaque.
import { mulberry32 } from '../sim/rng'
import type { PropMask } from '../types'

const S = 128

function canvasMask(draw: (c: CanvasRenderingContext2D) => void): Float32Array {
  const cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const c = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  c.fillStyle = '#fff'; c.fillRect(0, 0, S, S)
  draw(c)
  const d = c.getImageData(0, 0, S, S).data
  const T = new Float32Array(S * S)
  for (let i = 0; i < T.length; i++) T[i] = d[i * 4] / 255
  return T
}

function fern(): Float32Array {
  const r = mulberry32(5)
  return canvasMask((c) => {
    const grey = (t: number) => { const v = Math.round(t * 255); return `rgb(${v},${v},${v})` }
    const frond = (x: number, y: number, ang: number, len: number, depth: number) => {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len
      c.strokeStyle = grey(depth === 3 ? 0 : 0.15); c.lineWidth = depth === 3 ? 2.4 : 1.2
      c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke()
      if (depth === 0) {
        c.fillStyle = grey(0.25)
        c.beginPath(); c.ellipse(ex, ey, len * 0.6, len * 0.25, ang, 0, 7); c.fill()
        return
      }
      const n = depth === 3 ? 14 : 6
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1)
        const px = x + (ex - x) * t, py = y + (ey - y) * t
        const l = len * (depth === 3 ? 0.36 : 0.4) * (1 - t * 0.7) * (0.9 + 0.2 * r())
        frond(px, py, ang - 1.1, l, depth - 1)
        frond(px, py, ang + 1.1, l, depth - 1)
      }
    }
    frond(S * 0.5, S * 0.97, -Math.PI / 2 + 0.05, S * 0.9, 3)
  })
}

function key(): Float32Array {
  return canvasMask((c) => {
    c.fillStyle = '#000'
    c.beginPath(); c.arc(S * 0.5, S * 0.22, S * 0.15, 0, 7); c.fill()
    c.fillStyle = '#fff'; c.beginPath(); c.arc(S * 0.5, S * 0.22, S * 0.06, 0, 7); c.fill()
    c.fillStyle = '#000'
    c.fillRect(S * 0.46, S * 0.34, S * 0.08, S * 0.58)
    const teeth = [0.6, 0.68, 0.76, 0.84]
    teeth.forEach((t, i) => c.fillRect(S * 0.54, S * t, S * (0.06 + (i % 2) * 0.05), S * 0.05))
  })
}

function doily(): Float32Array {
  return canvasMask((c) => {
    c.fillStyle = 'rgb(13,13,13)'
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.48, 0, 7); c.fill()
    c.fillStyle = '#fff'
    for (let ring = 1; ring <= 4; ring++) {
      const rr = S * 0.1 * ring
      const k = 6 * ring
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + ring * 0.3
        c.beginPath(); c.arc(S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr, S * 0.028 + ring * 0.004 * S, 0, 7); c.fill()
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      c.beginPath(); c.arc(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48, S * 0.035, 0, 7); c.fill()
    }
  })
}

export function buildProps(): PropMask[] {
  return [
    { id: 'fern', name: 'Fern frond', W: S, H: S, T: fern(), sizeM: 0.17 },
    { id: 'key', name: 'Key', W: S, H: S, T: key(), sizeM: 0.07 },
    { id: 'doily', name: 'Lace doily', W: S, H: S, T: doily(), sizeM: 0.15 },
  ]
}

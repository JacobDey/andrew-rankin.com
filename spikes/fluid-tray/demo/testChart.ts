/**
 * Demo-only: draw the latent test print with Canvas 2D (a rusty mailbox at dusk, a step wedge, a Siemens
 * star, edge printing) and turn it into paper sensitivity S. Also: PNG import.
 */
import { latentFromLuminance, luminanceFromRGBA } from '../core/latent.ts'

export function drawTestPrint(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const u = w / 100
  // paper white (unexposed border)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  const ix = 5.5 * u
  const iy = 6 * u
  const iw = w - 2 * ix
  const ih = h - 2 * iy - 2 * u
  g.save()
  g.beginPath()
  g.rect(ix, iy, iw, ih)
  g.clip()
  // dusk sky: darker up top
  const sky = g.createLinearGradient(0, iy, 0, iy + ih * 0.7)
  sky.addColorStop(0, '#5a5a5a')
  sky.addColorStop(1, '#d8d8d8')
  g.fillStyle = sky
  g.fillRect(ix, iy, iw, ih)
  // sun, low
  const sun = g.createRadialGradient(ix + iw * 0.7, iy + ih * 0.52, 0, ix + iw * 0.7, iy + ih * 0.52, ih * 0.22)
  sun.addColorStop(0, '#ffffff')
  sun.addColorStop(0.35, '#f4f4f4')
  sun.addColorStop(1, 'rgba(240,240,240,0)')
  g.fillStyle = sun
  g.fillRect(ix, iy, iw, ih)
  // hills
  g.fillStyle = '#3c3c3c'
  g.beginPath()
  g.moveTo(ix, iy + ih * 0.66)
  for (let x = 0; x <= iw; x += 4) g.lineTo(ix + x, iy + ih * 0.66 - Math.sin(x / iw * 5.1 + 0.6) * ih * 0.05 - Math.sin(x / iw * 13) * ih * 0.012)
  g.lineTo(ix + iw, iy + ih)
  g.lineTo(ix, iy + ih)
  g.fill()
  // grass tufts
  g.strokeStyle = '#262626'
  g.lineWidth = Math.max(1, u * 0.25)
  for (let i = 0; i < 160; i++) {
    const x = ix + ((i * 37.3) % iw)
    const y = iy + ih * (0.7 + ((i * 13.7) % 25) / 100)
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + ((i % 5) - 2) * u * 0.4, y - u * (1 + (i % 3)))
    g.stroke()
  }
  // the mailbox: post, box, door, flag up
  const mx = ix + iw * 0.3
  const my = iy + ih * 0.62
  g.fillStyle = '#141414'
  g.fillRect(mx - 1.4 * u, my, 2.8 * u, ih * 0.38) // post
  g.beginPath() // box body with a rounded top
  g.moveTo(mx - 11 * u, my)
  g.lineTo(mx - 11 * u, my - 8 * u)
  g.arc(mx - 4 * u, my - 8 * u, 7 * u, Math.PI, 0)
  g.lineTo(mx + 3 * u, my)
  g.closePath()
  g.fill()
  // rust streaks / highlight on the curve
  g.strokeStyle = '#6e6e6e'
  g.lineWidth = 0.8 * u
  g.beginPath()
  g.arc(mx - 4 * u, my - 8 * u, 5.6 * u, Math.PI * 1.15, Math.PI * 1.55)
  g.stroke()
  g.fillStyle = '#4a4a4a'
  for (let i = 0; i < 9; i++) g.fillRect(mx - 10 * u + i * 1.4 * u, my - 6 * u + ((i * 7) % 5) * u * 0.6, 0.35 * u, (2 + (i % 3)) * u)
  // door outline
  g.strokeStyle = '#8a8a8a'
  g.lineWidth = 0.35 * u
  g.beginPath()
  g.moveTo(mx + 2.4 * u, my - 0.4 * u)
  g.lineTo(mx + 2.4 * u, my - 8 * u)
  g.stroke()
  // flag
  g.fillStyle = '#9a9a9a'
  g.fillRect(mx - 9.5 * u, my - 16 * u, 0.8 * u, 9 * u)
  g.fillRect(mx - 9.5 * u, my - 16 * u, 4 * u, 2.6 * u)
  // siemens star, upper left
  const sx = ix + iw * 0.12
  const sy = iy + ih * 0.2
  const sr = ih * 0.14
  g.fillStyle = '#fafafa'
  g.beginPath()
  g.arc(sx, sy, sr * 1.04, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#101010'
  for (let k = 0; k < 18; k++) {
    g.beginPath()
    g.moveTo(sx, sy)
    g.arc(sx, sy, sr, (k / 18) * Math.PI * 2, ((k + 0.5) / 18) * Math.PI * 2)
    g.closePath()
    g.fill()
  }
  g.restore()
  // step wedge just under the picture
  const wy = iy + ih + 0.6 * u
  const ww = iw * 0.55
  for (let k = 0; k < 11; k++) {
    const v = Math.round(255 * (1 - k / 10))
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(ix + (k * ww) / 11, wy, ww / 11 + 0.5, 1.6 * u)
  }
  // edge printing
  g.fillStyle = '#222'
  g.font = `${Math.round(1.7 * u)}px ui-monospace, Menlo, Consolas, monospace`
  g.textBaseline = 'top'
  g.textAlign = 'right'
  g.fillText('ANDREW-RANKIN.COM  ·  FLUID-TRAY TEST  ·  NIGHTJAR VARI-GRADE RC', ix + iw, wy + 0.1 * u)
  return c
}

/** Canvas (row 0 = top of picture) -> paper S at resX x resY. */
export function latentFromCanvas(c: HTMLCanvasElement, resX: number, resY: number, contrast = 1.3): Float32Array {
  const g = c.getContext('2d')!
  const img = g.getImageData(0, 0, c.width, c.height)
  const L = luminanceFromRGBA(img.data, c.width, c.height)
  return latentFromLuminance(L, c.width, c.height, resX, resY, contrast)
}

/** Fit any image into the sheet (centred, white border) and return S. */
export async function latentFromFile(file: Blob, resX: number, resY: number): Promise<Float32Array> {
  const bmp = await createImageBitmap(file)
  const w = resX * 2
  const h = resY * 2
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  const pad = 0.06
  const bw = w * (1 - 2 * pad)
  const bh = h * (1 - 2 * pad)
  const k = Math.min(bw / bmp.width, bh / bmp.height)
  const dw = bmp.width * k
  const dh = bmp.height * k
  g.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return latentFromCanvas(c, resX, resY, 1.2)
}

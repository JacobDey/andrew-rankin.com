// Seeded procedural canvas textures (darkroom.md §6.1).
import * as THREE from 'three'
import { fbm, hash2, mulberry32 } from '../sim/rng'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return [c, c.getContext('2d') as CanvasRenderingContext2D]
}
function tex(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
  return t
}

/** Bench laminate: warm grey with fbm wear and scratches. */
export function laminateTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256)
  const img = g.createImageData(512, 256)
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const n = fbm(x / 60, y / 30, 4) * 0.6 + fbm(x / 8, y / 8, 9) * 0.4
    const v = 0.36 + 0.1 * (n - 0.5) + 0.04 * (hash2(x, y, 3) - 0.5)
    const o = (y * 512 + x) * 4
    img.data[o] = Math.round(255 * v * 1.02); img.data[o + 1] = Math.round(255 * v * 0.97); img.data[o + 2] = Math.round(255 * v * 0.9); img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const r = mulberry32(4)
  g.strokeStyle = 'rgba(255,240,220,0.06)'
  for (let i = 0; i < 70; i++) { g.beginPath(); const x = r() * 512, y = r() * 256; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 10); g.stroke() }
  g.fillStyle = 'rgba(40,25,10,0.12)'
  for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(r() * 512, r() * 256, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, 7); g.fill() }
  return tex(c, [8, 1])
}

/** Painted pegboard wall. */
export function wallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#5a5048'; g.fillRect(0, 0, 256, 256)
  const img = g.getImageData(0, 0, 256, 256)
  for (let i = 0; i < 256 * 256; i++) { const n = (hash2(i % 256, (i / 256) | 0, 2) - 0.5) * 10; img.data[i * 4] += n; img.data[i * 4 + 1] += n; img.data[i * 4 + 2] += n }
  g.putImageData(img, 0, 0)
  g.fillStyle = '#2a241f'
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 256; x += 16) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill() }
  return tex(c, [24, 5])
}

export function corkTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 160)
  const img = g.createImageData(256, 160)
  for (let y = 0; y < 160; y++) for (let x = 0; x < 256; x++) {
    const n = hash2(x >> 1, y >> 1, 8)
    const v = 0.55 + 0.25 * (n - 0.5) + 0.1 * (fbm(x / 12, y / 12, 5) - 0.5)
    const o = (y * 256 + x) * 4
    img.data[o] = 255 * v; img.data[o + 1] = 200 * v; img.data[o + 2] = 130 * v; img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = '#3b2a1a'; g.lineWidth = 8; g.strokeRect(0, 0, 256, 160)
  return tex(c)
}

/** Masking-tape label with Caveat handwriting. */
export function tapeLabel(text: string, w = 256, h = 72, rot = -0.03): THREE.CanvasTexture {
  const [c, g] = canvas(w, h)
  g.translate(w / 2, h / 2); g.rotate(rot); g.translate(-w / 2, -h / 2)
  g.fillStyle = 'rgba(236,222,186,0.94)'
  g.beginPath()
  g.moveTo(6, 8); for (let x = 6; x < w - 6; x += 12) g.lineTo(x + 6, 6 + (x % 24 ? 2 : 0))
  g.lineTo(w - 4, h - 8); for (let x = w - 6; x > 6; x -= 12) g.lineTo(x - 6, h - 6 - (x % 24 ? 2 : 0))
  g.closePath(); g.fill()
  g.fillStyle = '#2a2016'
  g.font = `600 ${Math.round(h * 0.62)}px "Caveat Variable", "Caveat", "Segoe Print", cursive`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, w / 2, h / 2 + 2)
  return tex(c)
}

export function stencilLabel(lines: string[], w = 512, h = 256, bg = '#1c1a18', fg = '#e9e1cf'): THREE.CanvasTexture {
  const [c, g] = canvas(w, h)
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.fillStyle = fg
  g.textAlign = 'center'; g.textBaseline = 'middle'
  lines.forEach((l, i) => {
    const size = i === 0 ? h * 0.22 : h * 0.1
    g.font = `800 ${size}px "Archivo Variable", "Archivo", "Arial Narrow", sans-serif`
    g.save(); g.translate(w / 2, h * (0.3 + i * 0.22)); g.scale(0.75, 1); g.fillText(l, 0, 0); g.restore()
  })
  return tex(c)
}

export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128)
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  return t
}

export function kraftTexture(text: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 180)
  const img = g.createImageData(256, 180)
  for (let i = 0; i < 256 * 180; i++) { const n = hash2(i % 256, (i / 256) | 0, 12) * 0.12; img.data[i * 4] = 180 - n * 255 * 0.3; img.data[i * 4 + 1] = 140 - n * 60; img.data[i * 4 + 2] = 90 - n * 40; img.data[i * 4 + 3] = 255 }
  g.putImageData(img, 0, 0)
  g.fillStyle = '#3a2412'
  g.font = '600 30px "Caveat Variable", "Caveat", cursive'
  g.textAlign = 'center'
  g.fillText(text, 128, 100)
  return tex(c)
}

export function windowSkyTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 160)
  const gr = g.createLinearGradient(0, 0, 0, 160)
  gr.addColorStop(0, '#0b1424'); gr.addColorStop(1, '#1d2a3a')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 160)
  g.fillStyle = 'rgba(255,240,200,0.8)'
  const r = mulberry32(21)
  for (let i = 0; i < 18; i++) { g.fillRect(r() * 128, r() * 90, 1, 1) }
  g.fillStyle = '#05070a'; g.fillRect(0, 120, 128, 40)
  for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? '#c99a4a' : '#0b0d10'; g.fillRect(10 + i * 19, 128, 8, 10) }
  return tex(c)
}

/**
 * Small procedural canvas textures (no image files): lawn, bark, painted pickets, clapboard,
 * concrete, a striped ball, laundry. Deterministic (seeded) so screenshots are stable.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  return [c, ctx]
}

function tex(c: HTMLCanvasElement, repeat = true, srgb = true): Texture {
  const t = new CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Lawn: speckled greens with clover and dry patches. Tile it ~ every 3 m. */
export function lawnTexture(): Texture {
  const [c, x] = canvas(512, 512)
  const r = rng(7)
  x.fillStyle = '#5f8f34'
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 16000; i++) {
    const g = 0.75 + r() * 0.5
    const h = r()
    x.fillStyle = h < 0.08 ? `rgba(160,150,80,${0.25 * r()})` : `rgba(${(60 + 50 * r()) * g | 0},${(110 + 60 * r()) * g | 0},${(30 + 30 * r()) * g | 0},0.55)`
    const px = r() * 512
    const py = r() * 512
    x.fillRect(px, py, 1 + r() * 2, 2 + r() * 5)
  }
  // Clover clumps
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(70,130,50,${0.35 + r() * 0.3})`
    const px = r() * 512, py = r() * 512
    for (let k = 0; k < 14; k++) {
      x.beginPath()
      x.arc(px + (r() - 0.5) * 22, py + (r() - 0.5) * 22, 2 + r() * 2.5, 0, Math.PI * 2)
      x.fill()
    }
  }
  return tex(c)
}

export function barkTexture(): Texture {
  const [c, x] = canvas(256, 512)
  const r = rng(11)
  x.fillStyle = '#5a4a3c'
  x.fillRect(0, 0, 256, 512)
  for (let i = 0; i < 900; i++) {
    const px = r() * 256
    const w = 1 + r() * 4
    const l = 20 + r() * 120
    const py = r() * 512
    const v = (r() * 50) | 0
    x.fillStyle = `rgba(${40 + v},${34 + v},${28 + v},0.6)`
    x.fillRect(px, py, w, l)
  }
  for (let i = 0; i < 120; i++) {
    x.fillStyle = `rgba(20,16,12,${0.4 + r() * 0.4})`
    x.fillRect(r() * 256, r() * 512, 1.5, 30 + r() * 90)
  }
  return tex(c)
}

/** White picket paint, peeling to grey wood. */
export function picketTexture(): Texture {
  const [c, x] = canvas(128, 512)
  const r = rng(23)
  x.fillStyle = '#9b927f'
  x.fillRect(0, 0, 128, 512)
  for (let i = 0; i < 300; i++) {
    x.fillStyle = `rgba(80,70,58,${r() * 0.4})`
    x.fillRect(r() * 128, r() * 512, 1, 20 + r() * 80)
  }
  x.fillStyle = '#ece6d6'
  for (let y = 0; y < 512; y += 2) {
    for (let px = 0; px < 128; px += 2) {
      if (r() > 0.06 + 0.05 * Math.sin(y * 0.05 + px * 0.02)) x.fillRect(px, y, 2, 2)
    }
  }
  for (let i = 0; i < 25; i++) {
    x.fillStyle = `rgba(150,140,120,${0.5 + r() * 0.5})`
    x.beginPath()
    x.ellipse(r() * 128, r() * 512, 2 + r() * 6, 4 + r() * 18, 0, 0, Math.PI * 2)
    x.fill()
  }
  return tex(c)
}

/** 1950s clapboard siding: horizontal boards with shadow lines. */
export function clapboardTexture(): Texture {
  const [c, x] = canvas(512, 512)
  const r = rng(31)
  const board = 32
  for (let y = 0; y < 512; y += board) {
    const g = x.createLinearGradient(0, y, 0, y + board)
    g.addColorStop(0, '#f1ebdc')
    g.addColorStop(0.85, '#e3dccb')
    g.addColorStop(1, '#a9a291')
    x.fillStyle = g
    x.fillRect(0, y, 512, board)
  }
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = `rgba(120,110,90,${r() * 0.12})`
    x.fillRect(r() * 512, r() * 512, 10 + r() * 50, 1)
  }
  return tex(c)
}

export function concreteTexture(): Texture {
  const [c, x] = canvas(512, 512)
  const r = rng(41)
  x.fillStyle = '#b5ada0'
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 20000; i++) {
    const v = (r() * 60 - 30) | 0
    x.fillStyle = `rgba(${150 + v},${145 + v},${135 + v},0.5)`
    x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
  }
  x.strokeStyle = 'rgba(70,65,58,0.7)'
  x.lineWidth = 3
  x.strokeRect(1, 1, 510, 510)
  return tex(c)
}

/** Playground ball: red with a yellow equator band and white spots, so spin reads. */
export function ballTexture(): Texture {
  const [c, x] = canvas(256, 128)
  x.fillStyle = '#d0362a'
  x.fillRect(0, 0, 256, 128)
  x.fillStyle = '#f2c230'
  x.fillRect(0, 54, 256, 20)
  x.fillStyle = '#f7f1e3'
  for (let i = 0; i < 4; i++) {
    x.beginPath()
    x.arc(32 + i * 64, 24, 9, 0, Math.PI * 2)
    x.arc(32 + i * 64 + 32, 104, 9, 0, Math.PI * 2)
    x.fill()
  }
  return tex(c, false)
}

/** Cotton sheet with faint blue pinstripes, or a bold beach towel. */
export function laundryTexture(kind: 'sheet' | 'towel'): Texture {
  const [c, x] = canvas(256, 256)
  if (kind === 'sheet') {
    x.fillStyle = '#f4f1ea'
    x.fillRect(0, 0, 256, 256)
    x.fillStyle = 'rgba(90,130,190,0.35)'
    for (let i = 0; i < 256; i += 16) x.fillRect(i, 0, 2, 256)
    x.fillStyle = 'rgba(200,190,170,0.5)'
    x.fillRect(0, 0, 256, 6)
  } else {
    const cols = ['#e2553b', '#f4c542', '#2f8fa8', '#f6efe0', '#e2553b']
    for (let i = 0; i < 10; i++) {
      x.fillStyle = cols[i % cols.length]
      x.fillRect(0, i * 25.6, 256, 25.6)
    }
    const r = rng(53)
    x.fillStyle = 'rgba(255,255,255,0.08)'
    for (let i = 0; i < 2000; i++) x.fillRect(r() * 256, r() * 256, 1, 1)
  }
  return tex(c, false)
}

/** House number plate "16" (the sunny-16 address from studio-craft.md). */
export function numberPlateTexture(text: string): Texture {
  const [c, x] = canvas(128, 64)
  x.fillStyle = '#1f2a44'
  x.fillRect(0, 0, 128, 64)
  x.fillStyle = '#e9dfc4'
  x.font = 'bold 44px Georgia, serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(text, 64, 35)
  return tex(c, false)
}

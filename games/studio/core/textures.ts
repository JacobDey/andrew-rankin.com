// Procedural canvas textures (studio.md §6.3). Seeded, generated once at boot, ≤ 512² each.
import * as THREE from 'three'
import { fbm2, mulberry32 } from '@shared/core'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function tex(c: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function hex(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const u = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * u)},${Math.round(a[1] + (b[1] - a[1]) * u)},${Math.round(a[2] + (b[2] - a[2]) * u)})`
}

/** Per-pixel painter (fast enough at 256²). */
function paint(w: number, h: number, f: (x: number, y: number) => [number, number, number]): HTMLCanvasElement {
  const [c, g] = canvas(w, h)
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, gg, b] = f(x, y)
      const i = (y * w + x) * 4
      img.data[i] = r
      img.data[i + 1] = gg
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  return c
}

const cache = new Map<string, THREE.Texture>()
function memo(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

export const TEX = {
  lawn(): THREE.Texture {
    return memo('lawn', () => {
      const a = hex(0x6e9e3a)
      const b = hex(0x2f4a22)
      const c = paint(256, 256, (x, y) => {
        const n = fbm2(x / 40, y / 40, { octaves: 4, seed: 11 }) * 0.5 + 0.5
        const sp = fbm2(x / 3, y / 3, { octaves: 2, seed: 12 }) * 0.5 + 0.5
        const t = Math.max(0, Math.min(1, (n - 0.35) * 0.9 + (sp > 0.78 ? 0.25 : 0)))
        const col = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
        const k = 0.92 + 0.12 * sp
        return [col[0] * k, col[1] * k, col[2] * k]
      })
      return tex(c, [10, 10])
    })
  },
  clapboard(): THREE.Texture {
    return memo('clap', () => {
      const paintC = hex(0xede6d6)
      const peel = hex(0xb9b2a2)
      const c = paint(256, 256, (x, y) => {
        const band = (y % 32) / 32
        const lip = band > 0.86 ? 0.72 : band < 0.08 ? 1.04 : 1
        const m = fbm2(x / 30, y / 18, { octaves: 4, seed: 21 }) > 0.42 ? 1 : 0
        const base = m ? peel : paintC
        return [base[0] * lip, base[1] * lip, base[2] * lip]
      })
      return tex(c, [4, 1])
    })
  },
  wood(kind: 'mahogany' | 'ash' | 'bench' = 'bench'): THREE.Texture {
    return memo('wood' + kind, () => {
      const base = kind === 'mahogany' ? hex(0x5a2a1b) : kind === 'ash' ? hex(0xc8a97e) : hex(0x9a6a40)
      const dark: [number, number, number] = [base[0] * 0.7, base[1] * 0.68, base[2] * 0.66]
      const c = paint(256, 256, (x, y) => {
        const r = Math.abs(y - 128 + fbm2(x / 90, y / 30, { octaves: 3, seed: 31 }) * 40) / 10
        const ring = (r * 1.8 + fbm2(x / 60, y / 8, { octaves: 2, seed: 32 }) * 2) % 1
        const t = Math.pow(ring, 3)
        return [base[0] + (dark[0] - base[0]) * t, base[1] + (dark[1] - base[1]) * t, base[2] + (dark[2] - base[2]) * t]
      })
      return tex(c)
    })
  },
  linoleum(): THREE.Texture {
    return memo('lino', () => {
      const a = hex(0xd9d2c3)
      const b = hex(0x6e7f7a)
      const c = paint(256, 256, (x, y) => {
        const chk = ((x >> 5) + (y >> 5)) & 1
        const base = chk ? a : b
        const wear = 0.9 + 0.1 * (fbm2(x / 50, y / 50, { octaves: 3, seed: 41 }) * 0.5 + 0.5)
        return [base[0] * wear, base[1] * wear, base[2] * wear]
      })
      return tex(c, [4, 4])
    })
  },
  slab(): THREE.Texture {
    return memo('slab', () => {
      const c = paint(256, 256, (x, y) => {
        const n = 0.82 + 0.12 * fbm2(x / 20, y / 20, { octaves: 4, seed: 51 })
        const v = 150 * n
        return [v, v * 0.98, v * 0.94]
      })
      return tex(c, [3, 3])
    })
  },
  soil(): THREE.Texture {
    return memo('soil', () => {
      const a = hex(0x5a3e2a)
      const b = hex(0x3b2a1e)
      const r = mulberry32(61)
      const [c, g] = canvas(256, 256)
      for (let y = 0; y < 256; y++) {
        const t = 0.5 + 0.5 * Math.sin(y / 9 + fbm2(0, y / 30, { seed: 62 }) * 3)
        g.fillStyle = mix(a, b, t)
        g.fillRect(0, y, 256, 1)
      }
      for (let i = 0; i < 70; i++) {
        g.fillStyle = mix(hex(0x8a7a68), hex(0x4a4038), r())
        g.beginPath()
        g.ellipse(r() * 256, r() * 256, 2 + r() * 7, 1.5 + r() * 4, r() * 3, 0, Math.PI * 2)
        g.fill()
      }
      return tex(c, [3, 1])
    })
  },
  pegboard(): THREE.Texture {
    return memo('peg', () => {
      const [c, g] = canvas(256, 256)
      g.fillStyle = '#B98A5A'
      g.fillRect(0, 0, 256, 256)
      g.fillStyle = '#5a3e26'
      for (let y = 8; y < 256; y += 16) for (let x = 8; x < 256; x += 16) {
        g.beginPath()
        g.arc(x, y, 2.2, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = '#222'
      g.lineWidth = 2
      g.strokeRect(40, 40, 60, 90)
      g.beginPath()
      g.arc(170, 90, 34, 0, Math.PI * 2)
      g.stroke()
      g.strokeRect(130, 160, 90, 30)
      return tex(c, [2, 1])
    })
  },
  rust(): THREE.Texture {
    return memo('rust', () => {
      const paintC = hex(0x5e7f8c)
      const r1 = hex(0x7a3324)
      const r2 = hex(0xc1652f)
      const c = paint(256, 256, (x, y) => {
        const m = fbm2(x / 42, y / 42, { octaves: 4, seed: 71 }) * 0.5 + 0.5
        const drip = fbm2(x / 8, y / 90, { octaves: 2, seed: 72 }) * 0.5 + 0.5
        const rust = m + drip * 0.25 > 0.66
        if (!rust) return paintC
        const t = fbm2(x / 20, y / 20, { octaves: 3, seed: 73 }) * 0.5 + 0.5
        return [r1[0] + (r2[0] - r1[0]) * t, r1[1] + (r2[1] - r1[1]) * t, r1[2] + (r2[2] - r1[2]) * t]
      })
      const g = c.getContext('2d')!
      g.font = 'bold 64px Archivo, sans-serif'
      g.fillStyle = 'rgba(240,236,228,0.85)'
      g.textAlign = 'center'
      g.fillText('16', 128, 150)
      return tex(c)
    })
  },
  label(text: string, sub: string, bg: string, fg: string, w = 256, h = 128): THREE.Texture {
    return memo('label' + text + sub + bg, () => {
      const [c, g] = canvas(w, h)
      g.fillStyle = bg
      g.fillRect(0, 0, w, h)
      g.fillStyle = fg
      g.textAlign = 'center'
      g.font = `700 ${Math.round(h * 0.26)}px Archivo, sans-serif`
      g.fillText(text, w / 2, h * 0.45)
      g.font = `500 ${Math.round(h * 0.13)}px "IBM Plex Mono", monospace`
      g.fillText(sub, w / 2, h * 0.72)
      return tex(c)
    })
  },
  oats(): THREE.Texture {
    return memo('oats', () => {
      const [c, g] = canvas(512, 256)
      for (let x = 0; x < 512; x += 32) {
        g.fillStyle = (x / 32) % 2 ? '#9b2b22' : '#c8402f'
        g.fillRect(x, 0, 32, 256)
      }
      g.globalAlpha = 0.35
      for (let y = 0; y < 256; y += 32) {
        g.fillStyle = '#1e2a4a'
        g.fillRect(0, y, 512, 10)
      }
      g.globalAlpha = 1
      g.fillStyle = '#f1e7cf'
      g.fillRect(90, 70, 330, 116)
      g.fillStyle = '#3b2418'
      g.textAlign = 'center'
      g.font = '700 46px Fraunces, serif'
      g.fillText('ROLLED OATS', 255, 135)
      g.font = '500 18px Archivo, sans-serif'
      g.fillText('OLD FASHIONED · 18 OZ', 255, 168)
      return tex(c)
    })
  },
}

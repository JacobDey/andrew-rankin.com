// Shared helpers for the six hub previews (hub.md §4.2). Every preview ends with the same finish
// (grain 0.06, vignette 0.25, a soft highlight bloom), so six different worlds read as one roll.
// Pure 2D canvas, deterministic in t and seed.

import { mulberry32, hashString, hash2, valueNoise2, fbm2, clamp, lerp, smoothstep } from '@shared/core'
import { bayer8 } from '@shared/dither'

export { mulberry32, hashString, hash2, clamp, lerp, smoothstep, bayer8 }

/** Design space every preview draws in (3:2, like the frame). */
export const W = 360
export const H = 240
export const TAU = Math.PI * 2

export const valueNoise2D = (x: number, y: number, seed = 0): number => valueNoise2(x, y, seed)
export const fbm = (x: number, y: number, seed = 0, octaves = 4): number => fbm2(x, y, { seed, octaves })

export function easeInOut(x: number): number {
  const t = clamp(x, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** 0 → 1 → 0 window: rises over [a, b], falls over [c, d]. */
export function windowed(t: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, t) * (1 - smoothstep(c, d, t))
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export function ctx2d(c: HTMLCanvasElement, o?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', o)
  if (!ctx) throw new Error('2D canvas unavailable')
  return ctx
}

/** Sets the transform so the preview can draw in W x H design units. */
export function designSpace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0)
}

export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a)
  const [r2, g2, b2] = hexRgb(b)
  const k = clamp(t, 0, 1)
  return `rgb(${Math.round(lerp(r1, r2, k))} ${Math.round(lerp(g1, g2, k))} ${Math.round(lerp(b1, b2, k))})`
}

/** Runs `fn(row)` for rows [0, n), yielding to the browser about every 14 ms (no long tasks). */
export async function chunkedRows(n: number, fn: (row: number) => void): Promise<void> {
  let t0 = performance.now()
  for (let y = 0; y < n; y++) {
    fn(y)
    if (performance.now() - t0 > 14) {
      await new Promise<void>((r) => setTimeout(r, 0))
      t0 = performance.now()
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The finish
// ---------------------------------------------------------------------------------------------

const GRAIN_TILES = 6
const GRAIN_N = 128
let grainTiles: HTMLCanvasElement[] | null = null

function ensureGrain(): HTMLCanvasElement[] {
  if (grainTiles) return grainTiles
  grainTiles = []
  for (let k = 0; k < GRAIN_TILES; k++) {
    const c = makeCanvas(GRAIN_N, GRAIN_N)
    const g = ctx2d(c)
    const img = g.createImageData(GRAIN_N, GRAIN_N)
    const r = mulberry32(0x9a1e + k * 7919)
    for (let i = 0; i < GRAIN_N * GRAIN_N; i++) {
      // sum of three uniforms: roughly gaussian, centred on mid-grey
      const v = 128 + ((r() + r() + r()) / 3 - 0.5) * 230
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
    grainTiles.push(c)
  }
  return grainTiles
}

/** The same procedural grain on every preview; it changes 24 times a second of loop time. */
export function filmGrain(ctx: CanvasRenderingContext2D, amount: number, t: number, w: number, h: number): void {
  const tiles = ensureGrain()
  const f = Math.floor(t * 24)
  const tile = tiles[((f % GRAIN_TILES) + GRAIN_TILES) % GRAIN_TILES]!
  const ox = Math.floor(hash2(f, 1, 77) * GRAIN_N)
  const oy = Math.floor(hash2(f, 2, 77) * GRAIN_N)
  // grain size tracks the backing resolution a little, so it reads as film at every size
  const s = Math.max(1, Math.round(Math.min(w, h) / 260))
  ctx.save()
  ctx.setTransform(s, 0, 0, s, -ox * s, -oy * s)
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = clamp(amount * 3.2, 0, 1)
  const pat = ctx.createPattern(tile, 'repeat')
  if (pat) {
    ctx.fillStyle = pat
    ctx.fillRect(ox, oy, w / s + 1, h / s + 1)
  }
  ctx.restore()
}

export function vignette(ctx: CanvasRenderingContext2D, strength: number, w: number, h: number): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const r = Math.hypot(w, h) / 2
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

let bloomC: HTMLCanvasElement | null = null
let bloomX: CanvasRenderingContext2D | null = null

/** A soft highlight bloom: downsample, raise to the 4th power (self-multiply), screen back. */
export function halation(ctx: CanvasRenderingContext2D, amount: number, w: number, h: number): void {
  const bw = Math.max(8, Math.round(w / 10))
  const bh = Math.max(8, Math.round(h / 10))
  if (!bloomC) {
    bloomC = makeCanvas(bw, bh)
    bloomX = ctx2d(bloomC)
  }
  if (bloomC.width !== bw || bloomC.height !== bh) {
    bloomC.width = bw
    bloomC.height = bh
  }
  const b = bloomX!
  b.globalCompositeOperation = 'copy'
  b.imageSmoothingEnabled = true
  b.drawImage(ctx.canvas, 0, 0, bw, bh)
  b.globalCompositeOperation = 'multiply'
  b.drawImage(bloomC, 0, 0)
  b.drawImage(bloomC, 0, 0)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = amount
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(bloomC, -w * 0.02, -h * 0.02, w * 1.04, h * 1.04)
  ctx.restore()
}

/** The finish every preview shares: grain 0.06, vignette 0.25, soft bloom. */
export function finish(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, o: { bloom?: number; grain?: number; vignette?: number } = {}): void {
  const bloom = o.bloom ?? 0.35
  if (bloom > 0) halation(ctx, bloom, w, h)
  vignette(ctx, o.vignette ?? 0.25, w, h)
  filmGrain(ctx, o.grain ?? 0.06, t, w, h)
}

/** Seed for a slug (stable). */
export const seedOf = (slug: string): number => hashString(`hub:${slug}`)

/** fract-based periodic phase in [0, 1). */
export const phase = (t: number, period: number): number => (((t / period) % 1) + 1) % 1

export { fbm2 }

// Compact storage for an undeveloped frame (Studio's "LogH8"): the latent X image is quantised to 8 bits in
// log2 space, so a long-exposure roll fits in IndexedDB as small PNGs. The photo stays invisible until it is
// developed; the encoding covers minStops..maxStops around refX with a fixed step of (max - min) / 255 stops.

import { PAN_WEIGHTS } from './film.ts'

export interface Log2Options {
  /** 1 packs one (panchromatic) channel; 3 keeps colour */
  channels: 1 | 3
  /** stops below refX stored at byte 0 (negative number, e.g. -10) */
  minStops: number
  /** stops above refX stored at byte 255 (e.g. 6.6) */
  maxStops: number
  /** X at 0 stops (default 1) */
  refX?: number
}

/** Deterministic ordered dither in [-0.5, 0.5): a 4x4 Bayer matrix, so the same frame always encodes to the same bytes. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
function dither(x: number, y: number, c: number): number {
  return (BAYER4[((y + c) & 3) * 4 + ((x + 2 * c) & 3)] + 0.5) / 16 - 0.5
}

/**
 * Encodes latent X (RGBA float, top row first, as returned by `capture`) to log2 bytes, row-major, `channels`
 * per pixel. `spectral` maps the three latent channels to the stored ones (rows = stored channels); the default
 * is identity for 3 channels and the panchromatic weights for 1.
 */
export function encodeLog2(latentX: Float32Array, w: number, h: number, o: Log2Options & { spectral?: number[][] }): Uint8Array {
  const ch = o.channels
  const ref = o.refX ?? 1
  const lo = o.minStops
  const span = o.maxStops - o.minStops
  const out = new Uint8Array(w * h * ch)
  const m = o.spectral ?? (ch === 1 ? [[PAN_WEIGHTS[0], PAN_WEIGHTS[1], PAN_WEIGHTS[2]]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  const inv = 1 / Math.log(2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const r = latentX[i * 4]
      const g = latentX[i * 4 + 1]
      const b = latentX[i * 4 + 2]
      for (let c = 0; c < ch; c++) {
        const row = m[c] ?? m[0]
        const X = row[0] * r + row[1] * g + row[2] * b
        const stops = X > 0 ? Math.log(X / ref) * inv : lo - 1
        const v = ((stops - lo) / span) * 255 + dither(x, y, c)
        out[i * ch + c] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)
      }
    }
  }
  return out
}

/** Decodes log2 bytes back to X per channel (`channels` floats per pixel, row-major). */
export function decodeLog2(bytes: Uint8Array, w: number, h: number, o: Log2Options): Float32Array {
  const ch = o.channels
  const ref = o.refX ?? 1
  const span = o.maxStops - o.minStops
  const out = new Float32Array(w * h * ch)
  const lut = new Float32Array(256)
  for (let v = 0; v < 256; v++) lut[v] = ref * Math.pow(2, o.minStops + (v / 255) * span)
  for (let i = 0; i < w * h * ch; i++) out[i] = lut[bytes[i]]
  return out
}

function makeCanvas(w: number, h: number): { ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; toBlob: () => Promise<Blob> } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2d canvas unavailable')
    return { ctx, toBlob: () => c.convertToBlob({ type: 'image/png' }) }
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d canvas unavailable')
  return {
    ctx,
    toBlob: () => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png')),
  }
}

/** Packs bytes into a lossless PNG: 3 channels as RGB, 1 channel into R (G and B zero). */
export async function bytesToPNG(bytes: Uint8Array, w: number, h: number, channels: 1 | 3): Promise<Blob> {
  const { ctx, toBlob } = makeCanvas(w, h)
  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = bytes[i * channels]
    d[i * 4 + 1] = channels === 3 ? bytes[i * 3 + 1] : 0
    d[i * 4 + 2] = channels === 3 ? bytes[i * 3 + 2] : 0
    d[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return toBlob()
}

/** The inverse of bytesToPNG. Colour management is switched off so the bytes come back exactly. */
export async function pngToBytes(blob: Blob, channels: 1 | 3): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  const w = bmp.width
  const h = bmp.height
  const { ctx } = makeCanvas(w, h)
  ctx.drawImage(bmp, 0, 0)
  bmp.close?.()
  const d = ctx.getImageData(0, 0, w, h).data
  const bytes = new Uint8Array(w * h * channels)
  for (let i = 0; i < w * h; i++) {
    bytes[i * channels] = d[i * 4]
    if (channels === 3) {
      bytes[i * 3 + 1] = d[i * 4 + 1]
      bytes[i * 3 + 2] = d[i * 4 + 2]
    }
  }
  return { bytes, w, h }
}

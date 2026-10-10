// games/plates/content/develop.ts — CPU twin of PLATE_GLSL for thumbnails, portraits and the gallery.
import { PLATE_W, PLATE_H, SIM_W, SIM_H, K_DEV, S_SLOPE, L_MIN, L_SPAN } from '../contracts'
import { blueNoiseBytes, grainT } from '../render/dither'

/** 2^(S·L) for every byte value. */
export const S_OF_BYTE: Float32Array = (() => { const a = new Float32Array(256); for (let b = 0; b < 256; b++) a[b] = Math.pow(2, S_SLOPE * ((b / 255) * L_SPAN + L_MIN)); return a })()

export interface DevFields { P: Float32Array | number; F: Float32Array | number; H?: Float32Array | number }
function cell(f: Float32Array | number, x: number, y: number): number {
  if (typeof f === 'number') return f
  const cx = Math.min(SIM_W - 1, Math.max(0, Math.floor((x * SIM_W) / PLATE_W))), cy = Math.min(SIM_H - 1, Math.max(0, Math.floor((y * SIM_H) / PLATE_H)))
  return f[cy * SIM_W + cx]
}
/** Density at plate texel (x, y). */
export function densityAt(L: Uint8Array, f: DevFields, x: number, y: number): number {
  const P = cell(f.P, x, y), F = cell(f.F, x, y)
  return 1 - Math.exp(-K_DEV * P * (S_OF_BYTE[L[y * PLATE_W + x]] + F))
}
/**
 * Render a region of the plate as 1-bit ImageData. mode 'neg': silver = ink (transmission);
 * 'pos': silver = light (on velvet). Each output pixel samples one texel; at reduced size the
 * grain lattice is coarsened (texelsPerPx), never aliased.
 */
export function developRegion(L: Uint8Array, f: DevFields, seed: [number, number], rx: number, ry: number, rw: number, rh: number, ow: number, oh: number,
  mode: 'neg' | 'pos', ink: [number, number, number], light: [number, number, number], out?: ImageData): ImageData {
  const img = out ?? new ImageData(ow, oh)
  const d = img.data, sx = rw / ow, sy = rh / oh
  const coarse = Math.max(1, Math.min(sx, sy))
  const noise = blueNoiseBytes()
  for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
    const x = Math.min(PLATE_W - 1, Math.max(0, Math.floor(rx + (ox + 0.5) * sx))), y = Math.min(PLATE_H - 1, Math.max(0, Math.floor(ry + (oy + 0.5) * sy)))
    const D = densityAt(L, f, x, y)
    const gx = Math.floor(x / coarse), gy = Math.floor(y / coarse)
    let bit = D > grainT(noise, gx, gy, seed[0], seed[1]) ? 1 : 0
    if (f.H !== undefined) { const H = cell(f.H, x, y); if (H * 0.85 > grainT(noise, gx + 37, gy + 61, seed[0], seed[1])) bit = mode === 'neg' ? 1 : 0 }
    const lightPix = mode === 'neg' ? !bit : !!bit
    const c = lightPix ? light : ink, j = (oy * ow + ox) * 4
    d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255
  }
  return img
}

import type { AlbedoFn, RGB } from './types'

/** sRGB 0..1 -> linear 0..1. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
/** Linear 0..1 -> sRGB 0..1. */
export function linearToSrgb(c: number): number {
  const v = c < 0 ? 0 : c > 1 ? 1 : c
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

const hexCache = new Map<string, RGB>()
/** '#RRGGBB' (or '#RGB') -> linear RGB. */
export function hexToLinear(hex: string): RGB {
  const hit = hexCache.get(hex)
  if (hit) return [hit[0], hit[1], hit[2]]
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const out: RGB = [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)]
  hexCache.set(hex, out)
  return [out[0], out[1], out[2]]
}

/** Linear 0..1 -> sRGB 8-bit. */
export function toSrgb8(c: number): number {
  const v = Math.round(linearToSrgb(c) * 255)
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export function solid(hex: string): AlbedoFn {
  const c = hexToLinear(hex)
  return (_x, _y, out) => {
    out[0] = c[0]
    out[1] = c[1]
    out[2] = c[2]
    return out
  }
}

/** Piecewise-linear gradient in linear light. t is clamped to the first / last stop. */
export function paletteFn(stops: [number, string][], t: (x: number, y: number) => number): AlbedoFn {
  const s = stops.slice().sort((a, b) => a[0] - b[0])
  const cols = s.map((e) => hexToLinear(e[1]))
  const ts = s.map((e) => e[0])
  const n = s.length
  return (x, y, out) => {
    const v = t(x, y)
    if (v <= ts[0]) { out[0] = cols[0][0]; out[1] = cols[0][1]; out[2] = cols[0][2]; return out }
    if (v >= ts[n - 1]) { out[0] = cols[n - 1][0]; out[1] = cols[n - 1][1]; out[2] = cols[n - 1][2]; return out }
    let i = 1
    while (i < n - 1 && v > ts[i]) i++
    const u = (v - ts[i - 1]) / (ts[i] - ts[i - 1])
    const a = cols[i - 1]
    const b = cols[i]
    out[0] = a[0] + (b[0] - a[0]) * u
    out[1] = a[1] + (b[1] - a[1]) * u
    out[2] = a[2] + (b[2] - a[2]) * u
    return out
  }
}

export function tintFn(base: AlbedoFn, field: (x: number, y: number) => number, amt: number): AlbedoFn {
  return (x, y, out) => {
    base(x, y, out)
    let k = 1 + amt * field(x, y)
    k = k < 0 ? 0 : k > 1.5 ? 1.5 : k
    out[0] = Math.min(1, out[0] * k)
    out[1] = Math.min(1, out[1] * k)
    out[2] = Math.min(1, out[2] * k)
    return out
  }
}

export function blendFn(a: AlbedoFn, b: AlbedoFn, t: (x: number, y: number) => number): AlbedoFn {
  const tmp: RGB = [0, 0, 0]
  return (x, y, out) => {
    const u = t(x, y)
    if (u <= 0) return a(x, y, out)
    if (u >= 1) return b(x, y, out)
    a(x, y, out)
    b(x, y, tmp)
    out[0] += (tmp[0] - out[0]) * u
    out[1] += (tmp[1] - out[1]) * u
    out[2] += (tmp[2] - out[2]) * u
    return out
  }
}

/** Mix two colours (linear) in place into `out`. */
export function mixInto(out: RGB, c: RGB, t: number): RGB {
  out[0] += (c[0] - out[0]) * t
  out[1] += (c[1] - out[1]) * t
  out[2] += (c[2] - out[2]) * t
  return out
}

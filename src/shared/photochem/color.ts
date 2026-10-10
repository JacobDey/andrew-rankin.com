// Colour helpers shared by the silver and cyanotype models.
//
// Every colorant in this package is described by its *channel densities*:
// how much it absorbs in linear-light R, G and B per unit of "amount". A
// layer of colorants on a white base is then plain Beer–Lambert:
//
//   reflectance_c = base_c * 10^(-sum_k amount_k * density_k,c)
//
// plus a first-surface reflection floor (see `reflect`). Mixing happens in
// linear light; only the very last step converts to sRGB bytes.

export type RGB = [number, number, number]

/** sRGB transfer (IEC 61966-2-1), 0..1 in, 0..1 out. */
export function linearToSrgb(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

export function srgbToLinear(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

/** '#RRGGBB' -> linear RGB. */
export function hexToLinear(hex: string): RGB {
  const v = parseInt(hex.replace('#', ''), 16)
  return [srgbToLinear(((v >> 16) & 255) / 255), srgbToLinear(((v >> 8) & 255) / 255), srgbToLinear((v & 255) / 255)]
}

export function linearToHex(c: RGB): string {
  const b = (x: number) => Math.round(linearToSrgb(x) * 255).toString(16).padStart(2, '0')
  return '#' + b(c[0]) + b(c[1]) + b(c[2])
}

/** Rec. 709 relative luminance of a linear RGB triple. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Reflection through a colorant layer on a base, with a first-surface
 * reflection floor `surface` (fraction of light bounced off the top before it
 * meets any silver or pigment). The floor is what limits Dmax: glossy ≈ 0.006
 * (Dmax ≈ 2.2), pearl ≈ 0.01, matte ≈ 0.025 (Dmax ≈ 1.6). A water film on a
 * wet print acts like a glossy surface, which is why matte prints look richer
 * wet than dry.
 */
export function reflect(base: number, density: number, surface: number): number {
  return (1 - surface) * base * Math.pow(10, -density) + surface
}

/** Lookup table for linear 0..1 -> sRGB byte, 4096 entries. */
export const LUT_N = 4096
export const SRGB_LUT = new Uint8ClampedArray(LUT_N + 1)
for (let i = 0; i <= LUT_N; i++) SRGB_LUT[i] = Math.round(linearToSrgb(i / LUT_N) * 255)

/** Fast linear -> sRGB byte using a LUT (good to ±0.5 LSB). */
export function linToByte(x: number): number {
  if (!(x > 0)) return 0
  if (x >= 1) return 255
  return SRGB_LUT[(x * LUT_N + 0.5) | 0]
}

/** Interpolate two RGB triples. */
export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/**
 * Channel densities that turn `base` into `target` in one unit of a colorant:
 * d_c = log10(base_c / target_c). Used to derive colorant constants from
 * art-direction hex values so the palette and the physics agree.
 */
export function densityFromColors(baseHex: string, targetHex: string, floor = 0.002): RGB {
  const b = hexToLinear(baseHex)
  const t = hexToLinear(targetHex)
  return [0, 1, 2].map((i) => Math.log10(b[i] / Math.max(floor, t[i]))) as RGB
}

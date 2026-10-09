// Tiny GLSL preprocessor for recipes.
//
//   hex(#C1652F)  ->  vec3(<linear r>, <linear g>, <linear b>)
//
// Colours are authored the way photographers and painters quote them (sRGB
// hex) and converted to linear here, in JS, with exact float64 math, so every
// device gets bit-identical constants.

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function hexToLinear(hex: string): [number, number, number] {
  const v = parseInt(hex.replace(/^#|^0x/i, ''), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => srgbToLinear(x / 255)) as [number, number, number]
}

const fmt = (x: number) => {
  const s = x.toFixed(6)
  return s.includes('.') ? s : s + '.0'
}

export function preprocessGlsl(src: string): string {
  return src.replace(/\bhex\(\s*(?:#|0x)([0-9a-fA-F]{6})\s*\)/g, (_m, h: string) => {
    const [r, g, b] = hexToLinear(h)
    return `vec3(${fmt(r)}, ${fmt(g)}, ${fmt(b)})`
  })
}

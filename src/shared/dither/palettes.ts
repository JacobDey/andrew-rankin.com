/**
 * Two-colour palettes. `ink` is what a 0 bit shows, `light` what a 1 bit shows.
 * Hex values are sRGB and reach the screen exactly (the blit does no colour management).
 *
 * Sources: the spike set (docs/design plates-craft), plates.md section 7.1 (ruby, canary,
 * bone, prussian: the GDD's exact values win) and latent.md section 7.1 (latent*).
 */

export interface Palette {
  ink: string
  light: string
}

export const PALETTES = {
  /** Plates default: bone on ink (plates.md 7.1). Title, endings, room once the pane is out. */
  bone: { ink: '#191613', light: '#E9E1CF' },
  /** Finished prints, hub card, title. */
  albumen: { ink: '#23160D', light: '#EDDDB9' },
  /** Darkroom under the safelight. */
  ruby: { ink: '#160505', light: '#C9361F' },
  /** Plates: the canary light table, the Return, documents (plates.md 7.1). */
  canary: { ink: '#1A1206', light: '#F2B654' },
  /** Cool variant: a negative held against the porthole. */
  glass: { ink: '#0B0C0C', light: '#CDD5D1' },
  /** Cool variant 2: moonlit deck / night exterior. */
  nocturne: { ink: '#0D1217', light: '#A9C1CE' },
  /** Positive over black velvet. */
  ambrotype: { ink: '#0A0908', light: '#BDB59A' },
  /** Cyanotype coda / blueprint map only. */
  prussian: { ink: '#13396A', light: '#E8EEF2' },
  /** Lantern-room plates at night (same hues as canary, spike name kept). */
  lamp: { ink: '#1A1206', light: '#F2B654' },
  /** Latent: index terminal, P3 amber phosphor. */
  amber: { ink: '#1A0E00', light: '#FFB000' },
  /** Latent: printing under an OC safelight. */
  safelight: { ink: '#120503', light: '#D2692A' },
  /** Reference: pure black and white. */
  mono: { ink: '#000000', light: '#FFFFFF' },

  /** Latent Image terminal (latent.md 7.1). */
  latentTerminal: { ink: '#1A0E00', light: '#FFB000' },
  /** Latent Image light table: cold white. */
  latentLightTable: { ink: '#0B0D10', light: '#E8EEF2' },
  /** Latent Image darkroom under the safelight (the default darkroom state). */
  latentSafelight: { ink: '#140302', light: '#D8432B' },
  /** Latent Image darkroom, white light (400 ms blowout on switching). */
  latentWhite: { ink: '#121110', light: '#EFE9DC' },
  /** Latent Image drying line: fibre paper. */
  latentLine: { ink: '#0B0B0C', light: '#F1EDE3' },
  /** Latent Image ending clippings (halftone at 45 degrees). */
  latentClipping: { ink: '#111111', light: '#EDEAE2' },
} as const satisfies Record<string, Palette>

export type PaletteName = keyof typeof PALETTES

export function resolvePalette(p: PaletteName | Palette): Palette {
  return typeof p === 'string' ? PALETTES[p] : p
}

/** '#RRGGBB' -> [r, g, b] in 0..1, sRGB (no linearisation on purpose). */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Luminance weights applied to the linear scene colour before dithering. */
export const LUMA = {
  /** Rec.709 / sRGB luminance: the present-day eye. */
  rec709: [0.2126, 0.7152, 0.0722],
  /** Blue-sensitive gelatin dry plate (plates-craft.md section 2): red prints black, blue sky white. */
  plate: [0.05, 0.15, 0.8],
  /** Orthochromatic film: blind to red, sees green and blue. */
  ortho: [0.02, 0.55, 0.43],
} as const satisfies Record<string, readonly [number, number, number]>

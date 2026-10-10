import { bayer8, getThresholdMap, type PatternName } from './noise'
import { hexToRgb, resolvePalette, type Palette, type PaletteName } from './palettes'

export interface DitherImageOptions {
  palette: PaletteName | Palette
  /** Default 'bluenoise'. */
  pattern?: PatternName
  /** Blue-noise seed, default 1. */
  seed?: number
  /** Dither cell in output pixels (default 1): each cell x cell block shares one threshold. */
  cell?: number
  /** Reuse this ImageData (must be w x h). */
  out?: ImageData
}

const MAP_SIZE = 64

/**
 * CPU 1-bit dither for 2D canvases (thumbnails, share cards, fallbacks, hub previews).
 * `lum` is luminance per pixel: 0..1 floats (Float32Array) or 0..255 bytes (Uint8ClampedArray).
 * Output is w x h RGBA; each pixel is exactly the palette's ink or light colour.
 */
export function ditherImage(
  lum: Float32Array | Uint8ClampedArray,
  w: number,
  h: number,
  o: DitherImageOptions,
): ImageData {
  const pal = resolvePalette(o.palette)
  const ink = hexToRgb(pal.ink).map((v) => Math.round(v * 255))
  const light = hexToRgb(pal.light).map((v) => Math.round(v * 255))
  const pattern = o.pattern ?? 'bluenoise'
  const cell = Math.max(1, Math.floor(o.cell ?? 1))
  const map = getThresholdMap(pattern, MAP_SIZE, o.seed ?? 1, false)
  const bytes = lum instanceof Uint8ClampedArray
  const out = o.out && o.out.width === w && o.out.height === h ? o.out : new ImageData(w, h)
  const d = out.data
  for (let y = 0; y < h; y++) {
    const cy = Math.floor(y / cell)
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / cell)
      const t = (map[(cy % MAP_SIZE) * MAP_SIZE + (cx % MAP_SIZE)] + 0.5) / 256
      const v = bytes ? lum[y * w + x] / 255 : lum[y * w + x]
      const c = v > t ? light : ink
      const i = (y * w + x) * 4
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    }
  }
  return out
}

// Keep the closed-form Bayer reachable from here for callers that want an exact 8x8 screen.
export { bayer8 }

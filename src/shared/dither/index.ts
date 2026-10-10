// @shared/dither: three-free barrel (CPU helpers, palettes, matrices, GLSL strings).
// three code lives at '@shared/dither/three'.
export {
  bayerMatrix,
  bayer8,
  ign,
  clusterMatrix,
  generateBlueNoise,
  getThresholdMap,
  thresholdMapTimings,
} from './noise'
export type { PatternName, BlueNoiseOptions } from './noise'
export { PALETTES, LUMA, resolvePalette, hexToRgb } from './palettes'
export type { Palette, PaletteName } from './palettes'
export { ditherImage } from './cpu'
export type { DitherImageOptions } from './cpu'
export { DITHER_GLSL } from './glsl'

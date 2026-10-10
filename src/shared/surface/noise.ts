// @shared/surface noise: re-exports the shared core noise and adds only what the recipes need.
export { valueNoise1, valueNoise2, gradientNoise2, fbm1, fbm2, ridged2, worley2, bandNoise } from '@shared/core/noise'
export type { FbmOptions, WorleyHit } from '@shared/core/noise'
export { mulberry32, hashString, hash2, hash2i, hash3, rngStream } from '@shared/core/rng'
export type { Rng } from '@shared/core/rng'

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t
/** smoothstep; works for e0 > e1 too (inverted). */
export const smoothstep = (e0: number, e1: number, v: number): number => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

// @shared/optics types: lensbench.md §11.2 verbatim (architecture §4.8), plus PresetId.
// Pure TypeScript, no DOM, no three.

export type GlassId = 'crown' | 'lightFlint' | 'flint' | 'denseFlint' | 'lanthanumCrown' | 'fluorite'
export type Ch = 0 | 1 | 2 // R=C 656nm, G=d 588nm, B=F 486nm
export interface ElementSpec {
  id: string
  z: number
  t: number
  c1: number
  c2: number
  diameter: number
  glass: GlassId
  coating: 0 | 1 | 2
}
export interface StopSpec {
  z: number
  kind: 'iris' | 'card' | 'pinhole'
  diameter: number
  blades: 0 | 5 | 6 | 8 | 9
  roundness: number
  card?: string /* 32x32 1-bit base64 */
}
export interface LensDesign {
  v: 1
  elements: ElementSpec[]
  stop: StopSpec
}
export interface RayPath {
  pts: Float32Array /* z,y pairs */
  ch: Ch
  fate: 'film' | 'vignetted' | 'tir' | 'miss'
}
export interface Ghost {
  m: number
  sizeMm: number
  amp: number
  tint: [number, number, number]
}
export interface LensProfile {
  valid: boolean
  issues: string[]
  pinhole: boolean
  efl: number
  bfd: number
  ffd: number
  p1z: number
  p2z: number
  ep: { z: number; d: number }
  xp: { z: number; d: number }
  pupilMag: number
  fNumber: number
  tStop: number
  transmission: number
  pupilMask: Uint8Array /* 64x64 */
  maskArea: number
  blades: number
  distortion: { k1: number; k2: number; edgePct: number }
  lateralCA: [number, number, number]
  longCA: [number, number, number]
  lsa: number
  saBlurMm: number
  petzval: number
  pinholeBlurMm: number
  vignette: Float32Array
  catsEye: Float32Array /* 16 each, field 0..1 of half-diagonal */
  ghosts: Ghost[]
  glare: number
  massG: number
  lengthMm: number
  frontZ: number
  rearZ: number
  telephotoRatio: number
  format: { w: number; h: number }
  fieldHalfDiagRad: number
}

export type PresetId =
  | 'pinhole'
  | 'meniscus'
  | 'achromat'
  | 'portrait'
  | 'triplet'
  | 'telephoto'
  | 'retrofocus'
  | 'doubleGauss'

// @shared/dither/three: everything that needs three.
import * as THREE from 'three'
import { getThresholdMap, type PatternName } from './noise'

export { OneBitPass } from './OneBitPass'
export type {
  DitherMode,
  DebugView,
  OneBitOptions,
  OutlineOptions,
  ToneOptions,
  OneBitReadback,
  PassTimings,
  SurfaceDitherUniforms,
} from './OneBitPass'
export { applySurfaceDither, setSharedSurfaceUniforms, getSharedSurfaceUniforms } from './surfaceDither'
export type { SurfaceDitherOptions, SurfaceDitherHandle } from './surfaceDither'
export { DevelopingPrintMaterial } from './developingPrint'
export type { DevelopingPrintOptions } from './developingPrint'
export { AnchorTracker } from './anchor'
export type { AnchorTrackerOptions } from './anchor'
export { applyLineId, lineIdToAlpha, LINE_ID_MAX } from './lineId'
export type { LineIdOptions, LineIdHandle } from './lineId'

/**
 * A square threshold map as a DataTexture: R8, nearest filter, repeat wrap. Sample with
 * `thresholdLookup()` from DITHER_GLSL, or `texelFetch(t, ivec2(mod(p, size)), 0).r`.
 * A new texture is created per call (the bytes are cached); dispose it when done.
 */
export function thresholdTexture(pattern: PatternName, size = 64, seed = 1): THREE.DataTexture {
  const bytes = getThresholdMap(pattern, size, seed)
  const tex = new THREE.DataTexture(bytes, size, size, THREE.RedFormat, THREE.UnsignedByteType)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = false
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}

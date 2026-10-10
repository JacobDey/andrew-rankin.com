// @shared/optics: exact lens optics, pure TypeScript (architecture §4.8, lensbench.md §5.1–5.5).
// Hub-safe: no three, no DOM beyond optional localStorage in library.ts.
export type { GlassId, Ch, ElementSpec, StopSpec, LensDesign, RayPath, Ghost, LensProfile, PresetId } from './types'
export { GLASSES, GLASS_IDS, LAMBDA_UM, LAMBDA_D_MM, indexAt, indexCh, cauchy, sag, autoThickness, elementVolume } from './glass'
export type { GlassInfo } from './glass'
export { validate, computeProfile, collimate, traceFan, spotDiagram, clampElementZ, clone as cloneLens, RAIL_MIN_Z, MAX_ELEMENTS } from './profile'
export { rasterizePupil, samplePupil, maskFraction, encodeCard, decodeCard, heartCard, MASK_SIZE, CARD_SIZE } from './mask'
export { encodeLens, decodeLens, lensToCompact, lensFromCompact, b64urlEncode, b64urlDecode } from './codec'
export { loadPreset, setFNumber, PRESET_INFO, PRESET_IDS } from './presets'
export {
  focusDistanceM, extForDistance, magnification, workingN, cocMm, cocPx, acceptableCocMm, hyperfocalM, airyMm, fovDeg,
  filmIlluminanceLux, filmIlluminance, pinholeOptimum, pinholeBlurMm, vignetteAt,
} from './imaging'
export { listSavedLenses, saveLens } from './library'
export type { SavedLens } from './library'
export { selftest, randomDesign } from './selftest'
export type { OpticsCheck } from './selftest'
export { buildSurfaces } from './trace'
export { paraxial, pupils, petzvalSum } from './paraxial'

// Procedural material library: public API.
//
//   import { generateMaterial, CATALOG, matchGuess, createMacroViewMaterial } from '.../core'
//
// Lift this folder to src/shared/materials/ as-is. Nothing here touches the DOM
// except through the three.js renderer you pass in.

export type {
  Family, Habitat, Scale5, BodyPreset, PhysicsHints, MaterialInfo, Region,
  GenerateOptions, GenerateTimings, MaterialMaps,
} from './types'
export { CATALOG, MATERIAL_IDS, getMaterialInfo, lintCatalog, FAMILY_LABEL, HABITAT_LABEL } from './catalog'
export { normalizeGuess, resolveGuess, matchGuess, levenshtein, phraseScore } from './guess'
export type { GuessCandidate, GuessResult } from './guess'
export { generateMaterial, getGenerator, MaterialGenerator, getGeneratorCaps, buildSurfaceShader } from './generator'
export type { GeneratorCaps } from './generator'
export { createMacroViewMaterial, applyMapsToStandardMaterial } from './view'
export type { MacroViewMaterial, MacroViewOptions, ViewMode } from './view'
export { RECIPES } from './recipes/index'
export { TOOLKIT_GLSL } from './glsl/toolkit'
export { preprocessGlsl, hexToLinear } from './glsl/preprocess'

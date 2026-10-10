// @shared/surface: macro surfaces as pure functions of real millimetres, baked on the CPU in a worker.
// Hub-safe (never imports three). Texturedle's heart; also feeds Sunny 16 (the rusty mailbox) and Lens Bench.
export type {
  RGB, Field, FieldLike, AlbedoFn, ProbeKind, PropKind, RecipeKit, BenchEventLike, SecretHit, MaterialPhys, LayerSpec,
  FormSpec, BodySpec, SurfaceRecipe, ContactField, SurfaceBake, TexRect, ContactSample, SurfaceRuntime, BakeOptions,
  SurfaceMaps, RecipeInfo, WorleyOpts,
} from './types'
export { bakeSurface, bakeMaps, setBakeMode } from './bake-client'
export { bakeSync, mapsFromBake, formField, defaultSizeMm } from './baker'
export { createRuntime } from './runtime'
export { thumbnail, shadeMaps } from './thumbnail'
export { getRecipe, hasRecipe, listRecipes, POOL, WALK, WALK_PLAN } from './recipes'
export { createKit } from './fields'
export { PROBES, dilate, buildContact, contactRes } from './contact'
export { hexToLinear, linearToSrgb, srgbToLinear } from './colour'
export * from './noise'

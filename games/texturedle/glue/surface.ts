// The one place texturedle gets its surfaces from: @shared/surface (baker in a
// worker, runtime, recipes). The local stand-in that carried the build until the
// shared module landed has been removed (architecture §10).

export type {
  RGB, Field, ProbeKind, PropKind, RecipeKit, BenchEventLike, SecretHit, MaterialPhys, LayerSpec, FormSpec, BodySpec,
  SurfaceRecipe, ContactField, SurfaceBake, TexRect, ContactSample, SurfaceRuntime,
} from '@shared/surface'
export { bakeSurface, createRuntime, thumbnail, getRecipe, POOL, WALK } from '@shared/surface'
export const SURFACE_SOURCE = 'shared' as const

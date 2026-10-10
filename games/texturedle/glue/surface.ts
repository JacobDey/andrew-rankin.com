// The one place texturedle gets its surfaces from: @shared/surface (the real
// baker, worker, runtime and recipes). `?surface=local` swaps in the local
// stand-in (glue/surface-local.ts) that carried the build until the shared
// module landed; it stays as a debugging fallback and can be deleted.

export type {
  RGB, Field, ProbeKind, PropKind, RecipeKit, BenchEventLike, SecretHit, MaterialPhys, LayerSpec, FormSpec, BodySpec,
  SurfaceRecipe, ContactField, SurfaceBake, TexRect, ContactSample, SurfaceRuntime,
} from '@shared/surface'
import * as shared from '@shared/surface'
import type { SurfaceRecipe, SurfaceBake, SurfaceRuntime } from '@shared/surface'
import type * as L from './surface-types'
import { bakeSurfaceLocal, createRuntimeLocal, thumbnailLocal } from './surface-local'
import { getRecipeLocal, POOL_LOCAL, WALK_LOCAL } from './recipes-local'

const useLocal = typeof location !== 'undefined' && /[?&]surface=local\b/.test(location.search)
export const SURFACE_SOURCE: 'local' | 'shared' = useLocal ? 'local' : 'shared'

export function bakeSurface(recipe: SurfaceRecipe, opts: { ratio: number; res: number; physRes: number; seed?: number; sizeMm?: number }): Promise<SurfaceBake> {
  if (useLocal) return bakeSurfaceLocal(recipe as unknown as L.SurfaceRecipe, opts) as unknown as Promise<SurfaceBake>
  return shared.bakeSurface(recipe, opts)
}
export function createRuntime(bake: SurfaceBake, recipe: SurfaceRecipe, carryFrom?: SurfaceRuntime): SurfaceRuntime {
  if (useLocal) return createRuntimeLocal(bake as unknown as L.SurfaceBake, recipe as unknown as L.SurfaceRecipe) as unknown as SurfaceRuntime
  return shared.createRuntime(bake, recipe, carryFrom)
}
export function thumbnail(recipeId: string, px: number, lampAzDeg?: number): Promise<ImageData> {
  return useLocal ? thumbnailLocal(recipeId, px, lampAzDeg) : shared.thumbnail(recipeId, px, lampAzDeg)
}
export function getRecipe(id: string): SurfaceRecipe {
  return useLocal ? (getRecipeLocal(id) as unknown as SurfaceRecipe) : shared.getRecipe(id)
}
export const POOL: readonly string[] = useLocal ? POOL_LOCAL : shared.POOL
export const WALK: readonly string[] = useLocal ? WALK_LOCAL : shared.WALK

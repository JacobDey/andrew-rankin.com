// Recipe registry. Recipes 001-010 and the poster recipe are MUST; 011-036 are SHOULD and register here as they land.
import type { RecipeInfo, SurfaceRecipe } from '../types'
import { r001 } from './r001-rusty-mailbox'
import { r002 } from './r002-packing-bubbles'
import { r003 } from './r003-dried-mud-rut'
import { r004 } from './r004-laurel-leaf'
import { r005 } from './r005-moss-fence-post'
import { r006 } from './r006-oak-bark'
import { r007 } from './r007-house-brick'
import { r008 } from './r008-porch-boards'
import { r009 } from './r009-coir-doormat'
import { r010 } from './r010-brass-knocker'
import { posterPeelingPaint } from './poster-peeling-paint'

export const RECIPES: readonly SurfaceRecipe[] = [r001, r002, r003, r004, r005, r006, r007, r008, r009, r010, posterPeelingPaint]

/** The 30-day Nettle Lane walk (texturedle.md 6.3), by recipe id; only the registered ones are in WALK. */
export const WALK_PLAN: readonly string[] = [
  'rusty-mailbox', 'packing-bubbles', 'dried-mud-rut', 'laurel-leaf', 'moss-fence-post', 'oak-bark', 'house-brick',
  'porch-boards', 'coir-doormat', 'brass-knocker', 'flocked-wallpaper', 'denim-jacket', 'corduroy-armchair', 'vinyl-record',
  'cork-board', 'orange-peel', 'strawberry', 'toast', 'cast-iron-pan', 'terry-towel', 'chalkboard', 'basketball', 'golf-ball',
  'hook-and-loop', 'leather-strap', 'brushed-aluminium', 'sandpaper', 'popcorn-ceiling', 'contact-sheet', 'darkroom-sink',
]

const byId = new Map<string, SurfaceRecipe>(RECIPES.map((r) => [r.id, r]))

export function getRecipe(id: string): SurfaceRecipe {
  const r = byId.get(id)
  if (!r) throw new Error(`unknown surface recipe: ${id}`)
  return r
}
export function hasRecipe(id: string): boolean {
  return byId.has(id)
}
export function isRegistered(r: SurfaceRecipe): boolean {
  return byId.get(r.id) === r
}
/** Ids of every recipe that can be a daily answer (the poster is excluded). */
export const POOL: readonly string[] = RECIPES.filter((r) => r.pool).map((r) => r.id)
/** WALK_PLAN restricted to the recipes registered so far, in day order. */
export const WALK: readonly string[] = WALK_PLAN.filter((id) => byId.has(id))

export function listRecipes(): RecipeInfo[] {
  return RECIPES.map((r) => ({ id: r.id, no: r.no, name: r.name, pool: r.pool }))
}

// Registry of surface recipes by id (a Texturedle "day" = a recipe + seed).
import type { SurfaceRecipe } from './surface'
import { rustyMailbox } from './mailbox'

export const RECIPES: Record<string, (params: Record<string, number>) => SurfaceRecipe> = {
  'rusty-mailbox': (p) => rustyMailbox(p),
}

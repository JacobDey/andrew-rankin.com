// The six storyboards (hub.md §4.3), by slug.

import type { GameSlug } from '@shared/games'
import type { PreviewFactory } from './types'
import { createTexturedlePreview } from './texturedle'
import { createDarkroomPreview } from './darkroom'
import { createPlatesPreview } from './plates'
import { createLatentPreview } from './latent'
import { createLensbenchPreview } from './lensbench'
import { createStudioPreview } from './studio'

export const PREVIEWS: Record<GameSlug, PreviewFactory> = {
  texturedle: createTexturedlePreview,
  darkroom: createDarkroomPreview,
  plates: createPlatesPreview,
  latent: createLatentPreview,
  lensbench: createLensbenchPreview,
  studio: createStudioPreview,
}

export type { Preview, PreviewEnv, PreviewFactory } from './types'
export { createRunner } from './runner'
export type { Runner, Slot, RunnerStats } from './runner'
export { seedOf } from './kit'

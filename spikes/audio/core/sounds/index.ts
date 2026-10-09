// The built-in library. Import a pack to register only what a game needs, or ALL_SOUNDS.
import type { SoundDef } from '../types'
import { ui } from './ui'
import { liquid } from './liquid'
import { darkroom } from './darkroom'
import { camera } from './camera'
import { surface } from './surface'
import { ambience } from './ambience'
import { police } from './police'
import { sea } from './sea'

export { ui, liquid, darkroom, camera, surface, ambience, police, sea }

export const ALL_SOUNDS: SoundDef[] = [...ui, ...liquid, ...darkroom, ...camera, ...surface, ...ambience, ...police, ...sea]

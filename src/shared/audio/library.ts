// Registers the generic sound library (everything except the UI palette, which core.ts already has)
// into the shared engine. Imported for its side effect by index.ts.
import { Audio } from './core'
import { ALL_SOUNDS } from './sounds'

Audio.register(ALL_SOUNDS)

export { ALL_SOUNDS }

// @shared/audio: procedural WebAudio engine + sound library (architecture.md §4.4). Port of spikes/audio/core.
//
//   import { Audio, uiSound } from '@shared/audio'
//   Audio.arm()                                  // mountShell() does this for you
//   Audio.play('shutter.leaf', { t: 1 / 125 })   // one-shot (unknown ids are a silent no-op)
//   const tray = Audio.loop('liquid.slosh')      // loop handle, valid before the first gesture
//   tray.set('energy', 0.4)
//
// Importing this barrel registers the whole generic library into the shared engine. The hub (and
// anything that only needs the chrome palette) should import from '@shared/audio/core' instead,
// which carries only the UI sounds. No three, so the barrel is hub-safe by dependency, not by size.

import './library'

export { Audio, getAudio, sound, uiSound, haptic } from './core'
export type { UiSoundName } from './core'
export { AudioEngine, mergeParams, makeRoomIR } from './engine'
export { Synth, GrainStream, writeGrain, to, stopAll, clamp01, lerp, dbToGain, mulberry32 } from './synth'
export type { NoiseColor, BurstOpts, ToneOpts, ModalOpts, GrainStreamOpts } from './synth'
export * from './types'
export * from './sounds'

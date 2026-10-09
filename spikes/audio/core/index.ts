// Public entry for the procedural audio kit.
//
//   import { Audio } from '.../audio'
//   Audio.arm()                                   // first gesture creates + unlocks the context
//   Audio.play('shutter.leaf', { speed: 1/30 })   // one-shot
//   const tray = Audio.loop('liquid.slosh')       // loop handle (valid before unlock)
//   tray.set('energy', sim.rmsVelocity)           // per frame is fine (coalesced)
//   tray.stop()
import { AudioEngine } from './engine'
import { ALL_SOUNDS } from './sounds'
import type { LoopHandle, SoundPrefs, Voice } from './types'

/** The shared engine, with the whole built-in library registered. */
export const Audio = new AudioEngine().register(ALL_SOUNDS)
export default Audio

export { AudioEngine, mergeParams, makeRoomIR } from './engine'
export { Synth, GrainStream, writeGrain, to, stopAll, clamp01, lerp, dbToGain, mulberry32 } from './synth'
export type { NoiseColor, BurstOpts, ToneOpts, ModalOpts, GrainStreamOpts } from './synth'
export * from './types'
export * from './sounds'

// ---- docs/design/art-direction.md §10.1 compatibility layer ----

/** { ctx, master, ui } or null before the first gesture. */
export function getAudio(): ReturnType<AudioEngine['getAudio']> {
  return Audio.getAudio()
}

export const sound = {
  get muted(): boolean {
    return Audio.muted
  },
  setMuted(m: boolean): void {
    Audio.setMuted(m)
  },
  onChange(cb: (p: SoundPrefs) => void): () => void {
    return Audio.onChange(cb)
  },
}

/** Play a palette sound: uiSound('tick'), uiSound('shutter', { gain: 0.8, detune: -100 }). */
export function uiSound(name: string, opts: { gain?: number; detune?: number } = {}): Voice | null {
  const p: Record<string, number> = {}
  if (opts.gain !== undefined) p.gain = opts.gain
  if (opts.detune !== undefined) p.detune = opts.detune
  return Audio.play('ui.' + name, p)
}

export type { LoopHandle }

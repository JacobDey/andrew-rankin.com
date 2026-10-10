// The lean audio core: the ONE shared engine (with only the UI palette registered), the art-direction
// §10 API (getAudio, sound, uiSound) and haptics. The hub and the shell import this file, so they
// never pay for the rest of the sound library. Games import '@shared/audio' (index.ts), which
// registers the generic library into this same engine.

import { AudioEngine } from './engine'
import { ui } from './sounds/ui'
import type { SoundPrefs, Voice } from './types'

/** The page's single audio engine. */
export const Audio: AudioEngine = new AudioEngine().register(ui)

export type UiSoundName = 'tick' | 'shutter' | 'advance' | 'switch' | 'paper' | 'paper-out' | 'canister' | 'bell' | 'thunk' | 'develop'

const UI_ID: Record<UiSoundName, string> = {
  tick: 'ui.tick',
  shutter: 'ui.shutter',
  advance: 'ui.advance',
  switch: 'ui.switch',
  paper: 'ui.paper',
  'paper-out': 'ui.paperOut',
  canister: 'ui.canister',
  bell: 'ui.bell',
  thunk: 'ui.thunk',
  develop: 'ui.develop',
}

// Haptics only follow touch input (art-direction §10.3).
let lastWasTouch = false
if (typeof window !== 'undefined') {
  const mark = (e: Event): void => {
    lastWasTouch = (e as PointerEvent).pointerType === 'touch' || e.type === 'touchstart'
  }
  window.addEventListener('pointerdown', mark, { capture: true, passive: true })
  window.addEventListener('touchstart', mark, { capture: true, passive: true })
  window.addEventListener('keydown', () => (lastWasTouch = false), { capture: true, passive: true })
}

/** Vibrate (touch input only, only while sound is on). iOS ignores it. */
export function haptic(pattern: number | number[]): void {
  if (!lastWasTouch || Audio.muted) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported or blocked */
  }
}

/** { ctx, master, ui } (art-direction §10.1), or null before the first gesture. */
export function getAudio(): { ctx: AudioContext; master: GainNode; ui: GainNode } | null {
  return Audio.getAudio()
}

export const sound = {
  get muted(): boolean {
    return Audio.muted
  },
  setMuted(m: boolean): void {
    Audio.setMuted(m)
  },
  get volume(): number {
    return Audio.volume
  },
  setVolume(v: number): void {
    Audio.setVolume(v)
  },
  onChange(cb: (p: SoundPrefs) => void): () => void {
    return Audio.onChange(cb)
  },
}

/** Play a chrome palette sound (art-direction §10.2): uiSound('tick'), uiSound('shutter', { gain: 0.8, detune: -100 }). */
export function uiSound(name: UiSoundName, opts: { gain?: number; detune?: number } = {}): Voice | null {
  const id = UI_ID[name]
  if (!id) return null
  const p: Record<string, number> = {}
  if (opts.gain !== undefined) p.gain = opts.gain
  if (opts.detune !== undefined) p.detune = opts.detune
  const v = Audio.play(id, p)
  if (name === 'shutter') haptic(10)
  else if (name === 'switch') haptic(6)
  return v
}

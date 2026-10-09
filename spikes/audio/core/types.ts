// Shared types for the procedural audio kit. No DOM, no AudioContext creation here.
import type { Synth } from './synth'

/** Output buses. `ui` = chrome palette, `sfx` = world one-shots, `amb` = beds and loops. */
export type BusName = 'ui' | 'sfx' | 'amb'

export type GameSlug = 'hub' | 'texturedle' | 'darkroom' | 'plates' | 'latent' | 'lensbench' | 'studio'

export interface ParamSpec {
  min: number
  max: number
  default: number
  step?: number
  unit?: string
  label?: string
  /** Slider maps logarithmically (both ends must be > 0). */
  log?: boolean
  /** Integer enum: the value is an index into this list. */
  options?: string[]
}

export type ParamSpecs = Record<string, ParamSpec>

/**
 * Numeric params passed to a recipe. Defaults from the def are merged in first.
 * Reserved keys handled by the engine: `gain` (linear, default 1), `pan` (-1..1),
 * `when` (seconds from now). `k` is the per-play random pitch factor (~1), always set.
 */
export type Params = Record<string, number>

interface DefBase {
  id: string
  label: string
  /** Demo grouping and docs. */
  group: string
  games: GameSlug[]
  desc?: string
  params?: ParamSpecs
  /** Default `sfx` for one-shots, `amb` for loops. */
  bus?: BusName
}

export interface OneShotDef extends DefBase {
  kind: 'oneshot'
  /** Max simultaneous voices of this id; the oldest is cut (default 8). */
  maxVoices?: number
  /** Seconds. Plays closer together than this are dropped (rate limit). */
  minInterval?: number
  /** Per-play randomization: pitch as a fraction (0.04 = ±4%), gain in ±dB. */
  vary?: { pitch?: number; gain?: number }
  /** Schedule the sound into `out` starting at time `t`. Return the time it is fully silent. */
  play(s: Synth, out: AudioNode, t: number, p: Params): number
}

export interface LoopVoice {
  /** Apply a param change at time t (smoothly). `p` already holds the new value. */
  set(name: string, value: number, t: number): void
  /** Called by the heartbeat ~every 25ms: schedule granular events in [from, to). */
  tick?(from: number, to: number): void
  /** Optional readouts (e.g. the wind's current gust, the sea's swell) for syncing visuals. */
  read?(name: string, now: number): number | undefined
  /**
   * Optional extra cleanup at time t. Every source created during start() is tracked and stopped
   * by the engine after it fades the loop out, so most recipes don't need this.
   */
  stop?(t: number): void
}

export interface LoopDef extends DefBase {
  kind: 'loop'
  start(s: Synth, out: AudioNode, t: number, p: Params): LoopVoice
  /** How the demo/offline preview drives this loop (default: 3s at default params). */
  preview?: { dur?: number; auto?: (t: number, dur: number) => Params }
}

export type SoundDef = OneShotDef | LoopDef

/** Returned by `Audio.loop()`. Valid before init: it starts when audio unlocks. */
export interface LoopHandle {
  readonly id: string
  readonly playing: boolean
  readonly stopped: boolean
  /** Set one param. Coalesced to ~80 updates/s; values are smoothed by the recipe. */
  set(name: string, value: number): LoopHandle
  setMany(params: Params): LoopHandle
  /** Current param value, or a live readout the recipe exposes (e.g. `gust`, `swell`). */
  get(name: string): number | undefined
  /** Loop output gain (linear), ramped. */
  volume(v: number, ramp?: number): LoopHandle
  /** Fade out and release all nodes. */
  stop(fade?: number): void
}

/** Returned by `Audio.play()` (null if audio is locked, muted-suspended or rate-limited). */
export interface Voice {
  readonly id: string
  /** AudioContext time when the sound is silent. */
  readonly end: number
  stop(fade?: number): void
}

export type Quality = 'low' | 'high'

export interface AudioInitOptions {
  /** 'auto' picks 'low' on ≤4 cores. Low drops secondary layers and halves grain rates. */
  quality?: 'auto' | Quality
  /**
   * iOS audio session (Safari 16.4+). 'ambient' respects the silent switch and mixes with
   * other apps' audio (default, polite). 'playback' plays through the silent switch.
   */
  session?: 'ambient' | 'playback'
  latencyHint?: AudioContextLatencyCategory | number
  /** Suspend the context while the tab is hidden (default true). */
  suspendWhenHidden?: boolean
}

export interface SoundPrefs {
  muted: boolean
  volume: number
}

export interface AudioStats {
  state: string
  ready: boolean
  quality: Quality
  sampleRate: number
  baseLatency: number
  outputLatency: number
  voices: number
  loops: number
  nodesCreated: number
  plays: number
  dropped: number
  playCostMs: number
  tickCostMs: number
}

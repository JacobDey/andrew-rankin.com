// A small kit for authoring game sound libraries: alias an existing recipe under a new id with
// adapted params, or declare a "noise -> filter -> gain" bed in a few lines.
import type { BusName, LoopDef, LoopVoice, OneShotDef, ParamSpecs, Params, SoundDef } from '../types'
import { mergeParams } from '../engine'
import { type NoiseColor, type Synth, clamp01, to } from '../synth'

export type GameTag = SoundDef['games'][number]

export interface AliasOptions {
  id: string
  games: GameTag[]
  group?: string
  label?: string
  desc?: string
  caption?: string
  /** The alias's own param specs (default: the base's). */
  params?: ParamSpecs
  /** Convert this def's params into the base def's params (names, ranges). */
  adapt?: (p: Params) => Params
  maxVoices?: number
  minInterval?: number
}

/** The same recipe under a new id (and tagged for a game), optionally with different params. */
export function alias(base: SoundDef, o: AliasOptions): SoundDef {
  const common = {
    id: o.id,
    label: o.label ?? base.label,
    group: o.group ?? base.group,
    games: o.games,
    desc: o.desc ?? base.desc,
    caption: o.caption ?? base.caption,
    params: o.params ?? base.params,
    bus: base.bus,
  }
  if (base.kind === 'oneshot') {
    const def: OneShotDef = {
      ...base,
      ...common,
      kind: 'oneshot',
      maxVoices: o.maxVoices ?? base.maxVoices,
      minInterval: o.minInterval ?? base.minInterval,
      play(s, out, t, p) {
        if (!o.adapt) return base.play(s, out, t, p)
        const q = mergeParams(base, o.adapt(p))
        q.k = p.k
        return base.play(s, out, t, q)
      },
    }
    return def
  }
  const def: LoopDef = {
    ...base,
    ...common,
    kind: 'loop',
    start(s, out, t, p) {
      if (!o.adapt) return base.start(s, out, t, p)
      const q: Params = { ...mergeParams(base, o.adapt(p)), k: p.k ?? 1 }
      const v = base.start(s, out, t, q)
      const wrapped: LoopVoice = {
        ...v,
        set(_name, _value, at) {
          const nq = o.adapt!(p)
          for (const k in nq) {
            const val = nq[k] as number
            q[k] = val
            v.set(k, val, at)
          }
        },
      }
      return wrapped
    },
  }
  return def
}

export interface BedOptions {
  id: string
  games: GameTag[]
  group: string
  label: string
  desc?: string
  caption?: string
  params: ParamSpecs
  bus?: BusName
  color?: NoiseColor
  type?: BiquadFilterType
  /** Map params to the bed: filter centre (Hz), Q, output gain, pan. Called on start and on every param change. */
  map: (p: Params) => { f: number; gain: number; q?: number; pan?: number }
  /** Amplitude modulation of the bed: depth 0..1 at hz. */
  am?: (p: Params) => { hz: number; depth: number }
  /** A second filtered noise layer sharing the same source colour (e.g. a hiss over a rumble). */
  layer?: { type?: BiquadFilterType; q?: number; map: (p: Params) => { f: number; gain: number } }
  /** Extra scheduling (grains, chirps) on top of the bed. */
  extra?: (s: Synth, out: AudioNode, t: number, p: Params) => { tick?: (from: number, until: number) => void; set?: (at: number) => void }
  tau?: number
}

/** A looping filtered-noise bed whose filter, gain and pan follow params (smoothed). */
export function noiseBed(o: BedOptions): LoopDef {
  return {
    kind: 'loop',
    id: o.id,
    label: o.label,
    group: o.group,
    games: o.games,
    desc: o.desc,
    caption: o.caption,
    params: o.params,
    bus: o.bus,
    preview: { dur: 3 },
    start(s, out, t, p) {
      const pan = s.panner(0, out)
      const g = s.gain(0, pan)
      const f = s.filter(o.type ?? 'bandpass', 1000, 0.8, g)
      s.noise(o.color ?? 'white', t, null, f)
      let am: GainNode | null = null
      let lfoGain: GainNode | null = null
      let lfo: OscillatorNode | null = null
      let amBase: GainNode | null = null
      if (o.am) {
        // output = g * (1 - depth/2 + depth/2 * lfo): implemented as a gain whose value is modulated by an LFO
        am = s.gain(0, pan)
        amBase = am
        lfo = s.osc('sine', 1, t, null, null)
        lfoGain = s.gain(0)
        lfo.connect(lfoGain)
        lfoGain.connect(am.gain)
        g.disconnect()
        g.connect(am)
      }
      let layerF: BiquadFilterNode | null = null
      let layerG: GainNode | null = null
      if (o.layer && s.quality) {
        layerG = s.gain(0, pan)
        layerF = s.filter(o.layer.type ?? 'bandpass', 3000, o.layer.q ?? 0.7, layerG)
        s.noise(o.color ?? 'white', t, null, layerF)
      }
      const extra = o.extra?.(s, pan, t, p)
      const apply = (at: number, tau: number): void => {
        const m = o.map(p)
        to(f.frequency, Math.max(40, m.f), at, tau)
        if (m.q !== undefined) to(f.Q, m.q, at, tau)
        to(g.gain, Math.max(0, m.gain), at, tau)
        to(pan.pan, Math.max(-1, Math.min(1, m.pan ?? 0)), at, tau)
        if (o.am && lfo && lfoGain && amBase) {
          const a = o.am(p)
          const d = clamp01(a.depth)
          lfo.frequency.setTargetAtTime(Math.max(0.05, a.hz), at, tau || 0.001)
          to(amBase.gain, 1 - d / 2, at, tau)
          to(lfoGain.gain, d / 2, at, tau)
        }
        if (layerF && layerG && o.layer) {
          const l = o.layer.map(p)
          to(layerF.frequency, Math.max(40, l.f), at, tau)
          to(layerG.gain, Math.max(0, l.gain), at, tau)
        }
        extra?.set?.(at)
      }
      apply(t, 0)
      const voice: LoopVoice = {
        set(_n, _v, at) {
          apply(at, o.tau ?? 0.06)
        },
        tick: extra?.tick,
      }
      return voice
    },
  }
}

/** Shorthand: a one-shot with sensible defaults. */
export function shot(
  o: Omit<OneShotDef, 'kind'>,
): OneShotDef {
  return { kind: 'oneshot', maxVoices: 4, ...o }
}

/** Shorthand for a loop def with a short preview. */
export function loopDef(o: Omit<LoopDef, 'kind'>): LoopDef {
  return { kind: 'loop', preview: { dur: 3 }, ...o }
}

/** An oscillator wired into an AudioParam (vibrato, tremolo, FM): the param moves by +/-depth at `hz`. */
export function modulate(s: Synth, target: AudioParam, hz: number, depth: number, t: number, end: number | null, type: OscillatorType = 'sine'): OscillatorNode {
  const g = s.gain(depth)
  g.connect(target)
  return s.osc(type, hz, t, end, g)
}

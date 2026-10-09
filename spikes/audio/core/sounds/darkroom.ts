// Darkroom hardware: timers, enlarger, safelight, room light, switches.
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { type Synth, clamp01, to } from '../synth'

const G = 'Darkroom'
const DARK: SoundDef['games'] = ['darkroom', 'plates', 'latent', 'studio', 'lensbench']

/** Mechanical escapement tick (tock = the other half of the pair). */
export function escapement(s: Synth, out: AudioNode, t: number, tock: boolean, pitch: number, gain: number): number {
  const f = (tock ? 2100 : 2400) * pitch
  s.burst({ t, out, f, q: 4, gain: 0.6 * gain, attack: 0.0004, decay: 0.012 })
  s.burst({ t, out, f: f * 2.3, q: 3, gain: 0.2 * gain, attack: 0.0003, decay: 0.006 })
  return s.tone({ t, out, f: (tock ? 820 : 900) * pitch, gain: 0.05 * gain, attack: 0.0005, decay: 0.03 })
}

/** Inharmonic bell (free-bar partials 1, 2.76, 5.40, 8.93), with a hammer click. */
export function bell(s: Synth, out: AudioNode, t: number, f: number, decay: number, amp: number): number {
  s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.12 * amp, decay: 0.004 })
  return s.modal({
    t,
    out,
    f,
    ratios: [1, 2.76, 5.4, 8.93],
    gains: [0.25, 0.12, 0.06, 0.03],
    decays: [decay, decay * 0.45, decay * 0.22, decay * 0.12],
    amp,
  })
}

const tickShot: OneShotDef = {
  kind: 'oneshot',
  id: 'timer.tick',
  label: 'Timer tick',
  group: G,
  games: DARK,
  desc: 'One mechanical tick (or tock).',
  params: { tock: { min: 0, max: 1, default: 0, step: 1, options: ['tick', 'tock'] } },
  vary: { pitch: 0.015, gain: 1 },
  maxVoices: 4,
  play(s, out, t, p) {
    return escapement(s, out, t, p.tock >= 1, p.k, 1)
  },
}

const clock: LoopDef = {
  kind: 'loop',
  id: 'timer.clock',
  label: 'Running timer / clockwork',
  group: G,
  games: DARK,
  desc: 'Escapement tick-tock. rate 1 = darkroom timer; 4-5 with pitch 1.6 = pocket watch; plates clockwork = rate 1. Readout: beat (count).',
  params: {
    rate: { min: 0.25, max: 8, default: 1, step: 0.05, unit: 'Hz' },
    pitch: { min: 0.5, max: 2, default: 1, step: 0.01 },
    level: { min: 0, max: 1, default: 0.7, step: 0.01 },
  },
  preview: { dur: 3 },
  start(s, out, t, p) {
    let next = t
    let beat = 0
    return {
      set() {},
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          escapement(s, out, next + s.r(-0.002, 0.002), beat % 2 === 1, p.pitch, p.level)
          beat++
          next += 1 / Math.max(0.05, p.rate)
        }
      },
      read(name) {
        return name === 'beat' ? beat : undefined
      },
    }
  },
}

const beep: OneShotDef = {
  kind: 'oneshot',
  id: 'timer.beep',
  label: 'Timer beep',
  group: G,
  games: DARK,
  desc: 'Digital darkroom timer: piezo beeps.',
  params: {
    count: { min: 1, max: 5, default: 3, step: 1 },
    pitch: { min: 1500, max: 4000, default: 2730, step: 10, unit: 'Hz' },
  },
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t, p) {
    const bp = s.filter('bandpass', p.pitch, 3, out)
    let end = t
    for (let i = 0; i < p.count; i++) {
      const tb = t + i * 0.16
      const g = s.gain(0, bp)
      g.gain.setValueAtTime(0, tb)
      g.gain.linearRampToValueAtTime(0.16, tb + 0.002)
      g.gain.setValueAtTime(0.16, tb + 0.08)
      g.gain.linearRampToValueAtTime(0, tb + 0.083)
      s.osc('square', p.pitch, tb, tb + 0.09, g)
      end = tb + 0.09
    }
    return end
  },
}

const bellShot: OneShotDef = {
  kind: 'oneshot',
  id: 'timer.bell',
  label: 'Timer bell',
  group: G,
  games: DARK,
  desc: 'Mechanical timer bell at zero. strikes > 1 = rattling alarm.',
  params: {
    f: { min: 600, max: 2600, default: 1820, step: 10, unit: 'Hz' },
    strikes: { min: 1, max: 8, default: 1, step: 1 },
    decay: { min: 0.3, max: 3, default: 1.5, step: 0.05, unit: 's' },
  },
  vary: { pitch: 0.01, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    let end = t
    const n = Math.round(p.strikes)
    for (let i = 0; i < n; i++) end = Math.max(end, bell(s, out, t + i * 0.07, p.f * p.k, p.decay, i ? 0.6 : 1))
    return end
  },
}

const wind: OneShotDef = {
  kind: 'oneshot',
  id: 'timer.wind',
  label: 'Timer wind-up',
  group: G,
  games: DARK,
  desc: 'Twisting a mechanical timer: a soft ratchet.',
  params: { turn: { min: 0.1, max: 1, default: 0.5, step: 0.01, label: 'how far' } },
  maxVoices: 2,
  play(s, out, t, p) {
    const n = Math.round(6 + p.turn * 22)
    const dur = 0.25 + p.turn * 0.7
    let end = t
    for (let i = 0; i < n; i++) {
      const x = i / n
      const ti = t + dur * (x + 0.15 * x * (1 - x)) + s.r(-0.003, 0.003)
      end = s.burst({ t: ti, out, f: s.jit(3200 * p.k, 0.05), q: 3, gain: 0.3 * s.r(0.7, 1), decay: 0.006 })
    }
    s.burst({ t, out, f: 1200, q: 0.6, gain: 0.015, attack: 0.05, hold: dur - 0.1, decay: 0.05 })
    return end
  },
}

const enlSwitch: OneShotDef = {
  kind: 'oneshot',
  id: 'enlarger.switch',
  label: 'Enlarger lamp switch',
  group: G,
  games: DARK,
  desc: 'Toggle snap, relay thunk, and (on) a faint filament tink.',
  params: { on: { min: 0, max: 1, default: 1, step: 1, options: ['off', 'on'] } },
  maxVoices: 3,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 2500 * p.k, gain: 0.25, decay: 0.006 })
    s.tone({ t, out, f: 2200 * p.k, gain: 0.03, decay: 0.03 })
    const tt = t + 0.008
    s.burst({ t: tt, out, color: 'brown', type: 'lowpass', f: 300, gain: 0.2, decay: 0.05 })
    let end = s.tone({ t: tt, out, f: 75 * p.k, gain: 0.25, attack: 0.002, decay: 0.07 })
    if (p.on >= 1) end = Math.max(end, s.tone({ t: t + 0.035, out, f: 4500 * p.k, gain: 0.015, decay: 0.02 }))
    return end
  },
}

/** Mains hum: one sawtooth at 2× mains through a lowpass (120/240/360/480 Hz). */
function mainsHum(s: Synth, t: number, out: AudioNode, mains50: boolean, lpf = 520): OscillatorNode {
  const lp = s.filter('lowpass', lpf, 0.9, out)
  return s.osc('sawtooth', mains50 ? 100 : 120, t, null, lp)
}

const enlHum: LoopDef = {
  kind: 'loop',
  id: 'enlarger.hum',
  label: 'Enlarger hum + fan',
  group: G,
  games: DARK,
  desc: 'Lamp transformer hum and the cooling fan (slow 0.3 Hz beating).',
  params: {
    lamp: { min: 0, max: 1, default: 1, step: 0.01 },
    fan: { min: 0, max: 1, default: 0.6, step: 0.01 },
    mains: { min: 0, max: 1, default: 0, step: 1, options: ['60 Hz', '50 Hz'] },
  },
  start(s, out, t, p) {
    const hum = s.gain(0, out)
    const humOsc = mainsHum(s, t, hum, p.mains >= 1)
    const fanOut = s.gain(0, out)
    const am = s.gain(0.75, fanOut)
    const lfo = s.osc('sine', 0.3, t, null)
    const depth = s.gain(0.25)
    lfo.connect(depth)
    depth.connect(am.gain)
    const bp = s.filter('bandpass', 420, 0.6, am)
    s.noise('pink', t, null, bp)
    const blade = s.gain(0, am)
    s.osc('sine', 95, t, null, blade)
    const apply = (at: number, tau: number): void => {
      to(hum.gain, 0.035 * clamp01(p.lamp), at, tau)
      to(fanOut.gain, 0.12 * clamp01(p.fan), at, tau)
      to(blade.gain, 0.08 * clamp01(p.fan), at, tau)
      to(humOsc.frequency, p.mains >= 1 ? 100 : 120, at, 0)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.08)
      },
    }
  },
}

const safelight: LoopDef = {
  kind: 'loop',
  id: 'safelight.buzz',
  label: 'Safelight buzz',
  group: G,
  games: DARK,
  desc: 'Faint 120 Hz hum; `buzz` adds the ballast rasp of a sodium/fluorescent safelight. Fades in over ~1.5s (dark adaptation).',
  params: {
    level: { min: 0, max: 1, default: 0.6, step: 0.01 },
    buzz: { min: 0, max: 1, default: 0.4, step: 0.01 },
    mains: { min: 0, max: 1, default: 0, step: 1, options: ['60 Hz', '50 Hz'] },
  },
  start(s, out, t, p) {
    const master = s.gain(0, out)
    const hum = s.gain(0, master)
    const sine = s.osc('sine', p.mains >= 1 ? 100 : 120, t, null, hum)
    const rasp = s.gain(0, master)
    const lp = s.filter('lowpass', 1200, 0.7, rasp)
    const hp = s.filter('highpass', 300, 0.7, lp)
    const saw = s.osc('sawtooth', p.mains >= 1 ? 100 : 120, t, null, hp)
    const apply = (at: number, tau: number): void => {
      const L = clamp01(p.level)
      to(hum.gain, 0.045 * L, at, tau)
      to(rasp.gain, 0.05 * L * clamp01(p.buzz), at, tau)
      to(lp.frequency, 500 + 2200 * clamp01(p.buzz), at, tau)
      const f = p.mains >= 1 ? 100 : 120
      to(sine.frequency, f, at, 0)
      to(saw.frequency, f, at, 0)
    }
    apply(t, 0)
    master.gain.setValueAtTime(0, t)
    master.gain.setTargetAtTime(1, t, 0.5)
    return {
      set(_n, _v, at) {
        apply(at, 0.1)
      },
    }
  },
}

const chain: OneShotDef = {
  kind: 'oneshot',
  id: 'safelight.chain',
  label: 'Pull-chain',
  group: G,
  games: DARK,
  desc: 'Bead chain rattle, then the switch clack.',
  maxVoices: 2,
  play(s, out, t, p) {
    const n = s.quality ? 12 : 6
    for (let i = 0; i < n; i++) {
      const ti = t + (i / n) * 0.11 + s.r(0, 0.008)
      s.burst({ t: ti, out, f: s.r(3800, 6200) * p.k, q: 3, gain: 0.09 * (1 - i / (n + 2)), decay: 0.006 })
    }
    const tc = t + 0.12
    s.burst({ t: tc, out, f: 1800 * p.k, q: 1, gain: 0.3, decay: 0.012 })
    s.burst({ t: tc + 0.002, out, type: 'highpass', f: 4000, gain: 0.12, decay: 0.004 })
    return s.tone({ t: tc, out, f: 140 * p.k, gain: 0.16, decay: 0.045 })
  },
}

const roomlight: OneShotDef = {
  kind: 'oneshot',
  id: 'roomlight.start',
  label: 'Fluorescent start',
  group: G,
  games: DARK,
  desc: 'Starter tink… tink, a flicker, then the tube buzz swells (start roomlight hum yourself with safelight.buzz buzz=1).',
  maxVoices: 1,
  play(s, out, t, p) {
    const t2 = t + s.r(0.3, 0.5)
    for (const ti of [t, t2]) {
      s.burst({ t: ti, out, f: 5200 * p.k, q: 5, gain: 0.1, decay: 0.02 })
      s.tone({ t: ti, out, f: 3100 * p.k, gain: 0.02, decay: 0.05 })
    }
    const tb = t2 + 0.3
    const g = s.gain(0, out)
    s.shape(g.gain, tb, [
      [0, 0],
      [0.02, 0.05],
      [0.06, 0.005],
      [0.1, 0.05],
      [0.13, 0.01],
      [0.4, 0.04],
      [1.4, 0.0],
    ])
    const hp = s.filter('highpass', 200, 0.7, g)
    s.osc('sawtooth', 120, tb, tb + 1.45, hp)
    return tb + 1.45
  },
}

export const darkroom: SoundDef[] = [tickShot, clock, beep, bellShot, wind, enlSwitch, enlHum, safelight, chain, roomlight]

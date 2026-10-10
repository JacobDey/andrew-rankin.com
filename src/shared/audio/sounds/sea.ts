// The sea and old wood: swell, wave strikes, stick-slip creaks, the hull, the fog bell,
// and the glass-harmonica "fixing chord" (the period mystery's only music).
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { type Synth, clamp01, to, writeGrain } from '../synth'

const G = 'Sea & wood'
const SEA: SoundDef['games'] = ['plates', 'studio']

/**
 * Stick-slip creak: a pulse train (rate rises then falls, with jitter) exciting three narrow
 * wooden resonances. The pulses are written into ONE gain curve over a noise source (Synth.gate),
 * ~2000 curve points per second instead of a per-sample JS buffer: about 0.2 ms to build.
 * tension → pulse rate, size → resonance pitch (bigger = lower).
 */
export function creak(s: Synth, out: AudioNode, t: number, tension: number, dur: number, size: number, gain: number, k = 1): number {
  const base = 18 + 90 * clamp01(tension)
  const sc = (1.4 - 0.8 * clamp01(size)) * k
  const sum = s.gain(gain, out)
  const fs: Array<[number, number, number]> = [
    [180, 14, 1],
    [410, 12, 0.6],
    [950, 9, 0.35],
  ]
  const n = s.quality ? 3 : 2
  const src = s.gain(1)
  for (let i = 0; i < n; i++) {
    const [f, q, g] = fs[i]
    const rg = s.gain(g * 8, sum)
    src.connect(s.filter('bandpass', f * sc, q, rg))
  }
  const grit = s.gain(0.25, sum)
  src.connect(s.filter('lowpass', 2000, 0.7, grit))
  const nz = s.filter('lowpass', 4000, 0.7)
  s.noise('white', t, t + dur + 0.02, nz)
  s.gate(nz, src, t, dur, (w, res) => {
    let x = s.rand() / base
    while (x < dur) {
      const u = x / dur
      const env = Math.pow(Math.sin(Math.PI * u), 0.6)
      writeGrain(w, x / res, env * (0.6 + 0.4 * s.rand()), 0.0002, 0.004, res)
      const rate = base * (0.55 + 0.9 * Math.sin(Math.PI * u))
      x += (1 / rate) * (1 + (s.rand() - 0.5) * 0.35)
    }
  })
  return t + dur + 0.05
}

const creakShot: OneShotDef = {
  kind: 'oneshot',
  id: 'ship.creak',
  label: 'Wood creak',
  group: G,
  games: [...SEA, 'latent'],
  desc: 'Ship timbers, a hinge, the tire-swing rope (small size, high tension), the furnace hatch.',
  params: {
    tension: { min: 0, max: 1, default: 0.5, step: 0.01 },
    dur: { min: 0.2, max: 2.5, default: 1, step: 0.05, unit: 's' },
    size: { min: 0, max: 1, default: 0.5, step: 0.01 },
  },
  vary: { pitch: 0.06, gain: 2 },
  maxVoices: 4,
  play(s, out, t, p) {
    return creak(s, out, t, p.tension, p.dur, p.size, 1, p.k)
  },
}

function waveHit(s: Synth, out: AudioNode, t: number, force: number, k: number): number {
  const F = clamp01(force)
  let end = s.tone({ t, out, f: 45 * k, gain: 0.5 * F, attack: 0.01, decay: 1.5 })
  end = Math.max(end, s.burst({ t, out, color: 'brown', f: 200, q: 1, gain: 0.35 * F, attack: 0.02, decay: 0.6 }))
  end = Math.max(end, s.burst({ t: t + 0.05, out, color: 'pink', f: 900, f2: 400, q: 0.6, gain: 0.14 * F, attack: 0.05, decay: 1.2 }))
  if (s.quality) end = Math.max(end, creak(s, out, t + 0.35, 0.3, 0.9, 0.9, 0.35 * F, k))
  return end
}

const hit: OneShotDef = {
  kind: 'oneshot',
  id: 'sea.wavehit',
  label: 'Wave strike',
  group: G,
  games: SEA,
  desc: 'A wave hitting the tower: 45 Hz thump, a hiss of spray, and the stone/timber creak after.',
  params: { force: { min: 0, max: 1, default: 0.7, step: 0.01 } },
  maxVoices: 2,
  play(s, out, t, p) {
    return waveHit(s, out, t, p.force, p.k)
  },
}

const waves: LoopDef = {
  kind: 'loop',
  id: 'sea.waves',
  label: 'Sea swell',
  group: G,
  games: SEA,
  desc: 'Brown-noise sea swelling on randomized 9-13 s cycles, a wash at each crest, foam fizz after. Readout `swell` (0..1) is the current wave height, for bobbing visuals.',
  params: {
    swell: { min: 0, max: 1, default: 0.5, step: 0.01 },
    distance: { min: 0, max: 1, default: 0.2, step: 0.01, label: 'distance / walls' },
  },
  preview: { dur: 10, auto: () => ({ swell: 0.9 }) },
  start(s, out, t, p) {
    const olp = s.filter('lowpass', 8000, 0.7, out)
    const bed = s.gain(0.08, olp)
    s.noise('brown', t, null, s.filter('lowpass', 300, 0.7, bed))
    const wash = s.gain(0, olp)
    const wbp = s.filter('bandpass', 900, 0.5, wash)
    s.noise('pink', t, null, wbp)
    const fizz = s.gain(0, olp)
    if (s.quality) s.noise('white', t, null, s.filter('highpass', 3000, 0.7, fizz))
    let next = t
    const cycles: Array<{ t0: number; len: number }> = []
    const apply = (at: number, tau: number): void => to(olp.frequency, 8000 - 7200 * clamp01(p.distance), at, tau)
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.3)
      },
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          const S = clamp01(p.swell)
          const len = s.r(9, 13)
          const a = s.r(0.6, 1)
          const rise = len * 0.55
          const crest = next + rise
          bed.gain.setTargetAtTime(0.1 + 0.3 * S * a, next, rise / 3)
          bed.gain.setTargetAtTime(0.06 + 0.06 * S, crest, (len - rise) / 3)
          wash.gain.setTargetAtTime(0.3 * S * a, crest - 0.4, 0.2)
          wash.gain.setTargetAtTime(0.02, crest + 0.2, 1.2)
          wbp.frequency.setTargetAtTime(1300, crest - 0.4, 0.2)
          wbp.frequency.setTargetAtTime(500, crest + 0.2, 1.5)
          fizz.gain.setTargetAtTime(0.05 * S * a, crest, 0.3)
          fizz.gain.setTargetAtTime(0, crest + 0.6, 1.2)
          cycles.push({ t0: next, len })
          if (cycles.length > 3) cycles.shift()
          next += len
        }
      },
      read(name, now) {
        if (name !== 'swell') return undefined
        for (const c of cycles) {
          const x = (now - c.t0) / c.len
          if (x >= 0 && x < 1) return x < 0.55 ? Math.sin((Math.PI / 2) * (x / 0.55)) : Math.cos((Math.PI / 2) * ((x - 0.55) / 0.45))
        }
        return 0
      },
    }
  },
}

const hull: LoopDef = {
  kind: 'loop',
  id: 'ship.hull',
  label: 'Ship hull',
  group: G,
  games: SEA,
  desc: 'Self-playing creaks, rope stretches and deep groans; roll 0..1 sets how hard she is working.',
  params: { roll: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  preview: { dur: 6, auto: () => ({ roll: 1 }) },
  start(s, out, t, p) {
    let next = t + s.r(0.1, 0.8)
    return {
      set() {},
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          const R = clamp01(p.roll)
          const kind = s.rand()
          if (kind < 0.55) creak(s, out, next, s.r(0.2, 0.9), s.r(0.4, 1.6), s.r(0.3, 1), 0.15 + 0.25 * R)
          else if (kind < 0.85) creak(s, out, next, s.r(0.6, 1), s.r(0.2, 0.5), s.r(0, 0.15), 0.1 + 0.15 * R)
          else {
            creak(s, out, next, 0.03, s.r(1.5, 2.2), 1, 0.25 + 0.2 * R)
            s.tone({ t: next, out, f: 55, gain: 0.12 * R, attack: 0.2, decay: 0.6 })
          }
          next += s.r(1.2, 4.5) / (0.3 + R)
        }
      },
    }
  },
}

const fogBell: OneShotDef = {
  kind: 'oneshot',
  id: 'bell.fog',
  label: 'Fog bell',
  group: G,
  games: SEA,
  desc: 'A big bronze bell: hum partial plus free-bar partials (1, 2.76, 5.40, 8.93) × f, long decay.',
  params: {
    f: { min: 120, max: 800, default: 220, step: 1, unit: 'Hz' },
    decay: { min: 1, max: 8, default: 5, step: 0.1, unit: 's' },
  },
  vary: { pitch: 0.005, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    const d = p.decay
    s.burst({ t, out, type: 'lowpass', f: 2000, gain: 0.2, decay: 0.012 })
    return s.modal({
      t,
      out,
      f: p.f * p.k,
      ratios: [0.5, 1, 2.76, 5.4, 8.93],
      gains: [0.15, 0.25, 0.12, 0.06, 0.03],
      decays: [d, d * 0.8, d * 0.45, d * 0.25, d * 0.12],
      attack: 0.002,
      amp: 0.7,
    })
  },
}

// Twelve voicings (MIDI), one per plate.
const CHORDS: number[][] = [
  [72, 76, 79, 83],
  [69, 72, 76, 79],
  [74, 77, 81, 84],
  [71, 74, 79, 83],
  [76, 79, 83, 86],
  [77, 81, 84, 88],
  [72, 77, 79, 84],
  [74, 79, 83, 86],
  [69, 74, 76, 81],
  [71, 76, 79, 83],
  [73, 76, 81, 85],
  [70, 74, 77, 82],
]
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

const chord: OneShotDef = {
  kind: 'oneshot',
  id: 'glass.chord',
  label: 'Glass-harmonica chord',
  group: G,
  games: ['plates', 'darkroom'],
  desc: 'Slow-attack sines with 0.5-2 Hz beating. One chord per plate (0-11); also the darkroom’s one "magic" moment.',
  params: {
    chord: { min: 0, max: 11, default: 0, step: 1 },
    dur: { min: 2, max: 8, default: 4, step: 0.1, unit: 's' },
  },
  vary: { pitch: 0, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    const notes = CHORDS[Math.round(p.chord) % CHORDS.length]
    const d = p.dur
    const lp = s.filter('lowpass', 5000, 0.7, out)
    for (const m of notes) {
      const f = mtof(m)
      const g = s.gain(0, lp)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.03, t + 0.8)
      g.gain.setValueAtTime(0.03, t + Math.max(0.8, d - 1.5))
      g.gain.exponentialRampToValueAtTime(0.00001, t + d)
      const beat = s.r(0.5, 2)
      s.osc('sine', f - beat / 2, t, t + d + 0.02, g)
      s.osc('sine', f + beat / 2, t, t + d + 0.02, g)
      if (s.quality) {
        const h = s.gain(0.15, g)
        s.osc('sine', f * 2, t, t + d + 0.02, h)
      }
    }
    return t + d + 0.02
  },
}

export const sea: SoundDef[] = [waves, hit, creakShot, hull, fogBell, chord]

// Ruby Sector (plates) world sounds (docs/design/plates.md §7.4, architecture.md Appendix B).
// Owned by shared-audio. Call registerSounds() once at boot, then Audio.play('plates.clack', { speed }) etc.
// Ids and params are exactly Appendix B (names match SfxName in contracts.ts).
import {
  Audio,
  alias,
  bubble,
  clamp01,
  creak,
  loopDef,
  noiseBed,
  shot,
  to,
  type SoundDef,
  type Synth,
} from '@shared/audio'

const G = 'Ruby Sector'
const P: SoundDef['games'] = ['plates']

/** A glass clink: inharmonic partials 1, 2.76, 5.40, 8.93 on `base` Hz. */
function glassClink(s: Synth, out: AudioNode, t: number, base: number, amp: number): number {
  s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.08 * amp, attack: 0.0003, decay: 0.003 })
  return s.modal({
    t,
    out,
    f: base,
    ratios: [1, 2.76, 5.4, 8.93],
    gains: [0.3, 0.16, 0.08, 0.04],
    decays: [0.4, 0.3, 0.2, 0.1],
    amp,
  })
}

const clack: SoundDef = shot({
  id: 'plates.clack',
  label: 'Tray clack',
  group: G,
  games: P,
  desc: 'The tray meeting the bench: sines at 180 and 470 Hz (tau 80 ms) and a click.',
  params: { speed: { min: 0, max: 1, default: 0.6, step: 0.01, label: 'impact speed' } },
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    const a = 0.1 + 0.4 * clamp01(p.speed)
    s.burst({ t, out, f: 2600, q: 1.5, gain: 0.3 * a, attack: 0.0003, decay: 0.004 })
    const x = s.tone({ t, out, f: 180 * p.k, gain: 0.6 * a, attack: 0.001, decay: 0.2 })
    const y = s.tone({ t, out, f: 470 * p.k, gain: 0.3 * a, attack: 0.001, decay: 0.2 })
    return Math.max(x, y)
  },
})

const plop: SoundDef = shot({
  id: 'plates.plop',
  label: 'Plop',
  group: G,
  games: P,
  desc: 'A 6 mm Minnaert bubble (about 540 Hz) chirping up 20%, plus a noise splash.',
  vary: { pitch: 0.08, gain: 1.5 },
  play(s, out, t, p) {
    const a = bubble(s, out, t, (3260 / 6) * p.k, 0.3, 0.07, 1.2)
    const b = s.burst({ t, out, f: 1400, q: 0.8, gain: 0.12, attack: 0.002, decay: 0.07 })
    return Math.max(a, b)
  },
})

const drip: SoundDef = shot({
  id: 'plates.drip',
  label: 'Drip',
  group: G,
  games: P,
  desc: 'A Minnaert bubble f = 3.26 / r (r = 1-3 mm, so 1.1-3.3 kHz) chirping up 20% over 40 ms, then decaying in 60 ms.',
  params: { r: { min: 1, max: 3, default: 2, step: 0.05, unit: 'mm', label: 'bubble radius' } },
  vary: { pitch: 0.03, gain: 1.5 },
  maxVoices: 6,
  play(s, out, t, p) {
    const f = (3260 / Math.max(0.5, p.r)) * p.k
    return s.tone({ t, out, f, f2: f * 1.2, glide: 0.04, gain: 0.12, attack: 0.001, decay: 0.06 })
  },
})

const glass: SoundDef = shot({
  id: 'plates.glass',
  label: 'Glass clink',
  group: G,
  games: P,
  desc: 'Modal glass (partials 1, 2.76, 5.40, 8.93) on a 2.1 kHz base, +/-4%.',
  vary: { pitch: 0.04, gain: 1.5 },
  maxVoices: 5,
  play(s, out, t, p) {
    return glassClink(s, out, t, 2100 * p.k, 1)
  },
})

const tink: SoundDef = shot({
  id: 'plates.tink',
  label: 'Tink (plate fixed)',
  group: G,
  games: P,
  desc: 'The glass clink at 3.2 kHz, quieter.',
  vary: { pitch: 0.04, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    return glassClink(s, out, t, 3200 * p.k, 0.55)
  },
})

const fixChord: SoundDef = shot({
  id: 'plates.fixChord',
  label: 'Fixing chord',
  group: G,
  games: P,
  desc: 'Glass-harmonica voices from PlateMeta.chord (MIDI notes n0..n4, 0 = unused): sine plus octave at 0.3, 0.6 s attack, 2.5 s sustain, 1.5 s release, +/-0.7 Hz detune beating.',
  params: {
    n0: { min: 0, max: 96, default: 60, step: 1 },
    n1: { min: 0, max: 96, default: 64, step: 1 },
    n2: { min: 0, max: 96, default: 67, step: 1 },
    n3: { min: 0, max: 96, default: 0, step: 1 },
    n4: { min: 0, max: 96, default: 0, step: 1 },
  },
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t, p) {
    let end = t
    const notes = [p.n0, p.n1, p.n2, p.n3, p.n4].filter((n) => n > 0)
    const amp = 0.16 / Math.sqrt(Math.max(1, notes.length))
    notes.forEach((n, i) => {
      const f = 440 * Math.pow(2, (n - 69) / 12)
      const det = (i % 2 ? 1 : -1) * 0.7
      for (const dd of [-det, det]) {
        const g = s.gain(0, out)
        end = Math.max(end, s.ahr(g.gain, t + i * 0.04, amp * 0.5, 0.6, 2.5, 1.5))
        s.osc('sine', f + dd, t + i * 0.04, end + 0.01, g)
        s.osc('sine', f * 2 + dd, t + i * 0.04, end + 0.01, s.gain(0.3, g))
      }
    })
    return end
  },
})

const stamp: SoundDef = shot({
  id: 'plates.stamp',
  label: 'Stamp',
  group: G,
  games: P,
  desc: 'A rubber stamp: a 70 Hz thud and a paper slap.',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 1000, gain: 0.18, attack: 0.0006, decay: 0.02 })
    return s.tone({ t, out, f: 70 * p.k, f2: 52 * p.k, gain: 0.5, attack: 0.002, decay: 0.12 })
  },
})

const pen: SoundDef = shot({
  id: 'plates.pen',
  label: 'Pen scratch',
  group: G,
  games: P,
  desc: 'Scratchy noise bursts while typing or picking.',
  vary: { pitch: 0.1, gain: 2 },
  maxVoices: 6,
  play(s, out, t) {
    return s.burst({ t, out, f: s.r(3200, 5200), q: 1.6, gain: 0.07, attack: 0.001, hold: s.r(0.01, 0.03), decay: 0.04 })
  },
})

const paper: SoundDef = shot({
  id: 'plates.paper',
  label: 'Paper',
  group: G,
  games: P,
  desc: 'Noise through a 2 kHz band-pass, 120 ms.',
  vary: { pitch: 0.06, gain: 1.5 },
  play(s, out, t, p) {
    return s.burst({ t, out, f: 2000 * p.k, q: 0.9, gain: 0.12, attack: 0.02, decay: 0.1 })
  },
})

const fog: SoundDef = shot({
  id: 'plates.fog',
  label: 'Fog (white light on unfixed glass)',
  group: G,
  games: P,
  desc: 'A sharp tink, then a 0.5 s white-noise swell.',
  vary: { pitch: 0.02, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    glassClink(s, out, t, 3000 * p.k, 0.8)
    return s.burst({ t: t + 0.04, out, type: null, gain: 0.1, attack: 0.28, hold: 0.05, decay: 0.2 })
  },
})

const unwrap = alias(Audio.def('paper.crinkle')!, {
  id: 'plates.unwrap',
  games: P,
  group: G,
  label: 'Unwrap',
  desc: 'Paper and cloth coming off a plate: a long crinkle.',
  adapt: () => ({ dur: 0.55 }),
})

const palette: SoundDef = shot({
  id: 'plates.palette',
  label: 'Palette change',
  group: G,
  games: P,
  desc: 'When the pane comes out: a rising airy tone, noise through a 400 to 1600 Hz band-pass sweep over 0.8 s.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t) {
    return s.burst({ t, out, color: 'pink', f: 400, f2: 1600, q: 3, gain: 0.16, attack: 0.25, hold: 0.25, decay: 0.3 })
  },
})

const pin: SoundDef = shot({
  id: 'plates.pin',
  label: 'Pin',
  group: G,
  games: P,
  desc: 'A drawing pin pressed into the board: a tick and a soft cork thud.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, f: 4200 * p.k, q: 3, gain: 0.2, attack: 0.0003, decay: 0.004 })
    return s.tone({ t, out, f: 190 * p.k, f2: 130 * p.k, gain: 0.2, attack: 0.002, decay: 0.05 })
  },
})

const restore: SoundDef = shot({
  id: 'plates.restore',
  label: 'Restore',
  group: G,
  games: P,
  desc: 'A plate restored: two soft glass notes, rising.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t) {
    const a = s.modal({ t, out, f: 784, ratios: [1, 2.76], gains: [0.2, 0.06], decays: [0.9, 0.3], attack: 0.004 })
    const b = s.modal({ t: t + 0.14, out, f: 1175, ratios: [1, 2.76], gains: [0.2, 0.06], decays: [1.2, 0.4], attack: 0.004 })
    return Math.max(a, b)
  },
})

const lampSwing: SoundDef = shot({
  id: 'plates.lampSwing',
  label: 'Lamp swing creak',
  group: G,
  games: P,
  desc: 'A narrow 900 Hz creak excited in proportion to |theta-dot| (rad/s).',
  params: { speed: { min: 0, max: 4, default: 1, step: 0.01, unit: 'rad/s' } },
  vary: { pitch: 0.05, gain: 1.5 },
  maxVoices: 3,
  minInterval: 0.08,
  play(s, out, t, p) {
    const e = clamp01(p.speed / 2.5)
    return creak(s, out, t, 0.25 + 0.5 * e, 0.12 + 0.3 * e, 0.3, 0.25 * (0.15 + e), p.k)
  },
})

const wick: SoundDef = shot({
  id: 'plates.wick',
  label: 'Wick ratchet',
  group: G,
  games: P,
  desc: 'One ratchet tick as the lamp wick is turned (every 0.05 of travel).',
  vary: { pitch: 0.05, gain: 1 },
  maxVoices: 4,
  play(s, out, t, p) {
    s.burst({ t, out, f: 2200 * p.k, q: 3, gain: 0.16, attack: 0.0004, decay: 0.006 })
    return s.tone({ t, out, f: 900 * p.k, gain: 0.04, attack: 0.0005, decay: 0.02 })
  },
})

const snap: SoundDef = shot({
  id: 'plates.snap',
  label: 'Snap',
  group: G,
  games: P,
  desc: 'A plate seating in its holder: a dry click and a wooden knock.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, f: 3200 * p.k, q: 2, gain: 0.3, attack: 0.0003, decay: 0.006 })
    return s.tone({ t, out, f: 240 * p.k, f2: 180 * p.k, gain: 0.25, attack: 0.001, decay: 0.05 })
  },
})

const wave: SoundDef = shot({
  id: 'plates.wave',
  label: 'Wave strike',
  group: G,
  games: P,
  desc: 'A 38 Hz thump, 600 Hz noise wash, a stone creak 0.3 s later and bottle chatter. Every gain scales with strength.',
  params: { strength: { min: 0.6, max: 1.4, default: 1, step: 0.01 } },
  vary: { pitch: 0.03, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    const k = p.strength
    // thump: 0 -> 0.9 in 10 ms, tau 0.5 s
    const tg = s.gain(0, out)
    tg.gain.setValueAtTime(0, t)
    tg.gain.linearRampToValueAtTime(0.9 * k * 0.5, t + 0.01)
    tg.gain.setTargetAtTime(0, t + 0.01, 0.5)
    s.osc('sine', 38 * p.k, t, t + 2.6, tg)
    // wash: BP 600 Hz Q 0.7, decay 2 s
    s.burst({ t, out, f: 600, q: 0.7, gain: 0.4 * k, attack: 0.03, decay: 2.0 })
    // stone creak: noise impulses at 40/s through a 180 Hz Q 30 resonator for 0.6 s
    const cg = s.gain(0, out)
    const res = s.filter('bandpass', 180, 30, cg)
    s.noise('white', t + 0.3, t + 0.95, res)
    cg.gain.setValueAtTime(0, t + 0.3)
    cg.gain.linearRampToValueAtTime(0.5 * k, t + 0.4)
    cg.gain.linearRampToValueAtTime(0, t + 0.9)
    // bottle chatter: 6-10 ticks, 2-4 kHz, 15 ms each over 0.4 s
    const n = Math.round(s.r(6, 10))
    for (let i = 0; i < n; i++) {
      const tt = t + 0.12 + (i / n) * 0.4 + s.r(0, 0.02)
      s.tone({ t: tt, out, f: s.r(2000, 4000), gain: 0.05 * k, attack: 0.0005, decay: 0.015 })
    }
    return t + 2.7
  },
})

const sea = loopDef({
  id: 'plates.sea',
  label: 'Sea bed',
  group: G,
  games: P,
  desc: 'Brown noise through a 300 Hz low-pass; gain swells between 0.15 and 0.35 on a random 9-13 s period.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    const g = s.gain(0.25, m)
    s.noise('brown', t, null, s.filter('lowpass', 300, 0.7, g))
    const period = s.r(9, 13)
    const lfo = s.osc('sine', 1 / period, t, null, null)
    const lg = s.gain(0.1)
    lfo.connect(lg)
    lg.connect(g.gain)
    to(m.gain, p.level, t, 0.2)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.2)
      },
    }
  },
})

const slosh = noiseBed({
  id: 'plates.slosh',
  label: 'Tray slosh',
  group: G,
  games: P,
  desc: 'Brown noise through a band-pass at 300 + 600 sqrt(KE) Hz, gain 0.5 sqrt(KE), smoothed at 60 ms. energy = normalized KE 0..1.',
  params: { energy: { min: 0, max: 1, default: 0.3, step: 0.01 }, pan: { min: -1, max: 1, default: 0, step: 0.01 } },
  color: 'brown',
  map: (p) => {
    const e = Math.sqrt(clamp01(p.energy))
    return { f: 300 + 600 * e, q: 0.9, gain: 0.5 * e, pan: p.pan }
  },
  tau: 0.06,
})

const flame = loopDef({
  id: 'plates.flame',
  label: 'Lamp flame',
  group: G,
  games: P,
  desc: 'A quiet 1/f crackle: pink noise under sparse soft pops.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.noise('pink', t, null, s.filter('bandpass', 900, 0.5, s.gain(0.012, m)))
    const hp = s.filter('highpass', 2500, 0.7, m)
    const gs = s.stream(null, hp, { chunk: 0.04 })
    s.noise('white', t, null, gs.gate)
    gs.rate = 7
    gs.amp = 0.05
    gs.decay = 0.006
    to(m.gain, p.level, t, 0.2)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.2)
      },
      tick(from, until) {
        gs.fill(from, until)
      },
    }
  },
})

const fizz = loopDef({
  id: 'plates.fizz',
  label: 'Grain fizz',
  group: G,
  games: P,
  desc: 'Very quiet high-passed (6 kHz) noise ticks, Poisson-distributed at a rate proportional to d(density)/dt x area: you hear the image arrive.',
  params: { rate: { min: 0, max: 400, default: 60, step: 1, unit: '/s' } },
  start(s, out, t, p) {
    const gs = s.stream(null, s.filter('highpass', 6000, 0.7, out), { chunk: 0.04 })
    s.noise('white', t, null, gs.gate)
    gs.amp = 0.03
    gs.decay = 0.003
    gs.rate = s.quality ? p.rate : p.rate * 0.5
    return {
      set(_n, _v, _at) {
        gs.rate = s.quality ? p.rate : p.rate * 0.5
      },
      tick(from, until) {
        gs.fill(from, until)
      },
    }
  },
})

const fogBell = alias(Audio.def('bell.fog')!, {
  id: 'plates.fogBell',
  games: P,
  group: G,
  label: 'Fog bell',
  desc: 'The Ruby Sector fog bell, tolling across the water.',
})

const arrival: SoundDef = shot({
  id: 'plates.arrival',
  label: 'Arrival',
  group: G,
  games: P,
  desc: 'Footsteps on stone, then a door.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 1,
  play(s, out, t) {
    let tt = t
    for (let i = 0; i < 5; i++) {
      s.tone({ t: tt, out, f: 95 + (i % 2) * 12, f2: 60, gain: 0.3, attack: 0.002, decay: 0.07 })
      s.burst({ t: tt, out, f: 700, q: 1, gain: 0.1, attack: 0.001, decay: 0.03 })
      tt += 0.5 - i * 0.02
    }
    // the door: a latch click, a creak, a thud
    s.burst({ t: tt + 0.2, out, f: 2400, q: 3, gain: 0.22, attack: 0.0004, decay: 0.008 })
    creak(s, out, tt + 0.35, 0.5, 0.7, 0.7, 0.22, 1)
    s.tone({ t: tt + 1.1, out, f: 70, f2: 48, gain: 0.5, attack: 0.002, decay: 0.2 })
    return tt + 1.5
  },
})

export const SOUNDS: SoundDef[] = [
  clack, plop, drip, glass, tink, fixChord, stamp, pen, paper, fog, unwrap, palette, pin, restore, lampSwing, wick,
  snap, wave, sea, slosh, flame, fizz, fogBell, arrival,
]

let registered = false
/** Register every plates.* sound with the shared engine. Idempotent. */
export function registerSounds(): void {
  if (registered) return
  registered = true
  Audio.register(SOUNDS)
}

// Lens Bench world sounds (docs/design/lensbench.md §7.3, architecture.md Appendix B).
// Owned by shared-audio. Call registerSounds() once at boot, then Audio.play('lensbench.leaf', { t: 1 / 125 }).
// Shutters take the real exposure in seconds: the two sounds are always exactly that far apart.
import {
  Audio,
  bell,
  clamp01,
  loopDef,
  noiseBed,
  shot,
  to,
  type SoundDef,
  type Synth,
} from '@shared/audio'

const G = 'Lens Bench'
const B: SoundDef['games'] = ['lensbench']
const EXPOSURE = { min: 1 / 4000, max: 30, default: 1 / 125, step: 0.0001, log: true, unit: 's', label: 'exposure' } as const
/** A far-future second sound is fine, but keep one-shot voices to a sane length. */
const maxGap = (t: number): number => Math.min(12, Math.max(0.0005, t))

const leaf: SoundDef = shot({
  id: 'lensbench.leaf',
  label: 'Leaf shutter',
  group: G,
  games: B,
  desc: 'Two 4 ms band-passed clicks at 3.8 kHz, scheduled t seconds apart.',
  params: { t: EXPOSURE },
  vary: { pitch: 0.02, gain: 0.8 },
  maxVoices: 2,
  play(s, out, t, p) {
    const gap = maxGap(p.t)
    s.burst({ t, out, f: 3800 * p.k, q: 2.5, gain: 0.3, attack: 0.0003, decay: 0.004 })
    return s.burst({ t: t + gap, out, f: 3500 * p.k, q: 2.5, gain: 0.22, attack: 0.0003, decay: 0.004 })
  },
})

const clothFp: SoundDef = shot({
  id: 'lensbench.cloth-fp',
  label: 'Cloth focal plane',
  group: G,
  games: B,
  desc: 'Two low-passed (1.5 kHz) thups with flutter; the second follows t + 18 ms after the first.',
  params: { t: EXPOSURE },
  vary: { pitch: 0.03, gain: 0.8 },
  maxVoices: 2,
  play(s, out, t, p) {
    const gap = maxGap(p.t) + 0.018
    const thup = (at: number, a: number): number => {
      s.burst({ t: at, out, type: 'lowpass', f: 1500, q: 0.8, gain: 0.3 * a, attack: 0.002, decay: 0.03 })
      for (let i = 0; i < 4; i++) s.burst({ t: at + 0.012 + i * 0.006, out, f: s.r(1800, 2800), q: 2, gain: 0.05 * a, attack: 0.0006, decay: 0.006 })
      return s.tone({ t: at, out, f: 110 * p.k, gain: 0.12 * a, attack: 0.002, decay: 0.05 })
    }
    thup(t, 1)
    return thup(t + gap, 0.75)
  },
})

const metalFp: SoundDef = shot({
  id: 'lensbench.metal-fp',
  label: 'Metal focal plane + mirror',
  group: G,
  games: B,
  desc: 'A 60 Hz thump with a 2 kHz ring decaying over 90 ms, then a tick t later; mirror adds the slap before it.',
  params: { t: EXPOSURE, mirror: { min: 0, max: 1, default: 1, step: 1, options: ['no mirror', 'SLR mirror'] } },
  vary: { pitch: 0.03, gain: 0.8 },
  maxVoices: 2,
  play(s, out, t, p) {
    const gap = maxGap(p.t)
    let at = t
    if (p.mirror >= 0.5) {
      s.burst({ t, out, f: 700, q: 1, gain: 0.25, attack: 0.001, decay: 0.03 })
      s.tone({ t, out, f: 80 * p.k, f2: 55 * p.k, gain: 0.3, attack: 0.002, decay: 0.07 })
      at = t + 0.025
    }
    s.tone({ t: at, out, f: 60 * p.k, gain: 0.35, attack: 0.001, decay: 0.08 })
    s.tone({ t: at, out, f: 2000 * p.k, gain: 0.07, attack: 0.0005, decay: 0.09 })
    s.burst({ t: at + gap, out, f: 3000, q: 3, gain: 0.18, attack: 0.0003, decay: 0.006 })
    return s.tone({ t: at + gap, out, f: 1800 * p.k, gain: 0.04, attack: 0.0005, decay: 0.04 })
  },
})

const roller: SoundDef = shot({
  id: 'lensbench.roller',
  label: 'Roller-blind shutter',
  group: G,
  games: B,
  desc: 'A cloth zip of travel time tc: noise through an amplitude-modulated comb.',
  params: { tc: { min: 0.002, max: 0.08, default: 0.015, step: 0.001, unit: 's', label: 'curtain travel' } },
  vary: { pitch: 0.04, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    const dur = Math.max(0.02, p.tc * 4)
    const g = s.gate(null, out, t, dur, (w, res) => {
      const n = w.length
      for (let i = 0; i < n; i++) {
        const x = i / n
        const env = Math.sin(Math.PI * x)
        w[i] = env * (0.55 + 0.45 * Math.sin(i * res * 2 * Math.PI * 340)) * 0.2
      }
    })
    s.noise('white', t, t + dur + 0.02, s.filter('bandpass', 2400 * p.k, 0.9, g))
    return t + dur
  },
})

const cap: SoundDef = shot({
  id: 'lensbench.cap',
  label: 'Lens cap',
  group: G,
  games: B,
  desc: 'A felt fff as the cap is pulled off (open 1) or put back (open 0).',
  params: { open: { min: 0, max: 1, default: 1, step: 1, options: ['on', 'off'] } },
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    const up = p.open >= 0.5
    return s.burst({ t, out, f: up ? 1100 : 1700, f2: up ? 1700 : 1000, q: 0.8, gain: 0.08, attack: 0.02, hold: 0.03, decay: 0.07 })
  },
})

const escapement: SoundDef = shot({
  id: 'lensbench.escapement',
  label: 'Slow-speed escapement',
  group: G,
  games: B,
  desc: 'A 180 Hz square band-passed, +/-10% jitter, running under the exposure gap (1/8 s and slower).',
  params: { dur: { min: 0.1, max: 4, default: 0.5, step: 0.01, unit: 's' } },
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    const dur = Math.min(4, p.dur)
    const g = s.gain(0, out)
    const rate = 180
    // jittered pulse train through a resonant band-pass
    g.gain.setValueAtTime(0.1, t)
    g.gain.setValueAtTime(0.1, t + dur)
    g.gain.linearRampToValueAtTime(0, t + dur + 0.02)
    const o = s.osc('square', rate, t, t + dur + 0.03, s.filter('bandpass', 700, 2.5, g))
    for (let at = t; at < t + dur; at += 0.02) o.frequency.setValueAtTime(rate * s.r(0.9, 1.1), at)
    return t + dur + 0.02
  },
})

const advance: SoundDef = shot({
  id: 'lensbench.advance',
  label: 'Film advance',
  group: G,
  games: B,
  desc: 'Seven noise ticks rising in pitch, then a counter thunk.',
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    for (let i = 0; i < 7; i++) s.burst({ t: t + i * 0.034, out, f: (1700 + i * 210) * p.k, q: 3, gain: 0.16, attack: 0.0004, decay: 0.01 })
    return s.tone({ t: t + 0.27, out, f: 120 * p.k, f2: 80 * p.k, gain: 0.3, attack: 0.002, decay: 0.07 })
  },
})

const rewind: SoundDef = shot({
  id: 'lensbench.rewind',
  label: 'Film rewind',
  group: G,
  games: B,
  desc: 'A friction zip that goes slack at the end.',
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 1,
  play(s, out, t) {
    const dur = 1.3
    const g = s.gate(null, out, t, dur, (w, res) => {
      const n = w.length
      for (let i = 0; i < n; i++) {
        const x = i / n
        const slack = x > 0.82 ? 1 - (x - 0.82) / 0.18 : 1
        w[i] = Math.min(1, x * 12) * slack * (0.6 + 0.4 * Math.sin(i * res * 2 * Math.PI * (60 - x * 25))) * 0.09
      }
    })
    s.noise('white', t, t + dur + 0.02, s.filter('bandpass', 2600, 1.2, g))
    return t + dur
  },
})

const detent: SoundDef = shot({
  id: 'lensbench.detent',
  label: 'Detent',
  group: G,
  games: B,
  desc: 'A 6 kHz tick, 3 ms.',
  vary: { pitch: 0.06, gain: 1.5 },
  maxVoices: 4,
  minInterval: 0.02,
  play(s, out, t, p) {
    return s.burst({ t, out, f: 6000 * p.k, q: 2.5, gain: 0.1, attack: 0.0002, decay: 0.003 })
  },
})

const rub = noiseBed({
  id: 'lensbench.rub',
  label: 'Rail rub / focus',
  group: G,
  games: B,
  desc: 'Brown noise whose gain tracks the slide velocity (0..1).',
  params: { vel: { min: 0, max: 1, default: 0.3, step: 0.01 } },
  color: 'brown',
  type: 'bandpass',
  map: (p) => ({ f: 380 + 700 * clamp01(p.vel), q: 0.9, gain: 0.35 * Math.pow(clamp01(p.vel), 1.2) }),
  tau: 0.04,
})

const clink: SoundDef = shot({
  id: 'lensbench.clink',
  label: 'Glass clink',
  group: G,
  games: B,
  desc: 'Two pieces of glass meeting; v is the impact speed 0..1.',
  params: { v: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  vary: { pitch: 0.06, gain: 1.5 },
  maxVoices: 4,
  play(s, out, t, p) {
    const a = 0.15 + 0.85 * clamp01(p.v)
    s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.07 * a, attack: 0.0003, decay: 0.003 })
    return s.modal({ t, out, f: 2400 * p.k, ratios: [1, 1.73, 2.33], gains: [0.22 * a, 0.1 * a, 0.05 * a], decays: [0.4, 0.2, 0.12] })
  },
})

const creakShot: SoundDef = shot({
  id: 'lensbench.creak',
  label: 'Creak',
  group: G,
  games: B,
  desc: 'A resonant band-pass sweep whose Q tracks |c| (the lens curvature being bent).',
  params: { c: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  vary: { pitch: 0.06, gain: 1.5 },
  maxVoices: 3,
  play(s, out, t, p) {
    const c = clamp01(p.c)
    const dur = 0.2 + 0.25 * c
    const g = s.gain(0, out)
    const end = s.ahr(g.gain, t, 0.07 + 0.08 * c, 0.02, dur * 0.4, dur * 0.4)
    const f = s.filter('bandpass', 700 * p.k, 4 + 22 * c, g)
    f.frequency.setValueAtTime(700 * p.k, t)
    f.frequency.exponentialRampToValueAtTime(1500 * p.k, t + dur)
    s.noise('white', t, end + 0.01, f)
    return end
  },
})

const ping: SoundDef = shot({
  id: 'lensbench.ping',
  label: 'Glass ping',
  group: G,
  games: B,
  desc: 'Partials 1 : 1.73 : 2.33, decays 1.2 / 0.6 / 0.3 s, plus a 2 ms click. f0 in Hz (the tapped lens).',
  params: { f0: { min: 300, max: 3000, default: 1400, step: 1, unit: 'Hz', log: true } },
  vary: { pitch: 0.01, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3500, gain: 0.1, attack: 0.0002, decay: 0.002 })
    return s.modal({ t, out, f: Math.max(300, Math.min(3000, p.f0)) * p.k, ratios: [1, 1.73, 2.33], gains: [0.25, 0.12, 0.06], decays: [1.2, 0.6, 0.3] })
  },
})

const needle: SoundDef = shot({
  id: 'lensbench.needle',
  label: 'Meter needle',
  group: G,
  games: B,
  desc: 'A tiny click as the light-meter needle settles.',
  vary: { pitch: 0.05, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    return s.burst({ t, out, f: 4200 * p.k, q: 2, gain: 0.08, attack: 0.0003, decay: 0.004 })
  },
})

const chime: SoundDef = shot({
  id: 'lensbench.chime',
  label: 'Chime',
  group: G,
  games: B,
  desc: 'A small bell: sines at 1.2 kHz and 1.8 kHz.',
  vary: { pitch: 0, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t) {
    const a = s.tone({ t, out, f: 1200, gain: 0.16, attack: 0.002, decay: 0.7 })
    const b = s.tone({ t: t + 0.09, out, f: 1800, gain: 0.14, attack: 0.002, decay: 0.9 })
    return Math.max(a, b)
  },
})

const pour: SoundDef = shot({
  id: 'lensbench.pour',
  label: 'Tank pour',
  group: G,
  games: B,
  desc: 'Developer going into the tank: filtered noise whose pitch rises as it fills.',
  vary: { pitch: 0, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t) {
    return s.burst({ t, out, type: 'bandpass', f: 500, f2: 1700, q: 1.2, gain: 0.14, attack: 0.05, hold: 1.2, decay: 0.2 })
  },
})

const glug: SoundDef = shot({
  id: 'lensbench.glug',
  label: 'Tank glug',
  group: G,
  games: B,
  desc: 'The slosh of an inversion.',
  vary: { pitch: 0.08, gain: 1.5 },
  play(s, out, t) {
    const f = s.r(150, 260)
    return s.tone({ t, out, f, f2: f * 1.7, glide: 0.04, gain: 0.2, attack: 0.002, decay: 0.07 })
  },
})

const tick = Audio.def('timer.tick')!
const tickShot: SoundDef = { ...tick, id: 'lensbench.tick', games: B, group: G, desc: 'Timer escapement tick for the developing tank.' } as SoundDef

const bellShot: SoundDef = shot({
  id: 'lensbench.bell',
  label: 'Timer ding',
  group: G,
  games: B,
  desc: 'A ding at the end of development.',
  vary: { pitch: 0.01, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    return bell(s, out, t, 1820 * p.k, 1.2, 1)
  },
})

const stamp: SoundDef = shot({
  id: 'lensbench.stamp',
  label: 'Patent stamp',
  group: G,
  games: B,
  desc: 'A rubber stamp thud and a paper slap.',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 1000, gain: 0.2, attack: 0.0006, decay: 0.02 })
    return s.tone({ t, out, f: 75 * p.k, f2: 55 * p.k, gain: 0.45, attack: 0.002, decay: 0.12 })
  },
})

/** A little FM chirp of a bird. */
function chirp(s: Synth, out: AudioNode, t: number, f: number, gain: number): number {
  const g = s.gain(0, out)
  const end = s.ahr(g.gain, t, gain, 0.006, 0.012, 0.05)
  const car = s.osc('sine', f, t, end + 0.01, g)
  car.frequency.setValueAtTime(f, t)
  car.frequency.linearRampToValueAtTime(f * s.r(1.1, 1.35), t + 0.07)
  const mg = s.gain(f * 0.5)
  mg.connect(car.frequency)
  s.osc('sine', f * 1.5, t, end + 0.01, mg)
  return end
}

const street = loopDef({
  id: 'lensbench.street',
  label: 'Street bed',
  group: G,
  games: B,
  desc: 'Wind (pink noise, gain from the same W(t) that drives the windmill), FM bird chirps, and a fountain (band-passed noise, louder as you near it).',
  params: {
    wind: { min: 0, max: 1, default: 0.3, step: 0.01 },
    fountain: { min: 0, max: 1, default: 0.2, step: 0.01, label: 'fountain loudness (1 / distance)' },
  },
  start(s, out, t, p) {
    const wind = s.gain(0, out)
    const wf = s.filter('lowpass', 500, 0.6, wind)
    s.noise('pink', t, null, wf)
    const fount = s.gain(0, out)
    s.noise('white', t, null, s.filter('bandpass', 2600, 0.5, fount))
    const apply = (at: number): void => {
      to(wf.frequency, 300 + 700 * clamp01(p.wind), at, 0.2)
      to(wind.gain, 0.04 + 0.2 * clamp01(p.wind), at, 0.25)
      to(fount.gain, 0.12 * clamp01(p.fountain), at, 0.3)
    }
    apply(t)
    let next = t + s.r(1, 4)
    return {
      set(_n, _v, at) {
        apply(at)
      },
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          const n = Math.round(s.r(2, 5))
          const base = s.r(3600, 5600)
          for (let i = 0; i < n; i++) chirp(s, out, next + i * 0.11, base * s.r(0.92, 1.08), 0.035)
          next += s.r(3, 9)
        }
      },
    }
  },
})

const courierBell: SoundDef = shot({
  id: 'lensbench.courier-bell',
  label: 'Courier bell',
  group: G,
  games: B,
  desc: 'A bicycle bell, two rings. Pitch it with detune for the Doppler pass.',
  vary: { pitch: 0.01, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    let end = t
    for (let i = 0; i < 2; i++) end = Math.max(end, s.modal({ t: t + i * 0.17, out, f: 2600 * p.k, ratios: [1, 2.4, 4.1], gains: [0.2, 0.09, 0.04], decays: [0.7, 0.35, 0.2] }))
    return end
  },
})

const clockBell: SoundDef = shot({
  id: 'lensbench.clock-bell',
  label: 'Clock bell',
  group: G,
  games: B,
  desc: 'The church clock striking the quarter hour: a low bell with a long tail.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t) {
    return bell(s, out, t, 392, 3.4, 0.9)
  },
})

const achromat: SoundDef = shot({
  id: 'lensbench.achromat',
  label: 'Achromat resolve',
  group: G,
  games: B,
  desc: 'A two-note chord that turns consonant as the longitudinal chromatic spread falls below EFL/1500 (consonance 0 = clashing, 1 = a clean fifth).',
  params: { consonance: { min: 0, max: 1, default: 1, step: 0.01 } },
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t, p) {
    const c = clamp01(p.consonance)
    const f1 = 440
    const ratio = 1.0595 + (1.5 - 1.0595) * c // a semitone clash to a perfect fifth
    const a = s.modal({ t, out, f: f1, ratios: [1, 2], gains: [0.16, 0.05], decays: [1.4, 0.8], attack: 0.01 })
    const b = s.modal({ t: t + 0.03, out, f: f1 * ratio, ratios: [1, 2], gains: [0.14, 0.04], decays: [1.4, 0.8], attack: 0.01 })
    return Math.max(a, b)
  },
})

export const SOUNDS: SoundDef[] = [
  leaf, clothFp, metalFp, roller, cap, escapement, advance, rewind, detent, rub, clink, creakShot, ping, needle, chime,
  pour, glug, tickShot, bellShot, stamp, street, courierBell, clockBell, achromat,
]

let registered = false
/** Register every lensbench.* sound with the shared engine. Idempotent. */
export function registerSounds(): void {
  if (registered) return
  registered = true
  Audio.register(SOUNDS)
}

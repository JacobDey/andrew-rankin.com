// Sunny 16 (studio) world sounds (docs/design/studio.md §7.3, architecture.md Appendix B).
// Owned by shared-audio. Call registerSounds() once at boot. Postcard replies use uiSound('bell') and uiSound('develop').
// The world mix is the game's to duck (6 dB in the darkroom, and Audio.setMuffle(900) for "underground").
import {
  Audio,
  alias,
  clamp01,
  creak,
  loopDef,
  noiseBed,
  shot,
  to,
  type Params,
  type SoundDef,
  type Synth,
} from '@shared/audio'

const G = 'Sunny 16'
const S: SoundDef['games'] = ['studio']
const EXPOSURE = { min: 1 / 4000, max: 30, default: 1 / 125, step: 0.0001, log: true, unit: 's', label: 'exposure' } as const
const maxGap = (t: number): number => Math.min(12, Math.max(0.0005, t))

// ---- yard beds (aliases of the generic ambience) ------------------------------------------
const cicadas = alias(Audio.def('yard.cicadas')!, {
  id: 'studio.cicadas',
  games: S,
  group: G,
  label: 'Cicadas (day bed)',
  desc: 'Band-passed noise at 4.5-6 kHz, AM at 70 Hz inside 3-8 s swells. level 0..1 follows the sun elevation, peaking around 14:00.',
  params: { level: { min: 0, max: 1, default: 0.6, step: 0.01 } },
  adapt: (p: Params) => ({ intensity: clamp01(p.level) }),
})

const crickets = alias(Audio.def('yard.crickets')!, {
  id: 'studio.crickets',
  games: S,
  group: G,
  label: 'Crickets (night bed)',
  desc: '4.5 kHz chirps of three pulses; Dolbear rate N = 40 + 4 (T_F - 50) chirps a minute. tempF is the night temperature in degrees F.',
  params: { tempF: { min: 45, max: 100, default: 68, step: 1, unit: '°F' } },
  adapt: (p: Params) => ({ tempF: p.tempF, count: 3 }),
})

const wind = alias(Audio.def('yard.wind')!, {
  id: 'studio.wind',
  games: S,
  group: G,
  label: 'Wind',
  desc: 'Noise through a low-pass (300 + 400 w Hz) following the gust envelope. w is the wind speed in m/s.',
  params: { w: { min: 0, max: 12, default: 3, step: 0.05, unit: 'm/s' } },
  adapt: (p: Params) => ({ strength: clamp01(p.w / 10), gustiness: 0.6 }),
})

const TUBES = [587, 659, 740, 880, 988]
const chime: SoundDef = shot({
  id: 'studio.chime',
  label: 'Wind chime tube',
  group: G,
  games: S,
  desc: 'One tube: free-free bar partials 1 : 2.756 : 5.404 : 8.933 (gains 1, 0.35, 0.15, 0.06; decays 4, 2, 1, 0.5 s), D pentatonic 587 659 740 880 988 Hz.',
  params: { tube: { min: 0, max: 4, default: 0, step: 1 } },
  vary: { pitch: 0.003, gain: 2 },
  maxVoices: 8,
  play(s, out, t, p) {
    const f = TUBES[Math.max(0, Math.min(4, Math.round(p.tube)))] as number
    s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.02, attack: 0.0003, decay: 0.003 })
    return s.modal({ t, out, f: f * p.k, ratios: [1, 2.756, 5.404, 8.933], gains: [0.1, 0.035, 0.015, 0.006], decays: [4, 2, 1, 0.5] })
  },
})

const tsk: SoundDef = shot({
  id: 'studio.sprinkler-tsk',
  label: 'Sprinkler tsk',
  group: G,
  games: S,
  desc: 'Each step of the impact sprinkler: noise 8 ms through a 3 kHz high-pass plus a 2.8 kHz ping, 30 ms.',
  vary: { pitch: 0.05, gain: 1.5 },
  maxVoices: 3,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.2, attack: 0.0004, decay: 0.008 })
    return s.tone({ t, out, f: 2800 * p.k, gain: 0.06, attack: 0.0005, decay: 0.03 })
  },
})

const sprinklerReturn: SoundDef = shot({
  id: 'studio.sprinkler-return',
  label: 'Sprinkler return',
  group: G,
  games: S,
  desc: 'The arm swinging back: 18 clicks over 1.2 s.',
  vary: { pitch: 0.03, gain: 1 },
  maxVoices: 1,
  play(s, out, t, p) {
    let end = t
    for (let i = 0; i < 18; i++) {
      const at = t + i * (1.2 / 18) + s.r(-0.004, 0.004)
      end = Math.max(end, s.burst({ t: at, out, f: (2200 + i * 40) * p.k, q: 3, gain: 0.1, attack: 0.0004, decay: 0.006 }))
    }
    return end
  },
})

const spray = noiseBed({
  id: 'studio.spray',
  label: 'Sprinkler spray',
  group: G,
  games: S,
  desc: 'Hiss: noise through a 6 kHz band-pass; level = water on / distance.',
  params: { level: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  map: (p) => ({ f: 6000, q: 0.7, gain: 0.09 * clamp01(p.level) }),
  tau: 0.2,
})

// ---- shutters -----------------------------------------------------------------------------
const leaf: SoundDef = shot({
  id: 'studio.leaf',
  label: 'Leaf shutter',
  group: G,
  games: S,
  desc: 'One dry tik (noise 4 ms through a 4 kHz band-pass), then a second, quieter one exactly t seconds later.',
  params: { t: EXPOSURE },
  vary: { pitch: 0.02, gain: 0.8 },
  maxVoices: 2,
  play(s, out, t, p) {
    s.burst({ t, out, f: 4000 * p.k, q: 2.5, gain: 0.3, attack: 0.0003, decay: 0.004 })
    return s.burst({ t: t + maxGap(p.t), out, f: 3700 * p.k, q: 2.5, gain: 0.2, attack: 0.0003, decay: 0.004 })
  },
})

const drop: SoundDef = shot({
  id: 'studio.drop',
  label: 'Gravity-drop shutter',
  group: G,
  games: S,
  desc: 'A wooden clatter (three noise bursts through a 1.2 kHz band-pass) and a bounce at landing; h is the drop height in metres.',
  params: { h: { min: 0.02, max: 0.6, default: 0.2, step: 0.01, unit: 'm' } },
  vary: { pitch: 0.03, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    const fall = Math.sqrt((2 * p.h) / 9.81)
    for (let i = 0; i < 3; i++) s.burst({ t: t + i * 0.012, out, f: 1200 * p.k, q: 1.6, gain: 0.22, attack: 0.0006, decay: 0.012 })
    const land = t + fall
    s.burst({ t: land, out, f: 900, q: 1.2, gain: 0.3, attack: 0.0006, decay: 0.03 })
    return s.tone({ t: land, out, f: 140 * p.k, gain: 0.25, attack: 0.001, decay: 0.06 })
  },
})

const focal: SoundDef = shot({
  id: 'studio.focal',
  label: 'Focal-plane shutter',
  group: G,
  games: S,
  desc: 'Two cloth transients spaced by tc + t (curtain travel plus exposure).',
  params: { t: EXPOSURE, tc: { min: 0.002, max: 0.03, default: 0.012, step: 0.001, unit: 's', label: 'curtain travel' } },
  vary: { pitch: 0.03, gain: 0.8 },
  maxVoices: 2,
  play(s, out, t, p) {
    const thup = (at: number, a: number): number => {
      s.burst({ t: at, out, type: 'lowpass', f: 1600, q: 0.8, gain: 0.3 * a, attack: 0.002, decay: 0.03 })
      return s.tone({ t: at, out, f: 105 * p.k, gain: 0.12 * a, attack: 0.002, decay: 0.05 })
    }
    thup(t, 1)
    return thup(t + p.tc + maxGap(p.t), 0.75)
  },
})

const cap: SoundDef = shot({
  id: 'studio.cap',
  label: 'Lens cap',
  group: G,
  games: S,
  desc: 'A felt fff on pull (open 1) and replace (open 0).',
  params: { open: { min: 0, max: 1, default: 1, step: 1, options: ['on', 'off'] } },
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    const up = p.open >= 0.5
    return s.burst({ t, out, f: up ? 1100 : 1700, f2: up ? 1700 : 1000, q: 0.8, gain: 0.08, attack: 0.02, hold: 0.03, decay: 0.07 })
  },
})

const selftimer = alias(Audio.def('selftimer')!, {
  id: 'studio.selftimer',
  games: S,
  group: G,
  label: 'Self-timer',
  desc: 'A 30 Hz pulse train through a resonant 900 Hz band-pass for dur seconds (10 by default); fire studio.leaf or studio.focal at the end.',
  params: { dur: { min: 1, max: 12, default: 10, step: 0.1, unit: 's' } },
})

const windOn: SoundDef = shot({
  id: 'studio.wind-on',
  label: 'Film wind-on',
  group: G,
  games: S,
  desc: 'A ratchet of nine clicks per stroke (noise 3 ms through a band-pass falling 2.4 to 1.9 kHz), then a thunk at the stop.',
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    for (let i = 0; i < 9; i++) s.burst({ t: t + i * 0.032, out, f: (2400 - i * 55) * p.k, q: 3, gain: 0.15, attack: 0.0004, decay: 0.008 })
    return s.tone({ t: t + 0.32, out, f: 110 * p.k, f2: 75 * p.k, gain: 0.3, attack: 0.002, decay: 0.07 })
  },
})

const thock: SoundDef = shot({
  id: 'studio.thock',
  label: 'Thock (part snaps on)',
  group: G,
  games: S,
  desc: 'A 120 Hz sine, 40 ms, with a felt click (noise 5 ms through a 1.5 kHz low-pass).',
  vary: { pitch: 0.06, gain: 1.5 },
  maxVoices: 4,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'lowpass', f: 1500, gain: 0.2, attack: 0.001, decay: 0.005 })
    return s.tone({ t, out, f: 120 * p.k, f2: 90 * p.k, gain: 0.3, attack: 0.001, decay: 0.04 })
  },
})

const bellows = alias(Audio.def('bellows')!, {
  id: 'studio.bellows',
  games: S,
  group: G,
  label: 'Bellows',
  desc: 'Noise through a 400 Hz band-pass, gain following |dV/dt| of the bellows volume (rate -1..1).',
})

const needle = noiseBed({
  id: 'studio.needle',
  label: 'Held needle',
  group: G,
  games: S,
  desc: 'A tiny creak while the light-meter needle is held: noise through a 3 kHz band-pass, AM at 40 Hz.',
  params: { level: { min: 0, max: 1, default: 1, step: 0.01 } },
  map: (p) => ({ f: 3000, q: 3, gain: 0.03 * clamp01(p.level) }),
  am: () => ({ hz: 40, depth: 0.8 }),
  tau: 0.05,
})

const swingCreak: SoundDef = shot({
  id: 'studio.swing-creak',
  label: 'Swing creak',
  group: G,
  games: S,
  desc: 'Stick-slip granular clicks (10-40 Hz, rate follows |omega|) at the turnarounds, pitched by rope tension.',
  params: {
    tension: { min: 0, max: 1, default: 0.5, step: 0.01 },
    omega: { min: 0, max: 4, default: 1.5, step: 0.01, unit: 'rad/s' },
  },
  vary: { pitch: 0.04, gain: 1.5 },
  maxVoices: 3,
  minInterval: 0.1,
  play(s, out, t, p) {
    const w = clamp01(p.omega / 3)
    return creak(s, out, t, clamp01(p.tension), 0.15 + 0.5 * w, 0.8, 0.12 + 0.2 * w, p.k)
  },
})

/** Wing flutter: noise AM at 18 Hz for 300 ms. */
function flutterWings(s: Synth, out: AudioNode, t: number, gain: number): number {
  const g = s.gate(null, out, t, 0.3, (w, res) => {
    const n = w.length
    for (let i = 0; i < n; i++) {
      const x = i / n
      w[i] = Math.sin(Math.PI * x) * (0.5 + 0.5 * Math.sin(i * res * 2 * Math.PI * 18)) * gain
    }
  })
  s.noise('white', t, t + 0.32, s.filter('bandpass', 2200, 0.6, g))
  return t + 0.3
}

const sparrows: SoundDef = shot({
  id: 'studio.sparrows',
  label: 'Sparrows',
  group: G,
  games: S,
  desc: 'FM chirps (carrier 4-6 kHz, mod ratio 1.5, 60 ms) from n sparrows, with a wing flutter.',
  params: { n: { min: 1, max: 6, default: 3, step: 1 } },
  vary: { pitch: 0, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    let end = t
    const n = Math.round(p.n)
    for (let i = 0; i < n; i++) {
      const at = t + i * s.r(0.06, 0.14)
      const f = s.r(4000, 6000)
      const g = s.gain(0, out)
      const e = s.ahr(g.gain, at, 0.06, 0.004, 0.02, 0.04)
      const car = s.osc('sine', f, at, e + 0.01, g)
      car.frequency.setValueAtTime(f, at)
      car.frequency.linearRampToValueAtTime(f * s.r(0.85, 1.2), at + 0.06)
      const mg = s.gain(f * 0.6)
      mg.connect(car.frequency)
      s.osc('sine', f * 1.5, at, e + 0.01, mg)
      end = Math.max(end, e)
    }
    return Math.max(end, flutterWings(s, out, t + n * 0.07, 0.05))
  },
})

const flutter: SoundDef = shot({
  id: 'studio.flutter',
  label: 'Wing flutter',
  group: G,
  games: S,
  desc: 'A bird taking off: noise AM at 18 Hz for 300 ms.',
  vary: { pitch: 0, gain: 1 },
  maxVoices: 3,
  play(s, out, t) {
    return flutterWings(s, out, t, 0.09)
  },
})

const bark: SoundDef = shot({
  id: 'studio.bark',
  label: 'Dot barks',
  group: G,
  games: S,
  desc: 'A formant burst: a 380 Hz sawtooth through band-passes at 700 and 1200 Hz, 90 ms.',
  vary: { pitch: 0.08, gain: 1.5 },
  maxVoices: 2,
  play(s, out, t, p) {
    const g = s.gain(0, out)
    const end = s.ahr(g.gain, t, 0.28, 0.006, 0.03, 0.05)
    const f1 = s.filter('bandpass', 700, 5, g)
    const f2 = s.filter('bandpass', 1200, 6, g)
    const o = s.osc('sawtooth', 380 * p.k, t, end + 0.01, null)
    o.frequency.setValueAtTime(420 * p.k, t)
    o.frequency.exponentialRampToValueAtTime(320 * p.k, t + 0.09)
    o.connect(f1)
    o.connect(f2)
    s.burst({ t, out, f: 1500, q: 1, gain: 0.05, attack: 0.001, decay: 0.03 })
    return end
  },
})

const pant = noiseBed({
  id: 'studio.pant',
  label: 'Dot pants',
  group: G,
  games: S,
  desc: 'Noise through a 1.4 kHz band-pass, amplitude-modulated at 4 Hz.',
  params: { level: { min: 0, max: 1, default: 0.6, step: 0.01 } },
  map: (p) => ({ f: 1400, q: 0.7, gain: 0.07 * clamp01(p.level) }),
  am: () => ({ hz: 4, depth: 0.9 }),
  tau: 0.2,
})

// ---- impacts ------------------------------------------------------------------------------
const MATERIAL_NAMES = ['grass', 'wood', 'metal', 'glass', 'rubber', 'cloth']
const impact: SoundDef = shot({
  id: 'studio.impact',
  label: 'Impact',
  group: G,
  games: S,
  desc: 'Material table: grass (dull, low-passed 300 Hz), wood (band-pass 800 Hz), metal bucket (partials 523, 1307, 2210 Hz, 0.6 s), glass (3 kHz ping), rubber, cloth.',
  params: {
    material: { min: 0, max: 5, default: 1, step: 1, options: MATERIAL_NAMES },
    impulse: { min: 0, max: 8, default: 1, step: 0.01, unit: 'N·s' },
    mass: { min: 0.02, max: 20, default: 0.5, step: 0.01, unit: 'kg', log: true },
  },
  vary: { pitch: 0.05, gain: 1.5 },
  maxVoices: 6,
  minInterval: 0.015,
  play(s, out, t, p) {
    const a = Math.min(1, Math.pow(Math.max(0, p.impulse) / 3, 0.65)) * 0.5 + 0.05
    const heavy = Math.pow(0.5 / Math.max(0.02, p.mass), 0.18) * p.k // lighter objects ring higher
    switch (Math.round(p.material)) {
      case 0: // grass
        s.burst({ t, out, type: 'lowpass', f: 300, q: 0.7, gain: 0.5 * a, attack: 0.002, decay: 0.07 })
        return s.tone({ t, out, f: 90 * heavy, gain: 0.25 * a, attack: 0.002, decay: 0.06 })
      case 1: // wood
        s.burst({ t, out, f: 800 * heavy, q: 1.6, gain: 0.5 * a, attack: 0.0008, decay: 0.05 })
        return s.tone({ t, out, f: 330 * heavy, gain: 0.2 * a, attack: 0.001, decay: 0.08 })
      case 2: // metal bucket
        s.burst({ t, out, f: 3000, q: 1.5, gain: 0.1 * a, attack: 0.0004, decay: 0.01 })
        return s.modal({ t, out, f: 523 * heavy, ratios: [1, 1307 / 523, 2210 / 523], gains: [0.5 * a, 0.28 * a, 0.15 * a], decays: [0.6, 0.4, 0.25] })
      case 3: // glass
        s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.09 * a, attack: 0.0003, decay: 0.003 })
        return s.modal({ t, out, f: 3000 * heavy, ratios: [1, 2.32], gains: [0.3 * a, 0.1 * a], decays: [0.5, 0.2] })
      case 4: // rubber
        s.burst({ t, out, type: 'lowpass', f: 700, gain: 0.3 * a, attack: 0.002, decay: 0.03 })
        return s.tone({ t, out, f: 160 * heavy, f2: 110 * heavy, gain: 0.35 * a, attack: 0.002, decay: 0.07 })
      default: // cloth
        return s.burst({ t, out, type: 'lowpass', f: 1200, q: 0.5, gain: 0.25 * a, attack: 0.006, decay: 0.08 })
    }
  },
})

const screenDoor: SoundDef = shot({
  id: 'studio.screen-door',
  label: 'Screen door',
  group: G,
  games: S,
  desc: 'A spring boing (two detuned resonators at 190 and 196 Hz with a pitch drop), then a wooden slam.',
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 1,
  play(s, out, t) {
    for (const f of [190, 196]) s.tone({ t, out, f: f * 1.25, f2: f, glide: 0.35, gain: 0.1, attack: 0.002, decay: 0.45 })
    s.burst({ t, out, f: 2600, q: 4, gain: 0.08, attack: 0.001, decay: 0.2 })
    const slam = t + 0.5
    s.burst({ t: slam, out, f: 700, q: 1.2, gain: 0.4, attack: 0.001, decay: 0.05 })
    return s.tone({ t: slam, out, f: 100, f2: 60, gain: 0.45, attack: 0.002, decay: 0.15 })
  },
})

const stairs: SoundDef = shot({
  id: 'studio.stairs',
  label: 'Stairs down',
  group: G,
  games: S,
  desc: 'Thirteen footstep thuds, with the amber-room tone fading in underneath.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 1,
  play(s, out, t) {
    let at = t
    for (let i = 0; i < 13; i++) {
      s.tone({ t: at, out, f: 85 + (i % 2) * 10, f2: 55, gain: 0.28, attack: 0.002, decay: 0.07 })
      s.burst({ t: at, out, type: 'lowpass', f: 600, gain: 0.12, attack: 0.001, decay: 0.03 })
      at += 0.31 + s.r(-0.02, 0.02)
    }
    const g = s.gain(0, out)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.03, at)
    g.gain.linearRampToValueAtTime(0, at + 1.2)
    s.osc('sine', 120, t, at + 1.3, g)
    s.noise('brown', t, at + 1.3, s.filter('lowpass', 260, 0.7, g))
    return at + 1.2
  },
})

const glug: SoundDef = shot({
  id: 'studio.glug',
  label: 'Tank glug',
  group: G,
  games: S,
  desc: 'A glug: noise through a band-pass centred 200 + 300 |phi\'| Hz; rate is the inversion speed.',
  params: { rate: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  vary: { pitch: 0.08, gain: 1.5 },
  maxVoices: 4,
  play(s, out, t, p) {
    const f = 200 + 300 * clamp01(p.rate)
    s.burst({ t, out, f: f * p.k, q: 2, gain: 0.18, attack: 0.004, decay: 0.07 })
    return s.tone({ t, out, f: f * 0.7 * p.k, f2: f * 1.3 * p.k, glide: 0.05, gain: 0.12, attack: 0.003, decay: 0.07 })
  },
})

const lid: SoundDef = shot({
  id: 'studio.lid',
  label: 'Tank lid twist',
  group: G,
  games: S,
  desc: 'The light-tight lid twisting on: a short plastic scrape and a seat.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, f: 1800 * p.k, f2: 900, q: 2, gain: 0.1, attack: 0.01, hold: 0.12, decay: 0.08 })
    return s.tone({ t: t + 0.24, out, f: 140 * p.k, gain: 0.25, attack: 0.002, decay: 0.07 })
  },
})

const fixerPour: SoundDef = shot({
  id: 'studio.fixer-pour',
  label: 'Fixer pour',
  group: G,
  games: S,
  desc: 'Pouring fixer: filtered noise, pitch rising as the vessel fills.',
  vary: { pitch: 0, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t) {
    return s.burst({ t, out, f: 450, f2: 1500, q: 1.2, gain: 0.13, attack: 0.06, hold: 1.0, decay: 0.2 })
  },
})

const traySlosh = noiseBed({
  id: 'studio.tray-slosh',
  label: 'Tray slosh',
  group: G,
  games: S,
  desc: 'Noise through a low-pass at 500-1500 Hz following the tray amplitude A (energy 0..1).',
  params: { energy: { min: 0, max: 1, default: 0.3, step: 0.01 }, pan: { min: -1, max: 1, default: 0, step: 0.01 } },
  type: 'lowpass',
  color: 'brown',
  map: (p) => {
    const e = clamp01(p.energy)
    return { f: 500 + 1000 * e, q: 0.7, gain: 0.45 * Math.sqrt(e), pan: p.pan }
  },
  tau: 0.06,
})

const enlargerHum = loopDef({
  id: 'studio.enlarger-hum',
  label: 'Enlarger lamp hum',
  group: G,
  games: S,
  desc: 'A 120 Hz hum while the lamp is on.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.osc('sine', 120, t, null, s.gain(0.03, m))
    s.osc('sine', 240, t, null, s.gain(0.008, m))
    s.noise('brown', t, null, s.filter('lowpass', 400, 0.7, s.gain(0.012, m)))
    to(m.gain, p.level, t, 0.1)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.1)
      },
    }
  },
})

const mailTruck: SoundDef = shot({
  id: 'studio.mail-truck',
  label: 'Mail truck',
  group: G,
  games: S,
  desc: 'A distant engine (55 Hz sawtooth through a low-pass, Doppler drift), a door, then the box thunk.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 1,
  play(s, out, t) {
    const dur = 5
    const g = s.gain(0, out)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + 2.2)
    g.gain.linearRampToValueAtTime(0.03, t + dur)
    g.gain.linearRampToValueAtTime(0, t + dur + 0.4)
    const lp = s.filter('lowpass', 420, 0.7, g)
    const o = s.osc('sawtooth', 62, t, t + dur + 0.5, lp)
    o.frequency.setValueAtTime(62, t)
    o.frequency.linearRampToValueAtTime(66, t + 2.2)
    o.frequency.linearRampToValueAtTime(52, t + dur)
    s.osc('sawtooth', 124.5, t, t + dur + 0.5, s.gain(0.3, lp))
    // the door
    s.burst({ t: t + dur + 0.1, out, f: 900, q: 1.2, gain: 0.2, attack: 0.001, decay: 0.05 })
    s.tone({ t: t + dur + 0.1, out, f: 100, f2: 70, gain: 0.25, attack: 0.002, decay: 0.12 })
    // the box thunk
    const at = t + dur + 1.1
    s.burst({ t: at, out, f: 500, q: 1, gain: 0.35, attack: 0.001, decay: 0.06 })
    return s.tone({ t: at, out, f: 80, f2: 50, gain: 0.4, attack: 0.002, decay: 0.2 })
  },
})

export const SOUNDS: SoundDef[] = [
  cicadas, crickets, wind, chime, tsk, sprinklerReturn, spray, leaf, drop, focal, cap, selftimer, windOn, thock, bellows,
  needle, swingCreak, sparrows, flutter, bark, pant, impact, screenDoor, stairs, glug, lid, fixerPour, traySlosh,
  enlargerHum, mailTruck,
]

let registered = false
/** Register every studio.* sound with the shared engine. Idempotent. */
export function registerSounds(): void {
  if (registered) return
  registered = true
  Audio.register(SOUNDS)
}

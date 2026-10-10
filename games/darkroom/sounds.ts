// Darkroom world sounds (docs/design/darkroom.md §7.3, architecture.md Appendix B).
// Owned by shared-audio. Call registerSounds() once at boot; then Audio.play('darkroom.drip', { intoLiquid: 1 })
// or Audio.loop('darkroom.slosh').set('energy', e). The ui palette lives in @shared/audio (uiSound).
import {
  Audio,
  alias,
  bell,
  clamp01,
  loopDef,
  modulate,
  noiseBed,
  shot,
  to,
  type Params,
  type SoundDef,
  type Synth,
} from '@shared/audio'

const G = 'Darkroom (game)'
const D: SoundDef['games'] = ['darkroom']

/** brown noise -> lowpass at `f`, scaled by `gain`, into `out`. */
function brownLP(s: Synth, out: AudioNode, t: number, f: number, gain: number): void {
  const g = s.gain(gain, out)
  const lp = s.filter('lowpass', f, 0.7, g)
  s.noise('brown', t, null, lp)
}

const roomTone: SoundDef = loopDef({
  id: 'darkroom.room-tone',
  label: 'Room tone',
  group: G,
  games: D,
  desc: 'Brown noise through a 300 Hz low-pass, mains hum at 60/120 Hz and a slowly breathing extractor fan.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    brownLP(s, m, t, 300, 0.025)
    s.osc('sine', 60, t, null, s.gain(0.004, m))
    s.osc('sine', 120, t, null, s.gain(0.002, m))
    const fan = s.gain(0.01 * 0.875, m)
    const bp = s.filter('bandpass', 420, 0.7, fan)
    s.noise('white', t, null, bp)
    const lfo = s.osc('sine', 0.3, t, null, null)
    const lg = s.gain(0.01 * 0.125)
    lfo.connect(lg)
    lg.connect(fan.gain)
    to(m.gain, p.level, t, 0.15)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.1)
      },
    }
  },
})

const safelightOn: SoundDef = shot({
  id: 'darkroom.safelight-on',
  label: 'Safelight on',
  group: G,
  games: D,
  desc: 'A filament tink (noise 4 ms through a 5 kHz band-pass). The hum itself is darkroom.safelight-hum.',
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    const a = s.burst({ t, out, f: 5000 * p.k, q: 3, gain: 0.25, attack: 0.0005, decay: 0.004 })
    const b = s.tone({ t: t + 0.002, out, f: 1900 * p.k, gain: 0.03, attack: 0.0005, decay: 0.05 })
    return Math.max(a, b)
  },
})

const safelightHum: SoundDef = loopDef({
  id: 'darkroom.safelight-hum',
  label: 'Safelight hum',
  group: G,
  games: D,
  desc: 'Sines at 120 and 240 Hz (0.006 / 0.002), fading in over 1.5 s.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.osc('sine', 120, t, null, s.gain(0.006, m))
    s.osc('sine', 240, t, null, s.gain(0.002, m))
    m.gain.setValueAtTime(0, t)
    m.gain.linearRampToValueAtTime(p.level, t + 1.5)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.2)
      },
    }
  },
})

const pullChain: SoundDef = shot({
  id: 'darkroom.pull-chain',
  label: 'Pull-chain',
  group: G,
  games: D,
  desc: 'Bead clicks running along the chain, then a clack.',
  params: { beads: { min: 6, max: 9, default: 7, step: 1 } },
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    const n = Math.round(p.beads)
    let tt = t
    for (let i = 0; i < n; i++) {
      s.burst({ t: tt, out, f: s.r(3200, 4500) * p.k, q: 4, gain: 0.14 * Math.pow(0.9, i), attack: 0.0004, decay: 0.003 })
      tt += s.r(0.012, 0.025)
    }
    s.burst({ t: tt + 0.01, out, f: 1800, q: 1.2, gain: 0.3, attack: 0.0005, decay: 0.006 })
    return s.tone({ t: tt + 0.01, out, f: 160, gain: 0.2, attack: 0.001, decay: 0.03 })
  },
})

const guard: SoundDef = shot({
  id: 'darkroom.guard',
  label: 'Switch guard',
  group: G,
  games: D,
  desc: 'The spring guard over the enlarger switch: a 95 Hz clack and a vibrating 180 Hz boing.',
  vary: { pitch: 0.02, gain: 1 },
  play(s, out, t, p) {
    s.tone({ t, out, f: 95 * p.k, gain: 0.25, attack: 0.001, decay: 0.06 })
    const g = s.gain(0, out)
    const end = s.ahr(g.gain, t + 0.02, 0.12, 0.004, 0.02, 0.22)
    const o = s.osc('sine', 180 * p.k, t + 0.02, end + 0.01, g)
    modulate(s, o.frequency, 22, 9, t + 0.02, end + 0.01)
    return end
  },
})

const sw: SoundDef = shot({
  id: 'darkroom.switch',
  label: 'Toggle switch',
  group: G,
  games: D,
  desc: 'A bakelite toggle: noise 8 ms through a 2 kHz high-pass plus a 2.2 kHz ping.',
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 2000, gain: 0.2, attack: 0.0004, decay: 0.008 })
    const g = s.gain(0.1, out)
    g.gain.setValueAtTime(0.1, t)
    const f = s.filter('bandpass', 2200 * p.k, 30, g)
    s.noise('white', t, t + 0.05, f)
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045)
    return t + 0.05
  },
})

const flStart: SoundDef = shot({
  id: 'darkroom.fluorescent-start',
  label: 'Fluorescent start',
  group: G,
  games: D,
  desc: 'Two tinks 80 ms apart as the tube catches.',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    let end = t
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.08
      s.burst({ t: tt, out, f: 3400 * p.k, q: 4, gain: 0.22 - i * 0.06, attack: 0.0004, decay: 0.01 })
      end = Math.max(end, s.tone({ t: tt, out, f: 2600 * p.k, gain: 0.03, attack: 0.0005, decay: 0.06 }))
    }
    return end
  },
})

const flHum: SoundDef = loopDef({
  id: 'darkroom.fluorescent-hum',
  label: 'Fluorescent hum',
  group: G,
  games: D,
  desc: 'A sawtooth at 120 Hz through a 240 Hz band-pass (Q 2), ramping to 0.008 over 0.4 s.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    const bp = s.filter('bandpass', 240, 2, m)
    s.osc('sawtooth', 120, t, null, bp)
    m.gain.setValueAtTime(0, t)
    m.gain.linearRampToValueAtTime(0.008 * p.level, t + 0.4)
    return {
      set(_n, _v, at) {
        to(m.gain, 0.008 * p.level, at, 0.1)
      },
    }
  },
})

const slosh = alias(
  // base params: energy, depth, size, laps, pan
  Audio.def('liquid.slosh')!,
  {
    id: 'darkroom.slosh',
    games: D,
    group: G,
    label: 'Tray slosh',
    desc: 'Continuous. energy = min(1, KE / 0.006 J). Set laps to 0 and fire darkroom.lap on real wall hits.',
  },
)

const lapShot = alias(Audio.def('liquid.lap')!, {
  id: 'darkroom.lap',
  games: D,
  group: G,
  label: 'Lap (wall hit)',
  desc: 'One wave on the tray wall. intensity 0..1.',
})

const trayLand: SoundDef = shot({
  id: 'darkroom.tray-land',
  label: 'Tray lands',
  group: G,
  games: D,
  desc: 'Sines at 140 and 310 Hz for 90 ms, gain from the landing speed (m/s).',
  params: { speed: { min: 0, max: 1.5, default: 0.5, step: 0.01, unit: 'm/s' } },
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    const a = Math.min(0.25, 0.25 * clamp01(p.speed / 1.0) + 0.02)
    const x = s.tone({ t, out, f: 140 * p.k, f2: 118 * p.k, gain: a, attack: 0.001, decay: 0.09 })
    const y = s.tone({ t, out, f: 310 * p.k, gain: a * 0.55, attack: 0.001, decay: 0.06 })
    s.burst({ t, out, type: 'lowpass', f: 900, gain: a * 0.5, attack: 0.001, decay: 0.03 })
    return Math.max(x, y)
  },
})

const drip: SoundDef = shot({
  id: 'darkroom.drip',
  label: 'Drip',
  group: G,
  games: D,
  caption: '[drip]',
  desc: 'A sine falling 1400 to 650 Hz over 35 ms with a 2 ms click; intoLiquid adds a 300 Hz plop.',
  params: { intoLiquid: { min: 0, max: 1, default: 1, step: 1, options: ['bench', 'liquid'] } },
  vary: { pitch: 0.1, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.05, attack: 0.0003, decay: 0.002 })
    let end = s.tone({ t, out, f: 1400 * p.k, f2: 650 * p.k, glide: 0.035, gain: 0.07, attack: 0.001, decay: 0.035 })
    if (p.intoLiquid >= 0.5) end = Math.max(end, s.tone({ t: t + 0.03, out, f: 300 * p.k, gain: 0.06, attack: 0.002, decay: 0.02 }))
    return end
  },
})

const paperGrab: SoundDef = shot({
  id: 'darkroom.paper-grab',
  label: 'Paper grab',
  group: G,
  games: D,
  desc: 'Five to eight crinkle granules (2.5-6 kHz) over 120 ms.',
  vary: { pitch: 0.05, gain: 1.5 },
  play(s, out, t) {
    const n = Math.round(s.r(5, 8))
    let end = t
    for (let i = 0; i < n; i++) {
      const tt = t + (i / n) * 0.12 + s.r(0, 0.01)
      end = Math.max(end, s.burst({ t: tt, out, f: s.r(2500, 6000), q: 1.4, gain: s.r(0.04, 0.11), attack: 0.0006, decay: s.r(0.006, 0.014) }))
    }
    return end
  },
})

const paperDunk: SoundDef = shot({
  id: 'darkroom.paper-dunk',
  label: 'Paper into liquid',
  group: G,
  games: D,
  desc: 'A low-passed 900 Hz thump with a 90 Hz sine, then a 250 ms high-passed hiss.',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'lowpass', f: 900 * p.k, gain: 0.22, attack: 0.002, decay: 0.07 })
    s.tone({ t, out, f: 90 * p.k, gain: 0.2, attack: 0.002, decay: 0.04 })
    return s.burst({ t: t + 0.04, out, type: 'highpass', f: 4000, gain: 0.06, attack: 0.02, decay: 0.22 })
  },
})

const timerTick: SoundDef = shot({
  id: 'darkroom.timer-tick',
  label: 'Timer tick',
  group: G,
  games: D,
  desc: 'One tick per second: noise 2 ms through a 3 kHz band-pass (Q 8) plus a 1.1 kHz sine.',
  vary: { pitch: 0.02, gain: 0.8 },
  maxVoices: 3,
  play(s, out, t, p) {
    s.burst({ t, out, f: 3000 * p.k, q: 8, gain: 0.35, attack: 0.0003, decay: 0.002 })
    return s.tone({ t, out, f: 1100 * p.k, gain: 0.06, attack: 0.0005, decay: 0.008 })
  },
})

const timerWind = alias(Audio.def('timer.wind')!, { id: 'darkroom.timer-wind', games: D, group: G, label: 'Timer wind' })

const timerBell: SoundDef = shot({
  id: 'darkroom.timer-bell',
  label: 'Timer bell',
  group: G,
  games: D,
  desc: 'The shared bell recipe with decays 1.8x longer.',
  vary: { pitch: 0.01, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    return bell(s, out, t, 1820 * p.k, 1.5 * 1.8, 1)
  },
})

const enlargerOn: SoundDef = shot({
  id: 'darkroom.enlarger-on',
  label: 'Enlarger lamp on',
  group: G,
  games: D,
  desc: 'A 70 Hz thunk as the lamp strikes.',
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'lowpass', f: 600, gain: 0.08, attack: 0.001, decay: 0.03 })
    return s.tone({ t, out, f: 70 * p.k, gain: 0.3, attack: 0.002, decay: 0.05 })
  },
})

const enlargerFan = noiseBed({
  id: 'darkroom.enlarger-fan',
  label: 'Enlarger fan',
  group: G,
  games: D,
  caption: '[fan hum]',
  desc: 'Noise through a 900 Hz band-pass at 0.012 while the lamp is on.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  type: 'bandpass',
  map: (p) => ({ f: 900, q: 1, gain: 0.012 * p.level }),
})

const pour = noiseBed({
  id: 'darkroom.pour',
  label: 'Pour',
  group: G,
  games: D,
  desc: 'Stream hiss (2.5 kHz band-pass, grows with flow) and glugs at 4 Hz that rise in pitch as the vessel fills.',
  params: {
    rate: { min: 0, max: 12, default: 6, step: 0.1, unit: 'ml/s' },
    fill: { min: 0, max: 1, default: 0.2, step: 0.01 },
  },
  map: (p) => ({ f: 2500, q: 0.7, gain: 0.07 * clamp01(p.rate / 10) }),
  extra(s, out, _t, p) {
    let next = -1
    return {
      tick(from, until) {
        if (p.rate < 0.2) {
          next = -1
          return
        }
        const hz = 4 * (0.6 + 0.4 * clamp01(p.rate / 10))
        if (next < from) next = from
        while (next < until) {
          const f0 = (450 + 500 * (1 - clamp01(p.fill))) * s.r(0.94, 1.06)
          const amp = 0.09 * clamp01(0.3 + p.rate / 10)
          s.tone({ t: next, out, f: f0, f2: f0 * 1.8, glide: 0.04, gain: amp, attack: 0.002, decay: 0.045 })
          s.burst({ t: next, out, f: 1200, q: 1.2, gain: amp * 0.6, attack: 0.002, decay: 0.035 })
          next += (1 / hz) * s.r(0.8, 1.2)
        }
      },
    }
  },
})

const brush = noiseBed({
  id: 'darkroom.brush',
  label: 'Brush on paper',
  group: G,
  games: D,
  desc: 'Noise through a 3.5 kHz band-pass; gain follows speed x load (up to 0.05).',
  params: {
    speed: { min: 0, max: 1, default: 0.3, step: 0.01, unit: 'm/s' },
    load: { min: 0, max: 1, default: 0.6, step: 0.01 },
  },
  map: (p) => ({ f: 3500, q: 1, gain: 0.05 * clamp01(p.speed / 0.5) * clamp01(0.25 + p.load) }),
  tau: 0.04,
})

const hairdryer: SoundDef = loopDef({
  id: 'darkroom.hairdryer',
  label: 'Hairdryer',
  group: G,
  games: D,
  desc: 'Low-passed noise (2.5 kHz, 0.08) over a 210 Hz sawtooth through an 800 Hz low-pass; 0.25 s spin-up.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    const n = s.gain(0.08, m)
    s.noise('white', t, null, s.filter('lowpass', 2500, 0.7, n))
    const sg = s.gain(0.01, m)
    const saw = s.osc('sawtooth', 120, t, null, s.filter('lowpass', 800, 0.7, sg))
    saw.frequency.setValueAtTime(120, t)
    saw.frequency.linearRampToValueAtTime(210, t + 0.25)
    m.gain.setValueAtTime(0, t)
    m.gain.linearRampToValueAtTime(p.level, t + 0.25)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.1)
      },
    }
  },
})

const uvHum: SoundDef = loopDef({
  id: 'darkroom.uv-hum',
  label: 'UV box',
  group: G,
  games: D,
  desc: 'A 100 Hz sine (0.004), a 15 kHz whine (0.0015) and a small fan.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.osc('sine', 100, t, null, s.gain(0.004, m))
    if (s.quality) s.osc('sine', 15000, t, null, s.gain(0.0015, m))
    s.noise('white', t, null, s.filter('bandpass', 700, 0.8, s.gain(0.006, m)))
    to(m.gain, p.level, t, 0.1)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.1)
      },
    }
  },
})

const tap = noiseBed({
  id: 'darkroom.tap',
  label: 'Running tap',
  group: G,
  games: D,
  caption: '[tap running]',
  desc: 'Noise through a 2 kHz band-pass (Q 0.5, 0.06) with random 3-6 Hz gurgles around 300-600 Hz.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  map: (p) => ({ f: 2000, q: 0.5, gain: 0.06 * p.level }),
  extra(s, out, _t, p) {
    let next = -1
    return {
      tick(from, until) {
        if (p.level <= 0.01) return
        if (next < from) next = from
        while (next < until) {
          s.tone({ t: next, out, f: s.r(300, 600), f2: s.r(380, 700), glide: 0.05, gain: 0.03 * p.level, attack: 0.004, decay: 0.07 })
          next += 1 / s.r(3, 6)
        }
      },
    }
  },
})

const bloom: SoundDef = shot({
  id: 'darkroom.bloom',
  label: 'Peroxide bloom',
  group: G,
  games: D,
  desc: 'The one magic sound: sines at 880, 1320 and 1975 Hz shimmering +/-4 cents, 0.4 s attack, 2.5 s decay, over a 1.5 s fizz.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t) {
    let end = t
    for (const [f, d] of [[880, 0], [1320, 1.3], [1975, 2.1]] as const) {
      const g = s.gain(0, out)
      end = Math.max(end, s.ahr(g.gain, t, 0.02, 0.4, 0, 2.5))
      const o = s.osc('sine', f, t, end + 0.01, g)
      modulate(s, o.frequency, 3 + d * 0.4, f * (Math.pow(2, 4 / 1200) - 1), t, end + 0.01)
    }
    s.burst({ t, out, type: 'highpass', f: 6000, gain: 0.03, attack: 0.3, hold: 0.5, decay: 0.7 })
    return end
  },
})

const pencil: SoundDef = shot({
  id: 'darkroom.pencil',
  label: 'Pencil scratch',
  group: G,
  games: D,
  caption: '[pencil scratch]',
  desc: 'Noise through a 4.5 kHz band-pass, amplitude-modulated at a random 30-60 Hz for 0.5 s.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    const dur = 0.5
    const am = s.gate(null, out, t, dur, (w, res) => {
      const n = w.length
      let ph = 0
      const rate = s.r(30, 60)
      for (let i = 0; i < n; i++) {
        const x = i / n
        ph += (rate * (1 + 0.5 * Math.sin(i * res * 11))) * res
        const env = Math.sin(Math.PI * x) * 0.8
        w[i] = env * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2)) * 0.07
      }
    })
    s.noise('white', t, t + dur + 0.02, s.filter('bandpass', 4500 * p.k, 1.2, am))
    return t + dur
  },
})

// ---- the radio (SHOULD) -------------------------------------------------------------------
const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
const II_V_I = [
  { bass: [38, 41, 45, 43], comp: [53, 57, 60, 64] }, // Dm7
  { bass: [43, 47, 50, 48], comp: [53, 59, 62, 65] }, // G7
  { bass: [36, 40, 43, 47], comp: [52, 55, 59, 64] }, // Cmaj7
  { bass: [36, 43, 40, 38], comp: [52, 55, 59, 62] }, // Cmaj7 turnaround
]

const radio: SoundDef = loopDef({
  id: 'darkroom.radio',
  label: 'Radio',
  group: G,
  games: D,
  desc: 'station 0: static between stations. 1: late-night jazz (walking bass, brushes, FM piano, ii-V-I) through a tiny speaker. 2: a drone.',
  params: { station: { min: 0, max: 2, default: 1, step: 1, options: ['static', 'jazz', 'drone'] } },
  start(s, out, t, p) {
    const m = s.gain(0.9, out)
    // the tiny speaker: 300-3000 Hz
    const spk = s.filter('highpass', 300, 0.7, s.filter('lowpass', 3000, 0.7, m))
    const stat = s.gain(0, spk)
    s.noise('pink', t, null, s.filter('bandpass', 1500, 0.4, stat))
    const jazz = s.gain(0, spk)
    const drone = s.gain(0, spk)
    s.osc('sine', 110, t, null, s.gain(0.5, drone))
    s.osc('sine', 110.6, t, null, s.gain(0.4, drone))
    s.osc('triangle', 164.8, t, null, s.gain(0.2, drone))
    const hiss = s.gain(0.01, spk)
    s.noise('white', t, null, s.filter('bandpass', 2500, 0.6, hiss))
    const apply = (at: number): void => {
      const st = Math.round(p.station)
      to(stat.gain, st === 0 ? 0.14 : 0.0, at, 0.15)
      to(jazz.gain, st === 1 ? 1 : 0, at, 0.2)
      to(drone.gain, st === 2 ? 0.05 : 0, at, 0.4)
    }
    apply(t)
    const beat = 60 / 96
    let nextBeat = -1
    let n = 0
    return {
      set(_n, _v, at) {
        apply(at)
      },
      tick(from, until) {
        if (Math.round(p.station) !== 1) {
          nextBeat = -1
          return
        }
        if (nextBeat < from) nextBeat = from + 0.02
        while (nextBeat < until) {
          const bar = II_V_I[Math.floor(n / 4) % 4]!
          const b = n % 4
          const tt = nextBeat + s.r(-0.008, 0.008)
          // walking bass: a plucked sine with a little second harmonic
          const f = midiHz(bar.bass[b]!)
          s.tone({ t: tt, out: jazz, f, gain: 0.24, attack: 0.006, decay: 0.34 })
          s.tone({ t: tt, out: jazz, f: f * 2, gain: 0.05, attack: 0.004, decay: 0.12 })
          // brushes: a swish on 2 and 4
          if (b % 2 === 1) s.burst({ t: tt + 0.01, out: jazz, f: 6000, q: 0.5, gain: 0.07, attack: 0.03, decay: 0.12 })
          else s.burst({ t: tt, out: jazz, type: 'highpass', f: 5000, gain: 0.03, attack: 0.01, decay: 0.06 })
          // FM piano comp on the one and the "and" of two
          if (b === 0 || b === 1) {
            const at = b === 0 ? tt : tt + beat * 0.66
            for (const note of bar.comp.slice(0, 3)) {
              const fc = midiHz(note)
              const g = s.gain(0, jazz)
              const end = s.ahr(g.gain, at, 0.05, 0.004, 0, 0.7)
              const car = s.osc('sine', fc, at, end + 0.01, g)
              const modG = s.gain(fc * 1.4)
              modG.connect(car.frequency)
              modG.gain.setValueAtTime(fc * 1.4, at)
              modG.gain.exponentialRampToValueAtTime(fc * 0.05, at + 0.5)
              s.osc('sine', fc, at, end + 0.01, modG)
            }
          }
          nextBeat += beat
          n++
        }
      },
    }
  },
})

export const SOUNDS: SoundDef[] = [
  roomTone, safelightOn, safelightHum, pullChain, guard, sw, flStart, flHum, slosh, lapShot, trayLand, drip,
  paperGrab, paperDunk, timerTick, timerWind, timerBell, enlargerOn, enlargerFan, pour, brush, hairdryer, uvHum, tap,
  bloom, pencil, radio,
]

let registered = false
/** Register every darkroom.* sound with the shared engine. Idempotent. */
export function registerSounds(): void {
  if (registered) return
  registered = true
  Audio.register(SOUNDS)
}

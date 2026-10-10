// Latent Image world sounds (docs/design/latent.md §7.3, architecture.md Appendix B).
// Owned by shared-audio. Call registerSounds() once at boot, then Audio.play('latent.key').
// Mix target: everything quiet, transients -12 dBFS, room tone -36 dBFS. No music.
import {
  Audio,
  alias,
  clamp01,
  loopDef,
  noiseBed,
  shot,
  to,
  type SoundDef,
  type Synth,
} from '@shared/audio'

const G = 'Latent Image'
const L: SoundDef['games'] = ['latent']

const key: SoundDef = shot({
  id: 'latent.key',
  label: 'Key click',
  group: G,
  games: L,
  desc: 'A 4 ms noise burst through a 3.2 kHz band-pass (Q 2) and a 140 Hz sine thunk, 30 ms decay; +/-8% pitch.',
  vary: { pitch: 0.08, gain: 1.5 },
  maxVoices: 6,
  play(s, out, t, p) {
    s.burst({ t, out, f: 3200 * p.k, q: 2, gain: 0.22, attack: 0.0003, decay: 0.004 })
    return s.tone({ t, out, f: 140 * p.k, gain: 0.14, attack: 0.0006, decay: 0.03 })
  },
})

const seek: SoundDef = shot({
  id: 'latent.seek',
  label: 'Disk seek',
  group: G,
  games: L,
  desc: 'Three to seven impulses through a 1.8 kHz resonator, 8-20 ms apart.',
  params: { n: { min: 3, max: 7, default: 5, step: 1 } },
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    let tt = t
    let end = t
    for (let i = 0; i < Math.round(p.n); i++) {
      end = Math.max(end, s.burst({ t: tt, out, f: 1800 * p.k, q: 12, gain: 0.2, attack: 0.0003, decay: 0.012 }))
      tt += s.r(0.008, 0.02)
    }
    return end
  },
})

const tape: SoundDef = shot({
  id: 'latent.tape',
  label: 'Tape advance',
  group: G,
  games: L,
  desc: 'A 1.2 kHz buzz, 40 ms per printed line, then a short falling sweep.',
  params: { lines: { min: 1, max: 12, default: 2, step: 1 } },
  vary: { pitch: 0.03, gain: 1 },
  play(s, out, t, p) {
    const dur = 0.04 * Math.round(p.lines)
    const g = s.gain(0, out)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + 0.004)
    g.gain.setValueAtTime(0.07, t + dur)
    g.gain.linearRampToValueAtTime(0, t + dur + 0.004)
    s.osc('sawtooth', 1200 * p.k, t, t + dur + 0.01, s.filter('bandpass', 1500, 2, g))
    return s.tone({ t: t + dur, out, f: 1400, f2: 420, gain: 0.05, attack: 0.002, decay: 0.08 })
  },
})

const chainClink: SoundDef = shot({
  id: 'latent.chain-clink',
  label: 'Chain clink',
  group: G,
  games: L,
  desc: 'Three inharmonic partials (2.1, 3.4, 5.6 kHz), 80 ms.',
  vary: { pitch: 0.05, gain: 1.5 },
  maxVoices: 4,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.05, attack: 0.0003, decay: 0.002 })
    return s.modal({ t, out, f: 2100 * p.k, ratios: [1, 3.4 / 2.1, 5.6 / 2.1], gains: [0.18, 0.1, 0.06], decays: [0.08, 0.06, 0.04] })
  },
})

const clunk: SoundDef = shot({
  id: 'latent.clunk',
  label: 'Clunk',
  group: G,
  games: L,
  desc: 'A 90 Hz sine and a noise thump, 120 ms.',
  vary: { pitch: 0.06, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'lowpass', f: 700, gain: 0.2, attack: 0.001, decay: 0.05 })
    return s.tone({ t, out, f: 90 * p.k, f2: 70 * p.k, gain: 0.35, attack: 0.002, decay: 0.12 })
  },
})

const bagZip = noiseBed({
  id: 'latent.bag-zip',
  label: 'Changing bag zip',
  group: G,
  games: L,
  desc: 'Noise through a band-pass whose centre tracks the stroke speed (600 Hz to 2 kHz).',
  params: { speed: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  map: (p) => ({ f: 600 + 1400 * clamp01(p.speed), q: 3, gain: 0.12 * clamp01(p.speed * 1.4) }),
  am: (p) => ({ hz: 18 + 40 * clamp01(p.speed), depth: 0.7 }),
  tau: 0.04,
})

const bagTick: SoundDef = shot({
  id: 'latent.bag-tick',
  label: 'Bag tick',
  group: G,
  games: L,
  desc: 'A 1 ms click: one tooth of the zip.',
  vary: { pitch: 0.1, gain: 1.5 },
  maxVoices: 6,
  play(s, out, t, p) {
    return s.burst({ t, out, f: 2400 * p.k, q: 1.5, gain: 0.12, attack: 0.0002, decay: 0.002 })
  },
})

const kink: SoundDef = shot({
  id: 'latent.kink',
  label: 'Film kink',
  group: G,
  games: L,
  desc: 'Three crackles (8 ms noise bursts) as the film creases.',
  vary: { pitch: 0.06, gain: 1.5 },
  play(s, out, t) {
    let end = t
    for (let i = 0; i < 3; i++) end = Math.max(end, s.burst({ t: t + i * s.r(0.02, 0.06), out, f: s.r(2000, 5000), q: 1.2, gain: 0.14, attack: 0.0006, decay: 0.008 }))
    return end
  },
})

const glug: SoundDef = shot({
  id: 'latent.glug',
  label: 'Tank glug',
  group: G,
  games: L,
  desc: 'Three to six sine pops between 120 and 260 Hz.',
  vary: { pitch: 0.06, gain: 1.5 },
  play(s, out, t) {
    const n = Math.round(s.r(3, 6))
    let tt = t
    let end = t
    for (let i = 0; i < n; i++) {
      const f = s.r(120, 260)
      end = Math.max(end, s.tone({ t: tt, out, f, f2: f * 1.6, glide: 0.03, gain: 0.2, attack: 0.002, decay: 0.05 }))
      tt += s.r(0.06, 0.14)
    }
    return end
  },
})

const rap: SoundDef = shot({
  id: 'latent.rap',
  label: 'Tank rap',
  group: G,
  games: L,
  desc: 'Knuckles on the tank: a 300 Hz thud and a 2.8 kHz ring (tau 0.3 s) to dislodge bubbles.',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    s.tone({ t, out, f: 300 * p.k, f2: 220 * p.k, gain: 0.3, attack: 0.001, decay: 0.05 })
    return s.tone({ t, out, f: 2800 * p.k, gain: 0.07, attack: 0.0008, decay: 0.3 })
  },
})

const lid: SoundDef = shot({
  id: 'latent.lid',
  label: 'Tank lid',
  group: G,
  games: L,
  desc: 'A filtered clunk: the light-tight lid seating.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'lowpass', f: 1200, gain: 0.16, attack: 0.001, decay: 0.04 })
    return s.tone({ t, out, f: 130 * p.k, f2: 90 * p.k, gain: 0.28, attack: 0.002, decay: 0.09 })
  },
})

const timerTick = alias(Audio.def('timer.tick')!, { id: 'latent.timer-tick', games: L, group: G, label: 'Timer tick', desc: 'Escapement at 1 Hz (alternate tick and tock).' })

const timerBell: SoundDef = shot({
  id: 'latent.timer-bell',
  label: 'Timer bell',
  group: G,
  games: L,
  desc: 'Bell partials at 1820 and 4470 Hz, 1.5 s decay.',
  vary: { pitch: 0.01, gain: 1 },
  maxVoices: 2,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.1, attack: 0.0004, decay: 0.004 })
    return s.modal({ t, out, f: 1820 * p.k, ratios: [1, 4470 / 1820], gains: [0.25, 0.1], decays: [1.5, 0.7] })
  },
})

const enlargerHum = loopDef({
  id: 'latent.enlarger-hum',
  label: 'Enlarger lamp hum',
  group: G,
  games: L,
  desc: '60 Hz with 120 and 180 Hz at -30 dB, plus fan noise low-passed at 400 Hz.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.osc('sine', 60, t, null, s.gain(0.03, m))
    s.osc('sine', 120, t, null, s.gain(0.03 * 0.032 * 8, m))
    s.osc('sine', 180, t, null, s.gain(0.03 * 0.032 * 8, m))
    s.noise('brown', t, null, s.filter('lowpass', 400, 0.7, s.gain(0.02, m)))
    to(m.gain, p.level, t, 0.1)
    return {
      set(_n, _v, at) {
        to(m.gain, p.level, at, 0.1)
      },
    }
  },
})

const relay: SoundDef = shot({
  id: 'latent.relay',
  label: 'Relay clack',
  group: G,
  games: L,
  desc: 'A relay on or off: a sharp click and a small metallic ring.',
  vary: { pitch: 0.05, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    s.burst({ t, out, f: 2800 * p.k, q: 2, gain: 0.3, attack: 0.0003, decay: 0.006 })
    s.tone({ t, out, f: 160 * p.k, gain: 0.2, attack: 0.001, decay: 0.03 })
    return s.tone({ t: t + 0.002, out, f: 1650 * p.k, gain: 0.04, attack: 0.0005, decay: 0.05 })
  },
})

const slosh = alias(Audio.def('liquid.slosh')!, { id: 'latent.slosh', games: L, group: G, label: 'Tray slosh', desc: 'Continuous; drive energy 0..1 from the tray.' })
const lap = alias(Audio.def('liquid.lap')!, { id: 'latent.lap', games: L, group: G, label: 'Lap', desc: 'A wave on the tray wall.' })

const tok: SoundDef = shot({
  id: 'latent.tok',
  label: 'Tok',
  group: G,
  games: L,
  desc: 'A 900 Hz sine with a 2.5 kHz partial, 60 ms: paper against the tray.',
  vary: { pitch: 0.06, gain: 1 },
  play(s, out, t, p) {
    const a = s.tone({ t, out, f: 900 * p.k, gain: 0.2, attack: 0.001, decay: 0.06 })
    const b = s.tone({ t, out, f: 2500 * p.k, gain: 0.06, attack: 0.001, decay: 0.04 })
    return Math.max(a, b)
  },
})

const drip: SoundDef = shot({
  id: 'latent.drip',
  label: 'Drip',
  group: G,
  games: L,
  desc: 'A sine falling 900 to 500 Hz over 60 ms, +/-15%.',
  vary: { pitch: 0.15, gain: 1.5 },
  maxVoices: 6,
  play(s, out, t, p) {
    return s.tone({ t, out, f: 900 * p.k, f2: 500 * p.k, glide: 0.06, gain: 0.1, attack: 0.001, decay: 0.06 })
  },
})

const fogHiss: SoundDef = shot({
  id: 'latent.fog-hiss',
  label: 'Fog hiss',
  group: G,
  games: L,
  desc: 'White noise through a low-pass sweeping 6 kHz to 300 Hz over 0.6 s.',
  vary: { pitch: 0, gain: 0.5 },
  maxVoices: 2,
  play(s, out, t) {
    return s.burst({ t, out, type: 'lowpass', f: 6000, f2: 300, q: 0.7, gain: 0.14, attack: 0.02, hold: 0.1, decay: 0.5 })
  },
})

const stamp: SoundDef = shot({
  id: 'latent.stamp',
  label: 'LEGIBLE stamp',
  group: G,
  games: L,
  desc: 'A 70 Hz thump and a paper slap (noise high-passed at 1 kHz, 20 ms).',
  vary: { pitch: 0.04, gain: 1 },
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 1000, gain: 0.2, attack: 0.0006, decay: 0.02 })
    return s.tone({ t, out, f: 70 * p.k, f2: 52 * p.k, gain: 0.5, attack: 0.002, decay: 0.12 })
  },
})

const cluster = loopDef({
  id: 'latent.cluster',
  label: 'Rising cluster',
  group: G,
  games: L,
  desc: 'Four sines at 60 x {3, 4, 5, 7} Hz whose level rises with rho / rho_d (rho01 0..1). Cut it at the timer bell.',
  params: { rho01: { min: 0, max: 1, default: 0, step: 0.01 } },
  preview: { dur: 3, auto: (t, d) => ({ rho01: t / d }) },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    for (const [i, mult] of [3, 4, 5, 7].entries()) s.osc('sine', 60 * mult * (1 + (i - 1.5) * 0.0015), t, null, s.gain(0.03 / (1 + i * 0.35), m))
    const apply = (at: number): void => to(m.gain, Math.pow(clamp01(p.rho01), 1.6), at, 0.5)
    apply(t)
    return {
      set(_n, _v, at) {
        apply(at)
      },
    }
  },
})

/** A relay clack plus a compressor hum that ramps up over 3 s and decays. */
function compressorEvent(s: Synth, out: AudioNode, t: number, level: number): number {
  s.burst({ t, out, f: 2400, q: 2, gain: 0.25 * level, attack: 0.0003, decay: 0.008 })
  s.tone({ t, out, f: 150, gain: 0.2 * level, attack: 0.001, decay: 0.03 })
  const g = s.gain(0, out)
  g.gain.setValueAtTime(0, t + 0.05)
  g.gain.linearRampToValueAtTime(0.03 * level, t + 3.05)
  g.gain.linearRampToValueAtTime(0.03 * level, t + 6)
  g.gain.linearRampToValueAtTime(0, t + 8)
  s.osc('sine', 48, t + 0.05, t + 8.1, g)
  s.osc('sine', 96, t + 0.05, t + 8.1, s.gain(0.4, g))
  return t + 8.1
}

const compressor: SoundDef = shot({
  id: 'latent.compressor',
  label: 'Cold-store compressor',
  group: G,
  games: L,
  desc: 'A relay clack, then a hum that ramps up over 3 s and runs for a few seconds.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 1,
  play(s, out, t) {
    return compressorEvent(s, out, t, 1)
  },
})

const room = loopDef({
  id: 'latent.room',
  label: 'Room',
  group: G,
  games: L,
  desc: 'A 40 Hz HVAC drone; the cold-store compressor cycles in about every 240 s; rain (pink noise, high-passed at 2 kHz, with sparse drop transients) scales with the rain param.',
  params: {
    level: { min: 0, max: 2, default: 1, step: 0.01 },
    rain: { min: 0, max: 1, default: 0, step: 0.01 },
  },
  start(s, out, t, p) {
    const m = s.gain(0, out)
    s.osc('sine', 40, t, null, s.gain(0.02, m))
    s.noise('brown', t, null, s.filter('lowpass', 220, 0.7, s.gain(0.02, m)))
    const rainG = s.gain(0, m)
    s.noise('pink', t, null, s.filter('highpass', 2000, 0.7, rainG))
    const apply = (at: number): void => {
      to(m.gain, p.level, at, 0.2)
      to(rainG.gain, 0.03 * clamp01(p.rain), at, 0.4)
    }
    apply(t)
    let nextDrop = -1
    let nextComp = t + s.r(60, 240)
    return {
      set(_n, _v, at) {
        apply(at)
      },
      tick(from, until) {
        const rate = 7 * clamp01(p.rain)
        if (rate > 0.1) {
          if (nextDrop < from) nextDrop = from + s.r(0, 1 / rate)
          while (nextDrop < until) {
            s.burst({ t: nextDrop, out: m, f: s.r(1800, 3600), q: 2, gain: 0.03 * s.r(0.4, 1), attack: 0.0005, decay: 0.012 })
            nextDrop += s.r(0.4, 1.6) / rate
          }
        }
        if (nextComp < until) {
          compressorEvent(s, m, Math.max(from, nextComp), 1)
          nextComp += 240 * s.r(0.8, 1.2)
        }
      },
    }
  },
})

const phoneRing = loopDef({
  id: 'latent.phone-ring',
  label: 'Phone ring',
  group: G,
  games: L,
  desc: 'Two sines at 440 and 480 Hz, 2 s on, 4 s off.',
  params: { level: { min: 0, max: 2, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const m = s.gain(1, out)
    let next = t
    return {
      set() {},
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          const g = s.gain(0, m)
          g.gain.setValueAtTime(0, next)
          g.gain.linearRampToValueAtTime(0.1 * p.level, next + 0.01)
          g.gain.setValueAtTime(0.1 * p.level, next + 1.99)
          g.gain.linearRampToValueAtTime(0, next + 2)
          // the bell rings in 20 Hz bursts
          const trem = s.gain(0.5, g)
          trem.gain.setValueAtTime(0.5, next)
          s.osc('sine', 440, next, next + 2.01, trem)
          s.osc('sine', 480, next, next + 2.01, trem)
          next += 6
        }
      },
    }
  },
})

const squelch: SoundDef = shot({
  id: 'latent.squelch',
  label: 'Radio squelch',
  group: G,
  games: L,
  desc: 'No voice, just text with a squelch tail: a short band-passed noise burst.',
  vary: { pitch: 0.05, gain: 1 },
  play(s, out, t, p) {
    return s.burst({ t, out, f: 1800 * p.k, q: 1.2, gain: 0.12, attack: 0.004, hold: 0.03, decay: 0.09 })
  },
})

const fax: SoundDef = shot({
  id: 'latent.fax',
  label: 'Fax',
  group: G,
  games: L,
  desc: 'A carrier whistle sweeping 1.1 to 2.1 kHz, then a stepped motor buzz.',
  vary: { pitch: 0, gain: 0 },
  maxVoices: 1,
  play(s, out, t) {
    s.tone({ t, out, f: 1100, f2: 2100, glide: 0.7, sweep: 'lin', gain: 0.09, attack: 0.02, hold: 0.7, decay: 0.05 })
    let end = t + 0.8
    // stepped motor buzz: 16 steps
    const g = s.gain(0, out)
    for (let i = 0; i < 16; i++) {
      const tt = t + 0.85 + i * 0.045
      g.gain.setValueAtTime(0.05, tt)
      g.gain.linearRampToValueAtTime(0.02, tt + 0.04)
      end = tt + 0.045
    }
    g.gain.setValueAtTime(0, end)
    s.osc('sawtooth', 190, t + 0.85, end + 0.01, s.filter('bandpass', 650, 3, g))
    return end
  },
})

export const SOUNDS: SoundDef[] = [
  key, seek, tape, chainClink, clunk, bagZip, bagTick, kink, glug, rap, lid, timerTick, timerBell, enlargerHum, relay,
  slosh, lap, tok, drip, fogHiss, stamp, cluster, room, compressor, phoneRing, squelch, fax,
]

let registered = false
/** Register every latent.* sound with the shared engine. Idempotent. */
export function registerSounds(): void {
  if (registered) return
  registered = true
  Audio.register(SOUNDS)
}

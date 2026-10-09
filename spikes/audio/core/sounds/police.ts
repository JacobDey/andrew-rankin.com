// 1990s police UI and precinct: keyboard, typewriter, terminal beeps, disk seeks, CRT,
// dot-matrix printer, and unintelligible radio chatter.
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { clamp01, lerp, to, writeGrain } from '../synth'

const G = 'Precinct (1990s)'
const COP: SoundDef['games'] = ['latent']

const kbd: OneShotDef = {
  kind: 'oneshot',
  id: 'kbd.key',
  label: 'Keyboard key',
  group: G,
  games: [...COP, 'hub'],
  desc: 'Buckling-spring keyclick (3.2 kHz burst + 140 Hz thunk + spring ping). up=1 for the softer release; heavy=1 for space/enter.',
  params: {
    up: { min: 0, max: 1, default: 0, step: 1, options: ['down', 'up'] },
    heavy: { min: 0, max: 1, default: 0, step: 1, options: ['letter', 'space/enter'] },
  },
  vary: { pitch: 0.08, gain: 2 },
  maxVoices: 6,
  play(s, out, t, p) {
    const k = p.k
    if (p.up >= 1) {
      s.burst({ t, out, f: 3600 * k, q: 2, gain: 0.12, decay: 0.003 })
      return s.tone({ t, out, f: 160 * k, gain: 0.06, decay: 0.015 })
    }
    s.burst({ t, out, f: 3200 * k, q: 2, gain: 0.32, attack: 0.0003, decay: 0.006 })
    s.tone({ t, out, f: 2100 * k, type: 'triangle', gain: 0.02, decay: 0.025 })
    let end = s.tone({ t, out, f: 140 * k, gain: 0.18, attack: 0.0008, decay: 0.03 })
    if (p.heavy >= 1) {
      s.burst({ t: t + 0.004, out, f: 1600 * k, q: 1.5, gain: 0.1, decay: 0.02 })
      end = Math.max(end, s.tone({ t, out, f: 95 * k, gain: 0.2, decay: 0.05 }))
    }
    return end
  },
}

const tw: OneShotDef = {
  kind: 'oneshot',
  id: 'typewriter.key',
  label: 'Typewriter key',
  group: G,
  games: [...COP, 'plates'],
  desc: 'Key lever, typebar slapping the platen, carriage escapement tick.',
  params: { force: { min: 0, max: 1, default: 0.7, step: 0.01 } },
  vary: { pitch: 0.05, gain: 2 },
  maxVoices: 6,
  play(s, out, t, p) {
    const k = p.k
    const F = clamp01(p.force)
    s.burst({ t, out, f: 1800 * k, q: 1.5, gain: 0.1, decay: 0.006 })
    const ts = t + 0.018
    s.burst({ t: ts, out, type: 'highpass', f: 1200 * k, gain: 0.5 * F, attack: 0.0002, decay: 0.008 })
    s.tone({ t: ts, out, f: 210 * k, gain: 0.25 * F, attack: 0.0008, decay: 0.05 })
    s.tone({ t: ts, out, f: 1450 * k, type: 'triangle', gain: 0.03, decay: 0.04 })
    return s.burst({ t: ts + 0.012, out, f: 2600 * k, q: 3, gain: 0.12, decay: 0.004 })
  },
}

const twBell: OneShotDef = {
  kind: 'oneshot',
  id: 'typewriter.bell',
  label: 'Typewriter bell',
  group: G,
  games: [...COP, 'plates'],
  desc: 'End-of-line margin bell.',
  maxVoices: 1,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.1, decay: 0.004 })
    return s.modal({ t, out, f: 2350 * p.k, ratios: [1, 2.76, 5.4], gains: [0.2, 0.06, 0.03], decays: [1.2, 0.5, 0.25] })
  },
}

const twReturn: OneShotDef = {
  kind: 'oneshot',
  id: 'typewriter.return',
  label: 'Carriage return',
  group: G,
  games: [...COP, 'plates'],
  desc: 'Lever, line-feed ratchet, the carriage sliding home, end thunk.',
  params: { dur: { min: 0.25, max: 0.9, default: 0.5, step: 0.01, unit: 's' } },
  maxVoices: 1,
  play(s, out, t, p) {
    const d = p.dur
    s.burst({ t, out, f: 1400, q: 1, gain: 0.2, decay: 0.01 })
    s.burst({ t: t + 0.02, out, f: 2400, q: 3, gain: 0.18, decay: 0.006 })
    s.burst({ t: t + 0.06, out, f: 2300, q: 3, gain: 0.16, decay: 0.006 })
    s.burst({ t: t + 0.05, out, color: 'pink', f: 1800, f2: 900, q: 1.5, gain: 0.08, attack: 0.04, hold: d - 0.1, decay: 0.05 })
    const hp = s.filter('bandpass', 3000, 2)
    s.noise('white', t + 0.05, t + d + 0.05, hp)
    const st = s.stream(hp, out)
    st.rate = s.quality ? 120 : 60
    st.regular = 0.6
    st.amp = 0.08
    st.decay = 0.004
    st.fill(t + 0.05, t + d)
    const te = t + d
    s.burst({ t: te, out, type: 'lowpass', f: 600, gain: 0.35, decay: 0.04 })
    return s.tone({ t: te, out, f: 120 * p.k, gain: 0.3, decay: 0.07 })
  },
}

const TONES = ['ok', 'error', 'alert']

const beep: OneShotDef = {
  kind: 'oneshot',
  id: 'terminal.beep',
  label: 'Terminal beep',
  group: G,
  games: COP,
  desc: 'Evidence-database PC-speaker beeps through a tiny speaker: ok (short high), error (low double), alert (triple).',
  params: { tone: { min: 0, max: 2, default: 0, step: 1, options: TONES } },
  vary: { pitch: 0, gain: 0 },
  maxVoices: 2,
  play(s, out, t, p) {
    const spk = s.filter('lowpass', 3500, 0.7, s.filter('highpass', 400, 0.7, out))
    const seq: Array<[number, number, number]> =
      p.tone >= 2
        ? [
            [0, 880, 0.08],
            [0.12, 1046, 0.08],
            [0.24, 880, 0.08],
          ]
        : p.tone >= 1
          ? [
              [0, 440, 0.12],
              [0.18, 440, 0.18],
            ]
          : [[0, 1200, 0.06]]
    let end = t
    for (const [dt, f, dur] of seq) {
      const tb = t + dt
      const g = s.gain(0, spk)
      g.gain.setValueAtTime(0, tb)
      g.gain.linearRampToValueAtTime(0.08, tb + 0.001)
      g.gain.setValueAtTime(0.08, tb + dur)
      g.gain.linearRampToValueAtTime(0, tb + dur + 0.001)
      s.osc('square', f, tb, tb + dur + 0.01, g)
      end = tb + dur + 0.01
    }
    return end
  },
}

const seek: OneShotDef = {
  kind: 'oneshot',
  id: 'terminal.seek',
  label: 'Hard-disk seek',
  group: G,
  games: COP,
  desc: 'A query running: 3-8 head-seek ticks through a 1.8 kHz resonator.',
  params: { count: { min: 1, max: 12, default: 5, step: 1 } },
  maxVoices: 2,
  play(s, out, t, p) {
    let tt = t
    let end = t
    for (let i = 0; i < p.count; i++) {
      end = s.burst({ t: tt, out, f: s.jit(1800, 0.05), q: 8, gain: 1.1, attack: 0.0002, decay: 0.012 })
      s.burst({ t: tt, out, f: 900, q: 2, gain: 0.05, decay: 0.008 })
      tt += s.r(0.008, 0.02) + (s.chance(0.2) ? s.r(0.03, 0.08) : 0)
    }
    return end
  },
}

const degauss: OneShotDef = {
  kind: 'oneshot',
  id: 'crt.degauss',
  label: 'CRT degauss',
  group: G,
  games: COP,
  desc: 'Monitor power-on: relay click, the 60 Hz thoonk, a noise swell, relay off.',
  maxVoices: 1,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 2000, gain: 0.25, decay: 0.005 })
    s.tone({ t: t + 0.01, out, f: 60 * p.k, gain: 0.3, attack: 0.005, decay: 1.0 })
    const lp = s.filter('lowpass', 400, 0.7, out)
    s.tone({ t: t + 0.01, out: lp, type: 'sawtooth', f: 120 * p.k, gain: 0.15, attack: 0.005, decay: 0.7 })
    s.burst({ t: t + 0.01, out, color: 'pink', f: 300, q: 0.8, gain: 0.1, attack: 0.1, decay: 1.1 })
    return s.burst({ t: t + 1.4, out, type: 'highpass', f: 2000, gain: 0.15, decay: 0.005 })
  },
}

const whine: LoopDef = {
  kind: 'loop',
  id: 'crt.whine',
  label: 'CRT flyback whine',
  group: G,
  games: COP,
  desc: '15,734 Hz at about -48 dB. Many adults cannot hear it: give it a "for the young" toggle. Skipped on low quality.',
  params: { level: { min: 0, max: 1, default: 1, step: 0.01 } },
  start(s, out, t, p) {
    const g = s.gain(0, out)
    if (s.quality && s.ctx.sampleRate > 32000) s.osc('sine', 15734, t, null, g)
    const apply = (at: number, tau: number): void => to(g.gain, 0.004 * clamp01(p.level), at, tau)
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.1)
      },
    }
  },
}

const printer: OneShotDef = {
  kind: 'oneshot',
  id: 'printer.dotmatrix',
  label: 'Dot-matrix line',
  group: G,
  games: COP,
  desc: 'One printed line: 9-pin impact buzz per character, head motor, then the line feed.',
  params: { chars: { min: 5, max: 80, default: 40, step: 1 } },
  maxVoices: 1,
  play(s, out, t, p) {
    const cps = 80
    const n = Math.round(p.chars)
    const dur = n / cps
    const bp = s.filter('bandpass', 1200, 2)
    s.noise('white', t, t + dur + 0.05, bp)
    // one impact per dot column (9 per character), loudness ~ pins fired in that column
    const cols = s.quality ? 9 : 5
    s.gate(bp, out, t, dur + 0.02, (w, res) => {
      for (let c = 0; c < n; c++) {
        if (s.chance(0.15)) continue // spaces
        for (let col = 0; col < cols; col++) {
          const tc = (c + col / cols) / cps
          const pins = Math.floor(s.r(0, 10))
          if (!pins) continue
          writeGrain(w, tc / res, (0.25 + 0.06 * pins) * 0.9, 0.0002, 0.0025, res)
        }
      }
    })
    const mlp = s.filter('lowpass', 500, 0.7, out)
    s.tone({ t, out: mlp, type: 'sawtooth', f: 75, gain: 0.05, attack: 0.02, hold: dur, decay: 0.03 })
    const tl = t + dur + 0.03
    s.burst({ t: tl, out, f: 900, q: 1, gain: 0.2, decay: 0.05 })
    const slp = s.filter('lowpass', 1500, 0.7, out)
    s.tone({ t: tl + 0.02, out: slp, type: 'square', f: 220, gain: 0.04, attack: 0.005, hold: 0.07, decay: 0.02 })
    const tcr = tl + 0.12
    const clp = s.filter('lowpass', 800, 0.7, out)
    return s.tone({ t: tcr, out: clp, type: 'sawtooth', f: 140, f2: 90, glide: 0.2, gain: 0.04, attack: 0.01, hold: 0.15, decay: 0.05 })
  },
}

const radio: OneShotDef = {
  kind: 'oneshot',
  id: 'radio.chatter',
  label: 'Radio chatter',
  group: G,
  games: COP,
  desc: 'A squelch open, formant babble (never intelligible) in a 300-3000 Hz band, and a hard-cut squelch tail.',
  params: {
    dur: { min: 0.5, max: 4, default: 2, step: 0.1, unit: 's' },
    distance: { min: 0, max: 1, default: 0.4, step: 0.01 },
  },
  maxVoices: 1,
  play(s, out, t, p) {
    const d = p.dur
    const end = t + d
    const band = s.filter('lowpass', lerp(3000, 1800, p.distance), 0.7, s.filter('highpass', 300, 0.7, out))
    s.burst({ t, out: band, type: 'highpass', f: 800, gain: 0.15, decay: 0.02 })
    s.burst({ t, out: band, f: 1800, q: 0.5, gain: 0.03, attack: 0.01, hold: d, decay: 0.01 })
    // voice: sawtooth through three wandering formants, syllable-gated
    const syl = s.gain(0, band)
    const vg = s.gain(0.9, syl)
    const fs = [s.filter('bandpass', 600, 5, vg), s.filter('bandpass', 1500, 6, vg), s.filter('bandpass', 2600, 7, vg)]
    const src = s.gain(1)
    for (const f of fs) src.connect(f)
    const o = s.osc('sawtooth', 130, t + 0.03, end, src)
    let tt = t + 0.04
    while (tt < end - 0.05) {
      const sl = s.r(0.08, 0.2)
      o.frequency.linearRampToValueAtTime(s.r(95, 170), tt + sl)
      fs[0].frequency.linearRampToValueAtTime(s.r(300, 900), tt + sl)
      fs[1].frequency.linearRampToValueAtTime(s.r(900, 2300), tt + sl)
      fs[2].frequency.linearRampToValueAtTime(s.r(2300, 3000), tt + sl)
      const pause = s.chance(0.18)
      syl.gain.setValueAtTime(0, tt)
      if (!pause) {
        syl.gain.linearRampToValueAtTime(s.r(0.5, 1) * 0.5, tt + 0.02)
        syl.gain.linearRampToValueAtTime(0.05, tt + sl)
      }
      tt += sl + (pause ? s.r(0.1, 0.25) : s.r(0.0, 0.03))
    }
    syl.gain.linearRampToValueAtTime(0, end)
    // squelch tail: 120 ms of hard-cut noise
    const tail = s.gain(0, band)
    tail.gain.setValueAtTime(0.12, end)
    tail.gain.setValueAtTime(0, end + 0.12)
    s.noise('white', end, end + 0.13, s.filter('bandpass', 1500, 0.5, tail))
    return end + 0.13
  },
}

export const police: SoundDef[] = [kbd, tw, twBell, twReturn, beep, seek, degauss, whine, printer, radio]

// Liquids and paper: slosh, laps, pour, drips, paper flop/peel/crinkle.
// Liquid character comes from bubble resonances (Minnaert: f ≈ 3.26 / r, r in metres).
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { type Synth, clamp01, lerp, to } from '../synth'

const LIQ = 'Liquid'
const PAPER = 'Paper'
const DARK: SoundDef['games'] = ['darkroom', 'plates', 'latent', 'studio', 'lensbench']

/** One bubble "plink": a sine chirping upward as the bubble rises (van den Doel). */
export function bubble(s: Synth, out: AudioNode, t: number, f: number, gain: number, dur = 0.05, rise = 1.5): number {
  return s.tone({ t, out, f, f2: f * rise, glide: dur * 0.7, gain, attack: 0.0015, decay: dur })
}

/** A wave lapping against the tray wall. */
export function lap(s: Synth, out: AudioNode, t: number, intensity: number, size: number, k = 1): number {
  const I = clamp01(intensity)
  const sz = 1.3 - 0.6 * size
  let end = s.burst({ t, out, color: 'brown', f: s.r(260, 480) * sz * k, q: 1.5, gain: 0.55 * I, attack: 0.012, decay: 0.16 })
  end = Math.max(end, s.burst({ t: t + 0.004, out, f: s.r(1500, 2600) * k, q: 0.8, gain: 0.1 * Math.pow(I, 1.5), attack: 0.004, decay: 0.08 }))
  end = Math.max(end, s.tone({ t, out, f: 120 * sz * k, f2: 70 * sz * k, gain: 0.16 * I, attack: 0.004, decay: 0.09 }))
  if (s.quality) {
    const nb = 1 + Math.floor(s.r(0, 3) * I)
    for (let i = 0; i < nb; i++)
      end = Math.max(end, bubble(s, out, t + s.r(0.01, 0.07), s.r(700, 2200) * sz * k, 0.05 * I, s.r(0.03, 0.06)))
  }
  return end
}

const slosh: LoopDef = {
  kind: 'loop',
  id: 'liquid.slosh',
  label: 'Tray slosh',
  group: LIQ,
  games: DARK,
  desc: 'Continuous. Drive `energy` from the tray sim (RMS surface velocity or √KE, 0..1). Auto laps can be turned off (laps=0) and fired from real wall hits with liquid.lap.',
  params: {
    energy: { min: 0, max: 1, default: 0.4, step: 0.01 },
    depth: { min: 0, max: 1, default: 0.5, step: 0.01, label: 'depth (deeper = darker)' },
    size: { min: 0, max: 1, default: 0.5, step: 0.01, label: 'tray size' },
    laps: { min: 0, max: 1, default: 1, step: 0.01, label: 'auto laps' },
    pan: { min: -1, max: 1, default: 0, step: 0.01 },
  },
  preview: { dur: 4, auto: (t, d) => ({ energy: 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / d) }) },
  start(s, out, t, p) {
    const pan = s.panner(p.pan, out)
    const body = s.gain(0, pan)
    const bp1 = s.filter('bandpass', 400, 0.9, body)
    s.noise('brown', t, null, bp1)
    const surf = s.gain(0, pan)
    const bp2 = s.filter('bandpass', 2000, 0.7, surf)
    if (s.quality) s.noise('white', t, null, bp2)
    let nextLap = -1
    let nextBub = -1
    const apply = (at: number, tau: number): void => {
      const e = clamp01(p.energy)
      const fc = (300 + 600 * e) * (1.25 - 0.5 * p.depth) * (1.3 - 0.6 * p.size)
      to(bp1.frequency, fc, at, tau)
      to(body.gain, 0.55 * Math.sqrt(e), at, tau)
      to(bp2.frequency, 1200 + 2.2 * fc, at, tau)
      to(surf.gain, 0.14 * e * e, at, tau)
      to(pan.pan, Math.max(-1, Math.min(1, p.pan)), at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.06)
      },
      tick(from, until) {
        const e = clamp01(p.energy)
        const lapRate = p.laps * (e > 0.12 ? 0.6 + 3 * e : 0)
        if (lapRate > 0) {
          if (nextLap < from) nextLap = from + s.r(0, 1 / lapRate)
          while (nextLap < until) {
            lap(s, pan, nextLap, e * s.r(0.5, 1), p.size)
            nextLap += (1 / lapRate) * s.r(0.6, 1.4)
          }
        } else nextLap = -1
        const bRate = (s.quality ? 26 : 10) * e * e
        if (bRate > 0.2) {
          if (nextBub < from) nextBub = from + s.r(0, 1 / bRate)
          while (nextBub < until) {
            bubble(s, pan, nextBub, s.r(700, 2600) * (1.2 - 0.4 * p.size), 0.05 * e * s.r(0.3, 1), s.r(0.025, 0.06))
            nextBub += (-Math.log(1 - s.rand() * 0.999) / bRate)
          }
        } else nextBub = -1
      },
    }
  },
}

const lapShot: OneShotDef = {
  kind: 'oneshot',
  id: 'liquid.lap',
  label: 'Lap (wall hit)',
  group: LIQ,
  games: DARK,
  desc: 'One wave hitting the tray wall. Fire from the fluid sim when edge impact energy peaks.',
  params: {
    intensity: { min: 0, max: 1, default: 0.7, step: 0.01 },
    size: { min: 0, max: 1, default: 0.5, step: 0.01 },
  },
  maxVoices: 6,
  play(s, out, t, p) {
    return lap(s, out, t, p.intensity, p.size, p.k)
  },
}

const pour: LoopDef = {
  kind: 'loop',
  id: 'liquid.pour',
  label: 'Pour',
  group: LIQ,
  games: DARK,
  desc: 'Pouring into a tray or tank. `fill` raises the cavity resonance as the vessel fills; `glug` adds the source bottle gulping air.',
  params: {
    flow: { min: 0, max: 1, default: 0.6, step: 0.01 },
    fill: { min: 0, max: 1, default: 0.2, step: 0.01, label: 'vessel fill' },
    glug: { min: 0, max: 1, default: 0.5, step: 0.01, label: 'bottle glug' },
  },
  preview: { dur: 4, auto: (t, d) => ({ flow: t < 0.3 ? t / 0.3 : t > d - 0.4 ? (d - t) / 0.4 : 0.8, fill: t / d }) },
  start(s, out, t, p) {
    const stream = s.gain(0, out)
    const bp = s.filter('bandpass', 2000, 0.9, stream)
    s.noise('white', t, null, bp)
    const body = s.gain(0, out)
    const lp = s.filter('lowpass', 700, 0.8, body)
    s.noise('brown', t, null, lp)
    const cav = s.gain(0, out)
    const cavF = s.filter('bandpass', 400, 8, cav)
    if (s.quality) s.noise('white', t, null, cavF)
    let nextB = -1
    let nextG = -1
    const apply = (at: number, tau: number): void => {
      const f = clamp01(p.flow)
      const fill = clamp01(p.fill)
      to(bp.frequency, 900 + 1600 * f + 900 * fill, at, tau)
      to(stream.gain, 0.15 * f, at, tau)
      to(lp.frequency, 500 + 600 * f, at, tau)
      to(body.gain, 0.3 * f * (1 - 0.5 * fill), at, tau)
      to(cavF.frequency, 350 + 1400 * Math.pow(fill, 1.5), at, tau)
      to(cav.gain, 0.4 * f, at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.05)
      },
      tick(from, until) {
        const f = clamp01(p.flow)
        const rate = (s.quality ? 30 : 12) * f
        if (rate > 0.5) {
          if (nextB < from) nextB = from + s.r(0, 1 / rate)
          while (nextB < until) {
            const r = s.r(0.8, 4) * 1e-3
            bubble(s, out, nextB, (3.26 / r) * (1 + 0.3 * p.fill), 0.06 * f * s.r(0.3, 1), s.r(0.02, 0.05), 1.3)
            nextB += -Math.log(1 - s.rand() * 0.999) / rate
          }
        } else nextB = -1
        const gr = p.glug > 0.02 && f > 0.05 ? s.r(2.5, 5) : 0
        if (gr) {
          if (nextG < from) nextG = from + s.r(0, 1 / gr)
          while (nextG < until) {
            const g0 = (180 + 140 * (1 - p.fill)) * s.r(0.9, 1.1)
            s.tone({ t: nextG, out, f: g0, f2: g0 * 1.7, glide: 0.06, gain: 0.25 * p.glug * f, attack: 0.006, decay: 0.09 })
            nextG += (1 / gr) * s.r(0.7, 1.3)
          }
        } else nextG = -1
      },
    }
  },
}

const drip: OneShotDef = {
  kind: 'oneshot',
  id: 'liquid.drip',
  label: 'Drip',
  group: LIQ,
  games: DARK,
  desc: 'A drop into liquid (Minnaert bubble plink) or onto the bench (dry tick).',
  params: {
    size: { min: 1, max: 4, default: 2, step: 0.1, unit: 'mm', label: 'bubble radius' },
    surface: { min: 0, max: 1, default: 0, step: 1, options: ['liquid', 'bench'] },
  },
  vary: { pitch: 0.1, gain: 2 },
  maxVoices: 6,
  play(s, out, t, p) {
    if (p.surface >= 1) {
      s.burst({ t, out, f: 3000 * p.k, q: 1, gain: 0.15, decay: 0.015 })
      return s.burst({ t, out, type: 'lowpass', f: 900 * p.k, gain: 0.12, decay: 0.03 })
    }
    s.burst({ t, out, type: 'highpass', f: 2500, gain: 0.06, decay: 0.003 })
    const f0 = (3.26 / (p.size * 1e-3)) * p.k
    let end = bubble(s, out, t + 0.002, f0, 0.3, 0.075, 1.6)
    if (s.quality && s.chance(0.3)) end = Math.max(end, bubble(s, out, t + s.r(0.02, 0.05), f0 * s.r(1.3, 1.9), 0.08, 0.04))
    return end
  },
}

const flop: OneShotDef = {
  kind: 'oneshot',
  id: 'paper.flop',
  label: 'Paper flop',
  group: PAPER,
  games: DARK,
  desc: 'A sheet landing: dry slap on the bench, or a wet flop into a tray (wet=1).',
  params: {
    wet: { min: 0, max: 1, default: 0.8, step: 0.01 },
    size: { min: 0, max: 1, default: 0.5, step: 0.01 },
    force: { min: 0, max: 1, default: 0.7, step: 0.01 },
  },
  maxVoices: 4,
  play(s, out, t, p) {
    const { wet, size, force } = p
    // air pushed out from under the sheet
    s.burst({ t, out, color: 'pink', type: 'lowpass', f: 500, gain: 0.12 * size * force, attack: 0.025, decay: 0.04 })
    const ti = t + 0.03
    let end = s.burst({ t: ti, out, f: lerp(1300, 600, wet) * p.k, q: 0.7, gain: 0.35 * force, attack: 0.001, decay: lerp(0.02, 0.06, wet) })
    end = Math.max(end, s.tone({ t: ti, out, f: lerp(120, 75, wet) * p.k, f2: 48, gain: 0.25 * force * (0.5 + 0.5 * size), attack: 0.002, decay: 0.1 }))
    if (wet > 0.05) {
      end = Math.max(end, s.burst({ t: ti, out, color: 'brown', type: 'lowpass', f: 700, gain: 0.35 * wet * force, attack: 0.003, decay: 0.18 }))
      const nb = s.quality ? 3 + Math.floor(3 * wet) : 2
      for (let i = 0; i < nb; i++) end = Math.max(end, bubble(s, out, ti + s.r(0.01, 0.15), s.r(600, 1800), 0.05 * wet, s.r(0.03, 0.06)))
    }
    return end
  },
}

const peel: OneShotDef = {
  kind: 'oneshot',
  id: 'paper.peel',
  label: 'Paper peel',
  group: PAPER,
  games: DARK,
  desc: 'Lifting a stuck sheet: stick-slip crackle, then (wet) the suction letting go.',
  params: {
    dur: { min: 0.15, max: 1.5, default: 0.6, step: 0.01, unit: 's' },
    wet: { min: 0, max: 1, default: 0.5, step: 0.01 },
  },
  maxVoices: 3,
  play(s, out, t, p) {
    const dur = p.dur
    const wet = p.wet
    const end = t + dur
    const bp = s.filter('bandpass', lerp(2600, 1300, wet) * p.k, 0.8)
    s.noise('white', t, end + 0.06, bp)
    const st = s.stream(bp, out, { tail: 0.05 })
    st.decay = lerp(0.0025, 0.007, wet)
    st.amp = lerp(0.18, 0.14, wet)
    st.ampVar = 0.85
    const base = lerp(260, 70, wet) * (s.quality ? 1 : 0.6)
    for (let c = t; c < end; c += 0.04) {
      const x = (c - t) / dur
      st.rate = base * (0.4 + 1.2 * Math.sin(Math.PI * x))
      st.fill(c, Math.min(end, c + 0.04))
    }
    s.burst({ t, out, f: lerp(1500, 800, wet) * p.k, f2: lerp(3200, 1500, wet) * p.k, q: 0.7, gain: lerp(0.06, 0.035, wet), attack: dur * 0.3, hold: dur * 0.4, decay: dur * 0.3 })
    let e = end + 0.05
    if (wet > 0.2) e = Math.max(e, s.tone({ t: end - 0.01, out, f: 320 * p.k, f2: 110, gain: 0.2 * wet, attack: 0.002, decay: 0.05 }))
    return e
  },
}

const crinkle: OneShotDef = {
  kind: 'oneshot',
  id: 'paper.crinkle',
  label: 'Paper crinkle',
  group: PAPER,
  games: DARK,
  desc: 'Grabbing a dry sheet or envelope: a short burst of crackle.',
  params: { dur: { min: 0.05, max: 0.6, default: 0.18, step: 0.01, unit: 's' } },
  maxVoices: 3,
  play(s, out, t, p) {
    const end = t + p.dur
    const hp = s.filter('highpass', 1800 * p.k, 0.7)
    s.noise('white', t, end + 0.03, hp)
    const st = s.stream(hp, out, { tail: 0.03 })
    st.rate = s.quality ? 240 : 140
    st.decay = 0.002
    st.ampVar = 0.95
    st.amp = 0.12
    st.fill(t, end)
    s.burst({ t, out, f: 4000, q: 0.5, gain: 0.04, attack: 0.01, decay: p.dur })
    return end + 0.03
  },
}

export const liquid: SoundDef[] = [slosh, lapShot, pour, drip, flop, peel, crinkle]

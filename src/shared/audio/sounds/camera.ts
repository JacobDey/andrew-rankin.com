// Camera mechanics: shutters timed to the real exposure, film advance/rewind, bellows,
// focus and aperture rings, self-timer, flash, and a Geiger counter for thoriated glass.
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { type Synth, clamp01, to } from '../synth'

const G = 'Camera'
const CAM: SoundDef['games'] = ['lensbench', 'studio', 'latent', 'plates']

/** Slow-speed escapement: a 180 Hz square gear-train buzz with ±10% amplitude jitter. */
export function gearBuzz(s: Synth, out: AudioNode, t0: number, t1: number, gain: number): void {
  if (t1 - t0 < 0.02) return
  const g = s.gain(0, out)
  const n = Math.max(4, Math.round((t1 - t0) / 0.012))
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) c[i] = gain * (1 + (s.rand() * 2 - 1) * 0.1)
  c[0] = 0
  c[n - 1] = 0
  g.gain.setValueCurveAtTime(c, t0, t1 - t0)
  const bp = s.filter('bandpass', 360, 2, g)
  s.osc('square', 180, t0, t1 + 0.01, bp)
}

function leafClick(s: Synth, out: AudioNode, t: number, f: number, g: number): number {
  s.burst({ t, out, f, q: 3, gain: g, attack: 0.0003, decay: 0.004 })
  return s.burst({ t, out, f: 900, q: 1.5, gain: g * 0.6, attack: 0.0005, decay: 0.012 })
}

const SPEED = { min: 1 / 4000, max: 4, default: 1 / 60, log: true, unit: 's', label: 'shutter speed' }

const leaf: OneShotDef = {
  kind: 'oneshot',
  id: 'shutter.leaf',
  label: 'Leaf shutter',
  group: G,
  games: CAM,
  desc: 'Two tiny clicks separated by the real exposure. From 1/8s the slow-speed escapement buzzes in the gap.',
  params: { speed: { ...SPEED, min: 1 / 500 } },
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    const sp = p.speed
    leafClick(s, out, t, 3800 * p.k, 0.8)
    const tc = t + sp
    if (sp >= 1 / 8) gearBuzz(s, out, t + 0.006, tc - 0.002, 0.035)
    return leafClick(s, out, tc, 3500 * p.k, 0.7) + 0.01
  },
}

const focal: OneShotDef = {
  kind: 'oneshot',
  id: 'shutter.focal',
  label: 'Focal-plane shutter',
  group: G,
  games: CAM,
  desc: 'Two curtains separated by exposure + travel. Cloth = soft thup…thup, metal = crisp ticks. mirror=1 adds the SLR slap and return (ka-chunk).',
  params: {
    speed: { ...SPEED, default: 1 / 125 },
    mirror: { min: 0, max: 1, default: 1, step: 1, options: ['rangefinder', 'SLR mirror'] },
    curtain: { min: 0, max: 1, default: 0, step: 1, options: ['cloth', 'metal'] },
    travel: { min: 0.004, max: 0.025, default: 0.012, step: 0.001, unit: 's' },
  },
  vary: { pitch: 0.02, gain: 1 },
  maxVoices: 3,
  play(s, out, t, p) {
    const k = p.k
    const metal = p.curtain >= 1
    let tc = t
    if (p.mirror >= 1) {
      s.tone({ t, out, f: 60 * k, gain: 0.3, attack: 0.002, decay: 0.08 })
      s.modal({ t, out, f: 2000 * k, ratios: [1, 2.31], gains: [0.05, 0.02], decays: [0.09, 0.05] })
      s.burst({ t, out, f: 1200 * k, q: 0.8, gain: 0.25, decay: 0.02 })
      s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.1, decay: 0.004 })
      tc = t + 0.03
    }
    const curtain = (tt: number, second: boolean): number => {
      const g = second ? 1.15 : 1
      if (metal) {
        s.burst({ t: tt, out, type: 'highpass', f: 2500 * k, gain: 0.3 * g, decay: 0.006 })
        s.burst({ t: tt, out, f: 1800 * k, q: 2, gain: 0.1 * g, decay: 0.01 })
        return s.tone({ t: tt, out, f: 3200 * k, gain: 0.05 * g, decay: 0.015 })
      }
      s.burst({ t: tt, out, color: 'pink', type: 'lowpass', f: 1500 * k, gain: 0.45 * g, attack: 0.001, decay: 0.022 })
      return s.burst({ t: tt, out, f: 600 * k, q: 2, gain: 0.1 * g, decay: 0.04 })
    }
    curtain(tc, false)
    const t2 = tc + p.speed + p.travel
    if (p.speed >= 1 / 8) gearBuzz(s, out, tc + p.travel, t2 - 0.002, 0.025)
    let end = curtain(t2, true)
    end = Math.max(end, s.tone({ t: t2, out, f: 180 * k, gain: 0.12, decay: 0.05 }))
    if (p.mirror >= 1) {
      const tr = t2 + 0.02
      s.burst({ t: tr, out, f: 900 * k, q: 1, gain: 0.2, decay: 0.015 })
      end = Math.max(end, s.tone({ t: tr, out, f: 70 * k, gain: 0.25, attack: 0.002, decay: 0.06 }))
    }
    return end
  },
}

const advance: OneShotDef = {
  kind: 'oneshot',
  id: 'film.advance',
  label: 'Film advance',
  group: G,
  games: CAM,
  desc: 'A full lever stroke: ratchet clicks rising in pitch, film drag, then the frame counter thunk.',
  params: {
    clicks: { min: 4, max: 14, default: 9, step: 1 },
    stroke: { min: 0.12, max: 0.8, default: 0.3, step: 0.01, unit: 's' },
  },
  maxVoices: 2,
  play(s, out, t, p) {
    const n = Math.round(p.clicks)
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? i / (n - 1) : 0
      // equal angle steps of a lever that accelerates and decelerates
      const ti = t + (p.stroke * Math.acos(1 - 2 * x)) / Math.PI
      s.burst({ t: ti, out, f: (2000 + 1400 * x) * p.k, q: 3, gain: 0.25 * s.r(0.8, 1), decay: 0.005 })
      s.tone({ t: ti, out, f: (4800 + 800 * x) * p.k, gain: 0.02, decay: 0.008 })
    }
    s.burst({ t, out, f: 1800, q: 0.5, gain: 0.02, attack: 0.02, hold: Math.max(0, p.stroke - 0.04), decay: 0.03 })
    const te = t + p.stroke + 0.01
    s.burst({ t: te, out, f: 700 * p.k, q: 1, gain: 0.2, decay: 0.02 })
    s.burst({ t: te + 0.06, out, type: 'highpass', f: 3000, gain: 0.06, decay: 0.003 })
    return s.tone({ t: te, out, f: 160 * p.k, gain: 0.12, decay: 0.04 }) + 0.07
  },
}

const click: OneShotDef = {
  kind: 'oneshot',
  id: 'film.click',
  label: 'Ratchet detent',
  group: G,
  games: CAM,
  desc: 'One advance-lever detent, for drag-driven levers (pos rises the pitch along the stroke).',
  params: { pos: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  minInterval: 0.012,
  maxVoices: 4,
  play(s, out, t, p) {
    s.tone({ t, out, f: (4800 + 800 * p.pos) * p.k, gain: 0.02, decay: 0.008 })
    return s.burst({ t, out, f: (2000 + 1400 * p.pos) * p.k, q: 3, gain: 0.35, decay: 0.005 })
  },
}

const rewind: LoopDef = {
  kind: 'loop',
  id: 'film.rewind',
  label: 'Rewind crank',
  group: G,
  games: CAM,
  desc: 'Friction zip inside the canister + crank knob rattle, driven by crank speed. slack=1 once the leader leaves the take-up spool.',
  params: {
    speed: { min: 0, max: 1, default: 0.5, step: 0.01 },
    slack: { min: 0, max: 1, default: 0, step: 1, options: ['tension', 'slack'] },
  },
  preview: { dur: 3, auto: (t, d) => ({ speed: Math.sin((Math.PI * t) / d), slack: t > d * 0.7 ? 1 : 0 }) },
  start(s, out, t, p) {
    const zip = s.gain(0, out)
    const bp = s.filter('bandpass', 1500, 2, zip)
    s.noise('white', t, null, bp)
    const wh = s.gain(0, out)
    const lp = s.filter('lowpass', 300, 0.8, wh)
    s.noise('brown', t, null, lp)
    const rbp = s.filter('bandpass', 3000, 2)
    s.noise('white', t, null, rbp)
    const st = s.stream(rbp, out)
    st.decay = 0.004
    st.amp = 0.35
    st.regular = 0.5
    const apply = (at: number, tau: number): void => {
      const v = clamp01(p.speed)
      const slack = p.slack >= 1
      to(bp.frequency, (600 + 2400 * v) * (slack ? 0.5 : 1), at, tau)
      to(bp.Q, slack ? 0.6 : 2, at, tau)
      to(zip.gain, 0.22 * Math.pow(v, 0.8) * (slack ? 0.35 : 1), at, tau)
      to(wh.gain, 0.12 * v, at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.04)
      },
      tick(from, until) {
        const v = clamp01(p.speed)
        st.rate = v > 0.02 ? (4 + 18 * v) * (s.quality ? 1 : 0.5) : 0
        st.fill(from, until)
      },
    }
  },
}

const snap: OneShotDef = {
  kind: 'oneshot',
  id: 'film.leaderSnap',
  label: 'Leader snaps free',
  group: G,
  games: CAM,
  desc: 'The end of rewinding: tk-fwip.',
  maxVoices: 1,
  play(s, out, t, p) {
    s.burst({ t, out, type: 'highpass', f: 3000, gain: 0.3, decay: 0.005 })
    return s.burst({ t: t + 0.004, out, f: 2200 * p.k, f2: 900 * p.k, q: 1.5, gain: 0.12, attack: 0.002, decay: 0.07 })
  },
}

const bellows: LoopDef = {
  kind: 'loop',
  id: 'bellows',
  label: 'Bellows',
  group: G,
  games: ['lensbench', 'studio'],
  desc: 'Signed rate (dV/dt): air wheeze + leather stick-slip creak. Rack fast and it wheezes.',
  params: { rate: { min: -1, max: 1, default: 0, step: 0.01, label: 'dV/dt' } },
  preview: { dur: 3, auto: (t, d) => ({ rate: Math.sin((2 * Math.PI * t) / d) }) },
  start(s, out, t, p) {
    const wG = s.gain(0, out)
    const bp = s.filter('bandpass', 800, 1.2, wG)
    s.noise('pink', t, null, bp)
    const sum = s.gain(1)
    const r1 = s.filter('bandpass', 380, 6, sum)
    const r2 = s.filter('bandpass', 1100, 6, sum)
    const src = s.gain(1)
    src.connect(r1)
    src.connect(r2)
    s.noise('white', t, null, src)
    const cG = s.gain(0.8, out)
    const st = s.stream(sum, cG)
    st.decay = 0.005
    st.regular = 0.7
    st.jitter = 0.25
    st.ampVar = 0.5
    const apply = (at: number, tau: number): void => {
      const a = Math.min(1, Math.abs(p.rate))
      to(bp.frequency, 700 + 500 * a + (p.rate < 0 ? 300 : 0), at, tau)
      to(wG.gain, 0.2 * Math.pow(a, 1.2), at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.04)
      },
      tick(from, until) {
        const a = Math.min(1, Math.abs(p.rate))
        st.rate = a > 0.04 ? (20 + 150 * a) * (s.quality ? 1 : 0.6) : 0
        st.amp = 0.8 * a
        st.fill(from, until)
      },
    }
  },
}

const focus: LoopDef = {
  kind: 'loop',
  id: 'focus.ring',
  label: 'Focus ring friction',
  group: G,
  games: ['lensbench', 'studio', 'texturedle'],
  desc: 'Velocity-driven grease hush. grease=1 is a damped, expensive helicoid; 0 is dry and gritty.',
  params: {
    velocity: { min: -1, max: 1, default: 0, step: 0.01 },
    grease: { min: 0, max: 1, default: 0.8, step: 0.01 },
  },
  preview: { dur: 3, auto: (t, d) => ({ velocity: Math.sin((2 * Math.PI * t) / d), grease: 0.4 }) },
  start(s, out, t, p) {
    const hush = s.gain(0, out)
    const bp = s.filter('bandpass', 600, 0.7, hush)
    s.noise('brown', t, null, bp)
    const hp = s.filter('highpass', 3000, 0.7)
    s.noise('white', t, null, hp)
    const st = s.stream(hp, out)
    st.decay = 0.002
    const apply = (at: number, tau: number): void => {
      const v = Math.min(1, Math.abs(p.velocity))
      to(bp.frequency, 500 + 800 * v, at, tau)
      to(hush.gain, 0.07 * Math.pow(v, 0.8), at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.03)
      },
      tick(from, until) {
        const v = Math.min(1, Math.abs(p.velocity))
        st.rate = (1 - clamp01(p.grease)) * 220 * v
        st.amp = 0.08
        st.fill(from, until)
      },
    }
  },
}

const aperture: OneShotDef = {
  kind: 'oneshot',
  id: 'aperture.detent',
  label: 'Aperture detent',
  group: G,
  games: ['lensbench', 'studio'],
  desc: 'Half-stop click (6 kHz tick). declicked=1: a cine ring, just a grease hush.',
  params: { declicked: { min: 0, max: 1, default: 0, step: 1, options: ['click-stop', 'declicked'] } },
  minInterval: 0.02,
  maxVoices: 4,
  play(s, out, t, p) {
    if (p.declicked >= 1) return s.burst({ t, out, color: 'brown', type: 'lowpass', f: 1800, gain: 0.05, attack: 0.01, decay: 0.05 })
    s.tone({ t, out, f: 7000 * p.k, gain: 0.012, decay: 0.006 })
    return s.burst({ t, out, f: 6000 * p.k, q: 4, gain: 0.35, decay: 0.004 })
  },
}

const selftimer: OneShotDef = {
  kind: 'oneshot',
  id: 'selftimer',
  label: 'Self-timer',
  group: G,
  games: ['lensbench', 'studio'],
  desc: 'Escapement buzz whose rate falls as the spring unwinds, then the release clunk. Fire the shutter yourself at the end.',
  params: { dur: { min: 1, max: 10, default: 4, step: 0.1, unit: 's' } },
  maxVoices: 1,
  play(s, out, t, p) {
    const end = t + p.dur
    const sum = s.gain(1)
    const body = s.filter('bandpass', 700, 4, out)
    const bp = s.filter('bandpass', 1500, 3, out)
    sum.connect(body)
    sum.connect(bp)
    const src = s.filter('highpass', 400, 0.7)
    s.noise('white', t, end + 0.05, src)
    const st = s.stream(src, sum)
    st.regular = 1
    st.jitter = 0.04
    st.decay = 0.006
    st.amp = 0.9
    st.ampVar = 0.2
    for (let c = t; c < end; c += 0.04) {
      const x = (c - t) / p.dur
      st.rate = 30 - 12 * x
      st.fill(c, Math.min(end, c + 0.04))
    }
    s.burst({ t: end, out, f: 900, q: 1, gain: 0.2, decay: 0.02 })
    return s.tone({ t: end, out, f: 150, gain: 0.12, decay: 0.04 })
  },
}

const flashCharge: OneShotDef = {
  kind: 'oneshot',
  id: 'flash.charge',
  label: 'Flash charging',
  group: G,
  games: ['studio', 'lensbench', 'latent'],
  desc: 'Capacitor whine sweeping 3 to 9 kHz, then the neon ready-lamp tick.',
  params: { dur: { min: 0.5, max: 6, default: 3, step: 0.1, unit: 's' } },
  maxVoices: 1,
  play(s, out, t, p) {
    const end = t + p.dur
    s.tone({ t, out, f: 3000 * p.k, f2: 9000 * p.k, glide: p.dur, gain: 0.02, attack: 0.08, hold: p.dur - 0.2, decay: 0.15 })
    return s.burst({ t: end, out, type: 'highpass', f: 4000, gain: 0.1, decay: 0.004 })
  },
}

const flashPop: OneShotDef = {
  kind: 'oneshot',
  id: 'flash.pop',
  label: 'Flashbulb pop',
  group: G,
  games: ['studio', 'plates', 'latent'],
  desc: 'A muffled pop, then the glass ticking as it cools.',
  maxVoices: 2,
  play(s, out, t, p) {
    s.burst({ t, out, color: 'brown', type: 'lowpass', f: 900 * p.k, gain: 0.45, attack: 0.001, decay: 0.07 })
    s.burst({ t, out, f: 2500 * p.k, q: 1, gain: 0.2, decay: 0.012 })
    let end = t
    for (const dt of [0.35, 0.8, 1.4]) end = s.tone({ t: t + dt + s.r(0, 0.1), out, f: s.r(4800, 5800), gain: 0.025, decay: 0.012 })
    return end
  },
}

const geiger: LoopDef = {
  kind: 'loop',
  id: 'geiger',
  label: 'Geiger counter',
  group: G,
  games: ['lensbench'],
  desc: 'Poisson clicks; rate 0..1 maps to 0.5..80 counts per second (thoriated element nearby).',
  params: { rate: { min: 0, max: 1, default: 0.3, step: 0.01 } },
  preview: { dur: 3, auto: (t, d) => ({ rate: t / d }) },
  start(s, out, t, p) {
    const hp = s.filter('highpass', 1500, 0.7)
    s.noise('white', t, null, hp)
    const sum = s.gain(1)
    sum.connect(out)
    const res = s.filter('bandpass', 2600, 2, out)
    sum.connect(res)
    const st = s.stream(hp, sum)
    st.decay = 0.0018
    st.amp = 0.2
    st.ampVar = 0.15
    return {
      set() {},
      tick(from, until) {
        st.rate = 0.5 + 80 * Math.pow(clamp01(p.rate), 2)
        st.fill(from, until)
      },
    }
  },
}

export const camera: SoundDef[] = [leaf, focal, advance, click, rewind, snap, bellows, focus, aperture, selftimer, flashCharge, flashPop, geiger]

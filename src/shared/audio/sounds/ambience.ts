// Ambience beds: room tone, and the backyard (wind, birds, sprinkler, crickets, cicadas, chimes).
import type { LoopDef, SoundDef } from '../types'
import { type Synth, GrainStream, clamp01, to } from '../synth'

const ROOM = 'Ambience: rooms'
const YARD = 'Ambience: backyard'

const roomTone: LoopDef = {
  kind: 'loop',
  id: 'room.tone',
  label: 'Room tone',
  group: ROOM,
  games: ['darkroom', 'plates', 'latent', 'lensbench', 'studio'],
  desc: 'Brown-noise air, mains hum at about -40 dB, HVAC rumble, and an extractor fan with slow beating.',
  params: {
    level: { min: 0, max: 1, default: 0.6, step: 0.01 },
    hum: { min: 0, max: 1, default: 0.4, step: 0.01, label: 'mains hum' },
    rumble: { min: 0, max: 1, default: 0.3, step: 0.01, label: 'HVAC rumble' },
    fan: { min: 0, max: 1, default: 0, step: 0.01, label: 'extractor fan' },
    mains: { min: 0, max: 1, default: 0, step: 1, options: ['60 Hz', '50 Hz'] },
  },
  start(s, out, t, p) {
    const air = s.gain(0, out)
    s.noise('brown', t, null, s.filter('lowpass', 300, 0.7, air))
    const rum = s.gain(0, out)
    s.noise('brown', t, null, s.filter('lowpass', 55, 1.4, rum))
    const hum = s.gain(0, out)
    const m = p.mains >= 1 ? 50 : 60
    const h1 = s.osc('sine', m, t, null, hum)
    const h2g = s.gain(0.6, hum)
    const h2 = s.osc('sine', m * 2, t, null, h2g)
    const fan = s.gain(0, out)
    const am = s.gain(0.75, fan)
    const lfo = s.osc('sine', 0.3, t, null)
    const d = s.gain(0.25)
    lfo.connect(d)
    d.connect(am.gain)
    if (s.quality) s.noise('pink', t, null, s.filter('bandpass', 520, 0.5, am))
    const apply = (at: number, tau: number): void => {
      const L = clamp01(p.level)
      to(air.gain, 0.06 * L, at, tau)
      to(rum.gain, 0.4 * clamp01(p.rumble) * L, at, tau)
      to(hum.gain, 0.012 * clamp01(p.hum) * L, at, tau)
      to(fan.gain, 0.12 * clamp01(p.fan) * L, at, tau)
      const mm = p.mains >= 1 ? 50 : 60
      to(h1.frequency, mm, at, 0)
      to(h2.frequency, mm * 2, at, 0)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.1)
      },
    }
  },
}

const wind: LoopDef = {
  kind: 'loop',
  id: 'yard.wind',
  label: 'Wind',
  group: YARD,
  games: ['studio', 'lensbench', 'plates'],
  desc: 'Gusting wind with leaf rustle and a faint whistle in strong gusts. Readout `gust` (0..1) is the same envelope: use it to move leaves, chimes, the swing.',
  params: {
    strength: { min: 0, max: 1, default: 0.5, step: 0.01 },
    gustiness: { min: 0, max: 1, default: 0.6, step: 0.01 },
  },
  preview: { dur: 5 },
  start(s, out, t, p) {
    const main = s.gain(0, out)
    const lp = s.filter('lowpass', 400, 0.5, main)
    s.noise('pink', t, null, lp)
    const leaves = s.gain(0, out)
    const lbp = s.filter('bandpass', 3200, 0.4, leaves)
    const whistle = s.gain(0, out)
    const wbp = s.filter('bandpass', 800, 12, whistle)
    if (s.quality) {
      s.noise('white', t, null, lbp)
      s.noise('white', t, null, wbp)
    }
    const hp = s.filter('highpass', 3500, 0.7)
    s.noise('white', t, null, hp)
    const st = s.stream(hp, out)
    st.decay = 0.004
    let gFrom = 0
    let gTo = 0
    let gT0 = t
    let gTau = 1
    let next = t
    const gustAt = (now: number): number => gTo + (gFrom - gTo) * Math.exp(-Math.max(0, now - gT0) / gTau)
    const setGust = (at: number, g: number, tau: number): void => {
      gFrom = gustAt(at)
      gTo = g
      gT0 = at
      gTau = tau
      to(lp.frequency, 250 + 1400 * g, at, tau)
      to(main.gain, 0.08 + 0.45 * g, at, tau)
      to(lbp.frequency, 2600 + 1200 * g, at, tau)
      to(leaves.gain, 0.14 * g * g, at, tau)
      to(wbp.frequency, 700 + 500 * g, at, tau)
      to(whistle.gain, 1.2 * g * g * g, at, tau)
    }
    const pickTarget = (): number => {
      const S = clamp01(p.strength)
      const G = clamp01(p.gustiness)
      return clamp01(S * (0.55 + G * (1.3 * s.rand() * s.rand() - 0.35)))
    }
    return {
      set(_n, _v, at) {
        setGust(at, pickTarget(), 0.4)
      },
      tick(from, until) {
        if (next < from) next = from
        while (next < until) {
          setGust(next, pickTarget(), s.r(0.3, 1.2))
          next += s.r(0.4, 1.6)
        }
        const g = gustAt(from)
        st.rate = 40 * g * g * (s.quality ? 1 : 0.5)
        st.amp = 0.12
        st.fill(from, until)
      },
      read(name, now) {
        return name === 'gust' ? gustAt(now) : undefined
      },
    }
  },
}

type Caller = (s: Synth, o: OscillatorNode, amp: GainNode, t: number, L: number) => number

const warbler: Caller = (s, o, amp, t, L) => {
  const n = 4 + Math.floor(s.r(0, 6))
  let f = s.r(2500, 4500)
  let tn = t
  for (let i = 0; i < n; i++) {
    const dur = s.r(0.05, 0.11)
    const f1 = f * s.r(0.85, 1.15)
    const f2 = f1 * s.r(0.7, 1.4)
    o.frequency.setValueAtTime(f1, tn)
    o.frequency.exponentialRampToValueAtTime(f2, tn + dur)
    amp.gain.setValueAtTime(0, tn)
    amp.gain.linearRampToValueAtTime(L, tn + 0.008)
    amp.gain.linearRampToValueAtTime(0, tn + dur)
    tn += dur + s.r(0.02, 0.06)
    f = Math.min(5500, Math.max(2200, f * s.r(0.85, 1.18)))
  }
  return tn
}
const feeBee: Caller = (s, o, amp, t, L) => {
  const k = s.r(0.95, 1.05)
  o.frequency.setValueAtTime(3950 * k, t)
  o.frequency.linearRampToValueAtTime(3850 * k, t + 0.3)
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(L, t + 0.04)
  amp.gain.setValueAtTime(L, t + 0.26)
  amp.gain.linearRampToValueAtTime(0, t + 0.3)
  const t2 = t + 0.36
  o.frequency.setValueAtTime(3400 * k, t2)
  o.frequency.linearRampToValueAtTime(3350 * k, t2 + 0.35)
  amp.gain.setValueAtTime(0, t2)
  amp.gain.linearRampToValueAtTime(L * 0.9, t2 + 0.04)
  amp.gain.setValueAtTime(L * 0.9, t2 + 0.3)
  amp.gain.linearRampToValueAtTime(0, t2 + 0.35)
  return t2 + 0.36
}
const trill: Caller = (s, o, amp, t, L) => {
  const n = 10 + Math.floor(s.r(0, 10))
  const per = 1 / s.r(12, 16)
  const k = s.r(0.9, 1.1)
  for (let i = 0; i < n; i++) {
    const tn = t + i * per
    o.frequency.setValueAtTime(6000 * k, tn)
    o.frequency.exponentialRampToValueAtTime(4000 * k, tn + 0.03)
    amp.gain.setValueAtTime(0, tn)
    amp.gain.linearRampToValueAtTime(L * (0.6 + 0.4 * Math.sin((Math.PI * i) / n)), tn + 0.004)
    amp.gain.linearRampToValueAtTime(0, tn + 0.03)
  }
  return t + n * per
}
const coo: Caller = (s, o, amp, t, L) => {
  const notes: Array<[number, number, number]> = [
    [0, 0.25, 0.6],
    [0.38, 0.5, 1],
    [1.05, 0.32, 0.7],
    [1.5, 0.32, 0.6],
  ]
  const k = s.r(0.95, 1.05)
  for (const [dt, dur, a] of notes) {
    const tn = t + dt
    o.frequency.setValueAtTime(520 * k, tn)
    o.frequency.linearRampToValueAtTime(470 * k, tn + dur)
    amp.gain.setValueAtTime(0, tn)
    amp.gain.linearRampToValueAtTime(L * a * 1.6, tn + 0.06)
    amp.gain.linearRampToValueAtTime(0, tn + dur)
  }
  return t + 1.85
}
const CALLERS: Caller[] = [warbler, warbler, feeBee, trill, coo]

const birds: LoopDef = {
  kind: 'loop',
  id: 'yard.birds',
  label: 'Birds',
  group: YARD,
  games: ['studio', 'lensbench', 'darkroom'],
  desc: 'FM chirps from four made-up species (warbler, fee-bee whistle, trill, dove coo), randomly placed. density 0..1.',
  params: {
    density: { min: 0, max: 1, default: 0.5, step: 0.01 },
    distance: { min: 0, max: 1, default: 0.3, step: 0.01 },
  },
  preview: { dur: 5, auto: () => ({ density: 1 }) },
  start(s, out, t, p) {
    const dlp = s.filter('lowpass', 9000, 0.7, out)
    let next = t + s.r(0, 0.5)
    const call = (t0: number): void => {
      const pan = s.panner(s.r(-0.8, 0.8), dlp)
      const amp = s.gain(0, pan)
      const o = s.osc('sine', 3000, t0, null, amp)
      const c = s.pick(CALLERS)
      const L = s.r(0.3, 1) * 0.12 * (1 - 0.6 * clamp01(p.distance))
      let fm: OscillatorNode | null = null
      if (c === warbler && s.quality) {
        fm = s.osc('sine', s.r(30, 80), t0, null)
        const fg = s.gain(s.r(60, 140))
        fm.connect(fg)
        fg.connect(o.frequency)
      }
      const end = c(s, o, amp, t0, L)
      o.stop(end + 0.05)
      fm?.stop(end + 0.05)
    }
    const apply = (at: number, tau: number): void => to(dlp.frequency, 12000 - 9000 * clamp01(p.distance), at, tau)
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.1)
      },
      tick(from, until) {
        const rate = 0.15 + 1.2 * clamp01(p.density)
        if (next < from) next = from + s.r(0, 0.2)
        while (next < until) {
          call(next)
          next += -Math.log(1 - s.rand() * 0.999) / rate
        }
      },
    }
  },
}

const sprinkler: LoopDef = {
  kind: 'loop',
  id: 'yard.sprinkler',
  label: 'Impact sprinkler',
  group: YARD,
  games: ['studio', 'lensbench'],
  desc: 'tsk… tsk… as the arm steps across (panning with it), then the fast ratchet on the return. Spray hiss follows pressure.',
  params: {
    pressure: { min: 0, max: 1, default: 0.7, step: 0.01 },
    rate: { min: 0.5, max: 2, default: 1, step: 0.01 },
  },
  preview: { dur: 6 },
  start(s, out, t, p) {
    const pan = s.panner(-0.6, out)
    const spray = s.gain(0, pan)
    s.noise('white', t, null, s.filter('highpass', 5000, 0.7, spray))
    let next = t
    let i = 0
    const STEPS = 12
    const apply = (at: number, tau: number): void => to(spray.gain, 0.06 * clamp01(p.pressure), at, tau)
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.1)
      },
      tick(from, until) {
        if (next < from) next = from
        const P = clamp01(p.pressure)
        const r = Math.max(0.2, p.rate)
        while (next < until) {
          if (i < STEPS) {
            const tt = next
            to(pan.pan, -0.6 + (1.2 * i) / (STEPS - 1), tt, 0.05)
            s.burst({ t: tt, out: pan, f: 3500, q: 0.8, gain: 0.22 * P, attack: 0.002, decay: 0.07 })
            s.tone({ t: tt, out: pan, f: 2800, gain: 0.04 * P, decay: 0.03 })
            if (s.quality) s.burst({ t: tt, out: pan, color: 'pink', type: 'highpass', f: 2000, gain: 0.07 * P, attack: 0.01, decay: 0.25 })
            next += 0.4 / r
            i++
          } else {
            const dur = 0.9 / r
            const n = 18
            for (let j = 0; j < n; j++)
              s.burst({ t: next + (j / n) * dur, out: pan, f: 2600 * s.r(0.95, 1.05), q: 4, gain: 0.12 * P, decay: 0.006 })
            pan.pan.setTargetAtTime(-0.6, next, dur / 3)
            next += dur + 0.15
            i = 0
          }
        }
      },
    }
  },
}

const crickets: LoopDef = {
  kind: 'loop',
  id: 'yard.crickets',
  label: 'Crickets',
  group: YARD,
  games: ['studio', 'lensbench'],
  desc: "Night bed. Chirp rate follows Dolbear's law from tempF: you can read the temperature by ear.",
  params: {
    tempF: { min: 50, max: 100, default: 72, step: 1, unit: '°F' },
    count: { min: 1, max: 4, default: 3, step: 1 },
  },
  preview: { dur: 4 },
  start(s, out, t, p) {
    const streams: GrainStream[] = []
    const levels: GainNode[] = []
    const n = s.quality ? 4 : 2
    for (let i = 0; i < n; i++) {
      const lvl = s.gain(0, s.panner(s.r(-0.7, 0.7), out))
      const o = s.osc('sine', s.r(4300, 4800), t, null)
      const st = new GrainStream(s, o, lvl, { chunk: 0.05, tail: 0.12 })
      const res = st.res
      st.regular = 0.95
      st.jitter = 0.04
      st.ampVar = 0.15
      st.shape = (w, i0, a) => {
        // three 18ms pulses, 30ms apart
        const pl = Math.round(0.018 / res)
        for (let j = 0; j < 3; j++) {
          const s0 = Math.floor(i0 + (j * 0.03) / res)
          for (let k = 0; k < pl; k++) {
            const idx = s0 + k
            if (idx >= w.length) return
            w[idx] += a * Math.sin((Math.PI * k) / pl)
          }
        }
      }
      st.amp = 1
      streams.push(st)
      levels.push(lvl)
    }
    const apply = (at: number, tau: number): void => {
      for (let i = 0; i < levels.length; i++) to(levels[i].gain, i < p.count ? 0.07 : 0, at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.2)
      },
      tick(from, until) {
        const perMin = Math.max(5, 4 * (p.tempF - 50) + 40)
        for (let i = 0; i < streams.length; i++) {
          streams[i].rate = (perMin / 60) * (1 + 0.03 * i)
          streams[i].fill(from, until)
        }
      },
    }
  },
}

const cicadas: LoopDef = {
  kind: 'loop',
  id: 'yard.cicadas',
  label: 'Cicadas',
  group: YARD,
  games: ['studio', 'lensbench'],
  desc: 'Hot-afternoon bed: band-passed noise pulsed at ~70 Hz inside slow 3-8 s swells.',
  params: { intensity: { min: 0, max: 1, default: 0.5, step: 0.01 } },
  preview: { dur: 6, auto: () => ({ intensity: 1 }) },
  start(s, out, t, p) {
    const master = s.gain(0, out)
    const n = s.quality ? 2 : 1
    const swells: GainNode[] = []
    const nexts: number[] = []
    for (let v = 0; v < n; v++) {
      const sw = s.gain(0, s.panner(v ? 0.5 : -0.4, master))
      const am = s.gain(0.5, sw)
      const lfo = s.osc('sine', 70 * s.r(0.95, 1.05), t, null)
      const d = s.gain(0.5)
      lfo.connect(d)
      d.connect(am.gain)
      s.noise('white', t, null, s.filter('bandpass', v ? 5600 : 5000, 4, am))
      swells.push(sw)
      nexts.push(t + s.r(0, 2))
    }
    const apply = (at: number, tau: number): void => to(master.gain, clamp01(p.intensity), at, tau)
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.3)
      },
      tick(from, until) {
        for (let v = 0; v < swells.length; v++) {
          if (nexts[v] < from) nexts[v] = from
          while (nexts[v] < until) {
            const ts = nexts[v]
            const rise = s.r(1, 2)
            const sus = s.r(1, 5)
            swells[v].gain.setTargetAtTime(0.5 * s.r(0.6, 1), ts, rise / 3)
            swells[v].gain.setTargetAtTime(0, ts + rise + sus, 0.7)
            nexts[v] = ts + rise + sus + 2 + s.r(2, 6)
          }
        }
      },
    }
  },
}

const TUBES = [1046.5, 1174.7, 1318.5, 1568, 1760]

const chimes: LoopDef = {
  kind: 'loop',
  id: 'yard.chimes',
  label: 'Wind chimes',
  group: YARD,
  games: ['studio'],
  desc: 'Pentatonic free-free tubes (1 : 2.756 : 5.404 : 8.933). Feed `wind` from yard.wind.get("gust").',
  params: { wind: { min: 0, max: 1, default: 0.4, step: 0.01 } },
  preview: { dur: 5, auto: () => ({ wind: 0.7 }) },
  start(s, out, t, p) {
    const pans = TUBES.map((_, i) => s.panner(-0.5 + i * 0.25, out))
    let next = t
    return {
      set() {},
      tick(from, until) {
        const w = clamp01(p.wind)
        const rate = 0.1 + 5 * w * w
        if (next < from) next = from + s.r(0, 1 / rate)
        while (next < until) {
          const i = Math.floor(s.rand() * TUBES.length) % TUBES.length
          const str = s.r(0.3, 1) * (0.4 + 0.6 * w)
          const ds = 0.6 + 0.4 * str
          s.modal({
            t: next,
            out: pans[i],
            f: TUBES[i],
            ratios: [1, 2.756, 5.404, 8.933],
            gains: [1, 0.45, 0.25, 0.12],
            decays: [2.5 * ds, 1.2 * ds, 0.6 * ds, 0.3 * ds],
            amp: 0.06 * str,
          })
          next += -Math.log(1 - s.rand() * 0.999) / rate
        }
      },
    }
  },
}

export const ambience: SoundDef[] = [roomTone, wind, birds, sprinkler, crickets, cicadas, chimes]

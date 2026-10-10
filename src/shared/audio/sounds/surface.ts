// Surfaces and contact: material impacts (modal), the rolling marble, cloth rustle.
// Built for Texturedle's probes, reused by the Studio and the darkroom benches.
import type { LoopDef, OneShotDef, SoundDef } from '../types'
import { type Synth, clamp01, lerp, to } from '../synth'

const G = 'Surface & touch'

interface Material {
  f: number
  ratios: number[]
  gains: number[]
  decays: number[]
  click: number
  thud: number
}

/** Modal tables. Decays are T(-80 dB) in seconds at full force. */
export const MATERIALS: Record<string, Material> = {
  glass: { f: 2100, ratios: [1, 2.76, 5.4, 8.93], gains: [1, 0.5, 0.3, 0.15], decays: [0.4, 0.2, 0.12, 0.07], click: 0.4, thud: 0 },
  steel: { f: 3100, ratios: [1, 2.32, 4.25, 6.63], gains: [1, 0.6, 0.4, 0.25], decays: [0.7, 0.45, 0.3, 0.2], click: 0.35, thud: 0.1 },
  wood: { f: 820, ratios: [1, 2.57, 4.2], gains: [1, 0.5, 0.3], decays: [0.05, 0.03, 0.02], click: 0.25, thud: 0.3 },
  enamel: { f: 180, ratios: [1, 2.61, 6.7], gains: [1, 0.8, 0.3], decays: [0.15, 0.09, 0.05], click: 0.2, thud: 0.4 },
  ceramic: { f: 1500, ratios: [1, 2.31, 3.9, 5.6], gains: [1, 0.5, 0.35, 0.2], decays: [0.12, 0.08, 0.05, 0.04], click: 0.35, thud: 0.15 },
  tin: { f: 640, ratios: [1, 1.58, 2.37, 3.9, 5.1], gains: [1, 0.8, 0.6, 0.35, 0.2], decays: [0.25, 0.2, 0.14, 0.09, 0.06], click: 0.3, thud: 0.2 },
  cloth: { f: 0, ratios: [], gains: [], decays: [], click: 0.05, thud: 0.5 },
}
const MAT_NAMES = ['glass', 'steel', 'wood', 'enamel', 'ceramic', 'tin', 'cloth']

/** Generic struck-object sound. force 0..1, size 0..1 (bigger = lower). */
export function strike(s: Synth, out: AudioNode, t: number, m: Material, force: number, size: number, k = 1): number {
  const F = clamp01(force)
  const pitch = (1.5 - size) * k
  let end = t
  if (m.click > 0) end = s.burst({ t, out, type: 'highpass', f: 2500 * Math.min(1.4, pitch), gain: m.click * Math.pow(F, 1.2), attack: 0.0002, decay: 0.003 })
  if (m.thud > 0) {
    end = Math.max(end, s.burst({ t, out, color: 'brown', type: 'lowpass', f: 500 * pitch, gain: m.thud * F, attack: 0.001, decay: 0.05 }))
    end = Math.max(end, s.tone({ t, out, f: 110 * pitch, gain: 0.5 * m.thud * F, attack: 0.002, decay: 0.05 }))
  }
  if (m.f > 0) {
    const dscale = 0.6 + 0.4 * F
    end = Math.max(end, s.modal({ t, out, f: m.f * pitch, ratios: m.ratios, gains: m.gains, decays: m.decays.map((d) => d * dscale), amp: 0.12 * Math.pow(F, 1.2) }))
  }
  return end
}

const impact: OneShotDef = {
  kind: 'oneshot',
  id: 'impact',
  label: 'Impact / knock',
  group: G,
  games: ['texturedle', 'darkroom', 'plates', 'latent', 'lensbench', 'studio'],
  desc: 'Anything struck or set down: tongs on a tray (enamel), glass plates, wood, metal, a tin mailbox. Modal synthesis.',
  params: {
    material: { min: 0, max: MAT_NAMES.length - 1, default: 0, step: 1, options: MAT_NAMES },
    force: { min: 0, max: 1, default: 0.6, step: 0.01 },
    size: { min: 0, max: 1, default: 0.5, step: 0.01 },
  },
  vary: { pitch: 0.04, gain: 1.5 },
  maxVoices: 8,
  play(s, out, t, p) {
    const m = MATERIALS[MAT_NAMES[Math.round(p.material)] ?? 'glass']
    return strike(s, out, t, m, p.force, p.size, p.k)
  },
}

const SURF = ['glass', 'tin', 'wood', 'cloth']

const clack: OneShotDef = {
  kind: 'oneshot',
  id: 'marble.clack',
  label: 'Marble clack',
  group: G,
  games: ['texturedle', 'studio'],
  desc: 'A glass marble hitting something: a sharp click and a high ping, plus the surface answering.',
  params: {
    velocity: { min: 0, max: 1, default: 0.6, step: 0.01 },
    surface: { min: 0, max: SURF.length - 1, default: 1, step: 1, options: SURF },
  },
  vary: { pitch: 0.05, gain: 1.5 },
  maxVoices: 6,
  minInterval: 0.015,
  play(s, out, t, p) {
    const v = clamp01(p.velocity)
    const surf = SURF[Math.round(p.surface)] ?? 'glass'
    const soft = surf === 'cloth'
    let end = s.burst({ t, out, type: 'highpass', f: soft ? 1200 : 2500, gain: (soft ? 0.12 : 0.5) * v, attack: 0.0002, decay: soft ? 0.004 : 0.002 })
    if (!soft) {
      end = Math.max(end, s.tone({ t, out, f: 5800 * p.k, gain: 0.05 * v, decay: 0.03 }))
      end = Math.max(end, s.tone({ t, out, f: 9300 * p.k, gain: 0.03 * v, decay: 0.015 }))
    }
    if (surf === 'glass') end = Math.max(end, s.tone({ t, out, f: 4200 * p.k, gain: 0.06 * v, decay: 0.05 }))
    else end = Math.max(end, strike(s, out, t, MATERIALS[surf], v * 0.8, 0.5, p.k))
    return end
  },
}

const roll: LoopDef = {
  kind: 'loop',
  id: 'marble.roll',
  label: 'Marble rolling',
  group: G,
  games: ['texturedle', 'studio'],
  desc: 'Continuous. speed 0..1, roughness drives micro-impacts, hardness brightens, hollow adds a sheet-metal box resonance (rusty mailbox), contact=0 when airborne.',
  params: {
    speed: { min: 0, max: 1, default: 0.5, step: 0.01 },
    roughness: { min: 0, max: 1, default: 0.4, step: 0.01 },
    hardness: { min: 0, max: 1, default: 0.8, step: 0.01 },
    hollow: { min: 0, max: 1, default: 0.6, step: 0.01, label: 'hollow (tin box)' },
    contact: { min: 0, max: 1, default: 1, step: 0.01 },
  },
  preview: { dur: 4, auto: (t, d) => ({ speed: Math.sin((Math.PI * t) / d), roughness: t > d / 2 ? 0.8 : 0.2 }) },
  start(s, out, t, p) {
    const dry = s.gain(1, out)
    // body for the hollow resonance
    const hollowG = s.gain(0, out)
    const res = [420, 1130, 1870]
    const resQ = [18, 22, 25]
    const resIn = s.gain(1)
    if (s.quality) for (let i = 0; i < res.length; i++) resIn.connect(s.filter('bandpass', res[i], resQ[i], hollowG))
    const rumble = s.gain(0, dry)
    rumble.connect(resIn)
    // rotation wobble: tiny out-of-roundness modulates the contact at the spin rate
    const wob = s.gain(1, rumble)
    const spin = s.osc('sine', 5, t, null)
    const wobDepth = s.gain(0.25)
    spin.connect(wobDepth)
    wobDepth.connect(wob.gain)
    const lp = s.filter('lowpass', 400, 0.9, wob)
    s.noise('brown', t, null, lp)
    const whirr = s.gain(0, dry)
    const bp = s.filter('bandpass', 2000, 0.7, whirr)
    s.noise('white', t, null, bp)
    const bumpsLvl = s.gain(0, dry)
    bumpsLvl.connect(resIn)
    const bbp = s.filter('bandpass', 3000, 1)
    s.noise('white', t, null, bbp)
    const st = s.stream(bbp, bumpsLvl)
    st.ampVar = 0.8
    const apply = (at: number, tau: number): void => {
      const v = clamp01(p.speed)
      const h = clamp01(p.hardness)
      const c = clamp01(p.contact)
      to(lp.frequency, 120 + 900 * v * (0.3 + 0.7 * h), at, tau)
      to(rumble.gain, 0.3 * Math.pow(v, 1.2) * c * (0.6 + 0.4 * (1 - h)), at, tau)
      to(bp.frequency, 1200 + 3800 * v * h + 1500 * clamp01(p.roughness), at, tau)
      to(spin.frequency, 3 + 30 * v, at, tau)
      to(whirr.gain, 0.1 * Math.pow(v, 1.6) * h * c, at, tau)
      to(bbp.frequency, 1500 + 2500 * h, at, tau)
      to(bumpsLvl.gain, c * Math.sqrt(v), at, tau)
      to(hollowG.gain, 3 * clamp01(p.hollow), at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.03)
      },
      tick(from, until) {
        const v = clamp01(p.speed)
        const r = clamp01(p.roughness)
        const h = clamp01(p.hardness)
        st.rate = v > 0.01 ? v * (4 + 280 * Math.pow(r, 1.5)) * (s.quality ? 1 : 0.5) : 0
        st.amp = 0.28 * Math.pow(r, 0.7) + 0.03
        st.decay = 0.003 + 0.006 * (1 - h)
        st.fill(from, until)
      },
    }
  },
}

const cloth: LoopDef = {
  kind: 'loop',
  id: 'cloth.rustle',
  label: 'Cloth rustle',
  group: G,
  games: ['texturedle', 'studio', 'lensbench'],
  desc: 'Drag speed 0..1. roughness 0 = fine microfibre (smooth high hiss), 1 = rough canvas/burlap (crackle + low swish).',
  params: {
    speed: { min: 0, max: 1, default: 0.5, step: 0.01 },
    roughness: { min: 0, max: 1, default: 0.3, step: 0.01 },
  },
  preview: { dur: 4, auto: (t, d) => ({ speed: Math.abs(Math.sin((2 * Math.PI * t) / d)), roughness: t > d / 2 ? 0.85 : 0.15 }) },
  start(s, out, t, p) {
    const hiss = s.gain(0, out)
    const hbp = s.filter('bandpass', 5000, 0.6, hiss)
    s.noise('white', t, null, hbp)
    const swish = s.gain(0, out)
    const slp = s.filter('lowpass', 800, 0.7, swish)
    if (s.quality) s.noise('pink', t, null, slp)
    const cbp = s.filter('bandpass', 3500, 0.8)
    s.noise('white', t, null, cbp)
    const cl = s.gain(1, out)
    const st = s.stream(cbp, cl)
    st.ampVar = 0.9
    const apply = (at: number, tau: number): void => {
      const v = clamp01(p.speed)
      const r = clamp01(p.roughness)
      to(hbp.frequency, 6500 - 4000 * r, at, tau)
      to(hiss.gain, 0.12 * Math.pow(v, 1.3) * (1.2 - 0.6 * r), at, tau)
      to(slp.frequency, 500 + 1500 * v, at, tau)
      to(swish.gain, 0.2 * Math.pow(v, 1.5) * (0.3 + r), at, tau)
      to(cbp.frequency, 2800 + 1500 * (1 - r), at, tau)
    }
    apply(t, 0)
    return {
      set(_n, _v, at) {
        apply(at, 0.03)
      },
      tick(from, until) {
        const v = clamp01(p.speed)
        const r = clamp01(p.roughness)
        st.rate = v > 0.01 ? v * (40 + 600 * r) * (s.quality ? 1 : 0.5) : 0
        st.amp = 0.06 + 0.14 * r
        st.decay = lerp(0.0015, 0.0045, r)
        st.fill(from, until)
      },
    }
  },
}

export const surface: SoundDef[] = [impact, clack, roll, cloth]

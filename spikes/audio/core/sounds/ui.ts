// The shared UI palette, implemented to the recipes in docs/design/art-direction.md §10.2.
// All on the `ui` bus, all short and quiet. Ids: ui.<name>.
import type { OneShotDef } from '../types'

const G = 'UI palette'
const ALL: OneShotDef['games'] = ['hub', 'texturedle', 'darkroom', 'plates', 'latent', 'lensbench', 'studio']
const VARY = { pitch: 0.04, gain: 1.5 }

export const ui: OneShotDef[] = [
  {
    kind: 'oneshot',
    id: 'ui.tick',
    label: 'Tick',
    group: G,
    games: ALL,
    desc: 'Hover/focus on a frame or menu item, slider detents.',
    bus: 'ui',
    vary: VARY,
    minInterval: 0.045,
    maxVoices: 3,
    play(s, out, t, p) {
      return s.burst({ t, out, f: 3500 * p.k, q: 1.2, gain: 0.08, attack: 0.0005, decay: 0.006 })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.hover',
    label: 'Hover',
    group: G,
    games: ALL,
    desc: 'A softer, airier tick for pointer hover.',
    bus: 'ui',
    vary: VARY,
    minInterval: 0.06,
    maxVoices: 2,
    play(s, out, t, p) {
      return s.burst({ t, out, f: 4600 * p.k, q: 0.9, gain: 0.045, attack: 0.001, decay: 0.012 })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.click',
    label: 'Click',
    group: G,
    games: ALL,
    desc: 'Secondary buttons: a small plastic click.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 3,
    play(s, out, t, p) {
      const a = s.burst({ t, out, f: 2600 * p.k, q: 2, gain: 0.18, attack: 0.0004, decay: 0.008 })
      const b = s.tone({ t, out, f: 520 * p.k, gain: 0.07, attack: 0.0005, decay: 0.02 })
      return Math.max(a, b)
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.shutter',
    label: 'Shutter (UI)',
    group: G,
    games: ALL,
    desc: 'Primary button press, opening a game. A focal-plane ka-chick.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 3,
    play(s, out, t, p) {
      s.burst({ t, out, type: 'highpass', f: 2000 * p.k, gain: 0.35, attack: 0.0005, hold: 0.002, decay: 0.01 })
      const tb = t + 0.038
      const a = s.burst({ t: tb, out, f: 900 * p.k, q: 0.8, gain: 0.25, attack: 0.0005, hold: 0.002, decay: 0.016 })
      const b = s.tone({ t: tb, out, f: 140 * p.k, gain: 0.2, attack: 0.001, decay: 0.04 })
      return Math.max(a, b)
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.advance',
    label: 'Advance',
    group: G,
    games: ALL,
    desc: 'Back to contact sheet, next/previous: a 4-click film-advance ratchet.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      const fs = [2400, 2250, 2100, 1950]
      let end = t
      for (let n = 0; n < 4; n++)
        end = s.burst({ t: t + n * 0.024, out, f: fs[n] * p.k, q: 3, gain: 0.15 * Math.pow(0.8, n), decay: 0.005 })
      return end
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.switch',
    label: 'Switch',
    group: G,
    games: ALL,
    desc: 'Toggles: sound, lights, switches.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      s.burst({ t, out, type: 'highpass', f: 3000 * p.k, gain: 0.2, decay: 0.004 })
      return s.tone({ t, out, f: 90 * p.k, gain: 0.15, attack: 0.001, decay: 0.025 })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.paper',
    label: 'Paper in',
    group: G,
    games: ALL,
    desc: 'Dialog or panel open.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      return paperSweep(s, out, t, 0.22, 1200 * p.k, 3200 * p.k)
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.paperOut',
    label: 'Paper out',
    group: G,
    games: ALL,
    desc: 'Dialog or panel close.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      return paperSweep(s, out, t, 0.16, 3200 * p.k, 1400 * p.k)
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.canister',
    label: 'Canister',
    group: G,
    games: ALL,
    desc: 'Save: the pop of a film-can lid.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      s.burst({ t, out, type: 'highpass', f: 4000, gain: 0.12, decay: 0.003 })
      return s.tone({ t, out, f: 220 * p.k, f2: 110 * p.k, glide: 0.05, gain: 0.25, attack: 0.001, decay: 0.07 })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.bell',
    label: 'Bell',
    group: G,
    games: ALL,
    desc: 'Success: the darkroom timer bell (E6, free-bar partials).',
    bus: 'ui',
    vary: { pitch: 0.01, gain: 1 },
    maxVoices: 2,
    play(s, out, t, p) {
      return s.modal({ t, out, f: 1318.5 * p.k, ratios: [1, 2.76, 5.4], gains: [0.22, 0.09, 0.04], decays: [0.9, 0.4, 0.2] })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.thunk',
    label: 'Thunk',
    group: G,
    games: ALL,
    desc: 'Error or not allowed.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      const lp = s.filter('lowpass', 600, 0.707, out)
      s.tone({ t, out: lp, f: 110 * p.k, gain: 0.2, attack: 0.002, decay: 0.08 })
      return s.tone({ t: t + 0.09, out: lp, f: 98 * p.k, gain: 0.18, attack: 0.002, decay: 0.08 })
    },
  },
  {
    kind: 'oneshot',
    id: 'ui.develop',
    label: 'Develop',
    group: G,
    games: ALL,
    desc: 'Hub frame activation, image reveal: a gentle tray slosh.',
    bus: 'ui',
    vary: VARY,
    maxVoices: 2,
    play(s, out, t, p) {
      const trem = s.gain(1, out)
      const lfo = s.osc('sine', 3, t, t + 0.55)
      const depth = s.gain(0.3)
      lfo.connect(depth)
      depth.connect(trem.gain)
      const env = s.gain(0, trem)
      s.shape(env.gain, t, [
        [0, 0],
        [0.12, 0.05],
        [0.5, 0],
      ])
      const lp = s.filter('lowpass', 400 * p.k, 0.9, env)
      lp.frequency.setValueAtTime(400 * p.k, t)
      lp.frequency.exponentialRampToValueAtTime(1800 * p.k, t + 0.5)
      s.noise('white', t, t + 0.52, lp)
      return t + 0.52
    },
  },
]

function paperSweep(s: import('../synth').Synth, out: AudioNode, t: number, dur: number, f1: number, f2: number): number {
  const g = s.gain(0, out)
  s.shape(g.gain, t, [
    [0, 0],
    [0.04, 0.07],
    [dur * 0.6, 0.07],
    [dur, 0],
  ])
  const bp = s.filter('bandpass', f1, 0.6, g)
  bp.frequency.setValueAtTime(f1, t)
  bp.frequency.linearRampToValueAtTime(f2, t + dur)
  s.noise('white', t, t + dur + 0.01, bp)
  return t + dur
}

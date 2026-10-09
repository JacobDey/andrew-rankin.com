// Demo scenes: compositions used by the demo page and by the offline CPU benchmark.
import type { Scene } from './core/analysis'
import { ALL_SOUNDS } from './core/sounds'

export const SCENES: Scene[] = [
  {
    name: 'Darkroom at night',
    loops: [
      { id: 'room.tone', params: { fan: 0.4 } },
      { id: 'safelight.buzz' },
      { id: 'enlarger.hum', params: { lamp: 0, fan: 0.3 } },
      { id: 'timer.clock', params: { level: 0.5 } },
      { id: 'liquid.slosh', params: { energy: 0.25 } },
    ],
    events: [
      { id: 'liquid.drip', every: [3, 9] },
      { id: 'paper.flop', every: [8, 15] },
      { id: 'liquid.lap', every: [2, 5], params: { intensity: 0.4 } },
    ],
  },
  {
    name: 'Backyard, noon',
    loops: [
      { id: 'yard.wind', params: { strength: 0.4 } },
      { id: 'yard.birds', params: { density: 0.6 } },
      { id: 'yard.cicadas', params: { intensity: 0.4 } },
      { id: 'yard.sprinkler', params: { pressure: 0.6 } },
      { id: 'yard.chimes', params: { wind: 0.35 } },
    ],
    events: [
      { id: 'shutter.leaf', every: [5, 9], params: { speed: 1 / 250 } },
      { id: 'film.advance', every: [6, 10] },
    ],
  },
  {
    name: 'Backyard, night',
    loops: [
      { id: 'yard.crickets', params: { tempF: 68 } },
      { id: 'yard.wind', params: { strength: 0.2, gustiness: 0.3 } },
    ],
    events: [{ id: 'shutter.focal', every: [8, 14], params: { speed: 1 } }],
  },
  {
    name: 'Precinct, 1994',
    loops: [
      { id: 'room.tone', params: { rumble: 0.7, hum: 0.6 } },
      { id: 'crt.whine', params: { level: 0.6 } },
    ],
    events: [
      { id: 'kbd.key', every: [0.08, 0.3] },
      { id: 'terminal.seek', every: [3, 7] },
      { id: 'terminal.beep', every: [5, 10] },
      { id: 'radio.chatter', every: [7, 14] },
    ],
  },
  {
    name: 'Lighthouse storm',
    loops: [
      { id: 'sea.waves', params: { swell: 0.9, distance: 0.35 } },
      { id: 'ship.hull', params: { roll: 0.8 } },
      { id: 'yard.wind', params: { strength: 0.8, gustiness: 0.8 } },
      { id: 'timer.clock', params: { rate: 4, pitch: 1.6, level: 0.35 } },
    ],
    events: [
      { id: 'bell.fog', every: [16, 22] },
      { id: 'sea.wavehit', every: [7, 15] },
    ],
  },
  {
    name: 'Texture bench',
    loops: [
      { id: 'marble.roll', params: { speed: 0.5 } },
      { id: 'cloth.rustle', params: { speed: 0.3 } },
    ],
    events: [{ id: 'marble.clack', every: [1, 3] }],
  },
]

/** Worst case for the benchmark: every loop at once plus every one-shot every 0.5-3 s. */
export const STRESS: Scene = {
  name: 'Everything at once',
  loops: ALL_SOUNDS.filter((d) => d.kind === 'loop').map((d) => ({ id: d.id })),
  events: ALL_SOUNDS.filter((d) => d.kind === 'oneshot').map((d) => ({ id: d.id, every: [0.5, 3] as [number, number] })),
}

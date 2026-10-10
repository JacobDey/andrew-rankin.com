// games/plates/audio/sfx.ts — event → sound wiring (GDD §7.4). The voices live in games/plates/sounds.ts
// (shared-audio); unknown ids are a silent no-op, and nothing sounds before a gesture or with ?test=1.
import { Audio, haptic, type LoopHandle } from '@shared/audio'
import { registerSounds } from '../sounds'
import type { Bus, PlateId } from '../contracts'

export interface PlatesAudio { update(dt: number, slosh: number, flame: number): void; chord(notes: number[]): void; chordSequence(lists: number[][], gapMs?: number): void; start(): void }

export function createAudio(bus: Bus, meta: (id: PlateId) => { chord: number[] }): PlatesAudio {
  registerSounds()
  let sea: LoopHandle | null = null, slosh: LoopHandle | null = null, flame: LoopHandle | null = null
  let smooth = 0
  const play = (id: string, p: Record<string, number> = {}) => { try { Audio.play(`plates.${id}`, p) } catch (e) { console.debug('[plates] sfx', id, e) } }
  bus.on('sfx', (e) => {
    const p: Record<string, number> = {}
    if (e.gain !== undefined) { p.gain = e.gain; p.speed = e.gain }
    if (e.data !== undefined) p.r = e.data
    play(e.name, p)
    if (e.name === 'clack') haptic(8)
    if (e.name === 'snap') haptic(12)
    if (e.name === 'stamp') haptic([20, 30, 20])
  })
  bus.on('wave', (e) => { play('wave', { strength: e.strength }); if (e.strength > 1.2) haptic(30) })
  bus.on('plateFixed', (e) => a.chord(meta(e.id).chord))
  bus.on('pin', () => play('pin'))
  bus.on('restore', () => play('restore'))
  const a: PlatesAudio = {
    start() {
      try {
        if (!sea) sea = Audio.loop('plates.sea', {}, { fadeIn: 2 })
        if (!slosh) slosh = Audio.loop('plates.slosh', { energy: 0 })
        if (!flame) flame = Audio.loop('plates.flame', {}, { volume: 0.5 })
      } catch (e) { console.debug('[plates] loops', e) }
    },
    update(dt, s, f) {
      smooth += (s - smooth) * (1 - Math.exp(-dt / 0.06))
      slosh?.set('energy', smooth)
      flame?.set('level', f)
    },
    chord(notes) { const n = [...notes, 0, 0, 0, 0, 0]; play('fixChord', { n0: n[0], n1: n[1], n2: n[2], n3: n[3], n4: n[4] }) },
    chordSequence(lists, gapMs = 2600) { lists.forEach((l, i) => setTimeout(() => a.chord(l), i * gapMs)) },
  }
  return a
}

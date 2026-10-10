// sfx facade (lensbench.md §11.2, §7.3). Every method is a safe no-op until unlock().
// Plays the Appendix B `lensbench.*` ids when registered, else the generic library equivalents.
import { Audio, uiSound, haptic, type LoopHandle } from '@shared/audio'
import type { Place, ShutterId } from '../core/types'

let unlocked = false
let muted = false
let hapticsOn = true
let bed: LoopHandle | null = null
let rubLoop: LoopHandle | null = null
let lastDetent = 0

function play(id: string, params: Record<string, number> = {}, fallback?: [string, Record<string, number>?]): void {
  if (!unlocked || muted) return
  try {
    if (Audio.has(id)) Audio.play(id, params)
    else if (fallback && Audio.has(fallback[0])) Audio.play(fallback[0], fallback[1] ?? {})
  } catch { /* audio never throws into the game */ }
}
function buzz(ms: number | number[]) { if (hapticsOn) try { haptic(ms) } catch { /* ignore */ } }

export const sfx = {
  unlock(): void { unlocked = true },
  mute(on: boolean): void { muted = on; if (on) { bed?.stop(); bed = null; rubLoop?.stop(); rubLoop = null } },
  haptics(on: boolean): void { hapticsOn = on },
  shutter(k: ShutterId, t: number, mirror: boolean): void {
    buzz(20)
    if (k === 'cap') return play('lensbench.cap', { open: 1 }, ['film.click'])
    if (k === 'leaf' || k === 'tricolour') return play('lensbench.leaf', { t }, ['shutter.leaf', { speed: Math.max(1 / 500, Math.min(4, t)) }])
    if (k === 'clothFP') return play('lensbench.cloth-fp', { t }, ['shutter.focal', { speed: Math.max(1 / 4000, Math.min(4, t)), mirror: 0, curtain: 0, travel: 0.018 }])
    if (k === 'metalFP') return play('lensbench.metal-fp', { t, mirror: mirror ? 1 : 0 }, ['shutter.focal', { speed: Math.max(1 / 4000, Math.min(4, t)), mirror: mirror ? 1 : 0, curtain: 1, travel: 0.0065 }])
    if (k === 'rollerFP') return play('lensbench.roller', { tc: 0.12 }, ['shutter.focal', { speed: Math.max(1 / 4000, Math.min(4, t)), mirror: 0, curtain: 0, travel: 0.025 }])
  },
  capClose(): void { play('lensbench.cap', { open: 0 }, ['film.click']) },
  advance(): void { play('lensbench.advance', {}, ['film.advance']) },
  rewind(): void { play('lensbench.rewind', {}, ['film.rewind']) },
  detent(): void {
    const now = performance.now()
    if (now - lastDetent < 25) return
    lastDetent = now
    buzz(8)
    play('lensbench.detent', {}, ['aperture.detent'])
  },
  rub(vel: number): void {
    if (!unlocked || muted) return
    try {
      if (!rubLoop && vel > 0.02 && Audio.has('lensbench.rub')) rubLoop = Audio.loop('lensbench.rub', { vel })
      rubLoop?.set('vel', Math.max(0, Math.min(1, vel)))
      if (rubLoop && vel <= 0.001) { rubLoop.stop(); rubLoop = null }
    } catch { /* ignore */ }
  },
  clink(v: number): void { play('lensbench.clink', { v }, ['ui.tick']) },
  creak(c: number): void { play('lensbench.creak', { c }, ['focus.ring']) },
  ping(f0: number): void { play('lensbench.ping', { f0 }) },
  needle(): void { play('lensbench.needle', {}, ['ui.tick']) },
  chime(): void { play('lensbench.chime', {}, ['ui.bell']) },
  pour(): void { play('lensbench.pour', {}, ['ui.develop']) },
  glug(): void { play('lensbench.glug', {}, ['ui.thunk']) },
  tick(): void { play('lensbench.tick', {}, ['ui.tick']) },
  bell(): void { play('lensbench.bell', {}, ['ui.bell']) },
  stamp(): void { buzz([30, 40, 30]); play('lensbench.stamp', {}, ['ui.thunk']) },
  tock(): void { play('lensbench.clink', { v: 0.6 }, ['ui.tick']) },
  place(p: Place): void {
    if (!unlocked || muted) return
    try { uiSound(p === 'street' ? 'advance' : 'paper') } catch { /* ignore */ }
  },
  streetBed(w: number, fountainGain: number): void {
    if (!unlocked || muted) return
    try {
      if (!bed) {
        if (Audio.has('lensbench.street')) bed = Audio.loop('lensbench.street', { wind: w, fountain: fountainGain })
        else if (Audio.has('yard.wind')) bed = Audio.loop('yard.wind', { strength: w * 0.6, gustiness: 0.4 })
      }
      if (bed?.id === 'lensbench.street') bed.setMany({ wind: w, fountain: fountainGain })
      else bed?.set('strength', w * 0.6)
    } catch { /* ignore */ }
  },
  stopBed(): void { try { bed?.stop() } catch { /* ignore */ } bed = null },
  muffle(on: boolean): void { try { Audio.setMuffle(on ? 600 : null) } catch { /* ignore */ } },
}

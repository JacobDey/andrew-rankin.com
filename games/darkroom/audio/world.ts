// World audio wiring (darkroom.md §7.3): events → Audio.play ids (Appendix B).
// When @shared/audio isn't loaded, a few key sounds come from ./voices.
import type { DarkroomBus } from '../events'
import { flags, type Platform, type VoiceLite } from '../glue/platform'
import type { TrayId, WorldRead } from '../types'
import { localVoices } from './voices'

export function wireAudio(platform: Platform, bus: DarkroomBus, world: WorldRead): void {
  const A = platform.audio
  const F = flags()
  const quiet = F.test || F.embed === 'poster' || F.muted
  const local = !A.real && !quiet ? localVoices() : null
  const play = (id: string, p?: Record<string, number>) => { if (A.real) A.play(id, p); else local?.play(id, p) }
  const loops = new Map<string, VoiceLite | null>()
  const loop = (key: string, id: string, on: boolean, p?: Record<string, number>) => {
    const cur = loops.get(key)
    if (on && !cur) loops.set(key, A.real ? A.loop(id, p) : local?.loop(id, p) ?? null)
    else if (!on && cur) { cur.stop?.(); loops.delete(key) }
    else if (on && cur && p) cur.set?.(p)
  }
  bus.on('chain', () => play('darkroom.pull-chain', { beads: 7 }))
  bus.on('guard', () => { play('darkroom.guard'); A.haptic(8) })
  bus.on('light', (e) => {
    if (e.id === 'safe') { if (e.on) play('darkroom.safelight-on'); loop('safe', 'darkroom.safelight-hum', e.on) }
    if (e.id === 'room') { play('darkroom.switch'); if (e.on) play('darkroom.fluorescent-start'); loop('room', 'darkroom.fluorescent-hum', e.on); A.haptic(8) }
  })
  bus.on('trayLand', (e) => { play('darkroom.tray-land', { speed: e.speed }); A.haptic(8) })
  const sloshE: Partial<Record<TrayId, number>> = {}
  bus.on('slosh', (e) => {
    const energy = Math.min(1, e.kinetic / 0.006)
    const prev = sloshE[e.tray] ?? 0
    sloshE[e.tray] = energy
    loop('slosh:' + e.tray, 'darkroom.slosh', energy > 0.01, { energy })
    if (e.impact > 0.002 && prev < energy) play('darkroom.lap', { intensity: Math.min(1, e.impact / 0.02) })
  })
  bus.on('drip', (e) => play('darkroom.drip', { intoLiquid: e.intoTray ? 1 : 0 }))
  bus.on('paperGrab', () => play('darkroom.paper-grab'))
  bus.on('paperDrop', (e) => { if (e.place.at === 'tray') { play('darkroom.paper-dunk'); A.haptic(15) } })
  bus.on('dunk', () => play('darkroom.paper-dunk'))
  bus.on('timerTick', () => play('darkroom.timer-tick'))
  bus.on('timerBell', () => play('darkroom.timer-bell'))
  bus.on('exposure', (e) => { if (e.on) play('darkroom.enlarger-on'); loop('fan', 'darkroom.enlarger-fan', e.on) })
  bus.on('pour', (e) => play('darkroom.pour', { rate: e.rate, fill: 0.5 }))
  bus.on('dryer', (e) => loop('dryer', 'darkroom.hairdryer', e.on))
  bus.on('uv', (e) => loop('uv', 'darkroom.uv-hum', e.on))
  bus.on('tap', (e) => loop('tap', 'darkroom.tap', e.on))
  bus.on('peroxide', () => play('darkroom.drip', { intoLiquid: 1 }))
  bus.on('bloom', () => play('darkroom.bloom'))
  bus.on('discover', () => play('darkroom.pencil'))
  bus.on('fog', () => {})
  void world
}

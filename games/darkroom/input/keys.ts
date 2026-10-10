// Keyboard (darkroom.md §4.2).
import { GRADES } from '../constants'
import type { Platform } from '../glue/platform'
import { STATIONS } from '../layout'
import type { WorldX } from '../sim/world'
import type { Grade, View } from '../types'
import type { Hud } from '../ui/hud'
import type { Logbook } from '../ui/logbook'
import type { Persist } from '../save/persist'
import type { Input } from './pointer'

const DEG = Math.PI / 180

export function bindKeys(o: { world: WorldX; view: View; hud: Hud; input: Input; platform: Platform; logbook: Logbook; persist: Persist }): void {
  const { world, hud, platform } = o
  const W = world.cmd
  const tiltKeys = new Set<string>()
  const applyTilt = () => {
    const t = hud.activeTray()
    if (!tiltKeys.size) { W.releaseTray(t); return }
    const k = 6 * DEG
    const tx = (tiltKeys.has('KeyD') ? k : 0) - (tiltKeys.has('KeyA') ? k : 0)
    const ty = (tiltKeys.has('KeyS') ? k : 0) - (tiltKeys.has('KeyW') ? k : 0)
    W.holdTray(t, tx, ty)
  }
  addEventListener('keydown', (e) => {
    if (platform.shouldIgnoreKey(e)) return
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); void o.persist.pin(world, o.view).then((s) => s && hud.toast('Saved to the drawer.')); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const c = e.code
    if (c === 'ArrowLeft') { hud.nextStation(-1); e.preventDefault() }
    else if (c === 'ArrowRight') { hud.nextStation(1); e.preventDefault() }
    else if (/^Digit[1-6]$/.test(c)) hud.setStation(STATIONS[Number(c.slice(5)) - 1].id)
    else if (c === 'KeyW' || c === 'KeyA' || c === 'KeyS' || c === 'KeyD') { if (!e.repeat) { tiltKeys.add(c); applyTilt() } }
    else if (c === 'KeyR') { const t = hud.activeTray(); W.autoRock(t, !world.trays[t].rocking) }
    else if (c === 'KeyF') { const p = world.carried ?? world.papers.find((q) => q.place.at === 'tray')?.id; if (p) W.flip(p) }
    else if (c === 'Space') {
      e.preventDefault()
      if (world.carried) W.drop()
      else { const p = world.papers.find((q) => q.place.at === 'tray' || q.place.at === 'easel'); if (p) W.pick(p.id) }
    }
    else if (c === 'Enter' && world.carried) W.hang(world.carried)
    else if (c === 'KeyL') {
      if (world.lights.room > 0) W.setLight('room', 0)
      else { W.guard(true); setTimeout(() => W.setLight('room', 1), 300) }
    }
    else if (c === 'KeyK') W.setLight('safe', world.lights.safe > 0 ? 0 : 1)
    else if (c === 'KeyG') W.setFocusLamp(!world.enlarger.focus)
    else if (c === 'KeyX') { if (world.timer.running) W.stopExposure(); else W.startExposure() }
    else if (c === 'KeyT') W.startExposure('strip')
    else if (e.key === '+' || e.key === '=') W.setTimer(world.timer.seconds + (e.shiftKey ? 5 : 1))
    else if (e.key === '-' || e.key === '_') W.setTimer(world.timer.seconds - (e.shiftKey ? 5 : 1))
    else if (c === 'BracketLeft' || c === 'BracketRight') {
      const i = GRADES.indexOf(world.enlarger.grade as (typeof GRADES)[number])
      W.setGrade(GRADES[Math.max(0, Math.min(GRADES.length - 1, i + (c === 'BracketRight' ? 1 : -1)))] as Grade)
    }
    else if (c === 'KeyH') hud.setTool('hand')
    else if (c === 'KeyJ') hud.setTool('wand')
    else if (c === 'KeyB') hud.setTool('card')
    else if (c === 'KeyU') W.setUVLid(!world.iron.uvLid)
    else if (c === 'KeyP') W.peroxide('wash', 0, 0)
    else if (c === 'KeyI') W.tap(!world.iron.tap)
    else if (c === 'KeyN') o.logbook.open()
    else if (c === 'KeyV') W.blow(6.02, 0.44, true)
    else if (c === 'KeyO') W.frame(world.iron.frameOpen ? 'close' : 'open')
    else if (c === 'Period') hud.setFF(true)
    else if (c === 'ArrowUp' || c === 'ArrowDown') {
      if (world.occluder) { o.input.height01 = Math.max(0, Math.min(1, o.input.height01 + (c === 'ArrowUp' ? 0.1 : -0.1))); W.setOccluder({ ...world.occluder, height01: o.input.height01 }) }
    }
    else if (c === 'Escape') { hud.setTool(null); W.setOccluder(null) }
  })
  addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') { tiltKeys.delete(e.code); applyTilt() }
    else if (e.code === 'Period') hud.setFF(false)
    else if (e.code === 'KeyV') W.blow(6.02, 0.44, false)
  })
  addEventListener('blur', () => { tiltKeys.clear(); hud.setFF(false) })
}

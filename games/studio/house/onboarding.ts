// Onboarding (studio.md §9): no text walls. Each step is a flag in house.tutorial; glows and one tape note at a
// time; anything else the player does simply leaves the glow waiting.
import type { Engine } from '../core/engine'
import type { Studio } from '../core/boot'
import type { CameraApi } from '../camera/camera'
import type { Darkroom } from '../darkroom/darkroom'
import type { Hall } from './hall'
import type { House } from './architecture'
import { NOTES } from './copy'
import { PRESETS } from '../camera/spec'

export function installOnboarding(e: Engine, st: Studio, p: { camera: CameraApi; darkroom: Darkroom; hall: Hall; house: House }): void {
  const { store, hud, yard, rooms } = st
  const tut = store.house.tutorial
  const done = (k: string) => {
    tut[k] = true
    store.saveHouse({ tutorial: tut })
  }
  // the can on the stump: tapping it puts the pinhole on the tripod at the stump and raises the sight pins
  yard.onStumpCan = () => {
    const b = p.camera.build()
    if (b.body !== 'oatcan') p.camera.setBuild({ ...PRESETS.pinhole, stock: 'ortho25' })
    p.camera.placeTripod([1, 3], 0, 0, 0.45)
    yard.stumpCan.visible = false
    p.camera.set({ t: 15 })
    p.camera.finder(true)
    hud.note(NOTES.pinhole, 8000)
  }
  const stepNote = () => {
    if (!tut.shot) {
      yard.stumpGlow.pulse(true)
      if (rooms.current === 'yard') hud.note(NOTES.pinhole, 0)
    } else yard.stumpGlow.pulse(false)
    if (tut.shot && !tut.developed) {
      yard.doorGlow.pulse(true)
      hud.tags.darkroom.classList.add('st-tag--pulse')
    } else {
      yard.doorGlow.pulse(false)
      hud.tags.darkroom.classList.remove('st-tag--pulse')
    }
    if (tut.printed && !tut.pinned) p.hall.fridgeGlow.pulse(true)
    else p.hall.fridgeGlow.pulse(false)
  }
  e.bus.on('shot', () => {
    if (!tut.shot) {
      done('shot')
      hud.note(NOTES.basement, 6000)
    }
    stepNote()
  })
  e.bus.on('roll:developed', () => {
    if (!tut.developed) done('developed')
    stepNote()
  })
  e.bus.on('print:made', () => {
    if (!tut.printed) {
      done('printed')
      hud.note(NOTES.fridge, 6000)
    }
    p.hall.hubNote()
    stepNote()
  })
  const prevPinned = p.hall.onPinned
  p.hall.onPinned = (id) => {
    prevPinned?.(id)
    if (!tut.pinned) done('pinned')
    stepNote()
  }
  rooms.onChange((to) => {
    if (to === 'darkroom' && !tut.tankNote) {
      hud.note(NOTES.tank, 6000)
      done('tankNote')
    } else if (to === 'yard' && !tut.shot) hud.note(NOTES.pinhole, 0)
    else if (to === 'hall' && tut.printed && !tut.pinned) hud.note(NOTES.fridge, 6000)
  })
  stepNote()
}

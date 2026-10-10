// bootStudio (architecture §5.6): loader, RAPIER.init(), engine, house, rooms, yard, camera, darkroom, hall,
// postcards, onboarding, and the __game assembly.
import * as THREE from 'three'
import type { Shell, Loader } from '@shared/ui'
import { confirmDialog } from '@shared/ui'
import { installGameApi, markReady, onGameKey, flags } from '@shared/core'
import { Audio } from '@shared/audio'
import { createEngine, type Engine } from './engine'
import { loadRapier, createPhysics } from './physics'
import { createInput } from './input'
import { createGrab } from './grab'
import { createRooms, type RoomModule, type Rooms } from './rooms'
import { createStore, type Store } from './store'
import { addGlow, tickGlow, type Glow } from './glow'
import type { QualityName, RoomId } from './contracts'
import { createHud, type Hud } from '../hud/hud'
import { createHouse } from '../house/architecture'
import { createOverview } from '../house/overview'
import { createYard, type YardModule } from '../yard/yard'
import { createWorkshop } from '../camera/workshop'
import { installCamera } from '../camera/camera'
import { createDarkroom } from '../darkroom/darkroom'
import { createHall } from '../house/hall'
import { installPostcards } from '../house/postcards'
import { installOnboarding } from '../house/onboarding'
import { buildTestApi } from '../api/test-api'

export interface Studio {
  e: Engine
  store: Store
  hud: Hud
  rooms: Rooms
  yard: YardModule
  shell: Shell
}

export async function bootStudio(o: { stage: HTMLElement; shell: Shell; quality: QualityName; seed: number; loader: Loader }): Promise<Studio> {
  const { stage, shell, loader } = o
  const poster = flags().embed === 'poster'
  loader.progress(0.05)
  const R = await loadRapier()
  loader.progress(0.35)
  const store = await createStore(o.seed)
  const e = createEngine(stage, o.quality, o.seed)
  e.day.set(store.house.dayHours, 'api')
  const ph = createPhysics(e, R)
  const hud = createHud(stage)
  const input = createInput(e)
  const grab = createGrab(e)
  const house = createHouse(e, ph)
  loader.progress(0.5)
  let roomsRef: Rooms | null = null
  const rooms = createRooms(e, input, hud.fade)
  roomsRef = rooms
  const overview = createOverview(e, house, hud, () => roomsRef!)
  rooms.register(overview)
  const yard = createYard(e, ph, grab, hud, house)
  rooms.register(yard)
  loader.progress(0.65)
  const studio: Studio = { e, store, hud, rooms, yard, shell }
  const camera = installCamera(e, ph, studio, input)
  const workshop = createWorkshop(e, ph, studio, camera)
  rooms.register(workshop)
  const darkroom = createDarkroom(e, studio)
  rooms.register(darkroom)
  const hall = createHall(e, studio)
  rooms.register(hall)
  const postcards = installPostcards(e, studio, hall)
  loader.progress(0.85)

  // hover glow on pickables
  const glows = new WeakMap<THREE.Object3D, Glow>()
  let lit: Glow | null = null
  input.setHoverCb((p) => {
    lit?.set(false)
    lit = null
    if (!p) return
    let g = glows.get(p.object)
    if (!g) {
      g = addGlow(p.object)
      glows.set(p.object, g)
    }
    g.set(true)
    lit = g
  })
  e.onFrame((dt) => tickGlow(dt))

  // navigation
  yard.onDoor = (to) => void rooms.go(to)
  hud.houseButton.addEventListener('click', () => void rooms.go('overview'))
  rooms.onChange((to) => {
    hud.setRoom(to)
    store.saveHouse({ dayHours: e.day.hours })
  })
  const order: RoomId[] = ['yard', 'workshop', 'hall', 'darkroom']
  onGameKey((ev) => {
    if (ev.code === 'Tab') {
      ev.preventDefault()
      if (camera.finderOn) camera.finder(false)
      void rooms.go(rooms.current === 'overview' ? 'yard' : 'overview')
    } else if (/^Digit[1-4]$/.test(ev.code) && rooms.current === 'overview') {
      void rooms.go(order[Number(ev.code.slice(5)) - 1])
    } else if (ev.code === 'BracketLeft' || ev.code === 'BracketRight') {
      const d = (ev.shiftKey ? 1 : 0.25) * (ev.code === 'BracketLeft' ? -1 : 1)
      e.day.set(e.day.hours + d, 'drag')
    } else if (ev.code === 'Escape' && !camera.finderOn && rooms.current !== 'overview') {
      void rooms.go('overview')
    }
  })

  // shell actions
  shell.setActions([
    { id: 'house', label: 'House', icon: 'sheet', shortcut: 'Tab', priority: 0, onSelect: () => void rooms.go('overview') },
    {
      id: 'fresh', label: 'Start fresh', icon: 'reset', priority: 9,
      onSelect: () => {
        void confirmDialog('Clear the house: every print, roll and postcard?', { title: 'Start fresh', ok: 'Start fresh', cancel: 'Keep it' }).then(async (ok) => {
          if (!ok) return
          await store.clear()
          location.reload()
        })
      },
    },
  ])

  // ?test=1: time advances only through step()/advance() (architecture §3.6)
  if (flags().test) e.paused = true
  // first frame
  await rooms.go('overview', { instant: true })
  e.step(16)
  loader.progress(1)
  const api = buildTestApi({ e, ph, store, hud, rooms, yard, camera, workshop, darkroom, hall, postcards, house })
  installGameApi('studio', 'studio@1', api)
  if (!poster) {
    installOnboarding(e, studio, { camera, darkroom, hall, house })
    if (store.house.prints.length > 0 || store.house.negatives.length > 0) shell.toast('Back where you left it.')
    if (!store.persistent && !flags().fresh) shell.toast('This house forgets when you leave.')
    // dive into the yard after the roof lifts (onboarding step 1)
    if (!flags().test) window.setTimeout(() => void rooms.go('yard'), e.reducedMotion ? 300 : 1400)
  } else hud.setHidden(true)
  requestAnimationFrame(() => markReady())
  void Audio
  void (workshop as RoomModule)
  return studio
}

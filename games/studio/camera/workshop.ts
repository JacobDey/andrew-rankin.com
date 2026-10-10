// The garage workshop (studio.md §4.6): the bench under the north window, the turntable with the current
// build, five parts drawers, the pinhole needle, film loading, the optics card and the build shelf.
import * as THREE from 'three'
import { Audio, haptic } from '@shared/audio'
import type { Engine } from '../core/engine'
import type { Physics } from '../core/physics'
import type { Studio } from '../core/boot'
import type { RoomModule, StationView } from '../core/rooms'
import type { CameraBuild, ShutterKind, StockId } from '../core/contracts'
import type { CameraApi } from './camera'
import { BODIES, LENSES, SHUTTERS, STOCKS, PART_NAMES, deriveSpec, fmtN, fmtShutter, nearFocusM, pinholeN } from './spec'
import { box, mat } from '../house/architecture'
import { TEX } from '../core/textures'
import { addGlow } from '../core/glow'
import { computeOptics } from '@shared/photo'
import { photoSpec } from './spec'

type Drawer = 'bodies' | 'lenses' | 'shutters' | 'film' | 'accessories'
const DRAWERS: { id: Drawer; label: string }[] = [
  { id: 'bodies', label: 'Bodies' },
  { id: 'lenses', label: 'Lenses' },
  { id: 'shutters', label: 'Shutters' },
  { id: 'film', label: 'Film' },
  { id: 'accessories', label: 'Extras' },
]

export interface Workshop extends RoomModule {
  mount(partId: string): boolean
  poke(seconds: number): number
  shelve(): void
}

export function createWorkshop(e: Engine, ph: Physics, st: Studio, cam: CameraApi): Workshop {
  void ph
  const { store, hud } = st
  const root = new THREE.Group()
  root.name = 'workshop'
  e.scene.add(root)
  const wood = mat(0xffffff, { map: TEX.wood('bench') })
  // bench under the north window (z ≈ −0.5)
  box(3.4, 0.08, 0.8, wood, -9, 0.92, -0.55, root)
  for (const x of [-10.6, -7.4]) for (const z of [-0.2, -0.9]) box(0.08, 0.92, 0.08, wood, x, 0.46, z, root)
  // drawers under the bench
  const drawerMeshes: THREE.Group[] = []
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group()
    const x = -10.36 + i * 0.68
    box(0.62, 0.16, 0.62, mat(0x8a5a36, { map: TEX.wood('bench') }), 0, 0, 0, g)
    box(0.12, 0.03, 0.03, mat(0xb08d3c, { metal: 0.8, rough: 0.3 }), 0, 0.02, -0.32, g)
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshStandardMaterial({ map: TEX.label(DRAWERS[i].label.toUpperCase(), '', '#ecdeba', '#3d3a36', 256, 64) }))
    lab.position.set(0, -0.03, -0.312)
    lab.rotation.y = Math.PI
    g.add(lab)
    g.position.set(x, 0.78, -0.55)
    g.name = 'drawer-' + DRAWERS[i].id
    root.add(g)
    drawerMeshes.push(g)
  }
  // pegboard and lamp
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), mat(0xffffff, { map: TEX.pegboard() }))
  peg.position.set(-11.92, 1.6, -2)
  peg.rotation.y = Math.PI / 2
  root.add(peg)
  const lampArm = box(0.03, 0.5, 0.03, mat(0x2a2622, { metal: 0.6 }), -10.3, 1.2, -0.3, root)
  void lampArm
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 12, 1, true), mat(0x2c7547, { metal: 0.3 }))
  shade.position.set(-10.15, 1.42, -0.42)
  shade.rotation.z = 0.6
  root.add(shade)
  const lamp = new THREE.PointLight(0xffe2b8, 0.35, 0, 2)
  lamp.position.set(-10.0, 1.32, -0.5)
  root.add(lamp)
  // fluorescent tubes
  const tubes = new THREE.PointLight(0xf2f4ff, 1.3, 0, 2)
  tubes.position.set(-9, 2.5, -3)
  root.add(tubes)
  box(1.2, 0.04, 0.08, new THREE.MeshBasicMaterial({ color: 0xffffff }), -9, 2.6, -3, root, false)
  // turntable with the current build
  const turntable = new THREE.Group()
  turntable.position.set(-9, 0.97, -0.55)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 32), mat(0x3a3330, { rough: 0.7 }))
  turntable.add(disc)
  const model = new THREE.Group()
  model.position.y = 0.015
  turntable.add(model)
  root.add(turntable)
  const tableGlow = addGlow(disc, 0.01)
  void tableGlow
  // needle + foil for the pinhole
  const needle = new THREE.Group()
  needle.name = 'needle'
  const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0005, 0.12, 6), mat(0xcfd2d6, { metal: 0.9, rough: 0.25 }))
  nd.rotation.z = Math.PI / 2
  needle.add(nd)
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 16), mat(0xb08d3c, { metal: 0.9, rough: 0.3 }))
  foil.position.set(0.1, 0, 0)
  foil.rotation.z = Math.PI / 2
  needle.add(foil)
  needle.position.set(-8.3, 0.97, -0.4)
  root.add(needle)
  // the side door to the yard
  const door = e.scene.getObjectByName('side-door')

  // ---------------------------------------------------------------- the camera model on the turntable
  const brass = mat(0xb08d3c, { metal: 0.8, rough: 0.35 })
  const rebuildModel = () => {
    model.clear()
    const b = cam.build()
    if (b.body === 'oatcan') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 24), mat(0xffffff, { map: TEX.oats(), rough: 0.8 }))
      c.position.y = 0.09
      model.add(c)
      box(0.05, 0.05, 0.004, mat(0x151413), 0, 0.1, 0.066, model)
    } else if (b.body === 'box') {
      box(0.11, 0.12, 0.14, mat(0x1c1b1a, { rough: 0.55 }), 0, 0.06, 0, model)
      for (const sx of [-1, 1]) for (const sy of [0, 1]) box(0.012, 0.012, 0.14, brass, sx * 0.055, sy * 0.12, 0, model)
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), brass)
      knob.rotation.z = Math.PI / 2
      knob.position.set(0.062, 0.08, -0.03)
      model.add(knob)
    } else {
      box(0.17, 0.17, 0.02, mat(0x5a2a1b, { map: TEX.wood('mahogany') }), 0, 0.09, -0.08, model)
      box(0.13, 0.13, 0.02, mat(0x5a2a1b, { map: TEX.wood('mahogany') }), 0, 0.08, 0.1, model)
      const bel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.16, 4, 6), mat(0x7e1f1a, { rough: 0.9 }))
      bel.rotation.x = Math.PI / 2
      bel.rotation.y = Math.PI / 4
      bel.position.set(0, 0.085, 0.01)
      model.add(bel)
      box(0.02, 0.01, 0.3, brass, -0.05, 0.005, 0, model)
      box(0.02, 0.01, 0.3, brass, 0.05, 0.005, 0, model)
    }
    const front = b.body === 'oatcan' ? 0.07 : b.body === 'box' ? 0.07 : 0.115
    if (b.lens !== 'pinhole') {
      const L = LENSES[b.lens]
      const len = typeof L.f === 'number' ? L.f / 1500 : 0.05
      const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, len, 16), b.lens === 'plasmat150' ? mat(0xcfd2d6, { metal: 0.9, rough: 0.25 }) : b.lens === 'portrait120' ? brass : mat(0x111111, { rough: 0.5 }))
      lm.rotation.x = Math.PI / 2
      lm.position.set(0, b.body === 'field' ? 0.08 : 0.06, front + len / 2)
      model.add(lm)
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), new THREE.MeshStandardMaterial({ color: 0x88aabb, metalness: 0.9, roughness: 0.05 }))
      glass.position.set(0, lm.position.y, front + len + 0.001)
      model.add(glass)
    }
    if (b.shutter === 'leaf') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 20), mat(0xcfd2d6, { metal: 0.9, rough: 0.25 }))
      ring.position.set(0, b.body === 'field' ? 0.08 : 0.06, front + 0.01)
      model.add(ring)
    } else if (b.shutter === 'drop') {
      box(0.09, 0.22, 0.012, mat(0x6b4a2e), 0, 0.11, front + 0.02, model)
      box(0.07, 0.04, 0.008, mat(0x111111), 0, 0.17, front + 0.03, model)
    }
    if (b.accessories.includes('closeup2')) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 16), brass)
      ring.position.set(0, 0.06, front + 0.06)
      model.add(ring)
    }
    model.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
  }

  // ---------------------------------------------------------------- DOM: drawers, parts, optics card, needle, shelf
  const drawersEl = document.createElement('div')
  drawersEl.className = 'st-drawers'
  const partsEl = document.createElement('div')
  partsEl.className = 'st-parts'
  const card = document.createElement('div')
  card.className = 'st-card st-optics'
  card.setAttribute('aria-live', 'polite')
  const wrap = document.createElement('div')
  wrap.append(drawersEl, partsEl, card)
  wrap.hidden = true
  hud.el.appendChild(wrap)
  let open: Drawer | null = null
  const drawerBtns = new Map<Drawer, HTMLButtonElement>()
  for (const d of DRAWERS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'st-btn'
    b.textContent = d.label
    b.addEventListener('click', () => openDrawer(open === d.id ? null : d.id))
    drawersEl.appendChild(b)
    drawerBtns.set(d.id, b)
  }
  const owned = (id: string) => store.house.owned.includes(id)
  const partsOf = (d: Drawer): { id: string; sub: string }[] => {
    switch (d) {
      case 'bodies':
        return Object.values(BODIES).map((b) => ({ id: b.id, sub: `${b.formatMm[0]}×${b.formatMm[1]} · ${b.frames} fr` }))
      case 'lenses':
        return Object.values(LENSES).map((l) => ({ id: l.id, sub: l.id === 'pinhole' ? 'needle-poked' : `${l.f} mm f/${l.nMin}` }))
      case 'shutters':
        return (['cap', 'leaf', 'drop'] as ShutterKind[]).map((s) => ({ id: s, sub: s === 'cap' ? 'hold time' : s === 'leaf' ? 'B · 1 … 1/500' : 'falling plate' }))
      case 'film':
        return (Object.keys(STOCKS) as StockId[]).map((s) => ({ id: s, sub: `ISO ${STOCKS[s].iso}` }))
      case 'accessories':
        return [{ id: 'closeup2', sub: '+2 dioptre' }]
    }
  }
  const isOn = (id: string) => {
    const b = cam.build()
    return b.body === id || b.lens === id || b.shutter === id || b.stock === id || b.accessories.includes(id)
  }
  const renderParts = () => {
    partsEl.innerHTML = ''
    if (!open) return
    for (const p of partsOf(open)) {
      const b = document.createElement('button')
      b.type = 'button'
      const own = owned(p.id)
      b.className = 'st-btn st-part' + (isOn(p.id) ? ' st-part--on' : '') + (own ? '' : ' st-part--locked')
      b.innerHTML = `<span>${PART_NAMES[p.id] ?? p.id}</span><small>${own ? p.sub : 'not yet'}</small>`
      b.disabled = !own
      b.addEventListener('click', () => mount(p.id))
      partsEl.appendChild(b)
    }
  }
  const openDrawer = (d: Drawer | null) => {
    open = d
    for (const [id, b] of drawerBtns) b.setAttribute('aria-pressed', String(id === d))
    if (d) Audio.play('paper.flop', {})
    renderParts()
  }
  // drawer slide animation
  e.onFrame((dt) => {
    for (let i = 0; i < 5; i++) {
      const target = open === DRAWERS[i].id ? -0.55 - 0.25 : -0.55
      const g = drawerMeshes[i]
      g.position.z += (target - g.position.z) * Math.min(1, dt * 10)
    }
    if (e.room === 'workshop') turntable.rotation.y += dt * 0.25
  })

  const renderCard = () => {
    const b = cam.build()
    const spec = cam.spec()
    const st2 = cam.settings
    const ps = photoSpec(spec, st2)
    const op = computeOptics(ps)
    const near = nearFocusM(b)
    const sunny = b.lens === 'pinhole' ? null : `sunny 16: f/16 · ${fmtShutter(1 / closestSpeed(spec.iso))}`
    const pin = b.lens === 'pinhole' ? (() => {
      const d = b.pinholeMm ?? 0.45
      const f = spec.f
      const blur = Math.sqrt(d * d + Math.pow((2.44 * 0.00055 * f) / d, 2))
      return `d ${d.toFixed(2)} mm · ${fmtN(pinholeN(b))} · blur ${blur.toFixed(2)} mm`
    })() : null
    card.innerHTML = `<h3>Optics card</h3><dl>
      <dt>Body</dt><dd>${PART_NAMES[b.body]}</dd>
      <dt>Lens</dt><dd>${b.lens === 'pinhole' ? `pinhole ${spec.f} mm ${fmtN(spec.nMin)}` : `${spec.f} mm ${fmtN(spec.nMin)}`}</dd>
      <dt>Shutter</dt><dd>${b.shutter === 'leaf' ? '1/500–1 s, B' : b.shutter === 'drop' ? `${fmtShutter(spec.shutterSpeeds[0])}–${fmtShutter(spec.shutterSpeeds[spec.shutterSpeeds.length - 1])}` : 'lens cap'}</dd>
      <dt>Film</dt><dd>${b.stock ? STOCKS[b.stock].name.replace('Nightjar ', 'NJ ') : '—'}</dd>
      <dt>Mass</dt><dd>${spec.massKg.toFixed(2)} kg</dd>
      <dt>Near</dt><dd>${b.lens === 'pinhole' ? 'all of it' : Number.isFinite(near) ? `${near.toFixed(2)} m` : '∞'}</dd>
      <dt>FOV</dt><dd>${Math.round(op.fovH)}°</dd>
    </dl>${sunny ? `<div class="st-pencil">${sunny}</div>` : ''}${pin ? `<div class="st-pencil">${pin}</div>` : ''}`
  }
  const closestSpeed = (iso: number) => {
    const opts = [15, 30, 60, 125, 250, 500]
    let best = 125
    for (const o of opts) if (Math.abs(Math.log(o / iso)) < Math.abs(Math.log(best / iso))) best = o
    return best
  }

  const mount = (id: string): boolean => {
    if (!owned(id)) return false
    const b: CameraBuild = { ...cam.build(), accessories: [...cam.build().accessories] }
    if (id in BODIES) {
      b.body = id as CameraBuild['body']
      if (b.body === 'oatcan') {
        b.lens = 'pinhole'
        b.shutter = 'cap'
      }
    } else if (id in LENSES) {
      if (b.body === 'oatcan' && id !== 'pinhole') return false
      b.lens = id
    } else if (id === 'cap' || id === 'leaf' || id === 'drop') {
      if (b.body === 'oatcan' && id !== 'cap') return false
      b.shutter = id
      if (id === 'drop') b.dropHeightCm = b.dropHeightCm ?? 40
    } else if (id in STOCKS) {
      b.stock = id as StockId
    } else if (id === 'closeup2') {
      b.accessories = b.accessories.includes(id) ? b.accessories.filter((a) => a !== id) : [...b.accessories, id]
    } else return false
    cam.setBuild(b)
    Audio.play('studio.thock', {})
    haptic(6)
    rebuildModel()
    renderCard()
    renderParts()
    return true
  }

  // the needle: press-hold grows the hole, d = 0.15 + 0.45·(1 − e^{−t/0.9}) mm; > 2.5 s adds raggedness
  const needleBtn = document.createElement('button')
  needleBtn.type = 'button'
  needleBtn.className = 'st-btn'
  needleBtn.textContent = 'Poke the pinhole (hold)'
  let pokeStart = 0
  let creak: ReturnType<typeof Audio.loop> | null = null
  const pokeAt = (sec: number) => {
    const d = 0.15 + 0.45 * (1 - Math.exp(-sec / 0.9))
    const ragged = sec > 2.5 ? Math.min(1, (sec - 2.5) / 2) : 0
    const b = { ...cam.build(), pinholeMm: d, pinholeRagged: ragged }
    cam.setBuild(b)
    renderCard()
    return d
  }
  needleBtn.addEventListener('pointerdown', () => {
    if (cam.build().lens !== 'pinhole') return
    pokeStart = performance.now()
    creak = Audio.loop('studio.needle', { level: 1 })
  })
  const endPoke = () => {
    if (!pokeStart) return
    pokeAt((performance.now() - pokeStart) / 1000)
    pokeStart = 0
    creak?.stop(0.1)
    creak = null
  }
  needleBtn.addEventListener('pointerup', endPoke)
  needleBtn.addEventListener('pointerleave', endPoke)
  e.onFrame(() => {
    if (pokeStart) pokeAt((performance.now() - pokeStart) / 1000)
  })
  const shelfBtn = document.createElement('button')
  shelfBtn.type = 'button'
  shelfBtn.className = 'st-btn'
  shelfBtn.textContent = 'Shelve build'
  shelfBtn.addEventListener('click', () => api.shelve())
  const yardBtn = document.createElement('button')
  yardBtn.type = 'button'
  yardBtn.className = 'st-btn st-btn--dark'
  yardBtn.textContent = 'To the yard ▸'
  yardBtn.addEventListener('click', () => void st.rooms.go('yard'))
  const trayItems = [needleBtn, shelfBtn, yardBtn]

  const needlePick = e.addPickable({ object: needle, room: 'workshop', on: (pe) => pe.kind === 'tap' && (st.shell.toast('Hold the needle button to poke.'), true) })
  void needlePick
  drawerMeshes.forEach((g, i) => e.addPickable({ object: g, room: 'workshop', on: (pe) => pe.kind === 'tap' && (openDrawer(open === DRAWERS[i].id ? null : DRAWERS[i].id), true) }))
  e.addPickable({
    object: turntable,
    room: 'workshop',
    on: (pe) => {
      if (pe.kind === 'drag') {
        turntable.rotation.y += pe.dx * 0.01
        return true
      }
      return pe.kind === 'dragStart' || pe.kind === 'dragEnd'
    },
  })
  if (door) e.addPickable({ object: door, room: 'workshop', on: (pe) => pe.kind === 'tap' && (void st.rooms.go('yard'), true) })

  const view: StationView = { kind: 'station', pos: new THREE.Vector3(-9, 1.62, -2.3), target: new THREE.Vector3(-9, 0.95, -0.4), fov: 50, yawLimitDeg: 180, pitchMinDeg: -50, pitchMaxDeg: 15 }
  const api: Workshop = {
    id: 'workshop',
    view,
    ambientLux: () => 300 + 0.04 * e.sun().skyLux,
    enter() {
      wrap.hidden = false
      hud.tray.replaceChildren(...trayItems)
      needleBtn.hidden = cam.build().lens !== 'pinhole'
      e.hemiScale = 0.04
      lamp.intensity = 0.35
      tubes.intensity = 1.3
      rebuildModel()
      renderCard()
      renderParts()
    },
    exit() {
      wrap.hidden = true
      hud.tray.replaceChildren()
      openDrawer(null)
      e.hemiScale = 1
      lamp.intensity = 0
      tubes.intensity = 0
    },
    update() {
      if (e.room === 'workshop') needleBtn.hidden = cam.build().lens !== 'pinhole'
    },
    mount,
    poke: (s) => pokeAt(s),
    shelve() {
      const h = store.house
      if (h.builds.length >= 6) {
        st.shell.toast('The shelf is full.')
        return
      }
      h.builds.push({ ...cam.build(), accessories: [...cam.build().accessories] })
      store.saveHouse({ builds: h.builds })
      st.shell.toast('On the shelf.')
    },
  }
  rebuildModel()
  lamp.intensity = 0
  tubes.intensity = 0
  void deriveSpec
  return api
}

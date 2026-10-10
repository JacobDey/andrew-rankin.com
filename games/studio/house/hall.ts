// Hall and kitchen (studio.md §4.8, §7.2): the fridge gallery (8 magnet slots), the print box, the binder, the
// print viewer (Save print, Copy caption, Unpin) and the share card PNG.
import * as THREE from 'three'
import { Audio } from '@shared/audio'
import { openDialog } from '@shared/ui'
import { canvasToBlob, copyText, downloadBlob } from '@shared/core'
import { writeHubNote } from '@shared/storage'
import type { Engine } from '../core/engine'
import type { Studio } from '../core/boot'
import type { RoomModule, StationView } from '../core/rooms'
import type { PrintMeta } from '../core/contracts'
import type { PrintRecord } from '../darkroom/darkroom'
import { box, mat } from './architecture'
import { TEX } from '../core/textures'
import { addGlow, type Glow } from '../core/glow'
import { POSTCARD_TEXT } from './copy'

export interface Hall extends RoomModule {
  pin(printId: string, slot?: number): boolean
  unpin(printId: string): void
  openViewer(printId: string): Promise<void>
  openPrintBox(): Promise<void>
  fridgeGlow: Glow
  printBoxGlow: Glow
  onPinned: ((printId: string) => void) | null
  marks: Map<string, string> // printId → postcard mark text (e.g. '"Stop the water." ★')
  refreshFridge(): void
  hubNote(): void
  shareCard(printId: string): Promise<Blob | null>
}

export function createHall(e: Engine, st: Studio): Hall {
  const { store, hud } = st
  const house = store.house
  const root = new THREE.Group()
  root.name = 'hall'
  e.scene.add(root)
  // fridge
  const fridge = new THREE.Group()
  fridge.position.set(-4.4, 0, -0.5)
  const enamel = mat(0xf1eee6, { rough: 0.35 })
  box(0.78, 1.78, 0.68, enamel, 0, 0.89, 0, fridge)
  box(0.03, 0.4, 0.04, mat(0xb9b2a2, { metal: 0.6, rough: 0.3 }), 0.33, 1.25, -0.36, fridge)
  fridge.name = 'fridge'
  root.add(fridge)
  const fridgeGlow = addGlow(fridge, 0.02)
  const slots: THREE.Mesh[] = []
  const magnetCols = [0xc0362c, 0xe8c040, 0x2c7547, 0x2c6fb0]
  for (let i = 0; i < 8; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }))
    m.position.set(-0.17 + col * 0.34, 1.5 - row * 0.34, -0.345)
    m.rotation.y = Math.PI
    m.rotation.z = ((i * 37) % 7 - 3) * 0.012
    m.visible = false
    m.name = 'fridge-slot-' + i
    const mag = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat(magnetCols[i % 4], { rough: 0.4 }))
    mag.scale.z = 0.5
    mag.position.set(0, 0.11, -0.012)
    m.add(mag)
    fridge.add(m)
    slots.push(m)
  }
  // table + binder, counter + print box, framed lighthouse print (Plates cameo)
  const wood = mat(0xffffff, { map: TEX.wood('bench') })
  box(1.4, 0.05, 0.9, wood, -1.6, 0.75, -3.4, root)
  for (const x of [-2.2, -1.0]) for (const z of [-3.05, -3.75]) box(0.05, 0.75, 0.05, wood, x, 0.375, z, root)
  const binder = box(0.32, 0.06, 0.26, mat(0x2c3a5a, { rough: 0.7 }), -1.5, 0.81, -3.4, root)
  binder.name = 'binder'
  box(1.6, 0.9, 0.6, mat(0xd9d2c3), 0.9, 0.45, -0.4, root)
  box(1.64, 0.04, 0.64, mat(0x6e7f7a, { rough: 0.4 }), 0.9, 0.92, -0.4, root)
  const printBox = new THREE.Group()
  box(0.34, 0.1, 0.28, mat(0x9a7450, { rough: 0.8 }), 0, 0.05, 0, printBox)
  const boxLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshStandardMaterial({ map: TEX.label('PRINTS', 'NIGHTJAR · 8×10', '#ecdeba', '#3d3a36', 256, 64) }))
  boxLabel.position.set(0, 0.05, -0.141)
  boxLabel.rotation.y = Math.PI
  printBox.add(boxLabel)
  printBox.position.set(0.6, 0.94, -0.4)
  printBox.name = 'print-box'
  root.add(printBox)
  const printBoxGlow = addGlow(printBox, 0.012)
  const frame = new THREE.Group()
  box(0.5, 0.4, 0.03, mat(0x3a2e25), 0, 0, 0, frame)
  const lh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshStandardMaterial({ map: lighthouseTex(), roughness: 0.8 }))
  lh.position.z = 0.017
  frame.add(lh)
  frame.position.set(-2.6, 1.6, -0.1)
  frame.rotation.y = Math.PI
  root.add(frame)
  // kitchen light
  const lamp = new THREE.PointLight(0xffe8c8, 0.5, 0, 2)
  lamp.position.set(-2, 2.4, -3)
  root.add(lamp)
  // garage door (in the partition)
  const gDoor = new THREE.Group()
  box(0.05, 2.0, 0.86, mat(0x8a6a48, { map: TEX.wood('bench') }), 0, 1.0, 0, gDoor)
  gDoor.position.set(-5.97, 0, -1.95)
  gDoor.name = 'garage-door'
  root.add(gDoor)

  const textures = new Map<string, THREE.Texture>()
  const loadTex = async (id: string): Promise<THREE.Texture | null> => {
    let t = textures.get(id)
    if (t) return t
    const pr = await store.get<PrintRecord>('print:' + id)
    if (!pr) return null
    const bmp = await createImageBitmap(pr.image)
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    c.getContext('2d')!.drawImage(bmp, 0, 0)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    textures.set(id, t)
    return t
  }
  const refreshFridge = () => {
    house.fridge.forEach((id, i) => {
      const m = slots[i]
      if (!id) {
        m.visible = false
        return
      }
      void loadTex(id).then((t) => {
        if (!t) return
        const mm = m.material as THREE.MeshStandardMaterial
        mm.map = t
        mm.needsUpdate = true
        const img = t.image as HTMLCanvasElement
        const a = img.width / img.height
        m.scale.set(a >= 1 ? 1 : a, a >= 1 ? 1 / a : 1, 1)
        m.visible = true
      })
    })
  }
  const hubNote = () => {
    const n = house.fridge.filter(Boolean).length
    if (n > 0) writeHubNote('studio', `${n} ${n === 1 ? 'print' : 'prints'} on the fridge`)
    else writeHubNote('studio', `${house.negatives.length} photos developed`)
  }

  const thumbURL = new Map<string, string>()
  const urlOf = async (id: string) => {
    let u = thumbURL.get(id)
    if (u) return u
    const pr = await store.get<PrintRecord>('print:' + id)
    if (!pr) return ''
    u = URL.createObjectURL(pr.image)
    thumbURL.set(id, u)
    return u
  }
  const metaOf = async (id: string) => (await store.get<PrintRecord>('print:' + id))?.meta ?? null
  const marks = new Map<string, string>()

  const shareCard = async (id: string): Promise<Blob | null> => {
    const pr = await store.get<PrintRecord>('print:' + id)
    if (!pr) return null
    const bmp = await createImageBitmap(pr.image)
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 1500
    const g = c.getContext('2d')!
    g.fillStyle = '#F1EEE6'
    g.fillRect(0, 0, 1200, 1500)
    const s = Math.min(900 / bmp.width, 1000 / bmp.height)
    const w = bmp.width * s
    const h = bmp.height * s
    g.save()
    g.translate(600, 640)
    g.rotate((-2 * Math.PI) / 180)
    g.shadowColor = 'rgba(0,0,0,0.25)'
    g.shadowBlur = 24
    g.fillStyle = '#fbf8f0'
    g.fillRect(-w / 2 - 30, -h / 2 - 30, w + 60, h + 90)
    g.shadowBlur = 0
    g.drawImage(bmp, -w / 2, -h / 2, w, h)
    g.restore()
    // the fruit magnet
    g.fillStyle = '#c0362c'
    g.beginPath()
    g.arc(600, 640 - h / 2 - 20, 34, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2c7547'
    g.fillRect(596, 640 - h / 2 - 66, 8, 22)
    // grease caption
    const meta = pr.meta as PrintMeta & { logline?: string }
    g.fillStyle = '#c0362c'
    g.font = '600 46px "Caveat Variable", Caveat, cursive'
    g.textAlign = 'center'
    g.fillText(meta.caption || marks.get(id) || '', 600, 1290)
    g.fillStyle = '#4a433c'
    g.font = '500 24px "IBM Plex Mono", monospace'
    g.fillText(meta.logline ?? '', 600, 1340)
    g.font = '700 22px "IBM Plex Mono", monospace'
    g.fillStyle = '#6b6359'
    g.fillText('SUNNY 16 · RANKIN 400 ▸06', 600, 1450)
    return canvasToBlob(c, 'image/png')
  }

  const openViewer = async (id: string) => {
    const meta = (await metaOf(id)) as (PrintMeta & { logline?: string }) | null
    if (!meta) return
    const body = document.createElement('div')
    const img = document.createElement('img')
    img.className = 'st-print'
    img.alt = meta.caption || 'A print'
    img.src = await urlOf(id)
    body.appendChild(img)
    const cap = document.createElement('div')
    cap.className = 'st-grease'
    cap.textContent = [meta.caption, marks.get(id)].filter(Boolean).join(' · ')
    body.appendChild(cap)
    const log = document.createElement('div')
    log.className = 'st-logline'
    log.textContent = meta.logline ?? ''
    body.appendChild(log)
    const onFridge = house.fridge.includes(id)
    openDialog({
      edge: 'LOGBOOK · ▸06',
      title: meta.kind === 'contact' ? 'Contact sheet' : 'Print',
      body,
      actions: [
        {
          id: 'save', label: 'Save print', kind: 'primary',
          onSelect: () => {
            void shareCard(id).then((b) => b && downloadBlob(b, `sunny16-${id}.png`))
            return false
          },
        },
        {
          id: 'copy', label: 'Copy caption',
          onSelect: () => {
            const r = meta.record
            const txt = `Sunny 16 · ${marks.get(id) ?? (meta.caption || 'A print')} · ${r?.spec ? `${r.spec.body} ${r.spec.f}mm f/${Math.round(r.spec.N * 10) / 10} ${r.spec.t >= 1 ? r.spec.t + 's' : '1/' + Math.round(1 / r.spec.t)}` : ''}`
            void copyText(txt).then((ok) => st.shell.toast(ok ? 'Caption copied.' : 'Copy failed.'))
            return false
          },
        },
        onFridge
          ? { id: 'unpin', label: 'Unpin', onSelect: () => api.unpin(id) }
          : { id: 'pin', label: 'Pin to the fridge', onSelect: () => void api.pin(id) },
      ],
    })
  }

  const openPrintBox = async () => {
    const body = document.createElement('div')
    const ids = house.prints
    if (!ids.length) {
      body.innerHTML = '<p class="st-empty">The print box is empty. Prints come from the darkroom.</p>'
    } else {
      const wrapT = document.createElement('div')
      wrapT.className = 'st-thumbs'
      for (const id of ids.slice(0, 40)) {
        const b = document.createElement('button')
        b.type = 'button'
        const im = document.createElement('img')
        im.src = await urlOf(id)
        im.alt = 'Print'
        b.appendChild(im)
        if (house.fridge.includes(id)) b.setAttribute('aria-pressed', 'true')
        b.addEventListener('click', () => {
          dlg.close()
          void openViewer(id)
        })
        wrapT.appendChild(b)
      }
      body.appendChild(wrapT)
    }
    const dlg = openDialog({ edge: 'PRINT BOX · ▸06', title: 'Prints', body, wide: true, actions: [{ id: 'close', label: 'Close' }] })
  }

  const api: Hall = {
    id: 'hall',
    view: { kind: 'station', pos: new THREE.Vector3(-2.0, 1.62, -6.6), target: new THREE.Vector3(-2.6, 1.05, -0.6), fov: 55, yawLimitDeg: 180, pitchMinDeg: -40, pitchMaxDeg: 25 } as StationView,
    ambientLux: () => 200 + 0.04 * e.sun().skyLux,
    fridgeGlow, printBoxGlow, marks,
    onPinned: null,
    enter() {
      e.hemiScale = 0.04
      lamp.intensity = 0.5
      refreshFridge()
      const mb = document.createElement('button')
      mb.type = 'button'
      mb.className = 'st-btn'
      mb.textContent = 'Print box'
      mb.addEventListener('click', () => void openPrintBox())
      const bb = document.createElement('button')
      bb.type = 'button'
      bb.className = 'st-btn'
      bb.textContent = 'Binder'
      bb.addEventListener('click', () => void openPrintBox())
      const down = document.createElement('button')
      down.type = 'button'
      down.className = 'st-btn st-btn--dark'
      down.textContent = 'Basement ▾'
      down.addEventListener('click', () => void st.rooms.go('darkroom'))
      const out = document.createElement('button')
      out.type = 'button'
      out.className = 'st-btn st-btn--dark'
      out.textContent = 'Yard ▸'
      out.addEventListener('click', () => void st.rooms.go('yard'))
      hud.tray.replaceChildren(mb, bb, down, out)
    },
    exit() {
      e.hemiScale = 1
      lamp.intensity = 0
      hud.tray.replaceChildren()
    },
    update() {},
    pin(id, slot) {
      if (house.fridge.includes(id)) return true
      let i = slot ?? house.fridge.findIndex((s) => !s)
      if (i < 0 || i > 7) i = 7
      house.fridge[i] = id
      store.saveHouse({ fridge: house.fridge })
      Audio.play('studio.thock', {})
      refreshFridge()
      hubNote()
      api.onPinned?.(id)
      return true
    },
    unpin(id) {
      const i = house.fridge.indexOf(id)
      if (i >= 0) house.fridge[i] = null
      store.saveHouse({ fridge: house.fridge })
      refreshFridge()
      hubNote()
    },
    openViewer,
    openPrintBox,
    refreshFridge,
    hubNote,
    shareCard,
  }
  // picking
  e.addPickable({ object: printBox, room: 'hall', on: (pe) => pe.kind === 'tap' && (void openPrintBox(), true) })
  e.addPickable({ object: binder, room: 'hall', on: (pe) => pe.kind === 'tap' && (void openPrintBox(), true) })
  slots.forEach((m, i) => e.addPickable({ object: m, room: 'hall', on: (pe) => pe.kind === 'tap' && (house.fridge[i] ? void openViewer(house.fridge[i]!) : void openPrintBox(), true) }))
  e.addPickable({ object: fridge, room: 'hall', on: (pe) => pe.kind === 'tap' && (void openPrintBox(), true) })
  const back = e.scene.getObjectByName('back-door')
  if (back) e.addPickable({ object: back, room: 'hall', on: (pe) => pe.kind === 'tap' && (Audio.play('studio.screen-door', {}), void st.rooms.go('yard'), true) })
  const bdoor = e.scene.getObjectByName('basement-door')
  if (bdoor) e.addPickable({ object: bdoor, room: 'hall', on: (pe) => pe.kind === 'tap' && (void st.rooms.go('darkroom'), true) })
  e.addPickable({ object: gDoor, room: 'hall', on: (pe) => pe.kind === 'tap' && (void st.rooms.go('workshop'), true) })
  refreshFridge()
  lamp.intensity = 0
  void POSTCARD_TEXT
  return api
}

function lighthouseTex(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 192)
  sky.addColorStop(0, '#c9b896')
  sky.addColorStop(1, '#8a7a5e')
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 192)
  g.fillStyle = '#4a4034'
  g.fillRect(0, 140, 256, 52)
  g.beginPath()
  g.moveTo(0, 140)
  g.lineTo(90, 110)
  g.lineTo(150, 140)
  g.fill()
  g.fillStyle = '#e8dcc4'
  g.fillRect(118, 50, 16, 66)
  g.fillStyle = '#2a241c'
  g.fillRect(114, 42, 24, 10)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// The basement darkroom (studio.md §4.7, §5.11, §5.12): tank (pendulum slosh, cue lamp, temperature,
// push/pull, drag and surge defects), fix and wash, light box with loupe, contact sheet, enlarger with grade and
// timer, the rocking tray with live development, the drying line, and the room light that fogs paper.
import * as THREE from 'three'
import { Audio, haptic, uiSound } from '@shared/audio'
import { canvasToBlob, onGameKey } from '@shared/core'
import type { Engine } from '../core/engine'
import type { Studio } from '../core/boot'
import type { RoomModule, StationView } from '../core/rooms'
import type { DevParams, PrintMeta, Roll, StockId } from '../core/contracts'
import type { LatentRecord } from '../camera/camera'
import { STOCKS, fmtN, fmtShutter, PART_NAMES } from '../camera/spec'
import { box, mat } from '../house/architecture'
import { developFrame, negativeImage, exposePaper, suggestLamp, renderPrint, printStats, chem, CHEM_RATE, type Negative, type PrintTarget } from './chem'
import { fmtTime } from '../hud/hud'

export interface NegRecord { frameId: string; rollId: string; index: number; w: number; h: number; channels: 1 | 3; stock: StockId; D: Float32Array; params: DevParams; record: LatentRecord['record'] }
export interface PrintRecord { meta: PrintMeta; image: Blob }

export interface Darkroom extends RoomModule {
  develop(rollId?: string, o?: { tempC?: number; push?: number; cueRatio?: number }): Promise<{ frames: string[] }>
  print(frameId: string, o?: { lampS?: number; grade?: number; kind?: 'contact' | 'enlargement' }): Promise<string>
  printPixels(printId: string): Promise<{ w: number; h: number; mean: number; brightFrac: number }>
  step: () => string
  onPrint: ((id: string) => void) | null
}

type Step = 'idle' | 'loaded' | 'developing' | 'drained' | 'fixed' | 'washing' | 'hung'

export function createDarkroom(e: Engine, st: Studio): Darkroom {
  const { store, hud } = st
  const house = store.house
  const root = new THREE.Group()
  root.name = 'darkroom'
  e.scene.add(root)
  const Y = -1.72 // bench top
  const enamel = mat(0xe9e4da, { rough: 0.4 })
  box(4.7, 0.08, 0.75, mat(0x5a4a3c, { rough: 0.8 }), -2.5, Y - 0.04, -3.42, root)
  for (const x of [-4.75, -0.25]) box(0.08, 0.84, 0.08, mat(0x3a3330), x, Y - 0.46, -3.42, root)
  // tank in its water bath
  box(0.36, 0.1, 0.3, mat(0x2c3a44, { rough: 0.3 }), -4.25, Y + 0.05, -3.45, root)
  const tank = new THREE.Group()
  tank.position.set(-4.25, Y + 0.1, -3.45)
  const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), mat(0x151413, { rough: 0.45 }))
  tankBody.position.y = 0.08
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.025, 16), mat(0x2a2622, { rough: 0.5 }))
  lid.position.y = 0.17
  const cueLamp = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x220800 }))
  cueLamp.position.set(0, 0.19, 0.03)
  tank.add(tankBody, lid, cueLamp)
  tank.name = 'tank'
  root.add(tank)
  const thermo = box(0.012, 0.18, 0.012, mat(0xe8e0d0, { rough: 0.2 }), -4.02, Y + 0.17, -3.36, root)
  void thermo
  // jugs
  const mkJug = (x: number, color: number, name: string) => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.85 }))
    b.position.y = 0.08
    g.add(b)
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI), mat(0x222222))
    h.position.set(0.055, 0.09, 0)
    h.rotation.z = -Math.PI / 2
    g.add(h)
    g.position.set(x, Y, -3.4)
    g.name = name
    root.add(g)
    return g
  }
  const devJug = mkJug(-3.85, 0x7a5a3a, 'dev-jug')
  const fixJug = mkJug(-3.6, 0x8aa0a8, 'fix-jug')
  // light box on the wall
  const stripCanvas = document.createElement('canvas')
  stripCanvas.width = 1024
  stripCanvas.height = 160
  const stripTex = new THREE.CanvasTexture(stripCanvas)
  stripTex.colorSpace = THREE.SRGBColorSpace
  const lbMat = new THREE.MeshBasicMaterial({ map: stripTex, color: new THREE.Color(1, 1, 1) })
  const lightbox = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), lbMat)
  lightbox.position.set(-3.2, Y + 0.62, -3.08)
  lightbox.name = 'lightbox'
  root.add(lightbox)
  box(1.36, 0.26, 0.04, mat(0x2a2622), -3.2, Y + 0.62, -3.1, root)
  // enlarger
  const enlarger = new THREE.Group()
  enlarger.position.set(-2.1, Y, -3.45)
  box(0.42, 0.03, 0.36, mat(0x2a2622), 0, 0.015, 0, enlarger)
  box(0.04, 0.9, 0.04, mat(0x777777, { metal: 0.7, rough: 0.3 }), 0, 0.45, -0.15, enlarger)
  const ehead = new THREE.Group()
  ehead.position.set(0, 0.62, -0.05)
  box(0.16, 0.14, 0.16, mat(0x1c1b1a, { rough: 0.5 }), 0, 0, 0, ehead)
  const elens = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 12), mat(0x111111))
  elens.position.y = -0.1
  ehead.add(elens)
  enlarger.add(ehead)
  const easelPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.2), new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.9 }))
  easelPaper.rotation.x = -Math.PI / 2
  easelPaper.position.y = 0.032
  easelPaper.visible = false
  enlarger.add(easelPaper)
  const lampSpot = new THREE.SpotLight(0xfff4e0, 0, 1.2, 0.5, 0.4, 2)
  lampSpot.position.set(0, 0.5, -0.05)
  lampSpot.target.position.set(0, 0, -0.05)
  enlarger.add(lampSpot, lampSpot.target)
  enlarger.name = 'enlarger'
  root.add(enlarger)
  // trays: developer, fix
  const printCanvas = document.createElement('canvas')
  printCanvas.width = 256
  printCanvas.height = 256
  const printTex = new THREE.CanvasTexture(printCanvas)
  printTex.colorSpace = THREE.SRGBColorSpace
  const tray = new THREE.Group()
  tray.position.set(-1.25, Y + 0.02, -3.45)
  box(0.34, 0.012, 0.28, enamel, 0, 0, 0, tray)
  for (const [w, d, x, z] of [[0.34, 0.012, 0, 0.14], [0.34, 0.012, 0, -0.14], [0.012, 0.28, 0.17, 0], [0.012, 0.28, -0.17, 0]] as const) box(w, 0.05, d, enamel, x, 0.025, z, tray)
  const trayPrint = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), new THREE.MeshStandardMaterial({ map: printTex, roughness: 0.25 }))
  trayPrint.rotation.x = -Math.PI / 2
  trayPrint.position.y = 0.012
  trayPrint.visible = false
  tray.add(trayPrint)
  const liquid = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.26, 12, 1), new THREE.MeshStandardMaterial({ color: 0x8a6a40, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2 }))
  liquid.rotation.x = -Math.PI / 2
  liquid.position.y = 0.028
  tray.add(liquid)
  tray.name = 'dev-tray'
  root.add(tray)
  const fixTray = new THREE.Group()
  fixTray.position.set(-0.85, Y + 0.02, -3.45)
  box(0.3, 0.012, 0.26, enamel, 0, 0, 0, fixTray)
  root.add(fixTray)
  // sink + tap
  box(0.32, 0.12, 0.4, mat(0xbfc4c4, { metal: 0.6, rough: 0.3 }), -0.45, Y + 0.0, -3.45, root)
  const faucet = box(0.03, 0.2, 0.03, mat(0xcfd2d6, { metal: 0.9, rough: 0.2 }), -0.45, Y + 0.16, -3.65, root)
  faucet.name = 'faucet'
  const sink = root.children[root.children.length - 2]
  sink.name = 'sink'
  // safelight, room light, switch
  const safelight = new THREE.PointLight(0xff7a30, 0.0016, 0, 2)
  safelight.position.set(-2.5, -0.55, -3.3)
  root.add(safelight)
  const safeLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a3c).multiplyScalar(0.004) }))
  safeLamp.position.set(-2.5, -0.5, -3.06)
  root.add(safeLamp)
  const roomLight = new THREE.PointLight(0xfff2e0, 0, 0, 2)
  roomLight.position.set(-2.5, -0.4, -5.5)
  root.add(roomLight)
  const sw = box(0.06, 0.1, 0.02, mat(0xece0b8), -4.93, -1.2, -4.2, root)
  sw.rotation.y = Math.PI / 2
  sw.name = 'switch'
  // drying line
  box(4.4, 0.006, 0.006, mat(0xd8d0c0), -2.5, -0.55, -3.2, root)
  const lineGroup = new THREE.Group()
  root.add(lineGroup)

  // ---------------------------------------------------------------- state
  let step: Step = 'idle'
  let tankRoll: string | null = null
  let tempC = 20
  let needleC = 20
  let chemS = 0
  let devIntegral = 0
  let nominal = 420
  let cues = 0
  let cuesAnswered = 0
  let lastCueAt = -10
  let cueOn = false
  let cueT = 0
  let agitHigh = 0
  let surge = 0
  let phi = 0
  let phiV = 0
  let tankTilt = 0
  let washT = 0
  let roomOn = false
  let lightLevel = 0
  const negs = new Map<string, NegRecord>()
  let stripFrames: string[] = []
  let selected: string | null = null
  // printing
  let grade = 2
  let lampS = 8
  let sizeGain = 1
  let exposedPaper: { target: PrintTarget; frameId: string; kind: 'contact' | 'enlargement'; lampS: number; grade: number; fog: number } | null = null
  let inTray: { target: PrintTarget; t: number; rocked: number; frameId: string; kind: 'contact' | 'enlargement'; lampS: number; grade: number; chimed: boolean } | null = null
  let trayTilt = 0
  let trayTiltV = 0
  const modes = [0, 0, 0, 0] // a1, a1', a3, a3'
  let slosh: ReturnType<typeof Audio.loop> | null = null
  let hum: ReturnType<typeof Audio.loop> | null = null
  let lampOnAt = 0
  let api: Darkroom

  // ---------------------------------------------------------------- DOM: readouts, strip, controls
  const card = document.createElement('div')
  card.className = 'st-card st-dr'
  const strip = document.createElement('div')
  strip.className = 'st-strip'
  strip.hidden = true
  const wrap = document.createElement('div')
  wrap.append(card, strip)
  wrap.hidden = true
  hud.el.appendChild(wrap)
  const tempIn = document.createElement('input')
  tempIn.type = 'range'
  tempIn.min = '16'
  tempIn.max = '28'
  tempIn.step = '0.5'
  tempIn.value = '20'
  tempIn.className = 'st-range'
  tempIn.setAttribute('aria-label', 'Water bath temperature')
  tempIn.addEventListener('input', () => (tempC = Number(tempIn.value)))
  const mk = (label: string, fn: () => void, cls = 'st-btn') => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = cls
    b.textContent = label
    b.addEventListener('click', fn)
    return b
  }
  const bLoad = mk('Load the tank', () => loadTank())
  const bPour = mk('Pour developer', () => pourDev())
  const bInvert = mk('Invert', () => invert())
  const bOut = mk('Pour out', () => void pourOut())
  const bFix = mk('Fix', () => fix())
  const bWash = mk('Wash', () => wash())
  const bLight = mk('Room light', () => setRoomLight(!roomOn), 'st-btn st-btn--dark')
  const bContact = mk('Contact sheet', () => exposeContact())
  const bGrade = mk('Grade 2', () => {
    grade = (grade + 1) % 6
    bGrade.textContent = `Grade ${grade}`
    Audio.play('ui.tick', {})
  })
  const bSize = mk('Small print', () => {
    sizeGain = sizeGain === 1 ? 0.56 : sizeGain === 0.56 ? 0.36 : 1
    bSize.textContent = sizeGain === 1 ? 'Small print' : sizeGain === 0.56 ? 'Medium print' : 'Large print'
    ehead.position.y = sizeGain === 1 ? 0.62 : sizeGain === 0.56 ? 0.74 : 0.86
    if (selected) lampS = suggestLamp(negOf(selected)!, sizeGain)
    refresh()
  })
  const bLampMinus = mk('−', () => {
    lampS = Math.max(1, lampS / 1.26)
    refresh()
  })
  const bLampPlus = mk('+', () => {
    lampS = Math.min(120, lampS * 1.26)
    refresh()
  })
  const bExpose = mk('Expose 8 s', () => exposeEnlargement())
  const bTray = mk('Into the tray', () => slideIntoTray())
  const bRock = mk('Rock', () => rock(1))
  const bPull = mk('Pull · fix · hang', () => void pullPrint())

  const negOf = (id: string): Negative | null => {
    const n = negs.get(id)
    return n ? { frameId: n.frameId, w: n.w, h: n.h, channels: n.channels, D: n.D, stock: n.stock, params: n.params } : null
  }

  const refresh = () => {
    const pocket = house.pocket.length
    const r = rollStock()
    const nominalTxt = r ? fmtTime(STOCKS[r].devNominalS / 3600 * 60).replace(/^00:/, '') : '—'
    void nominalTxt
    const mm = Math.floor(chemS / 60)
    const ss = Math.floor(chemS % 60)
    const hint =
      step === 'idle' ? (pocket ? 'Turn the tank on. Load it.' : 'No film in your pocket.') :
      step === 'loaded' ? 'Pour the developer.' :
      step === 'developing' ? 'Turn it when it blinks.' :
      step === 'drained' ? 'Fix it.' :
      step === 'fixed' ? 'Wash it.' :
      step === 'washing' ? 'Washing…' : (exposedPaper ? 'Slide it into the tray.' : inTray ? 'Rock the tray.' : 'Pick a frame. Print it.')
    card.innerHTML = `<h3>Darkroom · wind-up timer</h3>
      <div class="st-timer">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}<span class="st-cue${cueOn ? ' st-cue--on' : ''}"></span></div>
      <dl><dt>Bath</dt><dd>${needleC.toFixed(1)} °C</dd><dt>Nominal</dt><dd>${fmtDev(nominal)}</dd><dt>Pocket</dt><dd>${pocket} ${pocket === 1 ? 'roll' : 'rolls'}</dd>
      ${step === 'hung' ? `<dt>Lamp</dt><dd>${lampS.toFixed(1)} s · grade ${grade}</dd>` : ''}</dl>
      <div class="st-pencil">${hint}</div>`
    card.querySelector('dl')?.after(tempIn)
    bExpose.textContent = `Expose ${lampS.toFixed(1)} s`
    const items: HTMLElement[] = []
    if (step === 'idle') items.push(bLoad)
    if (step === 'loaded') items.push(bPour)
    if (step === 'developing') items.push(bInvert, bOut)
    if (step === 'drained') items.push(bFix)
    if (step === 'fixed') items.push(bWash)
    if (step === 'hung' || step === 'idle') {
      if (stripFrames.length) {
        if (selected && !exposedPaper && !inTray) items.push(bGrade, bSize, bLampMinus, bExpose, bLampPlus)
        if (!exposedPaper && !inTray && stripFrames.length > 1) items.push(bContact)
        if (exposedPaper) items.push(bTray)
        if (inTray) items.push(bRock, bPull)
      }
    }
    items.push(bLight)
    hud.tray.replaceChildren(...items)
    tempIn.disabled = rollStock() === 'colour200'
  }
  const fmtDev = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const rollStock = (): StockId | null => (tankRoll ? rollCache.get(tankRoll)?.stock ?? null : null)
  const rollCache = new Map<string, Roll>()

  // ---------------------------------------------------------------- tank
  const loadTank = async () => {
    if (step !== 'idle' || !house.pocket.length) return
    const id = house.pocket[0]
    const r = await store.get<Roll>('roll:' + id)
    if (!r) {
      house.pocket.shift()
      store.saveHouse()
      return
    }
    rollCache.set(id, r)
    hud.fade.classList.add('st-fade--black')
    Audio.play('cloth.rustle', {})
    await new Promise((res) => setTimeout(res, e.quality.transitions ? 1500 : 10))
    hud.fade.classList.remove('st-fade--black')
    Audio.play('studio.lid', {})
    haptic(8)
    tankRoll = id
    house.pocket.shift()
    store.saveHouse()
    step = 'loaded'
    nominal = STOCKS[r.stock].devNominalS
    if (r.stock === 'colour200') {
      tempC = 38
      needleC = 38
    }
    chemS = 0
    devIntegral = 0
    cues = cuesAnswered = 0
    surge = 0
    agitHigh = 0
    refresh()
  }
  const pourDev = () => {
    if (step !== 'loaded') return
    Audio.play('liquid.pour', {})
    step = 'developing'
    cueT = 0
    refresh()
  }
  const invert = () => {
    if (step !== 'developing') return
    phiV += 9
    tankTilt = Math.PI
    Audio.play('studio.glug', { rate: 0.8 })
    if (e.sim.t - lastCueAt < 1.2 || cueOn) {
      cuesAnswered++
      lastCueAt = -10
    }
  }
  const pourOut = async () => {
    if (step !== 'developing' || !tankRoll) return
    Audio.play('studio.fixer-pour', {})
    const rho = devIntegral / nominal
    const cueRatio = cues ? Math.min(1, cuesAnswered / cues) : 1
    step = 'drained'
    refresh()
    await developRoll(tankRoll, { tempC, chemSeconds: chemS, rho, cueRatio, surge: surge > 0 ? 1 : 0, washed: false })
  }
  const fix = () => {
    if (step !== 'drained') return
    Audio.play('studio.fixer-pour', {})
    step = 'fixed'
    refresh()
  }
  const wash = () => {
    if (step !== 'fixed') return
    Audio.play('liquid.pour', {})
    step = 'washing'
    washT = 0
    refresh()
  }
  const finishWash = () => {
    step = 'hung'
    if (tankRoll) {
      const r = rollCache.get(tankRoll)
      if (r) {
        r.state = 'developed'
        void store.put('roll:' + r.id, r)
      }
      e.bus.emit('roll:developed', { rollId: tankRoll })
    }
    tankRoll = null
    washed = true
    drawStrip()
    refresh()
  }
  let washed = true

  const developRoll = async (rollId: string, params: DevParams): Promise<string[]> => {
    const keys = (await store.keys('latent:' + rollId + ':')).sort((a, b) => Number(a.split(':').pop()) - Number(b.split(':').pop()))
    const out: string[] = []
    const stock = rollCache.get(rollId)?.stock ?? 'nj100'
    for (const k of keys) {
      const lat = await store.get<LatentRecord>(k)
      if (!lat) continue
      const neg = await developFrame(lat.frameId, lat.png, lat.w, lat.h, lat.channels, lat.record.spec.stock ?? stock, params, (e.seed * 131 + lat.index * 17) >>> 0)
      const rec: NegRecord = { frameId: lat.frameId, rollId, index: lat.index, w: lat.w, h: lat.h, channels: lat.channels, stock: lat.record.spec.stock, D: neg.D, params, record: lat.record }
      negs.set(lat.frameId, rec)
      await store.put('neg:' + lat.frameId, rec)
      await store.del(k) // latents are deleted once developed
      out.push(lat.frameId)
    }
    house.negatives = [...out, ...house.negatives.filter((f) => !out.includes(f))]
    store.saveHouse()
    stripFrames = out.length ? out : stripFrames
    selected = stripFrames[0] ?? null
    if (selected) lampS = suggestLamp(negOf(selected)!, sizeGain)
    washed = false
    drawStrip()
    return out
  }

  // ---------------------------------------------------------------- light box strip + DOM strip
  const thumbs = new Map<string, HTMLCanvasElement>()
  const negCanvas = (id: string, positive = false): HTMLCanvasElement | null => {
    const n = negs.get(id)
    if (!n) return null
    const c = document.createElement('canvas')
    c.width = n.w
    c.height = n.h
    const g = c.getContext('2d')!
    const img = g.createImageData(n.w, n.h)
    if (positive) {
      const tgt = exposePaper(negOf(id)!, suggestLamp(negOf(id)!), 2)
      renderPrint(tgt, () => 1, img.data)
    } else negativeImage(negOf(id)!, img.data, washed ? 0 : 1)
    g.putImageData(img, 0, 0)
    return c
  }
  const drawStrip = () => {
    const g = stripCanvas.getContext('2d')!
    g.fillStyle = '#fbf6ec'
    g.fillRect(0, 0, stripCanvas.width, stripCanvas.height)
    strip.replaceChildren()
    thumbs.clear()
    if (!stripFrames.length) {
      stripTex.needsUpdate = true
      strip.hidden = true
      return
    }
    strip.hidden = e.room !== 'darkroom'
    const n = stripFrames.length
    const fw = Math.min(140, (stripCanvas.width - 20) / n - 6)
    g.fillStyle = '#2a1f14'
    g.fillRect(8, 10, (fw + 6) * n + 4, 140)
    stripFrames.forEach((id, i) => {
      const c = negCanvas(id)
      if (!c) return
      const h = 120
      const w = Math.min(fw, (h * c.width) / c.height)
      g.drawImage(c, 12 + i * (fw + 6), 20, w, h)
      const t = document.createElement('canvas')
      t.width = c.width
      t.height = c.height
      t.getContext('2d')!.drawImage(c, 0, 0)
      t.setAttribute('role', 'button')
      t.setAttribute('aria-label', `Frame ${i + 1}`)
      t.setAttribute('aria-pressed', String(id === selected))
      t.tabIndex = 0
      // the loupe: hover or press shows the positive inside the frame
      const pos = negCanvas(id, true)
      const showPos = (on: boolean) => {
        const tg = t.getContext('2d')!
        tg.drawImage(on && pos ? pos : c, 0, 0)
      }
      t.addEventListener('pointerenter', () => showPos(true))
      t.addEventListener('pointerleave', () => showPos(false))
      t.addEventListener('click', () => {
        selected = id
        lampS = suggestLamp(negOf(id)!, sizeGain)
        for (const x of strip.querySelectorAll('canvas')) x.setAttribute('aria-pressed', String(x === t))
        Audio.play('ui.tick', {})
        refresh()
      })
      strip.appendChild(t)
      thumbs.set(id, t)
    })
    stripTex.needsUpdate = true
  }

  // ---------------------------------------------------------------- enlarger, paper, tray
  const fogNow = () => (roomOn ? 1.2 : 0)
  const exposeEnlargement = () => {
    if (!selected || exposedPaper || inTray) return
    const neg = negOf(selected)
    if (!neg) return
    lampOnAt = performance.now()
    lampSpot.intensity = 0.05
    hum = Audio.loop('studio.enlarger-hum', { level: 1 })
    Audio.play('enlarger.switch', {})
    easelPaper.visible = true
    const t = lampS
    window.setTimeout(() => {
      lampSpot.intensity = 0
      hum?.stop(0.1)
      Audio.play('enlarger.switch', {})
    }, e.quality.transitions ? Math.min(3000, t * 250) : 10)
    exposedPaper = { target: exposePaper(neg, t, grade, sizeGain, fogNow()), frameId: selected, kind: 'enlargement', lampS: t, grade, fog: fogNow() }
    refresh()
  }
  const contactTarget = (ids: string[], t: number): PrintTarget => {
    // 8 frames of 6×6 in 2 rows of 4 on 8×10 paper (fewer frames: one row)
    const cols = Math.min(4, ids.length)
    const rows = Math.ceil(ids.length / 4)
    const first = negOf(ids[0])!
    const cw = 128
    const chh = Math.round((128 * first.h) / first.w)
    const W = cols * (cw + 8) + 8
    const H = rows * (chh + 8) + 8
    const ch = first.channels
    const Dp = new Float32Array(W * H * ch).fill(0.05)
    ids.forEach((id, k) => {
      const n = negOf(id)
      if (!n) return
      const tg = exposePaper(n, t, grade, 1, fogNow())
      const ox = 8 + (k % 4) * (cw + 8)
      const oy = 8 + Math.floor(k / 4) * (chh + 8)
      for (let y = 0; y < chh; y++)
        for (let x = 0; x < cw; x++) {
          const sx = Math.floor((x / cw) * n.w)
          const sy = Math.floor((y / chh) * n.h)
          for (let c = 0; c < ch; c++) Dp[((oy + y) * W + ox + x) * ch + c] = tg.Dp[(sy * n.w + sx) * n.channels + Math.min(c, n.channels - 1)]
        }
    })
    return { w: W, h: H, channels: ch, Dp }
  }
  const exposeContact = () => {
    if (exposedPaper || inTray || !stripFrames.length) return
    Audio.play('glass.chord', {})
    const t = selected ? lampS : 8
    exposedPaper = { target: contactTarget(stripFrames, t), frameId: stripFrames[0], kind: 'contact', lampS: t, grade, fog: fogNow() }
    easelPaper.visible = true
    refresh()
  }
  const slideIntoTray = () => {
    if (!exposedPaper) return
    Audio.play('paper.flop', {})
    inTray = { target: exposedPaper.target, t: 0, rocked: 0, frameId: exposedPaper.frameId, kind: exposedPaper.kind, lampS: exposedPaper.lampS, grade: exposedPaper.grade, chimed: false }
    exposedPaper = null
    easelPaper.visible = false
    trayPrint.visible = true
    printCanvas.width = Math.min(256, inTray.target.w)
    printCanvas.height = Math.round((printCanvas.width * inTray.target.h) / inTray.target.w)
    slosh = Audio.loop('studio.tray-slosh', { energy: 0 })
    refresh()
  }
  const rock = (dir: number) => {
    trayTiltV += dir * 1.2
  }
  const progressAt = (x: number, y: number, w: number, h: number) => {
    if (!inTray) return 1
    const rocked = inTray.rocked > 0.5
    const tau = 4 * (rocked ? 1 : 1.6)
    const cx = Math.abs(x / w - 0.5) * 2
    const cy = Math.abs(y / h - 0.5) * 2
    const lag = rocked ? 1 : 1 + 0.4 * Math.min(1, cx * cy * 1.5)
    return 1 - Math.exp(-inTray.t / (tau * lag))
  }
  let printImg: ImageData | null = null
  const drawTray = () => {
    if (!inTray) return
    const p = inTray.target
    const g = printCanvas.getContext('2d')!
    // render at the canvas size by sampling the target
    const W = printCanvas.width
    const H = printCanvas.height
    if (!printImg || printImg.width !== W) printImg = g.createImageData(W, H)
    const small: PrintTarget = { w: W, h: H, channels: p.channels, Dp: new Float32Array(W * H * p.channels) }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const sx = Math.floor((x / W) * p.w)
        const sy = Math.floor((y / H) * p.h)
        for (let c = 0; c < p.channels; c++) small.Dp[(y * W + x) * p.channels + c] = p.Dp[(sy * p.w + sx) * p.channels + c]
      }
    renderPrint(small, (x, y) => progressAt(x, y, W, H), printImg.data, 1)
    g.putImageData(printImg, 0, 0)
    printTex.needsUpdate = true
  }
  const pullPrint = async (): Promise<string | null> => {
    if (!inTray) return null
    const it = inTray
    inTray = null
    slosh?.stop(0.3)
    slosh = null
    trayPrint.visible = false
    Audio.play('paper.peel', {})
    const id = await savePrint(it.target, it.frameId, it.kind, it.lampS, it.grade, it.t, (x, y) => {
      const rocked = it.rocked > 0.5
      const tau = 4 * (rocked ? 1 : 1.6)
      const cx = Math.abs(x / it.target.w - 0.5) * 2
      const cy = Math.abs(y / it.target.h - 0.5) * 2
      const lag = rocked ? 1 : 1 + 0.4 * Math.min(1, cx * cy * 1.5)
      return 1 - Math.exp(-it.t / (tau * lag))
    })
    hangOnLine(id)
    refresh()
    return id
  }
  const savePrint = async (tgt: PrintTarget, frameId: string, kind: 'contact' | 'enlargement', lamp: number, gr: number, devS: number, prog: (x: number, y: number) => number): Promise<string> => {
    const c = document.createElement('canvas')
    c.width = tgt.w
    c.height = tgt.h
    const g = c.getContext('2d')!
    const img = g.createImageData(tgt.w, tgt.h)
    renderPrint(tgt, prog, img.data)
    g.putImageData(img, 0, 0)
    let blob: Blob
    try {
      blob = await canvasToBlob(c, 'image/webp', 0.92)
    } catch {
      blob = await canvasToBlob(c, 'image/png')
    }
    const neg = negs.get(frameId)
    const rec = neg?.record
    const id = 'p' + Date.now().toString(36) + (house.prints.length % 1000)
    const dev = neg?.params
    const caption = rec?.tags[0] ?? ''
    const meta: PrintMeta = {
      id, frameId, kind, lampS: lamp, grade: gr, devS, w: tgt.w, h: tgt.h, caption, tags: rec?.tags ?? [],
      record: rec ?? ({} as PrintMeta['record']), createdAt: Date.now(), place: 'box',
    }
    ;(meta as PrintMeta & { logline?: string }).logline = rec
      ? `${PART_NAMES[rec.spec.body]?.split(' ')[0] ?? rec.spec.body} · ${rec.spec.f} mm ${fmtN(rec.spec.N)} · ${fmtShutter(rec.spec.t)} · ${STOCKS[rec.spec.stock].name.replace('Nightjar ', 'NJ ')} · ${fmtTime(rec.dayHours)}${dev ? ` · dev ${fmtDev(dev.chemSeconds)} @ ${Math.round(dev.tempC)}°` : ''}`
      : ''
    const pr: PrintRecord = { meta, image: blob }
    await store.put('print:' + id, pr)
    house.prints.unshift(id)
    store.saveHouse()
    e.bus.emit('print:made', { printId: id })
    api.onPrint?.(id)
    return id
  }
  const hangOnLine = (id: string) => {
    void store.get<PrintRecord>('print:' + id).then(async (pr) => {
      if (!pr) return
      const bmp = await createImageBitmap(pr.image)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      c.getContext('2d')!.drawImage(bmp, 0, 0)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      const k = lineGroup.children.length % 8
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, (0.22 * c.height) / c.width), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }))
      m.position.set(-4.4 + k * 0.5, -0.55 - (0.11 * c.height) / c.width, -3.19)
      lineGroup.add(m)
    })
  }

  const setRoomLight = (on: boolean) => {
    roomOn = on
    Audio.play('ui.switch', {})
    if (on && (exposedPaper || inTray)) st.shell.toast('Light on. The paper fogged.')
    if (on && exposedPaper) exposedPaper.target = { ...exposedPaper.target, Dp: exposedPaper.target.Dp.map((d) => Math.min(2.1, d + 1.2)) }
    if (on && inTray) inTray.target = { ...inTray.target, Dp: inTray.target.Dp.map((d) => Math.min(2.1, d + 1.2)) }
    refresh()
  }

  // ---------------------------------------------------------------- per-frame chemistry (real time)
  let refreshAcc = 0
  e.onFrame((dt) => {
    // thermometer needle lags τ = 2 s
    needleC += (tempC - needleC) * (1 - Math.exp(-dt / 2))
    // tank pendulum slosh: φ'' = −(g/r) sin(φ − φ_tank) − 1.5 φ'
    tankTilt *= Math.exp(-dt * 3)
    phiV += (-(9.81 / 0.04) * Math.sin(phi - tankTilt) - 1.5 * phiV) * dt
    phi += phiV * dt
    tank.rotation.z = tankTilt
    const a = Math.abs(phiV)
    if (step === 'developing') {
      const dChem = dt * CHEM_RATE
      chemS += dChem
      devIntegral += chem.devRate(needleC) * dChem
      cueT += dt
      if (cueT >= 3) {
        cueT -= 3
        cues++
        lastCueAt = e.sim.t
        cueOn = true
        window.setTimeout(() => (cueOn = false), 400)
      }
      if (a > 6) agitHigh += dt
      else agitHigh = 0
      if (agitHigh > 4) surge = 1
    }
    ;(cueLamp.material as THREE.MeshBasicMaterial).color.setRGB(cueOn ? 0.02 : 0.0004, cueOn ? 0.004 : 0.0001, 0)
    if (step === 'washing') {
      washT += dt
      if (washT > (e.quality.transitions ? 4 : 0.05)) finishWash()
    }
    // tray: modal slosh k = 1, 3 relaxing to the tilt equilibrium
    trayTiltV += (-trayTilt * 30 - trayTiltV * 4) * dt
    trayTilt += trayTiltV * dt
    trayTilt = THREE.MathUtils.clamp(trayTilt, -0.17, 0.17)
    tray.rotation.x = trayTilt
    const L = 0.3
    for (const [k, idx] of [[1, 0], [3, 2]] as const) {
      const kap = (k * Math.PI) / L
      const w = Math.sqrt(9.81 * kap * Math.tanh(kap * 0.02))
      const ck = (4 * L) / (k * k * Math.PI * Math.PI)
      modes[idx + 1] += (-w * w * (modes[idx] - ck * trayTilt) - 2 * 0.04 * w * modes[idx + 1]) * dt
      modes[idx] += modes[idx + 1] * dt
    }
    const A = Math.min(1, (Math.abs(modes[1]) + Math.abs(modes[3])) * 4)
    liquid.rotation.y = modes[0] * 2
    slosh?.set('energy', A)
    if (inTray) {
      inTray.t += dt * (e.quality.transitions ? 1 : 1)
      if (A > 0.08) inTray.rocked += dt
      drawTray()
      const u = progressAt(inTray.target.w / 2, inTray.target.h / 2, inTray.target.w, inTray.target.h)
      if (!inTray.chimed && u > 0.5) {
        inTray.chimed = true
        uiSound('develop')
        haptic(4)
      }
    }
    // room light ramps over 250 ms (no strobe)
    lightLevel += ((roomOn ? 1 : 0) - lightLevel) * Math.min(1, dt / 0.25)
    roomLight.intensity = 0.3 * lightLevel
    lbMat.color.setScalar(e.room === 'darkroom' ? 0.004 + 0.02 * lightLevel : 0.004)
    if (e.room === 'darkroom') {
      e.ambientLux = 0.5 + 200 * lightLevel + (lampSpot.intensity > 0 ? 3 : 0)
      refreshAcc += dt
      if (refreshAcc > 0.25) {
        refreshAcc = 0
        const t = card.querySelector('.st-timer')
        if (t) {
          const mm = Math.floor(chemS / 60)
          const ss = Math.floor(chemS % 60)
          t.innerHTML = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}<span class="st-cue${cueOn ? ' st-cue--on' : ''}"></span>`
        }
      }
    }
    void lampOnAt
  })

  // ---------------------------------------------------------------- 3D picking
  const pick = (o: THREE.Object3D, fn: () => void) => e.addPickable({ object: o, room: 'darkroom', on: (pe) => pe.kind === 'tap' && (fn(), true) })
  e.addPickable({
    object: tank,
    room: 'darkroom',
    on: (pe) => {
      if (pe.kind === 'tap') {
        if (step === 'idle') void loadTank()
        else if (step === 'developing') invert()
        return true
      }
      if (pe.kind === 'dragStart') return true
      if (pe.kind === 'drag') {
        if (step === 'developing' && Math.abs(pe.dy) > 4) {
          tankTilt = THREE.MathUtils.clamp(tankTilt - pe.dy * 0.04, -Math.PI, Math.PI)
          phiV += -pe.dy * 0.3
          if (Math.abs(tankTilt) > 2.5) invert()
        }
        return true
      }
      return pe.kind === 'dragEnd'
    },
  })
  pick(devJug, pourDev)
  pick(fixJug, fix)
  pick(faucet, () => (step === 'fixed' ? wash() : undefined))
  pick(sink, () => void pourOut())
  pick(sw, () => setRoomLight(!roomOn))
  pick(enlarger, () => (exposedPaper ? undefined : exposeEnlargement()))
  e.addPickable({
    object: tray,
    room: 'darkroom',
    on: (pe) => {
      if (pe.kind === 'tap') {
        if (exposedPaper) slideIntoTray()
        else rock(1)
        return true
      }
      if (pe.kind === 'dragStart') return true
      if (pe.kind === 'drag') {
        trayTilt = THREE.MathUtils.clamp(trayTilt + pe.dy * 0.004, -0.17, 0.17)
        trayTiltV = pe.dy * 0.2
        return true
      }
      return pe.kind === 'dragEnd'
    },
  })
  onGameKey((ev) => {
    if (e.room !== 'darkroom') return
    if (ev.code === 'Space') {
      ev.preventDefault()
      if (step === 'developing') invert()
      else if (selected && !exposedPaper && !inTray) exposeEnlargement()
    } else if (ev.code === 'ArrowUp' || ev.code === 'ArrowDown') {
      if (inTray) {
        rock(ev.code === 'ArrowUp' ? 1 : -1)
        ev.preventDefault()
        ev.stopPropagation()
      }
    }
  })

  // ---------------------------------------------------------------- room module
  const view: StationView = { kind: 'station', pos: new THREE.Vector3(-2.5, -0.92, -6.3), target: new THREE.Vector3(-2.45, -1.62, -3.4), fov: 55, yawLimitDeg: 20, pitchMinDeg: -20, pitchMaxDeg: 20 }
  // restore developed negatives for the strip (newest roll)
  void (async () => {
    const ids = house.negatives.slice(0, 8)
    for (const id of ids) {
      const n = await store.get<NegRecord>('neg:' + id)
      if (n) negs.set(id, n)
    }
    const newest = ids[0] ? ids[0].split(':')[0] : null
    stripFrames = ids.filter((id) => id.split(':')[0] === newest && negs.has(id)).sort((a, b) => Number(a.split(':')[1]) - Number(b.split(':')[1]))
    selected = stripFrames[0] ?? null
    if (selected) step = 'hung'
    drawStrip()
  })()

  api = {
    id: 'darkroom',
    view,
    ambientLux: () => 0.5,
    enter() {
      wrap.hidden = false
      strip.hidden = !stripFrames.length
      e.sunLight.visible = false
      e.moonLight.visible = false
      e.hemiScale = 0
      Audio.setMuffle(900)
      Audio.play('studio.stairs', {})
      if (step === 'hung' && !stripFrames.length) step = 'idle'
      if (step === 'hung' && house.pocket.length && !inTray && !exposedPaper) step = 'idle'
      refresh()
    },
    exit() {
      wrap.hidden = true
      hud.tray.replaceChildren()
      e.sunLight.visible = true
      e.moonLight.visible = true
      e.hemiScale = 1
      Audio.setMuffle(null)
    },
    update() {},
    step: () => step,
    onPrint: null,
    async develop(rollId, o = {}) {
      const id = rollId ?? house.pocket[0]
      if (!id) return { frames: [] }
      const r = await store.get<Roll>('roll:' + id)
      if (r) rollCache.set(id, r)
      house.pocket = house.pocket.filter((p) => p !== id)
      store.saveHouse()
      const stock = r?.stock ?? 'nj100'
      const T = o.tempC ?? (stock === 'colour200' ? 38 : 20)
      const rho = Math.pow(2, o.push ?? 0) * (stock === 'colour200' ? 1 : 1)
      const nominalS = STOCKS[stock].devNominalS
      const frames = await developRoll(id, { tempC: T, chemSeconds: (nominalS * rho) / chem.devRate(T), rho, cueRatio: o.cueRatio ?? 1, surge: 0, washed: true })
      if (r) {
        r.state = 'developed'
        void store.put('roll:' + id, r)
      }
      washed = true
      step = 'hung'
      tankRoll = null
      drawStrip()
      e.bus.emit('roll:developed', { rollId: id })
      refresh()
      return { frames }
    },
    async print(frameId, o = {}) {
      let n = negs.get(frameId)
      if (!n) {
        const rec = await store.get<NegRecord>('neg:' + frameId)
        if (rec) {
          negs.set(frameId, rec)
          n = rec
        }
      }
      if (!n) throw new Error('no negative ' + frameId)
      const neg = negOf(frameId)!
      const kind = o.kind ?? 'enlargement'
      const lamp = o.lampS ?? 8 // t_ref; the in-game timer pre-sets the pencil-mark suggestion instead
      const gr = o.grade ?? 2
      const tgt = kind === 'contact' ? contactTarget(stripFrames.length ? stripFrames : [frameId], lamp) : exposePaper(neg, lamp, gr, 1, 0)
      const id = await savePrint(tgt, frameId, kind, lamp, gr, 30, () => 1)
      hangOnLine(id)
      selected = frameId
      return id
    },
    async printPixels(printId) {
      const pr = await store.get<PrintRecord>('print:' + printId)
      if (!pr) return { w: 0, h: 0, mean: 0, brightFrac: 0 }
      const bmp = await createImageBitmap(pr.image)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const g = c.getContext('2d')!
      g.drawImage(bmp, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      return { w: c.width, h: c.height, ...printStats(d) }
    },
  }
  return api
}

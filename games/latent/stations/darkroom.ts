// Station 3: the darkroom bench (GDD §4.4, §7.2): film shelf (bag + tank), the enlarger and easel, and the
// three trays. Desktop shows all three panes; phones show one pane at a time (tabs or swipe).
import { PALETTES } from '@shared/dither'
import { clamp } from '@shared/core'
import type { App } from '../core/app'
import { S, setLights } from '../core/state'
import type { GamePointer, Station } from '../core/types'
import { LABELS, OPENING } from '../data/text'
import { FilmProcess, fmtTime } from '../film/process'
import { RED, crispText, gray, floatToCanvas, wrap } from '../render/screen'
import { CELL_MM, PH, PW, displayL, phiStar } from '../print/optics'
import type { PrintSession, TrayId } from '../print/session'

interface Rect { x: number; y: number; w: number; h: number }
const hit = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export interface DarkroomHooks {
  hang(): void
  newPaper(): void
  onExposeEnd(): void
  developed(): void
  legible(): void
}

export interface DarkroomStation extends Station {
  pane: number
  setPane(i: number): void
  chainPull(): void
  film: FilmProcess
  refresh(): void
}

const BEADS = 12

export function createDarkroomStation(app: App, ps: PrintSession, film: FilmProcess, hooks: DarkroomHooks): DarkroomStation {
  let w = 1, h = 1, phone = false
  let pane = 1
  const panes: Rect[] = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }]
  let easel: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let column: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let knob = { x: 0, y: 0, r: 16 }
  let bigTray: Rect = { x: 0, y: 0, w: 1, h: 1 }
  const small: Record<TrayId, Rect> = { dev: { x: 0, y: 0, w: 1, h: 1 }, stop: { x: 0, y: 0, w: 1, h: 1 }, fix: { x: 0, y: 0, w: 1, h: 1 } }
  let bag: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let tank: Rect = { x: 0, y: 0, w: 1, h: 1 }
  let safeR: Rect = { x: 0, y: 0, w: 1, h: 1 }
  // pull chain (Verlet) and the safelight pendulum
  const chain = { ax: 0, ay: 0, x: new Float32Array(BEADS), y: new Float32Array(BEADS), px: new Float32Array(BEADS), py: new Float32Array(BEADS), grab: -1, gx: 0, gy: 0, low: 0, latch: 0, armed: true }
  let pend = { th: 0.25, w: 0 }
  let drag: { kind: string; x: number; y: number; sx: number; sy: number; v0: number; v1: number; a0?: number } | null = null
  let printCanvas: HTMLCanvasElement | null = null
  let projCanvas: HTMLCanvasElement | null = null
  let trayCanvas: HTMLCanvasElement | null = null
  let projKey = ''
  let tokArmed = true
  let focuser = false
  let manualHold = false
  let spaceDown = 0
  let uiAcc = 0
  const lights = () => S.save.lights

  // ---------- DOM controls ----------
  const controls = document.createElement('div')
  controls.className = 'li-dr-controls'
  const tabs = document.createElement('div')
  tabs.className = 'li-tabs'
  ;['Film', 'Enlarger', 'Trays'].forEach((t, i) => { const b = chip(t, () => setPane(i)); b.dataset.pane = String(i); tabs.append(b) })
  const paneCtl = [document.createElement('div'), document.createElement('div'), document.createElement('div')]
  paneCtl.forEach((d, i) => { d.className = 'li-pane-ctrl'; d.dataset.pane = String(i) })
  controls.append(tabs, ...paneCtl)

  function chip(label: string, fn: () => void, o: { key?: string; cls?: string; hold?: (down: boolean) => void } = {}): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `li-chip ${o.cls ?? ''}`
    b.innerHTML = o.key ? `${label} <kbd>${o.key}</kbd>` : label
    if (o.hold) {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); o.hold!(true) })
      b.addEventListener('pointerup', () => o.hold!(false))
      b.addEventListener('pointerleave', () => o.hold!(false))
      b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fn() } })
    } else b.addEventListener('click', fn)
    return b
  }

  function rebuild(): void {
    // film pane
    const f = paneCtl[0]
    f.innerHTML = ''
    if (film.phase === 'none' || film.phase === 'done') {
      const p = document.createElement('p'); p.className = 'li-note'; p.textContent = 'No film on the shelf. Send a cassette from the light table.'
      f.append(p, chip('Light table', () => app.go('lighttable'), { key: '2' }))
    } else if (film.phase === 'shelf') f.append(chip(`Open the bag · roll ${film.roll}`, () => { film.openBag(); app.sfx('latent.bag-zip', { speed: 0.4 }); rebuild() }, { key: 'B', cls: 'li-primary' }))
    else if (film.phase === 'bag') {
      if (film.bag === 'cap') f.append(chip('Pop the cap', () => bagAction('cap'), { key: 'Space' }))
      if (film.bag === 'leader') f.append(chip(`Pull the leader ${film.leader}/3`, () => bagAction('leader'), { key: '↓' }))
      if (film.bag === 'wind') f.append(chip('◀ Left', () => bagStroke('L'), { key: '←' }), chip('Right ▶', () => bagStroke('R'), { key: '→' }))
      if (film.bag === 'close') f.append(chip('Close the tank', () => bagAction('close'), { key: 'Q', cls: 'li-primary' }))
    } else if (film.phase === 'tank') {
      f.append(chip('−15 s', () => { film.setDial(film.dial - 15); app.sfx('latent.timer-tick'); rebuild() }, { key: '↓' }))
      const t = document.createElement('span'); t.className = 'li-readout'; t.textContent = fmtTime(film.dial); f.append(t)
      f.append(chip('+15 s', () => { film.setDial(film.dial + 15); app.sfx('latent.timer-tick'); rebuild() }, { key: '↑' }))
      f.append(chip('Pour', () => { if (film.pour()) { app.sfx('latent.glug'); rebuild() } }, { key: 'Enter', cls: 'li-primary' }))
    } else if (film.phase === 'dev') {
      f.append(chip('Invert', invert, { key: 'I' }), chip('Rap', rap, { key: 'R' }), chip('Pour out', pourOut, { key: 'Enter', cls: film.elapsed >= film.dial ? 'li-primary' : '' }))
    }
    // enlarger pane
    const e = paneCtl[1]
    e.innerHTML = ''
    const g = document.createElement('div'); g.className = 'li-grades'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Paper grade')
    for (let i = 0; i <= 5; i++) { const b = chip(String(i), () => { ps.set({ grade: i as 0 }); app.sfx('latent.key'); rebuild() }); b.setAttribute('aria-pressed', String(ps.enl.grade === i)); b.title = i === 5 ? 'for ghosts' : `Grade ${i}`; g.append(b) }
    const tm = document.createElement('span'); tm.className = 'li-readout'; tm.textContent = `${ps.enl.timer} s`
    e.append(
      chip(ps.sheet && ps.sheet.where === 'easel' ? 'Paper on easel' : 'Paper', () => { hooks.newPaper(); rebuild() }, { cls: ps.sheet && ps.sheet.where === 'easel' ? 'li-dim' : '' }),
      chip(ps.enl.redFilter ? 'Red filter: in' : 'Red filter: out', () => toggleRed(), { key: 'F' }),
      chip(ps.enl.flip ? 'Flipped' : 'Flip', () => { ps.set({ flip: !ps.enl.flip }); app.sfx('latent.clunk'); rebuild() }, { key: 'X' }),
      g,
      chip('−', () => { ps.set({ timer: ps.enl.timer - 1 }); app.sfx('latent.timer-tick'); rebuild() }), tm, chip('+', () => { ps.set({ timer: ps.enl.timer + 1 }); app.sfx('latent.timer-tick'); rebuild() }),
      chip('Strip', () => startExpose(true)),
      chip('Expose', () => startExpose(false), { key: 'Space', cls: 'li-primary', hold: (down) => { if (down) { spaceDown = performance.now(); manualHold = false; setTimeout(() => { if (spaceDown && !ps.exposing) { manualHold = true; beginManual() } }, 300) } else { const was = spaceDown; spaceDown = 0; if (manualHold) endManual(); else if (was) startExpose(false) } } }),
      chip(ps.enl.tool === 'card' ? 'Tool: burn card' : 'Tool: dodge wand', () => { ps.enl.tool = ps.enl.tool === 'card' ? 'wand' : 'card'; app.sfx('latent.key'); rebuild() }, { key: 'C/Z' }),
      chip(focuser ? 'Focuser on' : 'Focuser', () => { focuser = !focuser; rebuild() }, { key: 'G' }),
      chip('Into DEV →', () => toTray('dev'), { key: 'D', cls: ps.sheet?.where === 'easel' && ps.sheet.exposed > 0 ? 'li-primary' : '' }),
    )
    // trays pane
    const t = paneCtl[2]
    t.innerHTML = ''
    const s = ps.sheet
    if (s && s.where !== 'easel') {
      const ph = trayPhase()
      t.append(chip('→ STOP', () => toTray('stop'), { cls: ph === 'toStop' ? 'li-primary' : '' }), chip('→ FIX', () => toTray('fix'), { cls: ph === 'toFix' ? 'li-primary' : '' }))
      if (s.where === 'fix') t.append(chip(s.F >= 1 ? 'Hang it' : `Fixing ${Math.round(s.F * 100)}%`, () => { if (s.F >= 1) hooks.hang() }, { key: 'H', cls: s.F >= 1 ? 'li-primary' : 'li-dim' }))
    } else {
      const p = document.createElement('p'); p.className = 'li-note'; p.textContent = S.save.flags.A && !S.save.stats.searches ? 'Print hung. Next: open the TERMINAL on the rail (key 1) and search the records.' : 'Drag the tray to rock it. W/S pitch, Q/E roll.'
      t.append(p)
    }
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number((b as HTMLElement).dataset.pane) === pane)))
    layoutCtl()
  }

  /** Where the sheet is in the dev, stop, fix routine: drives the next-step chip and hint line. */
  function trayPhase(): string {
    const s = ps.sheet
    if (!s || s.where === 'easel') return 'none'
    if (s.where === 'dev') return s.devTime >= 5 ? 'toStop' : 'rock'
    if (s.where === 'stop') return s.act < 0.5 ? 'toFix' : 'stopping'
    return s.F >= 1 ? 'hang' : 'fixing'
  }
  function trayHint(): string {
    switch (trayPhase()) {
      case 'rock': return 'Rock the tray (drag it, or W S Q E). Watch the image come up.'
      case 'toStop': return 'The image is up. Move the print to STOP.'
      case 'stopping': return 'Stopping the developer.'
      case 'toFix': return 'Now move it to FIX so the image stays.'
      case 'fixing': return 'Fixing. Keep the white light off.'
      case 'hang': return 'Fixed. Press Hang it, then look at the drying line.'
      default: return ''
    }
  }
  let lastPhase = ''
  function wrapChars(text: string, n: number): string[] {
    const out: string[] = []; let cur = ''
    for (const wd of text.split(' ')) { if (cur && (cur + ' ' + wd).length > n) { out.push(cur); cur = wd } else cur = cur ? cur + ' ' + wd : wd }
    if (cur) out.push(cur)
    return out
  }

  function layoutCtl(): void {
    tabs.hidden = !phone
    paneCtl.forEach((d, i) => {
      const r = panes[i]
      d.style.left = `${r.x}px`; d.style.width = `${r.w}px`
      d.hidden = (phone && i !== pane) || lights() === 'off' || (film.phase === 'bag' && i !== 0)
    })
  }

  function setPane(i: number): void { pane = clamp(i, 0, 2); layout(); rebuild() }

  function toggleRed(): void {
    ps.set({ redFilter: !ps.enl.redFilter })
    app.sfx('latent.relay')
    rebuild()
  }

  function startExpose(strip: boolean): void {
    if (ps.exposing || !ps.enl.ref) { if (!ps.enl.ref) app.toast('The carrier is empty. Pick a frame at the light table.'); return }
    if (!ps.sheet || ps.sheet.where !== 'easel') hooks.newPaper()
    ps.refreshT()
    ps.exposing = { left: strip ? ps.enl.timer * 5 : ps.enl.timer, strip: strip ? 1 : 0, stripT: 0, manual: false }
    ps.enl.lampOn = true
    app.sfx('latent.relay')
    app.loop('latent.enlarger-hum', { level: 1 })
  }
  function beginManual(): void {
    if (!ps.enl.ref) return
    if (!ps.sheet || ps.sheet.where !== 'easel') hooks.newPaper()
    ps.refreshT()
    ps.exposing = { left: 999, strip: 0, stripT: 0, manual: true }
    ps.enl.lampOn = true
    app.sfx('latent.relay'); app.loop('latent.enlarger-hum', { level: 1 })
  }
  function endManual(): void { if (ps.exposing?.manual) endExpose() }
  function endExpose(): void {
    ps.exposing = null; ps.enl.lampOn = false
    app.sfx('latent.relay'); app.stopLoop('latent.enlarger-hum')
    hooks.onExposeEnd()
    rebuild()
  }

  function toTray(t: TrayId): void {
    const s = ps.sheet
    if (!s) return
    if (t === 'dev' && s.where !== 'easel') return
    if (t !== 'dev' && s.where === 'easel') return
    ps.moveTo(t)
    app.sfx('latent.tok')
    app.sfx('latent.lap')
    if (phone) setPane(2)
    rebuild()
  }

  // ---------- film ----------
  function bagAction(a: 'cap' | 'leader' | 'close'): void {
    if (a === 'cap' && film.popCap()) app.sfx('latent.clunk')
    if (a === 'leader' && film.pullLeader()) app.sfx('latent.bag-zip', { speed: 0.8 })
    if (a === 'close' && film.closeTank()) { app.sfx('latent.lid'); app.haptic(30) }
    rebuild()
  }
  function bagStroke(side: 'L' | 'R'): void {
    const k = film.stroke(side, performance.now(), S.save.settings.steadyHands)
    if (!k) return
    if (k === 'kink') { app.sfx('latent.kink'); app.haptic(120) } else app.sfx('latent.bag-tick')
    if (film.bag === 'close') rebuild()
  }
  function invert(): void { if (film.invert()) { app.sfx('latent.glug'); film.tankAngle = Math.PI } }
  function rap(): void { if (film.rap()) app.sfx('latent.rap') }
  function pourOut(): void {
    const dev = film.pourOut()
    if (!dev) return
    app.sfx('latent.glug'); app.sfx('latent.drip')
    hooks.developed()
    rebuild()
  }

  // ---------- chain ----------
  function chainReset(): void {
    for (let i = 0; i < BEADS; i++) { chain.x[i] = chain.px[i] = chain.ax; chain.y[i] = chain.py[i] = chain.ay + i * 9 }
  }
  function chainPull(): void {
    const l = lights()
    if (l === 'off') { setLights('safe'); app.sfx('latent.clunk'); app.haptic(40); pend.w += 1.2 }
    else if (l === 'safe') { setLights('white'); app.screen.flash = app.reduced() ? 0.3 : 0.7; app.sfx('latent.clunk') }
    else { setLights('safe'); app.sfx('latent.clunk') }
    app.applyPalette()
    layout()
    rebuild()
  }

  // ---------- layout ----------
  function layout(): void {
    if (phone) {
      for (let i = 0; i < 3; i++) panes[i] = i === pane ? { x: 0, y: i === 0 ? 100 : 0, w, h: i === 0 ? h - 100 : h } : { x: -9999, y: 0, w, h }
    } else {
      const a = Math.round(w * 0.26), b = Math.round(w * 0.38)
      panes[0] = { x: 0, y: 0, w: a, h }; panes[1] = { x: a, y: 0, w: b, h }; panes[2] = { x: a + b, y: 0, w: w - a - b, h }
    }
    const P = panes[1]
    const top = phone ? 46 : 10
    const ctlH = phone ? 150 : 112
    const ew = Math.min(P.w * (phone ? 0.92 : 0.8), ((P.h - ctlH - top - 120) * 254) / 203)
    const eh = (ew * 203) / 254
    easel = { x: P.x + (P.w - ew) / 2 + (phone ? 0 : P.w * 0.05), y: P.y + P.h - ctlH - eh - 8, w: ew, h: eh }
    column = { x: easel.x - 34, y: top + 30, w: 16, h: easel.y + eh - top - 30 }
    knob = { x: column.x + 70, y: headY() + 30, r: 16 }
    safeR = { x: P.x + P.w * (phone ? 0.78 : 0.62), y: top, w: 50, h: 34 }
    chain.ax = safeR.x + 34; chain.ay = safeR.y + safeR.h
    if (lights() === 'off') { chain.ax = Math.round(w / 2 - 30); chain.ay = Math.round(h * 0.3 - 54) }
    chainReset()
    const T = panes[2]
    const tw = Math.min(T.w - 30, ((T.h - ctlH - 150) * 4) / 3)
    bigTray = { x: T.x + (T.w - tw) / 2, y: T.y + (phone ? 72 : 26), w: tw, h: (tw * 3) / 4 }
    const sw = Math.min(110, (T.w - 40) / 3)
    ;(['dev', 'stop', 'fix'] as TrayId[]).forEach((id, i) => { small[id] = { x: T.x + (T.w - sw * 3 - 20) / 2 + i * (sw + 10), y: bigTray.y + bigTray.h + 26, w: sw, h: sw * 0.62 } })
    const F = panes[0]
    bag = { x: F.x + 20, y: F.y + F.h * 0.38, w: Math.min(140, F.w * 0.5), h: 80 }
    tank = { x: F.x + F.w * 0.62, y: F.y + F.h * 0.36, w: 46, h: 76 }
    layoutCtl()
  }
  function headY(): number {
    const t = (Math.log(ps.enl.M) - Math.log(2)) / (Math.log(16) - Math.log(2))
    return easel.y - 80 - t * Math.max(60, easel.y - 160)
  }
  function easelToMm(x: number, y: number): [number, number] {
    return [((x - easel.x) / easel.w - 0.5) * PW * CELL_MM, ((y - easel.y) / easel.h - 0.5) * PH * CELL_MM]
  }

  // ---------- drawing helpers ----------
  function drawTrayView(g: CanvasRenderingContext2D): void {
    const s = ps.sheet
    const trId: TrayId = s && s.where !== 'easel' ? s.where : 'dev'
    const tr = ps.trays[trId]
    const fl = tr.fluid
    const cell = app.screen.cell
    const tw = Math.max(8, Math.round(bigTray.w / cell)), th = Math.max(6, Math.round(bigTray.h / cell))
    if (!trayCanvas) trayCanvas = document.createElement('canvas')
    if (trayCanvas.width !== tw || trayCanvas.height !== th) { trayCanvas.width = tw; trayCanvas.height = th }
    const tg = trayCanvas.getContext('2d')!
    const im = tg.createImageData(tw, th)
    const d = im.data
    const nx = fl.nx, ny = fl.ny
    const swing = Math.sin(pend.th)
    const inThis = s && s.where === trId
    const wetK = s && s.F < 1 ? 0.92 : 1
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const tx = (x + 0.5) / tw * 0.32 - 0.16, ty = (y + 0.5) / th * 0.24 - 0.12
      const gi = clamp(Math.floor((tx + 0.16) / 0.01), 0, nx - 1), gj = clamp(Math.floor((ty + 0.12) / 0.01), 0, ny - 1)
      const k = gj * nx + gi
      const hC = fl.h[k]
      const hx = fl.h[gj * nx + Math.min(nx - 1, gi + 1)] - fl.h[gj * nx + Math.max(0, gi - 1)]
      const hy = fl.h[Math.min(ny - 1, gj + 1) * nx + gi] - fl.h[Math.max(0, gj - 1) * nx + gi]
      let v = 0.2 // tray floor (dark enamel under the liquid)
      if (inThis) {
        const px = (tx + hx * 0.6 - s!.x) / 0.254 + 0.5, py = (ty + hy * 0.6 - s!.y) / 0.203 + 0.5
        if (px >= 0 && px < 1 && py >= 0 && py < 1) {
          const Dv = s!.D[Math.floor(py * PH) * PW + Math.floor(px * PW)] * wetK
          v = 0.92 * displayL(Dv)
        }
      }
      // liquid: darker where deep, a specular streak from the swinging safelight
      const depth = hC / 0.012
      v *= hC > 0.0005 ? 0.97 - 0.015 * Math.min(2, depth) : 1
      const spec = Math.max(0, (hx * (0.6 + swing) - hy) * 120)
      v = Math.min(1, v + spec * spec * 0.9)
      const c = Math.round(v * 255)
      const q = (y * tw + x) * 4
      d[q] = d[q + 1] = d[q + 2] = c; d[q + 3] = 255
    }
    tg.putImageData(im, 0, 0)
    // tray body and lip, tilted a little in perspective with the tilt
    const lift = tr.tiltY * 140, roll = tr.tiltX * 140
    g.fillStyle = gray(0.05)
    g.beginPath()
    g.moveTo(bigTray.x - 12 - roll * 0.2, bigTray.y - 12 - lift * 0.3)
    g.lineTo(bigTray.x + bigTray.w + 12 - roll * 0.2, bigTray.y - 12 + lift * 0.3 * 0)
    g.lineTo(bigTray.x + bigTray.w + 12 + roll * 0.2, bigTray.y + bigTray.h + 12 + lift * 0.3)
    g.lineTo(bigTray.x - 12 + roll * 0.2, bigTray.y + bigTray.h + 12)
    g.closePath(); g.fill()
    g.imageSmoothingEnabled = false
    g.drawImage(trayCanvas, bigTray.x, bigTray.y, bigTray.w, bigTray.h)
    g.imageSmoothingEnabled = true
  }

  function projection(): HTMLCanvasElement | null {
    if (!ps.neg) return null
    const key = `${ps.enl.ref?.roll}:${ps.enl.ref?.frame}:${ps.enl.M}:${ps.enl.cx}:${ps.enl.cy}:${ps.enl.flip}:${ps.enl.focus}:${ps.Tdirty}`
    if (key !== projKey || !projCanvas) {
      ps.refreshT(!!drag)
      projCanvas = floatToCanvas(ps.T, PW, PH, (t) => Math.min(1, 0.06 + Math.sqrt(t) * 1.15), projCanvas ?? undefined)
      projKey = `${ps.enl.ref?.roll}:${ps.enl.ref?.frame}:${ps.enl.M}:${ps.enl.cx}:${ps.enl.cy}:${ps.enl.flip}:${ps.enl.focus}:${ps.Tdirty}`
    }
    return projCanvas
  }

  const station: DarkroomStation = {
    id: 'darkroom',
    pane: 1,
    film,
    controls,
    setPane,
    chainPull,
    refresh: rebuild,
    palette: () => {
      if (film.phase === 'bag') return { ink: '#000000', light: S.save.settings.bagLights ? '#2a2a2a' : '#000000' }
      if (lights() === 'off') return { ink: '#000000', light: '#5a1a10' }
      return lights() === 'white' ? PALETTES.latentWhite : PALETTES.latentSafelight
    },
    enter() { rebuild(); app.loop('latent.room', { level: 0.8, rain: 0.4 }) },
    exit() { if (ps.exposing) endExpose() },
    update(dt) {
      // chain physics
      const g = 1500
      for (let i = 1; i < BEADS; i++) {
        if (i === chain.grab) continue
        const vx = (chain.x[i] - chain.px[i]) * 0.995, vy = (chain.y[i] - chain.py[i]) * 0.995
        chain.px[i] = chain.x[i]; chain.py[i] = chain.y[i]
        chain.x[i] += vx; chain.y[i] += vy + g * dt * dt
      }
      chain.x[0] = chain.ax; chain.y[0] = chain.ay
      if (chain.grab > 0) { chain.x[chain.grab] = chain.gx; chain.y[chain.grab] = chain.gy }
      for (let it = 0; it < 16; it++) for (let i = 0; i < BEADS - 1; i++) {
        const dx = chain.x[i + 1] - chain.x[i], dy = chain.y[i + 1] - chain.y[i]
        const dd = Math.hypot(dx, dy) || 1e-6
        const diff = (dd - 9) / dd
        const pin0 = i === 0 || i === chain.grab, pin1 = i + 1 === chain.grab
        if (pin0 && !pin1) { chain.x[i + 1] -= dx * diff; chain.y[i + 1] -= dy * diff }
        else if (!pin0 && pin1) { chain.x[i] += dx * diff; chain.y[i] += dy * diff }
        else if (!pin0 && !pin1) { chain.x[i] += dx * diff * 0.5; chain.y[i] += dy * diff * 0.5; chain.x[i + 1] -= dx * diff * 0.5; chain.y[i + 1] -= dy * diff * 0.5 }
      }
      const bottom = chain.grab > 0 ? chain.gy - (chain.ay + chain.grab * 9) : 0
      chain.latch = Math.max(0, chain.latch - dt)
      if (bottom > 20) { chain.low += dt; if (chain.low > 0.04 && chain.latch <= 0 && chain.armed) { chain.latch = 0.3; chain.armed = false; chainPull() } } else { chain.low = 0; if (bottom < 8) chain.armed = true }
      // safelight pendulum
      if (!app.reduced() && !S.save.settings.screenshotMode) { pend.w += (-(9.81 / 0.6) * Math.sin(pend.th) - 0.25 * pend.w) * dt; pend.th += pend.w * dt } else pend.th = 0
      // exposure timer
      if (ps.exposing) {
        const ex = ps.exposing
        if (!ps.enl.redFilter) ps.exposeStep(dt)
        if (ex.strip) ex.stripT += dt
        if (!ex.manual) { ex.left -= dt; if (Math.floor(ex.left + dt) !== Math.floor(ex.left)) app.sfx('latent.timer-tick'); if (ex.left <= 0) endExpose() }
      }
      // trays and chemistry
      const r = ps.step(dt, lights() === 'white')
      if (r.slap > 0.02) app.sfx('latent.lap')
      app.loop('latent.slosh', { energy: clamp(r.energy * 4000, 0, 1) })
      if (ps.sheet?.where === 'dev') app.loop('latent.cluster', { rho01: ps.rhoHint }); else app.stopLoop('latent.cluster')
      if (r.legibleNow) { hooks.legible(); rebuild() }
      const s = ps.sheet
      const phNow = trayPhase()
      if (phNow !== lastPhase) { lastPhase = phNow; rebuild() }
      uiAcc += dt
      if (uiAcc > 0.5) { uiAcc = 0; if ((s && s.where === 'fix' && s.F < 1) || film.phase === 'dev') rebuild() }
      // tray tok when the tilt comes back through rest fast
      for (const tr of Object.values(ps.trays)) {
        const sp = Math.hypot(tr.vX, tr.vY)
        if (Math.abs(tr.tiltX) + Math.abs(tr.tiltY) < 0.003 && sp > 0.5 && tokArmed) { app.sfx('latent.tok'); tokArmed = false }
        if (Math.abs(tr.tiltX) + Math.abs(tr.tiltY) > 0.02) tokArmed = true
      }
      // film
      if (film.tick(dt)) { app.sfx('latent.timer-bell') }
      film.tankAngle *= Math.exp(-dt * 3)
    },
    resize(W, H, ph) { w = W; h = H; phone = ph; layout(); rebuild() },
    drawLum(g) {
      const l = lights()
      if (film.phase === 'bag') {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h)
        if (S.save.settings.bagLights) { g.strokeStyle = gray(0.6); g.lineWidth = 2; g.strokeRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4); g.beginPath(); g.arc(w / 2, h / 2, 60, 0, Math.PI * 2); g.stroke() }
        return
      }
      if (l === 'off') {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h)
        drawChain(g, 1, 1.8)
        return
      }
      // walls, bench, the safelight's moving light
      const lx = safeR.x + 25 + Math.sin(pend.th) * 90
      const gr = g.createRadialGradient(lx, safeR.y + 60, 20, lx, safeR.y + 60, Math.max(w, h) * 0.9)
      gr.addColorStop(0, gray(l === 'white' ? 0.9 : 0.12)); gr.addColorStop(0.5, gray(l === 'white' ? 0.8 : 0.03)); gr.addColorStop(1, gray(l === 'white' ? 0.7 : 0))
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      g.fillStyle = gray(l === 'white' ? 0.6 : 0.1); g.fillRect(0, h * 0.72, w, 3)
      // ---- enlarger pane ----
      const P = panes[1]
      if (P.x > -1000) {
        g.fillStyle = gray(0.12); g.fillRect(column.x, column.y, column.w, column.h)
        const hy = headY()
        g.fillStyle = gray(0.22); g.fillRect(column.x - 6, hy - 50, 120, 46)
        g.fillStyle = gray(0.3); g.fillRect(column.x + 30, hy - 4, 50, 22)
        g.fillStyle = gray(0.16); g.fillRect(column.x + 40, hy + 18, 30, 16)
        // red filter arm
        g.fillStyle = gray(ps.enl.redFilter ? 0.5 : 0.25); g.fillRect(column.x + (ps.enl.redFilter ? 34 : 80), hy + 34, 42, 6)
        // focus knob
        knob = { x: column.x + 104, y: hy - 26, r: 15 }
        g.beginPath(); g.arc(knob.x, knob.y, knob.r, 0, Math.PI * 2); g.fillStyle = gray(0.4); g.fill()
        const ka = ps.enl.focus * Math.PI * 4
        g.strokeStyle = gray(0.05); g.lineWidth = 3; g.beginPath(); g.moveTo(knob.x, knob.y); g.lineTo(knob.x + Math.cos(ka) * 12, knob.y + Math.sin(ka) * 12); g.stroke()
        // light cone when the lamp is on
        if (ps.enl.lampOn || (ps.enl.redFilter && ps.enl.ref)) {
          g.fillStyle = gray(ps.enl.redFilter ? 0.14 : 0.35)
          g.beginPath(); g.moveTo(column.x + 50, hy + 34); g.lineTo(column.x + 60, hy + 34); g.lineTo(easel.x + easel.w, easel.y); g.lineTo(easel.x, easel.y); g.closePath(); g.fill()
        }
        // easel with blades, the sheet, the projection
        g.fillStyle = gray(0.1); g.fillRect(easel.x - 14, easel.y - 14, easel.w + 28, easel.h + 28)
        g.fillStyle = gray(0.45); g.fillRect(easel.x - 10, easel.y - 10, easel.w + 20, 8); g.fillRect(easel.x - 10, easel.y - 10, 8, easel.h + 20)
        const s = ps.sheet
        const onEasel = s && s.where === 'easel'
        g.fillStyle = gray(onEasel ? 0.82 : 0.2); g.fillRect(easel.x, easel.y, easel.w, easel.h)
        const pr = (ps.enl.redFilter && ps.enl.ref) || ps.enl.lampOn ? projection() : null
        if (pr) {
          g.globalAlpha = ps.enl.lampOn && !ps.enl.redFilter ? 1 : 0.9
          g.globalCompositeOperation = onEasel ? 'multiply' : 'source-over'
          g.drawImage(pr, easel.x, easel.y, easel.w, easel.h)
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1
          if (ps.exposing?.strip) { const f = Math.min(1, (Math.floor(ps.exposing.stripT / ps.enl.timer) + 1) / 5); g.fillStyle = gray(0.05); g.fillRect(easel.x + easel.w * f, easel.y, easel.w * (1 - f), easel.h) }
        }
        // dodging/burning tool shadow
        if (ps.tool.on && (ps.enl.lampOn || ps.enl.redFilter)) {
          const sx = easel.x + easel.w / 2 + (ps.tool.x / (PW * CELL_MM)) * easel.w, sy = easel.y + easel.h / 2 + (ps.tool.y / (PH * CELL_MM)) * easel.h
          const scale = easel.w / (PW * CELL_MM)
          const z = ps.enl.toolZ
          if (ps.enl.tool === 'card') {
            const R = (10 / (1 - z)) * scale
            g.save(); g.beginPath(); g.rect(easel.x, easel.y, easel.w, easel.h); g.arc(sx, sy, R, 0, Math.PI * 2, true); g.fillStyle = gray(0.06); g.globalAlpha = 0.85; g.fill('evenodd'); g.restore()
          } else {
            const R = (12 / (1 - z)) * scale, pw = ((6.25 * z) / (1 - z)) * scale
            const rg = g.createRadialGradient(sx, sy, Math.max(0, R - pw / 2), sx, sy, R + pw / 2)
            rg.addColorStop(0, 'rgba(10,10,10,0.9)'); rg.addColorStop(1, 'rgba(10,10,10,0)')
            g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, R + pw / 2, 0, Math.PI * 2); g.fill()
            g.strokeStyle = 'rgba(10,10,10,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 300, sy + 300); g.stroke()
          }
        }
        // grain focuser inset (8×)
        if (focuser && ps.neg && ps.enl.redFilter) {
          const fx = easel.x + easel.w * 0.5, fy = easel.y + easel.h * 0.5
          const r = 46
          const off = Math.abs(ps.enl.focus - phiStar(ps.enl.M))
          g.save(); g.beginPath(); g.arc(fx, fy, r, 0, Math.PI * 2); g.clip()
          g.fillStyle = gray(0.1); g.fillRect(fx - r, fy - r, r * 2, r * 2)
          const n = 24
          for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const pi = PW / 2 + (i - n / 2) / 8, pj = PH / 2 + (j - n / 2) / 8
            const nxm = ps.enl.cx + ((pi - PW / 2) * CELL_MM * (ps.enl.flip ? -1 : 1)) / ps.enl.M, nym = ps.enl.cy + ((pj - PH / 2) * CELL_MM) / ps.enl.M
            let D = 2
            if (nxm >= 0 && nxm <= 36 && nym >= 0 && nym <= 24) D = ps.neg.density(nxm, nym, (CELL_MM / ps.enl.M) / 8)
            const blurMix = Math.min(1, off * 25)
            const v = Math.min(1, Math.sqrt(Math.pow(10, -D)) * 1.2) * (1 - blurMix) + 0.35 * blurMix
            g.fillStyle = gray(v); g.fillRect(fx - r + (i * 2 * r) / n, fy - r + (j * 2 * r) / n, (2 * r) / n + 0.5, (2 * r) / n + 0.5)
          }
          g.restore()
        }
        // paper safe and the timer
        g.fillStyle = gray(0.3); g.fillRect(easel.x + easel.w - 70, easel.y - 64, 70, 40)
        drawChain(g, 0.6)
        g.fillStyle = gray(0.28); g.fillRect(safeR.x, safeR.y - 8, 2, 8)
        g.save(); g.translate(safeR.x + 25, safeR.y); g.rotate(pend.th * 0.4); g.fillStyle = gray(l === 'white' ? 0.4 : 0.9); g.fillRect(-25, 0, 50, safeR.h); g.restore()
      }
      // ---- film pane ----
      const F = panes[0]
      if (F.x > -1000) {
        g.fillStyle = gray(0.3); g.fillRect(F.x + 10, F.y + F.h * 0.52, F.w - 20, 8)
        g.fillStyle = gray(0.08); roundRect(g, bag.x, bag.y, bag.w, bag.h, 14); g.fill()
        g.fillStyle = gray(0.16); g.fillRect(bag.x + 18, bag.y + 30, 26, 30); g.fillRect(bag.x + bag.w - 44, bag.y + 30, 26, 30)
        g.save(); g.translate(tank.x + tank.w / 2, tank.y + tank.h / 2); g.rotate(film.tankAngle); g.fillStyle = gray(0.42); g.fillRect(-tank.w / 2, -tank.h / 2, tank.w, tank.h); g.fillStyle = gray(0.2); g.fillRect(-tank.w / 2 - 4, -tank.h / 2 - 6, tank.w + 8, 10); g.restore()
        g.fillStyle = gray(0.35); g.fillRect(F.x + F.w * 0.36, F.y + F.h * 0.4, 30, 44)
        if (film.phase === 'shelf') { g.fillStyle = gray(0.55); g.fillRect(F.x + 30, F.y + F.h * 0.52 - 30, 22, 30) }
        g.fillStyle = gray(1); g.fillRect(F.x + 14, F.y + 20, F.w - 28, Math.min(150, F.h * 0.26))
        g.fillStyle = gray(0.14); g.fillRect(F.x + 14, F.y + F.h * 0.6, F.w - 28, 40)
      }
      // ---- trays pane ----
      const T = panes[2]
      if (T.x > -1000) {
        drawTrayView(g)
        for (const id of ['dev', 'stop', 'fix'] as TrayId[]) {
          const r = small[id]
          g.fillStyle = gray(0.04); g.fillRect(r.x, r.y, r.w, r.h)
          g.fillStyle = gray(ps.sheet?.where === id ? 0.95 : 0.6); g.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10)
        }
      }
    },
    drawCrisp(g) {
      const l = lights()
      const pal = station.palette()
      if (film.phase === 'bag') {
        // the reel's luminous dot (#7DFF9A at 6%) and nothing else
        const a = (film.k / film.target) * Math.PI * 2
        g.fillStyle = 'rgba(125,255,154,0.06)'
        g.beginPath(); g.arc(w / 2 + Math.cos(a) * 30, h / 2 + Math.sin(a) * 30, 6, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(125,255,154,0.05)'
        crispText(g, film.bag === 'wind' ? `WIND ${film.k}/${film.target}: TAP LEFT, RIGHT, LEFT...` : film.bag === 'cap' ? 'POP THE CAP' : film.bag === 'leader' ? 'PULL THE LEADER (3x)' : 'CLOSE THE TANK', w / 2, h / 2 + 70, 13, 'rgba(125,255,154,0.5)', { align: 'center' })
        return
      }
      if (l === 'off') {
        crispText(g, OPENING.pull + ' THE CHAIN', chain.ax + 24, chain.ay + 108, phone ? 22 : 20, PALETTES.latentTerminal.light, { weight: 600 })
        return
      }
      const ink = pal.ink, light = pal.light
      const P = panes[1]
      if (P.x > -1000) {
        // the card taped to the column (cursive, manila)
        if (!S.save.tutorialDone) {
          const cx = Math.max(P.x + 6, column.x - 150), cy = column.y + 40
          g.fillStyle = light; g.fillRect(cx, cy, 160, 92)
          g.font = "600 17px 'Caveat Variable', cursive"
          const lines = wrap(g, phone ? 'Start here. The first print is already in the easel. Tap Into DEV, rock the tray gently, and wait for it. — R.K.' : OPENING.startCard, 148)
          lines.forEach((s, i) => crispText(g, s, cx + 6, cy + 18 + i * 16, 17, ink, { font: 'hand', weight: 600 }))
        }
        crispText(g, `M ${ps.enl.M.toFixed(1)}×  GRADE ${ps.enl.grade}  ${ps.enl.timer} s${ps.enl.flip ? '  FLIP' : ''}`, easel.x, easel.y - 22, 12, light)
        crispText(g, ps.enl.ref ? `R${ps.enl.ref.roll}/F${ps.enl.ref.frame}` : 'CARRIER EMPTY', easel.x + easel.w, easel.y - 22, 12, light, { align: 'right' })
        crispText(g, 'SAFE', easel.x + easel.w - 35, easel.y - 40, 10, ink, { align: 'center' })
        if (ps.exposing) crispText(g, ps.exposing.manual ? 'HOLD' : `${Math.ceil(ps.exposing.left)}`, easel.x + easel.w / 2, easel.y + easel.h / 2, 28, RED, { align: 'center', weight: 600 })
        if (ps.sheet?.where === 'easel' && ps.sheet.exposed > 0 && !ps.exposing) crispText(g, `EXPOSED ${ps.sheet.exposed.toFixed(1)} s`, easel.x, easel.y + easel.h + 18, 11, light)
      }
      const F = panes[0]
      if (F.x > -1000) {
        const fs = Math.max(10, Math.min(12, (F.w - 40) / 40))
        LABELS.chart.forEach((s, i) => crispText(g, s, F.x + 22, F.y + 40 + i * (fs + 6), fs, ink, { max: F.w - 40 }))
        crispText(g, LABELS.chartPencil, F.x + 22, F.y + 40 + 5 * (fs + 6) + 4, fs, ink, { max: F.w - 40 })
        crispText(g, LABELS.tank[0], tank.x + tank.w / 2, tank.y + tank.h + 16, 10, light, { align: 'center' })
        if (film.phase === 'tank' || film.phase === 'dev') {
          crispText(g, film.phase === 'dev' ? `${fmtTime(film.elapsed)} / ${fmtTime(film.dial)}` : `DIAL ${fmtTime(film.dial)}`, tank.x + tank.w / 2, tank.y - 16, 14, light, { align: 'center', weight: 600 })
          if (film.phase === 'dev') crispText(g, `INVERSIONS ${film.inversions}${film.rapped ? ' · RAPPED' : ''}`, tank.x + tank.w / 2, tank.y + tank.h + 46, 10, light, { align: 'center' })
        }
        if (film.phase === 'shelf') crispText(g, `ROLL ${film.roll}`, F.x + 41, F.y + F.h * 0.52 - 36, 10, light, { align: 'center' })
        crispText(g, 'CHANGING BAG', bag.x + bag.w / 2, bag.y + bag.h + 16, 10, light, { align: 'center' })
      }
      const T = panes[2]
      if (T.x > -1000) {
        const s = ps.sheet
        for (const [i, id] of (['dev', 'stop', 'fix'] as TrayId[]).entries()) {
          const r = small[id]
          crispText(g, LABELS.trays[i], r.x + r.w / 2, r.y + r.h + 16, 13, light, { align: 'center', weight: 600 })
        }
        if (s && s.where !== 'easel') {
          const hint = trayHint()
          if (hint) { wrapChars(hint, Math.floor((T.w - 24) / 8)).forEach((ln, i) => crispText(g, ln, T.x + T.w / 2, small.dev.y + small.dev.h + 44 + i * 16, 13, RED, { align: 'center', weight: 600 })) }
          const label = s.where === 'dev' ? `DEV ${Math.floor(s.devTime)} s` : s.where === 'stop' ? 'STOP' : `FIX ${Math.round(s.F * 100)}%`
          crispText(g, label, bigTray.x, bigTray.y - 6, 13, light, { weight: 600 })
          if (s.F >= 1 && s.legible) {
            const ok = s.legible.filter((x) => x.pass)
            if (ok.length) { g.strokeStyle = RED; g.lineWidth = 3; g.strokeRect(bigTray.x + bigTray.w - 112, bigTray.y + 10, 100, 30); crispText(g, LABELS.stamp, bigTray.x + bigTray.w - 62, bigTray.y + 31, 16, RED, { align: 'center', weight: 600 }) }
          }
          if (s.fogged) crispText(g, 'FOGGED', bigTray.x + 10, bigTray.y + bigTray.h - 10, 13, RED, { weight: 600 })
        } else crispText(g, 'wait for it', bigTray.x + bigTray.w - 90, bigTray.y - 6, 18, light, { font: 'hand', weight: 600 })
      }
    },
    pointer(p: GamePointer) {
      const l = lights()
      if (film.phase === 'bag') {
        if (p.type === 'down') {
          if (film.bag === 'cap') bagAction('cap')
          else if (film.bag === 'leader') bagAction('leader')
          else if (film.bag === 'wind') bagStroke(p.x < w / 2 ? 'L' : 'R')
          else if (film.bag === 'close') bagAction('close')
        }
        return true
      }
      // the chain
      if (p.type === 'down') {
        for (let i = BEADS - 1; i > 0; i--) if (Math.hypot(p.x - chain.x[i], p.y - chain.y[i]) < 24) { chain.grab = i; chain.gx = p.x; chain.gy = p.y; drag = { kind: 'chain', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: 0, v1: 0 }; return true }
        if (l === 'off') return true
      }
      if (drag?.kind === 'chain') {
        if (p.type === 'move') { chain.gx = p.x; chain.gy = Math.min(p.y, chain.ay + (BEADS - 1) * 9 + 60); return true }
        if (p.type === 'up' || p.type === 'cancel') { chain.grab = -1; chain.armed = true; drag = null; return true }
      }
      if (l === 'off') return true
      // phone: horizontal swipe on empty space changes pane
      if (p.type === 'down') {
        const s = ps.sheet
        if (hit({ x: knob.x - 24, y: knob.y - 24, w: 48, h: 48 }, p.x, p.y)) { drag = { kind: 'knob', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: ps.enl.focus, v1: 0, a0: Math.atan2(p.y - knob.y, p.x - knob.x) }; return true }
        if (hit({ x: column.x - 10, y: headY() - 56, w: 130, h: 60 }, p.x, p.y)) { drag = { kind: 'head', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: ps.enl.M, v1: 0 }; return true }
        if (hit({ x: easel.x + easel.w - 70, y: easel.y - 64, w: 70, h: 40 }, p.x, p.y)) { hooks.newPaper(); rebuild(); return true }
        if (hit(easel, p.x, p.y)) {
          if (ps.enl.lampOn && !ps.enl.redFilter) { setTool(p); return true }
          if (ps.enl.redFilter && ps.enl.ref && !ps.exposing) { drag = { kind: 'crop', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: ps.enl.cx, v1: ps.enl.cy }; return true }
          if (s && s.where === 'easel' && s.exposed > 0) { drag = { kind: 'sheet', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: 0, v1: 0 }; return true }
          return true
        }
        if (hit(bigTray, p.x, p.y)) { const tr = ps.trays[s && s.where !== 'easel' ? s.where : 'dev']; drag = { kind: 'tray', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: tr.targetX, v1: tr.targetY }; return true }
        for (const id of ['dev', 'stop', 'fix'] as TrayId[]) if (hit(small[id], p.x, p.y)) { toTray(id); return true }
        if (hit(bag, p.x, p.y) && film.phase === 'shelf') { film.openBag(); app.sfx('latent.bag-zip', { speed: 0.4 }); rebuild(); return true }
        if (hit(tank, p.x, p.y)) {
          if (film.phase === 'tank') { film.pour() && app.sfx('latent.glug'); rebuild() }
          else if (film.phase === 'dev') { drag = { kind: 'tank', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: 0, v1: 0 } }
          return true
        }
        if (hit({ x: safeR.x - 10, y: safeR.y, w: 70, h: 50 }, p.x, p.y)) { pend.w += 2; return true }
        drag = { kind: 'swipe', x: p.x, y: p.y, sx: p.x, sy: p.y, v0: 0, v1: 0 }
        return true
      }
      if (p.type === 'move') {
        if (ps.enl.lampOn && !ps.enl.redFilter && hit(easel, p.x, p.y)) setTool(p)
        else if (p.pointerType === 'mouse' && !drag) ps.tool.on = false
        if (!drag) return false
        const d = drag
        if (d.kind === 'knob') { const a = Math.atan2(p.y - knob.y, p.x - knob.x); let da = a - (d.a0 ?? a); if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; d.a0 = a; ps.set({ focus: ps.enl.focus + da / (Math.PI * 4) }); if (Math.abs(ps.enl.focus - phiStar(ps.enl.M)) < 0.012) app.sfx('latent.timer-tick', { gain: 0.3 }) }
        if (d.kind === 'head') { const dy = p.y - d.sy; ps.set({ M: clamp(d.v0 * Math.pow(2, -dy / 120), 2, 16) }) }
        if (d.kind === 'crop') {
          const mmx = ((p.x - d.sx) / easel.w) * PW * CELL_MM, mmy = ((p.y - d.sy) / easel.h) * PH * CELL_MM
          ps.set({ cx: d.v0 - (mmx * (ps.enl.flip ? -1 : 1)) / ps.enl.M, cy: d.v1 - mmy / ps.enl.M })
        }
        if (d.kind === 'tray') {
          const s = ps.sheet
          const tr = ps.trays[s && s.where !== 'easel' ? s.where : 'dev']
          const deg = Math.PI / 180
          tr.targetX = clamp(d.v0 + (p.x - d.sx) * 0.05 * deg, -8 * deg, 8 * deg)
          tr.targetY = clamp(d.v1 + (p.y - d.sy) * 0.05 * deg, -8 * deg, 8 * deg)
        }
        if (d.kind === 'tank') { film.tankAngle = clamp((d.sy - p.y) / 60, 0, Math.PI); if (film.tankAngle > 2.6 && d.v1 === 0) { d.v1 = 1; invert() } }
        d.x = p.x; d.y = p.y
        return true
      }
      if (p.type === 'up' || p.type === 'cancel') {
        const d = drag
        drag = null
        if (p.pointerType === 'touch') ps.tool.on = false
        if (!d) return false
        if (d.kind === 'crop' || d.kind === 'head' || d.kind === 'knob') { ps.Tdirty = true; projKey = '' }
        if (d.kind === 'tray') { const s = ps.sheet; const tr = ps.trays[s && s.where !== 'easel' ? s.where : 'dev']; tr.targetX = 0; tr.targetY = 0 }
        if (d.kind === 'tank' && d.v1 === 0 && Math.hypot(p.x - d.sx, p.y - d.sy) < 8) rap()
        if (d.kind === 'sheet') {
          for (const id of ['dev'] as TrayId[]) if (hit(small[id], p.x, p.y) || hit(bigTray, p.x, p.y)) toTray(id)
        }
        if (d.kind === 'swipe' && phone && Math.abs(p.x - d.sx) > 60 && Math.abs(p.x - d.sx) > Math.abs(p.y - d.sy) * 1.5) setPane(pane + (p.x < d.sx ? 1 : -1))
        return true
      }
      if (p.type === 'dbl' && ps.sheet && ps.sheet.where !== 'easel' && hit(bigTray, p.x, p.y)) { ps.sheet = null; app.sfx('latent.kink'); rebuild(); return true }
      return false
    },
    wheel(dy, x, y, shift) {
      if (lights() === 'off' || film.phase === 'bag') return false
      if (shift || hit({ x: knob.x - 30, y: knob.y - 30, w: 60, h: 60 }, x, y)) { ps.set({ focus: ps.enl.focus - dy * 0.0004 }); return true }
      if (ps.enl.lampOn && hit(easel, x, y)) { ps.enl.toolZ = clamp(ps.enl.toolZ + dy * 0.0006, 0.05, 0.6); return true }
      if (hit({ x: column.x - 20, y: column.y, w: 140, h: column.h }, x, y)) { ps.set({ M: clamp(ps.enl.M * Math.pow(2, -dy / 800), 2, 16) }); return true }
      return false
    },
    key(e) {
      const k = e.code
      if (k === 'KeyL') { chainPull(); return true }
      if (lights() === 'off') return false
      if (film.phase === 'bag') {
        if (k === 'Space') { bagAction('cap'); return true }
        if (k === 'ArrowDown' || k === 'KeyS') { bagAction('leader'); return true }
        if (k === 'ArrowLeft' || k === 'KeyA') { if (!e.repeat) bagStroke('L'); return true }
        if (k === 'ArrowRight' || k === 'KeyD') { if (!e.repeat) bagStroke('R'); return true }
        if (k === 'KeyQ') { bagAction('close'); return true }
        return true
      }
      if (k === 'KeyB' && film.phase === 'shelf') { film.openBag(); rebuild(); return true }
      if (film.phase === 'tank' && (k === 'ArrowUp' || k === 'ArrowDown')) { film.setDial(film.dial + (k === 'ArrowUp' ? 15 : -15)); app.sfx('latent.timer-tick'); rebuild(); return true }
      if (k === 'Enter' && film.phase === 'tank') { if (film.pour()) app.sfx('latent.glug'); rebuild(); return true }
      if (k === 'Enter' && film.phase === 'dev') { pourOut(); return true }
      if (k === 'KeyI' && film.phase === 'dev') { invert(); return true }
      if (k === 'KeyR' && film.phase === 'dev') { rap(); return true }
      if (k === 'KeyF') { toggleRed(); return true }
      if (k === 'KeyX') { ps.set({ flip: !ps.enl.flip }); app.sfx('latent.clunk'); rebuild(); return true }
      if (k === 'KeyG') { focuser = !focuser; rebuild(); return true }
      if (k === 'KeyZ' || k === 'KeyV') { ps.enl.tool = 'wand'; rebuild(); return true }
      if (k === 'KeyC') { ps.enl.tool = 'card'; rebuild(); return true }
      if (e.shiftKey && /^Digit[0-5]$/.test(k)) { ps.set({ grade: Number(k.slice(5)) as 0 }); rebuild(); return true }
      if (k === 'Equal' || k === 'NumpadAdd') { ps.set({ M: ps.enl.M * 1.08 }); return true }
      if (k === 'Minus' || k === 'NumpadSubtract') { ps.set({ M: ps.enl.M / 1.08 }); return true }
      if (k === 'Comma') { ps.set({ focus: ps.enl.focus - 0.004 }); return true }
      if (k === 'Period') { ps.set({ focus: ps.enl.focus + 0.004 }); return true }
      if (k === 'ArrowUp' && !ps.sheet?.where.match(/dev|stop|fix/)) { ps.set({ timer: ps.enl.timer + 1 }); rebuild(); return true }
      if (k === 'ArrowDown' && !ps.sheet?.where.match(/dev|stop|fix/)) { ps.set({ timer: ps.enl.timer - 1 }); rebuild(); return true }
      if (k === 'Space') {
        if (e.type === 'keydown' && !e.repeat) { startExpose(false) }
        return true
      }
      if (k === 'KeyD' && ps.sheet?.where === 'easel') { toTray('dev'); return true }
      if (k === 'KeyH' && ps.sheet?.where === 'fix') { if (ps.sheet.F >= 1) hooks.hang(); return true }
      const deg = Math.PI / 180
      const s = ps.sheet
      if (s && s.where !== 'easel') {
        const tr = ps.trays[s.where]
        if (k === 'KeyW') { tr.targetY = -6 * deg; setTimeout(() => (tr.targetY = 0), 450); return true }
        if (k === 'KeyS') { tr.targetY = 6 * deg; setTimeout(() => (tr.targetY = 0), 450); return true }
        if (k === 'KeyQ') { tr.targetX = -6 * deg; setTimeout(() => (tr.targetX = 0), 450); return true }
        if (k === 'KeyE') { tr.targetX = 6 * deg; setTimeout(() => (tr.targetX = 0), 450); return true }
      }
      return false
    },
    layout() {
      return {
        chain: [chain.x[BEADS - 1], chain.y[BEADS - 1]], easel: [easel.x + easel.w / 2, easel.y + easel.h / 2], tray: [bigTray.x + bigTray.w / 2, bigTray.y + bigTray.h / 2],
        dev: [small.dev.x + small.dev.w / 2, small.dev.y + small.dev.h / 2], stop: [small.stop.x + small.stop.w / 2, small.stop.y + small.stop.h / 2], fix: [small.fix.x + small.fix.w / 2, small.fix.y + small.fix.h / 2],
        bag: [bag.x + bag.w / 2, bag.y + bag.h / 2], tank: [tank.x + tank.w / 2, tank.y + tank.h / 2], knob: [knob.x, knob.y], head: [column.x + 50, headY() - 30],
      }
    },
  }

  function setTool(p: GamePointer): void {
    const off = p.pointerType === 'touch' ? 40 : 0
    const [x, y] = easelToMm(p.x, p.y - off)
    ps.tool = { x, y, on: true }
  }
  function drawChain(g: CanvasRenderingContext2D, v: number, sc = 1): void {
    g.strokeStyle = gray(v * 0.7); g.lineWidth = 1.5 * sc
    g.beginPath(); g.moveTo(chain.x[0], chain.y[0])
    for (let i = 1; i < BEADS; i++) g.lineTo(chain.x[i], chain.y[i])
    g.stroke()
    for (let i = 0; i < BEADS; i++) { g.beginPath(); g.arc(chain.x[i], chain.y[i], (i === BEADS - 1 ? 6 : 3.2) * sc, 0, Math.PI * 2); g.fillStyle = gray(v); g.fill() }
  }
  function roundRect(g: CanvasRenderingContext2D, x: number, y: number, ww: number, hh: number, r: number): void {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath()
  }
  return station
}

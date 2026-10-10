// Input router (texturedle.md §4): touch the thing to move the thing, touch the
// world to tilt the world. No tool modes. Hit order on press inside the viewer:
// bezel ring → marble → cloths → bare surface. Pointer Events only.

import { onGameKey, trackKeys } from '@shared/core'
import type { Bench, ClothKind, Renderer, Vec2 } from '../contracts'
import type { BenchExtras } from '../sim/bench'

export interface InputHost {
  bench: Bench & BenchExtras
  renderer: Renderer
  frameEl: HTMLElement
  bezelEl: HTMLElement
  lampEl: HTMLButtonElement
  focusEl: HTMLElement
  tray: { dish: HTMLElement; lens: HTMLElement; burlap: HTMLElement }
  enabled(): boolean
  onActivity(): void
  setLamp(azDeg: number): void
  getLamp(): number
  toggleLampMode(): void
  nudgeFocus(dzMm: number): void
  autoFocus(): void
  togglePeaking(): void
  hover(x: number, y: number): void
  focusGuess(): void
  openHelp(): void
  stroke(kind: ClothKind, x: number, y: number): void
  probeUsed(k: 'tilt' | 'marble' | 'lens' | 'burlap'): void
}

export interface Input { tiltTarget: Vec2; tiltLock: boolean; frame(dt: number): void; dispose(): void }

interface Sample { t: number; x: number; y: number }

export function createInput(H: InputHost): Input {
  const b = H.bench
  let mode: 'none' | 'tilt' | 'marble' | 'cloth' | 'lamp' | 'focus' = 'none'
  let pid = -1
  let px0 = 0, py0 = 0
  let tilt0: Vec2 = { x: 0, y: 0 }
  const tiltTarget: Vec2 = { x: 0, y: 0 }
  let tiltLock = false
  let keyTilt = false
  const samples: Sample[] = []
  let lastTap = { t: 0, x: 0, y: 0 }
  let downT = 0
  let moved = false
  let fromTray: 'marble' | ClothKind | null = null
  let lampStart = 0
  let lampAng0 = 0
  let focusY = 0
  let lastRatchet = 0
  const keys = trackKeys()
  const spaceTimes: number[] = []

  const frameHit = (e: PointerEvent) => H.renderer.clientToFrame(e.clientX, e.clientY)
  const mmPerPx = () => H.renderer.mmPerPx()

  function pushSample(e: PointerEvent): void {
    const f = frameHit(e)
    samples.push({ t: e.timeStamp, x: f.x, y: f.y })
    while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift()
  }
  function throwVel(): [number, number] {
    // mean velocity over the last ~60 ms (at least two samples; rAF-coalesced moves)
    if (samples.length < 2) return [0, 0]
    const a = samples[0], z = samples[samples.length - 1]
    const dt = (z.t - a.t) / 1000
    if (dt <= 0.004) return [0, 0]
    return [(z.x - a.x) / dt, (z.y - a.y) / dt]
  }

  function lampAngleAt(cx: number, cy: number): number {
    const fr = H.frameEl.getBoundingClientRect()
    return (Math.atan2(-(cy - (fr.top + fr.height / 2)), cx - (fr.left + fr.width / 2)) * 180) / Math.PI
  }

  function onDown(e: PointerEvent): void {
    if (!H.enabled() || pid !== -1) return
    H.onActivity()
    const t = e.target as HTMLElement
    if (t === H.lampEl || t === H.focusEl) return
    const f = frameHit(e)
    pid = e.pointerId
    px0 = e.clientX; py0 = e.clientY
    downT = e.timeStamp
    moved = false
    samples.length = 0
    pushSample(e)
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    if (e.button === 2) { mode = 'tilt'; tilt0 = { ...tiltTarget }; return }
    if (!f.inside) {
      // the bezel ring swings the lamp
      mode = 'lamp'
      lampStart = H.getLamp()
      lampAng0 = lampAngleAt(e.clientX, e.clientY)
      return
    }
    const slack = 22 * mmPerPx()
    if (b.marbleAt(f.x, f.y, slack)) {
      mode = 'marble'
      b.marbleGrab(f.x, f.y)
      H.probeUsed('marble')
      H.frameEl.dataset.cursor = 'grabbing'
      return
    }
    const ck = b.clothAt(f.x, f.y)
    if (ck) {
      mode = 'cloth'
      b.clothGrab(ck, f.x, f.y, e.pointerType === 'pen' ? 0.3 + 1.7 * e.pressure : 1)
      H.probeUsed(ck)
      H.frameEl.dataset.cursor = 'grabbing'
      return
    }
    mode = 'tilt'
    tilt0 = { ...tiltTarget }
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerId !== pid) {
      if (pid === -1 && e.pointerType === 'mouse') {
        const f = frameHit(e)
        if (f.inside) {
          H.hover(f.x, f.y)
          const slack = 22 * mmPerPx()
          H.frameEl.dataset.cursor = b.marbleAt(f.x, f.y, slack) || b.clothAt(f.x, f.y) ? 'pointer' : ''
        }
      }
      return
    }
    H.onActivity()
    pushSample(e)
    const dxp = e.clientX - px0, dyp = e.clientY - py0
    if (Math.hypot(dxp, dyp) > 6) moved = true
    const f = frameHit(e)
    if (mode === 'tilt') {
      // 1° per 30 px from the press point; screen y down = plate −y
      let x = tilt0.x + dxp / 30, y = tilt0.y - dyp / 30
      const l = Math.hypot(x, y)
      if (l > 5) { x *= 5 / l; y *= 5 / l }
      tiltTarget.x = x; tiltTarget.y = y
      b.setTiltTarget(tiltTarget)
      if (l > 0.5) H.probeUsed('tilt')
    } else if (mode === 'marble') {
      b.marbleMove(f.x, f.y)
      H.hover(f.x, f.y)
    } else if (mode === 'cloth') {
      b.clothMove(f.x, f.y, e.pointerType === 'pen' ? 0.3 + 1.7 * e.pressure : undefined)
      H.hover(f.x, f.y)
    } else if (mode === 'lamp') {
      const a = lampAngleAt(e.clientX, e.clientY)
      let d = a - lampAng0
      while (d > 180) d -= 360
      while (d < -180) d += 360
      H.setLamp(lampStart + d)
    }
  }

  function onUp(e: PointerEvent): void {
    if (e.pointerId !== pid) return
    pid = -1
    H.frameEl.dataset.cursor = ''
    const f = frameHit(e)
    if (mode === 'marble') {
      const [vx, vy] = throwVel()
      b.marbleRelease(vx, vy)
    } else if (mode === 'cloth') {
      b.clothRelease()
    } else if (mode === 'tilt') {
      if (!tiltLock && !keyTilt) { tiltTarget.x = 0; tiltTarget.y = 0; b.setTiltTarget(tiltTarget) }
      // double-tap bare surface = knuckle tap
      if (!moved && e.timeStamp - downT < 250 && f.inside) {
        if (e.timeStamp - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 12) {
          b.tap(f.x, f.y)
          lastTap.t = 0
        } else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY }
      }
    }
    mode = 'none'
  }

  // ---- tray: drag a probe into the frame, or tap to place it at the centre ----
  function trayDown(kind: 'marble' | ClothKind) {
    return (e: PointerEvent) => {
      if (!H.enabled()) return
      H.onActivity()
      e.preventDefault()
      fromTray = kind
      pid = e.pointerId
      px0 = e.clientX; py0 = e.clientY
      downT = e.timeStamp
      moved = false
      samples.length = 0
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* synthetic */ }
      mode = 'none'
    }
  }
  function trayMove(e: PointerEvent): void {
    if (e.pointerId !== pid || !fromTray) return
    if (Math.hypot(e.clientX - px0, e.clientY - py0) > 6) moved = true
    const f = frameHit(e)
    pushSample(e)
    if (mode === 'none' && f.inside && moved) {
      if (fromTray === 'marble') { b.marbleGrab(f.x, f.y); mode = 'marble'; H.probeUsed('marble') }
      else { b.clothGrab(fromTray, f.x, f.y); mode = 'cloth'; H.probeUsed(fromTray) }
    }
    if (mode === 'marble') b.marbleMove(f.x, f.y)
    else if (mode === 'cloth') b.clothMove(f.x, f.y)
  }
  function trayUp(e: PointerEvent): void {
    if (e.pointerId !== pid || !fromTray) return
    pid = -1
    const k = fromTray
    fromTray = null
    if (mode === 'marble') { const [vx, vy] = throwVel(); b.marbleRelease(vx, vy) }
    else if (mode === 'cloth') b.clothRelease()
    else if (!moved) {
      // tap: drop the marble at the frame centre / lay the swatch there
      if (k === 'marble') { b.marbleDrop(0, 0, 2); H.probeUsed('marble') }
      else { b.clothGrab(k, 0, 0); b.clothRelease(); H.probeUsed(k) }
    }
    mode = 'none'
  }

  // lamp knob: tap toggles mode, drag swings
  let lampDown = false, lampMoved = false
  const lampPD = (e: PointerEvent) => {
    if (!H.enabled()) return
    e.stopPropagation()
    lampDown = true
    lampMoved = false
    lampStart = H.getLamp()
    lampAng0 = lampAngleAt(e.clientX, e.clientY)
    px0 = e.clientX; py0 = e.clientY
    try { H.lampEl.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
  }
  const lampPM = (e: PointerEvent) => {
    if (!lampDown) return
    if (Math.hypot(e.clientX - px0, e.clientY - py0) > 4) lampMoved = true
    if (!lampMoved) return
    let d = lampAngleAt(e.clientX, e.clientY) - lampAng0
    while (d > 180) d -= 360
    while (d < -180) d += 360
    H.setLamp(lampStart + d)
  }
  const lampPU = () => {
    if (!lampDown) return
    lampDown = false
    if (!lampMoved) H.toggleLampMode()
  }
  // focus ring strip
  let focusDown = false
  const focPD = (e: PointerEvent) => { focusDown = true; focusY = e.clientY; e.stopPropagation(); try { H.focusEl.setPointerCapture(e.pointerId) } catch { /* synthetic */ } }
  const focPM = (e: PointerEvent) => {
    if (!focusDown) return
    const d = e.clientY - focusY
    focusY = e.clientY
    H.nudgeFocus(-d * 0.004)
    const now = performance.now()
    if (now - lastRatchet > 40) lastRatchet = now
  }
  const focPU = () => { focusDown = false }

  const wheel = (e: WheelEvent) => {
    if (!H.enabled()) return
    e.preventDefault()
    H.nudgeFocus(-Math.sign(e.deltaY) * 0.01)
  }
  const ctx = (e: Event) => e.preventDefault()

  const area = H.bezelEl
  area.addEventListener('pointerdown', onDown)
  area.addEventListener('pointermove', onMove)
  area.addEventListener('pointerup', onUp)
  area.addEventListener('pointercancel', onUp)
  area.addEventListener('wheel', wheel, { passive: false })
  area.addEventListener('contextmenu', ctx)
  const trayPairs: Array<[HTMLElement, 'marble' | ClothKind]> = [[H.tray.dish, 'marble'], [H.tray.lens, 'lens'], [H.tray.burlap, 'burlap']]
  const trayHandlers = trayPairs.map(([el, k]) => {
    const d = trayDown(k)
    el.addEventListener('pointerdown', d)
    el.addEventListener('pointermove', trayMove)
    el.addEventListener('pointerup', trayUp)
    el.addEventListener('pointercancel', trayUp)
    el.addEventListener('contextmenu', ctx)
    return [el, d] as const
  })
  // keyboard activation of tray buttons (Enter/Space on a focused button)
  const trayClick = (k: 'marble' | ClothKind) => (e: MouseEvent) => {
    if (e.detail !== 0) return // pointer clicks are handled above
    if (k === 'marble') { b.marbleDrop(0, 0, 2); H.probeUsed('marble') } else { b.clothGrab(k, 0, 0); b.clothRelease(); H.probeUsed(k) }
  }
  const clickHandlers = trayPairs.map(([el, k]) => { const c = trayClick(k); el.addEventListener('click', c); return [el, c] as const })
  H.lampEl.addEventListener('pointerdown', lampPD)
  H.lampEl.addEventListener('pointermove', lampPM)
  H.lampEl.addEventListener('pointerup', lampPU)
  H.lampEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); H.toggleLampMode() } })
  H.focusEl.addEventListener('pointerdown', focPD)
  H.focusEl.addEventListener('pointermove', focPM)
  H.focusEl.addEventListener('pointerup', focPU)

  let hover = { x: 0, y: 0 }
  const host = H.hover
  H.hover = (x, y) => { hover = { x, y }; host(x, y) }
  let lampHeld = 0
  const offKey = onGameKey((e) => {
    if (!H.enabled()) return
    H.onActivity()
    const k = e.code
    if (k === 'KeyT') { tiltLock = !tiltLock; if (!tiltLock) { tiltTarget.x = 0; tiltTarget.y = 0; b.setTiltTarget(tiltTarget) } }
    else if (k === 'Space') {
      e.preventDefault()
      const now = performance.now()
      spaceTimes.push(now)
      while (spaceTimes.length && now - spaceTimes[0] > 600) spaceTimes.shift()
      if (spaceTimes.length >= 3) { b.shake(); spaceTimes.length = 0 } else b.tap(hover.x, hover.y)
    } else if (k === 'KeyM') { b.marbleDrop(hover.x, hover.y, 2); H.probeUsed('marble') }
    else if (k === 'KeyC') H.stroke('lens', hover.x, hover.y)
    else if (k === 'KeyB') H.stroke('burlap', hover.x, hover.y)
    else if (k === 'KeyQ') H.setLamp(H.getLamp() + 15)
    else if (k === 'KeyE') H.setLamp(H.getLamp() - 15)
    else if (k === 'KeyL') H.toggleLampMode()
    else if (k === 'BracketLeft') H.nudgeFocus(-0.01)
    else if (k === 'BracketRight') H.nudgeFocus(0.01)
    else if (k === 'KeyG') H.autoFocus()
    else if (k === 'KeyP') H.togglePeaking()
    else if (k === 'KeyR') b.resetProbes()
    else if (k === 'KeyF') { const c = b.heldCloth; if (c) b.clothFlip(c) }
    else if (k === 'Enter') { e.preventDefault(); H.focusGuess() }
    else if (e.key === '?') H.openHelp()
  })
  void lampHeld

  return {
    tiltTarget,
    get tiltLock() { return tiltLock },
    set tiltLock(v: boolean) { tiltLock = v },
    frame(dt: number) {
      // WASD / arrows ramp toward ±5° at 20°/s while held
      const kx = (keys.isDown('KeyD') || keys.isDown('ArrowRight') ? 1 : 0) - (keys.isDown('KeyA') || keys.isDown('ArrowLeft') ? 1 : 0)
      const ky = (keys.isDown('KeyW') || keys.isDown('ArrowUp') ? 1 : 0) - (keys.isDown('KeyS') || keys.isDown('ArrowDown') ? 1 : 0)
      if (document.activeElement instanceof HTMLInputElement) return
      if (kx || ky) {
        keyTilt = true
        tiltTarget.x = Math.max(-5, Math.min(5, tiltTarget.x + kx * 20 * dt))
        tiltTarget.y = Math.max(-5, Math.min(5, tiltTarget.y + ky * 20 * dt))
        b.setTiltTarget(tiltTarget)
        H.probeUsed('tilt')
        H.onActivity()
      } else if (keyTilt) {
        keyTilt = false
        if (!tiltLock && mode !== 'tilt') { tiltTarget.x = 0; tiltTarget.y = 0; b.setTiltTarget(tiltTarget) }
      }
      // hold Q/E to swing the lamp at 60°/s
      if (keys.isDown('KeyQ')) H.setLamp(H.getLamp() + 60 * dt * 0.5)
      if (keys.isDown('KeyE')) H.setLamp(H.getLamp() - 60 * dt * 0.5)
    },
    dispose() {
      offKey()
      keys.dispose()
      area.removeEventListener('pointerdown', onDown)
      area.removeEventListener('pointermove', onMove)
      area.removeEventListener('pointerup', onUp)
      area.removeEventListener('wheel', wheel)
      for (const [el, d] of trayHandlers) el.removeEventListener('pointerdown', d)
      for (const [el, c] of clickHandlers) el.removeEventListener('click', c)
    },
  }
}

// The Street (lensbench.md §4.3, §7.1): full-bleed finder, meter, standpoints, walking, focus,
// aperture, speed, half-press, fire, advance, tripod, time of day.
import * as THREE from 'three'
import { focusDistanceM, extForDistance } from '@shared/optics'
import { BODIES, F_STOPS, STOCKS, formatSpeed, speedsFor, filterStops } from '../core/catalog'
import type { Screen, StandpointId, ShotRecord } from '../core/types'
import type { App } from '../core/app'
import { sfx } from '../audio/audio'
import { Shake } from './shake'
import './street.css'

const SP_ORDER: StandpointId[] = ['shopStep', 'bakery', 'fountain', 'across', 'chart', 'farEnd', 'window']
const SP_LABEL: Record<StandpointId, string> = { window: 'Q.’s window', shopStep: 'Shop step', bakery: 'Bakery', fountain: 'Fountain', across: 'Across', farEnd: 'Far end', chart: 'Cinema' }
const D2R = Math.PI / 180

export interface StreetScreen extends Screen {
  fire(o?: { seed?: number; holdMs?: number; multiple?: boolean; panYawDegPerS?: number }): ShotRecord | null
  shake: Shake
  standpoint(id: StandpointId): void
}

export function createStreetScreen(root: HTMLElement, app: App): StreetScreen {
  root.classList.add('lb-street')
  root.innerHTML = `
    <div class="lb-finder"><div class="lb-finder-view"></div>
      <div class="lb-frame" aria-hidden="true"></div>
      <div class="lb-sticker" hidden></div>
      <div class="lb-exposing" hidden>exposing…</div>
    </div>
    <div class="lb-hud-top">
      <svg class="lb-meter" viewBox="0 0 120 60" role="img" aria-label="Exposure meter"><path d="M10 55 A50 50 0 0 1 110 55" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>
        <g class="lb-ticks"></g><line class="lb-needle" x1="60" y1="55" x2="60" y2="12" stroke="#d8432c" stroke-width="2"/><text x="60" y="50" text-anchor="middle" class="lb-meter-ev">EV</text></svg>
      <label class="lb-sun"><span>Time</span><input type="range" min="5.5" max="23.5" step="0.25" aria-label="Time of day"><output></output></label>
      <button class="lb-chip lb-tripod" aria-pressed="false" title="Tripod (T)">Tripod</button>
      <button class="lb-chip lb-dof" title="Hold for depth-of-field preview (V)">◐ DOF</button>
    </div>
    <nav class="lb-standpoints" aria-label="Standpoints"></nav>
    <div class="lb-stick" aria-hidden="true"><div class="lb-stick-knob"></div></div>
    <div class="lb-deck">
      <label class="lb-focus"><span>Focus</span><input type="range" min="0" max="1000" step="1" aria-label="Focus distance"><output></output></label>
      <div class="lb-dial lb-ap"><button aria-label="Open up">‹</button><b></b><button aria-label="Stop down">›</button></div>
      <div class="lb-dial lb-sp"><button aria-label="Slower">‹</button><b></b><button aria-label="Faster">›</button></div>
      <div class="lb-film-badge"></div>
      <button class="lb-chip lb-rewind" title="Rewind (R)">⟲ Rewind</button>
      <button class="lb-lever" title="Advance (F)" aria-label="Advance the film">⟵ wind</button>
      <button class="lb-release" aria-label="Shutter release: hold to meter, let go to fire"><span class="lb-count">1</span></button>
    </div>`
  const view = root.querySelector('.lb-finder-view') as HTMLElement
  const finderEl = root.querySelector('.lb-finder') as HTMLElement
  const frameEl = root.querySelector('.lb-frame') as HTMLElement
  const sticker = root.querySelector('.lb-sticker') as HTMLElement
  const exposing = root.querySelector('.lb-exposing') as HTMLElement
  const needle = root.querySelector('.lb-needle') as SVGLineElement
  const meterEv = root.querySelector('.lb-meter-ev') as SVGTextElement
  const sun = root.querySelector('.lb-sun input') as HTMLInputElement
  const sunOut = root.querySelector('.lb-sun output') as HTMLOutputElement
  const tripodBtn = root.querySelector('.lb-tripod') as HTMLButtonElement
  const dofBtn = root.querySelector('.lb-dof') as HTMLButtonElement
  const sps = root.querySelector('.lb-standpoints') as HTMLElement
  const stick = root.querySelector('.lb-stick') as HTMLElement
  const knob = root.querySelector('.lb-stick-knob') as HTMLElement
  const focus = root.querySelector('.lb-focus input') as HTMLInputElement
  const focusOut = root.querySelector('.lb-focus output') as HTMLOutputElement
  const apB = root.querySelector('.lb-ap b') as HTMLElement
  const spB = root.querySelector('.lb-sp b') as HTMLElement
  const filmBadge = root.querySelector('.lb-film-badge') as HTMLElement
  const release = root.querySelector('.lb-release') as HTMLButtonElement
  const count = root.querySelector('.lb-count') as HTMLElement
  const lever = root.querySelector('.lb-lever') as HTMLButtonElement
  const rewindBtn = root.querySelector('.lb-rewind') as HTMLButtonElement

  // meter ticks
  const ticks = root.querySelector('.lb-ticks') as SVGGElement
  for (let ev = -3; ev <= 3; ev++) {
    const a = (ev / 3) * 60 * D2R
    const x1 = 60 + Math.sin(a) * 44, y1 = 55 - Math.cos(a) * 44, x2 = 60 + Math.sin(a) * 50, y2 = 55 - Math.cos(a) * 50
    ticks.insertAdjacentHTML('beforeend', `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${ev === 0 ? 2 : 1}"/>`)
  }

  let active = false
  const shake = new Shake({ I: 0.001, tripod: true }, 1)
  let needleV = 0, needleX = 0
  let dofHeld = false
  let pressT0 = -1 // B: when the shutter opened (world time), -1 = idle
  let pressing = false
  let pressAltMultiple = false
  const bTrack: number[] = []
  const bAim: number[] = []
  let bOpenReal = 0
  let lastTick = 0
  const keys = new Set<string>()
  const lookDrag = { on: false, id: -1, x: 0, y: 0 }
  const stickDrag = { on: false, id: -1, cx: 0, cy: 0, dx: 0, dy: 0 }

  const st = () => app.store.get()
  const body = () => BODIES[st().camera.body]

  function updateShakeParams() {
    const p = app.profile()
    shake.params = { I: app.inertia(), tripod: st().tripod }
    void p
  }

  // -------------------------------------------------------------- standpoints, HUD
  for (const id of SP_ORDER) {
    const b = document.createElement('button')
    b.className = 'lb-chip'
    b.textContent = SP_LABEL[id]
    b.dataset.sp = id
    b.addEventListener('click', () => { standpoint(id); sfx.tock() })
    sps.appendChild(b)
  }
  function standpoint(id: StandpointId) {
    const s = app.world.standpoints[id]
    app.store.set({ standpoint: id, pos: [...s.pos], yaw: s.yawDeg * D2R, pitch: s.pitchDeg * D2R })
    app.finder.settle()
    renderHud()
  }
  function renderHud() {
    const s = st()
    const p = app.profile()
    sun.value = String(s.timeOfDay)
    const hh = Math.floor(s.timeOfDay), mm = Math.round((s.timeOfDay % 1) * 60)
    sunOut.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    tripodBtn.setAttribute('aria-pressed', String(s.tripod))
    tripodBtn.classList.toggle('on', s.tripod)
    const extMax = body().extMax
    focus.value = String(Math.round((s.ext / Math.max(0.001, extMax)) * 1000))
    const d = focusDistanceM(p.efl, s.ext)
    focusOut.textContent = p.pinhole ? '—' : Number.isFinite(d) ? (d < 10 ? `${d.toFixed(2)} m` : `${d.toFixed(0)} m`) : '∞'
    apB.textContent = p.pinhole ? `f/${Math.round(p.fNumber)}` : `f/${p.fNumber.toFixed(1)}${s.camera.lens.stop.kind === 'card' ? '♥' : ''}`
    spB.textContent = formatSpeed(s.shutterS)
    const roll = app.store.roll()
    const used = roll ? roll.frames.length : 0
    filmBadge.textContent = `${STOCKS[s.camera.stock].name} · ${used}/${body().frames}`
    count.textContent = String(Math.min(body().frames, used + (s.cocked ? 1 : 0)) || 1)
    release.classList.toggle('uncocked', !s.cocked)
    lever.classList.toggle('pulse', !s.cocked)
    for (const b of sps.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.sp === s.standpoint)
    // finder frame / sticker
    const kind = body().finder
    frameEl.className = `lb-frame lb-frame-${kind}`
    sticker.hidden = body().meter !== 'none'
    sticker.textContent = s.camera.body === 'tin' && !s.progress.tags.T01?.done ? 'Sun: count six.' : 'Sun: f/16 at 1/ISO. Shade: 3 stops more. Count Mississippis.'
    finderEl.style.setProperty('--lb-aspect', String(body().format[0] / body().format[1]))
  }

  // -------------------------------------------------------------- controls
  sun.addEventListener('input', () => { app.store.set({ timeOfDay: Number(sun.value) }); app.finder.settle(); renderHud() })
  tripodBtn.addEventListener('click', () => toggleTripod())
  function toggleTripod() {
    if (st().camera.body === 'tin' || st().camera.body === 'view') { app.toast('This one lives on a post.'); app.store.set({ tripod: true }); renderHud(); return }
    app.store.set({ tripod: !st().tripod }); updateShakeParams(); sfx.clink(0.5)
    if (st().tripod) app.noteOnce('tripod', 'Your heart beats nine times a second in your fingers. The tripod has no heart.')
    renderHud()
  }
  dofBtn.addEventListener('pointerdown', () => { dofHeld = true })
  dofBtn.addEventListener('pointerup', () => { dofHeld = false })
  dofBtn.addEventListener('pointerleave', () => { dofHeld = false })
  focus.addEventListener('input', () => { app.store.set({ ext: (Number(focus.value) / 1000) * body().extMax }); sfx.rub(0.3); renderHud() })
  focus.addEventListener('change', () => sfx.rub(0))
  const apBtns = root.querySelectorAll<HTMLButtonElement>('.lb-ap button')
  apBtns[0].addEventListener('click', () => stepAp(-1))
  apBtns[1].addEventListener('click', () => stepAp(1))
  const spBtns = root.querySelectorAll<HTMLButtonElement>('.lb-sp button')
  spBtns[0].addEventListener('click', () => stepSpeed(-1))
  spBtns[1].addEventListener('click', () => stepSpeed(1))
  function stepAp(dir: number) {
    if (app.profile().pinhole) return
    let i = F_STOPS.findIndex((n) => n >= st().fNumber - 0.01)
    if (i < 0) i = F_STOPS.length - 1
    i = Math.max(0, Math.min(F_STOPS.length - 1, i + dir))
    app.setAperture(F_STOPS[i]); sfx.detent(); renderHud()
  }
  function stepSpeed(dir: number) {
    const list = speedsFor(st().camera.shutter)
    let i = list.findIndex((t) => Math.abs(t - st().shutterS) < 1e-9)
    if (i < 0) i = 0
    i = Math.max(0, Math.min(list.length - 1, i + dir))
    app.store.set({ shutterS: list[i] }); sfx.detent(); renderHud()
  }
  lever.addEventListener('click', () => advance())
  rewindBtn.addEventListener('click', () => app.rewind())
  function advance() {
    if (st().cocked) return
    app.store.advance(); sfx.advance(); renderHud()
  }

  // release: hold = half-press, lift = fire (B: press opens, lift closes)
  release.addEventListener('pointerdown', (e) => {
    sfx.unlock()
    e.preventDefault()
    release.setPointerCapture(e.pointerId)
    pressAltMultiple = e.altKey
    halfPress()
  })
  release.addEventListener('pointerup', () => { if (pressing) letGo() })
  release.addEventListener('pointercancel', () => { pressing = false; shake.halfPressT = -1; pressT0 = -1 })
  function halfPress() {
    if (pressing) return
    pressing = true
    shake.halfPressT = 0
    release.classList.add('down')
    if (st().shutterS <= 0) openBulb()
  }
  function letGo() {
    pressing = false
    release.classList.remove('down')
    if (pressT0 >= 0) closeBulb()
    else fire({ multiple: pressAltMultiple })
    shake.halfPressT = -1
  }
  function canFire(multiple: boolean): boolean {
    if (!st().cocked && !multiple) { app.toast('Wind on first: the lever, or F.'); lever.classList.add('pulse'); return false }
    return true
  }
  function openBulb() {
    if (!canFire(pressAltMultiple)) { pressT0 = -1; return }
    pressT0 = st().worldT
    bOpenReal = performance.now()
    bTrack.length = 0; bAim.length = 0
    exposing.hidden = false
    sfx.shutter(st().camera.shutter === 'cap' ? 'cap' : st().camera.shutter, 0.5, false)
  }
  function closeBulb() {
    const held = Math.max(0.05, (performance.now() - bOpenReal) / 1000)
    exposing.hidden = true
    if (st().camera.shutter === 'cap') sfx.capClose()
    const shot = buildShot({ seed: app.nextSeed(), openS: held, worldT0: pressT0, recorded: { track: Float32Array.from(bTrack), aim: Float32Array.from(bAim), hz: bTrack.length / 2 / held } })
    pressT0 = -1
    commit(shot, pressAltMultiple)
  }

  function buildShot(o: { seed: number; openS: number; worldT0: number; panYawDegPerS?: number; recorded?: { track: Float32Array; aim: Float32Array; hz: number } }): ShotRecord {
    const s = st()
    const t = o.openS
    let track: Float32Array, aim: Float32Array, hz: number
    if (o.recorded && o.recorded.track.length >= 4) {
      track = o.recorded.track; aim = o.recorded.aim; hz = Math.max(1, o.recorded.hz)
    } else {
      hz = t > 4 ? 120 : 500
      const span = Math.max(t, 0.002) + 0.13 // covers curtain travel
      const n = Math.max(2, Math.ceil(span * hz) + 1)
      track = new Float32Array(n * 2); aim = new Float32Array(n * 2)
      updateShakeParams()
      const sim = new Shake({ ...shake.params }, o.seed)
      if (!s.tripod) { sim.yaw = shake.yaw; sim.pitch = shake.pitch; sim.vy = shake.vy; sim.vp = shake.vp; sim.halfPressT = shake.halfPressT }
      sim.t = shake.t
      const mirror = s.camera.body === 'reflex' && !s.mirrorLocked
      if (mirror) sim.impulse(4e-5)
      const pan = ((o.panYawDegPerS ?? 0) * D2R)
      for (let i = 0; i < n; i++) {
        const tt = i / hz
        const ay = s.yaw - pan * tt, ap = s.pitch
        aim[i * 2] = ay; aim[i * 2 + 1] = ap
        track[i * 2] = ay + sim.yaw; track[i * 2 + 1] = ap + sim.pitch
        sim.step(1 / hz)
      }
    }
    return {
      id: `s${o.seed.toString(36)}`, seed: o.seed, camera: JSON.parse(JSON.stringify(s.camera)), ext: s.ext, fNumber: app.profile().fNumber,
      shutterS: t, worldT0: o.worldT0, timeOfDay: s.timeOfDay, pos: [...s.pos], trackHz: hz, track, aimNoShake: aim,
      tripod: s.tripod, mirrorLocked: s.mirrorLocked, textSeed: s.progress.textSeed,
    }
  }
  function commit(shot: ShotRecord, multiple: boolean) {
    const f = app.store.fire(shot, multiple)
    sfx.shutter(shot.camera.shutter, shot.shutterS, shot.camera.body === 'reflex' && !shot.mirrorLocked)
    finderEl.classList.remove('blink'); void finderEl.offsetWidth; finderEl.classList.add('blink')
    app.onFired(f)
    renderHud()
  }
  function fire(o: { seed?: number; holdMs?: number; multiple?: boolean; panYawDegPerS?: number } = {}): ShotRecord | null {
    const multiple = !!o.multiple
    if (!canFire(multiple)) return null
    const s = st()
    const openS = s.shutterS > 0 ? s.shutterS : Math.max(0.05, (o.holdMs ?? 1000) / 1000)
    const shot = buildShot({ seed: o.seed ?? app.nextSeed(), openS, worldT0: s.worldT, panYawDegPerS: o.panYawDegPerS })
    commit(shot, multiple)
    return shot
  }

  // look & walk
  view.parentElement?.addEventListener('pointerdown', (e) => {
    sfx.unlock()
    const r = finderEl.getBoundingClientRect()
    const x = e.clientX - r.left
    if (e.pointerType === 'touch' && x < r.width * 0.4) {
      stickDrag.on = true; stickDrag.id = e.pointerId; stickDrag.cx = e.clientX; stickDrag.cy = e.clientY; stickDrag.dx = 0; stickDrag.dy = 0
      stick.style.left = `${e.clientX - r.left - 40}px`; stick.style.top = `${e.clientY - r.top - 40}px`; stick.classList.add('on')
    } else { lookDrag.on = true; lookDrag.id = e.pointerId; lookDrag.x = e.clientX; lookDrag.y = e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  })
  finderEl.addEventListener('pointermove', (e) => {
    if (lookDrag.on && e.pointerId === lookDrag.id) {
      const p = app.profile()
      const fov = 2 * Math.atan(body().format[1] / 2 / (p.efl + st().ext))
      const k = fov / Math.max(200, finderEl.clientHeight)
      const yaw = st().yaw + (e.clientX - lookDrag.x) * k
      const pitch = Math.max(-1.2, Math.min(1.2, st().pitch + (e.clientY - lookDrag.y) * k))
      lookDrag.x = e.clientX; lookDrag.y = e.clientY
      app.store.set({ yaw, pitch })
    } else if (stickDrag.on && e.pointerId === stickDrag.id) {
      stickDrag.dx = Math.max(-40, Math.min(40, e.clientX - stickDrag.cx)); stickDrag.dy = Math.max(-40, Math.min(40, e.clientY - stickDrag.cy))
      knob.style.transform = `translate(${stickDrag.dx}px, ${stickDrag.dy}px)`
    }
  })
  const endPtr = (e: PointerEvent) => {
    if (e.pointerId === lookDrag.id) lookDrag.on = false
    if (e.pointerId === stickDrag.id) { stickDrag.on = false; stick.classList.remove('on'); knob.style.transform = '' }
  }
  finderEl.addEventListener('pointerup', endPtr)
  finderEl.addEventListener('pointercancel', endPtr)
  finderEl.addEventListener('wheel', (e) => {
    e.preventDefault()
    const extMax = body().extMax
    const fine = e.shiftKey ? 0.1 : 1
    app.store.set({ ext: Math.max(0, Math.min(extMax, st().ext - Math.sign(e.deltaY) * extMax * 0.02 * fine)) })
    renderHud()
  }, { passive: false })

  const onKey = (e: KeyboardEvent) => {
    if (!active) return
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
    if (e.type === 'keyup') {
      keys.delete(e.code)
      if (e.code === 'Space' && pressing) { e.preventDefault(); letGo() }
      if (e.code === 'KeyV') dofHeld = false
      return
    }
    keys.add(e.code)
    if (e.repeat) return
    if (e.code === 'Space') { e.preventDefault(); sfx.unlock(); pressAltMultiple = e.altKey; halfPress() }
    else if (e.code === 'Tab') { e.preventDefault(); const i = SP_ORDER.indexOf(st().standpoint); standpoint(SP_ORDER[(i + (e.shiftKey ? SP_ORDER.length - 1 : 1)) % SP_ORDER.length]) }
    else if (e.code === 'KeyF') advance()
    else if (e.code === 'KeyT') toggleTripod()
    else if (e.code === 'KeyV') dofHeld = true
    else if (e.code === 'KeyR') app.rewind()
    else if (e.key === '[') stepAp(-1)
    else if (e.key === ']') stepAp(1)
    else if (e.key === ',') stepSpeed(-1)
    else if (e.key === '.') stepSpeed(1)
    else if (e.code === 'KeyQ' || e.code === 'KeyE') {
      const extMax = body().extMax
      const d = (e.code === 'KeyQ' ? -1 : 1) * extMax * (e.shiftKey ? 0.005 : 0.03)
      app.store.set({ ext: Math.max(0, Math.min(extMax, st().ext + d)) }); renderHud()
    }
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), pos = new THREE.Vector3()
  const scr: StreetScreen = {
    shake, standpoint, fire,
    enter() {
      active = true
      root.hidden = false
      app.gl.attachTo(view)
      if (st().camera.body === 'tin' || st().camera.body === 'view') app.store.set({ tripod: true })
      updateShakeParams()
      app.finder.settle()
      renderHud()
      if (body().finder === 'groundglass') sfx.muffle(false)
    },
    exit() { active = false; root.hidden = true; app.gl.attachTo(null); sfx.stopBed(); keys.clear(); pressing = false; pressT0 = -1 },
    update(dt: number) {
      if (!active) return
      const s = st()
      updateShakeParams()
      // walking
      let mx = 0, mz = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1
      if (stickDrag.on) { mx += stickDrag.dx / 40; mz -= stickDrag.dy / 40 }
      if ((mx || mz) && !s.tripod) {
        fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)); right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw))
        pos.set(...s.pos).addScaledVector(fwd, mz * 1.6 * dt).addScaledVector(right, mx * 1.6 * dt)
        app.world.clampWalk(pos)
        app.store.set({ pos: [pos.x, s.pos[1] > 3 ? s.pos[1] : 1.6, pos.z] })
      } else if ((mx || mz) && s.tripod) { /* on a tripod: stay put */ }
      // shake (true θ, not exaggerated)
      shake.step(dt)
      if (pressT0 >= 0) {
        bTrack.push(s.yaw + shake.yaw, s.pitch + shake.pitch); bAim.push(s.yaw, s.pitch)
        const sec = (performance.now() - bOpenReal) / 1000
        if (Math.floor(sec) > lastTick) { lastTick = Math.floor(sec); sfx.tick() }
      } else lastTick = 0
      app.renderStreet(dt, { yaw: s.yaw + shake.yaw, pitch: s.pitch + shake.pitch, dof: dofHeld })
      {
        const rc = app.finder.rect
        const kind = body().finder
        const k = kind === 'sight' ? 1 / 1.15 : kind === 'frame' ? 1 / 1.12 : 1
        const w = rc.w * k, h = rc.h * k
        frameEl.style.left = `${rc.x + (rc.w - w) / 2}px`; frameEl.style.top = `${rc.y + (rc.h - h) / 2}px`
        frameEl.style.width = `${w}px`; frameEl.style.height = `${h}px`
      }
      // meter needle: EV_meter − EV_set (spring, ζ 0.35, 3 Hz)
      const p = app.profile()
      const b = body()
      const N = p.fNumber
      const tset = s.shutterS > 0 ? s.shutterS : 1
      const Nw = N * (1 + s.ext / p.efl)
      const evSet = Math.log2((Nw * Nw) / tset) - Math.log2(STOCKS[s.camera.stock].iso / 100) + (b.meter === 'ttl' ? filterStops(s.camera.stock, s.camera.filter) : 0)
      const evM = app.finder.meterEV()
      const target = b.meter === 'none' ? 0 : Math.max(-3, Math.min(3, evM - evSet))
      const w = 2 * Math.PI * 3, z = 0.35
      needleV += (w * w * (target - needleX) - 2 * z * w * needleV) * Math.min(dt, 0.05)
      needleX += needleV * Math.min(dt, 0.05)
      const ang = (needleX / 3) * 60
      needle.setAttribute('transform', `rotate(${ang.toFixed(2)} 60 55)`)
      meterEv.textContent = b.meter === 'none' ? 'no meter' : `EV ${evM.toFixed(1)}`
      sfx.streetBed(app.world.wind(s.worldT), Math.max(0, 1 - Math.hypot(s.pos[0], s.pos[2]) / 30))
    },
    dispose() { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) },
  }
  app.store.on('cocked', () => active && renderHud())
  app.store.on('camera', () => active && renderHud())
  app.store.on('frames', () => active && renderHud())
  void extForDistance
  return scr
}

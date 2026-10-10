// The app: station manager, the bottom rail, pointer/keyboard routing, the frame loop, audio wiring,
// the desk phone and the clock (GDD §4.1, §11.4).
import { Audio, haptic, type LoopHandle } from '@shared/audio'
import { flags, onGameKey, prefersReducedMotion } from '@shared/core'
import { toast as shellToast, announce } from '@shared/ui'
import { HINTS, UNPROMPTED } from '../data/text'
import type { FrameStore } from '../frames/frameStore'
import { Screen, type Pal } from '../render/screen'
import { S, advanceClock, autosave, bus, clockText, currentStage, tape } from './state'
import type { GamePointer, Station, StationId } from './types'

export interface Ctx {
  screen: Screen
  frames: FrameStore
  view: HTMLElement
  phoneLayout(): boolean
  go(s: StationId): void
  sfx(id: string, params?: Record<string, number>): void
  loop(id: string, params?: Record<string, number>): LoopHandle | null
  toast(text: string): void
  announce(text: string): void
  phone(o?: { text?: string; ring?: boolean }): void
  reduced(): boolean
  test: boolean
  haptic(ms: number | number[]): void
  blinkRail(s: StationId): void
}

const GLYPH: Record<StationId, string> = {
  terminal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9h4M7 12h7"/></svg>',
  lighttable: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20"/></svg>',
  darkroom: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/></svg>',
  line: '<svg viewBox="0 0 24 24"><path d="M2 5h20"/><path d="M10 3v7M14 3v7"/><rect x="9" y="9" width="6" height="12" rx="1"/></svg>',
}
const LABEL: Record<StationId, string> = { terminal: 'Terminal', lighttable: 'Light table', darkroom: 'Darkroom', line: 'Drying line' }
const ORDER: StationId[] = ['terminal', 'lighttable', 'darkroom', 'line']

export class App implements Ctx {
  readonly screen: Screen
  readonly view: HTMLElement
  readonly root: HTMLElement
  readonly test: boolean
  stations = new Map<StationId, Station>()
  active: Station | null = null
  private rail: HTMLElement
  private clockEl: HTMLElement
  private railBtns = new Map<StationId, HTMLButtonElement>()
  private ctrlHost: HTMLElement
  private phoneEl: HTMLElement
  private loops = new Map<string, LoopHandle>()
  private last = 0
  private idleAcc = 0
  private realSeconds = 0
  private pointerDown: { id: number; x: number; y: number; t: number; moved: boolean; timer: number } | null = null
  private lastTap = { t: 0, x: 0, y: 0 }
  fps = 60
  private raf = 0
  private phoneTimer = 0

  constructor(readonly stage: HTMLElement, readonly frames: FrameStore) {
    this.test = flags().test
    this.root = document.createElement('div')
    this.root.className = 'li-root'
    this.view = document.createElement('div')
    this.view.className = 'li-view'
    this.screen = new Screen(this.view)
    this.ctrlHost = document.createElement('div')
    this.ctrlHost.className = 'li-controls'
    this.view.append(this.ctrlHost)
    this.phoneEl = document.createElement('div')
    this.phoneEl.className = 'li-phone'
    this.phoneEl.setAttribute('role', 'status')
    this.phoneEl.hidden = true
    this.view.append(this.phoneEl)
    this.rail = document.createElement('nav')
    this.rail.className = 'li-rail'
    this.rail.setAttribute('aria-label', 'Stations')
    ORDER.forEach((s, i) => {
      const b = document.createElement('button')
      b.className = 'li-rail-btn'
      b.type = 'button'
      b.innerHTML = GLYPH[s] + `<span>${LABEL[s]}</span>`
      b.setAttribute('aria-label', `${LABEL[s]} (${i + 1})`)
      b.addEventListener('click', () => this.go(s))
      this.railBtns.set(s, b)
      this.rail.append(b)
    })
    const phoneBtn = document.createElement('button')
    phoneBtn.className = 'li-rail-btn li-rail-phone'
    phoneBtn.type = 'button'
    phoneBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg><span>Desk</span>'
    phoneBtn.setAttribute('aria-label', 'Ring the front desk (P)')
    phoneBtn.addEventListener('click', () => this.phone())
    this.rail.append(phoneBtn)
    this.clockEl = document.createElement('span')
    this.clockEl.className = 'li-clock'
    this.rail.append(this.clockEl)
    if (!S.persistent) { const ns = document.createElement('span'); ns.className = 'li-nosave'; ns.textContent = 'NOT SAVING'; ns.title = "Saves won't stick in this browser"; this.rail.append(ns) }
    this.root.append(this.view, this.rail)
    stage.append(this.root)
    this.bindInput()
    new ResizeObserver(() => this.resize()).observe(this.view)
    document.addEventListener('visibilitychange', () => { if (document.hidden) { void Audio.stopAll?.(0.2) ; this.loops.clear() } })
  }

  phoneLayout(): boolean { return this.screen.w < 720 }
  reduced(): boolean { return prefersReducedMotion() || S.save.settings.reducedMotion }
  add(s: Station): void { this.stations.set(s.id, s) }
  toast(text: string): void { shellToast(text, { ms: 2600 }) }
  announce(text: string): void { announce(text) }
  haptic(ms: number | number[]): void { try { haptic(ms) } catch { /* ignore */ } }

  sfx(id: string, params: Record<string, number> = {}): void {
    if (this.test) return
    try { Audio.play(id, params) } catch { /* silent */ }
  }
  loop(id: string, params: Record<string, number> = {}): LoopHandle | null {
    if (this.test) return null
    try {
      let h = this.loops.get(id)
      if (!h || h.stopped) { h = Audio.loop(id, params); this.loops.set(id, h) } else h.setMany(params)
      return h
    } catch { return null }
  }
  stopLoop(id: string): void { const h = this.loops.get(id); if (h) { try { h.stop(0.3) } catch { /* */ } this.loops.delete(id) } }

  blinkRail(s: StationId): void {
    const b = this.railBtns.get(s)
    if (!b || this.reduced()) return
    b.classList.remove('li-blink'); void b.offsetWidth; b.classList.add('li-blink')
  }

  go(id: StationId): void {
    const next = this.stations.get(id)
    if (!next || next === this.active) return
    this.active?.exit()
    if (this.active?.controls) this.active.controls.remove()
    this.active = next
    S.station = id
    for (const [s, b] of this.railBtns) { b.setAttribute('aria-current', s === id ? 'page' : 'false') }
    this.root.dataset.station = id
    if (next.controls) this.ctrlHost.append(next.controls)
    next.resize(this.screen.w, this.screen.h, this.phoneLayout())
    next.enter()
    this.applyPalette()
    bus.emit('station', id)
    autosave()
  }

  palette(): Pal {
    const p = this.active?.palette() ?? { ink: '#000', light: '#000' }
    if (S.save.settings.highContrast) return { ink: '#000000', light: '#FFFFFF' }
    return p
  }
  applyPalette(): void {
    const p = this.palette()
    this.root.style.setProperty('--li-ink', p.ink)
    this.root.style.setProperty('--li-light', p.light)
  }

  resize(): void {
    const r = this.view.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    this.screen.resize(r.width, r.height)
    for (const s of this.stations.values()) s.resize(this.screen.w, this.screen.h, this.phoneLayout())
  }

  phone(o: { text?: string; ring?: boolean } = {}): void {
    let text = o.text
    if (!text) {
      const st = currentStage()
      const tier = Math.min(2, S.save.hints[st] ?? 0)
      text = HINTS[st][tier]
      S.save.hints[st] = tier + 1
      S.save.stats.calls++
      advanceClock(2)
      tape('CALL DESK')
    }
    if (o.ring) this.sfx('latent.squelch')
    else this.sfx('latent.squelch')
    this.phoneEl.innerHTML = ''
    const who = document.createElement('b'); who.textContent = 'SGT ATWELL · FRONT DESK'
    const p = document.createElement('p'); p.textContent = `“${text}”`
    const x = document.createElement('button'); x.type = 'button'; x.className = 'li-chip'; x.textContent = 'Hang up'
    x.addEventListener('click', () => { this.phoneEl.hidden = true; this.sfx('latent.clunk') })
    this.phoneEl.append(who, p, x)
    this.phoneEl.hidden = false
    announce(`Sergeant Atwell: ${text}`)
    clearTimeout(this.phoneTimer)
    this.phoneTimer = window.setTimeout(() => { this.phoneEl.hidden = true }, 14000)
  }

  private toPointer(e: PointerEvent, type: GamePointer['type']): GamePointer {
    const r = this.screen.canvas.getBoundingClientRect()
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, type, button: e.button, pointerType: (e.pointerType as GamePointer['pointerType']) || 'mouse', pressure: e.pressure, t: performance.now(), shift: e.shiftKey }
  }

  private bindInput(): void {
    const c = this.screen.canvas
    c.style.touchAction = 'none'
    c.addEventListener('contextmenu', (e) => e.preventDefault())
    c.addEventListener('pointerdown', (e) => {
      try { c.setPointerCapture(e.pointerId) } catch { /* */ }
      const p = this.toPointer(e, 'down')
      const timer = window.setTimeout(() => {
        if (this.pointerDown && !this.pointerDown.moved) this.active?.pointer({ ...p, type: 'long', t: performance.now() })
      }, 350)
      this.pointerDown = { id: e.pointerId, x: p.x, y: p.y, t: p.t, moved: false, timer }
      this.active?.pointer(p)
      this.idleAcc = 0
    })
    c.addEventListener('pointermove', (e) => {
      const p = this.toPointer(e, 'move')
      if (this.pointerDown && Math.hypot(p.x - this.pointerDown.x, p.y - this.pointerDown.y) > 8) this.pointerDown.moved = true
      this.active?.pointer(p)
    })
    const up = (e: PointerEvent, type: 'up' | 'cancel') => {
      const p = this.toPointer(e, type)
      if (this.pointerDown) clearTimeout(this.pointerDown.timer)
      this.active?.pointer(p)
      if (type === 'up' && this.pointerDown && !this.pointerDown.moved) {
        const now = performance.now()
        if (now - this.lastTap.t < 320 && Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < 16) { this.active?.pointer({ ...p, type: 'dbl' }); this.lastTap.t = 0 }
        else this.lastTap = { t: now, x: p.x, y: p.y }
      }
      this.pointerDown = null
    }
    c.addEventListener('pointerup', (e) => up(e, 'up'))
    c.addEventListener('pointercancel', (e) => up(e, 'cancel'))
    c.addEventListener('wheel', (e) => {
      const r = c.getBoundingClientRect()
      if (this.active?.wheel?.(e.deltaY, e.clientX - r.left, e.clientY - r.top, e.shiftKey)) e.preventDefault()
    }, { passive: false })
    onGameKey((e) => {
      this.idleAcc = 0
      if (this.active?.key(e)) { e.preventDefault(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      if (n >= 0 && !e.shiftKey) { this.go(ORDER[n]); e.preventDefault(); return }
      if (e.code === 'Tab') { const i = ORDER.indexOf(S.station); this.go(ORDER[(i + (e.shiftKey ? 3 : 1)) % 4]); e.preventDefault(); return }
      if (e.code === 'KeyP') { this.phone(); e.preventDefault() }
    })
  }

  start(): void {
    this.last = performance.now()
    const tick = (now: number) => {
      const dtReal = Math.min(0.25, (now - this.last) / 1000)
      this.last = now
      this.fps = this.fps * 0.95 + (dtReal > 0 ? 1 / dtReal : 60) * 0.05
      this.frame(Math.min(1 / 30, dtReal), dtReal)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }
  stop(): void { cancelAnimationFrame(this.raf) }

  /** One update + render (also used by the deterministic test path). */
  frame(dt: number, dtReal = dt): void {
    if (!this.test) {
      this.idleAcc += dtReal
      if (this.idleAcc >= 60) { this.idleAcc -= 60; advanceClock(1) }
      this.realSeconds += dtReal
      if (!S.save.unprompted.first && this.realSeconds > 150 && S.save.stats.searches === 0) { S.save.unprompted.first = true; this.phone({ text: UNPROMPTED.first, ring: true }) }
      if (!S.save.unprompted.van && S.save.clock >= 539) { S.save.unprompted.van = true; this.phone({ text: UNPROMPTED.van, ring: true }) }
    }
    for (const s of this.stations.values()) if (s !== this.active) s.update(dt * 0)
    const a = this.active
    if (!a) return
    a.update(dt)
    const pal = this.palette()
    if (this.screen.flash > 0) this.screen.flash = Math.max(0, this.screen.flash - dt / 0.4)
    this.screen.frame(pal, (g) => a.drawLum(g, this.screen.w, this.screen.h), (g) => a.drawCrisp(g, this.screen.w, this.screen.h))
    this.clockEl.textContent = clockText()
  }
}

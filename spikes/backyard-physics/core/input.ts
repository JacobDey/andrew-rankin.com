/**
 * Unified desktop + touch input for walkable 3D scenes.
 *
 * Desktop: WASD / arrows to move, Shift to run, Space to jump, drag on empty space to look,
 *          press-and-drag on a prop to grab it, wheel to push/pull the held prop (or zoom),
 *          optional pointer lock (press L or call requestPointerLock) for classic mouse-look
 *          with a centre crosshair.
 * Touch:   a floating joystick appears wherever the left thumb lands (left 40% of the screen),
 *          drag anywhere else to look, press on a prop to grab it, a second finger pinches to
 *          push/pull the held prop or zoom.
 *
 * The module doesn't know about physics. It asks the host whether a press should grab:
 * `press(x, y)` returns 'grab' or 'look'. Coordinates are CSS pixels relative to the element.
 */

export type PressResult = 'grab' | 'look'

export interface InputHandlers {
  /** A pointer went down at (x, y). Decide whether it grabs something. */
  press(x: number, y: number, pointerType: string): PressResult
  /** A grabbing pointer moved. */
  drag?(x: number, y: number): void
  /** A grabbing pointer was released. */
  release?(x: number, y: number): void
  /** Pointer hover (mouse only), for cursors/highlights. */
  hover?(x: number, y: number): void
  /** Keys not handled internally (e.g. 'KeyF', 'KeyO'). */
  key?(code: string, down: boolean): void
  /** Pinch (touch) or wheel: positive = pull closer / zoom in. Units ~ metres. */
  pinch?(delta: number): void
}

export interface FrameInput {
  /** Move intent, x = strafe right, z = forward, each -1..1. */
  moveX: number
  moveZ: number
  run: boolean
  jump: boolean
  /** Look delta in radians since the last consume(): +yaw turns right, +pitch looks down. */
  lookYaw: number
  lookPitch: number
}

export interface InputOptions {
  /** Radians per CSS pixel of drag-look. Default 0.0042 (mouse) / 0.006 (touch). */
  mouseLookSpeed?: number
  touchLookSpeed?: number
  /** Radians per pixel of pointer-locked mouse movement. Default 0.0022. */
  lockedLookSpeed?: number
  /** Fraction of the screen width that spawns the joystick on touch. Default 0.4. */
  joystickZone?: number
  /** Joystick radius in CSS px. Default 56. */
  joystickRadius?: number
}

interface Tracked {
  id: number
  kind: 'look' | 'grab' | 'stick'
  x: number
  y: number
  ox: number
  oy: number
  type: string
}

export class InputController {
  readonly el: HTMLElement
  readonly opts: Required<InputOptions>
  private handlers: InputHandlers
  private keys = new Set<string>()
  private pointers = new Map<number, Tracked>()
  private lookYaw = 0
  private lookPitch = 0
  private jumpQueued = false
  private stickX = 0
  private stickY = 0
  private stickBase: HTMLDivElement
  private stickKnob: HTMLDivElement
  private pinchDist = 0
  /** Virtual buttons (touch HUD) can force these on. */
  buttons = { run: false, jump: false }
  locked = false
  private disposers: (() => void)[] = []

  constructor(el: HTMLElement, handlers: InputHandlers, opts: InputOptions = {}) {
    this.el = el
    this.handlers = handlers
    this.opts = {
      mouseLookSpeed: opts.mouseLookSpeed ?? 0.0042,
      touchLookSpeed: opts.touchLookSpeed ?? 0.006,
      lockedLookSpeed: opts.lockedLookSpeed ?? 0.0022,
      joystickZone: opts.joystickZone ?? 0.4,
      joystickRadius: opts.joystickRadius ?? 56,
    }
    el.style.touchAction = 'none'
    el.style.userSelect = 'none'
    ;(el.style as CSSStyleDeclaration & { webkitUserSelect: string }).webkitUserSelect = 'none'

    const r = this.opts.joystickRadius
    this.stickBase = document.createElement('div')
    this.stickKnob = document.createElement('div')
    Object.assign(this.stickBase.style, {
      position: 'fixed', width: `${r * 2}px`, height: `${r * 2}px`, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,.55)', background: 'rgba(20,20,20,.18)',
      pointerEvents: 'none', display: 'none', zIndex: '20', transform: 'translate(-50%,-50%)',
      boxShadow: '0 2px 12px rgba(0,0,0,.25)',
    } satisfies Partial<CSSStyleDeclaration>)
    Object.assign(this.stickKnob.style, {
      position: 'fixed', width: `${r * 0.9}px`, height: `${r * 0.9}px`, borderRadius: '50%',
      background: 'rgba(255,255,255,.75)', pointerEvents: 'none', display: 'none', zIndex: '21',
      transform: 'translate(-50%,-50%)',
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.append(this.stickBase, this.stickKnob)

    const on = <K extends keyof HTMLElementEventMap>(
      t: HTMLElement | Document | Window,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      o?: AddEventListenerOptions,
    ) => {
      t.addEventListener(type, fn as EventListener, o)
      this.disposers.push(() => t.removeEventListener(type, fn as EventListener, o))
    }

    on(el, 'pointerdown', (e) => this.onDown(e))
    on(window, 'pointermove', (e) => this.onMove(e))
    on(window, 'pointerup', (e) => this.onUp(e))
    on(window, 'pointercancel', (e) => this.onUp(e))
    on(el, 'wheel', (e) => {
      e.preventDefault()
      this.handlers.pinch?.(-e.deltaY * 0.004)
    }, { passive: false })
    on(el, 'contextmenu', (e) => e.preventDefault())
    on(window, 'keydown', (e) => {
      if (isTyping(e)) return
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (e.repeat) return
      this.keys.add(e.code)
      if (e.code === 'Space') this.jumpQueued = true
      if (e.code === 'KeyL') this.requestPointerLock()
      this.handlers.key?.(e.code, true)
    })
    on(window, 'keyup', (e) => {
      this.keys.delete(e.code)
      this.handlers.key?.(e.code, false)
    })
    on(window, 'blur', () => this.keys.clear())
    on(document, 'pointerlockchange' as keyof HTMLElementEventMap, () => {
      this.locked = document.pointerLockElement === this.el
    })
    on(document, 'mousemove', (e) => {
      if (!this.locked) return
      this.lookYaw += e.movementX * this.opts.lockedLookSpeed
      this.lookPitch += e.movementY * this.opts.lockedLookSpeed
    })
  }

  requestPointerLock(): void {
    if (this.locked) document.exitPointerLock()
    else this.el.requestPointerLock?.()
  }

  /** Call once per frame. Returns accumulated intent and resets look deltas. */
  consume(): FrameInput {
    const k = this.keys
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
    let mz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
    mx += this.stickX
    mz += this.stickY
    const len = Math.hypot(mx, mz)
    if (len > 1) {
      mx /= len
      mz /= len
    }
    const out: FrameInput = {
      moveX: mx,
      moveZ: mz,
      run: k.has('ShiftLeft') || k.has('ShiftRight') || this.buttons.run || Math.hypot(this.stickX, this.stickY) > 0.97,
      jump: this.jumpQueued || this.buttons.jump,
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
    }
    this.lookYaw = 0
    this.lookPitch = 0
    this.jumpQueued = false
    this.buttons.jump = false
    return out
  }

  /** Inject look (for tests or gamepads). */
  addLook(yaw: number, pitch: number): void {
    this.lookYaw += yaw
    this.lookPitch += pitch
  }

  isGrabbing(): boolean {
    for (const p of this.pointers.values()) if (p.kind === 'grab') return true
    return false
  }

  dispose(): void {
    for (const d of this.disposers) d()
    this.stickBase.remove()
    this.stickKnob.remove()
  }

  // ------------------------------------------------------------------ pointer handling

  private local(e: PointerEvent): [number, number] {
    const r = this.el.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  private onDown(e: PointerEvent): void {
    const [x, y] = this.local(e)
    const touch = e.pointerType === 'touch'
    if (this.locked && e.pointerType === 'mouse') {
      // Crosshair grabs from the centre of the element.
      const r = this.el.getBoundingClientRect()
      const cx = r.width / 2
      const cy = r.height / 2
      const res = this.handlers.press(cx, cy, 'mouse')
      this.pointers.set(e.pointerId, { id: e.pointerId, kind: res, x: cx, y: cy, ox: cx, oy: cy, type: 'mouse' })
      return
    }
    e.preventDefault()
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events in tests can't be captured */
    }
    const hasStick = [...this.pointers.values()].some((p) => p.kind === 'stick')
    if (touch && !hasStick && x < this.el.clientWidth * this.opts.joystickZone && !this.isGrabbing()) {
      // Floating joystick unless the thumb landed on a prop (lets you grab from the left side too).
      const res = this.handlers.press(x, y, e.pointerType)
      if (res === 'grab') {
        this.pointers.set(e.pointerId, { id: e.pointerId, kind: 'grab', x, y, ox: x, oy: y, type: e.pointerType })
        return
      }
      this.pointers.set(e.pointerId, { id: e.pointerId, kind: 'stick', x, y, ox: x, oy: y, type: e.pointerType })
      this.showStick(e.clientX, e.clientY, e.clientX, e.clientY)
      return
    }
    if (this.isGrabbing() || this.lookCount() > 0) {
      // Second finger: becomes a pinch partner, never a second grab.
      this.pointers.set(e.pointerId, { id: e.pointerId, kind: 'look', x, y, ox: x, oy: y, type: e.pointerType })
      this.pinchDist = this.twoFingerDistance()
      return
    }
    const res = this.handlers.press(x, y, e.pointerType)
    this.pointers.set(e.pointerId, { id: e.pointerId, kind: res, x, y, ox: x, oy: y, type: e.pointerType })
  }

  private onMove(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId)
    if (!p) {
      if (e.pointerType === 'mouse' && !this.locked && e.target === this.el) {
        const [x, y] = this.local(e)
        this.handlers.hover?.(x, y)
      }
      return
    }
    if (this.locked && p.type === 'mouse') {
      if (p.kind === 'grab') {
        const r = this.el.getBoundingClientRect()
        this.handlers.drag?.(r.width / 2, r.height / 2)
      }
      return
    }
    const [x, y] = this.local(e)
    const dx = x - p.x
    const dy = y - p.y
    p.x = x
    p.y = y
    if (p.kind === 'stick') {
      const r = this.opts.joystickRadius
      let sx = (x - p.ox) / r
      let sy = (y - p.oy) / r
      const l = Math.hypot(sx, sy)
      if (l > 1) {
        // Drag the base along so the stick never "runs out" (floating joystick).
        p.ox += (sx / l) * (l - 1) * r
        p.oy += (sy / l) * (l - 1) * r
        sx /= l
        sy /= l
      }
      this.stickX = sx
      this.stickY = -sy
      const rect = this.el.getBoundingClientRect()
      this.showStick(rect.left + p.ox, rect.top + p.oy, rect.left + p.ox + sx * r, rect.top + p.oy + sy * r)
      return
    }
    const nTouch = this.twoFingerCount()
    if (nTouch >= 2) {
      const d = this.twoFingerDistance()
      if (this.pinchDist > 0) this.handlers.pinch?.((d - this.pinchDist) * 0.01)
      this.pinchDist = d
      if (p.kind === 'grab') this.handlers.drag?.(x, y)
      return
    }
    if (p.kind === 'grab') {
      this.handlers.drag?.(x, y)
    } else {
      const s = p.type === 'touch' ? this.opts.touchLookSpeed : this.opts.mouseLookSpeed
      this.lookYaw += dx * s
      this.lookPitch += dy * s
    }
  }

  private onUp(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    this.pointers.delete(e.pointerId)
    if (p.kind === 'stick') {
      this.stickX = 0
      this.stickY = 0
      this.stickBase.style.display = 'none'
      this.stickKnob.style.display = 'none'
    } else if (p.kind === 'grab') {
      this.handlers.release?.(p.x, p.y)
    }
    this.pinchDist = this.twoFingerDistance()
  }

  private lookCount(): number {
    let n = 0
    for (const p of this.pointers.values()) if (p.kind === 'look') n++
    return n
  }

  private twoFingerCount(): number {
    let n = 0
    for (const p of this.pointers.values()) if (p.kind !== 'stick') n++
    return n
  }

  private twoFingerDistance(): number {
    const ps = [...this.pointers.values()].filter((p) => p.kind !== 'stick')
    if (ps.length < 2) return 0
    return Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)
  }

  private showStick(bx: number, by: number, kx: number, ky: number): void {
    this.stickBase.style.display = 'block'
    this.stickKnob.style.display = 'block'
    this.stickBase.style.left = `${bx}px`
    this.stickBase.style.top = `${by}px`
    this.stickKnob.style.left = `${kx}px`
    this.stickKnob.style.top = `${ky}px`
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

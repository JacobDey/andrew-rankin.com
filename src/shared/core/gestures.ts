// Pointer-event gestures: tap, double tap, hold, drag, pinch, twist, wheel, hover, two-finger tap/drag.
// Sets touch-action: none on the element. Coordinates are CSS px relative to the element.

export interface GestureOptions {
  tapMs?: number // 250
  tapPx?: number // 6
  holdMs?: number // 450
  doubleMs?: number // 300
  doublePx?: number // 12
  preventContextMenu?: boolean // true
}

export type GestureKind =
  | 'down'
  | 'move'
  | 'up'
  | 'cancel'
  | 'hover'
  | 'tap'
  | 'doubleTap'
  | 'hold'
  | 'dragStart'
  | 'drag'
  | 'dragEnd'
  | 'wheel'
  | 'pinch'
  | 'twist'
  | 'twoFingerTap'
  | 'twoFingerDrag'

export interface GestureEvent {
  kind: GestureKind
  id: number
  t: number
  x: number
  y: number // CSS px relative to the element
  nx: number
  ny: number // NDC -1..1, y up
  dx: number
  dy: number // since the previous event
  totalDx: number
  totalDy: number
  startX: number
  startY: number
  vx: number
  vy: number // px/s, mean over the last 80 ms (throws, flicks)
  scale: number
  angle: number // pinch scale and twist (rad) since the two-finger start
  deltaY: number // wheel, normalized to px
  pointerType: 'mouse' | 'pen' | 'touch'
  button: number
  buttons: number
  pointers: number
  pressure: number
  shift: boolean
  alt: boolean
  ctrl: boolean
  meta: boolean
  native: Event
}

export interface Gestures {
  /** Higher priority first; returning true stops lower handlers. */
  on(handler: (e: GestureEvent) => boolean | void, priority?: number): () => void
  setOptions(o: Partial<GestureOptions>): void
  readonly activePointers: number
  dispose(): void
}

interface Sample {
  t: number
  x: number
  y: number
}

interface Ptr {
  id: number
  type: 'mouse' | 'pen' | 'touch'
  button: number
  startX: number
  startY: number
  x: number
  y: number
  lastX: number
  lastY: number
  startT: number
  dragging: boolean
  holdFired: boolean
  holdTimer: number
  hist: Sample[]
  multi: boolean // another pointer was down at some point during this one's life
}

interface Handler {
  fn: (e: GestureEvent) => boolean | void
  priority: number
  seq: number
}

const VEL_WINDOW_MS = 80

export function createGestures(el: HTMLElement, options: GestureOptions = {}): Gestures {
  const opt: Required<GestureOptions> = {
    tapMs: 250,
    tapPx: 6,
    holdMs: 450,
    doubleMs: 300,
    doublePx: 12,
    preventContextMenu: true,
    ...options,
  }
  let handlers: Handler[] = []
  let hseq = 0
  const ptrs = new Map<number, Ptr>()
  let lastTap: { t: number; x: number; y: number } | null = null

  // Two-finger state
  let two: {
    a: number
    b: number
    d0: number
    ang0: number
    angPrev: number
    angUnwrapped: number
    mx0: number
    my0: number
    mxPrev: number
    myPrev: number
    lastScale: number
    lastAngle: number
    startT: number
    moved: number
    tapOk: boolean
  } | null = null

  const prevTouchAction = el.style.touchAction
  el.style.touchAction = 'none'

  const rect = (): DOMRect => el.getBoundingClientRect()

  function velocity(p: Ptr, now: number): [number, number] {
    const h = p.hist
    let i = h.length - 1
    if (i < 1) return [0, 0]
    const last = h[i] as Sample
    while (i > 0 && now - (h[i - 1] as Sample).t <= VEL_WINDOW_MS) i--
    const first = h[i] as Sample
    const dt = last.t - first.t
    if (dt <= 0) return [0, 0]
    return [((last.x - first.x) / dt) * 1000, ((last.y - first.y) / dt) * 1000]
  }

  function emit(kind: GestureKind, native: Event, p: Ptr | null, extra: Partial<GestureEvent> = {}): boolean {
    if (handlers.length === 0) return false
    const r = rect()
    const pe = native as PointerEvent
    const x = extra.x ?? (p ? p.x : (pe.clientX ?? 0) - r.left)
    const y = extra.y ?? (p ? p.y : (pe.clientY ?? 0) - r.top)
    const [vx, vy] = p ? velocity(p, native.timeStamp) : [0, 0]
    const me = native as MouseEvent
    const e: GestureEvent = {
      kind,
      id: p ? p.id : (pe.pointerId ?? -1),
      t: native.timeStamp,
      x,
      y,
      nx: r.width > 0 ? (x / r.width) * 2 - 1 : 0,
      ny: r.height > 0 ? 1 - (y / r.height) * 2 : 0,
      dx: p ? p.x - p.lastX : 0,
      dy: p ? p.y - p.lastY : 0,
      totalDx: p ? p.x - p.startX : 0,
      totalDy: p ? p.y - p.startY : 0,
      startX: p ? p.startX : x,
      startY: p ? p.startY : y,
      vx,
      vy,
      scale: 1,
      angle: 0,
      deltaY: 0,
      pointerType: p ? p.type : pe.pointerType === 'pen' || pe.pointerType === 'touch' ? pe.pointerType : 'mouse',
      button: p ? p.button : (me.button ?? 0),
      buttons: me.buttons ?? 0,
      pointers: ptrs.size,
      pressure: pe.pressure ?? 0,
      shift: !!me.shiftKey,
      alt: !!me.altKey,
      ctrl: !!me.ctrlKey,
      meta: !!me.metaKey,
      native,
      ...extra,
    }
    for (const h of handlers) {
      if (h.fn(e) === true) return true
    }
    return false
  }

  function localXY(ev: PointerEvent): [number, number] {
    const r = rect()
    return [ev.clientX - r.left, ev.clientY - r.top]
  }

  function clearHold(p: Ptr): void {
    if (p.holdTimer) {
      clearTimeout(p.holdTimer)
      p.holdTimer = 0
    }
  }

  function twoMetrics(): { d: number; ang: number; mx: number; my: number } | null {
    if (!two) return null
    const a = ptrs.get(two.a)
    const b = ptrs.get(two.b)
    if (!a || !b) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    return { d: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }

  function beginTwo(native: Event): void {
    const ids = [...ptrs.keys()]
    if (ids.length < 2) return
    const a = ptrs.get(ids[0] as number) as Ptr
    const b = ptrs.get(ids[1] as number) as Ptr
    for (const p of [a, b]) {
      clearHold(p)
      p.multi = true
      if (p.dragging) {
        p.dragging = false
        emit('dragEnd', native, p)
      }
    }
    const dx = b.x - a.x
    const dy = b.y - a.y
    const ang = Math.atan2(dy, dx)
    two = {
      a: a.id,
      b: b.id,
      d0: Math.max(1, Math.hypot(dx, dy)),
      ang0: ang,
      angPrev: ang,
      angUnwrapped: 0,
      mx0: (a.x + b.x) / 2,
      my0: (a.y + b.y) / 2,
      mxPrev: (a.x + b.x) / 2,
      myPrev: (a.y + b.y) / 2,
      lastScale: 1,
      lastAngle: 0,
      startT: native.timeStamp,
      moved: 0,
      tapOk: true,
    }
  }

  function updateTwo(native: Event): void {
    if (!two) return
    const m = twoMetrics()
    if (!m) return
    let da = m.ang - two.angPrev
    if (da > Math.PI) da -= Math.PI * 2
    else if (da < -Math.PI) da += Math.PI * 2
    two.angPrev = m.ang
    two.angUnwrapped += da
    const scale = m.d / two.d0
    const mdx = m.mx - two.mxPrev
    const mdy = m.my - two.myPrev
    two.mxPrev = m.mx
    two.myPrev = m.my
    two.moved = Math.max(two.moved, Math.hypot(m.mx - two.mx0, m.my - two.my0), Math.abs(m.d - two.d0))
    if (two.moved > opt.tapPx * 2) two.tapOk = false
    const a = ptrs.get(two.a) as Ptr
    const common: Partial<GestureEvent> = {
      x: m.mx,
      y: m.my,
      dx: mdx,
      dy: mdy,
      totalDx: m.mx - two.mx0,
      totalDy: m.my - two.my0,
      startX: two.mx0,
      startY: two.my0,
      scale,
      angle: two.angUnwrapped,
      id: a.id,
    }
    if (Math.abs(scale - two.lastScale) > 0.0005) {
      two.lastScale = scale
      emit('pinch', native, null, common)
    }
    if (Math.abs(two.angUnwrapped - two.lastAngle) > 0.0005) {
      two.lastAngle = two.angUnwrapped
      emit('twist', native, null, common)
    }
    if (Math.abs(mdx) > 0.2 || Math.abs(mdy) > 0.2) emit('twoFingerDrag', native, null, common)
  }

  const onDown = (ev: PointerEvent): void => {
    if (ptrs.size >= 2) return // ignore a third finger
    const [x, y] = localXY(ev)
    const type = ev.pointerType === 'pen' || ev.pointerType === 'touch' ? ev.pointerType : 'mouse'
    const p: Ptr = {
      id: ev.pointerId,
      type,
      button: ev.button,
      startX: x,
      startY: y,
      x,
      y,
      lastX: x,
      lastY: y,
      startT: ev.timeStamp,
      dragging: false,
      holdFired: false,
      holdTimer: 0,
      hist: [{ t: ev.timeStamp, x, y }],
      multi: ptrs.size > 0,
    }
    ptrs.set(p.id, p)
    try {
      el.setPointerCapture(ev.pointerId)
    } catch {
      /* pointer already gone */
    }
    emit('down', ev, p)
    if (ptrs.size === 2) {
      beginTwo(ev)
    } else if (!p.multi) {
      p.holdTimer = window.setTimeout(() => {
        p.holdTimer = 0
        if (ptrs.has(p.id) && !p.dragging && !p.multi && ptrs.size === 1) {
          p.holdFired = true
          emit('hold', ev, p)
        }
      }, opt.holdMs)
    }
  }

  const onMove = (ev: PointerEvent): void => {
    const p = ptrs.get(ev.pointerId)
    if (!p) {
      if (ev.pointerType !== 'touch' && ev.buttons === 0) {
        const [x, y] = localXY(ev)
        emit('hover', ev, null, { x, y })
      }
      return
    }
    // coalesced events keep fast flicks accurate in the velocity history
    const batch = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : []
    for (const c of batch.length ? batch : [ev]) {
      const [cx, cy] = localXY(c)
      p.hist.push({ t: c.timeStamp || ev.timeStamp, x: cx, y: cy })
    }
    while (p.hist.length > 24 || (p.hist.length > 2 && ev.timeStamp - (p.hist[0] as Sample).t > 250)) p.hist.shift()
    const [x, y] = localXY(ev)
    p.x = x
    p.y = y

    if (two && (p.id === two.a || p.id === two.b)) {
      emit('move', ev, p)
      updateTwo(ev)
    } else {
      emit('move', ev, p)
      if (!p.dragging && !p.multi && Math.hypot(p.x - p.startX, p.y - p.startY) > opt.tapPx) {
        clearHold(p)
        p.dragging = true
        emit('dragStart', ev, p)
      }
      if (p.dragging) emit('drag', ev, p)
    }
    // dx/dy of the next event are measured from here
    p.lastX = p.x
    p.lastY = p.y
  }

  const finish = (ev: PointerEvent, cancelled: boolean): void => {
    const p = ptrs.get(ev.pointerId)
    if (!p) return
    clearHold(p)
    const [x, y] = localXY(ev)
    if (!cancelled) {
      p.lastX = p.x
      p.lastY = p.y
      p.x = x
      p.y = y
      p.hist.push({ t: ev.timeStamp, x, y })
    }
    const wasTwo = two !== null && (p.id === two.a || p.id === two.b)
    const elapsed = ev.timeStamp - p.startT
    const moved = Math.hypot(p.x - p.startX, p.y - p.startY)
    try {
      el.releasePointerCapture(ev.pointerId)
    } catch {
      /* not captured */
    }

    if (cancelled) {
      if (p.dragging) emit('dragEnd', ev, p)
      emit('cancel', ev, p)
      ptrs.delete(p.id)
      if (wasTwo) two = null
      return
    }

    emit('up', ev, p)
    if (p.dragging) {
      p.dragging = false
      emit('dragEnd', ev, p)
    } else if (wasTwo && two) {
      // second finger lifts: a two-finger tap if neither moved and it was quick
      const quick = ev.timeStamp - two.startT <= opt.tapMs
      if (two.tapOk && quick && ptrs.size === 2) {
        const m = twoMetrics()
        emit('twoFingerTap', ev, null, { x: m?.mx ?? p.x, y: m?.my ?? p.y, startX: two.mx0, startY: two.my0, id: two.a })
      }
    } else if (!p.multi && !p.holdFired && elapsed <= opt.tapMs && moved <= opt.tapPx) {
      const dbl =
        lastTap !== null &&
        ev.timeStamp - lastTap.t <= opt.doubleMs &&
        Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= opt.doublePx
      emit('tap', ev, p)
      if (dbl) {
        lastTap = null
        emit('doubleTap', ev, p)
      } else {
        lastTap = { t: ev.timeStamp, x: p.x, y: p.y }
      }
    }
    ptrs.delete(p.id)
    if (wasTwo) two = null
    // the remaining finger (if any) must not turn into a tap/drag after a two-finger gesture
    for (const rest of ptrs.values()) {
      rest.multi = true
      clearHold(rest)
      rest.startX = rest.x
      rest.startY = rest.y
    }
  }

  const onUp = (ev: PointerEvent): void => finish(ev, false)
  const onCancel = (ev: PointerEvent): void => finish(ev, true)

  const onWheel = (ev: WheelEvent): void => {
    let dy = ev.deltaY
    if (ev.deltaMode === 1) dy *= 16
    else if (ev.deltaMode === 2) dy *= window.innerHeight
    const r = rect()
    emit('wheel', ev, null, { x: ev.clientX - r.left, y: ev.clientY - r.top, deltaY: dy, id: -1 })
    ev.preventDefault() // the stage never scrolls, and ctrl+wheel must not zoom the page
  }

  const onContext = (ev: Event): void => {
    if (opt.preventContextMenu) ev.preventDefault()
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onCancel)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('contextmenu', onContext)

  return {
    on(fn, priority = 0) {
      const h: Handler = { fn, priority, seq: hseq++ }
      handlers = [...handlers, h].sort((a, b) => b.priority - a.priority || a.seq - b.seq)
      return () => {
        handlers = handlers.filter((x) => x !== h)
      }
    },
    setOptions(o) {
      Object.assign(opt, o)
    },
    get activePointers() {
      return ptrs.size
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContext)
      for (const p of ptrs.values()) clearHold(p)
      ptrs.clear()
      two = null
      handlers = []
      el.style.touchAction = prevTouchAction
    },
  }
}

/**
 * Turns a pointer position into incremental rotation around (cx, cy): update() returns the
 * wrapped change in angle (radians, CCW-positive in screen space with y down => clockwise-positive
 * on screen) since the previous call. The first call after reset() returns 0.
 */
export function circularDrag(cx: number, cy: number): { update(x: number, y: number): number; reset(): void } {
  let prev: number | null = null
  return {
    update(x, y) {
      const a = Math.atan2(y - cy, x - cx)
      if (prev === null) {
        prev = a
        return 0
      }
      let d = a - prev
      if (d > Math.PI) d -= Math.PI * 2
      else if (d < -Math.PI) d += Math.PI * 2
      prev = a
      return d
    },
    reset() {
      prev = null
    },
  }
}

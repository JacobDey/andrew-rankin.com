// The loupe (hub.md §6): a round lens that magnifies whatever is under it. It renders a deep clone
// of the exposed sheet (crisp text, rasterized once at M×) and mirrors the live preview canvases
// into the clone each frame. Fine pointers: follows the cursor with a heavy, eased lag. Touch:
// press and hold a frame for 350 ms, the loupe opens 100 px above the finger, drag to move,
// release to close; a hold never navigates.

import type { GameSlug } from '@shared/games'
import type { Runner } from './previews/runner'
import { prefersReducedMotion } from '@shared/ui'
import { haptic } from '@shared/audio/core'

export interface Loupe {
  readonly el: HTMLElement
  enabled(): boolean
  setEnabled(on: boolean): void
  showAt(x: number, y: number, o?: { immediate?: boolean; touch?: boolean }): void
  hide(): void
  state(): { on: boolean; x: number; y: number } | null
  rebuild(): void
  cloneFrame(slug: GameSlug): HTMLElement | null
  syncMarks(): void
  holding(): boolean
}

interface Opts {
  exposed: HTMLElement
  runner: Runner
  initialOn: boolean
  onToggle?(on: boolean): void
}

export function createLoupe(o: Opts): Loupe {
  const { exposed, runner } = o
  const fine = matchMedia('(pointer: fine)').matches
  let on = o.initialOn
  let visible = false
  let M = fine ? 2.5 : 2.25
  let D = fine ? (innerWidth >= 1600 ? 240 : 200) : 150
  let R = D / 2
  // target (pointer) and eased positions, viewport coordinates of the hotspot
  let px = 0
  let py = 0
  let ex = 0
  let ey = 0
  let sx = 0
  let sy = 0
  let raf = 0
  let last = 0
  let frameNo = 0
  let rect = exposed.getBoundingClientRect()
  let imageRects: { slug: GameSlug; x: number; y: number; w: number; h: number; src: HTMLCanvasElement; dst: HTMLCanvasElement | null }[] = []
  let underLoupe: GameSlug[] = []
  let touchMode = false

  const shadow = document.createElement('div')
  shadow.className = 'hub-loupe-shadow'
  shadow.setAttribute('aria-hidden', 'true')
  const el = document.createElement('div')
  el.className = 'hub-loupe'
  el.setAttribute('aria-hidden', 'true')
  el.inert = true
  const pan = document.createElement('div')
  pan.style.cssText = 'position:absolute;left:0;top:0;will-change:transform'
  const world = document.createElement('div')
  world.className = 'hub-loupe__world'
  pan.append(world)
  const hot = document.createElement('span')
  hot.className = 'hub-loupe__hot'
  el.append(pan, hot)
  document.body.append(shadow, el)
  let clone: HTMLElement | null = null

  function setSize(): void {
    el.style.setProperty('--d', `${D}px`)
    shadow.style.setProperty('--d', `${D}px`)
    world.style.transform = `scale(${M})`
  }

  function refreshRects(): void {
    rect = exposed.getBoundingClientRect()
    imageRects = []
    for (const s of runner.slots()) {
      const r = s.canvas.getBoundingClientRect()
      const dst = clone?.querySelector<HTMLCanvasElement>(`[data-slug="${s.slug}"] canvas.hub-canvas`) ?? null
      imageRects.push({ slug: s.slug, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height, src: s.canvas, dst })
    }
  }

  function build(): void {
    clone?.remove()
    const c = exposed.cloneNode(true) as HTMLElement
    c.removeAttribute('id')
    for (const n of c.querySelectorAll('[id]')) n.removeAttribute('id')
    for (const n of c.querySelectorAll('[aria-describedby],[aria-labelledby]')) {
      n.removeAttribute('aria-describedby')
      n.removeAttribute('aria-labelledby')
    }
    for (const a of c.querySelectorAll('a, button')) a.setAttribute('tabindex', '-1')
    c.inert = true
    const cs = getComputedStyle(exposed)
    const r = exposed.getBoundingClientRect()
    c.style.width = `${r.width}px`
    c.style.padding = cs.padding
    c.style.margin = '0'
    const cols = getComputedStyle(exposed.querySelector('.hub-frames')!).getPropertyValue('--cols').trim()
    c.querySelector<HTMLElement>('.hub-frames')?.style.setProperty('--cols', cols || '1')
    world.replaceChildren(c)
    clone = c
    refreshRects()
    syncCanvases(true)
  }

  let rebuildTimer = 0
  function rebuild(): void {
    clearTimeout(rebuildTimer)
    rebuildTimer = window.setTimeout(build, 150)
  }

  function syncCanvases(all: boolean): void {
    const rr = R / M
    const cx = ex - rect.left
    const cy = ey - rect.top
    const hits: GameSlug[] = []
    let copied = 0
    for (const ir of imageRects) {
      const nx = Math.max(ir.x, Math.min(cx, ir.x + ir.w))
      const ny = Math.max(ir.y, Math.min(cy, ir.y + ir.h))
      const inside = (nx - cx) ** 2 + (ny - cy) ** 2 <= rr * rr
      if (inside) hits.push(ir.slug)
      if ((inside || all) && ir.dst && copied < (all ? 6 : 2)) {
        if (ir.dst.width !== ir.src.width || ir.dst.height !== ir.src.height) {
          ir.dst.width = ir.src.width
          ir.dst.height = ir.src.height
        }
        const g = ir.dst.getContext('2d')
        if (g && ir.src.width > 0) {
          g.clearRect(0, 0, ir.dst.width, ir.dst.height)
          g.drawImage(ir.src, 0, 0)
        }
        copied++
      }
    }
    if (hits.join() !== underLoupe.join()) {
      underLoupe = hits
      runner.setLoupe(visible ? hits : [])
    }
  }

  function syncMarks(): void {
    if (!clone) return
    for (const li of exposed.querySelectorAll<HTMLElement>('.hub-frame')) {
      const slug = li.dataset.slug
      const twin = clone.querySelector<HTMLElement>(`.hub-frame[data-slug="${slug}"]`)
      if (!twin) continue
      twin.className = li.className
      const m = li.querySelector('.hub-marks')
      const tm = twin.querySelector('.hub-marks')
      if (m && tm) tm.innerHTML = m.innerHTML
      else if (m && !tm) twin.querySelector('.hub-card')?.append(m.cloneNode(true))
    }
  }

  function place(): void {
    el.style.transform = `translate3d(${ex - R}px, ${ey - R}px, 0)`
    shadow.style.transform = `translate3d(${sx - R + 10}px, ${sy - R + 16}px, 0)`
    pan.style.transform = `translate3d(${R - M * (ex - rect.left)}px, ${R - M * (ey - rect.top)}px, 0)`
  }

  function loop(now: number): void {
    raf = 0
    if (!visible) return
    const dt = last ? Math.min(64, now - last) : 16
    last = now
    const reduce = prefersReducedMotion()
    const k = reduce ? 1 : 1 - Math.exp(-dt / 40)
    const k2 = reduce ? 1 : 1 - Math.exp(-dt / 60)
    ex += (px - ex) * k
    ey += (py - ey) * k
    sx += (px - sx) * k2
    sy += (py - sy) * k2
    place()
    syncCanvases(false)
    if (++frameNo % 8 === 0) syncMarks()
    raf = requestAnimationFrame(loop)
  }

  function show(x: number, y: number, immediate: boolean): void {
    px = x
    py = y
    if (!clone) build()
    if (!visible || immediate) {
      ex = sx = x
      ey = sy = y
      rect = exposed.getBoundingClientRect()
      refreshRects()
    }
    if (!visible) {
      visible = true
      el.dataset.on = ''
      shadow.dataset.on = ''
      last = 0
    }
    place()
    syncCanvases(true)
    if (!raf) raf = requestAnimationFrame(loop)
  }

  function hide(): void {
    if (!visible) return
    visible = false
    delete el.dataset.on
    delete shadow.dataset.on
    underLoupe = []
    runner.setLoupe([])
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  // ---- fine pointer ----
  function applyCursorFlag(): void {
    document.documentElement.dataset.hubLoupe = on && fine ? 'on' : 'off'
  }
  applyCursorFlag()
  if (fine) {
    exposed.addEventListener('pointermove', (e) => {
      if (!on || e.pointerType === 'touch') return
      touchMode = false
      show(e.clientX, e.clientY, false)
    })
    exposed.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') hide()
    })
    window.addEventListener('blur', hide)
    exposed.addEventListener(
      'wheel',
      (e) => {
        if (!e.altKey || !visible) return
        e.preventDefault()
        M = Math.max(1.5, Math.min(4, M + (e.deltaY < 0 ? 0.25 : -0.25)))
        setSize()
        place()
      },
      { passive: false },
    )
  }
  addEventListener(
    'scroll',
    () => {
      if (visible && !touchMode) hide()
      rect = exposed.getBoundingClientRect()
    },
    { passive: true },
  )
  addEventListener('resize', () => {
    D = fine ? (innerWidth >= 1600 ? 240 : 200) : 150
    R = D / 2
    setSize()
    rebuild()
  })

  // ---- touch: press and hold ----
  let holdTimer = 0
  let holdingNow = false
  let pending = false
  let startX = 0
  let startY = 0
  let swallowUntil = 0
  const touchPos = (x: number, y: number): [number, number] => [
    Math.max(R + 4, Math.min(innerWidth - R - 4, x)),
    Math.max(R + 4, Math.min(innerHeight - R - 4, y - 100)),
  ]
  exposed.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        clearTimeout(holdTimer)
        return
      }
      const t = e.touches[0]!
      startX = t.clientX
      startY = t.clientY
      clearTimeout(holdTimer)
      pending = true
      holdTimer = window.setTimeout(() => {
        pending = false
        holdingNow = true
        touchMode = true
        const [x, y] = touchPos(startX, startY)
        show(x, y, true)
        haptic(10)
      }, 350)
    },
    { passive: true },
  )
  exposed.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0]
      if (!t) return
      if (holdingNow) {
        e.preventDefault()
        const [x, y] = touchPos(t.clientX, t.clientY)
        show(x, y, false)
      } else if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) {
        clearTimeout(holdTimer)
        pending = false
      }
    },
    { passive: false },
  )
  const endTouch = (): void => {
    clearTimeout(holdTimer)
    pending = false
    if (holdingNow) {
      holdingNow = false
      swallowUntil = performance.now() + 500
      hide()
    }
  }
  exposed.addEventListener('touchend', endTouch)
  exposed.addEventListener('touchcancel', endTouch)
  exposed.addEventListener(
    'click',
    (e) => {
      if (performance.now() < swallowUntil) {
        e.preventDefault()
        e.stopPropagation()
        swallowUntil = 0
      }
    },
    true,
  )
  exposed.addEventListener('contextmenu', (e) => {
    if (holdingNow || pending) e.preventDefault()
  })

  setSize()

  return {
    el,
    enabled: () => on,
    setEnabled(v) {
      on = v
      applyCursorFlag()
      if (!on) hide()
      o.onToggle?.(on)
    },
    showAt(x, y, opt = {}) {
      if (x < 0 && y < 0) return hide()
      if (opt.touch) touchMode = true
      show(x, y, opt.immediate ?? true)
    },
    hide,
    state: () => (visible ? { on: true, x: Math.round(ex), y: Math.round(ey) } : null),
    rebuild,
    cloneFrame: (slug) => clone?.querySelector<HTMLElement>(`.hub-frame[data-slug="${slug}"]`) ?? null,
    syncMarks,
    holding: () => holdingNow,
  }
}

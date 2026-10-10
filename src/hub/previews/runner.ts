// One requestAnimationFrame loop for all six previews (hub.md §4.2). Each visible preview draws
// only when its interval is due (idle 100 ms at 1/3 speed, active 33 ms at full speed); off-screen
// previews and hidden tabs cost nothing. Backing resolution follows the frame's state (idle,
// active, under the loupe). Adaptive: if the p90 cost of a tick goes over 6 ms across 2 s, idle
// drops to 6 fps at DPR 1; if it still does, idle frames freeze on their hero moment.

import type { GameSlug } from '@shared/games'
import type { Preview, PreviewEnv } from './types'
import { percentile } from '@shared/core'

export interface Slot {
  readonly slug: GameSlug
  readonly canvas: HTMLCanvasElement
  readonly preview: Preview
  readonly env: PreviewEnv
  cssW: number
  cssH: number
  visible: boolean
  active: boolean
  loupe: boolean
  ready: boolean
  dirty: boolean
  t: number
  drawnT: number
  lastDraw: number
}

export interface RunnerStats {
  degrade: 0 | 1 | 2
  p90: number
  draws: number
  ready: number
}

export interface Runner {
  add(slug: GameSlug, canvas: HTMLCanvasElement, preview: Preview, o: { seed: number; accentLit: string }): Slot
  start(): void
  slot(slug: GameSlug): Slot | undefined
  slots(): readonly Slot[]
  setActive(slug: GameSlug | null): void
  setLoupe(slugs: readonly GameSlug[]): void
  freeze(t: number | null): void
  frozen(): number | null
  setReduced(on: boolean): void
  redraw(): void
  whenAllReady(): Promise<void>
  onReady(cb: (s: Slot, tone: string) => void): void
  onDraw(cb: (s: Slot) => void): void
  stats(): RunnerStats
  /** Mean ms per draw for each initialized preview at its current backing size. */
  bench(n?: number): Record<string, number>
}

const P90_LIMIT = 6
const WINDOW_MS = 2000

export function createRunner(o: { reduced: boolean; frozen: number | null }): Runner {
  const list: Slot[] = []
  let reduced = o.reduced
  let frozenT = o.frozen
  let degrade: 0 | 1 | 2 = 0
  let raf = 0
  let lastNow = 0
  let initDone = false
  let draws = 0
  let lastP90 = 0
  let costs: number[] = []
  let windowStart = 0
  const readyCbs: ((s: Slot, tone: string) => void)[] = []
  const drawCbs: ((s: Slot) => void)[] = []
  let resolveAll: () => void = () => {}
  const allReady = new Promise<void>((r) => {
    resolveAll = r
  })

  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              const s = list.find((x) => x.canvas === e.target)
              if (!s) continue
              s.visible = e.isIntersecting
              if (s.visible) s.dirty = true
            }
          },
          { rootMargin: '120px 0px' },
        )
      : null
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const s = list.find((x) => x.canvas === e.target)
      if (!s) continue
      const r = e.contentRect
      if (r.width > 0 && r.height > 0) {
        s.cssW = r.width
        s.cssH = r.height
        s.dirty = true
      }
    }
  })

  function targetScale(s: Slot): number {
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    if (s.loupe) return 2.5
    if (s.active) return Math.min(dpr, 2)
    return degrade >= 1 ? 1 : Math.min(dpr, 1.5)
  }

  function ensureSize(s: Slot): void {
    if (s.cssW <= 0) return
    const scale = targetScale(s)
    let tw = Math.round(s.cssW * scale)
    if (s.loupe) tw = Math.min(tw, 1100)
    tw = Math.max(2, Math.min(tw, 2400))
    const th = Math.max(2, Math.round((tw * s.cssH) / s.cssW))
    if (Math.abs(s.canvas.width - tw) <= 1 && Math.abs(s.canvas.height - th) <= 1) return
    s.canvas.width = tw
    s.canvas.height = th
    s.env.w = tw
    s.env.h = th
    s.env.dpr = tw / s.cssW
    s.preview.resize(s.env)
    s.dirty = true
  }

  function drawSlot(s: Slot, t: number, now: number): number {
    ensureSize(s)
    const t0 = performance.now()
    try {
      s.preview.draw(t)
    } catch (err) {
      console.debug('[hub] preview draw failed', s.slug, err)
    }
    const dt = performance.now() - t0
    s.lastDraw = now
    s.dirty = false
    s.drawnT = t
    draws++
    for (const cb of drawCbs) cb(s)
    return dt
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick)
    if (document.hidden) {
      lastNow = now
      return
    }
    const dt = lastNow ? Math.min(100, now - lastNow) : 16
    lastNow = now
    let cost = 0
    let drew = false
    for (const s of list) {
      if (!s.ready) continue
      const period = s.preview.period
      // until every preview is initialized, hold still: init gets the main thread first
      const still = frozenT !== null || reduced || !initDone || (degrade >= 2 && !s.active && !s.loupe)
      if (!still) s.t = (s.t + (dt / 1000) * (s.active || s.loupe ? 1 : 1 / 3)) % period
      if (!s.visible && !s.loupe) continue
      if (still) {
        if (!s.dirty && s.cssW > 0 && targetMatches(s)) continue
        const t = frozenT ?? (reduced || degrade >= 2 ? s.preview.heroT : s.t)
        cost += drawSlot(s, t, now)
        drew = true
        continue
      }
      const interval = s.active || s.loupe ? 33 : degrade >= 1 ? 166 : 100
      if (!s.dirty && now - s.lastDraw < interval && targetMatches(s)) continue
      cost += drawSlot(s, s.t, now)
      drew = true
    }
    if (drew && initDone) {
      if (!windowStart) windowStart = now
      costs.push(cost)
      if (now - windowStart >= WINDOW_MS) {
        lastP90 = percentile(costs, 0.9)
        if (lastP90 > P90_LIMIT && degrade < 2 && frozenT === null) {
          degrade = (degrade + 1) as 1 | 2
          for (const s of list) s.dirty = true
          console.debug(`[hub] previews over budget (p90 ${lastP90.toFixed(1)} ms): degrade ${degrade}`)
        }
        costs = []
        windowStart = now
      }
    }
  }

  function targetMatches(s: Slot): boolean {
    const scale = targetScale(s)
    let tw = Math.round(s.cssW * scale)
    if (s.loupe) tw = Math.min(tw, 1100)
    tw = Math.max(2, Math.min(tw, 2400))
    return Math.abs(s.canvas.width - tw) <= 1
  }

  function toneOf(c: HTMLCanvasElement): string {
    try {
      const t = document.createElement('canvas')
      t.width = t.height = 1
      const g = t.getContext('2d', { willReadFrequently: true })
      if (!g) return '#1A1816'
      g.drawImage(c, 0, 0, 1, 1)
      const d = g.getImageData(0, 0, 1, 1).data
      const y = Math.round(0.2126 * d[0]! + 0.7152 * d[1]! + 0.0722 * d[2]!)
      return `rgb(${y} ${y} ${y})`
    } catch {
      return '#1A1816'
    }
  }

  async function initAll(): Promise<void> {
    const order = [...list].sort((a, b) => Number(b.visible) - Number(a.visible))
    for (const s of order) {
      await new Promise<void>((r) => {
        if ('requestIdleCallback' in window) requestIdleCallback(() => r(), { timeout: 400 })
        else setTimeout(r, 1)
      })
      try {
        ensureSize(s)
        await s.preview.init(s.env)
        s.ready = true
        drawSlot(s, frozenT ?? (reduced ? s.preview.heroT : s.t), performance.now())
        const tone = toneOf(s.canvas)
        for (const cb of readyCbs) cb(s, tone)
      } catch (err) {
        console.debug('[hub] preview init failed', s.slug, err)
      }
    }
    initDone = true
    for (const s of list) s.dirty = true
    resolveAll()
  }

  return {
    add(slug, canvas, preview, x) {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2D canvas')
      const env: PreviewEnv = { canvas, ctx, w: canvas.width, h: canvas.height, dpr: 1, seed: x.seed, accentLit: x.accentLit }
      const r = canvas.getBoundingClientRect()
      const s: Slot = {
        slug,
        canvas,
        preview,
        env,
        cssW: r.width,
        cssH: r.height,
        visible: r.bottom > -120 && r.top < innerHeight + 120,
        active: false,
        loupe: false,
        ready: false,
        dirty: true,
        t: preview.heroT,
        drawnT: preview.heroT,
        lastDraw: 0,
      }
      list.push(s)
      io?.observe(canvas)
      ro.observe(canvas)
      return s
    },
    start() {
      if (!raf) raf = requestAnimationFrame(tick)
      void initAll()
    },
    slot: (slug) => list.find((s) => s.slug === slug),
    slots: () => list,
    setActive(slug) {
      for (const s of list) {
        const on = s.slug === slug
        if (s.active !== on) {
          s.active = on
          s.dirty = true
        }
      }
    },
    setLoupe(slugs) {
      for (const s of list) {
        const on = slugs.includes(s.slug)
        if (s.loupe !== on) {
          s.loupe = on
          s.dirty = true
        }
      }
    },
    freeze(t) {
      frozenT = t
      for (const s of list) s.dirty = true
    },
    frozen: () => frozenT,
    setReduced(on) {
      reduced = on
      for (const s of list) s.dirty = true
    },
    redraw() {
      for (const s of list) s.dirty = true
    },
    whenAllReady: () => allReady,
    onReady(cb) {
      readyCbs.push(cb)
    },
    onDraw(cb) {
      drawCbs.push(cb)
    },
    stats: () => ({ degrade, p90: lastP90, draws, ready: list.filter((s) => s.ready).length }),
    bench(n = 5) {
      const out: Record<string, number> = {}
      for (const s of list) {
        if (!s.ready) continue
        ensureSize(s)
        const t0 = performance.now()
        for (let i = 0; i < n; i++) s.preview.draw((s.t + i * 0.37) % s.preview.period)
        out[s.slug] = Math.round(((performance.now() - t0) / n) * 100) / 100
        s.dirty = true
      }
      return out
    },
  }
}

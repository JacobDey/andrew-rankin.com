// The hub: Roll 01, a contact sheet (docs/design/hub.md). The page is complete static HTML; this
// module enhances it: previews, black-and-white to colour on attention, grease pencil, the loupe,
// UI sounds, prefetch, progress notes, the safelight egg and the debug API (§15).

import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import './hub.css'
import { GAMES, gameBySlug, SITE, type GameSlug } from '@shared/games'
import { mountHubShell, getTheme, setTheme, onThemeChange, prefersReducedMotion, type Theme } from '@shared/ui'
import { installGameApi, markReady, flags, onReducedMotionChange, mulberry32, hashString } from '@shared/core'
import { readHubNote } from '@shared/storage'
import { uiSound, sound, haptic } from '@shared/audio/core'
import { PREVIEWS, createRunner, seedOf } from './previews'
import { createFrameMarks, type FrameMarks } from './grease'
import { createDictationMarks } from './dictation'
import { createLoupe } from './loupe'
import { lintRegistry, syncRegistry } from './registry'

const f = flags()
const ogMode = f.get('og')
const posterMode = f.get('poster')

if (ogMode || posterMode) {
  void import('./og').then((m) => m.startOg(ogMode, posterMode))
} else {
  void boot()
}

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* private mode */
  }
}
function ss(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function ssSet(key: string, v: string): void {
  try {
    sessionStorage.setItem(key, v)
  } catch {
    /* private mode */
  }
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV) {
    // In dev, Vite injects each page's CSS from JS, so the game page has not opted into the
    // cross-document view transition by the time it is revealed, and Chrome rejects the skipped
    // transition as an uncaught error there. The built pages link their CSS in <head>, so the
    // "enlargement" stays on in production.
    const s = document.createElement('style')
    s.textContent = '@view-transition { navigation: none; }'
    document.head.append(s)
  }
  const html = document.documentElement
  const fine = matchMedia('(pointer: fine)').matches
  const tParam = f.get('t')
  const frozenT = tParam !== null && tParam.trim() !== '' && Number.isFinite(Number(tParam)) ? Number(tParam) : null
  const deterministic = frozenT !== null || f.test
  let reduce = prefersReducedMotion()

  // ---- the shell, in hub mode; the skip link stays first in the tab order
  let loupeOn = fine && ls('ar:hub:loupe') !== 'off'
  const shell = mountHubShell({
    onLoupeToggle(on) {
      loupe.setEnabled(on)
    },
  })
  const skip = document.querySelector('.ar-skip')
  if (skip) document.body.prepend(skip)
  const loupeBtn = shell.el.querySelector<HTMLButtonElement>('.ar-shell__loupe')
  loupeBtn?.setAttribute('aria-pressed', String(loupeOn))

  syncRegistry()

  const sheet = document.querySelector<HTMLElement>('.hub-sheet')!
  const exposed = document.querySelector<HTMLElement>('.hub-exposed')!
  const ol = exposed.querySelector<HTMLElement>('.hub-frames')!
  const items = [...ol.querySelectorAll<HTMLElement>(':scope > .hub-frame')]
  const bySlug = new Map<GameSlug, HTMLElement>()
  for (const li of items) bySlug.set(li.dataset.slug as GameSlug, li)

  // ---- previews
  const runner = createRunner({ reduced: reduce, frozen: frozenT })
  for (const li of items) {
    const slug = li.dataset.slug as GameSlug
    const info = gameBySlug(slug)
    const img = li.querySelector<HTMLElement>('.hub-image')!
    const dev = document.createElement('div')
    dev.className = 'hub-dev'
    const canvas = document.createElement('canvas')
    canvas.className = 'hub-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    dev.append(canvas)
    img.prepend(dev)
    runner.add(slug, canvas, PREVIEWS[slug](), { seed: seedOf(slug), accentLit: info.accentLit })
  }
  runner.onReady((s, tone) => {
    const li = bySlug.get(s.slug)
    const img = li?.querySelector<HTMLElement>('.hub-image')
    img?.style.setProperty('--tone', tone)
    li?.querySelector<HTMLElement>('.hub-dev')?.setAttribute('data-in', '')
    loupe.rebuild()
  })

  // ---- grease marks per frame
  const marks = new Map<GameSlug, FrameMarks>()
  for (const li of items) {
    const slug = li.dataset.slug as GameSlug
    marks.set(slug, createFrameMarks(li.querySelector<HTMLElement>('.hub-card')!, gameBySlug(slug)))
  }
  const card = document.querySelector<HTMLElement>('.hub-dictation')
  const dictation = card ? createDictationMarks(card) : null

  // ---- the hand-laid rows: per-row wobble and scissor-cut strip ends (§3.2)
  let cols = 1
  function layoutRows(): void {
    cols = Math.max(1, Math.round(Number(getComputedStyle(ol).getPropertyValue('--cols')) || 1))
    const still = cols === 1 || reduce
    items.forEach((li, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      const r = mulberry32(hashString(`row:${row}:${cols}`))
      const rot = (r() - 0.5) * 0.5
      const dyU = r() * 0.6
      const cutLU = 0.15 + r() * 0.65
      const cutRU = 0.15 + r() * 0.65
      const u = li.clientWidth / 38
      const strip = li.querySelector<HTMLElement>('.hub-strip')!
      strip.style.setProperty('--rot', `${still ? 0 : rot}deg`)
      strip.style.setProperty('--dy', `${still ? 0 : dyU * u}px`)
      strip.style.setProperty('--ox', `${(cols / 2 - col) * 100}%`)
      strip.style.setProperty('--cutL', col === 0 ? `${cutLU * u}px` : '0px')
      strip.style.setProperty('--cutR', col === cols - 1 || i === items.length - 1 ? `${cutRU * u}px` : '0px')
    })
    for (const m of marks.values()) m.layout()
    dictation?.layout()
  }

  // ---- the loupe
  const loupe = createLoupe({
    exposed,
    runner,
    initialOn: loupeOn,
    onToggle(on) {
      loupeOn = on
      lsSet('ar:hub:loupe', on ? 'on' : 'off')
      loupeBtn?.setAttribute('aria-pressed', String(on))
    },
  })

  // ---- activation: one frame at a time (§4.1)
  let active: GameSlug | null = null
  let hovered: GameSlug | null = null
  let focused: GameSlug | null = null
  let centred: GameSlug | null = null
  let restored: GameSlug | null = null
  let forced: GameSlug | null | undefined = undefined
  const visitNonce = deterministic ? 0 : Math.floor(Math.random() * 1e6) // UI juice only
  const developed = new Set<GameSlug>()

  function mirror(slug: GameSlug, fn: (li: HTMLElement) => void): void {
    const a = bySlug.get(slug)
    if (a) fn(a)
    const b = loupe.cloneFrame(slug)
    if (b) fn(b)
  }

  function update(cause: 'pointer' | 'focus' | 'scroll' | 'api' | 'restore'): void {
    const next = forced !== undefined ? forced : hovered ?? focused ?? centred ?? restored
    if (next === active) return
    const prev = active
    active = next
    runner.setActive(next)
    if (prev) {
      mirror(prev, (li) => li.classList.remove('is-active'))
      marks.get(prev)?.hideCircle()
    }
    if (next) {
      mirror(next, (li) => li.classList.add('is-active'))
      marks.get(next)?.showCircle(`${next}${visitNonce}`, !reduce && cause !== 'restore')
      dictation?.check(gameBySlug(next).frame, !reduce)
      if (cause === 'pointer' || cause === 'focus') uiSound('tick')
      if (cause !== 'restore' && !developed.has(next) && uiSound('develop')) developed.add(next)
    }
    loupe.syncMarks()
  }

  for (const li of items) {
    const slug = li.dataset.slug as GameSlug
    li.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return
      hovered = slug
      restored = null
      update('pointer')
    })
    li.addEventListener('pointerleave', (e) => {
      li.classList.remove('is-pressed')
      if (e.pointerType === 'touch') return
      if (hovered === slug) hovered = null
      update('pointer')
    })
    li.addEventListener('focusin', () => {
      focused = slug
      update('focus')
    })
    li.addEventListener('focusout', (e) => {
      if (focused === slug && !li.contains(e.relatedTarget as Node | null)) focused = null
      update('focus')
    })
    li.addEventListener('pointerdown', (e) => {
      if (e.button === 0) li.classList.add('is-pressed')
    })
    li.addEventListener('pointerup', () => li.classList.remove('is-pressed'))
    li.addEventListener('pointercancel', () => li.classList.remove('is-pressed'))
    const link = li.querySelector<HTMLAnchorElement>('.hub-title a')!
    let lastPointer = 'mouse'
    li.addEventListener('pointerdown', (e) => {
      lastPointer = e.pointerType
    })
    link.addEventListener('click', (e) => {
      if (e.defaultPrevented) return
      ssSet('ar:hub:last', slug)
      uiSound('shutter')
      if (lastPointer === 'touch') haptic(10)
    })
  }

  // coarse pointers: the frame crossing the middle band of the viewport is the active one
  if (!fine && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) centred = ((e.target.closest('.hub-frame') as HTMLElement | null)?.dataset.slug as GameSlug | undefined) ?? centred
        }
        update('scroll')
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 },
    )
    for (const li of items) io.observe(li.querySelector('.hub-strip')!)
  }

  // permanent marks: drawn once, when each frame first comes into view
  const permIo =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue
              const slug = (e.target.closest('.hub-frame') as HTMLElement | null)?.dataset.slug as GameSlug | undefined
              if (!slug) continue
              permIo?.unobserve(e.target)
              void marks
                .get(slug)
                ?.drawPermanent(!reduce && !deterministic)
                .then(() => loupe.syncMarks())
            }
          },
          { threshold: 0.35 },
        )
      : null
  for (const li of items) {
    // deterministic shots draw every mark at once (nothing waits on scrolling)
    if (permIo && !deterministic) permIo.observe(li.querySelector('.hub-strip')!)
    else void marks.get(li.dataset.slug as GameSlug)?.drawPermanent(false)
  }

  // keyboard: ←/→ (and ↑/↓ in one column) move between frame links
  ol.addEventListener('keydown', (e) => {
    const link = (e.target as HTMLElement).closest('.hub-title a')
    if (!link) return
    const i = items.findIndex((li) => li.contains(link))
    let j = -1
    if (e.key === 'ArrowRight' || (cols === 1 && e.key === 'ArrowDown')) j = i + 1
    else if (e.key === 'ArrowLeft' || (cols === 1 && e.key === 'ArrowUp')) j = i - 1
    if (j < 0 || j >= items.length || e.altKey || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    items[j]!.querySelector<HTMLElement>('.hub-title a')?.focus()
  })

  // prefetch fallback where speculation rules are not supported (§8.3)
  const sr = (HTMLScriptElement as unknown as { supports?: (t: string) => boolean }).supports?.('speculationrules') ?? false
  if (!sr) {
    const done = new Set<string>()
    const pre = (slug: string): void => {
      if (done.has(slug)) return
      done.add(slug)
      const l = document.createElement('link')
      l.rel = 'prefetch'
      l.href = `/games/${slug}/`
      document.head.append(l)
    }
    for (const li of items) {
      const slug = li.dataset.slug!
      li.addEventListener('pointerenter', () => pre(slug))
      li.addEventListener('focusin', () => pre(slug))
      li.addEventListener('touchstart', () => pre(slug), { passive: true })
    }
  }

  // coming back from a game: re-activate the frame you came from (§8.4)
  const restore = (): void => {
    const ref = /\/games\/([a-z]+)\//.exec(document.referrer)?.[1]
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const last = ss('ar:hub:last')
    const pick = ref && GAMES.some((g) => g.slug === ref) ? ref : nav?.type === 'back_forward' ? last : null
    if (pick && GAMES.some((g) => g.slug === pick)) {
      restored = pick as GameSlug
      update('restore')
    }
  }
  if (!deterministic) restore()
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return
    hovered = null
    const last = ss('ar:hub:last')
    if (last && GAMES.some((g) => g.slug === last)) {
      restored = last as GameSlug
      update('restore')
    }
  })

  // ---- progress notes from the games (§8.5)
  function readProgress(): void {
    for (const g of GAMES) {
      const p = f.embed === 'poster' ? null : readHubNote(g.slug)
      marks.get(g.slug)?.setProgress(p)
      const d = document.getElementById(`p-${g.slug}`)
      if (d) d.textContent = p ? `Your progress: ${p.note}` : ''
    }
  }
  readProgress()
  addEventListener('storage', (e) => {
    if (e.key && /^ar:[a-z]+:hub$/.test(e.key)) {
      readProgress()
      loupe.rebuild()
    }
  })

  // ---- footer: source link, match my system, sound
  const repo = document.querySelector<HTMLAnchorElement>('[data-hub-repo]')
  if (repo) {
    if (SITE.repoUrl) repo.href = SITE.repoUrl
    else repo.remove()
  }
  const sys = document.querySelector<HTMLButtonElement>('[data-hub-act="system"]')
  if (sys) {
    sys.hidden = false
    sys.addEventListener('click', () => {
      setTheme(null)
      uiSound('switch')
      shell.announce('Matching your system theme.')
    })
  }
  const snd = document.querySelector<HTMLButtonElement>('[data-hub-act="sound"]')
  if (snd) {
    const paint = (): void => {
      snd.textContent = sound.muted ? 'Sound off' : 'Sound on'
      snd.setAttribute('aria-pressed', String(!sound.muted))
    }
    snd.hidden = false
    paint()
    sound.onChange(paint)
    snd.addEventListener('click', () => {
      sound.setMuted(!sound.muted)
      if (!sound.muted) uiSound('switch')
      paint()
    })
  }

  // ---- interaction hint for fine pointers
  const hint = document.querySelector<HTMLElement>('[data-hub-hint]')
  if (hint && fine) hint.textContent = 'Hover a frame to look closer. Click to play.'

  // ---- the safelight Easter egg (dark theme only, §7)
  const overlay = document.createElement('div')
  overlay.className = 'hub-safelight'
  overlay.setAttribute('aria-hidden', 'true')
  document.body.append(overlay)
  const chain = document.createElement('button')
  chain.type = 'button'
  chain.className = 'hub-chain'
  chain.setAttribute('aria-pressed', 'false')
  chain.setAttribute('aria-label', 'Safelight only')
  chain.title = 'Safelight only'
  let beads = ''
  for (let i = 0; i < 9; i++) beads += `<circle cx="22" cy="${6 + i * 9}" r="2.4"/>`
  chain.innerHTML = `<svg viewBox="0 0 44 120" aria-hidden="true" fill="currentColor">${beads}<path d="M22 86v6" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="92" width="12" height="20" rx="5"/></svg>`
  document.querySelector('.hub-intro')?.append(chain)
  let safelightOn = false
  const setSafelight = (on: boolean): void => {
    safelightOn = on && getTheme() === 'dark'
    overlay.toggleAttribute('data-on', safelightOn)
    chain.setAttribute('aria-pressed', String(safelightOn))
  }
  chain.addEventListener('click', () => {
    setSafelight(!safelightOn)
    uiSound('switch')
  })

  // ---- keep everything laid out
  const relayout = (): void => {
    layoutRows()
    loupe.rebuild()
  }
  new ResizeObserver(() => relayout()).observe(ol)
  // web fonts reflow the captions and the card: re-measure every mark when they land
  if (card) new ResizeObserver(() => dictation?.layout()).observe(card)
  document.fonts?.addEventListener?.('loadingdone', () => relayout())
  void document.fonts?.ready.then(() => relayout())
  onThemeChange((t: Theme) => {
    if (t !== 'dark') setSafelight(false)
    loupe.rebuild()
  })
  onReducedMotionChange((on) => {
    reduce = on
    runner.setReduced(on)
    layoutRows()
  })
  layoutRows()

  // ---- the debug API (§15)
  installGameApi('hub', 'hub@1', {
    state: () => ({
      theme: getTheme(),
      active,
      loupe: loupe.state(),
      cols: cols as 1 | 2 | 3,
      previews: runner.stats(),
      checks: dictation?.checked() ?? [],
    }),
    activate(slug: GameSlug | null) {
      forced = slug === null ? undefined : slug
      if (slug === null) {
        hovered = focused = centred = restored = null
      }
      update('api')
    },
    freeze(t: number | null) {
      runner.freeze(t)
    },
    loupeAt(x: number, y: number) {
      loupe.showAt(x, y, { immediate: true })
    },
    setTheme(t: 'light' | 'dark' | null) {
      setTheme(t)
    },
    safelight(on: boolean) {
      setSafelight(on)
    },
    lintRegistry: () => lintRegistry(),
    bench: (n?: number) => runner.bench(n),
    previewHash(slug: GameSlug, t: number): number {
      const s = runner.slot(slug)
      if (!s || !s.ready) return -1
      s.preview.draw(t)
      const g = s.canvas.getContext('2d', { willReadFrequently: true })
      if (!g) return -1
      const d = g.getImageData(0, 0, s.canvas.width, s.canvas.height).data
      let h = 0x811c9dc5
      for (let i = 0; i < d.length; i += 16) h = Math.imul(h ^ d[i]!, 0x01000193)
      s.dirty = true
      return h >>> 0
    },
  })

  runner.start()
  void Promise.all([document.fonts?.ready ?? Promise.resolve(), runner.whenAllReady()]).then(async () => {
    try {
      await document.fonts.load('500 13px "IBM Plex Mono"')
    } catch {
      /* fine */
    }
    layoutRows()
    runner.redraw()
    loupe.rebuild()
    markReady()
    const lp = f.get('loupe')
    if (lp) {
      const [x, y] = lp.split(',').map(Number)
      if (Number.isFinite(x) && Number.isFinite(y)) setTimeout(() => loupe.showAt(x!, y!, { immediate: true }), 200)
    }
  })
  void sheet
}

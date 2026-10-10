// The shared game shell: the film-strip header bar on every game page (hub.md §9, art-direction §6.1).
// Plain DOM and CSS. API: hub.md §9.2 verbatim, plus a few additive members noted in README.md.

import './shell.css'
import { gameBySlug, SITE, type GameSlug } from '../games'
import { flags } from '../core/flags'
import { shouldGameIgnoreKey } from '../core/keys'
import { isGameReady } from '../core/testapi'
import { local } from '../storage'
import { Audio, sound, uiSound } from '../audio/core'
import { iconSvg, type IconName } from './icons'
import { toast as showToast, announce as announceText, liveRegion } from './toast'
import { openMenu, type MenuItem } from './menu'
import { openHelp as openHelpDialog } from './help'
import { openDialog } from './dialog'
import { getTheme, setTheme, schemeLock, onThemeChange } from './theme'
import { installGrain } from './grain'
import { ensureGreaseFilter } from './grease'
import { attachTooltip } from './tooltip'

export { shouldGameIgnoreKey }

export interface ShellAction {
  id: string
  label: string // visible label (<= 12 chars) and the base of its aria-label
  icon?: IconName
  kind?: 'default' | 'primary' | 'toggle'
  pressed?: boolean // toggles only; sets aria-pressed
  disabled?: boolean
  shortcut?: string // shown in the tooltip and the help table; the GAME handles the key
  priority?: number // 0 = most important; the highest numbers move to "More" first
  onSelect(): void
}

export interface HelpContent {
  intro?: string // <= 2 sentences
  controls: Array<{ action: string; mouse?: string; touch?: string; keys?: string }>
  tips?: string[] // <= 4, one sentence each
}

export interface ShellOptions {
  slug: GameSlug // title, frame number, accent and scheme come from the registry
  actions?: ShellAction[]
  help?: HelpContent
  helpOnFirstVisit?: boolean // default true: opens once, records ar:<slug>:seenHelp
  autoHide?: boolean | { idleMs: number } // default false; idleMs default 2500
  fullscreen?: HTMLElement | null // default document.documentElement; null hides the button
  confirmLeave?: () => string | null // return a message to confirm on Back, or null to leave
  returnFocus?: () => void // called after a pointer-initiated action, e.g. () => stage.focus()
}

export interface Shell {
  readonly el: HTMLElement
  readonly height: number // px including safe-area; also published as --ar-shell-total
  setStatus(text: string | null): void // visual only (timers etc.); not announced
  announce(text: string): void // polite screen-reader announcement
  toast(text: string, opts?: { kind?: 'info' | 'success' | 'error'; ms?: number }): void
  setActions(actions: ShellAction[]): void
  updateAction(id: string, patch: Partial<ShellAction>): void
  openHelp(): void
  setAutoHide(on: boolean): void
  reveal(): void
  onSoundChange(cb: (muted: boolean) => void): () => void
  destroy(): void
}

const MIN_IDENTITY_PX = 112 // the title never shrinks below this before actions fold into More

type UnsubFn = () => void

// ---------------------------------------------------------------------------------------------
// small DOM helpers
// ---------------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function iconButton(icon: IconName, label: string, extra = ''): HTMLButtonElement {
  const b = el('button', 'ar-btn ar-btn--on-film ar-btn--icon' + (extra ? ' ' + extra : ''))
  b.type = 'button'
  b.setAttribute('aria-label', label)
  b.innerHTML = iconSvg(icon)
  return b
}

function setIcon(b: HTMLElement, icon: IconName): void {
  const svg = b.querySelector('svg')
  if (svg) svg.innerHTML = (iconSvg(icon).match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? '')
}

function frameCode(n: number): string {
  return `▸${String(n).padStart(2, '0')}`
}

const mqPhone = (): MediaQueryList => matchMedia('(max-width: 767px)')

function publishHeight(root: HTMLElement): number {
  const h = root.offsetHeight
  if (h > 0) document.documentElement.style.setProperty('--ar-shell-total', `${h}px`)
  return h
}

/** Sound, theme and fullscreen controls shared by the game and hub shells. */
interface Common {
  soundBtn: HTMLButtonElement
  lightsBtn: HTMLButtonElement | null
  fsBtn: HTMLButtonElement | null
  menuItems: { lights: () => MenuItem | null; fs: () => MenuItem | null }
  dispose: UnsubFn
}

function wireCommon(o: { fullscreen: HTMLElement | null; showLights: boolean }): Common {
  const disposers: UnsubFn[] = []

  // ---- sound ----
  const soundBtn = iconButton('sound', 'Mute sound', 'ar-shell__sound')
  const paintSound = (): void => {
    const muted = sound.muted
    soundBtn.setAttribute('aria-pressed', String(muted))
    setIcon(soundBtn, muted ? 'sound-off' : 'sound')
  }
  soundBtn.addEventListener('click', () => {
    const next = !sound.muted
    sound.setMuted(next)
    if (!next) uiSound('switch')
    paintSound()
  })
  paintSound()
  disposers.push(sound.onChange(paintSound))
  disposers.push(attachTooltip(soundBtn, () => ({ text: sound.muted ? 'Sound off' : 'Sound on' })))

  // ---- lights ----
  let lightsBtn: HTMLButtonElement | null = null
  const lightsLabel = (): { icon: IconName; label: string } =>
    getTheme() === 'dark' ? { icon: 'lights', label: 'Lights on' } : { icon: 'safelight', label: 'Lights off' }
  if (o.showLights) {
    lightsBtn = iconButton('lights', 'Lights on', 'ar-shell__lights')
    const b = lightsBtn
    const paintLights = (): void => {
      const l = lightsLabel()
      setIcon(b, l.icon)
      b.setAttribute('aria-label', l.label)
    }
    b.addEventListener('click', () => {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark')
      uiSound('switch')
      paintLights()
    })
    paintLights()
    disposers.push(onThemeChange(paintLights))
    disposers.push(attachTooltip(b, () => ({ text: lightsLabel().label })))
  }

  // ---- fullscreen ----
  let fsBtn: HTMLButtonElement | null = null
  const fsTarget = o.fullscreen
  const fsOk = !!fsTarget && document.fullscreenEnabled === true
  const toggleFs = (): void => {
    if (!fsTarget) return
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void fsTarget.requestFullscreen?.().catch(() => {})
  }
  if (fsOk) {
    fsBtn = iconButton('fullscreen', 'Fullscreen', 'ar-shell__fs')
    fsBtn.addEventListener('click', toggleFs)
    disposers.push(attachTooltip(fsBtn, () => ({ text: document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen' })))
    const onFs = (): void => {
      document.documentElement.toggleAttribute('data-fullscreen', !!document.fullscreenElement)
      fsBtn?.setAttribute('aria-pressed', String(!!document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFs)
    disposers.push(() => document.removeEventListener('fullscreenchange', onFs))
  }

  return {
    soundBtn,
    lightsBtn,
    fsBtn,
    menuItems: {
      lights: () => {
        if (!lightsBtn) return null
        const l = lightsLabel()
        return { id: 'lights', label: l.label, icon: l.icon, onSelect: () => lightsBtn?.click() }
      },
      fs: () =>
        fsBtn
          ? { id: 'fullscreen', label: document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen', icon: 'fullscreen', onSelect: toggleFs }
          : null,
    },
    dispose: () => disposers.forEach((d) => d()),
  }
}

/** Cross-document view transitions can be skipped (hidden tab, reload, dev reload); swallow the rejected promises. */
let vtGuarded = false
function guardViewTransitions(): void {
  if (vtGuarded || typeof window === 'undefined') return
  vtGuarded = true
  const quiet = (vt: unknown): void => {
    const t = vt as { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> } | null | undefined
    if (!t) return
    for (const k of ['ready', 'finished', 'updateCallbackDone'] as const) t[k]?.catch?.(() => {})
  }
  window.addEventListener('pagereveal', (e) => quiet((e as unknown as { viewTransition?: unknown }).viewTransition))
  window.addEventListener('pageswap', (e) => quiet((e as unknown as { viewTransition?: unknown }).viewTransition))
}

function prepareDocument(slug: GameSlug | 'hub'): { poster: boolean } {
  guardViewTransitions()
  const html = document.documentElement
  const poster = flags().embed === 'poster'
  if (!html.getAttribute('data-game')) html.setAttribute('data-game', slug)
  if (poster) html.setAttribute('data-embed', 'poster')
  if (slug !== 'hub') {
    const info = gameBySlug(slug)
    if (info.scheme === 'dark' || info.scheme === 'light') {
      html.setAttribute('data-scheme-lock', info.scheme)
      html.setAttribute('data-theme', info.scheme)
    }
  }
  if (!poster) Audio.arm()
  installGrain()
  ensureGreaseFilter()
  liveRegion()
  return { poster }
}

// ---------------------------------------------------------------------------------------------
// Game shell
// ---------------------------------------------------------------------------------------------

export function mountShell(opts: ShellOptions): Shell {
  const info = gameBySlug(opts.slug)
  const { poster } = prepareDocument(opts.slug)
  const disposers: UnsubFn[] = []

  let actions: ShellAction[] = opts.actions ? opts.actions.map((a) => ({ ...a })) : []
  let help = opts.help
  let autoHide = false
  let idleMs = 2500
  if (typeof opts.autoHide === 'object' && opts.autoHide) {
    autoHide = true
    idleMs = opts.autoHide.idleMs
  } else if (opts.autoHide === true) autoHide = true

  // ---- DOM ----
  const root = el('header', 'ar-shell')
  root.dataset.mode = 'game'
  root.setAttribute('role', 'banner')
  root.innerHTML = '<div class="ar-film-bg" aria-hidden="true"></div>'

  const back = el('a', 'ar-shell__back ar-btn ar-btn--on-film') as HTMLAnchorElement
  back.href = '/'
  back.setAttribute('aria-label', 'Back to the contact sheet')
  back.innerHTML = iconSvg('sheet') + '<span class="ar-shell__back-label">Contact sheet</span>'

  const idBox = el('div', 'ar-shell__id')
  const dot = el('span', 'ar-shell__dot')
  dot.setAttribute('aria-hidden', 'true')
  const frame = el('span', 'ar-shell__frame', frameCode(info.frame))
  frame.setAttribute('aria-hidden', 'true')
  const title = el('h1', 'ar-shell__title', info.title)
  idBox.append(dot, frame, title)

  const status = el('p', 'ar-shell__status')
  status.setAttribute('aria-hidden', 'true')
  status.hidden = true

  const toolbar = el('div', 'ar-shell__actions')
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Game controls')
  const actionHost = el('div', 'ar-shell__action-host')
  const helpBtn = iconButton('help', 'How to play', 'ar-shell__help')
  const common = wireCommon({
    fullscreen: opts.fullscreen === undefined ? document.documentElement : opts.fullscreen,
    showLights: info.scheme === 'auto' && !schemeLock() && !document.documentElement.hasAttribute('data-scheme-lock'),
  })
  const moreBtn = iconButton('more', 'More', 'ar-shell__more')
  moreBtn.setAttribute('aria-haspopup', 'menu')
  moreBtn.setAttribute('aria-expanded', 'false')
  moreBtn.hidden = true
  helpBtn.hidden = !help
  toolbar.append(actionHost, helpBtn, common.soundBtn)
  if (common.lightsBtn) toolbar.appendChild(common.lightsBtn)
  if (common.fsBtn) toolbar.appendChild(common.fsBtn)
  toolbar.appendChild(moreBtn)

  root.append(back, idBox, status, toolbar)
  document.body.prepend(root)

  // ---- tooltips ----
  disposers.push(attachTooltip(helpBtn, () => ({ text: 'How to play', shortcut: '?' })))
  disposers.push(attachTooltip(moreBtn, () => ({ text: 'More' })))

  // ---- actions ----
  const actionBtns = new Map<string, HTMLButtonElement>()
  const tipDisposers = new Map<string, UnsubFn>()
  let overflowIds = new Set<string>()
  let menu: { close(): void } | null = null

  const pointerInitiated = (e: MouseEvent): boolean => e.detail > 0

  function paintAction(a: ShellAction, b: HTMLButtonElement): void {
    b.disabled = !!a.disabled
    b.dataset.kind = a.kind ?? 'default'
    if (a.kind === 'toggle') b.setAttribute('aria-pressed', String(!!a.pressed))
    else b.removeAttribute('aria-pressed')
    const iconHtml = a.icon ? iconSvg(a.icon) : ''
    b.innerHTML = `${iconHtml}<span class="ar-shell__action-label"></span>`
    ;(b.querySelector('.ar-shell__action-label') as HTMLElement).textContent = a.label
    b.setAttribute('aria-label', a.shortcut ? `${a.label} (${a.shortcut})` : a.label)
    if (!a.icon) b.classList.add('ar-shell__action--text')
    else b.classList.remove('ar-shell__action--text')
  }

  function renderActions(): void {
    for (const d of tipDisposers.values()) d()
    tipDisposers.clear()
    actionHost.replaceChildren()
    actionBtns.clear()
    for (const a of actions) {
      const b = el('button', 'ar-btn ar-btn--on-film ar-shell__action')
      b.type = 'button'
      b.dataset.id = a.id
      paintAction(a, b)
      b.addEventListener('click', (e) => {
        const cur = actions.find((x) => x.id === a.id) ?? a
        if (cur.disabled) return
        cur.onSelect()
        if (pointerInitiated(e)) opts.returnFocus?.()
      })
      tipDisposers.set(a.id, attachTooltip(b, () => ({ text: a.label, shortcut: actions.find((x) => x.id === a.id)?.shortcut })))
      actionBtns.set(a.id, b)
      actionHost.appendChild(b)
    }
    root.toggleAttribute('data-has-actions', actions.length > 0)
    layout()
  }

  // ---- overflow layout ----
  function layout(): void {
    const phone = mqPhone().matches
    root.dataset.layout = phone ? 'phone' : 'wide'
    overflowIds = new Set()
    for (const b of actionBtns.values()) b.hidden = false
    actionHost.hidden = phone
    if (common.lightsBtn) common.lightsBtn.hidden = phone
    if (common.fsBtn) common.fsBtn.hidden = phone
    if (phone) {
      moreBtn.hidden = !(actions.length > 0 || common.lightsBtn || common.fsBtn)
      for (const a of actions) overflowIds.add(a.id)
      publishHeight(root)
      return
    }
    moreBtn.hidden = true
    const cs = getComputedStyle(root)
    const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const gap = parseFloat(cs.columnGap) || 8
    // keep the title readable: its natural width, within [MIN_IDENTITY_PX, 240]
    const idWant = Math.max(MIN_IDENTITY_PX, Math.min(240, (dot.offsetWidth || 0) + frame.offsetWidth + title.scrollWidth + 20))
    const avail = (): number => root.clientWidth - padding - back.offsetWidth - idWant - gap * 3
    const needed = (): number => toolbar.offsetWidth
    // movable game actions, least important (highest priority number) first
    const order = actions
      .map((a, i) => ({ a, p: a.priority ?? i, i }))
      .sort((x, y) => y.p - x.p || y.i - x.i)
    let k = 0
    while (needed() > avail() && k < order.length) {
      const victim = order[k++]!.a
      const b = actionBtns.get(victim.id)
      if (b) b.hidden = true
      overflowIds.add(victim.id)
      moreBtn.hidden = false
    }
    // still too wide: fold fullscreen, then lights, into More as well
    if (needed() > avail() && common.fsBtn && !common.fsBtn.hidden) {
      common.fsBtn.hidden = true
      moreBtn.hidden = false
    }
    if (needed() > avail() && common.lightsBtn && !common.lightsBtn.hidden) {
      common.lightsBtn.hidden = true
      moreBtn.hidden = false
    }
    publishHeight(root)
  }

  moreBtn.addEventListener('click', () => {
    if (menu) {
      menu.close()
      menu = null
      return
    }
    const items: MenuItem[] = []
    for (const a of actions) {
      if (!overflowIds.has(a.id)) continue
      items.push({
        id: a.id,
        label: a.label,
        icon: a.icon,
        checked: a.kind === 'toggle' ? !!a.pressed : undefined,
        disabled: a.disabled,
        onSelect: () => {
          a.onSelect()
          opts.returnFocus?.()
        },
      })
    }
    if (common.lightsBtn?.hidden) {
      const l = common.menuItems.lights()
      if (l) items.push(l)
    }
    if (common.fsBtn?.hidden) {
      const f = common.menuItems.fs()
      if (f) items.push(f)
    }
    if (!items.length) return
    const m = openMenu(moreBtn, items)
    menu = m
    reveal()
    const poll = window.setInterval(() => {
      if (moreBtn.getAttribute('aria-expanded') !== 'true') {
        window.clearInterval(poll)
        menu = null
        schedule()
      }
    }, 200)
  })

  // ---- back ----
  back.addEventListener('click', (e) => {
    uiSound('advance')
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const msg = opts.confirmLeave?.() ?? null
    if (!msg) return
    e.preventDefault()
    openDialog({
      edge: `RANKIN 400 · ${frameCode(info.frame)} ${info.title.toUpperCase()}`,
      title: 'Leave this frame?',
      body: msg,
      actions: [
        { id: 'stay', label: 'Stay', kind: 'primary' },
        {
          id: 'leave',
          label: 'Leave',
          kind: 'secondary',
          onSelect: () => {
            location.href = back.href
          },
        },
      ],
    })
  })

  // ---- help ----
  function openHelp(): void {
    if (!help) return
    openHelpDialog(opts.slug, help, { onClose: () => opts.returnFocus?.() })
  }
  helpBtn.addEventListener('click', openHelp)
  const onKey = (e: KeyboardEvent): void => {
    if (!help || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key !== '?' && !(e.code === 'Slash' && e.shiftKey)) return
    if (shouldGameIgnoreKey(e)) return
    e.preventDefault()
    openHelp()
  }
  window.addEventListener('keydown', onKey)
  disposers.push(() => window.removeEventListener('keydown', onKey))

  if (help && (opts.helpOnFirstVisit ?? true) && !flags().test && !poster) {
    const ls = local(opts.slug)
    if (!ls.get<boolean>('seenHelp', false)) {
      const open = (): void => {
        ls.set('seenHelp', true)
        openHelp()
      }
      if (isGameReady()) window.setTimeout(open, 0)
      else {
        window.addEventListener('ar:ready', open, { once: true })
        disposers.push(() => window.removeEventListener('ar:ready', open))
      }
    }
  }

  // ---- auto-hide ----
  let hidden = false
  let idleTimer = 0
  let pointerOver = false
  const effectiveAutoHide = (): boolean => autoHide || !!document.fullscreenElement
  function setHidden(h: boolean): void {
    if (h === hidden) return
    hidden = h
    root.toggleAttribute('data-hidden', h)
    window.dispatchEvent(new CustomEvent('ar:shellvisibility', { detail: { hidden: h } }))
  }
  function schedule(): void {
    window.clearTimeout(idleTimer)
    if (!effectiveAutoHide()) return
    idleTimer = window.setTimeout(() => {
      const busy = pointerOver || root.matches(':focus-within') || moreBtn.getAttribute('aria-expanded') === 'true' || !!document.querySelector('dialog[open]')
      if (busy) schedule()
      else setHidden(true)
    }, idleMs)
  }
  function reveal(): void {
    setHidden(false)
    schedule()
  }
  const onMove = (e: PointerEvent): void => {
    if (!effectiveAutoHide()) return
    if (e.clientY < 56 + parseFloat(getComputedStyle(root).paddingTop || '0')) reveal()
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  root.addEventListener('pointerenter', () => {
    pointerOver = true
    reveal()
  })
  root.addEventListener('pointerleave', () => {
    pointerOver = false
    schedule()
  })
  root.addEventListener('pointerdown', () => {
    if (hidden) reveal()
  })
  root.addEventListener('focusin', () => reveal())
  root.addEventListener('focusout', () => schedule())
  const onFsChange = (): void => {
    if (document.fullscreenElement) schedule()
    else reveal()
  }
  document.addEventListener('fullscreenchange', onFsChange)
  disposers.push(() => document.removeEventListener('fullscreenchange', onFsChange), () => window.removeEventListener('pointermove', onMove))
  if (autoHide) schedule()

  // ---- resize ----
  const ro = new ResizeObserver(() => layout())
  ro.observe(root)
  const mq = mqPhone()
  mq.addEventListener('change', layout)
  disposers.push(() => {
    ro.disconnect()
    mq.removeEventListener('change', layout)
  })
  void document.fonts?.ready.then(() => layout())

  renderActions()
  root.dataset.ready = '1'

  const api: Shell = {
    el: root,
    get height() {
      return root.offsetHeight
    },
    setStatus(text) {
      status.textContent = text ?? ''
      status.hidden = !text
    },
    announce: (t) => announceText(t),
    toast: (t, o) => showToast(t, o),
    setActions(next) {
      actions = next.map((a) => ({ ...a }))
      renderActions()
    },
    updateAction(id, patch) {
      const i = actions.findIndex((a) => a.id === id)
      if (i < 0) return
      const prev = actions[i]!
      const next: ShellAction = { ...prev, ...patch, onSelect: patch.onSelect ?? prev.onSelect }
      actions[i] = next
      const b = actionBtns.get(id)
      if (b) {
        paintAction(next, b)
        if (patch.priority !== undefined) layout()
      }
    },
    openHelp,
    setAutoHide(on) {
      autoHide = on
      if (on) schedule()
      else {
        window.clearTimeout(idleTimer)
        if (!document.fullscreenElement) setHidden(false)
      }
    },
    reveal,
    onSoundChange(cb) {
      return sound.onChange((p) => cb(p.muted))
    },
    destroy() {
      window.clearTimeout(idleTimer)
      menu?.close()
      for (const d of tipDisposers.values()) d()
      for (const d of disposers) d()
      common.dispose()
      root.remove()
    },
  }
  return api
}

// ---------------------------------------------------------------------------------------------
// Hub shell
// ---------------------------------------------------------------------------------------------

const BRAND_MARK = `<svg class="ar-shell__mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false">
<rect width="32" height="32" rx="6" fill="#121110"/><g fill="#F3EDE2"><rect x="4" y="2.5" width="4" height="3" rx="1"/><rect x="14" y="2.5" width="4" height="3" rx="1"/><rect x="24" y="2.5" width="4" height="3" rx="1"/><rect x="4" y="26.5" width="4" height="3" rx="1"/><rect x="14" y="26.5" width="4" height="3" rx="1"/><rect x="24" y="26.5" width="4" height="3" rx="1"/></g>
<rect x="4" y="8" width="24" height="16" rx="1.5" fill="#EAE3D6"/><path d="M7.2 16.6c-.3-4 4.2-6.6 9.4-6.4 5 .2 8.6 2.6 8.2 5.8-.4 3.4-4.8 5.4-9.6 5.2-4.6-.2-8.4-2.2-7.6-5.4.4-1.6 2-2.8 3.6-3.4" fill="none" stroke="#D23A2A" stroke-width="2.2" stroke-linecap="round"/></svg>`

/** The hub's shell: brand mark and RANKIN 400 · ROLL 01 on the left, loupe, sound and lights on the right. */
export function mountHubShell(opts: { onLoupeToggle?(on: boolean): void; initialLoupe?: boolean } = {}): Shell {
  const { poster } = prepareDocument('hub')
  const disposers: UnsubFn[] = []

  const root = el('header', 'ar-shell')
  root.dataset.mode = 'hub'
  root.setAttribute('role', 'banner')
  root.innerHTML = '<div class="ar-film-bg" aria-hidden="true"></div>'

  const brand = el('a', 'ar-shell__brand') as HTMLAnchorElement
  brand.href = '/'
  brand.setAttribute('aria-label', 'Andrew Rankin, contact sheet')
  brand.innerHTML = BRAND_MARK + `<span class="ar-shell__stock ar-edge">${SITE.stock} · ${SITE.roll}</span>`
  const name = el('a', 'ar-shell__name', 'Andrew Rankin') as HTMLAnchorElement
  name.href = '/'
  name.setAttribute('aria-current', 'page')
  name.tabIndex = -1
  name.setAttribute('aria-hidden', 'true')

  const centre = el('p', 'ar-shell__centre ar-edge', '06 EXP. · CONTACT SHEET')
  centre.setAttribute('aria-hidden', 'true')

  const toolbar = el('div', 'ar-shell__actions')
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Page controls')

  const common = wireCommon({ fullscreen: null, showLights: !schemeLock() })
  let loupeBtn: HTMLButtonElement | null = null
  if (matchMedia('(pointer: fine)').matches) {
    loupeBtn = iconButton('loupe', 'Loupe', 'ar-shell__loupe')
    loupeBtn.setAttribute('aria-pressed', String(!!opts.initialLoupe))
    const lb = loupeBtn
    lb.addEventListener('click', () => {
      const on = lb.getAttribute('aria-pressed') !== 'true'
      lb.setAttribute('aria-pressed', String(on))
      uiSound('switch')
      opts.onLoupeToggle?.(on)
    })
    disposers.push(attachTooltip(lb, () => ({ text: 'Loupe' })))
    toolbar.appendChild(lb)
  }
  toolbar.appendChild(common.soundBtn)
  if (common.lightsBtn) toolbar.appendChild(common.lightsBtn)
  root.append(brand, name, centre, toolbar)
  document.body.prepend(root)

  // The wordmark appears in the bar once the page's own H1 scrolls out of view.
  const h1 = document.querySelector<HTMLElement>('[data-hub-wordmark], main h1, h1:not(.ar-shell__title)')
  if (h1 && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1]?.isIntersecting ?? true
        name.toggleAttribute('data-shown', !visible)
        name.tabIndex = visible ? -1 : 0
        name.setAttribute('aria-hidden', String(visible))
      },
      { rootMargin: `-${publishHeight(root) || 52}px 0px 0px 0px`, threshold: 0 },
    )
    io.observe(h1)
    disposers.push(() => io.disconnect())
  }
  brand.addEventListener('click', () => uiSound('advance'))

  const ro = new ResizeObserver(() => publishHeight(root))
  ro.observe(root)
  disposers.push(() => ro.disconnect())
  publishHeight(root)
  root.dataset.ready = '1'
  void poster

  return {
    el: root,
    get height() {
      return root.offsetHeight
    },
    setStatus() {},
    announce: (t) => announceText(t),
    toast: (t, o) => showToast(t, o),
    setActions() {},
    updateAction() {},
    openHelp() {},
    setAutoHide() {},
    reveal() {},
    onSoundChange(cb) {
      return sound.onChange((p) => cb(p.muted))
    },
    destroy() {
      for (const d of disposers) d()
      common.dispose()
      root.remove()
    },
  }
}

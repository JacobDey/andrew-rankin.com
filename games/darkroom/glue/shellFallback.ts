// A small stand-in for the shared film-strip shell (hub.md §9), used only while
// @shared/ui is missing. It keeps the same anatomy so screenshots read right.
import type { HelpLite, ShellActionLite, ShellLite } from './platform'

export interface LocalShellOptions {
  actions?: ShellActionLite[]
  help?: HelpLite
  helpOnFirstVisit?: boolean
  returnFocus?: () => void
}

const ICON: Record<string, string> = {
  save: '<path d="M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6"/>',
  load: '<path d="M4 6h6l2 2h8v11H4z"/>',
  import: '<path d="M12 4v11 M7 10l5 5 5-5 M5 20h14"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2-5 M5 4v4h4"/>',
  help: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14 M12 17v.5"/>',
  back: '<path d="M14 6l-6 6 6 6"/>',
}
const svg = (n: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] ?? ''}</svg>`

export function localShell(o: LocalShellOptions): ShellLite {
  const bar = document.createElement('header')
  bar.className = 'dr-fshell'
  bar.setAttribute('role', 'banner')
  bar.innerHTML = `
    <a class="dr-fshell__back" href="/" aria-label="Back to the contact sheet">${svg('back')}<span class="dr-fshell__backlabel">Contact sheet</span></a>
    <div class="dr-fshell__id"><span class="dr-fshell__frame" aria-hidden="true">▸02</span><h1 class="dr-fshell__title">Darkroom</h1></div>
    <p class="dr-fshell__status" aria-hidden="true"></p>
    <div class="dr-fshell__actions" role="toolbar" aria-label="Game controls"></div>`
  const live = document.createElement('div')
  live.className = 'dr-visually-hidden'
  live.setAttribute('role', 'status')
  live.setAttribute('aria-live', 'polite')
  document.body.prepend(live)
  document.body.prepend(bar)
  const statusEl = bar.querySelector('.dr-fshell__status') as HTMLElement
  const actionsEl = bar.querySelector('.dr-fshell__actions') as HTMLElement
  const buttons = new Map<string, HTMLButtonElement>()
  const toasts = document.createElement('div')
  toasts.className = 'dr-ftoasts'
  document.body.appendChild(toasts)

  const openHelp = () => {
    const h = o.help
    if (!h) return
    const d = document.createElement('dialog')
    d.className = 'dr-fdialog'
    const rows = h.controls.map((c) => `<tr><th>${c.action}</th><td>${c.mouse ?? ''}</td><td>${c.touch ?? ''}</td><td>${c.keys ?? ''}</td></tr>`).join('')
    d.innerHTML = `<header class="dr-fdialog__edge">RANKIN 400 · DATASHEET · ▸02 DARKROOM</header>
      <h2>How it works</h2>${h.intro ? `<p>${h.intro}</p>` : ''}
      <table class="dr-fdialog__table"><thead><tr><th>Action</th><th>Mouse</th><th>Touch</th><th>Keys</th></tr></thead><tbody>${rows}</tbody></table>
      ${h.tips ? `<ul>${h.tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
      <form method="dialog"><button class="dr-btn dr-btn--primary">Close</button></form>`
    document.body.appendChild(d)
    d.addEventListener('close', () => d.remove())
    d.showModal()
  }

  for (const a of o.actions ?? []) {
    const b = document.createElement('button')
    b.className = 'dr-fshell__btn'
    b.type = 'button'
    b.innerHTML = `${svg(a.icon ?? '')}<span class="dr-fshell__label">${a.label}</span>`
    b.setAttribute('aria-label', a.label)
    if (a.shortcut) b.title = `${a.label} (${a.shortcut})`
    b.addEventListener('click', (e) => { a.onSelect(); if (e.detail > 0) o.returnFocus?.() })
    actionsEl.appendChild(b)
    buttons.set(a.id, b)
  }
  const hb = document.createElement('button')
  hb.className = 'dr-fshell__btn'
  hb.type = 'button'
  hb.innerHTML = svg('help')
  hb.setAttribute('aria-label', 'Help')
  hb.addEventListener('click', openHelp)
  actionsEl.appendChild(hb)

  return {
    el: bar,
    setStatus(t) { statusEl.textContent = t ?? ''; statusEl.hidden = !t },
    announce(t) { live.textContent = t },
    toast(t, opts) {
      const el = document.createElement('div')
      el.className = 'dr-ftoast'
      el.textContent = t
      toasts.appendChild(el)
      setTimeout(() => el.remove(), opts?.ms ?? 2600)
      live.textContent = t
    },
    updateAction(id, patch) {
      const b = buttons.get(id)
      if (!b) return
      if (patch.disabled != null) b.disabled = patch.disabled
      if (patch.label) { const l = b.querySelector('.dr-fshell__label'); if (l) l.textContent = patch.label }
    },
    openHelp,
  }
}

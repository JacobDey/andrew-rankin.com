// Shared UI harness: a fake game page. ?game=<slug> picks the registry entry, ?view= switches what is shown:
//   (default) component sampler   toast   error   dialog (help)   confirm   custom   loader   nowebgl   crash   menu   autohide
import '@shared/ui/fonts'
import '@shared/ui/tokens.css'
import '@shared/ui/base.css'
import {
  mountShell, mountHubShell, toast, showLoader, showNoWebGL, showCrashCard, openHelp, openDialog, confirmDialog,
  bindRange, createSwitch, createSegmented, circlePath, underlinePath, checkPath, arrowPath, starPath, cropMarksPath, questionPath,
  drawStroke, iconSvg, ICONS, getTheme, schemeLock, type IconName, type Shell,
} from '@shared/ui'
import { installGameApi, markReady, flags, nextFrame } from '@shared/core'
import type { GameSlug } from '@shared/games'

const stage = document.getElementById('stage') as HTMLElement
const slug = document.documentElement.getAttribute('data-game') as GameSlug
const f = flags()
const view = f.get('view') ?? 'sampler'

let gridOn = false
const isHub = (slug as string) === 'hub'
const shell: Shell = isHub ? mountHubShell({ onLoupeToggle: (on) => toast(on ? 'Loupe on.' : 'Loupe off.') }) : mountShell({
  slug,
  actions: [
    { id: 'save', label: 'Save', icon: 'save', shortcut: 'Ctrl+S', priority: 1, onSelect: () => toast('Saved to the drawer.', { kind: 'success' }) },
    { id: 'import', label: 'Import', icon: 'import', priority: 2, onSelect: () => toast('Imported.') },
    { id: 'reset', label: 'Start fresh', icon: 'reset', priority: 3, onSelect: () => toast('Tray emptied.') },
    {
      id: 'tog', label: 'Grid', icon: 'sheet', kind: 'toggle', pressed: false, priority: 4,
      onSelect: () => {
        gridOn = !gridOn
        shell.updateAction('tog', { pressed: gridOn })
      },
    },
  ],
  help: {
    intro: 'Rock the tray to develop. Light is the enemy until the print is fixed.',
    controls: [
      { action: 'Tilt the tray', mouse: 'Drag a corner', touch: 'Drag, or tilt your phone', keys: 'W A S D' },
      { action: 'Room light', mouse: 'Click the switch', touch: 'Tap the switch', keys: 'L' },
      { action: 'Save', mouse: 'Save button', touch: 'Save button', keys: 'Ctrl+S' },
    ],
    tips: ['Slow, even rocking beats frantic rocking.', 'The safelight is kind to paper but not to film.'],
  },
  helpOnFirstVisit: false,
  returnFocus: () => stage.focus(),
  autoHide: view === 'autohide' ? { idleMs: 1200 } : false,
  confirmLeave: () => (f.has('confirm') ? 'You have unsaved prints on the line.' : null),
})
shell.setStatus('DEVELOPING · 0:42')
if (isHub) {
  stage.remove()
  const h = document.createElement('h1')
  h.textContent = 'Andrew Rankin'
  h.style.cssText = 'font:640 64px/1 var(--ar-font-display);padding:120px 24px 24px;margin:0'
  h.setAttribute('data-hub-wordmark', '')
  document.body.appendChild(h)
  const spacer = document.createElement('div')
  spacer.style.height = '1600px'
  document.body.appendChild(spacer)
}

function sampler(): void {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:grid;gap:16px;padding:24px 16px;max-width:760px;margin:0 auto;height:100%;overflow:auto;touch-action:auto;align-content:start;justify-items:start'
  const icons = (Object.keys(ICONS) as IconName[]).map((n) => '<span title="' + n + '">' + iconSvg(n, { size: 24 }) + '</span>').join('')
  wrap.innerHTML =
    '<section class="ar-panel"><span class="ar-edge ar-panel__edge">Buttons</span>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
    '<button class="ar-btn ar-btn--primary">Develop</button>' +
    '<button class="ar-btn ar-btn--secondary">Cancel</button>' +
    '<button class="ar-btn ar-btn--ghost">Skip</button>' +
    '<button class="ar-btn ar-btn--primary" disabled>Disabled</button>' +
    '<button class="ar-btn ar-btn--secondary ar-btn--icon" aria-label="Save">' + iconSvg('save') + '</button>' +
    '<button class="ar-btn ar-btn--primary ar-btn--lg">Large</button>' +
    '<span style="background:var(--ar-film);padding:4px;border-radius:4px"><button class="ar-btn ar-btn--on-film">On film</button></span>' +
    '<kbd>Ctrl</kbd><kbd>S</kbd></div></section>' +
    '<section class="ar-panel" id="controls"><span class="ar-edge ar-panel__edge">Controls</span></section>' +
    '<section class="ar-panel"><span class="ar-edge ar-panel__edge">Icons</span><div style="display:flex;flex-wrap:wrap;gap:12px;color:var(--ar-ink)">' + icons + '</div></section>' +
    '<section class="ar-panel" id="grease" style="position:relative;min-height:150px"><span class="ar-edge ar-panel__edge">Grease pencil</span></section>' +
    '<section class="ar-panel"><span class="ar-panel__title">Panel title in Fraunces</span><p style="margin-top:6px">Body copy in Archivo. The theme is <b id="theme"></b>; the lock is <b id="lock"></b>.</p></section>'
  stage.appendChild(wrap)
  const c = wrap.querySelector('#controls') as HTMLElement
  const row = document.createElement('div')
  row.style.cssText = 'display:grid;gap:12px'
  c.appendChild(row)
  row.appendChild(createSwitch({ label: 'Sound & haptics', checked: true, onChange: () => {} }))
  row.appendChild(
    createSegmented({
      label: 'Film speed',
      options: [{ value: '100', label: '100' }, { value: '400', label: '400' }, { value: '3200', label: '3200' }],
      value: '400',
      onChange: () => {},
    }),
  )
  const rw = document.createElement('div')
  rw.className = 'ar-range-wrap'
  const r = document.createElement('input')
  r.type = 'range'
  r.min = '0'
  r.max = '10'
  r.step = '1'
  r.value = '4'
  rw.appendChild(r)
  row.appendChild(rw)
  const stops = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45]
  bindRange(r, { format: (v) => 'f/' + String(stops[v] ?? v), detents: [0, 2, 4, 6, 8, 10] })
  const g = wrap.querySelector('#grease') as HTMLElement
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', '0 0 600 110')
  svg.style.cssText = 'width:100%;height:110px;color:var(--ar-grease-red);overflow:visible'
  const add = (d: string, transform = ''): SVGPathElement => {
    const p = document.createElementNS(svgNS, 'path')
    p.setAttribute('d', d)
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', 'currentColor')
    p.setAttribute('stroke-width', '3.5')
    p.setAttribute('stroke-linecap', 'round')
    p.setAttribute('stroke-linejoin', 'round')
    p.setAttribute('opacity', '0.92')
    p.setAttribute('filter', 'url(#ar-grease)')
    if (transform) p.setAttribute('transform', transform)
    svg.appendChild(p)
    return p
  }
  const ps = [
    add(circlePath({ x: 20, y: 20, w: 90, h: 50 }, 'circle')),
    add(underlinePath(120, 'underline'), 'translate(140 60)'),
    add(checkPath('check'), 'translate(290 20)'),
    add(arrowPath([0, 40], [90, 10], 'arrow'), 'translate(350 20)'),
    add(starPath(22, 'star'), 'translate(470 8)'),
    add(cropMarksPath({ x: 0, y: 0, w: 50, h: 40 }, 'crop'), 'translate(530 25)'),
    add(questionPath(40, 'q'), 'translate(20 68) scale(0.6)'),
  ]
  g.appendChild(svg)
  for (const p of ps) void drawStroke(p)
  ;(wrap.querySelector('#theme') as HTMLElement).textContent = getTheme()
  ;(wrap.querySelector('#lock') as HTMLElement).textContent = schemeLock() ?? 'none'
}

async function run(): Promise<void> {
  if (view === 'sampler' || view === 'autohide') sampler()
  else if (view === 'toast') {
    sampler()
    toast('Saved to the drawer.', { kind: 'success', ms: 60000 })
  } else if (view === 'error') {
    sampler()
    toast('The film jammed.', { kind: 'error', ms: 60000 })
  } else if (view === 'dialog') {
    sampler()
    openHelp(slug, {
      intro: 'Rock the tray to develop. Light is the enemy until the print is fixed.',
      controls: [
        { action: 'Tilt the tray', mouse: 'Drag a corner', touch: 'Drag, or tilt your phone', keys: 'W A S D' },
        { action: 'Room light', mouse: 'Click the switch', touch: 'Tap the switch', keys: 'L' },
        { action: 'Save', mouse: 'Save button', touch: 'Save button', keys: 'Ctrl+S' },
      ],
      tips: ['Slow, even rocking beats frantic rocking.'],
    })
  } else if (view === 'confirm') {
    sampler()
    void confirmDialog('Start fresh? The tray will be emptied.', { title: 'Start fresh', ok: 'Start fresh' })
  } else if (view === 'custom') {
    sampler()
    openDialog({
      edge: 'LOGBOOK · ▸02',
      title: 'Logbook',
      body: 'Three prints on the line.\n\nTwo still need fixing.',
      actions: [{ id: 'x', label: 'Close', kind: 'primary' }],
    })
  } else if (view === 'loader') {
    const l = showLoader(stage, { label: 'Mixing chemistry…', delayMs: 0 })
    l.progress(0.4)
  } else if (view === 'nowebgl') showNoWebGL(stage)
  else if (view === 'crash') showCrashCard(stage, new Error('Shader failed to compile: unexpected token'))
  else if (view === 'menu') {
    sampler()
    ;(shell.el.querySelector('.ar-shell__more') as HTMLButtonElement | null)?.click()
  }
  await nextFrame()
  await nextFrame()
  markReady()
}

interface Check {
  name: string
  ok: boolean
  detail?: string
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function interact(): Promise<{ ok: boolean; results: Check[] }> {
  const out: Check[] = []
  const t = (name: string, ok: boolean, detail?: string): void => {
    out.push({ name, ok, detail })
  }
  const q = <T extends Element>(sel: string): T | null => document.querySelector<T>(sel)
  const closeDialogs = async (): Promise<void> => {
    for (const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) (d.querySelector('.ar-dialog__foot .ar-btn') as HTMLElement | null)?.click()
    await wait(220)
  }

  // help
  shell.openHelp()
  await wait(50)
  const dlg = q<HTMLDialogElement>('dialog.ar-dialog[open]')
  t('openHelp opens a modal datasheet', !!dlg && dlg.querySelector('.ar-dialog__title')?.textContent === 'How to play')
  t('datasheet header names the frame', /^RANKIN 400 · DATASHEET · ▸0[1-6] [A-Z0-9 ]+$/.test(q('.ar-dialog__edge')?.textContent ?? ''), q('.ar-dialog__edge')?.textContent ?? '')
  t('keys render as kbd', document.querySelectorAll('dialog[open] kbd').length >= 5)
  await closeDialogs()
  t('Got it closes the datasheet', !q('dialog[open]'))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, code: 'Slash' }))
  await wait(50)
  t('? opens help', !!q('dialog[open]'))
  await closeDialogs()
  const input = document.createElement('input')
  document.body.appendChild(input)
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, code: 'Slash', bubbles: true }))
  await wait(50)
  t('? is ignored inside an input', !q('dialog[open]'))
  input.remove()

  // sound
  const sb = q<HTMLButtonElement>('.ar-shell__sound')!
  const before = localStorage.getItem('ar:sound')
  sb.click()
  t('sound toggle mutes and persists', sb.getAttribute('aria-pressed') === 'true' && localStorage.getItem('ar:sound') === 'off')
  sb.click()
  t('sound toggle unmutes', sb.getAttribute('aria-pressed') === 'false' && localStorage.getItem('ar:sound') === 'on')
  if (before === null) localStorage.removeItem('ar:sound')

  // lights (auto scheme only)
  const lb = q<HTMLButtonElement>('.ar-shell__lights')
  if (lb) {
    const was = getTheme()
    lb.click()
    t('lights toggle flips the theme', getTheme() !== was && localStorage.getItem('ar:theme') === getTheme())
    lb.click()
    t('lights toggle flips back', getTheme() === was)
    localStorage.removeItem('ar:theme')
    document.documentElement.removeAttribute('data-theme')
  } else t('no lights toggle on a scheme-locked page', schemeLock() !== null)

  // toast replaces
  toast('First.')
  toast('Second.')
  t('one toast at a time', document.querySelectorAll('.ar-toast').length === 1 && q('.ar-toast')?.textContent === 'Second.')
  t('toast is announced in the live region', document.querySelector('.ar-live')?.getAttribute('aria-live') === 'polite')

  // actions
  shell.updateAction('tog', { pressed: true })
  t('updateAction sets aria-pressed on a toggle', q('[data-id="tog"]')?.getAttribute('aria-pressed') === 'true')
  shell.setActions([{ id: 'only', label: 'Only', icon: 'save', onSelect: () => {} }])
  t('setActions replaces the buttons', document.querySelectorAll('.ar-shell__action').length === 1)

  // back + confirmLeave
  const back = q<HTMLAnchorElement>('.ar-shell__back')!
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
  let shellPrevented = false
  back.addEventListener('click', (e) => {
    shellPrevented = e.defaultPrevented // what the shell decided; then stop the harness itself navigating
    e.preventDefault()
  }, { once: true })
  back.dispatchEvent(ev)
  await wait(60)
  if (f.has('confirm')) {
    t('confirmLeave intercepts Back and asks', shellPrevented && !!q('dialog[open]'))
    await closeDialogs()
  } else t('Back is a plain link to /', back.getAttribute('href') === '/' && !shellPrevented)
  ;(back as HTMLElement).blur()
  return { ok: out.every((x) => x.ok), results: out }
}

installGameApi('shared:ui', 'shared-ui@1', {
  interact,
  state: () => ({ view, slug, theme: getTheme(), height: shell.height }),
  shell,
  selftest() {
    const out: Check[] = []
    const t = (name: string, ok: boolean, detail?: string): void => {
      out.push({ name, ok, detail })
    }
    t('one h1, the shell title', document.querySelectorAll('h1').length === 1)
    t('shell is a banner', shell.el.getAttribute('role') === 'banner')
    t('--ar-shell-total published', /px$/.test(document.documentElement.style.getPropertyValue('--ar-shell-total')))
    const small = [...shell.el.querySelectorAll<HTMLElement>('button, a')].filter((b) => !b.hidden && b.offsetParent !== null && b.offsetHeight < 44)
    t('shell controls are at least 44px tall', small.length === 0, small.map((b) => b.className).join(','))
    const fr = shell.el.querySelector('.ar-shell__frame')
    t('registry frame shown', !fr || /▸0\d/.test(fr.textContent ?? ''))
    t('no horizontal scroll', document.documentElement.scrollWidth <= innerWidth)
    t('errors empty', (window.__game as unknown as { errors(): string[] }).errors().length === 0)
    return { ok: out.every((x) => x.ok), results: out }
  },
})
void run()

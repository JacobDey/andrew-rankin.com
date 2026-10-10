// The "How to play" datasheet (art-direction §7.5, hub.md §9.5).

import { gameBySlug, type GameSlug } from '../games'
import { openDialog } from './dialog'
import type { HelpContent } from './shell'

const KEY_WORDS = new Set([
  'esc', 'enter', 'return', 'space', 'tab', 'shift', 'ctrl', 'alt', 'option', 'cmd', 'meta', 'delete', 'del', 'backspace',
  'pgup', 'pgdn', 'home', 'end', 'up', 'down', 'left', 'right', '←', '→', '↑', '↓',
])

function isKey(tok: string): boolean {
  if (tok.length === 1) return true
  if (tok.includes('+')) return true
  if (/^F\d{1,2}$/.test(tok)) return true
  return KEY_WORDS.has(tok.toLowerCase())
}

/** Render a keys string such as 'W A S D' or 'Ctrl+S, Space' with <kbd> for key tokens and plain text for the rest. */
function renderKeys(td: HTMLElement, keys: string): void {
  const tokens = keys.split(/(\s+|,|\/)/).filter((t) => t !== '')
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      td.appendChild(document.createTextNode(' '))
    } else if (tok === ',' || tok === '/') {
      td.appendChild(document.createTextNode(tok === '/' ? ' / ' : ', '))
    } else if (isKey(tok)) {
      const k = document.createElement('kbd')
      k.textContent = tok
      td.appendChild(k)
    } else {
      td.appendChild(document.createTextNode(tok))
    }
  }
}

export function openHelp(slug: GameSlug | 'hub', content: HelpContent, o: { onClose?: () => void } = {}): void {
  const label = slug === 'hub' ? 'CONTACT SHEET' : `▸${String(gameBySlug(slug).frame).padStart(2, '0')} ${gameBySlug(slug).title.toUpperCase()}`
  const body = document.createElement('div')

  if (content.intro) {
    const p = document.createElement('p')
    p.textContent = content.intro
    body.appendChild(p)
  }

  if (content.controls.length) {
    const hasMouse = content.controls.some((c) => c.mouse)
    const hasTouch = content.controls.some((c) => c.touch)
    const hasKeys = content.controls.some((c) => c.keys)
    const wrap = document.createElement('div')
    wrap.className = 'ar-table-wrap'
    const table = document.createElement('table')
    table.className = 'ar-controls'
    const thead = document.createElement('thead')
    const hr = document.createElement('tr')
    const cols: Array<[string, string]> = [['Action', 'ar-col-action']]
    if (hasMouse) cols.push(['Mouse', 'ar-col-mouse'])
    if (hasTouch) cols.push(['Touch', 'ar-col-touch'])
    if (hasKeys) cols.push(['Keys', 'ar-col-keys'])
    for (const [name, cls] of cols) {
      const th = document.createElement('th')
      th.scope = 'col'
      th.className = cls
      th.textContent = name
      hr.appendChild(th)
    }
    thead.appendChild(hr)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    for (const row of content.controls) {
      const tr = document.createElement('tr')
      const a = document.createElement('td')
      a.textContent = row.action
      tr.appendChild(a)
      if (hasMouse) {
        const td = document.createElement('td')
        td.className = 'ar-col-mouse'
        td.textContent = row.mouse ?? ''
        tr.appendChild(td)
      }
      if (hasTouch) {
        const td = document.createElement('td')
        td.className = 'ar-col-touch'
        td.textContent = row.touch ?? ''
        tr.appendChild(td)
      }
      if (hasKeys) {
        const td = document.createElement('td')
        td.className = 'ar-col-keys'
        if (row.keys) renderKeys(td, row.keys)
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrap.appendChild(table)
    body.appendChild(wrap)
  }

  if (content.tips && content.tips.length) {
    const h = document.createElement('h3')
    h.className = 'ar-edge'
    h.textContent = 'Tips'
    const ul = document.createElement('ul')
    for (const t of content.tips.slice(0, 4)) {
      const li = document.createElement('li')
      li.textContent = t
      ul.appendChild(li)
    }
    body.append(h, ul)
  }

  openDialog({
    edge: `RANKIN 400 · DATASHEET · ${label}`,
    title: 'How to play',
    body,
    wide: content.controls.length > 4,
    actions: [{ id: 'ok', label: 'Got it', kind: 'primary' }],
    onClose: o.onClose,
  })
}

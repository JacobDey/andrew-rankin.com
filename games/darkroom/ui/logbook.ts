// Logbook (darkroom.md §7.2): Prints, Techniques (the Notebook), Pins; plus the
// print inspector with PNG download.
import type { DarkroomBus } from '../events'
import type { Platform } from '../glue/platform'
import { NOTEBOOK, type WorldX } from '../sim/world'
import type { Persist, PrintRecord } from '../save/persist'
import { logLine } from '../save/persist'
import type { Paper } from '../types'
import { btn, h } from './dom'

export interface Logbook { open(tab?: 'prints' | 'techniques' | 'pins'): void; inspect(p: Paper): void; close(): void }

function dialog(platform: Platform, edge: string, title: string, body: HTMLElement, wide = true): { close(): void; el: HTMLDialogElement } {
  if (platform.openDialog) {
    try { return platform.openDialog({ edge, title, body, wide, actions: [{ id: 'close', label: 'Close', kind: 'secondary' }] }) } catch { /* fall back */ }
  }
  const d = h('dialog', { className: 'dr-dialog' + (wide ? ' dr-dialog--wide' : '') }) as HTMLDialogElement
  const closeB = btn('Close', () => d.close(), { className: 'dr-btn' })
  d.append(h('header', { className: 'dr-dialog__edge', textContent: edge }), h('h2', { className: 'dr-dialog__title', textContent: title }), body, h('div', { className: 'dr-dialog__actions' }, closeB))
  document.body.appendChild(d)
  d.addEventListener('close', () => d.remove())
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  d.showModal()
  return { el: d, close: () => d.close() }
}

export function createLogbook(platform: Platform, world: WorldX, persist: Persist, _bus: DarkroomBus): Logbook {
  let cur: { close(): void } | null = null
  const lb: Logbook = {
    open(tab = 'prints') {
      cur?.close()
      const body = h('div', { className: 'dr-logbook' })
      const tabs = h('div', { className: 'dr-seg dr-logtabs', role: 'tablist' })
      const pane = h('div', { className: 'dr-logpane' })
      const show = async (t: 'prints' | 'techniques' | 'pins') => {
        for (const b of tabs.children) b.setAttribute('aria-selected', String((b as HTMLElement).dataset.tab === t))
        pane.replaceChildren(h('p', { className: 'dr-hint', textContent: 'Reading the logbook…' }))
        if (t === 'prints') pane.replaceChildren(await printsPane())
        else if (t === 'techniques') pane.replaceChildren(techniquesPane())
        else pane.replaceChildren(await pinsPane())
      }
      for (const [id, label] of [['prints', 'Prints'], ['techniques', 'Techniques'], ['pins', 'Pins']] as const) {
        const b = btn(label, () => void show(id), { className: 'dr-segbtn' })
        b.dataset.tab = id
        b.setAttribute('role', 'tab')
        tabs.appendChild(b)
      }
      body.append(tabs, pane)
      cur = dialog(platform, 'RANKIN 400 · LOGBOOK · ▸02', 'Logbook', body)
      void show(tab)
    },
    inspect(p) {
      cur?.close()
      const c = document.createElement('canvas')
      c.width = p.W; c.height = p.H
      const g = c.getContext('2d') as CanvasRenderingContext2D
      const img = g.createImageData(p.W, p.H); img.data.set(p.albedo)
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
      g.putImageData(img, 0, 0)
      c.className = 'dr-inspect__img'
      const dl = btn('Download PNG', async () => {
        const blob = await persist.albedoPng(p)
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `darkroom-print-${String(p.log.no).padStart(3, '0')}.png`; a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }, { className: 'dr-btn dr-btn--primary' })
      const body = h('div', { className: 'dr-inspect' }, c, h('p', { className: 'dr-mono dr-logline', textContent: logLine(p) }), h('div', { className: 'dr-row' }, dl))
      cur = dialog(platform, 'RANKIN 400 · PRINT · ▸02', p.title, body)
    },
    close() { cur?.close(); cur = null },
  }

  async function printsPane(): Promise<HTMLElement> {
    const recs: PrintRecord[] = await persist.listPrints()
    const onLine = world.papers.filter((p) => p.place.at === 'line')
    if (!recs.length && !onLine.length) return h('p', { className: 'dr-hint', textContent: 'Nothing on the line yet. Everything goes on the line.' })
    const list = h('ul', { className: 'dr-prints' })
    for (const p of onLine) {
      const c = document.createElement('canvas'); c.width = p.W; c.height = p.H
      const g = c.getContext('2d') as CanvasRenderingContext2D
      const img = g.createImageData(p.W, p.H); img.data.set(p.albedo)
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
      g.putImageData(img, 0, 0)
      const li = h('li', { className: 'dr-print' }, c, h('span', { className: 'dr-mono dr-small', textContent: logLine(p) + (p.log.parentPin ? ` · from pin ${p.log.parentPin}` : '') }))
      li.addEventListener('click', () => lb.inspect(p))
      list.appendChild(li)
    }
    const older = recs.filter((r) => !onLine.some((p) => r.id.startsWith(p.id + ':')))
    for (const r of older.slice(0, 24)) {
      const im = h('img', { alt: r.title, src: URL.createObjectURL(r.png) })
      list.appendChild(h('li', { className: 'dr-print' }, im, h('span', { className: 'dr-mono dr-small', textContent: r.line })))
    }
    return list
  }
  function techniquesPane(): HTMLElement {
    const list = h('ul', { className: 'dr-techniques' })
    for (const n of NOTEBOOK) {
      const got = world.discoveries.includes(n.id)
      list.appendChild(h('li', { className: 'dr-tech' + (got ? ' is-found' : '') }, h('strong', { textContent: got ? n.title : '· · ·' }), h('span', { textContent: got ? 'Found.' : n.hint })))
    }
    return h('div', {}, h('p', { className: 'dr-mono dr-small', textContent: `${world.discoveries.filter((d) => NOTEBOOK.some((n) => n.id === d)).length} of ${NOTEBOOK.length} happy accidents` }), list)
  }
  async function pinsPane(): Promise<HTMLElement> {
    const metas = await persist.listPins()
    const grid = h('div', { className: 'dr-pins' })
    for (const id of ['1', '2', '3', '4', '5', '6', 'auto']) {
      const m = metas.find((q) => q.id === id)
      const thumb = m?.thumb ? h('img', { alt: '', src: URL.createObjectURL(m.thumb) }) : h('div', { className: 'dr-pin__empty', textContent: 'empty' })
      const load = btn('Load', async () => { const ok = await persist.loadPin(world, id); if (ok) { platform.shell.toast('Back where you left it.'); lb.close() } }, { className: 'dr-btn dr-btn--small' })
      load.disabled = !m
      const over = btn(m ? 'Overwrite' : 'Save here', async () => {
        const view = (window as unknown as { __drView?: import('../types').View }).__drView
        if (!view) return
        await persist.pin(world, view, id); platform.shell.toast('Saved to the drawer.'); void lb.open('pins')
      }, { className: 'dr-btn dr-btn--small' })
      over.hidden = id === 'auto'
      grid.appendChild(h('div', { className: 'dr-pin' }, thumb, h('span', { className: 'dr-mono dr-small', textContent: m ? `${m.label} · ${new Date(m.savedAt).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}` : `Pin ${id}` }), h('div', { className: 'dr-row' }, load, over)))
    }
    return grid
  }
  return lb
}

// DOM for the play screen (texturedle.md §7.2): tray, viewer with bezel, lamp,
// focus strip, scale bar, captions, coach line, iris; readout strip; Field
// Notes, turret, guesses and the guess bar. Plain DOM, tx- classes only.

import { RATIOS, type RatioSpec } from '../contracts'
import type { Chip } from '../game/notes'
import type { Tile } from '../game/guess'
import { tileGlyph } from '../game/guess'

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

export interface View {
  root: HTMLElement
  tray: HTMLElement
  dish: HTMLButtonElement
  lensBtn: HTMLButtonElement
  burlapBtn: HTMLButtonElement
  viewer: HTMLElement
  bezel: HTMLElement
  frame: HTMLElement
  canvas: HTMLCanvasElement
  lamp: HTMLButtonElement
  focus: HTMLElement
  coach: HTMLElement
  input: HTMLInputElement
  guessBtn: HTMLButtonElement
  guessbar: HTMLElement
  sugg: HTMLUListElement
  msg: HTMLElement
  cardWrap: HTMLElement
  portrait: boolean
  layout(): void
  setReadout(r: RatioSpec, tilt: number, lamp: number, roll: boolean): void
  setScaleBar(r: RatioSpec, mmPerPx: number): void
  setLampPos(azDeg: number, mode: 'rake' | 'ring'): void
  setChips(chips: Chip[], fresh: Set<string>): void
  setTurret(i: number): void
  setRows(rows: Array<{ name: string; tiles: Tile[] }>, flipLast: boolean): void
  caption(text: string): void
  setCoach(text: string | null): void
  iris(close: boolean, ms: number): Promise<void>
  flash(): void
  onLayout: (() => void) | null
}

const SENSE_ICON: Record<string, string> = { marble: '◉', lens: '≈', burlap: '#', light: '☼', tap: '✦' }

export function createView(stage: HTMLElement): View {
  const root = h('div', 'tx-root')
  const bench = h('div', 'tx-bench')
  // tray
  const tray = h('div', 'tx-tray')
  tray.setAttribute('role', 'group')
  tray.setAttribute('aria-label', 'Probe tray')
  const item = (label: string, inner: string) => {
    const b = h('button', 'tx-tray-item', `${inner}<span class="tx-cap">${label}</span>`)
    b.type = 'button'
    b.setAttribute('aria-label', label)
    return b
  }
  const dish = item('Marble', '<span class="tx-dish"></span><span class="tx-marble-dom"></span>')
  const lensBtn = item('Lens cloth', '<span class="tx-swatch tx-swatch--lens"></span>')
  const burlapBtn = item('Burlap', '<span class="tx-swatch tx-swatch--burlap"></span>')
  tray.append(dish, lensBtn, burlapBtn)
  // viewer
  const viewer = h('div', 'tx-viewer')
  const bezel = h('div', 'tx-bezel')
  const scale = h('div', 'tx-scale', '<span>×</span><span>1:2</span><span>1:1</span><span>2:1</span><span>3:1</span><span>4:1</span><span>5:1</span><span>MACRO</span>')
  const frame = h('div', 'tx-frame')
  const canvas = h('canvas', 'tx-canvas')
  canvas.setAttribute('aria-label', "Today's surface, magnified. Drag to tilt; use the tray to probe.")
  canvas.tabIndex = -1
  const crops = ['tl', 'tr', 'bl', 'br'].map((c) => h('span', `tx-crop tx-crop--${c}`))
  const scalebar = h('div', 'tx-scalebar', '<i></i><span>1 mm</span>')
  const captions = h('div', 'tx-captions')
  captions.setAttribute('aria-live', 'polite')
  const coach = h('div', 'tx-coach')
  const iris = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  iris.setAttribute('class', 'tx-iris')
  iris.setAttribute('preserveAspectRatio', 'none')
  const irisPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  irisPath.setAttribute('fill', '#0b0b0c')
  irisPath.setAttribute('fill-rule', 'evenodd')
  iris.appendChild(irisPath)
  const flashEl = h('div', 'tx-flash')
  frame.append(canvas, ...crops, scalebar, captions, coach, iris, flashEl)
  const lamp = h('button', 'tx-lamp')
  lamp.type = 'button'
  lamp.setAttribute('aria-label', 'Lamp: drag around the bezel to swing it, tap to switch rake and ring light')
  const focus = h('div', 'tx-focus')
  focus.setAttribute('aria-hidden', 'true')
  bezel.append(scale, frame, lamp, focus)
  const readout = h('div', 'tx-readout')
  readout.setAttribute('aria-live', 'off')
  viewer.append(bezel, readout)
  bench.append(tray, viewer)
  // side
  const side = h('div', 'tx-side')
  const notes = h('section', 'tx-panel tx-notes', '<div class="tx-h"><span>Field notes</span></div>')
  notes.setAttribute('aria-label', 'Field notes')
  const chipsEl = h('div', 'tx-chips')
  chipsEl.setAttribute('aria-live', 'polite')
  notes.append(chipsEl)
  const turret = h('div', 'tx-panel tx-turret')
  turret.setAttribute('aria-label', 'Magnification')
  const pips = RATIOS.map((r) => { const p = h('span', 'tx-pip', r.label); turret.append(p); return p })
  const guesses = h('section', 'tx-panel tx-guesses', '<div class="tx-h"><span>Guesses</span><span>6</span></div>')
  guesses.setAttribute('aria-label', 'Guesses')
  const rowsEl = h('div')
  const rowEls: HTMLElement[] = []
  for (let i = 0; i < 6; i++) {
    const r = h('div', 'tx-row')
    for (let k = 0; k < 5; k++) r.append(h('span', 'tx-tile'))
    r.append(h('span', 'tx-name'))
    rowsEl.append(r)
    rowEls.push(r)
  }
  const legend = h('div', 'tx-legend', '● right · ◐ close · ○ no · ↑ more / ↓ less')
  legend.hidden = true
  guesses.append(rowsEl, legend)
  const guessbar = h('form', 'tx-guessbar')
  guessbar.setAttribute('autocomplete', 'off')
  const input = h('input')
  input.type = 'text'
  input.placeholder = 'Name the surface'
  input.setAttribute('aria-label', 'Your guess')
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('autocapitalize', 'none')
  input.setAttribute('autocorrect', 'off')
  input.setAttribute('spellcheck', 'false')
  input.setAttribute('enterkeyhint', 'go')
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', 'tx-sugg')
  const guessBtn = h('button', 'ar-btn ar-btn--primary', 'Guess')
  guessBtn.type = 'submit'
  const sugg = h('ul', 'tx-sugg')
  sugg.id = 'tx-sugg'
  sugg.setAttribute('role', 'listbox')
  sugg.hidden = true
  guessbar.append(sugg, input, guessBtn)
  const msg = h('div', 'tx-msg')
  msg.setAttribute('aria-live', 'polite')
  const gwrap = h('div')
  gwrap.append(guessbar, msg)
  side.append(notes, turret, guesses, gwrap)
  const cardWrap = h('div', 'tx-card-wrap')
  cardWrap.hidden = true
  root.append(bench, side, cardWrap)
  stage.append(root)

  let lastLamp = { az: 135, mode: 'rake' as 'rake' | 'ring' }
  const view: View = {
    root, tray, dish, lensBtn, burlapBtn, viewer, bezel, frame, canvas, lamp, focus, coach, input, guessBtn, guessbar, sugg, msg, cardWrap,
    portrait: false,
    onLayout: null,
    layout() {
      const phone = window.innerWidth < 640
      view.portrait = phone && window.innerHeight > window.innerWidth
      const vr = viewer.getBoundingClientRect()
      const pad = phone ? 16 : 28
      const ro = readout.getBoundingClientRect().height + 10
      const aspect = view.portrait ? 2 / 3 : 3 / 2
      const aw = Math.max(80, vr.width - pad)
      let ah = Math.max(80, vr.height - pad - ro)
      if (phone) {
        // the viewer takes at most 58 dvh, and always leaves room for the chips, turret, rows and input
        const rootH = root.getBoundingClientRect().height
        ah = Math.max(160, Math.min(window.innerHeight * 0.58, rootH - 330) - pad)
      }
      let w = aw, hh = aw / aspect
      if (hh > ah) { hh = ah; w = ah * aspect }
      if (document.documentElement.dataset.embed === 'poster') { w = vr.width; hh = vr.height }
      frame.style.width = `${Math.floor(w)}px`
      frame.style.height = `${Math.floor(hh)}px`
      if (phone) {
        // the tray rides on the bottom bezel
        const rr = root.getBoundingClientRect()
        const fr = frame.getBoundingClientRect()
        tray.style.top = `${Math.round(fr.bottom - rr.top - 56)}px`
      } else tray.style.top = ''
      view.setLampPos(lastLamp.az, lastLamp.mode)
      view.onLayout?.()
    },
    setReadout(r, tilt, lampAz, roll) {
      const dof = r.dofMm < 1 ? r.dofMm.toFixed(2) : r.dofMm.toFixed(1)
      const fov = view.portrait ? `${r.fovMm[1]} × ${r.fovMm[0]}` : `${r.fovMm[0]} × ${r.fovMm[1]}`
      const lab = roll ? `<b class="tx-roll">${r.label}</b>` : `<b>${r.label}</b>`
      readout.innerHTML = `<span class="tx-long">${lab} · f/8 (EFF f/${r.nEff}) · DOF ${dof} MM · FOV ${fov} MM · +${r.ev.toFixed(1)} EV · ${r.fps} FPS · TILT ${tilt.toFixed(1)}° · LAMP ${Math.round(lampAz)}°</span><span class="tx-short">${lab} · ƒ/${r.nEff} · DOF ${dof} · ${r.fps} FPS</span>`
      const sp = scale.querySelectorAll('span')
      sp.forEach((s) => { s.innerHTML = s.textContent === r.label ? `<b>${r.label}</b>` : (s.textContent ?? '') })
    },
    setScaleBar(r, mmPerPx) {
      const px = r.scaleBarMm / Math.max(1e-6, mmPerPx)
      const i = scalebar.querySelector('i') as HTMLElement
      i.style.width = `${Math.round(px)}px`
      ;(scalebar.querySelector('span') as HTMLElement).textContent = r.scaleBarMm >= 10 ? `${r.scaleBarMm / 10} cm` : `${r.scaleBarMm} mm`
    },
    setLampPos(az, mode) {
      lastLamp = { az, mode }
      lamp.dataset.mode = mode
      // place the lamp knob on the bezel ring at its azimuth
      const br = bezel.getBoundingClientRect()
      const fr = frame.getBoundingClientRect()
      const cx = fr.left - br.left + fr.width / 2, cy = fr.top - br.top + fr.height / 2
      const a = (az * Math.PI) / 180
      const dx = Math.cos(a), dy = -Math.sin(a)
      const hw = fr.width / 2 + (br.width - fr.width) / 4, hh = fr.height / 2 + (br.height - fr.height) / 4
      const t = Math.min(Math.abs(hw / (dx || 1e-6)), Math.abs(hh / (dy || 1e-6)))
      lamp.style.left = `${cx + dx * t}px`
      lamp.style.top = `${cy + dy * t}px`
    },
    setChips(chips, fresh) {
      if (!chips.length) { chipsEl.innerHTML = '<span class="tx-empty">Touch it to take notes.</span>'; return }
      chipsEl.innerHTML = ''
      chips.forEach((c, i) => {
        const el = h('span', 'tx-chip', `<i aria-hidden="true">${SENSE_ICON[c.sense] ?? '•'}</i>${escapeHtml(c.text)}`)
        el.style.setProperty('--tx-rot', `${((i * 37) % 5) - 2}deg`)
        if (fresh.has(c.id)) el.dataset.new = '1'
        chipsEl.append(el)
      })
      const box = chipsEl.parentElement
      if (box) { box.scrollTop = box.scrollHeight; box.scrollLeft = box.scrollWidth }
    },
    setTurret(i) {
      pips.forEach((p, k) => { p.dataset.on = k === i ? '1' : '0'; p.dataset.past = k < i ? '1' : '0' })
    },
    setRows(rows, flipLast) {
      rowEls.forEach((r, i) => {
        const data = rows[i]
        const tiles = r.querySelectorAll<HTMLElement>('.tx-tile')
        const name = r.querySelector('.tx-name') as HTMLElement
        tiles.forEach((t, k) => {
          if (!data) { t.removeAttribute('data-s'); t.innerHTML = ''; t.removeAttribute('title'); return }
          const tile = data.tiles[k]
          t.dataset.s = tile.state
          t.innerHTML = `${tileGlyph(tile)}<small>${escapeHtml(tile.label)}</small>`
          t.title = `${tile.label}: ${tile.state === 'hit' ? 'right' : tile.state === 'near' ? 'close' : 'no'}${tile.dir ? (tile.dir === 'up' ? ', answer is higher' : ', answer is lower') : ''}`
          if (flipLast && i === rows.length - 1) {
            t.dataset.flip = '1'
            t.style.animationDelay = `${k * 120}ms`
          } else t.removeAttribute('data-flip')
        })
        name.textContent = data ? data.name : ''
      })
      legend.hidden = rows.length === 0
    },
    caption(text) {
      const p = h('p', '', escapeHtml(text))
      captions.append(p)
      setTimeout(() => p.remove(), 1600)
      while (captions.children.length > 3) captions.firstElementChild?.remove()
    },
    setCoach(text) {
      if (text) { coach.textContent = text; coach.dataset.on = '1' } else coach.dataset.on = '0'
    },
    iris(close, ms) {
      return new Promise((resolve) => {
        const fr = frame.getBoundingClientRect()
        const W = fr.width, H = fr.height
        iris.setAttribute('viewBox', `0 0 ${W} ${H}`)
        const R0 = Math.hypot(W, H) / 2 + 4
        const t0 = performance.now()
        const tick = (now: number) => {
          const u = Math.min(1, (now - t0) / Math.max(1, ms))
          const e = u * u * (3 - 2 * u)
          const k = close ? 1 - e : e
          const r = R0 * k
          const rot = (1 - k) * 0.6
          let d = `M0 0H${W}V${H}H0Z`
          if (r > 0.5) {
            d += 'M'
            for (let i = 0; i < 9; i++) {
              const a = rot + (i / 9) * Math.PI * 2
              d += `${(W / 2 + Math.cos(a) * r).toFixed(1)} ${(H / 2 + Math.sin(a) * r).toFixed(1)}${i < 8 ? 'L' : 'Z'}`
            }
          }
          irisPath.setAttribute('d', u >= 1 && !close ? '' : d)
          if (u < 1) requestAnimationFrame(tick)
          else resolve()
        }
        if (ms <= 0) { tick(t0 + 1); resolve(); return }
        requestAnimationFrame(tick)
      })
    },
    flash() {
      flashEl.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' })
    },
  }
  view.setChips([], new Set())
  return view
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

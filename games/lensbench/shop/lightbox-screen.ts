// The Lightbox (lensbench.md §4.4, §7 "Lightbox"): strip, enlarged print, negative/positive,
// loupe, Blur Budget, deliver to tag with Read It, PNG export.
import type { FrameRecord, Screen, TagId } from '../core/types'
import type { App } from '../core/app'
import { STOCKS } from '../core/catalog'
import { TAGS, stockLabel, type GradeResult } from './grade'
import { sfx } from '../audio/audio'

export interface LightboxScreen extends Screen { open(id: string): void; selected(): string | null }

const BUDGET_COL: Record<string, string> = { defocus: '#4AA8FF', motion: '#FFD04A', shake: '#E8772E', glass: '#AE97F2', diffraction: '#7fd3a0' }

export function createLightboxScreen(root: HTMLElement, app: App): LightboxScreen {
  root.classList.add('lb-lightbox')
  root.innerHTML = `
    <div class="lb-strip" role="listbox" aria-label="Contact strip"></div>
    <div class="lb-lb-main">
      <div class="lb-print-wrap"><canvas class="lb-print"></canvas><div class="lb-loupe" aria-hidden="true"><canvas width="160" height="160"></canvas></div><div class="lb-stamp-accepted" hidden>ACCEPTED</div><div class="lb-empty">Developed film shows up here.</div></div>
      <aside class="lb-side">
        <div class="lb-sleeve lb-hand"></div>
        <div class="lb-edge"></div>
        <div class="lb-side-actions"><button class="lb-chip" data-a="flip">Negative (P)</button><button class="lb-chip" data-a="export">Export print (E)</button></div>
        <div class="lb-tagpanel">
          <label class="lb-sel"><span>Deliver to</span><select class="lb-tagsel"></select></label>
          <p class="lb-ask"></p>
          <label class="lb-readit" hidden><span>Read it</span><input type="text" maxlength="40" autocomplete="off"></label>
          <button class="lb-chip primary" data-a="deliver">Pin to the tag</button>
          <div class="lb-budget" aria-label="Blur budget"></div>
          <p class="lb-fix lb-hand" aria-live="polite"></p>
        </div>
      </aside>
    </div>`
  const strip = root.querySelector('.lb-strip') as HTMLElement
  const canvas = root.querySelector('.lb-print') as HTMLCanvasElement
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  const loupe = root.querySelector('.lb-loupe') as HTMLElement
  const lc = loupe.querySelector('canvas') as HTMLCanvasElement
  const lg = lc.getContext('2d') as CanvasRenderingContext2D
  const sleeve = root.querySelector('.lb-sleeve') as HTMLElement
  const edge = root.querySelector('.lb-edge') as HTMLElement
  const tagSel = root.querySelector('.lb-tagsel') as HTMLSelectElement
  const ask = root.querySelector('.lb-ask') as HTMLElement
  const readit = root.querySelector('.lb-readit') as HTMLElement
  const readInput = readit.querySelector('input') as HTMLInputElement
  const budget = root.querySelector('.lb-budget') as HTMLElement
  const fixEl = root.querySelector('.lb-fix') as HTMLElement
  const stamp = root.querySelector('.lb-stamp-accepted') as HTMLElement
  const empty = root.querySelector('.lb-empty') as HTMLElement

  let active = false
  let sel: string | null = null
  let negative = false
  let img: HTMLCanvasElement | null = null
  let loupeOn = false

  const developedFrames = (): FrameRecord[] => app.store.frameList().filter((f) => f.status === 'developed')

  function renderStrip() {
    strip.innerHTML = ''
    for (const f of developedFrames()) {
      const d = app.developed(f.id)
      const b = document.createElement('button')
      b.className = 'lb-thumb' + (f.id === sel ? ' on' : '')
      b.setAttribute('role', 'option')
      b.setAttribute('aria-selected', String(f.id === sel))
      b.title = `Frame ${f.index}`
      if (d) {
        const c = document.createElement('canvas')
        const s = 96 / Math.max(d.w, d.h)
        c.width = Math.round(d.w * s); c.height = Math.round(d.h * s)
        const tmp = toCanvas(negative ? d.negative : d.positive)
        c.getContext('2d')?.drawImage(tmp, 0, 0, c.width, c.height)
        b.appendChild(c)
      }
      const n = document.createElement('span'); n.textContent = String(f.index); b.appendChild(n)
      b.addEventListener('click', () => open(f.id))
      strip.appendChild(b)
    }
  }
  function toCanvas(d: ImageData): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = d.width; c.height = d.height
    c.getContext('2d')?.putImageData(d, 0, 0)
    return c
  }
  function drawPrint() {
    const f = sel ? app.store.frames.get(sel) : null
    const d = f ? app.developed(f.id) : null
    empty.hidden = !!d
    const wrap = canvas.parentElement as HTMLElement
    const W = Math.max(100, wrap.clientWidth), H = Math.max(100, wrap.clientHeight)
    const dpr = Math.min(2, devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, W, H)
    if (!d || !f) { img = null; return }
    img = toCanvas(negative ? d.negative : d.positive)
    const s = Math.min((W - 40) / d.w, (H - 40) / d.h)
    const w = d.w * s, h = d.h * s, x = (W - w) / 2, y = (H - h) / 2
    // rebate
    g.fillStyle = negative ? '#2a2620' : '#111'
    g.fillRect(x - 10, y - 14, w + 20, h + 28)
    g.fillStyle = negative ? '#d8c890' : '#e8e0c8'
    g.font = '9px ui-monospace, monospace'
    g.fillText(`${STOCKS[f.shots[0].camera.stock].edge} ◄ ${f.index} ◄ ${f.index}A`, x, y - 4)
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, x, y, w, h)
    ;(canvas as HTMLCanvasElement & { _r?: number[] })._r = [x, y, w, h]
  }
  function renderSide() {
    const f = sel ? app.store.frames.get(sel) : null
    if (!f) { sleeve.textContent = ''; edge.textContent = ''; budget.innerHTML = ''; fixEl.textContent = ''; return }
    const r = app.store.rolls.get(f.rollId)
    const dev = r?.dev
    sleeve.textContent = `${stockLabel(f)}${dev ? ` · ${dev.developer === 'lab' ? 'lab' : `MQ ${Math.floor(dev.minutes)}:${String(Math.round((dev.minutes % 1) * 60)).padStart(2, '0')} @ ${dev.tempC} °C`}` : ''}${f.shots.length > 1 ? ` · ${f.shots.length} exposures` : ''}`
    edge.textContent = `Frame ${f.index} · ${f.meta ? `${f.meta.exposureEV >= 0 ? '+' : ''}${f.meta.exposureEV.toFixed(1)} EV` : ''}`
    // tags
    const prog = app.store.get().progress
    const open = TAGS.filter((t) => !prog.tags[t.id]?.done)
    const prev = tagSel.value
    tagSel.innerHTML = TAGS.map((t) => `<option value="${t.id}" ${prog.tags[t.id]?.done ? 'disabled' : ''}>${t.id.slice(1)} · ${t.from}${prog.tags[t.id]?.done ? ' ✓' : ''}</option>`).join('')
    tagSel.value = open.find((t) => t.id === prev)?.id ?? open[0]?.id ?? TAGS[0].id
    showTag()
  }
  function showTag() {
    const t = TAGS.find((x) => x.id === tagSel.value)
    if (!t) return
    ask.textContent = `“${t.ask}”`
    readit.hidden = !t.readIt
    const f = sel ? app.store.frames.get(sel) : null
    if (f) showBudget(app.grade(f.id, t.id))
  }
  function showBudget(gr: GradeResult) {
    const keys = Object.keys(gr.budget)
    if (!keys.length) { budget.innerHTML = ''; fixEl.textContent = gr.fix; return }
    const total = Math.max(1, keys.reduce((a, k) => a + gr.budget[k], 0))
    budget.innerHTML = `<div class="lb-bar">${keys.map((k) => `<i title="${k} ${gr.budget[k].toFixed(1)} px" style="flex:${Math.max(0.001, gr.budget[k] / total)};background:${BUDGET_COL[k]}"></i>`).join('')}</div>` +
      `<div class="lb-legend">${keys.map((k) => `<span><i style="background:${BUDGET_COL[k]}"></i>${k} ${gr.budget[k].toFixed(1)} px</span>`).join('')}</div>`
    fixEl.textContent = gr.fix
  }
  function open(id: string) {
    sel = id
    app.store.set({ selectedFrame: id })
    stamp.hidden = true
    renderStrip(); drawPrint(); renderSide()
    sfx.tick()
  }
  tagSel.addEventListener('change', showTag)
  root.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a
    if (a === 'flip') flip()
    else if (a === 'export') exportPrint()
    else if (a === 'deliver') deliver()
  })
  function flip() { negative = !negative; (root.querySelector('[data-a="flip"]') as HTMLElement).textContent = negative ? 'Positive (P)' : 'Negative (P)'; drawPrint(); renderStrip(); sfx.tick() }
  function deliver() {
    if (!sel) return
    const tag = tagSel.value as TagId
    const gr = app.deliver(sel, tag, readInput.value)
    if (gr.pass) {
      stamp.hidden = false
      stamp.classList.remove('go'); void stamp.offsetWidth; stamp.classList.add('go')
      sfx.stamp()
      renderSide()
    } else {
      showBudget(gr)
      fixEl.textContent = gr.fix || 'Not quite.'
      sfx.clink(0.3)
    }
  }
  async function exportPrint() {
    const f = sel ? app.store.frames.get(sel) : null
    const d = f ? app.developed(f.id) : null
    if (!d || !f) return
    const c = document.createElement('canvas')
    c.width = d.w + 40; c.height = d.h + 60
    const x = c.getContext('2d') as CanvasRenderingContext2D
    x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height)
    x.putImageData(d.positive, 20, 30)
    x.fillStyle = '#e8e0c8'; x.font = '12px ui-monospace, monospace'
    x.fillText(`${STOCKS[f.shots[0].camera.stock].edge} ◄ ${f.index}`, 20, 20)
    x.fillText(stockLabel(f), 20, c.height - 10)
    c.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = `lensbench-frame-${f.index}.png`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
  }
  // loupe
  const wrap = canvas.parentElement as HTMLElement
  wrap.addEventListener('pointerdown', (e) => { loupeOn = true; wrap.setPointerCapture(e.pointerId); moveLoupe(e) })
  wrap.addEventListener('pointermove', (e) => { if (loupeOn || e.pointerType === 'mouse' && e.buttons) moveLoupe(e) })
  wrap.addEventListener('pointerup', () => { loupeOn = false; loupe.classList.remove('on') })
  function moveLoupe(e: PointerEvent) {
    const r = (canvas as HTMLCanvasElement & { _r?: number[] })._r
    if (!img || !r) return
    const br = wrap.getBoundingClientRect()
    const px = e.clientX - br.left, py = e.clientY - br.top
    const u = (px - r[0]) / r[2], v = (py - r[1]) / r[3]
    loupe.classList.add('on')
    loupe.style.left = `${px - 80}px`; loupe.style.top = `${py - 180}px`
    lg.fillStyle = '#000'; lg.fillRect(0, 0, 160, 160)
    const zoom = 8 * (r[2] / img.width)
    const sw = 160 / zoom
    lg.imageSmoothingEnabled = false
    lg.drawImage(img, u * img.width - sw / 2, v * img.height - sw / 2, sw, sw, 0, 0, 160, 160)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!active) return
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return
    const list = developedFrames()
    const i = list.findIndex((f) => f.id === sel)
    if (e.key === 'ArrowRight' && list.length) open(list[Math.min(list.length - 1, i + 1)].id)
    else if (e.key === 'ArrowLeft' && list.length) open(list[Math.max(0, i - 1)].id)
    else if (e.key === 'p' || e.key === 'P') flip()
    else if (e.key === 'e' || e.key === 'E') void exportPrint()
  }
  window.addEventListener('keydown', onKey)
  const ro = new ResizeObserver(() => { if (active) drawPrint() })
  ro.observe(wrap)

  return {
    open, selected: () => sel,
    enter() {
      active = true; root.hidden = false
      const list = developedFrames()
      if (!sel || !list.find((f) => f.id === sel)) sel = list[list.length - 1]?.id ?? null
      renderStrip(); drawPrint(); renderSide()
    },
    exit() { active = false; root.hidden = true },
    update() { /* static */ },
    dispose() { window.removeEventListener('keydown', onKey); ro.disconnect() },
  }
}

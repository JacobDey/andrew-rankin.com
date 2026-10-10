// games/plates/ui/book.ts — the Return (DOM overlay, Canary or Bone): Persons, Findings, The Sector,
// Documents; stamps; the plate strip of the player's own developments; Seal (GDD §7.2.4, story §8).
import './book.css'
import { PLATE_IDS, PLATE_W, PLATE_H, type Ctx, type ReturnBook, type PlateId, type SoulId, type FateId, type FindingId } from '../contracts'
import type { PlatesBench } from '../bench/wetBench'
import type { PlatesLightTable } from '../inspect/lightTable'
import type { PlatesLibrary } from '../content/library'
import { createReturnModel, type PlatesReturn } from '../story/returnModel'
import { PERSONS, FIG_ROMAN } from '../story/truth'
import { BOOK, SOUL_NAMES, SOUL_ORDER, FATE_LABELS, FATE_ORDER, FATE_TAKES_AGENT, FINDING_TEXT, SECTOR_Q, FOUND_TEXT, DOCS, REGISTER_TRIAL, REGISTER_COVER, md } from '../story/text'
import { developRegion } from '../content/develop'
import { hexRGB255, PALETTES } from '../render/palette'
import { openDocument, openRegister } from './documents'

type Page = 'persons' | 'findings' | 'sector' | 'documents'
export interface PlatesBook extends ReturnBook {
  readonly model: PlatesReturn
  readonly page: Page
  holdForCite(id: PlateId): void
  onSeal: ((named: boolean | null) => void) | null
  onClosed: (() => void) | null
  render(): void
  setBone(on: boolean): void
  newMarks(): boolean
  clearMarks(): void
}

const FINDING_IDS: FindingId[] = ['f1', 'f2', 'f3', 'f4', 'f5']

export function createReturnBook(ctx: Ctx, bench: PlatesBench, table: PlatesLightTable, root: HTMLElement): PlatesBook {
  const lib = ctx.lib as PlatesLibrary
  const model = createReturnModel()
  const el = document.createElement('div'); el.className = 'pl-book'; el.hidden = true
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'The Return')
  root.appendChild(el)
  let page: Page = 'persons', isOpen = false, armed: FindingId | null = null, held: PlateId | null = null, marks = false
  const fixedSet = new Set<PlateId>()
  const pal = () => (el.classList.contains('pl-book--bone') ? PALETTES.bone : PALETTES.canary)

  model.onStamp = (e) => {
    marks = true
    ctx.bus.emit({ t: 'stamp', kind: e.kind, ids: e.ids })
    ctx.bus.emit({ t: 'sfx', name: 'stamp' })
    if (isOpen) book.render()
  }

  function portraitCanvas(fig: number): HTMLCanvasElement {
    const c = document.createElement('canvas'); c.width = 72; c.height = 72; c.className = 'pl-portrait'
    const t = PERSONS[fig - 1]
    const meta = lib.meta(t.plate), pr = meta.portraits.find((p) => p.fig === fig)
    const e = lib.cached(t.plate), x = c.getContext('2d')
    if (pr && e && x) {
      const chem = bench.chem(t.plate), p = pal()
      const side = Math.max(pr.w, pr.h), cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2
      const rx = Math.max(0, Math.min(PLATE_W - side, cx - side / 2)), ry = Math.max(0, Math.min(PLATE_H - side, cy - side / 2))
      const n = Math.min(72, Math.max(24, Math.round(side)))
      const img = developRegion(e.L, { P: chem.P, F: chem.F }, [hash(t.plate) % 128, (hash(t.plate) >>> 8) % 128], rx, ry, side, side, n, n, 'pos', hexRGB255(p.ink), hexRGB255(p.light))
      const tmp = document.createElement('canvas'); tmp.width = n; tmp.height = n; tmp.getContext('2d')?.putImageData(img, 0, 0)
      x.imageSmoothingEnabled = false; x.drawImage(tmp, 0, 0, 72, 72)
    }
    return c
  }
  function thumb(id: PlateId): HTMLCanvasElement {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; c.className = 'pl-thumb'
    const p = pal()
    c.getContext('2d')?.putImageData(bench.thumb(id, 128, 64, 'pos', { ink: hexRGB255(p.ink), light: hexRGB255(p.light) }), 0, 0)
    return c
  }
  const opt = (v: string, label: string, sel: boolean) => `<option value="${v}"${sel ? ' selected' : ''}>${label}</option>`
  const stampHtml = (txt: string, k = 0) => `<span class="pl-stamp" style="--r:${(((txt.length * 37 + k * 53) % 9) - 4).toFixed(1)}deg">${txt}</span>`

  function renderPersons(body: HTMLElement): void {
    body.innerHTML = `<p class="pl-book-head"><em>${BOOK.personsHeader}</em></p>`
    const list = document.createElement('ol'); list.className = 'pl-persons'
    const vis = new Set(model.visibleFigures())
    for (let fig = 1; fig <= 10; fig++) {
      const li = document.createElement('li'); li.className = 'pl-person'
      const label = `<span class="pl-fig pl-sc">Figure ${FIG_ROMAN[fig]}</span>`
      if (!vis.has(fig)) { li.innerHTML = `${label}<span class="pl-empty"><em>${BOOK.emptyRow}</em></span>`; list.appendChild(li); continue }
      const a = model.person(fig), ok = model.personConfirmed(fig)
      li.innerHTML = label
      const pc = portraitCanvas(fig); pc.title = 'Open this plate'
      pc.addEventListener('click', () => { const t = PERSONS[fig - 1]; book.close(); table.open(t.plate) })
      li.appendChild(pc)
      const f = document.createElement('div'); f.className = 'pl-fields'
      f.innerHTML = `
        <label><span>${BOOK.fieldName}</span><select data-k="name" ${ok ? 'disabled' : ''}>${opt('', '—', !a.name)}${SOUL_ORDER.map((s) => opt(s, SOUL_NAMES[s], a.name === s)).join('')}</select></label>
        <label><span>${BOOK.fieldPart}</span><select data-k="fate" ${ok ? 'disabled' : ''}>${opt('', '—', !a.fate)}${FATE_ORDER.map((s) => opt(s, FATE_LABELS[s], a.fate === s)).join('')}</select></label>
        <label class="pl-agent" ${a.fate && FATE_TAKES_AGENT[a.fate] ? '' : 'hidden'}><span>${BOOK.fieldAgent}</span><select data-k="agent" ${ok ? 'disabled' : ''}>${opt('', '—', !a.agent)}${SOUL_ORDER.map((s) => opt(s, SOUL_NAMES[s], a.agent === s)).join('')}</select></label>`
      f.addEventListener('change', () => {
        const get = (k: string) => (f.querySelector(`select[data-k="${k}"]`) as HTMLSelectElement).value || null
        const fate = get('fate') as FateId | null
        model.setPerson(fig, { name: get('name') as SoulId | null, fate, agent: fate && FATE_TAKES_AGENT[fate] ? (get('agent') as SoulId | null) : null })
        ctx.bus.emit({ t: 'sfx', name: 'pen' })
        book.render()
      })
      li.appendChild(f)
      if (ok) li.insertAdjacentHTML('beforeend', stampHtml(BOOK.stamps.examined))
      list.appendChild(li)
    }
    body.appendChild(list)
  }
  function renderFindings(body: HTMLElement): void {
    body.innerHTML = `<p class="pl-book-head"><em>${BOOK.findingsHeader}</em></p>`
    const list = document.createElement('ol'); list.className = 'pl-findings'
    FINDING_IDS.forEach((fid, i) => {
      const f = model.finding(fid)
      const li = document.createElement('li'); li.className = 'pl-finding'
      li.innerHTML = `<p class="pl-printed"><span class="pl-sc">${i + 1}.</span> ${FINDING_TEXT[fid]}</p>
        <div class="pl-verdict" role="group" aria-label="Verdict">
          <button type="button" data-v="stands" aria-pressed="${f.verdict === 'stands'}" ${f.confirmed ? 'disabled' : ''}>${BOOK.stands}</button>
          <button type="button" data-v="withdraw" aria-pressed="${f.verdict === 'withdraw'}" ${f.confirmed ? 'disabled' : ''}>${BOOK.withdraw}</button>
          <button type="button" class="pl-slot${armed === fid ? ' is-armed' : ''}" data-slot ${f.confirmed ? 'disabled' : ''}>${f.plate ? '' : `<em>${BOOK.citeSlot}</em>`}</button>
        </div>`
      const slot = li.querySelector('[data-slot]') as HTMLButtonElement
      if (f.plate) { const m = lib.meta(f.plate); slot.appendChild(thumb(f.plate)); slot.insertAdjacentHTML('beforeend', `<span class="pl-slot-no">${m.no === 'TRIAL' ? 'Trial' : 'No. ' + m.no}</span>`) }
      li.querySelectorAll<HTMLButtonElement>('[data-v]').forEach((b) => b.addEventListener('click', () => { model.setFinding(fid, b.dataset.v as 'stands' | 'withdraw', model.finding(fid).plate); ctx.bus.emit({ t: 'sfx', name: 'pen' }); book.render() }))
      slot.addEventListener('click', () => {
        if (held) { model.setFinding(fid, model.finding(fid).verdict, held); held = null; armed = null; ctx.bus.emit({ t: 'sfx', name: 'paper' }) }
        else armed = armed === fid ? null : fid
        book.render()
      })
      slot.addEventListener('dragover', (e) => e.preventDefault())
      slot.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer?.getData('text/plate') as PlateId; if (id) { model.setFinding(fid, model.finding(fid).verdict, id); book.render() } })
      if (f.confirmed) li.insertAdjacentHTML('beforeend', stampHtml(f.verdict === 'stands' ? BOOK.stamps.stands : BOOK.stamps.withdrawn))
      list.appendChild(li)
    })
    body.appendChild(list)
    // the plate strip: the player's own fixed developments
    const strip = document.createElement('div'); strip.className = 'pl-strip'; strip.setAttribute('aria-label', 'Your plates')
    for (const id of PLATE_IDS) {
      if (!fixedSet.has(id) || id === 'p00' || id === 'p13') continue
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pl-strip-plate'; b.draggable = true
      const m = lib.meta(id)
      b.appendChild(thumb(id)); b.insertAdjacentHTML('beforeend', `<span>No. ${m.no}</span>`)
      b.setAttribute('aria-label', `Plate ${m.no}, ${m.title}`)
      if (held === id) b.classList.add('is-held')
      b.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plate', id))
      b.addEventListener('click', () => {
        if (armed) { model.setFinding(armed, model.finding(armed).verdict, id); armed = null; ctx.bus.emit({ t: 'sfx', name: 'paper' }) }
        else held = held === id ? null : id
        book.render()
      })
      strip.appendChild(b)
    }
    if (!strip.children.length) strip.innerHTML = '<p class="pl-empty"><em>(no plate yet fixed)</em></p>'
    body.appendChild(strip)
  }
  function renderSector(body: HTMLElement): void {
    const s = model.sector()
    body.innerHTML = `<p class="pl-book-head"><em>${BOOK.sectorHeader}</em></p>
      <ol class="pl-sector">
        <li><p class="pl-q">${SECTOR_Q.when.q}</p><select data-q="when" ${s.accounted ? 'disabled' : ''}>${opt('', '—', !s.when)}${SECTOR_Q.when.options.map((o) => opt(o, o, s.when === o)).join('')}</select></li>
        <li><p class="pl-q">${SECTOR_Q.where.q}</p>${s.found ? `<p class="pl-pencil">${stampHtml(BOOK.stamps.found)} <em>${FOUND_TEXT}</em></p>` : '<p class="pl-empty"><em>&nbsp;</em></p>'}</li>
        <li><p class="pl-q">${SECTOR_Q.who.q}</p><select data-q="who" ${s.accounted ? 'disabled' : ''}>${opt('', '—', !s.who)}${SOUL_ORDER.map((o) => opt(o, SOUL_NAMES[o], s.who === o)).join('')}</select></li>
        <li><p class="pl-q">${SECTOR_Q.why.q}</p><select data-q="why" ${s.accounted ? 'disabled' : ''}>${opt('', '—', !s.why)}${SECTOR_Q.why.options.map((o) => opt(o, o, s.why === o)).join('')}</select></li>
      </ol>${s.accounted ? stampHtml(BOOK.stamps.accounted) : ''}`
    body.querySelectorAll<HTMLSelectElement>('select[data-q]').forEach((sel) => sel.addEventListener('change', () => { model.setSector(sel.dataset.q as 'when' | 'who' | 'why', sel.value || null); ctx.bus.emit({ t: 'sfx', name: 'pen' }); book.render() }))
  }
  function renderDocuments(body: HTMLElement): void {
    body.innerHTML = ''
    const ul = document.createElement('ul'); ul.className = 'pl-docs'
    const addItem = (label: string, fn: () => void) => { const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.innerHTML = label; b.addEventListener('click', () => { ctx.bus.emit({ t: 'sfx', name: 'paper' }); fn() }); li.appendChild(b); ul.appendChild(li) }
    for (const d of DOCS) addItem(md(d.title), () => openDocument(root, d))
    addItem('<em>Register of Exposures</em>', () => openRegister(root, REGISTER_COVER, REGISTER_TRIAL, [...fixedSet].filter((id) => id !== 'p00').map((id) => lib.meta(id).register)))
    body.appendChild(ul)
  }

  const book: PlatesBook = {
    model, onSeal: null, onClosed: null,
    get isOpen() { return isOpen }, get page() { return page },
    open(p) {
      if (p) page = p
      isOpen = true; el.hidden = false; marks = false
      ctx.bus.emit({ t: 'sfx', name: 'paper' })
      book.render()
      ;(el.querySelector('.pl-book-tabs button[aria-selected="true"]') as HTMLButtonElement | null)?.focus({ preventScroll: true })
    },
    close() { if (!isOpen) return; isOpen = false; el.hidden = true; armed = null; book.onClosed?.() },
    onPlateFixed(id) {
      fixedSet.add(id)
      for (const t of PERSONS) if (t.plate === id) model.reveal(t.fig)
      if (PERSONS.some((t) => t.plate === id)) marks = true
      if (isOpen) book.render()
    },
    holdForCite(id) { held = id; armed = null; book.open('findings') },
    setBone(on) { el.classList.toggle('pl-book--bone', on) },
    newMarks() { return marks },
    clearMarks() { marks = false },
    render() {
      if (!isOpen) return
      const scroll = (el.querySelector('.pl-book-body') as HTMLElement | null)?.scrollTop ?? 0
      el.innerHTML = `
        <div class="pl-book-sheet">
          <header class="pl-book-top">
            <div class="pl-book-spine"><span class="pl-sc">${BOOK.spine}</span> · <span class="pl-sc">${BOOK.spine2}</span></div>
            <nav class="pl-book-tabs" role="tablist">${(['persons', 'findings', 'sector', 'documents'] as Page[]).map((p, i) => `<button type="button" role="tab" data-p="${p}" aria-selected="${p === page}">${i + 1}. ${BOOK.tabs[p]}</button>`).join('')}</nav>
            <button type="button" class="pl-book-close" aria-label="Close the Return">‹ Back</button>
          </header>
          <div class="pl-book-body"></div>
          <footer class="pl-book-foot"><button type="button" class="pl-seal">${BOOK.seal}</button></footer>
        </div>`
      const body = el.querySelector('.pl-book-body') as HTMLElement
      if (page === 'persons') renderPersons(body)
      else if (page === 'findings') renderFindings(body)
      else if (page === 'sector') renderSector(body)
      else renderDocuments(body)
      body.scrollTop = scroll
      el.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.p as Page; ctx.bus.emit({ t: 'sfx', name: 'paper', gain: 0.5 }); book.render() }))
      el.querySelector('.pl-book-close')?.addEventListener('click', () => book.close())
      el.querySelector('.pl-seal')?.addEventListener('click', () => book.onSeal?.(null))
    },
  }
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); book.close() }
    if (['1', '2', '3', '4'].includes(e.key) && !(e.target instanceof HTMLSelectElement)) { page = (['persons', 'findings', 'sector', 'documents'] as Page[])[Number(e.key) - 1]; book.render() }
  })
  return book
}

function hash(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) } return h >>> 0 }

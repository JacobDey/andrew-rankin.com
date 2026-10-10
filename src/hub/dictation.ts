// Grease-pencil annotations on the dictation card (hub.md §2.2): a circle around "Cyanide" with an
// arrow to the margin, "sp?" beside "obrah dinn", a bracket around item 6, and a small check beside
// each item that draws itself the first time its frame becomes active in this visit. Decorative,
// aria-hidden; the card's real text carries the corrections for screen readers.

import { circlePath, arrowPath, checkPath, drawStroke } from '@shared/ui'
import { mulberry32 } from '@shared/core'
import { transformPath } from './grease'

const SVGNS = 'http://www.w3.org/2000/svg'

export interface DictationMarks {
  layout(): void
  check(item: number, animate: boolean): void
  checked(): number[]
}

export function createDictationMarks(card: HTMLElement): DictationMarks {
  const notes = card.querySelector<HTMLElement>('.hub-dictation__notes')!
  const layer = document.createElement('div')
  layer.className = 'hub-dict-marks'
  layer.setAttribute('aria-hidden', 'true')
  const svg = document.createElementNS(SVGNS, 'svg')
  layer.append(svg)
  card.append(layer)
  const mk = (cls = ''): SVGPathElement => {
    const p = document.createElementNS(SVGNS, 'path')
    if (cls) p.setAttribute('class', cls)
    svg.append(p)
    return p
  }
  const cyCircle = mk()
  const cyArrow = mk()
  const bracket = mk()
  const checks = new Map<number, SVGPathElement>()
  const done = new Set<number>()
  const text = (s: string, cls = 'hub-dict-note'): HTMLSpanElement => {
    const n = document.createElement('span')
    n.className = cls
    n.textContent = s
    layer.append(n)
    return n
  }
  const cyNote = text('cyanotype!! (nobody was poisoned)')
  const spNote = text('sp?')
  const frNote = text("friend's request")

  function rel(el: Element): { x: number; y: number; w: number; h: number } {
    const a = card.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height }
  }

  function place(n: HTMLElement, x: number, y: number, rot: number, anchor: 'left' | 'right' = 'left'): void {
    n.style.left = `${x}px`
    n.style.top = `${y}px`
    n.style.transformOrigin = anchor === 'left' ? '0 50%' : '100% 50%'
    n.style.transform = `translate(${anchor === 'right' ? '-100%' : '0'}, -50%) rotate(${rot}deg)`
  }

  /** The last line box of an element's text, relative to the card. */
  function lastLine(el: Element): { x: number; y: number; w: number; h: number } | null {
    const a = card.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = [...range.getClientRects()].filter((x) => x.width > 1)
    const r = rects[rects.length - 1]
    return r ? { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height } : null
  }

  function layout(): void {
    // measure in the card's own frame: lift its hand-placed tilt while reading rects
    const tilt = card.style.rotate
    card.style.rotate = '0deg'
    try {
      layoutFlat()
    } finally {
      card.style.rotate = tilt
    }
  }

  function layoutFlat(): void {
    const cw = card.clientWidth
    const nr = rel(notes)
    const right = nr.x + nr.w
    // "Cyanide": circle it; the note goes in the free space after item 2's last line, if it fits
    const cy = card.querySelector('[data-mark="cyanide"]')
    const two = card.querySelector('[data-item="2"]')
    if (cy && two) {
      const r = rel(cy)
      cyCircle.setAttribute('d', circlePath({ x: r.x - 3, y: r.y - 1, w: r.w + 6, h: r.h + 2 }, 'cyanide'))
      const nw = cyNote.offsetWidth
      // the nearest short last line (items 1-3, the title line) with room for the note
      const lines = ['[data-item="1"]', '[data-item="2"]', '[data-item="3"]', '[data-item="4"]']
        .map((q) => card.querySelector(q))
        .filter((e): e is Element => !!e)
        .map((e) => lastLine(e))
        .filter((l): l is NonNullable<typeof l> => !!l && right - (l.x + l.w) > nw + 18)
        .sort((p, q) => Math.abs(p.y - r.y) - Math.abs(q.y - r.y))
      const slot = lines[0]
      if (slot) {
        const ny = slot.y + slot.h / 2 + 1
        place(cyNote, right - nw - 2, ny - 1, -2.5) // pivot on the left: the uphill end clears the next line
        const up = ny < r.y
        cyArrow.setAttribute('d', arrowPath([r.x + r.w + 4, up ? r.y + 2 : r.y + r.h - 2], [right - nw - 8, ny + (up ? 5 : -4)], 'cyanide-arrow'))
      } else {
        const ty = Math.max(14, r.y - 22)
        place(cyNote, cw - 8, ty - 6, -3, 'right')
        cyArrow.setAttribute('d', arrowPath([r.x + r.w + 4, r.y + 2], [Math.min(cw - 12, r.x + r.w + 40), ty + 4], 'cyanide-arrow'))
      }
    }
    // "obrah dinn": a quick sp?
    const ob = card.querySelector('[data-mark="obrah"]')
    if (ob) {
      const r = rel(ob)
      if (right - (r.x + r.w) > 36) place(spNote, r.x + r.w + 7, r.y + r.h / 2 - 1, -6)
      else place(spNote, r.x + r.w - 24, r.y - 9, -6)
    }
    // item 6: a bracket, and the note in the free space after item 5's last line
    const six = card.querySelector('[data-item="6"]')
    const five = card.querySelector('[data-item="5"]')
    if (six) {
      const r = rel(six)
      const x = r.x - 12
      const rr = mulberry32(6)
      const j = (): number => (rr() - 0.5) * 2
      bracket.setAttribute('d', `M${x + 7 + j()} ${r.y - 2}C${x + j()} ${r.y + 2} ${x + j()} ${r.y + r.h - 2} ${x + 7 + j()} ${r.y + r.h + 2}`)
      const last = five ? lastLine(five) : null
      const nw = frNote.offsetWidth
      const cap = card.querySelector('figcaption')
      const cr = cap ? rel(cap) : null
      if (last && right - (last.x + last.w) > nw + 18) place(frNote, right - nw - 2, last.y + last.h / 2 + 2, -3)
      else if (cr && right - (cr.x + cr.w) > nw + 6) place(frNote, right - nw - 2, cr.y + 9, -3)
      else place(frNote, r.x + r.w, r.y + r.h + 8, -2, 'right')
    }
    for (const [item, p] of checks) placeCheck(item, p)
  }

  function placeCheck(item: number, p: SVGPathElement): void {
    const line = notes.querySelector(`[data-item="${item}"]`)
    if (!line) return
    const r = rel(line)
    const s = 15 / 32
    p.setAttribute('d', transformPath(checkPath(`check:${item}`), s, r.x - 19, r.y + 2))
  }

  layout()
  return {
    layout,
    check(item, animate) {
      if (done.has(item)) return
      done.add(item)
      const p = mk('hub-dict-check')
      checks.set(item, p)
      const tilt = card.style.rotate
      card.style.rotate = '0deg'
      placeCheck(item, p)
      card.style.rotate = tilt
      if (animate) void drawStroke(p, { ms: 380 })
    },
    checked: () => [...done].sort(),
  }
}

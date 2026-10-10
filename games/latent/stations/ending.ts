// The endings (story bible §7.7): FILE (Atwell, clippings chosen by the envelope's facts, the fax,
// the headstone line) or PURGE (keep one print). Rendered as a DOM overlay in the clipping palette.
import type { App } from '../core/app'
import { S, autosave, printById } from '../core/state'
import type { FactId } from '../core/types'
import { evaluateFile, evaluatePurge, type EndingText } from '../data/facts'
import { TERM } from '../data/text'
import { RECIPES } from '../data/rolls'

export function endingText(d: 'FILE' | 'PURGE'): EndingText {
  const total = RECIPES.length
  if (d === 'PURGE') return evaluatePurge(total)
  const prints = S.save.envelope.map((id) => printById(id)).filter((p): p is NonNullable<typeof p> => !!p)
  return evaluateFile(prints.map((p) => ({ facts: p.legible.map((l) => l.fact as FactId), roll: p.ref.roll, frame: p.ref.frame })), total)
}

export function showEnding(app: App, d: 'FILE' | 'PURGE', keep?: string): EndingText {
  const t = endingText(d)
  S.save.ending = { disposition: d, kept: keep, at: S.save.clock }
  S.save.flags.K = true
  autosave()
  const el = document.createElement('div')
  el.className = 'li-ending'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'The end of the night')
  const inner = document.createElement('div')
  inner.className = 'li-ending-inner'
  el.append(inner)
  const add = (cls: string, text: string, tag = 'p') => { const e = document.createElement(tag); e.className = cls; e.textContent = text; inner.append(e); return e }
  if (d === 'FILE') {
    add('li-end-atwell', t.atwell)
  } else {
    add('li-end-term', TERM.keepOne)
    const k = keep ? printById(keep) : null
    add('li-end-note', k ? `You keep R${k.ref.roll}/F${k.ref.frame}. Everything else rattles into the bin.` : 'Everything rattles into the bin.')
  }
  for (const c of t.clippings) {
    const clip = document.createElement('article'); clip.className = 'li-clip'
    const h = document.createElement('h3'); h.textContent = c.h
    clip.append(h)
    if (c.d) { const p = document.createElement('p'); p.textContent = c.d; clip.append(p) }
    inner.append(clip)
  }
  const fax = add('li-fax', t.fax)
  fax.setAttribute('aria-label', `Fax: ${t.fax}`)
  if (t.headstone) add('li-end-term', t.headstone)
  const kept = d === 'FILE' ? S.save.prints.filter((p) => p.fixed).length : keep ? 1 : 0
  add('li-end-term', t.last.replace(/\d+ KEPT\.$/, `${kept} KEPT.`))
  const close = document.createElement('button'); close.type = 'button'; close.className = 'li-chip'; close.textContent = 'Back to the lab'
  close.addEventListener('click', () => el.remove())
  inner.append(close)
  app.view.append(el)
  app.sfx('latent.fax')
  return { ...t, last: t.last.replace(/\d+ KEPT\.$/, `${kept} KEPT.`) }
}

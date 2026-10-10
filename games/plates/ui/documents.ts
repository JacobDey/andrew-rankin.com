// games/plates/ui/documents.ts — the document reader: one sheet on a dark ground, ≤ 640 px wide.
// Printed documents in small caps; hands in italic; Amos's hand larger and skewed. Click outside to close.
import type { DocDef } from '../story/text'
import { md } from '../story/text'

let open: HTMLElement | null = null
export function docOpen(): boolean { return !!open }
export function closeDocument(): void { open?.remove(); open = null }

function sheet(root: HTMLElement, cls: string, html: string, onClose?: () => void): HTMLElement {
  closeDocument()
  const ground = document.createElement('div'); ground.className = 'pl-doc-ground'
  ground.setAttribute('role', 'dialog'); ground.setAttribute('aria-modal', 'true')
  ground.innerHTML = `<article class="pl-doc ${cls}" tabindex="-1">${html}<button type="button" class="pl-doc-close" aria-label="Close">‹ Back</button></article>`
  const close = () => { closeDocument(); onClose?.() }
  ground.addEventListener('click', (e) => { if (e.target === ground || (e.target as HTMLElement).closest('.pl-doc-close')) close() })
  ground.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } })
  root.appendChild(ground)
  open = ground
  ;(ground.querySelector('.pl-doc') as HTMLElement).focus({ preventScroll: true })
  return ground
}

export function openDocument(root: HTMLElement, d: DocDef, onClose?: () => void): HTMLElement {
  return sheet(root, `pl-doc--${d.voice}`, `<h2 class="pl-doc-title">${md(d.title)}</h2>${d.paras.map((p) => `<p>${md(p)}</p>`).join('')}`, onClose)
}
export function openRegister(root: HTMLElement, cover: string, trial: string[], lines: string[]): HTMLElement {
  const body = [`<p class="pl-reg-cover"><em>${md(cover)}</em></p>`, `<p class="pl-reg-page"><span class="pl-sc">Trial</span></p>`, ...trial.map((t) => `<p><em>${md(t)}</em></p>`), ...lines.map((l) => `<p><em>${md(l)}</em></p>`)]
  return sheet(root, 'pl-doc--ottilie', `<h2 class="pl-doc-title"><em>Register of Exposures</em></h2>${body.join('')}`)
}
export function openSheet(root: HTMLElement, paras: string[], o: { cls?: string; title?: string; buttons?: { label: string; on: () => void }[]; onClose?: () => void } = {}): HTMLElement {
  const g = sheet(root, o.cls ?? 'pl-doc--board', `${o.title ? `<h2 class="pl-doc-title">${md(o.title)}</h2>` : ''}${paras.map((p) => `<p>${md(p)}</p>`).join('')}${o.buttons ? `<div class="pl-doc-actions">${o.buttons.map((b, i) => `<button type="button" data-i="${i}">${md(b.label)}</button>`).join('')}</div>` : ''}`, o.onClose)
  g.querySelectorAll<HTMLButtonElement>('.pl-doc-actions button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const fn = o.buttons?.[Number(b.dataset.i)]?.on; closeDocument(); fn?.() }))
  return g
}

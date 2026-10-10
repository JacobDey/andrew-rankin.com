// Datasheet dialogs (art-direction §7.5): a native <dialog> with a film-strip header and a paper body.

import { prefersReducedMotion } from '../core/flags'
import { uiSound } from '../audio/core'
import { iconSvg } from './icons'

export interface DialogAction {
  id: string
  label: string
  kind?: 'primary' | 'secondary' | 'ghost'
  /** Return false to keep the dialog open. */
  onSelect?: () => void | boolean
}

export interface OpenDialogOptions {
  edge: string // e.g. 'LOGBOOK · ▸02'
  title: string
  body: string | HTMLElement // a string becomes paragraphs (split on blank lines), as text
  actions?: DialogAction[]
  dismissible?: boolean // default true: close button, Esc, click outside
  wide?: boolean
  onClose?: () => void
}

let uid = 0

export function openDialog(o: OpenDialogOptions): { el: HTMLDialogElement; close(): void } {
  const dismissible = o.dismissible !== false
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const dlg = document.createElement('dialog')
  dlg.className = 'ar-dialog' + (o.wide ? ' ar-dialog--wide' : '')
  const titleId = `ar-dlg-${++uid}`
  dlg.setAttribute('aria-labelledby', titleId)

  const head = document.createElement('div')
  head.className = 'ar-dialog__head'
  head.innerHTML = '<div class="ar-film-bg" aria-hidden="true"></div>'
  const edge = document.createElement('span')
  edge.className = 'ar-dialog__edge ar-edge'
  edge.textContent = o.edge
  head.appendChild(edge)
  if (dismissible) {
    const x = document.createElement('button')
    x.type = 'button'
    x.className = 'ar-btn ar-btn--on-film ar-btn--icon'
    x.setAttribute('aria-label', 'Close')
    x.innerHTML = iconSvg('close', { size: 18 })
    x.addEventListener('click', () => close())
    head.appendChild(x)
  }

  const body = document.createElement('div')
  body.className = 'ar-dialog__body'
  const h = document.createElement('h2')
  h.className = 'ar-dialog__title'
  h.id = titleId
  h.textContent = o.title
  body.appendChild(h)
  if (typeof o.body === 'string') {
    for (const para of o.body.split(/\n{2,}/)) {
      const p = document.createElement('p')
      p.textContent = para.trim()
      if (p.textContent) body.appendChild(p)
    }
  } else {
    body.appendChild(o.body)
  }

  dlg.append(head, body)

  let closed = false
  const buttons: HTMLButtonElement[] = []
  if (o.actions && o.actions.length) {
    const foot = document.createElement('div')
    foot.className = 'ar-dialog__foot'
    for (const a of o.actions) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `ar-btn ar-btn--${a.kind ?? 'secondary'}`
      b.textContent = a.label
      b.dataset.action = a.id
      b.addEventListener('click', () => {
        const keep = a.onSelect?.() === false
        if (!keep) close()
      })
      if (a.kind === 'primary' && !buttons.some((x) => x.classList.contains('ar-btn--primary'))) b.autofocus = true
      buttons.push(b)
      foot.appendChild(b)
    }
    dlg.appendChild(foot)
  }

  function close(): void {
    if (closed) return
    closed = true
    uiSound('paper-out')
    const finish = (): void => {
      try {
        dlg.close()
      } catch {
        /* already closed */
      }
      dlg.remove()
      restore?.focus?.({ preventScroll: true })
      o.onClose?.()
    }
    if (prefersReducedMotion()) finish()
    else {
      dlg.setAttribute('data-closing', '')
      window.setTimeout(finish, 160)
    }
  }

  dlg.addEventListener('cancel', (e) => {
    e.preventDefault() // we animate the close ourselves
    if (dismissible) close()
  })
  if (dismissible) {
    dlg.addEventListener('mousedown', (e) => {
      if (e.target === dlg) close() // a click on the backdrop
    })
  }
  dlg.addEventListener('close', () => {
    if (!closed) {
      closed = true
      dlg.remove()
      o.onClose?.()
    }
  })

  document.body.appendChild(dlg)
  dlg.showModal()
  uiSound('paper')
  if (!buttons.some((b) => b.autofocus)) (dlg.querySelector<HTMLElement>('.ar-dialog__body') ?? dlg).setAttribute('tabindex', '-1')
  return { el: dlg, close }
}

/** A small yes/no datasheet. Resolves true on OK, false on cancel/dismiss. */
export function confirmDialog(message: string, o: { title?: string; ok?: string; cancel?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false
    openDialog({
      edge: 'RANKIN 400 · CONFIRM',
      title: o.title ?? 'Are you sure?',
      body: message,
      actions: [
        { id: 'cancel', label: o.cancel ?? 'Cancel', kind: 'secondary' },
        {
          id: 'ok',
          label: o.ok ?? 'OK',
          kind: 'primary',
          onSelect: () => {
            answer = true
          },
        },
      ],
      onClose: () => resolve(answer),
    })
  })
}
